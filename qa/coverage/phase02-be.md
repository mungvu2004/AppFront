<!-- qa-sources be=e2fc4d42 -->
# Phase 02 — Backend coverage (projects, notifications, auth refresh)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`) @ `e2fc4d42` (= `git rev-parse --short HEAD`,
2026-10-11). Every `file:line` is in that tree, `apps/api/...` unless it starts with `packages/` or `deploy/`.
API spec: `qa/tests/phase02_dashboard_api.spec.ts` — **26 tests**, all 26 passed in `run-12`
(`F:/App/qa-results/run-12/phase02-api/results.json`: 26 expected, 0 unexpected; run-11 had run the first 11). UI specs of
the phase: `phase02_dashboard.spec.ts`, `phase02_dashboard_ui.spec.ts`, `phase02_dashboard_edge.spec.ts`,
`phase02_wizard_edge.spec.ts`, `phase02_notify_edge.spec.ts`.
Endpoints called by the phase's screens (FE `src/api/endpoints.ts:186-213`, `src/api/client.ts:1123-1216`):
the nine of pass 1 + `POST /api/notifications/{id}/accept-invite` (#22, SCR-06 inline "chấp nhận",
`notificationCenterGateway.ts`). `GET /api/projects/:id` (#24), `GET /api/users/{id}/activity` (#40), N3/N4 member
add/remove and `DELETE /api/floors/{id}` (#11) are used only as read-back or setup.

Status words: **pass** (asserted by a test that passed in run-11) · **new** (asserted by a pass-2 test; all passed in run-12) · **covered** (another spec asserts it) · **partial** · **not covered** (reason given) · **unpairable**.

Test names below are shortened. Pass 1 (ran): "anon", "create", "rules", "idem", "rename", "patch-rules",
"delete", "N1", "roles", "notif", "notif-bodies". Pass 2 (new): "order", "text", "code-dup", "floors", "fields",
"idem-edges", "del-idem", "body-limit", "origin", "headers", "rollup", "members", "accept", "fresh", "activity".

Rows: 107 rule rows + 8 side-effect rows + 24 mock-pair rows + 6 budget rows = 145 (pass 1: 88). Open gaps: 9
(pass 1: 12) — list at the end.

## Shared rules (every phase-2 route)

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Protected route: no `Authorization: Bearer …` → 401 `UNAUTHENTICATED` before the body is read (W10) | core/routing.py:5-8,129-135,255-264 | anon: 9 routes + malformed body still 401; accept: #22 anonymous | pass / new (#22) |
| Non-Bearer scheme → 401 `UNAUTHENTICATED` | core/routing.py:131-133 | anon: "Basic" on GET /projects, /notifications | pass |
| Forged access token → 401 `UNAUTHENTICATED` (revoked session → `SESSION_REVOKED`) | auth/verifier.py:6-8,27-28 | anon: forged Bearer; revoked branch: Phase 1 | pass (forged) / covered (revoked, phase01_auth_api) |
| Refresh cookie alone (what a browser attaches) is not a credential on protected routes → 401 | core/routing.py:129-135 | origin: cookie-only GET /projects, POST, PATCH → 401, nothing changed | new |
| Error body W7 `{code, requestId}` + params `field` / `resource` / `count` | core/errors.py:80-85; packages/core/errors.py:48,60-68 | every negative test (`expectError`) | pass |
| Pydantic error → 422 `VALIDATION`, `field` = camelCase loc of the first error (`floors.0.heightMm`), `count` | core/errors.py:136-157,169-182 | rules, patch-rules, N1, notif-bodies, floors, fields | pass / new (`count` not asserted) |
| Root-level type error (`[]` body) → 422 `VALIDATION` without `field` | core/errors.py:157,176-178 | headers | new |
| Strict bodies (`extra="forbid"`) → 422 field = the extra key | core/wire.py:46 | rules, patch-rules, notif-bodies (`foo`); floors (`floors.0.foo`); fields/accept (`projectId` / `notificationId` equal to the path) | pass / new |
| Invalid JSON → 400 `MALFORMED_JSON` (with a valid Bearer) | core/errors.py:172-173 | headers (truncated JSON) | new |
| Body > 1 MiB → 413 `PAYLOAD_TOO_LARGE` before auth; exactly 1 MiB passes the ceiling | core/routing.py:46,64; core/middleware.py:217-237; core/errors.py:102-104; nginx 8m deploy/nginx/snippets/app_locations.conf:3 | body-limit: 1 048 576 → 401 (anon), 1 048 577 → 413, on #25 and #20 | new |
| Security headers `nosniff` / `DENY` / `same-origin` + `Cache-Control: no-store` on every response (200/201/400/401/413/422) | core/middleware.py:48-53,178-199 | headers, body-limit | new |
| No ETag / conditional requests: `If-Match` / `If-None-Match` ignored, last-write-wins | projects/router.py:75; no `ETag`/`If-Match` in apps/ or packages/ (grep) | headers | new |
| No rate limit on projects / notifications routes, no rate-limit headers on success (`Retry-After` only on 429) | grep `rate_limit(`; core/ratelimit.py:31,92-94 | headers (no `*ratelimit*` / `retry-after` header), budget | new |
| `Origin` checked only on cookie routes (`/api/auth/*`); Bearer writes accept no / foreign Origin | core/origin.py:1-10,53-61 | origin: POST 201 without Origin, PATCH/DELETE/#20 with a foreign Origin 200/204 | new |
| Write route + `Idempotency-Key`: claim, replay, reuse → 422, bad key → 422 field `idempotencyKey`; 401/408/429/5xx not stored | core/routing.py:166-187,227-236,333-371; core/idempotency.py:47-53,79-83,198-239; packages/db/models/idempotency.py:35 | idem (POST), idem-edges, del-idem | pass / new (in-progress 503 not covered: needs two concurrent requests) |
| Key pattern `^[A-Za-z0-9_-]{8,128}$`: 7 / 129 / "." → 422, 8 / 128 → accepted | packages/db/models/idempotency.py:35; core/idempotency.py:79-83 | idem-edges | new |
| A raised 4xx (e.g. 422 VALIDATION) discards the claim → same key + fixed body runs | core/routing.py:3-14,276-278,333-351; core/idempotency.py:265-280 | idem-edges | new |
| Claim scope = (user, method, route template, key): the POST key on PATCH is a new claim; digest = method + real path + query + body → same key on another project → 422 `IDEMPOTENCY_KEY_REUSED` | core/idempotency.py:86-101,130-172,225-231 | idem-edges (PATCH), del-idem (DELETE) | new |
| Guard runs after the route's permission dependencies → a DELETE replay on a deleted project is 404, never the stored 200 | core/routing.py:9-12,233-236; projects/access.py:62-72,82-83 | del-idem | new (contract note: FE treats delete-404 as done, edge spec "project deleted elsewhere") |
| Path-body guard W21: body key = camelCase path param with another value → 422 `PATH_BODY_MISMATCH` field | core/routing.py:138-151,249-250 | patch-rules (`projectId`), accept (`notificationId`) | pass / new |

## POST /api/projects (#25) — projects/router.py:54-63, service.py:238-260

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| `project.create` (system key): admin, engineer yes; viewer → 403 `FORBIDDEN` (no `resource`) | access/deps.py:30-45,65-74; packages/domain/permissions/matrix.py:50,59 | roles: viewer 403, engineer 201; fresh: engineer's first project; ui main "create CP-2" | pass / new |
| `name` required, trim → NFC → Cc/bidi (incl. LRM/RLM) rejected → 3..80 chars | projects/schemas.py:25-26,31-39,49-51,87-91; packages/core/text.py:6-9,22-46 | rules: missing, "  ab  ", 81, number, U+0007, U+202E, U+200E; create: padded NFD → NFC; text: tab, newline, U+2067 → `name` | pass / new |
| Length counted in code points AFTER NFC: 80 NFD "é" (> 80 raw code points) accepted; 80 astral emoji (> 80 UTF-16 units) accepted, 81 refused | projects/schemas.py:31-39,49-53 | text | new (FE note: a JS `.length` cap would refuse the emoji name the BE accepts) |
| Other format chars (U+200B), inner double spaces and letter case kept as sent | packages/core/text.py:6-9,28-31 (only U+202A-202E, U+2066-2069, U+200E/F + Cc blocked) | text | new |
| `code` optional 1..32 after trim; `address` optional 1..200; same Cc/bidi gate (RLO in code, LRM in address → 422); NBSP-only address → 422 (str.strip) | projects/schemas.py:27-28,52-53,72-73,123-131 | rules: code blank / 33, address 201, 32 / 200 accepted; text: RLO code, LRM address, NBSP-only address, NBSP edges trimmed | pass / new |
| `code` not unique (same code twice, case variant) | packages/db/models/projects.py:39-41 (plain Text, no index); service.py:243-244 | code-dup | new |
| Explicit `null` on name/code/address → 422 field (absent key = not sent) | projects/schemas.py:42-46,79-84 | rules: name null, code null; patch-rules: address null | pass |
| W18 keys accepted and ignored (`status`, `members`, `progress`, `currentVersion`) | projects/schemas.py:69-77 | — on create (asserted on PATCH, same base class `_ProjectWrite`) | partial |
| `floors[]` Pydantic: name CleanStr min 1 → `floors.<i>.name`; `order`/`elevationMm`/`heightMm` lax int (2500.5 → 422), missing key → `floors.<i>.<key>`, extra key → `floors.<i>.<key>`, not an array → `floors`; W18 `id`/`drawings`/`areaM2` accepted and ignored | projects/schemas.py:57-66 | rules: blank name; floors: 2500.5, missing heightMm, RLO name, `foo`, `"x"`, echoed id/drawings/areaM2 (server id, no areaM2) | pass / new |
| Hook `project.create_floors`: > 50 floors → `floors`; order 0..999, elevationMm −30000..300000, heightMm 2000..10000, name 1..120 → `floors.<i>.<key>`; errors carry the floor index | floors/view_parts.py:37-55,58-83; floors/schemas.py:16-47; floors/settings.py:18 | rules: 51 floors, heightMm 1999, order 1000, both range ends accepted; floors: order −1, elevation −30001 / 300001, heightMm 10001, name 121 / 120, 2nd floor → `floors.1.heightMm`, exactly 50 accepted | pass / new |
| Duplicate floor orders accepted (no unique (project, order)); `floors: []` skips the hook → 0 floors, `draft` | packages/db/models/floors.py:37-56; projects/service.py:233-235 | floors | new |
| Hook error → whole #25 rolled back (project row, membership, activity) | service.py:9-11,219-235; core/routing.py:14-16,333-350 | rules, floors: no rejected name in GET /projects afterwards | pass / new |
| 201 `ProjectOut` strict keys; `code`/`address`/`areaM2`/`avatarUrl` absent when empty; no `currentVersion`/`progress`/`deletedAt` | projects/wire.py:1-15,38-49,65-88 | create (exact key set), every `expectProjectOut` | pass |
| Creator becomes the only member (`created_by` from the session, K05) | service.py:243-255 | create, N1, roles, fresh | pass |
| `status` = legacy rollup: floors, no upload, 0 walls → `draft` | summaries.py:182-197 | create, rollup | pass / new |
| No unique-name rule: same name twice → two 201, never 409 | service.py:243-244 | idem ("twin") | pass |
| Side effects: `activity_log` `project.create` (label = name), `touch_project` | service.py:257-258,335-347; access/kinds.py:27 | create, activity | pass / new |
| Idempotent replay (same key + body → stored 201, one project) | core/idempotency.py:225-234 | idem | pass |

## GET /api/projects (#23) — projects/router.py:42-45, service.py:71-77,159-171

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Bare array of `ProjectOut` of projects the caller is a member of, soft-deleted excluded | service.py:71-77,159-171 | create, delete, roles, fresh (`[]` for a user without project) | pass / new |
| Order `updated_at DESC, id DESC` | service.py:165-169 | order: C before B before A; a rename puts A first; `updatedAt` non-increasing over the whole list (the `id DESC` tie-break is not observable: wire instants are ms-truncated, packages/core/instants.py:15-21) | new |
| Cap `PROJECTS_LIST_MAX` 500 | projects/settings.py:22 | order: length ≤ 500 | partial (the cut itself needs > 500 projects) |

## GET /api/projects/:id (#24, read-back only) — projects/router.py:48-51

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Any member reads → 200 | access.py:45-75 | create, roles, accept (member after accept-invite) | pass / new |
| Path not `prj_<ULID>` → 404 `NOT_FOUND` resource `project` without a query | access.py:28-33 | patch-rules ("malformed") | pass |
| Unknown / soft-deleted / not a member (also the system admin) → 404 resource `project` (K08) | access.py:3-6,62-72,82-83 | patch-rules, delete, roles; members: removed member → 404 | pass / new |

## PATCH /api/projects/:id (#26) — projects/router.py:66-76, service.py:263-309

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| `project.settings.edit` in the project: member admin/engineer 200; viewer member → 403 `FORBIDDEN`; non-member → 404 | access.py:78-86; matrix.py:51 | roles | pass |
| Body rules: name 3..80 (null → 422), code/address (null / blank → 422), extra key → 422 | projects/schemas.py:69-98 | patch-rules; fields: name 81, code 33, address 201, address blank | pass / new |
| Each field alone: name / code / address change only that field; 80 / 32 / 200 accepted together | service.py:56,263-287 | fields | new |
| Case-sensitive compare: changing only the letter case is a write; padded same name trims to the current one → no write | service.py:263-269; schemas.py:31-39 | fields (`-case` → `-CASE` 2 writes; padded → `updatedAt` kept) | new |
| `{}` → 200 unchanged | service.py:299-309 | rename (no-op "empty") | pass |
| Same values → 200, no UPDATE, no activity, `updatedAt` not pushed | service.py:263-269,307-309 | rename, fields | pass / new |
| W18 echo (`status`, `members`, `floors`, `progress`, `currentVersion`) accepted and ignored | projects/schemas.py:69-77,94-98 | rename (no-op "w18_echo") | pass |
| `projectId` in the body: ≠ path → 422 `PATH_BODY_MISMATCH`; = path → 422 `VALIDATION` field `projectId` (not a field of `ProjectUpdateIn`) | core/routing.py:138-151; projects/schemas.py:94-98; core/wire.py:46 | patch-rules, fields | pass / new |
| Changed fields written; `touch_project`; activity `project.update` labelled with the new name | service.py:272-287 | rename, fields, activity; ui main "rename + undo" | pass / new |
| `If-Match` not supported (last-write-wins) | router.py:75 | headers | new |
| Idempotent replay of a PATCH → stored 200, handler not run (one activity row) | core/idempotency.py:225-234 | idem-edges | new |
| Soft-deleted between gate and write → 404 | service.py:60-68,276-284 | delete (PATCH after delete → 404 via the gate) | partial (the race itself is not producible) |
| `name` duplicate allowed (no 409) | service.py:243-244 | — (PATCH) | not covered: same rule as create ("twin"); `code` duplicates on PATCH: code-dup |
| No way to clear `code` / `address` once set (null → 422, "" → 422) | projects/schemas.py:42-46,144-145 | patch-rules (null), fields (blank) | new (contract note for the FE: there is no "remove code") |

## DELETE /api/projects/:id (#27) — projects/router.py:79-84, service.py:312-332

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Same gate as PATCH (`project.settings.edit`): viewer 403, non-member 404, engineer member 200 | router.py:79; access.py:78-86 | roles, fresh | pass / new |
| 200 body = `ProjectOut` built BEFORE `deleted_at` (equal to the live project) | service.py:315-321 | delete, del-idem | pass / new |
| Soft delete: then GET/PATCH/DELETE → 404, gone from #23 and N1 | service.py:322-330; access.py:62-72 | delete, fresh | pass / new |
| DELETE twice with the same `Idempotency-Key` → 404 (gate first), the key on another live project → 422 `IDEMPOTENCY_KEY_REUSED` | core/routing.py:9-12,233-236; core/idempotency.py:86-101 | del-idem | new |
| Memberships and floor counts kept for the purge job; purge after 30 d | projects/settings.py:23-25; projects/jobs.py | — | not covered: no read API for deleted rows; purge is a scheduled job |
| Notifications of a deleted project hidden from #19 | notifications/service.py:53-60 | notif | pass |
| Activity `project.delete` labelled with the name | service.py:331 | delete, activity, del-idem (exactly one row) | pass / new |
| Bearer write with a foreign / no Origin → 200 | core/origin.py:1-10 | origin | new |
| FE gate differs: delete offered only to `canEdit && admin` (plan G2, `ProjectDashboard.tsx`); BE lets an engineer member delete | — | roles (engineer DELETE 200) | contract note, not a BE bug |

## GET /api/project-summaries (N1) — projects/router.py:32,38,87-92, service.py:180-216

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| `limit` Query 1..500, default 50 → 0 / 501 / "abc" → 422 field `limit` | core/pagination.py:26,46-63; router.py:32,38 | N1 | pass |
| `CursorPage {items, nextCursor?}`; `nextCursor` only while rows remain | core/pagination.py:31-35; service.py:193-205 | N1; fresh (`{items: []}` exactly, one item without `nextCursor`) | pass / new |
| Order `id ASC`; next page `id > cursor position` | service.py:180-190 | N1 | pass |
| Garbage / tampered MAC cursor → 422 `CURSOR_INVALID` | core/pagination.py:96-113 | N1 | pass |
| Cursor bound to the caller (`filters={"user": sub}`): another user's cursor → 422 `CURSOR_INVALID` | service.py:180-190,208-216 | roles | pass |
| Only member projects, soft-deleted excluded; empty for a user without project | service.py:71-77 | create, delete, roles, members (removed member), fresh | pass / new |
| Item keys exact; `members[]` = `{id, name}` only (no email) | projects/wire.py:91-114 | create, N1, rollup | pass / new |
| Rollup: no floor → 0 floors, `areaM2` 0, `processing`, NO `defaultFloorId` key | summaries.py:32-40 | N1; rollup (after every floor is deleted) | pass / new |
| Rollup with floors and nothing uploaded → `processing`, `floorCount` = live floors, `defaultFloorId` = lowest `floor_order` | summaries.py:182-197,200-251 | create (4 floors); rollup (orders 5/2/9 → order 2; delete it → order 5; → order 9) | pass / new |
| Hidden (deleted) floors leave the rollup; floor delete pushes `updatedAt` (= #24 `updatedAt`) | summaries.py:96-98,229; floors/service.py:173-184 | rollup | new |
| `status` `qc` / `done`, legacy `approved` / `error` / `processing`, `areaM2` > 0, walls counts | summaries.py:133-156,182-197 | — | not covered: needs an upload + pipeline (Phase 3, CP-5) |
| `updatedAt` = project `updated_at` | wire.py:159-176 | create, N1, rollup | pass / new |

## GET /api/notifications (#19) — notifications/router.py:25-29, service.py:162-170

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Only the caller's rows (`user_id` in the WHERE) | service.py:162-170 | notif; fresh (`[]`) | pass / new |
| Hidden unless project live AND caller still a member | service.py:53-60 | notif (project deleted); members (N4 → `[]`, re-add → the row is back) | pass / new |
| Newest first (`created_at DESC, id DESC`) | service.py:166-168 | notif (p2 row before p1 row) | pass |
| Cap `NOTIFICATIONS_LIST_MAX` 200 | notifications/settings.py:17 | — | not covered: needs > 200 visible rows = > 200 member adds (members_add 60 / h) |
| `NotificationOut` keys; `floorId` / `excerpt` absent when empty; no `userId` / `dedupeKey` / `streamId` | notifications/schemas.py:18-31; payload.py:11-28 | notif, members, accept, `inbox()` key check on every call | pass / new |
| `projectInvite` row from N3: place `projectSettings`, message "<name> đã thêm bạn vào dự án" | invite_sinks.py:20-50; messages.py:17-27; packages/db/models/notifications.py:31 | notif | pass |
| `projectName` / `objectLabel` = `clean_label(project name)`: Cc/Cf dropped, whitespace collapsed (so it can differ from the project's own name) | messages.py:13-21; service.py:134-136 | members (`"<base>  a\u200Bb"` → `"<base> ab"`) | new (contract note: the drawer may show a name the dashboard does not) |
| N3 on an existing member → 200, no row, no activity, no touch | project_members/router.py:68-69, service.py:79-94 | members | new |
| Dedupe per (project, user, UTC hour): add → remove → add in one hour → no new row, the old row (read state kept) is back | invite_sinks.py:33,48; service.py:105-159 | members (if the UTC hour flips mid-test, 2 rows are expected and annotated) | new |
| `aiCompleted` / `violationFound` rows | apps/worker/pipeline_persist/service.py:164 | — | not covered here: produced by the pipeline (Phase 3) |
| UI: drawer, filter, mark-read + undo | — | ui main SCR-06 (real data, skips when the admin has no unread row) | covered (ui) |

## POST /api/notifications/read (#20) — notifications/router.py:32-37, service.py:173-179

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| `ids` required, array of 1..200 strings of 1..64 → any violation → 422 field `ids` | notifications/schemas.py:15,34-53; settings.py:9,18 | notif-bodies | pass |
| Extra key → 422 field = key | core/wire.py:46 | notif-bodies (`foo`) | pass |
| 204 empty body; marks only the caller's unread rows; unknown / foreign ids ignored | router.py:32-37; service.py:173-179 | notif, notif-bodies, origin (foreign Origin, unknown id) | pass / new |
| Idempotent (already read → 204) | service.py:177 | notif (second mark) | pass |
| Body > 1 MiB → 413 | core/middleware.py:217-237 | body-limit | new |
| UI: "Hoàn tác" within 8 s sends NO request | FE `NotificationCenter` | ui main "mark-read + undo" | covered (ui) |

## POST /api/notifications/read-all (#21) — notifications/router.py:40-45, service.py:182-188

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Body exactly `{}` (FE `postWithoutBody(…, {})`, client.ts:1140); extra key → 422 field | notifications/schemas.py:56-57 | notif-bodies (`foo`) | pass |
| 204; every unread row of the caller → read (also hidden rows) | service.py:182-188 | notif (invitee: both rows read) | pass (hidden-row part not observable: #19 hides them) |
| Never sent as the admin | — | design rule of this suite (the admin inbox is shared with the UI test) | n/a |

## POST /api/notifications/{id}/accept-invite (#22) — notifications/router.py:48-54, service.py:191-210

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Own visible `projectInvite` → 200 `NotificationOut`, `isRead` true; membership / role unchanged | service.py:191-210 | accept | new |
| Idempotent: second call → 200, same body | service.py:206-210 | accept | new |
| Malformed id / unknown id / another user's id / hidden row (member removed) → 404 resource `notification` | service.py:196-203,53-60 | accept (admin on the invitee's id = 404, no change) | new |
| Body `{}` strict: `notificationId` ≠ path → 422 `PATH_BODY_MISMATCH`; = path → 422 `VALIDATION` field `notificationId` | notifications/schemas.py:56-57; core/routing.py:138-151 | accept | new |
| Not a `projectInvite` → 422 `NOTIFICATION_NOT_INVITE` | notifications/errors.py:5; service.py:204-205 | — | not covered: needs an `aiCompleted` / `violationFound` row = pipeline (Phase 3) |
| UI inline "chấp nhận" | `notificationCenterGateway.ts` | — (FE inventory N18 gap: needs a second user) | not covered (ui) |

## POST /api/auth/refresh — auth/router.py:236-282 (rules owned by Phase 1)

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| W16 body `{accessToken, expiresAt, roles, user}`; `roles` = the system role; `user.id` (read by SCR-07 onboarding for the seen-flag key) | auth/router.py:82-96 | notif / roles / members / accept / fresh setup: `roles` = ["viewer"] / ["engineer"], `user.id` = invited id; ui main SCR-07 reads `user.id` | pass / new |
| Cookie, rotation, grace, reuse, revoke, failure limits | auth/router.py:236-282; auth/sessions.py | phase01_auth_api.spec.ts (see `phase01-be.md`) | covered (Phase 1) |

## Side effects read back

| Effect | Read through | Test |
|---|---|---|
| Project row + membership | #24, #23, N1 | create, rules, floors (rollback), delete, roles, members, fresh |
| `activity_log` `project.create` / `project.update` / `project.delete` (no row for a no-op PATCH or a replay) | `GET /api/users/{adminId}/activity` (users/router.py:78-81, service.py:263-278) | create, rename, delete, fields, idem-edges, del-idem, activity |
| Activity row shape: exactly `{id, at, kind, objectCode, objectLabel}`, `id` decimal string, `at DESC, id DESC`, cap 200 | users/schemas.py:50-57; users/service.py:74,263-278 | every `activityOf` call (key check); activity (decimal id, order) |
| `member.add` / `member.remove` rows (objectCode = user id, label = email; the invitation also logs `user.invite` with the same objectCode) | project_members/service.py:81-89,121-129; users/service.py:188-197,386 | members |
| Notification row on N3 member add (one per project/user/UTC hour) | #19 as the invitee | notif, members, accept |
| `projects.updated_at` (touch) | `updatedAt` on #24 / N1 | rename, fields, order, rollup (floor delete), members (N3 new pushes, N3 existing does not) |
| Floor rows + `project_floor_summaries` rows (incl. hidden after #11) | #24 `floors`, N1 `floorCount` / `defaultFloorId` | create, rules, floors, rollup |
| Redis XADD of the notification after commit | — | not covered: SSE stream is outside this phase's endpoints (UNKNOWN - NEED VERIFICATION through `/api/streams/notifications`) |

## Mock pairing (UI `[mocked response]` tests of phase 2)

BUG-144 fix: pass 1 said "none". Grep of `[mocked response]` in `qa/tests/phase02_*.spec.ts` on 2026-10-11 finds
24 tests in four specs (dashboard_edge 15, dashboard_ui 5, wizard_edge 3, notify_edge 1) (lines as read that day; they shift while other agents edit). Every row names the API test
that proves the real response, or why none can.

<!-- mock-pairs:start -->
| UI test (spec:line) | Endpoint → faked response | Pairing |
|---|---|---|
| `phase02_dashboard_ui.spec.ts:487` U02 SCR-05 "no project" (dash_empty) | `GET /api/project-summaries` → 200 `{items: []}` | paired: "A02 · fresh engineer: N1 → exactly {items: []} …" — evidence `A02_fresh_summaries_default.json`, `A02_fresh_summaries_limit_1.json`, `A02_fresh_projects.json` (also `A02_fresh_summaries_empty_again.json`): a fresh invited engineer's N1 is exactly `{"items": []}`, `GET /api/projects` = `[]`, `GET /api/notifications` = `[]`; empty again after its only project is deleted |
| `phase02_dashboard_ui.spec.ts:840` U02 SCR-07 "no project" (onboarding_no_project) | `GET /api/project-summaries` → 200 `{items: []}` | paired: "A02 · fresh engineer: N1 → exactly {items: []} …" — evidence `A02_fresh_summaries_default.json`, `A02_fresh_summaries_limit_1.json`, `A02_fresh_projects.json` (also `A02_fresh_summaries_empty_again.json`) |
| `phase02_dashboard_edge.spec.ts:1031` E02 SCR-05 "no project" | `GET /api/project-summaries` → 200 `{items: []}` | paired: "A02 · fresh engineer: N1 → exactly {items: []} …" — evidence `A02_fresh_summaries_default.json`, `A02_fresh_summaries_limit_1.json`, `A02_fresh_projects.json` (also `A02_fresh_summaries_empty_again.json`) |
| `phase02_dashboard_ui.spec.ts:472` U02 SCR-05 "N1 fails (500)" (dash_load_error) | `GET /api/project-summaries` → 500 | unpairable: 5xx — no safe way to make the shared stack fail; real 200 proven by "N1" |
| `phase02_dashboard_ui.spec.ts:502` U02 SCR-05 "one unreadable row" (dash_partial) | `GET /api/project-summaries` → real page + 1 undecodable row | unpairable: the BE never emits it — ids come from `new_id("prj")` (projects/service.py:247), `ProjectSummaryOut` is strict (wire.py:98-114); readable rows = real page ("N1", "create" assert exact keys) |
| `phase02_dashboard_ui.spec.ts:775` U02 SCR-06 "list read fails (500)" (notif_load_error) | `GET /api/notifications` → 500 | unpairable: 5xx; real list proven by "notif", "members" |
| `phase02_dashboard_edge.spec.ts:1011` E02 SCR-05 "N1 fails (500)" | `GET /api/project-summaries` → 500 `{}` | unpairable: 5xx; real 200 proven by "N1" |
| `phase02_dashboard_edge.spec.ts:1050` E02 SCR-05 "one row the client cannot decode" | `GET /api/project-summaries` → real page + row `id: "not-a-project-id"` | unpairable: BE never emits it (see dash_partial) |
| `phase02_dashboard_edge.spec.ts:1127` E02 SCR-05 "rename answered 500" | `PATCH /api/projects/:id` → 500 | unpairable: 5xx; real 200 proven by "rename", "fields" |
| `phase02_dashboard_edge.spec.ts:1157` E02 SCR-05 "rename refused 403 FORBIDDEN" | `PATCH /api/projects/:id` → 403 `FORBIDDEN` | paired: "A02 · role/owner matrix …" — evidence `A02_role_viewer_member_patch_403.json`: viewer member PATCH → 403 `FORBIDDEN` without `resource` (access.py:84-85) |
| `phase02_dashboard_edge.spec.ts:1180` E02 SCR-05 "delete refused 403 FORBIDDEN" | `DELETE /api/projects/:id` → 403 `FORBIDDEN` | paired: "A02 · role/owner matrix …" — evidence `A02_role_viewer_member_delete_403.json`: viewer member DELETE → 403 `FORBIDDEN` |
| `phase02_dashboard_edge.spec.ts:1209` E02 SCR-05 "delete answered 500" | `DELETE /api/projects/:id` → 500 | unpairable: 5xx; real 200 / 404-after proven by "delete", "del-idem" |
| `phase02_dashboard_edge.spec.ts:1343` E02 SCR-05 "status routing" (`qc` / `done` rows) | `GET /api/project-summaries` → real page with two rows rewritten to `qc` / `done` + wall counts | unpairable until CP-5 (Phase 3/4 data): `qc` / `done` need an upload + pipeline (summaries.py:182-197); the rollup rules producible without the pipeline are proven by "rollup", "N1" |
| `phase02_dashboard_edge.spec.ts:1605` E02 SCR-05 "offline while the list loads" | `GET /api/project-summaries` → aborted | unpairable: network loss |
| `phase02_dashboard_edge.spec.ts:1633` E02 SCR-05 "N1 held then 500" | `GET /api/project-summaries` → held, then 500 | unpairable: 5xx |
| `phase02_dashboard_edge.spec.ts:1681` E02 SCR-05 "N1 over two cursor pages" | `GET /api/project-summaries` → page 1 with `nextCursor`, page 2 | paired: "A02 · N1: limit 1..500 …, id ASC cursor paging, …" — evidence `A02_summaries_page1.json`, `A02_summaries_page2.json`: real `limit=1` page carries `nextCursor`, page 2 read with it is the next `id` ASC, the last page has no `nextCursor` (service.py:180-205) |
| `phase02_dashboard_edge.spec.ts:1725` E02 SCR-05 "N1 page 2 answers 422 CURSOR_INVALID" | `GET /api/project-summaries?cursor=…` → 422 `CURSOR_INVALID` | paired: "A02 · N1: … forged cursor → 422 CURSOR_INVALID …" — evidence `A02_summaries_422_cursor_garbage.json`, `A02_summaries_422_cursor_bad_mac.json`; also "role/owner matrix" `A02_role_engineer_foreign_cursor_422.json` (another user's cursor) |
| `phase02_dashboard_edge.spec.ts:2267` E02 wizard "network lost on create" | `POST /api/projects` → aborted | unpairable: network loss; real 201 proven by "create" |
| `phase02_dashboard_edge.spec.ts:2523` E02 SCR-06 "list read held then 500" | `GET /api/notifications` → held, then 500 | unpairable: 5xx |
| `phase02_dashboard_edge.spec.ts:2669` E02 SCR-07 "N1 held then 500" | `GET /api/project-summaries` → held, then 500 | unpairable: 5xx |
| `phase02_notify_edge.spec.ts:604` E02 SCR-06 "POST /read fails (500) after the undo window" | `POST /api/notifications/read` → 500 `INTERNAL` | unpairable: 5xx; real 204 proven by "notif", "notif-bodies" |
| `phase02_wizard_edge.spec.ts:1177` E02 wizard "create 500" | `POST /api/projects` → 500 | unpairable: 5xx; real 201 proven by "create" |
| `phase02_wizard_edge.spec.ts:1199` E02 wizard "create 503 once, retried with the SAME Idempotency-Key" | `POST /api/projects` → 503 on the 1st attempt, then real | unpairable: 5xx; the real side of the retry (same key + same body → one project; 5xx is never stored, idempotency.py:53,237-239) is proven by "idem" (replay → one project) and "idem-edges" (a failed run does not burn the key) |
| `phase02_wizard_edge.spec.ts:1223` E02 wizard "network abort on the first create attempt" | `POST /api/projects` → aborted once, then real | unpairable: network loss; retry semantics as above ("idem", "idem-edges") |
<!-- mock-pairs:end -->

Re-check needed: other agents are still adding `[mocked response]` tests to `phase02_*_edge.spec.ts`. After they
land, grep `\[mocked response\]` in `qa/tests/phase02_*` and add one row per new test (paired API test or
"unpairable: <reason>"); line numbers above will shift.

`[held response]` tests deliver the real response, only delayed: no pair needed.

## Gaps

Closed in pass 2 (9): #23 order (cap only bounded, see row), payload 413, member-removed visibility, dedupe,
idempotency edge cases (key format, discarded claim, scope, PATCH replay, DELETE twice), malformed JSON on a protected
route, PATCH duplicate code, mock-pairing table (BUG-144), activity row shape.

Still open (9), each with its reason in the rows above:
1. #23 cap 500 cut (needs > 500 projects).
2. N1 `qc` / `done` and legacy `approved` / `error` / `processing`, `areaM2` > 0, wall counts (need upload + pipeline, Phase 3).
3. #19 cap 200 (needs > 200 notifications; members_add allows 60 / h).
4. `aiCompleted` / `violationFound` rows and #22 `NOTIFICATION_NOT_INVITE` (pipeline, Phase 3).
5. Idempotency in-progress 503 (needs two concurrent requests with one key).
6. Soft-delete race between gate and write (#26 / #27).
7. Purge job of deleted projects (scheduled, no read API).
8. Redis XADD / SSE publish (outside this phase's endpoints).
9. W18 echo on create (asserted on PATCH only).

Observations for the review step (not asserted as bugs; each is the BE behaving as its source says):
- A project name with U+200B or double spaces reaches the notification drawer cleaned (`clean_label`) while the
  dashboard shows it raw (members test).
- Project names allow other Cf characters (U+200B, U+061C, U+FEFF…) — only the listed bidi controls are blocked
  (packages/core/text.py:6-9), whereas notification labels strip every Cf.
- The BE counts code points; 80 astral characters are 80 for the BE but 160 for a JS `.length` check.
- A DELETE retried with its Idempotency-Key gets 404, not the stored 200 (gate before the guard).

## Rate-limit budget (one run)

| Bucket | Limit (BE) | API spec | UI layer of phase 02 | Sum / note |
|---|---|---|---|---|
| `auth_login_ip` (per IP) | 30 / 60 s (auth/settings.py:36-37; override 120) | 24 (one admin login per test except "anon" and "body-limit"; "origin" logs in by hand) over ~3 min → ≤ ~10 per 60 s | main 1 + ui 1 + dashboard_edge 1 + wizard_edge ≤ 11 + notify_edge 19 (each ≤ 7 / min per its header) | layers run sequentially, never one window; 0 failed admin attempts |
| `users_invite` (per admin) | 30 / 3600 s (users/router.py:32-43) | 6 (roles 2, notif 1, members 1, accept 1, fresh 1) | notify_edge ≤ 6 | Phase 1 8 + 6 + 6 = 20 ≤ 30 |
| `recovery_ip` (per IP) | 10 / 900 s (auth_recovery/settings.py:24-25; override 60) | 6 (invitation accepts) | notify_edge ≤ 6 (its header still assumes this spec spends 3) | 12 > 10 in one window → needs the override (already mandatory for Phase 1's 32); with Phase 1 in the window 44 ≤ 60 |
| `members_add` (per actor) | 60 / 3600 s (project_members/router.py:26-33, settings.py:14-15) | 7 (roles 1, notif 2, members 3 incl. the 200 re-add, accept 1) | notify_edge 13 | 20 ≤ 60 |
| `auth_refresh_total` (per session) | 300 / 60 s (auth/settings.py:45-46) | 1 per new session (24 admin + 6 invitees) | per page load on their own sessions | separate sessions |
| projects / notifications / floor-delete routes, 413 | none | every project it creates is deleted in `finally` | wizard_edge 7 creates + 3 refused 422, 8 DELETEs; notify_edge 13; dashboard_edge ~15 | — |
