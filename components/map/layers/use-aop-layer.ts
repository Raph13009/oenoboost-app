"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";

import { getAopCommunesInBbox } from "@/features/vignoble/queries/get-aop-communes-in-bbox";

import type { Bounds } from "../geo/geometry";
import { buildAopFeatures, pickSmallestFeature } from "./aop-features";
import {
  aopFillLayerId,
  aopOutlineLayerId,
  aopSourceId,
  subOutlineLayerId,
} from "./layer-ids";

type UseAopLayerResult = {
  visible: boolean;
  loading: boolean;
  /** Fetch AOPs for the given bbox (optionally scoped to a region) and render them.
   *  Re-entrant: replaces any existing layer. */
  show: (bbox: Bounds, regionId?: string) => Promise<void>;
  hide: () => void;
  /** Toggle. When visible, hides. When hidden, shows for the given bbox (no-op if null). */
  toggle: (bbox: Bounds | null, regionId?: string) => Promise<void>;
};

/**
 * Loads AOP communes inside a bbox and renders them as a fill + outline layer
 * above the subregion outline. Owns a hover tooltip and a per-feature hover
 * paint highlight. The hook auto-cleans on unmount or when the map instance
 * changes.
 */
export function useAopLayer(map: any | null): UseAopLayerResult {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);

  const runCleanup = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const hide = useCallback(() => {
    runCleanup();
    setVisible(false);
  }, [runCleanup]);

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

        map.on("mousemove", onPointerMove);
        map.on("mouseout", onPointerLeave);

        cleanupRef.current = () => {
          try {
            map.off("mousemove", onPointerMove);
            map.off("mouseout", onPointerLeave);
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

  return { visible, loading, show, hide, toggle };
}
