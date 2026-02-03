import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  await revokeSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
};
