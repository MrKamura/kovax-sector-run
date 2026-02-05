"use client";

import { useRef, useEffect, useState, startTransition } from "react";
import type { ChatMessageItem } from "../types";
import styles from "../page.module.css";

const SYSTEM_NICKNAME = "Система";

type ChatPanelProps = {
  scope: "sector" | "global" | "private" | "system";
  onScopeChange: (scope: "sector" | "global" | "private" | "system") => void;
  messages: ChatMessageItem[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSend: (privateTargetUserId?: number, textOverride?: string) => void;
  chatListRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  currentUserId: number | null;
  privateThreads: Record<number, ChatMessageItem[]>;
  selectedPrivateUserId: number | null;
  setSelectedPrivateUserId: (userId: number | null) => void;
  requestPrivateHistory: (userId: number) => void;
  pmTarget: { userId: number; nickname: string } | null;
  setPmTarget: (v: { userId: number; nickname: string } | null) => void;
  enabledChats: { sector: boolean; global: boolean; private: boolean; system: boolean };
  setEnabledChats: (chats: { sector: boolean; global: boolean; private: boolean; system: boolean }) => void;
  chatPosition: { x: number; y: number };
  setChatPosition: (pos: { x: number; y: number }) => void;
  chatSize: { width: number; height: number };
  setChatSize: (size: { width: number; height: number }) => void;
  chatOpacity: number;
  setChatOpacity: (opacity: number) => void;
};

export function ChatPanel({
  scope,
  onScopeChange,
  messages,
  chatInput,
  onChatInputChange,
  onSend,
  chatListRef,
  chatInputRef,
  currentUserId,
  privateThreads,
  selectedPrivateUserId,
  setSelectedPrivateUserId,
  requestPrivateHistory,
  pmTarget,
  setPmTarget,
  enabledChats,
  setEnabledChats,
  chatPosition,
  setChatPosition,
  chatSize,
  setChatSize,
  chatOpacity,
  setChatOpacity,
}: ChatPanelProps) {
  const pmInputRef = useRef<HTMLInputElement | null>(null);
  const [pmDraft, setPmDraft] = useState("");
  const pmMenuRef = useRef<HTMLDivElement | null>(null);
  const [chatFilterOpen, setChatFilterOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [opacityMenuOpen, setOpacityMenuOpen] = useState(false);
  const opacityMenuRef = useRef<HTMLDivElement | null>(null);
  const prevPmTargetRef = useRef<{ userId: number; nickname: string } | null>(null);

  // Проверка и корректировка позиции чата при монтировании и изменении размера окна
  useEffect(() => {
    const clampPosition = () => {
      const currentPos = chatPosition ?? { x: 20, y: 20 };
      const currentSize = chatSize ?? { width: 320, height: 400 };
      const maxX = window.innerWidth - currentSize.width;
      const maxY = window.innerHeight - currentSize.height;
      const clampedX = Math.max(0, Math.min(maxX, currentPos.x));
      const clampedY = Math.max(0, Math.min(maxY, currentPos.y));
      
      if (clampedX !== currentPos.x || clampedY !== currentPos.y) {
        setChatPosition({ x: clampedX, y: clampedY });
      }
    };

    clampPosition();
    window.addEventListener("resize", clampPosition);
    return () => window.removeEventListener("resize", clampPosition);
  }, [chatPosition, chatSize, setChatPosition]);

  useEffect(() => {
    if (pmTarget && prevPmTargetRef.current?.userId !== pmTarget.userId) {
      prevPmTargetRef.current = pmTarget;
      startTransition(() => {
        setPmDraft("");
      });
      setTimeout(() => pmInputRef.current?.focus(), 0);
    } else if (!pmTarget) {
      prevPmTargetRef.current = null;
    }
  }, [pmTarget]);

  // Автоматическая прокрутка чата вниз при появлении новых сообщений
  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    // Используем requestAnimationFrame для гарантии, что DOM обновлен
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, chatListRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement)?.closest(`.${styles.chatFilterButton}`)
      ) {
        setChatFilterOpen(false);
      }
      if (
        opacityMenuRef.current &&
        !opacityMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement)?.closest(`.${styles.chatOpacityButton}`)
      ) {
        setOpacityMenuOpen(false);
      }
      if (
        pmMenuRef.current &&
        !pmMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement)?.closest(`.${styles.chatNameButton}`)
      ) {
        setPmTarget(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pmTarget, opacityMenuOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const currentPos = chatPosition ?? { x: 20, y: 20 };
        const currentSize = chatSize ?? { width: 320, height: 400 };
        const newX = currentPos.x + e.clientX - dragStartRef.current.x;
        const newY = currentPos.y + e.clientY - dragStartRef.current.y;
        const maxX = window.innerWidth - currentSize.width;
        const maxY = window.innerHeight - currentSize.height;
        setChatPosition({
          x: Math.max(0, Math.min(maxX, newX)),
          y: Math.max(0, Math.min(maxY, newY)),
        });
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (isResizing && resizeStartRef.current) {
        const currentPos = chatPosition ?? { x: 20, y: 20 };
        const currentSize = chatSize ?? { width: 320, height: 400 };
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        const minWidth = 250;
        const minHeight = 200;
        const maxWidth = window.innerWidth - currentPos.x;
        const maxHeight = window.innerHeight - currentPos.y;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, currentSize.width + deltaX));
        const newHeight = Math.max(minHeight, Math.min(maxHeight, currentSize.height - deltaY));
        const heightDelta = newHeight - currentSize.height;
        setChatSize({
          width: newWidth,
          height: newHeight,
        });
        // При изменении высоты корректируем позицию Y, чтобы чат растягивался вверх
        setChatPosition({
          x: currentPos.x,
          y: Math.max(0, currentPos.y - heightDelta),
        });
        // Обновляем начальные значения для следующего движения
        resizeStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          width: newWidth,
          height: newHeight,
        };
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      dragStartRef.current = null;
      resizeStartRef.current = null;
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, chatPosition, chatSize, setChatPosition, setChatSize]);

  const handleDragStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.chatResizeHandle}`)) return;
    if (target.closest(`button, input, a, label`)) return;
    if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "A" || target.tagName === "LABEL") return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const currentSize = chatSize ?? { width: 320, height: 400 };
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: currentSize.width,
      height: currentSize.height,
    };
  };

  const privateUserIds = Object.keys(privateThreads).map(Number).filter((id) => id !== currentUserId);
  const getOtherNickname = (userId: number): string => {
    const thread = privateThreads[userId] ?? [];
    const otherMsg = thread.find((m) => m.userId !== currentUserId);
    return otherMsg?.nickname ?? `Игрок ${userId}`;
  };

  const handleSendPmFromMenu = () => {
    const text = pmDraft.trim();
    if (!text || !pmTarget) return;
    onSend(pmTarget.userId, text);
    setPmDraft("");
    setPmTarget(null);
    onScopeChange("private");
    setSelectedPrivateUserId(pmTarget.userId);
    requestPrivateHistory(pmTarget.userId);
  };

  const getMessageScope = (message: ChatMessageItem): "sector" | "global" | "private" | "system" => {
    if (message.scope) return message.scope;
    if (message.targetUserId != null) return "private";
    if (message.nickname === SYSTEM_NICKNAME) return "system";
    return "sector";
  };

  const getMessageColorClass = (scope: "sector" | "global" | "private" | "system"): string => {
    switch (scope) {
      case "private":
        return styles.chatMessagePrivate;
      case "system":
        return styles.chatMessageSystem;
      case "sector":
        return styles.chatMessageSector;
      case "global":
      default:
        return "";
    }
  };

  const safePosition = chatPosition ?? { x: 20, y: 20 };
  const safeSize = chatSize ?? { width: 320, height: 400 };
  const safeOpacity = chatOpacity ?? 0.92;

  const panelStyle = {
    left: `${safePosition.x}px`,
    top: `${safePosition.y}px`,
    width: `${safeSize.width}px`,
    height: `${safeSize.height}px`,
    backgroundColor: `rgba(12, 16, 22, ${safeOpacity})`,
  };

  return (
    <div
      ref={chatPanelRef}
      className={styles.chatPanel}
      style={panelStyle}
    >
      <div className={styles.chatHeader} onMouseDown={handleDragStart} style={{ cursor: isDragging ? "grabbing" : "grab" }}>
        <span>Онлайн чат</span>
        <div className={styles.chatHeaderRight}>
          {selectedPrivateUserId != null && (
            <div className={styles.chatPrivateBack}>
              <button
                type="button"
                className={styles.chatPrivateBackBtn}
                onClick={() => setSelectedPrivateUserId(null)}
              >
                ← Все
              </button>
              <span className={styles.chatPrivateWith}>{getOtherNickname(selectedPrivateUserId)}</span>
            </div>
          )}
          <div className={styles.chatHeaderControls}>
            <div className={styles.chatOpacityContainer}>
              <button
                type="button"
                className={styles.chatOpacityButton}
                onClick={() => setOpacityMenuOpen(!opacityMenuOpen)}
                title="Прозрачность чата"
              >
                ◐
              </button>
              {opacityMenuOpen && (
                <div className={styles.chatOpacityMenu} ref={opacityMenuRef}>
                  <div className={styles.chatOpacitySliderContainer}>
                    <label className={styles.chatOpacityLabel}>
                      Прозрачность: {Math.round(safeOpacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={safeOpacity}
                      onChange={(e) => setChatOpacity(Number(e.target.value))}
                      className={styles.chatOpacitySlider}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className={styles.chatFilterContainer}>
              <button
                type="button"
                className={styles.chatFilterButton}
                onClick={() => setChatFilterOpen(!chatFilterOpen)}
                title="Фильтр чатов"
              >
                ⚙
              </button>
              {chatFilterOpen && (
                <div className={styles.chatFilterMenu} ref={filterMenuRef}>
                  <div className={styles.chatFilterMenuItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={enabledChats.sector}
                        onChange={(e) => setEnabledChats({ ...enabledChats, sector: e.target.checked })}
                      />
                      <span className={styles.chatFilterLabelSector}>Сектор</span>
                    </label>
                  </div>
                  <div className={styles.chatFilterMenuItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={enabledChats.global}
                        onChange={(e) => setEnabledChats({ ...enabledChats, global: e.target.checked })}
                      />
                      <span>Глобальный</span>
                    </label>
                  </div>
                  <div className={styles.chatFilterMenuItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={enabledChats.private}
                        onChange={(e) => setEnabledChats({ ...enabledChats, private: e.target.checked })}
                      />
                      <span className={styles.chatFilterLabelPrivate}>Личные</span>
                    </label>
                  </div>
                  <div className={styles.chatFilterMenuItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={enabledChats.system}
                        onChange={(e) => setEnabledChats({ ...enabledChats, system: e.target.checked })}
                      />
                      <span className={styles.chatFilterLabelSystem}>Система</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.chatTabs}>
        <button
          type="button"
          className={scope === "sector" ? styles.chatTabActive : styles.chatTab}
          onClick={() => onScopeChange("sector")}
        >
          Сектор
        </button>
        <button
          type="button"
          className={scope === "global" ? styles.chatTabActive : styles.chatTab}
          onClick={() => onScopeChange("global")}
        >
          Глобальный
        </button>
        <button
          type="button"
          className={scope === "private" ? styles.chatTabActive : styles.chatTab}
          onClick={() => onScopeChange("private")}
        >
          Личные
        </button>
        <button
          type="button"
          className={scope === "system" ? styles.chatTabActive : styles.chatTab}
          onClick={() => onScopeChange("system")}
        >
          Система
        </button>
      </div>

      {enabledChats.private && !selectedPrivateUserId && privateUserIds.length > 0 && (
        <div className={styles.chatPrivateList}>
          <ul className={styles.chatPrivateConversations}>
            {privateUserIds.map((userId) => (
              <li key={userId}>
                <button
                  type="button"
                  className={styles.chatPrivateConversationBtn}
                  onClick={() => {
                    setSelectedPrivateUserId(userId);
                    requestPrivateHistory(userId);
                  }}
                >
                  {getOtherNickname(userId)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.chatMessages} ref={chatListRef} style={{ flex: 1, minHeight: 0 }}>
        {messages.length === 0 ? (
          <div className={styles.chatEmpty}>Нет сообщений. Включите чаты в фильтре.</div>
        ) : (
          messages.map((message) => {
            const messageScope = getMessageScope(message);
            const isRealPlayer = message.userId !== currentUserId && message.nickname !== SYSTEM_NICKNAME;
            const showButton = messageScope !== "private" && messageScope !== "system" && isRealPlayer;
            return (
              <div
                className={`${styles.chatMessage} ${getMessageColorClass(messageScope)}`}
                key={message.id}
              >
                {showButton ? (
                  <button
                    type="button"
                    className={styles.chatNameButton}
                    onClick={() => setPmTarget({ userId: message.userId, nickname: message.nickname })}
                    title="Написать в личку"
                  >
                    {message.nickname}:
                  </button>
                ) : (
                  <span className={styles.chatName}>{message.nickname}:</span>
                )}
                {" "}
                {message.text}
              </div>
            );
          })
        )}
      </div>

      {pmTarget && (
        <div className={styles.chatPmMenu} ref={pmMenuRef}>
          <div className={styles.chatPmMenuHeader}>
            Личное сообщение для {pmTarget.nickname}
            <button
              type="button"
              className={styles.chatPmMenuClose}
              onClick={() => setPmTarget(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <div className={styles.chatPmMenuInputRow}>
            <input
              ref={pmInputRef}
              type="text"
              className={styles.chatInput}
              value={pmDraft}
              onChange={(e) => setPmDraft(e.target.value)}
              placeholder="Введите сообщение..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSendPmFromMenu();
                }
                if (e.key === "Escape") setPmTarget(null);
              }}
            />
            <button type="button" className={styles.chatSend} onClick={handleSendPmFromMenu}>
              Отпр.
            </button>
          </div>
        </div>
      )}

      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          ref={chatInputRef}
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder={
            selectedPrivateUserId
              ? "Личное сообщение..."
              : scope === "sector"
                ? "Сообщение в сектор..."
                : scope === "global"
                  ? "Глобальное сообщение..."
                  : "Введите сообщение..."
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button type="button" className={styles.chatSend} onClick={() => onSend()}>
          Отпр.
        </button>
      </div>
      <div
        className={styles.chatResizeHandle}
        onMouseDown={handleResizeStart}
        style={{ cursor: "nesw-resize" }}
        title="Изменить размер"
      />
    </div>
  );
}
