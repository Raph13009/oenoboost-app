"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import "mapbox-gl/dist/mapbox-gl.css";

import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";

import { cn } from "@/lib/utils";

import {
  buildTargetIsoSet,
  canonicalIso3,
  featureMatchesProduction,
  filterFranceMainlandOnly,
} from "./grape-globe-country-iso";

/** Natural Earth 110m — ISO via ADM0_A3 / ISO_A3_EH when ISO_A3 is -99. */
const WORLD_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const SOURCE_ID = "grape-globe-countries";
const FILL_LAYER_ID = "grape-globe-fill";
const LINE_LAYER_ID = "grape-globe-line";

const COLOR_DEFAULT = "#EAEAEA";
const COLOR_PRODUCTION = "#5E503F";
const COLOR_PRODUCTION_HOVER = "#4A3A2E";
const COLOR_DEFAULT_HOVER = "#D5D5D5";

const ROTATION_DEG_PER_FRAME = 0.003;

/** France métropolitaine — vue par défaut, légèrement dézoomée. */
const INITIAL_CENTER_FRANCE: [number, number] = [2.35, 46.45];
const INITIAL_ZOOM = 0.5;

function annotateGeoJson(
  geo: GeoJSON.FeatureCollection,
  inputs: string[],
): GeoJSON.FeatureCollection {
  const targetIso = buildTargetIsoSet(inputs);

  for (const f of geo.features) {
    if (!f.properties) continue;
    const p = f.properties as Record<string, unknown>;
    const iso = canonicalIso3(p);
    const admin = String(p.ADMIN ?? "");

    if (
      targetIso.has("FRA") &&
      iso === "FRA" &&
      admin === "France" &&
      f.geometry.type === "MultiPolygon"
    ) {
      f.geometry = filterFranceMainlandOnly(f.geometry);
    }

    if (
      f.geometry.type === "MultiPolygon" &&
      f.geometry.coordinates.length === 0
    ) {
      p.__prod = 0;
      p.__label = "";
      continue;
    }

    const prod = featureMatchesProduction(p, targetIso) ? 1 : 0;
    p.__prod = prod;
    p.__label = String(p.NAME_EN ?? p.ADMIN ?? "");
  }

  return geo;
}

export type GrapeGlobeMapProps = {
  productionCountries: string[] | null | undefined;
  mapUnavailable: string;
  globeLabel?: string;
  /**
   * `sidebar` : colonne droite (2 lignes) sur desktop.
   * `default` : grande carte.
   */
  layout?: "sidebar" | "default";
};

