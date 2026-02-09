import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import type { QuestType } from "./daily-quest.model";

export interface UserQuestCompletionAttributes {
  id: number;
  userId: number;
  sectorId: string;
  questType: QuestType;
  completedAt: Date;
  rewardExp: number;
  rewardTokens: number;
  dailyQuestId: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserQuestCompletionCreationAttributes = Optional<
  UserQuestCompletionAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export class UserQuestCompletionModel
  extends Model<UserQuestCompletionAttributes, UserQuestCompletionCreationAttributes>
  implements UserQuestCompletionAttributes {
  declare id: number;
  declare userId: number;
  declare sectorId: string;
  declare questType: QuestType;
  declare completedAt: Date;
  declare rewardExp: number;
  declare rewardTokens: number;
  declare dailyQuestId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initUserQuestCompletionModel(sequelize: Sequelize): typeof UserQuestCompletionModel {
  UserQuestCompletionModel.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "user_id",
      },
      sectorId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "sector_id",
      },
      questType: {
        type: DataTypes.ENUM("mob_kills", "pvp_kills"),
        allowNull: false,
        field: "quest_type",
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "completed_at",
      },
      rewardExp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "reward_exp",
      },
      rewardTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "reward_tokens",
      },
      dailyQuestId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "daily_quest_id",
      },
    },
    {
      sequelize,
      modelName: "UserQuestCompletion",
      tableName: "user_quest_completions",
      underscored: true,
      timestamps: true,
    }
  );
  return UserQuestCompletionModel;
}
