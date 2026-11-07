"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionClearCookieHeader = exports.sessionCookieHeader = exports.sendJson = exports.readJsonBody = void 0;
const MAX_BODY_BYTES = 1000000;
/** Read and parse a JSON request body; resolves to null on empty/invalid input. */
const readJsonBody = (req) => new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
        data += chunk.toString("utf8");
        if (data.length > MAX_BODY_BYTES) {
            resolve(null);
            req.destroy();
        }
    });
    req.on("end", () => {
        if (!data) {
            resolve(null);
            return;
        }
        try {
            resolve(JSON.parse(data));
        }
        catch {
            resolve(null);
        }
    });
    req.on("error", () => resolve(null));
});
exports.readJsonBody = readJsonBody;
/** Send a JSON response with an optional list of raw Set-Cookie header values. */
const sendJson = (res, status, payload, setCookies) => {
    if (res.writableEnded) {
        return;
    }
    const body = JSON.stringify(payload);
    if (setCookies && setCookies.length > 0) {
        res.setHeader("Set-Cookie", setCookies);
    }
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
};
exports.sendJson = sendJson;
/** Session cookie (httpOnly, lax) valid until `expiresAt`. */
const sessionCookieHeader = (token, expiresAt) => {
    const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    return `session=${token}; Path=/; Expires=${expiresAt.toUTCString()}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
};
exports.sessionCookieHeader = sessionCookieHeader;
/** Expiring session cookie (logout). */
const sessionClearCookieHeader = () => "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax";
exports.sessionClearCookieHeader = sessionClearCookieHeader;
