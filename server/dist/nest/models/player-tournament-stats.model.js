"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerTournamentStatsModel = void 0;
exports.initPlayerTournamentStatsModel = initPlayerTournamentStatsModel;
const sequelize_1 = require("sequelize");
class PlayerTournamentStatsModel extends sequelize_1.Model {
}
exports.PlayerTournamentStatsModel = PlayerTournamentStatsModel;
function initPlayerTournamentStatsModel(sequelize) {
    PlayerTournamentStatsModel.init({
        id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, field: "user_id", unique: true },
        monsterKillsTotal: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "monster_kills_total" },
        monsterKillsWeek: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "monster_kills_week" },
        monsterStreakBest: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "monster_streak_best" },
        monsterStreakCurrent: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "monster_streak_current" },
        questCompletionsWeek: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "quest_completions_week" },
        pvpKillsTotal: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pvp_kills_total" },
        pvpKillsWeek: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pvp_kills_week" },
        pvpStreakBest: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pvp_streak_best" },
        pvpStreakCurrent: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pvp_streak_current" },
        revengeKillsWeek: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "revenge_kills_week" },
        ratingPveTotal: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_pve_total" },
        ratingPveWeek: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_pve_week" },
        ratingPvpTotal: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_pvp_total" },
        ratingPvpWeek: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_pvp_week" },
        ratingSocialTotal: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_social_total" },
        ratingSocialWeek: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_social_week" },
        ratingTotal: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_total" },
        ratingWeek: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_week" },
        weekStartUtc: { type: sequelize_1.DataTypes.DATE, allowNull: false, field: "week_start_utc" },
    }, {
        sequelize,
        modelName: "PlayerTournamentStats",
        tableName: "player_tournament_stats",
        underscored: true,
        timestamps: true,
    });
    return PlayerTournamentStatsModel;
}
