"use client";

import type { ChatMessageItem } from "../types";
import styles from "../page.module.css";

type ChatPanelProps = {
  scope: "sector" | "global";
  onScopeChange: (scope: "sector" | "global") => void;
  messages: ChatMessageItem[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSend: () => void;
  chatListRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
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
}: ChatPanelProps) {
  return (
    <div
      className={`${styles.chatPanel} ${
        scope === "global" ? styles.chatPanelGlobal : styles.chatPanelSector
      }`}
    >
      <div className={styles.chatHeader}>
        <span>Онлайн чат</span>
        <div className={styles.chatTabs}>
          <button
            type="button"
            className={`${styles.chatTab} ${
              scope === "sector" ? styles.chatTabActive : ""
            }`}
            onClick={() => onScopeChange("sector")}
          >
            Сектор
          </button>
          <button
            type="button"
            className={`${styles.chatTab} ${
              scope === "global" ? styles.chatTabActive : ""
            }`}
            onClick={() => onScopeChange("global")}
          >
            Глобальный
          </button>
        </div>
      </div>
      <div className={styles.chatMessages} ref={chatListRef}>
        {messages.map((message) => (
          <div className={styles.chatMessage} key={message.id}>
            <span className={styles.chatName}>{message.nickname}:</span>{" "}
            {message.text}
          </div>
        ))}
      </div>
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          ref={chatInputRef}
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder="Введите сообщение..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button type="button" className={styles.chatSend} onClick={onSend}>
          Отпр.
        </button>
      </div>
    </div>
  );
}
