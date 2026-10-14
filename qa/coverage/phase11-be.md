# Phase 11 coverage — phá huỷ + đăng xuất (BE)

Nguồn: catalog QA-11 C4. Layer `api` = `qa/tests/phase11_destroy*_api.spec.ts`; layer `be` = pytest có dòng `Catalog: <id>.` (AppBack nhánh `test/qa11-py`).

# Catalog C4 — BE phá huỷ / không hoàn tác (tiền tố `B11`, slug `destroy`)

Nguồn: `apps/api/{floors,projects,project_members,users,measurements,quality,versions,rules,project_settings,auth}/router.py` + service tương ứng; cổng `apps/api/core/routing.py` (401 -> guard 428/idempotency `:166-185` -> Pydantic), `apps/api/projects/access.py` (`require_project`: người ngoài 404 TRƯỚC 403 vai, `:91-99`). BE main dc510655, chỉ đọc. FE worktree p11-int 5fcaf502.

Quy ước: URL có tiền tố `/api`. `Idempotency-Key` áp cho MỌI route (`core/routing.py:166-185`, mặc định `auto`): lặp cùng khoá+thân = response đã lưu, thân khác = 422 `IDEMPOTENCY_KEY_REUSED`. Xoá mềm (floors/projects/users) trả snapshot TRƯỚC khi xoá; xoá cứng: measurements (204), members (gỡ dòng). Không có endpoint nào cho "crop"/"xoá mọi tầng"/"áp độ dày mọi tầng": FE lặp từng tầng (`useProjectSettings.ts:1222` `gateway.deleteAllFloors` -> DELETE /floors/{id} từng tầng, trả `deletedCount`/`failedFloorIds`; `useScaleCalibration.ts:1273` `allFloors` -> `readAllFloors` rồi lưu từng tầng) — cắt "Cắt và nắn" = `POST .../quality/corners`. Ẩn danh = `newApiContext()` không cookie/Bearer; vai = `poolUser(admin, role, 'p11-destroy-<vai>')` + `addProjectMember` vào dự án RIÊNG (`createProject`); người ngoài = pool admin/engineer chưa là thành viên. Mọi dữ liệu tự seed, dọn trong `finally`, KHÔNG đụng dự án main chain / admin chung / `admin.storage.json`.
Layer `be` = đã có pytest (cột existing `py:<tệp>::<test>`, tệp tương đối `apps/api/`). Layer `api` = Playwright request, `phase11_destroy_api.spec.ts`.
Khổ/E/F: n/a (BE) — không có dòng ui; "ngoài phạm vi: mobile" cũng n/a.

