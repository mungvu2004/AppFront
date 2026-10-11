<!-- qa-sources be=2ee030c5 -->
# Phase 06 — Backend coverage (rule config N21/N22, versions N17-N20 / #36, data viewer / export reads N15/N16)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`), HEAD `2ee030c5` (= `versionCheck.apiBuiltCommit`). Every
`file:line` is under `apps/api/` unless it starts with `packages/` or `apps/worker/`.
API spec: `qa/tests/phase06_rules_export_versions_api.spec.ts` — **7 tests** (`--list`), evidence prefix `A06_` (213 JSON
exchanges). Author run `run-01-author` (`node tools/run-phase.mjs --phase 06 --run-id run-01-author --layers api
--no-watch --grep "A06 ·"`): first pass 6/7 (one TEST bug: expected `field` "body.overrides.GENERAL", the BE camelCases
every alnum segment → "body.overrides.general"; fixed), second pass **7 passed / 7**, evidence ok,
`F:/App/qa-results/run-01-author/phase06-api/results.json`.
UI specs of the phase: main `phase06_rules_export_versions.spec.ts`, ui `phase06_rules_export_versions_ui.spec.ts`; no
edge spec yet.
Endpoints called by the phase's screens (FE `src/api/endpoints.ts:247-250` `ruleConfig.*`, `:251-266` `spatial.*`,
`:331-339` `versions.*`; client `src/api/client.ts:1284-1300,1425-1478`; `hooks/useProjectSpatial.ts:75` loads N21 with
N15 for every spatial screen; SCR-29 autosave = N22, SCR-32 list / diff / label / restore = N17 / N18 / N20 / N19):

| # | Method + path | BE handler |
|---|---|---|
| N21 | `GET /api/projects/:p/rule-config` | rules/router.py:21-26 → service.py:90-95 |
| N22 | `PUT /api/projects/:p/rule-config` (versioned) | rules/router.py:29-38 → service.py:98-148, schemas.py:23-50, catalog.py |
| N17 | `GET /api/projects/:p/versions?floorId=&limit=&cursor=` | versions/router.py:37-45 → service.py:142-163 |
| #36 | `GET /api/projects/:p/versions/:v` | versions/router.py:48-51 → service.py:129-139 |
| N18 | `GET /api/projects/:p/versions/:v/snapshot?floorId=` | versions/router.py:54-59 → service.py:166-176 |
| N19 | `POST /api/projects/:p/versions/:v/restore` (versioned) | versions/router.py:62-82 → service.py:217-298 |
| N20 | `PATCH /api/projects/:p/versions/:v/label` | versions/router.py:85-91 → service.py:301-338 |
| N15 | `GET /api/projects/:p/spatial` (data viewer, export) | spatial_read/router.py:65-68 |
| N16 | `GET /api/projects/:p/floors/:f/spatial/layer` (export, walls after restore) | spatial_read/router.py:71-87 |

Status words: **pass** (asserted by a test that passed in `run-01-author`) · **covered** (another spec / the BE pytest
asserts it) · **not covered** (reason given) · **unpairable**.
Test names shortened: "anon", "rules-write", "rules-body", "ver-read", "restore", "label", "roles".

## Shared rules

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Protected: no Bearer → 401 `UNAUTHENTICATED` before the project gate, the 428 guard and the body (truncated JSON still 401) — all 7 routes | core/routing.py:129-135 | anon (9 calls) | pass |
| Project gate `require_project`: malformed `prj_` → 404 `resource:"project"` without a query; missing / soft-deleted / not a member → 404 project; member without the key → 403 `FORBIDDEN` (no `resource`); 404 beats 403 | projects/access.py:28-33,45-86 | rules-body (malformed + missing project, no baseVersion → 404), ver-read (deleted project N17 → 404), roles (viewer non-member × 6 routes, engineer non-member) | pass |
| Keys: N21 / N17 / #36 / N18 any member; N22 `ruleset.edit` (admin only); N19 / N20 `layer.edit` (admin, engineer) | rules/router.py:21-33; versions/router.py:33-34; packages/domain/permissions/matrix.py:47,53 | roles (viewer reads 200, writes 403; engineer N22 403, N20 200, N19 201) ; ui main SCR-29 / SCR-32 run as admin | pass |
| Gate order (writes): auth → JSON parse 400 → project gate → W21 path/body 422 `PATH_BODY_MISMATCH` → 428 guard (N19 / N22) → idempotency guard (N20) → Pydantic 422 → service | core/routing.py:138-185,236-256 | roles (viewer: no baseVersion / invalid label / malformed version → 403), rules-body (404 project beats 428; W21), restore (W21 projectId + versionId), label (W21 versionId, bad key 422) | pass |
| No rate limit on N15-N22 / #36 | grep `rate_limit(` in rules/, versions/, spatial_read/, spatial_write/ → none | — | covered (source read; budget in the spec header) |
| Error field = first Pydantic error, root dropped, **every alnum segment camelCased** (`GENERAL` → `general`), stops at the first non-alnum segment (a dashed rule code) | core/errors.py:136-157,170-183 | rules-body (`body.overrides`, `body.overrides.general`) | pass |
| Observation: Pydantic path for `GENERAL: {}` is `body.overrides.general` while the catalog errors use `body.overrides.GENERAL.enabled` (hand-built, rules/service.py:72) — two spellings of one rule code in `field` | core/errors.py:153; rules/service.py:72 | rules-body | observation (FE maps neither to a field today — not a finding) |

