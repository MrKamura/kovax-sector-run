

import { useState, useCallback, useEffect } from "react";
import { TUTORIAL_PANELS, TUTORIAL_BUFF_DURATION_MS } from "../constants";
import { getGlobalSocket } from "../components/QuestButton";

const STORAGE_CONTROLS = "kovax_tutorial_controls_seen";
const STORAGE_PANELS = "kovax_tutorial_panels_seen";

export function useTutorial(isInGame: boolean): {
  showControlHints: boolean;
  dismissControlHints: () => void;
  showPanelHint: (typeof TUTORIAL_PANELS)[number] | null;
  dismissPanelHint: () => void;
  tutorialActive: boolean;
  tutorialBuffExpiresAt: number | null;
  tutorialBuffRemainingSec: number;
} {
  const [showControlHints, setShowControlHints] = useState(false);
  const [seenPanels, setSeenPanels] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_PANELS);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  const [tutorialBuffExpiresAt, setTutorialBuffExpiresAt] = useState<number | null>(null);
  const [buffRemainingSec, setBuffRemainingSec] = useState(0);

  useEffect(() => {
    if (tutorialBuffExpiresAt == null) return;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((tutorialBuffExpiresAt - Date.now()) / 1000));
      setBuffRemainingSec(rem);
      if (rem <= 0) setTutorialBuffExpiresAt(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tutorialBuffExpiresAt]);

  const currentPanelIndex = TUTORIAL_PANELS.findIndex((p) => !seenPanels.has(p.id));
  const showPanelHint =
    currentPanelIndex >= 0 ? TUTORIAL_PANELS[currentPanelIndex] : null;

  const tutorialActive = showControlHints || !!showPanelHint;

  useEffect(() => {
    if (!isInGame) return;
    const seen = localStorage.getItem(STORAGE_CONTROLS) === "1";
    setShowControlHints(!seen);
  }, [isInGame]);

  const dismissControlHints = useCallback(() => {
    setShowControlHints(false);
    localStorage.setItem(STORAGE_CONTROLS, "1");
  }, []);

  const dismissPanelHint = useCallback(() => {
    if (!showPanelHint) return;
    const next = new Set(seenPanels);
    next.add(showPanelHint.id);
    setSeenPanels(next);
    localStorage.setItem(STORAGE_PANELS, JSON.stringify([...next]));

    const allDone = next.size >= TUTORIAL_PANELS.length;
    if (allDone) {
      const expiresAt = Date.now() + TUTORIAL_BUFF_DURATION_MS;
      setTutorialBuffExpiresAt(expiresAt);
      const socket = getGlobalSocket();
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "tutorial_complete", durationMs: TUTORIAL_BUFF_DURATION_MS }));
      }
    }
  }, [showPanelHint, seenPanels]);

  return {
    showControlHints,
    dismissControlHints,
    showPanelHint,
    dismissPanelHint,
    tutorialActive,
    tutorialBuffExpiresAt,
    tutorialBuffRemainingSec: tutorialBuffExpiresAt != null ? buffRemainingSec : 0,
  };
}
