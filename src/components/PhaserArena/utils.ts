export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpColor = (from: number, to: number, t: number) => {
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(lerp(fr, tr, t));
  const g = Math.round(lerp(fg, tg, t));
  const b = Math.round(lerp(fb, tb, t));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

/** Server names like "Green L1 • Aquila-12" → show suffix after "•". */
export const formatSectorDisplayName = (raw: string) => {
  const parts = raw.split("•");
  return (parts[parts.length - 1] ?? raw).trim();
};

export const monsterNameColor = (monsterLevel: number, playerLevel: number) => {
  const green = 0x2ecc71;
  const red = 0xff5a5a;
  const white = 0xf1f4fb;
  const diff = monsterLevel - playerLevel;
  if (diff === 0) return lerpColor(green, green, 0);
  const t = Math.min(1, Math.abs(diff) / 5);
  return diff > 0 ? lerpColor(green, red, t) : lerpColor(green, white, t);
};
