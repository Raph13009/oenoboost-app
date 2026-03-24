import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { DEGUST_MAIN_VIEWPORT } from "@/features/degustation/constants";
import { DegustationStartCta } from "@/features/degustation/components/degustation-start-cta";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.degustation.title} — OenoBoost`,
    description: dict.degustation.subtitle,
  };
}

export default async function DegustationPage() {
  const dict = await getDictionary(await getServerLocale());
  const d = dict.degustation;
  const user = await getCurrentUser();

  return (
    <div
      className={cn(
        DEGUST_MAIN_VIEWPORT,
        "flex min-h-0 w-full max-w-5xl flex-col gap-8 overflow-hidden self-center sm:gap-10",
      )}
    >
      <div className="flex shrink-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <header className="flex flex-col gap-2 text-center sm:max-w-xl sm:text-left sm:gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            {d.title}
          </h1>
          <p className="text-[14px] leading-snug text-neutral-600 sm:text-[15px] sm:leading-relaxed md:text-base dark:text-neutral-400">
            {d.subtitle}
          </p>
        </header>
        <Link
          href="/degustation/oeil"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "shrink-0 self-center border-wine/25 text-wine hover:bg-wine/10 sm:mt-0.5 sm:self-start dark:border-wine/40 dark:hover:bg-wine/15",
          )}
        >
          {d.howItWorks}
        </Link>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <DegustationStartCta
          isLoggedIn={user != null}
          ctaLabel={d.ctaStart}
          authCopy={{
            title: d.authModalTitle,
            body: d.authModalBody,
            login: dict.auth.login,
            register: dict.auth.registerButton,
          }}
        />
        <Link
          href="/degustation/history"
          className="text-sm font-medium text-wine underline-offset-4 transition-opacity hover:opacity-80 hover:underline"
        >
          {dict.tastingHistory.title}
        </Link>
      </div>
    </div>
  );
}
