<!-- qa-sources be=dc510655 fe=c08468bf -->
# Phase 07 - Backend coverage (/api/me, SCR-33)

Rows come from `F:/App/AppBack/backend/dieu-phoi/chay/QA-07b/catalog-C4.md` (B07-G/C). `api` rows: Playwright API specs `phase07_me_api.spec.ts`, `phase07_me_b_api.spec.ts` (flows `FL-A07-*` of `flows-C4.md`). `be` rows: AppBack pytest, id in the test docstring (`flows-C4.md` reverse index).
Deferred: `B07-G-112` (PY-NEW, `catalog-late-be.txt`, hash executor busy -> 503 on /me/password) is written at S6, when the AppBack gate is available.

| row id | spec file | flow | layer |
|---|---|---|---|
| B07-G-001 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-002 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-003 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-004 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-005 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-006 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-007 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-008 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-009 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-010 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-011 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-012 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-013 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-014 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-015 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-016 | `phase07_me_b_api.spec.ts` | FL-A07-08 | api |
| B07-G-017 | `phase07_me_b_api.spec.ts` | FL-A07-05 | api |
| B07-G-020 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile__C01` | - | be |
| B07-G-021 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-022 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-023 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_no_keys_is_422_without_field` | - | be |
| B07-G-024 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-025 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-026 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile__C03` | - | be |
| B07-G-027 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-028 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-029 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-030 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_language_valid_value_is_saved` | - | be |
| B07-G-031 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-032 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-033 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-034 | `phase07_me_api.spec.ts` | FL-A07-02 | api |
| B07-G-035 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile__C17` | - | be |
| B07-G-036 | `pytest apps/api/me/tests/test_read_profile.py::test_me_read_profile__C17` | - | be |
| B07-G-037 | `pytest apps/api/me/tests/test_read_profile.py::test_me_read_profile__C01` | - | be |
| B07-G-038 | `phase07_me_api.spec.ts` | FL-A07-01 | api |
| B07-G-040 | `pytest apps/api/me/tests/test_read_profile.py::test_me_read_profile_session_revoked_when_user_deleted` | - | be |
| B07-G-041 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_session_revoked_when_user_deleted` | - | be |
| B07-G-042 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar_session_revoked_when_user_deleted` | - | be |
| B07-G-043 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password_session_revoked_when_user_deleted` | - | be |
| B07-G-044 | `phase07_me_b_api.spec.ts` | FL-A07-07 | api |
| B07-G-045 | `phase07_me_b_api.spec.ts` | FL-A07-07 | api |
| B07-G-046 | `phase07_me_b_api.spec.ts` | FL-A07-07 | api |
| B07-G-047 | `phase07_me_b_api.spec.ts` | FL-A07-07 | api |
| B07-G-048 | `phase07_me_b_api.spec.ts` | FL-A07-07 | api |
| B07-G-050 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar__C01` | - | be |
| B07-G-051 | `phase07_me_b_api.spec.ts` | FL-A07-05 | api |
| B07-G-052 | `phase07_me_b_api.spec.ts` | FL-A07-05 | api |
| B07-G-053 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar_jpeg_ok` | - | be |
| B07-G-054 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar_replaces_key_each_time` | - | be |
| B07-G-055 | `pytest apps/api/me/tests/test_text_source.py::test_me_replace_avatar__stored_key_name_is_a_bare_ulid` | - | be |
| B07-G-056 | `pytest apps/api/me/tests/test_avatar_unit.py::test_process_avatar_exif_orientation_applied_and_stripped` | - | be |
| B07-G-057 | `pytest apps/api/me/tests/test_avatar_unit.py::test_process_avatar_png_strips_icc_profile` | - | be |
| B07-G-058 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar_png_4096_16bit_downsizes_to_8bit` | - | be |
| B07-G-059 | `pytest apps/api/me/tests/test_avatar_unit.py::test_process_avatar_cmyk_downgrades_to_8bit_rgb` | - | be |
| B07-G-060 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-061 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-062 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-063 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-064 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-065 | `pytest apps/api/me/tests/test_avatar_unit.py::test_process_avatar_decoded_too_large_is_image_too_large` | - | be |
| B07-G-066 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar__U08_magic_bytes_mismatch` | - | be |
| B07-G-067 | `pytest apps/api/me/tests/test_avatar_unit.py::test_process_avatar_pdf_is_type_mismatch_not_unsupported` | - | be |
| B07-G-068 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar_gif_is_avatar_type_unsupported` | - | be |
| B07-G-069 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-070 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar__U03_dimensions_bomb` | - | be |
| B07-G-071 | `phase07_me_b_api.spec.ts` | FL-A07-05 | api |
| B07-G-072 | `pytest apps/api/me/tests/test_avatar_unit.py::test_process_avatar_pixel_count_exceeded_without_pillow_bomb` | - | be |
| B07-G-073 | `pytest apps/api/me/tests/test_avatar_unit.py::test_process_avatar_huge_declared_dims_is_too_large_and_decoder_never_called` | - | be |
| B07-G-074 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar__U07_truncated_file` | - | be |
| B07-G-075 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar__C03` | - | be |
| B07-G-076 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar_idempotency_key_repeat_creates_one_object` | - | be |
| B07-G-077 | `phase07_me_b_api.spec.ts` | FL-A07-05 | api |
| B07-G-078 | `phase07_me_b_api.spec.ts` | FL-A07-05 | api |
| B07-G-079 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar__C11` | - | be |
| B07-G-080 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-081 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-082 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-083 | `phase07_me_b_api.spec.ts` | FL-A07-06 | api |
| B07-G-084 | `pytest apps/api/me/tests/test_replace_avatar_route.py::test_me_replace_avatar_storage_down_is_503_avatar_key_unchanged` | - | be |
| B07-G-085 | `pytest apps/api/me/tests/test_avatar_unit.py::test_process_avatar_concurrency_gate_returns_503` | - | be |
| B07-G-086 | `pytest apps/api/me/tests/test_avatar_unit.py::test_avatar_decode_concurrency_env_invalid_rejects` | - | be |
| B07-G-087 | `pytest apps/api/me/tests/test_avatar_unit.py::test_avatar_urls__one_signed_urls_call_for_the_whole_batch` | - | be |
| B07-G-090 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password__C01` | - | be |
| B07-G-091 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-092 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-093 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-094 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-095 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-096 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-097 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-098 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password_wrong_current_is_422_not_401` | - | be |
| B07-G-099 | `phase07_me_b_api.spec.ts` | FL-A07-08 | api |
| B07-G-100 | `phase07_me_b_api.spec.ts` | FL-A07-08 | api |
| B07-G-101 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-102 | `phase07_me_b_api.spec.ts` | FL-A07-08 | api |
| B07-G-103 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password__C03` | - | be |
| B07-G-104 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password__C11` | - | be |
| B07-G-105 | `phase07_me_b_api.spec.ts` | FL-A07-08 | api |
| B07-G-106 | `phase07_me_b_api.spec.ts` | FL-A07-08 | api |
| B07-G-107 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password_invalidates_pending_password_reset_token` | - | be |
| B07-G-108 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password_concurrent_reset_wins_is_422_password_unchanged` | - | be |
| B07-G-109 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password_current_session_revoked_in_db_is_401` | - | be |
| B07-G-110 | `pytest apps/api/me/tests/test_change_password.py::test_me_change_password_safe_redis_down_is_503` | - | be |
| B07-G-111 | `phase07_me_b_api.spec.ts` | FL-A07-09 | api |
| B07-G-112 | (deferred: new pytest `apps/api/me/tests/test_change_password.py::test_me_change_password_hash_busy_is_503`) | - | be |
| B07-G-120 | `pytest apps/api/me/tests/test_jobs.py::test_purge_avatars__J01` | - | be |
| B07-G-121 | `pytest apps/api/me/tests/test_jobs.py::test_purge_avatars__J06` | - | be |
| B07-G-122 | `pytest apps/api/me/tests/test_jobs.py::test_purge_avatars_runs_in_batches` | - | be |
| B07-G-123 | `pytest apps/api/me/tests/test_jobs.py::test_purge_avatars_smoke` | - | be |
| B07-G-124 | `pytest apps/api/me/tests/test_jobs.py::test_purge_avatars_schedule_is_registered` | - | be |
| B07-G-125 | `pytest apps/api/me/tests/test_jobs.py::test_jobs_import_without_web_or_crypto_packages` | - | be |
| B07-G-126 | `pytest apps/api/me/tests/test_text_source.py::test_me_schemas__reuses_core_text` | - | be |
| B07-G-127 | `pytest apps/api/me/tests/test_text_source.py::test_me_router__reuses_core_new_ulid` | - | be |
| B07-G-128 | `pytest apps/api/me/tests/test_avatar_unit.py::test_avatar_url_absolute_and_no_stat_call` | - | be |
| B07-G-129 | `pytest apps/api/me/tests/test_avatar_unit.py::test_decode_and_reencode__does_not_write_truncated_flag` | - | be |
| B07-C-001 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile__C16` | - | be |
| B07-C-002 | `phase07_me_api.spec.ts` | FL-A07-03 | api |
| B07-C-003 | `phase07_me_api.spec.ts` | FL-A07-03 | api |
| B07-C-004 | `phase07_me_api.spec.ts` | FL-A07-03 | api |
| B07-C-005 | `phase07_me_api.spec.ts` | FL-A07-03 | api |
| B07-C-006 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_full_name_whitespace_only_is_422` | - | be |
| B07-C-007 | `phase07_me_api.spec.ts` | FL-A07-03 | api |
| B07-C-008 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_not_nullable_field_explicit_null_is_422` | - | be |
| B07-C-009 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile__C02` | - | be |
| B07-C-010 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_forbidden_control_char_is_422` | - | be |
| B07-C-011 | `phase07_me_api.spec.ts` | FL-A07-03 | api |
| B07-C-012 | `phase07_me_api.spec.ts` | FL-A07-03 | api |
| B07-C-013 | `phase07_me_api.spec.ts` | FL-A07-03 | api |
| B07-C-020 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-021 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-022 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_bidi_override_is_422` | - | be |
| B07-C-023 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-024 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile__C17` | - | be |
| B07-C-025 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_job_title_whitespace_only_clears` | - | be |
| B07-C-026 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_job_title_and_phone_explicit_null_clears` | - | be |
| B07-C-027 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-030 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-031 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_phone_too_long_is_422` | - | be |
| B07-C-032 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-033 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_phone_forbidden_char_is_422` | - | be |
| B07-C-034 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-036 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_job_title_and_phone_explicit_null_clears` | - | be |
| B07-C-039 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-040 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-050 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-051 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-052 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-053 | `phase07_me_api.spec.ts` | FL-A07-04 | api |
| B07-C-054 | `pytest apps/api/me/tests/test_update_profile.py::test_me_update_profile_not_nullable_field_explicit_null_is_422` | - | be |
| B07-C-070 | `phase07_me_b_api.spec.ts` | FL-A07-08 | api |

