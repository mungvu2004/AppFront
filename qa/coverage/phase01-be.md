<!-- qa-sources be=UNKNOWN - not computed (git rev-parse of F:/App/AppBack not run; HEAD is 0 commits behind origin/main) -->
# Phase 01 — Backend coverage (auth, auth_recovery)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`); every `file:line` below is in that tree
(`apps/api/...` unless it starts with `packages/`). API spec: `qa/tests/phase01_auth_api.spec.ts` (25 tests;
the 8 marked **new** carry "(gap)" in their titles). UI specs of the phase: `phase01_auth.spec.ts`,
`phase01_auth_edge.spec.ts`, `phase01_recovery_edge.spec.ts`, `phase01_auth_ui.spec.ts`.

Note: the older API tests and the edge specs cite `BE:` = `AppBack/fix378-x`. Some of those line numbers do not
match this tree. Examples: `login_guard.py:403-414,481` is `:41-53,100-119` here (the file has 134 lines), and
`auth/settings.py:29` (refresh_grace_s) is `:33` here. Behaviour and codes match what is read below. Not re-run.

Status words: **covered** (an existing test asserts it) · **new** (gap test added in this pass) · **partial** ·
**not covered** (reason given) · **unpairable** (cannot be produced safely on the shared stack).

## Shared rules

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Origin missing or foreign → 403 `ORIGIN_MISMATCH` on all 6 routes; runs before the limiter (costs no budget) | core/origin.py:44-56; auth/router.py:164,236; auth_recovery/router.py:232,280,342 | api: "foreign or missing Origin → 403 … on all six routes" | covered |
| Error body W7 = `{code, requestId}` + params (`field`, `count`); `Retry-After` header when set | core/errors.py:82-99 | api: `expectError` in every negative test | covered |
| Body validation → 422 `VALIDATION`, `field` = camelCase of first error, `count` = number of errors | core/errors.py:136-183 | api: all 422 tests (recovery pairs assert `count` 1) | covered |
| Invalid JSON → 400 `MALFORMED_JSON`, no `field` | core/errors.py:47,170-174; packages/core/error_codes.py:8 | api **new**: "login 400 MALFORMED_JSON …" | new |
| Strict body (`extra="forbid"`) → 422 field = the extra key | core/wire.py:46 | api: "login 422 … extra body key" (login only; same base class `WireRequest` for the 3 recovery bodies) | partial |
| Rate-limit `Retry-After` = max(1, min(ttl, 10)) | core/ratelimit.py:30,92-94 | api: lock test (=10), refresh fail test (1..10) | covered |
| Limiter counts BEFORE body validation (key fn never raises) | core/ratelimit.py:116-117 | budget only (not asserted) | not covered (would need an IP-wide 429) |

