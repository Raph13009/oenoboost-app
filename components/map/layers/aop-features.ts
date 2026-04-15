import { area } from "@turf/turf";

import { CONTRAST_SUBREGION_COLORS } from "../geo/color";
import { normalizeToMultiPolygon } from "../geo/geometry";

export type AopFeatureProperties = {
  aop_id: number;
  aop_name: string;
  color_hex: string;
  /** Geodesic area in m² — used for render ordering and smallest-pick hit-testing. */
  area_m2: number;
};

export type AopFeature = {
  type: "Feature";
  id: number;
  properties: AopFeatureProperties;
  geometry: GeoJSON.MultiPolygon;
};

export type AopInput = {
  aop_id: number;
  aop_name: string;
  geometry: unknown;
  /**
   * Server-precomputed geodesic area in m². When present, used as-is to avoid
   * recomputing the same value on every client fetch. Falls back to a
   * client-side turf computation if missing (e.g. a stale backfill).
   */
  area_m2?: number | null;
};

/**
 * Normalize AOP rows into Mapbox features, assign an area to each, and sort
 * descending by area. Mapbox paints fill features in source order (later on
 * top), so sorting descending means smaller AOPs paint on top of larger ones
 * — which is what keeps the smaller appellation reachable where they overlap.
 *
 * The server's `get_aop_communes_geojson` RPC already returns rows sorted by
 * `area_m2 desc nulls last`; the client-side sort here is a defensive backstop
 * for null-area rows (pushed last by the server) and for any future caller
 * building features from a non-RPC source.
 */
export function buildAopFeatures(aops: AopInput[]): AopFeature[] {
  const features: AopFeature[] = [];

  for (const aop of aops) {
    const normalized = normalizeToMultiPolygon(aop.geometry);
    if (!normalized) continue;

    const color =
      CONTRAST_SUBREGION_COLORS[
        Math.abs(aop.aop_id) % CONTRAST_SUBREGION_COLORS.length
      ];

    const areaM2 =
      typeof aop.area_m2 === "number" && Number.isFinite(aop.area_m2)
        ? aop.area_m2
        : area({
            type: "Feature",
            properties: {},
            geometry: normalized,
          });

    features.push({
      type: "Feature",
      id: aop.aop_id,
      properties: {
        aop_id: aop.aop_id,
        aop_name: aop.aop_name,
        color_hex: color,
        area_m2: areaM2,
      },
      geometry: normalized,
    });
  }

  features.sort((a, b) => b.properties.area_m2 - a.properties.area_m2);
  return features;
}

type HitFeature = { properties?: { area_m2?: number } | null };

/**
 * Pick the smallest feature (by `area_m2`) from a set of hit-tested features.
 * Decoupling hit-testing from render order guarantees that a user pointing at
 * a small AOP overlapping a larger one selects the small AOP, even if the
 * render stack happened to paint them the other way round.
 */
export function pickSmallestFeature<F extends HitFeature>(
  feats: readonly F[],
): F | null {
  if (feats.length === 0) return null;
  let best = feats[0];
  let bestArea = best.properties?.area_m2 ?? Infinity;
  for (let i = 1; i < feats.length; i++) {
    const f = feats[i];
    const a = f.properties?.area_m2 ?? Infinity;
    if (a < bestArea) {
      best = f;
      bestArea = a;
    }
  }
  return best;
}
