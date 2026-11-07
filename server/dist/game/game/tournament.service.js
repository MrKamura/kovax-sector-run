"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TournamentService = void 0;
const sequelize_1 = require("sequelize");
const tournament_constants_1 = require("./tournament.constants");
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
class TournamentService {
    constructor(db) {
        this.db = db;
    }
    /** Start of current week (Monday 00:00 Moscow) as UTC Date */
    getWeekStartUTC() {
        const now = new Date();
        const msk = new Date(now.getTime() + MOSCOW_OFFSET_MS);
        const day = msk.getUTCDay(); // 0 Sun, 1 Mon, ...
        const daysSinceMonday = day === 0 ? 6 : day - 1;
        const mondayNoon = new Date(msk);
        mondayNoon.setUTCDate(msk.getUTCDate() - daysSinceMonday);
        mondayNoon.setUTCHours(0, 0, 0, 0);
        return new Date(mondayNoon.getTime() - MOSCOW_OFFSET_MS);
    }
    async getOrCreateStats(userId) {
        if (!this.db.PlayerTournamentStats)
            return null;
        const weekStart = this.getWeekStartUTC();
        let row = await this.db.PlayerTournamentStats.findOne({ where: { userId } });
        if (!row) {
            row = await this.db.PlayerTournamentStats.create({
                userId,
                weekStartUtc: weekStart,
                monsterKillsTotal: 0,
                monsterKillsWeek: 0,
                monsterStreakBest: 0,
                monsterStreakCurrent: 0,
                questCompletionsWeek: 0,
                pvpKillsTotal: 0,
                pvpKillsWeek: 0,
                pvpStreakBest: 0,
                pvpStreakCurrent: 0,
                revengeKillsWeek: 0,
                ratingPveTotal: 0,
                ratingPveWeek: 0,
                ratingPvpTotal: 0,
                ratingPvpWeek: 0,
                ratingSocialTotal: 0,
                ratingSocialWeek: 0,
                ratingTotal: 0,
                ratingWeek: 0,
            });
            return row;
        }
        const rowWeek = new Date(row.weekStartUtc).getTime();
        const currentWeek = weekStart.getTime();
        if (rowWeek < currentWeek) {
            await row.update({
                weekStartUtc: weekStart,
                monsterKillsWeek: 0,
                questCompletionsWeek: 0,
                pvpKillsWeek: 0,
                revengeKillsWeek: 0,
                ratingPveWeek: 0,
                ratingPvpWeek: 0,
                ratingSocialWeek: 0,
                ratingWeek: 0,
            });
        }
        return row;
    }
    async recordMobKill(userId, mobLevel = 1) {
        const row = await this.getOrCreateStats(userId);
        if (!row)
            return;
        const level = Math.max(1, Math.floor(mobLevel));
        const points = tournament_constants_1.RATING_POINTS_MOB_LEVEL * level;
        const nextTotal = (row.monsterKillsTotal || 0) + 1;
        const nextWeek = (row.monsterKillsWeek || 0) + 1;
        const nextCurrent = (row.monsterStreakCurrent || 0) + 1;
        const nextBest = Math.max(row.monsterStreakBest || 0, nextCurrent);
        const rPveT = (row.ratingPveTotal ?? 0) + points;
        const rPveW = (row.ratingPveWeek ?? 0) + points;
        const rTotal = (row.ratingTotal ?? 0) + points;
        const rWeek = (row.ratingWeek ?? 0) + points;
        await row.update({
            monsterKillsTotal: nextTotal,
            monsterKillsWeek: nextWeek,
            monsterStreakCurrent: nextCurrent,
            monsterStreakBest: nextBest,
            ratingPveTotal: rPveT,
            ratingPveWeek: rPveW,
            ratingTotal: rTotal,
            ratingWeek: rWeek,
        });
    }
    async recordPvpKill(userId, victimLevel = 1) {
        const row = await this.getOrCreateStats(userId);
        if (!row)
            return;
        const level = Math.max(1, Math.floor(victimLevel));
        const points = tournament_constants_1.RATING_POINTS_PVP_BASE + tournament_constants_1.RATING_POINTS_PVP_PER_LEVEL * level;
        const nextTotal = (row.pvpKillsTotal || 0) + 1;
        const nextWeek = (row.pvpKillsWeek || 0) + 1;
        const nextCurrent = (row.pvpStreakCurrent || 0) + 1;
        const nextBest = Math.max(row.pvpStreakBest || 0, nextCurrent);
        const rPvpT = (row.ratingPvpTotal ?? 0) + points;
        const rPvpW = (row.ratingPvpWeek ?? 0) + points;
        const rTotal = (row.ratingTotal ?? 0) + points;
        const rWeek = (row.ratingWeek ?? 0) + points;
        await row.update({
            pvpKillsTotal: nextTotal,
            pvpKillsWeek: nextWeek,
            pvpStreakCurrent: nextCurrent,
            pvpStreakBest: nextBest,
            ratingPvpTotal: rPvpT,
            ratingPvpWeek: rPvpW,
            ratingTotal: rTotal,
            ratingWeek: rWeek,
        });
    }
    async recordRevengeKill(userId) {
        const row = await this.getOrCreateStats(userId);
        if (!row)
            return;
        await row.update({
            revengeKillsWeek: (row.revengeKillsWeek || 0) + 1,
        });
    }
    /** On death: reset current streaks (PvE death resets monster streak; PvP also resets pvp streak) */
    async recordDeath(userId, pvpDeath) {
        const row = await this.getOrCreateStats(userId);
        if (!row)
            return;
        const updates = {
            monsterStreakCurrent: 0,
        };
        if (pvpDeath)
            updates.pvpStreakCurrent = 0;
        await row.update(updates);
    }
    async recordQuestComplete(userId) {
        const row = await this.getOrCreateStats(userId);
        if (!row)
            return;
        const points = tournament_constants_1.RATING_POINTS_QUEST;
        const rSocialT = (row.ratingSocialTotal ?? 0) + points;
        const rSocialW = (row.ratingSocialWeek ?? 0) + points;
        const rTotal = (row.ratingTotal ?? 0) + points;
        const rWeek = (row.ratingWeek ?? 0) + points;
        await row.update({
            questCompletionsWeek: (row.questCompletionsWeek || 0) + 1,
            ratingSocialTotal: rSocialT,
            ratingSocialWeek: rSocialW,
            ratingTotal: rTotal,
            ratingWeek: rWeek,
        });
    }
    /** Top N players for a category; returns rank, userId, nickname, value */
    async getLeaderboard(category, limit = tournament_constants_1.LEADERBOARD_TOP) {
        if (!this.db.PlayerTournamentStats || !this.db.User)
            return [];
        const col = tournament_constants_1.TOURNAMENT_CATEGORY_COLUMN[category];
        const attr = tournament_constants_1.TOURNAMENT_CATEGORY_ATTR[category];
        if (!col)
            return [];
        const rows = await this.db.PlayerTournamentStats.findAll({
            order: [[attr || col, "DESC"]],
            limit: Math.min(limit, 100),
        });
        const userIds = Array.from(new Set(rows.map((r) => r.userId)));
        const users = userIds.length > 0
            ? await this.db.User.findAll({ where: { id: { [sequelize_1.Op.in]: userIds } }, attributes: ["id", "nickname"] })
            : [];
        const nickMap = new Map(users.map((u) => [u.id, u.nickname ?? null]));
        return rows.map((r, i) => ({
            rank: i + 1,
            userId: r.userId,
            nickname: nickMap.get(r.userId) ?? null,
            value: Number(attr ? r[attr] : r[col] ?? 0),
        }));
    }
    /** End of week: snapshot top 3 per category and award titles. Call at Monday 00:00 Moscow before traffic. */
    async finalizeWeek() {
        if (!this.db.PlayerTournamentStats || !this.db.TournamentWinner || !this.db.UserTitle)
            return;
        const currentWeekStart = this.getWeekStartUTC();
        const previousWeekStart = new Date(currentWeekStart.getTime() - 7 * MS_PER_DAY);
        const categories = [
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
        ];
        for (const cat of categories) {
            const col = tournament_constants_1.TOURNAMENT_CATEGORY_COLUMN[cat];
            const attr = tournament_constants_1.TOURNAMENT_CATEGORY_ATTR[cat];
            const rows = await this.db.PlayerTournamentStats.findAll({
                order: [[attr || col, "DESC"]],
                limit: tournament_constants_1.TOP_WINNERS_COUNT,
            });
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                await this.db.TournamentWinner.create({
                    weekStartUtc: previousWeekStart,
                    category: cat,
                    userId: r.userId,
                    rank: i + 1,
                    value: Number(attr ? r[attr] : r[col] ?? 0),
                });
                const titleKey = `tournament_${cat}_rank_${i + 1}`;
                await this.db.UserTitle.create({
                    userId: r.userId,
                    titleKey,
                    weekStartUtc: previousWeekStart,
                    awardedAt: new Date(),
                });
            }
        }
    }
}
exports.TournamentService = TournamentService;
