/**
 * Модуль постепенной миграции React → Native JS
 * Этот файл содержит логику для параллельной работы React и Native компонентов
 */

import { createIntroStoryMachine } from './hooks/nativeIntroStory';
import { createSplashMachine } from './hooks/nativeSplash';
import { createTutorialMachine } from './hooks/nativeTutorial';

/**
 * Фабрика для создания машин состояний (аналог React хуков)
 */
export class MigrationFactory {
  private introStoryMachine = createIntroStoryMachine();
  private splashMachine = createSplashMachine();
  private tutorialMachine = createTutorialMachine();

  /**
   * Получить машину intro story
   */
  public getIntropStoryMachine() {
    return this.introStoryMachine;
  }

  /**
   * Получить машину splash
   */
  public getSplashMachine() {
    return this.splashMachine;
  }

  /**
   * Получить машину tutorial
   */
  public getTutorialMachine() {
    return this.tutorialMachine;
  }

  /**
   * Очистить все машины при уничтожении
   */
  public destroy() {
    this.introStoryMachine.destroy();
    this.splashMachine.destroy();
    this.tutorialMachine.destroy();
  }
}

/**
 * Статус миграции компонентов
 */
export interface MigrationStatus {
  totalReactComponents: number;
  migratedNativeComponents: number;
  pendingComponents: string[];
  completedComponents: string[];
}

/**
 * Отслеживание миграции компонентов
 */
export class MigrationTracker {
  private pending: Set<string> = new Set();
  private completed: Set<string> = new Set();

  /**
   * Добавить компонент в отслеживание
   */
  public addPending(name: string): void {
    this.pending.add(name);
  }

  /**
   * Пометить компонент как мигрированный
   */
  public markCompleted(name: string): void {
    this.pending.delete(name);
    this.completed.add(name);
  }

  /**
   * Получить статус миграции
   */
  public getStatus(): MigrationStatus {
    return {
      totalReactComponents: this.pending.size + this.completed.size,
      migratedNativeComponents: this.completed.size,
      pendingComponents: Array.from(this.pending),
      completedComponents: Array.from(this.completed),
    };
  }
}

// Глобальный трекер миграции
export const migrationTracker = new MigrationTracker();

/**
 * Создать мигрированный компонент (аналог React компонента)
 * @param name Имя компонента
 * @param ReactComponent React компонент (для fallback)
 * @param NativeComponent Native JS компонент
 * @param options Опции миграции
 */
export function createMigratedComponent<
  P,
  ReactProps extends P,
  NativeProps extends P
>(
  name: string,
  ReactComponent: React.FC<ReactProps>,
  NativeComponent: { new (parent: HTMLElement | null, options: NativeProps): any },
  options?: {
    forceNative?: boolean;
    forceReact?: boolean;
  }
): { React: React.FC<ReactProps>; Native: any } {
  // Обновить трекер миграции
  migrationTracker.addPending(name);

  // Если используется native, вернуть Native компонент
  if (options?.forceNative) {
    migrationTracker.markCompleted(name);
    return { React: ReactComponent, Native: NativeComponent };
  }

  // Если используется React, вернуть React компонент
  if (options?.forceReact) {
    return { React: ReactComponent, Native: NativeComponent };
  }

  // По умолчанию возвращать оба варианта
  return { React: ReactComponent, Native: NativeComponent };
}