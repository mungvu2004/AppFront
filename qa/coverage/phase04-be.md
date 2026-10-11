<!-- qa-sources be=2ee030c5 -->
# Phase 04 — Backend coverage (QC layers: spatial layer read/write, floor meta, project graph, floors list)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`), branch `main` = `origin/main` = HEAD `2ee030c5`
(= `versionCheck.apiBuiltCommit`). `git diff --stat bf83f815 2ee030c5` over `apps/api/{spatial_read,spatial_write,floors,auth,
users,project_members,projects,core}`, `packages/{domain,core}` is empty: the BE of this phase did not change since the last
inventory, but that inventory carried **wrong line numbers** for every file that had been read together with another one
(`cat -n` numbering runs on across files: e.g. `changes.py:241-281` is really `changes.py:39-79`, `schemas.py:128-153` is
`61-86`, `graph.py:153-208` is `43-91`, `assemble.py:235-283` is `27-75`, `documents.py:294-313` is `61-80`). Every
`file:line` below was re-read per file at `2ee030c5`. Paths are under `apps/api/` unless they start with `packages/`,
`apps/worker/` or `deploy/`. The comments of the 9 older tests in the API spec still quote some old (shifted) numbers; this
file is the reference.

API spec: `qa/tests/phase04_qc_layers_api.spec.ts` — **12 tests** (`--list`), evidence prefix `A04_` (JSON exchanges; big
bodies write a summary JSON). The 9 older tests passed in `run-20-author`; the 3 new "gaps" tests ran in `run-22-author`
(results below). UI specs of the phase: main `phase04_qc_layers.spec.ts`, ui `phase04_qc_layers_ui.spec.ts`, edge
`phase04_qc_layers_edge.spec.ts` (1 `[mocked response]` test of 29).

Endpoints called by the phase's screens (FE `src/api/endpoints.ts` `spatial.floor|graph|layer`, `floors.list`; SCR-14
"Áp cho mọi tầng" = `useScaleCalibration.ts` onApply → #12 + N15 then one PUT per floor) and by the API spec's setup:

| # | Method + path | BE handler |
|---|---|---|
| N16 | `GET /api/projects/:p/floors/:f/spatial/layer` | spatial_read/router.py:71-87 |
| #35 | `PUT /api/projects/:p/floors/:f/spatial/layer` | spatial_write/router.py:45-67 → writer.py:196-241 |
| #33 | `GET /api/projects/:p/floors/:f/spatial` | spatial_read/router.py:58-62 |
| N15 | `GET /api/projects/:p/spatial` | spatial_read/router.py:65-68 → graph.py:56-91 |
| #12 | `GET /api/projects/:p/floors` | floors/router.py:46-49 → service.py:197-199 |
| login | `POST /api/auth/login` (every signed-in test) | auth/router.py:159-192 |
| #44 | `POST /api/users/invitations` ("roles" setup) | users/router.py:55-62 |
| N3 | `POST /api/projects/:p/members` (members_add, "roles" setup) | project_members/router.py:42-70 |
| setup | #10 `POST …/floors`, #11 `DELETE /api/floors/:f`, #41 `PATCH /api/users/:u/role`, `POST /api/auth/invitations/accept`, `POST /api/auth/refresh`, #46 `DELETE /api/users/:u`, #5/#6/#7/#8 uploads | floors/router.py:30-43; users/router.py:85-92,111-116; auth_recovery/router.py:337-344; auth/router.py:236-237; drawings/router.py:50-106 |

Status words: **pass** (asserted by a test that passed) · **covered** (another spec / the BE pytest asserts it) · **not
covered** (reason given) · **unpairable**. Test names shortened: "anon", "reads", "write", "versions", "rules", "domain",
"scale", "roles", "large", "g-restore", "g-truncate", "g-pipeline" (the three `A04 · gaps:` tests).

