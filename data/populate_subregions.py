#!/usr/bin/env python3
"""
Populate the `subregions` table and `communes_full_subregion_link` from the
per-region config JSON files under `data/config/`.

Each wine region maps to one *or more* source basenames. Each basename has a
`<basename>_subregions_communes.json` (or `<basename>_communes.json`) whose
top-level keys are subregion names and values are commune lists. Optional
companion `<basename>[_subregions]_departements.json` etc. carry department
metadata used to disambiguate communes that share a name across departments.

When a region maps to multiple basenames (e.g. Vallée du Rhône → rhone_nord
+ rhone_sud), each file contributes its own subregions. Subregions sharing
a name across basenames within the same region merge their commune lists.

Emits a full migration: resets `public.subregions` per region (cascades to
`communes_full_subregion_link` and `aop_subregion_link`), re-inserts
subregions with `slug`, `name_fr`, `name_en`, `name` populated, re-links the
commune junction, and rebuilds the per-region slice of `aop_subregion_link`
from `wine_subregions` via the same token-sort name match used by
20260417100000.

Aborts on any unmatched / ambiguous / unknown-to-communes_full commune.

Usage:
  python3 data/populate_subregions.py > supabase/migrations/<TIMESTAMP>_subregions_repopulate.sql
"""

import csv
import json
import os
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

# wine_regions.slug → list of source basenames. Each basename must have a
# `{base}_subregions_communes.json` or `{base}_communes.json` file. A slug
# can map to multiple basenames when a single region's editorial split spans
# several source files (e.g. Vallée du Rhône → rhone_nord + rhone_sud).
REGION_MAP: dict[str, list[str]] = {
    "alsace":               ["alsace"],
    "beaujolais":           ["beaujolais"],
    "bordeaux":             ["bordeaux"],
    "bourgogne":            ["bourgogne"],
    "champagne":            ["champagne"],
    "corse":                ["corse"],
    "jura":                 ["jura"],
    "languedoc-roussillon": ["languedoc_roussillon"],
    "provence":             ["provence"],
    "savoie":               ["savoie", "bugey"],
    "sud-ouest":            ["sud_ouest"],
    "vallee-de-la-loire":   ["loire"],
    "vallee-du-rhone":      ["rhone_nord", "rhone_sud"],
}

# Accepted suffixes for the "communes per subregion" source file, tried in
# order. The first matching file wins.
COMMUNES_SUFFIXES = ("_subregions_communes.json", "_communes.json")

# Accepted suffixes for department-metadata companion files. All existing
# files matching any of these suffixes are loaded and their contents merged.
DEPTS_SUFFIXES = (
    "_subregions.json",
    "_subregions_full.json",
    "_subregions_departements.json",
    "_subregions_explicit_departements.json",
    "_departements.json",
)

CONFIG_DIR   = Path("data/config")
COMMUNES_CSV = "data/v_commune_2026.csv"

# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    s = s.lower()
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    s = s.replace("'", " ")
    s = s.replace(" — ", " ").replace(" - ", " ")
    s = re.sub(r"\s*/\s*", " ", s)
    s = re.sub(r"[-]", " ", s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def dept_of(code_insee: str) -> str:
    # Metropolitan France: first 2 chars are the department.
    # Overseas: 97x / 98x → first 3 chars.
    return code_insee[:3] if code_insee[:2] in ("97", "98") else code_insee[:2]

def escape_sql(s: str) -> str:
    return s.replace("'", "''")

def get_api(path: str):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)

# ── Load env + remote data ────────────────────────────────────────────────────

try:
    SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    ANON_KEY     = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
except KeyError as e:
    sys.exit(f"Missing env var: {e}. Source .env before running.")

regions = get_api("wine_regions?select=id,slug")
slug_to_id: dict[str, str] = {r["slug"]: r["id"] for r in regions}

# Fetch all communes_full code_insee (paginated — there are ~35k)
cf_codes: set[str] = set()
offset = 0
while True:
    batch = get_api(f"communes_full?select=code_insee&offset={offset}&limit=1000")
    if not batch:
        break
    cf_codes.update(c["code_insee"] for c in batch)
    if len(batch) < 1000:
        break
    offset += 1000
print(f"-- Loaded {len(cf_codes)} code_insee from communes_full", file=sys.stderr)

# ── Load local INSEE communes (v_commune_2026) for name → code resolution ─────

