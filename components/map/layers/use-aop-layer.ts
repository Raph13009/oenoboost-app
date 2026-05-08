"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";

import { getAopCommunesInBbox } from "@/features/vignoble/queries/get-aop-communes-in-bbox";

import { computeMultiPolygonBounds } from "../geo/geometry";
import type { Bounds } from "../geo/geometry";
import type { AopFeature } from "./aop-features";
import { buildAopFeatures, pickSmallestFeature } from "./aop-features";
import {
  aopFillLayerId,
  aopOutlineLayerId,
  aopSourceId,
  subOutlineLayerId,
} from "./layer-ids";

export type AopClickPayload = {
  aopId: number;
  aopName: string;
};

type UseAopLayerOptions = {
  /** Called when the user clicks an AOP polygon. The smallest hit feature
   *  wins, mirroring the hover behaviour. */
  onClickAop?: (payload: AopClickPayload) => void;
};

export type AopListItem = { id: number; name: string; colorHex: string };

type UseAopLayerResult = {
  visible: boolean;
  loading: boolean;
  /** Sorted-alphabetically list of loaded AOPs — populated after show(), cleared on hide(). */
  aopItems: AopListItem[];
  /** Fetch AOPs for the given bbox (optionally scoped to a region) and render them.
   *  Re-entrant: replaces any existing layer. */
  show: (bbox: Bounds, regionId?: string) => Promise<void>;
  hide: () => void;
  /** Toggle. When visible, hides. When hidden, shows for the given bbox (no-op if null). */
  toggle: (bbox: Bounds | null, regionId?: string) => Promise<void>;
  /** Return the bounding box of a loaded AOP by id, or null if not found. */
  getBoundsForAop: (id: number) => Bounds | null;
  /** Visually highlight one AOP (dimming all others). Pass null to reset. */
  highlightAop: (id: number | null) => void;
};

/**
 * Loads AOP communes inside a bbox and renders them as a fill + outline layer
 * above the subregion outline. Owns a hover tooltip and a per-feature hover
 * paint highlight. The hook auto-cleans on unmount or when the map instance
 * changes.
 */
