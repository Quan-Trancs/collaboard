import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get JWT configuration - use lazy evaluation to ensure .env is loaded first
const getJWTSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production. Please set it in your .env file.');
    }
    return 'your-secret-key-change-in-production';
  }
  return secret;
};

const getJWTExpiresIn = (): string => {
  return process.env.JWT_EXPIRES_IN || '7d';
};

// Register
router.post('/register', validate(schemas.register), asyncHandler(async (req: express.Request, res: Response) => {
  const { email, password, name } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(409).json({ 
      error: 'User already exists', 
      code: 'USER_EXISTS' 
    });
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await User.create({
    email,
    password: hashedPassword,
    name,
  });

  // Generate token
  const tokenPayload = { userId: user._id.toString() };
  const token = jwt.sign(
    tokenPayload, 
    getJWTSecret(), 
    { expiresIn: getJWTExpiresIn() } as jwt.SignOptions
  ) as string;

  res.status(201).json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    },
    token,
  });
}));

// Login
router.post('/login', validate(schemas.login), asyncHandler(async (req: express.Request, res: Response) => {
  const { email, password } = req.body;

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    res.status(401).json({ 
      error: 'Invalid credentials', 
      code: 'INVALID_CREDENTIALS' 
    });
    return;
  }

  // Check password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    res.status(401).json({ 
      error: 'Invalid credentials', 
      code: 'INVALID_CREDENTIALS' 
    });
    return;
  }

  // Generate token
  const tokenPayload = { userId: user._id.toString() };
  const token = jwt.sign(
    tokenPayload, 
    getJWTSecret(), 
    { expiresIn: getJWTExpiresIn() } as jwt.SignOptions
  ) as string;

  res.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    },
    token,
  });
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId).select('-password');
  if (!user) {
    res.status(404).json({ 
      error: 'User not found', 
      code: 'USER_NOT_FOUND' 
    });
    return;
  }

  res.json({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  });
}));

// Update user profile
router.put('/profile', authenticate, validate(schemas.updateProfile), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, avatar_url } = req.body;
  const updates: Record<string, any> = {};

  if (name) updates.name = name;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;

  const user = await User.findByIdAndUpdate(
    req.userId,
    updates,
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    res.status(404).json({ 
      error: 'User not found', 
      code: 'USER_NOT_FOUND' 
    });
    return;
  }

  res.json({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  });
}));

export default router;
