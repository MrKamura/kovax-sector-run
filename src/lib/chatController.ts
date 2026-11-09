import type { ChatMessageItem } from "../types";

export type ChatScope = "sector" | "global" | "private" | "system";

export type EnabledChats = {
  sector: boolean;
  global: boolean;
  private: boolean;
  system: boolean;
};

export type ChatPosition = { x?: number; y?: number };
export type ChatSize = { width?: number; height?: number };

const SYSTEM_NICKNAME = "Система";

let saveChatSettingsTimer: number | null = null;
const scheduleSaveChatSettings = (settings: {
  chatPosition?: ChatPosition;
  chatSize?: ChatSize;
  chatOpacity?: number;
}) => {
  if (saveChatSettingsTimer != null) {
    window.clearTimeout(saveChatSettingsTimer);
  }
  saveChatSettingsTimer = window.setTimeout(() => {
    saveChatSettingsTimer = null;
    void fetch("/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).catch(() => {
      // ignore network errors; we'll try again on next change
    });
  }, 500);
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Chat state + socket (was useChat). Owns a dedicated WebSocket,
 * message buffers and user-adjustable panel settings.
 */
export class ChatController {
  sectorMessages: ChatMessageItem[] = [];
  globalMessages: ChatMessageItem[] = [];
  privateThreads: Record<number, ChatMessageItem[]> = {};
  chatScope: ChatScope = "sector";
  enabledChats: EnabledChats = {
    sector: true,
    global: true,
    private: true,
    system: true,
  };
  selectedPrivateUserId: number | null = null;
  chatInput = "";
  pmTarget: { userId: number; nickname: string } | null = null;
  chatPosition: ChatPosition = { x: 20, y: 20 };
  chatSize: ChatSize = { width: 320, height: 400 };
  chatOpacity = 0.92;
  currentUserId: number | null = null;
  socket: WebSocket | null = null;

  private settingsLoaded = false;
  private listeners = new Set<() => void>();

  constructor() {
    const storedPos = readJson<Partial<ChatPosition> | null>("chatPosition", null);
    if (storedPos && Number.isFinite(storedPos.x) && Number.isFinite(storedPos.y)) {
      this.chatPosition = { x: storedPos.x, y: storedPos.y };
    } else {
      // No saved position: default to bottom-left corner.
      this.chatPosition = {
        x: 20,
        y: window.innerHeight - (this.chatSize?.height ?? 300) - 20,
      };
      localStorage.setItem("chatPosition", JSON.stringify(this.chatPosition));
    }
    const storedSize = readJson<Partial<ChatSize> | null>("chatSize", null);
    if (storedSize && Number.isFinite(storedSize.width) && Number.isFinite(storedSize.height)) {
      this.chatSize = { width: storedSize.width, height: storedSize.height };
    }
    const storedOpacity = Number(localStorage.getItem("chatOpacity"));
    if (Number.isFinite(storedOpacity) && storedOpacity >= 0 && storedOpacity <= 1) {
      this.chatOpacity = storedOpacity;
    }
  }