## GET /api/projects/:p/rule-config (N21) — rules/router.py:21-26, service.py:90-95

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Never saved → 200 `{revision: 0, overrides: {}}`, no row created | service.py:90-94 | rules-write, rules-body, roles ; ui main SCR-28/29 load | pass |
| Saved → stored revision + overrides filtered by the catalog (codes / threshold keys outside it dropped on read) | service.py:36-59,95 | rules-write (read-back = N22 answer) | pass (filtering of legacy rows: not covered — a row outside the catalog cannot be written through N22; BE pytest rules/tests) |
| Body exact keys `{revision, overrides}`; absent override keys stay absent (W2); FE `ProjectRuleConfigSchema` decodes | schemas.py:53-70; FE src/api/schemas/ruleConfig.ts:99-117 | rules-write | pass |

## PUT /api/projects/:p/rule-config (N22) — rules/router.py:29-38, schemas.py:23-50, service.py:62-148

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Body not an object / no `baseVersion` → 428 `PRECONDITION_REQUIRED` before Pydantic (also `[]`, `"junk"`) | core/routing.py:154-163 | rules-body | pass |
| Truncated JSON → 400 `MALFORMED_JSON` (no `field`) | core/errors.py:170-174 | rules-body | pass |
| W21: body `projectId` ≠ path → 422 `PATH_BODY_MISMATCH` `field:"projectId"`; equal → 422 `VALIDATION` `field:"projectId"` (extra key) | core/routing.py:138-151; core/wire.py | rules-body | pass |
| `baseVersion` strict int ≥ 0 (`"0"`, -1, 1.5, null → `field:"baseVersion"`); `body` required; strict keys at every level (`note`, `body.revision`, override `note`) | schemas.py:46-50,23-43 | rules-body | pass |
| `overrides` dict, code key pattern `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`, threshold key pattern, override ≥ 1 key and no `null`, `thresholds` non-empty, `enabled` StrictBool, `severity` ∈ critical / warning / suggestion, threshold strict finite float (string, NaN, 1e400 rejected) → 422 `VALIDATION` `field:"body.overrides"` | schemas.py:14-43 | rules-body (14 cases) | pass |
| Catalog tier 2: unknown code → 422 `RULE_CODE_UNKNOWN`; key not in the 26 or under another code (also under GENERAL) → `RULE_THRESHOLD_UNKNOWN`; outside `[min, max]` → `RULE_THRESHOLD_OUT_OF_RANGE` (all `field:"body.overrides"`); GENERAL with `enabled` / `severity` → `RULE_GENERAL_NOT_TOGGLEABLE` `field:"body.overrides.GENERAL.enabled|severity"` | service.py:62-80; errors.py:5-15; catalog.py:14-96 | rules-body (8 cases) | pass |
| Catalog order: codes sorted, keys sorted, first error wins (`AAA-X` before `GENERAL`; `GENERAL` before `WALL-…`); catalog runs before the version check (base 9 + unknown code → 422, not 409) | service.py:67-80,106-108 | rules-body (order_code_first, order_general_first, catalog_before_version) | pass |
| Bounds inclusive (30 / 1000 wall thickness, 600 door, 60 room area, 0.5 support share, 100 000 escape); integer thresholds accepted | catalog.py:72-93; service.py:79 | rules-write, rules-body (bounds_inclusive) | pass |
| Win: `UPDATE … WHERE revision = base` → 200 `{revision: base + 1, overrides}`; PUT replaces the whole map (`{}` = defaults, SCR-29 "Khôi phục mặc định") | service.py:113-143 | rules-write (base 0 → 1, reset → 2) ; ui main SCR-29 toggle / preset / reset | pass |
| Win side effects: activity `rules.config_update` (objectCode = project) once per won write; `touch_project` bumps `updatedAt` | service.py:132-142; access/kinds.py:35 | rules-write (1 row after the first write, still 1 after the repeat; updatedAt moved, unchanged after repeat / rejects) | pass |
| Own repeat (C09b): same writer + same body SHA-256 + base = revision − 1 → 200 current, nothing written | service.py:144-147 | rules-write | pass |
| Stale base (another body) or base > revision → 409 `VERSION_CONFLICT` `currentVersion` + `remoteChanges: []` | service.py:148; core/errors.py:82-87 | rules-write (stale 0, future 7) | pass |
| Two concurrent writes on one base → one 200, one 409 (row-level UPDATE decides; K07) | service.py:113-131 | rules-write (race) | pass |
| Versioned route → no idempotency guard: a malformed `Idempotency-Key` is ignored | core/routing.py:227-232 | rules-write | pass |
| FE sends `{baseVersion, body}` (`UpdateRuleConfigSchema`); the spec's own bodies pass it | FE src/api/schemas/ruleConfig.ts:119-125 | rules-write | pass |