---

<!-- qa-sources be=2ee030c5 -->
# Phase 07 — Backend coverage (account: /api/me N11 / N12 / N13 / N14, session refresh W16, login probe W1)

Source read: `F:/App/AppBack` (qa.config `backendSourceRoot`), HEAD `2ee030c5` = `versionCheck.apiBuiltCommit` (no diff
in apps/packages/deploy vs the built image). Every `file:line` is under `apps/api/` unless it starts with `packages/`.
Re-inventory 2026-10-12 (run-31): the previous stamp was not a sha; the edge spec `phase07_account_edge.spec.ts` now
exists and sends `POST /api/me/password` (N13) and `POST /api/auth/login`, so N13 moved into scope.
API spec: `qa/tests/phase07_account_api.spec.ts` — **8 tests** (`--list`), evidence prefix `A07_`.
Author run `run-31-author` (`node tools/run-phase.mjs --phase 07 --run-id run-31-author --layers api --no-watch
--grep "A07 · N13 password"`; the non-ASCII grep did not reach Playwright, so all 8 tests ran): **7 passed / 1 failed**
(the failure is the known APP bug, see "Findings"), evidence ok, `F:/App/qa-results/run-31-author/phase07-api/results.json`.
New in this pass: "pwrules" and "pwchange" (both passed). Signed avatar URLs are written with the query (signature) cut.
UI specs of the phase: main `phase07_account.spec.ts`, ui `phase07_account_ui.spec.ts`, edge `phase07_account_edge.spec.ts`.
Endpoints called by SCR-33 (FE `src/api/endpoints.ts:137-139` avatar / password / ME_ROOT, client `src/api/client.ts`,
decoded with FE `src/api/schemas/me.ts` `MeSchema.strict()`; the FE `http` client adds `Idempotency-Key` to every PUT,
`src/lib/http/client.ts:400-405`):

