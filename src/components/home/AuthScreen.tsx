import { useState, useRef } from "react";
import styles from "@/page.module.css";
import { GAME_TITLE } from "@/lib/gameBranding";

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  authLoading: boolean;
  authError: string | null;
  onAuthSubmit: () => void;
}

export function AuthScreen({
  onLogin,
  onRegister,
  authLoading,
  authError,
  onAuthSubmit,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    onAuthSubmit();
    if (mode === "login") {
      void onLogin(email, password);
    } else {
      void onRegister(email, password);
    }
  };

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h1 className={styles.authGameTitle}>{GAME_TITLE}</h1>
        <div className={styles.authTabs}>
          <button
            className={`${styles.tabButton} ${mode === "login" ? styles.tabActive : ""}`}
            onClick={() => setMode("login")}
          >
            Вход
          </button>
          <button
            className={`${styles.tabButton} ${mode === "register" ? styles.tabActive : ""}`}
            onClick={() => setMode("register")}
          >
            Регистрация
          </button>
        </div>
        <div className={styles.authBody}>
          <label className={styles.authLabel}>
            Email
            <input
              className={styles.authInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className={styles.authLabel}>
            Пароль
            <input
              className={styles.authInput}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 4 символа"
            />
          </label>
          <button
            className={styles.primaryButton}
            onClick={handleSubmit}
            disabled={authLoading}
          >
            {mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
          {authError && <p className={styles.error}>{authError}</p>}
        </div>
      </div>
    </div>
  );
}
