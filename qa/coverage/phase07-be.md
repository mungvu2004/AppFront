<!-- qa-sources be=origin/main (0 commits behind) -->
# Phase 07 — Backend coverage (account: /api/me N11 / N12 / N14, session refresh W16)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`), HEAD `2ee030c5` = `origin/main` (0 commits behind, fetched
2026-10-12) = `versionCheck.apiBuiltCommit`. Every `file:line` is under `apps/api/` unless it starts with `packages/`.
API spec: `qa/tests/phase07_account_api.spec.ts` — **6 tests** (`--list`), evidence prefix `A07_` (72 JSON exchanges).
Author run `run-01-author` (`node tools/run-phase.mjs --phase 07 --run-id run-01-author --layers api --no-watch
--grep "A07 ·"`): **5 passed / 1 failed** (the failure is an APP bug, see "Findings"), evidence ok,
`F:/App/qa-results/run-01-author/phase07-api/results.json`. Signed avatar URLs are written with the query (signature)
cut (`redactedView` in the spec).
UI specs of the phase: main `phase07_account.spec.ts`, ui `phase07_account_ui.spec.ts`; no edge spec yet.
Endpoints called by SCR-33 (FE `src/api/endpoints.ts:10` ME_ROOT, client `src/api/client.ts:1090-1102`, decoded with
FE `src/api/schemas/me.ts:35-52` `MeSchema.strict()`; the FE `http` client adds `Idempotency-Key` to every PUT,
`src/lib/http/client.ts:400-405`):

| # | Method + path | BE handler |
|---|---|---|
| N11 | `GET /api/me` | me/router.py:109-112 → :77-106 |
| N12 | `PATCH /api/me` | me/router.py:115-143, me/schemas.py:32-91 |
| N14 | `PUT /api/me/avatar` | me/router.py:247-273, me/avatar.py:137-237, me/schemas.py:101-105 |
| W16 | `POST /api/auth/refresh` (session upkeep of every screen) | auth/router.py:236-282, auth/sessions.py:440-470 |
| (N13) | `POST /api/me/password` | me/router.py:146-244 — on the screen but NOT on the phase-7 plan (UI only shows client-side validation, `phase07_account_ui.spec.ts`); out of scope here |

Status words: **pass** (asserted by a test that passed in `run-01-author`) · **FAIL** (asserted, the real BE broke it)
· **covered** (another spec / the BE pytest asserts it) · **not covered** (reason given) · **unpairable**.
Test names shortened: "anon", "profile", "rules", "avatar", "avatar-rules", "deleted" (all `A07 · …`).

## Shared rules (N11 / N12 / N14)

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Protected: no / non-Bearer `Authorization` → 401 `UNAUTHENTICATED` before the body is read (truncated JSON still 401) | core/routing.py:129-135,262-263 | anon (GET, PATCH truncated, PUT, `Basic`) | pass |
| Bearer that is not a valid access JWT → 401 `UNAUTHENTICATED` | auth/verifier.py:27-30; auth/tokens.py:70-73 | anon (garbage Bearer) | pass |
| Session dead / owner disabled / `ver` mismatch → 401 `SESSION_REVOKED` (verifier, principal cache ≤ 5 s) | auth/sessions.py:605-621; auth/settings.py:35 | deleted (after soft delete) | pass |
| Owner soft-deleted while the cached principal still admits → handler re-read → 401 `SESSION_REVOKED`, never 500 (K30) | me/router.py:77-93,125-134,252-261 | deleted (either path yields the same answer) ; BE pytest `test_*_session_revoked_when_user_deleted` (read_profile:36, update_profile:153, replace_avatar_route:143) | pass |
| No role / owner gate: every authenticated role reads and writes ONLY its own row (`principal.user_id`), no path id → no IDOR surface | me/router.py:110-112,138-143,265-273 | profile, avatar (viewer role) ; ui main (admin) | pass |
| No `require_origin` on /me (Bearer, not cookie) | grep `require_origin` → auth/, auth_recovery/ only | all /me calls carry the helper's Origin; not varied | not covered (no rule to test) |
| Error body W7 `{code, requestId}` + `field` (first Pydantic error, camelCase, root dropped; model-level → no `field`) | core/errors.py:82-88,136-157,176-190 | rules, avatar-rules | pass |
| Responses `Cache-Control: no-store` (personal data) | core/middleware.py:53,191-199 | profile (GET) | pass |
| Response model W2: `None` keys absent; strict keys; FE `MeSchema.strict()` decodes every 200 | me/schemas.py:21-29; core/wire.py:79-112; FE schemas/me.ts:35-52 | profile, rules, avatar, avatar-rules, deleted (`expectMe` = exact keys + FE zod) | pass |

