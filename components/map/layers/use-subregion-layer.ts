"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";

import { getSubregionsByRegionId } from "@/features/vignoble/queries/get-subregions-by-region-id";

import { getSubregionBaseColor } from "../geo/color";
import type { Bounds } from "../geo/geometry";
import {
  computeMultiPolygonBounds,
  normalizeToMultiPolygon,
} from "../geo/geometry";
import type { SubregionLegendItem, VignobleMapLocale } from "../types";
import {
  fillLayerId,
  subFillLayerId,
  subOutlineLayerId,
  subSourceId,
} from "./layer-ids";

type SubregionRow = {
  id: string;
  slug: string;
  name: string;
  colorHex: string;
  geojson: GeoJSON.MultiPolygon;
  areaHectares: number | null;
  description: string | null;
};

type ShowResult = {
  bounds: Bounds | null;
  focusedId: string | null;
};

type UseSubregionLayerOptions = {
  locale: VignobleMapLocale;
  /** Fired when the user clicks a subregion polygon on the map. */
  onClickSubregion: (subregionId: string) => void;
};

export type UseSubregionLayerResult = {
  loading: boolean;
  legendItems: SubregionLegendItem[];
  selectedId: string | null;
  select: (subregionId: string | null) => void;
  /**
   * Fetch and render subregions for a region. Replaces any previously rendered
   * subregion layer. The region fill layer is hidden while this is active.
   * Returns the combined bounds of all subregions + the id of the
   * optionally-requested focus subregion.
   */
  show: (
    regionId: string,
    regionSlug: string,
    regionName: string,
    opts?: { focusSubregionSlug?: string },
  ) => Promise<ShowResult>;
  hide: () => void;
  /** Bounds of a specific subregion (e.g. for a "focus" camera move). */
  findBoundsForId: (subregionId: string) => Bounds | null;
};

