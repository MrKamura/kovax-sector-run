import { Component } from './Component';
import { Button } from './Button';
import { Input } from './Input';
import { EventEmitter } from '../../native/EventEmitter';
import { GAME_TITLE } from '../../lib/gameBranding';

/**
 * РЎРѕР±С‹С‚РёСЏ AuthScreen
 */
export const AuthScreenEvents = {
  LOGIN: 'skill_login',
  REGISTER: 'skill_register',
  MODE_CHANGE: 'skill_mode_change',
};

export interface AuthScreenOptions {
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string) => Promise<void>;
  skillLoading?: boolean;
  skillError?: string | null;
}

/**
 * РќР°С‚РёРІРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ СЌРєСЂР°РЅР° Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё
 */
export class PlayerPanel extends Component {
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
      skillLoading: false,
      skillError: null,
      ...options,
    };
    this.emitter = new EventEmitter();
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-skill-wrapper';

    const card = document.createElement('div');
    card.className = 'native-skill-card';

    const title = document.createElement('h1');
    title.className = 'native-skill-game-title';
    title.textContent = GAME_TITLE;
    card.appendChild(title);

    // Р’РєР»Р°РґРєРё
    const tabs = document.createElement('div');
    tabs.className = 'native-skill-tabs';

    this.loginTab = document.createElement('button');
    this.loginTab.className = 'native-tab-button native-tab-active';
    this.loginTab.textContent = 'Р’С…РѕРґ';
    
    this.registerTab = document.createElement('button');
    this.registerTab.className = 'native-tab-button';
    this.registerTab.textContent = 'Р РµРіРёСЃС‚СЂР°С†РёСЏ';

    tabs.appendChild(this.loginTab);
    tabs.appendChild(this.registerTab);
    card.appendChild(tabs);

    // РўРµР»Рѕ С„РѕСЂРјС‹
    const body = document.createElement('div');
    body.className = 'native-skill-body';

    // РџРѕР»Рµ email
    const emailContainer = document.createElement('div');
    emailContainer.className = 'native-skill-label';
    
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email';
    
    this.emailInput = new Input(null, {
      type: 'text',
      placeholder: 'you@example.com',
      value: '',
      className: 'native-skill-input',
    });
    
    emailContainer.appendChild(emailLabel);
    emailContainer.appendChild(this.emailInput.getElement());
    body.appendChild(emailContainer);

    // РџРѕР»Рµ РїР°СЂРѕР»СЏ
    const passwordContainer = document.createElement('div');
    passwordContainer.className = 'native-skill-label';
    
    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'РџР°СЂРѕР»СЊ';
    
    this.passwordInput = new Input(null, {
      type: 'password',
      placeholder: 'РњРёРЅРёРјСѓРј 4 СЃРёРјРІРѕР»Р°',
      value: '',
      className: 'native-skill-input',
    });
    
    passwordContainer.appendChild(passwordLabel);
    passwordContainer.appendChild(this.passwordInput.getElement());
    body.appendChild(passwordContainer);

    // РљРЅРѕРїРєР° РѕС‚РїСЂР°РІРєРё
    this.submitButton = new Button(null, {
      text: 'Р’РѕР№С‚Рё',
      className: 'native-primary-button',
      onClick: () => this.handleSubmit(),
      disabled: this.options.skillLoading,
    });
    body.appendChild(this.submitButton.getElement());

    // РЎРѕРѕР±С‰РµРЅРёРµ РѕР± РѕС€РёР±РєРµ
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
      this.submitButton.setDisabled(this.options.skillLoading || false);
      this.submitButton.setText(this.mode === 'login' ? 'Р’РѕР№С‚Рё' : 'РЎРѕР·РґР°С‚СЊ Р°РєРєР°СѓРЅС‚');
    }

    if (this.errorElement && this.options.skillError) {
      this.errorElement.textContent = this.options.skillError;
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
      this.emitter.emit('error', { message: 'Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РїРѕР»СЏ' });
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
   * РџРѕРґРїРёСЃР°С‚СЊСЃСЏ РЅР° СЃРѕР±С‹С‚РёСЏ AuthScreen
   */
  public on(eventType: string, callback: (event: any) => void): () => void {
    return this.emitter.on(eventType, callback);
  }

  /**
   * РЈСЃС‚Р°РЅРѕРІРёС‚СЊ РѕС€РёР±РєСѓ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё
   */
  public setAuthError(error: string | null): void {
    this.options.skillError = error;
    this.render();
  }

  /**
   * РЈСЃС‚Р°РЅРѕРІРёС‚СЊ СЃРѕСЃС‚РѕСЏРЅРёРµ Р·Р°РіСЂСѓР·РєРё
   */
  public setAuthLoading(loading: boolean): void {
    this.options.skillLoading = loading;
    this.render();
  }

  /**
   * РћС‡РёСЃС‚РёС‚СЊ РїРѕР»СЏ РІРІРѕРґР°
   */
  public clear(): void {
    this.emailInput?.clear();
    this.passwordInput?.clear();
    this.setAuthError(null);
  }
}
