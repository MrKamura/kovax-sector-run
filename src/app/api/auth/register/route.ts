import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureModels, hashPassword, createSession } from "@/lib/auth";
import { User } from "@/lib/modelInit";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  await ensureModels();
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || password.length < 4) {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 400 }
    );
  }
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already used." }, { status: 409 });
  }
  const user = await User.create({
    email,
    passwordHash: hashPassword(password),
    nickname: null,
    shipChoice: null,
  });
  if (!user.id) {
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
  const session = await createSession(user.id);
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      shipChoice: user.shipChoice,
    },
  });
  response.cookies.set("session", session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
    expires: session.expiresAt,
  });
  return response;
};