export function useAopLayer(
  map: any | null,
  options?: UseAopLayerOptions,
): UseAopLayerResult {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aopItems, setAopItems] = useState<AopListItem[]>([]);

  const cleanupRef = useRef<(() => void) | null>(null);
  const featuresRef = useRef<AopFeature[]>([]);
  const selectedAopIdRef = useRef<number | null>(null);

  // Keep the latest click handler in a ref so the listener attached inside
  // `show()` always calls the freshest closure without re-attaching.
  const onClickAopRef = useRef<UseAopLayerOptions["onClickAop"]>(
    options?.onClickAop,
  );
  useEffect(() => {
    onClickAopRef.current = options?.onClickAop;
  });

  const runCleanup = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const hide = useCallback(() => {
    runCleanup();
    setVisible(false);
    setAopItems([]);
    featuresRef.current = [];
    selectedAopIdRef.current = null;
  }, [runCleanup]);

  const getBoundsForAop = useCallback((id: number): Bounds | null => {
    const feature = featuresRef.current.find((f) => f.id === id);
    if (!feature) return null;
    return computeMultiPolygonBounds(feature.geometry);
  }, []);

  const highlightAop = useCallback(
    (id: number | null) => {
      selectedAopIdRef.current = id;
      if (!map) return;
      if (id == null) {
        if (map.getLayer(aopFillLayerId)) {
          map.setPaintProperty(aopFillLayerId, "fill-opacity", 0.58);
        }
        if (map.getLayer(aopOutlineLayerId)) {
          map.setPaintProperty(aopOutlineLayerId, "line-width", 0.5);
          map.setPaintProperty(aopOutlineLayerId, "line-color", "rgba(0,0,0,0.10)");
        }
      } else {
        if (map.getLayer(aopFillLayerId)) {
          map.setPaintProperty(aopFillLayerId, "fill-opacity", [
            "case", ["==", ["id"], id], 0.9, 0.2,
          ]);
        }
        if (map.getLayer(aopOutlineLayerId)) {
          map.setPaintProperty(aopOutlineLayerId, "line-width", [
            "case", ["==", ["id"], id], 2.5, 0.3,
          ]);
          map.setPaintProperty(aopOutlineLayerId, "line-color", [
            "case", ["==", ["id"], id], "rgba(0,0,0,0.45)", "rgba(0,0,0,0.05)",
          ]);
        }
      }
    },
    [map],
  );

  const show = useCallback(
    async (bbox: Bounds, regionId?: string) => {
      if (!map) return;
      setLoading(true);
      try {
        runCleanup();

        const aops = await getAopCommunesInBbox(
          [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]],
          regionId,
        );

        // Sorted descending by area: smaller AOPs paint on top of larger ones
        // so they remain visible (and clickable) where they overlap.
        const features = buildAopFeatures(aops);
        featuresRef.current = features;
        selectedAopIdRef.current = null;

        setAopItems(
          features
            .map((f) => ({ id: f.id, name: f.properties.aop_name, colorHex: f.properties.color_hex }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );

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

          // Keep subregion outlines above AOP fills.
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

        const resetHoverPaint = () => {
          const selId = selectedAopIdRef.current;
          if (selId != null) {
            if (map.getLayer(aopFillLayerId)) {
              map.setPaintProperty(aopFillLayerId, "fill-opacity", [
                "case", ["==", ["id"], selId], 0.9, 0.2,
              ]);
            }
            if (map.getLayer(aopOutlineLayerId)) {
              map.setPaintProperty(aopOutlineLayerId, "line-width", [
                "case", ["==", ["id"], selId], 2.5, 0.3,
              ]);
              map.setPaintProperty(aopOutlineLayerId, "line-color", [
                "case", ["==", ["id"], selId], "rgba(0,0,0,0.45)", "rgba(0,0,0,0.05)",
              ]);
            }
            return;
          }
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
        };

        const onPointerMove = (e: any) => {
          const feats = map.queryRenderedFeatures(e.point, {
            layers: [aopFillLayerId],
          }) as any[];
          // Pick the smallest AOP under the cursor rather than the topmost
          // rendered feature. This keeps hover aligned with user intent even
          // if rendering order ever drifts from area-descending.
          const feature = pickSmallestFeature(feats);
          if (!feature) {
            if (hoveredAopId !== null) {
              hoveredAopId = null;
              resetHoverPaint();
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

        const onPointerLeave = () => {
          hoveredAopId = null;
          resetHoverPaint();
          tooltip.remove();
          map.getCanvas().style.cursor = "";
        };

        const onClick = (e: any) => {
          const feats = map.queryRenderedFeatures(e.point, {
            layers: [aopFillLayerId],
          }) as any[];
          const feature = pickSmallestFeature(feats);
          if (!feature) return;
          const aopId = feature.id as number | undefined;
          const aopName = feature.properties?.aop_name as string | undefined;
          if (aopId == null || !aopName) return;
          onClickAopRef.current?.({ aopId, aopName });
        };

        map.on("mousemove", onPointerMove);
        map.on("mouseout", onPointerLeave);
        map.on("click", aopFillLayerId, onClick);

        cleanupRef.current = () => {
          try {
            map.off("mousemove", onPointerMove);
            map.off("mouseout", onPointerLeave);
            map.off("click", aopFillLayerId, onClick);
          } catch {
            /* ignore */
          }
          try {
            tooltip.remove();
          } catch {
            /* ignore */
          }
          try {
            if (map.getLayer(aopOutlineLayerId)) {
              map.removeLayer(aopOutlineLayerId);
            }
            if (map.getLayer(aopFillLayerId)) {
              map.removeLayer(aopFillLayerId);
            }
            if (map.getSource(aopSourceId)) {
              map.removeSource(aopSourceId);
            }
          } catch {
            /* map may already be gone */
          }
        };

        setVisible(true);
      } finally {
        setLoading(false);
      }
    },
    [map, runCleanup],
  );

  const toggle = useCallback(
    async (bbox: Bounds | null, regionId?: string) => {
      if (visible) {
        hide();
        return;
      }
      if (bbox) await show(bbox, regionId);
    },
    [visible, hide, show],
  );

  // Clean up on unmount / map swap.
  useEffect(() => {
    return () => {
      runCleanup();
    };
  }, [map, runCleanup]);

  return { visible, loading, aopItems, show, hide, toggle, getBoundsForAop, highlightAop };
}
