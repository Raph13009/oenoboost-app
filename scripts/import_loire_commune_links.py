#!/usr/bin/env python3
"""
Insert appellation_commune_links for a fixed set of Loire appellations.

Strict commune matching (no guesses):
  - Only communes whose INSEE code starts with one of LOIRE_ALLOWED_DEPARTMENTS.
  - Normalized exact name + LOIRE_COMMUNE_ALIASES only (no global fuzzy).
  - Homonyms: disambiguate with block department hints ∩ allowed set + sibling vote.

Cleanup:
  --delete-loire-links  Delete all appellation_commune_links for appellations that
                        belong to the Loire wine region (wine_regions / subregions),
                        plus appellations from this script's name list.
  --clean-and-apply     --delete-loire-links then insert (strict).
  --purge-withdrawn-loire-aops  Delete ALL commune links for appellations retirées de
                        l’import (Cour-Cheverny, Coteaux du Loir, Vendômois, Bourgueil).

Only INSERT; Prefer: resolution=ignore-duplicates (ON CONFLICT DO NOTHING).

Usage:
  python scripts/import_loire_commune_links.py
  python scripts/import_loire_commune_links.py --apply
  python scripts/import_loire_commune_links.py --delete-loire-links
  python scripts/import_loire_commune_links.py --clean-and-apply
  python scripts/import_loire_commune_links.py --purge-withdrawn-loire-aops

Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations

import argparse
import json
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from difflib import get_close_matches
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"

# INSEE département prefixes allowed for any Loire commune link (strict belt).
LOIRE_ALLOWED_DEPARTMENTS: frozenset[str] = frozenset(
    {"44", "49", "37", "41", "72", "86"},
)

# wine_regions.slug values that identify the Loire valley app (for safe DELETE scope).
LOIRE_WINE_REGION_SLUGS: frozenset[str] = frozenset(
    {"loire", "vallee-de-la-loire"},
)

# Retirées de l’import : liens communes erronés (carte hors Loire). Purger la DB avec
#   --purge-withdrawn-loire-aops
WITHDRAWN_LOIRE_APPELLATION_SLUGS: frozenset[str] = frozenset(
    {
        "cour-cheverny",
        "coteaux-du-loir",
        "coteaux-du-vendomois",
        "bourgueil",
    },
)

# Extra commune name hints (normalized key -> exact commune name as in DB `communes.name`)
LOIRE_COMMUNE_ALIASES: dict[str, str] = {
    # Merged / renamed communes (Loire)
    "martigne briand": "Martigné-Briand",
    "brissac quince": "Brissac Loire Aubance",
    "chateau la valliere": "Château-la-Vallière",
    "ingrandes de touraine": "Ingrandes-de-Touraine",
    "ingrandes le fresne sur loire": "Ingrandes-Le Fresne sur Loire",
    "les roches l eveque": "Les Roches-l'Évêque",
    # Spelling variant (official name uses Lorouer)
    "saint pierre du lorouet": "Saint-Pierre-du-Lorouer",
    "mont pres chambord": "Mont-près-Chambord",
    "fougeres sur bievre": "Fougères-sur-Bièvre",
    "val en vignes": "Val en Vignes",
}

# Try these name_fr variants in order until a unique appellation is found.
# (Cour-Cheverny, Coteaux du Loir, Coteaux du Vendômois, Bourgueil retirés — liens purgeables en DB.)
LOIRE_APPELLATION_NAME_CANDIDATES: list[list[str]] = [
    ["Coteaux de Saumur"],
    ["Anjou Villages Brissac"],
    ["Coteaux du Layon"],
    [
        "Anjou-Coteaux de la Loire",
        "Anjou Coteaux de la Loire",
        "Anjou-coteaux de la Loire",
    ],
    ["Coteaux de l'Aubance", "Coteaux de l’Aubance"],
    ["Cabernet de Saumur"],
    ["Bonnezeaux"],
]

LOIRE_COMMUNE_LISTS: list[list[str]] = [
    # Coteaux de Saumur
    [
        "Artannes-sur-Thouet",
        "Brézé",
        "Distré",
        "Montreuil-Bellay",
        "Parnay",
        "Rou-Marson",
        "Saumur",
        "Saint-Cyr-en-Bourg",
        "Turquant",
        "Varrains",
    ],
    # Anjou Villages Brissac
    [
        "Brissac Loire Aubance",
        "Juigné-sur-Loire",
        "Mûrs-Erigné",
        "Saint-Jean-des-Mauvrets",
        "Saint-Melaine-sur-Aubance",
        "Soulaines-sur-Aubance",
    ],
    # Coteaux du Layon
    [
        "Aubigné-sur-Layon",
        "Beaulieu-sur-Layon",
        "Bellevigne-en-Layon",
        "Champ-sur-Layon",
        "Chaudefonds-sur-Layon",
        "Cléré-sur-Layon",
        "Concourson-sur-Layon",
        "Doué-en-Anjou",
        "Faye-d'Anjou",
        "Les Gardes",
        "Luigné",
        "Martigné-Briand",
        "Passavant-sur-Layon",
        "Rablay-sur-Layon",
        "Rochefort-sur-Loire",
        "Saint-Aubin-de-Luigné",
        "Saint-Georges-sur-Layon",
        "Saint-Lambert-du-Lattay",
        "Thouarcé",
        "Tigné",
        "Val-du-Layon",
        "Les Verchers-sur-Layon",
        "Vihiers",
    ],
    # Anjou-Coteaux de la Loire
    [
        "Bouchemaine",
        "Champtocé-sur-Loire",
        "La Chapelle-Saint-Florent",
        "Chaudefonds-sur-Layon",
        "Ingrandes-Le Fresne sur Loire",
        "Montjean-sur-Loire",
        "La Possonnière",
        "Rochefort-sur-Loire",
        "Saint-Georges-sur-Loire",
        "Savennières",
    ],
    # Coteaux de l'Aubance
    [
        "Brissac Loire Aubance",
        "Juigné-sur-Loire",
        "Mûrs-Erigné",
        "Saint-Jean-des-Mauvrets",
        "Saint-Melaine-sur-Aubance",
        "Saint-Rémy-la-Varenne",
        "Saint-Saturnin-sur-Loire",
        "Soulaines-sur-Aubance",
        "Vauchrétien",
    ],
    # Cabernet de Saumur
    [
        "Allonnes",
        "Ambillou-Château",
        "Antoigné",
        "Artannes-sur-Thouet",
        "Bellevigne-les-Châteaux",
        "Brain-sur-Allonnes",
        "Brézé",
        "Brossay",
        "Cernusson",
        "Chacé",
        "Cizay-la-Madeleine",
        "Le Coudray-Macouard",
        "Courchamps",
        "Dénezé-sous-Doué",
        "Distré",
        "Doué-en-Anjou",
        "Épieds",
        "Fontevraud-l'Abbaye",
        "Gennes-Val-de-Loire",
        "Louerre",
        "Ménitré",
        "Montsoreau",
        "Montreuil-Bellay",
        "Noyant-la-Plaine",
        "Parnay",
        "Le Puy-Notre-Dame",
        "Rou-Marson",
        "Saint-Cyr-en-Bourg",
        "Saint-Just-sur-Dive",
        "Saint-Macaire-du-Bois",
        "Saint-Martin-du-Fouilloux",
        "Saint-Sigismond",
        "Saumur",
        "Soucelles",
        "Souzay-Champigny",
        "Turquant",
        "Les Ulmes",
        "Varennes-sur-Loire",
        "Varrains",
        "Vaudelnay",
        "Verrie",
        "Villevêque",
        "Berrie",
        "Curçay-sur-Dive",
        "Glénouze",
        "Pouançay",
        "Ranton",
        "Saint-Léger-de-Montbrillais",
        "Saix",
        "Ternay",
        "Les Trois-Moutiers",
        "Bouillé-Saint-Paul",
        "Cersay",
        "Saint-Martin-de-Sanzay",
        "Thouars",
        "Tourtenay",
        "Val en Vignes",
    ],
    # Bonnezeaux
    ["Thouarcé"],
]

# INSEE department prefixes allowed per appellation block (wine geography).
LOIRE_DEPARTMENT_HINTS: list[list[str]] = [
    ["49"],
    ["49"],
    ["49"],
    ["49"],
    ["49"],
    ["37", "41", "44", "49", "72", "86"],
    ["49"],
]


def assert_data_aligned() -> None:
    if len(LOIRE_APPELLATION_NAME_CANDIDATES) != len(LOIRE_COMMUNE_LISTS):
        raise RuntimeError(
            "LOIRE_APPELLATION_NAME_CANDIDATES and LOIRE_COMMUNE_LISTS length mismatch"
        )
    if len(LOIRE_DEPARTMENT_HINTS) != len(LOIRE_APPELLATION_NAME_CANDIDATES):
        raise RuntimeError(
            "LOIRE_DEPARTMENT_HINTS and LOIRE_APPELLATION_NAME_CANDIDATES length mismatch"
        )


@dataclass
class AppellationEntry:
    name: str
    communes: list[str]


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for raw_line in ENV_PATH.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value
    return env


def strip_notes(value: str) -> str:
    base = value.split("(", 1)[0].strip()
    for separator in [" — ", " – ", " - "]:
        if separator in base:
            base = base.split(separator, 1)[0].strip()
            break
    return " ".join(base.split())


def normalize(value: str) -> str:
    value = strip_notes(value)
    value = value.lower()
    value = value.replace("œ", "oe").replace("æ", "ae")
    value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    for old, new in {
        "’": "'",
        "`": "'",
        "´": "'",
        "'": " ",
        "-": " ",
        "_": " ",
        "/": " ",
        ",": " ",
        ".": " ",
    }.items():
        value = value.replace(old, new)
    return " ".join(value.split())


def normalize_exact(value: str) -> str:
    value = value.lower().replace("œ", "oe").replace("æ", "ae")
    value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    for old, new in {
        "’": "'",
        "`": "'",
        "´": "'",
        "'": " ",
        "-": " ",
        "_": " ",
        "/": " ",
        ",": " ",
        ".": " ",
        "(": " ",
        ")": " ",
    }.items():
        value = value.replace(old, new)
    return " ".join(value.split())


def encode_params(params: dict[str, str]) -> str:
    return urllib.parse.urlencode(params, safe="(),.*")


class SupabaseRest:
    def __init__(self, base_url: str, service_key: str):
        self.base_url = base_url.rstrip("/")
        self.service_key = service_key

    def _request(
        self,
        method: str,
        path: str,
        headers: dict[str, str] | None = None,
        body: bytes | None = None,
    ) -> tuple[Any, dict[str, str]]:
        req_headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(
            self.base_url + path,
            data=body,
            headers=req_headers,
            method=method,
        )
        with urllib.request.urlopen(req, timeout=120) as response:
            payload = response.read()
            data = json.loads(payload.decode("utf-8")) if payload else None
            return data, dict(response.headers)

    def fetch_all(self, table: str, select: str, page_size: int = 1000) -> list[dict[str, Any]]:
        start = 0
        rows: list[dict[str, Any]] = []
        while True:
            end = start + page_size - 1
            data, _ = self._request(
                "GET",
                f"/rest/v1/{table}?{encode_params({'select': select, 'order': 'id'})}",
                headers={"Range": f"{start}-{end}"},
            )
            batch = data or []
            rows.extend(batch)
            if len(batch) < page_size:
                break
            start += page_size
        return rows

    def insert_links_ignore_duplicates(self, rows: list[dict[str, str]]) -> None:
        """INSERT ... ON CONFLICT DO NOTHING (requires unique constraint on pair)."""
        if not rows:
            return
        body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
        self._request(
            "POST",
            "/rest/v1/appellation_commune_links",
            headers={
                "Content-Type": "application/json",
                "Prefer": "resolution=ignore-duplicates,return=minimal",
            },
            body=body,
        )


def build_index(rows: list[dict[str, Any]], name_key: str) -> dict[str, list[dict[str, Any]]]:
    index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        index[normalize(str(row[name_key]))].append(row)
    return index


def suggest(value: str, keys: list[str]) -> list[str]:
    return get_close_matches(normalize(value), keys, n=3, cutoff=0.75)


def dept2(row: dict[str, Any]) -> str | None:
    c = row.get("code_insee")
    if c is None or len(str(c)) < 2:
        return None
    return str(c)[:2]


def is_loire_commune_row(row: dict[str, Any]) -> bool:
    d = dept2(row)
    return d is not None and d in LOIRE_ALLOWED_DEPARTMENTS


def communes_loire_only(communes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [c for c in communes if is_loire_commune_row(c)]


def row_in_departments(row: dict[str, Any], prefixes: list[str]) -> bool:
    d = dept2(row)
    if d is None:
        return False
    return d in prefixes


def filter_by_departments(
    rows: list[dict[str, Any]], prefixes: list[str]
) -> list[dict[str, Any]]:
    if not prefixes:
        return [r for r in rows if is_loire_commune_row(r)]
    return [r for r in rows if row_in_departments(r, prefixes)]


def effective_block_departments(block_idx: int) -> list[str]:
    hinted = LOIRE_DEPARTMENT_HINTS[block_idx]
    inter = [d for d in hinted if d in LOIRE_ALLOWED_DEPARTMENTS]
    return inter if inter else sorted(LOIRE_ALLOWED_DEPARTMENTS)


def disambiguate_rows(
    rows: list[dict[str, Any]],
    dept_prefixes: list[str],
    sibling_counts: Counter[str],
) -> dict[str, Any] | None:
    if not rows:
        return None
    filtered = filter_by_departments(rows, dept_prefixes)
    if not filtered:
        return None
    if len(filtered) == 1:
        return filtered[0]

    best: dict[str, Any] | None = None
    best_score = -1
    for r in filtered:
        d = dept2(r)
        sc = sibling_counts.get(d, 0) if d else 0
        if sc > best_score:
            best_score = sc
            best = r
    if best is not None and best_score > 0:
        return best

    for pref in dept_prefixes:
        for r in filtered:
            if dept2(r) == pref:
                return r
    return filtered[0]


def resolve_commune_for_import(
    label: str,
    commune_index_loire: dict[str, list[dict[str, Any]]],
    block_idx: int,
    sibling_counts: Counter[str],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """Exact normalized match + aliases only; communes must be in LOIRE_ALLOWED_DEPARTMENTS."""
    dept_prefixes = effective_block_departments(block_idx)
    nk = normalize(label)
    matches = list(commune_index_loire.get(nk, []))

    if not matches and nk in LOIRE_COMMUNE_ALIASES:
        alias_target = normalize(LOIRE_COMMUNE_ALIASES[nk])
        matches = list(commune_index_loire.get(alias_target, []))

    if not matches:
        return None, []

    chosen = disambiguate_rows(matches, dept_prefixes, sibling_counts)
    if chosen is None:
        return None, matches
    return chosen, matches


def resolve_appellation(
    candidates: list[str],
    appellation_exact_index: dict[str, list[dict[str, Any]]],
    appellation_index: dict[str, list[dict[str, Any]]],
) -> dict[str, Any] | None:
    for name in candidates:
        ek = normalize_exact(name)
        m = appellation_exact_index.get(ek, [])
        if len(m) == 1:
            return m[0]
    for name in candidates:
        nk = normalize(name)
        m = appellation_index.get(nk, [])
        if len(m) == 1:
            return m[0]
    return None


def build_entries() -> list[AppellationEntry]:
    assert_data_aligned()
    entries: list[AppellationEntry] = []
    for candidates, communes in zip(
        LOIRE_APPELLATION_NAME_CANDIDATES,
        LOIRE_COMMUNE_LISTS,
        strict=True,
    ):
        label = candidates[0]
        entries.append(AppellationEntry(name=label, communes=communes))
    return entries


def chunk_list(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def fetch_loire_appellation_ids_from_regions(client: SupabaseRest) -> list[str]:
    regions = client.fetch_all("wine_regions", "id,slug")
    loire_region_ids = [
        str(r["id"])
        for r in regions
        if str(r.get("slug") or "").lower() in LOIRE_WINE_REGION_SLUGS
    ]
    if not loire_region_ids:
        return []

    sub_ids: list[str] = []
    for rid in loire_region_ids:
        data, _ = client._request(
            "GET",
            f"/rest/v1/wine_subregions?region_id=eq.{rid}&select=id",
        )
        for row in data or []:
            if row.get("id"):
                sub_ids.append(str(row["id"]))

    if not sub_ids:
        return []

    app_ids: set[str] = set()
    for chunk in chunk_list(sub_ids, 80):
        in_q = ",".join(chunk)
        path = (
            f"/rest/v1/appellation_subregion_links?"
            f"subregion_id=in.({in_q})&select=appellation_id"
        )
        data, _ = client._request("GET", path)
        for row in data or []:
            aid = row.get("appellation_id")
            if aid:
                app_ids.add(str(aid))
    return sorted(app_ids)


def collect_loire_appellation_ids_for_delete(
    client: SupabaseRest,
    appellation_exact_index: dict[str, list[dict[str, Any]]],
    appellation_index: dict[str, list[dict[str, Any]]],
) -> list[str]:
    ids: set[str] = set(fetch_loire_appellation_ids_from_regions(client))
    for candidates in LOIRE_APPELLATION_NAME_CANDIDATES:
        row = resolve_appellation(candidates, appellation_exact_index, appellation_index)
        if row:
            ids.add(str(row["id"]))
    return sorted(ids)


def delete_commune_links_for_appellations(
    client: SupabaseRest, appellation_ids: list[str]
) -> None:
    for chunk in chunk_list(appellation_ids, 40):
        if not chunk:
            continue
        in_q = ",".join(chunk)
        path = f"/rest/v1/appellation_commune_links?appellation_id=in.({in_q})"
        client._request(
            "DELETE",
            path,
            headers={"Prefer": "return=minimal"},
        )


def fetch_appellation_ids_by_slugs(
    client: SupabaseRest, slugs: frozenset[str]
) -> tuple[list[str], list[str]]:
    """Returns (ids, slugs_not_found_in_db)."""
    if not slugs:
        return [], []
    slug_list = sorted(slugs)
    ids: list[str] = []
    found_lower: set[str] = set()
    for chunk in chunk_list(slug_list, 40):
        in_q = ",".join(chunk)
        path = f"/rest/v1/appellations?slug=in.({in_q})&select=id,slug"
        data, _ = client._request("GET", path)
        for row in data or []:
            if row.get("id"):
                ids.append(str(row["id"]))
            s = row.get("slug")
            if s is not None:
                found_lower.add(str(s).strip().lower())
    missing = sorted(s for s in slug_list if s.strip().lower() not in found_lower)
    return ids, missing


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Loire appellation–commune links")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Insert rows via Supabase (otherwise dry-run only)",
    )
    parser.add_argument(
        "--delete-loire-links",
        action="store_true",
        help="Delete appellation_commune_links for Loire-scope appellations only",
    )
    parser.add_argument(
        "--clean-and-apply",
        action="store_true",
        help="Delete Loire links then insert (strict)",
    )
    parser.add_argument(
        "--purge-withdrawn-loire-aops",
        action="store_true",
        help="Delete appellation_commune_links for withdrawn Loire AOP slugs (see WITHDRAWN_LOIRE_APPELLATION_SLUGS)",
    )
    args = parser.parse_args()

    if args.clean_and_apply:
        args.delete_loire_links = True
        args.apply = True

    if args.purge_withdrawn_loire_aops and (
        args.apply or args.delete_loire_links or args.clean_and_apply
    ):
        print(
            "Incompatible: --purge-withdrawn-loire-aops seul (sans --apply / --delete-loire-links).",
            file=sys.stderr,
        )
        return 2

    if args.purge_withdrawn_loire_aops:
        if not ENV_PATH.is_file():
            print(
                f"Missing {ENV_PATH} (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)",
                file=sys.stderr,
            )
            return 1
        env = read_env()
        client = SupabaseRest(
            env["NEXT_PUBLIC_SUPABASE_URL"],
            env["SUPABASE_SERVICE_ROLE_KEY"],
        )
        ids, missing = fetch_appellation_ids_by_slugs(
            client, WITHDRAWN_LOIRE_APPELLATION_SLUGS
        )
        print(
            json.dumps(
                {
                    "purge": "withdrawn_loire_aops",
                    "slugs": sorted(WITHDRAWN_LOIRE_APPELLATION_SLUGS),
                    "appellation_ids": ids,
                    "slugs_not_found": missing,
                },
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        delete_commune_links_for_appellations(client, ids)
        print(
            f"Purge: deleted commune links for {len(ids)} appellations "
            f"(slugs manquants en base: {len(missing)}).",
            file=sys.stderr,
        )
        return 0

    assert_data_aligned()
    entries = build_entries()

    if not ENV_PATH.is_file():
        print(f"Missing {ENV_PATH} (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)", file=sys.stderr)
        return 1

    env = read_env()
    client = SupabaseRest(
        env["NEXT_PUBLIC_SUPABASE_URL"],
        env["SUPABASE_SERVICE_ROLE_KEY"],
    )

    appellations = client.fetch_all("appellations", "id,slug,name_fr")
    communes = client.fetch_all("communes", "id,name,code_insee")

    appellation_index = build_index(appellations, "name_fr")
    appellation_exact_index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in appellations:
        appellation_exact_index[normalize_exact(str(row["name_fr"]))].append(row)

    delete_only = args.delete_loire_links and not args.apply
    if delete_only:
        to_delete = collect_loire_appellation_ids_for_delete(
            client, appellation_exact_index, appellation_index
        )
        print(
            json.dumps(
                {
                    "delete_loire_scope": True,
                    "appellation_ids_count": len(to_delete),
                    "appellation_ids_sample": to_delete[:30],
                },
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        delete_commune_links_for_appellations(client, to_delete)
        print(
            f"Deleted appellation_commune_links for {len(to_delete)} Loire-scope appellations.",
            file=sys.stderr,
        )
        return 0

    communes_loire = communes_loire_only(communes)
    commune_index_loire = build_index(communes_loire, "name")
    commune_keys_loire = sorted(commune_index_loire.keys())

    links_to_insert: list[dict[str, str]] = []
    unresolved: list[dict[str, Any]] = []
    resolved_apps: list[dict[str, Any]] = []

    for idx, entry in enumerate(entries):
        candidates = LOIRE_APPELLATION_NAME_CANDIDATES[idx]
        app_row = resolve_appellation(candidates, appellation_exact_index, appellation_index)
        if app_row is None:
            all_matches: list[dict[str, Any]] = []
            for name in candidates:
                ek = normalize_exact(name)
                all_matches.extend(appellation_exact_index.get(ek, []))
                nk = normalize(name)
                all_matches.extend(appellation_index.get(nk, []))
            unresolved.append(
                {
                    "type": "appellation",
                    "candidates": candidates,
                    "matches": all_matches[:20],
                    "suggestions": suggest(
                        candidates[0],
                        sorted(appellation_index.keys()),
                    ),
                }
            )
            continue

        resolved_apps.append(
            {"name_fr": app_row["name_fr"], "id": app_row["id"], "slug": app_row.get("slug")}
        )
        appellation_id = str(app_row["id"])
        sibling_dept_counts: Counter[str] = Counter()

        for commune in entry.communes:
            match, all_matches = resolve_commune_for_import(
                commune,
                commune_index_loire,
                idx,
                sibling_dept_counts,
            )
            if match is None:
                unresolved.append(
                    {
                        "type": "commune",
                        "appellation": entry.name,
                        "input": commune,
                        "matches": all_matches,
                        "suggestions": suggest(commune, commune_keys_loire),
                    }
                )
                continue
            d = dept2(match)
            if d:
                sibling_dept_counts[d] += 1
            links_to_insert.append(
                {
                    "appellation_id": appellation_id,
                    "commune_id": str(match["id"]),
                }
            )

    deduped = list(
        {(r["appellation_id"], r["commune_id"]): r for r in links_to_insert}.values()
    )

    report: dict[str, Any] = {
        "strict_departments": sorted(LOIRE_ALLOWED_DEPARTMENTS),
        "dry_run": not args.apply,
        "appellations_resolved": len(resolved_apps),
        "candidate_links": len(links_to_insert),
        "deduped_links": len(deduped),
        "unresolved_count": len(unresolved),
        "resolved_appellations": resolved_apps,
        "unresolved": unresolved,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if unresolved:
        print(
            "\nUnresolved items — fix aliases or DB names, then re-run.",
            file=sys.stderr,
        )
        return 1

    if args.delete_loire_links and args.apply:
        to_delete = collect_loire_appellation_ids_for_delete(
            client, appellation_exact_index, appellation_index
        )
        print(
            json.dumps(
                {
                    "delete_loire_scope": True,
                    "appellation_ids_count": len(to_delete),
                    "appellation_ids_sample": to_delete[:30],
                },
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        delete_commune_links_for_appellations(client, to_delete)
        print(
            f"Deleted appellation_commune_links for {len(to_delete)} Loire-scope appellations.",
            file=sys.stderr,
        )

    if args.apply:
        batch_size = 500
        for start in range(0, len(deduped), batch_size):
            client.insert_links_ignore_duplicates(deduped[start : start + batch_size])
        print(f"\nInserted up to {len(deduped)} links (duplicates ignored).", file=sys.stderr)
    else:
        print(
            "\nDry run only. Re-run with --apply after resolving any issues.",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
