"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerModel = void 0;
exports.initPlayerModel = initPlayerModel;
const sequelize_1 = require("sequelize");
class PlayerModel extends sequelize_1.Model {
}
exports.PlayerModel = PlayerModel;
function initPlayerModel(sequelize) {
    PlayerModel.init({
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
        name: {
            type: sequelize_1.DataTypes.STRING(80),
            allowNull: false,
        },
        resources: {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: false,
        },
        health: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 100,
        },
        maxHealth: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 100,
        },
        level: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        exp: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        expToNext: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 100,
            field: "expToNext",
        },
        damage: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 18,
        },
        skills: {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },
        mutations: {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: true,
            defaultValue: { purchasedSkills: [], skillLevels: {}, upgradeInProgress: null },
        },
        monsterProgress: {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
            field: "monsterProgress",
        },
        lastHealthAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            field: "lastHealthAt",
        },
        posX: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0,
            field: "posX",
        },
        posY: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0,
            field: "posY",
        },
        rotation: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0,
        },
        sectorId: {
            type: sequelize_1.DataTypes.STRING(32),
            allowNull: true,
            field: "sectorId",
        },
        lastPositionAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            field: "lastPositionAt",
        },
        shelterLevel: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            field: "shelterLevel",
        },
        weapons: {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: false,
        },
        blueprints: {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: false,
        },
        cosmetics: {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: false,
        },
        lastCollectedAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            field: "lastCollectedAt",
        },
    }, {
        sequelize,
        modelName: "Player",
        tableName: "players",
        underscored: false,
        timestamps: true,
    });
    return PlayerModel;
}
