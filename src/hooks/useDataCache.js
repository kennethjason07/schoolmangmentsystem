import { useRef, useState, useCallback, useMemo } from 'react';

// Simple generic cache hook with TTL
// get(key, maxAgeMs?), set(key, data), invalidate(key), clear(), stats()
export default function useDataCache(defaultTtlMs = 5 * 60 * 1000) {
  const ref = useRef(new Map());
  const [, force] = useState(0);

  const touch = () => force(v => v + 1);

  const get = useCallback((key, maxAgeMs = defaultTtlMs) => {
    const entry = ref.current.get(key);
    if (!entry) return null;
    const expired = Date.now() - entry.t > maxAgeMs;
    if (expired) {
      ref.current.delete(key);
      touch();
      return null;
    }
    return entry.v;
  }, [defaultTtlMs]);

  const set = useCallback((key, value) => {
    ref.current.set(key, { v: value, t: Date.now() });
    touch();
  }, []);

  const invalidate = useCallback((key) => {
    if (ref.current.has(key)) {
      ref.current.delete(key);
      touch();
    }
  }, []);

  const clear = useCallback(() => {
    if (ref.current.size > 0) {
      ref.current.clear();
      touch();
    }
  }, []);

  const stats = useCallback(() => ({ size: ref.current.size }), []);

  // Return a stable reference to prevent infinite re-renders
  return useMemo(() => ({ get, set, invalidate, clear, stats }), [get, set, invalidate, clear, stats]);
}
