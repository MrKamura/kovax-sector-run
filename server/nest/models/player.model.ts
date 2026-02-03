import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface PlayerResources {
  scrap: number;
  tokens: number;
}

export interface MonsterProgressEntry {
  level?: number;
  exp?: number;
  expToNext?: number;
  health?: number;
  maxHealth?: number;
  damage?: number;
}

export interface PlayerAttributes {
  id?: number;
  userId: number;
  name: string;
  resources: PlayerResources;
  health: number;
  maxHealth: number;
  level: number;
  exp: number;
  expToNext: number;
  damage: number;
  skills: string[];
  monsterProgress: Record<string, MonsterProgressEntry>;
  lastHealthAt: Date | null;
  posX: number;
  posY: number;
  rotation: number;
  sectorId: string | null;
  lastPositionAt: Date | null;
  shelterLevel: number;
  weapons: unknown[];
  blueprints: string[];
  cosmetics: string[];
  lastCollectedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PlayerCreationAttributes = Optional<PlayerAttributes, "id" | "sectorId" | "createdAt" | "updatedAt">;

export class PlayerModel extends Model<PlayerAttributes, PlayerCreationAttributes> implements PlayerAttributes {
  declare id: number;
  declare userId: number;
  declare name: string;
  declare resources: PlayerResources;
  declare health: number;
  declare maxHealth: number;
  declare level: number;
  declare exp: number;
  declare expToNext: number;
  declare damage: number;
  declare skills: string[];
  declare monsterProgress: Record<string, MonsterProgressEntry>;
  declare lastHealthAt: Date | null;
  declare posX: number;
  declare posY: number;
  declare rotation: number;
  declare lastPositionAt: Date | null;
  declare shelterLevel: number;
  declare weapons: unknown[];
  declare blueprints: string[];
  declare cosmetics: string[];
  declare lastCollectedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initPlayerModel(sequelize: Sequelize): typeof PlayerModel {
  PlayerModel.init(
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
      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      resources: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      health: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      maxHealth: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      exp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      expToNext: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
        field: "expToNext",
      },
      damage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 18,
      },
      skills: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      monsterProgress: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        field: "monsterProgress",
      },
      lastHealthAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "lastHealthAt",
      },
      posX: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
        field: "posX",
      },
      posY: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
        field: "posY",
      },
      rotation: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      sectorId: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: "sectorId",
      },
      lastPositionAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "lastPositionAt",
      },
      shelterLevel: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "shelterLevel",
      },
      weapons: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      blueprints: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      cosmetics: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      lastCollectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "lastCollectedAt",
      },
    },
    {
      sequelize,
      modelName: "Player",
      tableName: "players",
      underscored: false,
      timestamps: true,
    }
  );
  return PlayerModel;
}
