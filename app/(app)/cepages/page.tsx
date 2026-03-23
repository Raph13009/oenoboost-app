import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getGrapes, getGrapesCount } from "@/features/cepages/queries/grapes.queries";
import { GrapeTypeEntry } from "@/features/cepages/components/grape-type-entry";
import { GrapesList } from "@/features/cepages/components/grapes-list";
import { getCurrentUser } from "@/lib/auth/session";
import { getFavoritedContentIds } from "@/features/favorites/queries/favorites.queries";

type Props = {
  searchParams?: Promise<{ type?: string }>;
};

export default async function CepagesPage({ searchParams }: Props) {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const qp = (await searchParams) ?? {};
  const type =
    qp.type === "red" || qp.type === "white"
      ? (qp.type as "red" | "white")
      : undefined;

  if (!type) {
    const grapesTotal = await getGrapesCount();

    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-semibold md:text-4xl">
            {dict.cepages.title}
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-600 md:text-base">
            {dict.cepages.intro}
          </p>
        </header>

        <GrapeTypeEntry
          whiteLabel={dict.cepages.cardWhite}
          whiteSubtitle={dict.cepages.whiteGrapesSubtitle}
          redLabel={dict.cepages.cardRed}
          redSubtitle={dict.cepages.redGrapesSubtitle}
        />

        <footer className="flex flex-col items-center text-center">
          <p className="text-sm text-neutral-600">
            +{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {grapesTotal}
            </span>{" "}
            {dict.cepages.grapesTotalSuffix}
          </p>
        </footer>
      </div>
    );
  }

  const grapes = await getGrapes(type);

  const user = await getCurrentUser();
  const favIds = user
    ? await getFavoritedContentIds(user.id)
    : { grapeIds: new Set<string>(), appellationIds: new Set<string>() };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-3xl font-semibold md:text-4xl">
        {type === "red" ? dict.cepages.redGrapes : dict.cepages.whiteGrapes}
      </h1>
      <GrapesList
        grapes={grapes}
        locale={locale}
        labels={{
          searchPlaceholder: dict.cepages.searchPlaceholder,
          allRegions: dict.cepages.allRegions,
        }}
        favoriteList={{
          favoritedIds: [...favIds.grapeIds],
          isLoggedIn: !!user,
          favoriteLabels: {
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
          },
        }}
      />
    </div>
  );
}
