"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";

import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { getSubregionsByRegionId } from "@/features/vignoble/queries/get-subregions-by-region-id";
import { getAppellationCommunesBySubregionIds } from "@/features/vignoble/queries/get-appellation-communes-by-subregion-ids";
import { unionMultiPolygons } from "@/lib/utils/union-multi-polygons";
import { XIcon } from "lucide-react";

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

const sourceId = "vignoble-regions";
const fillLayerId = "vignoble-regions-fill";
const subSourceId = "vignoble-subregions";
const subFillLayerId = "vignoble-subregions-fill";
const subOutlineLayerId = "vignoble-subregions-outline";
const aopSourceId = "vignoble-aops";
const aopFillLayerId = "vignoble-aops-fill";
const aopOutlineLayerId = "vignoble-aops-outline";
const aopPointsSourceId = "vignoble-aops-centroids";
const aopFallbackSourceId = "vignoble-aops-fallback-poly";
const aopFallbackFillLayerId = "vignoble-aops-fallback-fill";
const aopFallbackOutlineLayerId = "vignoble-aops-fallback-outline";
const aopLabelLayerId = "vignoble-aops-centroid-labels";

function validCentroidLngLat(
  lng: number | null | undefined,
  lat: number | null | undefined,
): [number, number] | null {
  if (lng == null || lat == null) return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
}

/** Small irregular quadrilateral (~1 km across) for AOPs without commune geometry; deterministic from id. */
function buildCentroidFallbackPolygon(
  lng: number,
  lat: number,
  seedId: string,
): GeoJSON.Polygon {
  const halfSideM = 520;
  const latRad = (lat * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = Math.max(1e-6, 111320 * Math.cos(latRad));

  let h = 2166136261;
  for (let i = 0; i < seedId.length; i++) {
    h ^= seedId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = (bits: number) => {
    const x = (h >>> bits) & 0xff;
    return 0.88 + (x / 255) * 0.24;
  };

  const dx = (i: number) => (halfSideM * r(i * 3)) / mPerDegLng;
  const dy = (i: number) => (halfSideM * r(i * 3 + 1)) / mPerDegLat;

  const corners: [number, number][] = [
    [lng - dx(0), lat - dy(1)],
    [lng + dx(2), lat - dy(3)],
    [lng + dx(4), lat + dy(5)],
    [lng - dx(6), lat + dy(7)],
  ];
  return {
    type: "Polygon",
    coordinates: [[...corners, corners[0]]],
  };
}

type SubregionLegendItem = {
  id: string;
  slug: string;
  name: string;
  colorHex: string;
  areaHectares: number | null;
  description: string | null;
};

const CONTRAST_SUBREGION_COLORS = [
  "#f4d35e", // yellow
  "#6bbf59", // green
  "#4ea8de", // bright blue
  "#3d5a80", // blue
  "#e07a5f", // terracotta
  "#81b29a", // sage
  "#9381ff", // violet
  "#ff8fab", // rose
];

const shouldDebugAopMap =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_DEBUG_AOP_MAP === "1";

function normalizeHexColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHexColors(baseHex: string, targetHex: string, amount: number) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  if (!base || !target) return baseHex;
  const t = clamp(amount, 0, 1);
  return rgbToHex(
    base.r + (target.r - base.r) * t,
    base.g + (target.g - base.g) * t,
    base.b + (target.b - base.b) * t,
  );
}

function shiftHexTone(baseHex: string, offset: number) {
  if (offset === 0) return baseHex;
  return offset > 0
    ? mixHexColors(baseHex, "#ffffff", offset)
    : mixHexColors(baseHex, "#10212d", Math.abs(offset));
}

function buildShadeOffsets(count: number) {
  if (count <= 1) return [-0.08];
  const start = -0.24;
  const end = 0.34;
  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    return start + (end - start) * ratio;
  });
}

function buildSubregionAopColorMap(
  rows: Array<{
    id: string;
    slug: string;
    subregion_id: string | null;
  }>,
  subregionColorById: Map<string, string>,
) {
  const grouped = new Map<string, Array<{ id: string; slug: string }>>();
  for (const row of rows) {
    if (!row.subregion_id) continue;
    const group = grouped.get(row.subregion_id) ?? [];
    group.push({ id: row.id, slug: row.slug });
    grouped.set(row.subregion_id, group);
  }

  const colorById = new Map<string, string>();

  for (const [subregionId, appellations] of grouped) {
    const baseColor =
      subregionColorById.get(subregionId) ??
      CONTRAST_SUBREGION_COLORS[0];
    const sorted = appellations
      .slice()
      .sort((a, b) => a.slug.localeCompare(b.slug));
    const offsets = buildShadeOffsets(sorted.length);
    sorted.forEach((appellation, index) => {
      colorById.set(appellation.id, shiftHexTone(baseColor, offsets[index] ?? 0));
    });
  }

  return colorById;
}

function getSubregionBaseColor(
  colorHex: string | null | undefined,
  fallbackIndex: number,
) {
  return (
    normalizeHexColor(colorHex) ??
    CONTRAST_SUBREGION_COLORS[fallbackIndex % CONTRAST_SUBREGION_COLORS.length]
  );
}

function computeMultiPolygonBounds(geometry: GeoJSON.MultiPolygon) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const coord of ring) {
        const lng = coord[0];
        const lat = coord[1];
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ] as const;
}

function normalizeToMultiPolygon(geojson: any): GeoJSON.MultiPolygon | null {
  if (!geojson) return null;
  const g = geojson.type === "Feature" ? geojson.geometry : geojson;
  if (!g || typeof g !== "object") return null;

  if (g.type === "MultiPolygon") return g as GeoJSON.MultiPolygon;
  if (g.type === "Polygon") {
    return { type: "MultiPolygon", coordinates: [g.coordinates] } satisfies GeoJSON.MultiPolygon;
  }
  return null;
}


type RegionFeature = {
  type: "Feature";
  id: string;
  properties: {
    region_slug: string;
    color_hex: string;
    name: string;
  };
  geometry: GeoJSON.MultiPolygon;
};

