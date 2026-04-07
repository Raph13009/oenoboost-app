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
    "Haut-Benauge":                                   [82],   # Entre-deux-Mers Haut-Benauge
    "L'Étoile":                                       [606],  # L'Etoile
    "Muscadet Sèvre-et-Maine":                        [195],
    "Pouilly-Fumé / Pouilly-sur-Loire":               [196],
    "Muscat de Frontignan":                            [1333],  # comagri: "Muscat de Frontignan ou Frontignan ou Vin de Frontignan"
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

allowed_idas: set[int] = set()
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

            # Try manual override first
            if heading in MANUAL:
                allowed_idas.update(MANUAL[heading])
                continue

            # Try automatic normalization match
            key = normalize(heading)
            if key in norm_to_ida:
                allowed_idas.add(norm_to_ida[key])
                continue

            unresolved.append(heading)

if unresolved:
    print(f"-- WARNING: {len(unresolved)} md headings could not be matched to a comagri AOP:", file=sys.stderr)
    for h in sorted(unresolved):
        print(f"--   {h!r}", file=sys.stderr)

allowed_idas.discard(0)  # safety: remove any accidental zero
print(f"-- Matched {len(allowed_idas)} wine AOPs from md files", file=sys.stderr)

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
