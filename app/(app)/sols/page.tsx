import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { SoilsCarousel } from "@/features/sols/components/soils-carousel";
import { SolsScrollLock } from "@/features/sols/components/sols-scroll-lock";
import { getPublishedSoils } from "@/features/sols/queries/soils.queries";

export const metadata = {
  title: "Sols — OenoBoost",
};

export default async function SoilsPage() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const soils = await getPublishedSoils();

  return (
    <>
      {/** Uniquement l’accueil /sols : pas de scroll vertical page (les fiches /sols/[slug] restent scrollables). */}
      <SolsScrollLock />
      <div
        className={
          soils.length > 0
            ? "flex min-h-0 flex-col gap-8 md:gap-12"
            : "flex min-h-[calc(100dvh-3.5rem)] flex-col gap-8 md:min-h-0"
        }
      >
      <header className="flex shrink-0 flex-col gap-2 md:gap-3">
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          {dict.sols.title}
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-600 md:text-base">
          {dict.sols.intro}
        </p>
      </header>

        {soils.length === 0 ? (
        <p className="flex min-h-[16rem] items-center justify-center text-center text-muted-foreground">
          {dict.common.empty}
        </p>
      ) : (
        <div
          className="-mx-6 w-[calc(100%+3rem)] flex-none shrink-0 self-stretch pb-2 md:mx-0 md:ml-[calc(50%-50vw)] md:w-screen md:max-w-[100vw] md:pb-4"
        >
          <SoilsCarousel
            soils={soils}
            prevLabel={dict.sols.carouselPrevAria}
            nextLabel={dict.sols.carouselNextAria}
          />
        </div>
      )}
    </div>
    </>
  );
}
