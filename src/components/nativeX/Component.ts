/**
 * Базовый класс для нативных JS компонентов
 * Предоставляет базовую инкапсуляцию и управление DOM
 */
export abstract class Component {
  protected parent: HTMLElement | null;
  protected element: HTMLElement;

  constructor(parent: HTMLElement | null = null) {
    this.parent = parent;
    this.element = this.createRootElement();
    if (parent) {
      parent.appendChild(this.element);
    }
  }

  /**
   * Создает корневой элемент компонента
   */
  protected abstract createRootElement(): HTMLElement;

  /**
   * Метод для инициализации компонента
   */
  public init(): void {
    this.render();
    this.attachEventListeners();
  }

  /**
   * Рендерит содержимое компонента
   */
  protected abstract render(): void;

  /**
   * Присоединяет обработчики событий
   */
  protected attachEventListeners(): void {
    // Переопределяется в подклассах при необходимости
  }

  /**
   * Удаляет компонент из DOM
   */
  public destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.detachEventListeners();
  }

  /**
   * Удаляет обработчики событий
   */
  protected detachEventListeners(): void {
    // Переопределяется в подклассах при необходимости
  }

  /**
   * Получить корневой элемент
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Показать компонент
   */
  public show(): void {
    this.element.style.display = '';
  }

  /**
   * Скрыть компонент
   */
  public hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Проверить, показан ли компонент
   */
  public isVisible(): boolean {
    return this.element.style.display !== 'none';
  }
}