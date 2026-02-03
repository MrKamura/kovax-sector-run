"use client";

import styles from "../page.module.css";

type ExitOverlayProps = {
  countdown: number;
};

export function ExitOverlay({ countdown }: ExitOverlayProps) {
  return (
    <div className={styles.exitOverlay} aria-live="polite">
      <div className={styles.exitCard}>
        <p className={styles.exitText}>Выход из игры…</p>
        <p className={styles.exitCountdown}>
          Отключение через {countdown} сек.
        </p>
        <p className={styles.exitHint}>
          Персонаж сохранён и недоступен для атак.
        </p>
      </div>
    </div>
  );
}
