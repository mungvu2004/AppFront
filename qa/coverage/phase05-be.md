<!-- qa-sources be=2ee030c5 -->
# Phase 05 — Backend coverage (3D viewer: measurements #16/#17/#18, spatial graph N15, layer N16/#35)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`), HEAD `2ee030c5` (= `versionCheck.apiBuiltCommit`). Every
`file:line` is under `apps/api/` unless it starts with `packages/` or `deploy/`.
API spec: `qa/tests/phase05_3d_viewer_api.spec.ts` — **8 tests** (`--list`), evidence prefix `A05_` (142 JSON exchanges; the
bulk "limits" case writes two summary JSONs). Author run `run-25-author` (`node tools/run-phase.mjs --phase 05 --run-id
run-25-author --layers api --no-watch --grep "A05 ·"`): **8 passed / 8**, evidence ok,
`F:/App/qa-results/run-25-author/phase05-api/results.json`.
UI specs of the phase: main `phase05_3d_viewer.spec.ts`, ui `phase05_3d_viewer_ui.spec.ts`, edge
`phase05_3d_viewer_edge.spec.ts` (4 `[mocked response]` tests, paired below — BUG-391).
Endpoints called by the phase's screens (FE `src/api/endpoints.ts:157-161` `measurements.*`, `:251-265` `spatial.*`;
SCR-23 load = N15, SCR-23 vertex edit = #35, SCR-24 exploded = N15, SCR-25 pin / delete / undo = #17 / #18 / #17, list = #16):

| # | Method + path | BE handler |
|---|---|---|
| #16 | `GET /api/projects/:p/measurements` | measurements/router.py:24-27 → service.py:76-84 |
| #17 | `POST /api/projects/:p/measurements` | measurements/router.py:30-38 → service.py:108-138 |
| #18 | `DELETE /api/projects/:p/measurements/:m` | measurements/router.py:41-44 → service.py:141-155 |
| N15 | `GET /api/projects/:p/spatial` | spatial_read/router.py:65-68 → graph.py:153-208 |
| N16 | `GET /api/projects/:p/floors/:f/spatial/layer` | spatial_read/router.py:71-87 |
| #35 | `PUT /api/projects/:p/floors/:f/spatial/layer` | spatial_write/router.py:45-67 → writer.py:196-241 |

Status words: **pass** (asserted by a test that passed in `run-25-author`) · **covered** (another spec / the BE pytest
asserts it) · **not covered** (reason given) · **unpairable**.
Test names shortened: "anon", "create", "same-id", "rules", "roles", "race", "idem", "limits".

## Shared rules (#16 / #17 / #18)

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Protected: no Bearer → 401 `UNAUTHENTICATED` before the body / path ids are read (truncated JSON still 401) | core/routing.py:129-136,264 | anon (3 routes + truncated POST) | pass |
| #17 body ceiling = default 1 MiB (no `route_options`): exactly 1 048 576 bytes → reaches auth (401); +1 → 413 `PAYLOAD_TOO_LARGE` before auth (nginx allows 8m, the app middleware cuts) | core/routing.py:46,64; core/middleware.py:217-236; deploy/nginx/snippets/app_locations.conf:3 | anon | pass |
| Project gate `require_project`: malformed `prj_` id → 404 `resource:"project"` without a query; missing / soft-deleted / not a member → 404 project; member without the key → 403 `FORBIDDEN` (no `resource`); 404 beats 403 | projects/access.py:28-33,45-86 | roles (malformed / missing / deleted × 3 routes, viewer non-member × 3, engineer non-member), rules (malformed + missing project with an invalid body) | pass |
| Keys: #16 any member (`require_project()`); #17 / #18 `layer.edit` (admin / engineer yes, viewer no) | router.py:21,24,30-44; packages/domain/permissions/matrix.py:47 | roles (viewer #16 200, #17 / #18 403; engineer #17 201, #18 204) ; ui main SCR-25 runs as admin | pass |
| Order: auth → body ceiling → JSON parse 400 → project gate (endpoint param dependency) → W21 guard → idempotency guard → Pydantic 422 → service | core/routing.py:1-18,138-185,221-226 | roles (viewer: invalid body, W21 mismatch, malformed measurement id → all 403), rules (404 project beats 422), idem (bad key → 422 `idempotencyKey` with a valid body) | pass |
| No rate limit on #16 / #17 / #18 | grep `rate_limit(` in measurements/ → none; nginx: no `limit_req` on /api/ | — | covered (source read; budget in the spec header) |
| Idempotency `auto` on #17 / #18 (protected, not versioned, not GET): key `^[A-Za-z0-9_-]{8,128}$` else 422 `VALIDATION` `field:"idempotencyKey"`; same key + same request → stored response replayed (201 / 204), handler not run; same key + other body or other path → 422 `IDEMPOTENCY_KEY_REUSED`; in-flight → 503 `IDEMPOTENCY_IN_PROGRESS` | core/routing.py:164-185,221-226; core/idempotency.py:79-96,198-239; packages/db/models/idempotency.py:35 | idem (bad key, 201 replay vs keyless 200, other body, other project, DELETE 204 replay vs keyless 404) | pass (503 in-flight: not covered — needs two requests inside one 30 s lease; BE pytest core/tests) |
| FE sends NO `Idempotency-Key` on #17 / #18 (only PUT or `idempotent: true`) | FE src/lib/http/client.ts:399-405 | — | observation (the 200-on-resubmit path is the FE's real retry semantics) |

