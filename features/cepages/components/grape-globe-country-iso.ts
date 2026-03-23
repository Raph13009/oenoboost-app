/**
 * Resolve English country names / aliases to ISO 3166-1 alpha-3 codes.
 * Natural Earth 110m often uses ISO_A3 "-99"; we fall back to ISO_A3_EH / ADM0_A3.
 */

/** Normalized English name → primary ISO_A3 (main territory). */
export const ENGLISH_NAME_TO_ISO3: Record<string, string> = {
  france: "FRA",
  italy: "ITA",
  spain: "ESP",
  portugal: "PRT",
  germany: "DEU",
  austria: "AUT",
  switzerland: "CHE",
  "united kingdom": "GBR",
  england: "GBR",
  "great britain": "GBR",
  britain: "GBR",
  uk: "GBR",
  ireland: "IRL",
  hungary: "HUN",
  romania: "ROU",
  bulgaria: "BGR",
  greece: "GRC",
  croatia: "HRV",
  serbia: "SRB",
  slovenia: "SVN",
  "north macedonia": "MKD",
  macedonia: "MKD",
  montenegro: "MNE",
  "bosnia and herzegovina": "BIH",
  moldova: "MDA",
  ukraine: "UKR",
  georgia: "GEO",
  armenia: "ARM",
  azerbaijan: "AZE",
  russia: "RUS",
  "russian federation": "RUS",
  turkey: "TUR",
  cyprus: "CYP",
  lebanon: "LBN",
  israel: "ISR",
  morocco: "MAR",
  tunisia: "TUN",
  algeria: "DZA",
  "south africa": "ZAF",
  "united states": "USA",
  "united states of america": "USA",
  usa: "USA",
  america: "USA",
  canada: "CAN",
  mexico: "MEX",
  chile: "CHL",
  argentina: "ARG",
  uruguay: "URY",
  brazil: "BRA",
  peru: "PER",
  australia: "AUS",
  "new zealand": "NZL",
  china: "CHN",
  japan: "JPN",
  "south korea": "KOR",
  "north korea": "PRK",
  korea: "KOR",
  india: "IND",
  "czech republic": "CZE",
  czechia: "CZE",
  slovakia: "SVK",
  luxembourg: "LUX",
  belgium: "BEL",
  netherlands: "NLD",
  denmark: "DNK",
  sweden: "SWE",
  norway: "NOR",
  finland: "FIN",
  poland: "POL",
  "ivory coast": "CIV",
  "cote divoire": "CIV",
  "côte d'ivoire": "CIV",
  "east timor": "TLS",
  "timor-leste": "TLS",
  vietnam: "VNM",
  "viet nam": "VNM",
  thailand: "THA",
  myanmar: "MMR",
  burma: "MMR",
  eswatini: "SWZ",
  swaziland: "SWZ",
  "cape verde": "CPV",
  "cabo verde": "CPV",
  bahamas: "BHS",
  "the bahamas": "BHS",
};

/** Extra aliases (normalized) → ISO_A3 codes. */
export const ALIAS_TO_ISO3: Record<string, string[]> = {
  usa: ["USA"],
  america: ["USA"],
  "united states": ["USA"],
  "united states of america": ["USA"],
  uk: ["GBR"],
  britain: ["GBR"],
  "great britain": ["GBR"],
  england: ["GBR"],
  "south korea": ["KOR"],
  "north korea": ["PRK"],
};

export const ISO2_TO_ISO3: Record<string, string> = {
  FR: "FRA",
  US: "USA",
  GB: "GBR",
  IT: "ITA",
  ES: "ESP",
  PT: "PRT",
  DE: "DEU",
  AT: "AUT",
  CH: "CHE",
  AU: "AUS",
  NZ: "NZL",
  AR: "ARG",
  CL: "CHL",
  BR: "BRA",
  ZA: "ZAF",
  CN: "CHN",
  JP: "JPN",
  CA: "CAN",
  GR: "GRC",
  HU: "HUN",
  RO: "ROU",
  GE: "GEO",
};

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Prefer ISO_A3, then ISO_A3_EH, then ADM0_A3 (Natural Earth uses -99 placeholders). */
export function canonicalIso3(props: Record<string, unknown>): string {
  const raw = String(props.ISO_A3 ?? "")
    .trim()
    .toUpperCase();
  if (raw && raw !== "-99") return raw;
  const eh = String(props.ISO_A3_EH ?? "")
    .trim()
    .toUpperCase();
  if (eh && eh !== "-99") return eh;
  const adm = String(props.ADM0_A3 ?? "")
    .trim()
    .toUpperCase();
  if (adm && adm !== "-99") return adm;
  return "";
}

function resolveSingleInput(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const key = normalizeName(trimmed);
  const fromAlias = ALIAS_TO_ISO3[key];
  if (fromAlias) return [...fromAlias];

  const fromLookup = ENGLISH_NAME_TO_ISO3[key];
  if (fromLookup) return [fromLookup];

  const u = trimmed.toUpperCase();
  if (u.length === 3 && /^[A-Z]{3}$/.test(u) && u !== "-99") return [u];
  if (u.length === 2 && ISO2_TO_ISO3[u]) return [ISO2_TO_ISO3[u]];

  return [];
}

export function buildTargetIsoSet(inputs: string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of inputs) {
    for (const code of resolveSingleInput(raw)) {
      set.add(code);
    }
  }
  return set;
}

/**
 * NE 110m stores France as one MultiPolygon: mainland + Corsica + French Guiana.
 * Keep only polygons whose centroid falls in metropolitan France / Corsica bounds.
 */
export function filterFranceMainlandOnly(
  geometry: GeoJSON.MultiPolygon,
): GeoJSON.MultiPolygon {
  const kept: GeoJSON.Position[][][] = [];
  for (const polygon of geometry.coordinates) {
    const outer = polygon[0];
    if (!outer?.length) continue;
    let sumLng = 0;
    let sumLat = 0;
    for (const c of outer) {
      sumLng += c[0];
      sumLat += c[1];
    }
    const n = outer.length;
    const lng = sumLng / n;
    const lat = sumLat / n;
    if (lat >= 39 && lat <= 52 && lng >= -10 && lng <= 12) {
      kept.push(polygon);
    }
  }
  return { type: "MultiPolygon", coordinates: kept };
}

export function featureMatchesProduction(
  props: Record<string, unknown>,
  targetIso: Set<string>,
): boolean {
  const iso3 = canonicalIso3(props);
  const admin = String(props.ADMIN ?? "");
  const regionUn = String(props.REGION_UN ?? "").trim();

  if (!iso3) return false;

  if (!targetIso.has(iso3)) return false;

  if (iso3 === "FRA") {
    if (admin !== "France") return false;
    if (regionUn && regionUn !== "Europe") return false;
    return true;
  }

  return true;
}
