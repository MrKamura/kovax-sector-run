import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureModels, getUserFromSession } from "@/lib/auth";
import { User } from "@/lib/modelInit";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  await ensureModels();
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const nickname = String(body?.nickname ?? "").trim();
  if (!nickname || nickname.length < 3) {
    return NextResponse.json({ error: "Nickname too short." }, { status: 400 });
  }
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const existing = await User.findOne({ where: { nickname } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json(
      { error: "Ник уже занят." },
      { status: 409 }
    );
  }
  user.nickname = nickname;
  await user.save();
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      shipChoice: user.shipChoice,
    },
  });
};
