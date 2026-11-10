import { Component } from './Component';

export interface QuestButtonOptions {
  onOpen?: () => void;
}

export class QuestButton extends Component {
  private options: QuestButtonOptions;

  constructor(parent: HTMLElement | null, options: QuestButtonOptions = {}) {
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
    button.className = 'native-quest-button';
    button.textContent = 'Quest';
    button.addEventListener('click', () => this.options.onOpen?.());
    return button;
  }

  protected render(): void {}

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}
}

