#!/usr/bin/env python3
"""
Generates SQL INSERT statements to populate communes_full, aop, and
communes_full_aop_link.

The source of truth for which AOPs to include is
`data/appellations/aop-list-full.txt`. Every entry in that list must resolve
to at least one IDA in the comagri dataset; unresolved entries are printed to
stderr and abort the run.

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
AOP_LIST  = f"{DATA_DIR}/appellations/aop-list-full.txt"

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

# Build lookup tables: direct normalized name → [ida], and " ou "-split → [ida]
exact_by_norm: dict[str, list[int]] = {}
split_by_norm: dict[str, list[int]] = {}
for ida, name in comagri_aops.items():
    cn = normalize(name)
    exact_by_norm.setdefault(cn, []).append(ida)
    if " ou " in cn:
        for part in cn.split(" ou "):
            split_by_norm.setdefault(part.strip(), []).append(ida)

# ── 2. Load authoritative AOP list and resolve each entry to comagri IDAs ─────
# MANUAL entries cover cases where the authoritative name doesn't normalize to
# a comagri name directly (historical names, varietal-scoped appellations that
# share a parent AOP, renamed AOPs, etc.).
MANUAL: dict[str, list[int]] = {
    # Alsace: all single-varietal or style-specific wines share AOP IDA 1
    # ("Alsace suivi d'un nom de lieu-dit" is the comagri umbrella entry).
    "ALSACE CHASSELAS OU GUTEDEL":      [1],
    "ALSACE GEWURZTRAMINER":            [1],
    "ALSACE MUSCAT":                    [1],
    "ALSACE PINOT NOIR":                [1],
    "ALSACE PINOT OU KLEVNER":          [1, 2],   # 2 = Alsace Klevener de Heiligenstein
    "ALSACE RIESLING":                  [1],
    "ALSACE SYLVANER":                  [1],
    "ALSACE TOKAY-PINOT GRIS":          [1],
    # Alsace grand cru: 51 individual lieux-dits (IDAs 3–52 + 1653).
    "ALSACE GRAND CRU":                 list(range(3, 53)) + [1653],
    # Beaujolais
    "BEAUJOLAIS SUPERIEUR (nouveau)":   [250],
    # Bordeaux: style/colour variants all share the base Bordeaux AOP (63).
    "BORDEAUX CLAIRET":                 [63],
    "BORDEAUX ROSE":                    [63],
    "BORDEAUX SEC":                     [63],
    # Historical names → current "Côtes de Bordeaux X" IDAs
    "BORDEAUX COTES DE FRANCS":         [1893],
    "COTES DE BLAYE":                   [1892],
    "COTES DE CASTILLON":               [1891],
    "PREMIERES COTES DE BLAYE":         [1892],
    "SAINTE-FOIX-BORDEAUX":             [2422],
    # Côtes de Bourg → "Côtes de Bourg, Bourg et Bourgeais" (IDA 66)
    "COTES DE BOURG":                   [66],
    # Graves Supérieures shares the Graves AOP (86)
    "GRAVES SUPERIEURES":               [86],
    # Moulis en Médoc = Moulis (IDA 2390)
    "MOULIS EN MEDOC":                  [2390],
    # Bourgogne
    "BIENVENUE BATARD-MONTRACHET":      [326],   # comagri: Bienvenues-Bâtard-Montrachet
    "BOURGOGNE ALIGOTE BOUZERON":       [1231],  # Bouzeron AOP
    "BOURGOGNE CLARET":                 [2184],  # style variant of base Bourgogne
    "BOURGOGNE GRAND ORDINAIRE":        [2184],  # ditto
    "BOURGOGNE PASSETOUTGRAIN":         [1876],  # comagri: Bourgogne Passe-tout-grains
    "BOURGOGNE VEZELAY":                [2428],  # renamed to simply "Vézelay"
    "MACON SUPERIEUR":                  [2216],  # style variant of Mâcon
    "NUIT-SAINT-GEORGES":               [926],   # typo in authoritative list
    "POUILLY-LOCHE":                    [1008],  # comagri lists only "Pouilly-Loché premier cru"
    # Rhône
    "COTEAUX DE PIERREVERT":            [1851],  # now simply "Pierrevert"
    "COTEAUX DU TRICASTIN":             [2123],  # renamed to "Grignan-les-Adhémar" in 2010
    "COTES DU LUBERON":                 [1862],  # now "Luberon"
    "COTES DU VENTOUX":                 [1305],  # now "Ventoux"
    # Languedoc-Roussillon
    "BANYULS GRAND CRU":                [1332],  # shares Banyuls AOP
    "BLANQUETTE DE LIMOUX":             [1235],  # under Limoux AOP umbrella
    "COTEAUX DU LANGUEDOC":             [2352],  # renamed to simply "Languedoc"
    "COTES DE LA MALEPERE":             [1414],  # now "Malepère"
    # Loire
    "CABERNET D'ANJOU":                 [158],   # style variant of Anjou
    "CHAUME":                           [2172],  # Coteaux du Layon premier cru Chaume
    "FIEFS VENDEENS AOVDQS":            [2176, 2177, 2178, 2179, 2180],
    "GROS PLANT AOVDQS":                [2171],  # Gros Plant du Pays nantais
    "MONTLOUIS":                        [191],   # now "Montlouis-sur-Loire"
    "MUSCADET COTES DE GRAND-LIEU":     [194],   # comagri: Muscadet Côtes de Grandlieu
    "MUSCADET DE SEVRE-ET-MAINE":       [195],
    "MUSCADET DES COTEAUX DE LA LOIRE": [2342],  # comagri: Muscadet Coteaux de la Loire
    "POUILLY-SUR-LOIRE":                [196],   # shares Pouilly-Fumé AOP
    "ROSE D'ANJOU":                     [158],   # style variant of Anjou
    "SAUMUR SEC BLANC":                 [203],   # Saumur blancs et rosés
    "SAVENNIERES COULEE-DE-SERRANT":    [2407],  # now simply "Coulée de Serrant"
    "SAVENNIERES ROCHES-AUX-MOINES":    [208],
    # Provence
    "COTEAUX D'AIX":                    [1320],  # Coteaux d'Aix-en-Provence
    # Sud-Ouest
    "BERGERAC SEC":                     [61],    # style variant of Bergerac
    "COTES DE BERGERAC MOELLEUX":       [1875],  # style variant
    "COTES DE SAINT-MONT AOVDQS":       [1733],  # now simply "Saint-Mont"
    "JURANCON SEC":                     [91],    # style variant of Jurançon
    # Name collides with a cheese AOP (1491); we want only the wine (1596).
    "VALENCAY AOVDQS":                  [1596],
    # Saumur has two comagri IDAs (blancs/rosés + rouges) for the same
    # geographic appellation. Include both explicitly so the ambiguity check
    # doesn't complain.
    "SAUMUR":                           [203, 204],
}


def resolve(entry: str) -> list[int]:
    """Return the comagri IDA(s) for an authoritative-list entry, or []."""
    if entry in MANUAL:
        return MANUAL[entry]
    # Strip the "AOVDQS" classifier anywhere in the entry; historical wines
    # still exist as AOPs (the category was abolished in 2011).
    clean = re.sub(r"\s+AOVDQS\b", "", entry).strip()
    norm = normalize(clean)
    if norm in exact_by_norm:
        matches = exact_by_norm[norm]
        # A collision on the normalized name usually means a non-wine AOP
        # shares the same label (e.g. Valençay the cheese vs the wine).
        # Force a MANUAL entry so we don't silently pick up the wrong IDA.
        if len(matches) > 1:
            raise SystemExit(
                f"Ambiguous match for {entry!r}: normalized name {norm!r} "
                f"resolves to multiple comagri IDAs {matches}. Add a MANUAL "
                f"entry to select the correct one."
            )
        return matches
    if norm in split_by_norm:
        return split_by_norm[norm]
    return []


allowed_idas: set[int] = set()
unresolved: list[str] = []

with open(AOP_LIST, encoding="utf-8") as f:
    for line in f:
        entry = line.strip()
        # Skip empties and category headers (e.g. "Corse :")
        if not entry or entry.endswith(":"):
            continue
        idas = resolve(entry)
        if idas:
            allowed_idas.update(idas)
        else:
            unresolved.append(entry)

if unresolved:
    print(
        f"-- ERROR: {len(unresolved)} authoritative-list entries did not resolve to any comagri AOP:",
        file=sys.stderr,
    )
    for h in unresolved:
        print(f"--   {h!r}", file=sys.stderr)
    sys.exit(1)

allowed_idas.discard(0)

# ── 2b. Integrity checks on the resolved set ──────────────────────────────────
# Check 1: every IDA referenced by MANUAL must actually exist in comagri.
# Catches typos like [1591] instead of [1596].
bad_manual = {
    entry: [ida for ida in idas if ida not in comagri_aops]
    for entry, idas in MANUAL.items()
    if any(ida not in comagri_aops for ida in idas)
}
if bad_manual:
    print("-- ERROR: MANUAL entries reference IDAs that don't exist in comagri:", file=sys.stderr)
    for entry, missing in bad_manual.items():
        print(f"--   {entry!r} → missing IDAs {missing}", file=sys.stderr)
    sys.exit(1)

# Check 2: none of the resolved IDAs should look non-wine. Comagri mixes wine
# AOPs with dairy, meat, oil, etc. — the comagri name will typically contain
# a giveaway keyword (fromage, beurre, huile, jambon, …). If a resolved IDA's
# name contains any of these, abort so a human can investigate.
NON_WINE_KEYWORDS = {
    # Each keyword is matched as a standalone word (whitespace boundaries)
    # against the normalized comagri name, to avoid false positives like
    # "bois" matching "Arbois" or "sel" matching "Sélestat".
    # dairy / cream
    "fromage", "beurre", "creme",
    # oils
    "huile",
    # nuts / chestnuts / fruits / vegetables / flowers
    "noix", "chataigne", "chataignes", "lentille", "lentilles", "oignon",
    "oignons", "pomme", "pommes", "abricot", "abricots", "figue", "figues",
    "cerise", "cerises", "melon", "melons", "safran", "ail", "lavande",
    "raisin",
    # meat / poultry / charcuterie
    "agneau", "veau", "volaille", "poulet", "dinde", "porc", "jambon",
    "saucisse", "charcuterie", "coppa", "lonzo", "taureau", "buf",
    "pres-sales", "kintoa",
    # spirits
    "armagnac", "cognac", "calvados", "marc", "fine", "eau-de-vie",
    "mirabelle", "kirsch", "rhum", "whisky", "pommeau", "floc",
    # cider (all ciders are not wine)
    "cidre",
    # honey / hay / flour / bread / mussels / wood / salt / olives
    "miel", "foin", "farine", "pain", "moules", "moule", "bois", "sel",
    "olive", "olives",
    # truffles
    "truffe", "truffes",
}
# Specific non-wine IDAs whose comagri name wouldn't trip the keyword check
# (e.g. cheese AOPs named simply "Abondance", "Brocciu", "Cantal"…).
NON_WINE_BY_NAME = {
    "abondance", "banon", "beaufort", "brocciu", "brousse du rove", "cantal",
    "chabichou du poitou", "chaource", "charolais", "chasselas de moissac",
    "chavignol", "chevrotin", "comte", "cornouaille", "domfront", "epoisses",
    "fourme d ambert", "fourme de montbrison", "laguiole", "langres", "livarot",
    "maroilles", "mont d or", "vacherin du haut doubs", "morbier", "mothais sur feuille",
    "munster", "muscat du ventoux", "neufchatel", "ossau iraty", "pays d auge",
    "picodon", "piment d espelette", "pont l eveque", "pouligny saint pierre",
    "reblochon de savoie", "rigotte de condrieu", "rocamadour", "roquefort",
    "saint nectaire", "sainte maure de touraine", "salers", "selles sur cher",
    "tome des bauges", "kintoa",
    # "Valençay" cheese (IDA 1491) — specifically excluded; wine (1596) is kept
    # via MANUAL.
}


def looks_non_wine(comagri_name: str) -> bool:
    n = normalize(comagri_name).lower()
    if n in NON_WINE_BY_NAME:
        return True
    words = set(n.split())
    return bool(words & NON_WINE_KEYWORDS)


# Look for IDAs that match the wine Valençay; it's the only name-collision
# where we need to be strict about which IDA out of a same-name pair is picked.
suspect = [
    (ida, comagri_aops[ida]) for ida in allowed_idas
    if looks_non_wine(comagri_aops[ida])
]
if suspect:
    print("-- ERROR: resolved IDAs look non-wine (check MANUAL mappings):", file=sys.stderr)
    for ida, name in sorted(suspect):
        print(f"--   {ida}  {name}", file=sys.stderr)
    sys.exit(1)

print(f"-- {len(allowed_idas)} AOPs resolved from the authoritative list", file=sys.stderr)

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

# Cleanup: delete any AOP row that isn't in the current allowed set.
# Cascades to communes_full_aop_link.
out.write("-- Remove any AOP not in the current allowed set\n")
out.write("delete from public.aop where id not in (\n")
out.write(",\n".join(f"  {ida}" for ida in sorted(allowed_idas)))
out.write("\n);\n\n")

# Wine AOPs
out.write("-- AOPs\n")
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
