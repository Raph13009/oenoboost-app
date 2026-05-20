/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  aopFillLayerId,
  aopOutlineLayerId,
  fillLayerId,
  subFillLayerId,
  subOutlineLayerId,
} from "./layers/layer-ids";

const CUSTOM_LAYER_IDS = new Set([
  fillLayerId,
  subFillLayerId,
  subOutlineLayerId,
  aopFillLayerId,
  aopOutlineLayerId,
]);

const NOISE_LAYER_SUBSTRINGS = [
  "road-label",
  "poi-label",
  "country-label",
  "state-label",
  "airport-label",
  "transit-label",
  "waterway-label",
  "water-label",
  "marine",
] as const;

function isPlaceOrSettlementLayer(layerId: string): boolean {
  return layerId.includes("place-") || layerId.includes("settlement");
}

function isNoiseLabelLayer(layerId: string): boolean {
  if (isPlaceOrSettlementLayer(layerId)) return false;
  if (NOISE_LAYER_SUBSTRINGS.some((part) => layerId.includes(part))) {
    return true;
  }
  return /natural-.*-label/.test(layerId);
}

/** Hide noisy Mapbox label layers; keep city/town place and settlement labels visible. */
export function hideMapNoiseLayers(map: any): void {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const id = layer.id;
    if (typeof id !== "string" || !isNoiseLabelLayer(id)) continue;
    try {
      map.setLayoutProperty(id, "visibility", "none");
    } catch {
      /* ignore */
    }
  }
}

/** Prefer French names on Mapbox symbol layers (cities, towns, etc.). */
export function applyMapLanguage(map: any): void {
  const layers = map.getStyle()?.layers ?? [];
  const textField: any = [
    "coalesce",
    ["get", "name_fr"],
    ["get", "name"],
    ["get", "name_en"],
  ];

  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    if (typeof layer.id !== "string" || CUSTOM_LAYER_IDS.has(layer.id)) continue;
    try {
      map.setLayoutProperty(layer.id, "text-field", textField);
    } catch {
      /* ignore */
    }
  }
}

/** Move city/town label layers above vignoble fills, AOP polygons, etc. */
export function raisePlaceLabelsToTop(map: any): void {
  const layers = map.getStyle()?.layers ?? [];
  const placeIds: string[] = [];
  for (const layer of layers) {
    const id = layer.id;
    if (typeof id === "string" && isPlaceOrSettlementLayer(id)) {
      placeIds.push(id);
    }
  }
  for (const id of placeIds) {
    try {
      if (map.getLayer(id)) map.moveLayer(id);
    } catch {
      /* ignore */
    }
  }
}

export function applyCityLabelStyle(map: any): void {
  hideMapNoiseLayers(map);
  applyMapLanguage(map);
  raisePlaceLabelsToTop(map);
}
