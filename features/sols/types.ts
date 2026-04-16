export type { SoilType } from "@/types/database";

export type RelatedAop = {
  id: number;
  slug: string;
  name: string;
  region_slug: string;
  subregion_slug: string;
};

export type RelatedSoil = {
  id: string;
  slug: string;
  name_fr: string;
  is_premium: boolean;
};
