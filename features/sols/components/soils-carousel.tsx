"use client";

import type { SoilType } from "../types";
import { SoilCard } from "./soil-card";
import { HorizontalCarousel } from "@/features/shared/components/horizontal-carousel";

type SoilsCarouselProps = {
  soils: SoilType[];
  prevLabel: string;
  nextLabel: string;
};

export function SoilsCarousel({ soils, prevLabel, nextLabel }: SoilsCarouselProps) {
  return (
    <HorizontalCarousel
      prevLabel={prevLabel}
      nextLabel={nextLabel}
      itemCount={soils.length}
    >
      {soils.map((soil) => (
        <div key={soil.id} data-carousel-card className="shrink-0 snap-center">
          <SoilCard soil={soil} />
        </div>
      ))}
    </HorizontalCarousel>
  );
}
