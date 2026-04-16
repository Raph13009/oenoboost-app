# AOP migration — handoff context

Snapshot of the `appellations → aop` migration work done on branch `axl/map`, intended as complete context for a fresh session. Nothing was dropped — the old tables survive as a backup. Code no longer reads from them.

---

## 1. Why this migration

The old data model used `public.appellations` (uuid PK, ~311 rows with hand-written content) as the single source of truth for French wine AOPs. The map rendered AOP polygons by unioning geometries from `public.communes` (the old commune table) via `public.appellation_commune_links`.

Two problems drove the migration:

- The old `communes` table had incomplete geometry coverage, so the map looked broken in many regions.
- The `appellations` table had been curated manually and only covered a subset of France's ~380 wine AOPs, so lots of legitimate appellations simply didn't exist in the app.

A new authoritative dataset was imported earlier in the branch:

- `public.aop` — integer id (matching the `IDA` from the comagri dataset), `name` text, `area_m2` from the geometry, plus all the content columns we added in this migration (see §2).
- `public.communes_full` — complete INSEE commune set (~35k rows) with PostGIS geometry.
- `public.communes_full_aop_link` — junction, populated from the comagri `commune ↔ AOP` data.

At the start of this migration session, the map had already been cut over to the new `aop` / `communes_full` / `communes_full_aop_link` triple. But the rest of the app (detail pages, favorites, soil reverse-lookups, subregion navigation) still read from `appellations` and its junctions. This migration finishes the cut-over.

---

## 2. SQL migrations applied (2 new migrations, nothing dropped)

### `supabase/migrations/20260416100000_aop_enrich_and_link.sql`

Additive DDL + backfill. No `DROP`.

**Enriched `public.aop`** (`ALTER TABLE ADD COLUMN IF NOT EXISTS`):
- `slug varchar UNIQUE NOT NULL` (backfilled from `appellations.slug` where name-joined; fallback generated from `name` via `unaccent` + `[^a-z0-9]+ → '-'`)
- `area_hectares numeric`
- `producer_count integer`
- `production_volume_hl integer`
- `price_range_min_eur numeric`, `price_range_max_eur numeric`
- `history_fr text`, `history_en text`
- `colors_grapes_fr text`, `colors_grapes_en text`
- `soils_description_fr text`, `soils_description_en text`
- `is_premium boolean NOT NULL DEFAULT true`
- `status varchar NOT NULL DEFAULT 'published'` with CHECK in (`'draft'`,`'published'`,`'archived'`)
- `published_at timestamp`, `created_at`, `updated_at`, `deleted_at`

**Intentionally NOT added**: `name_fr`, `name_en`, `geojson`, `centroid_lat`, `centroid_lng`.
- `name_fr`/`name_en` → dropped; for AOPs the two values are always identical, so the schema keeps a single `name` column.
- `geojson`/`centroid_*` → the map gets polygons from `ST_Union(communes_full.geometry)` via the RPC `get_aop_communes_geojson`; the detail page never rendered these.

**Backfilled `aop.*` from `appellations`** via name-join `lower(trim(a.name)) = lower(trim(ap.name_fr)) AND ap.deleted_at IS NULL`.

**Created `public.aop_subregion_link`**:
```
aop_id       integer NOT NULL REFERENCES aop(id) ON DELETE CASCADE
subregion_id uuid    NOT NULL REFERENCES wine_subregions(id) ON DELETE CASCADE
PRIMARY KEY (aop_id, subregion_id)
```
Index on `subregion_id`. Public-read RLS policy. Backfilled from `appellation_subregion_links`.

**Created `public.aop_soil_link`**:
```
aop_id       integer NOT NULL REFERENCES aop(id) ON DELETE CASCADE
soil_type_id uuid    NOT NULL REFERENCES soil_types(id) ON DELETE CASCADE
PRIMARY KEY (aop_id, soil_type_id)
```
Index on `soil_type_id`. Public-read RLS policy. Backfilled from `appellation_soil_links`.

