import { useEffect } from "react";
import { getSkillDef } from "../../server/game/shared/skills";
import { getEffectiveEnergyCost } from "../../server/game/shared/mutation";
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
        const baseSkills = (state.player?.skills ?? []).slice(0, 9);
        const skillId = baseSkills[index];
        const def = skillId ? getSkillDef(skillId) : null;
        const level = state.player?.mutations?.skillLevels?.[skillId ?? ""] ?? 0;
        const energyCost = def ? getEffectiveEnergyCost(def.energyCost, level) : 0;
        const energy = state.player?.resources?.scrap ?? 0;
        const cooldownEndsAt = Number(
          (skillId && state.skillCooldowns?.[skillId]) ?? 0
        );
        if (def && energy < energyCost) return;
        if (def && cooldownEndsAt > Date.now()) return;
        void state.triggerSkillSlot(index);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
