/**
 * Native hooks for splash machine (аналог useSplash)
 */

import { SPLASH_VISIBLE_MS } from "../constants";

/**
 * Состояние splash
 */
export interface SplashState {
  fading: boolean;
  dismissed: boolean;
}

/**
 * Splash machine (аналог useSplash)
 */
export interface SplashMachine {
  getState(): SplashState;
  subscribe(listener: () => void): () => void;
  enter(): void;
  leave(): void;
  handleFadeEnd(): void;
  destroy(): void;
}

/**
 * Создать splash machine
 */
export function createSplashMachine(): SplashMachine {
  let fading = false;
  let dismissed = false;
  let fadeStarted = false;
  let timer: number | null = null;
  const listeners: Set<() => void> = new Set();

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const enter = () => {
    if (fadeStarted) return;
    fadeStarted = true;
    timer = window.setTimeout(() => {
      fading = true;
      notify();
    }, SPLASH_VISIBLE_MS);
  };

  const leave = () => {
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const handleFadeEnd = () => {
    if (fading) dismissed = true;
    fadeStarted = false;
    fading = false;
    timer = null;
    notify();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState: (): SplashState => ({ fading, dismissed }),
    subscribe,
    enter,
    leave,
    handleFadeEnd,
    destroy: () => {
      leave();
      listeners.clear();
    },
  };
}

