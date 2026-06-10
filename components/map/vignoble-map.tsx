"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAopMapInfo } from "@/features/vignoble/actions/get-aop-map-info";

import { useMapCamera } from "./camera/use-map-camera";
import { normalizeHexColor } from "./geo/color";
import type { Bounds } from "./geo/geometry";
import {
  computeMultiPolygonBounds,
  normalizeToMultiPolygon,
} from "./geo/geometry";
import { useBodyScrollLock } from "./hooks/use-body-scroll-lock";
import type { AopClickPayload } from "./layers/use-aop-layer";
import { useAopLayer } from "./layers/use-aop-layer";
import type { RegionFeatureCollection } from "./layers/use-region-layer";
import { useRegionLayer } from "./layers/use-region-layer";
import { useSubregionLayer } from "./layers/use-subregion-layer";
import type { AopPanelInfo } from "./panels/aop-detail-panel";
import { AopDetailPanel } from "./panels/aop-detail-panel";
import { AopListPanel } from "./panels/aop-list-panel";
import { MapActionBar } from "./panels/map-action-bar";
import { MapLoadingOverlay } from "./panels/map-loading-overlay";
import { RegionDetailCard } from "./panels/region-detail-card";
import { SubregionDetailPanel } from "./panels/subregion-detail-panel";
import { SubregionLegend } from "./panels/subregion-legend";
import type {
  VignobleMapLocale,
  VignobleMapRegion,
  VignobleMapStrings,
} from "./types";
import { useMapboxMap } from "./use-mapbox-map";

export type { VignobleMapRegion } from "./types";

const MAPBOX_INIT = {
  center: [2.454071, 46.279229] as [number, number],
  zoom: 4.6,
};

const REGIONS_WITHOUT_SUBREGIONS = new Set(["corse", "provence", "jura"]);

function isAopOnlyRegion(region: VignobleMapRegion | null): boolean {
  return region != null && REGIONS_WITHOUT_SUBREGIONS.has(region.region_slug);
}

function getRegionBounds(region: VignobleMapRegion): Bounds | null {
  const normalized = normalizeToMultiPolygon(region.geojson);
  if (!normalized) return null;
  return computeMultiPolygonBounds(normalized);
}

function buildRegionGeojson(regions: VignobleMapRegion[]): RegionFeatureCollection {
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
    .filter((f): f is NonNullable<typeof f> => f !== null);

  return { type: "FeatureCollection", features };
}

function computeFranceBounds(regions: VignobleMapRegion[]): Bounds | null {
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
  ];
}

type Props = {
  regions: VignobleMapRegion[];
  heightClassName?: string;
  locale: VignobleMapLocale;
  initialRegionSlug?: string;
  initialSubregionSlug?: string;
  strings: VignobleMapStrings;
};

