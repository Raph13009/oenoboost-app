import json
from pathlib import Path


CONFIG_DIR = Path("/Users/raphaellevy/Desktop/Oenoboost-1/data/config")
FRANCE_BOUNDS = (-6.0, 41.0, 10.0, 51.5)


def validate_bbox(bbox):
    if not isinstance(bbox, list) or len(bbox) != 4:
        raise ValueError(f"Invalid bbox format: {bbox}")

    min_lng, min_lat, max_lng, max_lat = bbox
    if not all(isinstance(v, (int, float)) for v in bbox):
        raise ValueError(f"Non numeric bbox: {bbox}")
    if not (min_lng < max_lng and min_lat < max_lat):
        raise ValueError(f"Degenerate bbox: {bbox}")

    fr_min_lng, fr_min_lat, fr_max_lng, fr_max_lat = FRANCE_BOUNDS
    if not (
        fr_min_lng <= min_lng <= fr_max_lng
        and fr_min_lng <= max_lng <= fr_max_lng
        and fr_min_lat <= min_lat <= fr_max_lat
        and fr_min_lat <= max_lat <= fr_max_lat
    ):
        raise ValueError(f"Bbox outside France envelope: {bbox}")

    if (max_lng - min_lng) > 5 or (max_lat - min_lat) > 4:
        raise ValueError(f"Bbox too large for a subregion: {bbox}")


def main():
    config_files = sorted(CONFIG_DIR.glob("*.json"))
    if not config_files:
        raise SystemExit("No config files found.")

    for file_path in config_files:
        with file_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)

        if not isinstance(data, dict) or not data:
            raise ValueError(f"{file_path.name}: empty or invalid top-level object")

        for subregion_name, rules in data.items():
            if not isinstance(subregion_name, str) or not subregion_name.strip():
                raise ValueError(f"{file_path.name}: invalid subregion name")
            if not isinstance(rules, dict):
                raise ValueError(f"{file_path.name}: invalid rules for {subregion_name}")

            departements = rules.get("departements")
            bbox = rules.get("bbox")

            if not isinstance(departements, list) or not departements:
                raise ValueError(f"{file_path.name}: empty departements for {subregion_name}")
            if not all(isinstance(code, str) and code.strip() for code in departements):
                raise ValueError(f"{file_path.name}: invalid department code in {subregion_name}")

            validate_bbox(bbox)

        print(f"{file_path.stem}: {len(data)} subregions")


if __name__ == "__main__":
    main()
