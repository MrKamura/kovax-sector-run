import type { IncomingMessage, ServerResponse } from "http";

const MAX_BODY_BYTES = 1_000_000;

/** Read and parse a JSON request body; resolves to null on empty/invalid input. */
export const readJsonBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
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
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });

/** Send a JSON response with an optional list of raw Set-Cookie header values. */
export const sendJson = (
  res: ServerResponse,
  status: number,
  payload: unknown,
  setCookies?: string[]
): void => {
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

/** Session cookie (httpOnly, lax) valid until `expiresAt`. */
export const sessionCookieHeader = (token: string, expiresAt: Date): string => {
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return `session=${token}; Path=/; Expires=${expiresAt.toUTCString()}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
};

/** Expiring session cookie (logout). */
export const sessionClearCookieHeader = (): string =>
  "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax";
