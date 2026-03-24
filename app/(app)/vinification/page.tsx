import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { VinificationCarousel } from "@/features/vinification/components/vinification-carousel";
import { VinificationScrollLock } from "@/features/vinification/components/vinification-scroll-lock";
import { getPublishedVinificationTypes } from "@/features/vinification/queries/vinification.queries";

export const metadata = {
  title: "Vinification — OenoBoost",
};

export default async function VinificationPage() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const types = await getPublishedVinificationTypes();

  return (
    <>
      <VinificationScrollLock />
      <div
        className={
          types.length > 0
            ? "flex min-h-0 flex-col gap-4 md:gap-6"
            : "flex h-[calc(100vh-3.5rem-2rem-1rem)] min-h-0 flex-col gap-8"
        }
      >
        <header className="flex shrink-0 flex-col gap-2 md:gap-3">
          <h1 className="font-heading text-3xl font-semibold md:text-4xl">
            {dict.vinification.title}
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-600 md:text-base">
            {dict.vinification.intro}
          </p>
        </header>

        {types.length === 0 ? (
          <p className="flex min-h-0 flex-1 items-center justify-center text-center text-muted-foreground">
            {dict.common.empty}
          </p>
        ) : (
          <div className="-mx-6 w-[calc(100%+3rem)] flex-none shrink-0 self-stretch pb-2 md:mx-0 md:ml-[calc(50%-50vw)] md:w-screen md:max-w-[100vw] md:pb-4">
            <VinificationCarousel
              types={types}
              prevLabel={dict.vinification.carouselPrevAria}
              nextLabel={dict.vinification.carouselNextAria}
              cardPlaceholder={dict.vinification.cardPlaceholder}
            />
          </div>
        )}
      </div>
    </>
  );
}
