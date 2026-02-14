import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSession } from "@/lib/auth";
import { getOrCreatePlayer } from "@/lib/playerRepo";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const rawSkill = String(body?.skill ?? "").trim();
  if (!rawSkill) {
    return NextResponse.json({ error: "Skill is required." }, { status: 400 });
  }
  const skill = rawSkill.slice(0, 40);
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  const mutations = (player.get("mutations") as { purchasedSkills?: string[] } | undefined);
  const purchased = new Set(mutations?.purchasedSkills ?? []);
  if (!purchased.has(skill)) {
    return NextResponse.json(
      { error: "Навык нужно сначала купить в разделе Мутации." },
      { status: 400 }
    );
  }
  const skills = Array.from(Array.isArray(player.skills) ? player.skills : [], (s, i) => s || "");
  const filled = skills.slice(0, 9);
  while (filled.length < 9) filled.push("");
  if (!filled.includes(skill)) {
    const idx = filled.indexOf("");
    if (idx !== -1) filled[idx] = skill;
    player.skills = filled;
    await player.save();
  }
  return NextResponse.json({ player: player.toJSON() });
}

export const PUT = async (request: Request) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const raw = body?.skills;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: "skills array is required." },
      { status: 400 }
    );
  }
  const skills = Array.from({ length: 9 }, (_, i) => {
    const s = raw[i];
    return s != null && String(s).trim() ? String(s).trim().slice(0, 40) : "";
  });
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  const mutations = (player.get("mutations") as { purchasedSkills?: string[] } | undefined);
  const purchased = new Set(mutations?.purchasedSkills ?? []);
  const validSkills = skills.map((id) => (id && purchased.has(id) ? id : ""));
  player.skills = validSkills;
  await player.save();
  return NextResponse.json({ player: player.toJSON() });
};
