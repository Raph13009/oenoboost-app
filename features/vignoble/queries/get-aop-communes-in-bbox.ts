import { createClient } from "@/lib/supabase/client";

export type AopMapItem = {
  aop_id: number;
  aop_name: string;
  /** Precomputed geodesic area in m². Null only if the backfill hasn't run. */
  area_m2: number | null;
  geometry: unknown;
};

export async function getAopCommunesInBbox(
  bbox: [number, number, number, number],
): Promise<AopMapItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_aop_communes_geojson", {
    min_lng: bbox[0],
    min_lat: bbox[1],
    max_lng: bbox[2],
    max_lat: bbox[3],
  });

  if (error) throw new Error(`Failed to fetch AOP communes: ${error.message}`);

  return (data ?? []) as AopMapItem[];
}