| # | Method + path | BE handler |
|---|---|---|
| N11 | `GET /api/me` | me/router.py:109-112 → :77-106 |
| N12 | `PATCH /api/me` | me/router.py:115-143, me/schemas.py:32-91 |
| N14 | `PUT /api/me/avatar` | me/router.py:247-273, me/avatar.py:137-237, me/schemas.py:101-105 |
| W16 | `POST /api/auth/refresh` (session upkeep of every screen) | auth/router.py:236-282, auth/sessions.py:440-470 |
| N13 | `POST /api/me/password` | me/router.py:146-153 (limit), :168-244, me/schemas.py:94-98 — sent by the edge spec (wrong current, success) |
| W1 | `POST /api/auth/login` (probe only: old / new password after N13; the edge spec signs the invitee in with it) | auth/router.py:160-192; full inventory `coverage/phase01-be.md` |
| setup | `POST /api/users/invitations`, `POST /api/auth/invitations/accept`, `DELETE /api/users/{id}` | test-user setup / cleanup only; inventoried in phase 1 / phase 6 coverage |

Status words: **pass** (asserted by a test that passed in `run-01-author`) · **FAIL** (asserted, the real BE broke it)
· **covered** (another spec / the BE pytest asserts it) · **not covered** (reason given) · **unpairable**.
Test names shortened: "anon", "profile", "rules", "avatar", "avatar-rules", "deleted", "pwrules", "pwchange" (all `A07 · …`).

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

