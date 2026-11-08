export type ChatMessageItem = {
  id: string;
  userId: number;
  nickname: string;
  text: string;
  createdAt: number;
  /** Set for private messages: recipient user id */
  targetUserId?: number | null;
  /** Message scope: sector, global, private, or system */
  scope?: "sector" | "global" | "private" | "system";
};

export type KeeperKey = "keeper19" | "keeper20";

export type KeeperFormDisplay = {
  name: string;
  level: number;
  hp: number;
  dmg: number;
  spd: number;
};
