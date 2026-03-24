import Link from "next/link";
import type { SoilType } from "../types";
import { getSoilSummary } from "../utils";
import { SoilCoverImage } from "./soil-cover-image";

type SoilCardProps = {
  soil: SoilType;
};

export function SoilCard({ soil }: SoilCardProps) {
  return (
    <Link
      href={`/sols/${soil.slug}`}
      className="group block shrink-0"
      aria-label={soil.name_fr}
    >
      <article className="flex w-47 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_18px_36px_-24px_rgba(0,0,0,0.45)] transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:border-wine/15 hover:shadow-[0_26px_44px_-22px_rgba(0,0,0,0.42)] md:w-60">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden">
          <SoilCoverImage
            photoUrl={soil.photo_url}
            alt={soil.name_fr}
            fill
            sizes="(max-width: 768px) 47vw, 240px"
            className="object-cover transition duration-500 ease-out group-hover:scale-[1.04] group-hover:brightness-[1.03]"
          />
        </div>

        <div className="flex min-h-0 flex-col justify-between gap-2 p-3 md:gap-3 md:p-4">
          <h2 className="font-heading text-base font-semibold text-foreground md:text-lg">
            {soil.name_fr}
          </h2>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground md:text-sm">
            {getSoilSummary(soil)}
          </p>
        </div>
      </article>
    </Link>
  );
}
