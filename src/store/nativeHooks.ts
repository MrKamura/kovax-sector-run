// Native hooks (аналог React хуков без React)

/**
 * Native hook for cooldown tick (аналог useCooldownTick)
 * Обновляет тик каждую секунду, когда есть кулдауны
 */
export function useCooldownTick(
  skillCooldowns: Record<string, number> | undefined,
  vengeanceExpiresAt: number | undefined
): { tick: number; cleanup: () => void } {
  let tick = 0;
  const setTick = (value: number | ((prev: number) => number)) => {
    tick = typeof value === 'function' ? (value as (prev: number) => number)(tick) : value;
  };

  let intervalId: number | null = null;

  const start = () => {
    const hasCooldown =
      skillCooldowns &&
      Object.values(skillCooldowns).some((endsAt) => Number(endsAt) > Date.now());
    const hasVengeance =
      vengeanceExpiresAt != null && vengeanceExpiresAt > Date.now();
    if (!hasCooldown && !hasVengeance) return;
    intervalId = window.setInterval(() => {
      tick++;
    }, 1000);
  };

  const cleanup = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // Запустить сразу
  start();

  return { tick, cleanup };
}

/**
 * Native hook for keeper form display (аналог useKeeperFormDisplay)
 */
export function useKeeperFormDisplay(
  player: any | null,
  user: any | null
): {
  formA: any;
  formB: any;
  maxHp: number;
  maxDmg: number;
  maxSpd: number;
  pct: (value: number, max: number) => number;
} {
  // TODO: реализовать логику из useKeeperFormDisplay.ts
  // Использует gameStore для получения данных
  const formA = { name: 'Keeper 1', level: 1, hp: 100, dmg: 12, spd: 220 };
  const formB = { name: 'Keeper 2', level: 1, hp: 100, dmg: 12, spd: 220 };
  const maxHp = 100;
  const maxDmg = 12;
  const maxSpd = 220;
  const pct = (value: number, max: number) => (value / max) * 100;

  return { formA, formB, maxHp, maxDmg, maxSpd, pct };
}

/**
 * Native hook for skill hotkeys (аналог useSkillHotkeys)
 * Обрабатывает горячие клавиши 1-9 для скиллов
 */
export function useSkillHotkeys(
  enabled: boolean,
  onSkillTrigger: (index: number) => void,
  getSkillAt: (index: number) => string | undefined,
  getSkillLevel: (skillId: string) => number,
  getEnergyCost: (cost: number, level: number) => number,
  getPlayerState: () => { skills: string[]; mutations?: { skillLevels?: Record<string, number> }; resources?: { scrap?: number }; skillCooldowns?: Record<string, number> }
): { cleanup: () => void } {
  let cleanupFn: () => void = () => {};

  if (enabled) {
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= '1' && key <= '9') {
        const active = document.activeElement;
        const tag = active?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        const index = key.charCodeAt(0) - '1'.charCodeAt(0);
        const state = getPlayerState();
        const baseSkills = (state.skills ?? []).slice(0, 9);
        const skillId = baseSkills[index];
        const def = skillId ? { energyCost: 10 } : null; // Placeholder
        const level = skillId ? (state.mutations?.skillLevels?.[skillId] ?? 0) : 0;
        const energyCost = def ? getEnergyCost(def.energyCost, level) : 0;
        const energy = state.resources?.scrap ?? 0;
        const cooldownEndsAt = Number(
          (skillId && state.skillCooldowns?.[skillId]) ?? 0
        );
        if (def && energy < energyCost) return;
        if (def && cooldownEndsAt > Date.now()) return;
        onSkillTrigger(index);
      }
    };
    window.addEventListener('keydown', handler);
    cleanupFn = () => window.removeEventListener('keydown', handler);
  }

  return { cleanup: () => cleanupFn() };
}