## GET /api/me (N11) — me/router.py:109-112

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| 200 MeSchema `{email, fullName, language[, jobTitle, phone, avatarUrl]}` from the non-deleted row | me/router.py:77-106 | profile, rules, avatar, avatar-rules, deleted ; ui main SCR-33 load | pass |
| New invitee: `language` = DB default `vi`, no jobTitle/phone/avatarUrl | packages/db/models/auth.py:63 | profile, rules, avatar | pass |
| `avatarUrl` = signed absolute URL (`inline`), no `stat` (B0-04) | me/avatar.py:240-255; packages/storage/s3.py:244-255 | avatar (absolute → FE `z.string().url()`, served 200 by MinIO) | pass |
| No rate limit | me/router.py:109 (no `dependencies`) | — | covered (source read) |

## PATCH /api/me (N12) — me/router.py:115-143, schemas.py:32-91

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Writes only the keys present; returns the re-read row (K22) | router.py:115-122,125-143 | profile (jobTitle only, others unchanged; GET = last PATCH answer) ; ui main row 1 (`{jobTitle}` only) | pass |
| `fullName`: NFC + trim (`clean_text`), 1..120 after trim; explicit `null` → 422; blank → 422; 121 → 422; non-string → 422; Cc / bidi override → 422 `field:"fullName"` | schemas.py:40-54; packages/core/text.py:6-46 | profile (NFD→NFC, trim, 120 ok), rules (null, blank, 121, 123, U+0007) | pass |
| `jobTitle`: NFC + trim, ≤ 120; whitespace-only → `''` → NULL (cleared); bidi / Cc → 422 `field:"jobTitle"` | schemas.py:56-65; router.py:51,121 | profile (trim, 120 ok, `""` clears), rules (U+202E, 121) | pass |
| `phone`: NFC + strip only, ≤ 32; whitespace-only → NULL; **no Cc / bidi rule** | schemas.py:67-76 | profile (trim, 32 ok, `"   "` clears), rules (33 → 422; U+0007 accepted and stored — observation) | pass (observation: inconsistent with fullName/jobTitle) |
| `phone` containing U+0000 → reaches a Postgres TEXT column → **500 INTERNAL** | schemas.py:67-76 (no rule); router.py:125-134 | rules ("phone_nul") | **FAIL** (see Findings) |
| `language`: Literal `vi`/`en`; explicit `null` → 422 | schemas.py:38,78-84 | profile (`en`), rules (`fr`, null) | pass |
| `jobTitle` / `phone` explicit `null` → cleared (validator returns None, router writes NULL); FE always sends `""` | schemas.py:58-61,69-72; router.py:121 | profile ("clear_null") ; BE pytest update_profile:180 | pass |
| No key (`{}`) → 422 `VALIDATION` without `field` | schemas.py:86-91 | rules (`{}`) ; BE pytest update_profile:89 | pass |
| Body not an object (`[]`) → 422 `VALIDATION` without `field` | core/errors.py:176-190 | rules (`[]`) | pass |
| Unknown key (`email`, any server-owned field) → 422 `field` = that key; email not editable | core/wire.py:46,115-118 | rules (`email`) ; BE pytest update_profile:142 | pass |
| One bad key rejects the whole body (no partial write) | Pydantic before the handler (core/routing.py:9-12) | rules ("mixed_valid_invalid" + GET unchanged after all 422s) | pass |
| Truncated JSON → 400 `MALFORMED_JSON`, keys exactly `{code, requestId}` | core/errors.py:176-178 | rules | pass |
| Idempotency "auto" (claim only with the header); the FE sends no key on PATCH | core/routing.py:166-187,227-232; FE lib/http/client.ts:404 | — | not covered here (generic claim/replay rules: `phase02_dashboard_api` "idem", "idem-edges") |
| No rate limit | router.py:137 (no `dependencies`) | — | covered (source read) |
| Side effect on W16: refresh `user.name` reads `users.name` → follows N12 at the next refresh | auth/sessions.py:314,339; auth/router.py:253-282 | profile ("refresh_name": name = the 120-char fullName) | pass |
| Concurrency: last write wins per column (plain UPDATE, no version) | router.py:125-134 | — | not covered (no rule beyond the UPDATE; FE autosave debounces 800 ms) |

