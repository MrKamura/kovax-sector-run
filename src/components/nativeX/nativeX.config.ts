/**
 * Конфигурация для нативных компонентов
 */
export interface NativeXConfig {
  /**
   * Включить отладочный режим
   */
  debug?: boolean;
  /**
   * Префикс для CSS классов
   */
  cssPrefix?: string;
  /**
   * Время ожидания для анимаций (мс)
   */
  animationTimeout?: number;
  /**
   * Включить постепенную миграцию
   */
  enableMigration?: boolean;
  /**
   * Использовать нативные компоненты вместо React
   */
  forceNative?: boolean;
}

/**
 * Глобальный конфиг
 */
export const defaultConfig: NativeXConfig = {
  debug: false,
  cssPrefix: 'native',
  animationTimeout: 500,
  enableMigration: true,
  forceNative: false,
};

let currentConfig: NativeXConfig = defaultConfig;

/**
 * Установить конфигурацию
 */
export function setNativeXConfig(config: NativeXConfig): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Получить текущую конфигурацию
 */
export function getNativeXConfig(): NativeXConfig {
  return currentConfig;
}

/**
 * Получить префикс для CSS классов
 */
export function getCssPrefix(): string {
  return currentConfig.cssPrefix || 'native';
}

/**
 * Проверить, включена ли миграция
 */
export function isMigrationEnabled(): boolean {
  return currentConfig.enableMigration ?? true;
}

/**
 * Проверить, используется ли нативный режим
 */
export function isForceNative(): boolean {
  return currentConfig.forceNative ?? false;
}