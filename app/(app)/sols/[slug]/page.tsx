import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { SoilDetail } from "@/features/sols/components/soil-detail";
import { isSoilFavorited } from "@/features/sols/queries/soil-favorites.queries";
import {
  getRelatedAopsForSoil,
  getSoilBySlug,
} from "@/features/sols/queries/soils.queries";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ from?: string }>;
};

export default async function SoilDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qp = (await searchParams) ?? {};
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const soil = await getSoilBySlug(slug);
  if (!soil) {
    notFound();
  }

  const [relatedAops, user] = await Promise.all([
    getRelatedAopsForSoil(soil.id),
    getCurrentUser(),
  ]);

  const initialFavorited = user
    ? await isSoilFavorited(user.id, soil.id)
    : false;

  const isFromFavorites = qp.from === "favorites";
  const backHref = isFromFavorites ? "/profil/favoris" : "/sols";
  const backLabel = isFromFavorites
    ? dict.favorites.backToFavorites
    : dict.sols.backToSoils;

  return (
    <div className="flex flex-col gap-6">
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        {isFromFavorites && (
          <Link
            href="/sols"
            className="inline-flex items-center justify-center rounded-full bg-wine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine/90"
          >
            {dict.sols.viewAllSoils}
          </Link>
        )}
      </div>

      <SoilDetail
        locale={locale}
        soil={soil}
        relatedAops={relatedAops}
        emptyRelatedAopsLabel={dict.sols.noRelatedAops}
        favorite={{
          soilId: soil.id,
          soilSlug: soil.slug,
          initialFavorited,
          isLoggedIn: !!user,
        }}
        favoriteLabels={{
          favoriteAria: dict.sols.favoriteAddAria,
          unfavoriteAria: dict.sols.favoriteRemoveAria,
          addedToast: dict.sols.favoriteAddedToast,
          removedToast: dict.sols.favoriteRemovedToast,
          authModal: {
            title: dict.sols.favoriteAuthTitle,
            body: dict.sols.favoriteAuthBody,
            login: dict.sols.favoriteAuthLogin,
            register: dict.sols.favoriteAuthRegister,
          },
          premiumLimit: {
            title: dict.favorites.premiumLimitTitle,
            body: dict.favorites.premiumLimitBody,
            acknowledge: dict.favorites.premiumLimitAck,
          },
        }}
        labels={{
          geologicalOrigin: dict.sols.geologicalOrigin,
          regions: dict.sols.regions,
          mineralComposition: dict.sols.mineralComposition,
          influenceOnWine: dict.sols.influenceOnWine,
          relatedAops: dict.sols.relatedAops,
          premiumBadge: dict.sols.premiumBadge,
        }}
      />
    </div>
  );
}
