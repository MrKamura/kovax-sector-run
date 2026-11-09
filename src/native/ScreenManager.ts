/**
 * Менеджер экранов для управления переходами между различными экранами
 */
export class ScreenManager {
  private currentScreen: HTMLElement | null = null;
  private screens: Map<string, HTMLElement> = new Map();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Добавить экран
   */
  public addScreen(id: string, screen: HTMLElement): void {
    screen.style.display = 'none';
    this.container.appendChild(screen);
    this.screens.set(id, screen);
  }

  /**
   * Показать экран
   */
  public showScreen(id: string): void {
    // Скрыть текущий экран
    if (this.currentScreen) {
      this.currentScreen.style.display = 'none';
    }

    // Показать новый экран
    const screen = this.screens.get(id);
    if (screen) {
      this.currentScreen = screen;
      screen.style.display = '';
    } else {
      console.error(`Screen with id "${id}" not found`);
    }
  }

  /**
   * Скрыть текущий экран
   */
  public hideCurrentScreen(): void {
    if (this.currentScreen) {
      this.currentScreen.style.display = 'none';
    }
  }

  /**
   * Показать текущий экран
   */
  public showCurrentScreen(): void {
    if (this.currentScreen) {
      this.currentScreen.style.display = '';
    }
  }

  /**
   * Получить текущий экран
   */
  public getCurrentScreen(): HTMLElement | null {
    return this.currentScreen;
  }

  /**
   * Удалить экран
   */
  public removeScreen(id: string): void {
    const screen = this.screens.get(id);
    if (screen && screen.parentNode) {
      screen.parentNode.removeChild(screen);
    }
    this.screens.delete(id);
  }

  /**
   * Проверить наличие экрана
   */
  public hasScreen(id: string): boolean {
    return this.screens.has(id);
  }

  /**
   * Получить экран по ID
   */
  public getScreen(id: string): HTMLElement | undefined {
    return this.screens.get(id);
  }
}