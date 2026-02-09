"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserQuestCompletionModel = exports.DailyQuestModel = exports.SectorModel = exports.ChatMessageModel = exports.PlayerModel = exports.SessionModel = exports.UserModel = void 0;
exports.initModels = initModels;
const user_model_1 = require("./user.model");
Object.defineProperty(exports, "UserModel", { enumerable: true, get: function () { return user_model_1.UserModel; } });
const session_model_1 = require("./session.model");
Object.defineProperty(exports, "SessionModel", { enumerable: true, get: function () { return session_model_1.SessionModel; } });
const player_model_1 = require("./player.model");
Object.defineProperty(exports, "PlayerModel", { enumerable: true, get: function () { return player_model_1.PlayerModel; } });
const chat_message_model_1 = require("./chat-message.model");
Object.defineProperty(exports, "ChatMessageModel", { enumerable: true, get: function () { return chat_message_model_1.ChatMessageModel; } });
const sector_model_1 = require("./sector.model");
Object.defineProperty(exports, "SectorModel", { enumerable: true, get: function () { return sector_model_1.SectorModel; } });
const daily_quest_model_1 = require("./daily-quest.model");
Object.defineProperty(exports, "DailyQuestModel", { enumerable: true, get: function () { return daily_quest_model_1.DailyQuestModel; } });
const user_quest_completion_model_1 = require("./user-quest-completion.model");
Object.defineProperty(exports, "UserQuestCompletionModel", { enumerable: true, get: function () { return user_quest_completion_model_1.UserQuestCompletionModel; } });
function initModels(sequelize) {
    (0, user_model_1.initUserModel)(sequelize);
    (0, session_model_1.initSessionModel)(sequelize);
    (0, player_model_1.initPlayerModel)(sequelize);
    (0, chat_message_model_1.initChatMessageModel)(sequelize);
    (0, sector_model_1.initSectorModel)(sequelize);
    (0, daily_quest_model_1.initDailyQuestModel)(sequelize);
    (0, user_quest_completion_model_1.initUserQuestCompletionModel)(sequelize);
}
