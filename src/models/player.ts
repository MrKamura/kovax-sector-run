import { DataTypes, Model, Sequelize } from "sequelize";

export type PlayerResources = {
  scrap: number;
  tokens: number;
};

export type PlayerWeapon = {
  id: string;
  name: string;
  power: number;
};

export type PlayerAttributes = {
  id?: number;
  userId: number | null;
  name: string;
  resources: PlayerResources;
  health: number;
  maxHealth: number;
  level: number;
  exp: number;
  expToNext: number;
  damage: number;
  skills: string[];
  monsterProgress?: Record<
    string,
    {
      level: number;
      exp: number;
      expToNext: number;
      health: number;
      maxHealth: number;
      damage: number;
    }
  >;
  lastHealthAt: Date | null;
  posX: number;
  posY: number;
  rotation: number;
  lastPositionAt: Date | null;
  shelterLevel: number;
  weapons: PlayerWeapon[];
  blueprints: string[];
  cosmetics: string[];
  lastCollectedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export class Player extends Model<PlayerAttributes> implements PlayerAttributes {
  declare id: number;
  declare userId: number | null;
  declare name: string;
  declare resources: PlayerResources;
  declare health: number;
  declare maxHealth: number;
  declare level: number;
  declare exp: number;
  declare expToNext: number;
  declare damage: number;
  declare skills: string[];
  declare monsterProgress?: Record<
    string,
    {
      level: number;
      exp: number;
      expToNext: number;
      health: number;
      maxHealth: number;
      damage: number;
    }
  >;
  declare lastHealthAt: Date | null;
  declare posX: number;
  declare posY: number;
  declare rotation: number;
  declare lastPositionAt: Date | null;
  declare shelterLevel: number;
  declare weapons: PlayerWeapon[];
  declare blueprints: string[];
  declare cosmetics: string[];
  declare lastCollectedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initPlayerModel = (sequelize: Sequelize) => {
  Player.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
      },
      lastHealthAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      posX: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      posY: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      rotation: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      lastPositionAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      shelterLevel: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      },
    },
    {
      sequelize,
      modelName: "Player",
      tableName: "players",
    }
  );

  return Player;
};