## POST /api/auth/login — auth/router.py:159-192 (public, `require_origin`, `_login_ip_limit`)

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| `password` min 8 → 422 field `password` | router.py:72; auth/passwords.py:34 | api: "login 422 … a password of 4 code points that the FE sends" (`BE_SHORT_PASSWORD`, BUG-094) | covered |
| `rememberMe` strict bool → 422 field `rememberMe` | router.py:73 | api: "… rememberMe … string \"true\"" | covered |
| `rememberMe` / `email` / `password` missing → 422 (required) | router.py:71-73 | — | not covered: the FE schema always sends all three, and it is the same Pydantic required-field branch as the strict tests |
| `email`: trim, ASCII, ≤ 254, zod 3.23.8 regex → 422 field `email` | router.py:75-79; auth/emails.py:31-42 | api: "… zod .email() rejects (no dot)"; ui edge: too-long address stopped by FE | partial (non-ASCII and > 254 only via BE pytest) |
| Email lookup by `normalize_email` (NFC + strip + casefold); deleted users excluded | router.py:142-151; packages/core/text.py:17-19 | api **new**: "second login … address padded + upper-case → 204"; ui edge: uppercase admin login | new |
| Unknown address / `pending` / wrong password → same 401 `INVALID_CREDENTIALS` (dummy hash, C27) | router.py:171-177; auth/passwords.py:112-117 | api: lock test (unknown), invitation test (pending, disabled + wrong); ui main "ONE wrong password" | covered |
| `disabled` + right password → 403 `ACCOUNT_DISABLED`, no Set-Cookie | router.py:178-179 | api: invitation test | covered |
| (email, IP) counter: every attempt counted before hashing; > 5 in 900 s → lock 60 s → 429 `RATE_LIMITED`, `Retry-After` 10; other address same IP unaffected | auth/login_guard.py:41-53,100-119; auth/settings.py:38-40 | api: "5 attempts … 6th → 429 … another address … still 401" | covered |
| Email soft limit: 20 failures / 900 s across IPs → 429 unless the IP is "known" (30 d) | auth/login_guard.py:49-51,122-134; auth/settings.py:41-42 | — | unpairable: from one IP the (email, IP) lock fires at 5 first; needs > 4 source IPs. BE pytest only |
| Per-IP limit 30 / 60 s, store `safe`, fail-closed (Redis down → 503) | router.py:121-128; auth/settings.py:36-37 | budget only | unpairable: IP-wide lockout would break every later test; Redis outage is infra |
| Success → 204 empty, `appback_refresh` (Path=/api/auth) + `appback_stream` (Path=/api/streams), HttpOnly; Secure; SameSite=Strict; refresh `Max-Age` only when `rememberMe` | router.py:183-191; auth/sessions.py:176-236; auth/cookies.py:19-37 | api: rotation (no remember), reset test (remember); ui main "valid credentials → login 204 … cookie httpOnly/Secure/Strict" | covered |
| Cookie value `<uuid>.<43 base64url>` | auth/tokens.py:38-40,126-138 | api: `expectSessionCookies` | covered |
| Login carrying another live refresh cookie → that session revoked (`replaced`) | auth/sessions.py:205-211,239-263 | api **new**: "second login carrying the first refresh cookie … 401 SESSION_REVOKED" | new |
| Password NFC before hash and verify (NFD typed = NFC typed) | auth/passwords.py:120-129 | api **new**: "invitation token on /password-reset/confirm … NFC form of the password signs in" | new |
| Side effects: fail key cleared + IP marked known; rehash on old params; `last_active_at` touched | auth/login_guard.py:128-134; router.py:180-182,192-203 | — | not covered: no phase-1 read API exposes them (UNKNOWN - NEED VERIFICATION via admin users list, phase 8) |
| Hash executor saturated > 2 s → 503 `DEPENDENCY_UNAVAILABLE`, Retry-After 1 | auth/passwords.py:37-38,81-93 | — | unpairable: needs load on the shared stack |

