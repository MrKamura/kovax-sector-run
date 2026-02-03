import { create } from "zustand";
import { DEFAULT_PLAYER } from "@/lib/gameDefaults";
import { getSkillDef } from "@/lib/skills";

export type PlayerState = {
  id: number;
  userId: number | null;
  name: string;
  resources: {
    scrap: number;
    tokens: number;
  };
  health: number;
  maxHealth: number;
  level: number;
  exp: number;
  expToNext: number;
  damage: number;
  skills: string[];
  lastHealthAt: string | null;
  posX: number;
  posY: number;
  rotation: number;
  lastPositionAt: string | null;
  shelterLevel: number;
  weapons: Array<{
    id: string;
    name: string;
    power: number;
  }>;
  blueprints: string[];
  cosmetics: string[];
  lastCollectedAt: string | null;
  monsterProgress?: Record<
    string,
    {
      level: number;
      exp: number;
      expToNext: number;
      health: number;
      maxHealth: number;
      damage: number;
    }
  >;
};

export type UserState = {
  id: number;
  email: string;
  nickname: string | null;
  shipChoice: string | null;
  musicVolume?: number;
  sfxVolume?: number;
};

type GameStore = {
  player: PlayerState | null;
  user: UserState | null;
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  isLoading: boolean;
  authLoading: boolean;
  sessionReady: boolean;
  deathInfo: {
    lostTokens: number;
    lostExp: number;
    killedBy?: string;
    killedByUserId?: number;
  } | null;
  /** Cycle of Vengeance buff from server (target sector, expiresAt) */
  vengeance: {
    targetUserId: number;
    targetNickname: string;
    expiresAt: number;
    targetSectorId: string | null;
    targetSectorName: string | null;
  } | null;
  setVengeance: (v: GameStore["vengeance"]) => void;
  /** Hunted debuff from server (when someone is hunting you) */
  hunted: {
    hunterUserId: number;
    hunterNickname: string;
    expiresAt: number;
  } | null;
  setHunted: (v: GameStore["hunted"]) => void;
  levelUpCelebration: { level: number; previousLevel: number } | null;
  pendingRespawn: boolean;
  /** When set, Phaser sends respawn_vengeance with this userId */
  vengeanceRespawnTargetUserId: number | null;
  error: string | null;
  authError: string | null;
  loadSession: () => Promise<void>;
  loadPlayer: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setNickname: (nickname: string) => Promise<void>;
  setShipChoice: (ship: string) => Promise<void>;
  collectResource: (resource: "scrap" | "tokens") => Promise<void>;
  consumeEnergy: (amount?: number) => Promise<void>;
  damagePlayer: (amount: number) => Promise<void>;
  craftRecipe: (recipeId: string) => Promise<void>;
  upgradeShelter: () => Promise<void>;
  applyPlayerUpdate: (patch: Partial<PlayerState>) => void;
  addSkill: (skill: string) => Promise<void>;
  setSkillSlots: (slots: string[]) => Promise<void>;
  triggerSkillSlot: (slotIndex: number) => Promise<boolean>;
  /** Set by Phaser: true when local player is inside the safe zone (skills disabled) */
  playerInSafeZone: boolean;
  setPlayerInSafeZone: (value: boolean) => void;
  /** skillId -> timestamp (ms) when cooldown ends */
  skillCooldowns: Record<string, number>;
  activeSkillEffect: { skillId: string; expiresAt: number } | null;
  setActiveSkillEffect: (effect: { skillId: string; expiresAt: number } | null) => void;
  /** Set when a skill with serverEffect (e.g. immunity) is used; Phaser sends the message and clears it */
  pendingServerSkillEffect: { skillId: string; durationMs: number } | null;
  setPendingServerSkillEffect: (effect: { skillId: string; durationMs: number } | null) => void;
  clearDeath: () => void;
  setDeathInfo: (info: { lostTokens: number; lostExp: number; killedBy?: string; killedByUserId?: number } | null) => void;
  clearLevelUpCelebration: () => void;
  requestRespawn: () => void;
  requestRespawnVengeance: (killedByUserId: number) => void;
  clearRespawnRequest: () => void;
  setMusicVolume: (value: number) => void;
  setSfxVolume: (value: number) => void;
  /** Safe exit: set true when user clicks Exit; arena sends request_exit and starts countdown */
  exitRequested: boolean;
  /** Seconds left until disconnect (5..0); null when not exiting */
  exitCountdown: number | null;
  requestExitGame: () => void;
  setExitCountdown: (seconds: number | null) => void;
  clearExitCountdown: () => void;
  /** Called by arena after sending request_exit: stop requesting, show 5s countdown */
  onExitRequestSent: () => void;
  /** If true, after exit_ready we also call logout (used by "Log out" button) */
  exitThenLogout: boolean;
  setExitThenLogout: (value: boolean) => void;
  /** Set by Phaser: true when local player health < ~25% (red vignette, tension music, etc.) */
  lowHealthActive: boolean;
  setLowHealthActive: (value: boolean) => void;
  /** Brief "X killed Y" message for sector (set by Phaser on sector_kill_flash), cleared after ~2s */
  sectorKillFlash: { killerName: string; victimName: string } | null;
  setSectorKillFlash: (v: { killerName: string; victimName: string } | null) => void;
};

