import { Component } from './Component';
import { Button } from './Button';
import { Input } from './Input';
import { EventEmitter } from '../../native/EventEmitter';
import { GAME_TITLE } from '../../lib/gameBranding';

/**
 * События AuthScreen
 */
export const AuthScreenEvents = {
  LOGIN: 'auth_login',
  REGISTER: 'auth_register',
  MODE_CHANGE: 'auth_mode_change',
};

export interface AuthScreenOptions {
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string) => Promise<void>;
  authLoading?: boolean;
  authError?: string | null;
}

/**
 * Нативный компонент экрана аутентификации
 */
export class AuthScreen extends Component {
  private options: AuthScreenOptions;
  private mode: 'login' | 'register' = 'login';
  private emailInput: Input | null = null;
  private passwordInput: Input | null = null;
  private submitButton: Button | null = null;
  private loginTab: HTMLElement | null = null;
  private registerTab: HTMLElement | null = null;
  private errorElement: HTMLElement | null = null;
  private emitter: EventEmitter;

  constructor(parent: HTMLElement | null, options: AuthScreenOptions = {}) {
    super(parent);
    this.options = {
      onLogin: async () => {},
      onRegister: async () => {},
      authLoading: false,
      authError: null,
      ...options,
    };
    this.emitter = new EventEmitter();
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-auth-wrapper';

    const card = document.createElement('div');
    card.className = 'native-auth-card';

    const title = document.createElement('h1');
    title.className = 'native-auth-game-title';
    title.textContent = GAME_TITLE;
    card.appendChild(title);

    // Вкладки
    const tabs = document.createElement('div');
    tabs.className = 'native-auth-tabs';

    this.loginTab = document.createElement('button');
    this.loginTab.className = 'native-tab-button native-tab-active';
    this.loginTab.textContent = 'Вход';
    
    this.registerTab = document.createElement('button');
    this.registerTab.className = 'native-tab-button';
    this.registerTab.textContent = 'Регистрация';

    tabs.appendChild(this.loginTab);
    tabs.appendChild(this.registerTab);
    card.appendChild(tabs);

    // Тело формы
    const body = document.createElement('div');
    body.className = 'native-auth-body';

    // Поле email
    const emailContainer = document.createElement('div');
    emailContainer.className = 'native-auth-label';
    
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email';
    
    this.emailInput = new Input(null, {
      type: 'text',
      placeholder: 'you@example.com',
      value: '',
      className: 'native-auth-input',
    });
    
    emailContainer.appendChild(emailLabel);
    emailContainer.appendChild(this.emailInput.getElement());
    body.appendChild(emailContainer);

    // Поле пароля
    const passwordContainer = document.createElement('div');
    passwordContainer.className = 'native-auth-label';
    
    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'Пароль';
    
    this.passwordInput = new Input(null, {
      type: 'password',
      placeholder: 'Минимум 4 символа',
      value: '',
      className: 'native-auth-input',
    });
    
    passwordContainer.appendChild(passwordLabel);
    passwordContainer.appendChild(this.passwordInput.getElement());
    body.appendChild(passwordContainer);

    // Кнопка отправки
    this.submitButton = new Button(null, {
      text: 'Войти',
      className: 'native-primary-button',
      onClick: () => this.handleSubmit(),
      disabled: this.options.authLoading,
    });
    body.appendChild(this.submitButton.getElement());

    // Сообщение об ошибке
    this.errorElement = document.createElement('p');
    this.errorElement.className = 'native-error';
    this.errorElement.style.display = 'none';
    body.appendChild(this.errorElement);

    card.appendChild(body);
    wrapper.appendChild(card);

    return wrapper;
  }

  protected render(): void {
    if (this.submitButton) {
      this.submitButton.setDisabled(this.options.authLoading || false);
      this.submitButton.setText(this.mode === 'login' ? 'Войти' : 'Создать аккаунт');
    }

    if (this.errorElement && this.options.authError) {
      this.errorElement.textContent = this.options.authError;
      this.errorElement.style.display = '';
    } else if (this.errorElement) {
      this.errorElement.style.display = 'none';
    }

    if (this.loginTab) {
      if (this.mode === 'login') {
        this.loginTab.classList.add('native-tab-active');
        this.registerTab?.classList.remove('native-tab-active');
      } else {
        this.loginTab.classList.remove('native-tab-active');
        this.registerTab?.classList.add('native-tab-active');
      }
    }
  }

  protected attachEventListeners(): void {
    if (this.loginTab) {
      this.loginTab.addEventListener('click', () => this.setMode('login'));
    }
    if (this.registerTab) {
      this.registerTab.addEventListener('click', () => this.setMode('register'));
    }
  }

  protected detachEventListeners(): void {
    if (this.loginTab) {
      this.loginTab.removeEventListener('click', () => this.setMode('login'));
    }
    if (this.registerTab) {
      this.registerTab.removeEventListener('click', () => this.setMode('register'));
    }
  }

  private setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.emitter.emit(AuthScreenEvents.MODE_CHANGE, { mode });
    this.render();
  }

  private async handleSubmit(): Promise<void> {
    const email = this.emailInput?.getValue() || '';
    const password = this.passwordInput?.getValue() || '';

    if (!email || !password) {
      this.emitter.emit('error', { message: 'Заполните все поля' });
      return;
    }

    if (this.mode === 'login') {
      await this.options.onLogin?.(email, password);
      this.emitter.emit(AuthScreenEvents.LOGIN, { email, password });
    } else {
      await this.options.onRegister?.(email, password);
      this.emitter.emit(AuthScreenEvents.REGISTER, { email, password });
    }
  }

  /**
   * Подписаться на события AuthScreen
   */
  public on(eventType: string, callback: (event: any) => void): () => void {
    return this.emitter.on(eventType, callback);
  }

  /**
   * Установить ошибку аутентификации
   */
  public setAuthError(error: string | null): void {
    this.options.authError = error;
    this.render();
  }

  /**
   * Установить состояние загрузки
   */
  public setAuthLoading(loading: boolean): void {
    this.options.authLoading = loading;
    this.render();
  }

  /**
   * Очистить поля ввода
   */
  public clear(): void {
    this.emailInput?.clear();
    this.passwordInput?.clear();
    this.setAuthError(null);
  }
}