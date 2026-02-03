import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureModels, getUserFromSession, hashPassword, verifyPassword } from "@/lib/auth";

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
  const oldPassword = String(body?.oldPassword ?? "");
  const oldPasswordRepeat = String(body?.oldPasswordRepeat ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (!oldPassword || !oldPasswordRepeat || !newPassword) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }
  if (oldPassword !== oldPasswordRepeat) {
    return NextResponse.json(
      { error: "Old passwords do not match." },
      { status: 400 }
    );
  }
  if (newPassword.length < 4) {
    return NextResponse.json(
      { error: "New password is too short." },
      { status: 400 }
    );
  }
  if (!verifyPassword(oldPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Wrong old password." }, { status: 401 });
  }

  user.passwordHash = hashPassword(newPassword);
  await user.save();

  return NextResponse.json({ ok: true });
};

