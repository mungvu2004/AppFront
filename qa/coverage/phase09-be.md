# Phase 09 coverage — ma trận quyền BE

Nguồn: catalog QA-09 C6. Layer `api` = `qa/tests/phase09_authz*_api.spec.ts`; layer `be` = pytest AppBack có dòng `Catalog: <id>.` trong docstring (nhánh `test/qa09-py`).

## Catalog C6 — BE ma trận quyền (tiền tố `B09`)

Nguồn: `apps/api/access/deps.py` (`require_role`/`require_permission`/`require_admin`), `apps/api/projects/access.py` (`require_project`: 404 người ngoài TRƯỚC 403 vai, dòng 91-99), `packages/domain/permissions/matrix.py` (vai toàn cục admin/engineer/viewer; khoá hệ thống `project.create`,`user.manage`,`library.manage`), mọi `apps/api/*/router.py`. BE main dc510655, chỉ đọc.

Quy ước: URL có tiền tố `/api`. Cổng chạy TRƯỚC guard 428/Pydantic/idempotency (docstring spatial_write, versions) nên payload tối thiểu/sai hình vẫn nhận 401/403/404: KHÔNG cần payload hợp lệ để chứng minh từ chối và không có ghi thật. Pytest: C06 = admin hệ thống không là thành viên -> 404; C07 = vai thiếu quyền -> 403.
Ẩn danh = không cookie/Bearer (`newApiContext()`). Vai = pool user `poolUser(admin, role, "p09-authz-<vai>")`; thành viên = `addProjectMember` vào dự án RIÊNG của luồng (`createProject`, dọn bằng `deleteSeededProject`); người ngoài = engineer/admin pool chưa thêm. Dòng `authz+` = đối chứng dương (chỉ endpoint ĐỌC). Nhóm D (vai/không-thành-viên) nằm chung bảng G theo cột case.

## admin_ml_datasets — files: `apps/api/admin_ml_datasets/router.py`, tests `apps/api/admin_ml_datasets/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-mld-001 | authz | ml_list_datasets: ẩn danh (không cookie/Bearer) GET /api/admin/ml/datasets | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mld-002 | authz | ml_list_datasets: viewer (vai toàn cục) GET /api/admin/ml/datasets | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mld-003 | authz | ml_list_datasets: engineer (vai toàn cục) GET /api/admin/ml/datasets | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_datasets/tests/test_contract.py::test_ml_list_datasets__C07 | real | pytest (db_session) |
| B09-mld-004 | authz+ | ml_list_datasets: admin đối chứng dương GET /api/admin/ml/datasets | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-mld-005 | authz | ml_create_dataset: ẩn danh (không cookie/Bearer) POST /api/admin/ml/datasets | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mld-006 | authz | ml_create_dataset: viewer (vai toàn cục) POST /api/admin/ml/datasets | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mld-007 | authz | ml_create_dataset: engineer (vai toàn cục) POST /api/admin/ml/datasets | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_datasets/tests/test_contract.py::test_ml_create_dataset__C07 | real | pytest (db_session) |
| B09-mld-008 | authz | ml_list_dataset_versions: ẩn danh (không cookie/Bearer) GET /api/admin/ml/datasets/{id}/versions | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mld-009 | authz | ml_list_dataset_versions: viewer (vai toàn cục) GET /api/admin/ml/datasets/{id}/versions | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mld-010 | authz | ml_list_dataset_versions: engineer (vai toàn cục) GET /api/admin/ml/datasets/{id}/versions | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_datasets/tests/test_contract.py::test_ml_list_dataset_versions__C07 | real | pytest (db_session) |
| B09-mld-011 | authz+ | ml_list_dataset_versions: admin đối chứng dương GET /api/admin/ml/datasets/{id}/versions | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-mld-012 | authz | ml_build_dataset_version: ẩn danh (không cookie/Bearer) POST /api/admin/ml/datasets/{id}/versions | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mld-013 | authz | ml_build_dataset_version: viewer (vai toàn cục) POST /api/admin/ml/datasets/{id}/versions | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mld-014 | authz | ml_build_dataset_version: engineer (vai toàn cục) POST /api/admin/ml/datasets/{id}/versions | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_datasets/tests/test_contract.py::test_ml_build_dataset_version__C07 | real | pytest (db_session) |

