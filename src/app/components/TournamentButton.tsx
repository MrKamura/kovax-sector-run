"use client";

import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { getGlobalSocket } from "./QuestButton";
import styles from "../page.module.css";

const RATING_CATEGORIES = [
  { id: "rating_total", label: "Общий рейтинг" },
  { id: "rating_week", label: "Рейтинг за неделю" },
] as const;

const PVE_CATEGORIES = [
  { id: "pve_total_kills", label: "Убийства мобов (всего)" },
  { id: "pve_weekly_kills", label: "Убийства мобов (неделя)" },
  { id: "pve_best_streak", label: "Серия убийств мобов" },
  { id: "pve_quests_week", label: "Квесты (неделя)" },
] as const;

const PVP_CATEGORIES = [
  { id: "pvp_total_kills", label: "PvP убийства (всего)" },
  { id: "pvp_weekly_kills", label: "PvP убийства (неделя)" },
  { id: "pvp_best_streak", label: "Серия PvP убийств" },
  { id: "pvp_revenge_week", label: "Месть (неделя)" },
] as const;

type CategoryId =
  | typeof RATING_CATEGORIES[number]["id"]
  | typeof PVE_CATEGORIES[number]["id"]
  | typeof PVP_CATEGORIES[number]["id"];

interface LeaderboardEntry {
  rank: number;
  userId: number;
  nickname: string | null;
  value: number;
}

export function TournamentButton() {
  const userId = useGameStore((s) => s.user?.id ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"rating" | "pve" | "pvp">("rating");
  const [category, setCategory] = useState<CategoryId>("rating_total");
  const [list, setList] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = useCallback((cat: string) => {
    const socket = getGlobalSocket();
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setList([]);
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "tournament_leaderboard" && msg.category === cat) {
          setList(Array.isArray(msg.list) ? msg.list : []);
          socket.removeEventListener("message", handler);
          setLoading(false);
        }
      } catch {
        // ignore
      }
    };
    socket.addEventListener("message", handler);
    socket.send(JSON.stringify({ type: "tournament_leaderboard", category: cat, limit: 50 }));
    const t = setTimeout(() => {
      socket.removeEventListener("message", handler);
      setLoading(false);
    }, 5000);
    return () => {
      clearTimeout(t);
      socket.removeEventListener("message", handler);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const cleanup = fetchLeaderboard(category);
    return cleanup;
  }, [isOpen, category, fetchLeaderboard]);

  const categories =
    mode === "rating" ? RATING_CATEGORIES : mode === "pve" ? PVE_CATEGORIES : PVP_CATEGORIES;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className={styles.tournamentButton}
        onClick={() => setIsOpen(true)}
        title="Турнирная таблица"
      >
        <span className={styles.tournamentButtonIcon}>🏆</span>
      </button>

      {isOpen && (
        <>
          <div
            className={styles.questPanelOverlay}
            onClick={() => setIsOpen(false)}
            role="presentation"
          />
          <div className={styles.tournamentPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.questModalHeader}>
              <h2 className={styles.questModalTitle}>Турнирная таблица</h2>
              <button
                type="button"
                className={styles.questModalClose}
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className={styles.tournamentTabs}>
              <button
                type="button"
                className={mode === "rating" ? styles.tournamentTabActive : styles.tournamentTab}
                onClick={() => { setMode("rating"); setCategory("rating_total"); }}
              >
                Рейтинг
              </button>
              <button
                type="button"
                className={mode === "pve" ? styles.tournamentTabActive : styles.tournamentTab}
                onClick={() => { setMode("pve"); setCategory("pve_total_kills"); }}
              >
                PvE
              </button>
              <button
                type="button"
                className={mode === "pvp" ? styles.tournamentTabActive : styles.tournamentTab}
                onClick={() => { setMode("pvp"); setCategory("pvp_total_kills"); }}
              >
                PvP
              </button>
            </div>

            <div className={styles.tournamentSubTabs}>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={category === c.id ? styles.tournamentSubTabActive : styles.tournamentSubTab}
                  onClick={() => setCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className={styles.tournamentTableWrap}>
              {loading ? (
                <p className={styles.tournamentLoading}>Загрузка...</p>
              ) : (
                <table className={styles.tournamentTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Игрок</th>
                      <th>Очки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((row) => (
                      <tr
                        key={row.userId}
                        className={userId === row.userId ? styles.tournamentRowHighlight : undefined}
                      >
                        <td>{row.rank}</td>
                        <td>{row.nickname || `Пилот ${row.userId}`}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className={styles.tournamentFooter}>
              Топ-3 в конце недели получают титулы и достижения. Неделя сбрасывается в понедельник 00:00 (МСК).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
