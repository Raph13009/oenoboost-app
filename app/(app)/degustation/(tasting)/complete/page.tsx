import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.tastingFlow.successTitle} — OenoBoost`,
  };
}

export default async function TastingCompletePage({ searchParams }: Props) {
  const dict = await getDictionary(await getServerLocale());
  const t = dict.tastingFlow;
  const sp = await searchParams;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div className="space-y-3">
        <h1 className="font-heading text-2xl font-semibold text-wine sm:text-3xl">
          {t.successTitle}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          {t.successBody}
        </p>
        {sp.id ? (
          <p className="font-mono text-[11px] text-muted-foreground/80">
            ID · {sp.id.slice(0, 8)}…
          </p>
        ) : null}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        {sp.id ? (
          <Link
            href={`/degustation/history/${sp.id}`}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "w-full bg-wine text-primary-foreground hover:opacity-90",
            )}
          >
            {dict.tastingHistory.viewSheet}
          </Link>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full",
            )}
          >
            {t.backHome}
          </Link>
          <Link
            href="/degustation"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full",
            )}
          >
            {t.backDegustation}
          </Link>
          <Link
            href="/degustation/oeil/start"
            className={cn(
              buttonVariants({ variant: sp.id ? "outline" : "default", size: "lg" }),
              "w-full",
              !sp.id && "bg-wine text-primary-foreground hover:opacity-90",
            )}
          >
            {t.newTasting}
          </Link>
        </div>
        <Link
          href="/degustation/history"
          className="text-center text-sm font-medium text-wine underline-offset-4 hover:underline"
        >
          {dict.tastingHistory.title}
        </Link>
      </div>
    </div>
  );
}
