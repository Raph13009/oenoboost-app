#!/usr/bin/env python3
"""
Generates SQL INSERT statements to populate communes_full, aop, and communes_full_aop_link.
Only wine AOPs (those matching headings in data/appellations/*.md) are included.

Usage:
  python3 data/import_communes_aop.py > /tmp/communes_aop_data.sql
  # then run in Supabase SQL editor or:
  psql "$DATABASE_URL" < /tmp/communes_aop_data.sql
"""

import csv
import json
import os
import re
import sys
import unicodedata

DATA_DIR  = "data"
COMAGRI   = f"{DATA_DIR}/2025-10-09-comagri-communes-aires-ao.csv"
COMMUNES  = f"{DATA_DIR}/v_commune_2026.csv"
GEOJSON   = f"{DATA_DIR}/communes-1000m.geojson"
AOC_DIR   = f"{DATA_DIR}/appellations"

# ── Helpers ───────────────────────────────────────────────────────────────────

def escape(s: str) -> str:
    return s.replace("'", "''")

def normalize(s: str) -> str:
    """Lowercase, strip accents, collapse separators for fuzzy matching."""
    s = s.lower()
    s = s.replace("\u2019", "'").replace("\u2018", "'")  # typographic apostrophes → straight
    s = s.replace("'", " ")                              # apostrophe → space
    s = s.replace(" — ", " ").replace(" - ", " ")        # em-dash / en-dash
    s = re.sub(r"\s*/\s*", " ", s)                       # slash
    s = re.sub(r"[-]", " ", s)                           # remaining hyphens
    s = re.sub(r"\(.*?\)", "", s)                        # parenthetical
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s).strip()
    return s

# ── 1. Load comagri AOPs ──────────────────────────────────────────────────────
comagri_aops: dict[int, str] = {}   # ida → name
comagri_links: list[tuple[str, int]] = []

with open(COMAGRI, encoding="latin1") as f:
    for row in csv.DictReader(f, delimiter=";"):
        ida  = int(row["IDA"])
        name = row["Aire géographique"].strip()
        ci   = row["CI"].strip().zfill(5)
        comagri_aops[ida] = name
        comagri_links.append((ci, ida))

# Build a lookup: normalized name → ida
norm_to_ida: dict[str, int] = {normalize(name): ida for ida, name in comagri_aops.items()}

# ── 2. Extract wine AOP headings from .md files ───────────────────────────────

# Manual overrides: md heading (exact) → list of comagri IDAs
# Used when automatic normalization cannot find a match.
MANUAL: dict[str, list[int]] = {
    "Alsace":                                         [1],    # "Alsace suivi dun nom de lieu-dit"
    "Alsace Grand Cru":                               [],     # category heading only; individual grand crus matched separately
    "Beaujolais Blanc":                               [250],  # same area as Beaujolais
    "Champagne — Grand Cru":                          [54],
    "Champagne — Premier Cru":                        [54],
    "Champagne — Côte des Bar (Bar-sur-Aube)":        [54],
    "Champagne — Côte des Bar (Bar-sur-Seine)":       [54],
    "Champagne — Côte des Blancs":                    [54],
    "Champagne — Côte du Sézannais":                  [54],
    "Champagne — Haute-Marne":                        [54],
    "Champagne — Montagne de Reims (autres communes)":[54],
    "Champagne — Vallée de la Marne (Aisne)":         [54],
    "Champagne — Vallée de la Marne (Marne)":         [54],
    "Champagne — Vallée de la Marne (Seine-et-Marne)":[54],
    "Champagne — Vitryat":                            [54],
    "Clairette de Die / Crémant de Die":              [1281, 1871],
    "Haut-Benauge":                                   [82],
    "L'Étoile":                                       [606],
    "Muscadet Sèvre-et-Maine":                        [195],
    "Pouilly-Fumé / Pouilly-sur-Loire":               [196],
    "Muscat de Frontignan":                           [1333],
    "Rasteau (VDN)":                                  [1341],
    "Vin de Corse":                                   [1325],
    "Vin de Corse — Calvi":                           [1326],
    "Vin de Corse — Coteaux du Cap Corse":            [1327],
    "Vin de Corse — Figari":                          [1328],
    "Vin de Corse — Porto-Vecchio":                   [1329],
    "Vin de Corse — Sartène":                         [1330],
    "Bourgogne — Montrecul / Montre-Cul / En Montre-Cul": [348],
    "Pouilly-Loché":                                  [1008],
}