## POST /api/me/password (N13) — me/router.py:146-153,168-244, schemas.py:94-98

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Protected: no Bearer → 401 `UNAUTHENTICATED` before the rate limit and the body | core/routing.py:129-135 | pwrules (anonymous) | pass |
| Body `{currentPassword: str ≥ 1, newPassword: str ≥ 8}` strict; missing `newPassword` → 422 `VALIDATION field:"newPassword"` | schemas.py:94-98; auth/passwords.py:34 | pwrules ("missing_new") ; BE pytest test_change_password.py:66 (C02) | pass |
| `newPassword` 7 chars → 422 `VALIDATION field:"newPassword"` | schemas.py:98 | pwrules ("new_7_chars") ; edge "password checks on the spot" (FE blocks it before any request) | pass |
| `currentPassword` `""` → 422 `VALIDATION field:"currentPassword"` | schemas.py:97 | pwrules ("current_empty") ; BE pytest :66 (C02) | pass |
| Unknown key → 422 `VALIDATION field` = that key | core/wire.py:46,115-118 | pwrules ("extra_key", `email`) ; BE pytest :77 (C03) | pass |
| No max length, no "new ≠ current" rule, no strength rule on the BE (strength meter is FE-only) | schemas.py:94-98 | — | covered (source read; FE rules in `phase07.md`) |
| Wrong current password → 422 `CURRENT_PASSWORD_INCORRECT field:"currentPassword"`, never 401 (K30) | router.py:43,231-234 | pwrules ("wrong_current"), pwchange (old current after the change) ; edge "wrong current password, double-clicked" (real 422) ; BE pytest :98 | pass |
| Success → 204, empty body | router.py:219-244 | pwchange ; edge "password change succeeds" (:1196) ; BE pytest :48 (C01) | pass |
| New password hashed as `nfc(password)`: sent NFD, typed NFC at login → 204 | auth/passwords.py:120-129 | pwchange | pass |
| Old password then refused at login → 401 `INVALID_CREDENTIALS`; new one → 204 | auth/router.py:166-192; packages/core/error_codes.py:19 | pwchange ; edge success (new password 204) ; BE pytest :110 | pass |
| OTHER sessions revoked (`revoke_sessions(..., except_sid)`, reason `password_change`): their refresh → 401 `SESSION_REVOKED`, their live Bearer → 401 `SESSION_REVOKED` (principal cache dropped after commit) | router.py:217; auth/sessions.py:159-163,266-282,449-452,604-621 | pwchange (second session: refresh + GET /me) ; BE pytest :48 (DB row) | pass |
| The calling session is kept: GET /me 200, its refresh 200 | router.py:215-217 | pwchange ; edge success (reload keeps the session) | pass |
| Calling session revoked in DB mid-request → 401 `SESSION_REVOKED` | router.py:196-205,215-216 | BE pytest :123 | covered (race, not producible safely) |
| Concurrent password reset (N9) between read and swap → 422, password unchanged (compare-and-set) | router.py:183-193,212-213 | BE pytest :146 | covered (race) |
| Pending `password_reset` tokens revoked | router.py:214 | BE pytest :191 | covered (needs a reset mail on the same user: recovery budget) |
| Owner soft-deleted → 401 `SESSION_REVOKED` | router.py:168-180,231 | BE pytest :179 ; API "deleted" proves the verifier path for N11/N12/N14 | covered |
| Rate limit `me_password` 5 / 900 s per user, Redis "safe", fail-closed; counted BEFORE body validation; 6th → 429 `RATE_LIMITED` + `Retry-After` 1..10 | router.py:45-46,146-153,225; core/ratelimit.py:86-94,105-140 | pwrules (5 rejected → the 6th, a valid body, 429, Retry-After 10; the old password still signs in, the session is not revoked) ; BE pytest :86 (C11) | pass |
| Safe Redis down → 503 | core/ratelimit.py (on_error closed) | BE pytest :209 | unpairable (infra outage) / covered by pytest |
| Password hash executor busy > 2 s → 503 `DEPENDENCY_UNAVAILABLE` | auth/passwords.py:37-38 | — | unpairable (needs a saturated hash executor) |
| No mail sent by N13 | router.py:15-41 (no mail import) | — | covered (source read) |