## floors — DELETE /api/floors/{floor_id} (#11, `floors/router.py:38`), khôi phục POST /api/projects/{pid}/floors (#10, `:30`)

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-flr-001 | destroy | DELETE tầng của dự án mình (engineer thành viên) | 200 `FloorOut` dựng TRƯỚC khi xoá, dòng `floors` xoá mềm (floors/router.py:41) | `deleted_at` đặt, thân = snapshot (K22) | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__C01 | real | pytest |
| B11-flr-002 | destroy | DELETE lần 2 cùng tầng | 404 `NOT_FOUND` resource `floor` (không 204) | tầng `deleted_at` không còn trong tra cứu | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__C08 | real | pytest |
| B11-flr-003 | authz | viewer là thành viên DELETE | 403 `FORBIDDEN` (khoá `layer.edit`, access.py:99), tầng còn | `can(viewer,"layer.edit")`=false | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__C07 | real | pytest |
| B11-flr-004 | authz | admin hệ thống KHÔNG là thành viên DELETE | 404 (không 403; access.py:91 K08), tầng còn | không có ProjectMembership -> 404 trước vai | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__C06 | real | pytest |
| B11-flr-005 | authz | ẩn danh DELETE /api/floors/{fid} | 401 `UNAUTHENTICATED` (core/auth.py:77,87), thân không lộ tầng | không token -> 401 | api | missing | - | real | dự án riêng 1 tầng |
| B11-flr-006 | destroy | DELETE ghi nhật ký | đúng 1 dòng `activity_log` `FLOOR_DELETE`, `object_code`=id tầng, `object_label`=tên | floors/service delete_floor | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__C18 | real | pytest |
| B11-flr-007 | destroy | DELETE ẩn dòng đếm nhưng GIỮ số (để khôi phục trả lại đúng) | `summary.hidden=True`, số đếm giữ | B2-03 [6] | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__unregisters_but_keeps_summary_counts | real | pytest |
| B11-flr-008 | destroy | `{floor_id}` sai mẫu | 404 (không 500) | floors/tests path pattern | be | covered | py:floors/tests/test_routes_delete.py::test_floors_delete_floor__path_id_wrong_pattern | real | pytest |
| B11-flr-009 | destroy | hậu quả: GET /api/projects/{pid}/floors sau DELETE | 200, danh sách KHÔNG còn tầng đã xoá, tầng khác còn nguyên thứ tự | `list_floors` chỉ tầng chưa xoá (floors/router.py:50-53) | api | missing | - | real | dự án riêng 2 tầng |
| B11-flr-010 | destroy | hậu quả dây chuyền: GET /api/projects/{pid}/floors/{fid}/spatial của tầng đã xoá | 404 `NOT_FOUND` (tầng/lớp không còn); không trả lớp cũ | spatial_read tra tầng chưa xoá (xác minh resource trong luồng) | api | missing | - | real | dự án riêng 2 tầng |
| B11-flr-011 | destroy | hậu quả dây chuyền: GET .../floors/{fid}/quality của tầng đã xoá | 404 `NOT_FOUND` resource `floor` | quality/router.py:48 `get_floor is None` | api | missing | - | real | dự án riêng 2 tầng |
| B11-flr-012 | destroy | hậu quả dây chuyền: POST .../floors/{fid}/quality/straighten của tầng đã xoá | 404 resource `floor` | quality tests C08 (deleted) | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C08 | real | pytest |
| B11-flr-013 | undo | hoàn tác trong cửa sổ: POST /api/projects/{pid}/floors cùng `id` | 201, CÙNG pk, số đếm giữ, hết ẩn (`floor.drawings` quay lại) | `restore_window_elapsed` nửa mở `[0,window)` (drawings/runs.py:330) | be | covered | py:floors/tests/test_routes_create.py::test_floors_create_floor__restore_within_window_keeps_pk_and_counts | real | pytest |
| B11-flr-014 | undo | hoàn tác SAU cửa sổ | 201 với pk MỚI (không phục hồi dòng cũ) | quá `FLOOR_RESTORE_WINDOW_S` | be | covered | py:floors/tests/test_routes_create.py::test_floors_create_floor__restore_outside_window_gets_new_pk | real | pytest |
| B11-flr-015 | undo | hoàn tác ĐÚNG mốc hết cửa sổ | pk mới (đúng mốc là hết) | drawings/runs.py:333 | be | covered | py:floors/tests/test_routes_create.py::test_floors_create_floor__restore_exactly_at_window_gets_new_pk | real | pytest |
| B11-flr-016 | undo | hoàn tác khi dự án đã đạt trần số tầng | bị chặn (không vượt `FLOORS_MAX`) | floors/service restore + limit | be | covered | py:floors/tests/test_routes_create.py::test_floors_create_floor__restore_blocked_by_limit | real | pytest |
| B11-flr-017 | undo | sau hoàn tác GET /floors liệt kê lại tầng với cùng id; xoá lại -> 200 rồi 404 | tầng quay lại đúng vị trí `order`; DELETE lần 2 sau undo vẫn 200 | undo = tầng sống (service `_apply_restore`) | api | missing | - | real | dự án riêng 2 tầng |
| B11-flr-018 | destroy | hai DELETE song song cùng tầng (bấm đúp) | đúng một 200 và một 404, không 5xx, 1 dòng nhật ký | khoá hàng tầng trong service; lượt sau thấy `deleted_at` | api | missing | - | real | dự án riêng 1 tầng |
| B11-flr-019 | idem | DELETE tầng 2 lần cùng `Idempotency-Key` | lần 2 = response đã lưu (200, cùng thân), không chạy lại handler (core/routing.py:166-185) | idempotency.begin trả bản lưu | api | missing | - | real | dự án riêng 1 tầng |
| B11-flr-020 | destroy | "Xoá mọi tầng" (FE) lặp DELETE từng tầng: một tầng 404 giữa chừng | các tầng còn lại vẫn bị xoá; FE nhận `failedFloorIds` (useProjectSettings.ts:1234); BE trả 404 cho tầng lỗi, không rollback tầng khác | không có endpoint hàng loạt | api | missing | - | real | dự án riêng 3 tầng |

