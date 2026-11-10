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