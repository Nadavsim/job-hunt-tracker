import { useCallback, useEffect, useState } from "react";

/** Load data once on mount, with a `reload()` for after mutations. */
export function useResource<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const stableLoad = useCallback(load, deps);

  const reload = useCallback(async () => {
    try {
      setData(await stableLoad());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [stableLoad]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
