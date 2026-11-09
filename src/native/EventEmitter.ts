/**
 * Базовый класс для событий
 */
export class Event {
  public type: string;
  public data?: any;

  constructor(type: string, data?: any) {
    this.type = type;
    this.data = data;
  }
}

/**
 * Эмиттер событий для коммуникации между компонентами
 */
export class EventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Подписаться на событие
   */
  public on(eventType: string, callback: (event: Event) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)?.add(callback);

    // Вернуть функцию для отписки
    return () => this.off(eventType, callback);
  }

  /**
   * Отписаться от события
   */
  public off(eventType: string, callback: Function): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Отправить событие
   */
  public emit(eventType: string, data?: any): void {
    const event = new Event(eventType, data);
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in event listener for "${eventType}":`, error);
        }
      });
    }
  }

  /**
   * Очистить все слушатели для события
   */
  public clear(eventType: string): void {
    this.listeners.delete(eventType);
  }

  /**
   * Очистить все события
   */
  public clearAll(): void {
    this.listeners.clear();
  }

  /**
   * Проверить наличие слушателей для события
   */
  public hasListeners(eventType: string): boolean {
    const listeners = this.listeners.get(eventType);
    return listeners ? listeners.size > 0 : false;
  }
}