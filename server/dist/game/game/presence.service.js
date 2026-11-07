"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceService = void 0;
class PresenceService {
    constructor() {
        this.presence = new Map();
        this.clients = new Map();
    }
    getEntry(userId) {
        return this.presence.get(userId);
    }
    setEntry(userId, entry) {
        this.presence.set(userId, entry);
    }
    getSectorPlayerCount(sectorId) {
        return Array.from(this.presence.values()).filter((e) => e.sectorId === sectorId).length;
    }
    addClient(userId, socket) {
        let set = this.clients.get(userId);
        if (!set) {
            set = new Set();
            this.clients.set(userId, set);
        }
        set.add(socket);
    }
    removeClient(userId, socket) {
        const set = this.clients.get(userId);
        if (!set)
            return false;
        set.delete(socket);
        if (set.size === 0) {
            this.clients.delete(userId);
            return true;
        }
        this.clients.set(userId, set);
        return false;
    }
    getSockets(userId) {
        return this.clients.get(userId);
    }
    hasClient(userId) {
        return this.clients.has(userId);
    }
}
exports.PresenceService = PresenceService;
