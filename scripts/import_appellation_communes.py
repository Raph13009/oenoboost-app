#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from difflib import get_close_matches
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"
COMMUNE_ALIASES = {
    "l aubepin": "Les Trois-Châteaux",
    "beaufort": "Beaufort-Orbagna",
    "brery": "Domblans",
    "chazelles": "Les Trois-Châteaux",
    "grusse": "Val-Sonnette",
    "nanc les saint amour": "Les Trois-Châteaux",
    "orbagna": "Beaufort-Orbagna",
    "saint germain les arlay": "Arlay",
    "saint jean d etreux": "Les Trois-Châteaux",
    "saint laurent la roche": "La Chailleuse",
    "vercia": "Val-Sonnette",
    "vincelles": "Val-Sonnette",
    "francin": "Porte-de-Savoie",
    "les marches": "Porte-de-Savoie",
    "saint germain la chambotte": "Entrelacs",
    "venasgue": "Venasque",
    "le bois d oingt": "Val d'Oingt",
    "oingt": "Val d'Oingt",
    "saint laurent d oingt": "Val d'Oingt",
    "liergues": "Porte des Pierres Dorées",
    "pouilly le monial": "Porte des Pierres Dorées",
    "nuelles": "Saint-Germain-Nuelles",
    "saint germain sur l arbresle": "Saint-Germain-Nuelles",
    "les olmes": "Vindry-sur-Turdine",
    "les salles": "Les Salles-de-Castillon",
    "tillieres": "Sèvremoine",
    "drain": "Orée d'Anjou",
    "lire": "Orée d'Anjou",
    "saint crespin sur moine": "Sèvremoine",
    "saint hilaire de loulay": "Montaigu-Vendée",
    "saint gereon": "Ancenis-Saint-Géréon",
    "landemont": "Orée d'Anjou",
    "la varenne": "Orée d'Anjou",
    "ambillou chateau": "Tuffalun",
    "blaison gohier": "Blaison-Saint-Sulpice",
    "bouzille": "Orée d'Anjou",
    "breze": "Bellevigne-les-Châteaux",
    "brigne": "Doué-en-Anjou",
    "brissac quince": "Brissac Loire Aubance",
    "chace": "Bellevigne-les-Châteaux",
    "champ sur layon": "Bellevigne-en-Layon",
    "champtoceaux": "Orée d'Anjou",
    "chanzeaux": "Chemillé-en-Anjou",
    "concourson sur layon": "Doué-en-Anjou",
    "jumelles": "Longué-Jumelles",
    "luigne": "Brissac Loire Aubance",
    "martigne briand": "Terranjou",
    "notre dame d allencon": "Terranjou",
    "rablay sur layon": "Bellevigne-en-Layon",
    "saint aubin de luigne": "Val-du-Layon",
    "saint cyr en bourg": "Bellevigne-les-Châteaux",
    "saint georges sur layon": "Doué-en-Anjou",
    "saint lambert du lattay": "Val-du-Layon",
    "thouarce": "Bellevigne-en-Layon",
    "tigne": "Lys-Haut-Layon",
    "vauchretien": "Brissac Loire Aubance",
    "les verchers sur layon": "Doué-en-Anjou",
    "vihiers": "Lys-Haut-Layon",
    "villeveque": "Rives-du-Loir-en-Anjou",
    "canelle": "Cannelle",
    "saint andre d orcino": "Sant'Andréa-d'Orcino",
    "santa lucia di tallano": "Sainte-Lucie-de-Tallano",
    "cravant": "Deux Rivières",
    "gamay": "Saint-Aubin",
    "pontanevaux": "La Chapelle-de-Guinchay",
    "loche": "Mâcon",
    "lentheric": "Cabrerolles",
    "conilhac de la montagne": "Roquetaillade-et-Conilhac",
    "fa": "Val-du-Faby",
    "roquetaillade": "Roquetaillade-et-Conilhac",
    "plan de la tour": "Le Plan-de-la-Tour",
    "les arcs sur argens": "Les Arcs",
    "bergholtz zell": "Bergholtzzell",
    "hartmanswiller": "Hartmannswiller",
    "soultz": "Soultz-Haut-Rhin",
    "gimbrett": "Berstett",
}
COMMUNE_CODE_OVERRIDES = {
    "seyssel": ["01410", "74269"],
}
APPELLATION_ALIASES = {
    "vin de savoie": "Vin de Savoie ou Savoie",
    "vin de savoie abymes": "Vin de Savoie Abymes ou Les Abymes",
    "duche d uzes": "Duché d’Uzès",
    "duche duzes": "Duché d’Uzès",
    "haut benauge": "Bordeaux Haut-Benauge",
    "coteaux d ancenis": "Coteaux d'Ancenis",
    "coteaux dancenis": "Coteaux d'Ancenis",
    "cremant d alsace": "Cremant d'Alsace",
    "cremant dalsace": "Cremant d'Alsace",
}


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


