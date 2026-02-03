"use client";

import styles from "../page.module.css";

type LevelUpOverlayProps = {
  level: number;
  onDismiss: () => void;
};

export function LevelUpOverlay({ level, onDismiss }: LevelUpOverlayProps) {
  return (
    <div
      className={styles.levelUpOverlay}
      onClick={onDismiss}
      onKeyDown={(e) => e.key === "Enter" && onDismiss()}
      role="button"
      tabIndex={0}
      aria-label="Закрыть"
    >
      <div className={styles.levelUpCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.levelUpSign}>
          <span className={styles.levelUpTitle}>Уровень</span>
          <span className={styles.levelUpNumber}>{level}</span>
        </div>
        {level === 3 && (
          <div className={styles.levelUpLevel3Info}>
            <p>Увеличены здоровье, урон и размер.</p>
            <p>Доступны жёлтые секторы уровня 2.</p>
          </div>
        )}
        <button
          className={styles.levelUpDismiss}
          onClick={onDismiss}
          type="button"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
