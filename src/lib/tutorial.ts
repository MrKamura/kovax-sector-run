import { TUTORIAL_PANELS, TUTORIAL_BUFF_DURATION_MS } from "../constants";
import { getGlobalSocket } from "../components/QuestButton";

const STORAGE_CONTROLS = "kovax_tutorial_controls_seen";
const STORAGE_PANELS = "kovax_tutorial_panels_seen";

export interface TutorialState {
  showControlHints: boolean;
  showPanelHint: (typeof TUTORIAL_PANELS)[number] | null;
  tutorialActive: boolean;
  tutorialBuffExpiresAt: number | null;
  tutorialBuffRemainingSec: number;
}

/**
 * First-run tutorial state machine (was useTutorial):
 * control hints → per-panel hints → 10s immunity buff (server notified).
 */
export function createTutorialMachine() {
  let showControlHints = false;
  let seenPanels = loadSeenPanels();
  let buffExpiresAt: number | null = null;
  let buffRemainingSec = 0;
  let buffInterval: number | null = null;
  const listeners = new Set<() => void>();

  function loadSeenPanels(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_PANELS);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const stopBuffTicker = () => {
    if (buffInterval != null) {
      window.clearInterval(buffInterval);
      buffInterval = null;
    }
  };

  const startBuffTicker = () => {
    stopBuffTicker();
    const tick = () => {
      if (buffExpiresAt == null) return;
      buffRemainingSec = Math.max(
        0,
        Math.ceil((buffExpiresAt - Date.now()) / 1000)
      );
      if (buffRemainingSec <= 0) {
        buffExpiresAt = null;
        stopBuffTicker();
      }
      notify();
    };
    tick();
    buffInterval = window.setInterval(tick, 1000);
  };

  const enterGame = () => {
    const seen = localStorage.getItem(STORAGE_CONTROLS) === "1";
    showControlHints = !seen;
    notify();
  };

  const dismissControlHints = () => {
    showControlHints = false;
    localStorage.setItem(STORAGE_CONTROLS, "1");
    notify();
  };

  const dismissPanelHint = () => {
    const hint = getPanelHint();
    if (!hint) return;
    const next = new Set(seenPanels);
    next.add(hint.id);
    seenPanels = next;
    localStorage.setItem(STORAGE_PANELS, JSON.stringify([...next]));

    const allDone = next.size >= TUTORIAL_PANELS.length;
    if (allDone) {
      buffExpiresAt = Date.now() + TUTORIAL_BUFF_DURATION_MS;
      startBuffTicker();
      const socket = getGlobalSocket();
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "tutorial_complete",
            durationMs: TUTORIAL_BUFF_DURATION_MS,
          })
        );
      }
    }
    notify();
  };

  const getPanelHint = (): TutorialState["showPanelHint"] => {
    const index = TUTORIAL_PANELS.findIndex((p) => !seenPanels.has(p.id));
    return index >= 0 ? TUTORIAL_PANELS[index] : null;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const getState = (): TutorialState => {
    const panelHint = getPanelHint();
    return {
      showControlHints,
      showPanelHint: panelHint,
      tutorialActive: showControlHints || !!panelHint,
      tutorialBuffExpiresAt: buffExpiresAt,
      tutorialBuffRemainingSec: buffExpiresAt != null ? buffRemainingSec : 0,
    };
  };

  return {
    getState,
    subscribe,
    enterGame,
    dismissControlHints,
    dismissPanelHint,
    destroy: () => {
      stopBuffTicker();
      listeners.clear();
    },
  };
}

export type TutorialMachine = ReturnType<typeof createTutorialMachine>;
