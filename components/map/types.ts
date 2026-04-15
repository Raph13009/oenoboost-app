/* eslint-disable @typescript-eslint/no-explicit-any */

export type VignobleMapRegion = {
  region_id: string;
  region_slug: string;
  name: string;
  geojson: any;
  color_hex: string | null;
  department_count: number | null;
  area_hectares: number | null;
  total_production_hl: number | null;
};

export type SubregionLegendItem = {
  id: string;
  slug: string;
  name: string;
  colorHex: string;
  areaHectares: number | null;
  description: string | null;
};

export type VignobleMapStrings = {
  discover: string;
  backToRegions: string;
  backToRegion: string;
  closeLabel: string;
  departmentsLabel: string;
  hectaresLabel: string;
  totalProductionLabel: string;
  na: string;
};

export type VignobleMapLocale = "fr" | "en";
