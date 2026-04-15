import { area, difference, featureCollection, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { describe, expect, it } from "vitest";

import { buildAopFeatures, type AopFeature, type AopInput } from "./aop-features";

/**
 * Under the smallest-pick hit-test policy (`pickSmallestFeature`), an AOP F is
 * reachable iff there exists a point inside F where F is the smallest AOP
 * containing that point. Equivalently: `F \ union(AOPs G with area(G) < area(F))`
 * has non-zero area.
 *
 * This function returns the AOPs that violate that invariant.
 */
function findUnreachableAops(features: AopFeature[]): AopFeature[] {
  const unreachable: AopFeature[] = [];

  // `buildAopFeatures` returns features sorted descending by area. Smaller
  // AOPs occupy higher indexes.
  for (let i = 0; i < features.length - 1; i++) {
    const current = features[i];
    const smaller = features.slice(i + 1);
    if (smaller.length === 0) continue;

    const smallerFeatures: Feature<Polygon | MultiPolygon>[] = smaller.map(
      (s) => ({ type: "Feature", properties: {}, geometry: s.geometry }),
    );
    const mergedSmaller: Feature<Polygon | MultiPolygon> | null =
      smallerFeatures.length === 1
        ? smallerFeatures[0]
        : union(featureCollection(smallerFeatures));
    if (!mergedSmaller) continue;

    const diff = difference(
      featureCollection([
        {
          type: "Feature",
          properties: {},
          geometry: current.geometry,
        } satisfies Feature<Polygon | MultiPolygon>,
        mergedSmaller,
      ]),
    );

    // Less than 1 m² of exposed area is effectively unreachable at any
    // realistic zoom and counts as a violation.
    const remaining = diff ? area(diff) : 0;
    if (remaining < 1) {
      unreachable.push(current);
    }
  }

  return unreachable;
}

function polygon(
  lng: number,
  lat: number,
  side: number,
): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + side, lat],
        [lng + side, lat + side],
        [lng, lat + side],
        [lng, lat],
      ],
    ],
  };
}

function input(id: number, name: string, geom: GeoJSON.Polygon): AopInput {
  return { aop_id: id, aop_name: name, geometry: geom };
}

describe("AOP clickability invariant", () => {
  it("disjoint AOPs are all reachable", () => {
    const features = buildAopFeatures([
      input(1, "a", polygon(0, 45, 0.5)),
      input(2, "b", polygon(2, 45, 0.5)),
      input(3, "c", polygon(4, 45, 0.5)),
    ]);
    expect(findUnreachableAops(features)).toEqual([]);
  });

  it("small AOP nested inside a larger one — both reachable", () => {
    // The big square minus the small one is the annulus around it, which is
    // non-empty — so both are reachable.
    const features = buildAopFeatures([
      input(1, "big", polygon(0, 45, 1)),
      input(2, "small", polygon(0.25, 45.25, 0.25)),
    ]);
    expect(findUnreachableAops(features)).toEqual([]);
  });

  it("partial overlap — both AOPs reachable", () => {
    const features = buildAopFeatures([
      input(1, "left", polygon(0, 45, 1)),
      input(2, "right", polygon(0.5, 45, 1)),
    ]);
    expect(findUnreachableAops(features)).toEqual([]);
  });

  it("three nested AOPs — all reachable", () => {
    const features = buildAopFeatures([
      input(1, "outer", polygon(0, 45, 3)),
      input(2, "middle", polygon(1, 46, 1)),
      input(3, "inner", polygon(1.4, 46.4, 0.2)),
    ]);
    expect(findUnreachableAops(features)).toEqual([]);
  });

  it("parent AOP fully tiled by smaller AOPs is flagged as unreachable", () => {
    // Negative case: without smallest-pick hit-testing this would be a silent
    // bug. The invariant correctly catches it.
    const parent = polygon(0, 45, 1);
    // Two smaller halves that together cover the parent exactly.
    const leftHalf: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 45],
          [0.5, 45],
          [0.5, 46],
          [0, 46],
          [0, 45],
        ],
      ],
    };
    const rightHalf: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0.5, 45],
          [1, 45],
          [1, 46],
          [0.5, 46],
          [0.5, 45],
        ],
      ],
    };
    const features = buildAopFeatures([
      input(1, "parent", parent),
      input(2, "left", leftHalf),
      input(3, "right", rightHalf),
    ]);
    const unreachable = findUnreachableAops(features);
    expect(unreachable.map((f) => f.properties.aop_name)).toEqual(["parent"]);
  });

  it("buildAopFeatures output passes the invariant on a realistic mix", () => {
    // A representative French region: one big regional AOP, a few overlapping
    // sub-AOPs, and a handful of small disjoint ones.
    const features = buildAopFeatures([
      input(1, "regional", polygon(0, 45, 2)),
      input(2, "north-sub", polygon(0.2, 46.2, 0.6)),
      input(3, "south-sub", polygon(0.2, 45.2, 0.8)),
      input(4, "village-a", polygon(0.3, 45.3, 0.2)),
      input(5, "village-b", polygon(0.6, 45.4, 0.15)),
      input(6, "village-c", polygon(1.2, 46.3, 0.12)),
      input(7, "climat-a", polygon(0.35, 45.35, 0.05)),
    ]);
    expect(findUnreachableAops(features)).toEqual([]);
  });
});
