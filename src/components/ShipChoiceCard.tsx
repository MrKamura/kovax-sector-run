import type { KeeperFormDisplay } from "../types";
import type { KeeperKey } from "../types";
import styles from "../page.module.css";

type ShipChoiceCardProps = {
  keeperKey: KeeperKey;
  display: KeeperFormDisplay;
  maxHp: number;
  maxDmg: number;
  maxSpd: number;
  pct: (value: number, max: number) => number;
  onSelect: () => void;
  disabled?: boolean;
  selected?: boolean;
};

const PREVIEW_CLASS: Record<KeeperKey, string> = {
  keeper19: styles.monsterPreviewFast,
  keeper20: styles.monsterPreviewTank,
};

export function ShipChoiceCard({
  keeperKey,
  display,
  maxHp,
  maxDmg,
  maxSpd,
  pct,
  onSelect,
  disabled,
  selected,
}: ShipChoiceCardProps) {
  const previewClass = PREVIEW_CLASS[keeperKey];
  return (
    <button
      type="button"
      className={`${styles.secondaryButton} ${styles.monsterButton}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className={`${styles.monsterPreview} ${previewClass}`} />
      <div className={styles.monsterInfo}>
        <div className={styles.monsterLabelRow}>
          <span className={styles.monsterLabel}>{display.name}</span>
          <span className={styles.monsterLevel}>Lv.{display.level}</span>
        </div>
        <div className={styles.monsterStatRows}>
          <div className={styles.monsterStatRow}>
            <span className={styles.monsterStatName}>Скорость</span>
            <div className={styles.monsterStatBar}>
              <div
                className={styles.monsterStatFill}
                style={{ width: `${pct(display.spd, maxSpd)}%` }}
              />
              <span className={styles.monsterStatBarValue}>{display.spd}</span>
            </div>
          </div>
          <div className={styles.monsterStatRow}>
            <span className={styles.monsterStatName}>Урон</span>
            <div className={styles.monsterStatBar}>
              <div
                className={styles.monsterStatFill}
                style={{ width: `${pct(display.dmg, maxDmg)}%` }}
              />
              <span className={styles.monsterStatBarValue}>{display.dmg}</span>
            </div>
          </div>
          <div className={styles.monsterStatRow}>
            <span className={styles.monsterStatName}>HP</span>
            <div className={styles.monsterStatBar}>
              <div
                className={styles.monsterStatFill}
                style={{ width: `${pct(display.hp, maxHp)}%` }}
              />
              <span className={styles.monsterStatBarValue}>{display.hp}</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
