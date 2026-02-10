"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TournamentWinnerModel = void 0;
exports.initTournamentWinnerModel = initTournamentWinnerModel;
const sequelize_1 = require("sequelize");
class TournamentWinnerModel extends sequelize_1.Model {
}
exports.TournamentWinnerModel = TournamentWinnerModel;
function initTournamentWinnerModel(sequelize) {
    TournamentWinnerModel.init({
        id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        weekStartUtc: { type: sequelize_1.DataTypes.DATE, allowNull: false, field: "week_start_utc" },
        category: { type: sequelize_1.DataTypes.STRING(80), allowNull: false },
        userId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, field: "user_id" },
        rank: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
        value: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    }, {
        sequelize,
        modelName: "TournamentWinner",
        tableName: "tournament_winners",
        underscored: true,
        timestamps: true,
        updatedAt: false,
    });
    return TournamentWinnerModel;
}
