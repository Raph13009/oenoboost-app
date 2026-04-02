"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";

import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { getSubregionsByRegionId } from "@/features/vignoble/queries/get-subregions-by-region-id";
import { getAppellationsBySubregionIds } from "@/features/vignoble/queries/get-appellations-by-subregion-ids";
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
const aopLayerId = "vignoble-aops-circle";
const aopLabelLayerId = "vignoble-aops-label";

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

function getGeometryPointFallback(
  geojson: any,
): [number, number] | null {
  const g = geojson?.type === "Feature" ? geojson.geometry : geojson;
  if (!g || typeof g !== "object") return null;

  if (g.type === "Point") {
    const [lng, lat] = g.coordinates ?? [];
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat];
    }
    return null;
  }

  const normalized = normalizeToMultiPolygon(g);
  if (!normalized) return null;
  const bounds = computeMultiPolygonBounds(normalized);
  if (!bounds) return null;

  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const lng = (minLng + maxLng) / 2;
  const lat = (minLat + maxLat) / 2;
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function getSubregionSyntheticPoint(
  subregionId: string | null,
  missingIndex: number,
  subregions: Array<{
    id: string;
    geojson: GeoJSON.MultiPolygon;
  }>,
): [number, number] | null {
  if (!subregionId) return null;

  const subregion = subregions.find((item) => item.id === subregionId);
  if (!subregion) return null;

  const bounds = computeMultiPolygonBounds(subregion.geojson);
  if (!bounds) return null;

  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const radiusLng = Math.min(lngSpan * 0.18, 0.08);
  const radiusLat = Math.min(latSpan * 0.18, 0.06);

  if (missingIndex === 0) {
    return [centerLng, centerLat];
  }

  const ringIndex = Math.floor((missingIndex - 1) / 6) + 1;
  const slotIndex = (missingIndex - 1) % 6;
  const angle = (slotIndex / 6) * Math.PI * 2;
  const lng = centerLng + Math.cos(angle) * radiusLng * ringIndex;
  const lat = centerLat + Math.sin(angle) * radiusLat * ringIndex;

  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function getFeaturePointCoordinates(
  feature: any,
): [number, number] | null {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lng, lat] = coordinates;
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function getRegionSyntheticPoint(
  regionGeojson: any,
  missingIndex: number,
): [number, number] | null {
  const normalized = normalizeToMultiPolygon(regionGeojson);
  if (!normalized) return null;

  const bounds = computeMultiPolygonBounds(normalized);
  if (!bounds) return null;

  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const lngSpan = Math.max(maxLng - minLng, 0.02);
  const latSpan = Math.max(maxLat - minLat, 0.02);
  const radiusLng = Math.min(lngSpan * 0.22, 0.18);
  const radiusLat = Math.min(latSpan * 0.22, 0.12);

  if (missingIndex === 0) {
    return [centerLng, centerLat];
  }

  const ringIndex = Math.floor((missingIndex - 1) / 8) + 1;
  const slotIndex = (missingIndex - 1) % 8;
  const angle = (slotIndex / 8) * Math.PI * 2;
  const lng = centerLng + Math.cos(angle) * radiusLng * ringIndex;
  const lat = centerLat + Math.sin(angle) * radiusLat * ringIndex;

  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function spreadOverlappingAopFeatures(
  features: Array<{
    type: "Feature";
    id: string;
    properties: {
      subregion_id: string | null;
      name: string;
      slug: string;
      show_label: boolean;
    };
    geometry: { type: "Point"; coordinates: [number, number] };
  }>,
) {
  const groups = new Map<string, typeof features>();

  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    const key = `${lng.toFixed(6)}:${lat.toFixed(6)}`;
    const group = groups.get(key);
    if (group) {
      group.push(feature);
    } else {
      groups.set(key, [feature]);
    }
  }

  const adjusted = features.map((feature) => ({ ...feature }));
  const byId = new Map(adjusted.map((feature) => [feature.id, feature]));

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const [baseLng, baseLat] = group[0].geometry.coordinates;
    const radiusLng = 0.018;
    const radiusLat = 0.012;

    group
      .slice()
      .sort((a, b) => a.properties.slug.localeCompare(b.properties.slug))
      .forEach((feature, index, sortedGroup) => {
        const angle = (index / sortedGroup.length) * Math.PI * 2;
        const target = byId.get(feature.id);
        if (!target) return;
        target.geometry = {
          type: "Point",
          coordinates: [
            baseLng + Math.cos(angle) * radiusLng,
            baseLat + Math.sin(angle) * radiusLat,
          ],
        };
      });
  }

  return adjusted;
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
  const aopFeaturesRef = useRef<any[]>([]);
  const aopViewHandlerRef = useRef<(() => void) | null>(null);
  const aopInteractionHandlersRef = useRef<
    Array<{
      event: "mousemove" | "mouseleave" | "click";
      layerId: string;
      handler: (...args: any[]) => void;
    }>
  >([]);
  const aopRenderModeRef = useRef<"none" | "points" | "polygons">("none");
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

  async function toggleAopLayer(options?: {
    forceShow?: boolean;
    targetSubregionId?: string | null;
  }) {
    const map = mapRef.current;
    const forceShow = options?.forceShow === true;
    const activeSubregionId = options?.targetSubregionId ?? selectedSubregionId;
    if (!map || (!subregionsMode && !subregionsModeRef.current && !forceShow)) {
      return;
    }

    if (aopVisible && !forceShow) {
      if (aopInteractionHandlersRef.current.length > 0) {
        for (const interaction of aopInteractionHandlersRef.current) {
          map.off(interaction.event, interaction.layerId, interaction.handler);
        }
        aopInteractionHandlersRef.current = [];
      }
      if (aopPopupRef.current) {
        aopPopupRef.current.remove();
        aopPopupRef.current = null;
      }
      if (aopViewHandlerRef.current) {
        map.off("moveend", aopViewHandlerRef.current);
        map.off("zoomend", aopViewHandlerRef.current);
        aopViewHandlerRef.current = null;
      }
      if (map.getLayer(aopOutlineLayerId)) map.removeLayer(aopOutlineLayerId);
      if (map.getLayer(aopFillLayerId)) map.removeLayer(aopFillLayerId);
      if (map.getLayer(aopLabelLayerId)) map.removeLayer(aopLabelLayerId);
      if (map.getLayer(aopLayerId)) map.removeLayer(aopLayerId);
      if (map.getSource(aopSourceId)) map.removeSource(aopSourceId);
      aopFeaturesRef.current = [];
      aopRenderModeRef.current = "none";
      setAopVisible(false);
      aopVisibleRef.current = false;
      return;
    }

    setAopLoading(true);
    try {
      if (aopInteractionHandlersRef.current.length > 0) {
        for (const interaction of aopInteractionHandlersRef.current) {
          map.off(interaction.event, interaction.layerId, interaction.handler);
        }
        aopInteractionHandlersRef.current = [];
      }
      if (aopViewHandlerRef.current) {
        map.off("moveend", aopViewHandlerRef.current);
        map.off("zoomend", aopViewHandlerRef.current);
        aopViewHandlerRef.current = null;
      }
      if (aopPopupRef.current) {
        aopPopupRef.current.remove();
        aopPopupRef.current = null;
      }
      if (map.getLayer(aopOutlineLayerId)) map.removeLayer(aopOutlineLayerId);
      if (map.getLayer(aopFillLayerId)) map.removeLayer(aopFillLayerId);
      if (map.getLayer(aopLabelLayerId)) map.removeLayer(aopLabelLayerId);
      if (map.getLayer(aopLayerId)) map.removeLayer(aopLayerId);
      if (map.getSource(aopSourceId)) map.removeSource(aopSourceId);

      const scopedSubregionIds = activeSubregionId
        ? [activeSubregionId]
        : currentSubregionIdsRef.current;
      const rows = await getAppellationsBySubregionIds(scopedSubregionIds, {
        includeGeojson: false,
      });
      const aopColorById = buildSubregionAopColorMap(
        rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          subregion_id: row.subregion_id,
        })),
        subregionColorByIdRef.current,
      );
      const pointAopColorById = buildSubregionAopColorMap(
        rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          subregion_id: row.subregion_id,
        })),
        subregionColorByIdRef.current,
      );
      if (shouldDebugAopMap) {
        console.info("[aop-map][render] rows from query", {
          count: rows.length,
          items: rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            subregion_id: row.subregion_id,
            centroid_lat: row.centroid_lat,
            centroid_lng: row.centroid_lng,
            has_geojson: Boolean(row.geojson),
          })),
        });
      }

      const missingPointCountBySubregion = new Map<string, number>();
      let regionSyntheticCount = 0;
      const features = rows
        .map((a, index) => {
          const hasStoredCentroid =
            a.centroid_lng !== null &&
            a.centroid_lat !== null &&
            Number.isFinite(a.centroid_lng) &&
            Number.isFinite(a.centroid_lat);
          const geojsonFallback = getGeometryPointFallback(a.geojson);
          const syntheticIndex = a.subregion_id
            ? (missingPointCountBySubregion.get(a.subregion_id) ?? 0)
            : 0;
          const subregionSyntheticPoint = getSubregionSyntheticPoint(
            a.subregion_id,
            syntheticIndex,
            subregionRowsRef.current,
          );
          const regionSyntheticPoint = getRegionSyntheticPoint(
            selectedRegion?.geojson,
            regionSyntheticCount,
          );
          const coordinates =
            hasStoredCentroid
              ? ([a.centroid_lng, a.centroid_lat] as [number, number])
              : geojsonFallback ??
                subregionSyntheticPoint ??
                regionSyntheticPoint ??
                (map
                  ? ([map.getCenter().lng, map.getCenter().lat] as [number, number])
                  : null);

          if (!hasStoredCentroid && a.subregion_id) {
            missingPointCountBySubregion.set(a.subregion_id, syntheticIndex + 1);
          }
          if (!hasStoredCentroid && !geojsonFallback && !subregionSyntheticPoint) {
            regionSyntheticCount += 1;
          }

          if (!coordinates) {
            if (shouldDebugAopMap) {
              console.warn("[aop-map][render] skipped appellation without usable point", {
                id: a.id,
                slug: a.slug,
                subregion_id: a.subregion_id,
                centroid_lat: a.centroid_lat,
                centroid_lng: a.centroid_lng,
                has_geojson: Boolean(a.geojson),
              });
            }
            return null;
          }

          if (shouldDebugAopMap && !hasStoredCentroid) {
            console.info("[aop-map][render] using fallback point", {
              id: a.id,
              slug: a.slug,
              subregion_id: a.subregion_id,
              coordinates,
              fallback:
                geojsonFallback !== null
                  ? "geojson"
                  : subregionSyntheticPoint !== null
                    ? "subregion-synthetic"
                    : regionSyntheticPoint !== null
                      ? "region-synthetic"
                      : "map-center",
            });
          }

          return {
            type: "Feature" as const,
            id: a.id,
            properties: {
              subregion_id: a.subregion_id,
              name: locale === "en" ? a.name_en : a.name_fr,
              slug: a.slug,
              show_label: false,
              color_hex:
                pointAopColorById.get(a.id) ??
                subregionColorByIdRef.current.get(a.subregion_id ?? "") ??
                CONTRAST_SUBREGION_COLORS[
                  index % CONTRAST_SUBREGION_COLORS.length
                ],
            },
            geometry: {
              type: "Point" as const,
              coordinates,
            },
          };
        })
        .filter((f): f is NonNullable<typeof f> => Boolean(f));

      const resolvedFeatures = spreadOverlappingAopFeatures(features);

      if (shouldDebugAopMap) {
        console.info("[aop-map][render] final features", {
          count: resolvedFeatures.length,
          items: resolvedFeatures.map((feature) => ({
            id: feature.id,
            slug: feature.properties.slug,
            subregion_id: feature.properties.subregion_id,
            coordinates: feature.geometry.coordinates,
          })),
        });
      }

      if (map.getLayer(aopLayerId)) map.removeLayer(aopLayerId);
      if (map.getLayer(aopLabelLayerId)) map.removeLayer(aopLabelLayerId);
      if (map.getSource(aopSourceId)) map.removeSource(aopSourceId);

      map.addSource(aopSourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: resolvedFeatures,
        },
      });

      map.addLayer({
        id: aopLayerId,
        type: "circle",
        source: aopSourceId,
        paint: {
          "circle-radius": 3.2,
          "circle-color": ["get", "color_hex"],
          "circle-stroke-width": 0.8,
          "circle-stroke-color": "#fffdec",
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: aopLabelLayerId,
        type: "symbol",
        source: aopSourceId,
        filter: ["==", ["get", "show_label"], true],
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#2a2a2a",
          "text-halo-color": "rgba(255,253,236,0.94)",
          "text-halo-width": 1,
        },
      });

      const updateAopLabels = () => {
        const src = map.getSource(aopSourceId) as any;
        if (!src) return;
        const bounds = map.getBounds();

        const scoped = selectedSubregionId
          ? aopFeaturesRef.current.filter(
              (f) => f.properties.subregion_id === selectedSubregionId,
            )
          : aopFeaturesRef.current;

        const inView = scoped.filter((f) => {
          const coords = getFeaturePointCoordinates(f);
          return coords ? bounds.contains(coords) : false;
        });

        const selected = inView
          .slice()
          .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
          .slice(0, 4)
          .map((f) => f.id);
        const selectedSet = new Set(selected);

        const nextFeatures = aopFeaturesRef.current.map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            show_label: selectedSet.has(f.id),
          },
        }));

        aopFeaturesRef.current = nextFeatures;
        src.setData({
          type: "FeatureCollection",
          features: nextFeatures,
        });
      };

      aopFeaturesRef.current = resolvedFeatures;
      aopRenderModeRef.current = "points";
      updateAopLabels();

      const openAopPointPopup = async (feature: any) => {
        const subregionId = feature?.properties?.subregion_id as string | null;
        const coords = feature?.geometry?.coordinates as [number, number] | undefined;
        if (!subregionId || !coords) return;
        const sub = subregionRowsRef.current.find((s) => s.id === subregionId);
        if (!sub || !selectedRegion) return;

        const mapboxglMod: any = await import("mapbox-gl");
        const mapboxgl = mapboxglMod.default ?? mapboxglMod;

        if (aopPopupRef.current) {
          aopPopupRef.current.remove();
          aopPopupRef.current = null;
        }

        const aopName = String(feature?.properties?.name ?? "AOP");
        const aopSlug = String(feature?.properties?.slug ?? "");
        if (!aopSlug) return;
        const targetUrl = `/vignoble/${selectedRegion.region_slug}/${aopSlug}?from=map&subregion=${sub.slug}`;
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: true,
          offset: 10,
          className: "vignoble-aop-popup",
        })
          .setLngLat(coords)
          .setHTML(
            `<div style="
              min-width:200px;
              background:#fffdec;
              border:1px solid rgba(0,0,0,0.08);
              border-radius:14px;
              box-shadow:0 8px 22px rgba(0,0,0,0.08);
              padding:12px 12px;
              text-align:center;
            ">
              <div style="
                font-family:'Times New Roman',serif;
                font-size:16px;
                letter-spacing:0.01em;
                line-height:1.25;
                color:#7c2736;
                margin-bottom:10px;
              ">${aopName}</div>
              <a href="${targetUrl}" style="
                display:inline-flex;
                align-items:center;
                justify-content:center;
                min-width:108px;
                padding:6px 12px;
                border:1px solid rgba(124,39,54,0.25);
                border-radius:10px;
                background:rgba(124,39,54,0.06);
                color:#7c2736;
                text-decoration:none;
                font-size:12px;
                font-weight:500;
                line-height:1;
              ">
                Voir l'AOP
              </a>
            </div>`,
          )
          .addTo(map);
        aopPopupRef.current = popup;
      };

      const onPinMove = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const onPinLeave = () => {
        map.getCanvas().style.cursor = "";
      };
      const onLabelMove = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const onLabelLeave = () => {
        map.getCanvas().style.cursor = "";
      };
      const onPinClick = (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        void openAopPointPopup(f);
      };
      const onLabelClick = (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        void openAopPointPopup(f);
      };

      map.on("mousemove", aopLayerId, onPinMove);
      map.on("mouseleave", aopLayerId, onPinLeave);
      map.on("click", aopLayerId, onPinClick);
      map.on("mousemove", aopLabelLayerId, onLabelMove);
      map.on("mouseleave", aopLabelLayerId, onLabelLeave);
      map.on("click", aopLabelLayerId, onLabelClick);
      aopInteractionHandlersRef.current = [
        { event: "mousemove", layerId: aopLayerId, handler: onPinMove },
        { event: "mouseleave", layerId: aopLayerId, handler: onPinLeave },
        { event: "click", layerId: aopLayerId, handler: onPinClick },
        { event: "mousemove", layerId: aopLabelLayerId, handler: onLabelMove },
        { event: "mouseleave", layerId: aopLabelLayerId, handler: onLabelLeave },
        { event: "click", layerId: aopLabelLayerId, handler: onLabelClick },
      ];

      if (aopViewHandlerRef.current) {
        map.off("moveend", aopViewHandlerRef.current);
        map.off("zoomend", aopViewHandlerRef.current);
      }
      aopViewHandlerRef.current = () => updateAopLabels();
      map.on("moveend", aopViewHandlerRef.current);
      map.on("zoomend", aopViewHandlerRef.current);

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
      if (map.getLayer(aopLayerId)) {
        map.removeLayer(aopLayerId);
      }
      if (map.getLayer(aopOutlineLayerId)) {
        map.removeLayer(aopOutlineLayerId);
      }
      if (map.getLayer(aopFillLayerId)) {
        map.removeLayer(aopFillLayerId);
      }
      if (map.getLayer(aopLabelLayerId)) {
        map.removeLayer(aopLabelLayerId);
      }
      if (map.getSource(aopSourceId)) {
        map.removeSource(aopSourceId);
      }
      if (aopInteractionHandlersRef.current.length > 0) {
        for (const interaction of aopInteractionHandlersRef.current) {
          map.off(interaction.event, interaction.layerId, interaction.handler);
        }
        aopInteractionHandlersRef.current = [];
      }
      if (aopViewHandlerRef.current) {
        map.off("moveend", aopViewHandlerRef.current);
        map.off("zoomend", aopViewHandlerRef.current);
        aopViewHandlerRef.current = null;
      }
      aopFeaturesRef.current = [];
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
    if (!map.getSource(aopSourceId)) return;
    if (aopRenderModeRef.current === "polygons") {
      const nextFilter = selectedSubregionId
        ? ["==", ["get", "subregion_id"], selectedSubregionId]
        : null;
      if (map.getLayer(aopFillLayerId)) {
        map.setFilter(aopFillLayerId, nextFilter as any);
      }
      if (map.getLayer(subOutlineLayerId)) {
        map.moveLayer(subOutlineLayerId);
      }
      return;
    }

    const bounds = map.getBounds();
    const scoped = selectedSubregionId
      ? aopFeaturesRef.current.filter(
          (f) => f.properties.subregion_id === selectedSubregionId,
        )
      : aopFeaturesRef.current;

    const inView = scoped.filter((f) => {
      const coords = getFeaturePointCoordinates(f);
      return coords ? bounds.contains(coords) : false;
    });

    const selected = inView
      .slice()
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
      .slice(0, 4)
      .map((f) => f.id);
    const selectedSet = new Set(selected);

    const nextFeatures = aopFeaturesRef.current.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        show_label: selectedSet.has(f.id),
      },
    }));

    aopFeaturesRef.current = nextFeatures;
    const src = map.getSource(aopSourceId) as any;
    src.setData({
      type: "FeatureCollection",
      features: nextFeatures,
    });
  }, [aopVisible, selectedSubregionId]);

  useEffect(() => {
    if (!aopVisible) return;
    if (!subregionsMode) return;
    void toggleAopLayer({
      forceShow: true,
      targetSubregionId: selectedSubregionId,
    });
  }, [selectedSubregionId]);

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
    if (map.getLayer(aopLayerId)) {
      map.removeLayer(aopLayerId);
    }
    if (map.getLayer(aopOutlineLayerId)) {
      map.removeLayer(aopOutlineLayerId);
    }
    if (map.getLayer(aopFillLayerId)) {
      map.removeLayer(aopFillLayerId);
    }
    if (map.getLayer(aopLabelLayerId)) {
      map.removeLayer(aopLabelLayerId);
    }
    if (map.getSource(aopSourceId)) {
      map.removeSource(aopSourceId);
    }
    if (aopInteractionHandlersRef.current.length > 0) {
      for (const interaction of aopInteractionHandlersRef.current) {
        map.off(interaction.event, interaction.layerId, interaction.handler);
      }
      aopInteractionHandlersRef.current = [];
    }
    if (aopPopupRef.current) {
      aopPopupRef.current.remove();
      aopPopupRef.current = null;
    }
    if (aopViewHandlerRef.current) {
      map.off("moveend", aopViewHandlerRef.current);
      map.off("zoomend", aopViewHandlerRef.current);
      aopViewHandlerRef.current = null;
    }
    aopFeaturesRef.current = [];
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
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className={`relative ${subregionsMode ? "h-[62%]" : "h-full"}`}>
        <div
          ref={containerRef}
          className={`${heightClassName} w-full overflow-hidden rounded-2xl`}
        />

      {sheetOpen && (
        <div
          ref={cardRef}
          className="absolute bottom-0 left-0 right-0 z-20 rounded-t-lg border-t border-border bg-background"
        >
          <div className="flex items-start justify-between gap-3 p-4 pb-3">
            <div className="min-w-0">
              <div className="font-heading text-xl text-wine">
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
            <div className="px-4 pb-4 pt-0">
              <div className="mt-0 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    {strings.departmentsLabel}
                  </div>
                  <div className="mt-1 font-heading text-lg">
                    {selectedRegion.department_count === null
                      ? strings.na
                      : new Intl.NumberFormat(locale).format(
                          selectedRegion.department_count,
                        )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    {strings.hectaresLabel}
                  </div>
                  <div className="mt-1 font-heading text-lg">
                    {selectedRegion.area_hectares === null
                      ? strings.na
                      : new Intl.NumberFormat(locale).format(
                          selectedRegion.area_hectares,
                        )}
                  </div>
                </div>

                <div className="col-span-2 rounded-xl border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    {strings.totalProductionLabel}
                  </div>
                  <div className="mt-1 font-heading text-lg">
                    {selectedRegion.total_production_hl === null
                      ? strings.na
                      : `${new Intl.NumberFormat(locale).format(
                          selectedRegion.total_production_hl,
                        )} hl`}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  className="flex-1"
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
