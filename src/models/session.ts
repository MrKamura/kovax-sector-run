import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export type SessionAttributes = {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

// Добавляем тип для создания, где id, createdAt и updatedAt опциональны
export type SessionCreationAttributes = Optional<SessionAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class Session extends Model<SessionAttributes, SessionCreationAttributes> 
  implements SessionAttributes {
  
  declare id: number;
  declare userId: number;
  declare token: string;
  declare expiresAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initSessionModel = (sequelize: Sequelize) => {
  Session.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Session",
      tableName: "sessions",
      indexes: [{ fields: ["token"] }, { fields: ["userId"] }],
    }
  );

  return Session;
};