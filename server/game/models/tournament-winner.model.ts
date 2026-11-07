import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface TournamentWinnerAttributes {
  id: number;
  weekStartUtc: Date;
  category: string;
  userId: number;
  rank: number;
  value: number;
  createdAt?: Date;
}

export type TournamentWinnerCreationAttributes = Optional<TournamentWinnerAttributes, "id" | "createdAt">;

export class TournamentWinnerModel
  extends Model<TournamentWinnerAttributes, TournamentWinnerCreationAttributes>
  implements TournamentWinnerAttributes {
  declare id: number;
  declare weekStartUtc: Date;
  declare category: string;
  declare userId: number;
  declare rank: number;
  declare value: number;
  declare readonly createdAt: Date;
}

export function initTournamentWinnerModel(sequelize: Sequelize): typeof TournamentWinnerModel {
  TournamentWinnerModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      weekStartUtc: { type: DataTypes.DATE, allowNull: false, field: "week_start_utc" },
      category: { type: DataTypes.STRING(80), allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
      rank: { type: DataTypes.INTEGER, allowNull: false },
      value: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      sequelize,
      modelName: "TournamentWinner",
      tableName: "tournament_winners",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    }
  );
  return TournamentWinnerModel;
}
