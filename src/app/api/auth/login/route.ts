import { NextResponse } from "next/server";
//import { cookies } from "next/headers";
import { ensureModels, verifyPassword, createSession } from "@/lib/auth";
import { User } from "@/lib/modelInit";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  await ensureModels();
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 400 }
    );
  }
  const user = await User.findOne({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
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
