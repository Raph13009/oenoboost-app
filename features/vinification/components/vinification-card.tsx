import Link from "next/link";
import { GrapeClusterIcon } from "@/features/cepages/components/grape-cluster-icon";
import type { VinificationType } from "../types";
import { getVinificationVariant } from "./vinification-card-variants";
import { cn } from "@/lib/utils";

type VinificationCardProps = {
  type: VinificationType;
  placeholderText: string;
  /** Position dans le carrousel : 0 = vin blanc, 1 rosé, 2 rouge, 3 champagne, 4 doux, 5 macération (puis cycle). */
  variantIndex: number;
};

export function VinificationCard({
  type,
  placeholderText,
  variantIndex,
}: VinificationCardProps) {
  const v = getVinificationVariant(variantIndex);

  return (
    <Link
      href={`/vinification/${type.slug}`}
      prefetch={true}
      className="group block shrink-0"
      aria-label={type.name_fr}
    >
      <article
        className={cn(
          "grid min-h-[260px] w-47 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] overflow-hidden rounded-xl shadow-[0_18px_36px_-24px_rgba(0,0,0,0.45)] transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-[0_26px_44px_-22px_rgba(0,0,0,0.42)] md:min-h-[280px] md:w-60",
          v.card,
        )}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-2 pt-3 sm:pt-4">
          <div className={cn(v.iconWrap)}>
            <GrapeClusterIcon className="h-24 w-20 sm:h-28 sm:w-24 md:h-32 md:w-28" />
          </div>
        </div>

        <div className="flex min-h-0 flex-col justify-center gap-2 border-t border-black/[0.06] p-3 md:gap-3 md:p-4">
          <h2 className="font-heading text-base font-semibold text-foreground md:text-lg">
            {type.name_fr}
          </h2>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground md:text-sm">
            {placeholderText}
          </p>
        </div>
      </article>
    </Link>
  );
}
