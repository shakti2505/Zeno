import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/response';

/**
 * Maps Zod issues into a friendly array of field-level errors
 */
const formatZodError = (err: ZodError) => {
  return err.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'body',
    message: issue.message,
    code: issue.code,
  }));
};

/**
 * Comprehensive global error handler middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Operational AppError instances (intentional business/domain errors)
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // Zod schema validation errors
  if (err instanceof ZodError || err.name === 'ZodError') {
    const formattedErrors = formatZodError(err);
    const summary = formattedErrors.length === 1
      ? `Validation failed: ${formattedErrors[0].field} (${formattedErrors[0].message})`
      : `Validation failed: ${formattedErrors.length} schema requirements were not met.`;

    sendError(res, summary, 400, formattedErrors);
    return;
  }

  // Mongoose CastError (e.g. invalid MongoDB ObjectId passed in params)
  if (err instanceof mongoose.Error.CastError || err.name === 'CastError') {
    const message = `Invalid format provided for field '${err.path}': value '${err.value}' is not a valid identifier.`;
    sendError(res, message, 400, { field: err.path, value: err.value });
    return;
  }

  // Mongoose Document Validation Errors
  if (err instanceof mongoose.Error.ValidationError || err.name === 'ValidationError') {
    const errorDetails = Object.values(err.errors).map((item: any) => ({
      field: item.path,
      message: item.message,
      kind: item.kind,
    }));
    const message = `Document validation failed: ${errorDetails.map((e) => e.message).join('; ')}`;
    sendError(res, message, 422, errorDetails);
    return;
  }

  // MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
    const duplicateKeys = Object.keys(err.keyPattern || err.keyValue || {});
    const field = duplicateKeys.length > 0 ? duplicateKeys.join(', ') : 'field';
    const value = err.keyValue ? JSON.stringify(err.keyValue) : '';
    const message = `An entity with this ${field} already exists. Please provide unique values.`;
    sendError(res, message, 409, { duplicateField: field, duplicateValue: value });
    return;
  }

  // JWT Verification and Token Expiration Errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Authentication token is invalid or corrupted. Please log in again.', 401);
    return;
  }
  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Your session has expired. Please log in again to continue.', 401);
    return;
  }

  // Malformed JSON payload syntax error
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    sendError(res, 'Malformed JSON payload received in request body. Please check syntax.', 400);
    return;
  }

  // Unhandled / Unexpected Server Errors
  console.error(' [Unhandled Error Captured]:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  const isDev = process.env.NODE_ENV !== 'production';
  const message = isDev
    ? `Server encounter: ${err.message || 'An unexpected runtime issue occurred'}`
    : 'Unable to complete request due to an unexpected system state. Our team has been alerted.';

  const errorDetails = isDev ? { stack: err.stack, raw: err.toString() } : undefined;

  sendError(res, message, 500, errorDetails);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const message = `Route not found: ${req.method} ${req.originalUrl}. Please check the endpoint URI and HTTP method.`;
  sendError(res, message, 404);
};

export default errorHandler;
