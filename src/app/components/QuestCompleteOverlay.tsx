"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";

interface QuestCompleteOverlayProps {
  rewardExp: number;
  rewardTokens: number;
  onClose: () => void;
}

export function QuestCompleteOverlay({ rewardExp, rewardTokens, onClose }: QuestCompleteOverlayProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 500); // Задержка для анимации исчезновения
    }, 4000); // Показываем 4 секунды

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!show) return null;

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 500); // Задержка для анимации исчезновения
  };

  return (
    <div className={styles.questCompleteOverlay} onClick={handleClose}>
      <div className={styles.questCompleteContent} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.questCompleteClose}
          onClick={handleClose}
          type="button"
          aria-label="Закрыть"
        >
          ×
        </button>
        <div className={styles.questCompleteTitle}>🎉 Квест выполнен! 🎉</div>
        <div className={styles.questCompleteRewards}>
          <div className={styles.questCompleteReward}>
            <span className={styles.questCompleteRewardIcon}>⭐</span>
            <span className={styles.questCompleteRewardText}>+{rewardExp} опыта</span>
          </div>
          <div className={styles.questCompleteReward}>
            <span className={styles.questCompleteRewardIcon}>💰</span>
            <span className={styles.questCompleteRewardText}>+{rewardTokens} токенов</span>
          </div>
        </div>
      </div>
    </div>
  );
}