## POST /api/auth/refresh — auth/router.py:236-282 (public, `require_origin`)

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| No cookie / malformed cookie → 401 `UNAUTHENTICATED` | router.py:239-241; auth/tokens.py:131-138 | api: "refresh without a cookie or with a malformed cookie" | covered |
| Unknown sid → 401 `UNAUTHENTICATED` | auth/sessions.py:448-450 | api: failure-limit test | covered |
| Forged token on a live sid (not current/previous, not on the chain) → 401 `UNAUTHENTICATED`, session NOT revoked | auth/sessions.py:435-436,455-456 | api **new**: "… forged token on the new sid → 401 UNAUTHENTICATED and the new session survives" | new |
| Rotation; previous cookie within 30 s grace → same successor; current within grace → handed back | auth/sessions.py:423-434,472-498; auth/settings.py:33 | api: rotation test | covered |
| Previous cookie after grace (reuse) → session revoked, 401 `SESSION_REVOKED`, current dies too | auth/sessions.py:457-461 | api: rotation test | covered |
| Revoked / expired session → 401 `SESSION_REVOKED` | auth/sessions.py:452-453 | api: logout, invitation (disabled), reset, replaced tests | covered |
| Owner disabled → revoke + `SESSION_REVOKED` | auth/sessions.py:462-464 | api: invitation test | covered |
| Owner soft-deleted → revoke + `SESSION_REVOKED` | auth/sessions.py:462-464 | — | not covered: delete is only used in cleanup (phase 8 scope) |
| Idle 12 h / absolute 24 h (remember 7 d / 30 d) expiry | auth/sessions.py:61-64,108-110 | — | unpairable: time |
| W16 body exactly `{accessToken, expiresAt, roles[1], user{id,name,email}}`, access TTL ≤ 600 s | router.py:82-96,253-282; auth/settings.py:31 | api: `expectW16` (rotation, invitation, purpose, replace tests) | covered |
| Refresh re-issues `appback_stream` | router.py:266-275; auth/sessions.py:190-192 | api **new**: asserted in the replace test (older tests state it only in text) | new |
| Fail bucket: 20 × 401 / 60 s per (sid, token hash16) → 429 + Retry-After | router.py:206-233; auth/settings.py:43-44 | api: failure-limit test | covered |
| Total 300 / 60 s per sid, cache store, fail-open | router.py:131-139; auth/settings.py:45-46 | — | not covered: costs 301 requests; fail-open on Redis is infra |

## POST /api/auth/logout — auth/router.py:285-296 (public, Origin checked inside, not rate-limited)

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| Foreign Origin → 403 `ORIGIN_MISMATCH` + both cookies cleared, server session survives | router.py:288-293 | api: logout test; origin test | covered |
| Live cookie → 204, session revoked (`logout`), both cookies cleared (same name + Path, Max-Age=0) | router.py:294-296; auth/cookies.py:34-37 | api: logout test; ui recovery_edge SCR-04 logout after reset (mocked confirm, real logout) | covered |
| No / dead cookie → 204 + clear (idempotent) | router.py:287; auth/sessions.py:239-243 | api: logout test | covered |

## POST /api/auth/password-reset (N8) — auth_recovery/router.py:227-245 (public, Origin, `recovery_ip`)

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| `email` wire rule → 422 field `email` | router.py:72-81 | api: "password-reset with an address zod .email() rejects" | covered |
| `recovery_ip` 10 / 900 s per IP, shared by N8/N9/N10, fail-closed | router.py:121-128; auth_recovery/settings.py:24-25 | budget only | unpairable: IP-wide lockout for 15 min |
| Active user, no live reset token → token issued + mail "Yêu cầu đặt lại mật khẩu AppBack", link `{PUBLIC_BASE_URL}/login/reset-password#token=…` | router.py:186-198,215-245; auth_recovery/tokens.py:92-111; auth_recovery/messages.py:36-55 | api: reset test, cooldown + disabled tests (`mailedResetToken`); ui edge Mailpit pair | covered |
| Always 204 with an empty body (C27) | router.py:234-245 | api: reset test, cooldown test | covered |
| Unknown address → 204, nothing created (C27) | router.py:194-195,221-224 | ui edge: "forgot unknown address" (real request) | partial: absence of mail is not asserted; BE pytest `test_auth_request_password_reset__unknown_email_creates_nothing` |
| `pending` / `disabled` user → 204, no token (C28) | router.py:165-175 | — | not covered: the only check would be that no mail arrives. BE pytest `…__no_leak_for_unusable_accounts` |
| Live token younger than the cooldown (15 min) → no new token (C28) | router.py:165-175; auth_recovery/settings.py:23 | api **new**: "reset cooldown (C28) … the first mailed token … confirms → 204" | new |
| A new token supersedes the older live one | auth_recovery/tokens.py:118-122 | — | unpairable: needs the 15 min cooldown to pass |
| Token TTL 60 min | auth_recovery/settings.py:22; auth_recovery/tokens.py:66-71 | — | unpairable: time |