## projects — DELETE /api/projects/{project_id} (#27, `projects/router.py:80`)

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-prj-001 | destroy | admin thành viên DELETE | 200, thân = trạng thái NGAY TRƯỚC khi xoá (tên giữ), xoá mềm (K01) | projects/router.py:83 | be | covered | py:projects/tests/test_routes_write.py::test_projects_delete_project__C01 | real | pytest |
| B11-prj-002 | destroy | DELETE lần 2 | 200 rồi 404, không nhật ký thêm | `deleted_at` -> require_project 404 | be | covered | py:projects/tests/test_routes_write.py::test_delete_project_second_delete_returns_404 | real | pytest |
| B11-prj-003 | destroy | DELETE dự án đã xoá mềm từ trước | 404 | require_project không thấy | be | covered | py:projects/tests/test_routes_write.py::test_projects_delete_project__C08 | real | pytest |
| B11-prj-004 | authz | admin hệ thống KHÔNG là thành viên | 404 (không 403; access.py:91) | không ProjectMembership | be | covered | py:projects/tests/test_routes_write.py::test_projects_delete_project__C06 | real | pytest |
| B11-prj-005 | authz | viewer thành viên | 403 `FORBIDDEN` (khoá `admin`, access.py:99), dự án còn | `can(viewer,"admin")`=false | be | covered | py:projects/tests/test_routes_write.py::test_projects_delete_project__C07 | real | pytest |
| B11-prj-006 | authz | engineer thành viên (kể cả người tạo) | 403 `FORBIDDEN`; GET dự án vẫn 200; không nhật ký (BUG-513) | khoá theo vai hệ thống admin | be | covered | py:projects/tests/test_routes_write.py::test_delete_project_engineer_member_is_forbidden | real | pytest |
| B11-prj-007 | authz | ẩn danh DELETE /api/projects/{pid} | 401 `UNAUTHENTICATED` | không token | api | missing | - | real | dự án riêng |
| B11-prj-008 | destroy | nhật ký | đúng 1 dòng `PROJECT_DELETE`, `object_label`=tên | projects/service delete_project | be | covered | py:projects/tests/test_routes_write.py::test_projects_delete_project__C18 | real | pytest |
| B11-prj-009 | destroy | membership giữ (cho lịch dọn), quyền mất ngay | dòng `project_memberships` còn, GET dự án 404 | xoá mềm | be | covered | py:projects/tests/test_routes_write.py::test_delete_project_keeps_membership_row_but_revokes_access | real | pytest |
| B11-prj-010 | destroy | hậu quả: GET /api/projects/{pid} sau xoá | 404 `NOT_FOUND` resource `project` (người từng là admin/thành viên) | require_project | api | missing | - | real | dự án riêng 2 tầng + 1 thành viên |
| B11-prj-011 | destroy | hậu quả: GET /api/projects và /api/project-summaries | 200, KHÔNG còn dự án; thành viên cũng không thấy | projects/router.py:44,88 lọc theo dự án chưa xoá | api | missing | - | real | như trên |
| B11-prj-012 | destroy | dây chuyền: con của dự án đã xoá trả 404 `project` — floors | GET /projects/{pid}/floors -> 404 resource `project`; POST floors -> 404 | require_project("layer.edit") | api | missing | - | real | như trên |
| B11-prj-013 | destroy | dây chuyền — spatial/quality | GET .../floors/{fid}/spatial và .../quality -> 404 `project` | require_project | api | missing | - | real | như trên |
| B11-prj-014 | destroy | dây chuyền — settings/rule-config | GET /settings, GET/PUT /rule-config -> 404 `project` | rules C08, settings C08 | api | missing | - | real | như trên |
| B11-prj-015 | destroy | dây chuyền — measurements | DELETE measurement -> 404 `project` | measurements C08_deleted_project | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__C08_deleted_project | real | pytest |
| B11-prj-016 | destroy | dây chuyền — members | DELETE /members/{uid} -> 404 `project` | members C08 | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__C08 | real | pytest |
| B11-prj-017 | destroy | dây chuyền — PATCH dự án | 404 | projects update C08 | be | covered | py:projects/tests/test_routes_write.py::test_projects_update_project__C08 | real | pytest |
| B11-prj-018 | destroy | dây chuyền — rule-config PUT | 404 | rules C08 | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C08 | real | pytest |
| B11-prj-019 | destroy | dây chuyền — GET /spatial đồ thị và versions | GET /projects/{pid}/spatial, /versions -> 404 `project` | require_project | api | missing | - | real | như trên |
| B11-prj-020 | destroy | hai DELETE song song (bấm đúp) | một 200, một 404, không 5xx, 1 nhật ký | `deleted_at` | api | missing | - | real | dự án riêng |
| B11-prj-021 | idem | DELETE lặp cùng `Idempotency-Key` | lần 2 = response đã lưu 200 (không 404), cùng thân | core/routing.py:166-185 (lưu cả khi dự án đã xoá) | api | missing | - | real | dự án riêng |
| B11-prj-022 | destroy | xoá cứng dự án -> cascade `rule_configs` | dòng `rule_configs` mất (FK ON DELETE CASCADE) | models FK | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__cascade_on_project_delete | real | pytest |
| B11-prj-023 | destroy | xoá dự án KHÔNG xoá người dùng/thành viên khác | GET /api/me của thành viên cũ vẫn 200; `projectCount` của họ giảm | xoá mềm dự án | api | missing | - | real | dự án riêng + 1 thành viên pool |

## project_members — DELETE /api/projects/{pid}/members/{user_id} (N4, `project_members/router.py:73`)

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-mem-001 | destroy | gỡ viewer | 200 `UserOut` `{id,email,name,role}`, hết membership, 1 nhật ký `MEMBER_REMOVE`, `updatedAt` đổi | service remove_project_member | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__C01 | real | pytest |
| B11-mem-002 | authz | admin hệ thống không là thành viên | 404 resource `project` | access.py:91 | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__C06 | real | pytest |
| B11-mem-003 | authz | viewer thành viên gỡ người khác | 403 `FORBIDDEN` (khoá `project.settings.edit`) | matrix.py | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__C07 | real | pytest |
| B11-mem-004 | destroy | dự án đã xoá -> 404 `project`; người không là thành viên -> 404 `member` | hai mã tài nguyên khác nhau | members C08 | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__C08 | real | pytest |
| B11-mem-005 | destroy | `{user_id}` sai mẫu / id không có người | 404 resource `member` | member lookup | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__bad_user_id | real | pytest |
| B11-mem-006 | destroy | có hiệu lực ngay: người bị gỡ GET /api/projects/{pid} | 404 ngay (không cache) | require_project không cache | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__takes_effect_immediately | real | pytest |
| B11-mem-007 | destroy | tự gỡ mình khi còn người sửa khác | 200 | luật người sửa cuối | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__self_removal_with_other_editor | real | pytest |
| B11-mem-008 | destroy | gỡ người sửa cuối (dù còn viewer) | 422 `MEMBER_LAST_EDITOR`, không đổi gì | service | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__last_editor_with_viewer_left | real | pytest |
| B11-mem-009 | authz | ẩn danh DELETE /members/{uid} | 401 `UNAUTHENTICATED` | không token | api | missing | - | real | dự án riêng |
| B11-mem-010 | destroy | gỡ lần 2 cùng người | 404 resource `member` | đã không còn dòng | api | missing | - | real | dự án riêng + 1 viewer pool |
| B11-mem-011 | destroy | hậu quả dây chuyền: người bị gỡ gọi GET .../floors, PATCH .../spatial | 404 `project` (không 403) | require_project | api | missing | - | real | như trên |
| B11-mem-012 | destroy | phiên của người bị gỡ KHÔNG bị thu hồi: GET /api/me vẫn 200; GET /api/projects không chứa dự án | 200 + danh sách không có dự án | gỡ thành viên không đụng refresh_sessions | api | missing | - | real | như trên |
| B11-mem-013 | idem | gỡ lặp cùng `Idempotency-Key` | lần 2 = bản lưu 200 `UserOut`, không 404 | core/routing.py:166-185 | api | missing | - | real | như trên |
| B11-mem-014 | destroy | engineer gỡ admin khi còn người sửa khác | 200 (M2) | service | be | covered | py:project_members/tests/test_remove_member.py::test_members_remove_member__engineer_removes_admin | real | pytest |

