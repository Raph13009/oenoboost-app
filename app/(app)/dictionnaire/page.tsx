import { DictionaryBrowser } from "@/features/dictionnaire/components/dictionary-browser";
import { getDictionaryTermFavoriteIds } from "@/features/dictionnaire/queries/dictionary-favorites.queries";
import { getPublishedDictionaryTerms } from "@/features/dictionnaire/queries/dictionary.queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentUser } from "@/lib/auth/session";
import { isPremiumPlan } from "@/lib/favorites/constants";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.dictionnaire.pageTitle} — OenoBoost`,
    description: dict.dictionnaire.pageIntro,
  };
}

export default async function DictionnairePage() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const user = await getCurrentUser();
  const terms = await getPublishedDictionaryTerms();
  const favoritedIds = user
    ? [...(await getDictionaryTermFavoriteIds(user.id))]
    : [];
  const userPremium = user ? isPremiumPlan(user.plan) : false;

  return (
    <div className="flex flex-col gap-8 pb-8">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold text-wine md:text-4xl">
          {dict.dictionnaire.pageTitle}
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground md:text-base">
          {dict.dictionnaire.pageIntro}
        </p>
      </header>

      <DictionaryBrowser
        terms={terms}
        locale={locale}
        labels={dict.dictionnaire}
        favoritesLimit={{
          premiumLimitTitle: dict.favorites.premiumLimitTitle,
          premiumLimitBody: dict.favorites.premiumLimitBody,
          premiumLimitAck: dict.favorites.premiumLimitAck,
        }}
        favoritedIds={favoritedIds}
        isLoggedIn={!!user}
        userPremium={userPremium}
      />
    </div>
  );
}
