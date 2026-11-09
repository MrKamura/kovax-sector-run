import { Component } from './Component';
import { Button } from './Button';
import { Input } from './Input';
import { EventEmitter } from '../../native/EventEmitter';

const SYSTEM_NICKNAME = "Система";

export interface ChatMessageItem {
  id: number;
  userId: number;
  nickname: string;
  text: string;
  scope: 'sector' | 'global' | 'private' | 'system';
  timestamp: number;
}

export interface ChatPanelOptions {
  scope?: 'sector' | 'global' | 'private' | 'system';
  messages?: ChatMessageItem[];
  chatInput?: string;
  onScopeChange?: (scope: 'sector' | 'global' | 'private' | 'system') => void;
  onChatInputChange?: (v: string) => void;
  onSend?: (privateTargetUserId?: number, textOverride?: string) => void;
  currentUserId?: number | null;
  privateThreads?: Record<number, ChatMessageItem[]>;
  selectedPrivateUserId?: number | null;
  setSelectedPrivateUserId?: (userId: number | null) => void;
  pmTarget?: { userId: number; nickname: string } | null;
  setPmTarget?: (v: { userId: number; nickname: string } | null) => void;
  enabledChats?: { sector: boolean; global: boolean; private: boolean; system: boolean };
  chatPosition?: { x: number; y: number };
  setChatPosition?: (pos: { x: number; y: number }) => void;
  chatSize?: { width: number; height: number };
  setChatSize?: (size: { width: number; height: number }) => void;
  chatOpacity?: number;
  setChatOpacity?: (opacity: number) => void;
}

/**
 * Нативный компонент чата
 */
export class ChatPanel extends Component {
  private options: ChatPanelOptions;
  private input: Input | null = null;
  private sendButton: Button | null = null;
  private messageList: HTMLElement | null = null;
  private scopeButtons: Map<string, HTMLElement> = new Map();
  private timerInterval: number | null = null;
  private emitter: EventEmitter;

  constructor(parent: HTMLElement | null, options: ChatPanelOptions = {}) {
    super(parent);
    this.options = {
      scope: 'sector',
      messages: [],
      chatInput: '',
      onScopeChange: () => {},
      onChatInputChange: () => {},
      onSend: () => {},
      currentUserId: null,
      privateThreads: {},
      selectedPrivateUserId: null,
      setSelectedPrivateUserId: () => {},
      pmTarget: null,
      setPmTarget: () => {},
      enabledChats: { sector: true, global: true, private: true, system: true },
      chatPosition: { x: 20, y: 20 },
      setChatPosition: () => {},
      chatSize: { width: 320, height: 400 },
      setChatSize: () => {},
      chatOpacity: 1,
      setChatOpacity: () => {},
      ...options,
    };
    this.emitter = new EventEmitter();
    this.init();
  }

  protected createRootElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'native-chat-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.left = this.options.chatPosition!.x + 'px';
    wrapper.style.top = this.options.chatPosition!.y + 'px';
    wrapper.style.width = this.options.chatSize!.width + 'px';

    const card = document.createElement('div');
    card.className = 'native-chat-card';

    // Заголовок с вкладками
    const header = document.createElement('div');
    header.className = 'native-chat-header';

    const scopes: ('sector' | 'global' | 'private' | 'system')[] = ['sector', 'global', 'private', 'system'];
    scopes.forEach(scope => {
      const button = document.createElement('button');
      button.className = `native-chat-scope-btn ${scope === this.options.scope ? 'native-chat-scope-active' : ''}`;
      button.textContent = this.getScopeLabel(scope);
      button.onclick = () => {
        this.setScope(scope);
      };
      header.appendChild(button);
      this.scopeButtons.set(scope, button);
    });

    card.appendChild(header);

    // Список сообщений
    this.messageList = document.createElement('div');
    this.messageList.className = 'native-chat-list';
    card.appendChild(this.messageList);

    // Ввод сообщения
    const inputContainer = document.createElement('div');
    inputContainer.className = 'native-chat-input-container';

    this.input = new Input(null, {
      type: 'text',
      placeholder: 'Введите сообщение...',
      value: this.options.chatInput,
      className: 'native-chat-input',
      onChange: (value) => this.options.onChatInputChange?.(value),
    });

    this.sendButton = new Button(null, {
      text: 'Отпр.',
      className: 'native-chat-send',
      onClick: () => this.handleSend(),
      disabled: this.options.scope === 'system',
    });

    inputContainer.appendChild(this.input.getElement());
    inputContainer.appendChild(this.sendButton.getElement());
    card.appendChild(inputContainer);

    wrapper.appendChild(card);
    return wrapper;
  }

  protected render(): void {
    // Обновить список сообщений
    if (this.messageList) {
      this.messageList.innerHTML = '';
      
      (this.options.messages ?? []).forEach(message => {
        const msgEl = document.createElement('div');
        msgEl.className = `native-chat-message native-chat-${message.scope}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'native-chat-name';
        nameSpan.textContent = message.nickname + ':';
        msgEl.appendChild(nameSpan);
        
        const textSpan = document.createElement('span');
        textSpan.className = 'native-chat-text';
        textSpan.textContent = ' ' + message.text;
        msgEl.appendChild(textSpan);
        
        this.messageList!.appendChild(msgEl);
      });

      this.messageList!.scrollTop = this.messageList!.scrollHeight;
    }

    if (this.input && this.options.chatInput !== undefined) {
      this.input.setValue(this.options.chatInput);
      if (this.options.scope === 'system') {
        this.input.setDisabled(true);
      } else {
        this.input.setDisabled(false);
      }
    }

    if (this.sendButton) {
      this.sendButton.setDisabled(this.options.scope === 'system');
    }

    this.updateScopeButtons();

    if (this.timerInterval === null) {
      this.timerInterval = window.setInterval(() => this.render(), 1000);
    }
  }

  protected attachEventListeners(): void {
  }

  protected detachEventListeners(): void {
  }

  private getScopeLabel(scope: string): string {
    const labels: Record<string, string> = {
      sector: 'Сектор',
      global: 'Глобал',
      private: 'Личка',
      system: 'Система',
    };
    return labels[scope] || scope;
  }

  private setScope(scope: 'sector' | 'global' | 'private' | 'system'): void {
    if (this.options.scope === scope) return;
    
    this.options.scope = scope;
    this.options.onScopeChange?.(scope);
    this.updateScopeButtons();
    this.render();
  }

  private updateScopeButtons(): void {
    this.scopeButtons.forEach((btn, scope) => {
      if (scope === this.options.scope) {
        btn.classList.add('native-chat-scope-active');
      } else {
        btn.classList.remove('native-chat-scope-active');
      }
    });
  }

  private handleSend(): void {
    if (this.options.scope === 'system') return;
    if (!this.options.chatInput || this.options.chatInput.trim() === '') return;
    
    this.options.onSend?.(
      this.options.selectedPrivateUserId ?? undefined,
      this.options.chatInput
    );
    
    if (this.input) {
      this.input.clear();
    }
    if (this.options.onChatInputChange) {
      this.options.onChatInputChange('');
    }
  }

  public setMessages(messages: ChatMessageItem[]): void {
    this.options.messages = messages;
    this.render();
  }

  public setInputText(text: string): void {
    this.options.chatInput = text;
    this.render();
  }

  public setLoading(loading: boolean): void {
    if (this.sendButton) {
      this.sendButton.setDisabled(loading);
    }
  }

  public on(eventType: string, callback: (event: any) => void): () => void {
    return this.emitter.on(eventType, callback);
  }

  public destroy(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    super.destroy();
  }
}