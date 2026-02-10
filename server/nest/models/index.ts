import type { Sequelize } from "sequelize";
import { initUserModel, UserModel } from "./user.model";
import { initSessionModel, SessionModel } from "./session.model";
import { initPlayerModel, PlayerModel } from "./player.model";
import { initChatMessageModel, ChatMessageModel } from "./chat-message.model";
import { initSectorModel, SectorModel } from "./sector.model";
import { initDailyQuestModel, DailyQuestModel } from "./daily-quest.model";
import { initUserQuestCompletionModel, UserQuestCompletionModel } from "./user-quest-completion.model";
import { initPlayerTournamentStatsModel, PlayerTournamentStatsModel } from "./player-tournament-stats.model";
import { initTournamentWinnerModel, TournamentWinnerModel } from "./tournament-winner.model";
import { initUserTitleModel, UserTitleModel } from "./user-title.model";

export function initModels(sequelize: Sequelize): void {
  initUserModel(sequelize);
  initSessionModel(sequelize);
  initPlayerModel(sequelize);
  initChatMessageModel(sequelize);
  initSectorModel(sequelize);
  initDailyQuestModel(sequelize);
  initUserQuestCompletionModel(sequelize);
  initPlayerTournamentStatsModel(sequelize);
  initTournamentWinnerModel(sequelize);
  initUserTitleModel(sequelize);
}

export { UserModel, SessionModel, PlayerModel, ChatMessageModel, SectorModel, DailyQuestModel, UserQuestCompletionModel, PlayerTournamentStatsModel, TournamentWinnerModel, UserTitleModel };
