import { useState, useEffect, useRef } from 'react';

export interface UseApiResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  /** true when the last fetch failed and we are serving the fallback */
  usingFallback: boolean;
}

/**
 * Simple data-fetching hook with loading/error states and mock fallback.
 *
 * On success, `data` is the API result. On error (network, API down,
 * malformed response), `data` falls back to the provided mock value so the
 * UI always renders. `usingFallback` is true whenever we are showing the
 * fallback rather than live data.
 *
 * `deps` works like the dependency array of useEffect — the fetch re-runs
 * whenever one of the values changes.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  deps: any[] = [],
): UseApiResult<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Keep a ref to the latest fallback so we can reset on re-fetch without
  // re-triggering the effect when the fallback object reference changes.
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUsingFallback(false);

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setData(fallbackRef.current);
          setUsingFallback(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, usingFallback };
}