**Favorites polymorphic column widened**:
- `favorites.content_id uuid → text` via `USING content_id::text`. All existing uuid values still parse as uuid strings.
- Rows where `content_type='appellation'` had their `content_id` re-mapped from the old appellation uuid to the new `aop.id::text` (via the name-join above), and their `content_type` changed to `'aop'`.
- Any remaining `'appellation'` rows (users who favorited an AOP with no match in `aop`) were deleted.
- CHECK constraint on `content_type` was dropped (auto-named, looked up via `pg_constraint`) and re-added as:
  ```
  CHECK (content_type IN ('aop','grape','soil_type','vinification_type','dictionary_term'))
  ```
  — `'appellation'` is no longer accepted.

**RLS**: `aop` itself got a `public read aop` `SELECT USING (true)` policy if not already present. Same for both new link tables.

### `supabase/migrations/20260416110000_aop_backfill_refetch.sql`

Re-ran the same backfills with a stronger name-matching strategy, because the first pass used plain `lower(trim)` and missed ~40% of rows due to punctuation differences (e.g. `Canon-Fronsac` vs `Canon Fronsac`) and word reordering (`Cadillac Côtes de Bordeaux` vs `Côtes de Bordeaux Cadillac`).

The stronger match is a token-sort normalization:

```sql
array_to_string(array(
  select unnest(string_to_array(
    trim(regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', ' ', 'g')),
    ' '
  )) order by 1
), ' ')
```

It strips accents, replaces any non-alphanumeric run with a space, tokenizes on whitespace, sorts tokens alphabetically, and re-joins. So `"Cadillac Côtes de Bordeaux"` and `"Côtes de Bordeaux Cadillac"` both normalize to `"bordeaux cadillac cotes de"`.

- Content backfill re-ran with `COALESCE` so already-set columns were preserved.
- Both link tables got `INSERT ... ON CONFLICT DO NOTHING`, so existing rows stayed; new rows were added.

---

## 3. Current data state after migrations

All numbers confirmed via the Supabase REST API:

- `aop`: **352 rows**, all with non-null unique `slug`.
- `aop_subregion_link`: **197 rows** (from 316 old `appellation_subregion_links` rows — the gap is mostly appellations whose names don't match any `aop.name` because they aren't in the authoritative AOP list `data/appellations/aop-list-full.txt`).
- `aop_soil_link`: **5 rows** (from 10 old `appellation_soil_links`). Same cause.
- `aop` rows with `history_fr not null`: **31**. Content was only hand-written for ~31 AOPs in the old table; the rest of the 352 show the detail page with defaults / empty sections.
- `favorites`: **0 rows** for every `content_type`. User base is pre-launch.

**Old tables still intact** (untouched; serve as backup):
- `appellations` — 311 rows with `deleted_at IS NULL`
- `appellations_backup2`
- `appellation_commune_links`
- `appellation_grape_links`
- `appellation_soil_links` — 10 rows
- `appellation_subregion_links` — 316 rows
- `communes` (old commune table)
- `wine_subregions_backup`

---

## 4. Code changes

### `types/database.ts`
`Appellation` type updated:
- `id: string` → `id: number`
- Removed `name_fr`, `name_en`, `geojson`, `centroid_lat`, `centroid_lng`
- Added single `name: string`
- Kept `subregion_id: string` (virtual; populated at the query layer via `aop_subregion_link`, never a column on `aop` itself)
- Kept `history_fr/en`, `colors_grapes_fr/en`, `soils_description_fr/en` (genuinely different per locale)
- Lifecycle fields unchanged

### Queries — rewritten to read from `aop` + new junctions

- `features/vignoble/queries/appellations.queries.ts`
  - `getAppellations(subregionId)` now reads `aop_subregion_link` with embedded select `aop:aop_id(...)`.
  - `getAppellationBySlug(slug)` now reads `aop`.
  - Sort comparison switched from `a.name_fr` to `a.name`.

- `features/vignoble/queries/aop-navigation.queries.ts`
  - Local row types (`LinkAppellationRow`, `AopRecord`, `AopBrowseRow`, `AopBrowseItem`) rewritten: `id: number`, single `name` column, no `geojson`/centroids.
  - `getAopDetailByRegionAndSlug` follows the new junction via `aop_subregion_link.aop_id`.
  - `getAopBrowseItems` joins `aop_subregion_link` with embedded `aop:aop_id(...)` and `subregion:subregion_id(...)`.

