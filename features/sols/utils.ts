import type { SoilType } from "./types";

export const SOIL_PLACEHOLDER_IMAGE = "/images/soil-placeholder.jpg";

function isUsableImageUrl(value: string) {
  const v = value.trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower === "null" || lower === "undefined") return false;
  return (
    v.startsWith("/") ||
    v.startsWith("http://") ||
    v.startsWith("https://")
  );
}

/** URL d’image pour Next/Image : placeholder si vide ou valeur non exploitable en base. */
export function getSoilImageSrc(photoUrl: string | null) {
  const value = photoUrl?.trim() ?? "";
  if (!isUsableImageUrl(value)) {
    return SOIL_PLACEHOLDER_IMAGE;
  }
  return value;
}

export function getSoilSummary(soil: Pick<
  SoilType,
  "wine_influence_fr" | "mineral_composition_fr"
>) {
  const summary = soil.wine_influence_fr ?? soil.mineral_composition_fr ?? "...";
  return summary.replace(/\s+/g, " ").trim() || "...";
}
