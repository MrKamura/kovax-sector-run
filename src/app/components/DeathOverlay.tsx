"use client";

import styles from "../page.module.css";

type DeathOverlayProps = {
  killedBy: string;
  killedByUserId: number | undefined;
  lostTokens: number;
  lostExp: number;
  onRespawn: () => void;
  onRespawnVengeance: (userId: number) => void;
};

export function DeathOverlay({
  killedBy,
  killedByUserId,
  lostTokens,
  lostExp,
  onRespawn,
  onRespawnVengeance,
}: DeathOverlayProps) {
  return (
    <div className={styles.deathOverlay}>
      <div className={styles.deathCard}>
        <h2>Вы погибли</h2>
        {killedBy && <p>Killed: {killedBy}</p>}
        <p>
          Потеряно токенов: {lostTokens}. Потеряно опыта: {lostExp}.
        </p>
        <div className={styles.deathButtons}>
          {killedByUserId != null && (
            <button
              className={styles.vengeanceRespawnButton}
              onClick={() => onRespawnVengeance(killedByUserId)}
            >
              Respawn and hunt {killedBy}
            </button>
          )}
          <button className={styles.primaryButton} onClick={onRespawn}>
            {killedByUserId != null ? "Respawn" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
