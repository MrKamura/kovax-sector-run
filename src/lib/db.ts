import { Sequelize } from "sequelize";
import * as pg from "pg";

let sequelize: Sequelize | null = null;

export const getSequelize = () => {
  if (sequelize) {
    return sequelize;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  sequelize = new Sequelize(databaseUrl, {
    dialect: "postgres",
    dialectModule: pg,
    logging: false,
  });

  return sequelize;
};
