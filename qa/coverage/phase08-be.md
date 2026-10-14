<!-- qa-sources be=2ee030c5 built; BE HEAD equals origin/main (0 behind), no diff vs apiBuiltCommit -->
# Phase 08 — Backend coverage (admin: library, ML registry / jobs / datasets, users)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`), HEAD `2ee030c5` = `origin/main` (0 behind, fetched
2026-10-12) = `versionCheck.apiBuiltCommit`; `git diff 2ee030c5 HEAD -- apps packages deploy` (tests excluded) is empty.
Every `file:line` is under `apps/api/` unless it starts with `packages/`.
API spec: `qa/tests/phase08_admin_api.spec.ts` — **15 tests** (`--list`), evidence prefix `A08_` (194 JSON exchanges).
Author run `run-32-author` (`node tools/run-phase.mjs --phase 08 --run-id run-32-author --layers api --no-watch
--grep "A08 ·"`): **15 passed / 0 failed**, evidence ok, `F:/App/qa-results/run-32-author/phase08-api/results.json`.
Signed object URLs (`modelUrl`, `previewUrl`, `avatarUrl`) are written with the query (signature) cut.
UI specs of the phase: main `phase08_admin.spec.ts`, ui `phase08_admin_ui.spec.ts`; no edge spec.
Every 2xx body is decoded with the FE zod schema (strict): `src/api/schemas/library.ts` `LibraryItemSchema`,
`adminMl.ts` (`ModelFamilyPageSchema`, `ModelFamilySchema`, `ModelVersionPageSchema`, `TrainingJob*`, `Dataset*`),
`users.ts` (`AdminUserListSchema`, `AdminUserSchema`, `UserMembershipSchema`, `UserActivitySchema`).

Status words: **pass** (asserted by a test that passed in `run-32-author`) · **env** (branch exists, the stack's data
cannot reach it; the test checks for it and annotates "environment:") · **covered** (BE pytest asserts it, named) ·
**not covered** (reason) · **unpairable**. Test names shortened: "anon", "matrix", "library", "reg-read", "reg-write",
"jobs-read", "job-create", "datasets", "users-read", "invite", "self", "role", "state", "pending", "delete"
(all `A08 · …`).

## Shared rules (all 20 routes)

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Protected: no / non-Bearer / garbage Bearer → 401 `UNAUTHENTICATED` before session, dependencies or body (truncated JSON on writes still 401, not 400) | core/routing.py:129-135,261-263 | anon (20 routes + garbage Bearer) | pass |
| Admin ML routers: `require_admin` at router level → viewer / engineer 403 `FORBIDDEN` without `resource` | admin_ml_registry/router.py:31, admin_ml_jobs/router.py:30, admin_ml_datasets/router.py:27; access/deps.py:30-45,77 | matrix (viewer + engineer, 10 ML routes) | pass |
| `/users*`: `require_permission("user.manage")` (admin only) → 403 before the body and before the `users_invite` limiter | users/router.py:45-46; access/deps.py:65-74 | matrix (8 users routes, valid bodies on real targets; targets unchanged after) | pass |
| `/library*`: `current_principal` only, no role gate → every signed-in role 200 | library/router.py:1-4,13 | matrix (viewer 200, engineer 200) | pass (observation: FE gates SCR-34 by `library.manage`; BE serves the list to any role — by design, the editor panel uses it) |
| Error body W7 `{code, requestId}` + `field` / `resource` / `currentVersion`+`remoteChanges` | core/errors.py:82-88; packages/core/errors.py:63-65,171-185 | every error assertion (`expectError`) | pass |
| Pydantic → 422 `VALIDATION` with camelCase `field` of the first error (`query`/`body` root dropped) | core/errors.py:136-176 | reg-read, reg-write, jobs-read, job-create, datasets, role, state, delete | pass |
| Order: dependencies (auth gate, limiter) → framework guards (W21 422 `PATH_BODY_MISMATCH`, 428) → Pydantic 422 → endpoint | core/routing.py:8-12,138-163,242-255 | matrix (403 before body), role/state/delete (W21 before Pydantic), reg-write (428 before Pydantic) | pass |
| Idempotency only when `Idempotency-Key` is sent (writes without it run plainly); N24 is versioned → no idempotency table | core/routing.py:166-187,227-231; admin_ml_registry/router.py:5-6 | job-create (no key, nothing stored) | not covered (replay / `IDEMPOTENCY_KEY_REUSED` not sent: no successful create is safe here) |
| Cursor lists: HMAC-signed opaque cursor; garbage / tampered / other op / other filter → 422 `CURSOR_INVALID` (no field) | core/pagination.py:89-113 | reg-read (garbage, tampered, other filter, versions cursor on jobs), jobs-read, datasets | pass |
| `limit` 1..max (default 50; N25 max 200, N32 200, N28 200) → 422 `field:"limit"` | core/pagination.py:46-63 | reg-read (0, 201, 200 ok), jobs-read (201), datasets (0) | pass |
| Rate limits: only `users_invite` (30 / 3600 s per actor, safe store, fail-closed, counted before body validation) on #44 / #45 | users/router.py:32-46; core/ratelimit.py:84-140 | invite (2 counted calls); the budget is in the spec header | 429 **unpairable**: exhausting the admin's hourly window would block every later invite of phases 7-11; pytest `test_users_invite_users__C15` (users/tests/test_invite.py:138) asserts it |

