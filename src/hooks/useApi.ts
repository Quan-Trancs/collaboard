/**
 * Custom hook for API calls with loading and error states
 */

import { useState, useCallback } from 'react';
import { apiRequest, ApiError } from '@/lib/apiClient';

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export const useApi = <T = any>(options: UseApiOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (endpoint: string, requestOptions: RequestInit = {}) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiRequest<T>(endpoint, requestOptions);
        setData(result);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new Error('Request failed');
        setError(apiError);
        options.onError?.(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setError(null);
    setData(null);
  }, []);

  return { execute, loading, error, data, reset };
};

