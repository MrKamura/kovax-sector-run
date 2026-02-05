"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionModel = void 0;
exports.initSessionModel = initSessionModel;
const sequelize_1 = require("sequelize");
class SessionModel extends sequelize_1.Model {
}
exports.SessionModel = SessionModel;
function initSessionModel(sequelize) {
    SessionModel.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            field: "userId",
        },
        token: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
        },
        expiresAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            field: "expiresAt",
        },
    }, {
        sequelize,
        modelName: "Session",
        tableName: "sessions",
        underscored: false,
        timestamps: true,
    });
    return SessionModel;
}
