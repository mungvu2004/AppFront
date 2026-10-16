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