- `features/vignoble/queries/aop-favorites.queries.ts`
  - `isAppellationFavorited` filters `content_type='aop'`.
  - `getFavoriteAppellationsForUser` filters `content_type='aop'`, parses `content_id` as int, joins against `aop` / `aop_subregion_link`. Export type `FavoriteAppellationRow.appellation` now picks `"id" | "slug" | "name"`.

- `features/sols/queries/soils.queries.ts`
  - `getRelatedSoilsForAppellation(appellationId: number)` reads `aop_soil_link` by `aop_id`.
  - `getRelatedAopsForSoil(soilId)` reads `aop_soil_link` + `aop` + `aop_subregion_link`. Param/return types use numeric `id`.

- `features/sols/types.ts` — `RelatedAop` dropped `name_fr`/`name_en`, now has single `name`; `id: string → number`.

- `features/favorites/queries/favorites.queries.ts`
  - `FavoritedIds` renamed field `appellationIds: Set<string> → aopIds: Set<string>`.
  - Predicate switched from `content_type === "appellation"` to `"aop"`.

### Actions

- `features/vignoble/actions/appellation-favorite-actions.ts` — all three queries (select / delete / insert) use `content_type: 'aop'`. Function still takes `appellationId: string` (callers pass `String(aop.id)`).

### Components (id prop coercion + `name` direct access)

- `features/vignoble/components/appellation-detail.tsx` — `name` read directly as `appellation.name`; `history`/`colors_grapes`/`soils_description` still go through `getContent()` because they're genuinely bilingual.
- `features/vignoble/components/appellation-card.tsx` — `appellation.name`; `appellationId={String(appellation.id)}`.
- `features/vignoble/components/appellation-favorite-button.tsx` — unchanged (prop stays `string`).
- `features/vignoble/components/favorite-appellations-list.tsx` — `row.appellation.name`; `String(row.appellation.id)`; `getContent` import dropped.
- `features/vignoble/components/aop-browse-card.tsx` — `item.name`; `String(item.id)`.
- `features/sols/components/soil-detail.tsx` — `aop.name`; `getContent` import dropped (no longer used in file).

### Pages

- `app/(app)/vignoble/[region]/[subregion]/page.tsx`
  - `favIds` default shape changed from `appellationIds: Set<string>` to `aopIds: Set<string>`.
  - `favIds.aopIds.has(String(aop.id))` replaces `favIds.appellationIds.has(aop.id)`.
  - `isAppellationFavorited(user.id, String(aop.appellation.id))`.
  - `AppellationDetail` `favorite.appellationId={String(aop.appellation.id)}`.

- `app/(app)/vignoble/aop/page.tsx` — same fav-shape + stringification.
- `app/(app)/cepages/page.tsx` — `favIds` default shape updated.
- `app/page.tsx` (homepage) — favorite-AOP strip uses `item.row.appellation.name` and `String(item.row.appellation.id)`.
- `app/profil/favoris/page.tsx` — no code change needed (consumes unchanged function signatures).

### Deleted (dead code)

- `features/vignoble/queries/get-appellation-communes-by-subregion-ids.ts`
- `features/vignoble/queries/get-appellations-by-subregion-ids.ts`
- `scripts/import_appellation_communes.py`
- `scripts/import_loire_commune_links.py`

### Verification gates passed

- `npx tsc --noEmit` — **0 errors**.
- Grep sweeps all clean:
  - `from "appellations"` / `.from("appellation_*_links")` — zero hits
  - `content_type.*appellation` / `'appellation'` — zero hits
  - `appellationIds` — zero hits

---

## 5. Missing junctions — AOP side has no equivalent

| Old table (linked to `appellations`) | `aop` equivalent | Status |
|---|---|---|
| `appellation_commune_links` (→ `communes`) | `communes_full_aop_link` (→ `communes_full`) | ✅ equivalent exists (points at the new commune table; functionally the same role) |
| `appellation_subregion_links` (→ `wine_subregions`) | `aop_subregion_link` (→ `wine_subregions`) | ✅ created in this migration |
| `appellation_soil_links` (→ `soil_types`) | `aop_soil_link` (→ `soil_types`) | ✅ created in this migration |
| **`appellation_grape_links` (→ `grapes`, with `is_primary` flag)** | **none** | ❌ **no `aop_grape_link`** — dead code audit found zero reads/writes in TS and Python. Left un-migrated by design. |
| `news_articles.linked_id` + `content_type='appellation'` (polymorphic, no FK) | no `'aop'` variant | ❌ code path exists in the schema CHECK but no reads/writes anywhere in the repo. Effectively dead. |

