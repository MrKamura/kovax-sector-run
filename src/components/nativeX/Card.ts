import { Component } from './Component';

interface CardOptions {
  title?: string;
  className?: string;
}

/**
 * Нативный компонент карточки
 */
export class Card extends Component {
  private options: CardOptions;
  private contentElement: HTMLElement | null = null;
  private titleElement: HTMLElement | null = null;

  constructor(parent: HTMLElement | null, options: CardOptions = {}) {
    super(parent);
    this.options = {
      title: '',
      className: '',
      ...options,
    };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const card = document.createElement('div');
    card.className = `native-card ${this.options.className}`;

    if (this.options.title) {
      this.titleElement = document.createElement('h2');
      this.titleElement.className = 'native-card-title';
      this.titleElement.textContent = this.options.title;
      card.appendChild(this.titleElement);
    }

    this.contentElement = document.createElement('div');
    this.contentElement.className = 'native-card-content';
    card.appendChild(this.contentElement);

    return card;
  }

  protected render(): void {
    if (this.titleElement && this.options.title) {
      this.titleElement.textContent = this.options.title;
    }
  }

  /**
   * Добавить контент в карточку
   */
  public setContent(content: string | HTMLElement): void {
    if (!this.contentElement) return;

    if (typeof content === 'string') {
      this.contentElement.innerHTML = content;
    } else {
      this.contentElement.innerHTML = '';
      this.contentElement.appendChild(content);
    }
  }

  /**
   * Добавить HTML в карточку
   */
  public addHtml(html: string): void {
    if (!this.contentElement) return;
    this.contentElement.innerHTML += html;
  }

  /**
   * Получить контейнер контента
   */
  public getContentElement(): HTMLElement | null {
    return this.contentElement;
  }

  /**
   * Установить заголовок
   */
  public setTitle(title: string): void {
    this.options.title = title;
    this.render();
  }
}