export function GrapeGlobeMap({
  productionCountries,
  mapUnavailable,
  globeLabel,
  layout = "default",
}: GrapeGlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const hoveredIdRef = useRef<string | number | null>(null);
  const rotationFrameRef = useRef<number>(0);
  const [visible, setVisible] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [tooltip, setTooltip] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const [tooltipShown, setTooltipShown] = useState(false);

  const countries = useMemo(
    () => (productionCountries ?? []).filter((c) => c.trim().length > 0),
    [productionCountries],
  );
  const countriesKey = useMemo(
    () => [...countries].sort().join("|"),
    [countries],
  );

  const hasData = countries.length > 0;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const showEmpty = !hasData || !token || fetchError;

  useEffect(() => {
    if (!tooltip) {
      setTooltipShown(false);
      return;
    }
    setTooltipShown(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setTooltipShown(true));
    });
    return () => cancelAnimationFrame(id);
  }, [tooltip]);

  useEffect(() => {
    if (showEmpty || !containerRef.current) return;

    let cancelled = false;
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;

    const stopIdleRotation = () => {
      if (rotationFrameRef.current) {
        cancelAnimationFrame(rotationFrameRef.current);
        rotationFrameRef.current = 0;
      }
    };

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxgl.accessToken = token!;

        const res = await fetch(WORLD_GEOJSON_URL);
        if (!res.ok) throw new Error("GeoJSON fetch failed");
        const raw = (await res.json()) as GeoJSON.FeatureCollection;
        const geo = annotateGeoJson(raw, countries);

        if (cancelled) return;

        const map = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/light-v11",
          center: INITIAL_CENTER_FRANCE,
          zoom: INITIAL_ZOOM,
          minZoom: 0.35,
          maxZoom: 6,
          bearing: 0,
          pitch: 0,
          attributionControl: false,
          projection: "globe",
          interactive: true,
          scrollZoom: true,
          boxZoom: false,
          dragRotate: false,
          dragPan: {
            linearity: 0.22,
            deceleration: 3200,
            maxSpeed: 780,
          },
          keyboard: false,
          doubleClickZoom: true,
          touchZoomRotate: true,
          touchPitch: true,
        });

        if (cancelled) {
          map.remove();
          return;
        }

        mapRef.current = map;

        map.scrollZoom.setWheelZoomRate(1 / 800);

        map.addControl(
          new mapboxgl.AttributionControl({ compact: true }),
          "bottom-right",
        );

        resizeObserver = new ResizeObserver(() => {
          if (mapRef.current && !cancelled) mapRef.current.resize();
        });
        resizeObserver.observe(container);

        map.on("style.load", () => {
          map.setFog({
            color: "rgb(245, 239, 234)",
            "high-color": "rgb(220, 215, 205)",
            "horizon-blend": 0.08,
            "space-color": "rgb(235, 230, 222)",
          });
        });

        const clearHover = () => {
          if (hoveredIdRef.current !== null) {
            map.setFeatureState(
              { source: SOURCE_ID, id: hoveredIdRef.current },
              { hover: false },
            );
            hoveredIdRef.current = null;
          }
          map.getCanvas().style.cursor = "";
        };

        const onMapMouseMove = (e: MapMouseEvent) => {
          const feats = map.queryRenderedFeatures(e.point, {
            layers: [FILL_LAYER_ID],
          });
          if (!feats.length) {
            clearHover();
            return;
          }

          const f = feats[0];
          const props = f.properties as { __prod?: number } | undefined;
          const isProd = props?.__prod === 1;
          const id = f.id;
          if (id === undefined) return;

          if (!isProd) {
            if (hoveredIdRef.current !== null) {
              map.setFeatureState(
                { source: SOURCE_ID, id: hoveredIdRef.current },
                { hover: false },
              );
              hoveredIdRef.current = null;
            }
            map.getCanvas().style.cursor = "";
            return;
          }

          if (hoveredIdRef.current !== null && hoveredIdRef.current !== id) {
            map.setFeatureState(
              { source: SOURCE_ID, id: hoveredIdRef.current },
              { hover: false },
            );
          }
          hoveredIdRef.current = id;
          map.setFeatureState({ source: SOURCE_ID, id }, { hover: true });
          map.getCanvas().style.cursor = "pointer";
        };

        const onMapClick = (e: MapMouseEvent) => {
          if (cancelled) return;
          const feats = map.queryRenderedFeatures(e.point, {
            layers: [FILL_LAYER_ID],
          });
          if (!feats.length) {
            setTooltip(null);
            return;
          }
          const f = feats[0];
          const props = f.properties as { __prod?: number; __label?: string };
          if (props.__prod !== 1) {
            setTooltip(null);
            return;
          }
          const label = String(props.__label ?? "").trim();
          if (!label) {
            setTooltip(null);
            return;
          }
          setTooltip({ label, x: e.point.x, y: e.point.y });
        };

        map.on("load", () => {
          if (cancelled) return;

          map.touchZoomRotate.disableRotation();

          map.addSource(SOURCE_ID, {
            type: "geojson",
            data: geo,
            generateId: true,
          });

          map.addLayer({
            id: FILL_LAYER_ID,
            type: "fill",
            source: SOURCE_ID,
            paint: {
              "fill-color": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                [
                  "case",
                  ["==", ["get", "__prod"], 1],
                  COLOR_PRODUCTION_HOVER,
                  COLOR_DEFAULT_HOVER,
                ],
                [
                  "case",
                  ["==", ["get", "__prod"], 1],
                  COLOR_PRODUCTION,
                  COLOR_DEFAULT,
                ],
              ],
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                [
                  "case",
                  ["==", ["get", "__prod"], 1],
                  0.98,
                  0.68,
                ],
                [
                  "case",
                  ["==", ["get", "__prod"], 1],
                  0.9,
                  0.78,
                ],
              ],
              "fill-opacity-transition": { duration: 180, delay: 0 },
            },
          });

          map.addLayer({
            id: LINE_LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            paint: {
              "line-color": "rgba(0,0,0,0.06)",
              "line-width": 0.35,
              "line-opacity": 0.7,
            },
          });

          map.on("mousemove", onMapMouseMove);
          map.on("click", onMapClick);
          map.on("mouseout", clearHover);

          const stopRotationOnUse = () => {
            stopIdleRotation();
            setTooltip(null);
          };
          map.on("mousedown", stopRotationOnUse);
          map.on("touchstart", stopRotationOnUse);
          map.on("wheel", stopRotationOnUse);
          map.on("dragstart", stopRotationOnUse);
          map.on("zoomstart", stopRotationOnUse);

          map.resize();

          map.once("idle", () => {
            if (cancelled) return;
            setVisible(true);

            const reduceMotion =
              typeof window !== "undefined" &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (reduceMotion) return;

            const tick = () => {
              if (cancelled || !mapRef.current) return;
              map.setBearing(map.getBearing() - ROTATION_DEG_PER_FRAME);
              rotationFrameRef.current = requestAnimationFrame(tick);
            };
            rotationFrameRef.current = requestAnimationFrame(tick);
          });
        });
      } catch {
        if (!cancelled) setFetchError(true);
      }
    })();

    return () => {
      cancelled = true;
      stopIdleRotation();
      resizeObserver?.disconnect();
      hoveredIdRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setVisible(false);
      setTooltip(null);
    };
  }, [showEmpty, countriesKey, token]);

  const isSidebar = layout === "sidebar";

  const mapBoxClass = isSidebar
    ? "min-h-[240px] h-[260px] w-full md:min-h-[300px] md:h-full md:max-h-none md:flex-1"
    : "h-[min(380px,55vh)] min-h-[300px] max-w-full";

  if (showEmpty) {
    return (
      <div
        className={cn(
          "relative isolate overflow-hidden rounded-xl border border-border/50 bg-[#F5EFEA]",
          isSidebar && "min-h-[240px] md:min-h-[300px]",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground",
            isSidebar ? "min-h-[240px] md:min-h-[300px]" : "min-h-[300px]",
          )}
        >
          {mapUnavailable}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative isolate w-full min-w-0 overflow-hidden rounded-xl border border-border/50 bg-[#F5EFEA] p-px shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
        isSidebar && "flex min-h-0 flex-1 flex-col md:h-full",
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative w-full overflow-hidden rounded-[inherit] [&_.mapboxgl-canvas]:block! [&_.mapboxgl-canvas]:h-full! [&_.mapboxgl-canvas]:w-full! [&_.mapboxgl-map]:h-full! [&_.mapboxgl-map]:w-full!",
          mapBoxClass,
          visible ? "opacity-100" : "opacity-0",
          "transition-opacity duration-700 ease-out",
        )}
        style={{ borderRadius: "inherit" }}
        aria-label={globeLabel ?? "Globe"}
      />
      {tooltip && (
        <div
          className={cn(
            "pointer-events-none absolute z-20 max-w-[min(200px,90vw)] rounded-md border border-border/40 bg-[#F5EFEA] px-2.5 py-1.5 font-sans text-xs text-foreground shadow-md transition-opacity duration-200 ease-out",
            tooltipShown ? "opacity-100" : "opacity-0",
          )}
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
