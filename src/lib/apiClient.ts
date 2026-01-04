/**
 * API Client with retry logic, error handling, and caching
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  retries?: number;
  skipAuth?: boolean;
  cache?: boolean;
  cacheTTL?: number; // Time to live in milliseconds
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();

// Helper to get auth token
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

// Helper to clear expired cache entries
const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
    }
  }
};

// Clear expired cache every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(clearExpiredCache, 5 * 60 * 1000);
}

// Sleep helper for retries
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * API request with retry logic, caching, and error handling
 */
export const apiRequest = async <T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const {
    retries = MAX_RETRIES,
    skipAuth = false,
    cache: useCache = false,
    cacheTTL = 5 * 60 * 1000, // 5 minutes default
    ...fetchOptions
  } = options;

  // Check cache for GET requests
  if (useCache && (fetchOptions.method === undefined || fetchOptions.method === 'GET')) {
    const cacheKey = `${endpoint}${JSON.stringify(fetchOptions.body || {})}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
  }

  const token = skipAuth ? null : getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Add Authorization header if token exists and auth is not skipped
  if (token && !skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new ApiError(
            errorData.error || `Request failed with status ${response.status}`,
            response.status,
            errorData.code,
            errorData
          );
        }

        // Retry on server errors (5xx) or rate limits (429)
        if (attempt < retries && (response.status >= 500 || response.status === 429)) {
          const delay = RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff
          await sleep(delay);
          continue;
        }

        throw new ApiError(
          errorData.error || `Request failed with status ${response.status}`,
          response.status,
          errorData.code,
          errorData
        );
      }

      const data = await response.json();

      // Cache successful GET requests
      if (useCache && (fetchOptions.method === undefined || fetchOptions.method === 'GET')) {
        const cacheKey = `${endpoint}${JSON.stringify(fetchOptions.body || {})}`;
        cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl: cacheTTL,
        });
      }

      return data as T;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on network errors if it's the last attempt
      if (attempt < retries && error instanceof TypeError) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      // If it's an ApiError, throw it directly
      if (error instanceof ApiError) {
        throw error;
      }

      // Otherwise, wrap it
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // If we get here, all retries failed
  throw lastError || new ApiError('Request failed after retries', 0, 'RETRY_EXHAUSTED');
};

/**
 * Clear cache for a specific endpoint or all cache
 */
export const clearCache = (endpoint?: string) => {
  if (endpoint) {
    for (const key of cache.keys()) {
      if (key.startsWith(endpoint)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};
