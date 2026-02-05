"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessageItem } from "../types";

let saveChatSettingsTimer: number | null = null;
const scheduleSaveChatSettings = (settings: {
  chatPosition?: { x: number; y: number };
  chatSize?: { width: number; height: number };
  chatOpacity?: number;
}) => {
  if (typeof window === "undefined") {
    return;
  }
  if (saveChatSettingsTimer) {
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

export function useChat(
  isActive: boolean,
  currentUserId: number | null
): {
  sectorMessages: ChatMessageItem[];
  globalMessages: ChatMessageItem[];
  privateThreads: Record<number, ChatMessageItem[]>;
  chatScope: "sector" | "global" | "private" | "system";
  setChatScope: (scope: "sector" | "global" | "private" | "system") => void;
  enabledChats: { sector: boolean; global: boolean; private: boolean; system: boolean };
  setEnabledChats: (chats: { sector: boolean; global: boolean; private: boolean; system: boolean }) => void;
  selectedPrivateUserId: number | null;
  setSelectedPrivateUserId: (userId: number | null) => void;
  chatInput: string;
  setChatInput: (v: string) => void;
  sendChat: (privateTargetUserId?: number, textOverride?: string) => void;
  requestPrivateHistory: (targetUserId: number) => void;
  chatListRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  activeMessages: ChatMessageItem[];
  pmTarget: { userId: number; nickname: string } | null;
  setPmTarget: (v: { userId: number; nickname: string } | null) => void;
  chatPosition: { x: number; y: number };
  setChatPosition: (pos: { x: number; y: number }) => void;
  chatSize: { width: number; height: number };
  setChatSize: (size: { width: number; height: number }) => void;
  chatOpacity: number;
  setChatOpacity: (opacity: number) => void;
} {
  const [sectorMessages, setSectorChatMessages] = useState<ChatMessageItem[]>([]);
  const [globalMessages, setGlobalChatMessages] = useState<ChatMessageItem[]>([]);
  const [privateThreads, setPrivateThreads] = useState<Record<number, ChatMessageItem[]>>({});
  const [chatScope, setChatScope] = useState<"sector" | "global" | "private" | "system">("sector");
  const [enabledChats, setEnabledChats] = useState({ sector: true, global: true, private: true, system: true });
  const [selectedPrivateUserId, setSelectedPrivateUserId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [pmTarget, setPmTarget] = useState<{ userId: number; nickname: string } | null>(null);
  const chatSocketRef = useRef<WebSocket | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const currentUserIdRef = useRef(currentUserId);

  const [chatPosition, setChatPositionState] = useState(() => {
    if (typeof window === "undefined") return { x: 20, y: 20 };
    const stored = localStorage.getItem("chatPosition");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { x: Number(parsed.x) || 20, y: Number(parsed.y) || 20 };
      } catch {
        return { x: 20, y: 20 };
      }
    }
    return { x: 20, y: 20 };
  });

  const [chatSize, setChatSizeState] = useState(() => {
    if (typeof window === "undefined") return { width: 320, height: 400 };
    const stored = localStorage.getItem("chatSize");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { width: Number(parsed.width) || 320, height: Number(parsed.height) || 400 };
      } catch {
        return { width: 320, height: 400 };
      }
    }
    return { width: 320, height: 400 };
  });

  const [chatOpacity, setChatOpacityState] = useState(() => {
    if (typeof window === "undefined") return 0.92;
    const stored = localStorage.getItem("chatOpacity");
    if (stored) {
      try {
        const parsed = Number(stored);
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.92;
      } catch {
        return 0.92;
      }
    }
    return 0.92;
  });

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Загрузка настроек из БД при инициализации
  useEffect(() => {
    if (!currentUserId || settingsLoaded || typeof window === "undefined") return;
    
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.id) {
          // Загружаем настройки чата из БД через отдельный запрос
          // (так как /api/auth/me пока не возвращает настройки чата)
          // Используем localStorage как fallback, если БД пуста
          const dbPosX = data.user.chatPositionX;
          const dbPosY = data.user.chatPositionY;
          const dbWidth = data.user.chatWidth;
          const dbHeight = data.user.chatHeight;
          const dbOpacity = data.user.chatOpacity;

          if (dbPosX != null && dbPosY != null) {
            setChatPositionState({ x: dbPosX, y: dbPosY });
            localStorage.setItem("chatPosition", JSON.stringify({ x: dbPosX, y: dbPosY }));
          }
          if (dbWidth != null && dbHeight != null) {
            setChatSizeState({ width: dbWidth, height: dbHeight });
            localStorage.setItem("chatSize", JSON.stringify({ width: dbWidth, height: dbHeight }));
          }
          if (dbOpacity != null) {
            setChatOpacityState(dbOpacity);
            localStorage.setItem("chatOpacity", String(dbOpacity));
          }
        }
        setSettingsLoaded(true);
      })
      .catch(() => {
        setSettingsLoaded(true);
      });
  }, [currentUserId, settingsLoaded]);

  const setChatPosition = useCallback((pos: { x: number; y: number }) => {
    setChatPositionState(pos);
    localStorage.setItem("chatPosition", JSON.stringify(pos));
    if (currentUserId) {
      scheduleSaveChatSettings({ chatPosition: pos });
    }
  }, [currentUserId]);

  const setChatSize = useCallback((size: { width: number; height: number }) => {
    setChatSizeState(size);
    localStorage.setItem("chatSize", JSON.stringify(size));
    if (currentUserId) {
      scheduleSaveChatSettings({ chatSize: size });
    }
  }, [currentUserId]);

  const setChatOpacity = useCallback((opacity: number) => {
    const clamped = Math.max(0, Math.min(1, opacity));
    setChatOpacityState(clamped);
    localStorage.setItem("chatOpacity", String(clamped));
    if (currentUserId) {
      scheduleSaveChatSettings({ chatOpacity: clamped });
    }
  }, [currentUserId]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("chatPosition");
    if (!stored) {
      setChatPosition({ x: 20, y: window.innerHeight - chatSize.height - 20 });
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socketUrl = `${protocol}://${window.location.host}/ws`;
    const socket = new WebSocket(socketUrl);
    chatSocketRef.current = socket;

    socket.onmessage = (event) => {
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
            setGlobalChatMessages(
              payload.messages.slice(-50).map((m) => ({ ...m, scope: m.nickname === "Система" ? "system" : "global" }))
            );
          } else if (payload.scope === "private" && payload.targetUserId != null) {
            setPrivateThreads((prev) => ({
              ...prev,
              [payload.targetUserId!]: payload.messages!.slice(-50).map((m) => ({ ...m, scope: "private" as const })),
            }));
          } else {
            setSectorChatMessages(payload.messages.slice(-50).map((m) => ({ ...m, scope: "sector" as const })));
          }
        }
        if (payload.type === "chat_message" && payload.message) {
          const message = payload.message;
          if (payload.scope === "global") {
            const scope = message.nickname === "Система" ? ("system" as const) : ("global" as const);
            setGlobalChatMessages((prev) => [...prev.slice(-49), { ...message, scope }]);
          } else if (payload.scope === "private" && message.targetUserId != null) {
            const me = currentUserIdRef.current;
            const other = me != null && message.userId === me ? message.targetUserId! : message.userId;
            setPrivateThreads((prev) => ({
              ...prev,
              [other]: [
                ...(prev[other] ?? []).slice(-49),
                { ...message, targetUserId: message.targetUserId ?? undefined, scope: "private" as const },
              ],
            }));
          } else {
            setSectorChatMessages((prev) => [...prev.slice(-49), { ...message, scope: "sector" as const }]);
          }
        }
      } catch {
        // ignore invalid payload
      }
    };

    return () => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    };
  }, [isActive]);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    // Всегда прокручиваем вниз при появлении новых сообщений
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [sectorMessages, globalMessages, chatScope, privateThreads, selectedPrivateUserId, enabledChats]);

  const sendChat = useCallback(
    (privateTargetUserId?: number, textOverride?: string) => {
      const text = (textOverride != null ? textOverride : chatInput).trim();
      if (!text) return;
      const socket = chatSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (chatScope === "private" || privateTargetUserId != null) {
        const targetId = privateTargetUserId ?? selectedPrivateUserId;
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
        socket.send(JSON.stringify({ type: "chat_message", text, scope: chatScope }));
      }
      if (textOverride == null) {
        setChatInput("");
        chatInputRef.current?.blur();
      }
    },
    [chatInput, chatScope, selectedPrivateUserId]
  );

  const requestPrivateHistory = useCallback((targetUserId: number) => {
    const socket = chatSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "chat_history_request", scope: "private", targetUserId }));
    }
  }, []);

  const SYSTEM_NICKNAME = "Система";
  const allPrivateMessages = Object.values(privateThreads).flat();
  const combinedMessages: ChatMessageItem[] = [
    ...(enabledChats.sector ? sectorMessages : []),
    ...(enabledChats.global ? globalMessages.filter((m) => m.scope === "global") : []),
    ...(enabledChats.system ? globalMessages.filter((m) => m.scope === "system") : []),
    ...(enabledChats.private
      ? selectedPrivateUserId != null
        ? privateThreads[selectedPrivateUserId] ?? []
        : allPrivateMessages
      : []),
  ].sort((a, b) => a.createdAt - b.createdAt);

  const activeMessages = combinedMessages;

  return {
    sectorMessages,
    globalMessages,
    privateThreads,
    chatScope,
    setChatScope,
    enabledChats,
    setEnabledChats,
    selectedPrivateUserId,
    setSelectedPrivateUserId,
    chatInput,
    setChatInput,
    sendChat,
    requestPrivateHistory,
    chatListRef,
    chatInputRef,
    activeMessages,
    pmTarget,
    setPmTarget,
    chatPosition,
    setChatPosition,
    chatSize,
    setChatSize,
    chatOpacity,
    setChatOpacity,
  };
}
