"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { useGameStore } from "@/store/gameStore";
import SpaceArena from "@/components/SpaceArena";
import { getSkillDef, SKILL_SLOT_COUNT } from "@/lib/skills";
import { DEFAULT_PLAYER } from "@/lib/gameDefaults";
import { GAME_TITLE, STUDIO_NAME } from "@/lib/gameBranding";

export default function Home() {
  const player = useGameStore((state) => state.player);
  const user = useGameStore((state) => state.user);
  const musicVolume = useGameStore((state) => state.musicVolume);
  const sfxVolume = useGameStore((state) => state.sfxVolume);
  const authLoading = useGameStore((state) => state.authLoading);
  const sessionReady = useGameStore((state) => state.sessionReady);
  const error = useGameStore((state) => state.error);
  const authError = useGameStore((state) => state.authError);
  const deathInfo = useGameStore((state) => state.deathInfo);
  const lowHealthActive = useGameStore((state) => state.lowHealthActive);
  const levelUpCelebration = useGameStore((state) => state.levelUpCelebration);
  const clearLevelUpCelebration = useGameStore((state) => state.clearLevelUpCelebration);
  const requestRespawn = useGameStore((state) => state.requestRespawn);
  const requestRespawnVengeance = useGameStore((state) => state.requestRespawnVengeance);
  const vengeance = useGameStore((state) => state.vengeance);
  const hunted = useGameStore((state) => state.hunted);
  const sectorKillFlash = useGameStore((state) => state.sectorKillFlash);
  const setMusicVolume = useGameStore((state) => state.setMusicVolume);
  const setSfxVolume = useGameStore((state) => state.setSfxVolume);
  const loadSession = useGameStore((state) => state.loadSession);
  const loadPlayer = useGameStore((state) => state.loadPlayer);
  const register = useGameStore((state) => state.register);
  const login = useGameStore((state) => state.login);
  const logout = useGameStore((state) => state.logout);
  const exitCountdown = useGameStore((state) => state.exitCountdown);
  const requestExitGame = useGameStore((state) => state.requestExitGame);
  const setNickname = useGameStore((state) => state.setNickname);
  const setShipChoice = useGameStore((state) => state.setShipChoice);
  const triggerSkillSlot = useGameStore((state) => state.triggerSkillSlot);
  const setSkillSlots = useGameStore((state) => state.setSkillSlots);
  const skillCooldowns = useGameStore((state) => state.skillCooldowns);
  const playerInSafeZone = useGameStore((state) => state.playerInSafeZone);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [, setCooldownTick] = useState(0);
  const [draggedSkillSlot, setDraggedSkillSlot] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNicknameValue] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [sectorChatMessages, setSectorChatMessages] = useState<
    Array<{
      id: string;
      userId: number;
      nickname: string;
      text: string;
      createdAt: number;
    }>
  >([]);
  const [globalChatMessages, setGlobalChatMessages] = useState<
    Array<{
      id: string;
      userId: number;
      nickname: string;
      text: string;
      createdAt: number;
    }>
  >([]);
  const [chatScope, setChatScope] = useState<"sector" | "global">("sector");
  const chatSocketRef = useRef<WebSocket | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [monsterSaving, setMonsterSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [oldPasswordRepeat, setOldPasswordRepeat] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const needsNickname = !!user && !user.nickname;
  const needsShip = !!user && !!user.nickname && !user.shipChoice;
  const [introStoryDismissed, setIntroStoryDismissed] = useState(false);
  const [introStoryChars, setIntroStoryChars] = useState(0);
  const [introStoryCanProceed, setIntroStoryCanProceed] = useState(false);
  const [showIntroAfterAuth, setShowIntroAfterAuth] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const justSubmittedAuth = useRef(false);
  const hadShipWhenIntroShown = useRef(false);
  const introStoryJustEntered = useRef(false);
  const splashFadeStarted = useRef(false);

  const showSplash = !!user && showIntroAfterAuth && !splashDismissed;
  const INTRO_STORY_TEXT =
    "Человечество начало активное освоение космоса и вторглось в новую галактику, населённую киперами. Эти существа обитают в открытом космосе. Они способны развиваться и приспосабливаться к среде, мутировать и становиться сильнее, уничтожая враждебные корабли и других киперов. Вы — один из них. Выберите форму и вступите в борьбу за выживание.";
  const showIntroStory = !!user && showIntroAfterAuth && splashDismissed && !introStoryDismissed;
  const showKeeperSelectionAfterIntro =
    !!user && needsShip && introStoryDismissed && !hadShipWhenIntroShown.current;
  const TYPEWRITER_MS = 26;

  const MAX_LEVEL = 100;
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const maxStatsForForm = (key: "keeper19" | "keeper20") => {
    const level = MAX_LEVEL;
    const baseMaxHealth = 100 + Math.max(0, level - 1) * 8;
    const baseDamage = 12 + Math.max(0, level - 1) * 2;
    const healthMod = key === "keeper19" ? 0.85 : 1.2;
    const damageMod = key === "keeper19" ? 0.85 : 1.2;
    const speedMod = key === "keeper19" ? 1.15 : 0.9;
    const hp = Math.round(baseMaxHealth * healthMod);
    const dmg = Math.round(baseDamage * damageMod);
    const spd = Math.round(220 * speedMod * (1 + Math.max(0, level - 1) * 0.03));
    return { hp, dmg, spd };
  };

  const getFormProgress = (key: "keeper19" | "keeper20") => {
    const progress = player?.monsterProgress?.[key];
    if (progress) {
      return progress;
    }
    // Fallback if DB migration wasn't applied yet or old user record.
    const fallbackLevel = user?.shipChoice === key ? (player?.level ?? 1) : 1;
    const fallbackMaxHealth =
      user?.shipChoice === key ? (player?.maxHealth ?? 100) : 100;
    const fallbackDamage = user?.shipChoice === key ? (player?.damage ?? 12) : 12;
    return {
      level: fallbackLevel,
      exp: 0,
      expToNext: 100,
      health: fallbackMaxHealth,
      maxHealth: fallbackMaxHealth,
      damage: fallbackDamage,
    };
  };

  const getFormDisplay = (key: "keeper19" | "keeper20") => {
    const progress = getFormProgress(key);
    const levelRaw = Number(progress.level);
    const level = Number.isFinite(levelRaw) ? clamp(levelRaw, 1, MAX_LEVEL) : 1;
    const hp = Number.isFinite(Number(progress.maxHealth)) ? Math.max(1, Number(progress.maxHealth)) : 100;
    const dmg = Number.isFinite(Number(progress.damage)) ? Math.max(1, Number(progress.damage)) : 12;
    const baseSpeed =
      220 *
      (key === "keeper19" ? 1.15 : 0.9) *
      (1 + Math.max(0, level - 1) * 0.03);
    return {
      name: key === "keeper19" ? "Keeper 1" : "Keeper 2",
      level,
      hp: Math.round(hp),
      dmg: Math.round(dmg),
      spd: Math.round(baseSpeed),
    };
  };

  const formA = getFormDisplay("keeper19");
  const formB = getFormDisplay("keeper20");
  const maxA = maxStatsForForm("keeper19");
  const maxB = maxStatsForForm("keeper20");
  const maxHp = Math.max(maxA.hp, maxB.hp) || 1;
  const maxDmg = Math.max(maxA.dmg, maxB.dmg) || 1;
  const maxSpd = Math.max(maxA.spd, maxB.spd) || 1;

  const pct = (value: number, max: number) => {
    const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
    const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
    const raw = (safeValue / safeMax) * 100;
    // Make very small values still visible as a "bar", not a dot/line.
    const adjusted = raw > 0 && raw < 6 ? 6 : raw;
    return clamp(Math.round(adjusted), 0, 100);
  };

  useEffect(() => {
    void loadSession();
  }, [loadSession]);
  useEffect(() => {
    // Only refetch when the *identity* changes, otherwise this loops forever
    // because `loadPlayer()` updates `user` with a new object reference.
    if (!user?.id) {
      return;
    }
    void loadPlayer();
  }, [loadPlayer, user?.id]);

  const handleMonsterChange = async (choice: "keeper19" | "keeper20") => {
    if (monsterSaving) {
      return;
    }
    setMonsterSaving(true);
    try {
      await setShipChoice(choice);
      await loadPlayer();
    } finally {
      setMonsterSaving(false);
    }
  };

  useEffect(() => {
    if (!user || needsNickname || needsShip) {
      return;
    }
    
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socketUrl = `${protocol}://${window.location.host}/ws`;
    const socket = new WebSocket(socketUrl);
    
    chatSocketRef.current = socket;
    
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          type: string;
          scope?: "sector" | "global";
          sectorId?: string;
          messages?: Array<{
            id: string;
            userId: number;
            nickname: string;
            text: string;
            createdAt: number;
          }>;
          message?: {
            id: string;
            userId: number;
            nickname: string;
            text: string;
            createdAt: number;
          };
        };
        
        if (payload.type === "chat_history" && payload.messages) {
          if (payload.scope === "global") {
            setGlobalChatMessages(payload.messages.slice(-50));
          } else {
            setSectorChatMessages(payload.messages.slice(-50));
          }
        }
        
        if (payload.type === "chat_message" && payload.message) {
          const message = payload.message;
          
          if (payload.scope === "global") {
            setGlobalChatMessages((prev) => [
              ...prev.slice(-49),
              message,
            ]);
          } else {
            setSectorChatMessages((prev) => [
              ...prev.slice(-49),
              message,
            ]);
          }
        }
      } catch {
        // ignore invalid payload
      }
    };
    
    return () => {
      try {
        socket.close();
      } catch {
        // ignore close failures
      }
    };
  }, [user, needsNickname, needsShip]);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) {
      return;
    }
    // Don't force-scroll when user is reading older messages.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const shouldStickToBottom = distanceFromBottom < 60;
    if (shouldStickToBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sectorChatMessages, globalChatMessages, chatScope]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) {
      return;
    }
    const socket = chatSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(
      JSON.stringify({
        type: "chat_message",
        text,
        scope: chatScope,
      })
    );
    setChatInput("");
    chatInputRef.current?.blur();
  };

  const resources = player?.resources ?? { scrap: 0, tokens: 0 };
  const exp = player?.exp ?? 0;
  const expToNext = player?.expToNext ?? 100;
  const expRatio = Math.max(0, Math.min(1, exp / expToNext));
  const playerLevel = player?.level ?? 1;
  // Use server order so drag-and-drop reordering persists; append any default skills missing from server so new skills still appear
  const serverSkills = player?.skills ?? [];
  const mergedSkills = (() => {
    const list = serverSkills.filter(Boolean);
    for (const id of DEFAULT_PLAYER.skills) {
      if (!list.includes(id) && list.length < SKILL_SLOT_COUNT) list.push(id);
    }
    return list.slice(0, SKILL_SLOT_COUNT);
  })();
  const skillSlots = Array.from(
    { length: SKILL_SLOT_COUNT },
    (_, i) => mergedSkills[i] ?? ""
  );
  const energyCap = 10 + Math.max(0, playerLevel - 1) * 3;
  const isDead = (player?.health ?? 1) <= 0;
  const lostTokens = deathInfo?.lostTokens ?? 0;
  const lostExp = deathInfo?.lostExp ?? 0;
  const killedBy = deathInfo?.killedBy ?? "";
  const killedByUserId = deathInfo?.killedByUserId;
  const activeChatMessages =
    chatScope === "global" ? globalChatMessages : sectorChatMessages;

  useEffect(() => {
    if (!levelUpCelebration) return;
    const t = setTimeout(() => clearLevelUpCelebration(), 6000);
    return () => clearTimeout(t);
  }, [levelUpCelebration, clearLevelUpCelebration]);

  // Tick every second while any skill is on cooldown or vengeance buff so countdown updates
  useEffect(() => {
    const hasCooldown = skillCooldowns && Object.values(skillCooldowns).some((endsAt) => Number(endsAt) > Date.now());
    const hasVengeance = vengeance && vengeance.expiresAt > Date.now();
    if (!hasCooldown && !hasVengeance) return;
    const id = setInterval(() => setCooldownTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [skillCooldowns, vengeance]);

  useEffect(() => {
    if (!user || needsNickname || needsShip || menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= "1" && key <= "9") {
        const active = document.activeElement;
        const tag = active?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        const index = key.charCodeAt(0) - "1".charCodeAt(0);
        const state = useGameStore.getState();
        const baseSkills = (state.player?.skills ?? []).filter(Boolean);
        const merged: string[] = [...baseSkills];
        for (const id of DEFAULT_PLAYER.skills) {
          if (!merged.includes(id) && merged.length < 9) merged.push(id);
        }
        const skillId = merged[index];
        const def = skillId ? getSkillDef(skillId) : null;
        const energy = state.player?.resources?.scrap ?? 0;
        const cooldownEndsAt = Number((skillId && state.skillCooldowns?.[skillId]) ?? 0);
        if (def && energy < (def.energyCost ?? 0)) return;
        if (def && cooldownEndsAt > Date.now()) return;
        void state.triggerSkillSlot(index);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [user, needsNickname, needsShip, menuOpen]);

  useEffect(() => {
    if (user && justSubmittedAuth.current) {
      justSubmittedAuth.current = false;
      setShowIntroAfterAuth(true);
      setIntroStoryDismissed(false);
      setSplashDismissed(false);
      splashFadeStarted.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (showIntroStory) {
      hadShipWhenIntroShown.current = hadShipWhenIntroShown.current || !!user?.shipChoice;
      if (!introStoryJustEntered.current) {
        introStoryJustEntered.current = true;
        setIntroStoryChars(0);
        setIntroStoryCanProceed(false);
      }
    } else {
      introStoryJustEntered.current = false;
    }
  }, [showIntroStory, user?.shipChoice]);

  useEffect(() => {
    if (showIntroStory && introStoryChars >= INTRO_STORY_TEXT.length) {
      setIntroStoryCanProceed(true);
    }
  }, [showIntroStory, introStoryChars]);

  useEffect(() => {
    if (!showIntroStory || introStoryChars >= INTRO_STORY_TEXT.length) return;
    const id = setInterval(() => {
      setIntroStoryChars((n) => {
        if (n >= INTRO_STORY_TEXT.length) return n;
        return n + 1;
      });
    }, TYPEWRITER_MS);
    return () => clearInterval(id);
  }, [showIntroStory, introStoryChars]);

  const SPLASH_VISIBLE_MS = 2500;
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    if (!showSplash) return;
    if (splashFadeStarted.current) return;
    const t = setTimeout(() => {
      splashFadeStarted.current = true;
      setSplashFading(true);
    }, SPLASH_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [showSplash]);

  const handleSplashFadeEnd = () => {
    if (splashFading) setSplashDismissed(true);
    splashFadeStarted.current = false;
    setSplashFading(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.sceneContainer}>
        {sessionReady && !authLoading && !user && (
          <div className={styles.authWrapper}>
            <div className={styles.authCard}>
              <h1 className={styles.authGameTitle}>{GAME_TITLE}</h1>
              <div className={styles.authTabs}>
                <button
                  className={`${styles.tabButton} ${
                    mode === "login" ? styles.tabActive : ""
                  }`}
                  onClick={() => setMode("login")}
                >
                  Вход
                </button>
                <button
                  className={`${styles.tabButton} ${
                    mode === "register" ? styles.tabActive : ""
                  }`}
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
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label className={styles.authLabel}>
                  Пароль
                  <input
                    className={styles.authInput}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Минимум 4 символа"
                  />
                </label>
                <button
                  className={styles.primaryButton}
                  onClick={() => {
                    justSubmittedAuth.current = true;
                    if (mode === "login") {
                      void login(email, password);
                    } else {
                      void register(email, password);
                    }
                  }}
                  disabled={authLoading}
                >
                  {mode === "login" ? "Войти" : "Создать аккаунт"}
                </button>
                {authError && <p className={styles.error}>{authError}</p>}
              </div>
            </div>
          </div>
        )}
        {user && needsNickname && (
          <div className={styles.authWrapper}>
            <div className={styles.authCard}>
              <p className={styles.authGameTitle}>{GAME_TITLE}</p>
              <h2 className={styles.authTitle}>Выберите ник</h2>
              <label className={styles.authLabel}>
                Никнейм
                <input
                  className={styles.authInput}
                  value={nickname}
                  onChange={(event) => setNicknameValue(event.target.value)}
                  placeholder="Например: StarRider"
                />
              </label>
              <button
                className={styles.primaryButton}
                onClick={() => void setNickname(nickname)}
                disabled={authLoading}
              >
                Сохранить
              </button>
              {authError && <p className={styles.error}>{authError}</p>}
              <button className={styles.secondaryButton} onClick={logout}>
                Выйти
              </button>
            </div>
          </div>
        )}
        {showSplash && (
          <div
            className={`${styles.splashOverlay} ${splashFading ? styles.splashFadeOut : ""}`}
            onAnimationEnd={(e) => {
              if (e.animationName === styles.splashFadeOut || e.animationName === "splashFadeOut") handleSplashFadeEnd();
            }}
            role="img"
            aria-label={`A game from ${STUDIO_NAME}. ${GAME_TITLE}.`}
          >
            <div className={styles.splashContent}>
              <p className={styles.splashStudio}>A game from {STUDIO_NAME}</p>
              <h1 className={styles.splashTitle}>{GAME_TITLE}</h1>
            </div>
          </div>
        )}
        {showIntroStory && (
          <div className={styles.introStoryOverlay}>
            <div className={styles.introStoryContent}>
              <p className={styles.introStoryText}>
                {INTRO_STORY_TEXT.slice(0, introStoryChars)}
                {introStoryChars < INTRO_STORY_TEXT.length && (
                  <span className={styles.introStoryCursor}>|</span>
                )}
              </p>
            </div>
            <button
              type="button"
              className={introStoryCanProceed ? styles.introStoryProceed : styles.introStorySkip}
              onClick={() => {
                if (introStoryCanProceed) {
                  setIntroStoryDismissed(true);
                } else {
                  setIntroStoryChars(INTRO_STORY_TEXT.length);
                  setIntroStoryCanProceed(true);
                }
              }}
            >
              {introStoryCanProceed ? "Выберите форму" : "Пропустить историю"}
            </button>
          </div>
        )}
        {showKeeperSelectionAfterIntro && (
          <div className={styles.authWrapper}>
            <div className={styles.authCard}>
              <p className={styles.authGameTitle}>{GAME_TITLE}</p>
              <h2 className={styles.authTitle}>Выберите форму кипера</h2>
              <div className={styles.shipGrid}>
                <button
                  className={`${styles.secondaryButton} ${styles.monsterButton}`}
                  onClick={() => void setShipChoice("keeper19")}
                >
                  <span
                    className={`${styles.monsterPreview} ${styles.monsterPreviewFast}`}
                  />
                  <div className={styles.monsterInfo}>
                    <div className={styles.monsterLabelRow}>
                      <span className={styles.monsterLabel}>{formA.name}</span>
                      <span className={styles.monsterLevel}>Lv.{formA.level}</span>
                    </div>
                    <div className={styles.monsterStatRows}>
                      <div className={styles.monsterStatRow}>
                        <span className={styles.monsterStatName}>Скорость</span>
                        <div className={styles.monsterStatBar}>
                          <div
                            className={styles.monsterStatFill}
                                style={{ width: `${pct(formA.spd, maxSpd)}%` }}
                          />
                          <span className={styles.monsterStatBarValue}>
                            {formA.spd}
                          </span>
                        </div>
                      </div>
                      <div className={styles.monsterStatRow}>
                        <span className={styles.monsterStatName}>Урон</span>
                        <div className={styles.monsterStatBar}>
                          <div
                            className={styles.monsterStatFill}
                                style={{ width: `${pct(formA.dmg, maxDmg)}%` }}
                          />
                          <span className={styles.monsterStatBarValue}>
                            {formA.dmg}
                          </span>
                        </div>
                      </div>
                      <div className={styles.monsterStatRow}>
                        <span className={styles.monsterStatName}>HP</span>
                        <div className={styles.monsterStatBar}>
                          <div
                            className={styles.monsterStatFill}
                                style={{ width: `${pct(formA.hp, maxHp)}%` }}
                          />
                          <span className={styles.monsterStatBarValue}>
                            {formA.hp}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  className={`${styles.secondaryButton} ${styles.monsterButton}`}
                  onClick={() => void setShipChoice("keeper20")}
                >
                  <span
                    className={`${styles.monsterPreview} ${styles.monsterPreviewTank}`}
                  />
                  <div className={styles.monsterInfo}>
                    <div className={styles.monsterLabelRow}>
                      <span className={styles.monsterLabel}>{formB.name}</span>
                      <span className={styles.monsterLevel}>Lv.{formB.level}</span>
                    </div>
                    <div className={styles.monsterStatRows}>
                      <div className={styles.monsterStatRow}>
                        <span className={styles.monsterStatName}>Скорость</span>
                        <div className={styles.monsterStatBar}>
                          <div
                            className={styles.monsterStatFill}
                                style={{ width: `${pct(formB.spd, maxSpd)}%` }}
                          />
                          <span className={styles.monsterStatBarValue}>
                            {formB.spd}
                          </span>
                        </div>
                      </div>
                      <div className={styles.monsterStatRow}>
                        <span className={styles.monsterStatName}>Урон</span>
                        <div className={styles.monsterStatBar}>
                          <div
                            className={styles.monsterStatFill}
                                style={{ width: `${pct(formB.dmg, maxDmg)}%` }}
                          />
                          <span className={styles.monsterStatBarValue}>
                            {formB.dmg}
                          </span>
                        </div>
                      </div>
                      <div className={styles.monsterStatRow}>
                        <span className={styles.monsterStatName}>HP</span>
                        <div className={styles.monsterStatBar}>
                          <div
                            className={styles.monsterStatFill}
                                style={{ width: `${pct(formB.hp, maxHp)}%` }}
                          />
                          <span className={styles.monsterStatBarValue}>
                            {formB.hp}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
              {authError && <p className={styles.error}>{authError}</p>}
              <button className={styles.secondaryButton} onClick={logout}>
                Выйти
              </button>
            </div>
          </div>
        )}
        {user && !needsNickname && !needsShip && (
          <div
            className={`${styles.sceneWrapper} ${
              isDead ? styles.deadScene : ""
            } ${lowHealthActive ? styles.lowHealthScene : ""}`}
          >
            <SpaceArena paused={menuOpen} />
            <div className={styles.hud}>
              <div className={styles.topRightControls}>
                <button
                  className={styles.menuButton}
                  onClick={() => setMenuOpen(true)}
                >
                  Меню
                </button>
                <div className={styles.huntBuffs}>
                  {vengeance && vengeance.expiresAt > Date.now() && (
                    <div className={styles.vengeanceBuff} aria-label="Hunting">
                      <span className={styles.vengeanceIcon} title="Hunting">⚔</span>
                      <div className={styles.vengeanceDetails}>
                        <span className={styles.vengeanceTarget}>
                          Hunting: {vengeance.targetNickname}
                        </span>
                        <span className={styles.vengeanceSector}>
                          {vengeance.targetSectorName ?? "—"}
                        </span>
                        <span className={styles.vengeanceBonus}>
                          +15% damage vs this player
                        </span>
                        <span className={styles.vengeanceTime}>
                          {Math.max(0, Math.ceil((vengeance.expiresAt - Date.now()) / 1000))}s
                        </span>
                      </div>
                    </div>
                  )}
                  {hunted && !vengeance && hunted.expiresAt > Date.now() && (
                    <div className={styles.huntedBuff} aria-label="Being hunted">
                      <span className={styles.huntedIcon} title="Being hunted">🎯</span>
                      <div className={styles.huntedDetails}>
                        <span className={styles.huntedName}>
                          Hunted by: {hunted.hunterNickname}
                        </span>
                        <span className={styles.huntedTime}>
                          {Math.max(0, Math.ceil((hunted.expiresAt - Date.now()) / 1000))}s
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {sectorKillFlash && (
                <div className={styles.sectorKillFlash} role="alert">
                  {sectorKillFlash.killerName} killed {sectorKillFlash.victimName}
                </div>
              )}
              <div className={styles.resourcesBar}>
                <span>
                  Энергия: {resources.scrap} / {energyCap}
                </span>
                <span>Токены: {resources.tokens}</span>
              </div>

              {error && <p className={styles.error}>{error}</p>}
            </div>
            {isDead && (
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
                        onClick={() => requestRespawnVengeance(killedByUserId)}
                      >
                        Respawn and hunt {killedBy}
                      </button>
                    )}
                    <button
                      className={styles.primaryButton}
                      onClick={() => requestRespawn()}
                    >
                      {killedByUserId != null ? "Respawn" : "OK"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {levelUpCelebration && (
              <div
                className={styles.levelUpOverlay}
                onClick={() => clearLevelUpCelebration()}
                onKeyDown={(e) => e.key === "Enter" && clearLevelUpCelebration()}
                role="button"
                tabIndex={0}
                aria-label="Закрыть"
              >
                <div className={styles.levelUpCard} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.levelUpSign}>
                    <span className={styles.levelUpTitle}>Уровень</span>
                    <span className={styles.levelUpNumber}>{levelUpCelebration.level}</span>
                  </div>
                  {levelUpCelebration.level === 3 && (
                    <div className={styles.levelUpLevel3Info}>
                      <p>Увеличены здоровье, урон и размер.</p>
                      <p>Доступны жёлтые секторы уровня 2.</p>
                    </div>
                  )}
                  <button
                    className={styles.levelUpDismiss}
                    onClick={() => clearLevelUpCelebration()}
                  >
                    Продолжить
                  </button>
                </div>
              </div>
            )}
            {exitCountdown !== null && (
              <div className={styles.exitOverlay} aria-live="polite">
                <div className={styles.exitCard}>
                  <p className={styles.exitText}>Выход из игры…</p>
                  <p className={styles.exitCountdown}>
                    Отключение через {exitCountdown} сек.
                  </p>
                  <p className={styles.exitHint}>
                    Персонаж сохранён и недоступен для атак.
                  </p>
                </div>
              </div>
            )}
            {menuOpen && (
              <div
                className={styles.menuOverlay}
                onClick={() => {
                  setMenuOpen(false);
                  setShowPasswordForm(false);
                  setPasswordError(null);
                  setPasswordSuccess(null);
                }}
              >
                <div
                  className={styles.menuCard}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className={styles.menuHeader}>
                    <div className={styles.menuTitleBlock}>
                      <p className={styles.menuGameTitle}>{GAME_TITLE}</p>
                      <h2 className={styles.menuTitle}>Настройки</h2>
                      <div className={styles.menuMeta}>
                        {user?.email ?? ""}
                      </div>
                    </div>
                    <button
                      className={styles.menuClose}
                      onClick={() => {
                        setMenuOpen(false);
                        setShowPasswordForm(false);
                        setPasswordError(null);
                        setPasswordSuccess(null);
                      }}
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
                        onChange={(event) =>
                          setMusicVolume(Number(event.target.value) / 100)
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
                        onChange={(event) =>
                          setSfxVolume(Number(event.target.value) / 100)
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.menuSection}>
                    <div className={styles.menuLabel}>Форма</div>
                    <div className={styles.shipGrid}>
                      <button
                        className={`${styles.secondaryButton} ${styles.monsterButton}`}
                        onClick={() => void handleMonsterChange("keeper19")}
                        disabled={
                          monsterSaving ||
                          authLoading ||
                          user?.shipChoice === "keeper19"
                        }
                      >
                        <span
                          className={`${styles.monsterPreview} ${styles.monsterPreviewFast}`}
                        />
                        <div className={styles.monsterInfo}>
                          <div className={styles.monsterLabelRow}>
                            <span className={styles.monsterLabel}>{formA.name}</span>
                            <span className={styles.monsterLevel}>Lv.{formA.level}</span>
                          </div>
                          <div className={styles.monsterStatRows}>
                            <div className={styles.monsterStatRow}>
                              <span className={styles.monsterStatName}>Скорость</span>
                              <div className={styles.monsterStatBar}>
                                <div
                                  className={styles.monsterStatFill}
                                  style={{ width: `${pct(formA.spd, maxSpd)}%` }}
                                />
                                <span className={styles.monsterStatBarValue}>
                                  {formA.spd}
                                </span>
                              </div>
                            </div>
                            <div className={styles.monsterStatRow}>
                              <span className={styles.monsterStatName}>Урон</span>
                              <div className={styles.monsterStatBar}>
                                <div
                                  className={styles.monsterStatFill}
                                  style={{ width: `${pct(formA.dmg, maxDmg)}%` }}
                                />
                                <span className={styles.monsterStatBarValue}>
                                  {formA.dmg}
                                </span>
                              </div>
                            </div>
                            <div className={styles.monsterStatRow}>
                              <span className={styles.monsterStatName}>HP</span>
                              <div className={styles.monsterStatBar}>
                                <div
                                  className={styles.monsterStatFill}
                                  style={{ width: `${pct(formA.hp, maxHp)}%` }}
                                />
                                <span className={styles.monsterStatBarValue}>
                                  {formA.hp}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                      <button
                        className={`${styles.secondaryButton} ${styles.monsterButton}`}
                        onClick={() => void handleMonsterChange("keeper20")}
                        disabled={
                          monsterSaving ||
                          authLoading ||
                          user?.shipChoice === "keeper20"
                        }
                      >
                        <span
                          className={`${styles.monsterPreview} ${styles.monsterPreviewTank}`}
                        />
                        <div className={styles.monsterInfo}>
                          <div className={styles.monsterLabelRow}>
                            <span className={styles.monsterLabel}>{formB.name}</span>
                            <span className={styles.monsterLevel}>Lv.{formB.level}</span>
                          </div>
                          <div className={styles.monsterStatRows}>
                            <div className={styles.monsterStatRow}>
                              <span className={styles.monsterStatName}>Скорость</span>
                              <div className={styles.monsterStatBar}>
                                <div
                                  className={styles.monsterStatFill}
                                  style={{ width: `${pct(formB.spd, maxSpd)}%` }}
                                />
                                <span className={styles.monsterStatBarValue}>
                                  {formB.spd}
                                </span>
                              </div>
                            </div>
                            <div className={styles.monsterStatRow}>
                              <span className={styles.monsterStatName}>Урон</span>
                              <div className={styles.monsterStatBar}>
                                <div
                                  className={styles.monsterStatFill}
                                  style={{ width: `${pct(formB.dmg, maxDmg)}%` }}
                                />
                                <span className={styles.monsterStatBarValue}>
                                  {formB.dmg}
                                </span>
                              </div>
                            </div>
                            <div className={styles.monsterStatRow}>
                              <span className={styles.monsterStatName}>HP</span>
                              <div className={styles.monsterStatBar}>
                                <div
                                  className={styles.monsterStatFill}
                                  style={{ width: `${pct(formB.hp, maxHp)}%` }}
                                />
                                <span className={styles.monsterStatBarValue}>
                                  {formB.hp}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className={styles.menuSection}>
                    <button
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
                        onSubmit={async (event) => {
                          event.preventDefault();
                          setPasswordError(null);
                          setPasswordSuccess(null);

                          const old1 = oldPassword;
                          const old2 = oldPasswordRepeat;
                          const next = newPassword;

                          if (!old1 || !old2 || !next) {
                            setPasswordError("Заполните все поля.");
                            return;
                          }
                          if (old1 !== old2) {
                            setPasswordError("Старые пароли не совпадают.");
                            return;
                          }
                          if (next.length < 4) {
                            setPasswordError("Новый пароль слишком короткий.");
                            return;
                          }

                          setPasswordSaving(true);
                          try {
                            const res = await fetch(
                              "/api/auth/change-password",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  oldPassword: old1,
                                  oldPasswordRepeat: old2,
                                  newPassword: next,
                                }),
                              }
                            );
                            const data = (await res.json()) as { error?: string };
                            if (!res.ok) {
                              throw new Error(
                                data.error ?? "Не удалось сменить пароль."
                              );
                            }
                            setPasswordSuccess("Пароль обновлён.");
                            setOldPassword("");
                            setOldPasswordRepeat("");
                            setNewPassword("");
                            setShowPasswordForm(false);
                          } catch (err) {
                            setPasswordError(
                              err instanceof Error
                                ? err.message
                                : "Не удалось сменить пароль."
                            );
                          } finally {
                            setPasswordSaving(false);
                          }
                        }}
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
                            onChange={(e) =>
                              setOldPasswordRepeat(e.target.value)
                            }
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
                          <div className={styles.passwordError}>
                            {passwordError}
                          </div>
                        )}
                        {passwordSuccess && (
                          <div className={styles.passwordSuccess}>
                            {passwordSuccess}
                          </div>
                        )}

                        <div className={styles.passwordActions}>
                          <button
                            className={styles.primaryButton}
                            type="submit"
                            disabled={passwordSaving}
                          >
                            Сохранить
                          </button>
                          <button
                            className={styles.secondaryButton}
                            type="button"
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
                    <button
                      className={styles.primaryButton}
                      onClick={() => setMenuOpen(false)}
                    >
                      Продолжить
                    </button>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setMenuOpen(false);
                        setShowPasswordForm(false);
                        requestExitGame();
                      }}
                      disabled={exitCountdown !== null}
                    >
                      Выйти из игры
                    </button>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setMenuOpen(false);
                        setShowPasswordForm(false);
                        useGameStore.getState().setExitThenLogout(true);
                        requestExitGame();
                      }}
                      disabled={exitCountdown !== null}
                    >
                      Выйти из аккаунта
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div
              className={`${styles.chatPanel} ${
                chatScope === "global"
                  ? styles.chatPanelGlobal
                  : styles.chatPanelSector
              }`}
            >
              <div className={styles.chatHeader}>
                <span>Онлайн чат</span>
                <div className={styles.chatTabs}>
                  <button
                    className={`${styles.chatTab} ${
                      chatScope === "sector" ? styles.chatTabActive : ""
                    }`}
                    onClick={() => setChatScope("sector")}
                  >
                    Сектор
                  </button>
                  <button
                    className={`${styles.chatTab} ${
                      chatScope === "global" ? styles.chatTabActive : ""
                    }`}
                    onClick={() => setChatScope("global")}
                  >
                    Глобальный
                  </button>
                </div>
              </div>
              <div className={styles.chatMessages} ref={chatListRef}>
                {activeChatMessages.map((message) => (
                  <div className={styles.chatMessage} key={message.id}>
                    <span className={styles.chatName}>
                      {message.nickname}:
                    </span>{" "}
                    {message.text}
                  </div>
                ))}
              </div>
              <div className={styles.chatInputRow}>
                <input
                  className={styles.chatInput}
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Введите сообщение..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      sendChat();
                    }
                  }}
                />
                <button className={styles.chatSend} onClick={sendChat}>
                  Отпр.
                </button>
              </div>
            </div>
            <div className={styles.playerPanel}>
              <div className={styles.playerHeader}>
                <span>
                  {user?.nickname ?? "Пилот"} · Lv.{playerLevel}
                </span>
                <span className={styles.expText}>
                  EXP {exp} / {expToNext}
                </span>
              </div>
              <div className={styles.expBar}>
                <div
                  className={styles.expFill}
                  style={{ width: `${expRatio * 100}%` }}
                />
              </div>
              <div className={styles.skillBarSingleRow}>
                {skillSlots.map((skillId, index) => {
                  const def = skillId ? getSkillDef(skillId) : null;
                  const keyNum = index + 1;
                  const canAfford = def && resources.scrap >= (def.energyCost ?? 0);
                  const cooldownEndsAt = Number((skillId && skillCooldowns?.[skillId]) ?? 0);
                  const now = Date.now();
                  const cooldownRemainingMs = cooldownEndsAt > now ? cooldownEndsAt - now : 0;
                  const isOnCooldown = cooldownRemainingMs > 0;
                  const cooldownSec = Math.ceil(cooldownRemainingMs / 1000);
                  const isDisabled = def && (!canAfford || isOnCooldown || playerInSafeZone);
                  return (
                    <div
                      key={index}
                      className={`${styles.skillSlot} ${
                        draggedSkillSlot === index ? styles.skillSlotDragging : ""
                      } ${canAfford && !isOnCooldown && !playerInSafeZone ? styles.skillSlotUsable : ""} ${isDisabled ? styles.skillSlotDisabled : ""}`}
                      draggable={!!skillId}
                      onDragStart={() => skillId && setDraggedSkillSlot(index)}
                      onDragEnd={() => setDraggedSkillSlot(null)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = draggedSkillSlot;
                        setDraggedSkillSlot(null);
                        if (from == null || from === index) return;
                        const next = [...skillSlots];
                        const tmp = next[from];
                        next[from] = next[index];
                        next[index] = tmp;
                        void setSkillSlots(next);
                      }}
                      onClick={() => {
                        if (!skillId || isDead || isDisabled) return;
                        void triggerSkillSlot(index);
                      }}
                      role="button"
                      tabIndex={isDisabled ? -1 : 0}
                      aria-label={def ? (def.description ? `${def.name}. ${def.description}` : def.name) : `Слот ${keyNum}`}
                      title={def ? (def.description ? `${def.name}\n${def.description}` : def.name) : undefined}
                      aria-disabled={isDisabled || undefined}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (!skillId || isDead || isDisabled) return;
                          void triggerSkillSlot(index);
                        }
                        // Space is reserved for weapon fire in the game — do not capture it
                      }}
                    >
                      <span className={styles.skillSlotKey}>{keyNum}</span>
                      {def ? (
                        <>
                          {def.icon && (
                            <img
                              src={def.icon}
                              alt=""
                              className={styles.skillSlotIcon}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          <span className={styles.skillSlotName}>{def.name}</span>
                          {isOnCooldown ? (
                            <span className={styles.skillSlotCooldown}>
                              {cooldownSec} с
                            </span>
                          ) : (
                            <span className={styles.skillSlotCost}>
                              {def.energyCost} Э
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={styles.skillSlotEmpty}>—</span>
                      )}
                      {def && (def.name || def.description) ? (
                        <span className={styles.skillSlotTooltip} role="tooltip">
                          <strong>{def.name}</strong>
                          {def.description ? <span className={styles.skillSlotTooltipDesc}>{def.description}</span> : null}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
