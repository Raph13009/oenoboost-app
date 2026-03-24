/** Identifiants stables en `eye_color` (varchar). */
export type WineColorId =
  | "pale_lemon"
  | "lemon"
  | "gold"
  | "amber"
  | "pale_pink"
  | "salmon"
  | "deep_pink"
  | "ruby"
  | "garnet"
  | "purple"
  | "tawny";

export const WINE_COLOR_GROUPS: {
  groupKey: "groupWhite" | "groupRose" | "groupRed";
  colors: { id: WineColorId; hex: string }[];
}[] = [
  {
    groupKey: "groupWhite",
    colors: [
      { id: "pale_lemon", hex: "#F5E6C8" },
      { id: "lemon", hex: "#E8D48A" },
      { id: "gold", hex: "#D4A84B" },
      { id: "amber", hex: "#C0782A" },
    ],
  },
  {
    groupKey: "groupRose",
    colors: [
      { id: "pale_pink", hex: "#F5D0D5" },
      { id: "salmon", hex: "#E8A090" },
      { id: "deep_pink", hex: "#C85A6E" },
    ],
  },
  {
    groupKey: "groupRed",
    colors: [
      { id: "ruby", hex: "#9B2335" },
      { id: "garnet", hex: "#6B2A2A" },
      { id: "purple", hex: "#4A1F3D" },
      { id: "tawny", hex: "#8B5A3C" },
    ],
  },
];

/** Mappe id → clé i18n sous `tastingFlow` (ex. colorPaleLemon). */
export function getHexForEyeColorId(id: string | null): string {
  if (!id) return "rgba(0,0,0,0.08)";
  for (const g of WINE_COLOR_GROUPS) {
    const c = g.colors.find((x) => x.id === id);
    if (c) return c.hex;
  }
  return "rgba(0,0,0,0.12)";
}

export function colorLabelKey(id: WineColorId): string {
  const map: Record<WineColorId, string> = {
    pale_lemon: "colorPaleLemon",
    lemon: "colorLemon",
    gold: "colorGold",
    amber: "colorAmber",
    pale_pink: "colorPalePink",
    salmon: "colorSalmon",
    deep_pink: "colorDeepPink",
    ruby: "colorRuby",
    garnet: "colorGarnet",
    purple: "colorPurple",
    tawny: "colorTawny",
  };
  return map[id];
}
