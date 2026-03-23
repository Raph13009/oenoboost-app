import Link from "next/link";

import { GrapeClusterIcon } from "./grape-cluster-icon";

type GrapeTypeEntryProps = {
  whiteLabel: string;
  whiteSubtitle: string;
  redLabel: string;
  redSubtitle: string;
};

export function GrapeTypeEntry({
  whiteLabel,
  whiteSubtitle,
  redLabel,
  redSubtitle,
}: GrapeTypeEntryProps) {
  const cardBase =
    "group flex min-h-[15rem] flex-col items-center justify-between rounded-[14px] border px-2.5 py-4 transition-all duration-200 ease-out sm:min-h-[20rem] sm:rounded-[18px] sm:px-6 sm:py-8 md:min-h-[22rem] " +
    "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "hover:scale-[1.02] active:scale-[0.99]";

  const titleClass =
    "font-heading font-medium tracking-[0.02em] text-foreground text-[0.95rem] leading-snug sm:text-xl md:text-2xl";

  const subtitleClass =
    "mt-1.5 text-[11px] leading-relaxed text-muted-foreground sm:mt-2 sm:text-sm";

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-3 sm:gap-6 md:gap-8">
      <Link
        href="/cepages?type=white"
        className={
          cardBase +
          " border-black/[0.08] bg-[#FDFCFA] hover:bg-[#F7F5F2] " +
          "border-[1.5px]"
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center pt-1 sm:pt-2">
          <div className="text-[#8A7968] transition-colors duration-200 group-hover:text-[#756555]">
            <GrapeClusterIcon className="h-28 w-18 sm:h-36 sm:w-32 md:h-48 md:w-40" />
          </div>
        </div>
        <div className="mt-3 w-full text-center sm:mt-6">
          <h2 className={titleClass}>{whiteLabel}</h2>
          <p className={subtitleClass}>{whiteSubtitle}</p>
        </div>
      </Link>

      <Link
        href="/cepages?type=red"
        className={
          cardBase +
          " border-[#C99595]/65 bg-[#F3E4E4] hover:bg-[#E9D4D4] " +
          "border-[1.5px]"
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center pt-1 sm:pt-2">
          <div className="text-wine transition-colors duration-200 group-hover:text-wine-dark">
            <GrapeClusterIcon className="h-28 w-18 sm:h-36 sm:w-32 md:h-48 md:w-40" />
          </div>
        </div>
        <div className="mt-3 w-full text-center sm:mt-6">
          <h2 className={titleClass}>{redLabel}</h2>
          <p className={subtitleClass}>{redSubtitle}</p>
        </div>
      </Link>
    </div>
  );
}
