import { Component } from './Component';
import { GAME_TITLE, STUDIO_NAME } from '../../lib/gameBranding';

export class SplashScreen extends Component {
  private fading: boolean;

  constructor(parent: HTMLElement | null, fading: boolean = false) {
    super(parent);
    this.fading = fading;
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'native-splash-overlay';

    if (this.fading) {
      overlay.classList.add('native-splash-fade-out');
    }

    overlay.setAttribute('role', 'img');
    overlay.setAttribute('aria-label', `A game from ${STUDIO_NAME}. ${GAME_TITLE}.`);

    const content = document.createElement('div');
    content.className = 'native-splash-content';

    const studio = document.createElement('p');
    studio.className = 'native-splash-studio';
    studio.textContent = `A game from ${STUDIO_NAME}`;

    const title = document.createElement('h1');
    title.className = 'native-splash-title';
    title.textContent = GAME_TITLE;

    content.appendChild(studio);
    content.appendChild(title);
    overlay.appendChild(content);

    return overlay;
  }

  protected render(): void {
    if (this.fading) {
      this.element?.classList.add('native-splash-fade-out');
    } else {
      this.element?.classList.remove('native-splash-fade-out');
    }
  }

  protected attachEventListeners(): void {
    this.element?.addEventListener('animationend', (e) => {
      if (
        e.animationName === 'native-splash-fade-out' ||
        e.animationName === 'splashFadeOut'
      ) {
        // Call callback if provided
      }
    });
  }

  protected detachEventListeners(): void {
    this.element?.removeEventListener('animationend', () => {});
  }

  public setFading(fading: boolean): void {
    this.fading = fading;
    this.render();
  }
}