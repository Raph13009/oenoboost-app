import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRegionBySlug } from "@/features/vignoble/queries/regions.queries";
import { getSubregionBySlug } from "@/features/vignoble/queries/subregions.queries";
import { getAppellations } from "@/features/vignoble/queries/appellations.queries";
import { AppellationCard } from "@/features/vignoble/components/appellation-card";
import { AppellationDetail } from "@/features/vignoble/components/appellation-detail";
import { getAopDetailByRegionAndSlug } from "@/features/vignoble/queries/aop-navigation.queries";
import { isAppellationFavorited } from "@/features/vignoble/queries/aop-favorites.queries";
import { getFavoritedContentIds } from "@/features/favorites/queries/favorites.queries";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getContent } from "@/lib/i18n/get-content";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getRelatedSoilsForAppellation,
  getSoilBySlug,
} from "@/features/sols/queries/soils.queries";

type Props = {
  params: Promise<{ region: string; subregion: string }>;
  searchParams?: Promise<{
    from?: string;
    subregion?: string;
    listRegion?: string;
    listSubregion?: string;
    soilSlug?: string;
  }>;
};

export default async function RegionSubregionOrAopPage({
  params,
  searchParams,
}: Props) {
  const { region: regionSlug, subregion: slug } = await params;
  const qp = (await searchParams) ?? {};
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const region = await getRegionBySlug(regionSlug);
  if (!region) notFound();

  const subregion = await getSubregionBySlug(slug);
  if (subregion && subregion.region_id === region.id) {
    const appellations = await getAppellations(subregion.id);
    const subregionName = getContent(subregion, "name", locale);
    const user = await getCurrentUser();
    const favIds = user
      ? await getFavoritedContentIds(user.id)
      : { grapeIds: new Set<string>(), appellationIds: new Set<string>() };

    const aopFavoriteLabels = {
      favoriteAria: dict.vignoble.favoriteAddAria,
      unfavoriteAria: dict.vignoble.favoriteRemoveAria,
      addedToast: dict.vignoble.favoriteAddedToast,
      removedToast: dict.vignoble.favoriteRemovedToast,
      authModal: {
        title: dict.vignoble.favoriteAuthTitle,
        body: dict.vignoble.favoriteAuthBody,
        login: dict.vignoble.favoriteAuthLogin,
        register: dict.vignoble.favoriteAuthRegister,
      },
      premiumLimit: {
        title: dict.favorites.premiumLimitTitle,
        body: dict.favorites.premiumLimitBody,
        acknowledge: dict.favorites.premiumLimitAck,
      },
    };

    return (
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={`/vignoble/${regionSlug}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
          >
            <ArrowLeft className="h-4 w-4" />
            {dict.vignoble.backToSubregions}
          </Link>

          <h1 className="font-heading text-3xl font-semibold md:text-4xl">
            {subregionName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {dict.vignoble.appellations}
          </p>
        </div>

        {appellations.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {dict.common.empty}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {appellations.map((aop) => (
              <AppellationCard
                key={aop.id}
                appellation={aop}
                regionSlug={regionSlug}
                subregionSlug={subregion.slug}
                locale={locale}
                initialFavorited={favIds.appellationIds.has(aop.id)}
                isLoggedIn={!!user}
                favoriteLabels={aopFavoriteLabels}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const aop = await getAopDetailByRegionAndSlug(regionSlug, slug);
  if (!aop) notFound();

  const user = await getCurrentUser();
  const initialAopFavorited = user
    ? await isAppellationFavorited(user.id, aop.appellation.id)
    : false;
  const relatedSoils = await getRelatedSoilsForAppellation(aop.appellation.id);

  const isFromFavorites = qp.from === "favorites";
  const isFromList = qp.from === "list";
  const isFromSoil = qp.from === "soil" && Boolean(qp.soilSlug);

  const soilForBack =
    isFromSoil && qp.soilSlug ? await getSoilBySlug(qp.soilSlug) : null;
  const soilBackDisplayName = soilForBack?.name_fr ?? qp.soilSlug ?? "";

  const backHref = (() => {
    if (isFromFavorites) return "/profil/favoris";
    if (isFromList) {
      const params = new URLSearchParams();
      if (qp.listRegion) params.set("region", qp.listRegion);
      if (qp.listSubregion) params.set("subregion", qp.listSubregion);
      const q = params.toString();
      return q ? `/vignoble/aop?${q}` : "/vignoble/aop";
    }
    if (isFromSoil && qp.soilSlug) {
      return `/sols/${encodeURIComponent(qp.soilSlug)}`;
    }
    if (qp.from === "map" && qp.subregion) {
      return `/vignoble?region=${regionSlug}&subregion=${qp.subregion}`;
    }
    return `/vignoble?region=${regionSlug}&subregion=${aop.subregion.slug}`;
  })();
  const backLabel = (() => {
    if (isFromFavorites) return dict.favorites.backToFavorites;
    if (isFromList) {
      return locale === "fr" ? "Retour à la liste" : "Back to list";
    }
    if (isFromSoil && soilBackDisplayName) {
      return dict.vignoble.backToSoilNamed.replace("{name}", soilBackDisplayName);
    }
    return dict.vignoble.backToMap;
  })();

  const showViewAllAopsCta =
    (!isFromList || isFromFavorites) && !isFromSoil;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        {showViewAllAopsCta && (
          <Link
            href="/vignoble/aop"
            className="inline-flex items-center justify-center rounded-full bg-wine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine/90"
          >
            {dict.vignoble.viewAllAops}
          </Link>
        )}
      </div>

      <AppellationDetail
        appellation={aop.appellation}
        locale={locale}
        favorite={{
          appellationId: aop.appellation.id,
          regionSlug: aop.region.slug,
          subregionSlug: aop.subregion.slug,
          aopSlug: aop.appellation.slug,
          initialFavorited: initialAopFavorited,
          isLoggedIn: !!user,
        }}
        favoriteLabels={{
          favoriteAria: dict.vignoble.favoriteAddAria,
          unfavoriteAria: dict.vignoble.favoriteRemoveAria,
          addedToast: dict.vignoble.favoriteAddedToast,
          removedToast: dict.vignoble.favoriteRemovedToast,
          authModal: {
            title: dict.vignoble.favoriteAuthTitle,
            body: dict.vignoble.favoriteAuthBody,
            login: dict.vignoble.favoriteAuthLogin,
            register: dict.vignoble.favoriteAuthRegister,
          },
          premiumLimit: {
            title: dict.favorites.premiumLimitTitle,
            body: dict.favorites.premiumLimitBody,
            acknowledge: dict.favorites.premiumLimitAck,
          },
        }}
        relatedSoils={relatedSoils}
        soilLabels={{
          relatedSoils: dict.sols.relatedSoils,
          emptyRelatedSoils: dict.sols.noRelatedSoils,
        }}
      />
    </div>
  );
}
