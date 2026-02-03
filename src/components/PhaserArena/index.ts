export { ASSETS } from "./assets";
export { createSpaceArenaAnimations } from "./animations";
export * from "./constants";
export { setupMobileControls, isTouchDevice } from "./mobileControls";
export type { MobileControlsState } from "./mobileControls";
export { MONSTER_DEFS, PLAYER_MONSTER_CHOICES } from "./monsterDefs";
export * from "./types";
export * from "./utils";
export {
  connectSocket,
  handlePresencePayload,
  handleWorldPayload,
  sendWorldAction,
} from "./socketHandlers";
export type {
  PresenceEntry,
  PresencePayloadContext,
  WorldPayloadContext,
  ConnectSocketContext,
} from "./socketHandlers";
export {
  queueRemoteSnapshot,
  upsertRemotePlayer,
  updateRemoteHealthBar,
  interpolateRemotePlayers,
} from "./remotePlayers";
export type {
  RemoteSnapshotEntry,
  QueueRemoteSnapshotEntry,
  UpsertRemotePlayerEntry,
  RemotePlayerEntry,
  QueueRemoteSnapshotContext,
  UpsertRemotePlayerContext,
  InterpolateRemotePlayersContext,
} from "./remotePlayers";
