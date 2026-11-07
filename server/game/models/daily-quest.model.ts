import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export type QuestType = "mob_kills" | "pvp_kills";

export interface DailyQuestAttributes {
  id: number;
  userId: number;
  sectorId: string;
  questType: QuestType;
  killsRequired: number;
  killsCompleted: number;
  timeLimitMinutes: number;
  startedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  rewardExp: number;
  rewardTokens: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type DailyQuestCreationAttributes = Optional<
  DailyQuestAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export class DailyQuestModel extends Model<DailyQuestAttributes, DailyQuestCreationAttributes>
  implements DailyQuestAttributes {
  declare id: number;
  declare userId: number;
  declare sectorId: string;
  declare questType: QuestType;
  declare killsRequired: number;
  declare killsCompleted: number;
  declare timeLimitMinutes: number;
  declare startedAt: Date;
  declare expiresAt: Date;
  declare completedAt: Date | null;
  declare failedAt: Date | null;
  declare rewardExp: number;
  declare rewardTokens: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initDailyQuestModel(sequelize: Sequelize): typeof DailyQuestModel {
  DailyQuestModel.init(
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
      questType: { // Добавлено это поле
        type: DataTypes.ENUM('mob_kills', 'pvp_kills'),
        allowNull: false,
        field: "quest_type",
        defaultValue: "mob_kills",
      },
      killsRequired: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20,
        field: "kills_required",
      },
      killsCompleted: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "kills_completed",
      },
      timeLimitMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 15,
        field: "time_limit_minutes",
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "started_at",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "completed_at",
      },
      failedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "failed_at",
      },
      rewardExp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 250,
        field: "reward_exp",
      },
      rewardTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 75,
        field: "reward_tokens",
      },
    },
    {
      sequelize,
      modelName: "DailyQuest",
      tableName: "daily_quests",
      underscored: true,
      timestamps: true,
    }
  );
  return DailyQuestModel;
}