## Shared rules (the five phase routes)

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Protected: no / non-Bearer `Authorization` → 401 `UNAUTHENTICATED` before the body or path ids are read (truncated JSON still 401) | core/routing.py:129-135,307 | anon (5 routes + truncated PUT) | pass |
| #35 body ceiling 8 MiB (`BODY_LIMIT`, forces `idempotency="off"`): exactly 8 388 608 bytes → reaches auth (401); +1 → 413 `PAYLOAD_TOO_LARGE` before auth (middleware on `Content-Length`; nginx `client_max_body_size 8m` + `error_page 413` give the same W7 body) | spatial_write/router.py:29-30,46; core/routing.py:46,78-85; core/middleware.py:233-236; deploy/nginx/snippets/app_locations.conf:3,6 | anon | pass |
| #35 accepts a body above the 1 MiB default: 5 000 walls / ~1.26 MB → 200, all walls on N16 + N15 | spatial_write/router.py:29-30; core/routing.py:46 | large | pass |
| Project gate `require_project(key)`: malformed `prj_` id → 404 `resource:"project"` without a query; missing / soft-deleted / not a member → 404 project (one query); member without the key → 403 `FORBIDDEN` (no `resource`); 404 beats 403; the key is checked on the caller's **system** role (`can(principal.role, …)`) | projects/access.py:28-33,45-75,78-86 | reads (malformed / missing / deleted on N16, #33, N15, #12), rules (malformed on #35), roles (viewer 403, non-member 404) | pass |
| Keys: #35 `layer.edit` (admin, engineer yes; viewer no); N16, #33, N15, #12 any member | packages/domain/permissions/matrix.py:47; spatial_write/router.py:50; spatial_read/router.py:58,65,71; floors/router.py:46 | roles (viewer reads 200 ×4, PUT 403; engineer PUT 200) ; ui main runs as admin | pass |
| `require_project` (a parameter of #35) runs before the W21 / 428 guards and Pydantic: viewer with a valid body, no `baseVersion`, `body:{}` → all 403 | spatial_write/router.py:3-6,50; core/routing.py:236-252 | roles | pass |
| No rate limit on any of the five routes | grep `rate_limit(` in spatial_read/, spatial_write/, floors/ → none | — | covered (source read; budget in the spec header) |
| Floor lookup = live floor of THIS project by `level_id`, no id format check: unknown, malformed (`nope`), soft-deleted, other project's floor → 404 `resource:"floor"` | floors/lookup.py:111-118; spatial_read/router.py:38-43; spatial_write/router.py:55-57; writer.py:244-253 | reads (N16 + #33), rules (#35 unknown, malformed), domain (#35 deleted, foreign), g-restore (N16 of a deleted floor) | pass |

## GET …/floors/:f/spatial/layer (N16) — spatial_read/router.py:71-87, documents.py, assemble.py, wire.py:212-220

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Body `{revision, level, layer, axes, dimensions}` + optional `scaleStatus` (absent, never `null`); FE `FloorLayerDocumentSchema` decodes it | wire.py:1-19,212-220; FE schemas/spatialLayer.ts | every N16 read-back (zod-parsed) ; ui main SCR-16..22 load | pass |
| Floor never written → `empty_document`: revision 0, empty four lists, `axes []`, `dimensions []`, scale source `none` → no `scaleStatus`, no `level.scaleMillimetresPerPixel`; the read creates no row | router.py:75-76; documents.py:61-80,124-130 | reads | pass |
| `level` = the floor's FloorOut (`id/name/order/elevationMm/heightMm/areaM2`) + `confidence 1`, `source "human"`, `reviewed` | assemble.py:56-75; wire.py:118-131 | reads, write | pass |
| `level.reviewed` = ≥ 1 wall AND every item reviewed AND scale not provisional | assemble.py:44-53 | write (false / true / false with 0 walls), g-pipeline (false under a pipeline scale) | pass |
| `scaleStatus: "unresolved"` for scale source `pipeline` / `project_default` (a pipeline run writes one of the two); `human` / `none` → key absent | assemble.py:39-41; router.py:77-83; apps/worker/pipeline_build/build.py:75,201-220; apps/worker/pipeline_persist/service.py:108-130 | g-pipeline (unresolved after the run, absent after the human scale), scale (human → absent), reads (none → absent) | pass |
| A `human` scale drops to `pipeline` (→ `unresolved`) when the floor's current drawing page differs from the page stored with the scale | assemble.py:27-36; spatial_read/pages.py:39-48 | — | not covered (gap 2: needs a 2nd upload on the same floor after a human calibration) |
| `axes` always `[]` in v1; `dimensions` from the document (pipeline only) | router.py:85-86 | reads, write, g-pipeline | pass |

## PUT …/floors/:f/spatial/layer (#35) — spatial_write/router.py:45-67, schemas.py:61-86, writer.py

Order of checks (router.py:1-11; core/routing.py:138-163,251-252; writer.py:216-241): auth 401 → body ceiling 413 → JSON parse
400 → `require_project("layer.edit")` 404 / 403 → W21 path/body guard 422 → 428 guard → Pydantic 422 → floor lookup 404 →
candidate checks (A5 → levelId → integrity) 422 → base check 422 / C09b / 409 → rescale 422 → write → id claim 422.

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Truncated JSON → 400 `MALFORMED_JSON` (no `field`), sent as raw bytes | core/errors.py:174,212 | rules | pass |
| W21: top-level `floorId` / `projectId` ≠ path → 422 `PATH_BODY_MISMATCH` `field`; equal value → passes W21, then 422 `VALIDATION` `field:"floorId"` (extra key) | core/routing.py:138-151; schemas.py:75-79 | rules | pass |
| Missing `baseVersion` (also array body, `body:"junk"`) → 428 `PRECONDITION_REQUIRED` before Pydantic | core/routing.py:154-163,251-252 | rules | pass |
| `baseVersion` strict int ≥ 0 (−1, `"0"`, 1.5 → 422 `baseVersion`); `body` required | schemas.py:75-79 | rules | pass |
| `body` must carry `layer` or `scaleMillimetresPerPixel` (`{}`, `{layer:null}`, `{scale:null}` → 422 `field:"body"`); extra key → `body.<key>`; top-level extra → `<key>` | schemas.py:61-72 | rules, scale | pass |
| Layer = domain `SpatialLayer` (`extra="forbid"`, four lists required → `body.layer.furniture`) | packages/domain/spatial/model.py:41,247-253 | rules | pass |
| W4 ids `<letter>-[0-9A-Z]{10,64}` per kind (`…walls.0.id`, `…levelId`, `openingIds.0`, `roomId`) | packages/core/ids.py:92-94; model.py:44-54,85-92 | rules | pass |
| mm = strict safe int (12.5, `"110"`, 2^53 → 422); thickness / height / width > 0; offset / sill ≥ 0 | model.py:73-77,159-181 | rules | pass |
| Zero-length centreline → `…centreline`; inverted bounding box → `…boundingBox`; outline < 3 points → `…outline` | model.py:110-135,203 | rules | pass |
| Enums: wall `kind`, opening `swing`, room `usage`, furniture `kind`, `source` | model.py:99,167,181,190,202 | rules | pass |
| `confidence` 0..1 strict float (1.5 → 422; JSON integer `1` accepted); `reviewed` strict bool; `rotationDeg` [0, 360); `areaM2` ≥ 0 | model.py:78-81,95-100,193,204 | rules ; write | pass |
| Human text (room name): NFC, not empty, no control / bidi char (`""`, U+202E, U+0007 → `…rooms.0.name`); NFD stored NFC; **no strip**: `"   "` accepted and stored as sent | model.py:57-64,82,201 | rules, write, g-restore (whitespace-only) | pass |
| Pydantic runs before the floor lookup (unknown floor + `body:{}` → 422 `body`; unknown floor + valid body → 404 floor) | router.py:47-57 | rules | pass |
| A5: `source "ai"` + `reviewed true` → 422 `REVIEW_BY_AI_FORBIDDEN` `field` = first offending item (walls → openings → rooms → furniture), before `levelId`, integrity and the base check | writer.py:216-219,290-298; spatial_write/errors.py:10; packages/domain/spatial/kinds.py:71-80 | domain | pass |
| Item `levelId` of another floor → 422 `LAYER_LEVEL_MISMATCH` `field`; before integrity | writer.py:299-305; spatial_write/errors.py:13 | domain | pass |
| Critical integrity → 422 `LAYER_INTEGRITY_BROKEN` `count`: duplicate id, wall `openingIds` → missing opening, opening → missing wall | writer.py:306-308; packages/domain/spatial/integrity.py:35,49,55,110-112 | domain | pass |
| Integrity WARNINGS do not block: room `wallIds` → missing wall, furniture `roomId` → missing room, closed outline | integrity.py:54,57,59,87 | domain | pass |
| `baseVersion` > current → 422 `VALIDATION` `field:"baseVersion"` (not 409) | writer.py:355-356 | versions | pass |
| base = current → write at base+1 (200 `{revision, layer}`; FE `FloorLayerWriteResultSchema` decodes it) | writer.py:357-358,502-530; schemas.py:82-86 | write, versions, domain, scale, roles, g-* ; ui main SCR-16/17/20/21/14 | pass |
| Nothing would change (document, scale, source, page equal) → 200 current revision, no UPDATE, no log, no `touch_project` | writer.py:340-341,492-499 | write, scale | pass |
| C09b own repeat: same writer + same body SHA-256 + same original base → 200 identical body, no write | writer.py:174-193,359-364 | versions | pass |
| Stale base with logged changes → 409 `VERSION_CONFLICT` `currentVersion` + `remoteChanges` (one row per entity+field, newest value; snake field names; `changedBy` usr id or `system:pipeline`, `changedByName` = name at write time (pipeline: "hệ thống AI"); `changedAt` ms `Z`; removal `__deleted__` without `value`); FE `VersionConflictBodySchema` decodes it | writer.py:365-372; spatial_write/changes.py:39-79; core/errors.py:67-88; packages/core/errors.py:142-185; packages/domain/spatial/diff.py:17-78; router.py:36-42; apps/worker/pipeline_persist/constants.py:5 | versions (admin), roles (engineer name), g-pipeline (pipeline rows) | pass |
| `remoteChanges` capped at `SPATIAL_CONFLICT_CHANGES_MAX` (5 000): newest kept, ascending `(revision, id)` order | spatial_write/settings.py:19; changes.py:39-65; writer.py:369 | g-truncate (720 walls = 5 040 rows → 5 000) | pass |
| Stale base but NO logged change since (scale-only write in between) → written on top (200) | writer.py:365-373,593-614 | versions | pass |
| Log rows: new wall = `thickness_mm`, `height_mm`, `kind` + `V-<id>-start` / `V-<id>-end` `x`, `y`; review-only change = one touch mark at the representative field | diff.py:20-25,40-78; kinds.py:59-61; writer.py:73-80,575-590,608-610 | versions (touch mark), g-truncate (7 rows per wall, exact order) | pass |
| Two concurrent writes on one base → one 200, the loser retries and meets the winner's log (409) | writer.py:233-241,330-344,533-557 | versions | pass |
| Lost race `SPATIAL_WRITE_ATTEMPTS` (3) times → 503 `DEPENDENCY_UNAVAILABLE` + `Retry-After: 1` | writer.py:233-241; spatial_write/settings.py:18 | — | unpairable from outside (3 consecutive lost UPDATEs inside one request); BE pytest `spatial_write/tests` |
| `Idempotency-Key` ignored (idempotency off) | router.py:8-10,46 | versions | pass |
| Room `areaM2` recomputed from the outline on every write | writer.py:420-427; packages/domain/spatial/area.py:57 | write, scale, g-restore | pass |
| W2: optional keys absent, never `null` (furniture without `roomId`) | spatial_read/wire.py:1-19,106-115 | write | pass |
| Side effects: `project_floor_summaries` (walls total / reviewed, area) → #12 `areaM2`, N15 `grossFloorAreaM2`; `touch_project` → `ProjectOut.updatedAt` | writer.py:520-529; projects/summaries.py:133-156,177-179 | write | pass |
| Entity ids unique per PROJECT: id owned by another floor → 422 `LAYER_INTEGRITY_BROKEN` `count`, nothing written (savepoint); a soft-deleted floor keeps its ids inside `FLOOR_RESTORE_WINDOW_S` (600 s) and a restored floor still owns them; released ids can be claimed; another project may reuse an id | writer.py:10-13,514-518,560-572; spatial_read/entity_ids.py:26-55,68-127; drawings/runs.py:330-338; floors/settings.py:19 | domain, g-restore | pass |
| Id of a floor deleted MORE than 600 s ago is reclaimed | entity_ids.py:105-127 | — | not covered (gap 3: 10-minute wait) |
| Scale: JSON number only (bool, string → 422), raw range `0 < v ≤ 999999` (0, −1, 1e6, `NaN`, `1e400` → 422) then HALF_UP 6 places (0.0000004 → 0 → 422); all `field:"body.scaleMillimetresPerPixel"` | schemas.py:25-55 | scale | pass |
| Scale writer rank (human 3 > pipeline 2 > project_default 1 > none 0); a new scale rescales UNREVIEWED items by k = new/old (`js_round(v × k)`: centreline, outline, centre, box, thickness, offset, width; heights / sill / rotation kept; room area recomputed); reviewed untouched; first scale → no rescale; page = stored page, else current drawing page | writer.py:64-68,376-401,430-441; packages/domain/scale/rescale.py:40-104 | scale (human on own items), g-pipeline (human ×2 over a pipeline scale, every AI item) | pass |
| Layer + scale together → the sent layer is read in the OLD scale and rescaled | writer.py:437-439 | scale | pass |
| Rescale collapsing an item → 422 `VALIDATION` `field:"body.scaleMillimetresPerPixel"`, nothing written | writer.py:404-417 | scale | pass |
| A lower-rank scale cannot override a higher one; pipeline `merge` path, per-page rank | writer.py:376-391,311-327 | — | not covered (gap 2: needs a 2nd pipeline run after a human calibration) |
| Dimensions: rescaled with the layer (`line` only; `valueMm`, `overrideValueMm`, `referenceIds` kept); `referenceIds` pruned when an entity disappears, one `dimension reference_ids` log row per pruned dimension | writer.py:443-489,608-611; rescale.py:77-79,107-110 | g-pipeline (4 pipeline dimensions: line ×2, valueMm kept; 4 referenceIds pruned → 4 log rows) | pass |
| `has_untracked_changes` / A5 on the pipeline merge, `PIPELINE_RESULT_INVALID` mapping | apps/worker/pipeline_persist/service.py:131-138 | — | covered (BE pytest of the worker; phase 03) |

## GET …/floors/:f/spatial (#33) — spatial_read/router.py:58-62

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| 200 = exactly the FloorOut #12 returns for that floor (same `floor_outs` path); FE `FloorSchema` decodes it | router.py:46-62; floors/lookup.py:97-108 | reads | pass |
| Unknown / malformed / foreign / deleted floor → 404 floor | router.py:38-43 | reads | pass |
| Floor deleted between the two queries → 404 floor | router.py:46-55 | — | not covered (race inside one request) |

## GET /api/projects/:p/spatial (N15) — spatial_read/router.py:65-68, graph.py:43-91

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Project without floors → every list `[]`, `floorRevisions []`; `building` = project name, `datumElevationMm 0`, `confidence 1`, `source "human"`, `grossFloorAreaM2` from the rollup (0), `reviewed false` | graph.py:36-53,56-91 | reads | pass |
| Levels in floor order `(order, pk)`; `floorRevisions` a bijection with `levels`; entity lists concatenated in floor order; FE `SpatialGraphDocumentSchema` decodes it | graph.py:63-91; floors/lookup.py:52-86 | reads, write, scale, g-restore | pass |
| `building.reviewed` = ≥ 1 level and every level reviewed; `grossFloorAreaM2` = rollup of the visible summary rows | graph.py:43-53,69,78 | write, g-restore | pass |
| A deleted floor leaves `levels`, `floorRevisions`, the entity lists AND the area rollup (`unregister_floor` sets `hidden`, `project_rollups` skips hidden rows); restoring it inside the window brings all back with its counts | floors/service.py:174-194,134-156; projects/summaries.py:74-98,200-229 | g-restore (30 → 20 → 30 m²) | pass |
| Read never writes (no `ensure_document`, project `updatedAt` kept) | graph.py:8-10,71 | reads | pass |

## GET /api/projects/:p/floors (#12) — floors/router.py:46-49, service.py:197-199

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Live floors sorted `(floor_order, pk)`; FloorOut keys `drawings/elevationMm/heightMm/id/name/order` + optional `areaM2` (summary area rounded to 2 places, `NULL` → absent); FE `FloorSchema` decodes each | service.py:197-199; floors/lookup.py:39-49,52-86; projects/wire.py:65-74 | reads, write, scale, g-restore ; ui main SCR-14 all-floors | pass |
| Empty project → `[]`; deleted floor gone; restored floor back with its `areaM2` | service.py:197-199 | reads, g-restore | pass |
| `FLOORS_MAX` 50, #10 create / restore, #11 delete, #13 reorder, #34 patch rules | floors/settings.py:18; floors/service.py | phase03_pipeline_api ("floor-create", "gaps") | covered |

## Setup endpoints used by the API spec (full rules: phase01-be.md, phase02-be.md, phase03-be.md)

| Endpoint | Rule the phase-4 spec relies on | BE source | Budget / status |
|---|---|---|---|
| `POST /api/auth/login` | 204 + refresh cookie for a valid active account; `require_origin`; rate limit `auth_login_ip` 30 / 60 s per IP (QA override `LOGIN_IP_LIMIT=120`), store `safe`, fail-closed; failures counted per email (5 / 900 s → lock 60 s) — the spec never sends a wrong password | auth/router.py:121-129,159-192; auth/settings.py:36-42; qa-limits.override.yml | 12 per run in this file (+ ≤ 6 for the UI layers), 0 failed — covered (phase01) |
| `POST /api/auth/refresh` | 200 `accessToken` + rotated cookie; `auth_refresh_total` 300 / 60 s per sid | auth/router.py:131-139,236-237; auth/settings.py:45-46 | 12 (one per sign-in) + 1 invitee — covered (phase01) |
| `POST /api/users/invitations` (#44) | `user.manage` (admin); body `{emails ≥ 1, role}`; 201 list of pending users; mail after commit; `users_invite` 30 / 3600 s per admin (shared with #45), fail-closed | users/router.py:32-46,55-62; users/schemas.py:84-94 | 1 per run — covered (phase01/08 specs) |
| `POST /api/auth/invitations/accept` | 204 + refresh cookie with the mailed token; `recovery_ip` 10 / 900 s per IP (override 60) | auth_recovery/router.py:121-127,337-344; auth_recovery/settings.py:24-25 | 1 per run — covered (phase01) |
| `POST /api/projects/:p/members` (N3, members_add) | `project.settings.edit` gate BEFORE the limit (viewer / outsider never burn it); 201 new member, 200 already a member; `members_add` 60 / 3600 s per actor, fail-closed | project_members/router.py:26-46,48-70; project_members/settings.py:14-15; schemas.py:9-15 | 1 per run — covered (phase02) |
| `PATCH /api/users/:u/role` (#41), `DELETE /api/users/:u` (#46) | `user.manage`; W21 `userId`; #46 needs `confirmEmail` | users/router.py:85-92,111-116 | 1 + 1 per run — covered (phase08 / phase01) |
| `POST …/floors/:f/drawings/uploads` (#5), chunks (#6), complete (#7), progress (#8) | `floor.upload` gate; `drawings_init` 60 / 600 s per user (cache, fail-open); #6 body limit 8 MiB; #7 starts one run; #8 any member | drawings/router.py:33-47,50-106; drawings/settings.py:23-24 | 1 upload / 1 run per run here (+1 in the edge spec) — covered (phase03) |

## Mock pairing (every `[mocked response]` test of the phase's UI specs)

| UI test | Endpoint + faked response | Pairing |
|---|---|---|
| `phase04_qc_layers_edge.spec.ts` "E04 · SCR-16 [mocked response] GET …/spatial/layer 500 → error alert in the wall panel, screen not blank" | N16 `GET …/floors/:f/spatial/layer` → 500 | unpairable: no API path produces a 500 on N16 for a healthy stack — the only BE branch is a corrupt `floor_documents` row (`schema_version` mismatch / undecodable jsonb → `DocumentCorruptError`, spatial_read/documents.py:83-111), reachable only by writing the DB directly; the 404 / 403 / 401 / 200 answers of N16 are asserted for real (reads, roles, anon) |
| `phase04_qc_layers.spec.ts` | — | 0 `page.route` / `[mocked response]` |
| `phase04_qc_layers_ui.spec.ts` | — | 0 (header: "No faked response") |

Mocked share of the phase's UI tests: 1 / (main + ui + edge) — far under `rules.maxMockedShare` 0.35.

## Contract notes (FE ↔ BE)

- FE `scaleMillimetresPerPixelSchema` (`z.number().positive().finite()`, src/api/schemas/spatialLayer.ts) is wider than the
  BE range `(0, 999999]` after HALF_UP 6 places (spatial_write/schemas.py:34-55): a value above 999 999 or below 0.0000005
  passes the FE and gets 422. Not reachable from SCR-14 (scale derived from a drawn line). Observation, not filed.
- Room names: the BE accepts a whitespace-only name (model.py:57-64, no strip); the FE blocks committing one in the name
  field (`RoomLabelNameField.tsx:73`, `draft.trim() === ''`) and shows such a room as "unnamed" (`roomLabelReviewGateway.ts`
  `statusOfRoom`). A non-FE writer can still store `"   "`; the FE renders it as unnamed. Observation, not filed.
- Every 200 / 409 body the tests saw decodes with the FE zod schemas (`FloorLayerDocumentSchema`,
  `FloorLayerWriteResultSchema`, `SpatialGraphDocumentSchema`, `FloorSchema`, `VersionConflictBodySchema`), including a
  409 whose rows carry `changedBy: "system:pipeline"` (FE `actorIdSchema`, src/api/schemas/errors.ts:58).

## Findings

None. Author run `run-22-author` (`node tools/run-phase.mjs --phase 04 --run-id run-22-author --layers api --no-watch
--grep "gaps:"`): **3 passed / 3**, evidence ok, `F:/App/qa-results/run-22-author/phase04-api/results.json`. The pipeline run
(drawing.png, fake ML) completed with 5 walls, 5 openings, 2 rooms, 6 furniture, 4 dimensions (each with 1 referenceId),
pipeline scale 10.035092 → N16 `scaleStatus: "unresolved"`; the human ×2 scale (20.070184) removed it and doubled every
AI item and dimension line; the empty layer pruned all 4 referenceIds and logged them. The 409 of g-truncate carried exactly
5 000 rows starting at the end vertex of wall 6. No app failure, no test bug left. (A first launch with `--grep "A04 · gaps"`
was split by the runner's shell and started the whole file; it was stopped after the "anon" test — that test's `A04_anon_*`
evidence in run-22-author comes from it.) The 9 older tests were not re-run here (the run step runs every layer once).

## Gaps (still open)

1. 503 `DEPENDENCY_UNAVAILABLE` after 3 lost races — unpairable from outside; BE pytest covers it.
2. A `human` scale demoted to `pipeline` / `unresolved` by a new drawing page, and the rank rule "lower-rank scale cannot
   override a higher one": both need a second upload + pipeline run on a floor that already has a human scale (1 more
   `drawings_init`, ≥ 1 more pipeline run per test run). Candidate for the next DEBT batch.
3. Restore-window expiry (600 s) reclaiming an id from a deleted floor (10-minute wait).
4. #33 / N16 floor deleted between the two queries inside one request (race, not producible on demand).