## POST /api/auth/password-reset/confirm (N9) — auth_recovery/router.py:275-292

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| `token` 1..512 → 422 field `token` | router.py:58,87 | api: "confirm with a 513-character token" | covered (max); min 1: not covered (the FE never sends an empty token) |
| `newPassword` min 8 → 422 field `newPassword` | router.py:88 | api: "confirm with a newPassword of 4 code points" (`BE_SHORT_PASSWORD`) | covered |
| Used token → 422 `PASSWORD_RESET_TOKEN_INVALID` (never 401, K30) | router.py:286-287; auth_recovery/tokens.py:200-207 | api: reset test (reuse) | covered |
| Wrong purpose (an invitation token) → 422 `PASSWORD_RESET_TOKEN_INVALID`, token not consumed | auth_recovery/tokens.py:204-206 | api **new**: "invitation token on /password-reset/confirm …" | new |
| Token revoked by a user disable → 422 `PASSWORD_RESET_TOKEN_INVALID` | users/service.py:297-309 (:307); auth_recovery/tokens.py:191-197 | api **new**: "disabling a user voids a reset link already mailed" | new |
| Unknown token (never issued) → 422 `PASSWORD_RESET_TOKEN_INVALID` | router.py:138-142,286-287 | ui edge 1570 is mocked; same `_identity_or_422` branch as the reuse/purpose tests | covered (same branch) |
| Expired token → 422 | auth_recovery/tokens.py:61-63 | — | unpairable: time (60 min) |
| User no longer `active` between lookup and update (race) → 422 | router.py:255-265,290-291 | — | unpairable: race. BE pytest `…__disabled_mid_hash_stays_disabled` |
| Success → 204: password replaced, ALL sessions revoked (`password_reset`), other reset tokens revoked, both cookies cleared | router.py:268-272,288-292 | api: reset test (old pw 401, new 204, old session SESSION_REVOKED, reuse 422); cooldown test | covered |

## POST /api/auth/invitations/accept (N10) — auth_recovery/router.py:337-365

| Rule / branch | BE source | Covering test | Status |
|---|---|---|---|
| `token` 1..512 → 422 field `token` | router.py:58,94 | api: "accept with a 513-character token" | covered |
| `password` min 8 → 422 field `password` | router.py:96 | api: "accept with a password of 4 code points" (`BE_SHORT_PASSWORD`) | covered |
| `fullName` blank after trim → 422 field `fullName` | router.py:64-69,98-102; packages/core/text.py:34-46 | api **new**: "accept with a whitespace-only fullName" | new |
| `fullName` > 120 → 422; exactly 120 accepted | router.py:59,64-69 | api **new**: "121-character fullName"; "… 120-character name …" (accept 204 + W16 name) | new |
| `fullName` control char (Cc) → 422 | packages/core/text.py:22-31 | api **new**: "control character (U+0007) in fullName" | new |
| `fullName` bidi override (U+202E) → 422 | packages/core/text.py:22-31 | ui (real BE): edge 2364, recovery_edge 536 | covered |
| `fullName` NFC + trim stored | router.py:64-69 | api: invitation test (trimmed name in W16) | covered |
| Used token → 422 `INVITATION_TOKEN_INVALID` | router.py:348-349; auth_recovery/tokens.py:200-207 | api: invitation test (reuse) | covered |
| Unknown token → 422 `INVITATION_TOKEN_INVALID` | router.py:348-349 | ui edge: "invitation bogus token" (real request) | covered |
| Wrong purpose (a reset token) → 422 `INVITATION_TOKEN_INVALID`, not consumed, no Set-Cookie | auth_recovery/tokens.py:204-206 | api **new**: "reset cooldown … a reset token on /invitations/accept → 422 …" | new |
| Superseded (re-sent invitation) / expired (168 h) → 422 | auth_recovery/tokens.py:61-63,118-122; auth_recovery/settings.py:21 | — | not covered: resend is `POST /api/users/invitations/{id}/resend` (phase 8); expiry = time |
| User already `active` (race) → 422 | router.py:310-329 | — | unpairable: race. BE pytest `…__C26_already_active` |
| Success → 204: pending → active, name + hash set, token consumed, session opened (no Max-Age) | router.py:350-365 | api: invitation test | covered |
| Accept carrying another live session cookie → that session revoked (`replaced`) | router.py:356-364; auth/sessions.py:210-211 | api **new**: "… while carrying another session cookie → 204 and that session is revoked" | new |