# Explicit list of non-wine IDAs present in the comagri dataset.
# Built by manually classifying every AOP not already covered by an .md heading
# (cheese, butter, meat, poultry, charcuterie, spirits, cider, olive oil,
# fruits/vegetables, honey, chestnuts, mussels, wood, etc.).
NON_WINE_IDAS: set[int] = {
    # Spirits (Cognac, Armagnac, Calvados, eaux-de-vie, marcs, fines, pommeaux,
    # kirsch, rhum, whisky, wood)
    1347, 1348, 1349, 1350, 1351, 1352, 1353, 1354,
    1362, 1363, 1438, 1449, 1450, 1676, 1737, 1887, 1888,
    1946, 1947, 1952, 1953, 1955, 1956, 1957,
    2132, 2133, 2137, 2367, 2373, 2374, 2375, 2378, 2379, 2451,
    # Cider
    1360, 1361, 1854, 2465,
    # Cheese / dairy / cream
    1454, 1455, 1456, 1457, 1459, 1460, 1461, 1462, 1463, 1464, 1465, 1466,
    1467, 1468, 1469, 1470, 1471, 1472, 1473, 1474, 1475, 1476, 1477, 1478,
    1480, 1481, 1482, 1483, 1484, 1485, 1486, 1487, 1490, 1491, 1492, 1494,
    1495, 1496, 1518, 1647, 1720, 1948, 1951, 2222, 2223, 2514,
    # Butter / cream
    1488, 1489, 2225, 2339,
    # Meat / poultry / charcuterie
    1498, 1504, 1577, 1595, 1609, 1651, 1674, 1679, 1680, 1699, 1805, 1958,
    1959, 2140, 2412, 2413, 2415,
    # Olive / olive oil
    1499, 1507, 1512, 1513, 1515, 1610, 1611, 1613, 1644, 1650, 1678, 1838,
    # Fruits / vegetables / table grapes
    1497, 1506, 1510, 1511, 1579, 1612, 1637, 1639, 1735, 1878, 2416,
    # Nuts / chestnuts / chestnut flour / walnut oil
    1501, 1516, 1618, 1638, 1706, 2464,
    # Honey / hay / peppers / essential oils / lavender / mussels
    1502, 1505, 1508, 1509, 1514, 1640,
}

# Use .md headings only for warnings/traceability. Allowed set = every comagri
# AOP that isn't in NON_WINE_IDAS. MANUAL is still honored (needed for cases
# where a heading maps to multiple IDAs, e.g. Alsace's lieu-dit IDA).
md_matched_idas: set[int] = set()
unresolved: list[str] = []

for fname in sorted(os.listdir(AOC_DIR)):
    if fname == "REGION_TEMPLATE.md" or not fname.endswith(".md"):
        continue
    with open(f"{AOC_DIR}/{fname}", encoding="utf-8") as f:
        for line in f:
            m = re.match(r"^## (.+)", line.strip())
            if not m:
                continue
            heading = m.group(1).strip()
            if heading in MANUAL:
                md_matched_idas.update(MANUAL[heading])
                continue
            key = normalize(heading)
            if key in norm_to_ida:
                md_matched_idas.add(norm_to_ida[key])
                continue
            unresolved.append(heading)

if unresolved:
    print(f"-- WARNING: {len(unresolved)} md headings could not be matched to a comagri AOP:", file=sys.stderr)
    for h in sorted(unresolved):
        print(f"--   {h!r}", file=sys.stderr)

