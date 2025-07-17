export interface AppError {
  type: 'network' | 'auth' | 'validation' | 'permission' | 'notFound' | 'server' | 'unknown';
  message: string;
  originalError?: any;
  code?: string;
}

export class ErrorHandler {
  static createError(error: any, context?: string): AppError {
    // Handle Supabase errors
    if (error?.code) {
      switch (error.code) {
        case 'PGRST116':
          return {
            type: 'notFound',
            message: 'The requested resource was not found.',
            originalError: error,
            code: error.code
          };
        case 42501:
          return {
            type: 'permission',
            message: 'You do not have permission to perform this action.',
            originalError: error,
            code: error.code
          };
        case 23505:
          return {
            type: 'validation',
            message: 'This item already exists.',
            originalError: error,
            code: error.code
          };
        case 23503:
          return {
            type: 'validation',
            message: 'This operation cannot be completed due to related data.',
            originalError: error,
            code: error.code
          };
      }
    }

    // Handle network errors
    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      return {
        type: 'network',
        message: 'Network error. Please check your connection and try again.',
        originalError: error
      };
    }

    // Handle authentication errors
    if (error?.message?.includes('auth') || error?.message?.includes('login')) {
      return {
        type: 'auth',
        message: 'Authentication failed. Please log in again.',
        originalError: error
      };
    }

    // Handle validation errors
    if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
      return {
        type: 'validation',
        message: error.message || 'Invalid data provided.',
        originalError: error
      };
    }

    // Default error
    return {
      type: 'unknown',
      message: error?.message || 'An unexpected error occurred.',
      originalError: error
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
        return {
          ...baseConfig,
          title: 'Authentication Error',
          description: error.message
        };
      case 'validation':
        return {
          ...baseConfig,
          title: 'Validation Error',
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
    if (import.meta.env.DEV) {
      console.group(`Error in ${context || 'unknown context'}`);
      console.error('Error details:', error);
      console.error('Original error:', error.originalError);
      console.groupEnd();
    }

    // In production, you could send to error reporting service
    if (import.meta.env.PROD) {
      // Example: send to Sentry, LogRocket, etc.
      // errorReportingService.captureException(error.originalError, {
      //   tags: { type: error.type, context },
      //   extra: { appError: error }
      // });
    }
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