export type ChatMessageItem = {
  id: string;
  userId: number;
  nickname: string;
  text: string;
  createdAt: number;
};

export type KeeperKey = "keeper19" | "keeper20";

export type KeeperFormDisplay = {
  name: string;
  level: number;
  hp: number;
  dmg: number;
  spd: number;
};
