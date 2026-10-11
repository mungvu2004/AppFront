<!-- qa-sources be=unknown (not recorded; BE worktree is 0 commits behind origin/main) -->
# Phase 04 — Backend coverage (QC layers: spatial layer read/write, floor meta, project graph, floors list)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`), branch `main`, `git status`: up to date with `origin/main`
(HEAD `bf83f815` = `versionCheck.apiBuiltCommit`; the stamp above stays `unknown` as instructed). Every `file:line` is under
`apps/api/` unless it starts with `packages/` or `deploy/`.
API spec: `qa/tests/phase04_qc_layers_api.spec.ts` — **9 tests** (`--list`), evidence prefix `A04_` (JSON exchanges; the
"large" case writes a summary JSON). Author run `run-20-author` (`node tools/run-phase.mjs --phase 04 --run-id run-20-author
--layers api --no-watch --grep "A04"`): **9 passed / 9**, evidence ok (219 `A04_*.json`),
`F:/App/qa-results/run-20-author/phase04-api/results.json`.
UI specs of the phase: main `phase04_qc_layers.spec.ts`, ui `phase04_qc_layers_ui.spec.ts` (written in parallel by another
agent; its header says "No faked response"), no edge spec yet.
Endpoints called by the phase's screens (FE `src/api/endpoints.ts:251-265` `spatial.floor|graph|layer`, `:109-112`
`floors.list`; SCR-14 "Áp cho mọi tầng" = `useScaleCalibration.ts` onApply → #12 + N15 then one PUT per floor):

| # | Method + path | BE handler |
|---|---|---|
| N16 | `GET /api/projects/:p/floors/:f/spatial/layer` | spatial_read/router.py:71-87 |
| #35 | `PUT /api/projects/:p/floors/:f/spatial/layer` | spatial_write/router.py:45-67 → writer.py:196-241 |
| #33 | `GET /api/projects/:p/floors/:f/spatial` | spatial_read/router.py:58-62 |
| N15 | `GET /api/projects/:p/spatial` | spatial_read/router.py:65-68 → graph.py:173-208 |
| #12 | `GET /api/projects/:p/floors` | floors/router.py:46-49 → service.py:197-199 |

Status words: **pass** (asserted by a test that passed in `run-20-author`) · **covered** (another spec / the BE pytest
asserts it) · **not covered** (reason given) · **unpairable**.
Test names shortened: "anon", "reads", "write", "versions", "rules", "domain", "scale", "roles", "large".

