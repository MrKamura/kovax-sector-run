/**
 * Примеры использования нативных компонентов
 */

import { Component } from './Component';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { AuthScreen } from './AuthScreen';
import { ScreenManager } from '../../native/ScreenManager';

/**
 * Пример 1: Простая кнопка
 */
export function createSimpleButton(): void {
  const button = new Button(document.body, {
    text: 'Нажми меня',
    className: 'my-custom-button',
    onClick: () => {
      alert('Кнопка нажата!');
    },
    disabled: false,
  });
  button.init();
}

/**
 * Пример 2: Поле ввода
 */
export function createInputExample(): void {
  const input = new Input(document.body, {
    type: 'text',
    placeholder: 'Введите имя',
    value: '',
    className: 'name-input',
    onChange: (value) => {
      console.log('Изменено:', value);
    },
  });
  input.init();
}

/**
 * Пример 3: Карточка с контентом
 */
export function createCardExample(): void {
  const card = new Card(document.body, {
    title: 'Пример карточки',
    className: 'my-card',
  });
  card.init();

  if (card.getContentElement()) {
    card.setContent('<p>Это содержимое карточки</p>');
  }
}

/**
 * Пример 4: Полная форма аутентификации
 */
export function createAuthFormExample(): void {
  const authScreen = new AuthScreen(document.body, {
    onLogin: async (email, password) => {
      console.log('Login:', email, password);
      // Здесь логика входа
    },
    onRegister: async (email, password) => {
      console.log('Register:', email, password);
      // Здесь логика регистрации
    },
    authLoading: false,
    authError: null,
  });

  authScreen.init();

  // Подписаться на события
  authScreen.on('error', (event: any) => {
    console.error('Error:', event.data?.message);
  });

  authScreen.on('auth_mode_change', (event: any) => {
    console.log('Mode changed:', event.data.mode);
  });
}

/**
 * Пример 5: Комбинированный пример с ScreenManager
 */
export function createScreenManagerExample(): void {
  const container = document.getElementById('app-container');
  if (!container) return;

  const manager = new ScreenManager(container);

  // Создать экран 1
  const screen1 = document.createElement('div');
  screen1.id = 'screen1';
  screen1.innerHTML = '<h1>Экран 1</h1><button id="go-to-screen2">Перейти к экрану 2</button>';
  container.appendChild(screen1);

  // Создать экран 2
  const screen2 = document.createElement('div');
  screen2.id = 'screen2';
  screen2.innerHTML = '<h1>Экран 2</h1><button id="go-to-screen1">Перейти к экрану 1</button>';
  container.appendChild(screen2);

  manager.addScreen('screen1', screen1);
  manager.addScreen('screen2', screen2);

  // Показать экран 1
  manager.showScreen('screen1');

  // Переключение экранов
  screen1.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'go-to-screen2') {
      manager.showScreen('screen2');
    }
  });

  screen2.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'go-to-screen1') {
      manager.showScreen('screen1');
    }
  });
}

/**
 * Пример 6: Использование в React компоненте
 */
export function useInReactExample(): void {
  // Это демонстрирует, как использовать nativeX внутри React компонента
  console.log('See src/components/nativeX/README.md for React integration example');
}