  /** Combined, filtered and sorted messages for the active tab. */
  get activeMessages(): ChatMessageItem[] {
    const allPrivateMessages = Object.values(this.privateThreads).flat();
    const combined: ChatMessageItem[] = [
      ...(this.enabledChats.sector ? this.sectorMessages : []),
      ...(this.enabledChats.global
        ? this.globalMessages.filter((m) => m.scope === "global")
        : []),
      ...(this.enabledChats.system
        ? this.globalMessages.filter((m) => m.scope === "system")
        : []),
      ...(this.enabledChats.private
        ? this.selectedPrivateUserId != null
          ? this.privateThreads[this.selectedPrivateUserId] ?? []
          : allPrivateMessages
        : []),
    ];
    return combined.sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Open the chat socket and load persisted settings from the DB. */
  start(currentUserId: number | null): void {
    this.currentUserId = currentUserId;
    this.loadSettings();

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
    this.socket = socket;
    socket.onmessage = (event: MessageEvent) => this.handleMessage(event);
  }

  stop(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private loadSettings(): void {
    if (this.currentUserId == null || this.settingsLoaded) return;
    this.settingsLoaded = true;
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        const user = data?.user;
        if (user?.id) {
          const dbPosX = user.chatPositionX;
          const dbPosY = user.chatPositionY;
          const dbWidth = user.chatWidth;
          const dbHeight = user.chatHeight;
          const dbOpacity = user.chatOpacity;

          if (dbPosX != null && dbPosY != null) {
            this.chatPosition = { x: dbPosX, y: dbPosY };
            localStorage.setItem(
              "chatPosition",
              JSON.stringify(this.chatPosition)
            );
          }
          if (dbWidth != null && dbHeight != null) {
            this.chatSize = { width: dbWidth, height: dbHeight };
            localStorage.setItem("chatSize", JSON.stringify(this.chatSize));
          }
          if (dbOpacity != null) {
            this.chatOpacity = dbOpacity;
            localStorage.setItem("chatOpacity", String(dbOpacity));
          }
        }
        this.notify();
      })
      .catch(() => {
        // keep localStorage values
      });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const payload = JSON.parse(event.data as string) as {
        type: string;
        scope?: "sector" | "global" | "private";
        targetUserId?: number;
        messages?: ChatMessageItem[];
        message?: ChatMessageItem & { targetUserId?: number | null };
      };
      if (payload.type === "chat_history" && payload.messages) {
        if (payload.scope === "global") {
          this.globalMessages = payload.messages
            .slice(-50)
            .map((m) => ({
              ...m,
              scope: m.nickname === SYSTEM_NICKNAME ? "system" : "global",
            }));
        } else if (payload.scope === "private" && payload.targetUserId != null) {
          this.privateThreads = {
            ...this.privateThreads,
            [payload.targetUserId]: payload.messages
              .slice(-50)
              .map((m) => ({ ...m, scope: "private" as const })),
          };
        } else {
          this.sectorMessages = payload.messages
            .slice(-50)
            .map((m) => ({ ...m, scope: "sector" as const }));
        }
        this.notify();
      }
      if (payload.type === "chat_message" && payload.message) {
        const message = payload.message;
        if (payload.scope === "global") {
          const scope: ChatScope =
            message.nickname === SYSTEM_NICKNAME ? "system" : "global";
          this.globalMessages = [
            ...this.globalMessages.slice(-49),
            { ...message, scope },
          ];
        } else if (payload.scope === "private" && message.targetUserId != null) {
          const me = this.currentUserId;
          const other =
            me != null && message.userId === me
              ? message.targetUserId
              : message.userId;
          if (other == null) return;
          this.privateThreads = {
            ...this.privateThreads,
            [other]: [
              ...(this.privateThreads[other] ?? []).slice(-49),
              {
                ...message,
                targetUserId: message.targetUserId ?? undefined,
                scope: "private" as const,
              },
            ],
          };
        } else {
          this.sectorMessages = [
            ...this.sectorMessages.slice(-49),
            { ...message, scope: "sector" as const },
          ];
        }
        this.notify();
      }
    } catch {
      // ignore invalid payload
    }
  }

  setChatScope(scope: ChatScope): void {
    this.chatScope = scope;
    this.notify();
  }

  setEnabledChats(chats: EnabledChats): void {
    this.enabledChats = chats;
    this.notify();
  }

  setSelectedPrivateUserId(userId: number | null): void {
    this.selectedPrivateUserId = userId;
    this.notify();
  }

  setChatInput(value: string): void {
    this.chatInput = value;
  }

  setPmTarget(value: { userId: number; nickname: string } | null): void {
    this.pmTarget = value;
    this.notify();
  }

  setChatPosition(pos: ChatPosition): void {
    this.chatPosition = pos;
    localStorage.setItem("chatPosition", JSON.stringify(pos));
    if (this.currentUserId != null) {
      scheduleSaveChatSettings({ chatPosition: pos });
    }
    this.notify();
  }

  setChatSize(size: ChatSize): void {
    this.chatSize = size;
    localStorage.setItem("chatSize", JSON.stringify(size));
    if (this.currentUserId != null) {
      scheduleSaveChatSettings({ chatSize: size });
    }
    this.notify();
  }

  setChatOpacity(opacity: number): void {
    const clamped = Math.max(0, Math.min(1, opacity));
    this.chatOpacity = clamped;
    localStorage.setItem("chatOpacity", String(clamped));
    if (this.currentUserId != null) {
      scheduleSaveChatSettings({ chatOpacity: clamped });
    }
    this.notify();
  }

  sendChat = (
    privateTargetUserId?: number,
    textOverride?: string,
    chatInputEl?: HTMLInputElement | null
  ): void => {
    const text = (textOverride != null ? textOverride : this.chatInput).trim();
    if (!text) return;
    // Sending messages to the system chat is not allowed
    if (this.chatScope === "system") return;
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (this.chatScope === "private" || privateTargetUserId != null) {
      const targetId = privateTargetUserId ?? this.selectedPrivateUserId;
      if (targetId == null) return;
      socket.send(
        JSON.stringify({
          type: "chat_message",
          text,
          scope: "private",
          targetUserId: targetId,
        })
      );
    } else {
      socket.send(
        JSON.stringify({ type: "chat_message", text, scope: this.chatScope })
      );
    }
    if (textOverride == null) {
      this.chatInput = "";
      chatInputEl?.blur();
      this.notify();
    }
  };

  requestPrivateHistory = (targetUserId: number): void => {
    const socket = this.socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "chat_history_request",
          scope: "private",
          targetUserId,
        })
      );
    }
  };
}

