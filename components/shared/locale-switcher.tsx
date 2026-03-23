"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import { useRouter } from "next/navigation";

export function LocaleSwitcher() {
  const router = useRouter();
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          setLocale("fr");
          router.refresh();
        }}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          locale === "fr"
            ? "bg-wine text-white"
            : "text-foreground hover:bg-accent"
        }`}
      >
        FR
      </button>
      <button
        onClick={() => {
          setLocale("en");
          router.refresh();
        }}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          locale === "en"
            ? "bg-wine text-white"
            : "text-foreground hover:bg-accent"
        }`}
      >
        EN
      </button>
    </div>
  );
}