## GET /api/projects/:p/versions (N17) — versions/router.py:37-45, service.py:142-163

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Versions only come from the pipeline (before note "trạng thái trước khi ghi kết quả AI", after without note, creator `system:pipeline` / "hệ thống AI") and from N19 — never from autosave | apps/worker/pipeline_persist/service.py:182-198; constants.py:5; versions/messages.py:18-20 | ver-read (v1 before, v2 after on an own pipeline run), restore | pass |
| 200 `{items[, nextCursor]}`, `sequence` desc; item exact keys (`label` / `note` absent when unset, W2); `floorRevision` of the after = N16 `revision`; FE `FloorVersionPageSchema` + `FloorVersionSummarySchema` decode | service.py:78-90,142-163; schemas.py:31-42; snapshots.py:147-183 | ver-read, restore, label, roles ; ui main SCR-32 | pass |
| Floor without versions → `{items: []}` | service.py:154-163 | ver-read (floor 2) ; ui `U06 · SCR-32 versions, floor without versions` | pass |
| `limit` 1..200 (0, 201, "abc" → 422 `field:"limit"`), default 50; `limit+1` read → `nextCursor` only when more | router.py:42; core/pagination.py:44-58; service.py:157-163 | ver-read (limit 1 → page 2 → no cursor; 200 ok) ; ui main "Xem thêm phiên bản" (branch only when > 50) | pass |
| Cursor HMAC + op + floor digest: garbage → 422 `CURSOR_INVALID`; a cursor of floor A on floor B → 422 `CURSOR_INVALID`; decoded BEFORE the floor lookup (bad cursor + unknown floor → 422, not 404) | core/pagination.py:85-113; service.py:149-153 | ver-read | pass |
| `floorId` required, min 1 (missing / empty → 422 `field:"floorId"`); unknown floor → 404 `resource:"floor"` | router.py:39; service.py:151-153 | ver-read | pass |
| Cursor not bound to the caller (filters = `floorId` only) | service.py:149 | — | not covered (any member may reuse another member's cursor by design; no harm: same project gate) |

## GET /api/projects/:p/versions/:v (#36) — versions/router.py:48-51, service.py:129-139

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| 200 `{id, projectId, sequence, createdAt, creatorId[, note]}` | schemas.py:20-28; service.py:129-139 | ver-read (v2 no note, v1 note) | pass |
| `_locate`: malformed id → 404 `resource:"version"` without a query; missing / other project's version / soft-deleted floor → 404 version | service.py:93-112 | ver-read (malformed, missing, P's version under Q) | pass (deleted floor: not covered — needs a floor delete of the versioned floor; same `_locate` branch) |
| Not called by any phase-6 screen (FE `spatial.version` has no caller in screens/) | FE src/api/client.ts:1319 | — | observation |

