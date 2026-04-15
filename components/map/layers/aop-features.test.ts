import { describe, expect, it } from "vitest";

import {
  buildAopFeatures,
  pickSmallestFeature,
  type AopInput,
} from "./aop-features";

function square(
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

describe("buildAopFeatures", () => {
  it("sorts features descending by area_m2 so smaller AOPs render on top", () => {
    const big: AopInput = {
      aop_id: 1,
      aop_name: "big",
      geometry: square(0, 45, 1),
    };
    const small: AopInput = {
      aop_id: 2,
      aop_name: "small",
      geometry: square(0.2, 45.2, 0.1),
    };
    const tiny: AopInput = {
      aop_id: 3,
      aop_name: "tiny",
      geometry: square(0.25, 45.25, 0.01),
    };

    // Input order deliberately shuffled.
    const out = buildAopFeatures([small, tiny, big]);

    expect(out.map((f) => f.properties.aop_name)).toEqual([
      "big",
      "small",
      "tiny",
    ]);
    expect(out[0].properties.area_m2).toBeGreaterThan(out[1].properties.area_m2);
    expect(out[1].properties.area_m2).toBeGreaterThan(out[2].properties.area_m2);
  });

  it("accepts MultiPolygon geometries as well as Polygons", () => {
    const multi: AopInput = {
      aop_id: 1,
      aop_name: "multi",
      geometry: {
        type: "MultiPolygon",
        coordinates: [square(0, 45, 0.5).coordinates, square(2, 45, 0.5).coordinates],
      },
    };
    const out = buildAopFeatures([multi]);
    expect(out).toHaveLength(1);
    expect(out[0].geometry.type).toBe("MultiPolygon");
    expect(out[0].geometry.coordinates).toHaveLength(2);
    expect(out[0].properties.area_m2).toBeGreaterThan(0);
  });

  it("skips rows with null, missing, or invalid geometry", () => {
    const out = buildAopFeatures([
      { aop_id: 1, aop_name: "null", geometry: null },
      { aop_id: 2, aop_name: "missing", geometry: undefined },
      { aop_id: 3, aop_name: "bad-type", geometry: { type: "Point", coordinates: [0, 0] } },
      { aop_id: 4, aop_name: "good", geometry: square(0, 45, 1) },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].properties.aop_name).toBe("good");
  });

  it("preserves the AOP id on the Mapbox feature", () => {
    const out = buildAopFeatures([
      { aop_id: 42, aop_name: "forty-two", geometry: square(0, 45, 1) },
    ]);
    expect(out[0].id).toBe(42);
    expect(out[0].properties.aop_id).toBe(42);
  });

  it("prefers the server-precomputed area_m2 when present", () => {
    // A 1°x1° square at latitude 45° is ~12 billion m². Passing a trivial
    // override value proves we're trusting the server, not recomputing.
    const out = buildAopFeatures([
      {
        aop_id: 1,
        aop_name: "server-value",
        geometry: square(0, 45, 1),
        area_m2: 42,
      },
    ]);
    expect(out[0].properties.area_m2).toBe(42);
  });

  it("falls back to client-side area when area_m2 is null, missing, or non-finite", () => {
    const out = buildAopFeatures([
      { aop_id: 1, aop_name: "null", geometry: square(0, 45, 0.5), area_m2: null },
      { aop_id: 2, aop_name: "missing", geometry: square(0, 45, 0.5) },
      { aop_id: 3, aop_name: "nan", geometry: square(0, 45, 0.5), area_m2: Number.NaN },
    ]);
    for (const f of out) {
      expect(f.properties.area_m2).toBeGreaterThan(0);
      expect(Number.isFinite(f.properties.area_m2)).toBe(true);
    }
  });

  it("client-side sort still fires when one row lacks a server area", () => {
    // Server orders desc-nulls-last; if a tiny AOP comes back with null the
    // client fallback gives it a real area, and our final sort ensures it
    // ends up in the correct descending position rather than at the end.
    const out = buildAopFeatures([
      { aop_id: 1, aop_name: "big", geometry: square(0, 45, 1), area_m2: 1e10 },
      { aop_id: 2, aop_name: "medium", geometry: square(0, 45, 0.5), area_m2: 1e8 },
      { aop_id: 3, aop_name: "small-null", geometry: square(0, 45, 0.1), area_m2: null },
    ]);
    expect(out.map((f) => f.properties.aop_name)).toEqual([
      "big",
      "medium",
      "small-null",
    ]);
  });
});

describe("pickSmallestFeature", () => {
  const feature = (id: number, area_m2: number) => ({
    id,
    properties: { area_m2 },
  });

  it("returns null for an empty array", () => {
    expect(pickSmallestFeature([])).toBeNull();
  });

  it("returns the feature with the smallest area_m2", () => {
    const picked = pickSmallestFeature([
      feature(1, 100),
      feature(2, 10),
      feature(3, 50),
    ]);
    expect(picked?.id).toBe(2);
  });

  it("keeps the first occurrence when areas tie", () => {
    const picked = pickSmallestFeature([feature(1, 10), feature(2, 10)]);
    expect(picked?.id).toBe(1);
  });

  it("treats features with missing area_m2 as larger than any known area", () => {
    const feats = [{ id: 1, properties: {} }, feature(2, 100)] as const;
    const picked = pickSmallestFeature(feats);
    expect(picked?.id).toBe(2);
  });
});