## users — POST disable/enable, DELETE /api/users/{user_id} (#42/#43/#46, `users/router.py:95-120`)

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-usr-001 | destroy | disable người active | 200 `AdminUser` status `disabled`, thu hồi mọi phiên + lời mời chờ | service disable_user | be | covered | py:users/tests/test_state.py::test_users_disable_user__C01 | real | pytest |
| B11-usr-002 | destroy | disable lần 2 | 200, không ghi thêm (không nhật ký, `token_version` giữ) | service | be | covered | py:users/tests/test_state.py::test_users_disable_user_twice_and_self | real | pytest |
| B11-usr-003 | destroy | tự disable | 422 `USER_LAST_ADMIN` (admin duy nhất) hoặc `USER_SELF_MODIFICATION` (còn admin khác); vẫn active | NO-206 | be | covered | py:users/tests/test_state.py::test_users_disable_user_twice_and_self | real | pytest |
| B11-usr-004 | destroy | disable id không có | 404 resource `user` | users C08 | be | covered | py:users/tests/test_state.py::test_users_disable_user__C08 | real | pytest |
| B11-usr-005 | destroy | thân disable/enable không phải object / có khoá lạ | 422 `VALIDATION` | EmptyBody strict | be | covered | py:users/tests/test_state.py::test_users_disable_user__C02 | real | pytest |
| B11-usr-006 | authz | viewer/engineer gọi disable/enable/delete | 403 `FORBIDDEN` (`user.manage`), không đổi gì | access/deps.py:44 | be | covered | py:users/tests/test_state.py::test_users_disable_user__C07 | real | pytest |
| B11-usr-007 | authz | ẩn danh POST /users/{uid}/disable, /enable, DELETE /users/{uid} | 401 `UNAUTHENTICATED` mỗi cái | không token | api | missing | - | real | user pool riêng (target) |
| B11-usr-008 | destroy | disable giết mọi phiên của nạn nhân | access token cũ 401 `SESSION_REVOKED`; refresh 401; đăng nhập lại 403; `revoked_reason` chứa `disabled` | test_state.py:287 | be | covered | py:users/tests/test_state.py::test_users_disable_user_kills_every_session | real | pytest |
| B11-usr-009 | destroy | enable người disabled | 200 `AdminUser` `active` | service enable_user | be | covered | py:users/tests/test_state.py::test_users_enable_user__C01 | real | pytest |
| B11-usr-010 | destroy | enable người không disabled | 200 nguyên trạng, không nhật ký, không tăng `token_version` | service | be | covered | py:users/tests/test_state.py::test_users_enable_user_not_disabled_writes_nothing | real | pytest |
| B11-usr-011 | destroy | enable id không có | 404 resource `user` | users C08 | be | covered | py:users/tests/test_state.py::test_users_enable_user__C08 | real | pytest |
| B11-usr-012 | destroy | sau enable người đó đăng nhập lại được (phiên MỚI) | `POST /api/auth/login` 204 (không 403) | trạng thái active | api | partial | phase01_auth_api.spec.ts (A01_invite_disable, mới tới disable) | real | user tự mời (testEmail) |
| B11-usr-013 | destroy | disable rồi đăng nhập | login bị từ chối 403, không cookie | test_state.py:287 (login 403) | api | partial | phase01_auth_api.spec.ts:681 | real | user tự mời |
| B11-usr-014 | destroy | delete: admin xoá người có xác nhận đúng email | 200 `AdminUser` status `active` (TRƯỚC xoá); DB `deleted_at` + `disabled`, phiên `revoked_reason=deleted`, lời mời huỷ | users/router.py:111 | be | covered | py:users/tests/test_delete.py::test_users_delete_user__C01 | real | pytest |
| B11-usr-015 | destroy | `confirmEmail` sai | 422 `USER_CONFIRM_EMAIL_MISMATCH` field `confirmEmail`, không xoá | schemas DeleteUserBody | be | covered | py:users/tests/test_delete.py::test_users_delete_user_confirm_email_is_compared_normalized | real | pytest |
| B11-usr-016 | destroy | `confirmEmail` khác hoa thường | vẫn khớp, 200 | so sánh chuẩn hoá | be | covered | py:users/tests/test_delete.py::test_users_delete_user_confirm_email_is_compared_normalized | real | pytest |
| B11-usr-017 | destroy | `confirmEmail` có Kelvin U+212A/U+017F | 422 `VALIDATION`, không xoá (K37) | validate_wire_email | be | covered | py:users/tests/test_delete.py::test_users_delete_user_confirm_email_rejects_non_ascii_folding | real | pytest |
| B11-usr-018 | destroy | `userId` thân khác đường | 422 `PATH_BODY_MISMATCH`, không xoá ai (K09) | W21 | be | covered | py:users/tests/test_delete.py::test_users_delete_user__C21 | real | pytest |
| B11-usr-019 | destroy | thân delete thiếu `confirmEmail` / khoá lạ | 422 `VALIDATION` | strict body | be | covered | py:users/tests/test_delete.py::test_users_delete_user__C03 | real | pytest |
| B11-usr-020 | destroy | tự xoá mình khi còn admin khác | 422 `USER_SELF_MODIFICATION` | service | be | covered | py:users/tests/test_delete.py::test_users_delete_user_self_is_rejected | real | pytest |
| B11-usr-021 | destroy | admin active duy nhất tự xoá | 422 `USER_LAST_ADMIN` | NO-206 | be | covered | py:users/tests/test_delete.py::test_users_delete_user_last_admin_is_rejected | real | pytest |
| B11-usr-022 | destroy | xoá lần 2 / id không có | 404 resource `user` | users C08 | be | covered | py:users/tests/test_delete.py::test_users_delete_user__C08 | real | pytest |
| B11-usr-023 | destroy | sau xoá: biến mất khỏi GET /users, `total` giảm, email dùng lại mời ra `id` mới | `total`-1; POST /users/invitations cùng email 201 `id` khác | test_delete.py:162 | be | covered | py:users/tests/test_delete.py::test_users_delete_user_disappears_from_list_and_frees_email | real | pytest |
| B11-usr-024 | destroy | xoá gỡ khỏi mọi dự án; dự án chỉ còn người này sửa -> log `project_orphaned` | `projectCount` thân = số trước; sau = 0 | service | be | covered | py:users/tests/test_delete.py::test_users_delete_user_removes_memberships_and_logs_orphans | real | pytest |
| B11-usr-025 | destroy | nhật ký | 1 dòng `USER_DELETE` do admin, `object_label`=email; nhật ký của nạn nhân giữ | service | be | covered | py:users/tests/test_delete.py::test_users_delete_user__C18 | real | pytest |
| B11-usr-026 | destroy | user đã xoá đăng nhập lại | `POST /api/auth/login` → 401 `INVALID_CREDENTIALS` (xoá mềm bị `_find_account` lọc · auth/router.py:139-148,175-177; S4 chốt) | status disabled + deleted_at | api | partial | phase01_auth_api.spec.ts:206 (chỉ dọn) | real | user tự mời |
| B11-usr-027 | destroy | access token + refresh cũ của user đã xoá | `GET /api/me` 401 `SESSION_REVOKED`; `POST /auth/refresh` 401 | delete thu hồi phiên `deleted` | api | missing | - | real | user tự mời, phiên mới |
| B11-usr-028 | destroy | GET /users/{uid}/memberships và /activity của người đã xoá | 404 resource `user` hoặc rỗng — xác minh trong `service.list_memberships` | users_list_* | api | missing | - | real | user tự mời |
| B11-usr-029 | idem | DELETE user lặp cùng `Idempotency-Key` + cùng thân | lần 2 = bản lưu 200 (không 404) | core/routing.py:166-185 | api | missing | - | real | user tự mời |
| B11-usr-030 | idem | cùng `Idempotency-Key`, thân khác (confirmEmail khác) | 422 `IDEMPOTENCY_KEY_REUSED` | core/idempotency.py:90 | api | missing | - | real | user tự mời |

