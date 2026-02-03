import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureModels, getUserFromSession } from "@/lib/auth";

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
  const musicVolumeRaw = body?.musicVolume;
  const sfxVolumeRaw = body?.sfxVolume;

  const nextMusic =
    musicVolumeRaw == null ? null : Math.max(0, Math.min(1, Number(musicVolumeRaw) || 0));
  const nextSfx =
    sfxVolumeRaw == null ? null : Math.max(0, Math.min(1, Number(sfxVolumeRaw) || 0));

  if (nextMusic == null && nextSfx == null) {
    return NextResponse.json({ error: "No settings provided." }, { status: 400 });
  }

  if (nextMusic != null) {
    user.musicVolume = nextMusic;
  }
  if (nextSfx != null) {
    user.sfxVolume = nextSfx;
  }
  await user.save();

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      shipChoice: user.shipChoice,
      musicVolume: Number(user.musicVolume ?? 0.45),
      sfxVolume: Number(user.sfxVolume ?? 0.55),
    },
  });
};

