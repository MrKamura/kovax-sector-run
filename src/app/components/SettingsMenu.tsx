"use client";

import { useState } from "react";
import { GAME_TITLE } from "../constants";
import { ShipChoiceCard } from "./ShipChoiceCard";
import type { KeeperFormDisplay } from "../types";
import type { KeeperKey } from "../types";
import styles from "../page.module.css";

type SettingsMenuProps = {
  userEmail: string;
  musicVolume: number;
  sfxVolume: number;
  onMusicVolumeChange: (v: number) => void;
  onSfxVolumeChange: (v: number) => void;
  formA: KeeperFormDisplay;
  formB: KeeperFormDisplay;
  maxHp: number;
  maxDmg: number;
  maxSpd: number;
  pct: (value: number, max: number) => number;
  currentShip: string | null;
  onShipChange: (key: KeeperKey) => void;
  onClose: () => void;
  onContinue: () => void;
  onExitGame: () => void;
  onExitAndLogout: () => void;
  shipChangeLoading: boolean;
  authLoading: boolean;
  exitCountdown: number | null;
};

export function SettingsMenu({
  userEmail,
  musicVolume,
  sfxVolume,
  onMusicVolumeChange,
  onSfxVolumeChange,
  formA,
  formB,
  maxHp,
  maxDmg,
  maxSpd,
  pct,
  currentShip,
  onShipChange,
  onClose,
  onContinue,
  onExitGame,
  onExitAndLogout,
  shipChangeLoading,
  authLoading,
  exitCountdown,
}: SettingsMenuProps) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [oldPasswordRepeat, setOldPasswordRepeat] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const closeAndReset = () => {
    onClose();
    setShowPasswordForm(false);
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!oldPassword || !oldPasswordRepeat || !newPassword) {
      setPasswordError("Заполните все поля.");
      return;
    }
    if (oldPassword !== oldPasswordRepeat) {
      setPasswordError("Старые пароли не совпадают.");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("Новый пароль слишком короткий.");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword,
          oldPasswordRepeat,
          newPassword,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Не удалось сменить пароль.");
      }
      setPasswordSuccess("Пароль обновлён.");
      setOldPassword("");
      setOldPasswordRepeat("");
      setNewPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Не удалось сменить пароль."
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div
      className={styles.menuOverlay}
      onClick={closeAndReset}
      role="presentation"
    >
      <div
        className={styles.menuCard}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className={styles.menuHeader}>
          <div className={styles.menuTitleBlock}>
            <p className={styles.menuGameTitle}>{GAME_TITLE}</p>
            <h2 className={styles.menuTitle}>Настройки</h2>
            <div className={styles.menuMeta}>{userEmail}</div>
          </div>
          <button
            type="button"
            className={styles.menuClose}
            onClick={closeAndReset}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className={styles.menuBody}>
          <div className={styles.menuRow}>
            <span className={styles.menuLabel}>
              Музыка: {Math.round(musicVolume * 100)}%
            </span>
            <input
              className={styles.menuSlider}
              type="range"
              min={0}
              max={100}
              value={Math.round(musicVolume * 100)}
              onChange={(e) =>
                onMusicVolumeChange(Number(e.target.value) / 100)
              }
            />
          </div>
          <div className={styles.menuRow}>
            <span className={styles.menuLabel}>
              Эффекты: {Math.round(sfxVolume * 100)}%
            </span>
            <input
              className={styles.menuSlider}
              type="range"
              min={0}
              max={100}
              value={Math.round(sfxVolume * 100)}
              onChange={(e) => onSfxVolumeChange(Number(e.target.value) / 100)}
            />
          </div>
        </div>

        <div className={styles.menuSection}>
          <div className={styles.menuLabel}>Форма</div>
          <div className={styles.shipGrid}>
            <ShipChoiceCard
              keeperKey="keeper19"
              display={formA}
              maxHp={maxHp}
              maxDmg={maxDmg}
              maxSpd={maxSpd}
              pct={pct}
              onSelect={() => onShipChange("keeper19")}
              disabled={
                shipChangeLoading ||
                authLoading ||
                currentShip === "keeper19"
              }
              selected={currentShip === "keeper19"}
            />
            <ShipChoiceCard
              keeperKey="keeper20"
              display={formB}
              maxHp={maxHp}
              maxDmg={maxDmg}
              maxSpd={maxSpd}
              pct={pct}
              onSelect={() => onShipChange("keeper20")}
              disabled={
                shipChangeLoading ||
                authLoading ||
                currentShip === "keeper20"
              }
              selected={currentShip === "keeper20"}
            />
          </div>
        </div>

        <div className={styles.menuSection}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              setShowPasswordForm((prev) => !prev);
              setPasswordError(null);
              setPasswordSuccess(null);
            }}
          >
            Сменить пароль
          </button>

          {showPasswordForm && (
            <form
              className={styles.passwordForm}
              onSubmit={handlePasswordSubmit}
            >
              <label className={styles.passwordLabel}>
                Старый пароль
                <input
                  className={styles.passwordInput}
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className={styles.passwordLabel}>
                Старый пароль (ещё раз)
                <input
                  className={styles.passwordInput}
                  type="password"
                  value={oldPasswordRepeat}
                  onChange={(e) => setOldPasswordRepeat(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className={styles.passwordLabel}>
                Новый пароль
                <input
                  className={styles.passwordInput}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>

              {passwordError && (
                <div className={styles.passwordError}>{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className={styles.passwordSuccess}>
                  {passwordSuccess}
                </div>
              )}

              <div className={styles.passwordActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={passwordSaving}
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                  disabled={passwordSaving}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>

        <div className={styles.menuActions}>
          <button type="button" className={styles.primaryButton} onClick={onContinue}>
            Продолжить
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              closeAndReset();
              onExitGame();
            }}
            disabled={exitCountdown !== null}
          >
            Выйти из игры
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              closeAndReset();
              onExitAndLogout();
            }}
            disabled={exitCountdown !== null}
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
