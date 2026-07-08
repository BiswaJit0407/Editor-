import { useCallback, useRef, useState } from "react";

export function useHistoryState<T>(initial: T, cap = 50) {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const set = useCallback((updater: T | ((s: T) => T)) => {
    setState((prev) => {
      const next = typeof updater === "function" ? (updater as (s: T) => T)(prev) : updater;
      if (Object.is(prev, next)) return prev;
      past.current.push(prev);
      if (past.current.length > cap) past.current.shift();
      future.current = [];
      bump();
      return next;
    });
  }, [cap]);

  // Replace without touching history (e.g., loader hydration).
  const replace = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    setState(next);
    bump();
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      const last = past.current.pop();
      if (last === undefined) return prev;
      future.current.push(prev);
      bump();
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const next = future.current.pop();
      if (next === undefined) return prev;
      past.current.push(prev);
      bump();
      return next;
    });
  }, []);

  return {
    state,
    set,
    replace,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    _tick: tick,
  };
}