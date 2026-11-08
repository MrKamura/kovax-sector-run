import styles from "../page.module.css";

type DeathOverlayProps = {
  killedBy: string;
  killedByUserId: number | undefined;
  lostTokens: number;
  lostExp: number;
  expPercent?: number;
  tokenPercent?: number;
  onRespawn: () => void;
  onRespawnVengeance: (userId: number) => void;
};

export function DeathOverlay({
  killedBy,
  killedByUserId,
  lostTokens,
  lostExp,
  expPercent,
  tokenPercent,
  onRespawn,
  onRespawnVengeance,
}: DeathOverlayProps) {
  return (
    <div className={styles.deathOverlay}>
      <div className={styles.deathCard}>
        <h2>Вы погибли</h2>
        {killedBy && <p>Killed: {killedBy}</p>}
        <p>
          Потеряно токенов: {lostTokens}
          {tokenPercent != null && ` (${tokenPercent}%)`}.
          Потеряно опыта: {lostExp}
          {expPercent != null && ` (${expPercent}%)`}.
        </p>
        <div className={styles.deathButtons}>
          {killedByUserId != null && killedByUserId > 0 && (
            <button
              className={styles.vengeanceRespawnButton}
              onClick={() => onRespawnVengeance(killedByUserId)}
            >
              Respawn and hunt {killedBy}
            </button>
          )}
          <button className={styles.primaryButton} onClick={onRespawn}>
            {killedByUserId != null && killedByUserId > 0 ? "Respawn" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
