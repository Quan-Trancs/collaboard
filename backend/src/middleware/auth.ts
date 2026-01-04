import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    // Check if Authorization header exists
    if (!authHeader) {
      res.status(401).json({ 
        error: 'No token provided', 
        code: 'NO_TOKEN' 
      });
      return;
    }

    // Check if header starts with "Bearer "
    if (!authHeader.startsWith('Bearer ')) {
      res.status(400).json({ 
        error: 'Invalid token format. Expected "Bearer <token>"', 
        code: 'INVALID_TOKEN_FORMAT' 
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    // Verify token
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, jwtSecret) as { userId: string };
    } catch (error: any) {
      // Handle specific JWT errors with different HTTP status codes
      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ 
          error: 'Invalid token signature', 
          code: 'INVALID_TOKEN_SIGNATURE' 
        });
        return;
      }
      
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ 
          error: 'Token has expired', 
          code: 'TOKEN_EXPIRED' 
        });
        return;
      }
      
      if (error.name === 'NotBeforeError') {
        res.status(400).json({ 
          error: 'Token not active yet', 
          code: 'TOKEN_NOT_ACTIVE' 
        });
        return;
      }

      // Generic JWT error
      res.status(401).json({ 
        error: 'Invalid token', 
        code: 'INVALID_TOKEN' 
      });
      return;
    }
    
    // Find user by ID from token
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      res.status(404).json({ 
        error: 'User not found', 
        code: 'USER_NOT_FOUND' 
      });
      return;
    }

    // Attach user info to request
    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch (error: any) {
    // Unexpected error
    res.status(500).json({ 
      error: 'Authentication error', 
      code: 'AUTH_ERROR' 
    });
  }
};