## GET /api/projects/:p/measurements (#16) — router.py:24-27, service.py:76-84

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| 200 bare array (no envelope); fresh project → `[]` | router.py:24-27 | create | pass |
| Item = `{id, name, mode, points, rawValueMm}` only — no `createdBy`, `updatedAt`, `bodySha256` (K01); absent `z` stays absent (W2); FE `MeasurementRecordSchema` (strict) decodes every item | schemas.py:1-5,50-55,78-85; service.py:63-73; FE src/api/schemas/measurements.ts:51-97 | create, same-id, limits (1 000 items, 0 undecodable) ; ui main SCR-25 list | pass |
| Order `(char_length(id), id COLLATE "C")` = numeric order (`MS-0002 < MS-9999 < MS-10000 < MS-123456789012345`) | service.py:78-82 | create (4 ids), limits (MS-9001..MS-10000) | pass |
| `LIMIT MEASUREMENTS_MAX` (1 000) | service.py:82; settings.py:18 | limits (1 000 returned at the cap) | pass |
| Per project: another project's records never listed | service.py:80 | same-id (project 2 sees only its own MS-0001) | pass |
| Read never touches the project (`updatedAt` kept) | service.py:76-84 (no touch) | create | pass |

## POST /api/projects/:p/measurements (#17) — router.py:30-38, schemas.py:58-75, service.py:108-138

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Truncated JSON → 400 `MALFORMED_JSON` (no `field`) | core/errors.py:170-174 | rules | pass |
| W21: body `projectId` ≠ path → 422 `PATH_BODY_MISMATCH` `field:"projectId"`; equal value → passes W21, then 422 `VALIDATION` `field:"projectId"` (extra key) | core/routing.py:138-151; core/wire.py:46,115-118 | rules | pass |
| Strict keys at every depth (`extra="forbid"`): top-level `createdBy` → `field:"createdBy"`; point key `w` → `points.0.w` | core/wire.py:46,115-118; schemas.py:32-55 | rules | pass |
| Body root not an object (`[]`) → 422 `VALIDATION` without `field` | core/errors.py:136-183 | rules | pass |
| `id` string `^MS-[0-9]{4,15}$` (`MS-123`, 16 digits, `ms-1234`, number 1234, missing → `field:"id"`); 15 digits accepted | schemas.py:25-29,61; packages/core/ids.py:37,97-99 | rules, create (MS-123456789012345) | pass |
| `name` = `nfc(strip)`, 1..120 chars after it, no Cc, no bidi override (`""`, `"   "`, 121 chars, U+0007, U+202E, `null` → `field:"name"`); LRM U+200E allowed; stored trimmed + NFC | text.py:12-27; packages/core/text.py:6-45 | rules, create (NFD + spaces → "Phòng khách", 120 chars, LRM) | pass |
| `mode` ∈ {pointToPoint, perpendicular, height, floorArea} (`area` → `field:"mode"`) | schemas.py:16,63 | rules, create (all four) | pass |
| `points` count: floorArea 3..200, other modes 2..200 (`[]`, 1 point, floorArea 2, 201 → `field:"points"`); 200 accepted | schemas.py:21-22,67-75; settings.py:19 | rules, create (floorArea 3), limits (100 × 200) | pass |
| Point `x` / `y` / `z`: strict finite float — integer accepted; string, bool, `NaN`, `1e400` → `points.0.x`; missing `y` → `points.0.y`; `z: null` → `points.0` (NullFreeModel); absent `z` stays absent, `z: 0` kept | schemas.py:18-19,32-55 | rules, create | pass |
| `rawValueMm` strict finite float ≥ 0 (−1, `"1000"`, `Infinity`, missing → `field:"rawValueMm"`) | schemas.py:65 | rules, create (4000 integer accepted) | pass |
| Pydantic `populate_by_name=True`: snake keys (`raw_value_mm`) are also accepted on the wire | core/wire.py:46 | — | not covered (gap 3) |
| Rejected bodies write nothing and do not touch the project | core/routing.py:16-17 (exception → rollback) | rules (list `[]`, `updatedAt` kept) | pass |
| New id → 201 normalised record (`-0.0` → 0, floats, name NFC); response = what #16 returns | service.py:30-54,108-138 | create (4 modes), same-id ; ui main SCR-25 "Ghim phép đo" | pass |
| Same id + same normalised body (SHA-256 of canonical JSON) → 200 the stored record, nothing written, no `touch_project`; also spaces / NFD name, `-0.0`, `1000.0` | router.py:34-38; service.py:43-60,101-105,122-123 | same-id (exact + raw normalised variant, `updatedAt` kept), race, limits (repeat at both caps → 200) | pass |
| Same id + other body → 409 `MEASUREMENT_ID_TAKEN` `field:"id"`; never an upsert (stored record unchanged) | service.py:101-105; errors.py:5-6 | same-id, race ; FE retries once with a fresh id (measurementToolGateway.ts:651-667) | pass |
| Id unique per project (PK project_id + measurement_id): the same id in another project → 201 | service.py:115-121; packages/db/models/measurements.py:31-32 | same-id | pass |
| C14 concurrency: advisory lock `measurements:<project>` then `SELECT … FOR UPDATE`: two parallel same id + same body → {201, 200}; same id + different body → {201, 409} | service.py:114-121; cases.toml:5-8 | race | pass |
| Caps after the lock, after the existing-id lookup: `count ≥ MEASUREMENTS_MAX` (1 000) or `total points + new > MEASUREMENT_POINTS_TOTAL_MAX` (20 000) → 422 `MEASUREMENT_LIMIT_REACHED` (no `field`); inclusive (1 000th record and exactly 20 000 points accepted); a delete frees room | service.py:87-98,124; settings.py:18-20; errors.py:8-9 | limits | pass |
| Side effect: `touch_project` → `ProjectOut.updatedAt` on a real create | service.py:137; projects/summaries.py:177 | create (bumped), same-id (kept on a 200) | pass |
| Undo of a delete = re-POST of the identical record → 201 (hard delete left nothing) | router.py:34; service.py:141-155 | same-id ; ui main SCR-25 "Xoá {name}" then "Hoàn tác" | pass |

