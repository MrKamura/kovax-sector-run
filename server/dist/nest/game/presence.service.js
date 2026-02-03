"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceService = void 0;
const common_1 = require("@nestjs/common");
let PresenceService = class PresenceService {
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
};
exports.PresenceService = PresenceService;
exports.PresenceService = PresenceService = __decorate([
    (0, common_1.Injectable)()
], PresenceService);
