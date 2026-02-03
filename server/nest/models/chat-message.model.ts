import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface ChatMessageAttributes {
  id: string;
  scope: string;
  sectorId: string | null;
  userId: number;
  nickname: string;
  text: string;
  createdAt: number;
}

export type ChatMessageCreationAttributes = Optional<ChatMessageAttributes, never>;

export class ChatMessageModel extends Model<ChatMessageAttributes, ChatMessageCreationAttributes> implements ChatMessageAttributes {
  declare id: string;
  declare scope: string;
  declare sectorId: string | null;
  declare userId: number;
  declare nickname: string;
  declare text: string;
  declare createdAt: number;
}

export function initChatMessageModel(sequelize: Sequelize): typeof ChatMessageModel {
  ChatMessageModel.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      scope: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sectorId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "sector_id",
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "user_id",
      },
      nickname: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: "created_at",
      },
    },
    {
      sequelize,
      modelName: "ChatMessage",
      tableName: "chat_messages",
      underscored: true,
      timestamps: false,
    }
  );
  return ChatMessageModel;
}
