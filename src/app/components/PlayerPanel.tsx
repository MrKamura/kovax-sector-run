"use client";

import { getSkillDef } from "@/lib/skills";
import styles from "../page.module.css";

type PlayerPanelProps = {
  nickname: string | null;
  playerLevel: number;
  exp: number;
  expToNext: number;
  expRatio: number;
  resources: { scrap: number; tokens: number };
  skillSlots: string[];
  skillCooldowns: Record<string, number>;
  playerInSafeZone: boolean;
  isDead: boolean;
  draggedSkillSlot: number | null;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onSkillTrigger: (index: number) => void;
  onSetSkillSlots: (slots: string[]) => void;
};

export function PlayerPanel({
  nickname,
  playerLevel,
  exp,
  expToNext,
  expRatio,
  resources,
  skillSlots,
  skillCooldowns,
  playerInSafeZone,
  isDead,
  draggedSkillSlot,
  onDragStart,
  onDragEnd,
  onSkillTrigger,
  onSetSkillSlots,
}: PlayerPanelProps) {
  return (
    <div className={styles.playerPanel}>
      <div className={styles.playerHeader}>
        <span>{nickname ?? "Пилот"} · Lv.{playerLevel}</span>
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
          const canAfford =
            def && resources.scrap >= (def.energyCost ?? 0);
          const cooldownEndsAt = Number(
            (skillId && skillCooldowns?.[skillId]) ?? 0
          );
          const now = Date.now();
          const cooldownRemainingMs =
            cooldownEndsAt > now ? cooldownEndsAt - now : 0;
          const isOnCooldown = cooldownRemainingMs > 0;
          const cooldownSec = Math.ceil(cooldownRemainingMs / 1000);
          const isDisabled =
            def &&
            (!canAfford || isOnCooldown || playerInSafeZone);

          return (
            <div
              key={index}
              className={`${styles.skillSlot} ${
                draggedSkillSlot === index ? styles.skillSlotDragging : ""
              } ${
                canAfford && !isOnCooldown && !playerInSafeZone
                  ? styles.skillSlotUsable
                  : ""
              } ${isDisabled ? styles.skillSlotDisabled : ""}`}
              draggable={!!skillId}
              onDragStart={() => skillId && onDragStart(index)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = draggedSkillSlot;
                onDragEnd();
                if (from == null || from === index) return;
                const next = [...skillSlots];
                const tmp = next[from];
                next[from] = next[index];
                next[index] = tmp;
                void onSetSkillSlots(next);
              }}
              onClick={() => {
                if (!skillId || isDead || isDisabled) return;
                void onSkillTrigger(index);
              }}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              aria-label={
                def
                  ? def.description
                    ? `${def.name}. ${def.description}`
                    : def.name
                  : `Слот ${keyNum}`
              }
              title={
                def
                  ? def.description
                    ? `${def.name}\n${def.description}`
                    : def.name
                  : undefined
              }
              aria-disabled={isDisabled || undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!skillId || isDead || isDisabled) return;
                  void onSkillTrigger(index);
                }
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
                  {def.description ? (
                    <span className={styles.skillSlotTooltipDesc}>
                      {def.description}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
