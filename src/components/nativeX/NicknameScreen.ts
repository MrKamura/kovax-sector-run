import { Component } from './Component';
import { Button } from './Button';
import { Input } from './Input';
import { GAME_TITLE } from '../../lib/gameBranding';

export interface NicknameScreenOptions {
  nickname?: string;
  onNicknameChange?: (v: string) => void;
  onSave?: () => void;
  onLogout?: () => void;
  authLoading?: boolean;
  authError?: string | null;
}

export const NicknameScreenEvents = {
  SAVE: 'nickname_save',
  LOGOUT: 'nickname_logout',
};

/**
 * Нативный компонент экрана выбора никнейма
 */
export class NicknameScreen extends Component {
  private options: NicknameScreenOptions;
  private nicknameInput: Input | null = null;
  private saveButton: Button | null = null;
  private logoutButton: Button | null = null;
  private errorElement: HTMLElement | null = null;
  private emitter: any;

  constructor(parent: HTMLElement | null, options: NicknameScreenOptions = {}) {
    super(parent);
    this.options = {
      nickname: '',
      onNicknameChange: () => {},
      onSave: () => {},
      onLogout: () => {},
      authLoading: false,
      authError: null,
      ...options,
    };
    this.emitter = { on: () => () => {}, emit: () => {} };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-nickname-wrapper';

    const card = document.createElement('div');
    card.className = 'native-nickname-card';

    const title = document.createElement('p');
    title.className = 'native-nickname-game-title';
    title.textContent = GAME_TITLE;
    card.appendChild(title);

    const subtitle = document.createElement('h2');
    subtitle.className = 'native-nickname-title';
    subtitle.textContent = 'Выберите ник';
    card.appendChild(subtitle);

    // Поле никнейма
    const nicknameContainer = document.createElement('div');
    nicknameContainer.className = 'native-nickname-label';

    const nicknameLabel = document.createElement('label');
    nicknameLabel.textContent = 'Никнейм';

    this.nicknameInput = new Input(null, {
      type: 'text',
      placeholder: 'Например: StarRider',
      value: this.options.nickname,
      className: 'native-nickname-input',
      onChange: (value) => this.options.onNicknameChange?.(value),
    });

    nicknameContainer.appendChild(nicknameLabel);
    nicknameContainer.appendChild(this.nicknameInput.getElement());
    card.appendChild(nicknameContainer);

    // Кнопка сохранения
    this.saveButton = new Button(null, {
      text: 'Сохранить',
      className: 'native-primary-button',
      onClick: () => {
        this.options.onSave?.();
        this.emitter.emit(NicknameScreenEvents.SAVE);
      },
      disabled: this.options.authLoading || false,
    });
    card.appendChild(this.saveButton.getElement());

    // Сообщение об ошибке
    this.errorElement = document.createElement('p');
    this.errorElement.className = 'native-error';
    this.errorElement.style.display = 'none';
    card.appendChild(this.errorElement);

    // Кнопка выхода
    this.logoutButton = new Button(null, {
      text: 'Выйти',
      className: 'native-secondary-button',
      onClick: () => {
        this.options.onLogout?.();
        this.emitter.emit(NicknameScreenEvents.LOGOUT);
      },
    });
    card.appendChild(this.logoutButton.getElement());

    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {
    if (this.nicknameInput) {
      this.nicknameInput.setValue(this.options.nickname || '');
    }

    if (this.saveButton) {
      this.saveButton.setDisabled(this.options.authLoading || false);
    }

    if (this.errorElement && this.options.authError) {
      this.errorElement.textContent = this.options.authError;
      this.errorElement.style.display = '';
    } else if (this.errorElement) {
      this.errorElement.style.display = 'none';
    }
  }

  protected attachEventListeners(): void {
    // Уже обработано в Input и Button
  }

  protected detachEventListeners(): void {
    // Уже обработано в Input и Button
  }

  /**
   * Подписаться на события
   */
  public on(eventType: string, callback: (event: any) => void): () => void {
    return this.emitter.on(eventType, callback);
  }

  /**
   * Очистить поля
   */
  public clear(): void {
    if (this.nicknameInput) {
      this.nicknameInput.clear();
    }
    if (this.errorElement) {
      this.errorElement.style.display = 'none';
    }
  }
}