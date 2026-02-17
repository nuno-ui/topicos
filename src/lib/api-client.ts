/**
 * API client with retry logic, request deduplication, and typed helpers.
 * Provides a resilient wrapper around fetch for client-side API calls.
 */

interface ApiClientOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  deduplicate?: boolean;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
  ok: boolean;
}

const DEFAULT_OPTIONS: Required<ApiClientOptions> = {
  retries: 2,
  retryDelay: 1000,
  timeout: 30000,
  deduplicate: true,
};

// In-flight request deduplication map
const inflightRequests = new Map<string, Promise<Response>>();

function getDedupeKey(url: string, options?: RequestInit): string {
  const method = options?.method?.toUpperCase() || 'GET';
  // Only deduplicate GET requests
  if (method !== 'GET') return '';
  return `${method}:${url}`;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof TypeError) return true; // Network errors
  return false;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Core fetch function with retry and deduplication
 */
async function resilientFetch(
  url: string,
  fetchOptions: RequestInit = {},
  clientOptions: ApiClientOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...clientOptions };
  const dedupeKey = opts.deduplicate ? getDedupeKey(url, fetchOptions) : '';

  // Check for in-flight duplicate
  if (dedupeKey && inflightRequests.has(dedupeKey)) {
    return inflightRequests.get(dedupeKey)!.then(r => r.clone());
  }

  const execute = async (): Promise<Response> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= opts.retries; attempt++) {
      try {
        const response = await fetchWithTimeout(url, fetchOptions, opts.timeout);

        if (!isRetryableStatus(response.status) || attempt === opts.retries) {
          return response;
        }

        // Wait before retry with exponential backoff
        await sleep(opts.retryDelay * Math.pow(2, attempt));
      } catch (error) {
        lastError = error;

        if (!isRetryableError(error) || attempt === opts.retries) {
          throw error;
        }

        await sleep(opts.retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError;
  };

  const promise = execute();

  // Track in-flight GET requests
  if (dedupeKey) {
    inflightRequests.set(dedupeKey, promise);
    promise.finally(() => inflightRequests.delete(dedupeKey));
  }

  return promise;
}

/**
 * Type-safe API client methods
 */
export const api = {
  async get<T>(url: string, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    try {
      const response = await resilientFetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }, options);

      const data = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : null;

      if (!response.ok) {
        return { data: null, error: data?.error || `Request failed (${response.status})`, status: response.status, ok: false };
      }

      return { data: data as T, error: null, status: response.status, ok: true };
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Request timed out'
        : error instanceof Error ? error.message : 'Network error';
      return { data: null, error: message, status: 0, ok: false };
    }
  },

  async post<T>(url: string, body?: unknown, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    try {
      const response = await resilientFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      }, { ...options, deduplicate: false });

      const data = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : null;

      if (!response.ok) {
        return { data: null, error: data?.error || `Request failed (${response.status})`, status: response.status, ok: false };
      }

      return { data: data as T, error: null, status: response.status, ok: true };
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Request timed out'
        : error instanceof Error ? error.message : 'Network error';
      return { data: null, error: message, status: 0, ok: false };
    }
  },

  async patch<T>(url: string, body?: unknown, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    try {
      const response = await resilientFetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      }, { ...options, deduplicate: false });

      const data = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : null;

      if (!response.ok) {
        return { data: null, error: data?.error || `Request failed (${response.status})`, status: response.status, ok: false };
      }

      return { data: data as T, error: null, status: response.status, ok: true };
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Request timed out'
        : error instanceof Error ? error.message : 'Network error';
      return { data: null, error: message, status: 0, ok: false };
    }
  },

  async delete<T>(url: string, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    try {
      const response = await resilientFetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }, { ...options, deduplicate: false });

      const data = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : null;

      if (!response.ok) {
        return { data: null, error: data?.error || `Request failed (${response.status})`, status: response.status, ok: false };
      }

      return { data: data as T, error: null, status: response.status, ok: true };
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Request timed out'
        : error instanceof Error ? error.message : 'Network error';
      return { data: null, error: message, status: 0, ok: false };
    }
  },
};

/**
 * Custom hook-friendly fetcher for SWR-like patterns
 */
export function createFetcher<T>(options?: ApiClientOptions) {
  return async (url: string): Promise<T> => {
    const result = await api.get<T>(url, options);
    if (!result.ok) throw new Error(result.error || 'Fetch failed');
    return result.data as T;
  };
}
