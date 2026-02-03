import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSession } from "@/lib/auth";

type PresenceEntry = {
  userId: number;
  nickname: string | null;
  shipChoice: string | null;
  x: number;
  y: number;
  rotation: number;
  health: number;
  maxHealth: number;
  firingAt: number | null;
  updatedAt: number;
};

const PRESENCE_TTL_MS = 10000;
const presenceStore = globalThis as typeof globalThis & {
  __presenceMap?: Map<number, PresenceEntry>;
};

const getStore = () => {
  if (!presenceStore.__presenceMap) {
    presenceStore.__presenceMap = new Map();
  }
  return presenceStore.__presenceMap;
};

const cleanup = (store: Map<number, PresenceEntry>) => {
  const now = Date.now();
  for (const [userId, entry] of store.entries()) {
    if (now - entry.updatedAt > PRESENCE_TTL_MS) {
      store.delete(userId);
    }
  }
};

export const runtime = "nodejs";

export const GET = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const store = getStore();
  cleanup(store);
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const others = Array.from(store.values()).filter(
    (entry) => entry.userId !== user.id
  );
  return NextResponse.json({ players: others });
};

export const POST = async (request: Request) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const x = Number(body?.x);
  const y = Number(body?.y);
  const rotation = Number(body?.rotation ?? 0);
  const health = Number(body?.health ?? 0);
  const maxHealth = Number(body?.maxHealth ?? 0);
  const firingAt =
    body?.firingAt == null ? null : Number(body?.firingAt ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return NextResponse.json({ error: "Invalid position." }, { status: 400 });
  }
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const store = getStore();
  store.set(user.id, {
    userId: user.id,
    nickname: user.nickname,
    shipChoice: user.shipChoice,
    x,
    y,
    rotation,
    health: Number.isFinite(health) && health >= 0 ? health : 100,
    maxHealth: Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : 100,
    firingAt: Number.isFinite(firingAt) ? firingAt : null,
    updatedAt: Date.now(),
  });
  return NextResponse.json({ ok: true });
};