insee_name_to_candidates: dict[str, list[tuple[str, str]]] = {}  # norm_name → [(code, dept)]
# Also track each candidate under the form that has its leading article
# dropped ("Les Ardillats" → also indexed as "ardillats"), because many input
# files omit the article that INSEE preserves. COMD rows (historical
# "communes déléguées" that have been absorbed into a commune nouvelle) are
# indexed under their historical name but point at the parent COM's code, so
# pre-2019 names in our input files still resolve.
_ARTICLES = ("l ", "le ", "la ", "les ")
with open(COMMUNES_CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        typecom = row["TYPECOM"]
        if typecom == "COM":
            effective_code = row["COM"]
        elif typecom == "COMD":
            effective_code = row["COMPARENT"]
        else:
            continue
        dept = dept_of(effective_code)
        norm = normalize(row["LIBELLE"])
        keys = {norm}
        for article in _ARTICLES:
            if norm.startswith(article):
                keys.add(norm[len(article):])
                break
        for k in keys:
            insee_name_to_candidates.setdefault(k, []).append((effective_code, dept))

# ── Helpers for loading department metadata ───────────────────────────────────

def find_communes_file(basename: str) -> Path | None:
    for suffix in COMMUNES_SUFFIXES:
        p = CONFIG_DIR / f"{basename}{suffix}"
        if p.exists():
            return p
    return None


def load_depts_per_subregion(basename: str) -> dict[str, list[str]]:
    """Return {subregion_name: [dept, ...]} merged from every metadata file
    available for the basename. Individual metadata files can use different
    subregion names than the companion `*_communes.json` file, so we union
    everything and also expose a region-level fallback."""
    merged: dict[str, set[str]] = {}
    for suffix in DEPTS_SUFFIXES:
        path = CONFIG_DIR / f"{basename}{suffix}"
        if path.exists():
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            for k, v in data.items():
                merged.setdefault(k, set()).update(v.get("departements", []))
    return {k: sorted(v) for k, v in merged.items()}


def slugify(name: str) -> str:
    n = unicodedata.normalize("NFD", name.lower())
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    n = re.sub(r"[^a-z0-9]+", "-", n)
    return n.strip("-")


# Per-region explicit overrides. Used when a JSON entry is a historical name
# (communes that merged and whose old name isn't kept as a COMD), an
# unresolvable ambiguity, or a typo in the source file.
# Key: (region_slug, subregion_name, commune_name_as_written_in_json)
# Value: INSEE code of the target commune (must exist in communes_full)
MANUAL_COMMUNE_OVERRIDES: dict[tuple[str, str, str], str] = {
    # Typo in source: written "Aiguille", INSEE has "Aiguilhe"
    ("bordeaux",           "Libournais",    "Saint-Philippe-d'Aiguille"):  "33461",
    # Merged into Arvière-en-Valromey (commune nouvelle, 2019)
    ("savoie",             "Bugey",         "01:Saint-Champ"):             "01453",
    # Beaufort + Orbagna → Beaufort-Orbagna (2016)
    ("jura",               "Côtes du Jura", "39:Beaufort"):                "39043",
    ("jura",               "Côtes du Jura", "39:Orbagna"):                 "39043",
    # Sigoulès + Flaugeac → Sigoulès-et-Flaugeac (2019)
    ("sud-ouest",          "Bergeracois",   "24:Sigoulès"):                "24534",
    # Centre-Loire ambiguities → pick the Cher (18) variant (wine AOC area)
    ("vallee-de-la-loire", "Centre-Loire",  "Brinay"):                     "18036",
    ("vallee-de-la-loire", "Centre-Loire",  "Verneuil"):                   "18277",
    ("vallee-de-la-loire", "Centre-Loire",  "Saint-Germain-des-Bois"):     "18212",
    ("vallee-de-la-loire", "Centre-Loire",  "Arpheuilles"):                "18013",
    ("vallee-de-la-loire", "Centre-Loire",  "Saint-Maur"):                 "18225",
    # Anjou-Saumur: pick the Maine-et-Loire (49) variant
    ("vallee-de-la-loire", "Anjou-Saumur",  "Saint-Martin-du-Fouilloux"):  "49306",
    # Typo: INSEE spells it "Feilluns", not "Felluns"
    ("languedoc-roussillon", "Roussillon",  "66:Felluns"):                 "66076",
    # Name not in INSEE; assumed to mean "Lugny-Champagne" (only Lugny in Cher)
    ("vallee-de-la-loire", "Centre-Loire",  "Lugny-Bourbonnais"):          "18132",
    # Rhône Sud "Castellet" → Castellet-en-Luberon (84033); the unqualified
    # INSEE Castellet is only 04041/83035, neither of which is in the Rhône.
    ("vallee-du-rhone",    "Rhône Sud",    "Castellet"):                  "84033",
}

# ── Walk the region files and validate everything ─────────────────────────────

# Accumulate (region_id, sub_name) → set[code_insee]. Multiple basenames
# can contribute to the same (region_id, sub_name), so we merge commune
# codes to avoid emitting duplicate subregion rows that would collide on
# the unique slug index.
accum: dict[tuple[str, str], dict[str, str]] = {}
unmatched: list[tuple[str, str, str, str]] = []  # (slug, sub, name, reason)

for slug, basenames in REGION_MAP.items():
    region_id = slug_to_id.get(slug)
    if region_id is None:
        sys.exit(f"-- ABORTING: no wine_regions row for slug {slug!r}")

    for file_base in basenames:
        communes_path = find_communes_file(file_base)
        if communes_path is None:
            sys.exit(
                f"-- ABORTING: no communes file found for {file_base!r}"
                f" (looked for {', '.join(file_base + s for s in COMMUNES_SUFFIXES)})"
            )

        with open(communes_path, encoding="utf-8") as f:
            sub_to_communes = json.load(f)

        depts_map = load_depts_per_subregion(file_base)
        # Region-level fallback: union of every dept mentioned in the metadata
        # for this basename. Used when a subregion name in the communes file
        # doesn't match anything in the metadata.
        region_depts_fallback: set[str] = set()
        for depts in depts_map.values():
            region_depts_fallback.update(depts)

        for sub_name, commune_names in sub_to_communes.items():
            subregion_depts = set(depts_map.get(sub_name, []))
            bucket = accum.setdefault((region_id, sub_name), {})

            for raw in commune_names:
                # Explicit manual override bypasses everything else.
                override = MANUAL_COMMUNE_OVERRIDES.get((slug, sub_name, raw))
                if override is not None:
                    if override not in cf_codes:
                        unmatched.append((slug, sub_name, raw, f"override {override} not in communes_full"))
                        continue
                    bucket.setdefault(override, raw)
                    continue

                # Some files prefix entries with "<dept>:" (e.g. "68:Bergheim").
                # When present, it's the authoritative department for this commune.
                if ":" in raw and len(raw.split(":", 1)[0]) in (2, 3):
                    prefix, cname = raw.split(":", 1)
                    dept_filter = {prefix}
                else:
                    cname = raw
                    dept_filter = subregion_depts or region_depts_fallback

                nname = normalize(cname)
                candidates = list({c for c in insee_name_to_candidates.get(nname, [])})

                if dept_filter:
                    narrowed = [c for c in candidates if c[1] in dept_filter]
                    if narrowed:
                        candidates = narrowed

                if len(candidates) == 0:
                    unmatched.append((slug, sub_name, cname, "no INSEE match"))
                    continue
                if len(candidates) > 1:
                    depts = sorted({c[1] for c in candidates})
                    codes = sorted(c[0] for c in candidates)
                    unmatched.append((
                        slug, sub_name, cname,
                        f"ambiguous across depts {depts} (codes {codes})",
                    ))
                    continue

                code = candidates[0][0]

                if code not in cf_codes:
                    unmatched.append((slug, sub_name, cname, f"INSEE code {code} not in communes_full"))
                    continue

                bucket.setdefault(code, cname)

# Flatten accum into the emit plan. Stable order: group by region_id, then
# by subregion name, to keep diffs readable.
plan: list[tuple[str, str, list[tuple[str, str]]]] = []
for (region_id, sub_name), codes_map in sorted(accum.items()):
    resolved = [(code, name) for code, name in codes_map.items()]
    plan.append((region_id, sub_name, resolved))

# ── Report and abort if anything failed validation ────────────────────────────

if unmatched:
    print(f"-- ABORTING: {len(unmatched)} unresolved commune entries", file=sys.stderr)
    for slug, sub, cname, reason in unmatched:
        print(f"--   [{slug} / {sub}] {cname!r} — {reason}", file=sys.stderr)
    sys.exit(1)

# ── Emit SQL ──────────────────────────────────────────────────────────────────

total_assignments = sum(len(r[2]) for r in plan)
print(
    f"-- {len(plan)} subregions, {total_assignments} commune assignments, "
    f"across {len({s for _, s, _ in plan})} unique names",
    file=sys.stderr,
)

out = sys.stdout
out.write("-- Generated by populate_subregions.py\n")
out.write(f"-- {len(plan)} subregions, {total_assignments} commune links\n")
out.write("--\n")
out.write("-- Rebuilds public.subregions and communes_full_subregion_link from the\n")
out.write("-- per-region JSON source files. Also wipes and re-derives\n")
out.write("-- aop_subregion_link rows (cascaded on FK) via the same wine_subregions\n")
out.write("-- token-sort match used by 20260417100000_subregions_enrich_and_link.sql.\n")
out.write("begin;\n\n")

out.write("create extension if not exists unaccent;\n\n")

# Wipe prior state. ON DELETE CASCADE on the junction tables removes the
# link rows (both communes_full_subregion_link and aop_subregion_link)
# automatically when we delete subregions.
out.write("-- Reset (idempotent re-runs). Cascade clears aop_subregion_link too;\n")
out.write("-- we re-derive it from wine_subregions at the end of this migration.\n")
out.write("delete from public.subregions;\n\n")

# One CTE block per subregion: insert the subregion with content columns
# populated, then insert one link row per (commune, subregion) pair.
out.write("-- Insert each subregion and link its communes (N:N)\n")
for region_id, sub_name, resolved in plan:
    if not resolved:
        continue
    slug = slugify(sub_name)
    codes_sql = ",\n    ".join(f"('{code}')" for code, _ in resolved)
    name_sql    = escape_sql(sub_name)
    slug_sql    = escape_sql(slug)
    out.write(f"""with s as (
  insert into public.subregions (region_id, name, name_fr, name_en, slug)
  values ('{region_id}', '{name_sql}', '{name_sql}', '{name_sql}', '{slug_sql}')
  returning id
)
insert into public.communes_full_subregion_link (commune_code_insee, subregion_id)
select v.code, s.id
  from (values
    {codes_sql}
  ) as v(code), s;

""")

# Re-derive aop_subregion_link from wine_subregions (kept as backup) via the
# token-sort name-match that 20260417100000_subregions_enrich_and_link.sql
# introduced. aop_subregion_link was cascade-cleared by the delete above.
out.write("""-- Rebuild aop_subregion_link via wine_subregions → subregions token-sort match.
insert into public.aop_subregion_link (aop_id, subregion_id)
select distinct aop_links.aop_id, s.id
  from (
    select a.id as aop_id, asl.subregion_id as ws_id
      from public.appellation_subregion_links asl
      join public.appellations ap on ap.id = asl.appellation_id
      join public.aop a on
        array_to_string(array(
          select unnest(string_to_array(
            trim(regexp_replace(lower(unaccent(a.name)), '[^a-z0-9]+', ' ', 'g')),
            ' '
          )) order by 1
        ), ' ')
        =
        array_to_string(array(
          select unnest(string_to_array(
            trim(regexp_replace(lower(unaccent(ap.name_fr)), '[^a-z0-9]+', ' ', 'g')),
            ' '
          )) order by 1
        ), ' ')
      where ap.deleted_at is null
  ) aop_links
  join public.wine_subregions ws on ws.id = aop_links.ws_id and ws.deleted_at is null
  join public.subregions s
    on s.region_id = ws.region_id
   and array_to_string(array(
         select unnest(string_to_array(
           trim(regexp_replace(lower(unaccent(ws.name_fr)), '[^a-z0-9]+', ' ', 'g')),
           ' '
         )) order by 1
       ), ' ')
       =
       array_to_string(array(
         select unnest(string_to_array(
           trim(regexp_replace(lower(unaccent(s.name_fr)), '[^a-z0-9]+', ' ', 'g')),
           ' '
         )) order by 1
       ), ' ')
on conflict do nothing;

""")

# Re-derive area_hectares from geometry for every subregion (the backfill
# from wine_subregions content is only valuable when the subregion name
# matched an old row — for geography-driven new splits like Rhône Nord/Sud,
# the area always comes from the commune union).
out.write("""-- Fill area_hectares from the commune union (always authoritative here).
update public.subregions s
set area_hectares = sub.hectares
from (
  select l.subregion_id,
         st_area(st_union(c.geometry)::geography) / 10000.0 as hectares
    from public.communes_full_subregion_link l
    join public.communes_full c on c.code_insee = l.commune_code_insee
   where c.geometry is not null
   group by l.subregion_id
) sub
where s.id = sub.subregion_id;

""")

# Backfill description_fr/en + centroids + color_hex from wine_subregions
# where the name matches, so re-runs don't lose editorial content that
# survived from before option-2.
out.write("""-- Backfill editorial content from wine_subregions where names match.
update public.subregions s
set description_fr = coalesce(s.description_fr, ws.description_fr),
    description_en = coalesce(s.description_en, ws.description_en),
    centroid_lat   = coalesce(s.centroid_lat,   ws.centroid_lat),
    centroid_lng   = coalesce(s.centroid_lng,   ws.centroid_lng),
    map_order      = coalesce(s.map_order,      ws.map_order)
from public.wine_subregions ws
where ws.region_id = s.region_id
  and ws.deleted_at is null
  and array_to_string(array(
        select unnest(string_to_array(
          trim(regexp_replace(lower(unaccent(ws.name_fr)), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )) order by 1
      ), ' ')
      =
      array_to_string(array(
        select unnest(string_to_array(
          trim(regexp_replace(lower(unaccent(s.name_fr)), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )) order by 1
      ), ' ');

""")

out.write("commit;\n")
