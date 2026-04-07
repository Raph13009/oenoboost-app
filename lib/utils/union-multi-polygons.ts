import { featureCollection, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

/**
 * Topologically merges commune polygons into one shape per appellation (ST_Union–style).
 * Returns null if nothing valid could be built.
 */
export function unionMultiPolygons(
  geometries: GeoJSON.MultiPolygon[],
): GeoJSON.MultiPolygon | null {
  const cleaned = geometries.filter(Boolean);
  if (cleaned.length === 0) return null;
  if (cleaned.length === 1) return cleaned[0];

  const features: Array<Feature<Polygon | MultiPolygon>> = cleaned.map(
    (geometry) => ({
      type: "Feature",
      properties: {},
      geometry,
    }),
  );

  try {
    const merged = union(featureCollection(features));
    if (!merged?.geometry) {
      return unionMultiPolygonsPairwise(cleaned);
    }
    const g = merged.geometry;
    if (g.type === "Polygon") {
      return { type: "MultiPolygon", coordinates: [g.coordinates] };
    }
    return g as GeoJSON.MultiPolygon;
  } catch {
    return unionMultiPolygonsPairwise(cleaned);
  }
}

function unionMultiPolygonsPairwise(
  geometries: GeoJSON.MultiPolygon[],
): GeoJSON.MultiPolygon | null {
  if (geometries.length === 0) return null;
  let acc: Feature<Polygon | MultiPolygon> = {
    type: "Feature",
    properties: {},
    geometry: geometries[0],
  };

  for (let i = 1; i < geometries.length; i++) {
    const next: Feature<Polygon | MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: geometries[i],
    };
    try {
      const merged = union(featureCollection([acc, next]));
      if (!merged?.geometry) return null;
      acc = merged as Feature<Polygon | MultiPolygon>;
    } catch {
      return null;
    }
  }

  const g = acc.geometry;
  if (g.type === "Polygon") {
    return { type: "MultiPolygon", coordinates: [g.coordinates] };
  }
  return g as MultiPolygon;
}
