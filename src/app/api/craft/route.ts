import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEFAULT_PLAYER } from "@/lib/gameDefaults";
import { getOrCreatePlayer } from "@/lib/playerRepo";
import { RECIPES, RecipeId } from "@/lib/recipes";
import { getUserFromSession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const recipeId = body?.recipeId as RecipeId | undefined;

  if (!recipeId || !RECIPES[recipeId]) {
    return NextResponse.json({ error: "Unknown recipe." }, { status: 400 });
  }

  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }

  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  const recipe = RECIPES[recipeId];
  const blueprints =
    player.blueprints?.length > 0 ? player.blueprints : DEFAULT_PLAYER.blueprints;

  if (!blueprints.includes(recipeId)) {
    return NextResponse.json(
      { error: "Blueprint locked." },
      { status: 403 }
    );
  }

  const resources = {
    ...DEFAULT_PLAYER.resources,
    ...player.resources,
  };

  for (const [key, value] of Object.entries(recipe.cost)) {
    const amount = resources[key as keyof typeof resources] ?? 0;
    if (amount < value) {
      return NextResponse.json(
        { error: "Not enough resources." },
        { status: 400 }
      );
    }
  }

  for (const [key, value] of Object.entries(recipe.cost)) {
    resources[key as keyof typeof resources] -= value;
  }

  player.resources = resources;
  player.weapons = [
    ...(player.weapons ?? []),
    {
      id: recipe.id,
      name: recipe.produces.weaponName,
      power: recipe.produces.power,
    },
  ];

  if (recipe.unlocksBlueprint) {
    player.blueprints = Array.from(
      new Set([...blueprints, recipe.unlocksBlueprint])
    );
  }

  await player.save();

  return NextResponse.json({ player: player.toJSON() });
};