def parse_markdown(path: Path) -> tuple[str | None, list[AppellationEntry]]:
    region: str | None = None
    current_name: str | None = None
    current_communes: list[str] = []
    entries: list[AppellationEntry] = []

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("# "):
            region = line[2:].strip()
            continue
        if line.startswith("## "):
            if current_name is not None:
                entries.append(AppellationEntry(current_name, current_communes))
            current_name = line[3:].strip()
            current_communes = []
            continue
        if line.startswith("- ") and current_name is not None:
            current_communes.append(line[2:].strip())

    if current_name is not None:
        entries.append(AppellationEntry(current_name, current_communes))

    return region, entries


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
        with urllib.request.urlopen(req, timeout=60) as response:
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

    def upsert_links(self, rows: list[dict[str, str]]) -> None:
        if not rows:
            return
        body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
        self._request(
            "POST",
            "/rest/v1/appellation_commune_links",
            headers={
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=representation",
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown_path")
    parser.add_argument("--department-code")
    parser.add_argument("--department-codes")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--apply-resolved", action="store_true")
    args = parser.parse_args()

    md_path = (ROOT / args.markdown_path).resolve()
    region, entries = parse_markdown(md_path)
    env = read_env()
    client = SupabaseRest(
        env["NEXT_PUBLIC_SUPABASE_URL"],
        env["SUPABASE_SERVICE_ROLE_KEY"],
    )

    appellations = client.fetch_all("appellations", "id,slug,name_fr")
    communes = client.fetch_all("communes", "id,name,code_insee")

    appellation_index = build_index(appellations, "name_fr")
    appellation_exact_index = defaultdict(list)
    for row in appellations:
      appellation_exact_index[normalize_exact(str(row["name_fr"]))].append(row)
    commune_index = build_index(communes, "name")
    appellation_keys = sorted(appellation_index.keys())
    commune_keys = sorted(commune_index.keys())
    allowed_department_codes = set()
    if args.department_code:
        allowed_department_codes.add(args.department_code)
    if args.department_codes:
        allowed_department_codes.update(
            code.strip() for code in args.department_codes.split(",") if code.strip()
        )

    links_to_insert: list[dict[str, str]] = []
    unresolved: list[dict[str, Any]] = []

    for entry in entries:
        app_key = normalize(entry.name)
        app_key_exact = normalize_exact(entry.name)
        if app_key in APPELLATION_ALIASES:
            alias_value = APPELLATION_ALIASES[app_key]
            app_key = normalize(alias_value)
            app_key_exact = normalize_exact(alias_value)
        app_matches = appellation_exact_index.get(app_key_exact, [])
        if len(app_matches) == 0:
            app_matches = appellation_index.get(app_key, [])
        if len(app_matches) != 1:
            unresolved.append(
                {
                    "type": "appellation",
                    "input": entry.name,
                    "matches": app_matches,
                    "suggestions": suggest(entry.name, appellation_keys),
                }
            )
            continue

        appellation_id = app_matches[0]["id"]
        for commune in entry.communes:
            commune_key = normalize(commune)
            commune_matches = commune_index.get(commune_key, [])

            if not commune_matches and commune_key in COMMUNE_ALIASES:
                commune_matches = commune_index.get(
                    normalize(COMMUNE_ALIASES[commune_key]),
                    [],
                )

            if commune_key in COMMUNE_CODE_OVERRIDES:
                override_codes = set(COMMUNE_CODE_OVERRIDES[commune_key])
                commune_matches = [
                    row
                    for row in communes
                    if (row.get("code_insee") or "") in override_codes
                ]

            if allowed_department_codes:
                department_matches = [
                    row
                    for row in commune_matches
                    if any(
                        (row.get("code_insee") or "").startswith(prefix)
                        for prefix in allowed_department_codes
                    )
                ]
                if len(department_matches) == 1:
                    commune_matches = department_matches
                elif len(department_matches) > 1:
                    commune_matches = department_matches

            if len(commune_matches) == 0:
                unresolved.append(
                    {
                        "type": "commune",
                        "appellation": entry.name,
                        "input": commune,
                        "matches": commune_matches,
                        "suggestions": suggest(commune, commune_keys),
                    }
                )
                continue
            for match in commune_matches:
                links_to_insert.append(
                    {
                        "appellation_id": appellation_id,
                        "commune_id": match["id"],
                    }
                )

    deduped_links = list(
        {
            (row["appellation_id"], row["commune_id"]): row
            for row in links_to_insert
        }.values()
    )

    report = {
        "region": region,
        "appellations_in_file": len(entries),
        "candidate_links": len(links_to_insert),
        "deduped_links": len(deduped_links),
        "unresolved_count": len(unresolved),
        "unresolved": unresolved,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if unresolved and not args.apply_resolved:
        print("\nImport not applied because unresolved matches remain.", file=sys.stderr)
        return 1

    if args.apply or args.apply_resolved:
        client.upsert_links(deduped_links)
        print(f"\nInserted/upserted {len(deduped_links)} links into appellation_commune_links.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
