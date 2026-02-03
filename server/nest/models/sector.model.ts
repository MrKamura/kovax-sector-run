import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface SectorAttributes {
  id: string;
  name: string;
  level: number;
  createdAt?: Date;
}

export type SectorCreationAttributes = Optional<SectorAttributes, "createdAt">;

export class SectorModel extends Model<SectorAttributes, SectorCreationAttributes> implements SectorAttributes {
  declare id: string;
  declare name: string;
  declare level: number;
  declare readonly createdAt: Date;
}

export function initSectorModel(sequelize: Sequelize): typeof SectorModel {
  SectorModel.init(
    {
      id: {
        type: DataTypes.STRING(32),
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      level: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "createdAt",
      },
    },
    {
      sequelize,
      modelName: "Sector",
      tableName: "sectors",
      underscored: false,
      timestamps: false,
    }
  );
  return SectorModel;
}
