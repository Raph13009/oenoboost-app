import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FavoriteGrapesList } from "@/features/cepages/components/favorite-grapes-list";
import { getFavoriteGrapesForUser } from "@/features/cepages/queries/favorites.queries";
import { FavoriteAppellationsList } from "@/features/vignoble/components/favorite-appellations-list";
import { getFavoriteAppellationsForUser } from "@/features/vignoble/queries/aop-favorites.queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/session";

export default async function FavorisPage() {
  const user = await requireUser();
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const [grapeRows, aopRows] = await Promise.all([
    getFavoriteGrapesForUser(user.id),
    getFavoriteAppellationsForUser(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
      >
        <ArrowLeft className="h-4 w-4" />
        {dict.nav.profil}
      </Link>

      <div>
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          {dict.favorites.pageTitle}
        </h1>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="font-heading text-xl font-semibold">
          {dict.favorites.grapeSection}
        </h2>
        <div className="mt-4">
          {grapeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {dict.favorites.emptyGrapes}
            </p>
          ) : (
            <FavoriteGrapesList
              initialItems={grapeRows}
              locale={locale}
              labels={{
                red: dict.cepages.red,
                white: dict.cepages.white,
                rose: dict.cepages.rose,
                removeAria: dict.favorites.removeAria,
              }}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="font-heading text-xl font-semibold">
          {dict.favorites.aopSection}
        </h2>
        <div className="mt-4">
          {aopRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {dict.favorites.emptyAops}
            </p>
          ) : (
            <FavoriteAppellationsList
              initialItems={aopRows}
              locale={locale}
              labels={{
                removeAria: dict.favorites.removeAria,
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}
