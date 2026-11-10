import { Component } from './Component';
import { Button } from './Button';

export interface ControlHintsOptions {
  onDismiss?: () => void;
}

export class ControlHintsOverlay extends Component {
  private options: ControlHintsOptions;

  constructor(parent: HTMLElement | null, options: ControlHintsOptions = {}) {
    super(parent);
    this.options = {
      onDismiss: () => {},
      ...options,
    };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-tutorial-overlay';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-label', 'правление');
    const card = document.createElement('div');
    card.className = 'native-tutorial-card';
    const title = document.createElement('h2');
    title.className = 'native-tutorial-title';
    title.textContent = 'правление';
    card.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'native-tutorial-list';
    const moveItem = document.createElement('li');
    const moveSpan = document.createElement('span');
    moveSpan.textContent = 'W A S D или стрелки Ч движение';
    moveItem.appendChild(moveSpan);
    list.appendChild(moveItem);
    const shootItem = document.createElement('li');
    const shootSpan = document.createElement('span');
    shootSpan.textContent = 'робел Ч стрельба';
    shootItem.appendChild(shootSpan);
    list.appendChild(shootItem);
    card.appendChild(list);
    const button = new Button(null, { text: 'он€тно', className: 'native-tutorial-ok-button', onClick: () => this.options.onDismiss?.() });
    card.appendChild(button.getElement());
    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {}

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}
}


export interface PanelHintOptions {
  title?: string;
  description?: string;
  onDismiss?: () => void;
}

export class PanelHintOverlay extends Component {
  private options: PanelHintOptions;

  constructor(parent: HTMLElement | null, options: PanelHintOptions = {}) {
    super(parent);
    this.options = {
      title: '',
      description: '',
      onDismiss: () => {},
      ...options,
    };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-tutorial-overlay';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-label', this.options.title || '');
    const card = document.createElement('div');
    card.className = 'native-tutorial-card';
    const title = document.createElement('h2');
    title.className = 'native-tutorial-title';
    title.textContent = this.options.title || '';
    card.appendChild(title);
    const descP = document.createElement('p');
    descP.className = 'native-tutorial-description';
    descP.textContent = this.options.description || '';
    card.appendChild(descP);
    const button = new Button(null, { text: 'OK', className: 'native-tutorial-ok-button', onClick: () => this.options.onDismiss?.() });
    card.appendChild(button.getElement());
    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {
    const title = this.element.querySelector('.native-tutorial-title') as HTMLElement;
    const descP = this.element.querySelector('.native-tutorial-description') as HTMLElement;
    if (title && this.options.title) title.textContent = this.options.title;
    if (descP && this.options.description) descP.textContent = this.options.description;
  }

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}
}

