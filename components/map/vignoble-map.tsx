"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";

import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { getSubregionsByRegionId } from "@/features/vignoble/queries/get-subregions-by-region-id";
import { getAopCommunesInBbox } from "@/features/vignoble/queries/get-aop-communes-in-bbox";
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


function normalizeHexColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
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
  const currentRegionBboxRef = useRef<[[number, number], [number, number]] | null>(null);
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
    if (map.getLayer(aopOutlineLayerId)) map.removeLayer(aopOutlineLayerId);
    if (map.getLayer(aopFillLayerId)) map.removeLayer(aopFillLayerId);
    if (map.getSource(aopSourceId)) map.removeSource(aopSourceId);
  }

  async function toggleAopLayer(options?: { forceShow?: boolean }) {
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

      const bbox = currentRegionBboxRef.current;
      if (!bbox) return;

      const aops = await getAopCommunesInBbox([
        bbox[0][0],
        bbox[0][1],
        bbox[1][0],
        bbox[1][1],
      ]);

      const features = aops
        .map((aop) => {
          const normalized = normalizeToMultiPolygon(aop.geometry);
          if (!normalized) return null;
          const color =
            CONTRAST_SUBREGION_COLORS[
              Math.abs(aop.aop_id) % CONTRAST_SUBREGION_COLORS.length
            ];
          return {
            type: "Feature" as const,
            id: aop.aop_id,
            properties: {
              aop_id: aop.aop_id,
              aop_name: aop.aop_name,
              color_hex: color,
            },
            geometry: normalized,
          };
        })
        .filter((f): f is NonNullable<typeof f> => Boolean(f));

      if (features.length > 0) {
        map.addSource(aopSourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features },
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

        if (map.getLayer(subOutlineLayerId)) {
          map.moveLayer(subOutlineLayerId);
        }
      }

      let hoveredAopId: number | null = null;

      const mapboxglMod: any = await import("mapbox-gl");
      const mapboxgl = mapboxglMod.default ?? mapboxglMod;

      const tooltip = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: "vignoble-aop-tooltip",
      });

      const resetAopHoverPaint = () => {
        if (map.getLayer(aopFillLayerId)) {
          map.setPaintProperty(aopFillLayerId, "fill-opacity", 0.58);
        }
        if (map.getLayer(aopOutlineLayerId)) {
          map.setPaintProperty(aopOutlineLayerId, "line-width", 0.5);
          map.setPaintProperty(aopOutlineLayerId, "line-color", "rgba(0,0,0,0.10)");
        }
      };

      const onAopPointerMove = (e: any) => {
        const feats = map.queryRenderedFeatures(e.point, {
          layers: [aopFillLayerId],
        }) as any[];
        const feature = feats?.[0];
        if (!feature) {
          if (hoveredAopId !== null) {
            hoveredAopId = null;
            resetAopHoverPaint();
            tooltip.remove();
            map.getCanvas().style.cursor = "";
          }
          return;
        }

        const newAopId = feature.id as number | undefined;
        const aopName = feature.properties?.aop_name as string | undefined;

        if (newAopId != null && newAopId !== hoveredAopId) {
          hoveredAopId = newAopId;
          if (map.getLayer(aopFillLayerId)) {
            map.setPaintProperty(aopFillLayerId, "fill-opacity", [
              "case",
              ["==", ["id"], newAopId],
              0.8,
              0.4,
            ]);
          }
          if (map.getLayer(aopOutlineLayerId)) {
            map.setPaintProperty(aopOutlineLayerId, "line-width", [
              "case",
              ["==", ["id"], newAopId],
              1.6,
              0.5,
            ]);
            map.setPaintProperty(aopOutlineLayerId, "line-color", [
              "case",
              ["==", ["id"], newAopId],
              "rgba(0,0,0,0.32)",
              "rgba(0,0,0,0.10)",
            ]);
          }
        }

        tooltip
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="
              font-family:'Times New Roman',serif;
              font-size:14px;
              letter-spacing:0.01em;
              color:#7c2736;
              padding:4px 10px;
              white-space:nowrap;
            ">${aopName ?? ""}</div>`,
          )
          .addTo(map);

        map.getCanvas().style.cursor = "pointer";
      };

      const onAopPointerLeave = () => {
        hoveredAopId = null;
        resetAopHoverPaint();
        tooltip.remove();
        map.getCanvas().style.cursor = "";
      };

      map.on("mousemove", onAopPointerMove);
      map.on("mouseout", onAopPointerLeave);

      aopInteractionHandlersRef.current = [
        { event: "mousemove", layerId: null, handler: onAopPointerMove },
        { event: "mouseout", layerId: null, handler: onAopPointerLeave },
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

    const region = regionById.get(regionId);
    currentRegionBboxRef.current = region ? getRegionBounds(region) : null;
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
    currentRegionBboxRef.current = null;
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
      // Attempt to disable Mapbox telemetry (getter-only in v3, so swallow the error).
      try { if (mapboxgl.config) mapboxgl.config.EVENTS_URL = ""; } catch { /* ignore */ }

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