## Shared rules (all five routes)

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Protected: no Bearer → 401 `UNAUTHENTICATED` before the body / path ids are read (truncated JSON still 401) | core/routing.py:1-10,129-136,264 | anon (5 routes + truncated PUT) | pass |
| #35 body ceiling 8 MiB (`body_limit`, idempotency off): exactly 8 388 608 bytes → reaches auth (401); +1 → 413 `PAYLOAD_TOO_LARGE` before auth (nginx `client_max_body_size 8m` + `error_413_body.conf` give the same W7 body) | spatial_write/router.py:29-30,46; core/middleware.py:217-236; deploy/nginx/snippets/app_locations.conf:3,6 | anon | pass |
| #35 accepts a body above the 1 MiB default (route limit 8 MiB): 5 000 walls / 1 257 864 bytes → 200, all walls read back on N16 + N15 | spatial_write/router.py:29-30; core/routing.py:46 | large | pass |
| Project gate `require_project(key)`: malformed `prj_` id → 404 `resource:"project"` without a query; missing / soft-deleted / not a member → 404 project; member without the key → 403 `FORBIDDEN` (no `resource`); 404 beats 403 | projects/access.py:28-33,45-86 | reads (malformed, missing, deleted project on N16/#33/N15/#12), rules (malformed on #35), roles (viewer 403 ×3, non-member 404 ×4, engineer non-member 404) | pass |
| Keys: #35 `layer.edit` (admin / engineer yes, viewer no); N16, #33, N15, #12 any member | packages/domain/permissions/matrix.py:47; spatial_write/router.py:50; spatial_read/router.py:58,65,71; floors/router.py:46 | roles (viewer reads 200 ×4, PUT 403; engineer PUT 200) ; ui main runs as admin | pass |
| `require_project` runs before the W21 / 428 guards and Pydantic (viewer: valid body, no `baseVersion`, `body:{}` → all 403) | spatial_write/router.py:3-6; core/routing.py:9-12,236-252 | roles | pass |
| No rate limit on any of the five routes | grep `rate_limit(` in spatial_read/, spatial_write/, floors/ → none | — | covered (source read; budget in the spec header) |
| Floor lookup: live floor of THIS project by `level_id` (no id format check) — unknown, malformed (`nope`), soft-deleted, other project's floor → 404 `resource:"floor"` | floors/lookup.py:111-118; spatial_read/router.py:38-55; spatial_write/router.py:55-57 | reads (N16 + #33: unknown / malformed / foreign / deleted), rules (#35 unknown, malformed), domain (#35 deleted, foreign) | pass |

## GET …/floors/:f/spatial/layer (N16) — spatial_read/router.py:71-87, documents.py, assemble.py, wire.py:212-220

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Body `{revision, level, layer, axes, dimensions}` + optional `scaleStatus`; FE `FloorLayerDocumentSchema` decodes it | wire.py:212-220; FE schemas/spatialLayer.ts:71-93 | every N16 read-back (zod-parsed) ; ui main SCR-16..22 load | pass |
| Floor never written → `empty_document`: revision 0, empty four lists, `axes []`, `dimensions []`, no `scaleStatus`, no `level.scaleMillimetresPerPixel`; the read creates no row (revision still 0 afterwards) | router.py:75-76; documents.py:294-313 | reads | pass |
| `level` = the floor's FloorOut (`id/name/order/elevationMm/heightMm/areaM2`) + `confidence 1`, `source "human"`, `reviewed` | assemble.py:264-283 | reads (fresh), write (`areaM2` 20) | pass |
| `level.reviewed` = ≥ 1 wall AND every item reviewed AND scale not provisional | assemble.py:252-261 | write (false with one AI wall; true after approve-all; false with 0 walls) | pass |
| `scaleStatus: "unresolved"` only for scale source `pipeline` / `project_default`; `human` and `none` → key absent | assemble.py:235-249 | scale (human → absent), reads (none → absent) | pass (absent branch) / not covered (`unresolved` — gap 2) |
| `axes` always `[]` in v1; `dimensions` from the document | router.py:84-85 | reads, write | pass |

## PUT …/floors/:f/spatial/layer (#35) — spatial_write/router.py:45-67, schemas.py:128-153, writer.py

Order of checks (router.py:1-10; core/routing.py:9-12; writer.py:216-241): auth 401 → body ceiling 413 → JSON parse 400 →
`require_project("layer.edit")` 404 / 403 → W21 path/body guard 422 → 428 guard → Pydantic 422 → floor lookup 404 →
candidate checks (A5 → levelId → integrity) 422 → base check 422 / 409 / C09b → rescale 422 → write → id claim 422.

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Truncated JSON → 400 `MALFORMED_JSON` (no `field`) — sent as raw bytes | core/errors.py:170-174 | rules | pass |
| W21: top-level `floorId` / `projectId` ≠ path → 422 `PATH_BODY_MISMATCH` `field`; equal value → passes W21, then 422 `VALIDATION` `field:"floorId"` (extra key) | core/routing.py:138-151; schemas.py:142-146 | rules | pass |
| Missing `baseVersion` (also an array body, also `body:"junk"`) → 428 `PRECONDITION_REQUIRED` before Pydantic | core/routing.py:154-161,251-252 | rules | pass |
| `baseVersion` strict int ≥ 0 (−1, `"0"`, 1.5 → 422 `baseVersion`); `body` required | schemas.py:142-146 | rules | pass |
| `body` must carry `layer` or `scaleMillimetresPerPixel` (`{}`, `{layer:null}`, `{scale:null}` → 422 `field:"body"`); extra key → `body.<key>`; top-level extra → `<key>` | schemas.py:128-139 | rules, scale (`null_only`) | pass |
| Layer = domain `SpatialLayer` (`extra="forbid"`, four lists required → `body.layer.furniture` when missing) | packages/domain/spatial/model.py:34-41,247-257 | rules | pass |
| W4 ids `<letter>-[0-9A-Z]{10,64}` per kind (short id, wrong prefix → `…walls.0.id`; bad level id → `…levelId`; `openingIds.0`; `roomId`) | packages/core/ids.py:23-31,92-94; model.py:44-54,85-92 | rules | pass |
| mm = strict safe int (12.5, `"110"`, 2^53 → 422); `thicknessMm`/`heightMm`/`widthMm` > 0; `offsetMm`/`sillHeightMm` ≥ 0 | model.py:73-77,159-181 | rules (thickness 0 / float / string / unsafe, height −1, offset −1, width 0) | pass |
| Zero-length centreline → `…centreline`; inverted bounding box → `…boundingBox`; room outline < 3 points → `…outline` | model.py:110-135,203 | rules | pass |
| Enums: wall `kind`, opening `swing`, room `usage`, furniture `kind`, `source` | model.py:99,167,181,190,202 | rules (brick, up, garage, sofa, robot) | pass |
| `confidence` 0..1 strict float (1.5 → 422; the JSON integer `1` the FE sends is accepted); `reviewed` strict bool (`"true"` → 422); `rotationDeg` [0, 360) (360 → 422); `areaM2` ≥ 0 | model.py:78-81,98-100,193,204 | rules ; write (integer `1` accepted on every human item) | pass |
| Human text (room name): NFC, not empty, no control / bidi char (`""`, U+202E, U+0007 → `…rooms.0.name`); NFD name stored NFC | model.py:57-64 | rules, write | pass |
| Pydantic runs before the floor lookup (unknown floor + `body:{}` → 422 `body`; unknown floor + valid body → 404 floor) | router.py:47-57 | rules | pass |
| A5: `source "ai"` + `reviewed true` → 422 `REVIEW_BY_AI_FORBIDDEN` `field` = first offending item in walls → openings → rooms → furniture order; before `levelId`, integrity AND the base check (base 9 + A5 → A5) | writer.py:216-219,290-298; errors.py:163-164; packages/domain/spatial/kinds.py:454-463 | domain (wall, 2nd wall, opening, base ahead, A5 + level mismatch) | pass |
| Item `levelId` of another floor → 422 `LAYER_LEVEL_MISMATCH` `field` (walls / rooms); before integrity | writer.py:299-305; errors.py:166-167 | domain | pass |
| Critical integrity → 422 `LAYER_INTEGRITY_BROKEN` `count`: duplicate id, opening → missing wall, wall `openingIds` → missing opening | writer.py:306-308; packages/domain/spatial/integrity.py:303-339,381-383 | domain (count 1 each) | pass |
| Integrity WARNINGS do not block: room `wallIds` → missing wall, furniture `roomId` → missing room, closed outline (first = last point) → 200, stored as sent | integrity.py:319-358 | domain | pass |
| `baseVersion` > current → 422 `VALIDATION` `field:"baseVersion"` (not 409) | writer.py:355-356 | versions | pass |
| base = current → write at base+1 (200 `{revision, layer}`; FE `FloorLayerWriteResultSchema` decodes it) | writer.py:357-358,502-530; schemas.py:149-153 | write, versions, domain, scale, roles ; ui main SCR-16 approve / thickness, SCR-17 edit, SCR-20 edit, SCR-21 apply, SCR-14 apply | pass |
| Nothing would change (document, scale, source, page equal) → 200 current revision, no UPDATE, no log, no `touch_project` | writer.py:340-341,492-499 | write (same layer: revision 1, project `updatedAt` kept), scale (same scale) | pass |
| C09b own repeat: same writer + same body SHA-256 + same original base → 200 identical body, no write | writer.py:174-193,359-364 | versions | pass |
| Stale base with logged changes since → 409 `VERSION_CONFLICT` `currentVersion` + `remoteChanges` (one row per entity+field, newest value; snake field names `thickness_mm`; `changedBy` usr id, `changedByName` = writer's name at write time, `changedAt` ms `Z`; removal `__deleted__` without `value`); FE `VersionConflictBodySchema` decodes it | writer.py:365-372; changes.py:241-281; core/errors.py:67-87; packages/domain/spatial/diff.py:20-78; router.py:36-42 | versions (admin), roles (names the engineer) | pass |
| Stale base but NO logged change since (e.g. a scale-only write in between) → no conflict, written on top (200) | writer.py:365-373,593-614 | versions | pass |
| Review-only change (reviewed / source / confidence) logs exactly one touch mark at the representative field (`wall` → `thickness_mm` = current value) | writer.py:73-80,575-590,608-610 | versions | pass |
| Two concurrent writes on one base → `UPDATE … WHERE revision = base` lets one win (200), the loser retries and meets the winner's log (409) | writer.py:233-241,330-344,533-557 | versions (parallel pair) | pass |
| Lost race `SPATIAL_WRITE_ATTEMPTS` (3) times in a row → 503 `DEPENDENCY_UNAVAILABLE` + `Retry-After: 1` | writer.py:233-241; settings.py:188 | — | unpairable from outside (needs 3 consecutive lost UPDATEs in one request); BE pytest `spatial_write/tests/test_routes_errors.py:188` |
| `Idempotency-Key` ignored (idempotency off): same key, new base/body → a 2nd write | router.py:8-10,46 | versions | pass |
| Room `areaM2` recomputed from the outline on every write (client value 999 → 20 for 4000 × 5000 mm) | writer.py:420-427; packages/domain/spatial/area.py:57-59 | write, scale (80 after ×2) | pass |
| W2: optional keys absent, never `null` (furniture without `roomId`) | spatial_read/wire.py:1-19,106-115 | write | pass |
| Side effects: `project_floor_summaries` (walls total / reviewed, area) → #12 `areaM2`, N15 `grossFloorAreaM2`; `touch_project` → `ProjectOut.updatedAt` | writer.py:520-529; projects/summaries.py:133-179; packages/domain/spatial/document.py:44-50 | write (20 m² → back to 0 / absent on an empty layer; updatedAt bumped on a real write, kept on an unchanged one) | pass |
| Entity ids unique per PROJECT: an id owned by another floor → 422 `LAYER_INTEGRITY_BROKEN` `count` and no revision bump (savepoint); a soft-deleted floor keeps its ids inside `FLOOR_RESTORE_WINDOW_S` (600 s); a released id (floor dropped it) can be claimed; another project may reuse the id | writer.py:10-13,514-518,560-572; spatial_read/entity_ids.py (claim_entity_ids, _release); floors/settings.py:19 | domain | pass |
| Id of a floor deleted MORE than 600 s ago is reclaimed | spatial_read/entity_ids.py (expired → UPDATE) | — | not covered (gap 3: needs a 10-minute wait) |
| Scale: JSON number only (bool, string → 422), range checked on the raw value `0 < v ≤ 999999` (0, −1, 1 000 000, `NaN`, `1e400` → 422) then HALF_UP 6 places (2.0000005 → 2.000001; 0.0000004 → 0 → 422; 0.0000005 → 0.000001 ok); all → `field:"body.scaleMillimetresPerPixel"` | schemas.py:92-125 | scale | pass |
| Scale source `human` (rank 3), page key = current drawing's page (none here); a new scale rescales UNREVIEWED items by k = new/old (centreline, outline, centre, box, thickness, offset, width; heights / sill / rotation kept; room area recomputed); reviewed items untouched (K21); first scale (no previous) → no rescale | writer.py:376-401,430-441; packages/domain/scale/rescale.py:1-110 | scale (2 → 4: wall end 8000 / t 220, door 1000 / 1800, room ×2 / 80 m², table ×2) | pass |
| Layer + scale together → the sent layer is read in the OLD scale and rescaled | writer.py:437-439; FE schemas/spatialLayer.ts:97-103 | scale (4 → 8: sent end 1000 / t 100 stored as 2000 / 200) | pass |
| Rescale that collapses an item (thickness rounds to 0) → 422 `VALIDATION` `field:"body.scaleMillimetresPerPixel"`, nothing written | writer.py:404-417 | scale | pass |
| Lower-rank scale writer cannot override a higher one; `merge` path (pipeline, K21); per-page rank | writer.py:376-391,264-267,311-327 | — | not covered (only `human` writes are reachable from the API; pipeline merge = phase 03 run) |
| Dimensions: rescaled with the layer, `referenceIds` pruned when an entity disappears, logged | writer.py:443-489,611 | — | not covered (gap 4: dimensions only come from the pipeline; own data has `dimensions []`) |
| `SPATIAL_CONFLICT_CHANGES_MAX` (5 000) truncation of `remoteChanges` (newest kept) | changes.py:241-267; settings.py:189 | — | not covered (gap 5) |

## GET …/floors/:f/spatial (#33) — spatial_read/router.py:58-62

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| 200 = exactly the FloorOut #12 returns for that floor (same `floor_outs` path); FE `FloorSchema` decodes it | router.py:46-62; floors/lookup.py | reads | pass |
| Unknown / malformed / foreign / deleted floor → 404 floor; project gate as above | router.py:38-43 | reads | pass |
| Floor deleted between the two queries → 404 floor | router.py:46-55 | — | not covered (race inside one request) |

## GET /api/projects/:p/spatial (N15) — spatial_read/router.py:65-68, graph.py:153-208

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Project without floors → every list `[]`, `floorRevisions []`; `building` = project name, `datumElevationMm 0`, `confidence 1`, `source "human"`, `grossFloorAreaM2` from the rollup (0), `reviewed false` | graph.py:153-208 | reads | pass |
| Levels in floor order `(order, pk)`; `floorRevisions` a bijection with `levels`, revision per floor (0 when never written); entity lists concatenated in floor order; FE `SpatialGraphDocumentSchema` decodes it | graph.py:129-131,182-208 | reads, write, scale (apply-all reads the revisions) | pass |
| `building.reviewed` = ≥ 1 level and every level reviewed; `grossFloorAreaM2` follows the layer writes | graph.py:160-170 | write | pass |
| Deleted floors are excluded (and their revision row) | graph.py:182 (floor_outs_with_pk, live floors) | reads | pass |
| Read never writes (no `ensure_document`, project `updatedAt` kept) | graph.py:125-127 | reads | pass |
| Hidden floors excluded from the rollup | projects/summaries.py:200-202 | — | not covered (no API hides a floor: `hideFloorFrom3d` is off, plan G7) |

## GET /api/projects/:p/floors (#12) — floors/router.py:46-49, service.py:197-199

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Live floors sorted `(floor_order, pk)`, FloorOut keys `drawings/elevationMm/heightMm/id/name/order` + optional `areaM2`; FE `FloorSchema` decodes each | service.py:197-199; projects/wire.py:65-74 | reads, write, scale ; ui main SCR-14 all-floors (GET floors, no PUT) | pass |
| Empty project → `[]`; deleted floor gone | service.py:197-199 | reads | pass |
| `areaM2` = the floor's summary area after a layer write | projects/summaries.py:133-156 | write | pass |
| `FLOORS_MAX` 50 cap, create / patch / reorder rules | floors/settings.py:18; service.py | phase03_pipeline_api "floor-create" | covered |

## Mock pairing (every `[mocked response]` test of the phase's UI specs)

| UI test | Endpoint + faked response | Pairing |
|---|---|---|
| — | `phase04_qc_layers.spec.ts`: 0 `page.route` / `[mocked response]` (grep); `phase04_qc_layers_ui.spec.ts`: 0 (header: "No faked response: every state is the real stack"); no `phase04_*_edge.spec.ts` | nothing to pair (re-check when an edge spec lands) |

## Contract notes (FE ↔ BE)

- FE `scaleMillimetresPerPixelSchema = z.number().positive().finite()` (src/api/schemas/spatialLayer.ts:59) is wider than
  the BE range `(0, 999999]` after HALF_UP 6 places (spatial_write/schemas.py:92-125): a client value above 999 999 or below
  0.0000005 passes the FE and gets 422 `body.scaleMillimetresPerPixel`. Observation, not filed: SCR-14 derives the scale from
  a drawn reference line, so such values are not reachable in normal use.
- Every 200 / 409 body the tests saw decoded with the FE zod schemas (`FloorLayerDocumentSchema`,
  `FloorLayerWriteResultSchema`, `SpatialGraphDocumentSchema`, `FloorSchema`, `VersionConflictBodySchema`).

## Findings

None: all 9 API tests passed in `run-20-author` (no app failure, no test bug left).

## Gaps

1. 503 `DEPENDENCY_UNAVAILABLE` after 3 lost races (not producible from outside; BE pytest covers it).
2. `scaleStatus: "unresolved"` (scale source `pipeline` / `project_default`, or a `human` scale whose drawing page changed):
   needs a pipeline run on the floor (phase 03 "pipeline") — the UI main spec reads the CP-5 work floor, but no API test
   asserts the key. Rank rules between scale writers are only reachable through the pipeline merge.
3. Restore-window expiry (600 s) reclaiming an id from a deleted floor.
4. Dimensions on #35 (rescale, `referenceIds` pruning, log rows): only the pipeline creates dimensions.
5. `remoteChanges` truncation at `SPATIAL_CONFLICT_CHANGES_MAX` (needs > 5 000 changed fields on one floor).
6. Whitespace-only human text (room name `"   "`): `_human_text` does not strip (model.py:57-64), so the BE accepts it;
   not asserted — UNKNOWN - NEED VERIFICATION whether the FE trims before sending.
