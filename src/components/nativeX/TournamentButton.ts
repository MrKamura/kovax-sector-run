import { Component } from './Component';

export interface TournamentButtonOptions {
  onOpen?: () => void;
}

export class TournamentButton extends Component {
  private options: TournamentButtonOptions;

  constructor(parent: HTMLElement | null, options: TournamentButtonOptions = {}) {
    super(parent);
    this.options = {
      onOpen: () => {},
      ...options,
    };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'native-tournament-button';
    button.setAttribute('title', 'Турнирная таблица');
    const icon = document.createElement('span');
    icon.className = 'native-tournament-button-icon';
    icon.textContent = '??';
    button.appendChild(icon);
    button.addEventListener('click', () => this.options.onOpen?.());
    return button;
  }

  protected render(): void {}

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}
}

