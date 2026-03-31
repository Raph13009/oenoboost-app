import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { VinificationTimeline } from "@/features/vinification/components/vinification-timeline";
import {
  getVinificationStepsForType,
  getVinificationTypeBySlug,
} from "@/features/vinification/queries/vinification.queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getContent } from "@/lib/i18n/get-content";
import { getServerLocale } from "@/lib/i18n/server";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const type = await getVinificationTypeBySlug(slug);
  if (!type) {
    return { title: `${dict.vinification.title} — OenoBoost` };
  }
  const name = getContent(type, "name", locale);
  return { title: `${name} — ${dict.vinification.title} — OenoBoost` };
}

export default async function VinificationDetailPage({ params }: Props) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const type = await getVinificationTypeBySlug(slug);
  if (!type) {
    notFound();
  }

  const steps = await getVinificationStepsForType(type.id);
  const name = getContent(type, "name", locale);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Link
        href="/vinification"
        className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {dict.vinification.backToVinification}
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold text-wine md:text-4xl">
          {name}
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-600 md:text-base">
          {dict.vinification.intro}
        </p>
      </header>

      {steps.length > 0 ? (
        <VinificationTimeline
          steps={steps}
          locale={locale}
          labels={{
            expand: dict.vinification.timelineExpand,
            collapse: dict.vinification.timelineCollapse,
          }}
        />
      ) : (
        <p className="text-[15px] text-muted-foreground">
          {dict.vinification.emptySteps}
        </p>
      )}
    </div>
  );
}
