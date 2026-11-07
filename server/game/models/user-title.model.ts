import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface UserTitleAttributes {
  id: number;
  userId: number;
  titleKey: string;
  weekStartUtc: Date;
  awardedAt: Date;
  createdAt?: Date;
}

export type UserTitleCreationAttributes = Optional<UserTitleAttributes, "id" | "createdAt">;

export class UserTitleModel extends Model<UserTitleAttributes, UserTitleCreationAttributes> implements UserTitleAttributes {
  declare id: number;
  declare userId: number;
  declare titleKey: string;
  declare weekStartUtc: Date;
  declare awardedAt: Date;
  declare readonly createdAt: Date;
}

export function initUserTitleModel(sequelize: Sequelize): typeof UserTitleModel {
  UserTitleModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
      titleKey: { type: DataTypes.STRING(120), allowNull: false, field: "title_key" },
      weekStartUtc: { type: DataTypes.DATE, allowNull: false, field: "week_start_utc" },
      awardedAt: { type: DataTypes.DATE, allowNull: false, field: "awarded_at" },
    },
    {
      sequelize,
      modelName: "UserTitle",
      tableName: "user_titles",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    }
  );
  return UserTitleModel;
}
