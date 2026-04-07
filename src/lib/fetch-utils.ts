/**
 * Safe JSON fetch utilities with proper error handling, timeout, and retry support
 * @module lib/fetch-utils
 */

/**
 * Result type for safeFetch operations
 */
export interface SafeFetchResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Options for safe fetch operations
 */
export interface SafeFetchOptions extends RequestInit {
  /** Skip automatic JSON parsing of response */
  rawResponse?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts for transient failures (default: 0) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Default timeout for fetch requests (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Default number of retry attempts
 */
const DEFAULT_RETRIES = 0;

/**
 * Default delay between retries
 */
const DEFAULT_RETRY_DELAY = 1000;

/**
 * Error class for timeout errors
 */
export class FetchTimeoutError extends Error {
  constructor(url: string, timeout: number) {
    super(`Request to ${url} timed out after ${timeout}ms`);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * Check if error is a transient/retryable error
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    // Timeout errors should be retried
    if (error.name === 'AbortError') {
      return true;
    }
    // Network errors should be retried
    if (error instanceof TypeError) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('connection')
      );
    }
  }
  if (error instanceof FetchTimeoutError) {
    return true;
  }
  return false;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe JSON fetch with error handling, timeout, and retry support.
 * Returns { data, error } pattern for safe error handling.
 * 
 * @example
 * const { data, error } = await safeFetch<User>('/api/user');
 * if (error) {
 *   console.error(error);
 *   return;
 * }
 * // use data safely
 * 
 * @example With timeout and retries
 * const { data, error } = await safeFetch<User>('/api/user', {
 *   timeout: 5000,
 *   retries: 3,
 *   retryDelay: 1000
 * });
 */
export async function safeFetch<T>(
  url: string,
  options?: SafeFetchOptions
): Promise<SafeFetchResult<T>> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY;
  
  // Remove our custom options from the RequestInit
  const { rawResponse, timeout: _, retries: __, retryDelay: ___, ...fetchOptions } = options || {};
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
          ...fetchOptions.headers
        }
      });

      // Clear timeout
      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Response might not be JSON
          try {
            const text = await response.text();
            if (text) errorMessage = text;
          } catch {
            // Ignore parse errors
          }
        }
        return { data: null, error: errorMessage };
      }

      // Handle raw response if requested
      if (rawResponse) {
        return { data: await response.text() as unknown as T, error: null };
      }

      // Parse successful response
      const data = await response.json() as T;
      return { data, error: null };
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Check if it's a timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new FetchTimeoutError(url, timeout);
      } else {
        lastError = error instanceof Error ? error : new Error('Network error');
      }
      
      // If this is a transient error and we have retries left, wait and retry
      if (isTransientError(error) && attempt < retries) {
        console.warn(`[Fetch] Attempt ${attempt + 1}/${retries + 1} failed for ${url}, retrying in ${retryDelay}ms...`);
        await sleep(retryDelay * (attempt + 1)); // Exponential backoff
        continue;
      }
      
      // No more retries or non-transient error
      break;
    }
  }
  
  return {
    data: null,
    error: lastError?.message || 'Network error'
  };
}

/**
 * Safe JSON parse with fallback.
 * Returns the fallback value if parsing fails.
 * 
 * @example
 * const data = safeJsonParse<{ id: string }>(jsonString, { id: '' });
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safe JSON parse that returns unknown type.
 * Returns null if parsing fails.
 * Use this when you need to validate the result separately.
 * 
 * @example
 * const data = safeJsonParseUnknown(jsonString);
 * if (data && typeof data === 'object' && 'id' in data) {
 *   // data is now narrowed
 * }
 */
export function safeJsonParseUnknown(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper that throws on error.
 * Use this when you want to use try/catch pattern.
 * 
 * @example
 * try {
 *   const user = await fetchJson<User>('/api/user');
 *   // use user
 * } catch (error) {
 *   console.error(error);
 * }
 */
export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers
    }
  });

  if (!response.ok) {
    // Try to get error from response
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Try text if not JSON
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Ignore
      }
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

/**
 * Safely parse response JSON with error handling.
 * Returns null if response is not OK or JSON parsing fails.
 * 
 * @example
 * const response = await fetch('/api/user');
 * const data = await safeResponseJson<User>(response);
 * if (!data) {
 *   // handle error
 * }
 */
export async function safeResponseJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) {
    return null;
  }
  
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

/**
 * Extract error message from a failed response.
 * Useful when you need to get the error from response.json() safely.
 * 
 * @example
 * const response = await fetch('/api/user', { method: 'POST', body: JSON.stringify(data) });
 * if (!response.ok) {
 *   const error = await extractResponseError(response);
 *   setError(error);
 * }
 */
export async function extractResponseError(response: Response): Promise<string> {
  try {
    const errorData = await response.json();
    return errorData.error || errorData.message || `Request failed with status ${response.status}`;
  } catch {
    try {
      const text = await response.text();
      return text || `Request failed with status ${response.status}`;
    } catch {
      return `Request failed with status ${response.status}`;
    }
  }
}
