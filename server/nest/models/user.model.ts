import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface UserAttributes {
  id: number;
  email: string;
  passwordHash: string;
  nickname: string | null;
  shipChoice: string | null;
  musicVolume: number;
  sfxVolume: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export class UserModel extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare email: string;
  declare passwordHash: string;
  declare nickname: string | null;
  declare shipChoice: string | null;
  declare musicVolume: number;
  declare sfxVolume: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initUserModel(sequelize: Sequelize): typeof UserModel {
  UserModel.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      nickname: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      shipChoice: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: "shipChoice",
      },
      musicVolume: {
        type: DataTypes.REAL,
        allowNull: false,
        defaultValue: 0.45,
        field: "musicVolume",
      },
      sfxVolume: {
        type: DataTypes.REAL,
        allowNull: false,
        defaultValue: 0.55,
        field: "sfxVolume",
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      underscored: false,
      timestamps: true,
    }
  );
  return UserModel;
}
