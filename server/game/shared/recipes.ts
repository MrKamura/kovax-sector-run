import { ResourceKey } from "./gameDefaults";

export type RecipeId = "rusty_blade" | "scrap_spear";

type Recipe = {
  id: RecipeId;
  name: string;
  description: string;
  cost: Record<ResourceKey, number>;
  produces: {
    weaponName: string;
    power: number;
  };
  unlocksBlueprint?: RecipeId;
};

export const RECIPES: Record<RecipeId, Recipe> = {
  rusty_blade: {
    id: "rusty_blade",
    name: "Rusty Blade",
    description: "Old steel, still sharp enough for the first hunts.",
    cost: {
      scrap: 8,
      tokens: 0,
    },
    produces: {
      weaponName: "Rusty Blade",
      power: 2,
    },
    unlocksBlueprint: "scrap_spear",
  },
  scrap_spear: {
    id: "scrap_spear",
    name: "Scrap Spear",
    description: "Longer reach makes the night raids safer.",
    cost: {
      scrap: 15,
      tokens: 0,
    },
    produces: {
      weaponName: "Scrap Spear",
      power: 4,
    },
  },
};
