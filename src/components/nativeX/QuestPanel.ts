import { Component } from './Component';
import { Button } from './Button';
import { EventEmitter } from '../../native/EventEmitter';

/**
 * События QuestPanel
 */
export const QuestPanelEvents = {
  QUEST_COMPLETE: 'quest_complete',
  QUEST_CANCEL: 'quest_cancel',
};

export interface QuestData {
  id: number;
  title: string;
  description: string;
  killsCompleted: number;
  killsRequired: number;
  expiresAt: number;
  questType: 'pvp_kills' | 'mobs';
  rewardExp: number;
  rewardTokens: number;
  completedAt?: number;
}

export interface QuestPanelOptions {
  quests?: QuestData[];
  onQuestComplete?: (questId: number) => void;
  onQuestCancel?: (questId: number) => void;
  loading?: boolean;
}

/**
 * Нативный компонент панели квестов
 */
export class QuestPanel extends Component {
  private options: QuestPanelOptions;
  private quests: Map<number, HTMLElement> = new Map();
  private timerInterval: number | null = null;
  private emitter: EventEmitter;

  constructor(parent: HTMLElement | null, options: QuestPanelOptions = {}) {
    super(parent);
    this.options = {
      quests: [],
      onQuestComplete: () => {},
      onQuestCancel: () => {},
      loading: false,
      ...options,
    };
    this.emitter = new EventEmitter();
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-quest-wrapper';

    const card = document.createElement('div');
    card.className = 'native-quest-card';

    const title = document.createElement('h3');
    title.className = 'native-quest-title';
    title.textContent = 'Активные квесты';
    card.appendChild(title);

    const list = document.createElement('div');
    list.className = 'native-quest-list';
    card.appendChild(list);

    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {
    const list = this.element.querySelector('.native-quest-list') as HTMLElement;
    if (!list) return;

    // Очистить существующие квесты
    list.innerHTML = '';

    // Отфильтровать активные квесты (не завершенные и не истекшие)
    const now = Date.now();
    const activeQuests = (this.options.quests ?? []).filter(q => q !== null && q.completedAt === undefined && (q.expiresAt - now) > 0);

    if (activeQuests.length === 0) {
      this.hide();
      return;
    } else {
      this.show();
    }

    // Отобразить каждый квест
    activeQuests.forEach(quest => {
      const questEl = document.createElement('div');
      questEl.className = 'native-quest-item';

      const title = document.createElement('div');
      title.className = 'native-quest-item-title';
      title.textContent = quest.questType === 'pvp_kills' ? 'PvP квест' : 'Квест на мобов';
      questEl.appendChild(title);

      // Прогресс
      const progressContainer = document.createElement('div');
      progressContainer.className = 'native-quest-progress';
      const progressFill = document.createElement('div');
      progressFill.className = 'native-quest-progress-fill';
      const progressPercent = Math.min(100, (quest.killsCompleted / quest.killsRequired) * 100);
      progressFill.style.width = progressPercent + '%';
      progressContainer.appendChild(progressFill);
      questEl.appendChild(progressContainer);

      // Статус
      const status = document.createElement('div');
      status.className = 'native-quest-status';
      status.textContent = quest.killsCompleted + ' / ' + quest.killsRequired;
      questEl.appendChild(status);

      // Таймер
      const timerContainer = document.createElement('div');
      timerContainer.className = 'native-quest-timer';
      const timeRemaining = Math.max(0, quest.expiresAt - now);
      const minutes = Math.floor(timeRemaining / 60000);
      const seconds = Math.floor((timeRemaining % 60000) / 1000);
      const timeString = minutes + ':' + seconds.toString().padStart(2, '0');
      timerContainer.textContent = 'Время: ' + timeString;
      questEl.appendChild(timerContainer);

      // Кнопки
      const buttons = document.createElement('div');
      buttons.className = 'native-quest-buttons';

      const completeBtn = new Button(null, {
        text: 'Завершить',
        className: 'native-secondary-button',
        onClick: () => {
          this.options.onQuestComplete?.(quest.id);
          this.emitter.emit(QuestPanelEvents.QUEST_COMPLETE, { questId: quest.id });
        },
        disabled: this.options.loading,
      });
      buttons.appendChild(completeBtn.getElement());

      const cancelBtn = new Button(null, {
        text: 'Отменить',
        className: 'native-danger-button',
        onClick: () => {
          this.options.onQuestCancel?.(quest.id);
          this.emitter.emit(QuestPanelEvents.QUEST_CANCEL, { questId: quest.id });
        },
        disabled: this.options.loading,
      });
      buttons.appendChild(cancelBtn.getElement());

      questEl.appendChild(buttons);
      list.appendChild(questEl);
    });

    // Запустить таймер обновления
    if (this.timerInterval === null) {
      this.timerInterval = window.setInterval(() => this.render(), 1000);
    }
  }

  protected attachEventListeners(): void {
    // Уже обработано в Button
  }

  protected detachEventListeners(): void {
    // Уже обработано в Button
  }

  /**
   * Обновить список квестов
   */
  public setQuests(quests: QuestData[]): void {
    this.options.quests = quests;
    this.render();
  }

  /**
   * Установить состояние загрузки
   */
  public setLoading(loading: boolean): void {
    this.options.loading = loading;
    this.render();
  }

  /**
   * Подписаться на события
   */
  public on(eventType: string, callback: (event: any) => void): () => void {
    return this.emitter.on(eventType, callback);
  }

  /**
   * Очистить таймер при уничтожении
   */
  public destroy(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    super.destroy();
  }
}