<!-- qa-sources be=2ee030c5 -->
# Phase 03 — Backend coverage (project settings, floors, drawing upload, pipeline stream)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`), branch `main` at **2ee030c5** (= `versionCheck.apiBuiltCommit`).
**QA-03d re-inventory (2026-10-12, run-32-p03api):** `git diff bf83f815 2ee030c5 -- apps packages deploy` touches only
`packages/vision/preprocess/pdf.py` (+ its test): zero-page PDFs are now classified `PDF_UNREADABLE` deterministically —
the "gaps-pdf" `/Count 0` row below keeps its outcome. QA-03d re-read every phase-3 module end to end
(projects/access, project_settings, project_members, floors (router/resolvers/schemas/service), drawings (router, latest,
uploads, complete, schemas, view_parts, drawings), streams (router, sse), packages/messaging/streams, quality (router,
schemas, service, geometry, assessments), core (routing, errors, pagination, idempotency, wire), packages/core/text) and
added the endpoints the phase's screens call that were not inventoried: **#11** DELETE floor (SCR-08 "Xoá mọi tầng"),
**#12** GET floors (SCR-09 / SCR-15 CAD floor list), **N7** latest uploads (SCR-12 / SCR-13), **#31** corners (SCR-11),
**N3 / N4** members (SCR-08 "Thành viên"). SCR-13 (graph) calls only #8, N7, S1 and #24; SCR-15 (CAD) only #12 — no
graph / branch / CAD endpoint exists in the BE (FE `pipelineGraphGateway.ts` lists them as missing capabilities). SCR-12
also reads N16 (`spatial.readLayer`, extraction summary), owned by `phase04_qc_layers_api.spec.ts`. No phase-3 screen
calls the versions API.
**Counts:** before QA-03d **16** API tests; after **48** (`--list`), 32 new in the describe "A03 phase-3 backend depth
(QA-03d)", one rule per test ("depth …" below). Run `run-32-p03api` (headless, `QA_SKIP_INVITES=1`):
46 passed, 2 failed, 1 skipped — both failures were test bugs (fixed: the S1 revoked-session code is `SESSION_REVOKED`;
the racy `QUALITY_DRAWING_CHANGED` test was removed, see gap 2); re-run `run-32-p03api/phase03-rerun-api` 7/7 passed and
`phase03-rerun2-api` (the two strengthened quality tests). "roles" is skipped in run-32 because the caller reported the
`users_invite` bucket at its hourly cap (no invitation was sent); its QA-03d rows are written but not yet executed.
Re-checked in run-18: `git log -1 -- apps/api/{projects,project_settings,floors,drawings,streams,quality,files,core} packages`
-> bf83f815 itself, whose diff touches only `apps/api/notifications` + docs, so the inventory below (first written on this
same commit in run-17) is unchanged except where a row says run-18. Every `file:line` is under `apps/api/`
unless it starts with `packages/` or `deploy/`.
API spec: `qa/tests/phase03_pipeline_api.spec.ts` — **16 tests** (`--list`; 13 + 3 "gaps" added in run-18), evidence prefix `A03_` (JSON exchanges;
SSE cases write `A03_<slug>.json` with the frames, no cookie value). Author run: `run-17-author`
(`F:/App/qa-results/run-17-author/phase03-api/results.json`): **11 passed, 2 failed** (both on one app finding, F1);
`run-17-author-r2` (all 13 again — the `--grep` with spaces did not filter) gave the same 11 / 2 and ran the
pipeline test with the signed-URL fetch: completed, `sourceUrl` on `localhost:9000` (MinIO) served 200 `image/*`.
`run-18-author` (`--grep "gaps:"`, only the 3 new tests, headless): **3 passed**
(`F:/App/qa-results/run-18-author/phase03-api/results.json`; evidence `run-18-author/evidence/A03_pdf_*`, `A03_race_*`, `A03_gone_floor_*`).
UI specs of the phase (layer main / ui / edge): `phase03_pipeline.spec.ts`, `phase03_pipeline_ui.spec.ts`,
`phase03_pipeline_edge.spec.ts`.
Endpoints called by the phase's screens (FE `src/api/endpoints.ts`, `src/lib/upload/uploadTask.ts:424-490`,
`projectSettingsGateway.ts`, `floorManagerGateway.ts`): the nine of the task + read-backs `GET /api/projects/:id/settings`
(N5), `GET /api/projects/:id/floors` (#12), `GET …/drawings/uploads/:uid/progress` (#8), `GET …/quality` (#30, SCR-11),
`GET /api/files/{token}` (signed page URL). Path note: chunks/complete/progress are
`/api/projects/:id/drawings/uploads/:uid/{chunks,complete,progress}` — **not** under `/floors/:fid` (drawings/router.py:70,80,102;
FE endpoints.ts `complete`, `progress`).

Status words: **pass** (asserted by a test that passed in `run-17-author`) · **fail** (asserted, failed — see Findings) ·
**covered** (another spec asserts it) · **partial** · **not covered** (reason given) · **unpairable**.

Test names below are shortened: "anon", "set-ver", "set-rules", "floor-create", "floor-patch", "reorder", "init-rules",
"dedupe", "chunks", "reject", "pipeline", "sse-gates", "roles", and (run-18) "gaps-pdf", "gaps-race", "gaps-gone-floor".

## Shared rules (every phase-3 route)

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Protected route: no `Authorization: Bearer` → 401 `UNAUTHENTICATED` before the body or the path ids are read (malformed JSON still 401) | core/routing.py:1-10,125-131 | anon: 9 routes + truncated JSON on N6 | pass |
| Body ceiling 1 MiB (N6, #10, #13, #34, #5, #7): 1 048 576 bytes → reaches auth (401); +1 → 413 `PAYLOAD_TOO_LARGE` | core/routing.py:46; core/middleware.py:218-241 | anon (N6) | pass |
| #6 chunks ceiling 8 MiB (`body_limit`, idempotency off): exactly 8 MiB → 401; +1 → 413 (nginx `client_max_body_size 8m` gives the same W7 body) | drawings/router.py:33-34,70-71; deploy/nginx/snippets/app_locations.conf:3,6; error_413_body.conf | anon | pass |
| Project gate `require_project(key)`: malformed `prj_` id → 404 `resource:"project"` without a query; not a member / deleted → 404; member without the key → 403 `FORBIDDEN` (no `resource`); 404 beats 403 | projects/access.py:28-33,45-86 | set-rules (malformed id), floor-create (missing project), roles (viewer 403 ×7, engineer non-member 404 ×8) | pass |
| Keys: `project.settings.edit` (N6), `layer.edit` (#10, #13, #34), `floor.upload` (#5, #6, #7, #32), member only (N5, #8, #30, S1) — admin/engineer yes, viewer no | packages/domain/permissions/matrix.py:46-51; project_settings/router.py:34; floors/router.py:26-30,67; drawings/router.py:36-37; quality/router.py:25-26 | roles (viewer 403 on the 7 writes, 200 on N5/#8/S1; engineer member 201/200) | pass |
| W21 path/body guard: camelCase path key in the body with another value → 422 `PATH_BODY_MISMATCH` `field` (runs after the permission deps, before Pydantic) | core/routing.py:9-12,138-151,237-247 | floor-create (`projectId`), floor-patch (`floorId`), init-rules (`projectId`), chunks (`uploadId`) | pass |
| Pydantic → 422 `VALIDATION` `field` = camelCase loc (`body.notes`); strict bodies (`extra="forbid"`) | core/errors.py:136-182; core/wire.py | set-rules, floor-create, floor-patch, init-rules, chunks, sse-gates (#32 `foo`) | pass |
| Invalid JSON → 400 `MALFORMED_JSON`; the source says FastAPI parses before every dependency, so also before the N6 428 guard and the #13 resolver | core/errors.py:47,172-174; core/routing.py:100-112 ("JSON hỏng đã thành 400 … ở chỗ khác"); floors/schemas.py:107-117; BE test core/tests/test_routing.py:190-197 | set-rules (N6), reorder (#13) | pass in run-32 (F1 no longer reproduces on 2ee030c5: "set-rules" and "reorder" both passed, so N6 and #13 answer 400) |
| Idempotency: N6 is versioned → no idempotency claim (`Idempotency-Key` ignored); #6 `idempotency="off"`; #5/#7/#10/#13/#34 "auto" (claim only with the header, FE sends none) | core/routing.py:166-187,227-232; project_settings/router.py:3-5; drawings/router.py:9-11,54,71,85 | set-ver (same key, new base → 2nd write) | pass (N6); QA-03d: #5 replay after a chunk → the stored 200 + `IDEMPOTENCY_KEY_REUSED` (depth "init #5 Idempotency-Key"), #7 replay → the stored pending body vs the current final without a key (depth "complete #7 Idempotency-Key"), #6 "off" ignores even a malformed key (depth "chunk #6 size edges") — pass. #10 / #13 / #34 / #31 / #32 replay: generic, phase02_dashboard_api "idem", "idem-edges" |
| QA-03d · malformed `prj_` id → 404 project on N5, #10, #12, #34, #5, #6, #7, #8, N7, #30, #31, #32, N3, N4 (before the body); malformed level id → 404 floor on #11 (resolver pattern), #34, #30, #31 (after the geometry), #32 | projects/access.py:28-33; floors/resolvers.py:54-60; floors/service.py:159-166; quality/router.py:219-220, service.py:125-133 | depth "gates: a malformed project id" | pass |
| QA-03d · soft-deleted project: N5, N6, #10, #12, #34, #5, #6, #7, #8, N7, #30, #31, #32, N3, N4 → 404 project; #11 / #13 → 404 floor (resolvers join `Project.deleted_at IS NULL`); S1 → 404 upload, even for its own live upload | projects/access.py:62-83; floors/resolvers.py:24-37; drawings/stream_providers.py:43-62 | depth "gates: a soft-deleted project" | pass |
| QA-03d · 422 `VALIDATION` carries `count` = number of Pydantic errors and `field` = the first in declaration order | core/errors.py:166-180 | depth "gates: 422 VALIDATION reports count" | pass |
| No rate limit on settings / floors / #6 / #7 / #8 routes; only #5 has one (below) | grep `rate_limit(` in project_settings/, floors/, drawings/router.py:39-46 | — | covered (source read; budget below) |

## PUT /api/projects/:id/settings (N6) + GET (N5) — project_settings/router.py:22-39, service.py:88-119, schemas.py:56-133

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| N5 fresh project → 200 defaults `revision 0`, residential / mm / 50 / 0.75 / 1, `notes` absent | read.py:29-37,65-68; schemas.py:124-146 | set-ver; ui main SCR-08 load | pass |
| Missing `baseVersion` (any body, also an array) → 428 `PRECONDITION_REQUIRED` before Pydantic | core/routing.py:154-161,251-252 | set-ver (`{body:{junk}}`, `[1]`) | pass |
| `baseVersion` strict int ≥ 0 (`"0"`, −1 → 422 field `baseVersion`); `body` required (→ field `body`) | schemas.py:114-121 | set-rules | pass |
| `buildingType` ∈ residential/commercial/industrial/mixed/other; `lengthUnit` ∈ mm/m; both required | schemas.py:56-57,106-108 | set-rules (castle, cm, missing lengthUnit) ; ui main "Đơn vị chiều dài" m ↔ mm | pass |
| `snapToleranceMm` strict int 1..120 (0, 121, 1.5, "50" → 422) | schemas.py:109 | set-rules (+ 1 / 120 accepted) | pass |
| `confidenceThreshold` JSON number 0..1, bool/string refused, range checked on the raw value, then HALF_UP 3 places (0.1235 → 0.124; −0.0004 → 422) | schemas.py:73-99,110 | set-rules (1.0001, −0.0004, true, "0.5"; 0 / 1 accepted), set-ver (0.1235) | pass |
| `defaultScaleMmPerPx` 0.01..1000, HALF_UP 6 places (1.0000005 → 1.000001) | schemas.py:100,111 | set-rules (0.0099, 1000.5; 0.01 / 1000 accepted), set-ver | pass |
| `notes` optional: trim + NFC, `\n` `\t` allowed, other Cc / bidi → 422, 1..500 after trim (blank → 422); absent = cleared (PUT replaces) | schemas.py:59-70,98,104 | set-ver (NFD + padding → NFC trimmed; absent → no `notes`), set-rules (501, blank, U+202E, U+0007; 500 accepted) | pass |
| Extra key in `body` → field `body.<key>`; top-level extra → field `<key>` | core/wire.py; schemas.py:114-117 | set-rules | pass |
| base 0 → INSERT … ON CONFLICT DO NOTHING; base n → UPDATE WHERE revision = n; win → 200 revision+1 | service.py:57-76,101-115 | set-ver (0 → 1, 1 → 2, 2 → 3), roles (engineer 1 → 2) | pass |
| Own repeat (same writer + same normalised-body SHA-256 at revision = base+1) → 200 current, no write; NFD/NFC spellings hash the same | service.py:47-54,79-85,116-118 | set-ver (exact repeat, NFC spelling; activity count proves no 2nd write) | pass |
| Stale or ahead base → 409 `VERSION_CONFLICT` `currentVersion` + `remoteChanges: []` | service.py:119; core/errors.py:82-87; packages/core/errors.py:171-185 | set-ver (stale 0 → current 1, ahead 9 → 3, old repeat → 3) ; ui edge — none | pass |
| Same body + base by ANOTHER writer is not a repeat → 409 | service.py:79-85 (`last_writer_id`) | roles (admin writes, engineer sends the same → 409 currentVersion 1) | pass |
| Concurrent writers on one base: base 0 = `INSERT … ON CONFLICT DO NOTHING`, base n = `UPDATE … WHERE revision = n` → exactly one 200 (revision+1), the other 409 `VERSION_CONFLICT` `currentVersion` = the winner's, `remoteChanges []`; N5 = the winner's body; one activity row per win | service.py:57-76,101-119 | gaps-race (base 0 and base 1, two parallel PUTs each) | pass (run-18) |
| Side effects on a real write: activity `project.settings_update` (objectCode = project id), `touch_project` (updatedAt) — none on repeat / 409 / 422 | service.py:104-115; access/kinds.py:30,61 | set-ver (3 rows for 3 writes; updatedAt grows); set-rules (still revision 0 after 22 × 422) | pass |
| QA-03d · notes text: LRM / RLM (bidi_marks=True for notes) / FSI / CR / NEL → 422 `body.notes`; U+200B kept; the 500 limit counts NFC (500 NFD "é" accepted, 501 refused) | schemas.py:20-31,57; packages/core/text.py:5-8,24-35 | depth "settings notes text" | pass |
| QA-03d · decimals: NaN / Infinity / 1e400 → 422; HALF_UP edges (0.0005 → 0.001, 0.9995 → 1, 0.0100004 → 0.01, 999.9999995 → 1000); −0.0 stored 0 and digests like 0 (own repeat) | schemas.py:34-56; service.py:47-54 | depth "settings decimals" | pass |
| QA-03d · `baseVersion` 0.0 / true / null → 422 `baseVersion` (key present → no 428); body null / [] → 422 `body`; base 1 on a never-written project → 409 currentVersion 0 | schemas.py:114-121; core/routing.py:154-161; service.py:57-76,119 | depth "settings baseVersion and body types" | pass |
| Permission: viewer 403, non-member 404, engineer 200 | router.py:34 | roles | pass (run-17); skipped in run-32 (invitation cap) |

## PATCH /api/projects/:id (#26) — projects/router.py:66-76, service.py:263-309

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Phase 3 sends only name / code / address (SCR-08 "Địa chỉ"); every field rule, each-field-alone write, null / blank → 422, W21, roles, no-op, activity | projects/schemas.py:69-98,123-145; service.py:263-309 | `phase02_dashboard_api.spec.ts` "rename", "patch-rules", "fields" (address alone), "roles"; ui main SCR-08 "Địa chỉ" | covered (phase 2 owns #26; no new phase-3 branch) |

## POST /api/projects/:id/floors (#10) — floors/router.py:30-35, service.py:76-156, schemas.py:16-86

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| 201 `FloorOut` {id, name, order, elevationMm, heightMm, drawings[]} (areaM2 absent); `drawings` / `areaM2` in the body accepted and ignored (W18) | schemas.py:77-86; projects/wire.py:63-72 | floor-create; ui main "Thêm tầng" ×2 | pass |
| `id` = `L-[0-9A-Z]{10,64}` (W-…, too short, lower case → 422 field `id`); 64-char body accepted | schemas.py:50-56; packages/core/ids.py:92-94 | floor-create | pass |
| `name` trim + NFC, Cc / bidi → 422, 1..120 | schemas.py:16,26-33; packages/core/text.py:34-46 | floor-create (blank, 121, RLO; 120 accepted; NFD → NFC) | pass |
| `order` 0..999, `elevationMm` −30000..300000, `heightMm` 2000..10000; JSON number only (string / bool → 422); ≤ 0.01 off an integer is rounded (2999.995 → 3000), more → 422 (3000.5); required | schemas.py:17-23,36-47,68-74 | floor-create (−1, 1000, −30001, 300001, 1999, 10001, 3000.5, "3000", true, missing; bounds accepted) | pass |
| Same id live in the project → 409 `FLOOR_ID_TAKEN` field `id` (also on a unique-violation race) | service.py:76-96; errors.py:7-8 | floor-create (sequential); gaps-race (two parallel POSTs of one id → one 201, one 409 field id, one live floor, one `floor.create`) | pass (run-18; `lock_project_floors` serialises, service.py:139-141 — which guard answered is not observable, both give the same body) |
| 50 live floors (`FLOORS_MAX`) → 422 `FLOOR_LIMIT_REACHED` (no field) | service.py:86-89,142-143; settings.py:156 | floor-create (project created with 50 hook floors) | pass |
| Soft-deleted id inside `FLOOR_RESTORE_WINDOW_S` 600 s → restored in place with the new body, 201 (not 409) | service.py:53-73,118-131; drawings/runs.py:330-338; settings.py:157 | floor-create (DELETE #11 then POST same id) | pass (window expiry 600 s not covered: too slow for a run) |
| Side effects: summaries `register_floor`, `touch_project`, activity `floor.create` (objectCode = level id) | service.py:144-155 | floor-create (create / delete / create rows) | pass |
| QA-03d · name text: tab / newline / NUL / LRI → 422 `name`; LRM allowed (no bidi_marks); 120 NFD "é" → 201 stored NFC; #34 NFD rename → NFC | schemas.py:26-33; packages/core/text.py | depth "floor name text" | pass |
| QA-03d · the cap counts LIVE floors: at 50 a live id → 409 `FLOOR_ID_TAKEN` (id check before the cap); after a delete a new id → 201; at 50 again a restore → 422 `FLOOR_LIMIT_REACHED` | service.py:76-89,129-148 | depth "floor cap #10 counts LIVE floors only" | pass |
| Unknown project → 404 project; viewer 403; non-member 404 | floors/router.py:30 | floor-create, roles | pass |

## PATCH /api/projects/:id/floors/:fid/spatial (#34) — floors/router.py:67-78, service.py:263-322, schemas.py:89-104

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Every key optional; each of name / heightMm / elevationMm / order alone → 200 `FloorOut` with only that change | service.py:269-289,292-322 | floor-patch; ui main rename / height / elevation | pass |
| `{}`, same values, W18 echo (`drawings`, `areaM2`) → 200 without write, activity or `touch_project` | service.py:302-308 | floor-patch (updatedAt unchanged, activity count) | pass |
| Explicit `null` on id / name / order / elevationMm / heightMm → 422 field | schemas.py:59-63,100-104 | floor-patch (name, heightMm, id) | pass |
| Same field rules as #10 (blank / 121 name, 1999, 2500.5, 1000, −30001, bad id) ; extra key → 422 | schemas.py:66-74 | floor-patch | pass |
| Body `id` ≠ path → 422 `PATH_BODY_MISMATCH` field `id` (service); body `floorId` ≠ path → W21 field `floorId`; `floorId` = path → 422 VALIDATION field `floorId` (extra) | service.py:263-266; core/routing.py:138-151 | floor-patch | pass |
| Unknown floor of the project → 404 `resource:"floor"` | service.py:159-166,305-306 | floor-patch | pass |
| Side effects: `set_floor_orders` when order changes, `touch_project`, activity `floor.edit` labelled with the new name | service.py:308-321 | floor-patch (4 edits → 4 rows) | pass |
| QA-03d · numbers: NaN / ±Infinity / 1e400 → 422 field; order 2.004 → 2, order 1.02 → 422 | schemas.py:36-47 | depth "floor numbers on #34" | pass |
| QA-03d · the floor is looked up inside the PATH project: a floor of another of my projects → 404 floor; a soft-deleted floor → 404 floor | service.py:159-166,263-322 | depth "floor PATCH #34 lookup" | pass |
| Permission: viewer 403, non-member 404, engineer 200 | router.py:67 | roles | pass |

## DELETE /api/floors/:fid (#11, QA-03d) — floors/router.py:144-149, resolvers.py:40-60, service.py:173-194

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| 200 = FloorOut snapshot before the delete; #12 drops it; `touch_project`; activity `floor.delete` labelled with the name | service.py:173-194 | depth "floor delete #11" | pass |
| Again → 404 floor; unknown well-formed / malformed id → 404 floor | resolvers.py:54-60 | depth "floor delete #11", "gates: a malformed project id" | pass |
| Same level id live in two of my projects → 409 `FLOOR_ID_AMBIGUOUS`, nothing deleted; after one project is deleted → 200 | resolvers.py:40-51 | depth "floor delete #11 ambiguity" | pass |
| Re-create inside the 600 s restore window | floors/service.py:53-73 | floor-create, gaps-gone-floor | pass |
| Permission (layer.edit after the resolver): viewer 403, engineer member 200, non-member 404 floor | router.py:132,144 | roles (QA-03d rows) | written, skipped in run-32 (invitation cap) |

## GET /api/projects/:id/floors (#12, QA-03d) — floors/router.py:152-155, service.py:197-199

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Live floors sorted (order, pk): duplicate orders allowed, creation order kept; `drawings: []` before an upload; deleted left out | service.py:197-199; floors/view_parts.py | depth "floor list #12" | pass |
| After a completed run: `drawings[0]` = {id, name (NFC-trimmed upload fileName), url, widthMm, heightMm, uploadedAt, uploaderId = the uploader} | drawings/view_parts.py:26-58; drawings.py:120-170 | depth "after a completed run" | pass |
| Member only (viewer 200, non-member 404 project) | router.py:152 | roles (QA-03d rows) | written, skipped in run-32 |
| Shape / empty project | — | phase04_qc_layers_api "reads"; every floor test here | covered |

## PATCH /api/floors/reorder (#13) — floors/router.py:52-64, resolvers.py:80-138, service.py:202-260

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Raw-body shape (resolver, before Pydantic): object with only `floorIds`, array of 1..50 strings, no duplicates — else 422 `VALIDATION` field `floorIds` | resolvers.py:80-107 | reorder ([], dup, extra key, string, number item, `{}`) | pass |
| No id is a live floor of a live project I am a member of → 404 `resource:"floor"` (also for a non-member) | resolvers.py:41-54,119-125 | reorder (unknown id), roles (engineer non-member → 404 floor) | pass |
| The full id set matches > 1 project → 409 `FLOOR_ID_AMBIGUOUS` | resolvers.py:110-131; errors.py:10-11 | reorder (same level id in two of my projects) | pass |
| No single project holds all ids → 422 `FLOOR_REORDER_MISMATCH` `floorIds`; a project holds them but has more live floors → same 422 (service) | resolvers.py:129-131; service.py:219-222 | reorder (ids from two projects; subset) | pass |
| Permutation → 200 `FloorOut[]` in the new order, `order` = index; only changed rows written | service.py:213-260 | reorder; ui main Alt+ArrowUp / Mod+Z | pass |
| Same order → 200, no write / activity / touch | service.py:246-247 | reorder | pass |
| Side effects: `set_floor_orders`, `touch_project`, activity `floor.reorder` (objectCode = project id) | service.py:248-259 | reorder | pass |
| QA-03d · 51 ids → 422 floorIds (FLOORS_MAX, before any lookup); array body → 422 floorIds; full set + a deleted id → 422 `FLOOR_REORDER_MISMATCH`; only the deleted id → 404 floor | resolvers.py:63-121 | depth "reorder #13 set rules" | pass |
| Permission (after the resolver): viewer 403; engineer member 200 | router.py:27; projects/access.py:78-86 | roles | pass |

## POST /api/projects/:id/floors/:fid/drawings/uploads (#5) — drawings/router.py:39-67, uploads.py:93-227, schemas.py:27-66

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Body: `fileName` trim + NFC, 1..255, no Cc / bidi / `/` / `\` (→ field `fileName`); `floorId`, `projectId` required non-empty; `mimeType` ≤ 255 (may be ""); `sizeBytes` ≥ 1; `pageIndex` 0..19, default 0 | schemas.py:27-66 | init-rules (`a/b.png`, sizeBytes 0, pageIndex 20, missing floorId); QA-03d depth "init #5 fileName / mimeType limits" (256 name, FSI in the name, 256 MIME → 422) and "init #5 accepted types" (255 after NFC from 506 NFD code points; `.JPEG` + " Image/JPEG " → 200; octet-stream + pageIndex 19 PDF → 200) | pass |
| QA-03d · W21 body `floorId` ≠ path → 422 `PATH_BODY_MISMATCH` floorId | core/routing.py:138-151 | depth "init #5 W21" | pass |
| Floor of the project must be live → 404 `resource:"floor"` (checked before the file type) | uploads.py:190-192 | init-rules | pass |
| `.dwg` extension (any case) or `dwg` in the MIME → 422 `CAD_NOT_SUPPORTED` | uploads.py:98-109 | init-rules (`.DWG`, `image/vnd.dwg`) | pass |
| Extension outside png/jpg/jpeg/pdf → 422 `FILE_TYPE_MISMATCH`; MIME declared and ≠ the extension's → same; "" / `application/octet-stream` accepted | uploads.py:51-58,110-115 | init-rules (`.txt`, png + image/jpeg; "" → 200) ; ui main `.txt` rejection | pass (octet-stream: not asserted, same branch as "") |
| `sizeBytes` > `UPLOAD_MAX_BYTES` 100 MiB → 413 `PAYLOAD_TOO_LARGE` | uploads.py:194-196; settings.py:130 | init-rules | pass |
| `pageIndex` ≠ 0 on an image → 422 field `pageIndex` | uploads.py:197-198 | init-rules | pass |
| 200 `Progress` {id: `upl_…`, status pending, step preprocess, progressPercent 0}; `chunk_count = ceil(size / 5 MiB)` | uploads.py:204-227; progress.py:27-30 | init-rules, chunks; ui main (init `id` = uploadId) | pass |
| Dedupe: same floor + user + name + size + MIME + page, `receiving`, no chunk yet, within 120 s → the same upload | uploads.py:145-171,200-202; settings.py:132 | dedupe; roles (60 identical inits → one id) | pass |
| Side effect: activity `floor.upload` per NEW upload only | uploads.py:218-226 | dedupe (2 rows for 3 inits) | pass |
| Rate limit `drawings_init` 60 / 600 s per user (Redis cache store, fails open), counted after the `floor.upload` gate — every 422 too → 61st → 429 `RATE_LIMITED` + `Retry-After` ≤ 10 | router.py:39-53; settings.py:135-136; core/ratelimit.py:30-31,100-140 | roles (fresh engineer: 60 × 200, 61st 429) | pass |
| Permission: viewer 403 (not counted), non-member 404 | router.py:36,52 | roles | pass (run-17); skipped in run-32 |
| Concurrent identical inits (floor `FOR UPDATE` → the dedupe sees the first) | uploads.py:174-202 | — | not covered: the admin `drawings_init` bucket (60 / 600 s) has no room left (this file 52 + main 2 + edge 3 = 57); sequential dedupe is covered |

## POST /api/projects/:id/drawings/uploads/:uid/chunks (#6) — drawings/router.py:70-77, uploads.py:118-142,230-296

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Upload must belong to the path project and a live floor → else 404 `resource:"upload"` (other project, unknown, malformed id) | uploads.py:118-142 | chunks (unknown, malformed), pipeline (another project of mine) | pass |
| Upload not `receiving` (complete / rejected) → 422 `UPLOAD_NOT_RECEIVING` | uploads.py:255-261,283-284; errors.py:156-157 | reject | pass |
| `chunkIndex` ≥ 0 (Pydantic) and < chunk_count (route) → 422 field `chunkIndex` | schemas.py:73; uploads.py:285-286 | chunks (2, −1) | pass |
| `chunk` non-empty, strict base64, ≤ 5 MiB decoded, non-final chunk exactly 5 MiB → else 422 field `chunk` | schemas.py:72; uploads.py:230-245 | chunks (empty, `!!!`, 10-byte chunk 0) | pass; QA-03d depth "chunk #6 size edges": a 5 MiB + 1 last chunk → 422 chunk, exactly 5 MiB non-final → 200 |
| Resend of an index → 200, overwrites (upsert) | uploads.py:248-270 | chunks | pass |
| 200 `Progress` pending | uploads.py:296 | chunks, dedupe; ui main | pass |
| Permission: viewer 403, non-member 404 | router.py:70 | roles | pass |

## POST /api/projects/:id/drawings/uploads/:uid/complete (#7) — drawings/router.py:80-99, complete.py:113-312

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Body `{uploadId}` required, = path (W21) | schemas.py:76-79 | chunks (`{}` → field uploadId; other id → PATH_BODY_MISMATCH) | pass |
| Unknown / other project's upload → 404 `resource:"upload"` | complete.py:302; uploads.py:118-142 | chunks, pipeline | pass |
| Upload already complete / rejected → 200 current `Progress`, no 2nd run / activity | complete.py:253-265,302-304 | reject (rejected → 200 failed), pipeline (complete twice → 1 `floor.upload_complete`) | pass |
| Missing chunk indexes → 422 `UPLOAD_INCOMPLETE` + `count`; total ≠ `sizeBytes` → 422 `UPLOAD_SIZE_MISMATCH`; both keep `receiving` | complete.py:113-131 | chunks | pass |
| Magic bytes decide: DWG (`AC10` + 2 digits) → `CAD_NOT_SUPPORTED`; kind ≠ extension (incl. unknown) → `FILE_TYPE_MISMATCH`; no end marker (IEND / FFD9 / %%EOF) → `FILE_CORRUPT`; returned (not raised) so the row stays `rejected` with the code | complete.py:144-153,197-218,227-239,306-311; packages/vision/preprocess/sniff.py:23-39 | reject (3 cases; #8 → failed + error) | pass |
| PDF: > 20 pages → 422 `VALIDATION` (no field); `pageIndex` ≥ pages → field `pageIndex`; `/Count 0` (pdfium err SUCCESS) → `PDF_UNREADABLE`; `%PDF-` + garbage with `%%EOF` (pdfium FORMAT) → `FILE_CORRUPT`; each returned, row kept `rejected` → #8 failed + code | complete.py:52-53,172-194,227-239; packages/vision/preprocess/pdf.py:30-60; sniff.py:37-38 | gaps-pdf (PDFs generated in the spec by a port of the BE fixture `packages/vision/preprocess/tests/synthetic.py` `make_pdf`) | pass (run-18; a user-password PDF → `PDF_UNREADABLE` not covered: needs RC4 encryption, same mapping as `/Count 0`) |
| Chunk object changed between check and finish → 409 `UPLOAD_CHUNKS_CHANGED`; floor deleted meanwhile → 404 floor | complete.py:258-267 | — | not covered: needs a race inside one #7 (between its stage 2 and stage 3), not reproducible deterministically from outside |
| QA-03d · two parallel completes (C14) → both 200 with the same id, one `floor.upload_complete`, one run | complete.py:242-283 | depth "complete #7 concurrency" | pass |
| Floor soft-deleted BEFORE #6 / #7 / #8 → 404 `resource:"upload"` (`load_upload` joins a live floor); re-creating the id inside the restore window keeps the floor pk → the same upload is reachable again (#8 200 = the old Progress) | uploads.py:118-142 (136-137); floors/service.py:53-73,118-131,174-194 | gaps-gone-floor | pass (run-18) |
| Success: upload `complete`, `start_run` (pending run, supersedes live runs of the floor), activity `floor.upload_complete`, 200 `Progress` pending | complete.py:269-283; runs.py:218-256 | pipeline; ui main CP-4 | pass |
| Permission: viewer 403, non-member 404 | router.py:80-82 | roles | pass |

## GET …/drawings/uploads/:uid/progress (#8, read-back) — drawings/router.py:102-106, progress.py:33-115

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Member only (viewer 200, non-member 404 project); upload of the path project and a live floor else 404 upload | router.py:37,102-106; uploads.py:118-142 | roles, chunks, pipeline | pass |
| Progress table: receiving / pending run → pending preprocess 0; rejected → failed + `error` = rejected code; running → step + %; completed → qualityCheck 100 + endedAt; failed → error, no endedAt | progress.py:33-68 | reject (failed), chunks (pending), pipeline (final state = SSE last frame) | pass (running frames asserted only by shape) |

## GET /api/streams/projects/:id/uploads/:uid/progress (S1, SSE) — streams/router.py:118-140, sse.py:161-262, drawings/stream_providers.py:37-72

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Public route, cookie `appback_stream` (Path /api/streams) — missing / forged → 401 `UNAUTHENTICATED` | streams/router.py:1-6,128; sse.py:161-169; auth/cookies.py:15-31 | anon | pass |
| `Origin` absent → allowed (EventSource, K31); same origin → 200; foreign → 403 `ORIGIN_MISMATCH`, checked before the cookie | streams/router.py:127; core/origin.py:59-62 | sse-gates (absent, same, foreign), anon (foreign without cookie → 403) | pass |
| Malformed `prj_` / `upl_` id → 404 `resource:"upload"` (after auth) | streams/router.py:129-130 | sse-gates | pass |
| Not a member, unknown upload, upload of another project, deleted floor → 404 `resource:"upload"` (never 403) | stream_providers.py:43-62 | sse-gates (unknown upload, unknown project), pipeline (another project), roles (non-member), gaps-gone-floor (deleted floor) | pass |
| 200 `text/event-stream`, `Cache-Control: no-store`; first frame = snapshot `Progress` with `id:` = stream tail (S08); frames `id:` + one `data:` line, never `event:`; `: ping` heartbeats | sse.py:60-62,79-86,279-311,408-427 | sse-gates (snapshot = #8), pipeline (frames until final) ; ui main SCR-12 | pass |
| `lastEventId` (query, router.py:37) used only when well-formed (`[0-9]{1,20}-[0-9]{1,20}`), ≤ tail AND not trimmed; else the snapshot frame with `id` = tail. Empty stream → tail `0-0`, `is_trimmed` True | sse.py:279-311; packages/messaging/streams.py:23-24,45-47,168-179 | gaps-gone-floor (`not-an-id`, `0-0`, `99999999999999-0` → 200 snapshot, id = tail of a plain open, data = #8) | pass (run-18 fall-backs; QA-03d depth "S1 resume": lastEventId = the first live event → exactly the later events, same ids and data, no snapshot; lastEventId = the last id → no frame) |
| ≤ 6 streams per user → 7th 429 `RATE_LIMITED` + `Retry-After: 5`; global 500 → 429; nginx 30 per IP → 429 | sse.py:65,172-221; connections.py:30-50; streams/settings.py:34-35; deploy/nginx/snippets/app_locations.conf:25-28,101-108 | roles (engineer's 7th stream) | pass (global / per-IP caps not covered: 500 / 30 concurrent streams) |
| Membership rechecked every `STREAM_RECHECK_S` (≤ 5 s close after losing access) | sse.py:327-355; streams/settings.py:23-48 | — | not covered (needs a second real user removed while streaming → an invitation; pytest BE S07) |
| QA-03d · order Origin → cookie → id pattern: no cookie + malformed ids → 401; a foreign Origin first → 403; a revoked session (after POST /api/auth/logout) → 401 **`SESSION_REVOKED`** | streams/router.py:127-131; sse.py:161-169; auth/sessions.py:605-615 | depth "S1 session gates" | pass (re-run) |

## GET /api/projects/:id/floors/:fid/quality (#30, SCR-11) + POST …/corners (#31) + POST …/straighten (#32) — quality/router.py

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Member only; unknown floor → 404 floor; no floor of the project with a drawing → 404 upload | router.py:30-37; assessments.py:248-279 | sse-gates | pass |
| 200 `{projectId, floorId, floors[≥1]}`, floor entries with `sourceUrl` (signed) | assessments.py:257-279; schemas.py:62-79 | pipeline (run completed in both author runs) ; ui main / ui SCR-11 | pass |
| #32 body `{}` strict (extra → 422); no current drawing → 404 upload | router.py:49-56; schemas.py:95-96; service.py:125-140 | sse-gates | pass |
| QA-03d · #31 body: 3 / 5 / missing corners → 422 corners; xRatio 1.5 / yRatio −0.1 → `corners.0.xRatio` / `.yRatio`; extra keys → 422; geometry (counter-clockwise, not TL first, self-crossing, area < 0.05) → 422 corners — all before the floor lookup | schemas.py:82-92; geometry.py:54-78; service.py:333-339 | depth "quality #31 corners body" | pass |
| QA-03d · lookups: valid corners + unknown floor → 404 floor, no drawing → 404 upload; a rhombus (TL tie within eps) and a 0.0625 square pass the geometry; #32 / #30 unknown floor → 404 floor | service.py:125-142; geometry.py:60-76 | depth "quality #30 / #31 / #32 lookups" | pass |
| QA-03d · #30 view: floors = only floors with a drawing, `floorId` falls back to the first one; measured shape; #32 on a settled page (drawing.png: no SKEW_DETECTED, abs(skew) < 0.1) → 200, no new run (same #8 Progress, same drawing id) | assessments.py:221-279; service.py:198-205,355-366 | depth "quality #30 after a run" | pass |
| QA-03d · #31 happy path: 200, applied corners → frame `{isFound: true}`, a new run of the same upload (later `endedAt`), drawing id kept | service.py:229-352; assessments.py:221-228; drawings.py:146-150 | depth "quality #31 happy path" | pass |
| QA-03d · `QUALITY_LAYER_REVIEWED` 422: completed run + a human scale (#35) → #32 and #31 422, nothing re-queued | service.py:114-120; spatial_read/documents.py:165-176 | depth "quality 422 QUALITY_LAYER_REVIEWED" | pass |
| `QUALITY_DRAWING_CHANGED` 409 (a newer complete upload whose run has not failed and has not yet replaced the drawing) | service.py:89-122 | — | not covered: tried in run-32 (both calls 200, evidence `A03_drawing_changed_*_409.json`): the QA worker finishes drawing.png in ~0.5 s and `upsert_drawing` switches the floor to the new upload before the quality call reads it, so the window cannot be hit from outside; BE pytest quality/tests/test_race.py:90 covers it. Same for the 409 of `to_unrectified` / `_commit_swap` (degenerate homography / swap race) |
| #31 undo through `undo.corners`, "same corners → 200 without a run", `IMAGE_TOO_LARGE` (> 128 MiB page) | service.py:170-196,208-210 | — | not covered: undo / same-corners depend on the assessment row the follow-up ML run rewrites (not stable from outside); a 128 MiB page is above the 100 MiB upload cap |
| Permission: #31 / #32 viewer 403 (floor.upload), non-member 404 | router.py:209,224,233 | roles (QA-03d rows) | written, skipped in run-32 |

## GET /api/files/{token} — files/router.py:30-62

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Forged / unknown / expired token → one 404 `NOT_FOUND` | files/router.py:2-10,33-40 | anon | pass |
| Valid token → 200 stream, `inline` + image type only for PNG/JPEG with an inline token | files/router.py:41-62 | — (the QA stack stores in MinIO: `sourceUrl` is a presigned `localhost:9000` URL, files/router.py:34-36 → this route is a 404 there); the presigned URL itself → 200 `image/*` in pipeline | not covered on this stack (S3 backend) |

## GET /api/projects/:id/drawings/uploads/latest (N7, SCR-12 / SCR-13, QA-03d) — drawings/latest.py:30-123, core/pagination.py

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| One item per live floor with an upload, sorted by floor order; a receiving upload is listed without `sourceImageUrl`; rejected-only floors and floors without uploads left out; a deleted floor drops out | latest.py:39-76,89-117 | depth "N7 latest uploads" | pass |
| A floor with a run keeps the run's upload even after a newer abandoned init; `sourceImageUrl` present when the current drawing belongs to that upload | latest.py:39-76,92-108 | depth "after a completed run" | pass |
| `limit` 1..200 (0 / 201 / "abc" → 422 field limit, 200 ok); `nextCursor` only when more; the cursor → the next page | pagination.py:46-63; latest.py:79-86,110-116 | depth "N7 paging" | pass |
| Forged / tampered cursor → 422 `CURSOR_INVALID`; project P's cursor on Q → 422 (filters digest) | pagination.py:89-112; latest.py:84 | depth "N7 paging" | pass |
| Member only; non-member 404 project | latest.py:120 | roles (QA-03d rows) | written, skipped in run-32 |

## POST / DELETE /api/projects/:id/members (N3 / N4, SCR-08 "Thành viên", QA-03d) — project_members/router.py:42-80, service.py

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Unknown email → 422 `MEMBER_USER_UNAVAILABLE` field email; malformed / non-ASCII email → 422 email; extra key → 422 | service.py:32-39; schemas.py | depth "members N3 / N4" | pass |
| Own email (case variant) → 200 already a member, no row | service.py:61-95 | depth "members" | pass |
| Removing the last editor (myself) → 422 `MEMBER_LAST_EDITOR`; malformed / unknown user id → 404 member | service.py:42-58,98-140 | depth "members" | pass |
| Another active account → 201 UserOut; N4 → 200 UserOut; again → 404 member; activity `member.add` / `member.remove` | service.py:61-140 | depth "members" (the stack's second admin account; with none the branch is noted, not failed) | pass |
| `disabled` user → MEMBER_USER_UNAVAILABLE; pending user → 201; projectInvite notification; rate limit 60 / 3600 s; viewer 403 / non-member 404 | service.py:32-39; router.py:26-46 | phase02_dashboard_api "N3 →", "notifications", "roles"; QA-03d roles rows | covered by phase 2 / needs invitations here |

## spatial_read / spatial_write

`GET …/spatial/layer` (N16) is read by SCR-12 (extraction summary) and `PUT …/spatial/layer` (#35) is used here only as
setup for `QUALITY_LAYER_REVIEWED`; every rule of both is owned by `phase04_qc_layers_api.spec.ts`. N15 and the versions
API (N17–N20) are not called by any phase-3 screen.

## Side effects read back

| Effect | BE source | Read back by | Status |
|---|---|---|---|
| `touch_project` (project `updatedAt`) on real writes only | projects/summaries.py; settings service.py:114; floors service.py:146,184,250,312; runs.py:252 | set-ver, floor-patch, reorder (GET /api/projects/:id) | pass |
| Activity rows `project.settings_update`, `floor.create` / `floor.delete` / `floor.edit` / `floor.reorder`, `floor.upload`, `floor.upload_complete` | access/kinds.py:21-30,52-61 | GET /api/users/{id}/activity in set-ver, floor-create, floor-patch, reorder, dedupe, pipeline | pass |
| Upload row `rejected` + `rejected_code` | complete.py:227-239 | #8 in reject | pass |
| Pipeline run queued (`send_start_after_commit`), progress published to the upload stream | runs.py:245-255 | SSE frames in pipeline | pass |
| Floor summaries / N1 rollup (`register_floor`, `set_floor_orders`, `set_upload_state`) | projects/summaries.py | — | covered (phase02_dashboard_api "rollup" for floors; upload state not read back: N1 `wallsTotalCount` etc. are Phase 4) |

## Mock pairing (UI `[mocked response]` tests of phase 3)

Searched `qa/tests/phase03_*.spec.ts` (main `phase03_pipeline.spec.ts`, ui `phase03_pipeline_ui.spec.ts`, edge
`phase03_pipeline_edge.spec.ts`) for `[mocked response]` / `page.route`: **1 mocked test** (edge).

| UI test | Endpoint + faked response | Pairing |
|---|---|---|
| `phase03_pipeline_edge.spec.ts` E03 SCR-09 "[mocked response] GET floors 500 → "Không đọc được danh sách tầng" + "Thử lại" recovers" | `GET /api/projects/:id/floors` → 500 | unpairable: 5xx (no safe way to make #12 fail on the real stack). The real 200 `FloorOut[]` it recovers to is read back in floor-create, floor-patch, reorder (`A03_*_list*.json`) |

Real responses the edge spec gets from the stack (not mocked) and this spec also proves: N6 422 `body.notes` bidi
(set-rules `notes_bidi`), N6 409 `VERSION_CONFLICT` (set-ver), #5 422 `CAD_NOT_SUPPORTED` (init-rules `.DWG`).

## Rate-limit budget (one run)

| Limit (key) | BE value | This spec | Other phase-3 specs | Verdict |
|---|---|---|---|---|
| `auth_login_ip` (per IP) | 30 / 60 s (auth/settings.py; QA override 120) | 15 admin logins (every test but "anon") | main 1, ui 1, edge 0 (+1 each only if the stored session is dead) | ≤ 20 per run, layers sequential |
| `drawings_init` (per user) | 60 / 600 s (drawings/settings.py:135-136) | admin 52 = 29 (init-rules 13, dedupe 3, chunks 2, reject 3, pipeline 1, sse-gates 1, roles 1, gaps-pdf 4, gaps-gone-floor 1) + QA-03d 23 (spec header); engineer 61 (own bucket, deleted user). run-32 spent 53, then 5 more in a `--grep "S1 session gates"` re-run (spaces are not a filter: 8 tests ran) = 58 in one window, no 429 | main ≤ 2 (drawing.png, maybe .txt), edge 3, ui 0 (their headers) | 57 per full phase-3 run ≤ 60 — no room left: a new #5 case must replace one; keep 10 min between runs; re-run single tests with a space-free `--grep` regex |
| `POST /api/users/invitations` (per admin) | 30 / 3600 s | 2 ("roles" only; 0 with `QA_SKIP_INVITES=1`) | 0 | Phases 1 (8) + 2 (≤ 15) + 3 (2) = 25 ≤ 30 per hour |
| `recovery_ip` (per IP) | 10 / 900 s (override 60) | 2 accepts | 0 | fine |
| `members_add` (per actor) | 60 / 3600 s | admin 2 (roles) + ≤ 6 (QA-03d members) | 0 | fine |
| SSE per user / per IP | 6 / 30 concurrent | admin ≤ 1 at a time (gaps-gone-floor opens 5 streams one after another, each closed after its first frame); engineer 7 (6 held + 1 refused) | main 1 | fine |
| Concurrency (no limit) | — | gaps-race: 3 pairs of parallel requests | — | fine |

## Findings

- **F1 (run-17) — no longer reproduces on 2ee030c5**: "set-rules" (N6 truncated JSON → 400 `MALFORMED_JSON`) and "reorder"
  (#13 truncated JSON → 400) both passed in run-32 (`run-32-p03api/evidence/A03_set_rules_malformed_400.json`,
  `A03_reorder_malformed_400.json`). Close the BUG-LOG entry if it is still open.
- QA-03d: **no backend failure**. The two red tests of run-32 were test bugs: the S1 revoked-session code is
  `SESSION_REVOKED` (auth/sessions.py:605-615), not `UNAUTHENTICATED`; the `QUALITY_DRAWING_CHANGED` test assumed a
  window the QA worker closes in ~0.5 s (gap 2).
- Observation (not a bug): the QA stack stores drawings in MinIO, so `#30 sourceUrl` / N7 `sourceImageUrl` are presigned
  `http://localhost:9000/…` URLs and `GET /api/files/{token}` is a 404-only route there (files/router.py:34-36).
- drawing.png is "settled" for #32 (measured, no `SKEW_DETECTED`, abs(skewDeg) < 0.1): the no-op branch is what runs.

## Gaps

Closed by QA-03d (32 new tests): #11, #12, N7, #31, N3 / N4 (admin-only branches), S1 real resume + revoked session,
#5 fileName 255 (after NFC) / 256 / bidi and MIME 256, #6 > 5 MiB last chunk, #5 / #7 replay with an `Idempotency-Key`,
#7 concurrent completes, `QUALITY_LAYER_REVIEWED`, #31 / #32 happy and no-op paths, shared malformed / deleted-project
gates, VALIDATION `count`. Still open (each with its reason):

1. PDF with a user password → `PDF_UNREADABLE` (needs RC4-40 encryption in the spec; same mapping as `/Count 0`).
2. Races inside one request: `UPLOAD_CHUNKS_CHANGED` 409 and "floor deleted between #7 stage 2 and 3"
   (complete.py:258-267); `QUALITY_DRAWING_CHANGED` 409 (the worker replaces the drawing in ~0.5 s — tried and removed in
   run-32; BE pytest quality/tests/test_race.py:90); the #10 unique-violation path vs the pre-check.
3. S1 membership recheck close (S07) and every viewer / non-member row of the new endpoints (#11, #12, N7, #31, #32,
   N3, N4) — written in "roles" but skipped while `users_invite` is at its cap; run "roles" once the hour has passed.
   Global / per-IP stream caps (500 / 30 concurrent) are not safe to test.
4. Restore-window expiry (600 s) on #10.
5. #31 undo / same-corners no-op, `IMAGE_TOO_LARGE` (see the quality table).
6. Concurrent identical #5 inits — no room in the admin `drawings_init` bucket (57 / 60 per full run).
7. `GET /api/files/{token}` with a valid token: the QA stack uses MinIO, so the route only answers 404 here.
