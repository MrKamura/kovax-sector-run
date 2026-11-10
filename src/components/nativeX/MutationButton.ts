import { Component } from './Component';

export interface MutationButtonOptions {
  onOpen?: () => void;
}

export class MutationButton extends Component {
  private options: MutationButtonOptions;

  constructor(parent: HTMLElement | null, options: MutationButtonOptions = {}) {
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
    button.className = 'native-mutation-button';
    button.setAttribute('title', 'утации - покупка и улучшение навыков');
    const icon = document.createElement('span');
    icon.className = 'native-mutation-button-icon';
    icon.textContent = '??';
    button.appendChild(icon);
    button.addEventListener('click', () => this.options.onOpen?.());
    return button;
  }

  protected render(): void {}

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}
}

