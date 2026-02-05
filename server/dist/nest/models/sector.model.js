"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectorModel = void 0;
exports.initSectorModel = initSectorModel;
const sequelize_1 = require("sequelize");
class SectorModel extends sequelize_1.Model {
}
exports.SectorModel = SectorModel;
function initSectorModel(sequelize) {
    SectorModel.init({
        id: {
            type: sequelize_1.DataTypes.STRING(32),
            primaryKey: true,
        },
        name: {
            type: sequelize_1.DataTypes.STRING(120),
            allowNull: false,
        },
        level: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
        },
        createdAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            field: "createdAt",
        },
    }, {
        sequelize,
        modelName: "Sector",
        tableName: "sectors",
        underscored: false,
        timestamps: false,
    });
    return SectorModel;
}
