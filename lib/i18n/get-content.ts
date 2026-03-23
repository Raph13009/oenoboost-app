import type { Locale } from "./config";

/**
 * Access a bilingual database field by locale.
 * Usage: getContent(region, "name", "fr") → region.name_fr
 */
export function getContent<T extends Record<string, unknown>>(
  obj: T,
  field: string,
  locale: Locale,
): string {
  const key = `${field}_${locale}` as keyof T;
  const value = obj[key];
  if (typeof value === "string") return value;

  const fallback = `${field}_fr` as keyof T;
  const fallbackValue = obj[fallback];
  return typeof fallbackValue === "string" ? fallbackValue : "";
}
