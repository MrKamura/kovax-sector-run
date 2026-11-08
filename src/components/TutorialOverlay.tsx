

import styles from "../page.module.css";

type ControlHintsProps = {
  onDismiss: () => void;
};

export function ControlHintsOverlay({ onDismiss }: ControlHintsProps) {
  return (
    <div className={styles.tutorialOverlay} role="dialog" aria-label="Управление">
      <div className={styles.tutorialCard}>
        <h2 className={styles.tutorialTitle}>Управление</h2>
        <ul className={styles.tutorialList}>
          <li>
            <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> или стрелки — движение
          </li>
          <li>
            <kbd>Пробел</kbd> — стрельба
          </li>
        </ul>
        <button
          type="button"
          className={styles.tutorialOkButton}
          onClick={onDismiss}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

type PanelHintProps = {
  title: string;
  description: string;
  onDismiss: () => void;
};

export function PanelHintOverlay({ title, description, onDismiss }: PanelHintProps) {
  return (
    <div className={styles.tutorialOverlay} role="dialog" aria-label={title}>
      <div className={styles.tutorialCard}>
        <h2 className={styles.tutorialTitle}>{title}</h2>
        <p className={styles.tutorialDescription}>{description}</p>
        <button
          type="button"
          className={styles.tutorialOkButton}
          onClick={onDismiss}
        >
          OK
        </button>
      </div>
    </div>
  );
}