## PUT /api/me/avatar (N14) — me/router.py:247-273, avatar.py, schemas.py:101-105

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Body `{mimeType: image/png\|image/jpeg, contentBase64: 1..699 052}`; other mime → 422 `field:"mimeType"`; empty / too long → 422 `field:"contentBase64"` | schemas.py:101-105; avatar.py:53 | avatar-rules (gif mime, `""`, 699 056 chars) | pass |
| Invalid base64 → 422 `VALIDATION field:"contentBase64"` | avatar.py:137-142 | avatar-rules (`@@@@`) | pass |
| Decoded > 512 KiB → 422 `IMAGE_TOO_LARGE` (boundary: exactly 699 052 chars = 524 289 bytes) | avatar.py:56,143-144 | avatar-rules | pass |
| Magic bytes PNG/JPEG ≠ declared mime → 422 `FILE_TYPE_MISMATCH`; unknown bytes → same | avatar.py:158-167 | avatar-rules (PNG as image/jpeg) ; BE pytest avatar_unit:118,143 | pass |
| GIF / WebP / BMP / TIFF → 422 `AVATAR_TYPE_UNSUPPORTED` | avatar.py:74-80,148-166 | avatar-rules (GIF89a) ; BE pytest avatar_unit:129 | pass |
| Pixels > 40 M → 422 `IMAGE_TOO_LARGE` (checked from the header, before `load()`) | avatar.py:57,170-180 | avatar-rules (7000×7000 1-bit) | pass |
| Side > 4096 → 422 `AVATAR_DIMENSIONS_EXCEEDED` | avatar.py:58,181-182 | avatar-rules (5000×1) | pass |
| Undecodable / truncated → 422 `FILE_CORRUPT` | avatar.py:71,177-178,221-222 | avatar-rules (PNG cut inside IDAT) ; BE pytest avatar_unit:211,219 | pass |
| Success → 200 MeSchema with `avatarUrl`; object `users/<usr_id>/avatar/<ULID>.<png\|jpg>`, re-encoded, thumbnail ≤ 512×512 keeping aspect, alpha kept for RGBA PNG, no upscale | router.py:264-273; avatar.py:59,185-231; packages/storage/keys.py:122-128 | avatar (600×300 RGB → served 512×256 RGB; 64×64 RGBA → 64×64 RGBA; key pattern) | pass |
| JPEG path (draft, quality 90), EXIF orientation applied + EXIF/ICC stripped, 16-bit / CMYK → 8-bit | avatar.py:190-218 | BE pytest avatar_unit:72,87,96,107,201; replace_avatar_route:53,155 | covered (no JPEG encoder in the API layer without a new dependency) |
| Each upload → new object key (old object left for `purge_avatars`) | router.py:270-272; me/jobs.py:7-11 | avatar (2nd upload path ≠ 1st) ; BE pytest replace_avatar_route:60, test_jobs.py | pass (purge: covered by BE pytest test_jobs.py) |
| `Idempotency-Key` (FE sends one on every PUT): same key + same body → stored response replayed (same object path, handler not re-run); same key + other body → 422 `IDEMPOTENCY_KEY_REUSED`; key outside `^[A-Za-z0-9_-]{8,128}$` → 422 `field:"idempotencyKey"` | core/idempotency.py:79-83,225-233; packages/db/models/idempotency.py:35 | avatar (replay + GET unchanged, reuse, "short") ; BE pytest replace_avatar_route:175 | pass |
| Rate limit `me_avatar` 10 / 900 s per user, Redis "safe", fail-closed; counted BEFORE body validation (rejected bodies count); 11th → 429 `RATE_LIMITED` + `Retry-After` = max(1, min(ttl, 10)) | router.py:47-48,247-249; core/ratelimit.py:86-94,105-140 | avatar-rules (10 rejected PUTs, the 11th valid one → 429, Retry-After in 1..10, nothing stored) | pass |
| Decode semaphore busy > 2 s → 503 `DEPENDENCY_UNAVAILABLE` + Retry-After 1 | avatar.py:63-66,123-134 | BE pytest avatar_unit:227 | unpairable on the real stack (needs 3 concurrent multi-second decodes) / covered by pytest |
| Storage down → 503, `avatar_key` unchanged | router.py:271 | BE pytest replace_avatar_route:195 | unpairable (infra outage) / covered by pytest |
| Owner deleted between verify and write → 401 `SESSION_REVOKED` (object orphaned, purged later) | router.py:252-261 | deleted (valid body → 401) | pass |

