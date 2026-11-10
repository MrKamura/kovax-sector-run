import { Component } from './Component';
import { Button } from './Button';
import { INTRO_STORY_TEXT } from '../..//constants';

export interface IntroStoryOverlayOptions {
  charsShown: number;
  canProceed: boolean;
  onProceed: () => void;
  onSkip: () => void;
}

export class IntroStoryOverlay extends Component {
  private options: IntroStoryOverlayOptions;

  constructor(parent: HTMLElement | null, options: IntroStoryOverlayOptions) {
    super(parent);
    this.options = options;
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'native-intro-story-overlay';

    const content = document.createElement('div');
    content.className = 'native-intro-story-content';

    const text = document.createElement('p');
    text.className = 'native-intro-story-text';
    
    // Обрезать текст по количеству символов
    const textToShow = INTRO_STORY_TEXT.slice(0, this.options.charsShown);
    text.textContent = textToShow;

    // Добавить курсор если еще не показан весь текст
    if (this.options.charsShown < INTRO_STORY_TEXT.length) {
      const cursor = document.createElement('span');
      cursor.className = 'native-intro-story-cursor';
      cursor.textContent = '|';
      text.appendChild(cursor);
    }

    content.appendChild(text);
    overlay.appendChild(content);

    // Кнопка
    const button = new Button(null, {
      text: this.options.canProceed ? 'Выберите форму' : 'Пропустить историю',
      className: this.options.canProceed ? 'native-intro-story-proceed' : 'native-intro-story-skip',
      onClick: () => {
        if (this.options.canProceed) {
          this.options.onProceed();
        } else {
          this.options.onSkip();
        }
      },
    });
    overlay.appendChild(button.getElement());

    return overlay;
  }

  protected render(): void {
    const textElement = this.element?.querySelector('.native-intro-story-text');
    if (textElement) {
      const textToShow = INTRO_STORY_TEXT.slice(0, this.options.charsShown);
      textElement.textContent = textToShow;
      
      // Обновить курсор
      const cursor = textElement.querySelector('.native-intro-story-cursor');
      if (this.options.charsShown < INTRO_STORY_TEXT.length) {
        if (!cursor) {
          const newCursor = document.createElement('span');
          newCursor.className = 'native-intro-story-cursor';
          newCursor.textContent = '|';
          textElement.appendChild(newCursor);
        }
      } else if (cursor) {
        cursor.remove();
      }
    }

    const buttonElement = this.element?.querySelector('button');
    if (buttonElement) {
      buttonElement.textContent = this.options.canProceed ? 'Выберите форму' : 'Пропустить историю';
    }
  }

  public setCharsShown(chars: number): void {
    this.options.charsShown = chars;
    this.render();
  }

  public setCanProceed(canProceed: boolean): void {
    this.options.canProceed = canProceed;
    this.render();
  }
}