## measurements — DELETE /api/projects/{pid}/measurements/{mid} (#18, `measurements/router.py:41`)

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-msr-001 | destroy | xoá MS-0001 | 204 thân rỗng, xoá CỨNG, MS-0002 còn | measurements/router.py:44 | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__C01 | real | pytest |
| B11-msr-002 | authz | admin không là thành viên | 404 resource `project` | access.py:91 | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__C06 | real | pytest |
| B11-msr-003 | authz | viewer | 403, dòng còn | `layer.edit`/EditAccess | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__C07 | real | pytest |
| B11-msr-004 | destroy | id không có / sai mẫu | 404 resource `measurement` | service delete_record | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__C08 | real | pytest |
| B11-msr-005 | destroy | id của dự án A qua đường dự án B | 404 `measurement`, dòng A còn | cô lập theo dự án | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__other_project_id_not_deletable | real | pytest |
| B11-msr-006 | destroy | `touch_project` chạy khi xoá được, không chạy khi 404 | `projects.updated_at` đổi/không đổi | test :245 | be | covered | py:measurements/tests/test_routes_read_delete.py::test_measurements_delete_record__touch_project | real | pytest |
| B11-msr-007 | authz | ẩn danh DELETE measurement | 401 | không token | api | missing | - | real | dự án riêng + 1 phép đo |
| B11-msr-008 | destroy | xoá lần 2 cùng id | 404 resource `measurement` | xoá cứng | api | missing | - | real | như trên |
| B11-msr-009 | destroy | hậu quả: GET /measurements sau xoá | 200 mảng không còn id đã xoá | measurements_list_records (:25) | api | missing | - | real | như trên |
| B11-msr-010 | undo | hoàn tác = POST lại đúng bản ghi cũ (cùng id) | 201 tạo mới; gửi lại lần nữa (đã có) -> 200 nguyên bản | router.py:30-38 | api | missing | - | real | như trên |
| B11-msr-011 | idem | DELETE lặp cùng `Idempotency-Key` | lần 2 = 204 từ bản lưu (không 404) | core/routing.py:166-185 | api | missing | - | real | như trên |

