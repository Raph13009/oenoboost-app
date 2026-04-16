export const CONTRAST_SUBREGION_COLORS = [
  "#f4d35e", // yellow
  "#6bbf59", // green
  "#4ea8de", // bright blue
  "#3d5a80", // blue
  "#e07a5f", // terracotta
  "#81b29a", // sage
  "#9381ff", // violet
  "#ff8fab", // rose
];

export function normalizeHexColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
}

export function getSubregionBaseColor(
  colorHex: string | null | undefined,
  fallbackIndex: number,
): string {
  return (
    normalizeHexColor(colorHex) ??
    CONTRAST_SUBREGION_COLORS[fallbackIndex % CONTRAST_SUBREGION_COLORS.length]
  );
}
