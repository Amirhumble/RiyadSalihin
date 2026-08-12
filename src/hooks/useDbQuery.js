import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppContext } from '@/context/AppContext';

// Runs an async DB query and tracks data / loading / error.
// Waits until the database is ready before querying.
// refetch({ silent: true }) refreshes without showing the full-screen loader.
export function useDbQuery(queryFn, deps = []) {
  const { isDbReady } = useAppContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelRef = useRef(false);
  const hasDataRef = useRef(false);

  const run = useCallback(async (options = {}) => {
    if (!isDbReady) return;

    const silent = options?.silent === true && hasDataRef.current;
    cancelRef.current = false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await queryFn();
      if (!cancelRef.current) {
        setData(result);
        hasDataRef.current = true;
        setError(null);
      }
    } catch (err) {
      if (!cancelRef.current) {
        console.error('[useDbQuery]', err);
        setError(err);
      }
    } finally {
      if (!cancelRef.current && !silent) {
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
