/**
 * Конфигурация приложения
 * Выбор между React и нативным JS
 */

export const AppConfig = {
  // Использовать React или нативный JS для UI
  // true = React (по умолчанию, для обратной совместимости)
  // false = нативный JS
  useReactUI: true,
  
  // Путь к React entry point
  reactEntryPoint: './main.tsx',
  
  // Путь к нативному JS entry point
  nativeEntryPoint: './main-native.ts',
  
  // Разрешенные UI библиотеки
  allowedUI: ['react', 'native'] as const,
} as const;

/**
 * Получить текущий entry point на основе конфигурации
 */
export function getEntryPoint(): string {
  return AppConfig.useReactUI 
    ? AppConfig.reactEntryPoint 
    : AppConfig.nativeEntryPoint;
}

/**
 * Проверить, использует ли приложение React
 */
export function isUsingReact(): boolean {
  return AppConfig.useReactUI;
}

/**
 * Проверить, использует ли приложение нативный JS
 */
export function isUsingNative(): boolean {
  return !AppConfig.useReactUI;
}