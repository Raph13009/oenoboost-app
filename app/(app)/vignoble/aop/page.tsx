import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAopBrowseItems } from "@/features/vignoble/queries/aop-navigation.queries";
import { AopFilters } from "@/features/vignoble/components/aop-filters";
import { AopBrowseCard } from "@/features/vignoble/components/aop-browse-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getFavoritedContentIds } from "@/features/favorites/queries/favorites.queries";

type Props = {
  searchParams?: Promise<{ region?: string; subregion?: string; from?: string }>;
};

export default async function AopListPage({ searchParams }: Props) {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const qp = (await searchParams) ?? {};

  const data = await getAopBrowseItems({
    regionId: qp.region,
    subregionId: qp.subregion,
  });

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

  const availableSubregions = qp.region
    ? data.subregions.filter((s) => s.region_id === qp.region)
    : data.subregions;
  const backHref = qp.from === "home" ? "/" : "/vignoble";
  const backLabel = qp.from === "home" ? dict.common.back : dict.vignoble.backToRegions;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={backHref}
          className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <h1 className="mt-3 font-heading text-3xl font-semibold md:text-4xl">
          {dict.vignoble.allAops}
        </h1>
      </div>

      <AopFilters
        locale={locale}
        regionLabel={dict.vignoble.regions}
        subregionLabel={dict.vignoble.subregions}
        selectedRegionId={qp.region ?? ""}
        selectedSubregionId={qp.subregion ?? ""}
        regions={data.regions}
        initialSubregions={availableSubregions}
      />

      {data.items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {dict.common.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.items.map((item) => {
            const params = new URLSearchParams({
              from: "list",
              subregion: item.subregion_slug,
            });
            if (qp.region) params.set("listRegion", qp.region);
            if (qp.subregion) params.set("listSubregion", qp.subregion);
            const href = `/vignoble/${item.region_slug}/${item.slug}?${params.toString()}`;
            return (
              <AopBrowseCard
                key={item.id}
                item={item}
                locale={locale}
                href={href}
                initialFavorited={favIds.appellationIds.has(item.id)}
                isLoggedIn={!!user}
                favoriteLabels={aopFavoriteLabels}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