export function VignobleMap({
  regions,
  heightClassName = "h-full",
  locale,
  initialRegionSlug,
  initialSubregionSlug,
  strings,
}: Props) {
  useBodyScrollLock();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const { map, ready } = useMapboxMap(containerRef, MAPBOX_INIT);

  const regionBySlug = useMemo(
    () => new Map(regions.map((r) => [r.region_slug, r])),
    [regions],
  );
  const regionById = useMemo(
    () => new Map(regions.map((r) => [r.region_id, r])),
    [regions],
  );

  const regionGeojson = useMemo(() => buildRegionGeojson(regions), [regions]);
  const franceBounds = useMemo(() => computeFranceBounds(regions), [regions]);

  // State machine.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [subregionsMode, setSubregionsMode] = useState(false);
  const [layerMode, setLayerMode] = useState<"subregions" | "aop">(
    "subregions",
  );
  const selectedRegion = selectedRegionId
    ? regionById.get(selectedRegionId) ?? null
    : null;

  const lastFittedRegionIdRef = useRef<string | null>(null);
  const subregionsBoundsRef = useRef<Bounds | null>(null);
  const initialFocusHandledRef = useRef(false);

  const camera = useMapCamera(map, { franceBounds });
  const cameraRef = useRef<ReturnType<typeof useMapCamera> | null>(null);

  useRegionLayer(map, {
    geojson: regionGeojson,
    visible: !subregionsMode,
    initialFit: franceBounds,
    onSelectSlug: useCallback(
      (slug: string) => {
        const region = regionBySlug.get(slug);
        if (!region) return;
        setSelectedRegionId(region.region_id);
        setSheetOpen(true);
      },
      [regionBySlug],
    ),
  });

  // AOP click selection — populated lazily once an AOP is clicked. Mutually
  // exclusive with `selectedSubregion`: clicking one clears the other.
  const [selectedAop, setSelectedAop] = useState<AopPanelInfo | null>(null);
  const [selectedAopLoading, setSelectedAopLoading] = useState(false);
  // Race-guard so the latest click wins when two AOPs are clicked in quick
  // succession before the first fetch resolves.
  const aopFetchSeqRef = useRef(0);

  const handleAopClick = useCallback(
    async ({ aopId, aopName }: AopClickPayload) => {
      // Mutually exclusive with subregion selection.
      subregionsRef.current?.select(null);

      const bounds = aopRef.current?.getBoundsForAop(aopId);
      if (bounds) cameraRef.current?.fitToBounds(bounds, { padding: 60, maxZoom: 12 });
      aopRef.current?.highlightAop(aopId);

      const seq = ++aopFetchSeqRef.current;
      setSelectedAop({
        id: aopId,
        slug: null,
        name: aopName,
        area_hectares: null,
        colors_grapes_fr: null,
        colors_grapes_en: null,
        is_grand_cru: false,
        region_slug: null,
        subregion_slug: null,
      });
      setSelectedAopLoading(true);

      try {
        const info = await getAopMapInfo(aopId);
        if (seq !== aopFetchSeqRef.current) return;
        if (info) {
          setSelectedAop({
            id: info.id,
            slug: info.slug,
            name: info.name,
            area_hectares: info.area_hectares,
            colors_grapes_fr: info.colors_grapes_fr,
            colors_grapes_en: info.colors_grapes_en,
            is_grand_cru: info.is_grand_cru,
            region_slug: info.region_slug,
            subregion_slug: info.subregion_slug,
          });
        }
      } catch (err) {
        console.error("[vignoble-map] failed to load AOP info", err);
      } finally {
        if (seq === aopFetchSeqRef.current) {
          setSelectedAopLoading(false);
        }
      }
    },
    [],
  );

  const aop = useAopLayer(map, { onClickAop: handleAopClick });

  // Latest-ref for the map-click handler. The subregion hook only attaches its
  // click handler once; we keep the orchestrator's current callback live via a
  // ref so it can close over up-to-date hook state.
  const subregionsClickRef = useRef<(id: string) => void>(() => {});
  // Latest-ref to the subregions API so handleAopClick can clear the
  // subregion selection without re-binding when the API identity changes.
  const subregionsRef = useRef<ReturnType<typeof useSubregionLayer> | null>(
    null,
  );
  const aopRef = useRef<ReturnType<typeof useAopLayer> | null>(null);

  const subregions = useSubregionLayer(map, {
    locale,
    onClickSubregion: useCallback((id: string) => {
      subregionsClickRef.current(id);
    }, []),
  });

  useEffect(() => {
    subregionsRef.current = subregions;
    aopRef.current = aop;
    cameraRef.current = camera;
    subregionsClickRef.current = (id: string) => {
      subregions.select(id);
      setSelectedAop(null);
      const b = subregions.findBoundsForId(id);
      if (b) camera.fitToBounds(b, { padding: 26, maxZoom: 9.2 });
    };
  });

  const selectedSubregion = subregions.selectedId
    ? subregions.legendItems.find((s) => s.id === subregions.selectedId) ?? null
    : null;

  const enterSubregions = useCallback(
    async (region: VignobleMapRegion, focusSubregionSlug?: string) => {
      setSelectedRegionId(region.region_id);
      setSheetOpen(false);

      if (isAopOnlyRegion(region)) {
        const regionBbox = getRegionBounds(region);
        setSubregionsMode(true);
        setLayerMode("aop");
        subregionsBoundsRef.current = regionBbox;
        if (regionBbox) {
          camera.fitToBounds(regionBbox, {
            padding: 22,
            maxZoom: 8,
            duration: 250,
          });
          void aop.show(regionBbox, region.region_id);
        }
        return;
      }

      const result = await subregions.show(
        region.region_id,
        region.region_slug,
        region.name,
        { focusSubregionSlug },
      );
      setSubregionsMode(true);
      setLayerMode("subregions");
      subregionsBoundsRef.current = result.bounds;
      if (result.bounds) {
        camera.fitToBounds(result.bounds, {
          padding: 22,
          maxZoom: 8,
          duration: 250,
        });
      }
      if (result.focusedId) {
        const focusBounds = subregions.findBoundsForId(result.focusedId);
        if (focusBounds) {
          camera.fitToBounds(focusBounds, { padding: 26, maxZoom: 9.2 });
        }
      }
    },
    [subregions, camera, aop],
  );

  const exitSubregions = useCallback(() => {
    subregions.hide();
    aop.hide();
    setSubregionsMode(false);
    setLayerMode("subregions");
    setSelectedAop(null);
    subregionsBoundsRef.current = null;
  }, [subregions, aop]);

  const handleLayerModeChange = useCallback(
    (next: "subregions" | "aop") => {
      if (next === layerMode) return;
      if (isAopOnlyRegion(selectedRegion)) return;
      setLayerMode(next);
      setSelectedAop(null);
      if (next === "aop") {
        subregions.setVisibility(false);
        if (selectedRegion) {
          const regionBbox = getRegionBounds(selectedRegion);
          if (regionBbox) {
            void aop.show(regionBbox, selectedRegion.region_id);
          }
        }
      } else {
        aop.hide();
        subregions.setVisibility(true);
      }
    },
    [layerMode, subregions, aop, selectedRegion],
  );

  const handleAopBack = useCallback(() => {
    setSelectedAop(null);
    aopRef.current?.highlightAop(null);
    const all = subregionsBoundsRef.current;
    if (all) {
      camera.fitToBounds(all, { padding: 22, maxZoom: 8 });
    }
  }, [camera]);

  const handleAopListPick = useCallback(
    (id: number, name: string) => {
      const bounds = aop.getBoundsForAop(id);
      if (bounds) camera.fitToBounds(bounds, { padding: 60, maxZoom: 12 });
      aop.highlightAop(id);
      void handleAopClick({ aopId: id, aopName: name });
    },
    [aop, camera, handleAopClick],
  );

  // Fit camera to a selected region once its sheet has rendered (so we know
  // how much of the map is visually hidden by the bottom card).
  useEffect(() => {
    if (!map || !sheetOpen || !selectedRegion || subregionsMode) return;
    const regionId = selectedRegion.region_id;
    if (lastFittedRegionIdRef.current === regionId) return;

    const raf = requestAnimationFrame(() => {
      const bottomInset = cardRef.current?.getBoundingClientRect().height ?? 0;
      const bounds = getRegionBounds(selectedRegion);
      if (!bounds) return;
      camera.fitToRegion(bounds, { bottomInset });
      lastFittedRegionIdRef.current = regionId;
    });
    return () => cancelAnimationFrame(raf);
  }, [map, sheetOpen, selectedRegion, subregionsMode, camera]);

  // Keep the canvas size in sync when the sheet closes.
  useEffect(() => {
    if (sheetOpen) return;
    try {
      map?.resize();
    } catch {
      /* ignore */
    }
  }, [sheetOpen, map]);

  // Initial focus from URL: select the region and jump straight into subregion
  // mode. Runs at most once, after the map is ready.
  useEffect(() => {
    if (!ready || initialFocusHandledRef.current || !initialRegionSlug) return;
    const region = regionBySlug.get(initialRegionSlug);
    if (!region) return;
    initialFocusHandledRef.current = true;
    // Defer so the synchronous setState at the top of enterSubregions runs in
    // a microtask rather than during the effect body — satisfies
    // react-hooks/set-state-in-effect for this one-shot URL-driven init.
    void Promise.resolve().then(() =>
      enterSubregions(region, initialSubregionSlug),
    );
  }, [
    ready,
    initialRegionSlug,
    initialSubregionSlug,
    regionBySlug,
    enterSubregions,
  ]);

  const aopOnly = isAopOnlyRegion(selectedRegion);
  const hasPanelContent = Boolean(selectedSubregion || selectedAop);
  const showAopList = subregionsMode && layerMode === "aop" && aop.aopItems.length > 0;
  const showBottomPanel = subregionsMode && (!aopOnly || Boolean(selectedAop) || showAopList);
  const showDesktopLegendOverlay =
    subregionsMode && !aopOnly && layerMode === "subregions";

  return (
    <div className="flex h-full flex-col gap-1 overflow-hidden md:gap-2">
      <div
        className={`relative ${showBottomPanel ? "h-[78%] md:h-[98%]" : "h-full"}`}
      >
        <div
          ref={containerRef}
          className={`${heightClassName} w-full overflow-hidden rounded-2xl`}
        />

        {sheetOpen && (
          <RegionDetailCard
            ref={cardRef}
            region={selectedRegion}
            locale={locale}
            strings={strings}
            discoverDisabled={subregions.loading || subregionsMode}
            onClose={() => {
              setSheetOpen(false);
              setSelectedRegionId(null);
              lastFittedRegionIdRef.current = null;
              // Defensive: if we ever end up with both the sheet and subregions
              // mounted, tear subregions down as well.
              exitSubregions();
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  try {
                    map?.resize();
                  } catch {
                    /* ignore */
                  }
                  camera.fitToFrance();
                });
              });
            }}
            onDiscover={() => {
              if (!selectedRegion) return;
              void enterSubregions(selectedRegion);
            }}
          />
        )}

        {subregionsMode && (
          <MapActionBar
            backLabel={strings.backToRegions}
            subregionsLabel={strings.subregionsLayer}
            aopLabel={strings.aopLayer}
            layerMode={layerMode}
            aopLoading={aop.loading}
            toggleDisabled={aopOnly}
            onBack={() => {
              exitSubregions();
              camera.fitToFrance();
              setSheetOpen(false);
              setSelectedRegionId(null);
            }}
            onLayerModeChange={handleLayerModeChange}
          />
        )}

        {!ready && <MapLoadingOverlay />}

        {showDesktopLegendOverlay && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden md:flex md:bottom-12 md:justify-center">
            <div className="pointer-events-auto w-fit max-w-full">
              <SubregionLegend
                items={subregions.legendItems}
                onPick={(id) => {
                  subregions.select(id);
                  const b = subregions.findBoundsForId(id);
                  if (b) camera.fitToBounds(b, { padding: 26, maxZoom: 9.2 });
                }}
              />
            </div>
          </div>
        )}

        {showAopList && (
          <div className="pointer-events-none absolute right-3 top-14 bottom-3 z-10 hidden md:flex md:flex-col md:items-end md:justify-start">
            <div className="pointer-events-auto">
              <AopListPanel
                items={aop.aopItems}
                onPick={handleAopListPick}
              />
            </div>
          </div>
        )}
      </div>

      {showBottomPanel && (
        <div
          className={`flex-1 overflow-hidden md:min-h-0 md:flex-none ${!hasPanelContent ? "md:hidden" : ""}`}
        >
          {selectedSubregion ? (
            <SubregionDetailPanel
              subregion={selectedSubregion}
              locale={locale}
              strings={strings}
              onBack={() => {
                subregions.select(null);
                const all = subregionsBoundsRef.current;
                if (all) {
                  camera.fitToBounds(all, { padding: 22, maxZoom: 8 });
                }
              }}
            />
          ) : selectedAop ? (
            <AopDetailPanel
              aop={selectedAop}
              loading={selectedAopLoading}
              locale={locale}
              strings={strings}
              onBack={handleAopBack}
            />
          ) : showAopList ? (
            <div className="h-full md:hidden">
              <AopListPanel
                items={aop.aopItems}
                onPick={handleAopListPick}
              />
            </div>
          ) : (
            <div className="md:hidden">
              <SubregionLegend
                items={subregions.legendItems}
                onPick={(id) => {
                  subregions.select(id);
                  const b = subregions.findBoundsForId(id);
                  if (b) camera.fitToBounds(b, { padding: 26, maxZoom: 9.2 });
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
