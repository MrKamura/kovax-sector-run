"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { useGameStore } from "@/store/gameStore";
import SpaceArena from "@/components/SpaceArena";
import { DEFAULT_PLAYER } from "@/lib/gameDefaults";
import { SKILL_SLOT_COUNT } from "@/lib/skills";
import { AuthScreen } from "@/components/home/AuthScreen";
import { NicknameScreen } from "./components/NicknameScreen";
import { ShipSelectScreen } from "./components/ShipSelectScreen";
import { SplashScreen } from "./components/SplashScreen";
import { IntroStoryOverlay } from "./components/IntroStoryOverlay";
import { DeathOverlay } from "./components/DeathOverlay";
import { LevelUpOverlay } from "./components/LevelUpOverlay";
import { ExitOverlay } from "./components/ExitOverlay";
import { SettingsMenu } from "./components/SettingsMenu";
import { ChatPanel } from "./components/ChatPanel";
import { PlayerPanel } from "./components/PlayerPanel";
import {
  useChat,
  useIntroStory,
  useSplash,
  useKeeperFormDisplay,
  useCooldownTick,
  useSkillHotkeys,
} from "./hooks";

export default function Home() {
  const player = useGameStore((s) => s.player);
  const user = useGameStore((s) => s.user);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const sfxVolume = useGameStore((s) => s.sfxVolume);
  const authLoading = useGameStore((s) => s.authLoading);
  const sessionReady = useGameStore((s) => s.sessionReady);
  const error = useGameStore((s) => s.error);
  const authError = useGameStore((s) => s.authError);
  const deathInfo = useGameStore((s) => s.deathInfo);
  const lowHealthActive = useGameStore((s) => s.lowHealthActive);
  const levelUpCelebration = useGameStore((s) => s.levelUpCelebration);
  const clearLevelUpCelebration = useGameStore((s) => s.clearLevelUpCelebration);
  const requestRespawn = useGameStore((s) => s.requestRespawn);
  const requestRespawnVengeance = useGameStore((s) => s.requestRespawnVengeance);
  const vengeance = useGameStore((s) => s.vengeance);
  const hunted = useGameStore((s) => s.hunted);
  const sectorKillFlash = useGameStore((s) => s.sectorKillFlash);
  const setMusicVolume = useGameStore((s) => s.setMusicVolume);
  const setSfxVolume = useGameStore((s) => s.setSfxVolume);
  const loadSession = useGameStore((s) => s.loadSession);
  const loadPlayer = useGameStore((s) => s.loadPlayer);
  const register = useGameStore((s) => s.register);
  const login = useGameStore((s) => s.login);
  const logout = useGameStore((s) => s.logout);
  const exitCountdown = useGameStore((s) => s.exitCountdown);
  const requestExitGame = useGameStore((s) => s.requestExitGame);
  const setNickname = useGameStore((s) => s.setNickname);
  const setShipChoice = useGameStore((s) => s.setShipChoice);
  const triggerSkillSlot = useGameStore((s) => s.triggerSkillSlot);
  const setSkillSlots = useGameStore((s) => s.setSkillSlots);
  const skillCooldowns = useGameStore((s) => s.skillCooldowns);
  const playerInSafeZone = useGameStore((s) => s.playerInSafeZone);

  const [nickname, setNicknameValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [monsterSaving, setMonsterSaving] = useState(false);
  const [showIntroAfterAuth, setShowIntroAfterAuth] = useState(false);
  const [draggedSkillSlot, setDraggedSkillSlot] = useState<number | null>(null);
  const justSubmittedAuth = useRef(false);

  const needsNickname = !!user && !user.nickname;
  const needsShip = !!user && !!user.nickname && !user.shipChoice;

  const chatActive = !!user && !needsNickname && !needsShip;
  const chat = useChat(chatActive);

  const splash = useSplash(!!user && showIntroAfterAuth);
  const showSplashVisible =
    !!user && showIntroAfterAuth && !splash.splashDismissed;

  const showIntroStoryActive =
    !!user && showIntroAfterAuth && splash.splashDismissed;
  const introStory = useIntroStory(
    showIntroStoryActive,
    user?.shipChoice ?? null
  );
  const showIntroStory =
    showIntroStoryActive && !introStory.introStoryDismissed;

  const showKeeperSelectionAfterIntro =
    !!user &&
    needsShip &&
    introStory.introStoryDismissed &&
    introStory.showKeeperSelectionAfterIntro;

  const keeperForm = useKeeperFormDisplay(player, user);
  useCooldownTick(skillCooldowns, vengeance?.expiresAt);
  useSkillHotkeys(!!user && !needsNickname && !needsShip && !menuOpen);

  useEffect(() => void loadSession(), [loadSession]);
  useEffect(() => {
    if (!user?.id) return;
    void loadPlayer();
  }, [loadPlayer, user?.id]);

  useEffect(() => {
    if (levelUpCelebration) {
      const t = setTimeout(() => clearLevelUpCelebration(), 6000);
      return () => clearTimeout(t);
    }
  }, [levelUpCelebration, clearLevelUpCelebration]);

  useEffect(() => {
    if (user && justSubmittedAuth.current) {
      justSubmittedAuth.current = false;
      setShowIntroAfterAuth(true);
    }
  }, [user]);

  const handleMonsterChange = async (choice: "keeper19" | "keeper20") => {
    if (monsterSaving) return;
    setMonsterSaving(true);
    try {
      await setShipChoice(choice);
      await loadPlayer();
    } finally {
      setMonsterSaving(false);
    }
  };

  const resources = player?.resources ?? { scrap: 0, tokens: 0 };
  const exp = player?.exp ?? 0;
  const expToNext = player?.expToNext ?? 100;
  const expRatio = Math.max(0, Math.min(1, exp / expToNext));
  const playerLevel = player?.level ?? 1;
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
  const isDead = (player?.health ?? 1) <= 0;

  return (
    <div className={styles.page}>
      <div className={styles.sceneContainer}>
        {sessionReady && !authLoading && !user && (
          <AuthScreen
            onAuthSubmit={() => {
              justSubmittedAuth.current = true;
            }}
            onLogin={login}
            onRegister={register}
            authLoading={authLoading}
            authError={authError}
          />
        )}

        {user && needsNickname && (
          <NicknameScreen
            nickname={nickname}
            onNicknameChange={setNicknameValue}
            onSave={() => void setNickname(nickname)}
            onLogout={logout}
            authLoading={authLoading}
            authError={authError}
          />
        )}

        {showSplashVisible && (
          <SplashScreen
            fading={splash.splashFading}
            onAnimationEnd={splash.handleSplashFadeEnd}
          />
        )}

        {showIntroStory && (
          <IntroStoryOverlay
            charsShown={introStory.introStoryChars}
            canProceed={introStory.introStoryCanProceed}
            onProceed={introStory.dismiss}
            onSkip={introStory.skipToEnd}
          />
        )}

        {showKeeperSelectionAfterIntro && (
          <ShipSelectScreen
            formA={keeperForm.formA}
            formB={keeperForm.formB}
            maxHp={keeperForm.maxHp}
            maxDmg={keeperForm.maxDmg}
            maxSpd={keeperForm.maxSpd}
            pct={keeperForm.pct}
            onSelectKeeper={(key) => void setShipChoice(key)}
            onLogout={logout}
            authError={authError}
          />
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
                  type="button"
                  className={styles.menuButton}
                  onClick={() => setMenuOpen(true)}
                >
                  Меню
                </button>
                <div className={styles.huntBuffs}>
                  {vengeance && vengeance.expiresAt > Date.now() && (
                    <div className={styles.vengeanceBuff} aria-label="Hunting">
                      <span className={styles.vengeanceIcon} title="Hunting">
                        ⚔
                      </span>
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
                          {Math.max(
                            0,
                            Math.ceil((vengeance.expiresAt - Date.now()) / 1000)
                          )}
                          s
                        </span>
                      </div>
                    </div>
                  )}
                  {hunted &&
                    !vengeance &&
                    hunted.expiresAt > Date.now() && (
                      <div
                        className={styles.huntedBuff}
                        aria-label="Being hunted"
                      >
                        <span
                          className={styles.huntedIcon}
                          title="Being hunted"
                        >
                          🎯
                        </span>
                        <div className={styles.huntedDetails}>
                          <span className={styles.huntedName}>
                            Hunted by: {hunted.hunterNickname}
                          </span>
                          <span className={styles.huntedTime}>
                            {Math.max(
                              0,
                              Math.ceil(
                                (hunted.expiresAt - Date.now()) / 1000
                              )
                            )}
                            s
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
                  Энергия: {resources.scrap} /{" "}
                  {10 + Math.max(0, playerLevel - 1) * 3}
                </span>
                <span>Токены: {resources.tokens}</span>
              </div>

              {error && <p className={styles.error}>{error}</p>}
            </div>

            {isDead && (
              <DeathOverlay
                killedBy={deathInfo?.killedBy ?? ""}
                killedByUserId={deathInfo?.killedByUserId}
                lostTokens={deathInfo?.lostTokens ?? 0}
                lostExp={deathInfo?.lostExp ?? 0}
                onRespawn={() => requestRespawn()}
                onRespawnVengeance={requestRespawnVengeance}
              />
            )}

            {levelUpCelebration && (
              <LevelUpOverlay
                level={levelUpCelebration.level}
                onDismiss={() => clearLevelUpCelebration()}
              />
            )}

            {exitCountdown !== null && (
              <ExitOverlay countdown={exitCountdown} />
            )}

            {menuOpen && (
              <SettingsMenu
                userEmail={user?.email ?? ""}
                musicVolume={musicVolume}
                sfxVolume={sfxVolume}
                onMusicVolumeChange={setMusicVolume}
                onSfxVolumeChange={setSfxVolume}
                formA={keeperForm.formA}
                formB={keeperForm.formB}
                maxHp={keeperForm.maxHp}
                maxDmg={keeperForm.maxDmg}
                maxSpd={keeperForm.maxSpd}
                pct={keeperForm.pct}
                currentShip={user?.shipChoice ?? null}
                onShipChange={handleMonsterChange}
                onClose={() => setMenuOpen(false)}
                onContinue={() => setMenuOpen(false)}
                onExitGame={requestExitGame}
                onExitAndLogout={() => {
                  useGameStore.getState().setExitThenLogout(true);
                  requestExitGame();
                }}
                shipChangeLoading={monsterSaving}
                authLoading={authLoading}
                exitCountdown={exitCountdown}
              />
            )}

            <ChatPanel
              scope={chat.chatScope}
              onScopeChange={chat.setChatScope}
              messages={chat.activeMessages}
              chatInput={chat.chatInput}
              onChatInputChange={chat.setChatInput}
              onSend={chat.sendChat}
              chatListRef={chat.chatListRef}
              chatInputRef={chat.chatInputRef}
            />

            <PlayerPanel
              nickname={user?.nickname ?? null}
              playerLevel={playerLevel}
              exp={exp}
              expToNext={expToNext}
              expRatio={expRatio}
              resources={resources}
              skillSlots={skillSlots}
              skillCooldowns={skillCooldowns ?? {}}
              playerInSafeZone={playerInSafeZone}
              isDead={isDead}
              draggedSkillSlot={draggedSkillSlot}
              onDragStart={setDraggedSkillSlot}
              onDragEnd={() => setDraggedSkillSlot(null)}
              onSkillTrigger={triggerSkillSlot}
              onSetSkillSlots={setSkillSlots}
            />
          </div>
        )}
      </div>
    </div>
  );
}