## Mock pairing — every `[mocked response]` UI test of phase 01

Generated: `node tools/mock-pairs.mjs --write` (from `qa/`) re-reads the specs, so `file:line` is always current;
without `--write` it only checks (exit 1 = a mocked test with no row, BUG-103/104).

<!-- mock-pairs:start (generated by tools/mock-pairs.mjs, do not edit by hand) -->
32 `[mocked response]` tests in source (a test inside a per-screen loop runs once per screen).

| UI test (file:line) | Endpoint + faked response | Pairing |
|---|---|---|
| auth_edge:416 SCR-01 server unreachable at bootstrap | refresh → network loss | unpairable: network loss |
| auth_edge:459 session layer never loads | app JS chunks aborted (no API) | unpairable: not an API |
| auth_edge:505 refresh fails mid-session | refresh → network loss | unpairable: network loss |
| auth_edge:988 login 500 | login → 500 | unpairable: 5xx |
| auth_edge:1013 login network failure | login → network loss | unpairable: network loss |
| auth_edge:1038 login 429 | login → 429 RATE_LIMITED | paired: "5 attempts on one unknown address → … 6th → 429 RATE_LIMITED + Retry-After 10" |
| auth_edge:1071 login 403 ACCOUNT_DISABLED | login → 403 | paired: invitation test ("… right password 403 ACCOUNT_DISABLED …") |
| auth_edge:1115 login 403 ORIGIN_MISMATCH | login → 403 | paired: "foreign or missing Origin → 403 ORIGIN_MISMATCH on all six routes" |
| auth_edge:1134 login 422 field password / unknown field | login → 422 VALIDATION | paired: "login 422 … a password of 4 code points that the FE sends" (same `BE_SHORT_PASSWORD` as the UI box, BUG-094), "login 422 … extra body key" |
| auth_edge:1169 login 204, follow-up refresh unreachable | refresh → network loss | unpairable: network loss (login 204 itself paired by the rotation test) |
| auth_edge:1216 login 204 with no cookie, real refresh 401 | login → 204 without Set-Cookie | unpairable: the real BE always sets cookies on 204 (router.py:183-191; the state = a browser that drops cookies). The refresh 401 is real and paired by "refresh without a cookie … 401 UNAUTHENTICATED" |
| auth_edge:1396 forgot "sending" then sent | password-reset → held 204 | paired: reset test ("request 204 + mailed link") |
| auth_edge:1432 forgot 429 | password-reset → 429 | unpairable: `recovery_ip` is IP-wide for 900 s |
| auth_edge:1455 forgot network / 403 / 500 / 422 email | password-reset → each | 403 paired: origin test; 422 paired: "password-reset with an address zod .email() rejects"; network, 500 unpairable |
| auth_edge:1648 reset bogus token → 422 PASSWORD_RESET_TOKEN_INVALID | confirm → 422 | paired: reset test (reuse → 422) + purpose test (invitation token → 422); same branch, router.py:286-287 |
| auth_edge:2510 SCR-03/04 500 / network / 429 | accept, confirm → each | unpairable: 5xx, network loss, IP-wide 429 |
| auth_edge:2569 SCR-03 server unreachable at load | refresh → network loss | unpairable: network loss |
| auth_edge:2796 SCR-01 retry ladder while the server is unreachable | refresh → network loss ×8, then real 401 | unpairable: network loss (the closing 401 is real, paired by "refresh without a cookie … 401 UNAUTHENTICATED") |
| auth_edge:3018 forgot 429 with Retry-After 120 | password-reset → 429 + Retry-After 120 | unpairable: `recovery_ip` is an IP-wide limit (900 s window); the real Retry-After is the window left, not a chosen 120 |
| auth_edge:3054 reset 204, logout unreachable | confirm → 204; logout → network loss | unpairable: network loss (confirm 204 itself paired by the reset test) |
| auth_ui:155 U01_login_strips_1024 | login → 401 INVALID_CREDENTIALS, 403 ORIGIN_MISMATCH | paired: lock test (401) + origin test (403) |
| recovery_edge:365 SCR-03 / SCR-04 slow 500 | accept / confirm → 500 | unpairable: 5xx |
| recovery_edge:407 SCR-03 / SCR-04 network failure | accept / confirm → network loss | unpairable: network loss |
| recovery_edge:430 SCR-03 / SCR-04 429 | accept / confirm → 429 | unpairable: `recovery_ip` is IP-wide for 900 s |
| recovery_edge:451 SCR-03 / SCR-04 403 ORIGIN_MISMATCH | accept / confirm → 403 | paired: origin test |
| recovery_edge:466 SCR-03 / SCR-04 422 field token | accept / confirm → 422 VALIDATION token | paired: "accept with a 513-character token", "confirm with a 513-character token" |
| recovery_edge:513 SCR-03 422 field fullName / password | accept → 422 | paired: "accept with a whitespace-only fullName" (+ 121, Cc), "accept with a password of 4 code points" (same `BE_SHORT_PASSWORD`, BUG-094) |
| recovery_edge:566 SCR-03 204 but no session | accept → 204 without Set-Cookie | 204 + body (hash token, trimmed name) paired: invitation test. The "no session" part is unpairable: the real BE always opens a session (router.py:356-364) |
| recovery_edge:603 SCR-03 server unreachable at load | refresh → network loss | unpairable: network loss |
| recovery_edge:667 SCR-03 signed in, 204 → session opens | accept → 204 | paired: invitation test + purpose test (accept carrying a live session → 204, that session revoked "replaced") |
| recovery_edge:749 SCR-04 422 field newPassword | confirm → 422 | paired: "confirm with a newPassword of 4 code points" (same `BE_SHORT_PASSWORD`, BUG-094) |
| recovery_edge:767 SCR-04 204 → logout | confirm → 204 | paired: reset test (confirm 204 clears cookies) + logout test |
<!-- mock-pairs:end -->