## admin_ml_jobs — files: `apps/api/admin_ml_jobs/router.py`, tests `apps/api/admin_ml_jobs/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-mlj-001 | authz | ml_list_jobs: ẩn danh (không cookie/Bearer) GET /api/admin/ml/training-jobs | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlj-002 | authz | ml_list_jobs: viewer (vai toàn cục) GET /api/admin/ml/training-jobs | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlj-003 | authz | ml_list_jobs: engineer (vai toàn cục) GET /api/admin/ml/training-jobs | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_jobs/tests/test_contract.py::test_ml_list_jobs__C07 | real | pytest (db_session) |
| B09-mlj-004 | authz+ | ml_list_jobs: admin đối chứng dương GET /api/admin/ml/training-jobs | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-mlj-005 | authz | ml_create_job: ẩn danh (không cookie/Bearer) POST /api/admin/ml/training-jobs | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlj-006 | authz | ml_create_job: viewer (vai toàn cục) POST /api/admin/ml/training-jobs | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlj-007 | authz | ml_create_job: engineer (vai toàn cục) POST /api/admin/ml/training-jobs | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_jobs/tests/test_contract.py::test_ml_create_job__C07 | real | pytest (db_session) |
| B09-mlj-008 | authz | ml_read_job: ẩn danh (không cookie/Bearer) GET /api/admin/ml/training-jobs/{id} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlj-009 | authz | ml_read_job: viewer (vai toàn cục) GET /api/admin/ml/training-jobs/{id} | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlj-010 | authz | ml_read_job: engineer (vai toàn cục) GET /api/admin/ml/training-jobs/{id} | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_jobs/tests/test_contract.py::test_ml_read_job__C07 | real | pytest (db_session) |
| B09-mlj-011 | authz+ | ml_read_job: admin đối chứng dương GET /api/admin/ml/training-jobs/{id} | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-mlj-012 | authz | ml_cancel_job: ẩn danh (không cookie/Bearer) POST /api/admin/ml/training-jobs/{id}/cancel | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlj-013 | authz | ml_cancel_job: viewer (vai toàn cục) POST /api/admin/ml/training-jobs/{id}/cancel | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlj-014 | authz | ml_cancel_job: engineer (vai toàn cục) POST /api/admin/ml/training-jobs/{id}/cancel | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_jobs/tests/test_contract.py::test_ml_cancel_job__C07 | real | pytest (db_session) |
| B09-mlj-015 | authz | ml_list_job_metrics: ẩn danh (không cookie/Bearer) GET /api/admin/ml/training-jobs/{id}/metrics | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlj-016 | authz | ml_list_job_metrics: viewer (vai toàn cục) GET /api/admin/ml/training-jobs/{id}/metrics | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlj-017 | authz | ml_list_job_metrics: engineer (vai toàn cục) GET /api/admin/ml/training-jobs/{id}/metrics | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_jobs/tests/test_contract.py::test_ml_list_job_metrics__C07 | real | pytest (db_session) |
| B09-mlj-018 | authz+ | ml_list_job_metrics: admin đối chứng dương GET /api/admin/ml/training-jobs/{id}/metrics | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-mlj-019 | authz | ml_list_job_logs: ẩn danh (không cookie/Bearer) GET /api/admin/ml/training-jobs/{id}/logs | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlj-020 | authz | ml_list_job_logs: viewer (vai toàn cục) GET /api/admin/ml/training-jobs/{id}/logs | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlj-021 | authz | ml_list_job_logs: engineer (vai toàn cục) GET /api/admin/ml/training-jobs/{id}/logs | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_jobs/tests/test_contract.py::test_ml_list_job_logs__C07 | real | pytest (db_session) |
| B09-mlj-022 | authz+ | ml_list_job_logs: admin đối chứng dương GET /api/admin/ml/training-jobs/{id}/logs | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |

## admin_ml_registry — files: `apps/api/admin_ml_registry/router.py`, tests `apps/api/admin_ml_registry/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-mlr-001 | authz | ml_list_families: ẩn danh (không cookie/Bearer) GET /api/admin/ml/model-families | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlr-002 | authz | ml_list_families: viewer (vai toàn cục) GET /api/admin/ml/model-families | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlr-003 | authz | ml_list_families: engineer (vai toàn cục) GET /api/admin/ml/model-families | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_registry/tests/test_contract.py::test_ml_list_families__C07 | real | pytest (db_session) |
| B09-mlr-004 | authz+ | ml_list_families: admin đối chứng dương GET /api/admin/ml/model-families | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-mlr-005 | authz | ml_activate_version: ẩn danh (không cookie/Bearer) PUT /api/admin/ml/model-families/{family}/active | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlr-006 | authz | ml_activate_version: viewer (vai toàn cục) PUT /api/admin/ml/model-families/{family}/active | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlr-007 | authz | ml_activate_version: engineer (vai toàn cục) PUT /api/admin/ml/model-families/{family}/active | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_registry/tests/test_contract.py::test_ml_activate_version__C07 | real | pytest (db_session) |
| B09-mlr-008 | authz | ml_list_versions: ẩn danh (không cookie/Bearer) GET /api/admin/ml/model-versions | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlr-009 | authz | ml_list_versions: viewer (vai toàn cục) GET /api/admin/ml/model-versions | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlr-010 | authz | ml_list_versions: engineer (vai toàn cục) GET /api/admin/ml/model-versions | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_registry/tests/test_contract.py::test_ml_list_versions__C07 | real | pytest (db_session) |
| B09-mlr-011 | authz+ | ml_list_versions: admin đối chứng dương GET /api/admin/ml/model-versions | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-mlr-012 | authz | ml_upload_version: ẩn danh (không cookie/Bearer) POST /api/admin/ml/model-versions | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlr-013 | authz | ml_upload_version: viewer (vai toàn cục) POST /api/admin/ml/model-versions | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlr-014 | authz | ml_upload_version: engineer (vai toàn cục) POST /api/admin/ml/model-versions | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_registry/tests/test_contract.py::test_ml_upload_version__C07 | real | pytest (db_session) |
| B09-mlr-015 | authz | ml_read_version: ẩn danh (không cookie/Bearer) GET /api/admin/ml/model-versions/{id} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mlr-016 | authz | ml_read_version: viewer (vai toàn cục) GET /api/admin/ml/model-versions/{id} | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(viewer,"admin")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-mlr-017 | authz | ml_read_version: engineer (vai toàn cục) GET /api/admin/ml/model-versions/{id} | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_admin) | `can(engineer,"admin")`=false -> 403 | be | covered | py:admin_ml_registry/tests/test_contract.py::test_ml_read_version__C07 | real | pytest (db_session) |
| B09-mlr-018 | authz+ | ml_read_version: admin đối chứng dương GET /api/admin/ml/model-versions/{id} | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |

