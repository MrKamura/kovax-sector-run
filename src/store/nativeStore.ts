/**
 * Native store - аналог Zustand без React зависимостей
 * Поддерживает подписку, get/set состояния
 */

export interface StoreListener<T extends object> {
  (state: T, prevState: T): void;
}

export interface Store<T extends object> {
  getState(): T;
  setState(partial: Partial<T> | ((state: T) => Partial<T> | void)): void;
  subscribe(listener: StoreListener<T>): () => void;
}

export type StateSelector<T extends object, R> = (state: T) => R;

export interface UseStoreOptions<T extends object> {
  equalityFn?: (a: T, b: T) => boolean;
}

/**
 * Создает store с начальным состоянием
 */
export function createNativeStore<T extends object>(initial: T): Store<T> {
  let state: T = initial;
  const listeners: Set<StoreListener<T>> = new Set();

  const getState = (): T => state;

  const setState = (
    partial: Partial<T> | ((state: T) => Partial<T> | void)
  ): void => {
    const prev = state;
    if (typeof partial === 'function') {
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

/**
 * Подписка на изменения store (аналог subscribe)
 */
export function subscribeToStore<T extends object>(
  store: Store<T>,
  listener: StoreListener<T>
): () => void {
  return store.subscribe(listener);
}

/**
 * Получить текущее состояние
 */
export function getStoreState<T extends object>(store: Store<T>): T {
  return store.getState();
}

/**
 * Обновить состояние
 */
export function setStoreState<T extends object>(
  store: Store<T>,
  partial: Partial<T> | ((state: T) => Partial<T> | void)
): void {
  store.setState(partial);
}

/**
 * Извлечь подвыборку из состояния (аналог selector)
 */
export function useStoreSelector<T extends object, R>(
  store: Store<T>,
  selector: StateSelector<T, R>
): R {
  return selector(store.getState());
}