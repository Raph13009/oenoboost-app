"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";

import "mapbox-gl/dist/mapbox-gl.css";

import { applyCityLabelStyle } from "./map-label-utils";

type UseMapboxMapOptions = {
  center: [number, number];
  zoom: number;
  style?: string;
};

type UseMapboxMapResult = {
  map: any | null;
  ready: boolean;
};

/**
 * Lazy-loads `mapbox-gl` (SSR-safe), instantiates a Map in the given container,
 * keeps the canvas in sync with layout via a ResizeObserver, configures city
 * labels (French names, noise layers hidden), and flips `ready` when loaded.
 *
 * The initial center/zoom are captured once; changing them does not re-create
 * the map. Consumers that need to pan/zoom later should do so imperatively.
 */
export function useMapboxMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseMapboxMapOptions,
): UseMapboxMapResult {
  const [map, setMap] = useState<any | null>(null);
  const [ready, setReady] = useState(false);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      setReady(true);
      return;
    }

    let cancelled = false;
    let instance: any = null;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      const mapboxglMod: any = await import("mapbox-gl");
      const mapboxgl = mapboxglMod.default ?? mapboxglMod;
      if (cancelled) return;

      mapboxgl.accessToken = token;
      // Attempt to disable Mapbox telemetry (getter-only in v3, so swallow the error).
      try {
        if (mapboxgl.config) mapboxgl.config.EVENTS_URL = "";
      } catch {
        /* ignore */
      }

      const { center, zoom, style } = optionsRef.current;
      instance = new mapboxgl.Map({
        container: containerRef.current,
        style: style ?? "mapbox://styles/mapbox/light-v11",
        center,
        zoom,
        attributionControl: false,
        interactive: true,
        preserveDrawingBuffer: true,
        scrollZoom: true,
        boxZoom: false,
        dragRotate: false,
        keyboard: false,
        doubleClickZoom: true,
      });

      setMap(instance);

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          try {
            instance.resize();
          } catch {
            /* ignore */
          }
        });
        resizeObserver.observe(containerRef.current);
      }

      const onStyleReady = () => {
        if (!instance) return;
        try {
          applyCityLabelStyle(instance);
        } catch {
          /* ignore */
        }
      };

      instance.on("load", () => {
        onStyleReady();
        try {
          instance.resize();
        } catch {
          /* ignore */
        }
        setReady(true);
      });

      instance.on("style.load", onStyleReady);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (instance) instance.remove();
      setMap(null);
      setReady(false);
    };
  }, [containerRef]);

  return { map, ready };
}
