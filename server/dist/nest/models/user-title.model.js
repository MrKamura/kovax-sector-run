"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserTitleModel = void 0;
exports.initUserTitleModel = initUserTitleModel;
const sequelize_1 = require("sequelize");
class UserTitleModel extends sequelize_1.Model {
}
exports.UserTitleModel = UserTitleModel;
function initUserTitleModel(sequelize) {
    UserTitleModel.init({
        id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, field: "user_id" },
        titleKey: { type: sequelize_1.DataTypes.STRING(120), allowNull: false, field: "title_key" },
        weekStartUtc: { type: sequelize_1.DataTypes.DATE, allowNull: false, field: "week_start_utc" },
        awardedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, field: "awarded_at" },
    }, {
        sequelize,
        modelName: "UserTitle",
        tableName: "user_titles",
        underscored: true,
        timestamps: true,
        updatedAt: false,
    });
    return UserTitleModel;
}
