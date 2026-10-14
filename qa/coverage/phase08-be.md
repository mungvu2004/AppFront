<!-- qa-sources fe=5fcaf502 be=dc510655 -->
# Phase 08 - Backend coverage (ML admin, users, library)

Rows come from `F:/App/AppBack/backend/dieu-phoi/chay/QA-08/catalog-C6.md`, `catalog-C7.md` (B08*) and the user/library API rows of C4/C5. `api` rows: Playwright API specs `phase08_*_api.spec.ts`. `be` rows: AppBack pytest on branch `test/qa08-py`, id in the test docstring (`Catalog: <id>`).

| row id | spec file | flow | layer |
|---|---|---|---|
| B08M-C-001 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-002 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-003 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-004 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-005 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-006 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-007 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-008 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-009 | `phase08_ml_c_api.spec.ts` | FL-B08M-11 | api |
| B08M-C-010 | `pytest apps/api/admin_ml_datasets/tests/test_contract.py::test_ml_create_dataset_rejects_unknown_keys` | - | be |
| B08M-D-001 | `phase08_ml_api.spec.ts` | FL-B08M-01 | api |
| B08M-D-002 | `phase08_ml_api.spec.ts` | FL-B08M-01 | api |
| B08M-D-003 | `phase08_ml_api.spec.ts` | FL-B08M-01 | api |
| B08M-D-004 | `phase08_ml_api.spec.ts` | FL-B08M-01 | api |
| B08M-D-005 | `phase08_ml_api.spec.ts` | FL-B08M-01 | api |
| B08M-D-006 | `phase08_ml_api.spec.ts` | FL-B08M-01 | api |
| B08M-D-011 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-012 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-013 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-014 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-015 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-016 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-021 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-022 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-023 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-024 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-025 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-026 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-030 | `phase08_ml_api.spec.ts` | FL-B08M-02 | api |
| B08M-D-040 | `pytest apps/api/admin_ml_datasets/tests/test_contract.py::test_ml_build_dataset_version__C07` | - | be |
| B08M-G-001 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-002 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-003 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-004 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-005 | `pytest apps/api/admin_ml_registry/tests/test_contract.py::test_family_out_omits_a_family_without_an_active_version` | - | be |
| B08M-G-010 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-011 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-012 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-013 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-014 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-015 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-016 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-017 | `phase08_ml_api.spec.ts` | FL-B08M-03 | api |
| B08M-G-018 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-019 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-020 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-021 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-022 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-023 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-024 | `pytest apps/api/admin_ml_registry/tests/test_read.py::test_ml_list_versions__C01` | - | be |
| B08M-G-030 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-031 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-032 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-033 | `phase08_ml_api.spec.ts` | FL-B08M-04 | api |
| B08M-G-034 | `pytest apps/api/admin_ml_registry/tests/test_read.py::test_ml_read_version__C01` | - | be |
| B08M-G-040 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-041 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-042 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-043 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-044 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-045 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-046 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-047 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-048 | `phase08_ml_api.spec.ts` | FL-B08M-05 | api |
| B08M-G-049 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-050 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-051 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-052 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-053 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-054 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-055 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-056 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-057 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-058 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-059 | `phase08_ml_b_api.spec.ts` | FL-B08M-06 | api |
| B08M-G-060 | `pytest apps/api/admin_ml_registry/tests/test_activate.py::test_set_active_version_rejects_a_safetensors_version` | - | be |
| B08M-G-061 | `phase08_ml_b_api.spec.ts` | FL-B08M-07 | api |
| B08M-G-062 | `phase08_ml_b_api.spec.ts` | FL-B08M-07 | api |
| B08M-G-063 | `phase08_ml_b_api.spec.ts` | FL-B08M-07 | api |
| B08M-G-064 | `phase08_ml_b_api.spec.ts` | FL-B08M-07 | api |
| B08M-G-065 | `pytest apps/api/admin_ml_registry/tests/test_activate.py::test_ml_activate_version__C01` | - | be |
| B08M-G-070 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-071 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-072 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-073 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-074 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-075 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-076 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-077 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-078 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-079 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-080 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-081 | `phase08_ml_b_api.spec.ts` | FL-B08M-08 | api |
| B08M-G-082 | `pytest apps/api/admin_ml_registry/tests/test_contract.py::test_ml_upload_version_takes_a_large_body_without_idempotency` | - | be |
| B08M-G-083 | `pytest apps/api/admin_ml_registry/tests/test_upload.py::test_ml_upload_version__C01` | - | be |
| B08M-G-084 | `pytest apps/api/admin_ml_registry/tests/test_upload.py::test_ml_upload_version__C02` | - | be |
| B08M-G-085 | `pytest apps/api/admin_ml_registry/tests/test_upload.py::test_upload_version_get_beats_the_deadline_while_streaming` | - | be |
| B08M-G-100 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-101 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-102 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-103 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-104 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-105 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-106 | `pytest apps/api/admin_ml_datasets/tests/test_read.py::test_ml_list_datasets__C01` | - | be |
| B08M-G-110 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-111 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-112 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-113 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-114 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-115 | `phase08_ml_b_api.spec.ts` | FL-B08M-09 | api |
| B08M-G-116 | `pytest apps/api/admin_ml_datasets/tests/test_read.py::test_ml_list_dataset_versions__C01_failed` | - | be |
| B08M-G-120 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-121 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-122 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-123 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-124 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-125 | `pytest apps/api/admin_ml_datasets/tests/test_write.py::test_ml_create_dataset__C14_concurrent_same_name` | - | be |
| B08M-G-126 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-127 | `phase08_ml_b_api.spec.ts` | FL-B08M-10 | api |
| B08M-G-128 | `pytest apps/api/admin_ml_datasets/tests/test_write.py::test_ml_create_dataset__C01` | - | be |
| B08M-G-130 | `phase08_ml_c_api.spec.ts` | FL-B08M-12 | api |
| B08M-G-131 | `phase08_ml_c_api.spec.ts` | FL-B08M-12 | api |
| B08M-G-132 | `phase08_ml_c_api.spec.ts` | FL-B08M-12 | api |
| B08M-G-133 | `phase08_ml_c_api.spec.ts` | FL-B08M-12 | api |
| B08M-G-134 | `phase08_ml_c_api.spec.ts` | FL-B08M-12 | api |
| B08M-G-135 | `pytest apps/api/admin_ml_datasets/tests/test_write.py::test_ml_build_dataset_version__C02_project_soft_deleted` | - | be |
| B08M-G-136 | `phase08_ml_c_api.spec.ts` | FL-B08M-12 | api |
| B08M-G-137 | `phase08_ml_c_api.spec.ts` | FL-B08M-12 | api |
| B08M-G-138 | `pytest apps/api/admin_ml_datasets/tests/test_contract.py::test_build_dataset_version_in_rejects_empty_project_ids` | - | be |
| B08M-G-139 | `pytest apps/api/admin_ml_datasets/tests/test_versions.py::test_check_failed_requires_failure_code_format` | - | be |
| B08M-G-150 | `phase08_ml_c_api.spec.ts` | FL-B08M-13 | api |
| B08M-G-151 | `phase08_ml_c_api.spec.ts` | FL-B08M-13 | api |
| B08M-G-152 | `phase08_ml_c_api.spec.ts` | FL-B08M-13 | api |
| B08M-G-153 | `phase08_ml_c_api.spec.ts` | FL-B08M-13 | api |
| B08M-G-154 | `phase08_ml_c_api.spec.ts` | FL-B08M-13 | api |
| B08M-G-155 | `phase08_ml_c_api.spec.ts` | FL-B08M-13 | api |
| B08M-G-156 | `phase08_ml_c_api.spec.ts` | FL-B08M-13 | api |
| B08M-G-157 | `phase08_ml_c_api.spec.ts` | FL-B08M-13 | api |
| B08M-G-158 | `pytest apps/api/admin_ml_jobs/tests/test_read.py::test_ml_list_jobs__C01` | - | be |
| B08M-G-160 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-161 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-162 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-163 | `pytest apps/api/admin_ml_jobs/tests/test_read.py::test_ml_read_job__C01_cancelled` | - | be |
| B08M-G-170 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-171 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-172 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-173 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-174 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-175 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-176 | `phase08_ml_c_api.spec.ts` | FL-B08M-14 | api |
| B08M-G-180 | `phase08_ml_c_api.spec.ts` | FL-B08M-15 | api |
| B08M-G-181 | `phase08_ml_c_api.spec.ts` | FL-B08M-15 | api |
| B08M-G-182 | `phase08_ml_c_api.spec.ts` | FL-B08M-15 | api |
| B08M-G-183 | `phase08_ml_c_api.spec.ts` | FL-B08M-15 | api |
| B08M-G-184 | `phase08_ml_c_api.spec.ts` | FL-B08M-15 | api |
| B08M-G-185 | `phase08_ml_c_api.spec.ts` | FL-B08M-15 | api |
| B08M-G-186 | `phase08_ml_c_api.spec.ts` | FL-B08M-15 | api |
| B08M-G-190 | `pytest apps/api/admin_ml_jobs/tests/test_progress.py::test_ml_list_job_metrics__C01` | - | be |
| B08M-G-192 | `pytest apps/api/admin_ml_jobs/tests/test_progress.py::test_ml_list_job_logs__C01` | - | be |
| B08M-G-200 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-201 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-202 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-203 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-204 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-205 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-206 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-207 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-208 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-209 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-210 | `phase08_ml_c_api.spec.ts` | FL-B08M-16 | api |
| B08M-G-211 | `pytest apps/api/admin_ml_jobs/tests/test_contract.py::test_create_training_job_in_rejects_a_malformed_dataset_version_id` | - | be |
| B08M-G-220 | `phase08_ml_c_api.spec.ts` | FL-B08M-17 | api |
| B08M-G-221 | `phase08_ml_c_api.spec.ts` | FL-B08M-17 | api |
| B08M-G-222 | `phase08_ml_c_api.spec.ts` | FL-B08M-17 | api |
| B08M-G-223 | `phase08_ml_c_api.spec.ts` | FL-B08M-17 | api |
| B08M-G-224 | `pytest apps/api/admin_ml_jobs/tests/test_contract.py::test_cancel_training_job_in_rejects_unknown_keys` | - | be |
| B08M-G-230 | `pytest apps/api/admin_ml_jobs/tests/test_contract.py::test_job_out_omits_bridge_columns` | - | be |
| B08M-G-231 | `pytest apps/api/admin_ml_datasets/tests/test_errors_settings.py::test_errors__status_and_failure_codes` | - | be |
| B08U-C-001 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-C-002 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-C-003 | `pytest apps/api/users/tests/test_delete.py::test_users_delete_user_self_is_rejected` | - | be |
| B08U-C-004 | `pytest apps/api/users/tests/test_service.py::test_forbid_self_reports_last_admin_first` | - | be |
| B08U-C-005 | `pytest apps/api/users/tests/test_service.py::test_forbid_self_allows_another_target` | - | be |
| B08U-C-006 | `pytest apps/api/users/tests/test_state.py::test_users_change_role_last_admin_is_rejected` | - | be |
| B08U-C-007 | `pytest apps/api/users/tests/test_delete.py::test_users_delete_user_last_admin_is_rejected` | - | be |
| B08U-C-008 | `pytest apps/api/users/tests/test_state.py::test_users_disable_user_twice_and_self` | - | be |
| B08U-C-009 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-C-010 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-C-011 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-C-012 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-C-013 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-C-014 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-C-015 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users_rejects_non_wire_emails` | - | be |
| B08U-C-016 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-C-017 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users_long_local_part_truncates_name` | - | be |
| B08U-C-018 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-C-019 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-C-020 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-C-021 | `pytest apps/api/users/tests/test_delete.py::test_users_delete_user_confirm_email_rejects_non_ascii_folding` | - | be |
| B08U-C-022 | `pytest apps/api/users/tests/test_delete.py::test_users_delete_user_confirm_email_is_compared_normalized` | - | be |
| B08U-C-023 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-C-024 | `phase08_users_b_api.spec.ts` | FL-B08U-05 | api |
| B08U-C-025 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-C-026 | `phase08_users_b_api.spec.ts` | FL-B08U-06 | api |
| B08U-C-027 | `phase08_users_b_api.spec.ts` | FL-B08U-06 | api |
| B08U-C-028 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-D-001 | `phase08_users_api.spec.ts` | FL-B08U-01 | api |
| B08U-D-002 | `phase08_users_api.spec.ts` | FL-B08U-01 | api |
| B08U-D-003 | `phase08_users_api.spec.ts` | FL-B08U-01 | api |
| B08U-D-004 | `phase08_users_api.spec.ts` | FL-B08U-01 | api |
| B08U-D-005 | `phase08_users_api.spec.ts` | FL-B08U-01 | api |
| B08U-D-006 | `phase08_users_api.spec.ts` | FL-B08U-01 | api |
| B08U-D-007 | `pytest apps/api/users/tests/test_state.py::test_users_change_role__C07` | - | be |
| B08U-D-008 | `phase08_users_b_api.spec.ts` | FL-B08U-05 | api |
| B08U-D-009 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-D-010 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-G-001 | `phase08_users_api.spec.ts` | FL-B08U-02 | api |
| B08U-G-002 | `phase08_users_api.spec.ts` | FL-B08U-02 | api |
| B08U-G-003 | `phase08_users_api.spec.ts` | FL-B08U-02 | api |
| B08U-G-004 | `phase08_users_api.spec.ts` | FL-B08U-02 | api |
| B08U-G-005 | `pytest apps/api/users/tests/test_read.py::test_users_list_users__C15` | - | be |
| B08U-G-006 | `pytest apps/api/users/tests/test_read.py::test_users_list_users_sql_count_is_flat` | - | be |
| B08U-G-007 | `pytest apps/api/users/tests/test_read.py::test_users_list_users__signs_all_avatars_in_one_batch` | - | be |
| B08U-G-008 | `pytest apps/api/users/tests/test_read.py::test_users_list_users__C17` | - | be |
| B08U-G-009 | `pytest apps/api/users/tests/test_read.py::test_users_list_users__invite_bounced` | - | be |
| B08U-G-010 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-G-011 | `phase08_users_api.spec.ts` | FL-B08U-02 | api |
| B08U-G-012 | `phase08_users_api.spec.ts` | FL-B08U-02 | api |
| B08U-G-013 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-G-014 | `pytest apps/api/users/tests/test_read.py::test_users_list_memberships__C15` | - | be |
| B08U-G-016 | `phase08_users_api.spec.ts` | FL-B08U-02 | api |
| B08U-G-017 | `phase08_users_api.spec.ts` | FL-B08U-02 | api |
| B08U-G-018 | `pytest apps/api/users/tests/test_read.py::test_users_list_activity__C15` | - | be |
| B08U-G-019 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-G-020 | `phase08_users_b_api.spec.ts` | FL-B08U-05 | api |
| B08U-G-021 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-022 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-G-023 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-G-024 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-G-025 | `pytest apps/api/users/tests/test_state.py::test_users_change_role__C21` | - | be |
| B08U-G-026 | `pytest apps/api/users/tests/test_state.py::test_users_change_role__C08` | - | be |
| B08U-G-027 | `pytest apps/api/users/tests/test_state.py::test_users_change_role__C03` | - | be |
| B08U-G-028 | `phase08_users_api.spec.ts` | FL-B08U-04 | api |
| B08U-G-029 | `pytest apps/api/users/tests/test_state.py::test_users_change_role_actor_demoted_in_db_is_forbidden` | - | be |
| B08U-G-030 | `pytest apps/api/users/tests/test_concurrency.py::test_users_change_role__C14` | - | be |
| B08U-G-031 | `pytest apps/api/users/tests/test_state.py::test_users_change_role__C01` | - | be |
| B08U-G-032 | `pytest apps/api/users/tests/test_state.py::test_users_change_role_revokes_old_access_token` | - | be |
| B08U-G-033 | `phase08_users_b_api.spec.ts` | FL-B08U-05 | api |
| B08U-G-034 | `phase08_users_b_api.spec.ts` | FL-B08U-05 | api |
| B08U-G-035 | `pytest apps/api/users/tests/test_state.py::test_users_disable_user__C03` | - | be |
| B08U-G-036 | `pytest apps/api/users/tests/test_state.py::test_users_disable_user__C08` | - | be |
| B08U-G-037 | `pytest apps/api/users/tests/test_state.py::test_users_disable_user_kills_every_session` | - | be |
| B08U-G-038 | `pytest apps/api/users/tests/test_concurrency.py::test_users_disable_user__C14` | - | be |
| B08U-G-039 | `phase08_users_b_api.spec.ts` | FL-B08U-06 | api |
| B08U-G-040 | `pytest apps/api/users/tests/test_state.py::test_users_disable_user__C01` | - | be |
| B08U-G-041 | `phase08_users_b_api.spec.ts` | FL-B08U-05 | api |
| B08U-G-042 | `phase08_users_b_api.spec.ts` | FL-B08U-06 | api |
| B08U-G-043 | `pytest apps/api/users/tests/test_state.py::test_users_enable_user_not_disabled_writes_nothing` | - | be |
| B08U-G-044 | `pytest apps/api/users/tests/test_state.py::test_users_enable_user__C08` | - | be |
| B08U-G-045 | `pytest apps/api/users/tests/test_state.py::test_users_enable_user__C01` | - | be |
| B08U-G-046 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-047 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-048 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-049 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-050 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-051 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users_batch_cap_counts_before_dedupe` | - | be |
| B08U-G-052 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users__C10` | - | be |
| B08U-G-053 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users__C11` | - | be |
| B08U-G-054 | `pytest apps/api/users/tests/test_e2e.py::test_invited_user_can_accept_and_sign_in` | - | be |
| B08U-G-055 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users_parallel_batches_in_opposite_order` | - | be |
| B08U-G-056 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users_lost_race_reuses_pending` | - | be |
| B08U-G-057 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users_lost_race_to_active_is_taken` | - | be |
| B08U-G-058 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users__C03` | - | be |
| B08U-G-059 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users__C18` | - | be |
| B08U-G-060 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users__C15` | - | be |
| B08U-G-061 | `pytest apps/api/users/tests/test_invite.py::test_users_invite_users__C01` | - | be |
| B08U-G-062 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-063 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-064 | `phase08_users_api.spec.ts` | FL-B08U-03 | api |
| B08U-G-065 | `pytest apps/api/users/tests/test_invite.py::test_users_resend_invitation__C01` | - | be |
| B08U-G-066 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-G-067 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-G-068 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-G-069 | `pytest apps/api/users/tests/test_delete.py::test_users_delete_user_removes_memberships_and_logs_orphans` | - | be |
| B08U-G-070 | `phase08_users_b_api.spec.ts` | FL-B08U-07 | api |
| B08U-G-071 | `pytest apps/api/users/tests/test_delete.py::test_users_delete_user__C03` | - | be |
| B08U-G-072 | `pytest apps/api/users/tests/test_concurrency.py::test_users_delete_user__C14` | - | be |
| B08U-G-073 | `pytest apps/api/users/tests/test_delete.py::test_users_delete_user__C01` | - | be |
| B08U-G-074 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-075 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-076 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-077 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-078 | `pytest apps/api/library/tests/test_routes.py::test_library_list_items__C15` | - | be |
| B08U-G-079 | `pytest apps/api/library/tests/test_routes.py::test_library_list_items__C01` | - | be |
| B08U-G-080 | `pytest apps/api/library/tests/test_routes.py::test_library_urls_absolute_stable_within_hour` | - | be |
| B08U-G-081 | `pytest apps/api/library/tests/test_routes.py::test_library_list_items__signs_every_url_in_one_batch` | - | be |
| B08U-G-082 | `pytest apps/api/library/tests/test_routes.py::test_library_mine_source_and_visibility` | - | be |
| B08U-G-083 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-084 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-085 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-086 | `pytest apps/api/library/tests/test_routes.py::test_library_read_item__C08` | - | be |
| B08U-G-087 | `pytest apps/api/library/tests/test_routes.py::test_library_read_item__C01` | - | be |
| B08U-G-088 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-089 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-090 | `phase08_library_api.spec.ts` | FL-B08U-08 | api |
| B08U-G-091 | `phase08_users_api.spec.ts` | FL-B08U-01 | api |
| B08U-G-092 | `phase08_users_api.spec.ts` | FL-B08U-01 | api |
