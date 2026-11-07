"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { getSkillDef } from "../../../server/game/shared/skills";
import {
  MUTATION_SKILL_IDS,
  MUTATION_MAX_LEVEL,
  getSkillLevelCost,
  getEffectiveEnergyCost,
  formatDuration,
} from "../../../server/game/shared/mutation";
import styles from "../page.module.css";

export function MutationButton() {
  const player = useGameStore((s) => s.player);
  const loadMutation = useGameStore((s) => s.loadMutation);
  const purchaseMutationSkill = useGameStore((s) => s.purchaseMutationSkill);
  const startMutationUpgrade = useGameStore((s) => s.startMutationUpgrade);
  const tokens = player?.resources?.tokens ?? 0;
  const mutations = player?.mutations ?? {
    purchasedSkills: [],
    skillLevels: {},
    upgradeInProgress: null,
  };
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    void loadMutation();
  }, [isOpen, loadMutation]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handlePurchase = async (skillId: string) => {
    if (loading) return;
    setLoading("purchase-" + skillId);
    try {
      await purchaseMutationSkill(skillId);
    } finally {
      setLoading(null);
    }
  };

  const handleUpgrade = async (skillId: string) => {
    if (loading) return;
    setLoading("upgrade-" + skillId);
    try {
      await startMutationUpgrade(skillId);
    } finally {
      setLoading(null);
    }
  };

  const upgradeInProgress = mutations.upgradeInProgress;
  const upgradingNow = upgradeInProgress && upgradeInProgress.endsAt > currentTime;
  const remainingMs = upgradingNow ? upgradeInProgress!.endsAt - currentTime : 0;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className={styles.mutationButton}
        onClick={() => setIsOpen(true)}
        title="Мутации — покупка и улучшение навыков"
      >
        <span className={styles.mutationButtonIcon}>🧬</span>
      </button>

      {isOpen && (
        <>
          <div
            className={styles.questPanelOverlay}
            onClick={() => setIsOpen(false)}
            role="presentation"
          />
          <div
            className={styles.mutationPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.questModalHeader}>
              <h2 className={styles.questModalTitle}>Мутации</h2>
              <button
                type="button"
                className={styles.questModalClose}
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <p className={styles.mutationIntro}>
              Приобретайте навыки за токены (уровень 1) и улучшайте до 5 ур. за токены и время.
              Обучение идёт и офлайн. Только купленные навыки можно ставить на панель.
            </p>
            <div className={styles.mutationTokens}>
              Токены: <strong>{tokens}</strong>
            </div>
            {upgradingNow && upgradeInProgress && (
              <div className={styles.mutationUpgradeProgress}>
                <span>Улучшение: {getSkillDef(upgradeInProgress.skillId)?.name ?? upgradeInProgress.skillId}</span>
                <span className={styles.mutationUpgradeTime}>
                  {formatDuration(remainingMs)}
                </span>
              </div>
            )}
            <div className={styles.mutationSkillList}>
              {MUTATION_SKILL_IDS.map((skillId) => {
                const def = getSkillDef(skillId);
                const purchased = mutations.purchasedSkills.includes(skillId);
                const level = Math.max(
                  0,
                  Math.min(
                    MUTATION_MAX_LEVEL,
                    mutations.skillLevels[skillId] ?? 0
                  )
                );
                const nextLevel = level + 1;
                const level1Cost = getSkillLevelCost(skillId, 1);
                const nextLevelCost = getSkillLevelCost(skillId, nextLevel);
                const canUpgrade =
                  purchased &&
                  level >= 1 &&
                  level < MUTATION_MAX_LEVEL &&
                  !upgradingNow &&
                  nextLevelCost != null &&
                  tokens >= nextLevelCost.tokens;
                const energyCost =
                  def != null && level >= 1
                    ? getEffectiveEnergyCost(def.energyCost, level)
                    : 0;

                return (
                  <div key={skillId} className={styles.mutationSkillCard}>
                    <div className={styles.mutationSkillHeader}>
                      {def?.icon && (
                        <img
                          src={def.icon}
                          alt=""
                          className={styles.mutationSkillIcon}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                      <div className={styles.mutationSkillInfo}>
                        <span className={styles.mutationSkillName}>
                          {def?.name ?? skillId}
                        </span>
                        {purchased && (
                          <span className={styles.mutationSkillLevel}>
                            Ур. {level} · стоимость: {energyCost} Э
                          </span>
                        )}
                      </div>
                    </div>
                    {!purchased ? (
                      <div className={styles.mutationSkillActions}>
                        <button
                          type="button"
                          className={styles.mutationBtn}
                          disabled={
                            loading !== null ||
                            level1Cost == null ||
                            tokens < level1Cost.tokens
                          }
                          onClick={() => handlePurchase(skillId)}
                        >
                          Уровень 1: {level1Cost?.tokens ?? 0} токенов
                          {level1Cost?.durationMs ? ` + ${formatDuration(level1Cost.durationMs)}` : ""}
                        </button>
                      </div>
                    ) : (
                      <div className={styles.mutationSkillActions}>
                        {level < MUTATION_MAX_LEVEL && nextLevelCost ? (
                          <button
                            type="button"
                            className={styles.mutationBtn}
                            disabled={!canUpgrade || loading !== null}
                            onClick={() => handleUpgrade(skillId)}
                          >
                            Уровень {nextLevel}: {nextLevelCost.tokens} токенов
                            {nextLevelCost.durationMs > 0
                              ? ` + ${formatDuration(nextLevelCost.durationMs)}`
                              : ""}
                          </button>
                        ) : (
                          <span className={styles.mutationMaxLevel}>
                            Макс. уровень
                          </span>
                        )}
                      </div>
                    )}
                    {(purchased || level1Cost != null) && (
                      <div className={styles.mutationHierarchy}>
                        <span className={styles.mutationHierarchyTitle}>
                          Уровни:
                        </span>
                        {[1, 2, 3, 4, 5].map((lvl) => {
                          const lc = getSkillLevelCost(skillId, lvl);
                          const done = level >= lvl;
                          return (
                            <div
                              key={lvl}
                              className={
                                done
                                  ? styles.mutationHierarchyRowDone
                                  : styles.mutationHierarchyRow
                              }
                            >
                              Ур. {lvl}: {lc?.tokens ?? 0} токенов
                              {lc?.durationMs ? `, ${formatDuration(lc.durationMs)}` : ""}
                              {def && lvl >= 1 && (
                                <> · {getEffectiveEnergyCost(def.energyCost, lvl)} Э</>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
