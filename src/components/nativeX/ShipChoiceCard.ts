import { Component } from './Component';
import { Button } from './Button';
import type { KeeperFormDisplay } from '../../types';
import type { KeeperKey } from '../../types';

export interface ShipChoiceCardOptions {
  keeperKey: KeeperKey;
  display: KeeperFormDisplay;
  maxHp: number;
  maxDmg: number;
  maxSpd: number;
  pct: (value: number, max: number) => number;
  onSelect: () => void;
  disabled?: boolean;
  selected?: boolean;
}

export class ShipChoiceCard extends Component {
  private options: ShipChoiceCardOptions;

  constructor(parent: HTMLElement | null, options: ShipChoiceCardOptions) {
    super(parent);
    this.options = options;
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'native-secondary-button native-monster-button';
    button.onclick = () => this.options.onSelect();
    button.disabled = this.options.disabled || false;
    button.setAttribute('aria-pressed', this.options.selected ? 'true' : 'false');

    // Превью
    const previewClass = this.getPreviewClass();
    const preview = document.createElement('span');
    preview.className = `native-monster-preview ${previewClass}`;
    button.appendChild(preview);

    // Информация о корабле
    const info = document.createElement('div');
    info.className = 'native-monster-info';

    const labelRow = document.createElement('div');
    labelRow.className = 'native-monster-label-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'native-monster-label';
    nameSpan.textContent = this.options.display.name;

    const levelSpan = document.createElement('span');
    levelSpan.className = 'native-monster-level';
    levelSpan.textContent = `Lv.${this.options.display.level}`;

    labelRow.appendChild(nameSpan);
    labelRow.appendChild(levelSpan);
    info.appendChild(labelRow);

    // Статы
    const statRows = document.createElement('div');
    statRows.className = 'native-monster-stat-rows';

    statRows.appendChild(this.createStatRow('Скорость', this.options.display.spd, this.options.maxSpd));
    statRows.appendChild(this.createStatRow('Урон', this.options.display.dmg, this.options.maxDmg));
    statRows.appendChild(this.createStatRow('HP', this.options.display.hp, this.options.maxHp));

    info.appendChild(statRows);
    button.appendChild(info);

    return button;
  }

  protected render(): void {
    const button = this.element as HTMLButtonElement;
    button.disabled = this.options.disabled || false;
    button.setAttribute('aria-pressed', this.options.selected ? 'true' : 'false');
  }

  private getPreviewClass(): string {
    const previewClass: Record<string, string> = {
      keeper19: 'native-monster-preview-fast',
      keeper20: 'native-monster-preview-tank',
    };
    return previewClass[this.options.keeperKey] || '';
  }

  private createStatRow(label: string, value: number, max: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'native-monster-stat-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'native-monster-stat-name';
    nameSpan.textContent = label;

    const bar = document.createElement('div');
    bar.className = 'native-monster-stat-bar';

    const fill = document.createElement('div');
    fill.className = 'native-monster-stat-fill';
    const width = this.options.pct(value, max);
    fill.style.width = `${width}%`;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'native-monster-stat-bar-value';
    valueSpan.textContent = value.toString();

    bar.appendChild(fill);
    bar.appendChild(valueSpan);

    row.appendChild(nameSpan);
    row.appendChild(bar);

    return row;
  }
}