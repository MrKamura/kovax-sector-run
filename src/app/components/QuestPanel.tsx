"use client";

import { useEffect, useState, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import styles from "../page.module.css";

interface Position {
  x: number;
  y: number;
}

export function QuestPanel() {
  const activeQuests = useGameStore((s) => s.activeQuests);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const previousCompletedRef = useRef<Map<number, number>>(new Map());
  
  // Состояние для позиции панели
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("questPanelPosition");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return { x: 20, y: 20 };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<Position>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Отслеживаем завершение квестов для показа фанфар
  useEffect(() => {
    for (const quest of activeQuests) {
      if (!quest) continue;
      if (quest.completedAt && quest.completedAt !== previousCompletedRef.current.get(quest.id)) {
        // Квест только что завершился
        previousCompletedRef.current.set(quest.id, quest.completedAt);
        useGameStore.getState().setQuestCompleteReward({
          exp: quest.rewardExp,
          tokens: quest.rewardTokens,
        });
      }
    }
    // Очищаем завершенные квесты из ref
    const activeQuestIds = new Set(activeQuests.filter(q => q).map(q => q!.id));
    for (const [id] of previousCompletedRef.current) {
      if (!activeQuestIds.has(id)) {
        previousCompletedRef.current.delete(id);
      }
    }
  }, [activeQuests]);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      setCurrentTime(now);
      // Удаляем истёкшие квесты из store (сервер их уже удалил, UI не должен показывать «Отменить»)
      const current = useGameStore.getState().activeQuests;
      const stillActive = current.filter(
        (q): q is NonNullable<typeof q> =>
          q !== null && q.completedAt === null && (q.expiresAt - now) > 0
      );
      if (stillActive.length !== current.length) {
        useGameStore.getState().setActiveQuests(stillActive);
        useGameStore.getState().setDailyQuest(stillActive.length > 0 ? stillActive[0] : null);
      }
    };

    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Сохранение позиции в localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("questPanelPosition", JSON.stringify(position));
    }
  }, [position]);

  // Обработчики для перетаскивания
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      
      setPosition((prev) => {
        const panelWidth = panelRef.current?.offsetWidth || 200;
        const panelHeight = panelRef.current?.offsetHeight || 100;
        
        return {
          x: Math.max(0, Math.min(window.innerWidth - panelWidth, prev.x + deltaX)),
          y: Math.max(0, Math.min(window.innerHeight - panelHeight, prev.y + deltaY)),
        };
      });
      
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Только левая кнопка мыши
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  // Фильтруем только активные квесты (не завершённые и не истёкшие по времени)
  const now = currentTime;
  const activeQuestsFiltered = activeQuests.filter(
    (q): q is NonNullable<typeof q> => 
      q !== null && q.completedAt === null && (q.expiresAt - now) > 0
  );

  if (activeQuestsFiltered.length === 0) {
    return null;
  }

  return (
    <div 
      ref={panelRef}
      className={styles.questProgressRight}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: "auto",
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div 
        className={`${styles.questProgressRightTitle} ${isDragging ? styles.questProgressRightTitleDragging : ""}`}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
      >
        Активные квесты
      </div>
      {activeQuestsFiltered.map((quest) => {
        const timeRemaining = Math.max(0, quest.expiresAt - currentTime);
        const progressPercent = Math.min(100, (quest.killsCompleted / quest.killsRequired) * 100);
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        const totalTime = quest.expiresAt - quest.startedAt;
        const timePercent = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0;
        const isLowTime = timePercent < 15 && timeRemaining > 0;
        const questTitle = quest.questType === "pvp_kills" ? "PvP квест" : "Квест на мобов";

        return (
          <div key={quest.id} className={styles.questProgressItem}>
            <div className={styles.questProgressItemTitle}>{questTitle}</div>
            <div className={styles.questProgressRightTime}>
              <span className={styles.questTimerLabel}>Время:</span>
              <span
                className={`${styles.questTimerValue} ${isLowTime ? styles.questTimerValueLow : ""}`}
              >
                {timeString}
              </span>
            </div>
            <div className={styles.questProgressRightKills}>
              {quest.killsCompleted} / {quest.killsRequired}
            </div>
            <div className={styles.questProgressRightBar}>
              <div
                className={styles.questProgressRightFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}