## GET /api/projects/:p/versions/:v/snapshot (N18) — versions/router.py:54-59, service.py:166-176

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| 200 exactly `{versionId, layer, dimensions}`; `layer` / `dimensions` = N16 at that revision; FE `FloorVersionSnapshotSchema` decodes | schemas.py:45-50; service.py:166-176; snapshots.py:97-103,121-144 | ver-read (v2 = N16 AI layer with walls, v1 = empty layer) ; ui main SCR-32 restore (snapshot read) | pass |
| Order: 404 version → floor mismatch → snapshot; `floorId` ≠ the version's floor (other or unknown floor) → 422 `VERSION_FLOOR_MISMATCH` `field:"floorId"`; missing `floorId` → 422 `VALIDATION` `field:"floorId"`; malformed version on another floor → 404 version | service.py:166-173; router.py:56 | ver-read (6 cases) | pass |
| Purged / corrupt snapshot → 422 `VERSION_SNAPSHOT_PURGED` (`hasSnapshot: false` beyond the newest 50) | service.py:115-121; snapshots.py:48-59,132-144,284-295; errors.py:9-10 | — | not covered (needs > 50 versions on one floor = > 25 restores, or `VERSIONS_KEEP_SNAPSHOTS` lowered on the stack; BE pytest versions/tests) |

## POST /api/projects/:p/versions/:v/restore (N19) — versions/router.py:62-82, service.py:179-298

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| No `baseVersion` → 428; truncated JSON → 400; W21 `projectId` / `versionId` ≠ path → 422 `PATH_BODY_MISMATCH` | core/routing.py:138-163 | restore | pass |
| Body strict: `baseVersion` strict int ≥ 0, `body.floorId` min 1, extra keys → 422 `VALIDATION` with `field` (`baseVersion`, `body`, `body.floorId`, `body.note`, `label`) | schemas.py:53-63 | restore (7 cases) | pass |
| Malformed / missing version → 404 version; other project's version → 404 version | service.py:93-112,226 | restore, ver-read (P's version under Q) | pass |
| Version of another floor than `body.floorId` → 422 `VERSION_FLOOR_MISMATCH` `field:"body.floorId"` | service.py:228-229 | restore | pass |
| `baseVersion` > floor revision → 422 `VALIDATION` `field:"baseVersion"` (after the replay check) | service.py:232-236 | restore | pass |
| Stale base with logged changes → 409 `VERSION_CONFLICT` `currentVersion` + `remoteChanges` (the human #35 edit, `changedBy` = admin); the "before" version is rolled back with the request (N17 unchanged) | service.py:1-5,269-287; spatial_write/writer.py:349-372 | restore | pass |
| Success → 201 the "after" version: `sequence` + 2, `floorRevision` + 1, note "phục hồi nội dung của phiên bản vN", creator = caller (id + name at write time), `hasSnapshot` true; "before" version note "trạng thái trước khi phục hồi phiên bản vN" at the old revision; N16 layer = the snapshot layer (no rescale without a scale change) | service.py:200-215,254-298; messages.py:8-15; snapshots.py:223-264 | restore (v2 → v4 / v3, N16 = N18 v2), roles (engineer restore → creator = engineer) ; ui main SCR-32 restore (walls = snapshot) | pass |
| Activity `version.restore` (objectCode = restored version id) once, only when the revision moved | service.py:241-250; access/kinds.py:33 | restore (1 row; replay 0; no-op 0) | pass |
| Own repeat (C09b): latest = its "after" for the same version + caller + base at the doc revision → 200 same row, nothing written | service.py:179-197,232-234; router.py:80-81 | restore | pass |
| Content equal to the floor → `write_layer` unchanged, no new version (K18): 201 with the EXISTING latest row, `floorRevision` = `baseVersion` (FE `unchanged`) | service.py:241,266-298; snapshots.py:242-244; FE versionHistoryGateway.ts:224-230 | restore (restore v4 at its own revision) | pass |
| "Before" not inserted when the latest version already sits at the doc revision (restore v1 right after v4) | snapshots.py:240-244 | restore (v5 after v4, no extra before) | pass |
| Rescale of an unreviewed snapshot when the floor scale changed since; `RescaleError` → 422 `VALIDATION` | service.py:200-214 | — | not covered (needs a scale write between pipeline and restore; scale rules are phase 3/4 — BE pytest versions/tests) |
| Versioned → no idempotency table | core/routing.py:227-232 | — | covered (source read; same mechanism asserted on N22 in rules-write) |

## PATCH /api/projects/:p/versions/:v/label (N20) — versions/router.py:85-91, service.py:301-338

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| `label` strict string (number, null, missing → 422 `field:"label"`); strict keys (`note` → `field:"note"`); W21 `versionId` | schemas.py:66-69; core/routing.py:138-151 | label | pass |
| `nfc` + `strip`, then ≤ 60 UTF-16 units (60 `a` ok, 61 → 422; 30 emoji = 60 ok, 31 → 422), no `Cc` / `Cf` (U+0007, U+202E, **U+200E**) → 422 `field:"label"` | service.py:54-58,301-311 | label | pass |
| Observation: FE `LabelVersionSchema` (`z.string().trim().max(60)`) lets U+200E / control chars through, the BE answers 422 `label` — the dialog would show a server error instead of an inline one | FE src/api/schemas/versions.ts (LabelVersionSchema); service.py:57-58 | label (`label_lrm_cf_422`) | observation (FE↔BE validation gap, P3) |
| `""` / spaces only → label removed (key absent, W2) | service.py:311; schemas.py:41 | label | pass |
| Label validated BEFORE the version lookup (invalid label on a malformed id → 422, not 404); malformed / missing / other project's version → 404 version | service.py:322-323,93-112 | label, ver-read (P's version under Q) | pass |
| 200 = the same row with the new label; no new version, floor revision unchanged; unchanged label → no write, no activity; activity `version.label` once per change | service.py:314-338; access/kinds.py:34 | label (N17 still 2, N16 revision unchanged, activity 1 after set + same) ; ui main SCR-32 label (PATCH 200, row shows "e2e") | pass |
| Idempotency `auto` (PATCH, protected, not versioned): key `^[A-Za-z0-9_-]{8,128}$` else 422 `field:"idempotencyKey"`; same key + same body → stored 200 replayed; same key + other body → 422 `IDEMPOTENCY_KEY_REUSED` | core/routing.py:164-185,227-232; core/idempotency.py:79-96,198-234 | label | pass |