---

## 6. Future work / deferred items

1. **`aop_grape_link`** — if AOP detail pages ever need to display grape varieties, or if the grape detail page wants a reverse "AOPs using this grape" list, build a new N:N junction:
   ```sql
   create table public.aop_grape_link (
     aop_id     integer not null references public.aop(id)    on delete cascade,
     grape_id   uuid    not null references public.grapes(id) on delete cascade,
     is_primary boolean default true,
     primary key (aop_id, grape_id)
   );
   ```
   Data source: comagri doesn't include grape-variety → AOP mappings, so this is either hand-curated or scraped from INAO cahiers des charges. The old `appellation_grape_links` table has 0 rows as far as I know — check before backfilling.

2. **`wine_subregions` retirement** — `wine_subregions` (uuid id) is still referenced by `aop_subregion_link.subregion_id`. The minimal `subregions` table (integer id) was created and populated earlier in the branch specifically for the map (subregion polygons built from unioned communes). `wine_subregions` has 11 content columns (`slug`, `name_fr/en`, `description_fr/en`, `area_hectares`, `geojson`, `centroid_*`, `map_order`, `status`, `published_at`, etc.) that 6 query files read from. A future migration could:
   - Extend `subregions` with the needed content columns.
   - Backfill from `wine_subregions` by name match.
   - Repoint `aop_subregion_link.subregion_id` from uuid → integer (involves table rebuild).
   - Update all code in `features/vignoble/queries/*subregion*.ts` to read from `subregions`.
   - Drop `wine_subregions` + `wine_subregions_backup`.

   This was deliberately deferred — it's roughly as big as the migration described in this document.

3. **Eventual old-table cleanup** — once the new schema has been stable in production for a while, consider dropping:
   ```
   appellations, appellations_backup2, communes, wine_subregions_backup,
   appellation_commune_links, appellation_grape_links,
   appellation_soil_links, appellation_subregion_links
   ```
   in dependency order (junctions first, then `appellations` and `communes`). Not part of the current migration — user explicitly requested the backups stay.

4. **Typed favorite tables** — current pattern keeps `favorites` polymorphic with `content_type + content_id text`. Long-term, splitting into typed tables (`favorite_aops(user_id, aop_id)`, `favorite_grapes`, etc.) would give proper FKs. Not urgent.

5. **Content parity on `aop`** — only ~31 of the 352 `aop` rows have `history_fr`/`colors_grapes_fr`/`soils_description_fr` populated. The detail page renders empty sections for the rest. If this matters for launch, either:
   - Write more content (manual).
   - Hide empty sections in `features/vignoble/components/appellation-detail.tsx`.
   - Fall back to reading the old `appellations` table for unmatched rows (not recommended — creates two sources of truth again).

6. **Name-matching gaps** — the token-sort match in migration `20260416110000` still leaves ~119 old `appellations` rows unmatched. These are appellations that truly have no `aop` counterpart (historical/renamed/merged AOPs not in the authoritative list). If any of them should exist in `aop`, update `data/appellations/aop-list-full.txt` and re-run `data/import_communes_aop.py` (generates a new SQL migration).

---

## 7. Invariants / gotchas for future work

