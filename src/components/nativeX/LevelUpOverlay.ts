import { Component } from './Component';
import { Button } from './Button';

export interface LevelUpOverlayOptions {
  level?: number;
  onDismiss?: () => void;
}

export class LevelUpOverlay extends Component {
  private options: LevelUpOverlayOptions;
  private button: Button | null = null;

  constructor(parent: HTMLElement | null, options: LevelUpOverlayOptions = {}) {
    super(parent);
    this.options = {
      level: 1,
      onDismiss: () => {},
      ...options,
    };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-levelup-overlay';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-label', 'акрыть');
    wrapper.addEventListener('click', () => this.options.onDismiss?.());
    wrapper.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.options.onDismiss?.(); });
    const card = document.createElement('div');
    card.className = 'native-levelup-card';
    card.addEventListener('click', (e) => e.stopPropagation());
    const sign = document.createElement('div');
    sign.className = 'native-levelup-sign';
    const title = document.createElement('span');
    title.className = 'native-levelup-title';
    title.textContent = 'ровень';
    const number = document.createElement('span');
    number.className = 'native-levelup-number';
    number.textContent = (this.options.level || 1).toString();
    sign.appendChild(title);
    sign.appendChild(number);
    card.appendChild(sign);
    if (this.options.level === 3) {
      const info = document.createElement('div');
      info.className = 'native-levelup-level3-info';
      const p1 = document.createElement('p');
      p1.textContent = 'величены здоровье, урон и размер.';
      const p2 = document.createElement('p');
      p2.textContent = 'оступны жёлтые секторы уровня 2.';
      info.appendChild(p1);
      info.appendChild(p2);
      card.appendChild(info);
    }
    this.button = new Button(null, { text: 'родолжить', className: 'native-levelup-dismiss', onClick: () => this.options.onDismiss?.() });
    card.appendChild(this.button.getElement());
    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {
    const number = this.element.querySelector('.native-levelup-number') as HTMLElement;
    if (number) number.textContent = (this.options.level || 1).toString();
  }

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}
}

