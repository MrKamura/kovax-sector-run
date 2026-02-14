import { Injectable } from "@nestjs/common";
import { Op } from "sequelize";
import { DbService } from "./db.service";
import { PlayerService } from "./player.service";

export type QuestType = "mob_kills" | "pvp_kills";

export interface QuestProgress {
  id: number;
  sectorId: string;
  sectorName?: string; // Название сектора для отображения
  questType: QuestType;
  killsRequired: number;
  killsCompleted: number;
  timeLimitMinutes: number;
  startedAt: number;
  expiresAt: number;
  completedAt: number | null;
  failedAt: number | null;
  rewardExp: number;
  rewardTokens: number;
  timeRemaining: number; // milliseconds
  expired?: boolean; // Флаг, что квест истек по времени (не выполнен)
}

@Injectable()
export class QuestService {
  constructor(
    private readonly db: DbService,
    private readonly player: PlayerService
  ) {
    // При использовании createApplicationContext зависимости могут не инжектироваться
    // Это нормально, так как мы используем resolved services из bootstrap
    // Проверка только для диагностики в development
    if (process.env.NODE_ENV === "development" && !this.db) {
      // Тихий warning, так как resolved version будет использоваться
    }
  }

  /** Начало текущего дня по Москве (UTC+3) в UTC и начало следующего дня (для сброса квестов). */
  private getMoscowDayBounds(): { todayStartUTC: Date; tomorrowStart: Date } {
    const now = new Date();
    const moscowOffsetMin = 180; // Москва = UTC+3
    const mskDate = new Date(now.getTime() + moscowOffsetMin * 60000);
    const y = mskDate.getUTCFullYear();
    const m = mskDate.getUTCMonth();
    const d = mskDate.getUTCDate();
    const todayStartUTC = new Date(Date.UTC(y, m, d) - 3 * 60 * 60 * 1000);
    const tomorrowStart = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);
    return { todayStartUTC, tomorrowStart };
  }

  /**
   * Создать новый квест для пользователя в секторе
   * @param questType Тип квеста: "mob_kills" или "pvp_kills"
   */
  async createQuest(userId: number, sectorId: string, questType: QuestType = "mob_kills"): Promise<QuestProgress | null> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in createQuest");
        return null;
      }
      
      const { todayStartUTC } = this.getMoscowDayBounds();
      const now = new Date();
      console.log(`[QuestService] createQuest: userId=${userId}, sectorId=${sectorId}, todayStartUTC=${todayStartUTC.toISOString()}`);
      
      // Проверяем, был ли квест этого типа уже выполнен сегодня в этом секторе
      const existingToday = await this.db.DailyQuest.findOne({
        where: {
          userId,
          sectorId,
          questType,
          startedAt: {
            [Op.gte]: todayStartUTC,
          },
        },
        order: [["startedAt", "DESC"]],
      });
      
      console.log(`[QuestService] createQuest: existingToday for sector ${sectorId}, type ${questType}:`, existingToday ? {
        id: existingToday.id,
        sectorId: existingToday.sectorId,
        questType: existingToday.questType,
        completedAt: existingToday.completedAt,
        failedAt: existingToday.failedAt,
      } : 'null');

      // If this quest type was successfully completed today, do not allow creating again until next day
      if (existingToday && existingToday.completedAt) {
        return null; // Квест уже успешно выполнен сегодня
      }

      // If there is an active quest of this type (not completed), return it
      // Note: мы удаляем отменённые/истёкшие квесты, поэтому проверка failedAt не нужна
      if (existingToday && !existingToday.completedAt) {
        const expiresAt = new Date(existingToday.expiresAt).getTime();
        const timeRemaining = Math.max(0, expiresAt - Date.now());
        return {
          id: existingToday.id,
          sectorId: existingToday.sectorId,
          questType: existingToday.questType as QuestType,
          killsRequired: existingToday.killsRequired,
          killsCompleted: existingToday.killsCompleted,
          timeLimitMinutes: existingToday.timeLimitMinutes,
          startedAt: new Date(existingToday.startedAt).getTime(),
          expiresAt,
          completedAt: null,
          failedAt: null, // Отменённые квесты удаляются, поэтому всегда null
          rewardExp: existingToday.rewardExp,
          rewardTokens: existingToday.rewardTokens,
          timeRemaining,
        };
      }

      // Параметры квеста в зависимости от типа
      let killsRequired: number;
      let timeLimitMinutes: number;
      let rewardExp: number;
      let rewardTokens: number;

      if (questType === "pvp_kills") {
        killsRequired = 3; // Убить 3 игроков
        timeLimitMinutes = 10; // 10 минут на выполнение
        rewardExp = 500;
        rewardTokens = 150;
      } else {
        // mob_kills
        killsRequired = 20;
        timeLimitMinutes = 5;
        rewardExp = 250;
        rewardTokens = 75;
      }

      const expiresAt = new Date(now.getTime() + timeLimitMinutes * 60 * 1000);
      
      const quest = await this.db.DailyQuest.create({
        userId,
        sectorId,
        questType,
        killsRequired,
        killsCompleted: 0,
        timeLimitMinutes,
        startedAt: now,
        expiresAt,
        completedAt: null,
        failedAt: null,
        rewardExp,
        rewardTokens,
      });

      return {
        id: quest.id,
        sectorId: quest.sectorId,
        questType: quest.questType as QuestType,
        killsRequired: quest.killsRequired,
        killsCompleted: quest.killsCompleted,
        timeLimitMinutes: quest.timeLimitMinutes,
        startedAt: new Date(quest.startedAt).getTime(),
        expiresAt: expiresAt.getTime(),
        completedAt: null,
        failedAt: quest.failedAt ? new Date(quest.failedAt).getTime() : null,
        rewardExp: quest.rewardExp,
        rewardTokens: quest.rewardTokens,
        timeRemaining: timeLimitMinutes * 60 * 1000,
      };
    } catch (err) {
      console.error("Failed to create quest:", err);
      return null;
    }
  }

  /**
   * Получить или создать активный квест для пользователя в секторе
   * Для тестов: создает новый квест каждый раз (бесконечное выполнение)
   * @deprecated Используйте createQuest для явного создания квеста
   */
  async getOrCreateQuest(userId: number, sectorId: string): Promise<QuestProgress | null> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Для тестов: всегда создаем новый квест (бесконечное выполнение)
      // В продакшене нужно раскомментировать проверку на существующий квест
      /*
      const existing = await this.db.DailyQuest.findOne({
        where: {
          userId,
          sectorId,
          startedAt: {
            [Op.gte]: todayStart,
          },
          completedAt: null,
        },
        order: [["startedAt", "DESC"]],
      });

      if (existing) {
        const expiresAt = new Date(existing.expiresAt).getTime();
        const timeRemaining = Math.max(0, expiresAt - Date.now());
        return {
          id: existing.id,
          sectorId: existing.sectorId,
          killsRequired: existing.killsRequired,
          killsCompleted: existing.killsCompleted,
          timeLimitMinutes: existing.timeLimitMinutes,
          startedAt: new Date(existing.startedAt).getTime(),
          expiresAt,
          completedAt: existing.completedAt ? new Date(existing.completedAt).getTime() : null,
          rewardExp: existing.rewardExp,
          rewardTokens: existing.rewardTokens,
          timeRemaining,
        };
      }
      */

      // Создаем новый квест
      const timeLimitMinutes = 5; // Время на выполнение: 5 минут для убийства 20 мобов
      const expiresAt = new Date(now.getTime() + timeLimitMinutes * 60 * 1000);
      
      const quest = await this.db.DailyQuest.create({
        userId,
        sectorId,
        questType: "mob_kills",
        killsRequired: 20,
        killsCompleted: 0,
        timeLimitMinutes,
        startedAt: now,
        expiresAt,
        completedAt: null,
        failedAt: null,
        rewardExp: 250,
        rewardTokens: 75,
      });

      return {
        id: quest.id,
        sectorId: quest.sectorId,
        questType: quest.questType as QuestType,
        killsRequired: quest.killsRequired,
        killsCompleted: quest.killsCompleted,
        timeLimitMinutes: quest.timeLimitMinutes,
        startedAt: new Date(quest.startedAt).getTime(),
        expiresAt: expiresAt.getTime(),
        completedAt: null,
        failedAt: quest.failedAt ? new Date(quest.failedAt).getTime() : null,
        rewardExp: quest.rewardExp,
        rewardTokens: quest.rewardTokens,
        timeRemaining: timeLimitMinutes * 60 * 1000,
      };
    } catch (err) {
      console.error("Failed to get or create quest:", err);
      return null;
    }
  }

  /**
   * Увеличить счетчик убийств для квеста
   */
  async incrementKills(userId: number, sectorId: string): Promise<QuestProgress | null> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in incrementKills");
        return null;
      }
      const quest = await this.db.DailyQuest.findOne({
        where: {
          userId,
          sectorId,
          questType: "mob_kills",
          completedAt: null, // Только активные (не завершённые) квесты
        },
        order: [["startedAt", "DESC"]],
      });

      if (!quest) return null;

      const now = Date.now();
      const expiresAt = new Date(quest.expiresAt).getTime();
      
      // Проверяем, не истекло ли время
      if (now >= expiresAt) {
        // Время истекло — удаляем запись квеста, чтобы игрок мог взять его снова
        await quest.destroy();
        // Возвращаем null, чтобы message-handler знал что квест истёк и был удалён
        return null;
      }

      const newKillsCompleted = quest.killsCompleted + 1;
      await quest.update({ killsCompleted: newKillsCompleted });

      // Проверяем, выполнено ли задание (completeQuest будет вызван из message-handler)
      const isCompleted = newKillsCompleted >= quest.killsRequired;

      const timeRemaining = Math.max(0, expiresAt - now);
      return {
        id: quest.id,
        sectorId: quest.sectorId,
        questType: quest.questType as QuestType,
        killsRequired: quest.killsRequired,
        killsCompleted: newKillsCompleted,
        timeLimitMinutes: quest.timeLimitMinutes,
        startedAt: new Date(quest.startedAt).getTime(),
        expiresAt,
        completedAt: isCompleted ? now : null, // Помечаем как выполненный с текущим временем, если достигнут лимит
        failedAt: null,
        rewardExp: quest.rewardExp,
        rewardTokens: quest.rewardTokens,
        timeRemaining: isCompleted ? 0 : timeRemaining,
      };
    } catch (err) {
      console.error("Failed to increment kills:", err);
      return null;
    }
  }

  /**
   * Получить квест по ID
   */
  async getQuestById(questId: number): Promise<QuestProgress | null> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in getQuestById");
        return null;
      }
      const quest = await this.db.DailyQuest.findByPk(questId);
      if (!quest) return null;

      const expiresAt = new Date(quest.expiresAt).getTime();
      const completedAt = quest.completedAt ? new Date(quest.completedAt).getTime() : null;
      const now = Date.now();
      const timeRemaining = completedAt ? 0 : Math.max(0, expiresAt - now);

        return {
          id: quest.id,
          sectorId: quest.sectorId,
          questType: quest.questType as QuestType,
          killsRequired: quest.killsRequired,
          killsCompleted: quest.killsCompleted,
          timeLimitMinutes: quest.timeLimitMinutes,
          startedAt: new Date(quest.startedAt).getTime(),
          expiresAt,
          completedAt,
          failedAt: quest.failedAt ? new Date(quest.failedAt).getTime() : null,
          rewardExp: quest.rewardExp,
          rewardTokens: quest.rewardTokens,
          timeRemaining,
        };
    } catch (err) {
      console.error("Failed to get quest by id:", err);
      return null;
    }
  }

  /**
   * Завершить квест и выдать награду
   */
  async completeQuest(questId: number, userId: number, sectorId: string, shipChoice?: string | null): Promise<{ exp?: number; tokens?: number } | null> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in completeQuest");
        return null;
      }
      const quest = await this.db.DailyQuest.findByPk(questId);
      if (!quest || quest.completedAt) {
        console.log(`[QuestService] completeQuest: quest not found or already completed, questId=${questId}`);
        return null;
      }

      // Проверяем, что квест принадлежит правильному пользователю и сектору
      if (quest.userId !== userId) {
        console.error(`[QuestService] completeQuest: userId mismatch: quest.userId=${quest.userId}, userId=${userId}`);
        return null;
      }
      if (quest.sectorId !== sectorId) {
        console.error(`[QuestService] completeQuest: sectorId mismatch: quest.sectorId=${quest.sectorId}, sectorId=${sectorId}`);
        return null;
      }

      console.log(`[QuestService] Completing quest: id=${quest.id}, userId=${quest.userId}, sectorId=${quest.sectorId}`);
      const now = new Date();
      await quest.update({ completedAt: now });
      console.log(`[QuestService] Quest completed: id=${quest.id}, completedAt=${now.toISOString()}`);

      // Record completion per sector in user database (for stats/history)
      if (this.db.UserQuestCompletion) {
        try {
          await this.db.UserQuestCompletion.create({
            userId: quest.userId,
            sectorId: quest.sectorId,
            questType: quest.questType,
            completedAt: now,
            rewardExp: quest.rewardExp,
            rewardTokens: quest.rewardTokens,
            dailyQuestId: quest.id,
          });
        } catch (err) {
          console.error("[QuestService] Failed to record user_quest_completion:", err);
        }
      }

      // Выдаем токены
      const player = await this.db.Player.findOne({
        where: { userId },
        attributes: ["resources"],
      });

      if (player) {
        const resources = (player.resources as { scrap?: number; tokens?: number }) || { scrap: 0, tokens: 0 };
        const nextResources = {
          scrap: Number(resources.scrap ?? 0) || 0,
          tokens: (Number(resources.tokens ?? 0) || 0) + quest.rewardTokens,
        };
        await this.db.Player.update(
          { resources: nextResources },
          { where: { userId } }
        );
      }

      return {
        exp: quest.rewardExp,
        tokens: quest.rewardTokens,
      };
    } catch (err) {
      console.error("Failed to complete quest:", err);
      return null;
    }
  }

  /**
   * Получить информацию о квесте в секторе (статус, время до обновления и т.д.)
   * @param questType Если указан, возвращает информацию только для этого типа квеста. Если не указан, возвращает общую информацию.
   */
  async getQuestInfo(userId: number, sectorId: string, questType?: QuestType): Promise<{
    available: boolean;
    completedAt: number | null;
    timeUntilReset: number | null; // milliseconds until reset (midnight)
  }> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in getQuestInfo");
        return { available: false, completedAt: null, timeUntilReset: null };
      }
      const { todayStartUTC, tomorrowStart } = this.getMoscowDayBounds();
      const now = new Date();
      console.log(`[QuestService] getQuestInfo: userId=${userId}, sectorId=${sectorId}, questType=${questType || 'all'}, todayStartUTC=${todayStartUTC.toISOString()}, now=${now.toISOString()}`);
      
      // Проверяем квесты для этого сектора сегодня (только указанного типа, если указан)
      const whereClause: any = {
        userId,
        sectorId,
        startedAt: {
          [Op.gte]: todayStartUTC,
        },
      };
      
      if (questType) {
        whereClause.questType = questType;
      }
      
      const existingToday = await this.db.DailyQuest.findAll({
        where: whereClause,
        order: [["startedAt", "DESC"]],
      });

      console.log(`[QuestService] getQuestInfo result for sector ${sectorId}${questType ? `, type ${questType}` : ''}:`, existingToday.length, 'quest(s) found');

      // Проверяем, есть ли активные квесты (не завершённые)
      // Отменённые/истёкшие квесты удаляются из БД, поэтому проверка failedAt не нужна
      const hasActiveQuest = existingToday.some(q => !q.completedAt);
      
      // Если есть активные квесты, квесты доступны
      if (hasActiveQuest) {
        console.log(`[QuestService] Quest available for sector ${sectorId}${questType ? `, type ${questType}` : ''} (has active quests)`);
        return {
          available: true,
          completedAt: null,
          timeUntilReset: null,
        };
      }

      // Если есть завершенные квесты, находим самый последний для времени завершения
      const completedQuests = existingToday.filter(q => q.completedAt);
      if (completedQuests.length > 0) {
        // Берем самый последний завершенный квест
        const lastCompleted = completedQuests[0];
        const timeUntilReset = tomorrowStart.getTime() - Date.now();
        console.log(`[QuestService] Quest${questType ? ` (type ${questType})` : 's'} completed for sector ${sectorId}, timeUntilReset=${timeUntilReset}`);
        return {
          available: false,
          completedAt: new Date(lastCompleted.completedAt!).getTime(),
          timeUntilReset: Math.max(0, timeUntilReset),
        };
      }

      // Нет квестов сегодня - доступны
      console.log(`[QuestService] Quest available for sector ${sectorId}${questType ? `, type ${questType}` : ''} (no quests today)`);
      return {
        available: true,
        completedAt: null,
        timeUntilReset: null,
      };
    } catch (err) {
      console.error("Failed to get quest info:", err);
      return { available: false, completedAt: null, timeUntilReset: null };
    }
  }

  /**
   * Проверить, доступен ли квест для пользователя в секторе
   * Возвращает true, если можно создать новый квест (не выполнен сегодня)
   */
  async isQuestAvailable(userId: number, sectorId: string): Promise<boolean> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in isQuestAvailable");
        return false;
      }
      const { todayStartUTC } = this.getMoscowDayBounds();
      // Проверяем все квесты для этого сектора
      const existingToday = await this.db.DailyQuest.findAll({
        where: {
          userId,
          sectorId,
          startedAt: {
            [Op.gte]: todayStartUTC,
          },
        },
        order: [["startedAt", "DESC"]],
      });

      // If there is any active quest, quests are available
      // Отменённые/истёкшие квесты удаляются из БД, поэтому проверка failedAt не нужна
      const hasActiveQuest = existingToday.some(q => !q.completedAt);
      if (hasActiveQuest) {
        return true;
      }

      // Check per quest type: unavailable only if both types are successfully completed today
      const mobCompleted = existingToday.some(q => q.questType === "mob_kills" && q.completedAt);
      const pvpCompleted = existingToday.some(q => q.questType === "pvp_kills" && q.completedAt);
      if (mobCompleted && pvpCompleted) {
        return false; // Both completed today, no quests until next day
      }
      // At least one type can be taken (either not completed or only failed/canceled)
      return true;
    } catch (err) {
      console.error("Failed to check quest availability:", err);
      return false;
    }
  }

  /**
   * Получить активный квест для пользователя в секторе
   */
  async getActiveQuest(userId: number, sectorId: string): Promise<QuestProgress | null> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined");
        return null;
      }
      // Получаем все активные квесты для пользователя в секторе (только не завершённые)
      const quests = await this.db.DailyQuest.findAll({
        where: {
          userId,
          sectorId,
          completedAt: null, // Только активные (не завершённые) квесты
        },
        order: [["startedAt", "DESC"]],
      });

      if (quests.length === 0) return null;

      const now = Date.now();
      const activeQuests: QuestProgress[] = [];

      for (const quest of quests) {
        const expiresAt = new Date(quest.expiresAt).getTime();
        
        // Проверяем, не истекло ли время
        if (now >= expiresAt) {
          // Время истекло — удаляем запись квеста
          await quest.destroy();
          continue;
        }

        const timeRemaining = Math.max(0, expiresAt - now);
        activeQuests.push({
          id: quest.id,
          sectorId: quest.sectorId,
          questType: quest.questType as QuestType,
          killsRequired: quest.killsRequired,
          killsCompleted: quest.killsCompleted,
          timeLimitMinutes: quest.timeLimitMinutes,
          startedAt: new Date(quest.startedAt).getTime(),
          expiresAt,
          completedAt: null,
          failedAt: null,
          rewardExp: quest.rewardExp,
          rewardTokens: quest.rewardTokens,
          timeRemaining,
        });
      }

      // Возвращаем первый активный квест (для обратной совместимости)
      // В будущем можно вернуть массив всех активных квестов
      return activeQuests.length > 0 ? activeQuests[0] : null;
    } catch (err) {
      console.error("Failed to get active quest:", err);
      return null;
    }
  }

  /**
   * Отменить активный квест для пользователя в секторе
   * Удаляет запись квеста, чтобы пользователь мог взять его снова
   * @param questType Если указан, отменяет только квест этого типа. Если не указан, отменяет все активные квесты (для совместимости при переходе в другой сектор)
   */
  async cancelQuest(userId: number, sectorId: string, questType?: QuestType): Promise<boolean> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in cancelQuest");
        return false;
      }
      // Удаляем активные квесты в секторе (только указанного типа, если указан)
      // Удаляем только активные (не завершённые) квесты, чтобы пользователь мог взять их снова
      const whereClause: any = {
        userId,
        sectorId,
        completedAt: null, // Только активные квесты (не завершённые)
      };
      
      if (questType) {
        whereClause.questType = questType;
      }
      
      // Удаляем запись квеста вместо пометки failedAt - так пользователь может взять квест снова
      const result = await this.db.DailyQuest.destroy({
        where: whereClause,
      });

      console.log(`[QuestService] Cancelled (deleted) ${result} quest(s) for user ${userId} in sector ${sectorId}${questType ? ` (type: ${questType})` : ' (all types)'}`);
      return result > 0;
    } catch (err) {
      console.error("Failed to cancel quest:", err);
      return false;
    }
  }

  /**
   * Получить все активные квесты для пользователя в секторе
   */
  async getAllActiveQuests(userId: number, sectorId: string): Promise<QuestProgress[]> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in getAllActiveQuests");
        return [];
      }
      const quests = await this.db.DailyQuest.findAll({
        where: {
          userId,
          sectorId,
          completedAt: null, // Только активные (не завершённые) квесты
        },
        order: [["startedAt", "DESC"]],
      });

      const now = Date.now();
      const activeQuests: QuestProgress[] = [];

      for (const quest of quests) {
        const expiresAt = new Date(quest.expiresAt).getTime();
        
        // Проверяем, не истекло ли время
        if (now >= expiresAt) {
          // Время истекло — удаляем запись квеста
          await quest.destroy();
          continue;
        }

        const timeRemaining = Math.max(0, expiresAt - now);
        activeQuests.push({
          id: quest.id,
          sectorId: quest.sectorId,
          questType: quest.questType as QuestType,
          killsRequired: quest.killsRequired,
          killsCompleted: quest.killsCompleted,
          timeLimitMinutes: quest.timeLimitMinutes,
          startedAt: new Date(quest.startedAt).getTime(),
          expiresAt,
          completedAt: null,
          failedAt: null,
          rewardExp: quest.rewardExp,
          rewardTokens: quest.rewardTokens,
          timeRemaining,
        });
      }

      return activeQuests;
    } catch (err) {
      console.error("Failed to get all active quests:", err);
      return [];
    }
  }

  /**
   * Увеличить счетчик убийств игроков для PvP квеста
   */
  async incrementPvpKills(userId: number, sectorId: string): Promise<QuestProgress | null> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in incrementPvpKills");
        return null;
      }
      const quest = await this.db.DailyQuest.findOne({
        where: {
          userId,
          sectorId,
          questType: "pvp_kills",
          completedAt: null, // Только активные (не завершённые) квесты
        },
        order: [["startedAt", "DESC"]],
      });

      if (!quest) return null;

      const now = Date.now();
      const expiresAt = new Date(quest.expiresAt).getTime();
      
      // Проверяем, не истекло ли время
      if (now >= expiresAt) {
        // Время истекло — удаляем запись квеста
        await quest.destroy();
        return null;
      }

      const newKillsCompleted = quest.killsCompleted + 1;
      await quest.update({ killsCompleted: newKillsCompleted });

      // Проверяем, выполнено ли задание
      const isCompleted = newKillsCompleted >= quest.killsRequired;

      const timeRemaining = Math.max(0, expiresAt - now);
      return {
        id: quest.id,
        sectorId: quest.sectorId,
        questType: quest.questType as QuestType,
        killsRequired: quest.killsRequired,
        killsCompleted: newKillsCompleted,
        timeLimitMinutes: quest.timeLimitMinutes,
        startedAt: new Date(quest.startedAt).getTime(),
        expiresAt,
        completedAt: isCompleted ? now : null,
        failedAt: null,
        rewardExp: quest.rewardExp,
        rewardTokens: quest.rewardTokens,
        timeRemaining: isCompleted ? 0 : timeRemaining,
      };
    } catch (err) {
      console.error("Failed to increment PvP kills:", err);
      return null;
    }
  }

  /**
   * Провалить PvP квест (если игрок умер)
   */
  async failPvpQuest(userId: number, sectorId: string): Promise<boolean> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in failPvpQuest");
        return false;
      }
      const result = await this.db.DailyQuest.update(
        { failedAt: new Date() },
        {
          where: {
            userId,
            sectorId,
            questType: "pvp_kills",
            completedAt: null,
            failedAt: null,
          },
        }
      );

      console.log(`[QuestService] Failed ${result[0]} PvP quest(s) for user ${userId} in sector ${sectorId}`);
      return result[0] > 0;
    } catch (err) {
      console.error("Failed to fail PvP quest:", err);
      return false;
    }
  }

  /**
   * Сбросить все истекшие квесты (вызывается в 00:00)
   */
  async resetExpiredQuests(): Promise<void> {
    try {
      if (!this.db || !this.db.DailyQuest) {
        console.error("QuestService: db or db.DailyQuest is undefined in resetExpiredQuests");
        return;
      }
      const now = new Date();
      await this.db.DailyQuest.update(
        { completedAt: now },
        {
          where: {
            completedAt: null,
            expiresAt: {
              [Op.lt]: now,
            },
          },
        }
      );
    } catch (err) {
      console.error("Failed to reset expired quests:", err);
    }
  }
}
