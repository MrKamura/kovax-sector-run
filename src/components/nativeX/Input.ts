import { Component } from './Component';

interface InputOptions {
  type?: string;
  placeholder?: string;
  value?: string;
  className?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

/**
 * Нативный компонент input
 */
export class Input extends Component {
  private options: InputOptions;
  private label: HTMLElement | null = null;

  constructor(parent: HTMLElement | null, options: InputOptions = {}) {
    super(parent);
    this.options = {
      type: 'text',
      placeholder: '',
      value: '',
      className: '',
      onChange: () => {},
      disabled: false,
      ...options,
    };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = `native-input-container ${this.options.className}`;

    if (this.options.placeholder) {
      this.label = document.createElement('label');
      this.label.className = 'native-input-label';
      this.label.textContent = this.options.placeholder;
      container.appendChild(this.label);
    }

    const input = document.createElement('input');
    input.type = this.options.type || 'text';
    input.className = 'native-input';
    input.value = this.options.value ?? '';
    input.placeholder = this.options.placeholder ?? '';
    if (this.options.disabled) {
      input.disabled = true;
    }
    container.appendChild(input);

    return container;
  }

  protected render(): void {
    const input = this.element.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value = this.options.value ?? '';
      input.placeholder = this.options.placeholder ?? '';
      input.disabled = this.options.disabled || false;
    }

    if (this.label && this.options.placeholder) {
      this.label.textContent = this.options.placeholder;
    }
  }

  protected attachEventListeners(): void {
    const input = this.element.querySelector('input') as HTMLInputElement;
    if (input) {
      input.addEventListener('input', () => {
        this.options.onChange?.(input.value);
      });
    }
  }

  protected detachEventListeners(): void {
    const input = this.element.querySelector('input') as HTMLInputElement;
    if (input && this.options.onChange) {
      input.removeEventListener('input', () => {
        this.options.onChange?.(input.value);
      });
    }
  }

  /**
   * Установить значение
   */
  public setValue(value: string): void {
    this.options.value = value;
    const input = this.element.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value = value;
    }
  }

  /**
   * Получить значение
   */
  public getValue(): string {
    const input = this.element.querySelector('input') as HTMLInputElement;
    return input?.value || '';
  }

  /**
   * Установить состояние disabled
   */
  public setDisabled(disabled: boolean): void {
    this.options.disabled = disabled;
    this.render();
  }

  /**
   * Фокус на поле ввода
   */
  public focus(): void {
    const input = this.element.querySelector('input') as HTMLInputElement;
    input?.focus();
  }

  /**
   * Очистить поле ввода
   */
  public clear(): void {
    this.setValue('');
  }
}