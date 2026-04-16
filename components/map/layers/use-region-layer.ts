"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef } from "react";

import type { Bounds } from "../geo/geometry";
import { fillLayerId, sourceId } from "./layer-ids";

type RegionLayerFeature = {
  type: "Feature";
  id: string;
  properties: {
    region_slug: string;
    color_hex: string;
    name: string;
  };
  geometry: GeoJSON.MultiPolygon;
};

export type RegionFeatureCollection = {
  type: "FeatureCollection";
  features: RegionLayerFeature[];
};

type UseRegionLayerOptions = {
  geojson: RegionFeatureCollection;
  visible: boolean;
  /** Bounds to fit on first load (typically the full France framing). */
  initialFit: Bounds | null;
  onSelectSlug: (slug: string) => void;
};

/**
 * Attaches the region fill layer to the map: source + fill layer + hover paint
 * + click-to-select. Keeps the source data in sync with `geojson` on every
 * change, toggles visibility, and cleans everything up when the map changes.
 *
 * `onSelectSlug` is captured via a latest-ref so the click handler never goes
 * stale even though it is only attached once per map instance.
 */
export function useRegionLayer(
  map: any | null,
  { geojson, visible, initialFit, onSelectSlug }: UseRegionLayerOptions,
) {
  const onSelectSlugRef = useRef(onSelectSlug);
  useEffect(() => {
    onSelectSlugRef.current = onSelectSlug;
  });

  const geojsonRef = useRef(geojson);
  useEffect(() => {
    geojsonRef.current = geojson;
  });

  const initialFitRef = useRef(initialFit);
  useEffect(() => {
    initialFitRef.current = initialFit;
  });

  // Attach source/layer and wire handlers once per map.
  useEffect(() => {
    if (!map) return;

    let hoveredId: string | number | null = null;

    const onMouseMove = (e: any) => {
      const feature = e.features?.[0];
      if (!feature) return;
      if (hoveredId !== null && hoveredId !== feature.id) {
        map.setFeatureState(
          { source: sourceId, id: hoveredId },
          { hover: false },
        );
      }
      hoveredId = feature.id ?? null;
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: sourceId, id: hoveredId },
          { hover: true },
        );
      }
      map.getCanvas().style.cursor = "pointer";
    };

    const onMouseLeave = () => {
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: sourceId, id: hoveredId },
          { hover: false },
        );
      }
      hoveredId = null;
      map.getCanvas().style.cursor = "";
    };

    const onClick = (e: any) => {
      const feature = e.features?.[0];
      const slug = feature?.properties?.region_slug;
      if (typeof slug === "string") {
        onSelectSlugRef.current(slug);
      }
    };

    const attach = () => {
      // Ensure we don't accidentally stack layers/sources across reloads.
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      map.addSource(sourceId, {
        type: "geojson",
        data: geojsonRef.current,
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
      map.on("click", fillLayerId, onClick);

      const fit = initialFitRef.current;
      if (fit) {
        map.fitBounds(fit, { padding: 6, maxZoom: 7.8, duration: 0 });
      }

      try {
        map.resize();
      } catch {
        /* ignore */
      }
    };

    if (map.isStyleLoaded && map.isStyleLoaded()) {
      attach();
    } else {
      map.once("load", attach);
    }

    return () => {
      try {
        map.off("mousemove", fillLayerId, onMouseMove);
        map.off("mouseleave", fillLayerId, onMouseLeave);
        map.off("click", fillLayerId, onClick);
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        /* map may already be torn down */
      }
    };
  }, [map]);

  // Sync data when regions change.
  useEffect(() => {
    if (!map) return;
    try {
      const src = map.getSource(sourceId) as any;
      if (!src) return;
      src.setData(geojson as any);
    } catch {
      // Source may not be ready yet.
    }
  }, [map, geojson]);

  // Toggle visibility.
  useEffect(() => {
    if (!map) return;
    try {
      if (map.getLayer(fillLayerId)) {
        map.setLayoutProperty(
          fillLayerId,
          "visibility",
          visible ? "visible" : "none",
        );
      }
    } catch {
      /* ignore */
    }
  }, [map, visible]);
}