## POST /api/auth/login (W1) — phase-7 part only (full inventory: `coverage/phase01-be.md`)

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| Correct password → 204 + refresh cookie (new session) | auth/router.py:160-192 | pwrules (old password still valid), pwchange (second session, new password) ; edge (every test signs the invitee in) | pass |
| Wrong password → 401 `INVALID_CREDENTIALS`; counts on the (email, IP) attempt bucket (5 / 900 s since the last success) and the email soft bucket | auth/router.py:173-177; login_guard.py:41-53,122-126 | pwchange (old password after N13: 1 attempt on the test user's own bucket) | pass |
| Origin, lockout 429, `auth_login_ip`, pending / disabled, rehash | auth/router.py:121-192 | `phase01_auth_api.spec.ts` | covered |

## POST /api/auth/refresh (W16) — phase-7 part only (full inventory: `coverage/phase01-be.md` "POST /api/auth/refresh")

| Rule / branch | BE source | Covering test (api / ui) | Status |
|---|---|---|---|
| `user.name` is read from `users` at refresh time → reflects a PATCH of `fullName` | auth/sessions.py:314,339; auth/router.py:277-282 | profile | pass |
| Owner soft-deleted → sessions revoked by the delete → 401 `SESSION_REVOKED` (phase01-be.md listed it "not covered") | users/service.py:451-455; auth/sessions.py:451-452,462-464 | deleted | pass |
| Session revoked by N13 (another session of the same user) → 401 `SESSION_REVOKED`; the calling session still refreshes | auth/sessions.py:449-452 | pwchange | pass |
| Origin, cookie shape, rotation / grace / reuse, fail bucket, W16 shape, idle/absolute expiry | auth/router.py:206-282 | `phase01_auth_api.spec.ts` | covered |

## Mock-pairing table

Every `[mocked response]` test in the phase's UI specs (`phase07_account.spec.ts`, `phase07_account_ui.spec.ts`,
`phase07_account_edge.spec.ts`) — grep `mocked response` / `page.route` on 2026-10-12: main 0, ui 0, edge 1 mocked
(+1 "[held real response]", which delays the backend's own body and fakes nothing).

| UI test | Endpoint + faked response | Pairing |
|---|---|---|
| edge `E07 · SCR-33 [mocked response] GET /api/me 500 → "Không tải được cài đặt tài khoản" …` (phase07_account_edge.spec.ts:530) | `GET /api/me` → 500 | unpairable: a 5xx on N11 is not producible safely on the shared stack (needs the DB / storage down); the real 401 / 200 shapes of N11 are proven by "anon", "profile", "deleted" |
| edge `E07 · SCR-33 loading state [held real response] …` (:499) | `GET /api/me` held, real body served | not a mock (real response) — nothing to pair |

Real-BE answers the edge spec relies on without mocks, proven here: N12 422 per field → "rules"; N14 422
`FILE_TYPE_MISMATCH` → "avatar-rules"; N13 422 `CURRENT_PASSWORD_INCORRECT` → "pwrules", "pwchange"; N13 204 + other
sessions revoked + new password signs in → "pwchange". Unpairable: N14 503 `DEPENDENCY_UNAVAILABLE` / storage 503, N13
503 (safe Redis / hash executor), any 5xx or network loss on N11/N12/N13/N14.

## Findings (author run)

1. **PATCH /api/me `{"phone": "12\u000034"}` → 500 `INTERNAL`** (APP, Functional). `_validate_phone` only NFCs and
   strips (me/schemas.py:67-76); U+0000 is not whitespace, so it reaches the TEXT column, which Postgres cannot store
   → unhandled DB error → 500 (core/errors.py:195-202). Expected: a W7 4xx (`VALIDATION field:"phone"`), as fullName /
   jobTitle reject Cc via `clean_text`. Evidence `F:/App/qa-results/run-01-author/evidence/A07_rules_phone_nul.json`
   (requestId `3f1fa6889643c2c18a89e2995b7b6a79`); reproduced in `run-31-author`
   (`F:/App/qa-results/run-31-author/evidence/A07_rules_phone_nul.json`, requestId `3d8b81bcf6d4c9baa18802d072195429`).
   Left failing in the spec.
2. Observation (not failing): phone accepts other control chars (U+0007 stored and returned as sent), while fullName /
   jobTitle reject them — evidence `A07_rules_phone_control_char.json`. Same root as 1 (no `clean_text` on phone).

## Not covered (with reason)

- N13 races (session revoked mid-request, concurrent N9 reset), reset-token revocation, 503 paths → BE pytest
  `apps/api/me/tests/test_change_password.py` (:123, :146, :191, :209).
- N12 idempotency replay with a key: the FE never sends one on PATCH; generic rules in phase 2.
- N14 JPEG success path / EXIF / ICC / 16-bit: no JPEG encoder without a new dependency → BE pytest.
- N14 503 paths (semaphore, storage): infra states → BE pytest.
- `purge_avatars` beat: background schedule → BE pytest `apps/api/me/tests/test_jobs.py`.

## Budget (this file, per run) — details in the spec header

| Bucket | Limit | This file | Phase-7 UI (main / ui / edge) | Note |
|---|---|---|---|---|
| `users_invite` per admin | 30 / 3600 s | 1 (one batch of 7) | 0 / 1 / 1 per worker | Phases 1-7 in one hour at the cap (phase06 header); a re-run inside the hour gets 429 |
| `recovery_ip` per IP | 10 / 900 s (override 60) | 7 accepts | 0 / 1 / ≤ 6 | ≤ 14 ≤ 60; the BE default 10 would be exceeded by the phase total — needs `qa-limits.override.yml` (loaded by chuoi.sh) |
| `auth_login_ip` per IP | 30 / 60 s (override 120) | 5 (admin 1, pwrules 1, pwchange 3) | 1 / 1 / ≤ 28 spread over minutes | 1 failed login, on the test user's own (email, IP) bucket |
| login (email, IP) attempts | 5 / 900 s since the last success | pwchange: success, fail, success | edge: own user, 0 failed | — |
| `me_avatar` per user | 10 / 900 s | 5 + 11 (designed 429) + 1 | edge 2 on its user | each on its own fresh user |
| `me_password` per user | 5 / 900 s | pwrules 5 + designed 6th (429); pwchange 2 | edge 2 on its user | each on its own fresh user |
| refresh fail bucket per (sid, token) | 20 / 60 s | deleted 1, pwchange 1 (each its own dead sid) | 0 | — |