export function useSubregionLayer(
  map: any | null,
  { locale, onClickSubregion }: UseSubregionLayerOptions,
): UseSubregionLayerResult {
  const [loading, setLoading] = useState(false);
  const [legendItems, setLegendItems] = useState<SubregionLegendItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rowsRef = useRef<SubregionRow[]>([]);
  const handlersRef = useRef<{
    onMove: (e: any) => void;
    onLeave: () => void;
    onMapClick: (e: any) => void;
  } | null>(null);

  const onClickSubregionRef = useRef(onClickSubregion);
  useEffect(() => {
    onClickSubregionRef.current = onClickSubregion;
  });

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  const teardown = useCallback(
    (m: any) => {
      if (handlersRef.current) {
        const h = handlersRef.current;
        try {
          m.off("mousemove", subFillLayerId, h.onMove);
          m.off("mouseleave", subFillLayerId, h.onLeave);
          m.off("click", h.onMapClick);
        } catch {
          /* ignore */
        }
        handlersRef.current = null;
      }
      try {
        if (m.getLayer(subFillLayerId)) m.removeLayer(subFillLayerId);
        if (m.getLayer(subOutlineLayerId)) m.removeLayer(subOutlineLayerId);
        if (m.getSource(subSourceId)) m.removeSource(subSourceId);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const hide = useCallback(() => {
    if (!map) return;
    teardown(map);
    setLegendItems([]);
    setSelectedId(null);
    rowsRef.current = [];
    try {
      if (map.getLayer(fillLayerId)) {
        map.setLayoutProperty(fillLayerId, "visibility", "visible");
      }
    } catch {
      /* ignore */
    }
  }, [map, teardown]);

  const show = useCallback(
    async (
      regionId: string,
      regionSlug: string,
      regionName: string,
      opts?: { focusSubregionSlug?: string },
    ): Promise<ShowResult> => {
      if (!map) return { bounds: null, focusedId: null };
      setLoading(true);
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

        teardown(map);
        setLegendItems([]);
        setSelectedId(null);

        const normalizedRows = rows
          .map((sr, idx) => {
            const geo = normalizeToMultiPolygon(sr.geojson);
            if (!geo) return null;
            return {
              id: sr.id,
              slug: sr.slug,
              name: locale === "en" ? sr.name_en : sr.name_fr,
              colorHex: getSubregionBaseColor(null, idx),
              geojson: geo,
              areaHectares: sr.area_hectares ?? null,
              description:
                (locale === "en" ? sr.description_en : sr.description_fr) ??
                null,
            };
          })
          .filter((r): r is SubregionRow => Boolean(r));
        rowsRef.current = normalizedRows;

        const focusedId = opts?.focusSubregionSlug
          ? rows.find((r) => r.slug === opts.focusSubregionSlug)?.id ?? null
          : null;

        map.addSource(subSourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features },
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

        // Build the sorted legend. If a region only has one subregion and it
        // shares the region's name, treat the legend as empty (redundant).
        const items = rows
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
          items.length === 1 &&
          items[0].name.trim().toLowerCase() ===
            regionName.trim().toLowerCase();
        setLegendItems(isSingleSameAsRegion ? [] : items);

        let hoveredSubId: string | number | null = null;
        const onMove = (e: any) => {
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

        const onLeave = () => {
          if (hoveredSubId !== null) {
            map.setFeatureState(
              { source: subSourceId, id: hoveredSubId },
              { hover: false },
            );
          }
          hoveredSubId = null;
          map.getCanvas().style.cursor = "";
        };

        const onMapClick = (e: any) => {
          const feats = map.queryRenderedFeatures(e.point, {
            layers: [subFillLayerId],
          });
          const f = feats[0];
          if (!f) return;
          const raw =
            (f.properties as Record<string, unknown> | undefined)
              ?.subregion_id ?? f.id;
          if (raw == null || raw === "") return;
          onClickSubregionRef.current(String(raw));
        };

        map.on("mousemove", subFillLayerId, onMove);
        map.on("mouseleave", subFillLayerId, onLeave);
        map.on("click", onMapClick);
        handlersRef.current = { onMove, onLeave, onMapClick };

        // Combined bounds.
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
        const bounds: Bounds | null =
          Number.isFinite(minLng) && Number.isFinite(minLat)
            ? [
                [minLng, minLat],
                [maxLng, maxLat],
              ]
            : null;

        // Hide the region fill while subregions are active.
        try {
          if (map.getLayer(fillLayerId)) {
            map.setLayoutProperty(fillLayerId, "visibility", "none");
          }
        } catch {
          /* ignore */
        }

        if (focusedId) setSelectedId(focusedId);

        return { bounds, focusedId };
      } finally {
        setLoading(false);
      }
    },
    [map, locale, teardown],
  );

  const findBoundsForId = useCallback(
    (subregionId: string): Bounds | null => {
      const row = rowsRef.current.find((r) => r.id === subregionId);
      if (!row) return null;
      return computeMultiPolygonBounds(row.geojson);
    },
    [],
  );

  // Selection paint expression.
  useEffect(() => {
    if (!map) return;
    if (!map.getLayer(subFillLayerId)) return;

    if (selectedId) {
      map.setPaintProperty(subFillLayerId, "fill-color", [
        "case",
        ["==", ["get", "subregion_id"], selectedId],
        ["get", "color_hex"],
        "#c4c4c4",
      ]);
      map.setPaintProperty(subFillLayerId, "fill-opacity", [
        "case",
        ["==", ["get", "subregion_id"], selectedId],
        0.86,
        0.24,
      ]);
      return;
    }

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
  }, [map, selectedId, legendItems]);

  // Cleanup on unmount / map swap.
  useEffect(() => {
    return () => {
      if (map) teardown(map);
    };
  }, [map, teardown]);

  return {
    loading,
    legendItems,
    selectedId,
    select,
    show,
    hide,
    findBoundsForId,
  };
}
