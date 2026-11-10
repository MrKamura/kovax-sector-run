import { Component } from './Component';
import { Button } from './Button';

export interface DeathOverlayOptions {
  killedBy?: string;
  killedByUserId?: number;
  lostTokens?: number;
  lostExp?: number;
  expPercent?: number;
  tokenPercent?: number;
  onRespawn?: () => void;
  onRespawnVengeance?: (userId: number) => void;
}

export const DeathOverlayEvents = {
  RESPAWN: 'respawn',
  RESPAWN_VENGEANCE: 'respawn_vengeance',
};

export class DeathOverlay extends Component {
  private options: DeathOverlayOptions;
  private vengeanceButton: Button | null = null;
  private respawnButton: Button | null = null;
  private emitter: any;

  constructor(parent: HTMLElement | null, options: DeathOverlayOptions = {}) {
    super(parent);
    this.options = {
      killedBy: '',
      killedByUserId: undefined,
      lostTokens: 0,
      lostExp: 0,
      expPercent: undefined,
      tokenPercent: undefined,
      onRespawn: () => {},
      onRespawnVengeance: () => {},
      ...options,
    };
    this.emitter = { on: () => () => {}, emit: () => {} };
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-death-overlay';
    const card = document.createElement('div');
    card.className = 'native-death-card';
    const title = document.createElement('h2');
    title.textContent = 'ы погибли';
    card.appendChild(title);
    if (this.options.killedBy) {
      const killedByP = document.createElement('p');
      killedByP.textContent = 'Killed: ' + this.options.killedBy;
      card.appendChild(killedByP);
    }
    const lossP = document.createElement('p');
    lossP.textContent = 'отеряно токенов: ' + (this.options.lostTokens || 0);
    if (this.options.tokenPercent != null) lossP.textContent += ' (' + this.options.tokenPercent + '%)';
    lossP.textContent += '. отеряно опыта: ' + (this.options.lostExp || 0);
    if (this.options.expPercent != null) lossP.textContent += ' (' + this.options.expPercent + '%)';
    lossP.textContent += '.';
    card.appendChild(lossP);
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'native-death-buttons';
    if (this.options.killedByUserId != null && this.options.killedByUserId > 0) {
      this.vengeanceButton = new Button(null, { text: 'Respawn and hunt ' + (this.options.killedBy || 'player'), className: 'native-vengeance-respawn-button', onClick: () => { this.options.onRespawnVengeance?.(this.options.killedByUserId!); this.emitter.emit(DeathOverlayEvents.RESPAWN_VENGEANCE, { userId: this.options.killedByUserId }); } });
      buttonContainer.appendChild(this.vengeanceButton.getElement());
    }
    this.respawnButton = new Button(null, { text: this.options.killedByUserId != null && this.options.killedByUserId > 0 ? 'Respawn' : 'OK', className: 'native-primary-button', onClick: () => { this.options.onRespawn?.(); this.emitter.emit(DeathOverlayEvents.RESPAWN); } });
    buttonContainer.appendChild(this.respawnButton.getElement());
    card.appendChild(buttonContainer);
    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {}

  protected attachEventListeners(): void {}

  protected detachEventListeners(): void {}

  public on(eventType: string, callback: (event: any) => void): () => void {
    return this.emitter.on(eventType, callback);
  }
}

