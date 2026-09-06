import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, IUser } from './user.model';
import { BadRequestError, UnauthorizedError, ConflictError } from '../../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'zeno_jwt_secret_dev_key';
const JWT_EXPIRES_IN = '7d';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
  token: string;
}

/**
 * Registers a new user with atomic unique constraint protection
 */
export const registerUser = async (email: string, password: string): Promise<AuthResponse> => {
  const normalizedEmail = email?.toLowerCase()?.trim();

  if (!email || !password) {
    throw new BadRequestError('Both email and password are required for registration');
  }

  if (password.length < 6) {
    throw new BadRequestError('Password must be at least 6 characters in length');
  }

  // Pre-check for clear UX (unique index enforces atomicity at DB level)
  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    throw new ConflictError(`An account with email '${normalizedEmail}' already exists. Please log in instead.`);
  }

  const user = new User({
    email: normalizedEmail,
    password,
  });
  await user.save();

  const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token,
  };
};

/**
 * Logs in a user using lean() unhydrated query and bcrypt compare
 */
export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const normalizedEmail = email?.toLowerCase()?.trim();

  if (!email || !password) {
    throw new BadRequestError('Please provide both email and password to log in');
  }

  // Fetch unhydrated user document with lean() for optimal performance
  const user = await User.findOne({ email: normalizedEmail }).lean();
  if (!user) {
    throw new UnauthorizedError('No account found with this email address. Please check your email or create an account.');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Incorrect password. Please verify your password and try again.');
  }

  const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token,
  };
};

/**
 * Fetches user profile unhydrated with lean()
 */
export const getUserById = async (userId: string): Promise<any | null> => {
  return User.findById(userId).select('-password').lean();
};