## quality — POST .../quality/straighten (#32, "Nắn thẳng") và .../quality/corners (#31, "Cắt và nắn") (`quality/router.py:40-58`)

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-qlt-001 | destroy | straighten trang nghiêng 4° | 200 `ImageQualityAssessment` của trang đã nắn, `isMeasured=true` | service.straighten | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C01 | real | pytest |
| B11-qlt-002 | destroy | straighten đổi `sourceUrl`, ĐỔI id phát hiện, thêm 1 lượt (không hoàn tác được) | `after.sourceUrl != before.sourceUrl`, `run_count==2` | test :72 | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__deskews_and_renews_finding_ids | real | pytest |
| B11-qlt-003 | destroy | straighten trang đã thẳng | 200 nguyên hiện trạng, không lượt mới | no-op | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__already_straight_is_a_noop | real | pytest |
| B11-qlt-004 | destroy | thân không phải object / khoá lạ | 422 `VALIDATION` | StraightenIn strict | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C02 | real | pytest |
| B11-qlt-005 | authz | người ngoài (admin hệ thống) | 404 `project` | access.py:91 | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C06 | real | pytest |
| B11-qlt-006 | authz | viewer | 403 `FORBIDDEN` | `_upload_gate` | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C07 | real | pytest |
| B11-qlt-007 | destroy | tầng không có / đã xoá / chưa bản vẽ | 404 `floor`, 404 `floor`, 404 `upload` | test :200 | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C08 | real | pytest |
| B11-qlt-008 | idem | lặp `Idempotency-Key` | cùng response, MỘT lượt mới, MỘT thông điệp `pipeline.cpu` | idempotency | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C10_queue_once | real | pytest |
| B11-qlt-009 | idem | lặp KHÔNG khoá | lượt trên trang đã thẳng không làm gì; mỗi lượt có xử lý tạo đúng một lượt | test :260 | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__C10_no_key_replay | real | pytest |
| B11-qlt-010 | destroy | homography lưu lệch | 409 | test :129 | be | covered | py:quality/tests/test_routes_straighten.py::test_quality_straighten__stored_homography_mismatch_is_409 | real | pytest |
| B11-qlt-011 | destroy | straighten khi lớp đã duyệt (reviewed) | 422 `QUALITY_LAYER_REVIEWED`, trang không đổi | phase03 spec | api | covered | phase03_pipeline_api.spec.ts:2590 (layer_reviewed_straighten_422) | real | tầng đã duyệt |
| B11-qlt-012 | authz | ẩn danh POST .../straighten và .../corners | 401 mỗi cái | không token | api | missing | - | real | dự án riêng 1 tầng bản vẽ |
| B11-qlt-013 | destroy | straighten tầng đã xoá (qua API, sau DELETE tầng) | 404 `floor` | qlt-007 | api | partial | phase03_pipeline_api.spec.ts:2482 (tầng ma), chưa tầng đã xoá | real | dự án riêng 1 tầng bản vẽ |
| B11-qlt-014 | destroy | "Cắt và nắn": 4 góc hợp lệ | 200, trang đã cắt-nắn, xếp lại pipeline | service.set_corners | be | covered | py:quality/tests/test_routes_corners.py::test_quality_set_corners__four_corners_applied | real | pytest |
| B11-qlt-015 | destroy | corners hình sai (thiếu góc, không lồi) | 422 `VALIDATION` | test C02_shape | be | covered | py:quality/tests/test_routes_corners.py::test_quality_set_corners__C02_shape | real | pytest |
| B11-qlt-016 | authz | corners viewer 403; người ngoài 404 | 403 `FORBIDDEN` / 404 `project` | _upload_gate | be | covered | py:quality/tests/test_routes_corners.py::test_quality_set_corners__C07 | real | pytest |
| B11-qlt-017 | destroy | corners khi lớp đã duyệt | 422 `QUALITY_LAYER_REVIEWED` | test reviewed_layer | be | covered | py:quality/tests/test_routes_corners.py::test_quality_set_corners__reviewed_layer | real | pytest |
| B11-qlt-018 | undo | corners có đường hoàn tác (áp lại góc cũ) | áp lại bốn góc ban đầu trả trạng thái cũ | test `undo` | be | covered | py:quality/tests/test_routes_corners.py::test_quality_set_corners__undo | real | pytest |
| B11-qlt-019 | idem | corners lặp `Idempotency-Key` | một lượt + một thông điệp | C10_queue_once | be | covered | py:quality/tests/test_routes_corners.py::test_quality_set_corners__C10_queue_once | real | pytest |
| B11-qlt-020 | destroy | hậu quả: GET .../quality sau straighten | `sourceUrl` mới, id phát hiện mới; id cũ không còn trong danh sách | quality_read_assessment | api | missing | - | real | dự án riêng + bản vẽ nghiêng |

