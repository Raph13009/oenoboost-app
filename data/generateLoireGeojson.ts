import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

type SubregionRule = {
  departements: string[];
  bbox: [number, number, number, number];
};

type RulesConfig = Record<string, SubregionRule>;

type PolygonFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
type BoundingBox = [number, number, number, number] | [number, number, number, number, number, number];

const COMMUNES_PATH = path.resolve("./data/communes.geojson");
const CONFIG_PATH = path.resolve("./data/config/loire_subregions_full.json");
const OUTPUT_PATH = path.resolve("./data/loire_subregions.geojson");
const BATCH_SIZE = 50;
const SIMPLIFY_TOLERANCE = 0.0008;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function getDepartmentCode(inseeCode: string): string {
  return inseeCode.slice(0, 2);
}

function bboxOverlaps(a: BoundingBox, b: BoundingBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function toPolygonFeature(feature: GeoJSON.Feature): PolygonFeature | null {
  if (!feature.geometry) return null;
  if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
    return feature as PolygonFeature;
  }
  return null;
}

function combineFeatures(features: PolygonFeature[]): PolygonFeature {
  const combined = turf.combine(turf.featureCollection(features));
  return combined.features[0] as PolygonFeature;
}

function unionPair(left: PolygonFeature, right: PolygonFeature): PolygonFeature {
  try {
    const merged = turf.union(turf.featureCollection([left, right]));
    return (merged as PolygonFeature | null) ?? combineFeatures([left, right]);
  } catch {
    return combineFeatures([left, right]);
  }
}

function unionChunk(features: PolygonFeature[]): PolygonFeature {
  let merged = features[0];
  for (let index = 1; index < features.length; index += 1) {
    merged = unionPair(merged, features[index]);
  }
  return merged;
}

function unionInBatches(features: PolygonFeature[], batchSize = BATCH_SIZE): PolygonFeature {
  if (features.length === 0) {
    throw new Error("Cannot union an empty feature set.");
  }

  let current = features.slice();
  let round = 1;

  while (current.length > 1) {
    const next: PolygonFeature[] = [];
    for (let index = 0; index < current.length; index += batchSize) {
      const chunk = current.slice(index, index + batchSize);
      next.push(unionChunk(chunk));
    }
    console.log(`  round ${round}: ${current.length} -> ${next.length} merged features`);
    current = next;
    round += 1;
  }

  return current[0];
}

function simplifyFeature(feature: PolygonFeature): PolygonFeature {
  return turf.simplify(feature, {
    tolerance: SIMPLIFY_TOLERANCE,
    highQuality: false,
    mutate: false,
  }) as PolygonFeature;
}

function main() {
  const communes = readJson<GeoJSON.FeatureCollection>(COMMUNES_PATH);
  const config = readJson<RulesConfig>(CONFIG_PATH);

  const resultFeatures: GeoJSON.Feature[] = [];

  for (const [subregionName, rules] of Object.entries(config)) {
    console.log(`Processing: ${subregionName}`);

    const filtered = communes.features
      .filter((feature) => {
        const code = String(feature.properties?.code ?? "");
        if (!code) return false;

        const departmentCode = getDepartmentCode(code);
        if (!rules.departements.includes(departmentCode)) return false;

        const geometry = feature.geometry;
        if (!geometry) return false;

        const featureBbox = turf.bbox(feature);
        return bboxOverlaps(featureBbox, rules.bbox);
      })
      .map(toPolygonFeature)
      .filter((feature): feature is PolygonFeature => feature !== null);

    console.log(`  communes matched: ${filtered.length}`);

    if (filtered.length === 0) {
      console.log(`  skipped: no communes found`);
      continue;
    }

    const merged = unionInBatches(filtered);
    const simplified = simplifyFeature(merged);

    resultFeatures.push({
      type: "Feature",
      properties: {
        name: subregionName,
      },
      geometry: simplified.geometry,
    });

    console.log(`Done: ${subregionName}`);
  }

  const output: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: resultFeatures,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
  console.log(`Created: ${OUTPUT_PATH}`);
}

main();
