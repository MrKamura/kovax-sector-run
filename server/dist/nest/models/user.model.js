"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
exports.initUserModel = initUserModel;
const sequelize_1 = require("sequelize");
class UserModel extends sequelize_1.Model {
}
exports.UserModel = UserModel;
function initUserModel(sequelize) {
    UserModel.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        email: {
            type: sequelize_1.DataTypes.STRING(160),
            allowNull: false,
            unique: true,
        },
        passwordHash: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
        },
        nickname: {
            type: sequelize_1.DataTypes.STRING(40),
            allowNull: true,
        },
        shipChoice: {
            type: sequelize_1.DataTypes.STRING(40),
            allowNull: true,
            field: "shipChoice",
        },
        musicVolume: {
            type: sequelize_1.DataTypes.REAL,
            allowNull: false,
            defaultValue: 0.45,
            field: "musicVolume",
        },
        sfxVolume: {
            type: sequelize_1.DataTypes.REAL,
            allowNull: false,
            defaultValue: 0.55,
            field: "sfxVolume",
        },
        chatPositionX: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            field: "chatPositionX",
        },
        chatPositionY: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            field: "chatPositionY",
        },
        chatWidth: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            field: "chatWidth",
        },
        chatHeight: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            field: "chatHeight",
        },
        chatOpacity: {
            type: sequelize_1.DataTypes.REAL,
            allowNull: true,
            field: "chatOpacity",
        },
    }, {
        sequelize,
        modelName: "User",
        tableName: "users",
        underscored: false,
        timestamps: true,
    });
    return UserModel;
}
