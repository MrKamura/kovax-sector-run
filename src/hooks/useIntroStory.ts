import { useEffect, useState, useRef } from "react";
import { INTRO_STORY_TEXT, TYPEWRITER_MS } from "../constants";

export function useIntroStory(
  showIntroStory: boolean,
  userShipChoice: string | null
): {
  introStoryChars: number;
  introStoryCanProceed: boolean;
  introStoryDismissed: boolean;
  showKeeperSelectionAfterIntro: boolean;
  dismiss: () => void;
  skipToEnd: () => void;
} {
  const [introStoryChars, setIntroStoryChars] = useState(0);
  const [introStoryCanProceed, setIntroStoryCanProceed] = useState(false);
  const [introStoryDismissed, setIntroStoryDismissed] = useState(false);
  const [showKeeperSelectionAfterIntro, setShowKeeperSelectionAfterIntro] =
    useState(false);
  const introStoryJustEntered = useRef(false);
  const hadShipWhenIntroShown = useRef(false);

  useEffect(() => {
    if (showIntroStory) {
      hadShipWhenIntroShown.current =
        hadShipWhenIntroShown.current || !!userShipChoice;
      if (!introStoryJustEntered.current) {
        introStoryJustEntered.current = true;
        queueMicrotask(() => {
          setIntroStoryChars(0);
          setIntroStoryCanProceed(false);
        });
      }
    } else {
      introStoryJustEntered.current = false;
    }
  }, [showIntroStory, userShipChoice]);
  useEffect(() => {
    if (showIntroStory && introStoryChars >= INTRO_STORY_TEXT.length) {
      queueMicrotask(() => setIntroStoryCanProceed(true));
    }
  }, [showIntroStory, introStoryChars]);
  useEffect(() => {
    if (!showIntroStory || introStoryChars >= INTRO_STORY_TEXT.length) return;
    const id = setInterval(() => {
      setIntroStoryChars((n) =>
        n >= INTRO_STORY_TEXT.length ? n : n + 1
      );
    }, TYPEWRITER_MS);
    return () => clearInterval(id);
  }, [showIntroStory, introStoryChars]);

  const dismiss = () => {
    setShowKeeperSelectionAfterIntro(!hadShipWhenIntroShown.current);
    setIntroStoryDismissed(true);
  };
  const skipToEnd = () => {
    setIntroStoryChars(INTRO_STORY_TEXT.length);
    setIntroStoryCanProceed(true);
  };

  return {
    introStoryChars,
    introStoryCanProceed,
    introStoryDismissed,
    showKeeperSelectionAfterIntro,
    dismiss,
    skipToEnd,
  };
}
