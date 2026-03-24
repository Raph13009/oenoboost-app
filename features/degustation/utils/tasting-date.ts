import type { Locale } from "@/lib/i18n/config";

export function formatTastingMonthYear(iso: string, locale: Locale): string {
  const tag = locale === "en" ? "en-US" : "fr-FR";
  return new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
