"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import "mapbox-gl/dist/mapbox-gl.css";

export type VignobleMapRegion = {
  region_id: string;
  region_slug: string;
  name: string;
  geojson: any;
  color_hex: string | null;
};

const sourceId = "vignoble-regions";
const fillLayerId = "vignoble-regions-fill";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function blendWithWhite(hex: string, t: number) {
  const { r, g, b } = hexToRgb(hex);
  const rr = Math.round(r + (255 - r) * t);
  const gg = Math.round(g + (255 - g) * t);
  const bb = Math.round(b + (255 - b) * t);
  return rgbToHex(rr, gg, bb);
}

function normalizeHexColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
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
    base_color: string;
    hover_color: string;
    name: string;
  };
  geometry: GeoJSON.MultiPolygon;
};

export function VignobleMap({
  regions,
  heightClassName = "h-full",
}: {
  regions: VignobleMapRegion[];
  heightClassName?: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const geojson = useMemo(() => {
    const features = regions
      .map((r) => {
        const base = normalizeHexColor(r.color_hex);
        if (!base) return null;
        const hover = blendWithWhite(base, 0.92);
      const normalized = normalizeToMultiPolygon(r.geojson);

      return {
        type: "Feature" as const,
        id: r.region_id,
        properties: {
          region_slug: r.region_slug,
          color_hex: base,
          base_color: base, // kept for compatibility with existing paint expressions
          hover_color: hover,
          name: r.name,
        },
        geometry: normalized,
        };
      })
      .filter((f): f is RegionFeature => {
        return f !== null && f.geometry !== null;
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

  useLayoutEffect(() => {
    // Prevent page scrolling while the map is the primary interaction.
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

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
        scrollZoom: false,
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
            // Debug isolation: use DB color_hex ONLY (no hover blending).
            "fill-color": ["get", "color_hex"],
            "fill-opacity": 1,
            "fill-outline-color": "rgba(0,0,0,0)",
          },
        });

        map.on("mousemove", fillLayerId, onMouseMove);
        map.on("mouseleave", fillLayerId, onMouseLeave);

        map.on("click", fillLayerId, (e: any) => {
          const feature = e.features?.[0];
          const slug = feature?.properties?.region_slug;
          if (typeof slug === "string") {
            router.push(`/vignoble/${slug}`);
          }
        });

        if (fitBounds) {
          map.fitBounds(fitBounds, {
            padding: 26,
            duration: 0,
          });
        }

        // Log one rendered feature's properties directly from Mapbox.
        map.once("mousemove", fillLayerId, (e: any) => {
          const f = e.features?.[0];
          console.log("[vignoble][map feature props]", f?.properties);
        });

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
  }, [router, geojson, fitBounds]);

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

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className={`${heightClassName} w-full overflow-hidden rounded-2xl`}
      />

      {!ready && (
        <div className="absolute inset-0 z-10 animate-pulse rounded-2xl bg-muted/50" />
      )}
    </div>
  );
}
