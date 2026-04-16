"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback } from "react";

import type { Bounds } from "../geo/geometry";

type FitOpts = {
  padding?: number;
  maxZoom?: number;
  duration?: number;
};

type FitRegionOpts = {
  /** Extra bottom padding for an overlay (e.g. the bottom sheet card). */
  bottomInset?: number;
  maxZoom?: number;
  duration?: number;
};

export type UseMapCameraResult = {
  /** Fit to the whole-France framing passed in via `franceBounds`. */
  fitToFrance: () => void;
  fitToBounds: (bounds: Bounds, opts?: FitOpts) => void;
  /** Fit to a region's bounds, respecting a bottom overlay. */
  fitToRegion: (regionBounds: Bounds, opts?: FitRegionOpts) => void;
};

/**
 * Small facade over `map.fitBounds` with the repo's default paddings/durations.
 * Pulls `franceBounds` in once so callers don't have to plumb it through.
 */
export function useMapCamera(
  map: any | null,
  { franceBounds }: { franceBounds: Bounds | null },
): UseMapCameraResult {
  const fitToFrance = useCallback(() => {
    if (!map || !franceBounds) return;
    map.fitBounds(franceBounds, {
      padding: 6,
      maxZoom: 7.8,
      duration: 220,
    });
  }, [map, franceBounds]);

  const fitToBounds = useCallback(
    (bounds: Bounds, opts?: FitOpts) => {
      if (!map) return;
      map.fitBounds(bounds, {
        padding: opts?.padding ?? 22,
        maxZoom: opts?.maxZoom ?? 8,
        duration: opts?.duration ?? 220,
      });
    },
    [map],
  );

  const fitToRegion = useCallback(
    (regionBounds: Bounds, opts?: FitRegionOpts) => {
      if (!map) return;
      map.fitBounds(regionBounds, {
        padding: {
          top: 12,
          left: 12,
          right: 12,
          bottom: Math.round((opts?.bottomInset ?? 0) + 10),
        },
        duration: opts?.duration ?? 220,
        maxZoom: opts?.maxZoom ?? 7,
      });
    },
    [map],
  );

  return { fitToFrance, fitToBounds, fitToRegion };
}
