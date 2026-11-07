/**
 * Tournament leaderboard categories. Used for API, DB, and UI tabs.
 * PvE: total kills, weekly kills, best streak, quests per week
 * PvP: total kills, weekly kills, best streak, revenge kills per week
 * Rating: general (total) and weekly combined rating (PvE + PvP + social points).
 */
export const TOURNAMENT_CATEGORIES = [
  "rating_total",
  "rating_week",
  "pve_total_kills",
  "pve_weekly_kills",
  "pve_best_streak",
  "pve_quests_week",
  "pvp_total_kills",
  "pvp_weekly_kills",
  "pvp_best_streak",
  "pvp_revenge_week",
] as const;

export type TournamentCategory = (typeof TOURNAMENT_CATEGORIES)[number];

export const TOURNAMENT_CATEGORY_LABELS: Record<TournamentCategory, string> = {
  rating_total: "Общий рейтинг",
  rating_week: "Рейтинг за неделю",
  pve_total_kills: "Убийства мобов (всего)",
  pve_weekly_kills: "Убийства мобов (неделя)",
  pve_best_streak: "Серия убийств мобов",
  pve_quests_week: "Квесты (неделя)",
  pvp_total_kills: "PvP убийства (всего)",
  pvp_weekly_kills: "PvP убийства (неделя)",
  pvp_best_streak: "Серия PvP убийств",
  pvp_revenge_week: "Месть (неделя)",
};

/** DB column for each category (ORDER BY and raw value) */
export const TOURNAMENT_CATEGORY_COLUMN: Record<TournamentCategory, string> = {
  rating_total: "rating_total",
  rating_week: "rating_week",
  pve_total_kills: "monster_kills_total",
  pve_weekly_kills: "monster_kills_week",
  pve_best_streak: "monster_streak_best",
  pve_quests_week: "quest_completions_week",
  pvp_total_kills: "pvp_kills_total",
  pvp_weekly_kills: "pvp_kills_week",
  pvp_best_streak: "pvp_streak_best",
  pvp_revenge_week: "revenge_kills_week",
};

/** Model attribute (camelCase) for reading value from Sequelize instance */
export const TOURNAMENT_CATEGORY_ATTR: Record<TournamentCategory, string> = {
  rating_total: "ratingTotal",
  rating_week: "ratingWeek",
  pve_total_kills: "monsterKillsTotal",
  pve_weekly_kills: "monsterKillsWeek",
  pve_best_streak: "monsterStreakBest",
  pve_quests_week: "questCompletionsWeek",
  pvp_total_kills: "pvpKillsTotal",
  pvp_weekly_kills: "pvpKillsWeek",
  pvp_best_streak: "pvpStreakBest",
  pvp_revenge_week: "revengeKillsWeek",
};

/** Rating points: PvE = POINTS_PER_MOB_LEVEL * mobLevel (min 1); PvP = PVP_BASE + PVP_PER_LEVEL * victimLevel; Social = POINTS_QUEST per quest */
export const RATING_POINTS_MOB_LEVEL = 10;
export const RATING_POINTS_PVP_BASE = 50;
export const RATING_POINTS_PVP_PER_LEVEL = 20;
export const RATING_POINTS_QUEST = 100;

export const LEADERBOARD_TOP = 50;
export const TOP_WINNERS_COUNT = 3;
