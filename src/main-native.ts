/**
 * Main entry point for native JS version of Kovax Game
 * This file provides an alternative to React-based main.tsx
 * Components can be gradually migrated from React to native JS
 */

import { ScreenManager } from './native';
import { createNativeStore } from './store/nativeStore';
import { AuthScreen, PlayerPanel, QuestPanel, ChatPanel, NicknameScreen, ShipSelectScreen } from './components/nativeX';

// Состояние приложения
interface AppState {
  user: any | null;
  player: any | null;
  authLoading: boolean;
  authError: string | null;
}

// Создать store для состояния
const appStore = createNativeStore<AppState>({
  user: null,
  player: null,
  authLoading: false,
  authError: null,
});

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
      appStore.setState({ authLoading: true, authError: null });
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          const data = await response.json();
          appStore.setState({ user: data.user, authLoading: false });
          authScreen.clear();
          screenManager.showScreen('main');
        } else {
          const error = await response.json();
          appStore.setState({ authError: error.message || 'Ошибка входа', authLoading: false });
          authScreen.setAuthError(error.message || 'Ошибка входа');
        }
      } catch (error) {
        appStore.setState({ authError: 'Сетевая ошибка', authLoading: false });
        authScreen.setAuthError('Сетевая ошибка');
      }
    },
    onRegister: async (email: string, password: string) => {
      console.log('Register attempt:', email, password);
      appStore.setState({ authLoading: true, authError: null });
      
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          appStore.setState({ authLoading: false });
          authScreen.clear();
          screenManager.showScreen('main');
        } else {
          const error = await response.json();
          appStore.setState({ authError: error.message || 'Ошибка регистрации', authLoading: false });
          authScreen.setAuthError(error.message || 'Ошибка регистрации');
        }
      } catch (error) {
        appStore.setState({ authError: 'Сетевая ошибка', authLoading: false });
        authScreen.setAuthError('Сетевая ошибка');
      }
    },
    authLoading: false,
    authError: null,
  });

  authScreen.init();
  screenManager.addScreen('auth', authScreen.getElement());

  // Создать панель игрока
  const playerPanel = new PlayerPanel(appContainer, {
    authLoading: false,
    authError: null,
  });
  playerPanel.init();
  screenManager.addScreen('player', playerPanel.getElement());

  // Создать панель квестов
  const questPanel = new QuestPanel(appContainer, {
    quests: [],
    onQuestComplete: (questId: number) => {
      console.log('Quest complete:', questId);
    },
  });
  questPanel.init();
  screenManager.addScreen('quest', questPanel.getElement());

  // Создать чат
  const chatPanel = new ChatPanel(appContainer, {
    messages: [],
    chatInput: '',
    onSend: (privateTargetUserId?: number, textOverride?: string) => {
      console.log('Send message:', textOverride);
    },
  });
  chatPanel.init();
  screenManager.addScreen('chat', chatPanel.getElement());

  // Создать экран выбора ника
  const nicknameScreen = new NicknameScreen(appContainer, {
    onNicknameChange: (value: string) => {
      console.log('Nickname change:', value);
    },
    onSave: async () => {
      console.log('Save nickname');
    },
    onLogout: () => {
      console.log('Logout');
    },
    authLoading: false,
    authError: null,
  });
  nicknameScreen.init();
  screenManager.addScreen('nickname', nicknameScreen.getElement());

  // Создать экран выбора корабля
  const shipSelectScreen = new ShipSelectScreen(appContainer, {
    onSelectKeeper: (key: string) => {
      console.log('Select keeper:', key);
    },
    onLogout: () => {
      console.log('Logout');
    },
    authError: null,
  });
  shipSelectScreen.init();
  screenManager.addScreen('ship', shipSelectScreen.getElement());

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