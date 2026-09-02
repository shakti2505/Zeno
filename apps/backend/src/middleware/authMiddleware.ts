import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ message: 'Unauthorized: No token provided' });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET || 'zeno_jwt_secret_dev_key';

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    if (!decoded || !decoded.userId) {
      res.clearCookie('token');
      res.status(401).json({ message: 'Unauthorized: Invalid token payload' });
      return;
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.clearCookie('token');
    res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
};

export default authMiddleware;
