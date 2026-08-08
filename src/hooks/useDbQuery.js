import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppContext } from '@/context/AppContext';

/**
 * Runs an async database query function and manages loading / error / data state.
 *
 * @param {() => Promise<any>} queryFn  - A function that calls a repository method.
 * @param {any[]}              deps     - Re-run when these values change (like useEffect deps).
 *
 * @returns {{ data, loading, error, refetch }}
 *
 * @example
 * const { data: chapters, loading, error } = useDbQuery(
 *   () => getAllChapters(),
 *   []
 * );
 */
export function useDbQuery(queryFn, deps = []) {
  const { isDbReady } = useAppContext();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Keep a stable ref so we can cancel stale requests on unmount / dep change.
  const cancelRef = useRef(false);

  const run = useCallback(async () => {
    if (!isDbReady) return;

    cancelRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const result = await queryFn();
      if (!cancelRef.current) {
        setData(result);
      }
    } catch (err) {
      if (!cancelRef.current) {
        console.error('[useDbQuery]', err);
        setError(err);
      }
    } finally {
      if (!cancelRef.current) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDbReady, ...deps]);

  useEffect(() => {
    run();
    return () => {
      cancelRef.current = true;
    };
  }, [run]);

  return { data, loading, error, refetch: run };
}
