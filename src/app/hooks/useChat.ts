"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessageItem } from "../types";

export function useChat(
  isActive: boolean
): {
  sectorMessages: ChatMessageItem[];
  globalMessages: ChatMessageItem[];
  chatScope: "sector" | "global";
  setChatScope: (scope: "sector" | "global") => void;
  chatInput: string;
  setChatInput: (v: string) => void;
  sendChat: () => void;
  chatListRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  activeMessages: ChatMessageItem[];
} {
  const [sectorMessages, setSectorChatMessages] = useState<ChatMessageItem[]>([]);
  const [globalMessages, setGlobalChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatScope, setChatScope] = useState<"sector" | "global">("sector");
  const [chatInput, setChatInput] = useState("");
  const chatSocketRef = useRef<WebSocket | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

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
          scope?: "sector" | "global";
          messages?: ChatMessageItem[];
          message?: ChatMessageItem;
        };
        if (payload.type === "chat_history" && payload.messages) {
          if (payload.scope === "global") {
            setGlobalChatMessages(payload.messages.slice(-50));
          } else {
            setSectorChatMessages(payload.messages.slice(-50));
          }
        }
        if (payload.type === "chat_message" && payload.message) {
          const message = payload.message;
          if (payload.scope === "global") {
            setGlobalChatMessages((prev) => [...prev.slice(-49), message]);
          } else {
            setSectorChatMessages((prev) => [...prev.slice(-49), message]);
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
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 60) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sectorMessages, globalMessages, chatScope]);

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    const socket = chatSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "chat_message", text, scope: chatScope }));
    setChatInput("");
    chatInputRef.current?.blur();
  }, [chatInput, chatScope]);

  const activeMessages = chatScope === "global" ? globalMessages : sectorMessages;

  return {
    sectorMessages,
    globalMessages,
    chatScope,
    setChatScope,
    chatInput,
    setChatInput,
    sendChat,
    chatListRef,
    chatInputRef,
    activeMessages,
  };
}
