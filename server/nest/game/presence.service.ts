import { Injectable } from "@nestjs/common";
import type { PresenceEntry } from "./types";
import type { GameSocket } from "./types";

@Injectable()
export class PresenceService {
  readonly presence = new Map<number, PresenceEntry>();
  readonly clients = new Map<number, Set<GameSocket>>();

  getEntry(userId: number): PresenceEntry | undefined {
    return this.presence.get(userId);
  }

  setEntry(userId: number, entry: PresenceEntry): void {
    this.presence.set(userId, entry);
  }

  getSectorPlayerCount(sectorId: string): number {
    return Array.from(this.presence.values()).filter((e) => e.sectorId === sectorId).length;
  }

  addClient(userId: number, socket: GameSocket): void {
    let set = this.clients.get(userId);
    if (!set) {
      set = new Set();
      this.clients.set(userId, set);
    }
    set.add(socket);
  }

  removeClient(userId: number, socket: GameSocket): boolean {
    const set = this.clients.get(userId);
    if (!set) return false;
    set.delete(socket);
    if (set.size === 0) {
      this.clients.delete(userId);
      return true;
    }
    this.clients.set(userId, set);
    return false;
  }

  getSockets(userId: number): Set<GameSocket> | undefined {
    return this.clients.get(userId);
  }

  hasClient(userId: number): boolean {
    return this.clients.has(userId);
  }
}
