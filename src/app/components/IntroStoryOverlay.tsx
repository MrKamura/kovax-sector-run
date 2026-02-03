"use client";

import { INTRO_STORY_TEXT } from "../constants";
import styles from "../page.module.css";

type IntroStoryOverlayProps = {
  charsShown: number;
  canProceed: boolean;
  onProceed: () => void;
  onSkip: () => void;
};

export function IntroStoryOverlay({
  charsShown,
  canProceed,
  onProceed,
  onSkip,
}: IntroStoryOverlayProps) {
  return (
    <div className={styles.introStoryOverlay}>
      <div className={styles.introStoryContent}>
        <p className={styles.introStoryText}>
          {INTRO_STORY_TEXT.slice(0, charsShown)}
          {charsShown < INTRO_STORY_TEXT.length && (
            <span className={styles.introStoryCursor}>|</span>
          )}
        </p>
      </div>
      <button
        type="button"
        className={
          canProceed ? styles.introStoryProceed : styles.introStorySkip
        }
        onClick={() => (canProceed ? onProceed() : onSkip())}
      >
        {canProceed ? "Выберите форму" : "Пропустить историю"}
      </button>
    </div>
  );
}
