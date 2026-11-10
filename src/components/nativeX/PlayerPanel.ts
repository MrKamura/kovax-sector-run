import { Component } from './Component';
import { Button } from './Button';
import { Input } from './Input';
import { EventEmitter } from '../../native/EventEmitter';
import { GAME_TITLE } from '../../lib/gameBranding';

export const PlayerPanelEvents = {
  LOGIN: 'login',
  REGISTER: 'register',
  MODE_CHANGE: 'mode_change',
};

export interface PlayerPanelOptions {
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string) => Promise<void>;
  authLoading?: boolean;
  authError?: string | null;
}

export class PlayerPanel extends Component {
  private options: PlayerPanelOptions;
  private mode: 'login' | 'register' = 'login';
  private emailInput: Input | null = null;
  private passwordInput: Input | null = null;
  private submitButton: Button | null = null;
  private loginTab: HTMLElement | null = null;
  private registerTab: HTMLElement | null = null;
  private errorElement: HTMLElement | null = null;
  private emitter: EventEmitter;

  constructor(parent: HTMLElement | null, options: PlayerPanelOptions = {}) {
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
    wrapper.className = 'native-player-wrapper';

    const card = document.createElement('div');
    card.className = 'native-player-card';

    const title = document.createElement('h1');
    title.className = 'native-player-game-title';
    title.textContent = GAME_TITLE;
    card.appendChild(title);

    const tabs = document.createElement('div');
    tabs.className = 'native-player-tabs';

    this.loginTab = document.createElement('button');
    this.loginTab.className = 'native-tab-button native-tab-active';
    this.loginTab.textContent = 'Вход';
    
    this.registerTab = document.createElement('button');
    this.registerTab.className = 'native-tab-button';
    this.registerTab.textContent = 'Регистрация';

    tabs.appendChild(this.loginTab);
    tabs.appendChild(this.registerTab);
    card.appendChild(tabs);

    const body = document.createElement('div');
    body.className = 'native-player-body';

    const emailContainer = document.createElement('div');
    emailContainer.className = 'native-player-label';
    
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email';
    
    this.emailInput = new Input(null, {
      type: 'text',
      placeholder: 'you@example.com',
      value: '',
      className: 'native-player-input',
    });
    
    emailContainer.appendChild(emailLabel);
    emailContainer.appendChild(this.emailInput.getElement());
    body.appendChild(emailContainer);

    const passwordContainer = document.createElement('div');
    passwordContainer.className = 'native-player-label';
    
    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'Пароль';
    
    this.passwordInput = new Input(null, {
      type: 'password',
      placeholder: '',
      value: '',
      className: 'native-player-input',
    });
    
    passwordContainer.appendChild(passwordLabel);
    passwordContainer.appendChild(this.passwordInput.getElement());
    body.appendChild(passwordContainer);

    this.submitButton = new Button(null, {
      text: 'Войти',
      className: 'native-primary-button',
      onClick: () => this.handleSubmit(),
      disabled: this.options.authLoading,
    });
    body.appendChild(this.submitButton.getElement());

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
    this.emitter.emit(PlayerPanelEvents.MODE_CHANGE, { mode });
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
      this.emitter.emit(PlayerPanelEvents.LOGIN, { email, password });
    } else {
      await this.options.onRegister?.(email, password);
      this.emitter.emit(PlayerPanelEvents.REGISTER, { email, password });
    }
  }

  public on(eventType: string, callback: (event: any) => void): () => void {
    return this.emitter.on(eventType, callback);
  }

  public setAuthError(error: string | null): void {
    this.options.authError = error;
    this.render();
  }

  public setAuthLoading(loading: boolean): void {
    this.options.authLoading = loading;
    this.render();
  }

  public clear(): void {
    this.emailInput?.clear();
    this.passwordInput?.clear();
    this.setAuthError(null);
  }
}