## DELETE /api/projects/:p/measurements/:m (#18) — router.py:41-44, service.py:141-155

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Hard delete → 204 empty body; gone from #16 | router.py:41-44; service.py:146-152 | same-id, roles, idem, limits ; ui main SCR-25 delete (waits 200/204) | pass |
| Malformed id (`MS-12`, `nope`, 16 digits) → 404 `resource:"measurement"` before the lock / query | service.py:143-144 | same-id | pass |
| Id not in THIS project (never existed, already deleted, other project's) → 404 measurement | service.py:146-154 | same-id (again, foreign MS-0003), idem (keyless after delete) | pass |
| No owner rule: any `layer.edit` member deletes any record of the project | service.py:141-155 (no `created_by` filter) | roles (engineer deletes the admin's record → 204) | pass |
| Side effect: `touch_project` on a real delete | service.py:155 | same-id (`updatedAt` bumped) | pass |
| Viewer → 403 before the id check | router.py:21,42 | roles (valid id and `nope` → 403) | pass |

## N15 / N16 / #35 (SCR-23 load + vertex edit, SCR-24 exploded) — unchanged since phase 4

`git diff bf83f815 2ee030c5 -- apps/api/spatial_read apps/api/spatial_write apps/api/floors apps/api/projects apps/api/core
packages` touches only `packages/vision/preprocess/pdf.py` (not on these routes), so every row of
`qa/coverage/phase04-be.md` (sections N16, #35, N15) still holds and is covered by `phase04_qc_layers_api.spec.ts`
(9/9 in `run-20-author`). Phase-5-specific use of them:

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| N15 graph: levels in floor order, entity lists concatenated, `floorRevisions` per floor; FE `SpatialGraphDocumentSchema` decodes it (what SCR-23 / SCR-24 render) | spatial_read/graph.py:153-208 | phase04 api reads, write, scale ; ui main SCR-23 load waits `GET …/spatial` | covered (phase04 api) |
| SCR-23 vertex edit = a #35 write of a moved wall centreline at the current base → 200 `{revision, layer}`; same rules as any #35 write (W21, 428, Pydantic, A5, integrity, versioning 409) | spatial_write/router.py:45-67; writer.py:196-648 | phase04 api write, versions, rules, domain ; ui main SCR-23 "Sửa hình học tường" → `PUT …/spatial/layer` | covered (phase04 api) |
| N16 layer read after a 3D write | spatial_read/router.py:71-87 | phase04 api write (N16 = response) | covered (phase04 api) |
| Phase-4 gaps 1-6 (503 after 3 lost races, `scaleStatus: "unresolved"`, restore-window expiry, dimensions on #35, `remoteChanges` truncation, whitespace-only room name) | see phase04-be.md "Gaps" | — | not covered (unchanged; not phase-5 work) |

## Mock pairing (every `[mocked response]` test of the phase's UI specs)

| UI test (by title: line numbers drift, BUG-496) | Endpoint + faked response | Pairing |
|---|---|---|
| `phase05_3d_viewer_edge.spec.ts` "E05 · SCR-23 [mocked response] GET …/spatial 500 → gate error" | N15 `GET /api/projects/:p/spatial` → 500 | unpairable: 5xx — N15 has no 5xx branch a healthy stack reaches (graph.py:67 `load_documents`; only a corrupt `floor_documents` row → `DocumentCorruptError`, spatial_read/documents.py, written straight into the DB); its 200 / 404 / 401 answers are asserted for real (phase04 api reads, roles, anon) |
| `phase05_3d_viewer_edge.spec.ts` "E05 · SCR-25 [mocked response] GET measurements 500 → …" | #16 `GET /api/projects/:p/measurements` → 500 | unpairable: 5xx — #16 has no error branch past the project gate (service.py:76-84 is one SELECT); its 200 / 404 / 401 answers are asserted for real (create, roles, anon) |
| `phase05_3d_viewer_edge.spec.ts` "E05 · SCR-26 [mocked response] pascal-mount.js network loss → …" | static `/assets/pascal/pascal-mount.js` → aborted (network) | unpairable: network loss of a static asset, not an API route |
| `phase05_3d_viewer_edge.spec.ts` "E05 · SCR-26 [mocked response] flag "scene.pascal-viewer" off → …" | #9 `GET /api/feature-flags` → real body with `scene.pascal-viewer: false` | unpairable: feature flag — stack-wide env `FEATURE_FLAGS` (CP-0 sets it `true` for every role; turning it off breaks every other Pascal test). The off / per-role resolution is BE pytest `telemetry/tests/test_feature_flags_route.py` (telemetry/router.py:32-38, flags.py:53-60) |
| `phase05_3d_viewer.spec.ts`, `phase05_3d_viewer_ui.spec.ts` | — | 0 `page.route` / `[mocked response]` (grep; ui header: "No faked response") |

## Contract notes (FE ↔ BE)

- FE `MeasurementRecordSchema.id = /^MS-\d{4,}$/` (src/api/schemas/measurements.ts:81) has no upper bound; BE accepts
  4..15 digits (packages/core/ids.py:37) and answers 422 `field:"id"` for 16+. FE comment (measurements.ts:17-19) says its
  generator never exceeds `Number.MAX_SAFE_INTEGER`, so this is not reachable in normal use. Observation, not filed.
- FE comment (measurements.ts:75-76) says the point list has "no upper bound"; BE caps it at 200 per record and 20 000
  per project (settings.py:19-20). A long `floorArea` chain of > 200 clicks gets 422 `field:"points"`; the FE gateway
  rethrows non-409 errors (measurementToolGateway.ts:652-656). Observation for the FE review (UNKNOWN - NEED
  VERIFICATION whether the screen caps the chain).
- Every 200 / 201 body the tests saw decoded with the FE zod `MeasurementRecordSchema`.

## Findings

None: all 8 API tests passed in `run-25-author` (no app failure, no test bug left).

## Gaps

1. 503 `IDEMPOTENCY_IN_PROGRESS` (needs a second keyed request inside the first one's 30 s lease while it still runs —
   not producible from outside without slowing the handler; framework-level, BE pytest `core/tests`).
2. `MEASUREMENT_POINTS_MAX` / caps changed by settings (BE pytest `test_measurements_create_record__points_max_setting`
   monkeypatches env; the QA stack runs the defaults, asserted here).
3. Snake-case wire keys (`raw_value_mm`, `populate_by_name=True`, core/wire.py:46) are accepted by every `WireRequest`;
   not asserted (framework-wide behaviour, not a phase-5 rule) — UNKNOWN - NEED VERIFICATION whether this is intended.
4. Measurement rows of a soft-deleted project stay in the DB until the project row is purged (FK cascade only on the
   hard delete, packages/db/models/measurements.py:31); the API only shows 404 project. The purge job is not reachable
   from this layer.
