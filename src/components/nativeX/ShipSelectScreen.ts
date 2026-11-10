import { Component } from './Component';
import { Button } from './Button';
import { GAME_TITLE } from '../../lib/gameBranding';

export interface ShipSelectScreenOptions {
  keeper19Name?: string;
  keeper19Level?: number;
  keeper19Spd?: number;
  keeper19Dmg?: number;
  keeper19Hp?: number;
  keeper20Name?: string;
  keeper20Level?: number;
  keeper20Spd?: number;
  keeper20Dmg?: number;
  keeper20Hp?: number;
  maxHp?: number;
  maxDmg?: number;
  maxSpd?: number;
  pct?: (value: number, max: number) => number;
  onSelectKeeper?: (key: string) => void;
  onLogout?: () => void;
  authError?: string | null;
}

export const ShipSelectScreenEvents = {
  SELECT_KEEPER: 'ship_select_keeper',
  LOGOUT: 'ship_logout',
};

export class ShipSelectScreen extends Component {
  private options: ShipSelectScreenOptions;
  private logoutButton: Button | null = null;
  private errorElement: HTMLElement | null = null;
  private emitter: any;

  constructor(parent: HTMLElement | null, options: ShipSelectScreenOptions = {}) {
    super(parent);
    this.options = {
      keeper19Name: '',
      keeper19Level: 1,
      keeper19Spd: 0,
      keeper19Dmg: 0,
      keeper19Hp: 0,
      keeper20Name: '',
      keeper20Level: 1,
      keeper20Spd: 0,
      keeper20Dmg: 0,
      keeper20Hp: 0,
      maxHp: 100,
      maxDmg: 10,
      maxSpd: 10,
      pct: (v, max) => (v / max) * 100,
      onSelectKeeper: () => {},
      onLogout: () => {},
      authError: null,
      ...options,
    };
    this.emitter = { on: () => () => {}, emit: () => {} };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "native-ship-wrapper";
    const card = document.createElement("div");
    card.className = "native-ship-card";
    const title = document.createElement("p");
    title.className = "native-ship-game-title";
    title.textContent = GAME_TITLE;
    card.appendChild(title);
    const subtitle = document.createElement("h2");
    subtitle.className = "native-ship-title";
    subtitle.textContent = "ыберите форму кипера";
    card.appendChild(subtitle);
    const grid = document.createElement("div");
    grid.className = "native-ship-grid";
    const card1 = this.createShipCard("keeper19", { name: this.options.keeper19Name, level: this.options.keeper19Level, spd: this.options.keeper19Spd, dmg: this.options.keeper19Dmg, hp: this.options.keeper19Hp });
    card1.className += " native-ship-card-19";
    grid.appendChild(card1);
    const card2 = this.createShipCard("keeper20", { name: this.options.keeper20Name, level: this.options.keeper20Level, spd: this.options.keeper20Spd, dmg: this.options.keeper20Dmg, hp: this.options.keeper20Hp });
    card2.className += " native-ship-card-20";
    grid.appendChild(card2);
    card.appendChild(grid);
    this.errorElement = document.createElement("p");
    this.errorElement.className = "native-error";
    this.errorElement.style.display = "none";
    card.appendChild(this.errorElement);
    this.logoutButton = new Button(null, { text: "ыйти", className: "native-secondary-button", onClick: () => { this.options.onLogout?.(); this.emitter.emit(ShipSelectScreenEvents.LOGOUT); } });
    card.appendChild(this.logoutButton.getElement());
    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {
    const card1 = this.element.querySelector(".native-ship-card-19") as HTMLElement;
    const card2 = this.element.querySelector(".native-ship-card-20") as HTMLElement;
    if (card1) { this.updateShipCard(card1, { name: this.options.keeper19Name, level: this.options.keeper19Level, spd: this.options.keeper19Spd, dmg: this.options.keeper19Dmg, hp: this.options.keeper19Hp }); }
    if (card2) { this.updateShipCard(card2, { name: this.options.keeper20Name, level: this.options.keeper20Level, spd: this.options.keeper20Spd, dmg: this.options.keeper20Dmg, hp: this.options.keeper20Hp }); }
    if (this.errorElement && this.options.authError) { this.errorElement.textContent = this.options.authError; this.errorElement.style.display = ""; } else if (this.errorElement) { this.errorElement.style.display = "none"; }
  }

  protected attachEventListeners(): void {}
  protected detachEventListeners(): void {}

  private createShipCard(keeperKey: string, data: any): HTMLElement {
    const container = document.createElement("div");
    container.className = "native-ship-container " + (keeperKey === "keeper19" ? "keeper19" : "keeper20");
    const preview = document.createElement("span");
    preview.className = "native-ship-preview " + (keeperKey === "keeper19" ? "native-ship-preview-fast" : "native-ship-preview-tank");
    container.appendChild(preview);
    const info = document.createElement("div");
    info.className = "native-ship-info";
    const labelRow = document.createElement("div");
    labelRow.className = "native-ship-label-row";
    const nameSpan = document.createElement("span");
    nameSpan.className = "native-ship-name";
    nameSpan.textContent = data.name || "";
    const levelSpan = document.createElement("span");
    levelSpan.className = "native-ship-level";
    levelSpan.textContent = "Lv." + (data.level || 1);
    labelRow.appendChild(nameSpan);
    labelRow.appendChild(levelSpan);
    info.appendChild(labelRow);
    const statRows = document.createElement("div");
    statRows.className = "native-ship-stat-rows";
    statRows.appendChild(this.createStatRow("Скорость", data.spd || 0, this.options.maxSpd || 10));
    statRows.appendChild(this.createStatRow("рон", data.dmg || 0, this.options.maxDmg || 10));
    statRows.appendChild(this.createStatRow("HP", data.hp || 0, this.options.maxHp || 100));
    info.appendChild(statRows);
    container.appendChild(info);
    const button = new Button(null, { text: "", className: "native-secondary-button native-ship-button", onClick: () => { this.options.onSelectKeeper?.(keeperKey); this.emitter.emit(ShipSelectScreenEvents.SELECT_KEEPER, { keeperKey }); } });
    button.setDisabled(false);
    container.appendChild(button.getElement());
    return container;
  }

  private createStatRow(label: string, value: number, max: number): HTMLElement {
    const row = document.createElement("div");
    row.className = "native-ship-stat-row";
    const labelSpan = document.createElement("span");
    labelSpan.className = "native-ship-stat-name";
    labelSpan.textContent = label;
    const barContainer = document.createElement("div");
    barContainer.className = "native-ship-stat-bar";
    const fill = document.createElement("div");
    fill.className = "native-ship-stat-fill";
    fill.style.width = this.options.pct!(value, max) + "%";
    const valueSpan = document.createElement("span");
    valueSpan.className = "native-ship-stat-value";
    valueSpan.textContent = value.toString();
    barContainer.appendChild(fill);
    barContainer.appendChild(valueSpan);
    row.appendChild(labelSpan);
    row.appendChild(barContainer);
    return row;
  }

  private updateShipCard(card: HTMLElement, data: any): void {
    const nameSpan = card.querySelector(".native-ship-name") as HTMLElement;
    const levelSpan = card.querySelector(".native-ship-level") as HTMLElement;
    if (nameSpan && data.name) nameSpan.textContent = data.name;
    if (levelSpan && data.level) levelSpan.textContent = "Lv." + data.level;
    this.updateShipStat(card, "spd", data.spd || 0, this.options.maxSpd || 10);
    this.updateShipStat(card, "dmg", data.dmg || 0, this.options.maxDmg || 10);
    this.updateShipStat(card, "hp", data.hp || 0, this.options.maxHp || 100);
  }

  private updateShipStat(card: HTMLElement, stat: string, value: number, max: number): void {
    const bar = card.querySelector(".native-ship-stat-bar[data-stat=" + stat + "]") as HTMLElement;
    if (bar) {
      bar.style.width = this.options.pct!(value, max) + "%";
      const valueSpan = bar.querySelector(".native-ship-stat-value") as HTMLElement;
      if (valueSpan) valueSpan.textContent = value.toString();
    }
  }

  public on(eventType: string, callback: (event: any) => void): () => void {
    return this.emitter.on(eventType, callback);
  }

}
