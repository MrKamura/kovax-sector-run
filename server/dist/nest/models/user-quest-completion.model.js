"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserQuestCompletionModel = void 0;
exports.initUserQuestCompletionModel = initUserQuestCompletionModel;
const sequelize_1 = require("sequelize");
class UserQuestCompletionModel extends sequelize_1.Model {
}
exports.UserQuestCompletionModel = UserQuestCompletionModel;
function initUserQuestCompletionModel(sequelize) {
    UserQuestCompletionModel.init({
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
            type: sequelize_1.DataTypes.ENUM("mob_kills", "pvp_kills"),
            allowNull: false,
            field: "quest_type",
        },
        completedAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            field: "completed_at",
        },
        rewardExp: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            field: "reward_exp",
        },
        rewardTokens: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            field: "reward_tokens",
        },
        dailyQuestId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            field: "daily_quest_id",
        },
    }, {
        sequelize,
        modelName: "UserQuestCompletion",
        tableName: "user_quest_completions",
        underscored: true,
        timestamps: true,
    });
    return UserQuestCompletionModel;
}
