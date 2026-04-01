import Link from "next/link";
import {
  Brain,
  ChevronRight,
  Grape as GrapeIcon,
  Layers,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { getContent } from "@/lib/i18n/get-content";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { isPremiumPlan } from "@/lib/favorites/constants";

import { GrapeFavoriteButton } from "@/features/cepages/components/grape-favorite-button";
import type { GrapeFavoriteLabels } from "@/features/cepages/components/grape-favorite-button";
import { AppellationFavoriteButton } from "@/features/vignoble/components/appellation-favorite-button";
import type { AppellationFavoriteLabels } from "@/features/vignoble/components/appellation-favorite-button";
import { SoilFavoriteButton } from "@/features/sols/components/soil-favorite-button";
import type { SoilFavoriteLabels } from "@/features/sols/components/soil-favorite-button";
import { DailyQuestionCta } from "@/features/quiz/components/daily-question-cta";

import { getFavoriteGrapesForUser } from "@/features/cepages/queries/favorites.queries";
import type { FavoriteGrapeRow } from "@/features/cepages/queries/favorites.queries";
import { getFavoriteAppellationsForUser } from "@/features/vignoble/queries/aop-favorites.queries";
import type { FavoriteAppellationRow } from "@/features/vignoble/queries/aop-favorites.queries";
import { getFavoriteSoilsForUser } from "@/features/sols/queries/soil-favorites.queries";
import type { FavoriteSoilRow } from "@/features/sols/queries/soil-favorites.queries";
import { getDailyQuestionForUser } from "@/features/quiz/queries/daily-question.queries";

type QuizPill = {
  href: string;
  label: string;
  icon: ReactNode;
  featured?: boolean;
};

type FavoriteHomeItem =
  | { type: "grape"; row: FavoriteGrapeRow }
  | { type: "aop"; row: FavoriteAppellationRow }
  | { type: "soil"; row: FavoriteSoilRow };

function ModuleCard({
  href,
  title,
  icon,
  subtitle,
  tintClass,
}: {
  href: string;
  title: string;
  icon: ReactNode;
  subtitle?: string;
  tintClass: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={`group relative flex min-h-[118px] flex-col overflow-hidden rounded-[28px] border border-white/70 px-3.5 py-3.5 shadow-[0_10px_22px_rgba(91,54,35,0.08)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(91,54,35,0.12)] active:scale-[0.985] md:min-h-[126px] md:px-4 md:py-4 ${tintClass}`}
    >
      <div className="pointer-events-none absolute inset-x-4 top-0 h-14 rounded-full bg-white/30 blur-2xl transition-transform duration-200 group-hover:translate-y-1" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/75 text-wine shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm md:h-10 md:w-10">
          {icon}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-wine/70 transition-all duration-200 group-hover:bg-white/90 group-hover:text-wine group-hover:translate-x-0.5 md:h-8.5 md:w-8.5">
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
      </div>
      <div className="relative mt-4 min-w-0 max-w-[9rem] md:mt-5 md:max-w-[10rem]">
        <h3 className="font-heading text-[0.95rem] font-semibold leading-tight tracking-tight text-foreground md:text-[1rem]">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 line-clamp-2 text-[0.74rem] leading-relaxed text-muted-foreground md:text-[0.78rem]">
            {subtitle}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const user = await getCurrentUser();
  const [grapeRows, aopRows, soilRows] = user
    ? await Promise.all([
        getFavoriteGrapesForUser(user.id),
        getFavoriteAppellationsForUser(user.id),
        getFavoriteSoilsForUser(user.id),
      ])
    : [[], [], []];

  const favoritesCount =
    grapeRows.length + aopRows.length + soilRows.length;

  const favoriteItems: FavoriteHomeItem[] = favoritesCount
    ? [
        ...grapeRows.map((row) => ({ type: "grape" as const, row })),
        ...aopRows.map((row) => ({ type: "aop" as const, row })),
        ...soilRows.map((row) => ({ type: "soil" as const, row })),
      ].slice(0, 5)
    : [];

  const daily = await getDailyQuestionForUser({
    userId: user?.id ?? null,
    locale,
    isPremium: isPremiumPlan(user?.plan),
  });

  const grapeFavoriteLabels: GrapeFavoriteLabels = {
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
  };

  const aopFavoriteLabels: AppellationFavoriteLabels = {
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

  const soilFavoriteLabels: SoilFavoriteLabels = {
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
  };

  const quizPills: QuizPill[] = [
    {
      href: "/quiz?type=beginner",
      label: locale === "en" ? "Beginner quiz" : "Quiz débutant",
      icon: <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      href: "/quiz?type=intermediate",
      label: locale === "en" ? "Intermediate quiz" : "Quiz intermédiaire",
      icon: <Brain className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      href: "/quiz?type=expert",
      label: locale === "en" ? "Expert quiz" : "Quiz expert",
      icon: <Brain className="h-3.5 w-3.5" strokeWidth={2} />,
    },
  ];

  const quizSectionTitle = dict.quiz.title;
  const favoritesTitle = dict.nav.myFavorites;
  const dailyQuestionAuthCopy = {
    title: dict.cepages.favoriteAuthTitle,
    body:
      locale === "en"
        ? "This feature requires an account. Create one to start a quiz."
        : "Cette fonctionnalité nécessite de créer un compte pour lancer un quiz.",
    login: dict.cepages.favoriteAuthLogin,
    register: dict.cepages.favoriteAuthRegister,
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] min-w-0 flex-col overflow-x-hidden pb-6">
      {daily.questionId ? (
        <section className="relative mt-6 w-full overflow-hidden rounded-[28px] border border-white/65 bg-[linear-gradient(135deg,rgba(124,39,54,0.12),rgba(255,255,255,0.78)_40%,rgba(244,225,212,0.82))] px-4 py-4 shadow-[0_16px_34px_rgba(91,54,35,0.1)] backdrop-blur-sm md:px-5 md:py-5">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/45 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-8 h-20 w-28 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-col gap-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="min-w-0 flex-1 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-wine/70">
                {dict.home.dailyQuestionTitle}
              </p>
              <DailyQuestionCta
                href="/quiz/daily"
                isLoggedIn={!!user}
                label={dict.home.dailyAnswerCta}
                authCopy={dailyQuestionAuthCopy}
                className="quiz-fab shrink-0 rounded-2xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_14px_32px_rgba(124,39,54,0.22)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-wine-dark active:scale-[0.985]"
              />
            </div>
            <p className="max-w-[24rem] font-heading text-[1.25rem] font-semibold leading-snug tracking-tight text-foreground md:max-w-[28rem] md:text-[1.4rem]">
              {daily.prompt}
            </p>
          </div>
        </section>
      ) : null}

      <section
        className={`flex w-full min-w-0 flex-col gap-4 ${
          daily.questionId ? "mt-12" : "mt-6"
        }`}
      >
        <h2 className="font-heading text-[1.55rem] font-semibold tracking-tight text-foreground">
          {locale === "en" ? "Modules" : "Modules"}
        </h2>
        <div className="grid grid-cols-2 gap-3.5 md:gap-4">
          <ModuleCard
            href="/vignoble"
            title={dict.nav.vignoble}
            icon={<MapIcon className="h-5 w-5" strokeWidth={1.6} />}
            tintClass="bg-[linear-gradient(180deg,rgba(255,236,236,0.98),rgba(255,250,249,0.96))]"
          />
          <ModuleCard
            href="/cepages"
            title={dict.nav.cepages}
            icon={<GrapeIcon className="h-5 w-5" strokeWidth={1.6} />}
            tintClass="bg-[linear-gradient(180deg,rgba(247,239,255,0.98),rgba(255,252,255,0.96))]"
          />
          <ModuleCard
            href="/sols"
            title={dict.nav.sols}
            icon={<Layers className="h-5 w-5" strokeWidth={1.6} />}
            tintClass="bg-[linear-gradient(180deg,rgba(246,236,225,0.98),rgba(255,251,245,0.96))]"
          />
          <ModuleCard
            href="/vinification"
            title={dict.nav.vinification}
            icon={<RotateCcw className="h-5 w-5" strokeWidth={1.6} />}
            tintClass="bg-[linear-gradient(180deg,rgba(255,244,219,0.98),rgba(255,251,240,0.96))]"
          />
        </div>
      </section>

      <section className="mt-10 flex w-full min-w-0 flex-col gap-4 md:mt-12">
        <h2 className="font-heading text-[1.55rem] font-semibold tracking-tight text-foreground">
          {quizSectionTitle}
        </h2>
        <ul className="flex w-full min-w-0 list-none flex-col gap-3 p-0">
          <li>
            <DailyQuestionCta
              href="/quiz/daily"
              isLoggedIn={!!user}
              label={dict.home.dailyQuestionTitle}
              authCopy={dailyQuestionAuthCopy}
              className="group flex h-10.5 w-full min-w-0 max-w-full items-center justify-between gap-2.5 rounded-full border border-primary/20 bg-primary px-3.5 text-[0.88rem] font-semibold text-primary-foreground shadow-[0_10px_20px_rgba(124,39,54,0.18)] transition-colors duration-200 ease-out active:opacity-90 hover:bg-wine-dark"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                </span>
                <span className="truncate">{dict.home.dailyQuestionTitle}</span>
              </span>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-white/80"
                strokeWidth={2}
              />
            </DailyQuestionCta>
          </li>
          {quizPills.map((pill) => (
            <li key={pill.href}>
              <DailyQuestionCta
                href={pill.href}
                isLoggedIn={!!user}
                label={pill.label}
                authCopy={dailyQuestionAuthCopy}
                className="group flex h-10.5 w-full min-w-0 max-w-full items-center justify-between gap-2.5 rounded-full border border-white/70 bg-white/75 px-3.5 text-[0.88rem] font-semibold text-foreground shadow-[0_8px_18px_rgba(91,54,35,0.06)] backdrop-blur-sm transition-colors duration-200 ease-out active:opacity-90 hover:border-primary/15 hover:bg-white"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/80 text-wine">
                    {pill.icon}
                  </span>
                  <span className="truncate">{pill.label}</span>
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-wine/70"
                  strokeWidth={2}
                />
              </DailyQuestionCta>
            </li>
          ))}
        </ul>
      </section>

      {favoritesCount > 0 ? (
        <section className="mt-10 flex w-full min-w-0 flex-col gap-4 md:mt-12">
          <h2 className="font-heading text-[1.55rem] font-semibold tracking-tight text-foreground">
            {favoritesTitle}
          </h2>
          <div className="flex w-full min-w-0 gap-3 overflow-x-auto pb-1 no-scrollbar">
            {favoriteItems.map((item) => {
              if (item.type === "grape") {
                const name = getContent(item.row.grape, "name", locale);
                const typeLabel =
                  item.row.grape.type === "red"
                    ? dict.cepages.red
                    : item.row.grape.type === "white"
                      ? dict.cepages.white
                      : dict.cepages.rose;

                return (
                  <div
                    key={`grape:${item.row.grape.id}`}
                    className="shrink-0 w-[8.75rem] rounded-[22px] border border-white/70 bg-white/78 px-3 py-2.5 shadow-[0_8px_20px_rgba(91,54,35,0.08)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white hover:shadow-[0_14px_28px_rgba(91,54,35,0.12)] active:scale-[0.985]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/cepages/${item.row.grape.slug}?from=favorites`}
                          prefetch
                          className="block min-w-0"
                          aria-label={name}
                        >
                        <div className="font-heading text-[0.92rem] font-semibold leading-tight truncate">
                            {name}
                          </div>
                        </Link>
                        <div className="mt-2 text-xs font-medium text-muted-foreground">
                          {typeLabel}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <GrapeFavoriteButton
                          grapeId={item.row.grape.id}
                          grapeSlug={item.row.grape.slug}
                          initialFavorited={true}
                          isLoggedIn={!!user}
                          labels={grapeFavoriteLabels}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              if (item.type === "aop") {
                const href = `/vignoble/${item.row.regionSlug}/${item.row.appellation.slug}?subregion=${encodeURIComponent(
                  item.row.subregionSlug,
                )}&from=favorites`;
                const name = getContent(item.row.appellation, "name", locale);

                return (
                  <div
                    key={`aop:${item.row.appellation.id}`}
                    className="shrink-0 w-[8.75rem] rounded-[22px] border border-white/70 bg-white/78 px-3 py-2.5 shadow-[0_8px_20px_rgba(91,54,35,0.08)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white hover:shadow-[0_14px_28px_rgba(91,54,35,0.12)] active:scale-[0.985]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={href}
                          prefetch
                          className="block min-w-0"
                          aria-label={name}
                        >
                          <div className="font-heading text-[0.92rem] font-semibold leading-tight truncate">
                            {name}
                          </div>
                        </Link>
                        <div className="mt-2 text-xs font-medium text-muted-foreground">
                          AOP
                        </div>
                      </div>
                      <div className="shrink-0">
                        <AppellationFavoriteButton
                          appellationId={item.row.appellation.id}
                          regionSlug={item.row.regionSlug}
                          aopSlug={item.row.appellation.slug}
                          subregionSlug={item.row.subregionSlug}
                          initialFavorited={true}
                          isLoggedIn={!!user}
                          labels={aopFavoriteLabels}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              const href = `/sols/${item.row.soil.slug}?from=favorites`;
              return (
                <div
                  key={`soil:${item.row.soil.id}`}
                  className="shrink-0 w-[8.75rem] rounded-[22px] border border-white/70 bg-white/78 px-3 py-2.5 shadow-[0_8px_20px_rgba(91,54,35,0.08)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white hover:shadow-[0_14px_28px_rgba(91,54,35,0.12)] active:scale-[0.985]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={href}
                        prefetch
                        className="block min-w-0"
                        aria-label={item.row.soil.name_fr}
                      >
                        <div className="font-heading text-[0.92rem] font-semibold leading-tight truncate">
                          {item.row.soil.name_fr}
                        </div>
                      </Link>
                      <div className="mt-2 text-xs font-medium text-muted-foreground">
                        Sol
                      </div>
                    </div>
                    <div className="shrink-0">
                      <SoilFavoriteButton
                        soilId={item.row.soil.id}
                        soilSlug={item.row.soil.slug}
                        initialFavorited={true}
                        isLoggedIn={!!user}
                        labels={soilFavoriteLabels}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-10 flex w-full min-w-0 flex-col gap-4 md:mt-12">
        <h2 className="font-heading text-[1.55rem] font-semibold tracking-tight text-foreground">
          {dict.vignoble.discover}
        </h2>
        <div className="grid grid-cols-2 gap-3.5 md:gap-4">
          <Link
            href="/vignoble/aop?from=home"
            prefetch
            className="group relative flex min-h-[116px] flex-col overflow-hidden rounded-[28px] border border-white/70 px-3.5 py-3.5 shadow-[0_10px_22px_rgba(91,54,35,0.08)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(91,54,35,0.12)] active:scale-[0.985] bg-[linear-gradient(180deg,rgba(255,240,237,0.98),rgba(255,252,250,0.96))]"
            aria-label="AOP"
          >
            <div className="pointer-events-none absolute inset-x-4 top-0 h-14 rounded-full bg-white/30 blur-2xl" />
            <div className="relative flex items-start justify-between gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/75 text-wine">
                <MapPin className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-wine/70 transition-all duration-200 group-hover:bg-white/90 group-hover:text-wine group-hover:translate-x-0.5">
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
            </div>
            <div className="relative mt-4 min-w-0 max-w-[8.75rem]">
              <div className="font-heading text-[0.95rem] font-semibold leading-tight tracking-tight">
                AOP
              </div>
              <div className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
                {locale === "en" ? "Browse appellations" : "Explorer les appellations"}
              </div>
            </div>
          </Link>

          <Link
            href="/cepages"
            prefetch
            className="group relative flex min-h-[116px] flex-col overflow-hidden rounded-[28px] border border-white/70 px-3.5 py-3.5 shadow-[0_10px_22px_rgba(91,54,35,0.08)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(91,54,35,0.12)] active:scale-[0.985] bg-[linear-gradient(180deg,rgba(245,239,255,0.98),rgba(255,252,255,0.96))]"
            aria-label={dict.nav.cepages}
          >
            <div className="pointer-events-none absolute inset-x-4 top-0 h-14 rounded-full bg-white/30 blur-2xl" />
            <div className="relative flex items-start justify-between gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/75 text-wine">
                <GrapeIcon className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-wine/70 transition-all duration-200 group-hover:bg-white/90 group-hover:text-wine group-hover:translate-x-0.5">
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
            </div>
            <div className="relative mt-4 min-w-0 max-w-[8.75rem]">
              <div className="font-heading text-[0.95rem] font-semibold leading-tight tracking-tight">
                Cépage
              </div>
              <div className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
                {locale === "en" ? "Discover grape varieties" : "Découvrir les cépages"}
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
