import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface SessionAttributes {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SessionCreationAttributes = Optional<
  SessionAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export class SessionModel extends Model<SessionAttributes, SessionCreationAttributes> implements SessionAttributes {
  declare id: number;
  declare userId: number;
  declare token: string;
  declare expiresAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initSessionModel(sequelize: Sequelize): typeof SessionModel {
  SessionModel.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "userId",
      },
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "expiresAt",
      },
    },
    {
      sequelize,
      modelName: "Session",
      tableName: "sessions",
      underscored: false,
      timestamps: true,
    }
  );
  return SessionModel;
}
