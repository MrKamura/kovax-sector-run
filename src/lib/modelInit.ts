import { getSequelize } from "./db";
import {
  initModels as initServerModels,
  UserModel,
  SessionModel,
  PlayerModel,
} from "../../server/nest/models";

let modelsReady = false;

export const initModels = async () => {
  if (modelsReady) {
    return;
  }
  const sequelize = getSequelize();
  initServerModels(sequelize);
  const shouldSync = process.env.DB_SYNC !== "false";
  const shouldAlter = process.env.DB_SYNC_ALTER === "true";
  if (shouldSync) {
    try {
      if (shouldAlter) {
        await sequelize.sync({ alter: true });
      } else {
        await sequelize.sync();
      }
    } catch {
      // If alter fails (e.g. PG catalog cache), fall back to plain sync/auth.
      try {
        await sequelize.sync();
      } catch {
        await sequelize.authenticate();
      }
    }
  }
  modelsReady = true;
};

export { PlayerModel as Player, UserModel as User, SessionModel as Session };