## versions — POST /api/projects/{pid}/versions/{vid}/restore (N19, "Phục hồi", `versions/router.py:62`)

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-ver-001 | destroy | phục hồi phiên bản cũ | 201 `FloorVersionSummary` bản "sau"; sinh thêm bản "trước" (ảnh chụp bản hiện tại) | service.restore_version | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C01 | real | pytest |
| B11-ver-002 | destroy | phục hồi xoá các sửa lớp sau phiên bản (mất tường) | lớp = ảnh chụp; tường thêm sau biến mất | test undo | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__undo_brings_back_the_lost_wall | real | pytest |
| B11-ver-003 | undo | phục hồi bản "trước" vừa sinh = hoàn tác | `layer`, `dimensions` về như cũ (có lại tường) | test :518 | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__undo_brings_back_the_lost_wall | real | pytest |
| B11-ver-004 | destroy | `baseVersion` cũ | 409 `VERSION_CONFLICT` `currentVersion`, `remoteChanges`>=1; không bản mới | W20 | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C09_stale | real | pytest |
| B11-ver-005 | destroy | thiếu `baseVersion` | 428 | guard khung | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C09_missing | real | pytest |
| B11-ver-006 | idem | gửi lại lượt vừa thành công (cùng người, cùng thân) | 200 cùng `id`, `sequence` không tăng; người khác -> 409 | C09b | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C09b | real | pytest |
| B11-ver-007 | authz | viewer | 403 `FORBIDDEN` | `layer.edit` | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C07 | real | pytest |
| B11-ver-008 | authz | người ngoài | 404 `project` | access.py:91 | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C06 | real | pytest |
| B11-ver-009 | destroy | phiên bản vắng / sai mẫu / dự án khác / tầng xoá mềm | 404 resource `version` | C08 | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__C08 | real | pytest |
| B11-ver-010 | destroy | `floorId` không khớp phiên bản | lỗi (422/404) không ghi | test floor_mismatch | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__floor_mismatch | real | pytest |
| B11-ver-011 | destroy | rescale làm vỡ mô hình | 422, không ghi | test :486 | be | covered | py:versions/tests/test_routes_restore.py::test_versions_restore_version__rescale_that_breaks_the_model_is_422 | real | pytest |
| B11-ver-012 | authz | ẩn danh POST .../restore | 401 | không token | api | missing | - | real | dự án riêng |
| B11-ver-013 | destroy | vòng API: PUT layer v1 (2 tường) -> PUT v2 (thêm tường) -> restore v1 -> GET layer | GET lớp còn đúng tường v1; tường thêm sau mất; GET /versions có bản "trước" | spatial_write + versions end-to-end | api | missing | - | real | dự án riêng 1 tầng + spatialwrite seed (`layerSeed.ts`) |

## rules / settings — "Khôi phục mặc định" = PUT /api/projects/{pid}/rule-config `overrides:{}` (N22); "Áp cho mọi tầng" = lưu tầng từng cái

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-rul-001 | destroy | khôi phục mặc định: PUT `{baseVersion: rev, body:{overrides:{}}}` sau khi đã có override | 200 `{revision: rev+1, overrides:{}}`; override cũ mất | rules/router.py:29-36 | api | missing | - | real | dự án riêng admin + 1 override |
| B11-rul-002 | destroy | sau khôi phục GET /rule-config | `overrides:{}` và `revision` = n | rules_read_config | api | missing | - | real | như trên |
| B11-rul-003 | destroy | base cũ | 409 `VERSION_CONFLICT`, `remoteChanges:[]` | C09 | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C09 | real | pytest |
| B11-rul-004 | idem | gửi lại đúng lượt vừa thành công | 200 cùng `revision` (không +1), 1 nhật ký | C09b | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C09b | real | pytest |
| B11-rul-005 | authz | viewer/engineer PUT rule-config | 403 `FORBIDDEN` (`ruleset.edit` chỉ admin) | matrix.py | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C07 | real | pytest |
| B11-rul-006 | authz | người ngoài | 404 `project` | access.py:91 | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C06 | real | pytest |
| B11-rul-007 | authz | ẩn danh PUT rule-config | 401 | không token | api | missing | - | real | dự án riêng |
| B11-rul-008 | destroy | ghi lại cùng cấu hình vẫn tăng revision (C01_same_config_still_writes) | 200 `revision`+1 | test :59 | be | covered | py:rules/tests/test_routes_replace.py::test_rules_replace_config__C01_same_config_still_writes | real | pytest |
| B11-set-001 | destroy | "Áp cho mọi tầng": BE không có endpoint hàng loạt — FE lưu từng tầng; một tầng 409 giữa chừng | tầng khác đã lưu giữ nguyên (không rollback), tầng 409 báo riêng (useScaleCalibration.ts:1273 `AllFloorsReport`) | `floors_patch_spatial_floor` last-write-wins (floors/router.py:68) | api | missing | - | real | dự án riêng 3 tầng |
| B11-set-002 | authz | viewer PATCH .../floors/{fid}/spatial | 403 `FORBIDDEN` (`layer.edit`) | matrix.py | be | covered | py:floors/tests/test_routes_patch.py::test_floors_patch_spatial_floor__C07 | real | pytest |
| B11-set-003 | destroy | PUT /settings base cũ | 409 `remoteChanges:[]` | settings C09 | be | covered | py:project_settings/tests/test_routes_replace.py::test_settings_replace_settings__C09 | real | pytest |

## auth — POST /api/auth/logout (`auth/router.py:285`), refresh sau logout, thu hồi phiên

