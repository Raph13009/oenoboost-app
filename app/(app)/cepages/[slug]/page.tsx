import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isGrapeFavorited } from "@/features/cepages/queries/favorites.queries";
import { getGrapeBySlug } from "@/features/cepages/queries/grapes.queries";
import { GrapeDetail } from "@/features/cepages/components/grape-detail";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ from?: string }>;
};

export default async function GrapeDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qp = (await searchParams) ?? {};
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const grape = await getGrapeBySlug(slug);

  if (!grape) notFound();

  const user = await getCurrentUser();
  const initialFavorited = user
    ? await isGrapeFavorited(user.id, grape.id)
    : false;

  const isFromFavorites = qp.from === "favorites";
  const backHref = isFromFavorites ? "/profil/favoris" : "/cepages";
  const backLabel = isFromFavorites
    ? dict.favorites.backToFavorites
    : dict.cepages.backToGrapes;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        {isFromFavorites && (
          <Link
            href="/cepages"
            className="inline-flex items-center justify-center rounded-full bg-wine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine/90"
          >
            {dict.cepages.viewAllGrapes}
          </Link>
        )}
      </div>

      <GrapeDetail
        grape={grape}
        locale={locale}
        favorite={{
          grapeId: grape.id,
          grapeSlug: grape.slug,
          initialFavorited,
          isLoggedIn: !!user,
        }}
        favoriteLabels={{
          favoriteAria: dict.cepages.favoriteAddAria,
          unfavoriteAria: dict.cepages.favoriteRemoveAria,
          addedToast: dict.cepages.favoriteAddedToast,
          removedToast: dict.cepages.favoriteRemovedToast,
          authModal: {
            title: dict.cepages.favoriteAuthTitle,
            body: dict.cepages.favoriteAuthBody,
            login: dict.cepages.favoriteAuthLogin,
            register: dict.cepages.favoriteAuthRegister,
          },
          premiumLimit: {
            title: dict.favorites.premiumLimitTitle,
            body: dict.favorites.premiumLimitBody,
            acknowledge: dict.favorites.premiumLimitAck,
          },
        }}
        labels={{
          origin: dict.cepages.origin,
          history: dict.cepages.history,
          characteristics: dict.cepages.characteristics,
          tasting: dict.cepages.tasting,
          productionRegions: dict.cepages.productionRegions,
          crossings: dict.cepages.crossings,
          emblematicWines: dict.cepages.emblematicWines,
          grapeGlobe: dict.cepages.grapeGlobe,
          mapUnavailable: dict.cepages.mapUnavailable,
          red: dict.cepages.red,
          white: dict.cepages.white,
          rose: dict.cepages.rose,
        }}
      />
    </div>
  );
}