## GET /api/library (#14) — library/router.py:17-20, service.py:24-30,69-78

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| 200 bare array (legacy list, not `{items}`); FE `z.array(LibraryItemSchema)` strict decodes | router.py:18; schemas.py:15-28 | library, matrix | pass |
| Visible = published, not retired, (system or own); `source` `mine` / `catalogue` | service.py:24-30,55 | library (decode: source enum) | covered (no API to create an owned item: `library/tests/test_routes.py`) |
| ≤ `LIBRARY_LIST_MAX` 500, order `(sort_order, id)` | service.py:69-78; settings.py:18 | library (≤ 500) | pass (order not observable on the wire: `sort_order` is not sent) |
| K01: no `furnitureKind` / `ownerId` / `publishedAt`; W2: `previewUrl` absent not null | schemas.py:1-4,28 | library | pass |
| Signed URLs computed locally (`attachment`), absolute | service.py:33-66 | library (FE `z.string().url()`) | pass |

## GET /api/library/{itemId} (#15) — router.py:23-28, service.py:81-90

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| id outside `^[a-z0-9]+(-[a-z0-9]+)*$` (≤ 64) → 404 `resource:"libraryItem"` without a query | service.py:83-84; packages/domain/library/catalogue.py:25-29 | library (`Bad_ID`) | pass |
| Well-formed id, not visible → 404 `libraryItem` (no existence leak for others' `mine` items) | service.py:85-89 | library (unknown id) | pass (others' `mine` item: covered, `library/tests/test_routes.py`) |
| 200 = the list row (URLs re-signed per call) | service.py:90 | library | pass |

## GET /api/admin/ml/model-families (N23) — admin_ml_registry/router.py:38-41, service.py:55-65

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Exactly 3 families in `FAMILY_ORDER` (walls, opening, dimension), never `nextCursor` | service.py:55-65; packages/ml_contracts/families.py:19-23 | reg-read | pass |
| `activeVersionId` absent (not null) on the classic path; `revision` int | schemas.py:47-52,147-153 | reg-read, reg-write | pass |

