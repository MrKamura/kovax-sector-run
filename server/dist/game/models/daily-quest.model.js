"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyQuestModel = void 0;
exports.initDailyQuestModel = initDailyQuestModel;
const sequelize_1 = require("sequelize");
class DailyQuestModel extends sequelize_1.Model {
}
exports.DailyQuestModel = DailyQuestModel;
function initDailyQuestModel(sequelize) {
    DailyQuestModel.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            field: "user_id",
        },
        sectorId: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            field: "sector_id",
        },
        questType: {
            type: sequelize_1.DataTypes.ENUM('mob_kills', 'pvp_kills'),
            allowNull: false,
            field: "quest_type",
            defaultValue: "mob_kills",
        },
        killsRequired: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 20,
            field: "kills_required",
        },
        killsCompleted: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: "kills_completed",
        },
        timeLimitMinutes: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 15,
            field: "time_limit_minutes",
        },
        startedAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            field: "started_at",
        },
        expiresAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            field: "expires_at",
        },
        completedAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            field: "completed_at",
        },
        failedAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            field: "failed_at",
        },
        rewardExp: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 250,
            field: "reward_exp",
        },
        rewardTokens: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 75,
            field: "reward_tokens",
        },
    }, {
        sequelize,
        modelName: "DailyQuest",
        tableName: "daily_quests",
        underscored: true,
        timestamps: true,
    });
    return DailyQuestModel;
}
