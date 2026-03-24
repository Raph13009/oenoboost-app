/** First letter bucket for A–Z sections (accents folded). */
export function dictionaryGroupKey(termFr: string): string {
  const t = termFr.trim();
  if (!t) return "#";
  const base = t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .charAt(0)
    .toUpperCase();
  if (/[0-9]/.test(base)) return "#";
  if (/[A-Z]/.test(base)) return base;
  return "#";
}
