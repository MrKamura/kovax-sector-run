import { getSequelize } from "./db";
import { initPlayerModel, Player } from "@/models/player";
import { initUserModel, User } from "@/models/user";
import { initSessionModel, Session } from "@/models/session";

let modelsReady = false;

export const initModels = async () => {
  if (modelsReady) {
    return;
  }
  const sequelize = getSequelize();
  initUserModel(sequelize);
  initPlayerModel(sequelize);
  initSessionModel(sequelize);
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

export { Player, User, Session };
