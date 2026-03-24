"use client";

import type { VinificationType } from "../types";
import { VinificationCard } from "./vinification-card";
import { HorizontalCarousel } from "@/features/shared/components/horizontal-carousel";

type VinificationCarouselProps = {
  types: VinificationType[];
  prevLabel: string;
  nextLabel: string;
  cardPlaceholder: string;
};

export function VinificationCarousel({
  types,
  prevLabel,
  nextLabel,
  cardPlaceholder,
}: VinificationCarouselProps) {
  return (
    <HorizontalCarousel
      prevLabel={prevLabel}
      nextLabel={nextLabel}
      itemCount={types.length}
    >
      {types.map((t, index) => (
        <div key={t.id} data-carousel-card className="shrink-0 snap-center">
          <VinificationCard
            type={t}
            placeholderText={cardPlaceholder}
            variantIndex={index}
          />
        </div>
      ))}
    </HorizontalCarousel>
  );
}
