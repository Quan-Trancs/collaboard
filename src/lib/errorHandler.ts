export interface AppError {
  type: 'network' | 'auth' | 'validation' | 'permission' | 'notFound' | 'server' | 'unknown';
  message: string;
  originalError?: any;
  code?: string;
}

export class ErrorHandler {
  static createError(error: any, context?: string): AppError {
    // Handle ApiError with specific codes
    if (error instanceof Error && 'code' in error && 'status' in error) {
      const apiError = error as { code?: string; status: number; message: string };
      
      // Authentication error codes
      switch (apiError.code) {
        case 'NO_TOKEN':
          return {
            type: 'auth',
            message: 'You need to log in to perform this action. Please log in and try again.',
            originalError: error,
            code: 'NO_TOKEN'
          };
        
        case 'INVALID_TOKEN_FORMAT':
          return {
            type: 'auth',
            message: 'Invalid token format. Please log in again.',
            originalError: error,
            code: 'INVALID_TOKEN_FORMAT'
          };
        
        case 'INVALID_TOKEN_SIGNATURE':
          return {
            type: 'auth',
            message: 'Invalid token. Please log in again.',
            originalError: error,
            code: 'INVALID_TOKEN_SIGNATURE'
          };
        
        case 'TOKEN_EXPIRED':
          return {
            type: 'auth',
            message: 'Your session has expired. Please log in again.',
            originalError: error,
            code: 'TOKEN_EXPIRED'
          };
        
        case 'TOKEN_NOT_ACTIVE':
          return {
            type: 'auth',
            message: 'Token not active yet. Please try again later.',
            originalError: error,
            code: 'TOKEN_NOT_ACTIVE'
          };
        
        case 'INVALID_TOKEN':
          return {
            type: 'auth',
            message: 'Invalid token. Please log in again.',
            originalError: error,
            code: 'INVALID_TOKEN'
          };
        
        case 'USER_NOT_FOUND':
          return {
            type: 'auth',
            message: 'User not found. Please log in again.',
            originalError: error,
            code: 'USER_NOT_FOUND'
          };
        
        case 'INVALID_CREDENTIALS':
          return {
            type: 'auth',
            message: 'Invalid email or password. Please check your credentials and try again.',
            originalError: error,
            code: 'INVALID_CREDENTIALS'
          };
        
        case 'USER_EXISTS':
          return {
            type: 'validation',
            message: 'An account with this email already exists. Please log in instead.',
            originalError: error,
            code: 'USER_EXISTS'
          };
        
        case 'AUTH_ERROR':
          return {
            type: 'auth',
            message: 'Authentication error. Please try again.',
            originalError: error,
            code: 'AUTH_ERROR'
          };
      }
    }

    // Handle database errors
    if (error?.code) {
      switch (error.code) {
        case 42501:
          return {
            type: 'permission',
            message: 'You do not have permission to perform this action.',
            originalError: error,
            code: error.code.toString()
          };
        case 23505:
        case 11000: // MongoDB duplicate key error
          return {
            type: 'validation',
            message: 'This item already exists.',
            originalError: error,
            code: error.code.toString()
          };
        case 23503:
          return {
            type: 'validation',
            message: 'This operation cannot be completed due to related data.',
            originalError: error,
            code: error.code.toString()
          };
      }
    }

    // Handle network errors
    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      return {
        type: 'network',
        message: 'Network error. Please check your connection and try again.',
        originalError: error,
        code: 'NETWORK_ERROR'
      };
    }

    // Handle validation errors
    if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
      return {
        type: 'validation',
        message: error.message || 'Invalid data provided.',
        originalError: error,
        code: 'VALIDATION_ERROR'
      };
    }

    // Default error
    return {
      type: 'unknown',
      message: error?.message || 'An unexpected error occurred.',
      originalError: error,
      code: 'UNKNOWN_ERROR'
    };
  }

  static getToastConfig(error: AppError) {
    const baseConfig = {
      variant: 'destructive' as const,
      duration: 5000
    };

    switch (error.type) {
      case 'network':
        return {
          ...baseConfig,
          title: 'Connection Error',
          description: error.message
        };
      case 'auth':
        let title = 'Authentication Error';
        switch (error.code) {
          case 'NO_TOKEN':
            title = 'Authentication Required';
            break;
          case 'INVALID_CREDENTIALS':
            title = 'Login Failed';
            break;
          case 'TOKEN_EXPIRED':
            title = 'Session Expired';
            break;
          case 'INVALID_TOKEN_SIGNATURE':
          case 'INVALID_TOKEN':
          case 'INVALID_TOKEN_FORMAT':
            title = 'Invalid Session';
            break;
          case 'USER_NOT_FOUND':
            title = 'User Not Found';
            break;
        }
        return {
          ...baseConfig,
          title,
          description: error.message
        };
      case 'validation':
        return {
          ...baseConfig,
          title: error.code === 'USER_EXISTS' ? 'Account Exists' : 'Validation Error',
          description: error.message
        };
      case 'permission':
        return {
          ...baseConfig,
          title: 'Permission Denied',
          description: error.message
        };
      case 'notFound':
        return {
          ...baseConfig,
          title: 'Not Found',
          description: error.message
        };
      case 'server':
        return {
          ...baseConfig,
          title: 'Server Error',
          description: error.message
        };
      default:
        return {
          ...baseConfig,
          title: 'Error',
          description: error.message
        };
    }
  }

  static logError(error: AppError, context?: string) {
    // Error logged (removed console logging for production)
  }
}

export const handleAsyncError = async <T>(
  asyncFn: () => Promise<T>,
  context?: string
): Promise<{ data: T | null; error: AppError | null }> => {
  try {
    const data = await asyncFn();
    return { data, error: null };
  } catch (error) {
    const appError = ErrorHandler.createError(error, context);
    ErrorHandler.logError(appError, context);
    return { data: null, error: appError };
  }
};
