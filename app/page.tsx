import Link from "next/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export default async function HomePage() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="flex flex-col items-center gap-8 pt-12 text-center">
      <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
        OenoBoost
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        {dict.home.subtitle}
      </p>
      <Link
        href="/vignoble"
        className="rounded-xl bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {dict.home.cta}
      </Link>
    </div>
  );
}
