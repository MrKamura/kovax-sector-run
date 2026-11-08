import type { IncomingMessage, ServerResponse } from "http";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";

const MIME: Record<string, string> = {
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

type Next = (err?: unknown) => void;

/**
 * Serves the built client (client-dist/) with SPA fallback to index.html.
 * Used in production only; in dev the Vite middleware serves the UI.
 */
export function createStaticHandler(rootDir: string): (req: IncomingMessage, res: ServerResponse, next: Next) => void {
  const root = path.normalize(rootDir);
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }
    if (pathname.includes("\0")) {
      res.writeHead(400);
      res.end();
      return;
    }
    const filePath = path.normalize(path.join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let servePath = filePath;
    if (!existsSync(servePath) || !statSync(servePath).isFile()) {
      if (path.extname(pathname)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      servePath = path.join(root, "index.html");
      if (!existsSync(servePath)) {
        next();
        return;
      }
    }
    const type = MIME[path.extname(servePath).toLowerCase()] ?? "application/octet-stream";
    const isHtml = servePath === path.join(root, "index.html");
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
    createReadStream(servePath).pipe(res);
  };
}
