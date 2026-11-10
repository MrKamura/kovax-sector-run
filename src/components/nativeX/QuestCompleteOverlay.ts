import { Component } from './Component';
import { Button } from './Button';

export interface QuestCompleteOverlayOptions {
  rewardExp?: number;
  rewardTokens?: number;
  onClose?: () => void;
}

export class QuestCompleteOverlay extends Component {
  private options: QuestCompleteOverlayOptions;
  private closeTimer: any = null;

  constructor(parent: HTMLElement | null, options: QuestCompleteOverlayOptions = {}) {
    super(parent);
    this.options = {
      rewardExp: 0,
      rewardTokens: 0,
      onClose: () => {},
      ...options,
    };
    this.init();
    this.startAutoClose();
  }

  private startAutoClose(): void {
    this.closeTimer = setTimeout(() => {
      this.hide();
      setTimeout(() => this.options.onClose?.(), 500);
    }, 4000);
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-quest-complete-overlay';
    wrapper.addEventListener('click', () => this.handleClose());
    const content = document.createElement('div');
    content.className = 'native-quest-complete-content';
    content.addEventListener('click', (e) => e.stopPropagation());
    const closeBtn = document.createElement('button');
    closeBtn.className = 'native-quest-complete-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'акрыть');
    closeBtn.textContent = '?';
    closeBtn.addEventListener('click', () => this.handleClose());
    content.appendChild(closeBtn);
    const title = document.createElement('div');
    title.className = 'native-quest-complete-title';
    title.textContent = '?? вест выполнен! ??';
    content.appendChild(title);
    const rewards = document.createElement('div');
    rewards.className = 'native-quest-complete-rewards';
    const expReward = document.createElement('div');
    expReward.className = 'native-quest-complete-reward';
    const expIcon = document.createElement('span');
    expIcon.className = 'native-quest-complete-reward-icon';
    expIcon.textContent = '?';
    const expText = document.createElement('span');
    expText.className = 'native-quest-complete-reward-text';
    expText.textContent = '+' + (this.options.rewardExp || 0) + ' опыта';
    expReward.appendChild(expIcon);
    expReward.appendChild(expText);
    rewards.appendChild(expReward);
    const tokenReward = document.createElement('div');
    tokenReward.className = 'native-quest-complete-reward';
    const tokenIcon = document.createElement('span');
    tokenIcon.className = 'native-quest-complete-reward-icon';
    tokenIcon.textContent = '??';
    const tokenText = document.createElement('span');
    tokenText.className = 'native-quest-complete-reward-text';
    tokenText.textContent = '+' + (this.options.rewardTokens || 0) + ' токенов';
    tokenReward.appendChild(tokenIcon);
    tokenReward.appendChild(tokenText);
    rewards.appendChild(tokenReward);
    content.appendChild(rewards);
    wrapper.appendChild(content);
    return wrapper;
  }

  protected render(): void {
    const expText = this.element.querySelector('.native-quest-complete-reward-text');
    const tokenText = this.element.querySelectorAll('.native-quest-complete-reward-text')[1];
    if (expText && expText.parentElement) expText.textContent = '+' + (this.options.rewardExp || 0) + ' опыта';
    if (tokenText && tokenText.parentElement) tokenText.textContent = '+' + (this.options.rewardTokens || 0) + ' токенов';
  }

  private handleClose(): void {
    this.hide();
    setTimeout(() => this.options.onClose?.(), 500);
  }

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}

  public destroy(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    super.destroy();
  }
}

