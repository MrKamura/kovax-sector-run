"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageModel = void 0;
exports.initChatMessageModel = initChatMessageModel;
const sequelize_1 = require("sequelize");
class ChatMessageModel extends sequelize_1.Model {
}
exports.ChatMessageModel = ChatMessageModel;
function initChatMessageModel(sequelize) {
    ChatMessageModel.init({
        id: {
            type: sequelize_1.DataTypes.STRING,
            primaryKey: true,
        },
        scope: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        sectorId: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
            field: "sector_id",
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            field: "user_id",
        },
        nickname: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        text: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: false,
        },
        createdAt: {
            type: sequelize_1.DataTypes.BIGINT,
            allowNull: false,
            field: "created_at",
        },
        targetUserId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            field: "target_user_id",
        },
    }, {
        sequelize,
        modelName: "ChatMessage",
        tableName: "chat_messages",
        underscored: true,
        timestamps: false,
    });
    return ChatMessageModel;
}