## GET …/spatial (N15) and …/spatial/layer (N16) — data viewer (SCR-31) and export (SCR-30)

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| All N15 / N16 rules (gate, 404 floor, empty document, `revision`, `level`, four lists, `dimensions`, FE zod) — unchanged since phase 4 (`git diff bf83f815 2ee030c5` on spatial_read/, spatial_write/, projects/, core/ is empty) | spatial_read/router.py:65-87 | `phase04_qc_layers_api.spec.ts` (see `phase04-be.md`) ; ui main SCR-30 / SCR-31 | covered (phase 4) |
| N16 after a restore = the restored snapshot; revision moves by one per applied restore | spatial_read/router.py:71-87; versions/service.py:279-287 | restore (`restore_layer_after_201`, `restore_layer_final`) ; ui main SCR-32 restore | pass |
| Export / JSON download are client-side (blob `<a download>`, PDF has no builder) — no BE route | FE screens/export/ExportPanel/exportPanelGateway.ts:31,55 | ui main SCR-30 | n/a (no endpoint) |

## Mock pairing (every `[mocked response]` test of the phase's UI specs)

| UI test | Endpoint + faked response | Pairing |
|---|---|---|
| — | `grep "mocked response\|page.route" tests/phase06_*` → no match in `phase06_rules_export_versions.spec.ts` or `phase06_rules_export_versions_ui.spec.ts` (no edge spec yet) | nothing to pair (0 mocked tests) |

## Gaps left (not authored)

| Gap | Why |
|---|---|
| N18 / N19 `VERSION_SNAPSHOT_PURGED` | needs > 50 versions on one floor (> 25 restores) or a lowered `VERSIONS_KEEP_SNAPSHOTS` on the stack — BE pytest owns it |
| N19 rescale branch (`RescaleError` → 422) | needs a scale change between snapshot and restore — BE pytest owns it |
| #36 / N18 on a soft-deleted floor → 404 version | same `_locate` filter as the asserted branches; would need deleting the versioned floor |
| N21 filtering of legacy rows outside the catalog | cannot be produced through N22 (catalog rejects it) |
