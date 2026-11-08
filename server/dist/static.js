"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStaticHandler = createStaticHandler;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".txt": "text/plain; charset=utf-8",
    ".wasm": "application/wasm",
};
/**
 * Serves the built client (client-dist/) with SPA fallback to index.html.
 * Used in production only; in dev the Vite middleware serves the UI.
 */
function createStaticHandler(rootDir) {
    const root = path_1.default.normalize(rootDir);
    return (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
            next();
            return;
        }
        let pathname;
        try {
            pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
        }
        catch {
            res.writeHead(400);
            res.end("Bad Request");
            return;
        }
        if (pathname.includes("\0")) {
            res.writeHead(400);
            res.end();
            return;
        }
        const filePath = path_1.default.normalize(path_1.default.join(root, pathname));
        if (filePath !== root && !filePath.startsWith(root + path_1.default.sep)) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }
        let servePath = filePath;
        if (!(0, fs_1.existsSync)(servePath) || !(0, fs_1.statSync)(servePath).isFile()) {
            if (path_1.default.extname(pathname)) {
                res.writeHead(404);
                res.end("Not Found");
                return;
            }
            servePath = path_1.default.join(root, "index.html");
            if (!(0, fs_1.existsSync)(servePath)) {
                next();
                return;
            }
        }
        const type = MIME[path_1.default.extname(servePath).toLowerCase()] ?? "application/octet-stream";
        const isHtml = servePath === path_1.default.join(root, "index.html");
        const isHashedAsset = pathname.startsWith("/assets/");
        res.writeHead(200, {
            "Content-Type": type,
            "Cache-Control": isHtml
                ? "no-cache"
                : isHashedAsset
                    ? "public, max-age=31536000, immutable"
                    : "public, max-age=3600",
        });
        if (req.method === "HEAD") {
            res.end();
            return;
        }
        (0, fs_1.createReadStream)(servePath).pipe(res);
    };
}