### G API/BE

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| B11-out-001 | destroy | logout cookie sống | 204 thân rỗng, xoá hai cookie, phiên `revoked_reason=logout`, cache snapshot xoá | auth/router.py:290-294 | be | covered | py:auth/tests/test_logout.py::test_auth_logout__C01 | real | pytest |
| B11-out-002 | destroy | logout lặp cùng cookie | 204 cả hai lần, lý do thu hồi không đổi | router.py docstring | be | covered | py:auth/tests/test_logout.py::test_logout_twice_is_204 | real | pytest |
| B11-out-003 | destroy | logout không cookie / cookie rác | 204, vẫn xoá cookie | router.py:290-294 | be | covered | py:auth/tests/test_logout.py::test_logout_without_a_cookie_is_204 | real | pytest |
| B11-out-004 | authz | `Origin` lệch/thiếu | 403 `ORIGIN_MISMATCH` KÈM lệnh xoá cookie; phiên KHÔNG thu hồi | router.py:288-289 | be | covered | py:auth/tests/test_logout.py::test_auth_logout__C24 | real | pytest |
| B11-out-005 | destroy | refresh bằng cookie `previous` trong ân hạn sau logout | 401 `SESSION_REVOKED` (thu hồi kiểm trước ân hạn) | test_refresh.py:219 | be | covered | py:auth/tests/test_refresh.py::test_revocation_is_checked_before_grace | real | pytest |
| B11-out-006 | destroy | refresh bằng chính cookie đã logout (vòng API đầy đủ: login -> refresh -> logout -> refresh) | `POST /api/auth/refresh` 401 (`SESSION_REVOKED`/`UNAUTHENTICATED`), không cấp token mới | sessions.refresh_session | api | partial | phase01_auth_api.spec.ts:548-563 (logout 204/lặp), phase03_upload_api.spec.ts:798 | real | user pool riêng, phiên mới |
| B11-out-007 | destroy | access token cũ sau logout | 401 `SESSION_REVOKED` (auth/sessions.py:575-578,605-620; S4 chốt) | auth/verifier.py | api | missing | - | real | user pool riêng |
| B11-out-008 | destroy | logout CHỈ thu hồi phiên của cookie đó: phiên thứ 2 của cùng user vẫn sống | GET /api/me bằng phiên 2 = 200 | revoke_by_cookie (auth/sessions.py:239-263) | api | partial | phase03_upload_api.spec.ts:798 (phiên thứ 2 bị thu hồi) | real | user pool riêng, 2 phiên |
| B11-out-009 | destroy | disable user -> phiên thứ 2 + refresh chết (thu hồi từ xa) | access 401 `SESSION_REVOKED`, refresh 401, login 403 | test_state.py:287 | api | missing | - | real | user tự mời, 2 phiên |
| B11-out-010 | destroy | đổi mật khẩu thu hồi các phiên KHÁC (trừ phiên hiện tại) | phiên khác refresh 401; phiên hiện tại sống | me/router.py:217 `revoke_sessions(... except_sid)` | be | covered | py:me/tests/test_change_password.py::test_me_change_password__C01 | real | pytest |
| B11-out-011 | idem | logout lặp cùng `Idempotency-Key` | 204 | core/routing.py | api | missing | - | real | user pool riêng |

### Notes

- ⚑ B11-out-010: `test_me_change_password__C01` phủ happy path đổi mật khẩu (me/router.py:217 thu hồi phiên khác trừ phiên hiện tại); khẳng định "phiên khác bị thu hồi" chưa chắc có trong test -> luồng api kiểm lại.
- ⚑ B11-flr-010/-011, B11-prj-013/-019, B11-usr-026/-028, B11-out-007: mã/resource cụ thể (`floor` vs `layer`, 401 vs 403 login, 401 vs 200 token cũ) chưa chứng minh bằng pytest — luồng phải ghi hành vi thật rồi so với oracle; sai lệch là bug nghi ngờ.
- ⚑ B11-flr-018 / B11-prj-020: không thấy pytest nào cho hai DELETE song song; nếu service không khoá hàng, lượt 2 có thể 200 hai lần (nhật ký đôi). FE bấm đúp "Xoá tầng"/"Xoá dự án".
- ⚑ B11-set-001 / B11-flr-020: "Áp cho mọi tầng", "Xoá mọi tầng" là vòng lặp phía FE, không nguyên tử; BE không có endpoint hàng loạt -> một tầng lỗi giữa chừng để lại trạng thái nửa vời (chỉ báo qua `failedFloorIds`/`AllFloorsReport`).
- ⚑ B11-prj-021 / B11-flr-019: `Idempotency-Key` áp cho DELETE (guard theo method không loại trừ); lặp trả bản lưu 200 kể cả sau khi thực thể đã 404 — hợp lý theo thiết kế, nhưng chưa có pytest; kiểm xem FE có gửi khoá cho DELETE không (FE chỉ gửi cho straighten, `phase11_teardown.spec.ts:312`).
- ⚑ B11-usr-012/013: phase01 chỉ có disable; chưa có `enable -> login lại` trên API.
- n/a: crop (không có endpoint riêng, = corners); `Xoá mọi tầng` bulk; mobile/`/m/` ngoài phạm vi; cổng thu hồi từ `admin.storage.json` KHÔNG kiểm (phiên admin chung).
- Quy tắc seed: user nạn nhân luôn là user tự mời qua `POST /api/users/invitations` (`testEmail(slug)` @example.test) hoặc `poolUser(admin, role, 'p11-destroy-<vai>')`; thao tác logout/disable/delete CHỈ trên chính user đó; không bao giờ trên admin pool dùng chung.

## Tóm tắt

| màn | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| floors | 20 | 0 | 20 | 12 | 0 | 8 | 0 | 0 |
| projects | 23 | 0 | 23 | 13 | 0 | 10 | 0 | 0 |
| project_members | 14 | 0 | 14 | 9 | 0 | 5 | 0 | 0 |
| users | 30 | 0 | 30 | 22 | 3 | 5 | 0 | 0 |
| measurements | 11 | 0 | 11 | 6 | 0 | 5 | 0 | 0 |
| quality | 20 | 0 | 20 | 17 | 1 | 2 | 0 | 0 |
| versions | 13 | 0 | 13 | 11 | 0 | 2 | 0 | 0 |
| rules/settings | 11 | 0 | 11 | 7 | 0 | 4 | 0 | 0 |
| auth | 11 | 0 | 11 | 6 | 2 | 3 | 0 | 0 |
| **tổng** | **153** | 0 | 153 | 103 | 6 | 44 | 0 | 0 |