## users — files: `apps/api/users/router.py`, tests `apps/api/users/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-usr-001 | authz | users_list_users: ẩn danh (không cookie/Bearer) GET /api/users | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-002 | authz | users_list_users: viewer (vai toàn cục) GET /api/users | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-003 | authz | users_list_users: engineer (vai toàn cục) GET /api/users | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_read.py::test_users_list_users__C07 | real | pytest (db_session) |
| B09-usr-004 | authz+ | users_list_users: admin đối chứng dương GET /api/users | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-usr-005 | authz | users_invite_users: ẩn danh (không cookie/Bearer) POST /api/users/invitations | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-006 | authz | users_invite_users: viewer (vai toàn cục) POST /api/users/invitations | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-007 | authz | users_invite_users: engineer (vai toàn cục) POST /api/users/invitations | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_invite.py::test_users_invite_users__C07 | real | pytest (db_session) |
| B09-usr-008 | authz | users_resend_invitation: ẩn danh (không cookie/Bearer) POST /api/users/invitations/{uid}/resend | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-009 | authz | users_resend_invitation: viewer (vai toàn cục) POST /api/users/invitations/{uid}/resend | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-010 | authz | users_resend_invitation: engineer (vai toàn cục) POST /api/users/invitations/{uid}/resend | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_invite.py::test_users_resend_invitation__C07 | real | pytest (db_session) |
| B09-usr-011 | authz | users_list_memberships: ẩn danh (không cookie/Bearer) GET /api/users/{uid}/memberships | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-012 | authz | users_list_memberships: viewer (vai toàn cục) GET /api/users/{uid}/memberships | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-013 | authz | users_list_memberships: engineer (vai toàn cục) GET /api/users/{uid}/memberships | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_read.py::test_users_list_memberships__C07 | real | pytest (db_session) |
| B09-usr-014 | authz+ | users_list_memberships: admin đối chứng dương GET /api/users/{uid}/memberships | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-usr-015 | authz | users_list_activity: ẩn danh (không cookie/Bearer) GET /api/users/{uid}/activity | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-016 | authz | users_list_activity: viewer (vai toàn cục) GET /api/users/{uid}/activity | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-017 | authz | users_list_activity: engineer (vai toàn cục) GET /api/users/{uid}/activity | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_read.py::test_users_list_activity__C07 | real | pytest (db_session) |
| B09-usr-018 | authz+ | users_list_activity: admin đối chứng dương GET /api/users/{uid}/activity | 200 (không 403; mã khác 200 nếu id giả -> 404 resource, vẫn không 403) | admin thuộc tập vai được phép | api | missing | - | real | pool admin |
| B09-usr-019 | authz | users_change_role: ẩn danh (không cookie/Bearer) PATCH /api/users/{uid}/role | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-020 | authz | users_change_role: viewer (vai toàn cục) PATCH /api/users/{uid}/role | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-021 | authz | users_change_role: engineer (vai toàn cục) PATCH /api/users/{uid}/role | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_state.py::test_users_change_role__C07 | real | pytest (db_session) |
| B09-usr-022 | authz | users_disable_user: ẩn danh (không cookie/Bearer) POST /api/users/{uid}/disable | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-023 | authz | users_disable_user: viewer (vai toàn cục) POST /api/users/{uid}/disable | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-024 | authz | users_disable_user: engineer (vai toàn cục) POST /api/users/{uid}/disable | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_state.py::test_users_disable_user__C07 | real | pytest (db_session) |
| B09-usr-025 | authz | users_enable_user: ẩn danh (không cookie/Bearer) POST /api/users/{uid}/enable | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-026 | authz | users_enable_user: viewer (vai toàn cục) POST /api/users/{uid}/enable | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-027 | authz | users_enable_user: engineer (vai toàn cục) POST /api/users/{uid}/enable | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_state.py::test_users_enable_user__C07 | real | pytest (db_session) |
| B09-usr-028 | authz | users_delete_user: ẩn danh (không cookie/Bearer) DELETE /api/users/{uid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-usr-029 | authz | users_delete_user: viewer (vai toàn cục) DELETE /api/users/{uid} | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(viewer,"user.manage")`=false -> 403 | api | missing | - | real | dự án riêng + pool user |
| B09-usr-030 | authz | users_delete_user: engineer (vai toàn cục) DELETE /api/users/{uid} | 403 `FORBIDDEN` (access/deps.py:44 `gate`; require_permission("user.manage")) | `can(engineer,"user.manage")`=false -> 403 | be | covered | py:users/tests/test_delete.py::test_users_delete_user__C07 | real | pytest (db_session) |

## projects — files: `apps/api/projects/router.py`, tests `apps/api/projects/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-prj-001 | authz | projects_create_project: ẩn danh (không cookie/Bearer) POST /api/projects | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-prj-002 | authz | projects_create_project: viewer POST /api/projects | 403 `FORBIDDEN` (access/deps.py:44; require_permission("project.create")) | `can(viewer,"project.create")`=false | be | covered | py:projects/tests/test_routes_write.py::test_projects_create_project__C07 | real | pytest (db_session) |
| B09-prj-003 | authz | projects_read_project: ẩn danh (không cookie/Bearer) GET /api/projects/{pid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-prj-004 | authz | projects_read_project: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid} | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:projects/tests/test_routes_read.py::test_projects_read_project__C06 | real | pytest (db_session) |
| B09-prj-005 | authz+ | projects_read_project: viewer thành viên đối chứng dương GET /api/projects/{pid} | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-prj-006 | authz | projects_update_project: ẩn danh (không cookie/Bearer) PATCH /api/projects/{pid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-prj-007 | authz | projects_update_project: viewer là thành viên PATCH /api/projects/{pid} | 403 `FORBIDDEN` (projects/access.py:99; khoá `project.settings.edit`) | `can(viewer,"project.settings.edit")`=false (matrix.py) | be | covered | py:projects/tests/test_routes_write.py::test_projects_update_project__C07 | real | pytest (db_session) |
| B09-prj-008 | authz | projects_update_project: không phải thành viên dự án (admin hệ thống) PATCH /api/projects/{pid} | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:projects/tests/test_routes_write.py::test_projects_update_project__C06 | real | pytest (db_session) |
| B09-prj-009 | authz | projects_delete_project: ẩn danh (không cookie/Bearer) DELETE /api/projects/{pid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-prj-010 | authz | projects_delete_project: viewer là thành viên DELETE /api/projects/{pid} | 403 `FORBIDDEN` (projects/access.py:99; khoá `admin`) | `can(viewer,"admin")`=false (matrix.py) | be | covered | py:projects/tests/test_routes_write.py::test_projects_delete_project__C07 | real | pytest (db_session) |
| B09-prj-011 | authz | projects_delete_project: engineer là thành viên DELETE /api/projects/{pid} | 403 `FORBIDDEN` (projects/access.py:95-99; vai hệ thống admin) | engineer không thuộc {admin} cho `admin` | be | covered | py:projects/tests/test_routes_write.py::test_delete_project_engineer_member_is_forbidden | real | pytest (db_session) |
| B09-prj-012 | authz | projects_delete_project: không phải thành viên dự án (admin hệ thống) DELETE /api/projects/{pid} | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:projects/tests/test_routes_write.py::test_projects_delete_project__C06 | real | pytest (db_session) |
| B09-prj-013 | authz | projects_list_projects/projects_list_summaries: viewer chỉ thấy dự án mình là thành viên (GET /api/projects, /api/project-summaries) | 200, danh sách không chứa dự án không-thành-viên (projects/router.py:44,88) | lọc theo ProjectMembership của principal | api | missing | - | real | dự án riêng + pool user |
| B09-prj-014 | authz | projects_list_projects: ẩn danh GET /api/projects | 401 `UNAUTHENTICATED` | không token | api | missing | - | real | không |

## project_members — files: `apps/api/project_members/router.py`, tests `apps/api/project_members/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-mem-001 | authz | members_add_member: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/members | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mem-002 | authz | members_add_member: viewer là thành viên POST /api/projects/{pid}/members | 403 `FORBIDDEN` (projects/access.py:99; khoá `project.settings.edit`) | `can(viewer,"project.settings.edit")`=false (matrix.py) | be | covered | py:project_members/tests/test_add_member.py::test_members_add_member__C07 | real | pytest (db_session) |
| B09-mem-003 | authz | members_add_member: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/members | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:project_members/tests/test_add_member.py::test_members_add_member__C06 | real | pytest (db_session) |
| B09-mem-004 | authz | members_remove_member: ẩn danh (không cookie/Bearer) DELETE /api/projects/{pid}/members/{uid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-mem-005 | authz | members_remove_member: viewer là thành viên DELETE /api/projects/{pid}/members/{uid} | 403 `FORBIDDEN` (projects/access.py:99; khoá `project.settings.edit`) | `can(viewer,"project.settings.edit")`=false (matrix.py) | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__C07 | real | pytest (db_session) |
| B09-mem-006 | authz | members_remove_member: không phải thành viên dự án (admin hệ thống) DELETE /api/projects/{pid}/members/{uid} | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__C06 | real | pytest (db_session) |

## project_settings — files: `apps/api/project_settings/router.py`, tests `apps/api/project_settings/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-set-001 | authz | settings_read_settings: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/settings | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-set-002 | authz | settings_read_settings: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/settings | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:project_settings/tests/test_routes_read.py::test_settings_read_settings__C06 | real | pytest (db_session) |
| B09-set-003 | authz+ | settings_read_settings: viewer thành viên đối chứng dương GET /api/projects/{pid}/settings | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-set-004 | authz | settings_replace_settings: ẩn danh (không cookie/Bearer) PUT /api/projects/{pid}/settings | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-set-005 | authz | settings_replace_settings: viewer là thành viên PUT /api/projects/{pid}/settings | 403 `FORBIDDEN` (projects/access.py:99; khoá `project.settings.edit`) | `can(viewer,"project.settings.edit")`=false (matrix.py) | be | covered | py:project_settings/tests/test_routes_replace.py::test_settings_replace_settings__C07 | real | pytest (db_session) |
| B09-set-006 | authz | settings_replace_settings: không phải thành viên dự án (admin hệ thống) PUT /api/projects/{pid}/settings | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:project_settings/tests/test_routes_replace.py::test_settings_replace_settings__C06 | real | pytest (db_session) |

## rules — files: `apps/api/rules/router.py`, tests `apps/api/rules/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-rul-001 | authz | rules_read_config: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/rule-config | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-rul-002 | authz | rules_read_config: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/rule-config | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:rules/tests/test_routes_read.py::test_rules_read_config__C06 | real | pytest (db_session) |
| B09-rul-003 | authz+ | rules_read_config: viewer thành viên đối chứng dương GET /api/projects/{pid}/rule-config | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-rul-004 | authz | rules_replace_config: ẩn danh (không cookie/Bearer) PUT /api/projects/{pid}/rule-config | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-rul-005 | authz | rules_replace_config: viewer là thành viên PUT /api/projects/{pid}/rule-config | 403 `FORBIDDEN` (projects/access.py:99; khoá `ruleset.edit`) | `can(viewer,"ruleset.edit")`=false (matrix.py) | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C07 | real | pytest (db_session) |
| B09-rul-006 | authz | rules_replace_config: engineer là thành viên PUT /api/projects/{pid}/rule-config | 403 `FORBIDDEN` (projects/access.py:95-99; ruleset.edit chỉ admin) | engineer không thuộc {admin} cho `ruleset.edit` | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C07 | real | pytest (db_session) |
| B09-rul-007 | authz | rules_replace_config: không phải thành viên dự án (admin hệ thống) PUT /api/projects/{pid}/rule-config | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C06 | real | pytest (db_session) |

## floors — files: `apps/api/floors/router.py`, tests `apps/api/floors/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-flr-001 | authz | floors_list_floors: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/floors | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-flr-002 | authz | floors_list_floors: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/floors | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:floors/tests/test_routes_list.py::test_floors_list_floors__C06 | real | pytest (db_session) |
| B09-flr-003 | authz+ | floors_list_floors: viewer thành viên đối chứng dương GET /api/projects/{pid}/floors | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-flr-004 | authz | floors_create_floor: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/floors | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-flr-005 | authz | floors_create_floor: viewer là thành viên POST /api/projects/{pid}/floors | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:floors/tests/test_routes_create.py::test_floors_create_floor__C07 | real | pytest (db_session) |
| B09-flr-006 | authz | floors_create_floor: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/floors | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:floors/tests/test_routes_create.py::test_floors_create_floor__C06 | real | pytest (db_session) |
| B09-flr-007 | authz | floors_delete_floor: ẩn danh (không cookie/Bearer) DELETE /api/floors/{fid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-flr-008 | authz | floors_delete_floor: viewer là thành viên DELETE /api/floors/{fid} | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__C07 | real | pytest (db_session) |
| B09-flr-009 | authz | floors_delete_floor: không phải thành viên dự án (admin hệ thống) DELETE /api/floors/{fid} | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__C06 | real | pytest (db_session) |
| B09-flr-010 | authz | floors_reorder_floors: ẩn danh (không cookie/Bearer) PATCH /api/floors/reorder | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-flr-011 | authz | floors_reorder_floors: viewer là thành viên PATCH /api/floors/reorder | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:floors/tests/test_routes_reorder.py::test_floors_reorder_floors__C07 | real | pytest (db_session) |
| B09-flr-012 | authz | floors_reorder_floors: không phải thành viên dự án (admin hệ thống) PATCH /api/floors/reorder | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:floors/tests/test_routes_reorder.py::test_floors_reorder_floors__C06 | real | pytest (db_session) |
| B09-flr-013 | authz | floors_patch_spatial_floor: ẩn danh (không cookie/Bearer) PATCH /api/projects/{pid}/floors/{fid}/spatial | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-flr-014 | authz | floors_patch_spatial_floor: viewer là thành viên PATCH /api/projects/{pid}/floors/{fid}/spatial | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:floors/tests/test_routes_patch.py::test_floors_patch_spatial_floor__C07 | real | pytest (db_session) |
| B09-flr-015 | authz | floors_patch_spatial_floor: không phải thành viên dự án (admin hệ thống) PATCH /api/projects/{pid}/floors/{fid}/spatial | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:floors/tests/test_routes_patch.py::test_floors_patch_spatial_floor__C06 | real | pytest (db_session) |

## spatial_read — files: `apps/api/spatial_read/router.py`, tests `apps/api/spatial_read/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-spr-001 | authz | spatial_read_floor: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/floors/{fid}/spatial | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-spr-002 | authz | spatial_read_floor: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/floors/{fid}/spatial | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:spatial_read/tests/test_routes_floor.py::test_spatial_read_floor__C06 | real | pytest (db_session) |
| B09-spr-003 | authz+ | spatial_read_floor: viewer thành viên đối chứng dương GET /api/projects/{pid}/floors/{fid}/spatial | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-spr-004 | authz | spatial_read_graph: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/spatial | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-spr-005 | authz | spatial_read_graph: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/spatial | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:spatial_read/tests/test_routes_graph.py::test_spatial_read_graph__C06 | real | pytest (db_session) |
| B09-spr-006 | authz+ | spatial_read_graph: viewer thành viên đối chứng dương GET /api/projects/{pid}/spatial | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-spr-007 | authz | spatial_read_layer: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/floors/{fid}/spatial/layer | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-spr-008 | authz | spatial_read_layer: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/floors/{fid}/spatial/layer | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:spatial_read/tests/test_routes_layer.py::test_spatial_read_layer__C06 | real | pytest (db_session) |
| B09-spr-009 | authz+ | spatial_read_layer: viewer thành viên đối chứng dương GET /api/projects/{pid}/floors/{fid}/spatial/layer | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |

## spatial_write — files: `apps/api/spatial_write/router.py`, tests `apps/api/spatial_write/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-spw-001 | authz | spatial_write_layer: ẩn danh (không cookie/Bearer) PUT /api/projects/{pid}/floors/{fid}/spatial/layer | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-spw-002 | authz | spatial_write_layer: viewer là thành viên PUT /api/projects/{pid}/floors/{fid}/spatial/layer | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:spatial_write/tests/test_routes.py::test_spatial_write_layer__C07 | real | pytest (db_session) |
| B09-spw-003 | authz | spatial_write_layer: không phải thành viên dự án (admin hệ thống) PUT /api/projects/{pid}/floors/{fid}/spatial/layer | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:spatial_write/tests/test_routes.py::test_spatial_write_layer__C06 | real | pytest (db_session) |

## drawings — files: `apps/api/drawings/router.py`, tests `apps/api/drawings/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-drw-001 | authz | drawings_init_upload: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/floors/{fid}/drawings/uploads | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-drw-002 | authz | drawings_init_upload: viewer là thành viên POST /api/projects/{pid}/floors/{fid}/drawings/uploads | 403 `FORBIDDEN` (projects/access.py:99; khoá `floor.upload`) | `can(viewer,"floor.upload")`=false (matrix.py) | be | covered | py:drawings/tests/test_routes_init.py::test_drawings_init_upload__C07 | real | pytest (db_session) |
| B09-drw-003 | authz | drawings_init_upload: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/floors/{fid}/drawings/uploads | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:drawings/tests/test_routes_init.py::test_drawings_init_upload__C06 | real | pytest (db_session) |
| B09-drw-004 | authz | drawings_upload_chunk: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/drawings/uploads/{uploadId}/chunks | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-drw-005 | authz | drawings_upload_chunk: viewer là thành viên POST /api/projects/{pid}/drawings/uploads/{uploadId}/chunks | 403 `FORBIDDEN` (projects/access.py:99; khoá `floor.upload`) | `can(viewer,"floor.upload")`=false (matrix.py) | api | missing | - | real | dự án riêng + pool user |
| B09-drw-006 | authz | drawings_upload_chunk: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/drawings/uploads/{uploadId}/chunks | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:drawings/tests/test_routes_chunk.py::test_drawings_upload_chunk__C06 | real | pytest (db_session) |
| B09-drw-007 | authz | drawings_complete_upload: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/drawings/uploads/{uploadId}/complete | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-drw-008 | authz | drawings_complete_upload: viewer là thành viên POST /api/projects/{pid}/drawings/uploads/{uploadId}/complete | 403 `FORBIDDEN` (projects/access.py:99; khoá `floor.upload`) | `can(viewer,"floor.upload")`=false (matrix.py) | api | missing | - | real | dự án riêng + pool user |
| B09-drw-009 | authz | drawings_complete_upload: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/drawings/uploads/{uploadId}/complete | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:drawings/tests/test_routes_complete.py::test_drawings_complete_upload__C06 | real | pytest (db_session) |
| B09-drw-010 | authz | drawings_read_progress: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/drawings/uploads/{uploadId}/progress | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-drw-011 | authz | drawings_read_progress: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/drawings/uploads/{uploadId}/progress | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:drawings/tests/test_routes_progress.py::test_drawings_read_progress__C06 | real | pytest (db_session) |
| B09-drw-012 | authz+ | drawings_read_progress: viewer thành viên đối chứng dương GET /api/projects/{pid}/drawings/uploads/{uploadId}/progress | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |

## streams — files: `apps/api/streams/router.py`, tests `apps/api/streams/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-str-001 | authz | streams_open_progress: ẩn danh (không cookie/Bearer) GET /api/streams/projects/{pid}/uploads/{uploadId}/progress (SSE) | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-str-002 | authz | streams_open_progress: không phải thành viên dự án (admin hệ thống) GET /api/streams/projects/{pid}/uploads/{uploadId}/progress (SSE) | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | api | missing | - | real | dự án riêng + pool user |
| B09-str-003 | authz+ | streams_open_progress: viewer thành viên đối chứng dương GET /api/streams/projects/{pid}/uploads/{uploadId}/progress (SSE) | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-str-004 | authz | streams_open_notifications: ẩn danh GET /api/streams/notifications (SSE) | 401 `UNAUTHENTICATED` (streams/router.py authenticate_stream) | không token | api | missing | - | real | không |

## quality — files: `apps/api/quality/router.py`, tests `apps/api/quality/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-qlt-001 | authz | quality_read_assessment: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/floors/{fid}/quality | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-qlt-002 | authz | quality_read_assessment: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/floors/{fid}/quality | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:quality/tests/test_routes_read.py::test_quality_read_assessment__C06 | real | pytest (db_session) |
| B09-qlt-003 | authz+ | quality_read_assessment: viewer thành viên đối chứng dương GET /api/projects/{pid}/floors/{fid}/quality | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-qlt-004 | authz | quality_set_corners: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/floors/{fid}/quality/corners | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-qlt-005 | authz | quality_set_corners: viewer là thành viên POST /api/projects/{pid}/floors/{fid}/quality/corners | 403 `FORBIDDEN` (projects/access.py:99; khoá `floor.upload`) | `can(viewer,"floor.upload")`=false (matrix.py) | be | covered | py:quality/tests/test_routes_corners.py::test_quality_set_corners__C07 | real | pytest (db_session) |
| B09-qlt-006 | authz | quality_set_corners: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/floors/{fid}/quality/corners | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:quality/tests/test_routes_corners.py::test_quality_set_corners__C06 | real | pytest (db_session) |
| B09-qlt-007 | authz | quality_straighten: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/floors/{fid}/quality/straighten | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-qlt-008 | authz | quality_straighten: viewer là thành viên POST /api/projects/{pid}/floors/{fid}/quality/straighten | 403 `FORBIDDEN` (projects/access.py:99; khoá `floor.upload`) | `can(viewer,"floor.upload")`=false (matrix.py) | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C07 | real | pytest (db_session) |
| B09-qlt-009 | authz | quality_straighten: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/floors/{fid}/quality/straighten | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C06 | real | pytest (db_session) |

## templates — files: `apps/api/templates/router.py`, tests `apps/api/templates/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-tpl-001 | authz | templates_list_templates: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/property-templates | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-tpl-002 | authz | templates_list_templates: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/property-templates | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:templates/tests/test_routes.py::test_templates_list_templates__C06 | real | pytest (db_session) |
| B09-tpl-003 | authz+ | templates_list_templates: viewer thành viên đối chứng dương GET /api/projects/{pid}/property-templates | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-tpl-004 | authz | templates_create_template: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/property-templates | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-tpl-005 | authz | templates_create_template: viewer là thành viên POST /api/projects/{pid}/property-templates | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:templates/tests/test_routes.py::test_templates_create_template__C07 | real | pytest (db_session) |
| B09-tpl-006 | authz | templates_create_template: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/property-templates | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:templates/tests/test_routes.py::test_templates_create_template__C06 | real | pytest (db_session) |

## measurements — files: `apps/api/measurements/router.py`, tests `apps/api/measurements/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-msr-001 | authz | measurements_list_records: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/measurements | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-msr-002 | authz | measurements_list_records: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/measurements | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_list_records__C06 | real | pytest (db_session) |
| B09-msr-003 | authz+ | measurements_list_records: viewer thành viên đối chứng dương GET /api/projects/{pid}/measurements | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-msr-004 | authz | measurements_create_record: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/measurements | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-msr-005 | authz | measurements_create_record: viewer là thành viên POST /api/projects/{pid}/measurements | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:measurements/tests/test_routes_create.py::test_measurements_create_record__C07 | real | pytest (db_session) |
| B09-msr-006 | authz | measurements_create_record: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/measurements | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:measurements/tests/test_routes_create.py::test_measurements_create_record__C06 | real | pytest (db_session) |
| B09-msr-007 | authz | measurements_delete_record: ẩn danh (không cookie/Bearer) DELETE /api/projects/{pid}/measurements/{mid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-msr-008 | authz | measurements_delete_record: viewer là thành viên DELETE /api/projects/{pid}/measurements/{mid} | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__C07 | real | pytest (db_session) |
| B09-msr-009 | authz | measurements_delete_record: không phải thành viên dự án (admin hệ thống) DELETE /api/projects/{pid}/measurements/{mid} | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__C06 | real | pytest (db_session) |

## versions — files: `apps/api/versions/router.py`, tests `apps/api/versions/tests/`

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B09-ver-001 | authz | versions_list_versions: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/versions | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-ver-002 | authz | versions_list_versions: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/versions | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:versions/tests/test_routes_list.py::test_versions_list_versions__C06 | real | pytest (db_session) |
| B09-ver-003 | authz+ | versions_list_versions: viewer thành viên đối chứng dương GET /api/projects/{pid}/versions | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-ver-004 | authz | versions_read_version: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/versions/{vid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-ver-005 | authz | versions_read_version: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/versions/{vid} | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:versions/tests/test_routes_read.py::test_versions_read_version__C06 | real | pytest (db_session) |
| B09-ver-006 | authz+ | versions_read_version: viewer thành viên đối chứng dương GET /api/projects/{pid}/versions/{vid} | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-ver-007 | authz | versions_read_snapshot: ẩn danh (không cookie/Bearer) GET /api/projects/{pid}/versions/{vid}/snapshot | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-ver-008 | authz | versions_read_snapshot: không phải thành viên dự án (admin hệ thống) GET /api/projects/{pid}/versions/{vid}/snapshot | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:versions/tests/test_routes_read.py::test_versions_read_snapshot__C06 | real | pytest (db_session) |
| B09-ver-009 | authz+ | versions_read_snapshot: viewer thành viên đối chứng dương GET /api/projects/{pid}/versions/{vid}/snapshot | 200 (đọc cho mọi thành viên, require_project() không khoá quyền) | permission=None -> allowed | api | missing | - | real | dự án riêng + pool user |
| B09-ver-010 | authz | versions_restore_version: ẩn danh (không cookie/Bearer) POST /api/projects/{pid}/versions/{vid}/restore | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-ver-011 | authz | versions_restore_version: viewer là thành viên POST /api/projects/{pid}/versions/{vid}/restore | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C07 | real | pytest (db_session) |
| B09-ver-012 | authz | versions_restore_version: không phải thành viên dự án (admin hệ thống) POST /api/projects/{pid}/versions/{vid}/restore | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C06 | real | pytest (db_session) |
| B09-ver-013 | authz | versions_label_version: ẩn danh (không cookie/Bearer) PATCH /api/projects/{pid}/versions/{vid}/label | 401 `UNAUTHENTICATED` (core/auth.py:77,87; protected_router) | không token -> AppError 401, thân không lộ dữ liệu | api | missing | - | real | không |
| B09-ver-014 | authz | versions_label_version: viewer là thành viên PATCH /api/projects/{pid}/versions/{vid}/label | 403 `FORBIDDEN` (projects/access.py:99; khoá `layer.edit`) | `can(viewer,"layer.edit")`=false (matrix.py) | be | covered | py:versions/tests/test_routes_label.py::test_versions_label_version__C07 | real | pytest (db_session) |
| B09-ver-015 | authz | versions_label_version: không phải thành viên dự án (admin hệ thống) PATCH /api/projects/{pid}/versions/{vid}/label | 404 `NOT_FOUND` resource `project` — không phải 403 (projects/access.py:91; K08) | không có dòng ProjectMembership -> 404 trước mọi kiểm quyền, kể cả admin | be | covered | py:versions/tests/test_routes_label.py::test_versions_label_version__C06 | real | pytest (db_session) |

## Tóm tắt

| router | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| admin_ml_datasets | 14 | 0 | 14 | 4 | 0 | 10 | 0 | 0 |
| admin_ml_jobs | 22 | 0 | 22 | 6 | 0 | 16 | 0 | 0 |
| admin_ml_registry | 18 | 0 | 18 | 5 | 0 | 13 | 0 | 0 |
| users | 30 | 0 | 30 | 9 | 0 | 21 | 0 | 0 |
| projects | 14 | 0 | 14 | 7 | 0 | 7 | 0 | 0 |
| project_members | 6 | 0 | 6 | 4 | 0 | 2 | 0 | 0 |
| project_settings | 6 | 0 | 6 | 3 | 0 | 3 | 0 | 0 |
| rules | 7 | 0 | 7 | 4 | 0 | 3 | 0 | 0 |
| floors | 15 | 0 | 15 | 9 | 0 | 6 | 0 | 0 |
| spatial_read | 9 | 0 | 9 | 3 | 0 | 6 | 0 | 0 |
| spatial_write | 3 | 0 | 3 | 2 | 0 | 1 | 0 | 0 |
| drawings | 12 | 0 | 12 | 5 | 0 | 7 | 0 | 0 |
| streams | 4 | 0 | 4 | 0 | 0 | 4 | 0 | 0 |
| quality | 9 | 0 | 9 | 5 | 0 | 4 | 0 | 0 |
| templates | 6 | 0 | 6 | 3 | 0 | 3 | 0 | 0 |
| measurements | 9 | 0 | 9 | 5 | 0 | 4 | 0 | 0 |
| versions | 15 | 0 | 15 | 7 | 0 | 8 | 0 | 0 |
| TỔNG | 199 | 0 | 199 | 81 | 0 | 118 | 0 | 0 |

### Notes

- Không gắn cổng vai (ngoài ma trận, không có dòng): `/api/me*`, `/api/library*` (chỉ `current_principal`, khoá `—`), `/api/notifications*` (theo chủ), `/api/files/{token}` (token ký), `/api/auth*`, `/api/telemetry*`. Ẩn danh 401 chung đã có `core/tests/test_routing.py::test_protected_route_without_token_is_401`.
- Pytest ML/users chỉ thử `engineer` (`_forbidden_for_engineer`, users C07 "Thiếu quyền") -> dòng viewer layer `api`. Kiểm Origin/CSRF theo vai: ngoài phạm vi.
- ⚑1 `projects_delete_project` khoá bằng vai HỆ THỐNG admin (projects/access.py:95): engineer tạo dự án vẫn 403; FE phải ẩn Vùng nguy hiểm cho engineer (đối chiếu C1).
- ⚑2 `rules_replace_config` cần `ruleset.edit` (chỉ admin, matrix.py:53): nếu FE RuleSettings cho engineer sửa -> 403 (UX lỗi vai; đối chiếu C4).
- ⚑3 `members_add_member`/`members_remove_member` dùng `project.settings.edit` (engineer được): engineer thêm/gỡ thành viên kể cả admin (pytest `test_members_remove_member__engineer_removes_admin`) - xác nhận đúng ý đồ.
- ⚑4 Không router nào dùng `model.export`/`share.create`/`qc.approve`/`library.manage`: viewer đọc được `snapshot`, `rule-config`, `spatial` và mọi GET; ẩn Export/Share/QC theo vai chỉ là chắn phía FE (BE không có endpoint ghi tương ứng để chặn) - nếu có endpoint xuất/chia sẻ ở nơi khác thì thiếu cổng (Medium, cần xác nhận).
- ⚑5 `streams_open_progress` dùng `membership_checked_by_provider` thay `require_project`: non-member phải 404 `project` giống các route khác (pytest S06, không phải C06) - kiểm thân lỗi thống nhất.
- Chưa kiểm chứng: `resource` của 404 cho `/api/floors/{fid}` và `/api/floors/reorder` (resolver `project_of_floor*`, floors/router.py:26-27) có thể là `floor` thay `project`.