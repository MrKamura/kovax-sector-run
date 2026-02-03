"use client";

import { useEffect } from "react";
import { getSkillDef } from "@/lib/skills";
import { DEFAULT_PLAYER } from "@/lib/gameDefaults";
import { useGameStore } from "@/store/gameStore";

export function useSkillHotkeys(
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;
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
        const cooldownEndsAt = Number(
          (skillId && state.skillCooldowns?.[skillId]) ?? 0
        );
        if (def && energy < (def.energyCost ?? 0)) return;
        if (def && cooldownEndsAt > Date.now()) return;
        void state.triggerSkillSlot(index);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
