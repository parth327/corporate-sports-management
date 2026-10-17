import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/api';
import type { ListQuery, PagedResult, Resource } from '@/api';

/**
 * A tiny data layer, on purpose.
 *
 * There is no React Query here: a new developer can read these ninety lines and
 * know exactly what happens on every keystroke. The trade is no cross-component
 * cache — each screen owns its own fetch — which is the right call for an admin
 * console where freshness matters more than request count.
 */

export interface ListState<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: ApiError | null;
  /** Re-runs the current query. Call after a save. */
  refresh: () => void;
}

export function useList<T>(
  resource: Resource<T>,
  query: ListQuery = {},
  options: { enabled?: boolean } = {},
): ListState<T> {
  const enabled = options.enabled ?? true;

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  /* Serialising the query gives a stable dependency without asking every caller
     to memoise the object they pass in. */
  const key = JSON.stringify(query);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    resource
      .list(JSON.parse(key) as ListQuery, controller.signal)
      .then((result: PagedResult<T>) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof ApiError ? cause : new ApiError(String(cause), 0));
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [resource, key, enabled, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { items, total, loading, error, refresh };
}

/** Same contract, for a single record. Pass `null` to skip fetching. */
export function useRecord<T>(
  resource: Resource<T>,
  id: number | null,
): { record: T | null; loading: boolean; error: ApiError | null; refresh: () => void } {
  const [record, setRecord] = useState<T | null>(null);
  const [loading, setLoading] = useState(id !== null);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (id === null) {
      setRecord(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    resource
      .get(id, controller.signal)
      .then((value) => active && setRecord(value))
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof ApiError ? cause : new ApiError(String(cause), 0));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [resource, id, nonce]);

  return { record, loading, error, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}

/** Dropdown source: active rows only, fetched once per query. */
export function useOptions<T>(
  resource: Resource<T>,
  query: ListQuery = {},
  options: { enabled?: boolean } = {},
): { options: T[]; loading: boolean } {
  const enabled = options.enabled ?? true;
  const key = JSON.stringify(query);

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);

    resource
      .options(JSON.parse(key) as ListQuery, controller.signal)
      .then((value) => active && setRows(value))
      .catch(() => active && setRows([]))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
      controller.abort();
    };
  }, [resource, key, enabled]);

  return { options: rows, loading };
}

/** Wraps a save so the button can show a spinner and the form can show errors. */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): {
  run: (...args: TArgs) => Promise<TResult>;
  saving: boolean;
  error: ApiError | null;
  reset: () => void;
} {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: TArgs) => {
      setSaving(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (cause) {
        const apiError = cause instanceof ApiError ? cause : new ApiError(String(cause), 0);
        if (mounted.current) setError(apiError);
        throw apiError;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [fn],
  );

  return { run, saving, error, reset: useCallback(() => setError(null), []) };
}

/** Debounces a fast-changing value — used by every search box. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** Stable pagination state for list screens. */
export function usePaging(initialPageSize = 12) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  return useMemo(
    () => ({
      page,
      pageSize,
      setPage,
      setPageSize: (size: number) => {
        setPageSize(size);
        setPage(1);
      },
      reset: () => setPage(1),
    }),
    [page, pageSize],
  );
}
