/**
 * Пример использования нативных компонентов
 * Этот файл демонстрирует, как использовать нативные компоненты вместо React
 */

import { ScreenManager } from './ScreenManager';
import { AuthScreen } from '@/components/nativeX';

/**
 * Инициализация нативных компонентов
 */
export async function initNativeApp(): Promise<void> {
  console.log('Initializing NativeX app...');

  // Создать контейнер для экранов
  const appContainer = document.getElementById('app-container');
  if (!appContainer) {
    console.error('App container not found');
    return;
  }

  // Создать менеджер экранов
  const screenManager = new ScreenManager(appContainer);

  // Создать экран аутентификации
  const authScreen = new AuthScreen(appContainer, {
    onLogin: async (email: string, password: string) => {
      console.log('Login attempt:', email, password);
      // Здесь можно добавить логику входа
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          // Успешный вход
          authScreen.clear();
          screenManager.showScreen('main');
        } else {
          const error = await response.json();
          authScreen.setAuthError(error.message || 'Ошибка входа');
        }
      } catch (error) {
        authScreen.setAuthError('Сетевая ошибка');
      }
    },
    onRegister: async (email: string, password: string) => {
      console.log('Register attempt:', email, password);
      // Здесь можно добавить логику регистрации
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          // Успешная регистрация
          authScreen.clear();
          screenManager.showScreen('main');
        } else {
          const error = await response.json();
          authScreen.setAuthError(error.message || 'Ошибка регистрации');
        }
      } catch (error) {
        authScreen.setAuthError('Сетевая ошибка');
      }
    },
    authLoading: false,
    authError: null,
  });

  authScreen.init();
  screenManager.addScreen('auth', authScreen.getElement());

  // Показать экран аутентификации
  screenManager.showScreen('auth');

  console.log('NativeX app initialized');
}

/**
 * Запуск приложения
 */
export function startNativeApp(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNativeApp);
  } else {
    initNativeApp();
  }
}

// Запустить приложение (раскомментировать, когда будет готово)
// startNativeApp();