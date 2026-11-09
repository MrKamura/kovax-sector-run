export type StoreListener<T> = (state: T, prev: T) => void;

export interface Store<T extends object> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T> | void)) => void;
  subscribe: (listener: StoreListener<T>) => () => void;
}

/**
 * Minimal vanilla store (replaces zustand + immer middleware).
 *
 * `setState` accepts either:
 * - a partial state object to merge, or
 * - a mutator that receives the current state and mutates it in place
 *   (or returns a partial to merge).
 *
 * After every update subscribers are called with `(state, prev)`,
 * matching the zustand `subscribe` signature used across the client.
 */
export function createStore<T extends object>(initial: T): Store<T> {
  let state: T = initial;
  const listeners = new Set<StoreListener<T>>();

  const getState = (): T => state;

  const setState = (
    partial: Partial<T> | ((state: T) => Partial<T> | void)
  ): void => {
    const prev = state;
    if (typeof partial === "function") {
      const result = (partial as (s: T) => Partial<T> | void)(state);
      state = result ? { ...state, ...result } : { ...state };
    } else {
      state = { ...state, ...partial };
    }
    for (const listener of [...listeners]) {
      listener(state, prev);
    }
  };

  const subscribe = (listener: StoreListener<T>): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { getState, setState, subscribe };
}
