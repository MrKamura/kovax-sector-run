import { Component } from './Component';

export interface ExitOverlayOptions {
  countdown?: number;
}

export class ExitOverlay extends Component {
  private options: ExitOverlayOptions;

  constructor(parent: HTMLElement | null, options: ExitOverlayOptions = {}) {
    super(parent);
    this.options = {
      countdown: 10,
      ...options,
    };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-exit-overlay';
    wrapper.setAttribute('aria-live', 'polite');
    const card = document.createElement('div');
    card.className = 'native-exit-card';
    const textP = document.createElement('p');
    textP.className = 'native-exit-text';
    textP.textContent = 'ыход из игры…';
    card.appendChild(textP);
    const countdownP = document.createElement('p');
    countdownP.className = 'native-exit-countdown';
    countdownP.textContent = 'тключение через ' + (this.options.countdown || 10) + ' сек.';
    card.appendChild(countdownP);
    const hintP = document.createElement('p');
    hintP.className = 'native-exit-hint';
    hintP.textContent = 'ерсонаж сохранён и недоступен для атак.';
    card.appendChild(hintP);
    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {
    const countdownP = this.element.querySelector('.native-exit-countdown') as HTMLElement;
    if (countdownP) countdownP.textContent = 'тключение через ' + (this.options.countdown || 10) + ' сек.';
  }

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}
}

