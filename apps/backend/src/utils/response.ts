import { Response } from 'express';

export interface ApiResponsePayload<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
  meta?: Record<string, any>;
  timestamp: string;
}

/**
 * Generic response sender ensuring uniform JSON envelope across all endpoints
 */
export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  success: boolean,
  message?: string,
  data?: T,
  errors?: any,
  meta?: Record<string, any>
): Response => {
  const payload: ApiResponsePayload<T> = {
    success,
    ...(message !== undefined && { message }),
    ...(data !== undefined && { data }),
    ...(errors !== undefined && { errors }),
    ...(meta !== undefined && { meta }),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(payload);
};

/**
 * Helper to send successful HTTP 200 responses
 */
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message: string = 'Request processed successfully',
  statusCode: number = 200,
  meta?: Record<string, any>
): Response => {
  return sendResponse(res, statusCode, true, message, data, undefined, meta);
};

/**
 * Helper to send HTTP 201 Created responses
 */
export const sendCreated = <T>(
  res: Response,
  data?: T,
  message: string = 'Resource created successfully',
  meta?: Record<string, any>
): Response => {
  return sendResponse(res, 201, true, message, data, undefined, meta);
};

/**
 * Helper to send structured error responses
 */
export const sendError = (
  res: Response,
  message: string = 'An error occurred during request processing',
  statusCode: number = 500,
  errors?: any
): Response => {
  return sendResponse(res, statusCode, false, message, undefined, errors);
};
