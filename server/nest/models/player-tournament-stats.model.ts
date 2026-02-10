import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface PlayerTournamentStatsAttributes {
  id: number;
  userId: number;
  monsterKillsTotal: number;
  monsterKillsWeek: number;
  monsterStreakBest: number;
  monsterStreakCurrent: number;
  questCompletionsWeek: number;
  pvpKillsTotal: number;
  pvpKillsWeek: number;
  pvpStreakBest: number;
  pvpStreakCurrent: number;
  revengeKillsWeek: number;
  ratingPveTotal: number;
  ratingPveWeek: number;
  ratingPvpTotal: number;
  ratingPvpWeek: number;
  ratingSocialTotal: number;
  ratingSocialWeek: number;
  ratingTotal: number;
  ratingWeek: number;
  weekStartUtc: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PlayerTournamentStatsCreationAttributes = Optional<
  PlayerTournamentStatsAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export class PlayerTournamentStatsModel
  extends Model<PlayerTournamentStatsAttributes, PlayerTournamentStatsCreationAttributes>
  implements PlayerTournamentStatsAttributes {
  declare id: number;
  declare userId: number;
  declare monsterKillsTotal: number;
  declare monsterKillsWeek: number;
  declare monsterStreakBest: number;
  declare monsterStreakCurrent: number;
  declare questCompletionsWeek: number;
  declare pvpKillsTotal: number;
  declare pvpKillsWeek: number;
  declare pvpStreakBest: number;
  declare pvpStreakCurrent: number;
  declare revengeKillsWeek: number;
  declare ratingPveTotal: number;
  declare ratingPveWeek: number;
  declare ratingPvpTotal: number;
  declare ratingPvpWeek: number;
  declare ratingSocialTotal: number;
  declare ratingSocialWeek: number;
  declare ratingTotal: number;
  declare ratingWeek: number;
  declare weekStartUtc: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initPlayerTournamentStatsModel(sequelize: Sequelize): typeof PlayerTournamentStatsModel {
  PlayerTournamentStatsModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id", unique: true },
      monsterKillsTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "monster_kills_total" },
      monsterKillsWeek: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "monster_kills_week" },
      monsterStreakBest: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "monster_streak_best" },
      monsterStreakCurrent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "monster_streak_current" },
      questCompletionsWeek: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "quest_completions_week" },
      pvpKillsTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pvp_kills_total" },
      pvpKillsWeek: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pvp_kills_week" },
      pvpStreakBest: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pvp_streak_best" },
      pvpStreakCurrent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pvp_streak_current" },
      revengeKillsWeek: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "revenge_kills_week" },
      ratingPveTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_pve_total" },
      ratingPveWeek: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_pve_week" },
      ratingPvpTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_pvp_total" },
      ratingPvpWeek: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_pvp_week" },
      ratingSocialTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_social_total" },
      ratingSocialWeek: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_social_week" },
      ratingTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_total" },
      ratingWeek: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rating_week" },
      weekStartUtc: { type: DataTypes.DATE, allowNull: false, field: "week_start_utc" },
    },
    {
      sequelize,
      modelName: "PlayerTournamentStats",
      tableName: "player_tournament_stats",
      underscored: true,
      timestamps: true,
    }
  );
  return PlayerTournamentStatsModel;
}
