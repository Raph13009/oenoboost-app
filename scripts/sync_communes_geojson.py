#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for raw_line in ENV_PATH.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value
    return env


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

    def fetch_all_existing_codes(self) -> set[str]:
        start = 0
        codes: set[str] = set()
        while True:
            end = start + 999
            data, _ = self._request(
                "GET",
                "/rest/v1/communes?select=code_insee&order=id",
                headers={"Range": f"{start}-{end}"},
            )
            batch = data or []
            for row in batch:
                code = row.get("code_insee")
                if code:
                    codes.add(code)
            if len(batch) < 1000:
                break
            start += 1000
        return codes

    def insert_batch(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
        self._request(
            "POST",
            "/rest/v1/communes",
            headers={
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            body=body,
        )


def ensure_closed_ring(ring: list[list[float]]) -> list[list[float]]:
    if ring and ring[0] != ring[-1]:
        return ring + [ring[0]]
    return ring


def coords_to_wkt_pair(coord: list[float]) -> str:
    return f"{coord[0]} {coord[1]}"


def polygon_to_wkt(rings: list[list[list[float]]]) -> str:
    parts = []
    for ring in rings:
        closed = ensure_closed_ring(ring)
        parts.append("(" + ", ".join(coords_to_wkt_pair(pt) for pt in closed) + ")")
    return "(" + ", ".join(parts) + ")"


def geometry_to_ewkt(geometry: dict[str, Any]) -> str:
    geom_type = geometry["type"]
    coords = geometry["coordinates"]
    if geom_type == "Polygon":
        wkt = "MULTIPOLYGON(" + polygon_to_wkt(coords) + ")"
    elif geom_type == "MultiPolygon":
        polys = [polygon_to_wkt(poly) for poly in coords]
        wkt = "MULTIPOLYGON(" + ", ".join(polys) + ")"
    else:
        raise ValueError(f"Unsupported geometry type: {geom_type}")
    return f"SRID=4326;{wkt}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("geojson_path")
    parser.add_argument("--department")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    with (ROOT / args.geojson_path).open() as f:
        doc = json.load(f)

    features = doc.get("features", [])
    if args.department:
        features = [
            ft for ft in features if ft.get("properties", {}).get("departement") == args.department
        ]
    if args.limit is not None:
        features = features[: args.limit]

    env = read_env()
    client = SupabaseRest(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
    existing_codes = client.fetch_all_existing_codes()

    rows: list[dict[str, Any]] = []
    skipped_existing = 0
    for feature in features:
        props = feature["properties"]
        code = props["code"]
        if code in existing_codes:
            skipped_existing += 1
            continue
        rows.append(
            {
                "name": props["nom"],
                "code_insee": code,
                "geometry": geometry_to_ewkt(feature["geometry"]),
            }
        )

    print(
        json.dumps(
            {
                "requested_features": len(features),
                "to_insert": len(rows),
                "skipped_existing": skipped_existing,
                "sample": rows[:3],
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    if args.apply:
        batch_size = 100
        for start in range(0, len(rows), batch_size):
            client.insert_batch(rows[start : start + batch_size])
        print(f"\nInserted {len(rows)} communes.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
