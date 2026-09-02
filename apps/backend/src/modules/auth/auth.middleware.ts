import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../../utils/response';

// Extend Express Request interface to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

interface JwtPayload {
  userId: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'zeno_jwt_secret_dev_key';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token;

  if (!token) {
    sendError(res, 'Authentication required: No session token provided. Please log in.', 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded || !decoded.userId) {
      res.clearCookie('token');
      sendError(res, 'Invalid session token payload. Please log in again.', 401);
      return;
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.clearCookie('token');
    sendError(res, 'Authentication session expired or invalid. Please sign in again.', 401);
  }
};

export default authMiddleware;
