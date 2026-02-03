import { DataTypes, Model, Sequelize } from "sequelize";

export type UserAttributes = {
  id?: number;
  email: string;
  passwordHash: string;
  nickname: string | null;
  shipChoice: string | null;
  musicVolume?: number;
  sfxVolume?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export class User extends Model<UserAttributes> implements UserAttributes {
  declare id?: number;
  declare email: string;
  declare passwordHash: string;
  declare nickname: string | null;
  declare shipChoice: string | null;
  declare musicVolume?: number;
  declare sfxVolume?: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initUserModel = (sequelize: Sequelize) => {
  User.init(
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
        unique: true,
      },
      shipChoice: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      musicVolume: {
        type: DataTypes.REAL,
        allowNull: false,
        defaultValue: 0.45,
      },
      sfxVolume: {
        type: DataTypes.REAL,
        allowNull: false,
        defaultValue: 0.55,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
    }
  );

  return User;
};