const request = async <T>(url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = (await response.json()) as T;
  if (!response.ok) {
    const error = (data as { error?: string }).error ?? "Request failed.";
    throw new Error(error);
  }

  return data;
};

const USER_CACHE_KEY = "kovax_user_cache";

const loadCachedUser = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as UserState;
  } catch {
    return null;
  }
};

const saveCachedUser = (user: UserState | null) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!user) {
      window.localStorage.removeItem(USER_CACHE_KEY);
    } else {
      window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore storage errors
  }
};

let saveSettingsTimer: number | null = null;
const scheduleSaveAudioSettings = (next: {
  musicVolume?: number;
  sfxVolume?: number;
}) => {
  if (typeof window === "undefined") {
    return;
  }
  if (saveSettingsTimer) {
    window.clearTimeout(saveSettingsTimer);
  }
  saveSettingsTimer = window.setTimeout(() => {
    saveSettingsTimer = null;
    void fetch("/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {
      // ignore network errors; we'll try again on next change
    });
  }, 350);
};

export const useGameStore = create<GameStore>((set) => ({
  player: null,
  // IMPORTANT: don't read localStorage during initial render (SSR hydration mismatch).
  // We'll load the cached user inside `loadSession()` (runs on the client).
  user: null,
  musicVolume: 0.45,
  sfxVolume: 0.55,
  isLoading: false,
  authLoading: false,
  sessionReady: false,
  deathInfo: null,
  vengeance: null,
  setVengeance: (v) => set({ vengeance: v }),
  hunted: null,
  setHunted: (v) => set({ hunted: v }),
  levelUpCelebration: null,
  pendingRespawn: false,
  vengeanceRespawnTargetUserId: null,
  error: null,
  authError: null,
  playerInSafeZone: false,
  setPlayerInSafeZone: (value) => set({ playerInSafeZone: value }),
  exitRequested: false,
  exitCountdown: null,
  requestExitGame: () => set({ exitRequested: true }),
  setExitCountdown: (seconds) => set({ exitCountdown: seconds }),
  clearExitCountdown: () =>
    set({ exitRequested: false, exitCountdown: null }),
  onExitRequestSent: () =>
    set({ exitRequested: false, exitCountdown: 5 }),
  exitThenLogout: false,
  setExitThenLogout: (value) => set({ exitThenLogout: value }),
  lowHealthActive: false,
  setLowHealthActive: (value) => set({ lowHealthActive: value }),
  sectorKillFlash: null,
  setSectorKillFlash: (v) => set({ sectorKillFlash: v }),
  skillCooldowns: {},
  activeSkillEffect: null,
  pendingServerSkillEffect: null,
  loadSession: async () => {
    set({ authLoading: true, authError: null });
    try {
      const data = await request<{ user: UserState | null }>("/api/auth/me");
      saveCachedUser(data.user);
      set((state) => ({
        user: data.user,
        authLoading: false,
        sessionReady: true,
        musicVolume: data.user?.musicVolume ?? state.musicVolume,
        sfxVolume: data.user?.sfxVolume ?? state.sfxVolume,
      }));
    } catch (error) {
      const cached = loadCachedUser();
      set({
        authError: error instanceof Error ? error.message : "Auth failed.",
        authLoading: false,
        sessionReady: true,
        user: cached ?? null,
      });
    }
  },
  loadPlayer: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await request<{ player: PlayerState; user: UserState }>(
        "/api/player"
      );
      const baseSkills = data.player.skills ?? [];
      const merged: string[] = [...baseSkills];
      for (const id of DEFAULT_PLAYER.skills) {
        if (!merged.includes(id) && merged.length < 9) merged.push(id);
      }
      const playerWithDefaults = {
        ...data.player,
        skills: merged.slice(0, 9),
      };
      set((state) => {
        const wasDead = (state.player?.health ?? 1) <= 0;
        const isDead = (playerWithDefaults.health ?? 1) <= 0;
        const nextDeathInfo =
          (playerWithDefaults.health ?? 1) <= 0 ? state.deathInfo : null;
        return {
          player: playerWithDefaults,
          user: data.user,
          isLoading: false,
          deathInfo: nextDeathInfo,
          pendingRespawn: isDead ? (wasDead ? state.pendingRespawn : false) : false,
          musicVolume: data.user?.musicVolume ?? state.musicVolume,
          sfxVolume: data.user?.sfxVolume ?? state.sfxVolume,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Load failed.";
      if (message.includes("Unauthorized")) {
        set({ error: message, isLoading: false, player: null });
      } else {
        set({ error: message, isLoading: false });
      }
    }
  },
  register: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await request<{ user: UserState }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveCachedUser(data.user);
      set({ user: data.user, authLoading: false });
    } catch (error) {
      set({
        authError: error instanceof Error ? error.message : "Register failed.",
        authLoading: false,
      });
    }
  },
  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await request<{ user: UserState }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveCachedUser(data.user);
      set({ user: data.user, authLoading: false });
    } catch (error) {
      set({
        authError: error instanceof Error ? error.message : "Login failed.",
        authLoading: false,
      });
    }
  },
  logout: async () => {
    set({ authLoading: true, authError: null });
    try {
      await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      saveCachedUser(null);
      set({ user: null, player: null, authLoading: false });
    } catch (error) {
      set({
        authError: error instanceof Error ? error.message : "Logout failed.",
        authLoading: false,
      });
    }
  },
  setNickname: async (nickname) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await request<{ user: UserState }>("/api/user/nickname", {
        method: "POST",
        body: JSON.stringify({ nickname }),
      });
      saveCachedUser(data.user);
      set({ user: data.user, authLoading: false });
    } catch (error) {
      set({
        authError: error instanceof Error ? error.message : "Nickname failed.",
        authLoading: false,
      });
    }
  },
  setShipChoice: async (ship) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await request<{ user: UserState }>("/api/user/ship", {
        method: "POST",
        body: JSON.stringify({ ship }),
      });
      saveCachedUser(data.user);
      set({ user: data.user, authLoading: false });
    } catch (error) {
      set({
        authError: error instanceof Error ? error.message : "Ship failed.",
        authLoading: false,
      });
    }
  },
  collectResource: async (resource) => {
    set({ error: null });
    try {
      const data = await request<{ player: PlayerState }>("/api/collect", {
        method: "POST",
        body: JSON.stringify({ resource }),
      });
      set({ player: data.player });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Collect failed.",
      });
    }
  },
  consumeEnergy: async (amount = 1) => {
    set({ error: null });
    try {
      const data = await request<{ player: PlayerState }>("/api/consume-energy", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      set({ player: data.player });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Energy use failed.",
      });
    }
  },
  damagePlayer: async (amount) => {
    set({ error: null });
    try {
      const data = await request<{
        player: PlayerState;
        death?: { lostTokens: number; lostExp: number; killedBy?: string };
      }>("/api/damage-player", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      set((state) => {
        const wasDead = (state.player?.health ?? 1) <= 0;
        const isDead = (data.player.health ?? 1) <= 0;
        return {
          player: data.player,
          deathInfo: data.death ?? state.deathInfo,
          // If this hit caused a new death, clear any stale respawn request.
          pendingRespawn: isDead ? (wasDead ? state.pendingRespawn : false) : false,
        };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Damage failed.",
      });
    }
  },
  craftRecipe: async (recipeId) => {
    set({ error: null });
    try {
      const data = await request<{ player: PlayerState }>("/api/craft", {
        method: "POST",
        body: JSON.stringify({ recipeId }),
      });
      set({ player: data.player });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Craft failed.",
      });
    }
  },
  upgradeShelter: async () => {
    set({ error: null });
    try {
      const data = await request<{ player: PlayerState }>(
        "/api/upgrade-shelter",
        {
          method: "POST",
        }
      );
      set({ player: data.player });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Upgrade failed.",
      });
    }
  },
  applyPlayerUpdate: (patch) => {
    set((state) => {
      if (!state.player) {
        return state;
      }
      const nextPlayer = { ...state.player, ...patch };
      const shouldClearDeath = (patch.health ?? nextPlayer.health) > 0;
      const wasDead = (state.player.health ?? 1) <= 0;
      const isDead = (nextPlayer.health ?? 1) <= 0;
      const newLevel = typeof patch.level === "number" ? patch.level : null;
      const prevLevel = state.player.level ?? 1;
      const levelUpCelebration =
        newLevel != null && newLevel > prevLevel
          ? { level: newLevel, previousLevel: prevLevel }
          : null;
      return {
        player: nextPlayer,
        deathInfo: shouldClearDeath ? null : state.deathInfo,
        levelUpCelebration: levelUpCelebration ?? state.levelUpCelebration,
        pendingRespawn: shouldClearDeath
          ? false
          : isDead
          ? wasDead
            ? state.pendingRespawn
            : false
          : false,
      };
    });
  },
  addSkill: async (skill) => {
    set({ error: null });
    try {
      const data = await request<{ player: PlayerState }>("/api/skills", {
        method: "POST",
        body: JSON.stringify({ skill }),
      });
      set({ player: data.player });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Skill failed.",
      });
    }
  },
  setSkillSlots: async (slots) => {
    set({ error: null });
    try {
      const data = await request<{ player: PlayerState }>("/api/skills", {
        method: "PUT",
        body: JSON.stringify({ skills: slots }),
      });
      set({ player: data.player });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to reorder skills.",
      });
    }
  },
  triggerSkillSlot: async (slotIndex) => {
    const { getState } = useGameStore;
    const state = getState();
    // Build merged list the same way as the page (filter(Boolean) first) so slot indices match
    const baseSkills = (state.player?.skills ?? []).filter(Boolean);
    const merged: string[] = [...baseSkills];
    for (const id of DEFAULT_PLAYER.skills) {
      if (!merged.includes(id) && merged.length < 9) merged.push(id);
    }
    const skillId = merged[slotIndex];
    if (!skillId) {
      return false;
    }
    const def = getSkillDef(skillId);
    if (!def) {
      return false;
    }
    if (state.playerInSafeZone) {
      set({ error: "В безопасной зоне навыки использовать нельзя." });
      return false;
    }
    const cooldownEndsAt = state.skillCooldowns?.[skillId] ?? 0;
    if (cooldownEndsAt > Date.now()) {
      const sec = Math.ceil((cooldownEndsAt - Date.now()) / 1000);
      set({ error: `Перезарядка: ${sec} сек.` });
      return false;
    }
    const energy = state.player?.resources?.scrap ?? 0;
    if (energy < def.energyCost) {
      set({ error: "Недостаточно энергии." });
      return false;
    }
    set({ error: null });
    try {
      const data = await request<{ player: PlayerState }>("/api/consume-energy", {
        method: "POST",
        body: JSON.stringify({ amount: def.energyCost }),
      });
      set({ player: data.player });
      if (def.durationMs) {
        set({
          activeSkillEffect: {
            skillId: def.id,
            expiresAt: Date.now() + def.durationMs,
          },
        });
      }
      if ((def.serverEffect === "immunity" || def.serverEffect === "healing" || def.serverEffect === "fury" || def.serverEffect === "teleport" || def.serverEffect === "gravity_pit") && def.durationMs) {
        set({ pendingServerSkillEffect: { skillId: def.id, durationMs: def.durationMs } });
      }
      const cooldownMs = def.cooldownMs ?? 0;
      if (cooldownMs > 0) {
        set((s) => ({
          skillCooldowns: {
            ...s.skillCooldowns,
            [def.id]: Date.now() + cooldownMs,
          },
        }));
      }
      return true;
    } catch {
      set({
        error: "Недостаточно энергии.",
      });
      return false;
    }
  },
  setActiveSkillEffect: (effect) => set({ activeSkillEffect: effect }),
  setPendingServerSkillEffect: (effect) => set({ pendingServerSkillEffect: effect }),
  clearDeath: () => set({ deathInfo: null }),
  setDeathInfo: (info) => set({ deathInfo: info }),
  clearLevelUpCelebration: () => set({ levelUpCelebration: null }),
  requestRespawn: () =>
    set({ pendingRespawn: true, vengeanceRespawnTargetUserId: null }),
  requestRespawnVengeance: (killedByUserId) =>
    set({ pendingRespawn: true, vengeanceRespawnTargetUserId: killedByUserId }),
  clearRespawnRequest: () =>
    set({ pendingRespawn: false, vengeanceRespawnTargetUserId: null }),
  setMusicVolume: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(1, Number(value) || 0));
      scheduleSaveAudioSettings({ musicVolume: next });
      return { musicVolume: next };
    }),
  setSfxVolume: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(1, Number(value) || 0));
      scheduleSaveAudioSettings({ sfxVolume: next });
      return { sfxVolume: next };
    }),
}));