## POST /api/auth/refresh (W16) — phase-7 part only (full inventory: `coverage/phase01-be.md` "POST /api/auth/refresh")

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| `user.name` is read from `users` at refresh time → reflects a PATCH of `fullName` | auth/sessions.py:314,339; auth/router.py:277-282 | profile | pass |
| Owner soft-deleted → sessions revoked by the delete → 401 `SESSION_REVOKED` (phase01-be.md listed it "not covered") | users/service.py:451-455; auth/sessions.py:451-452,462-464 | deleted | pass |
| Origin, cookie shape, rotation / grace / reuse, fail bucket, W16 shape, idle/absolute expiry | auth/router.py:206-282 | `phase01_auth_api.spec.ts` | covered |

## Mock-pairing table

Every `[mocked response]` test in the phase's UI specs (`phase07_account.spec.ts`, `phase07_account_ui.spec.ts`; no
`phase07_*_edge.spec.ts` yet) — grep `mocked response` / `page.route` on 2026-10-12:

| UI test | Endpoint + faked response | Pairing |
|---|---|---|
| — | none: both phase-7 UI specs run on the real stack only (0 `page.route`, 0 `[mocked response]` titles) | nothing to pair |

Ready pairings for a future edge spec (real BE answers proven by this file): N14 422 `VALIDATION`(mimeType /
contentBase64), `IMAGE_TOO_LARGE`, `FILE_TYPE_MISMATCH`, `AVATAR_TYPE_UNSUPPORTED`, `AVATAR_DIMENSIONS_EXCEEDED`,
`FILE_CORRUPT`, 429 `RATE_LIMITED` + Retry-After → "avatar-rules"; N11/N12/N14 401 `SESSION_REVOKED` → "deleted";
N12 422 per field → "rules". Unpairable: N14 503 `DEPENDENCY_UNAVAILABLE` / storage 503, any 5xx or network loss on
N11/N12/N14.

## Findings (author run)

1. **PATCH /api/me `{"phone": "12\u000034"}` → 500 `INTERNAL`** (APP, Functional). `_validate_phone` only NFCs and
   strips (me/schemas.py:67-76); U+0000 is not whitespace, so it reaches the TEXT column, which Postgres cannot store
   → unhandled DB error → 500 (core/errors.py:195-202). Expected: a W7 4xx (`VALIDATION field:"phone"`), as fullName /
   jobTitle reject Cc via `clean_text`. Evidence `F:/App/qa-results/run-01-author/evidence/A07_rules_phone_nul.json`
   (requestId `3f1fa6889643c2c18a89e2995b7b6a79`). Left failing in the spec.
2. Observation (not failing): phone accepts other control chars (U+0007 stored and returned as sent), while fullName /
   jobTitle reject them — evidence `A07_rules_phone_control_char.json`. Same root as 1 (no `clean_text` on phone).

## Not covered (with reason)

- N13 change password: not on the phase-7 plan (screen-only validation in the ui spec).
- N12 idempotency replay with a key: the FE never sends one on PATCH; generic rules in phase 2.
- N14 JPEG success path / EXIF / ICC / 16-bit: no JPEG encoder without a new dependency → BE pytest.
- N14 503 paths (semaphore, storage): infra states → BE pytest.
- `purge_avatars` beat: background schedule → BE pytest `apps/api/me/tests/test_jobs.py`.

## Budget (this file, per run) — details in the spec header

| Bucket | Limit | This file | Phase-7 UI | Note |
|---|---|---|---|---|
| `users_invite` per admin | 30 / 3600 s | 1 (one batch of 5) | ui 1 | Phases 1-7 in one hour = 30: at the cap |
| `recovery_ip` per IP | 10 / 900 s (override 60) | 5 accepts | ui 1 | 6 ≤ 10 |
| `auth_login_ip` per IP | 30 / 60 s (override 120) | 1 (admin) | main 1, ui 1 | 0 failed logins |
| `me_avatar` per user | 10 / 900 s | 5 + 11 (designed 429) + 1 | 0 | each on its own fresh user |
| `me_password` per user | 5 / 900 s | 0 | 0 | — |
| refresh fail bucket per (sid, token) | 20 / 60 s | 1 (deleted user's own sid) | 0 | — |
