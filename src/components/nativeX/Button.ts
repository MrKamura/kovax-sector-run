import { Component } from './Component';

interface ButtonOptions {
  text?: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * Нативный компонент кнопки
 */
export class Button extends Component {
  private options: ButtonOptions;

  constructor(parent: HTMLElement | null, options: ButtonOptions = {}) {
    super(parent);
    this.options = {
      text: '',
      className: '',
      onClick: () => {},
      disabled: false,
      ...options,
    };
  }

  protected createRootElement(): HTMLElement {
    const button = document.createElement('button');
    button.className = `native-button ${this.options.className || ''}`;
    button.textContent = this.options.text ?? '';
    if (this.options.disabled) {
      button.disabled = true;
    }
    return button as HTMLElement;
  }

  protected render(): void {
    const button = this.element as HTMLButtonElement;
    button.textContent = this.options.text ?? '';
    if (this.options.disabled) {
      button.disabled = true;
    } else {
      button.disabled = false;
    }
  }

  protected attachEventListeners(): void {
    const button = this.element as HTMLButtonElement;
    button.addEventListener('click', (e) => {
      if (!this.options.disabled) {
        this.options.onClick?.();
      }
    });
  }

  protected detachEventListeners(): void {
    const button = this.element as HTMLButtonElement;
    if (this.options.onClick) {
      button.removeEventListener('click', this.options.onClick);
    }
  }

  /**
   * Установить текст кнопки
   */
  public setText(text: string): void {
    this.options.text = text;
    this.render();
  }

  /**
   * Установить состояние disabled
   */
  public setDisabled(disabled: boolean): void {
    this.options.disabled = disabled;
    this.render();
  }

  /**
   * Установить обработчик клика
   */
  public setOnClick(callback: () => void): void {
    this.options.onClick = callback;
    this.attachEventListeners();
  }
}