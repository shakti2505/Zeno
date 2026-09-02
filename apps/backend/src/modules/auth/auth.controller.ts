import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { NotFoundError, UnauthorizedError } from '../../utils/AppError';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: COOKIE_MAX_AGE,
});

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.registerUser(email, password);

    res.cookie('token', token, getCookieOptions());
    sendCreated(res, { user }, 'Account registered successfully. Authentication session established.');
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.loginUser(email, password);

    res.cookie('token', token, getCookieOptions());
    sendSuccess(res, { user }, 'Logged in successfully. Authentication session established.');
  } catch (error) {
    next(error);
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  });
  sendSuccess(res, null, 'Logged out successfully. Authentication session cleared.');
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      throw new UnauthorizedError('No active user session found. Please log in.');
    }

    const user = await authService.getUserById(req.userId);
    if (!user) {
      throw new NotFoundError('User profile corresponding to this session was not found.');
    }

    sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      'User profile fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};
