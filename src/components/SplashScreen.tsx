import { GAME_TITLE, STUDIO_NAME } from "../constants";
import styles from "../page.module.css";

type SplashScreenProps = {
  fading: boolean;
  onAnimationEnd: () => void;
};

export function SplashScreen({ fading, onAnimationEnd }: SplashScreenProps) {
  return (
    <div
      className={`${styles.splashOverlay} ${fading ? styles.splashFadeOut : ""}`}
      onAnimationEnd={(e) => {
        if (
          e.animationName === styles.splashFadeOut ||
          e.animationName === "splashFadeOut"
        ) {
          onAnimationEnd();
        }
      }}
      role="img"
      aria-label={`A game from ${STUDIO_NAME}. ${GAME_TITLE}.`}
    >
      <div className={styles.splashContent}>
        <p className={styles.splashStudio}>A game from {STUDIO_NAME}</p>
        <h1 className={styles.splashTitle}>{GAME_TITLE}</h1>
      </div>
    </div>
  );
}