Gaps left (none written; reasons above): missing required login keys; non-ASCII/over-long email on the API;
soft-deleted owner refresh; superseded/expired one-time tokens; N8 for pending/disabled (negative mail check
only); refresh total limit; login side effects without a read API.

## Rate-limit budget (one run)

| Bucket | Limit (BE) | API spec | UI specs of phase 01 | Sum / note |
|---|---|---|---|---|
| `recovery_ip` (N8+N9+N10, per IP) | 10 / 900 s (auth_recovery/settings.py:24-25) | 24 | 8 (edge 7 + recovery_edge 1) | 32: needs `qa-limits.override.yml` (RECOVERY_IP_LIMIT=60). The default 10 is already exceeded (BUG-053) |
| `auth_login_ip` (per IP) | 30 / 60 s (auth/settings.py:36-37) | 28 | 29 (edge 20 + main 6 + recovery 2 + ui 1: SCR-37 setup `signedInApi`, BUG-105) | each layer ≤ 30 even within one window; layers run sequentially and must not share a 60 s window |
| (email, IP) lock | 5 / 900 s | 6 attempts on 1 run-unique address | 1 attempt per address | admin: 0 failed attempts |
| `users_invite` (per admin) | 30 / 3600 s (users/router.py:32-43) | 5 | 3 (edge 2 + ui 1: SCR-37 second user, BUG-105) | 8 |
| refresh fail (sid, token) | 20 / 60 s | 21 on a random sid + 1 forged on own sid | — | own buckets only |
