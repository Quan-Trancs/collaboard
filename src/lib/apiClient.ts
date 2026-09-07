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

interface RequestOptions extends Omit<RequestInit, 'cache'> {
  retries?: number;
  skipAuth?: boolean;
  useCache?: boolean; // Custom cache flag (different from native RequestInit.cache)
  cacheTTL?: number; // Time to live in milliseconds
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();
let cacheEpoch = 0;

// Helper to get auth token
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

const makeCacheKey = (endpoint: string, body: unknown) => {
  const token = getAuthToken() || 'anon';
  return `${token}:${endpoint}:${JSON.stringify(body ?? {})}`;
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
    useCache = false,
    cacheTTL = 5 * 60 * 1000, // 5 minutes default
    ...fetchOptions
  } = options;

  const epochAtStart = cacheEpoch;
  const tokenAtStart = skipAuth ? null : getAuthToken();

  // Check cache for GET requests (keyed by auth token so users never share lists)
  if (useCache && (fetchOptions.method === undefined || fetchOptions.method === 'GET')) {
    const cached = cache.get(makeCacheKey(endpoint, fetchOptions.body));
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
  }

  const token = tokenAtStart;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
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

        // Don't retry on client errors (4xx), including 429 — retries make rate limits worse
        if (response.status >= 400 && response.status < 500) {
          throw new ApiError(
            errorData.error || `Request failed with status ${response.status}`,
            response.status,
            errorData.code,
            errorData
          );
        }

        // Retry on server errors (5xx)
        if (attempt < retries && response.status >= 500) {
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

      // Skip cache writes if auth changed while this request was in flight
      if (
        useCache &&
        epochAtStart === cacheEpoch &&
        tokenAtStart === getAuthToken() &&
        (fetchOptions.method === undefined || fetchOptions.method === 'GET')
      ) {
        cache.set(makeCacheKey(endpoint, fetchOptions.body), {
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
  if (!endpoint) {
    cache.clear();
    cacheEpoch += 1;
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(`:${endpoint}`) || key.includes(endpoint)) {
      cache.delete(key);
    }
  }
};
