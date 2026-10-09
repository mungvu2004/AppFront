# AppFront: E2E Test Execution Plan (v2, reviewed)

- **Source:** `AppFront` `origin/master` @ `c4978eb4`, read only through `git show`.
- **Scope:** 38 product routes (8 outside the `ScreenMain` group + 30 inside it, `*` included) and 8 dev-only routes (`src/routes/router.tsx`), across 3 roles.
- **Review:** v1 went through 3 independent source-level reviews. The high-impact corrections (registry revert, versions, wizard floors, login 204, reorder PATCH, tour) were re-checked by hand. Changes are in §7.
- **Status:** PLAN ONLY. No browser has been opened. Execution waits for explicit approval.

---

## 0. Ground truth

| # | Fact (verified) | Consequence |
|---|---|---|
| G1 | The only route gate is `SessionBootstrap`. Anonymous users go to `/login?next=…` (`encodeURIComponent`). Public routes are `/login`, `/login/invitation/*`, `/login/reset-password/*`; DEV builds also allow the 8 demo routes. While the session status is `unknown`, the gate shows "Không kết nối được máy chủ" / "Chưa mở được ứng dụng…" instead of redirecting. `/login` does **not** redirect a signed-in user; it shows the form. | One redirect test covers every protected route. In the prod (compose) build the dev routes fall through to `*`. |
| G2 | No route-level role guard; each screen gates itself. Most screens use `can()`. ModelRegistry and TrainingJobs use `roles.includes('admin')`. Project delete needs `canEdit && admin`. | Role tests assert each screen's own forbidden or read-only copy. |
| G3 | **The effective role is per project.** `rolesOf` takes the member role when the user is a member, otherwise the global role, and stores it as `userRoles`. `ProjectSpatialGate` (11 screens) shows "Không tìm thấy dự án này" to non-members. | E and V accounts must be **project members**. The role matrix is global role × membership. |
| G4 | No logout in the product shell. `signOut()` is called only from AccessDenied "Đăng nhập bằng tài khoản khác" (sends `state.from=/khong-co-quyen`, so re-login lands back there) and from a successful PasswordReset. | Logout goes through `/khong-co-quyen`. Switching roles is easier with separate browser contexts. |
| G5 | Writes autosave after about 800 ms (`PUT …/spatial/layer` with `{baseVersion, body}`). Undo is an "Hoàn tác" toast with an 8 s window; **hovering the toast pauses the timer**. Ctrl+S flushes immediately. Canvas-scope keys (J/K/Backspace/Enter/digits) are inert while an input has focus. | Assert on network responses. For expiry tests, move the mouse off the toast. Before pressing keys, focus the canvas or list. |
| G6 | `EditorTour` loads lazily on walls, export and `/3d` (about 6 s on /3d). Its backdrop swallows the first click. The skip button is **"Bỏ qua hướng dẫn"**. (Plain "Bỏ qua" is the wall inspector's skip, a different button.) | Each run calls `dismissTour` (`e2e/fixtures/tour.ts`) on those screens before acting. |
| G7 | Capabilities that are off in the real gateways: share links; account sessions and deletion; project duplicate; pipeline cancel/retry/skip; PipelineGraph run; CAD inspect, mapping and branch; ScaleCalibration auto-sources; FloorManager `persistFloorContents` and `hideFloorFrom3d`; Overlay metrics; every ModelLibrary write; Dimension and Axis persistence. | These are tested as "absent / no-op as designed" (P2). |
| G8 | Existing coverage: F-14 `chain.fullstack.ts` (real BE; it passed on 2026-10-06 with `web` built from **efbda6bd**) and about 50 mocked specs (`e2e/v1…v12b`, `e2e/auth`, `e2e/cross/viewer-role.spec.ts`, smoke). In mock mode the role comes from the email (`admin@`/`engineer@`/`viewer@example.com`, `e2e/fixtures/session.ts`). | Track B (role matrix) reuses the mock fixtures, so no invite tokens are needed. Labels proven by the chain are preferred. |

---

## 1. Two tracks

| Track | Target | Covers | Why |
|---|---|---|---|
| **A: Fullstack** | AppBack compose with `web` built from **c4978eb4** | Phases 1–8, 10, 11 (admin) | Real auth, SSE, autosave, versions, registry |
| **B: Mock** | `pnpm dev` with `VITE_USE_MOCK_API` | Phase 9 role matrix and dev routes | Roles come from the email, so no CP-7 tokens are needed. Mock mode auto-opens a session, so G1 tests stay in Track A. |

## 2. Checkpoints (Track A)

| CP | Checkpoint | Produced by | Blocks |
|---|---|---|---|
| CP-0 | Compose up per `e2e/fullstack/README.md` **preconditions 1–7**. (a) `web` image hand-built from **c4978eb4**; don't use `APPFRONT_SHA`, which pins F-00c. (b) URL is `http://localhost:8080`; **`localhost`, not 127.0.0.1**. (c) If 8080 is taken, change **all 4** of `POSTGRES_HOST_PORT`, `WEB_HTTP_PORT`, `PUBLIC_BASE_URL`, `E2E_FULLSTACK_BASE_URL`, or auth calls get 403 `ORIGIN_MISMATCH`. (d) `ML_BACKEND=fake`; `FEATURE_FLAGS='{"scene.pascal-viewer": true}'` (needs AppBack FIX-378, and FIX-379 for flag sync). (e) `GET /api/health` returns 200; CSP has `'wasm-unsafe-eval'` + `worker-src blob:`. | User | everything |
| CP-1 | Admin from `create-admin` (**only on a blank DB**). Credentials in `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`. | User | all |
| CP-2 | Project `E2E-QA-<yyyymmdd-hhmm>`. The wizard **always creates 4 floors: "Tầng trệt", "Tầng 1", "Tầng 2", "Tầng 3"**. | SCR-05 | SCR-08…32 |
| CP-3 | Two added floors, **F_work** and **F_scratch**. Their names and ids come from the `POST /projects/:id/floors` response bodies; never hard-code them. | SCR-09 | SCR-10…22 |
| CP-4 | Drawing (`E2E_DRAWING_PNG`, a `render_plan(7)` PNG) attached to F_work: init → chunks → complete | SCR-10 | SCR-11, 12 |
| CP-5 | Pipeline finished for F_work: "Đã xong N/N tầng", so a spatial layer exists | SCR-12 (right after CP-4) | SCR-14, 16–32 |
| CP-6 | A restorable version: **autosave does not create versions.** The pipeline writes a "before" and an "after" version. The first layer PUT bumps `floorRevision`, so the AI row loses "Hiện tại" and becomes restorable. CP-6 = CP-5 + at least 1 layer PUT. | SCR-16 approve | SCR-32 |
| CP-8 | A second `onnx` candidate in family **openingAndFurnitureDetection**, uploaded through N26 and evaluated (about 5–10 min). Set up through README precondition 7, not by F-14. | User / AppBack | SCR-36 |

**Run conditions**
- Do not run while another agent is loading the machine (`ERR_NO_BUFFER_SPACE` shows up as blank pages).
- Viewport 1440×900; mobile and compact checks use 375×812.
- Only touch entities this run creates. **Never click the create-project toast's "Hoàn tác"**: it deletes CP-2.

---

## 3. Target classification

**Safe:** tabs, segmented controls, filters, search, sort, "Xem thêm", panel collapse, modal open/cancel, tree expand, camera and zoom, local-only toggles (account Notifications grid, floor "Ẩn khỏi mô hình 3D", Overlay "Xác nhận…", Dimension and Axis edits).

**Write, reversible:**
- profile fields; project settings; floor rename and reorder; layer approve/edit; thickness apply; scale apply; rule toggles
- notification mark-read; measurement pin
- account **theme**, which persists to `localStorage['app-theme-mode']`, so revert it in the same test

**Destructive / irreversible (Phase 11, test entities only):**
- "Xoá tầng" (no confirm)
- Remove drawing
- "Nắn thẳng" / "Cắt và nắn" (confirm; "không hoàn tác được")
- "Áp cho mọi tầng" (confirm)
- "Phục hồi" (wipes every layer edit made after that version)
- "Gỡ" member
- "Xoá mọi tầng" (confirm only)
- "Xoá dự án" (type the name)
- User "xoá hẳn" (type the email)
- RuleSettings "Khôi phục mặc định" (no confirm)
- Logout

**Global state (affects other users, must be restored):** ModelRegistry activation (§5 rule R2).

**Opt-in only (off by default):**
- Forgot-password submit and **user invite**: both send real email; need a mail sink or a non-routable test domain.
- "Bắt đầu huấn luyện": uses ML compute.
- Export "Xuất": triggers a browser download, which needs per-run approval.
- Admin password change.

---

## 4. Master matrix

Roles: **A** admin, **E** engineer, **V** viewer, **∅** anonymous. `{work}` / `{scratch}` are the floor names captured at CP-3. Evidence goes to `evidence/<run-id>/`.

### Phase 1: Auth (Track A, ∅)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-01 | Session gate (any protected route) | ∅, CP-0 | URL `/projects/x/floors` | Navigate | Redirects to `/login?next=%2Fprojects%2Fx%2Ffloors` | `01_gate_redirect.png` | P0 |
| SCR-02 | Login (`/login`) | ∅ | "Thư điện tử" with a bad value, then blur | Type | "Thư điện tử chưa đúng dạng…" | `02_login_email_invalid.png` | P1 |
| SCR-02 | Login | ∅ | email filled, "Mật khẩu" (`exact:true`) empty | Type | "Đã có thư điện tử, còn thiếu mật khẩu."; `main[data-auth-state=partial]` | `02_login_partial.png` | P2 |
| SCR-02 | Login | ∅ | "Hiện mật khẩu" / "Ẩn mật khẩu" | Click | Input switches between type=text and type=password | `02_login_eye.png` | P2 |
| SCR-02 | Login | ∅ | **one** wrong password, then "Đăng nhập" | Submit | "Sai thư điện tử hoặc mật khẩu" + action "Đặt lại mật khẩu" (1 attempt only; lockout starts at a 429) | `02_login_wrong.png` | P1 |
| SCR-02 | Login | ∅ | "Quên mật khẩu", then "Quay lại đăng nhập" / Esc | Click/Key | h1 changes to "Quên mật khẩu" and back. **No submit.** | `02_login_forgot_panel.png` | P2 |
| SCR-02 | Login | ∅ | "Đăng nhập bằng SSO công ty" | Navigate | No SSO flow is wired, so neither the button nor the "Hoặc" divider is rendered (count 0; BUG-002, F-04) | `02_login_no_sso.png` | P2 |
| SCR-02 | Login | ∅, CP-1 | valid credentials, "Đăng nhập" | Submit | `POST /api/auth/login` **204**, then `POST /api/auth/refresh` 200, then `/`. Cookie `appback_refresh` is httpOnly, Secure, SameSite=Strict. | `02_login_submitted.png` | P0 |
| SCR-02 | Login | ∅ | `/login?next=/projects/x/floors`, then sign in | Submit | Lands on the `next` path | `02_login_next.png` | P1 |
| SCR-02 | Login | ∅ | `/login?next=https://example.org/` and `?next=//example.org`, then sign in | Submit | Stays in-app at `/` (`safeDestination`) | `02_login_next_open_redirect.png` | P1 |
| SCR-02 | Login | A signed in | open `/login` | Navigate | The form is shown, with no redirect (G1) | `02_login_signed_in.png` | P2 |
| SCR-01 | Session expiry | A, 2 tabs | clear `appback_refresh` and the access token in context A, then trigger a refresh | Script/Navigate | Tab A goes to `/login` with the "sessionEnded" notice; **tab B** is signed out too (cross-tab broadcast) | `01_session_ended_crosstab.png` | P1 |
| SCR-03 | Invitation (`/login/invitation`) | ∅, no hash | load | Navigate | Dead-end, subtitle "Liên kết này không mở được lời mời." + "Trang này không còn mã của liên kết lời mời (trang đã được tải lại hoặc liên kết bị cắt)…" + "Về trang đăng nhập"; NOT "Lời mời đã hết hạn…" (that copy is only for a token the server rejects, 422; BUG-005) | `03_invite_deadend.png` | P1 |
| SCR-03 | Invitation | ∅, `#token=bogus` | "Họ và tên", "Mật khẩu", "Nhập lại mật khẩu" (mismatched) | Type | "Hai mật khẩu chưa giống nhau."; `#token` stripped from the URL | `03_invite_validation.png` | P2 |
| SCR-04 | Password reset (`/login/reset-password`) | ∅, no hash | load | Navigate | Dead-end, subtitle "Liên kết này không đặt lại được mật khẩu." + "Trang này không còn mã của liên kết đặt lại mật khẩu (trang đã được tải lại hoặc liên kết bị cắt)…" + "Về trang đăng nhập"; NOT "Liên kết đã hết hạn…" (422 only; BUG-005) | `04_reset_deadend.png` | P2 |

### Phase 2: Dashboard and project creation (A)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-05 | Dashboard (`/`) | A | load | Navigate | h1 "Dự án của tôi"; list "Danh sách dự án" or "Chưa có dự án nào" | `05_dash_loaded.png` | P0 |
| SCR-05 | Dashboard | A | "Dự án mới" (or `N`), then "Tạo dự án" with an empty name | Click | "Chưa nhập tên dự án." | `05_wizard_validation.png` | P2 |
| SCR-05 | Dashboard | A | **Proven sequence:** "Tên dự án", then "Tiếp tục", then "Chiều cao áp cho mọi tầng"=3, then "Áp cho mọi tầng", then "Tiếp tục", then "Tạo dự án" | Click/Type | `POST /api/projects` 200 or 201. Card for **CP-2**. **Do not click the toast's "Hoàn tác".** | `05_dash_project_created.png` | P0 |
| SCR-05 | Dashboard | wizard dirty | "Huỷ", then "Đóng, bỏ thay đổi" | Click | "Đóng và bỏ các thay đổi chưa lưu?", then the modal closes | `05_wizard_discard.png` | P2 |
| SCR-05 | Dashboard | CP-2 | searchbox "Tìm dự án" = CP-2 name; then nonsense, then "Xoá bộ lọc" | Type/Click | One card; then "Không tìm thấy dự án phù hợp"; then the list is restored | `05_dash_search.png` | P1 |
| SCR-05 | Dashboard | ≥1 project | sort "Tên A–Z"; "Kiểu xem" set to "Bảng"; status "Đang xử lý" / "Cần QC" / "Hoàn thành" | Select/Click | Order changes; table headers Tên dự án…Cập nhật; list filters (aria-pressed) | `05_dash_view_controls.png` | P2 |
| SCR-05 | Dashboard | CP-2 | "Tuỳ chọn cho {name}", then "Đổi tên", then "Đổi tên {name}" + Enter, then toast "Hoàn tác" | Click/Type | `PATCH /projects/:id`; undo restores the name | `05_dash_rename_undo.png` | P1 |
| SCR-05 | Dashboard | CP-2 | card click | Click | processing goes to `/pipeline`; qc goes to walls, or `/floors` if there is no default floor; done goes to `/3d` | `05_dash_open_project.png` | P1 |
| SCR-06 | Notifications (bell on `/`) | A | `button "Thông báo"` **exact:true** | Click | Drawer "Thông báo"; radiogroup "Lọc thông báo" | `06_notif_drawer.png` | P1 |
| SCR-06 | Notifications | ≥1 unread (e.g. after CP-5) | "Đánh dấu đã đọc", then "Hoàn tác" within 8 s | Click | Item reverts; **no** `POST /notifications/read` | `06_notif_markread_undo.png` | P2 |
| SCR-06 | Notification Center (`/thong-bao`) | A | load; Esc | Navigate/Key | Drawer forced open; Esc goes back in history (or to `/`) | `06_notif_route.png` | P2 |
| SCR-07 | Onboarding (`/onboarding`) | A, flag cleared | load; "Bỏ qua" | Navigate/Click | Three steps; "Bỏ qua" sets `appfront:onboarding-welcome-seen:<uid>`, then `/`; reload redirects to `/` | `07_onboard_skip.png` | P2 |

### Phase 3: Project setup, upload and pipeline (A, CP-2)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-08 | Project Settings (`/projects/:id/settings`) | CP-2 | tablist "Nhóm cài đặt": Chung / Đơn vị đo / Thành viên / Vùng nguy hiểm | Click | Panels switch; "Vùng nguy hiểm" visible (admin) | `08_settings_tabs.png` | P1 |
| SCR-08 | Project Settings | CP-2 | "Ghi chú" edit | Type | **Only** `PUT /projects/:id/settings` (baseVersion); toast "Đã lưu cài đặt dự án." | `08_settings_notes_put.png` | P1 |
| SCR-08 | Project Settings | CP-2 | "Địa chỉ" edit | Type | `PATCH /projects/:id` (name/code/address only) | `08_settings_address_patch.png` | P1 |
| SCR-08 | Project Settings | CP-2 | "Đơn vị chiều dài" set to "Mét (m)", then back to "Milimét (mm)" | Select | PUT settings ×2 | `08_settings_units.png` | P2 |
| SCR-09 | Floor Manager (`/projects/:id/floors`) | CP-2 | "Thêm tầng" ×2 | Click | `POST /projects/:id/floors` ×2. Capture `{work}` and `{scratch}` from the bodies (**CP-3**); 6 rows total; badge "Chưa có bản vẽ". | `09_floors_added.png` | P0 |
| SCR-09 | Floor Manager | CP-3 | "Tên tầng {scratch}", type a new name, Enter; then rename again and press Escape | Type/Key | `PATCH /projects/:id/floors/:fid/spatial`; Escape reverts (name field only) | `09_floor_rename.png` | P1 |
| SCR-09 | Floor Manager | CP-3 | "Chiều cao tầng {work}" (NumericField, commits on change) | Type | PATCH spatial | `09_floor_height.png` | P2 |
| SCR-09 | Floor Manager | CP-3 | focus a **middle** row `<tr>`, Alt+ArrowUp; then Mod+Z | Key | **`PATCH /api/floors/reorder`** `{floorIds}`; order changes, then is restored | `09_floor_reorder.png` | P1 |
| SCR-09 | Floor Manager | CP-3 | "Thu gọn lát cắt" / "Hiện lát cắt"; band button matching `/^{work}, cao/` | Click | Cut collapses and expands; row selected; "Nhân bản tầng" visible | `09_floor_section.png` | P2 |
| SCR-09 | Floor Manager | CP-3 | "Tự động tính cao độ" off, then "Cao độ tầng {work}" | Click/Type | Elevation input appears; PATCH | `09_floor_elevation.png` | P2 |
| SCR-09 | Floor Manager | CP-3 | "Thao tác khác cho tầng {scratch}", then "Ẩn khỏi mô hình 3D" | Click | Session-only notice "Những thay đổi chỉ sống trong phiên làm việc này" | `09_floor_hide3d_session.png` | P2 |
| SCR-10 | Floor Upload (`/projects/:id/upload`) | CP-3 | `setInputFiles` on `floor-upload-file-input` ← `drawing.png`; "Gán cho tầng khác" = `{work}` | Upload/Select | `POST …/drawings/uploads` → `…/chunks` → `…/complete`; "Đã gắn kèm" (**CP-4**). Assert the network, not the transient "Đang tải lên". | `10_upload_attached.png` | P0 |
| SCR-12 | Processing (`/projects/:id/pipeline`) | **immediately** after CP-4 | load (`waitUntil:'commit'`) | Navigate | SSE `/api/streams/projects/:id/uploads/:uid/progress`; wait for `/^Đã xong ([1-9]\d*)\/\1 tầng/` or "Sao chép mã lỗi" (≤300 s). **CP-5** | `12_pipeline_complete.png` | P0 |
| SCR-12 | Processing | running or complete | tabs "Xem trước" / "Nhật ký"; "Khoá cuộn tự động"; "Mở chi tiết bước …" | Click | `role=log`; aria-pressed flips; step detail expands | `12_pipeline_log.png` | P2 |
| SCR-12 | Processing | — | "Huỷ xử lý" | Assert | Not rendered | `12_pipeline_no_cancel.png` | P2 |
| SCR-12 | Processing | CP-5 | "Duyệt lớp tường" | Click | `/projects/:id/floors/{workId}/layers/walls` | `12_pipeline_to_walls.png` | P1 |
| SCR-10 | Floor Upload | CP-5 | "Bắt đầu xử lý" | Click | `floor-upload-block-notice` "Không thể bắt đầu xử lý" listing the file-less floors (don't assert which floor it scrolls to) | `10_upload_blocked.png` | P1 |
| SCR-10 | Floor Upload | CP-3 | `setInputFiles` with a `.txt` | Upload | Rejection on the attachment + "Đóng" | `10_upload_rejected.png` | P2 |
| SCR-11 | Input Quality Gate (`/projects/:id/quality`) | CP-4 | load; ArrowRight / ArrowLeft | Navigate/Key | "Báo cáo chất lượng" + "Phát hiện" | `11_quality_report.png` | P1 |
| SCR-11 | Input Quality Gate | CP-4 | "Chọn góc thủ công", arrow keys on "Góc trên bên trái", Esc | Click/Key | Handle moves 1% per press; Esc exits | `11_quality_corners.png` | P2 |
| SCR-11 | Input Quality Gate | CP-4 | "Tự động nắn", then **"Huỷ"** | Click | Modal "Nắn thẳng bản vẽ tầng …" closes; no POST | `11_quality_straighten_cancel.png` | P2 |
| SCR-11 | Input Quality Gate | CP-4 | "Tiếp tục xử lý" (**if** checkbox "Tôi đã đọc cảnh báo…" exists, which only happens with a `poor` metric: first without it, then with it) | Click | Goes to `/pipeline` (after "Đánh dấu ô xác nhận…" when gated) | `11_quality_continue.png` | P1 |
| SCR-13 | Pipeline Graph (`/projects/:id/pipeline/graph`) | A | load | Navigate | "Chưa có lượt xử lý nào để kể lại" (F-06) | `13_graph_empty.png` | P2 |
| SCR-15 | CAD Branch Confirm (`/…/floors/{workId}/cad-confirm`) | A | load; "Huỷ" in "Phát hiện tệp CAD" | Navigate/Click | "Tệp CAD không có lớp được đặt tên" (F-07) | `15_cad_empty.png` | P2 |

### Phase 4: QC layers (A, CP-5; call `dismissTour` first)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-16 | Wall Layer Review (`/…/{workId}/layers/walls`) | CP-5, tour dismissed | option in listbox "Danh sách đoạn tường"; then J / K with focus on the list | Click/Key | Inspector "Đoạn tường" follows | `16_walls_select.png` | P0 |
| SCR-16 | Wall Layer Review | unapproved wall | "Duyệt đoạn này" | Click | `PUT …/spatial/layer` 200; status changes; auto-advances; no "Lưu" button (**CP-6**) | `16_walls_approved.png` | P0 |
| SCR-16 | Wall Layer Review | CP-5 | first `radio{checked:false}` in "Độ dày tường" (110/220/330) | Click | PUT; thickness updates | `16_walls_thickness.png` | P0 |
| SCR-16 | Wall Layer Review | after the edit | Mod+Z (canvas focus), then Ctrl+S | Key | Edit reverted; Ctrl+S flushes the PUT immediately | `16_walls_undo_flush.png` | P1 |
| SCR-16 | Wall Layer Review | CP-5 | "Chỉ hiện chưa duyệt"; "Chỉ hiện độ tin cậy thấp"; "Hiện tim tường"; "Ẩn lớp tường"; "Thu gọn hai panel"; "Bỏ qua" (inspector) | Click | List narrows, overlay toggles, panels collapse; "Bỏ qua" jumps to the next wall with no PUT | `16_walls_view_controls.png` | P2 |
| SCR-16 | Wall Layer Review | 2 walls that are **collinear and share an endpoint** (read from the layer GET body) | Ctrl-click both, then "nối đoạn" | Click | Merge applied plus PUT. With one wall selected the label is "nối đoạn — Chọn hai đoạn tường để gộp" (disabled) | `16_walls_merge.png` | P1 |
| SCR-16 | Wall Layer Review | CP-5 | select a wall, Backspace (canvas focus), then "Hoàn tác" | Key/Click | Removed, then restored | `16_walls_delete_undo.png` | P1 |
| SCR-16 | Wall Layer Review | CP-5 | "Cây lớp" items Cửa và nội thất / Kích thước / Trục / Phòng; floor nav | Click | Navigates to objects / dimensions / grids / rooms / another floor. ("Sang lớp cửa và nội thất" only shows once **every** wall is approved.) | `16_walls_layer_nav.png` | P1 |
| SCR-17 | Object Layer Review (`…/layers/objects`) | CP-5 | "Lọc theo loại" chips; "Mở nhóm …"; list option | Click | List filters; inspector "Đối tượng" | `17_objects_filter.png` | P1 |
| SCR-17 | Object Layer Review | object selected | "Duyệt đối tượng này"; "Loại đối tượng"; "hướng mở" set to mở trái | Click/Select | PUT per change | `17_objects_edit.png` | P1 |
| SCR-17 | Object Layer Review | object selected | right-click `locator('g[aria-label="<code>"]')`, then "Xoá", then status bar "Hoàn tác" | Click | Removed, then restored | `17_objects_delete_undo.png` | P2 |
| SCR-18 | Dimension OCR Review (`…/layers/dimensions`) | CP-5 (may be empty with fake ML) | "Chưa duyệt"; "Giá trị kích thước <code>" + Enter; "Duyệt kích thước <code>" | Type/Click | Local update; save indicator says saved but **no PUT is sent** (F-08). Empty-state branch allowed. | `18_dims_local_only.png` | P2 |
| SCR-19 | Axis Grid Manager (`…/layers/grids`) | CP-5 | "Thêm trục ngang"; "Ẩn trục X"; "Xoá trục X", then undo | Click | In-memory only; no PUT | `19_grids_local_only.png` | P2 |
| SCR-20 | Room Label Review (`…/layers/rooms`) | CP-5 (may be empty) | option in "Danh sách phòng"; "Tên phòng"; "Công năng"; "Duyệt phòng này" | Click/Type | PUT layer | `20_rooms_edit.png` | P1 |
| SCR-20 | Room Label Review | CP-5 | "Chuẩn hoá tên", then "Huỷ" **or** "Đóng"; "Gộp phòng", then cancel | Click | Modals close; no PUT | `20_rooms_modals_cancel.png` | P2 |
| SCR-21 | Thickness Standardization (`…/layers/thickness`) | non-standard walls exist (otherwise empty state) | slider "Ngưỡng giữa 110 mm và 220 mm"; tick "Đồng ý chuẩn hoá {n} tường {m} mm về {group}"; "Xem trước", then "Áp dụng" | Drag/Click | Bulk PUT; "Hoàn tác" available | `21_thickness_apply.png` | P1 |
| SCR-14 | Scale Calibration (`/…/{workId}/scale`) | CP-5 | "Vẽ đường tham chiếu"; drag on canvas "Bản vẽ đã nắn, kéo để vẽ đường tham chiếu" from 20% to 80% width at 50% height; "Chiều dài thật"=5000 + Enter | Drag/Type | Line with two handles; scale computed | `14_scale_refline.png` | P1 |
| SCR-14 | Scale Calibration | refline drawn | "Chỉ áp cho tầng này", then "Áp dụng tỷ lệ" | Click | `PUT …/spatial/layer`; "Đã áp tỷ lệ cho bản vẽ" | `14_scale_applied.png` | P1 |
| SCR-14 | Scale Calibration | refline drawn | "Áp cho mọi tầng", then **"Huỷ"** in "Áp tỉ lệ này cho N tầng có bản vẽ?" | Click | GET floors + spatial; **no PUT** | `14_scale_all_cancel.png` | P2 |
| SCR-22 | Overlay Comparison (`…/{workId}/overlay`) | CP-5 | "Kiểu đối chiếu" set to "Trượt"; divider slider + arrows; "Độ mờ ảnh nguồn" | Click/Key | Divider moves; "Chưa đo được vùng lệch nào." | `22_overlay_swipe.png` | P2 |

### Phase 5: 3D (A, CP-5)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-23 | Viewer 3D (`/projects/:id/3d`) | CP-5 | load; `dismissTour({waitMs:6000})` | Navigate | `main "Khung nhìn mô hình"` + canvas with non-blank pixels; Draco loaded under CSP | `23_viewer_loaded.png` | P0 |
| SCR-23 | Viewer 3D | CP-5 | "Góc nhìn sẵn" set to Trên xuống / Mặt cắt; "Chế độ xem" set to 2D; keys O / F / 0 / Esc | Select/Key | Camera changes (screenshot diff) | `23_viewer_presets.png` | P1 |
| SCR-23 | Viewer 3D | rooms exist | `/`, then "Tìm phòng theo tên hoặc mã", then a result | Key/Type | Room framed and selected | `23_viewer_search.png` | P1 |
| SCR-23 | Viewer 3D | CP-5 | "Bảng phụ của khung nhìn 3D": Diện tích phòng / Thư viện đồ đạc / Lịch sử thao tác | Click | Panel switches | `23_viewer_panels.png` | P2 |
| SCR-23 | Viewer 3D | wall selected | "Sửa hình học tường", then edit, then autosave | Click | `PUT …/spatial/layer` from 3D | `23_viewer_geometry_put.png` | P1 |
| SCR-23 | Viewer 3D | CP-5 | "Tách tầng" / "Công cụ đo" / "Đối chiếu bản vẽ" | Click | `/3d/exploded`, `/3d/measure`, overlay | `23_viewer_nav.png` | P1 |
| SCR-24 | Exploded View (`/3d/exploded`) | ≥2 storeys with geometry (otherwise empty state) | "Tách hết"; "Độ tách các tầng"; "Ẩn tầng {work}" | Click/Drag | Floors separate; one hidden | `24_exploded.png` | P2 |
| SCR-25 | Measurement Tool (`/3d/measure`) | CP-5 | preset "Trên xuống"; mode "Điểm đến điểm"; click 2 **wall** pixels; assert a draft exists; "Ghim phép đo (phím Enter)" | Click/Key | `POST /projects/:id/measurements`; row under "Phép đo" | `25_measure_pinned.png` | P1 |
| SCR-25 | Measurement Tool | pinned | "đơn vị" set to m; "Ẩn {name}"; "Xoá {name}", then "Hoàn tác"; "Bỏ phần đo dở (phím Esc)" | Select/Click | Units relabel; hide; delete then undo | `25_measure_manage.png` | P2 |
| SCR-26 | Pascal Viewer (`/3d/pascal`) | CP-5, flag on | load; Esc / E / R | Navigate/Key | `pascal-mount.js?v=<8hex>` (no-cache); caption matches the chain's `PASCAL_RENDERED_PATTERN` within 60 s | `26_pascal_rendered.png` | P1 |
| SCR-27 | Mobile Viewer (`/m/du-an/:id`) | CP-5, 375×812 | "Tầng" / "Chế độ xem" / "Đo" / "Thông tin" | Click | Sheets open; "Chia sẻ dự án" absent | `27_mobile_tools.png` | P2 |

### Phase 6: Rules, export, data, versions (A)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-28 | Rule Report (`/projects/:id/rules`) | CP-5 | "Chạy kiểm tra lại" | Click | Spinner, then Tổng số kiểm tra / Đạt / Cảnh báo / Vi phạm | `28_rules_run.png` | P1 |
| SCR-28 | Rule Report | ready | "Lọc theo mức độ" set to Vi phạm; "Nhóm luật"; "Tầng"; group expander; row, then ViolationDetail | Click/Select | Rows filter; detail opens | `28_rules_filter.png` | P2 |
| SCR-28 | Rule Report | ready | link "Cài đặt bộ luật"; "Xem"; "Xác nhận đã xử lý" (disabled while violations > 0) | Click/Assert | Goes to `/rules/settings` and `/3d`; disabled state matches the violation count | `28_rules_nav.png` | P2 |
| SCR-29 | Rule Settings (`/rules/settings`) | A | "Bật hoặc tắt luật: …" | Click | 800 ms later, `PUT …/rule-config {baseVersion, body}`; undo toast | `29_rulesettings_toggle.png` | P1 |
| SCR-29 | Rule Settings | A | preset "văn phòng"; then "Khôi phục mặc định" (only renders when not default) | Click | PUT; "Đã trả bộ luật về mặc định." (rule-config is per project, so nothing global) | `29_rulesettings_reset.png` | P2 |
| SCR-30 | Export Panel (`/projects/:id/export`) | CP-5, tour dismissed | "Định dạng xuất" = .glb; "Tuỳ chọn"; checkboxes under "Phạm vi"; "Kiểm tra trước khi xuất" | Click | Options match the format | `30_export_options.png` | P1 |
| SCR-30 | Export Panel | **download opt-in** | .json, then "Xuất" | Click | Download event; "Tệp đã xuất" row | `30_export_json_done.png` | P1 |
| SCR-30 | Export Panel | CP-5 | .pdf, then "Xuất" | Click | "Chưa tải về được…" | `30_export_pdf_unsupported.png` | P2 |
| SCR-31 | Spatial JSON Viewer (`/projects/:id/data`) | CP-5 | "Tìm theo khoá hoặc giá trị" (≥1 match), then "Kết quả sau"; "Mở rộng tất cả"; treeitem ArrowRight; "Xem trước"; "Thô" | Type/Click/Key | Match count; tree expands; view switches | `31_json_tree.png` | P2 |
| SCR-32 | Version History (`/projects/:id/versions`) | CP-6 | "Tầng" = `{work}`; **uncheck the pre-selected pair**, then check 2 "Chọn phiên bản … để so sánh"; tabs Thay đổi / JSON / Trực quan; "Xem thêm phiên bản" | Click | Diff renders | `32_versions_diff.png` | P1 |
| SCR-32 | Version History | CP-6 | "Gắn nhãn phiên bản này", then "Nhãn"=`e2e`, then "Gắn nhãn" | Type/Click | **`PATCH …/versions/:v/label`**; label shows; no toast (F-09) | `32_versions_label.png` | P2 |
| SCR-32 | Version History | CP-6, **after every Phase 4–5 write** | "Phục hồi phiên bản này" on the **first row without "Hiện tại"** (the AI result; never the oldest, empty row), then "Phục hồi" | Click | `POST …/versions/:v/restore` 200; walls equal the chosen version's content (compare against the snapshot, as chain step 9 does); no PUT afterwards | `32_versions_restored.png` | P0 |

### Phase 7: Account (A)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-33 | Account Settings (`/tai-khoan`) | A | "Chức danh" + `-e2e`, then revert | Type | `PATCH /me` ×2 (only `jobTitle`) | `33_account_autosave.png` | P1 |
| SCR-33 | Account Settings | A | "Chủ đề" set to Tối, **then back to the original**; "Giảm chuyển động"; one notification checkbox | Click | Theme changes (persists in localStorage); no network | `33_account_appearance.png` | P2 |
| SCR-33 | Account Settings | A | "Tìm phím tắt" = "Ctrl" | Type | Table filters | `33_account_shortcuts.png` | P2 |
| SCR-33 | Account Settings | A | "Đổi ảnh" ← png, then **"Huỷ"** in "Đặt ảnh đại diện?" / "Thay ảnh đại diện?" | Upload/Click | Dialog closes; no PUT | `33_account_avatar_cancel.png` | P2 |
| SCR-33 | Account Settings | — | "Phiên đăng nhập" / "Vùng nguy hiểm" | Assert | Not rendered | `33_account_hidden_sections.png` | P2 |

### Phase 8: Admin (A)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-34 | Model Library (`/admin/models`) | A | "tìm model"; "danh mục"; sort `th` "Số tam giác" (**before** switching to Lưới); then "Lưới"; name, then "Chi tiết model", then Esc | Type/Click | Filter, `aria-sort`, grid, panel; no write controls | `34_library_browse.png` | P2 |
| SCR-35 | Training Jobs (`/admin/training/jobs`) | A | tabs "Lượt huấn luyện" / "Bộ dữ liệu"; status filter; row, then "Chi tiết lượt huấn luyện" | Click | Panels; "Số đo" and "Nhật ký" | `35_training_browse.png` | P2 |
| SCR-35 | Training Jobs | A | "Tạo lượt huấn luyện", then "Đóng" | Click | Dialog opens and closes; no POST | `35_training_dialog_cancel.png` | P2 |
| SCR-36 | Model Registry (`/admin/training/models`) | A, CP-8 | **Record** `GET /admin/ml/model-families` → `openingAndFurnitureDetection.activeVersionId`. Then "Họ model" = "Nhận diện cửa và đồ đạc"; candidate row "Kích hoạt", then dialog "Kích hoạt" | Click | `PUT /admin/ml/model-families/openingAndFurnitureDetection/active` 200; "Đang dùng" moves | `36_registry_activated.png` | P1 |
| SCR-36 | Model Registry | after activation | **In a finally block:** "Kích hoạt" on the recorded original row, then "Kích hoạt" | Click | Active version equals the recorded id (**mandatory restore**, the same way the chain does it) | `36_registry_restored.png` | P0 |
| SCR-36 | Model Registry | walls family | "Quay về đường cổ điển" | Assert only | Visible only for walls. **Do not click**: it sends `versionId:null` (classic, no model) | `36_registry_classic_visible.png` | P2 |
| SCR-37 | User Management (`/admin/users`) | A | "Tìm người dùng"; "Vai" / "Trạng thái"; "Xem ma trận quyền", then close; row name, then "Chi tiết người dùng", then Esc | Type/Click | Filters, modal, detail | `37_users_browse.png` | P2 |
| SCR-37 | User Management | own row | role select / "Vô hiệu hoá" | Assert | Inline text "Bạn không thể tự đổi vai của mình" / "…tự vô hiệu hoá…" replaces the control | `37_users_self_guard.png` | P1 |
| SCR-37 | User Management | **opt-in (sends email)** | "Mời người dùng", then "Email người được mời" = `e2e+x@example.invalid`, then "Gửi lời mời" | Submit | `POST /users/invitations`; status "Chờ chấp nhận" | `37_users_invited.png` | P2 |

### Phase 9: Role matrix (Track B, mock; roles from the email)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-05 | Dashboard | V | "Dự án mới"; card menu "Xoá" | Assert | Hidden/disabled; "Vai người xem: chỉ có thể mở dự án…" | `R-V_05.png` | P1 |
| SCR-08/09/10/16 | Settings / Floors / Upload / Walls | V | edit controls | Assert | "Vai hiện tại chỉ xem được cài đặt…" / "Không có quyền sửa tầng" / "Vai hiện tại chỉ được xem danh sách tệp…" / "Bạn đang xem với vai người xem…" | `R-V_<scr>.png` | P1 |
| SCR-14/17/20/21 | Scale / Objects / Rooms / Thickness | V | edit controls | Assert | "Bạn không có quyền hiệu chỉnh tỷ lệ" / tools disabled / "Không có quyền sửa lớp phòng" / "Không có quyền sửa độ dày tường" | `R-V_<scr>.png` | P1 |
| SCR-30/32 | Export / Versions | V | "Xuất"; "Phục hồi phiên bản này"; "Gắn nhãn phiên bản này" | Assert | "Không có quyền xuất bản vẽ"; restore and label absent; "Vai trò của bạn trên dự án này chỉ đọc được lịch sử…" | `R-V_<scr>.png` | P1 |
| SCR-25/31/28 | Measure / JSON / Rules | V | pin; load | Assert | Record actual behaviour: Measure has no FE `can()`, so check whether pinning works and whether the BE returns 403. JSON is ungated. Rules is ungated (F-03). | `R-V_<scr>_gap.png` | P2 |
| SCR-29/35/36/37 | RuleSettings / Training / Registry / Users | V | load | Assert | Read-only / "Không có quyền truy cập" ×2 / permission matrix only | `R-V_<scr>.png` | P1 |
| SCR-29/37 | RuleSettings / Users | E | edit controls | Assert | "Chỉ quản trị viên đổi được bộ luật…"; "Vai của bạn chưa quản lý được người dùng…" | `R-E_<scr>.png` | P1 |
| SCR-13 | Pipeline Graph | E | load | Assert | "Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây." | `R-E_13.png` | P1 |
| SCR-34/35/36 | Library / Training / Registry | E | load | Assert | Library forbidden (`library.manage`); "Không có quyền truy cập" ×2 | `R-E_<scr>.png` | P1 |
| SCR-08 | Project Settings | E | tab "Vùng nguy hiểm" | Assert | Absent | `R-E_08.png` | P1 |
| SCR-09/10/16/30 | Floors / Upload / Walls / Export | E | edit and upload controls | Assert | **Present and enabled** (positive engineer check) | `R-E_<scr>_can_edit.png` | P1 |
| SCR-34 | Model Library | A, then join a project as V, then return | load `/admin/models` | Assert | Investigate F-11: stale per-project `userRoles` could falsely forbid an admin | `R-A_34_stale_role.png` | P2 |

### Phase 10: System and dev routes

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-39 | Not Found (`*`) | A | `/khong-ton-tai`; "Quay lại"; recent link | Navigate/Click | "Không tìm thấy trang này" (no period); "Dự án gần đây" (≤3) linking to `/floors` | `39_notfound.png` | P2 |
| SCR-41 | Global shortcuts | A | `?`, then Esc | Key | `GlobalShortcutHelp` opens lazily, then closes | `41_shortcut_help.png` | P2 |
| SCR-40 | Dev routes (`/demo`, `/design-system`, `/design-system/states`, `/data-entry-demo`, `/list-review-demo`, `/shell-demo`, `/demo/canvas-overlays`, `/feedback-demo`) | Track B dev server | load each; `/shell-demo` "Thu gọn panel trái ([)" | Navigate | Each renders. In Track A (prod build) the same URLs go to NotFound. | `40_dev_<slug>.png` | P2 |

### Phase 11: Destruction and logout (A, test entities only)

| Screen ID | Screen Name & Route | Prerequisite / State | Interactive Target | Action Type | Expected UI Mutation | Evidence Name Pattern | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SCR-10 | Floor Upload | CP-4 | "Xoá bản vẽ drawing.png", then "Hoàn tác xoá bản vẽ …" | Click | Removed, then restored (local, no request) | `D_10_drawing_remove_undo.png` | P2 |
| SCR-11 | Input Quality Gate | CP-4 | "Tự động nắn", then **"Nắn thẳng"** | Click | `POST …/quality/straighten` (idempotency key) | `D_11_straightened.png` | P2 |
| SCR-09 | Floor Manager | `{scratch}` | menu "Xoá tầng", then "Hoàn tác" (<8 s); **re-resolve `{scratch}`**, then "Xoá tầng" | Click | `DELETE /floors/:id` (no confirm, F-05); undo sends a **new** `POST …/floors` (new id); the final delete removes it | `D_09_floor_deleted.png` | P1 |
| SCR-08 | Project Settings | CP-2 | "Vùng nguy hiểm", then "Xoá mọi tầng", then confirm | Click | `DELETE` per floor; "Đã xoá N tầng của dự án." | `D_08_all_floors_deleted.png` | P1 |
| SCR-08 | Project Settings | CP-2 | "Xoá dự án": wrong name first (disabled), then the exact name, then "Xoá dự án" | Type/Click | `DELETE /projects/:id`; "Đã xoá dự án."; `/`; card gone | `D_08_project_deleted.png` | P0 |
| SCR-37 | User Management | opt-in invitee | "Vô hiệu hoá", then "bật lại"; "xoá", then "xoá hẳn {name}?", then the email in "Địa chỉ thư", then "Xác nhận xoá vĩnh viễn" | Click/Type | POST disable/enable; confirm disabled until the email matches; `DELETE /users/:id` | `D_37_user_deleted.png` | P2 |
| SCR-38 | Access Denied (`/khong-co-quyen`) | A | "Về danh sách dự án" | Click | `/` | `38_denied_home.png` | P2 |
| SCR-38 | Access Denied | A | **"Đăng nhập bằng tài khoản khác"** | Click | `POST /api/auth/logout`, then `/login` (state.from=/khong-co-quyen); `/` now redirects to login | `38_logout.png` | P0 |
| SCR-01 | Session gate | logged out | `/projects/<deleted-id>/3d` | Navigate | Redirects to `/login?next=…` | `01_gate_after_logout.png` | P1 |

---

## 5. Execution sequencing and dependency graph

```
Track A (fullstack, admin, one context; a 2nd context only for the cross-tab expiry test)

CP-0 ─► Phase 1 Auth ─► CP-1 login
          │
          ▼
   Phase 2 Dashboard ─► CP-2 (4 default floors)
          │
          ▼
   SCR-08 Settings ─► SCR-09 Floors ─► CP-3 {work},{scratch}
          │
          ▼
   SCR-10 upload ─► CP-4 ─► SCR-12 Pipeline IMMEDIATELY (SSE) ─► CP-5
          │
          ├─► SCR-10 blocked / SCR-11 Quality (read + cancel only)
          │
          ▼
   Phase 4 QC writes (SCR-16 first ⇒ CP-6) ─► Phase 5 3D writes
          │
          ▼
   SCR-28/29/30/31 ─► SCR-32 RESTORE (after all layer writes, before Phase 11)
          │
          ▼
   Phase 7 Account ─► Phase 8 Admin (SCR-36: record → activate → restore in finally)
          │
          ▼
   Phase 10 (NotFound, shortcuts)
          │
          ▼
   Phase 11: drawing undo → straighten → {scratch} → all floors → project → [invitee] → LOGOUT

Track B (mock dev server, independent, can run any time):
   Phase 9 role matrix (admin@/engineer@/viewer@example.com) + SCR-40 dev routes
```

**Hard rules**
- **R1:** Phase 11 runs only after every non-destructive test that needs CP-2, CP-3 or CP-5.
- **R2:** SCR-36 records the original `activeVersionId` **before** activating, and restores it in a `finally` block. A crashed run restores it first on resume.
- **R3:** SCR-32 restore runs after every Phase 4–5 write (it wipes them) and before Phase 11.
- **R4:** The SCR-33 profile field and the theme are reverted inside the same test.
- **R5:** A P0 failure stops the **feature** steps, but the **teardown always runs**: registry restore (R2), delete CP-2, delete any invitee, logout. Save the trace, HAR and console on failure.
- **R6:** Don't click the create-project toast's "Hoàn tác". Don't remove yourself as a member (it navigates away and later CP-2 steps 404).

---

## 6. Findings from static analysis (confirm at run time)

| ID | Finding | Where |
|---|---|---|
| F-01 | No logout, user menu or account entry in the product shell. `/tai-khoan` is reachable only from the notification gear (dashboard) and the pipeline "support" links. | `components/shell/AppShell.tsx` (only `ShellDemo`) |
| F-02 | No route-level role guard; `/khong-co-quyen` is never navigated to. (ModelLibrary **is** gated inline; v1 was wrong.) | `router.tsx` |
| F-03 | RuleReport `canEdit` defaults to true, so its forbidden state is unreachable; the route passes nothing. | `useRuleReport.ts:367`, `RuleReport.container.tsx:225` |
| F-04 | No SSO flow is wired: "Đăng nhập bằng SSO công ty" and the "Hoặc" divider are not rendered (BUG-002 fix; was a no-op button). Test: `phase01_auth.spec.ts` "no SSO flow wired → no … button". | `useAuthScreen.ts:781`, `AuthScreen.tsx:190-209` |
| F-05 | "Xoá tầng" deletes immediately with no confirm. Undo re-creates the floor (new id) and cannot restore its contents (`persistFloorContents:false`). | `FloorTable.tsx:173`, `floorManagerGateway.ts:1260` |
| F-06 | PipelineGraph is always empty at the real route (no `run`). | `PipelineGraph.container.tsx:114` |
| F-07 | The CAD branch cannot succeed against the real gateway. | `cadBranchConfirmGateway.ts:325` |
| F-08 | **Dimension OCR shows "saved" but never persists** (`unsupported` resolves as success). Axis edits aren't persisted either, but the UI says so. | `useDimensionOcrReview.ts:582`, `useAxisGridManager.ts:170` |
| F-09 | VersionHistory gets no `onToast` / `onExportVersion`, so restore and label undo toasts and "Xuất phiên bản này" are unreachable. | `VersionHistory.container.tsx:223` |
| F-10 | No in-app link to `/pipeline/graph`, `/cad-confirm`, `/onboarding`, `/m/du-an/:id`, `/versions`, `/data`, `/3d/pascal`, `/admin/models`, `/admin/users`, `/khong-co-quyen`. Invitation accept lands on `/`, not onboarding. | grep of `ROUTES.*` |
| F-11 | (To verify.) Per-project `userRoles` stays in the store after leaving a project and is read first by ModelLibrary, Export, Data, Versions and RuleSettings, so an admin could be falsely forbidden. | `api/floorLayerGraph.ts:181`, `store/projectHydration.ts:36` |
| F-12 | MeasurementTool has no FE `can()`, so a viewer may be able to pin. SpatialJsonViewer only checks `roles.length > 0`. | `useMeasurementTool.ts`, `SpatialJsonViewer` |

---

## 7. Changes from v1 (from the review)

- **Facts corrected:** route count 31→38; login 200→**204** + refresh; reorder POST→**PATCH `/api/floors/reorder`**; version label PUT→**PATCH**; "Ghi chú" goes to PUT settings only; NotFound heading "Dự án gần đây"; "Mét (m)" casing; "Xoá mọi tầng" needs no typed name; SCR-13 engineer copy.
- **Structural fixes:**
  - The wizard needs the "Chiều cao áp cho mọi tầng" + "Áp cho mọi tầng" steps and creates 4 floors; floor names are now captured from the server.
  - Versions come from the pipeline and restores, not autosave; restore targets the AI row, never the oldest.
  - **The registry test now uses the opening family and restores the recorded version.** v1's "Quay về đường cổ điển" would have left walls with no model, globally.
  - Pipeline runs immediately after upload; the SCR-11 checkbox is conditional.
- **Feasibility fixes:**
  - `dismissTour` ("Bỏ qua hướng dẫn").
  - `exact:true` for "Mật khẩu" and "Thông báo".
  - Thickness: click the first unchecked radio.
  - Merge needs adjacent walls.
  - "Sang lớp…" needs every wall approved.
  - SCR-21 needs the "Đồng ý chuẩn hoá…" tick.
  - Measure clicks must hit geometry.
  - Objects are targeted with a `g[aria-label]` locator.
- **Sequencing:**
  - The role matrix moved to Track B (mock), which removes the invite-token blocker.
  - Member add/remove and invites are now opt-in.
  - Teardown always runs (R5); restore after all writes (R3).
- **Added:** open-redirect check, signed-in `/login`, session expiry + cross-tab sign-out, 3D geometry PUT, positive engineer checks, viewer gaps (F-11, F-12).
- **Environment:** `web` must be built from c4978eb4; `localhost` only; the 4-variable port change; the FIX-378/379 flag conditions; CP-8 needs about 10 min of seeding.

## 8. Open questions (answer before execution)

1. **Runner:** there's no Playwright MCP server in this session. Options: (a) drive the built-in browser pane through this matrix, (b) run `pnpm e2e:fullstack` for the P0 backbone, the existing mocked specs for Track B, and the browser pane for the gaps, or (c) write the gaps as new Playwright specs.
2. **Track A image:** can I (or you) hand-build `web` from c4978eb4 per README precondition 1? The last green run used efbda6bd.
3. **CP-8:** is a second evaluated onnx in the opening family already seeded? If not, SCR-36 activation is skipped and only the "Kích hoạt" disabled-reason copy is checked.
4. **Opt-ins:** JSON export download, user invite and forgot-password email (need a mail sink or `.invalid` domain), training job.
