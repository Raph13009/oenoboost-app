import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getGrapes } from "@/features/cepages/queries/grapes.queries";
import { GrapeTypeEntry } from "@/features/cepages/components/grape-type-entry";
import { GrapesList } from "@/features/cepages/components/grapes-list";

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
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          {dict.cepages.title}
        </h1>
        <GrapeTypeEntry
          redLabel={dict.cepages.redGrapes}
          whiteLabel={dict.cepages.whiteGrapes}
        />
      </div>
    );
  }

  const grapes = await getGrapes(type);

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
          red: dict.cepages.red,
          white: dict.cepages.white,
          rose: dict.cepages.rose,
        }}
      />
    </div>
  );
}
