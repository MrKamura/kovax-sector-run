import { SPLASH_VISIBLE_MS } from "../constants";

export interface SplashState {
  fading: boolean;
  dismissed: boolean;
}

/**
 * Splash screen state machine (was useSplash):
 * visible → fade after SPLASH_VISIBLE_MS → dismissed on animation end.
 */
export function createSplashMachine() {
  let fading = false;
  let dismissed = false;
  let fadeStarted = false;
  let timer: number | null = null;
  const listeners = new Set<() => void>();

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

export type SplashMachine = ReturnType<typeof createSplashMachine>;
