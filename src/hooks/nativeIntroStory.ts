/**
 * Native hooks for intro story machine (аналог useIntroStory)
 */

import { INTRO_STORY_TEXT, TYPEWRITER_MS } from "../constants";

/**
 * Состояние intro story
 */
export interface IntroStoryState {
  chars: number;
  canProceed: boolean;
  dismissed: boolean;
  showKeeperSelectionAfterIntro: boolean;
}

/**
 * Intro story machine (аналог useIntroStory)
 */
export interface IntroStoryMachine {
  getState(): IntroStoryState;
  subscribe(listener: () => void): () => void;
  enter(userShipChoice: string | null): void;
  leave(): void;
  dismiss(): void;
  skipToEnd(): void;
  destroy(): void;
}

/**
 * Создать intro story machine
 */
export function createIntroStoryMachine(): IntroStoryMachine {
  let chars = 0;
  let canProceed = false;
  let dismissed = false;
  let showKeeperSelectionAfterIntro = false;
  let justEntered = false;
  let hadShipWhenIntroShown = false;
  let interval: number | null = null;
  const listeners: Set<() => void> = new Set();

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const stopTyping = () => {
    if (interval != null) {
      window.clearInterval(interval);
      interval = null;
    }
  };

  const startTyping = () => {
    stopTyping();
    interval = window.setInterval(() => {
      if (chars >= INTRO_STORY_TEXT.length) {
        stopTyping();
        return;
      }
      chars += 1;
      if (chars >= INTRO_STORY_TEXT.length) {
        canProceed = true;
        stopTyping();
      }
      notify();
    }, TYPEWRITER_MS);
  };

  /** Called while the intro overlay is visible. */
  const enter = (userShipChoice: string | null) => {
    hadShipWhenIntroShown = hadShipWhenIntroShown || !!userShipChoice;
    if (!justEntered) {
      justEntered = true;
      queueMicrotask(() => {
        chars = 0;
        canProceed = false;
        notify();
        startTyping();
      });
    }
  };

  /** Called when the intro overlay is hidden. */
  const leave = () => {
    justEntered = false;
    stopTyping();
  };

  const dismiss = () => {
    showKeeperSelectionAfterIntro = !hadShipWhenIntroShown;
    dismissed = true;
    stopTyping();
    notify();
  };

  const skipToEnd = () => {
    chars = INTRO_STORY_TEXT.length;
    canProceed = true;
    stopTyping();
    notify();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState: (): IntroStoryState => ({
      chars,
      canProceed,
      dismissed,
      showKeeperSelectionAfterIntro,
    }),
    subscribe,
    enter,
    leave,
    dismiss,
    skipToEnd,
    destroy: () => {
      stopTyping();
      listeners.clear();
    },
  };
}