export function VignobleMap({
  regions,
  heightClassName = "h-full",
  locale,
  initialRegionSlug,
  initialSubregionSlug,
  strings,
}: {
  regions: VignobleMapRegion[];
  heightClassName?: string;
  locale: "fr" | "en";
  initialRegionSlug?: string;
  initialSubregionSlug?: string;
  strings: {
    discover: string;
    backToRegions: string;
    backToRegion: string;
    closeLabel: string;
    departmentsLabel: string;
    hectaresLabel: string;
    totalProductionLabel: string;
    na: string;
  };
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    null,
  );
  const [subregionsLoading, setSubregionsLoading] = useState(false);
  const [subregionsMode, setSubregionsMode] = useState(false);
  const [aopVisible, setAopVisible] = useState(false);
  const [aopLoading, setAopLoading] = useState(false);
  const aopInteractionHandlersRef = useRef<
    Array<{
      event: "mousemove" | "mouseleave" | "mouseout" | "click";
      layerId: string | null;
      handler: (...args: any[]) => void;
    }>
  >([]);
  const aopRenderModeRef = useRef<"none" | "polygons">("none");
  const aopPopupRef = useRef<any>(null);
  const aopVisibleRef = useRef(false);
  const subregionsModeRef = useRef(false);
  const subLayerHandlersRef = useRef<{
    onMove: ((e: any) => void) | null;
    onLeave: (() => void) | null;
    onMapClick: ((e: any) => void) | null;
  } | null>(null);
  const [subregionLegendItems, setSubregionLegendItems] = useState<
    SubregionLegendItem[]
  >([]);
  const [selectedSubregionId, setSelectedSubregionId] = useState<string | null>(
    null,
  );
  const subregionRowsRef = useRef<
    Array<{
      id: string;
      slug: string;
      name: string;
      colorHex: string;
      geojson: GeoJSON.MultiPolygon;
      areaHectares: number | null;
      description: string | null;
    }>
  >([]);
  const subregionColorByIdRef = useRef<Map<string, string>>(new Map());

  const regionById = useMemo(() => {
    return new Map(regions.map((r) => [r.region_id, r]));
  }, [regions]);

  const regionBySlug = useMemo(() => {
    return new Map(regions.map((r) => [r.region_slug, r]));
  }, [regions]);

  const selectedRegion = selectedRegionId
    ? regionById.get(selectedRegionId) ?? null
    : null;
  const selectedSubregion = selectedSubregionId
    ? subregionLegendItems.find((s) => s.id === selectedSubregionId) ?? null
    : null;

  const cardRef = useRef<HTMLDivElement | null>(null);
  const lastFittedRegionIdRef = useRef<string | null>(null);
  const currentSubregionIdsRef = useRef<string[]>([]);
  const currentRegionSubregionsBoundsRef = useRef<
    [[number, number], [number, number]] | null
  >(null);
  const initialFocusHandledRef = useRef(false);
  const showSubregionsForRegionRef = useRef(showSubregionsForRegion);

  useEffect(() => {
    aopVisibleRef.current = aopVisible;
  }, [aopVisible]);

  useEffect(() => {
    subregionsModeRef.current = subregionsMode;
  }, [subregionsMode]);

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  function getRegionBounds(region: VignobleMapRegion) {
    const normalized = normalizeToMultiPolygon(region.geojson);
    if (!normalized) return null;
    return computeMultiPolygonBounds(normalized);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!sheetOpen) return;
    if (!selectedRegion) return;
    if (subregionsMode) return; // when subregions are shown, we already fit to them

    const regionId = selectedRegion.region_id;
    if (lastFittedRegionIdRef.current === regionId) return;

    // Wait for the panel to render so the bottom padding is accurate.
    const raf = requestAnimationFrame(() => {
      const cardHeight = cardRef.current?.getBoundingClientRect().height ?? 0;
      const bounds = getRegionBounds(selectedRegion);
      if (!bounds) return;

      map.fitBounds(bounds, {
        padding: {
          top: 12,
          left: 12,
          right: 12,
          bottom: Math.round(cardHeight + 10),
        },
        duration: 220,
        maxZoom: 7,
      });

      lastFittedRegionIdRef.current = regionId;
    });

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [sheetOpen, selectedRegion, subregionsMode]);

  useEffect(() => {
    if (sheetOpen) return;
    // Keep camera in sync when the panel disappears.
    try {
      mapRef.current?.resize();
    } catch {
      // ignore
    }
  }, [sheetOpen]);

  const geojson = useMemo(() => {
    const features = regions
      .map((r) => {
        const base = normalizeHexColor(r.color_hex);
        if (!base) return null;
        const normalized = normalizeToMultiPolygon(r.geojson);
        if (!normalized) return null;

        return {
          type: "Feature" as const,
          id: r.region_id,
          properties: {
            region_slug: r.region_slug,
            color_hex: base,
            name: r.name,
          },
          geometry: normalized,
        };
      })
      .filter((f): f is RegionFeature => {
        return f !== null;
      });

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [regions]);

  const fitBounds = useMemo(() => {
    if (regions.length === 0) return null;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    for (const r of regions) {
      const normalized = normalizeToMultiPolygon(r.geojson);
      if (!normalized) continue;
      const b = computeMultiPolygonBounds(normalized);
      if (!b) continue;
      minLng = Math.min(minLng, b[0][0]);
      minLat = Math.min(minLat, b[0][1]);
      maxLng = Math.max(maxLng, b[1][0]);
      maxLat = Math.max(maxLat, b[1][1]);
    }

    if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;

    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ] as const;
  }, [regions]);

  function fitToDefaultFranceView() {
    const map = mapRef.current;
    if (!map) return;
    if (!fitBounds) return;

    // Default: show whole France framing.
    map.fitBounds(fitBounds, {
      padding: 6,
      maxZoom: 7.8,
      duration: 220,
    });
  }

  function fitToCurrentRegionSubregionsView() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = currentRegionSubregionsBoundsRef.current;
    if (!bounds) return;

    map.fitBounds(bounds, {
      padding: 22,
      maxZoom: 8,
      duration: 220,
    });
  }

  function focusSubregion(subregionId: string) {
    const map = mapRef.current;
    if (!map) return;

    const sub = subregionRowsRef.current.find((s) => s.id === subregionId);
    if (!sub) return;

    const bounds = computeMultiPolygonBounds(sub.geojson);
    if (!bounds) return;

    setSelectedSubregionId(subregionId);
    map.fitBounds(bounds, {
      padding: 26,
      maxZoom: 9.2,
      duration: 220,
    });
  }

  function cleanupAopLayers(map: any) {
    if (aopInteractionHandlersRef.current.length > 0) {
      for (const interaction of aopInteractionHandlersRef.current) {
        if (interaction.layerId) {
          map.off(interaction.event, interaction.layerId, interaction.handler);
        } else {
          map.off(interaction.event, interaction.handler);
        }
      }
      aopInteractionHandlersRef.current = [];
    }
    if (aopPopupRef.current) {
      aopPopupRef.current.remove();
      aopPopupRef.current = null;
    }
    if (map.getLayer(aopLabelLayerId)) map.removeLayer(aopLabelLayerId);
    if (map.getLayer(aopFallbackOutlineLayerId)) {
      map.removeLayer(aopFallbackOutlineLayerId);
    }
    if (map.getLayer(aopFallbackFillLayerId)) map.removeLayer(aopFallbackFillLayerId);
    if (map.getSource(aopFallbackSourceId)) map.removeSource(aopFallbackSourceId);
    if (map.getSource(aopPointsSourceId)) map.removeSource(aopPointsSourceId);
    if (map.getLayer(aopOutlineLayerId)) map.removeLayer(aopOutlineLayerId);
    if (map.getLayer(aopFillLayerId)) map.removeLayer(aopFillLayerId);
    if (map.getSource(aopSourceId)) map.removeSource(aopSourceId);
  }

  async function toggleAopLayer(options?: {
    forceShow?: boolean;
    targetSubregionId?: string | null;
  }) {
    const map = mapRef.current;
    const forceShow = options?.forceShow === true;
    if (!map || (!subregionsMode && !subregionsModeRef.current && !forceShow)) {
      return;
    }

    if (aopVisible && !forceShow) {
      cleanupAopLayers(map);
      aopRenderModeRef.current = "none";
      setAopVisible(false);
      aopVisibleRef.current = false;
      return;
    }

    setAopLoading(true);
    try {
      cleanupAopLayers(map);

      const scopedSubregionIds = currentSubregionIdsRef.current;
      const appellationsWithCommunes =
        await getAppellationCommunesBySubregionIds(scopedSubregionIds);

      const aopColorById = buildSubregionAopColorMap(
        appellationsWithCommunes.map((row) => ({
          id: row.id,
          slug: row.slug,
          subregion_id: row.subregion_id,
        })),
        subregionColorByIdRef.current,
      );

      if (shouldDebugAopMap) {
        console.info("[aop-map][render] appellations with communes", {
          appellationCount: appellationsWithCommunes.length,
          sample: appellationsWithCommunes.slice(0, 5).map((a) => ({
            id: a.id,
            slug: a.slug,
            communeCount: a.communes.length,
          })),
        });
      }

      type AopPolygonProperties = {
        appellation_id: string;
        appellation_slug: string;
        appellation_name: string;
        display_label: string;
        subregion_id: string | null;
        color_hex: string;
        uses_subregion_geometry_fallback: boolean;
        label_lng?: number;
        label_lat?: number;
      };

      const fallbackFirstFeatures: Array<{
        type: "Feature";
        id: string;
        properties: AopPolygonProperties;
        geometry: GeoJSON.MultiPolygon;
      }> = [];
      const communeFeatures: typeof fallbackFirstFeatures = [];

      const centroidPointFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];

      const centroidFallbackPolyFeatures: Array<{
        type: "Feature";
        id: string;
        properties: AopPolygonProperties & { is_centroid_fallback_poly: true };
        geometry: GeoJSON.Polygon;
      }> = [];

      for (const aop of appellationsWithCommunes) {
        const color =
          aopColorById.get(aop.id) ??
          subregionColorByIdRef.current.get(aop.subregion_id ?? "") ??
          CONTRAST_SUBREGION_COLORS[0];
        const aopNameFr = aop.name_fr;
        const aopNameEn = aop.name_en;
        const displayLabel = locale === "en" ? aopNameEn : aopNameFr;

        const seenCommuneIds = new Set<string>();
        const communeGeoms: GeoJSON.MultiPolygon[] = [];
        for (const commune of aop.communes) {
          if (!commune.geometry || seenCommuneIds.has(commune.id)) continue;
          seenCommuneIds.add(commune.id);
          const normalized = normalizeToMultiPolygon(commune.geometry);
          if (normalized) communeGeoms.push(normalized);
        }

        const mergedFromCommunes = unionMultiPolygons(communeGeoms);
        const centroid = validCentroidLngLat(aop.centroid_lng, aop.centroid_lat);

        let displayGeometry: GeoJSON.MultiPolygon | null = mergedFromCommunes;
        let usesSubregionGeometryFallback = false;

        if (!displayGeometry && !centroid && communeGeoms.length === 0 && aop.subregion_id) {
          const parentSub = subregionRowsRef.current.find(
            (s) => s.id === aop.subregion_id,
          );
          if (parentSub?.geojson) {
            displayGeometry = normalizeToMultiPolygon(parentSub.geojson);
            usesSubregionGeometryFallback = true;
            if (shouldDebugAopMap) {
              console.info("[aop-map][render] subregion geometry fallback", {
                id: aop.id,
                slug: aop.slug,
                subregion_id: aop.subregion_id,
              });
            }
          }
        }

        const labelLng = centroid?.[0];
        const labelLat = centroid?.[1];

        if (centroid) {
          centroidPointFeatures.push({
            type: "Feature",
            id: aop.id,
            geometry: { type: "Point", coordinates: centroid },
            properties: {
              appellation_id: aop.id,
              appellation_slug: aop.slug,
              appellation_name: displayLabel,
              display_label: displayLabel,
              subregion_id: aop.subregion_id,
              color_hex: color,
              label_lng: labelLng,
              label_lat: labelLat,
            },
          });
        }

        if (!displayGeometry) {
          if (centroid) {
            centroidFallbackPolyFeatures.push({
              type: "Feature",
              id: aop.id,
              geometry: buildCentroidFallbackPolygon(
                centroid[0],
                centroid[1],
                aop.id,
              ),
              properties: {
                appellation_id: aop.id,
                appellation_slug: aop.slug,
                appellation_name: displayLabel,
                display_label: displayLabel,
                subregion_id: aop.subregion_id,
                color_hex: color,
                uses_subregion_geometry_fallback: false,
                is_centroid_fallback_poly: true,
                ...(labelLng != null && labelLat != null
                  ? { label_lng: labelLng, label_lat: labelLat }
                  : {}),
              },
            });
          } else if (shouldDebugAopMap) {
            console.warn("[aop-map][render] skipped appellation (no geometry)", {
              id: aop.id,
              slug: aop.slug,
              communeGeomCount: communeGeoms.length,
            });
          }
          continue;
        }

        const baseProps: AopPolygonProperties = {
          appellation_id: aop.id,
          appellation_slug: aop.slug,
          appellation_name: displayLabel,
          display_label: displayLabel,
          subregion_id: aop.subregion_id,
          color_hex: color,
          uses_subregion_geometry_fallback: usesSubregionGeometryFallback,
        };
        if (labelLng != null && labelLat != null) {
          baseProps.label_lng = labelLng;
          baseProps.label_lat = labelLat;
        }

        const feat = {
          type: "Feature" as const,
          id: aop.id,
          properties: baseProps,
          geometry: displayGeometry,
        };

        if (usesSubregionGeometryFallback) {
          fallbackFirstFeatures.push(feat);
        } else {
          communeFeatures.push(feat);
        }
      }

      const polygonFeatures = [...fallbackFirstFeatures, ...communeFeatures];

      if (shouldDebugAopMap) {
        console.info("[aop-map][render] features built", {
          polygonCount: polygonFeatures.length,
          centroidFallbackPolyCount: centroidFallbackPolyFeatures.length,
          centroidPoints: centroidPointFeatures.length,
        });
      }

      const hasPolygons = polygonFeatures.length > 0;
      const hasCentroidFallbackPolys = centroidFallbackPolyFeatures.length > 0;
      const hasCentroidPoints = centroidPointFeatures.length > 0;

      if (hasPolygons) {
        map.addSource(aopSourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features: polygonFeatures },
        });

        map.addLayer({
          id: aopFillLayerId,
          type: "fill",
          source: aopSourceId,
          paint: {
            "fill-color": ["get", "color_hex"],
            "fill-opacity": 0.58,
          },
        });

        map.addLayer({
          id: aopOutlineLayerId,
          type: "line",
          source: aopSourceId,
          paint: {
            "line-color": "rgba(0,0,0,0.10)",
            "line-width": 0.5,
          },
        });
      }

      if (hasCentroidFallbackPolys) {
        map.addSource(aopFallbackSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: centroidFallbackPolyFeatures,
          },
        });

        map.addLayer({
          id: aopFallbackFillLayerId,
          type: "fill",
          source: aopFallbackSourceId,
          paint: {
            "fill-color": ["get", "color_hex"],
            "fill-opacity": 0.72,
          },
        });

        map.addLayer({
          id: aopFallbackOutlineLayerId,
          type: "line",
          source: aopFallbackSourceId,
          paint: {
            "line-color": "rgba(0,0,0,0.22)",
            "line-width": 1.2,
          },
        });
      }

      if (hasCentroidPoints) {
        map.addSource(aopPointsSourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features: centroidPointFeatures },
        });

        map.addLayer({
          id: aopLabelLayerId,
          type: "symbol",
          source: aopPointsSourceId,
          layout: {
            "text-field": ["get", "display_label"],
            "text-font": [
              "Open Sans Semibold",
              "Arial Unicode MS Regular",
            ],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              9,
              12,
              10.5,
              16,
              12,
            ],
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            "text-padding": 8,
            "text-max-width": 14,
          },
          paint: {
            "text-color": "#7c2736",
            "text-halo-color": "#fffded",
            "text-halo-width": 1.1,
            "text-halo-blur": 0.2,
            "text-opacity": 0.92,
          },
          minzoom: 9,
        });
      }

      if (map.getLayer(subOutlineLayerId)) {
        map.moveLayer(subOutlineLayerId);
      }

      let hoveredAppellationId: string | null = null;

      const mapboxglMod: any = await import("mapbox-gl");
      const mapboxgl = mapboxglMod.default ?? mapboxglMod;

      const tooltip = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: "vignoble-aop-tooltip",
      });

      const isSubregionGeometryFallbackFeature = (f: any) => {
        const v = f?.properties?.uses_subregion_geometry_fallback;
        return v === true || v === "true";
      };

      const activeAopPickLayers = (): string[] => {
        const ids: string[] = [];
        if (map.getLayer(aopFallbackFillLayerId)) {
          ids.push(aopFallbackFillLayerId);
        }
        if (map.getLayer(aopFallbackOutlineLayerId)) {
          ids.push(aopFallbackOutlineLayerId);
        }
        if (map.getLayer(aopFillLayerId)) ids.push(aopFillLayerId);
        if (map.getLayer(aopLabelLayerId)) ids.push(aopLabelLayerId);
        return ids;
      };

      /** Centroid-fallback polys are above commune fills so they win hits; then commune, then subregion fallback; labels last. */
      const pickAopFeatureAtPoint = (point: { x: number; y: number }) => {
        const layers = activeAopPickLayers();
        if (layers.length === 0) return null;
        const stack = map.queryRenderedFeatures(point, {
          layers,
        }) as any[];
        if (!stack?.length) return null;
        const fallbackHit = stack.find(
          (f) =>
            f.layer?.id === aopFallbackFillLayerId ||
            f.layer?.id === aopFallbackOutlineLayerId,
        );
        if (fallbackHit) return fallbackHit;
        const fillNonSub = stack.find(
          (f) =>
            f.layer?.id === aopFillLayerId &&
            !isSubregionGeometryFallbackFeature(f),
        );
        if (fillNonSub) return fillNonSub;
        const fillAny = stack.find((f) => f.layer?.id === aopFillLayerId);
        if (fillAny) return fillAny;
        return stack[0];
      };

      const resetAopHoverPaint = () => {
        if (map.getLayer(aopFillLayerId)) {
          map.setPaintProperty(aopFillLayerId, "fill-opacity", 0.58);
        }
        if (map.getLayer(aopOutlineLayerId)) {
          map.setPaintProperty(aopOutlineLayerId, "line-width", 0.5);
          map.setPaintProperty(
            aopOutlineLayerId,
            "line-color",
            "rgba(0,0,0,0.10)",
          );
        }
        if (map.getLayer(aopFallbackFillLayerId)) {
          map.setPaintProperty(aopFallbackFillLayerId, "fill-opacity", 0.72);
        }
        if (map.getLayer(aopFallbackOutlineLayerId)) {
          map.setPaintProperty(aopFallbackOutlineLayerId, "line-width", 1.2);
          map.setPaintProperty(
            aopFallbackOutlineLayerId,
            "line-color",
            "rgba(0,0,0,0.22)",
          );
        }
      };

      const applyAopHoverPaint = (appId: string) => {
        if (map.getLayer(aopFillLayerId)) {
          map.setPaintProperty(aopFillLayerId, "fill-opacity", [
            "case",
            ["==", ["get", "appellation_id"], appId],
            0.8,
            0.4,
          ]);
        }
        if (map.getLayer(aopOutlineLayerId)) {
          map.setPaintProperty(aopOutlineLayerId, "line-width", [
            "case",
            ["==", ["get", "appellation_id"], appId],
            1.6,
            0.5,
          ]);
          map.setPaintProperty(aopOutlineLayerId, "line-color", [
            "case",
            ["==", ["get", "appellation_id"], appId],
            "rgba(0,0,0,0.32)",
            "rgba(0,0,0,0.10)",
          ]);
        }
        if (map.getLayer(aopFallbackFillLayerId)) {
          map.setPaintProperty(aopFallbackFillLayerId, "fill-opacity", [
            "case",
            ["==", ["get", "appellation_id"], appId],
            0.88,
            0.72,
          ]);
        }
        if (map.getLayer(aopFallbackOutlineLayerId)) {
          map.setPaintProperty(aopFallbackOutlineLayerId, "line-width", [
            "case",
            ["==", ["get", "appellation_id"], appId],
            2,
            1.2,
          ]);
          map.setPaintProperty(aopFallbackOutlineLayerId, "line-color", [
            "case",
            ["==", ["get", "appellation_id"], appId],
            "rgba(0,0,0,0.38)",
            "rgba(0,0,0,0.22)",
          ]);
        }
      };

      const tooltipAnchor = (feature: any, fallback: { lng: number; lat: number }) => {
        const lng = feature?.properties?.label_lng;
        const lat = feature?.properties?.label_lat;
        if (typeof lng === "number" && typeof lat === "number") {
          return [lng, lat] as [number, number];
        }
        return [fallback.lng, fallback.lat] as [number, number];
      };

      const onAopPointerMove = (e: any) => {
        const feature = pickAopFeatureAtPoint(e.point);
        if (!feature) {
          if (hoveredAppellationId !== null) {
            hoveredAppellationId = null;
            resetAopHoverPaint();
            tooltip.remove();
            map.getCanvas().style.cursor = "";
          }
          return;
        }

        const newAppId = feature.properties?.appellation_id as string | undefined;
        const appName = (feature.properties?.display_label ??
          feature.properties?.appellation_name) as string | undefined;

        if (newAppId && newAppId !== hoveredAppellationId) {
          hoveredAppellationId = newAppId;
          applyAopHoverPaint(newAppId);
        }

        tooltip
          .setLngLat(tooltipAnchor(feature, e.lngLat))
          .setHTML(
            `<div style="
              font-family:'Times New Roman',serif;
              font-size:14px;
              letter-spacing:0.01em;
              color:#7c2736;
              padding:4px 10px;
              white-space:nowrap;
            ">${appName ?? ""}</div>`,
          )
          .addTo(map);

        map.getCanvas().style.cursor = "pointer";
      };

      const onAopPointerLeave = () => {
        hoveredAppellationId = null;
        resetAopHoverPaint();
        tooltip.remove();
        map.getCanvas().style.cursor = "";
      };

      const onAopClick = (e: any) => {
        const feature = pickAopFeatureAtPoint(e.point);
        if (!feature) return;

        const slug = feature.properties?.appellation_slug as string | undefined;
        if (!slug || !selectedRegion) return;

        const subregionId = feature.properties?.subregion_id as string | undefined;
        const sub = subregionId
          ? subregionRowsRef.current.find((s) => s.id === subregionId)
          : null;

        const targetUrl = `/vignoble/${selectedRegion.region_slug}/${slug}?from=map${sub ? `&subregion=${sub.slug}` : ""}`;
        window.location.href = targetUrl;
      };

      map.on("mousemove", onAopPointerMove);
      map.on("mouseout", onAopPointerLeave);
      map.on("click", onAopClick);

      aopInteractionHandlersRef.current = [
        { event: "mousemove", layerId: null, handler: onAopPointerMove },
        { event: "mouseout", layerId: null, handler: onAopPointerLeave },
        { event: "click", layerId: null, handler: onAopClick },
      ];

      aopPopupRef.current = tooltip;
      aopRenderModeRef.current = "polygons";
      setAopVisible(true);
      aopVisibleRef.current = true;
    } finally {
      setAopLoading(false);
    }
  }

  async function focusSubregionWithAop(subregionId: string) {
    focusSubregion(subregionId);
    if (!aopVisibleRef.current) {
      await toggleAopLayer({ forceShow: true });
    }
  }

  async function showSubregionsForRegion(
    regionId: string,
    regionSlug: string,
    options?: { focusSubregionSlug?: string },
  ) {
    const map = mapRef.current;
    if (!map) return;

    setSubregionsLoading(true);
    try {
      const rows = await getSubregionsByRegionId(regionId);

      const features = rows
        .map((sr, idx) => {
          const normalized = normalizeToMultiPolygon(sr.geojson);
          if (!normalized) return null;
          const color_hex = getSubregionBaseColor(null, idx);
          const subregionName = locale === "en" ? sr.name_en : sr.name_fr;

          return {
            type: "Feature" as const,
            id: sr.id,
            properties: {
              subregion_id: sr.id,
              subregion_slug: sr.slug,
              region_slug: regionSlug,
              color_hex,
              subregion_name: subregionName,
            },
            geometry: normalized,
          };
        })
        .filter((f): f is NonNullable<typeof f> => Boolean(f));

      // Remove any existing subregion layer/source before re-adding.
      if (subLayerHandlersRef.current) {
        const prev = subLayerHandlersRef.current;
        if (prev.onMove) map.off("mousemove", subFillLayerId, prev.onMove);
        if (prev.onLeave) map.off("mouseleave", subFillLayerId, prev.onLeave);
        if (prev.onMapClick) map.off("click", prev.onMapClick);
        subLayerHandlersRef.current = null;
      }

      if (map.getLayer(subFillLayerId)) {
        map.removeLayer(subFillLayerId);
      }
      if (map.getLayer(subOutlineLayerId)) {
        map.removeLayer(subOutlineLayerId);
      }
      cleanupAopLayers(map);
      aopRenderModeRef.current = "none";
      if (map.getSource(subSourceId)) {
        map.removeSource(subSourceId);
      }
      setSubregionLegendItems([]);
      setAopVisible(false);
      aopVisibleRef.current = false;
      setSelectedSubregionId(null);
      currentSubregionIdsRef.current = rows.map((r) => r.id);
      subregionRowsRef.current = rows
        .map((sr, idx) => {
          const geo = normalizeToMultiPolygon(sr.geojson);
          if (!geo) return null;
          const colorHex = getSubregionBaseColor(null, idx);
          return {
            id: sr.id,
            slug: sr.slug,
            name: locale === "en" ? sr.name_en : sr.name_fr,
            colorHex,
            geojson: geo,
            areaHectares: sr.area_hectares ?? null,
            description:
              (locale === "en" ? sr.description_en : sr.description_fr) ?? null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => Boolean(r));
      subregionColorByIdRef.current = new Map(
        subregionRowsRef.current.map((row) => [row.id, row.colorHex]),
      );

      const focusSubregionIdFromSlug =
        options?.focusSubregionSlug
          ? rows.find((r) => r.slug === options.focusSubregionSlug)?.id ?? null
          : null;

      map.addSource(subSourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
      });

      map.addLayer({
        id: subFillLayerId,
        type: "fill",
        source: subSourceId,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "dimmed"], false],
            "#c4c4c4",
            ["boolean", ["feature-state", "hover"], false],
            ["get", "color_hex"],
            ["get", "color_hex"],
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "dimmed"], false],
            0.38,
            ["boolean", ["feature-state", "hover"], false],
            0.86,
            0.62,
          ],
          // Extremely subtle stroke for a premium look.
          "fill-outline-color": "rgba(124,39,54,0.02)",
        },
      });

      map.addLayer({
        id: subOutlineLayerId,
        type: "line",
        source: subSourceId,
        paint: {
          "line-color": "rgba(124,39,54,0.18)",
          "line-width": 1.2,
          "line-opacity": 0.9,
        },
      });

      const legendItems = rows
        .map((sr, idx) => ({
          id: sr.id,
          slug: sr.slug,
          name: locale === "en" ? sr.name_en : sr.name_fr,
          colorHex: getSubregionBaseColor(null, idx),
          areaHectares: sr.area_hectares ?? null,
          description:
            (locale === "en" ? sr.description_en : sr.description_fr) ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const isSingleSameAsRegion =
        legendItems.length === 1 &&
        selectedRegion &&
        legendItems[0].name.trim().toLowerCase() ===
          selectedRegion.name.trim().toLowerCase();
      setSubregionLegendItems(isSingleSameAsRegion ? [] : legendItems);

      let hoveredSubId: string | number | null = null;
      const onMouseMoveSub = (e: any) => {
        const feature = e.features?.[0];
        if (!feature) return;

        if (hoveredSubId !== null && hoveredSubId !== feature.id) {
          map.setFeatureState(
            { source: subSourceId, id: hoveredSubId },
            { hover: false },
          );
        }

        hoveredSubId = feature.id ?? null;
        if (hoveredSubId !== null) {
          map.setFeatureState(
            { source: subSourceId, id: hoveredSubId },
            { hover: true },
          );
        }
        map.getCanvas().style.cursor = "";
      };

      const onMouseLeaveSub = () => {
        if (hoveredSubId !== null) {
          map.setFeatureState(
            { source: subSourceId, id: hoveredSubId },
            { hover: false },
          );
        }
        hoveredSubId = null;
        map.getCanvas().style.cursor = "";
      };

      map.on("mousemove", subFillLayerId, onMouseMoveSub);
      map.on("mouseleave", subFillLayerId, onMouseLeaveSub);

      const onMapClickSub = (e: any) => {
        if (!subregionsModeRef.current) return;
        const feats = map.queryRenderedFeatures(e.point, {
          layers: [subFillLayerId],
        });
        const f = feats[0];
        if (!f) return;
        const raw =
          (f.properties as Record<string, unknown> | undefined)?.subregion_id ??
          f.id;
        if (raw == null || raw === "") return;
        void focusSubregionWithAop(String(raw));
      };
      map.on("click", onMapClickSub);

      subLayerHandlersRef.current = {
        onMove: onMouseMoveSub,
        onLeave: onMouseLeaveSub,
        onMapClick: onMapClickSub,
      };

      // Fit bounds to subregions (for full France framing + zoom-in).
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;

      for (const f of features) {
        const b = computeMultiPolygonBounds(f.geometry);
        if (!b) continue;
        minLng = Math.min(minLng, b[0][0]);
        minLat = Math.min(minLat, b[0][1]);
        maxLng = Math.max(maxLng, b[1][0]);
        maxLat = Math.max(maxLat, b[1][1]);
      }

      if (Number.isFinite(minLng) && Number.isFinite(minLat)) {
        const bounds = [
          [minLng, minLat],
          [maxLng, maxLat],
        ] as [[number, number], [number, number]];
        currentRegionSubregionsBoundsRef.current = bounds;
        map.fitBounds(bounds, { padding: 22, maxZoom: 8, duration: 250 });
      }

      map.setLayoutProperty(fillLayerId, "visibility", "none");
      setSubregionsMode(true);
      subregionsModeRef.current = true;
      if (!aopVisibleRef.current) {
        await toggleAopLayer({ forceShow: true });
      }
      if (focusSubregionIdFromSlug) {
        focusSubregion(focusSubregionIdFromSlug);
      }
    } finally {
      setSubregionsLoading(false);
    }
  }

  useEffect(() => {
    if (!aopVisible) return;
    const map = mapRef.current;
    if (!map) return;
    if (
      !map.getSource(aopSourceId) &&
      !map.getSource(aopFallbackSourceId) &&
      !map.getSource(aopPointsSourceId)
    ) {
      return;
    }

    const nextFilter = selectedSubregionId
      ? ["==", ["get", "subregion_id"], selectedSubregionId]
      : null;
    const aopLayers = [
      aopFillLayerId,
      aopOutlineLayerId,
      aopFallbackFillLayerId,
      aopFallbackOutlineLayerId,
      aopLabelLayerId,
    ];
    for (const layerId of aopLayers) {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, nextFilter as any);
      }
    }
    if (map.getLayer(subOutlineLayerId)) {
      map.moveLayer(subOutlineLayerId);
    }
  }, [aopVisible, selectedSubregionId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !subregionsMode) return;
    if (!map.getLayer(subFillLayerId)) return;

    // Strict focus mode:
    // when a subregion is selected, only that one keeps its original color.
    if (selectedSubregionId) {
      map.setPaintProperty(subFillLayerId, "fill-color", [
        "case",
        ["==", ["get", "subregion_id"], selectedSubregionId],
        ["get", "color_hex"],
        "#c4c4c4",
      ]);
      map.setPaintProperty(subFillLayerId, "fill-opacity", [
        "case",
        ["==", ["get", "subregion_id"], selectedSubregionId],
        0.86,
        0.24,
      ]);
      return;
    }

    // Default subregion mode (no focused subregion yet).
    map.setPaintProperty(subFillLayerId, "fill-color", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      ["get", "color_hex"],
      ["get", "color_hex"],
    ]);
    map.setPaintProperty(subFillLayerId, "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      0.86,
      0.62,
    ]);
  }, [selectedSubregionId, subregionsMode, aopVisible]);

  function showRegionsLayer() {
    const map = mapRef.current;
    if (!map) return;

    if (subLayerHandlersRef.current) {
      const prev = subLayerHandlersRef.current;
      if (prev.onMove) map.off("mousemove", subFillLayerId, prev.onMove);
      if (prev.onLeave) map.off("mouseleave", subFillLayerId, prev.onLeave);
      if (prev.onMapClick) map.off("click", prev.onMapClick);
      subLayerHandlersRef.current = null;
    }

    if (map.getLayer(subFillLayerId)) {
      map.removeLayer(subFillLayerId);
    }
    if (map.getLayer(subOutlineLayerId)) {
      map.removeLayer(subOutlineLayerId);
    }
    cleanupAopLayers(map);
    aopRenderModeRef.current = "none";
    if (map.getSource(subSourceId)) {
      map.removeSource(subSourceId);
    }
    setSubregionLegendItems([]);
    setAopVisible(false);
    aopVisibleRef.current = false;
    setSelectedSubregionId(null);
    currentSubregionIdsRef.current = [];
    currentRegionSubregionsBoundsRef.current = null;
    subregionRowsRef.current = [];

    if (map.getLayer(fillLayerId)) {
      map.setLayoutProperty(fillLayerId, "visibility", "visible");
    }
    setSubregionsMode(false);
    subregionsModeRef.current = false;
  }

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      setReady(true);
      return;
    }

    // Avoid importing Mapbox GL at module evaluation time (SSR safety).
    let cancelled = false;
    let map: any = null;

    void (async () => {
      const mapboxglMod: any = await import("mapbox-gl");
      const mapboxgl = mapboxglMod.default ?? mapboxglMod;

      if (cancelled) return;

      mapboxgl.accessToken = token;

      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [2.454071, 46.279229],
        zoom: 4.6,
        attributionControl: false,
        interactive: true,
        preserveDrawingBuffer: true,
        scrollZoom: true,
        boxZoom: false,
        dragRotate: false,
        keyboard: false,
        doubleClickZoom: true,
      });

      mapRef.current = map;

      // Mapbox needs an accurate container size after hydration.
      // ResizeObserver keeps the canvas in sync with layout changes.
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          try {
            map.resize();
          } catch {
            // ignore
          }
        });
        resizeObserver.observe(containerRef.current);
      }

      let hoveredId: string | number | null = null;

      const onMouseMove = (e: any) => {
        const feature = e.features?.[0];
        if (!feature) return;

        if (hoveredId !== null && hoveredId !== feature.id) {
          map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
        }

        hoveredId = feature.id ?? null;

        if (hoveredId !== null) {
          map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: true });
        }

        map.getCanvas().style.cursor = "pointer";
      };

      const onMouseLeave = () => {
        if (hoveredId !== null) {
          map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
        }
        hoveredId = null;
        map.getCanvas().style.cursor = "";
      };

      map.on("load", () => {
        if (!map) return;

        // Minimal look: hide most label symbols to keep the map premium.
        try {
          const layers = map.getStyle()?.layers ?? [];
          for (const layer of layers) {
            if (
              layer.type === "symbol" &&
              typeof layer.id === "string" &&
              layer.id.includes("label")
            ) {
              map.setLayoutProperty(layer.id, "visibility", "none");
            }
          }
        } catch {
          // ignore
        }

        // Ensure we don't accidentally stack layers/sources across reloads.
        if (map.getLayer(fillLayerId)) {
          map.removeLayer(fillLayerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }

        map.addSource(sourceId, {
          type: "geojson",
          data: geojson,
        });

        map.addLayer({
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": ["get", "color_hex"],
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.86,
              0.62,
            ],
            // Extra subtle stroke to keep the map premium (almost invisible).
            "fill-outline-color": "rgba(124,39,54,0.015)",
          },
        });

        map.on("mousemove", fillLayerId, onMouseMove);
        map.on("mouseleave", fillLayerId, onMouseLeave);

        map.on("click", fillLayerId, (e: any) => {
          const feature = e.features?.[0];
          const slug = feature?.properties?.region_slug;
          if (typeof slug === "string") {
            const region = regionBySlug.get(slug) ?? null;
            if (region) {
              setSelectedRegionId(region.region_id);
              setSheetOpen(true);
            }
          }
        });

        if (fitBounds) {
          map.fitBounds(fitBounds, {
            padding: 6,
            maxZoom: 7.8,
            duration: 0,
          });
        }

        // Ensure correct sizing after fitBounds.
        try {
          map.resize();
        } catch {
          // ignore
        }

        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
    };
  }, [geojson, fitBounds, regionBySlug]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const src = map.getSource(sourceId) as any;
      if (!src) return;
      src.setData(geojson as any);
    } catch {
      // Map source might not be ready yet.
    }
  }, [geojson]);

  useEffect(() => {
    showSubregionsForRegionRef.current = showSubregionsForRegion;
  });

  useEffect(() => {
    if (!ready) return;
    if (initialFocusHandledRef.current) return;
    if (!initialRegionSlug) return;

    const region = regionBySlug.get(initialRegionSlug);
    if (!region) return;
    initialFocusHandledRef.current = true;
    setSelectedRegionId(region.region_id);
    setSheetOpen(false);
    void showSubregionsForRegionRef.current(region.region_id, region.region_slug, {
      focusSubregionSlug: initialSubregionSlug,
    });
  }, [ready, initialRegionSlug, initialSubregionSlug, regionBySlug]);

  return (
    <div className="flex h-full flex-col gap-1 md:gap-2 overflow-hidden">
      <div className={`relative ${subregionsMode ? "h-[78%] md:h-[62%]" : "h-full"}`}>
        <div
          ref={containerRef}
          className={`${heightClassName} w-full overflow-hidden rounded-2xl`}
        />

      {sheetOpen && (
        <div
          ref={cardRef}
          className="absolute bottom-0 left-0 right-0 z-20 rounded-t-lg border-t border-border bg-background"
        >
          <div className="flex items-start justify-between gap-3 p-2 pb-1.5 md:p-4 md:pb-3">
            <div className="min-w-0">
              <div className="font-heading text-lg text-wine md:text-xl">
                {selectedRegion?.name ?? ""}
              </div>
              {!selectedRegion && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {strings.na}
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setSheetOpen(false);
                setSelectedRegionId(null);
                lastFittedRegionIdRef.current = null;
                showRegionsLayer();
                // After the panel unmounts, re-fit to the default France view
                // so the camera is centered for the full visible map height.
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    try {
                      mapRef.current?.resize();
                      fitToDefaultFranceView();
                    } catch {
                      // ignore
                    }
                  });
                });
              }}
              aria-label={strings.closeLabel}
              className="shrink-0"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>

          {selectedRegion && (
            <div className="px-2 pb-2 pt-0 md:px-4 md:pb-4">
              <div className="mt-0 grid grid-cols-2 gap-1.5 md:gap-3">
                <div className="rounded-xl border border-border bg-card p-2 md:p-3">
                  <div className="text-xs text-muted-foreground">
                    {strings.departmentsLabel}
                  </div>
                  <div className="mt-1 font-heading text-base md:text-lg">
                    {selectedRegion.department_count === null
                      ? strings.na
                      : new Intl.NumberFormat(locale).format(
                          selectedRegion.department_count,
                        )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-2 md:p-3">
                  <div className="text-xs text-muted-foreground">
                    {strings.hectaresLabel}
                  </div>
                  <div className="mt-1 font-heading text-base md:text-lg">
                    {selectedRegion.area_hectares === null
                      ? strings.na
                      : new Intl.NumberFormat(locale).format(
                          selectedRegion.area_hectares,
                        )}
                  </div>
                </div>

                <div className="col-span-2 rounded-xl border border-border bg-card p-2 md:p-3">
                  <div className="text-xs text-muted-foreground">
                    {strings.totalProductionLabel}
                  </div>
                  <div className="mt-1 font-heading text-base md:text-lg">
                    {selectedRegion.total_production_hl === null
                      ? strings.na
                      : `${new Intl.NumberFormat(locale).format(
                          selectedRegion.total_production_hl,
                        )} hl`}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex gap-2 md:mt-4">
                <Button
                  className="h-11 flex-1"
                  disabled={subregionsLoading || subregionsMode}
                  onClick={() => {
                    if (!selectedRegion) return;
                    setSheetOpen(false);
                    showSubregionsForRegion(
                      selectedRegion.region_id,
                      selectedRegion.region_slug,
                    );
                  }}
                >
                  {strings.discover}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

        {subregionsMode && (
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-background/90 backdrop-blur-sm"
              onClick={() => {
                showRegionsLayer();
                fitToDefaultFranceView();
                setSheetOpen(false);
                setSelectedRegionId(null);
              }}
            >
              {strings.backToRegions}
            </Button>
            <Button
              variant="outline"
              className={
                aopVisible
                  ? "border-wine bg-wine text-white hover:bg-wine/90 hover:text-white"
                  : "bg-background/90 text-foreground backdrop-blur-sm"
              }
              disabled={aopLoading}
              onClick={() => toggleAopLayer()}
            >
              AOP
            </Button>
          </div>
        )}

        {!ready && (
          <div className="absolute inset-0 z-10 animate-pulse rounded-2xl bg-muted/50" />
        )}
      </div>

      {subregionsMode && (
        <div className="flex-1 overflow-hidden">
          {selectedSubregion ? (
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="font-heading text-lg text-wine">
                  {selectedSubregion.name}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedSubregionId(null);
                    fitToCurrentRegionSubregionsView();
                  }}
                >
                  {strings.backToRegion}
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">
                  {strings.hectaresLabel}
                </div>
                <div className="text-sm">
                  {selectedSubregion.areaHectares === null
                    ? strings.na
                    : new Intl.NumberFormat(locale).format(
                        selectedSubregion.areaHectares,
                      )}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Description
                </div>
                <div className="text-sm">
                  {selectedSubregion.description || strings.na}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full rounded-xl border border-border bg-card p-3">
              <div className="grid h-full grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {subregionLegendItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      void focusSubregionWithAop(item.id);
                    }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.colorHex }}
                    />
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