allowed_idas: set[int] = {
    ida for ida in comagri_aops
    if ida != 0 and ida not in NON_WINE_IDAS
}
# Sanity: every .md-matched IDA must be included (otherwise NON_WINE_IDAS is wrong).
misclassified = md_matched_idas & NON_WINE_IDAS
if misclassified:
    print(f"-- ERROR: {len(misclassified)} md-matched IDAs are in NON_WINE_IDAS: {sorted(misclassified)}", file=sys.stderr)
    sys.exit(1)
print(f"-- {len(allowed_idas)} wine AOPs ({len(md_matched_idas)} from .md, rest from comagri minus {len(NON_WINE_IDAS)} non-wine)", file=sys.stderr)

# ── 3. Load communes (name from v_commune_2026) ───────────────────────────────
communes: dict[str, str] = {}

with open(COMMUNES, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        if row["TYPECOM"] == "COM":
            communes[row["COM"]] = row["LIBELLE"]

# ── 4. Load geometry from GeoJSON ─────────────────────────────────────────────
geometries: dict[str, str] = {}

with open(GEOJSON, encoding="utf-8") as f:
    geojson = json.load(f)

for feature in geojson["features"]:
    code = feature["properties"].get("code", "").strip().zfill(5)
    geometries[code] = json.dumps(feature["geometry"], ensure_ascii=False)

# ── 5. Determine which communes need importing ────────────────────────────────
needed_codes = set(ci for ci, ida in comagri_links if ida in allowed_idas)
valid_codes  = needed_codes & set(communes.keys())

# ── 6. Emit SQL ───────────────────────────────────────────────────────────────
out = sys.stdout

out.write("-- Generated by import_communes_aop.py\n")
out.write(f"-- {len(allowed_idas)} wine AOPs, {len(valid_codes)} communes\n")
out.write("begin;\n\n")

# Cleanup: drop any AOP that was previously imported but shouldn't be there
# (non-wine IDAs from earlier keyword-based imports). Cascades to link table.
out.write("-- Remove any non-wine AOPs left over from earlier imports\n")
out.write("delete from public.aop where id in (\n")
out.write(",\n".join(f"  {ida}" for ida in sorted(NON_WINE_IDAS)))
out.write("\n);\n\n")

# Wine AOPs
out.write("-- AOPs (wine only)\n")
out.write("insert into public.aop (id, name) values\n")
aop_rows = [
    f"  ({ida}, '{escape(comagri_aops[ida])}')"
    for ida in sorted(allowed_idas)
]
out.write(",\n".join(aop_rows))
out.write("\non conflict (id) do update set name = excluded.name;\n\n")

# Communes
out.write("-- Communes\n")
out.write("insert into public.communes_full (code_insee, name, geometry) values\n")
commune_rows = []
for code in sorted(valid_codes):
    name = communes[code]
    geom = geometries.get(code)
    geom_sql = f"ST_SetSRID(ST_GeomFromGeoJSON('{escape(geom)}'), 4326)" if geom else "null"
    commune_rows.append(f"  ('{code}', '{escape(name)}', {geom_sql})")
out.write(",\n".join(commune_rows))
out.write("\non conflict (code_insee) do update set name = excluded.name, geometry = excluded.geometry;\n\n")

# Links
out.write("-- Commune ↔ AOP links\n")
out.write("insert into public.communes_full_aop_link (commune_code_insee, aop_id) values\n")
seen: set[tuple[str, int]] = set()
link_rows = []
for ci, ida in comagri_links:
    ci = ci.zfill(5)
    if ida not in allowed_idas or ci not in valid_codes:
        continue
    key = (ci, ida)
    if key in seen:
        continue
    seen.add(key)
    link_rows.append(f"  ('{ci}', {ida})")
out.write(",\n".join(link_rows))
out.write("\non conflict do nothing;\n\n")

out.write("commit;\n")
