// азовые компоненты
export { Component } from './Component';

// UI компоненты
export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';

// Специфичные компоненты игры
export { AuthScreen } from './AuthScreen';
export { PlayerPanel } from './PlayerPanel';
export { QuestPanel } from './QuestPanel';
export { ChatPanel } from './ChatPanel';

// Типы и конфигурация
export type { 
  ComponentOptions, 
  ButtonOptions, 
  InputOptions, 
  CardOptions,
  NativeXConfig,
  AuthScreenEventData,
} from './types';
export { 
  setNativeXConfig, 
  getNativeXConfig, 
  getCssPrefix,
  defaultConfig 
} from './nativeX.config';

// анель игрока