- **`aop.id` is `integer`, not uuid**. Any code touching favorites, URL slugs, or cross-table joins needs to know which type side it's on. Pattern used across the codebase: DB returns `number`, components/actions marshal via `String(id)` at the boundary when writing to `favorites.content_id` (which is now `text`).
- **`aop.name` is a single column**. Don't try to `getContent(aop, "name", locale)`; there's no `name_fr`/`name_en`. Other content fields (`history`, `colors_grapes`, `soils_description`) still have the `_fr`/`_en` split and still use `getContent()`.
- **Name-matching infrastructure is in the SQL migration, not in TypeScript**. The `unaccent` + regex + token-sort normalization only runs at migration time. If you need the same match at runtime (e.g. for a search feature), reimplement it carefully — the token-sort part has edge cases with short tokens.
- **`favorites.content_type = 'appellation'` is no longer a valid value** thanks to the replaced CHECK constraint. Any code or SQL that tries to insert this will fail.
- **`aop_subregion_link` still points at `wine_subregions` (uuid)**, not at the new `subregions` (integer). This is intentional because `wine_subregions` carries content that the subregion detail page still reads. If/when that's migrated (item 2 above), `aop_subregion_link.subregion_id` will need to be rebuilt as an integer FK.
- **RLS is on** for `aop`, `aop_subregion_link`, `aop_soil_link` with simple public-read (`USING (true)`) policies. The anon-key REST client requires these. If you clone the pattern for new tables, add the policy.
- **No RPC was added or changed** for this migration — the map's `get_aop_communes_geojson` RPC is untouched.

---

## 8. Paths cheat-sheet

### Migrations
- `supabase/migrations/20260416100000_aop_enrich_and_link.sql`
- `supabase/migrations/20260416110000_aop_backfill_refetch.sql`
- Earlier relevant: `20260407120000_communes_aop.sql`, `20260407130000_aop_map_rpc.sql`, `20260407180000_aop_data_auth_list.sql`, `20260407190000_aop_fix_valencay.sql`, `20260407200000_subregions.sql`, `20260407210000_subregions_to_n_n.sql`, `20260407220000_subregions_populate.sql`.

### Types
- `types/database.ts` — `Appellation`, `WineSubregion`, `Favorite`, etc.
- `features/sols/types.ts` — `RelatedAop`, `RelatedSoil`, `SoilType` re-export.

### Queries (all reads hit `aop` / `aop_*_link` / `wine_subregions`)
- `features/vignoble/queries/appellations.queries.ts`
- `features/vignoble/queries/aop-navigation.queries.ts`
- `features/vignoble/queries/aop-favorites.queries.ts`
- `features/vignoble/queries/regions.queries.ts` (unchanged)
- `features/vignoble/queries/subregions.queries.ts` (unchanged, reads `wine_subregions`)
- `features/vignoble/queries/get-subregions-by-region-id.ts`, `get-subregion-options-by-region-id.ts`, `get-regions.ts` (unchanged)
- `features/vignoble/queries/get-aop-communes-in-bbox.ts` (map RPC wrapper, unchanged)
- `features/sols/queries/soils.queries.ts`
- `features/favorites/queries/favorites.queries.ts`

### Actions
- `features/vignoble/actions/appellation-favorite-actions.ts`

### Components
- `features/vignoble/components/appellation-detail.tsx`
- `features/vignoble/components/appellation-card.tsx`
- `features/vignoble/components/appellation-favorite-button.tsx`
- `features/vignoble/components/favorite-appellations-list.tsx`
- `features/vignoble/components/aop-browse-card.tsx`
- `features/sols/components/soil-detail.tsx`

### Pages
- `app/page.tsx`
- `app/profil/favoris/page.tsx`
- `app/(app)/vignoble/page.tsx`
- `app/(app)/vignoble/aop/page.tsx`
- `app/(app)/vignoble/[region]/page.tsx`
- `app/(app)/vignoble/[region]/[subregion]/page.tsx`
- `app/(app)/cepages/page.tsx`

### Import pipeline
- `data/appellations/aop-list-full.txt` — source of truth for which AOPs exist in `aop`.
- `data/2025-10-09-comagri-communes-aires-ao.csv` — source of communes ↔ AOP.
- `data/v_commune_2026.csv` — INSEE communes (name, code, department).
- `data/communes-1000m.geojson` — commune geometries.
- `data/import_communes_aop.py` — generates the SQL that populates `aop`, `communes_full`, `communes_full_aop_link`.
- `data/populate_subregions.py` — generates the SQL that populates `subregions` and `communes_full_subregion_link` from the per-region JSONs under `data/config/`.

### Reference dump
- `.cursor/rules/DATABASE_SCHEMA.md` — full schema dump. **Pre-migration**. Any table edited by the migrations above may no longer match this file. Regenerate before trusting it.
