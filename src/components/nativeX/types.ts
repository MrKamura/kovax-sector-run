/**
 * Типы для нативных компонентов
 */

/**
 * Опции для базового компонента
 */
export interface ComponentOptions {
  className?: string;
  visible?: boolean;
}

/**
 * Методы для всех компонентов
 */
export interface ComponentMethods {
  init(): void;
  render(): void;
  destroy(): void;
  show(): void;
  hide(): void;
  isVisible(): boolean;
  getElement(): HTMLElement;
}

/**
 * Опции для Button
 */
export interface ButtonOptions extends ComponentOptions {
  text?: string;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * Опции для Input
 */
export interface InputOptions extends ComponentOptions {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

/**
 * Опции для Card
 */
export interface CardOptions extends ComponentOptions {
  title?: string;
}

/**
 * Опции для AuthScreen
 */
export interface AuthScreenOptions extends ComponentOptions {
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string) => Promise<void>;
  authLoading?: boolean;
  authError?: string | null;
}

/**
 * События для AuthScreen
 */
export const AuthScreenEvents = {
  LOGIN: 'auth_login',
  REGISTER: 'auth_register',
  MODE_CHANGE: 'auth_mode_change',
} as const;

/**
 * Тип события
 */
export type AuthScreenEvent = keyof typeof AuthScreenEvents;

/**
 * Данные события
 */
export interface AuthScreenEventData {
  email: string;
  password: string;
}

/**
 * Конфигурация NativeX
 */
export interface NativeXConfig {
  debug?: boolean;
  cssPrefix?: string;
  animationTimeout?: number;
}