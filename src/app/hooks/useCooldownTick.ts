"use client";

import { useEffect, useState } from "react";

export function useCooldownTick(
  skillCooldowns: Record<string, number> | undefined,
  vengeanceExpiresAt: number | undefined
) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const hasCooldown =
      skillCooldowns &&
      Object.values(skillCooldowns).some((endsAt) => Number(endsAt) > Date.now());
    const hasVengeance =
      vengeanceExpiresAt != null && vengeanceExpiresAt > Date.now();
    if (!hasCooldown && !hasVengeance) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [skillCooldowns, vengeanceExpiresAt]);
}
