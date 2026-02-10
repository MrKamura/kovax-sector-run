"use client";

import { useState, useEffect, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import styles from "../page.module.css";

// Глобальная переменная для хранения socket (устанавливается из PhaserArena)
let globalSocket: WebSocket | null = null;

export function setGlobalSocket(socket: WebSocket | null) {
  globalSocket = socket;
}

export function getGlobalSocket(): WebSocket | null {
  return globalSocket;
}

interface QuestInfo {
  sectorId: string;
  sectorName: string;
  questType: "mob_kills" | "pvp_kills";
  available: boolean;
  completedAt: number | null;
  timeUntilReset: number | null;
  isActive: boolean;
}

export function QuestButton() {
  const activeQuests = useGameStore((s) => s.activeQuests);
  const questAvailable = useGameStore((s) => s.questAvailable);
  const currentSectorQuestInfo = useGameStore((s) => s.currentSectorQuestInfo);
  const currentSectorPvpAllowed = useGameStore((s) => s.currentSectorPvpAllowed);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<QuestInfo | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Обновляем время каждую секунду (для таймеров и определения истёкших квестов)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Формируем список доступных квестов для текущего сектора
  const quests = useMemo(() => {
    const questsList: QuestInfo[] = [];
    
    if (!currentSectorQuestInfo) {
      return questsList; // Нет информации о текущем секторе
    }
    
    const sectorInfo = currentSectorQuestInfo;
    
    // Получаем активные квесты для текущего сектора (истёкшие по времени не считаем активными)
    const now = currentTime;
    const sectorActiveQuests = activeQuests
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .filter(q => q.sectorId === sectorInfo.sectorId)
      .filter(q => q.completedAt === null && (q.expiresAt - now) > 0);
    
    // Проверяем, какие типы квестов уже активны (только не истёкшие)
    const activeMobQuest = sectorActiveQuests.find(q => q.questType === "mob_kills");
    const activePvpQuest = sectorActiveQuests.find(q => q.questType === "pvp_kills");
    
    // Получаем информацию о каждом типе квеста (если доступна)
    const mobQuestInfo = sectorInfo.questInfo?.mob_kills;
    const pvpQuestInfo = sectorInfo.questInfo?.pvp_kills;
    
    // Добавляем квест на убийство мобов
    questsList.push({
      sectorId: sectorInfo.sectorId,
      sectorName: sectorInfo.sectorName,
      questType: "mob_kills",
      available: mobQuestInfo 
        ? mobQuestInfo.available && !activeMobQuest
        : sectorInfo.available && !activeMobQuest,
      completedAt: activeMobQuest?.completedAt || mobQuestInfo?.completedAt || sectorInfo.completedAt || null,
      timeUntilReset: activeMobQuest?.completedAt 
        ? (() => {
            const now = new Date();
            const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            return Math.max(0, tomorrowStart.getTime() - currentTime);
          })()
        : mobQuestInfo?.timeUntilReset ?? sectorInfo.timeUntilReset,
      isActive: !!activeMobQuest,
    });
    
    // Добавляем PvP квест только если в текущем секторе разрешён PvP (не белый сектор)
    if (currentSectorPvpAllowed) {
      questsList.push({
        sectorId: sectorInfo.sectorId,
        sectorName: sectorInfo.sectorName,
        questType: "pvp_kills",
        available: pvpQuestInfo 
          ? pvpQuestInfo.available && !activePvpQuest
          : sectorInfo.available && !activePvpQuest,
        completedAt: activePvpQuest?.completedAt || pvpQuestInfo?.completedAt || null,
        timeUntilReset: activePvpQuest?.completedAt 
          ? (() => {
              const now = new Date();
              const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
              return Math.max(0, tomorrowStart.getTime() - currentTime);
            })()
          : pvpQuestInfo?.timeUntilReset ?? null,
        isActive: !!activePvpQuest,
      });
    }

    return questsList;
  }, [activeQuests, questAvailable, currentSectorQuestInfo, currentSectorPvpAllowed, currentTime]);

  const handleStartQuest = (questType: "mob_kills" | "pvp_kills") => {
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
      globalSocket.send(JSON.stringify({ type: "start_quest", questType }));
      setIsModalOpen(false);
      setSelectedQuest(null);
    } else {
      console.warn("Socket not available");
    }
  };

  const handleCancelQuest = () => {
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN && selectedQuest) {
      globalSocket.send(JSON.stringify({ 
        type: "cancel_quest",
        questType: selectedQuest.questType 
      }));
      setIsModalOpen(false);
      setSelectedQuest(null);
    } else {
      console.warn("Socket not available or no quest selected");
    }
  };

  const formatTimeUntilReset = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  const getQuestInfo = (questType: "mob_kills" | "pvp_kills") => {
    if (questType === "pvp_kills") {
      return {
        title: "PvP квест",
        description: "Убейте 3 других игроков и не погибните",
        conditions: [
          "Убить 3 игроков в секторе",
          "Не погибнуть во время выполнения квеста",
          "Время на выполнение: 10 минут",
          "Квест можно выполнить один раз в сутки",
        ],
        rewards: {
          exp: 500,
          tokens: 150,
        },
      };
    } else {
      return {
        title: "Квест на убийство мобов",
        description: "Убейте 20 мобов в текущем секторе за ограниченное время",
        conditions: [
          "Убить 20 мобов в секторе",
          "Время на выполнение: 5 минут",
          "Квест можно выполнить один раз в сутки",
        ],
        rewards: {
          exp: 250,
          tokens: 75,
        },
      };
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className={styles.questButton}
        onClick={() => setIsModalOpen(true)}
        title="Ежедневный квест"
      >
        <span className={styles.questButtonIcon}>📋</span>
        {questAvailable && (
          <span className={styles.questButtonBadge}>!</span>
        )}
      </button>

      {isModalOpen && (
        <>
          <div className={styles.questPanelOverlay} onClick={() => {
            setIsModalOpen(false);
            setSelectedQuest(null);
          }} />
          <div className={styles.questPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.questModalHeader}>
              <h2 className={styles.questModalTitle}>Ежедневные квесты</h2>
              <button
                type="button"
                className={styles.questModalClose}
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedQuest(null);
                }}
              >
                ×
              </button>
            </div>

            {selectedQuest ? (
              // Детали выбранного квеста
              <div className={styles.questModalContent}>
                <button
                  type="button"
                  className={styles.questModalBack}
                  onClick={() => setSelectedQuest(null)}
                >
                  ← Назад к списку
                </button>
                {(() => {
                  const info = getQuestInfo(selectedQuest.questType);
                  return (
                    <>
                      <p className={styles.questModalDescription}>{info.description}</p>

                      <div className={styles.questModalSection}>
                        <h3 className={styles.questModalSectionTitle}>Условия:</h3>
                        <ul className={styles.questModalConditions}>
                          {info.conditions.map((condition, index) => (
                            <li key={index}>{condition}</li>
                          ))}
                        </ul>
                      </div>

                      <div className={styles.questModalSection}>
                        <h3 className={styles.questModalSectionTitle}>Награда:</h3>
                        <div className={styles.questModalRewards}>
                          <div className={styles.questModalReward}>
                            <span className={styles.questModalRewardIcon}>⭐</span>
                            <span>+{info.rewards.exp} опыта</span>
                          </div>
                          <div className={styles.questModalReward}>
                            <span className={styles.questModalRewardIcon}>💰</span>
                            <span>+{info.rewards.tokens} токенов</span>
                          </div>
                        </div>
                      </div>

                      {selectedQuest.isActive ? (
                        <button
                          type="button"
                          className={styles.questModalCancelButton}
                          onClick={handleCancelQuest}
                        >
                          Отказаться
                        </button>
                      ) : selectedQuest.available ? (
                        <button
                          type="button"
                          className={styles.questModalStartButton}
                          onClick={() => handleStartQuest(selectedQuest.questType)}
                        >
                          Приступить
                        </button>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ) : (
              // Список квестов
              <div className={styles.questModalContent}>
                <div className={styles.questList}>
                  {quests.map((quest) => (
                    <div
                      key={`${quest.sectorId}-${quest.questType}`}
                      className={`${styles.questListItem} ${
                        !quest.available && !quest.isActive ? styles.questListItemCompleted : ""
                      } ${quest.isActive ? styles.questListItemActive : ""} ${
                        quest.available && !quest.isActive ? styles.questListItemClickable : ""
                      }`}
                      onClick={() => {
                        if (quest.available && !quest.isActive) {
                          setSelectedQuest(quest);
                        } else if (quest.isActive) {
                          setSelectedQuest(quest);
                        }
                      }}
                    >
                      <div className={styles.questListItemHeader}>
                        <span className={styles.questListItemTitle}>
                          {quest.questType === "pvp_kills" ? "PvP квест" : "Квест на мобов"}
                        </span>
                        {quest.isActive && (
                          <span className={styles.questListItemBadge}>Активен</span>
                        )}
                        {!quest.available && !quest.isActive && (
                          <span className={styles.questListItemBadgeCompleted}>Выполнен</span>
                        )}
                      </div>
                      {!quest.available && !quest.isActive && quest.timeUntilReset !== null && (
                        <div className={styles.questListItemResetTime}>
                          Обновление через: {formatTimeUntilReset(quest.timeUntilReset)}
                        </div>
                      )}
                      {quest.available && !quest.isActive && (
                        <div className={styles.questListItemHint}>
                          Нажмите, чтобы принять квест
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