## PUT /api/admin/ml/model-families/{family}/active (N24) — router.py:44-61, service.py:124-171

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| No `baseVersion` / non-object body → 428 `PRECONDITION_REQUIRED` before Pydantic | core/routing.py:154-163; router.py:45 | reg-write (missing key, `[1]`) | pass |
| `baseVersion` strict int ≥ 0 (string, -1 → 422 `field:"baseVersion"`); unknown key → 422 field = key; `body.versionId` required (nullable) → `field:"body.versionId"` | schemas.py:78-96 | reg-write | pass |
| `{family}` outside the three → 404 `resource:"modelFamily"` | service.py:141-142; errors.py:32-34 | reg-write (`doors`) | pass |
| `revision ≠ baseVersion` (and not the writer's own repeat) → 409 `VERSION_CONFLICT` `currentVersion`, `remoteChanges: []` | service.py:145-148 | reg-write (`R+1`) | pass |
| C09b repeat (same writer, same body, `revision = base+1`) → 200 current row | service.py:68-76,145-146 | — | covered (`admin_ml_registry/tests/test_activate.py`); not sent: depends on who wrote last |
| `versionId:null` for a non-walls family → 422 `MODEL_VERSION_FAMILY_MISMATCH` | service.py:150-152 | reg-write (opening) | pass |
| Version of another family → 422 `MODEL_VERSION_FAMILY_MISMATCH`; unknown id → 404 `modelVersion` | service.py:95-100 | reg-write | pass |
| Not onnx → 422 `MODEL_FORMAT_UNSUPPORTED` (before evaluation); onnx not completed → 422 `MODEL_VERSION_NOT_EVALUATED` | service.py:101-104 | reg-write (conditional) | **env** (run-32: no non-onnx / un-evaluated opening version); covered by `test_activate.py` |
| Same version already active → 200 current row, revision NOT bumped, no activity | service.py:155-156 | reg-write (body = `{activeVersionId, family, revision: R}`; families unchanged after) | pass |
| Real switch: `UPDATE … WHERE revision = :base` (+1), `model.activate` activity, `versionId:null` → walls classic | service.py:108-121,157-171 | ui main SCR-36 (activate + mandatory restore, R2) | not covered here by design (global state; the UI test owns it) |
| Viewer / engineer → 403 even with a valid no-op body | router.py:31 | matrix | pass |

## GET /api/admin/ml/model-versions (N25) — router.py:64-71, service.py:174-200

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Newest first by `(createdAt, id)`; K01 (`weightsKey`, `pinnedName`, `evaluationAttempts`, `evaluationErrorCode` absent); `metrics` ⇔ `completed` with the family's key | service.py:192-200; schemas.py:1-10,112-144 | reg-read | pass |
| `?family=` filter (each of 3); unknown → 422 `field:"family"` (query, not 404) | service.py:182-187 | reg-read | pass |
| `limit` 1..200 (`VERSION_LIST_MAX_LIMIT`) | router.py:35,67 | reg-read (0, 201 → 422; 200 → 200) | pass |
| Cursor continues strictly after the page row (tuple compare); cursor bound to op + filters | service.py:184-199 | reg-read (page 2 = row 2; other filter / other op / tampered → `CURSOR_INVALID`) | pass |

## GET /api/admin/ml/training-jobs (N32) — admin_ml_jobs/router.py:40-48, service.py:91-115

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Newest first, `TrainingJobPage`; K01 (`lastHeartbeatAt`, `artifactsPurgedAt`, `requeueCount`, `updatedAt` absent); K02 optional fields absent | service.py:107-115; schemas.py:1-12,99-116 | jobs-read | pass (list empty in run-32: decode of an empty page) |
| `family` ∉ TRAINABLE (incl. `dimensionReading`) → 422 `field:"family"`; `status` ∉ 6 statuses → 422 `field:"status"` | service.py:93-96; families.py:24; packages/db/models/admin_ml_jobs.py:28 | jobs-read | pass |
| `?status=succeeded` / `?family=` filter (the SCR-35 "Xong" filter) | service.py:99-102 | jobs-read | pass (empty result) |
| `limit` ≤ 200, cursor rules | router.py:43 | jobs-read | pass |

## POST /api/admin/ml/training-jobs (N33) — router.py:51-64, service.py:147-195 (UI: dialog opened then closed, never sent)

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| `epochs` 1..300 → 422 `field:"epochs"` | schemas.py:28-29; models/admin_ml_jobs.py:37 | job-create (0, 301) | pass |
| `family` TrainableFamily → `dimensionReading` 422 `field:"family"` | schemas.py:92 | job-create | pass |
| `datasetVersionId` not `dsv_<ULID>` → 422 `field:"datasetVersionId"` (not 404) | schemas.py:10-11,25 | job-create | pass |
| Unknown key (e.g. `creatorId`, K05) → 422 field = key | schemas.py:81-92; core/wire.py:46 | job-create | pass |
| `baseModel` ∉ `BASE_MODELS[family]` → 422 `TRAINING_BASE_MODEL_MISMATCH` before the dataset lookup | service.py:161-162; families.py:29-34 | job-create (`mitB0` + opening) | pass |
| Unknown dataset version → 404 `resource:"datasetVersion"` | service.py:135-137 | job-create | pass |
| Version not `ready` → 422 `DATASET_VERSION_NOT_READY`; ready of another family → 422 `DATASET_FAMILY_MISMATCH` | service.py:138-143 | job-create (conditional) | **env** (run-32: no dataset at all); covered by `admin_ml_jobs/tests/test_write.py` |
| Success: 202 `queued`, `creator_id` from Principal, `training.create` activity, runner task after commit | service.py:164-195 | — | not covered (would start a real training job; no delete API) — covered by `test_write.py` |
| Nothing written by any refused body | service.py:161-163 | job-create (newest job id unchanged) | pass |

## GET /api/admin/ml/training-jobs/{id} (N34), /metrics (N36), /logs (N37) — router.py:67-94, service.py:75-88,118-120,239-327

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Unknown / malformed id → 404 `resource:"trainingJob"` (never 422); metrics/logs read the job first | service.py:75-88,287,314 | jobs-read (job, metrics, logs) | pass |
| `since` ≥ -1 (exclusive), `limit` 1..200 → 422 `field` (query checked before the handler) | router.py:33-37,83,91 | jobs-read (since -2, limit 0 / 201, both streams) | pass |
| 200 job = list row; metrics step ascending, last step held until both splits / late window; logs seq ascending; `nextCursor` = decimal of last step/seq, absent only past the late window | service.py:239-327; settings.py:24 | jobs-read (conditional on a real job) | **env** (run-32: no training job); covered by `admin_ml_jobs/tests/test_progress.py`, `test_read.py` |

## GET /api/admin/ml/datasets (N28) — admin_ml_datasets/router.py:33-40, service.py:54-77

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Newest first `DatasetPage`; K01 no `createdBy` / `nameKey` | service.py:63-77; schemas.py:83-85 | datasets | pass (empty in run-32) |
| `?family=` (3 families) filter; unknown → 422 `field:"family"` | service.py:59-63 | datasets | pass |
| `limit` / cursor rules | router.py:36 | datasets (limit 0, bad cursor) | pass |

## GET /api/admin/ml/datasets/{id}/versions (N30) — router.py:51-56, service.py:116-141

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Unknown / malformed dataset → 404 `resource:"dataset"` | service.py:49-51,116-121 | datasets | pass |
| `sequence` descending; `manifestSha256`/`splitCounts` ⇔ ready, `failureCode` ⇔ failed; K01 | service.py:124-141; schemas.py:5-8,88-102 | datasets (conditional) | **env** (run-32: no dataset); covered by `admin_ml_datasets/tests/test_read.py` |

## GET /api/users (#38) — users/router.py:49-52, service.py:240-246

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Non-deleted users `(created_at, id)` ASC, `total` ≥ `users.length`, ≤ `USERS_LIST_MAX` 1000 | service.py:72,240-246 | users-read | pass |
| `lastActiveAt` always present (KeepNull); `invitedAt`/`inviteExpiresAt` only for `pending` with an unused invite | schemas.py:20-32; service.py:203-217 | users-read, pending (disabled row has no `invitedAt`) | pass |
| Soft-deleted users absent | service.py:242 | delete | pass |

## GET /api/users/{id}/memberships (#39), /activity (#40) — router.py:73-82, service.py:249-278

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Unknown or soft-deleted user → 404 `resource:"user"` | service.py:92-96,249-252 | users-read, delete | pass |
| Memberships: non-deleted projects, `role` = the user's current SYSTEM role | service.py:255-260 | users-read (invitee `[]`, admin rows role admin) | pass |
| Activity by `actor_id`, newest first, ≤ 200; `id` decimal string; kinds `user.invite` / `user.role_change` / `user.disable` / `user.enable` / `user.delete` with objectCode = target id, label = email | service.py:263-278,188-197; access/kinds.py:36-41 | users-read, role, state, delete | pass |

## POST /api/users/invitations (#44) — router.py:55-62, service.py:390-418, schemas.py:84-94

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| 201 `AdminUser[]` in input order; dedupe by `normalize_email` (upper-case copy dropped); pending, role, invite window | service.py:399-418 | every test via `batch()` (setup exchange `A08_setup_invite_batch.json`) | pass |
| Invite mail sent after commit (Mailpit, subject "Lời mời tham gia AppBack") with a working token | service.py:384; auth_recovery/tokens.py | `claim()` reads it for 7 users; 4 accepted | pass |
| Address of an `active`/`disabled` user → 422 `USER_EMAIL_TAKEN` `field:"emails"`; whole batch rolled back, no mail | service.py:123-126,399-403 | invite (fresh address not listed, no mail) | pass |
| Malformed email → 422 `VALIDATION` `field:"emails"` (list-level validator, K37) | schemas.py:90-94; auth/emails.py:31-42 | invite | pass |
| `[]` → 422; > 50 (before dedupe) → 422 `field:"emails"`; bad role → 422 | schemas.py:87-88; service.py:117-120 | — | covered (`test_invite.py` `__C02`, `__C03`, `default_batch_cap_is_50`, `batch_cap_counts_before_dedupe`); not sent: each costs the hourly invite budget |
| Re-invite a pending user (role change bumps ver, new token) | service.py:374-387 | — | covered (`test_invite.py` `lost_race_reuses_pending`, `__C01`) |
| 429 `RATE_LIMITED` + `Retry-After` past 30 / h | router.py:32-43 | — | unpairable (see Shared rules) |

## PATCH /api/users/{id}/role (#41) — router.py:85-92, service.py:284-294

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| `role` ∉ admin/engineer/viewer → 422 `field:"role"`; `userId` missing → 422 `field:"userId"`; unknown key → 422 | schemas.py:16,64-68 | role | pass |
| Body `userId` ≠ path → 422 `PATH_BODY_MISMATCH` `field:"userId"` (W21) | core/routing.py:138-151 | role | pass |
| Unknown target → 404 `user` | service.py:181-185 | role | pass |
| Change → 200 new role, `bump_token_version` (old access token → 401 `SESSION_REVOKED` within the 5 s principal cache), one `user.role_change` row | service.py:290-294; auth/sessions.py:605-621; auth/settings.py:35 | role, matrix (setup) | pass |
| Same role → 200, nothing written | service.py:290 | role (exactly one activity row) | pass |
| Self → 422 `USER_LAST_ADMIN` (sole admin) / `USER_SELF_MODIFICATION` before any write | service.py:148-156,288-289 | self (2+ active admins in run-32 → `USER_SELF_MODIFICATION`; sent with role `admin`, a no-op) | pass |
| Last-admin demotion of another admin; actor demoted in DB → 403 | service.py:162-167 | — | covered (`test_state.py` `last_admin_is_rejected`, `actor_demoted_in_db_is_forbidden`); not sent (needs a second real admin) |

## POST /api/users/{id}/disable (#42), /enable (#43) — router.py:95-108, service.py:297-320

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| `EmptyBody`: any key → 422 field = key; `userId` ≠ path → 422 `PATH_BODY_MISMATCH` (guard before Pydantic) | schemas.py:60-61; core/routing.py:138-151 | state | pass |
| Unknown target → 404 `user` | service.py:181-185 | state | pass |
| Disable → 200 `disabled`; sessions revoked + ver bumped (Bearer → 401 `SESSION_REVOKED`), pending tokens revoked, one `user.disable` row; again → 200 no-op | service.py:297-309 | state, pending | pass |
| Pending invitee's mailed token after disable → accept 422 `INVITATION_TOKEN_INVALID` | service.py:307; auth_recovery/router.py:338-355 | pending | pass |
| Enable: disabled + password → `active`; without password → `pending`; not disabled → 200 no-op; revoked session stays revoked | service.py:312-320 | state (active), pending (pending) | pass |
| Self disable → 422 | service.py:302 | — | covered (`test_state.py` `disable_user_twice_and_self`); not sent: a broken guard would disable the shared admin |

## DELETE /api/users/{id} (#46) — router.py:111-123, service.py:441-460

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| No body → 422 `VALIDATION`; `confirmEmail` not an email → 422 `field:"confirmEmail"`; `userId` ≠ path → 422 `PATH_BODY_MISMATCH` | schemas.py:71-81; core/routing.py:138-151 | delete | pass |
| `confirmEmail` ≠ target (after `normalize_email`) → 422 `USER_CONFIRM_EMAIL_MISMATCH` `field:"confirmEmail"` | service.py:111-114 | delete (other address; upper-case address accepted) | pass |
| Success → 200 AdminUser built BEFORE the soft delete; then absent from #38, #39/#40 404, second delete 404, one `user.delete` row | service.py:441-460 | delete | pass |
| Memberships removed, orphan log after commit; email freed for re-invite | service.py:457-459 | — | covered (`test_delete.py` `removes_memberships_and_logs_orphans`, `disappears_from_list_and_frees_email`) |
| Self / last admin → 422 | service.py:450 | — | covered (`test_delete.py` `self_is_rejected`, `last_admin_is_rejected`); not sent (shared admin) |

## Mock pairing

`grep "mocked response\|page.route"` over `tests/phase08_*.spec.ts` (main `phase08_admin.spec.ts`, ui
`phase08_admin_ui.spec.ts`, api): **0 mocked tests**. Nothing to pair; mocked share 0 %.

| UI test `[mocked response]` | Endpoint / faked response | Pair |
|---|---|---|
| — (none in phase 8) | — | — |

## Findings

None from the API layer in `run-32-author` (15 / 15 passed). Observation only: the BE serves `GET /api/library` to
every signed-in role (library/router.py:1-4) while the FE gates the SCR-34 screen by `library.manage` (plan Phase 9) —
by design, not a bug.

## Not reachable on the current stack (env)

No training job, no dataset, no non-onnx / un-evaluated opening model version in run-32: the conditional branches in
"reg-write", "jobs-read", "job-create", "datasets" annotate `environment:` and stay asserted by the BE pytest named
above. They run automatically once such data exists (CP-8 / a dataset build).
