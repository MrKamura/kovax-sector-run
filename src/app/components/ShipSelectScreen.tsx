"use client";

import { GAME_TITLE } from "../constants";
import { ShipChoiceCard } from "./ShipChoiceCard";
import type { KeeperFormDisplay } from "../types";
import type { KeeperKey } from "../types";
import styles from "../page.module.css";

type ShipSelectScreenProps = {
  formA: KeeperFormDisplay;
  formB: KeeperFormDisplay;
  maxHp: number;
  maxDmg: number;
  maxSpd: number;
  pct: (value: number, max: number) => number;
  onSelectKeeper: (key: KeeperKey) => void;
  onLogout: () => void;
  authError: string | null;
};

export function ShipSelectScreen({
  formA,
  formB,
  maxHp,
  maxDmg,
  maxSpd,
  pct,
  onSelectKeeper,
  onLogout,
  authError,
}: ShipSelectScreenProps) {
  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <p className={styles.authGameTitle}>{GAME_TITLE}</p>
        <h2 className={styles.authTitle}>Выберите форму кипера</h2>
        <div className={styles.shipGrid}>
          <ShipChoiceCard
            keeperKey="keeper19"
            display={formA}
            maxHp={maxHp}
            maxDmg={maxDmg}
            maxSpd={maxSpd}
            pct={pct}
            onSelect={() => onSelectKeeper("keeper19")}
          />
          <ShipChoiceCard
            keeperKey="keeper20"
            display={formB}
            maxHp={maxHp}
            maxDmg={maxDmg}
            maxSpd={maxSpd}
            pct={pct}
            onSelect={() => onSelectKeeper("keeper20")}
          />
        </div>
        {authError && <p className={styles.error}>{authError}</p>}
        <button className={styles.secondaryButton} onClick={onLogout}>
          Выйти
        </button>
      </div>
    </div>
  );
}
