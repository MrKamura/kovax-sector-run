import { GAME_TITLE } from "../constants";
import styles from "../page.module.css";

type NicknameScreenProps = {
  nickname: string;
  onNicknameChange: (v: string) => void;
  onSave: () => void;
  onLogout: () => void;
  authLoading: boolean;
  authError: string | null;
};

export function NicknameScreen({
  nickname,
  onNicknameChange,
  onSave,
  onLogout,
  authLoading,
  authError,
}: NicknameScreenProps) {
  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <p className={styles.authGameTitle}>{GAME_TITLE}</p>
        <h2 className={styles.authTitle}>Выберите ник</h2>
        <label className={styles.authLabel}>
          Никнейм
          <input
            className={styles.authInput}
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            placeholder="Например: StarRider"
          />
        </label>
        <button
          className={styles.primaryButton}
          onClick={() => void onSave()}
          disabled={authLoading}
        >
          Сохранить
        </button>
        {authError && <p className={styles.error}>{authError}</p>}
        <button className={styles.secondaryButton} onClick={onLogout}>
          Выйти
        </button>
      </div>
    </div>
  );
}

// hmr-probe

// hmr-probe
