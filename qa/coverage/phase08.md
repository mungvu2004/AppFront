<!-- qa-sources fe=ccd645a5 -->
# Phase 08 — Admin: FE coverage inventory

Screens SCR-34 Model Library (`/admin/models`), SCR-35 Training Jobs (`/admin/training/jobs`), SCR-36 Model Registry
(`/admin/training/models`), SCR-37 User Management (`/admin/users`) — `src/routes/router.tsx:386-389`.
Source `F:/App/AppFront` @ ccd645a5. Backend rules (N23–N37 admin ML, #38–#46 users, `/library`: field rules, error
codes, 403 per role, `users_invite` limit) live in `coverage/phase08-be.md` (API spec), not here.

Test keys:
- **M** `tests/phase08_admin.spec.ts` (serial, one admin page) — title quoted by key words.
- **E** `tests/phase08_admin_edge.spec.ts` (non-serial, own context + in-context API sign-in per test; one real `engineer`
  invitee per worker) — `E08 · …` titles.
- **R9** `tests/phase09_roles_matrix.spec.ts` (Track B, mock roles) — `SCR-3x [E]/[V] …` titles.
- **E01** `tests/phase01_auth_edge.spec.ts` "anonymous on the routes of SCR-08/10/11/37/38/39/40".
- **UI** dedicated UI-verify spec `tests/phase08_admin_ui.spec.ts` (owner: qa-verify-ui step; **not authored yet** at
  this stamp) — compact/responsive rows marked `gap (UI)` until it exists.

Path short names (under `src/screens/admin/`): `MLC` ModelLibrary/ModelLibrary.container.tsx, `ML` ModelLibrary.tsx,
`MLT` ModelLibraryToolbar.tsx, `MLB` ModelLibraryTable.tsx, `MLD` ModelLibraryDetail.tsx, `MLS` ModelLibrarySummary.tsx,
`UML` useModelLibrary.ts, `MLG` modelLibraryGateway.ts · `TJ` TrainingJobs/TrainingJobs.tsx, `TJC` TrainingJobs.container.tsx,
`TJF` TrainingJobForm.tsx, `TJT` TrainingJobsTable.tsx, `TDT` TrainingDatasetsTab.tsx, `TJD` TrainingJobDetail.tsx,
`UTJ` useTrainingJobs.ts, `TJG` trainingJobsGateway.ts · `MR` ModelRegistry/ModelRegistry.tsx, `MRA` ModelRegistryActivateDialog.tsx,
`MRV` ModelRegistryVersionTable.tsx, `MRD` ModelRegistryDetail.tsx, `UMR` useModelRegistry.ts, `MRE` modelRegistryErrors.ts ·
`UM` UserManagement/UserManagement.tsx, `UMC` UserManagement.container.tsx, `UMT` UserManagementToolbar.tsx,
`UMB` UserManagementTable.tsx, `UMD` UserManagementDetail.tsx, `UMP` UserManagementPermissionMatrix.tsx,
`UUM` useUserManagement.ts, `UMG` userManagementGateway.ts.
Others: `TBL` src/components/ui/Table.tsx, `TAB` src/components/ui/Tabs.tsx, `SEG` src/components/ui/SegmentedControl.tsx,
`MOD` src/components/overlay/Modal.tsx, `DRW` src/components/overlay/Drawer.tsx, `FT` src/lib/input/focusTrap.ts,
`SR` src/lib/input/shortcutRegistry.ts, `NB` src/lib/mutations/notificationBus.ts, `UNF` src/hooks/useNumericField.ts,
`PERM` src/lib/auth/permissions.ts, `I18N` src/i18n/vi.json.

## Shared — gate and roles

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 1 | Navigation | Anonymous → `/login?next=<path>` on `/admin/models`, `/admin/training/jobs`, `/admin/training/models`; no `/api/library` or `/api/admin` read | `src/routes/router.tsx:386-388`, plan G1 | E "SCR-34/35/36 anonymous → /login?next=…" | covered |
| 2 | Navigation | Anonymous → `/login?next=%2Fadmin%2Fusers` | `src/routes/router.tsx:389` | E01 "anonymous on the routes of SCR-08/10/11/37…" | covered |
| 3 | Permission | No route guard; each screen gates itself (G2). Library uses `can('manage','library')` with store `userRoles` first (F-11) | `MLC:126-131`, `MLG:111-125` | R9 "SCR-34 [A] F-11 …" (fixme) | gap (F-11 stale-role scenario, owned by phase 09) |

## SCR-34 Model Library

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 4 | Network | `GET /api/library` once on open (bare array) | `UML:339-342`, `src/api/client.ts:1082` | M "SCR-34 search, category, sort…", E every SCR-34 test | covered |
| 5 | State | Loading: breadcrumb + 6-header table with 10 skeleton rows | `ML:61-83` | — | gap (sub-second on the real stack; needs a held response; P3) |
| 6 | State | Empty library: EmptyState "Chưa có model nào" / "Thư viện chưa có model nào." (before the read-only alert) | `ML:85-91`, `UML:504` | M (skip branch), E "real engineer" (empty branch) | covered (env-dependent branch) |
| 7 | State | Read error: InlineAlert "Không tải được thư viện model" + `describeError` text; **no retry action** although `retryLoad` exists | `ML:93-99`, `UML:498-502,570-572` | E "[mocked response] GET /api/library 500 …" | covered (mock, unpairable 5xx) |
| 8 | State | Recovery from the error state only by reload (no "Thử lại") | `ML:96` | E "[mocked response] … a reload recovers" | covered |
| 9 | Permission | Non-admin (`library.manage` false): attention alert "Vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện", table still rendered | `UML:101-103,506-509,577`, `ML:103`, `PERM:64-75` | E "SCR-34 real engineer …", R9 "SCR-34 [E] load" | covered |
| 10 | Display | Admin: no read-only alert, no write control (G7) | `MLT:1-14`, `MLD:26-37` | M row SCR-34, E "real engineer" (write regex) | covered |
| 11 | Display | Breadcrumb "Quản trị › Thư viện model" (no h1 on this screen) | `ML:36-38,47-58` | — | gap (display only; P3 — no h1, see a11y review) |
| 12 | Input | "tìm model" filters by name | `MLT:17,37-43`, `UML:216-221,370-379` | M | covered |
| 13 | Input | Search folds case + diacritics, trims spaces | `UML:216-221`, `src/lib/format/fold.ts:36-38` | E "SCR-34 search folds case, diacritics …" | covered |
| 14 | State | No match: table row "Không tìm thấy model phù hợp." | `MLB:31,217-218` | E "SCR-34 search folds … a miss shows …" | covered |
| 15 | State | No match in grid / card list: `<p>` "Không tìm thấy model phù hợp." | `MLB:97-100,145-147` | E same test (grid) | covered (cards: gap P3) |
| 16 | Display | Summary strip "Tổng số model" / "Tổng dung lượng" / "model nặng" computed from FILTERED rows | `MLS:12-46`, `UML:262-279,397` | E "SCR-34 search … summary counts 0" | covered (total size label not asserted: `formatFileSize(0)` copy UNKNOWN) |
| 17 | Select | "danh mục" filter with "<label> (<count>)" options | `MLT:45-54`, `UML:387-395` | M | covered |
| 18 | Sort | Default sort "Tên" ascending (`aria-sort`) | `UML:320-323`, `TBL:161-176` | E "SCR-34 sort …" | covered |
| 19 | Sort | "Số tam giác" asc → desc toggle, numeric order; other headers go `none` | `UML:232-249,554-559`, `MLB:209-213` | M (asc), E "SCR-34 sort …" (asc + desc, order) | covered |
| 20 | Keyboard | Sortable `th` has no tabindex / key handler → sorting is mouse-only | `TBL:166-176` | — | gap (A12 keyboard parity; route to a11y review, no source-backed expected behaviour) |
| 21 | Segmented | "Chế độ xem" Bảng/Lưới by click | `MLT:22-25,56-61` | M | covered |
| 22 | Keyboard | "Chế độ xem" ArrowRight | `SEG:128-139` | E "SCR-34 keyboard: ArrowRight picks Lưới …" | covered |
| 23 | Keyboard | Grid card (role=listitem, tabIndex 0) + Enter → detail | `MLB:150-166` | E "SCR-34 keyboard … Enter on a focused card" | covered |
| 24 | Button | Table name button → detail | `MLB:225-233` | — (M uses the grid card) | gap (P3; same `openDetail`) |
| 25 | Network | `GET /api/library/:id` when the detail opens | `UML:344-354` | E "SCR-34 keyboard …" | covered |
| 26 | Panel | Detail `aside "Chi tiết model"`: h2 name, "Xem trước mô hình", "Số tam giác" ("Máy chủ khai"), "Siêu dữ liệu model" (4 rows), auto-spin note | `MLD:101-230,277-324`, `UML:101-110,474` | M (h2), E "SCR-34 keyboard …" | covered |
| 27 | Panel | Measured count "Đo lại từ tệp" + caption after the GLB loads | `MLD:180-192`, `UML:436-440` | — | gap (needs WebGL + a real GLB; P3) |
| 28 | State | Preview failed: neutral overlay + "Thử lại" (reopens the same model) | `MLD:118-142`, `UML:442-451,535-538` | — | gap (no broken model on the stack; P3) |
| 29 | Button | Row preview retry "Thử tải lại ảnh xem trước của {name}" (when `previewUrl` missing) → invalidates list + detail | `MLB:40,66-76`, `UML:549-554` | — | UNKNOWN (depends on library data without `previewUrl`; NEED VERIFICATION of the seed) |
| 30 | Display | Heavy badge "Nặng" + heavy advice section "Cảnh báo model nặng" | `MLB:115,176,244-248`, `MLD:250-267` | — | UNKNOWN (depends on a model over `SCENE_BUDGET`; NEED VERIFICATION of the seed) |
| 31 | Keyboard | Esc closes the detail (sidePanel scope) | `MLD:283-289` | M | covered |
| 32 | Button | "Đóng panel chi tiết model" | `MLD:305-310` | E "SCR-34 keyboard … close button removes it" | covered |
| 33 | Layout | < 1024 px: stacked cards whatever "Lưới" says; name button opens detail | `MLC:58,75-97`, `MLB:189-192`, `UML:516-517` | E "SCR-34 below 1024 px …" | covered |
| 34 | Layout | 1440/1024/768/375 layout metrics | `ML:47-58`, `MLD:68-69` | UI | gap (UI) |
| 35 | Navigation | Refresh resets search / view / sort / filter (local state only) | `UML:317-323` | E "SCR-34 refresh resets …" | covered |
| 36 | State | Render crash → `ScreenErrorBoundary` fallback | `MLC:106-119,159-170` | — | gap (not producible on the real stack; P3) |

## SCR-35 Training Jobs

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 37 | Network | `GET /api/admin/ml/training-jobs` on open; polls every 15 s while a job is active (≤ 3 pages) | `UTJ:89-90,415-427` | M, E every SCR-35 test | covered (polling: gap P3, needs an active job) |
| 38 | Display | Header: breadcrumb "Quản trị › Huấn luyện model" (`aria-current`), h1 "Huấn luyện model AI" | `TJ:26-62` | E "SCR-35 ↔ SCR-36 related links …" | covered |
| 39 | Link | "Model AI của chuỗi xử lý" → `/admin/training/models` (plain `<a>`) | `TJ:57-59`, `UTJ:151,161` | E "SCR-35 ↔ SCR-36 related links …" | covered |
| 40 | Navigation | Browser Back after the cross links | — | E "… related links and Back" | covered |
| 41 | Tabs | "Lượt huấn luyện" / "Bộ dữ liệu" by click | `TJ:145-162` | M | covered |
| 42 | Keyboard | Tabs ArrowRight / ArrowLeft / Home / End move selection + focus | `TAB:98-118` | E "SCR-35 tabs keyboard …" | covered |
| 43 | Segmented | "Lọc theo họ" → `training-jobs?family=…` | `TJ:67-72`, `UTJ:163-166,405-413` | E "SCR-35 Lọc theo họ = Tách lớp tường …" | covered |
| 44 | Select | "Lọc theo trạng thái" → `?status=…` | `TJ:73-88`, `UTJ:168-174` | M | covered |
| 45 | State | Filtered and empty → "Không có lượt nào khớp bộ lọc." | `TJT:121-122`, `UTJ:815-820` | E "SCR-35 Lọc theo họ …" (branch on the real response) | covered (env-dependent branch) |
| 46 | State | No jobs at all → "Chưa có lượt huấn luyện" + "Chưa có lượt huấn luyện nào. Tạo lượt đầu tiên…" | `TJT:121-122`, `UTJ:146` | M (skip branch evidence) | covered (env-dependent) |
| 47 | State | Loading: 8 skeleton rows (`aria-busy`) | `TJ:96-104,114-116`, `UTJ:99` | — | gap (sub-second; P3) |
| 48 | State | Read error: "Không đọc được dữ liệu huấn luyện" + text + "Thử lại" (refetch); toolbar stays | `TJT:107-116`, `UTJ:578-585,728-731`, `TJG:171-182` | E "SCR-35 [mocked response] GET training-jobs 500 …" | covered (mock, unpairable 5xx) |
| 49 | State | Partial: "N lượt đang chờ hoặc chạy; số liệu tự cập nhật." | `TJT:120`, `UTJ:197-199` | — | gap (needs an active job; opt-in ML compute) |
| 50 | Button | "Xem thêm" (next cursor), load-more error, silent `CURSOR_INVALID` retry once | `TJT:128-133`, `UTJ:720-726` | — | gap (needs > 1 page of jobs; P3) |
| 51 | Button | Row open button (`aria-pressed`) → `aside "Chi tiết lượt huấn luyện"` with "Số đo" / "Nhật ký" | `TJT:28-38`, `TJ:120-124`, `TJD:183-190` | M | covered (env-dependent: skips with no job) |
| 52 | Panel | Detail fields, failure text, "Xem model AI đã tạo" link, notice | `TJD:145-182`, `UTJ:150,275` | — | gap (needs a finished job; P3) |
| 53 | Network | `GET …/training-jobs/:id`, `/metrics`, `/logs` cursor polling; stops on 401/403/404 | `UTJ:437-512`, `TJG:150-158` | — | gap (needs a job; P3) |
| 54 | Button | "Huỷ lượt" → dialog "Huỷ lượt huấn luyện này?" / "Giữ lại"; 409 not cancellable notice | `TJD:177-181,201-224`, `UTJ:680-713` | — | gap (needs an active job; never run here: opt-in ML compute) |
| 55 | Button | "Tạo lượt huấn luyện" opens the form; "Đóng" closes without POST | `TJ:89-91`, `TJF:121-124` | M "SCR-35 Tạo lượt huấn luyện → Đóng" | covered |
| 56 | Keyboard | Enter on the opener opens the form; Esc closes; focus returns to the opener | `MOD:56-78`, `FT:183-213`, `TJF:1-5` | E "SCR-35 form keyboard …" | covered |
| 57 | Network | Form reads `GET datasets?family=` for the form family; family switch re-reads | `UTJ:517-524,733-740` | E "SCR-35 form keyboard …" | covered |
| 58 | Select | "Bộ dữ liệu" picker disabled with no option; first dataset preselected | `TJF:38-55,92`, `UTJ:522-524` | E "SCR-35 form keyboard …" (branch on the real response) | covered |
| 59 | Select | "Phiên bản" ready versions only; "Bộ dữ liệu này chưa có phiên bản sẵn sàng." | `TJF:93-99`, `UTJ:526-537,768-771` | — | UNKNOWN (needs a dataset with/without a ready version; NEED VERIFICATION of the seed) |
| 60 | Segmented | "Model nền" per family (`yolov8n`/`yolov8s` for openings), first preselected | `TJF:100-108`, `src/api/schemas/adminMl.ts:64-67`, `UTJ:539-541` | E "SCR-35 form keyboard …" | covered |
| 61 | Validation | "Số vòng" < 1 → "Giá trị không nhỏ hơn 1." (field's own refusal, not committed) | `UNF:69-74`, `UTJ:96` | E "SCR-35 form Số vòng …" | covered |
| 62 | Validation | "Số vòng" > 300 → "Giá trị không quá 300." | `UNF:72`, `UTJ:97` | E same | covered |
| 63 | Validation | Empty → "Số vòng phải từ 1 đến 300.", submit disabled | `UTJ:646-652,765`, `TJG:127` | E same | covered |
| 64 | Keyboard | Enter while invalid sends nothing (form `onSubmit` → early return) | `TJF:71-74`, `UTJ:654-655` | E same (POST guard count 0) | covered |
| 65 | Validation | Non-integer "Số vòng" (e.g. "2,5") → epochsInvalid | `UTJ:646-650` | — | UNKNOWN (`parseNumber` of "2,5" not verified; NEED VERIFICATION) |
| 66 | Submit | "Bắt đầu huấn luyện" → `POST training-jobs` 202 with Idempotency key, toast "Đã xếp hàng lượt huấn luyện", field errors from 422 | `UTJ:600-640,654-668`, `TJG:123-138` | — | n/a-by-design (plan §3 opt-in: ML compute; never clicked) |
| 67 | Tabs | "Bộ dữ liệu": read-only note, "Họ model" (3 families) → `datasets?family=` | `TDT:110-123`, `UTJ:185-187,544-548` | E "SCR-35 Bộ dữ liệu tab …" | covered |
| 68 | State | Datasets empty → "Chưa có bộ dữ liệu" + CLI copy; list nav "Danh sách bộ dữ liệu" (first `aria-pressed`) + "Phiên bản" section | `TDT:80-105`, `UTJ:148,551-553` | E same (branch on the real response) | covered |
| 69 | Table | Dataset versions table / "Bộ dữ liệu này chưa có phiên bản nào." / version read error | `TDT:34-66` | — | gap (only the section region is asserted; contents env-dependent; P3) |
| 70 | Permission | Non-admin: header + "Không có quyền truy cập" / "Chỉ quản trị viên hệ thống xem được trang huấn luyện."; no tabs; no `/api/admin/ml` request | `TJG:39-41`, `UTJ:399-402,580`, `TJ:133-140` | E "SCR-35 real engineer …", R9 "SCR-35 [E]/[V]" | covered |
| 71 | Permission | 403 mid-session locks the screen into forbidden | `UTJ:567-575` | — | gap (needs a role change mid-session; P3) |
| 72 | Layout | < 1024 px: cards + `Drawer "Chi tiết lượt huấn luyện"` | `TJ:164-172`, `TJT:41-70` | UI | gap (UI; needs a job) |
| 73 | Keyboard | Desktop side panel has no Esc binding (only the < 1024 Drawer closes on Esc) | `TJ:120-124` vs `DRW:156-160` | — | UNKNOWN (A12 scope of a non-layer side panel; route to a11y review) |

## SCR-36 Model Registry

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 74 | Network | `GET model-families` + `GET model-versions?family=wallSegmentation` on open | `UMR:398-410` | M, E every SCR-36 test | covered |
| 75 | Display | Header: breadcrumb "Quản trị › Model AI", h1 "Model AI của chuỗi xử lý", link "Lượt huấn luyện" → `/admin/training/jobs` | `MR:25-67`, `UMR:94` | E "SCR-35 ↔ SCR-36 related links …" | covered |
| 76 | Segmented | "Họ model" click → versions read for the family | `MR:187-193`, `UMR:567-573` | M | covered |
| 77 | Keyboard | "Họ model" ArrowRight walks the three families | `SEG:128-139` | E "SCR-36 every family via ArrowRight …" | covered |
| 78 | Card | "Đang dùng" card: label / format · metric · date; "Đường cổ điển" (walls, none) / "Chưa kích hoạt bản nào" | `MR:75-108`, `UMR:227-253` | M, E "SCR-36 every family …" | covered |
| 79 | Button | "Quay về đường cổ điển" only for walls with an active version | `MR:101-105`, `UMR:247` | M (walls), E "SCR-36 every family …" (absence elsewhere) | covered |
| 80 | Dialog | Revert dialog "Quay về đường cổ điển cho tách lớp tường?" + confirm | `UMR:164-166,328-333`, `MRA` | — | n/a-by-design (plan: "Do not click" — `versionId:null` is global) |
| 81 | Table | Rows: label button, format, evaluation badge, metric, source, date; "Đang dùng" badge on the active row | `MRV:19,42-47,112-144`, `UMR:208-225` | M, E "SCR-36 every family …" | covered |
| 82 | Validation | Blocked "Kích hoạt" + reason "Chỉ kích hoạt được bản đã đánh giá." / "…định dạng onnx." (`aria-describedby`) | `MRV:49-59`, `UMR:201-206` | M (CP-8 missing branch), E "SCR-36 every family …" | covered |
| 83 | State | Partial: "N phiên bản đang chờ hoặc đang đánh giá; …" | `MR:147`, `UMR:178-180,342-343` | E "SCR-36 every family …" (branch on the real response) | covered |
| 84 | State | Empty family: "Chưa có phiên bản" + emptyBase (+ "Đang dùng đường cổ điển." for walls without active) | `MR:148-149`, `UMR:336-340` | E "SCR-36 every family …" (branch on the real response) | covered (env-dependent branch) |
| 85 | State | Loading skeleton (card + 8 rows, `aria-busy`) | `MR:111-122` | — | gap (sub-second; P3) |
| 86 | State | Read error "Không đọc được danh sách model" + "Thử lại" (refetch both); picker stays | `MR:124-133`, `UMR:437-440,638-642`, `MRE:59-74` | E "SCR-36 [mocked response] GET model-families 500 …" | covered (mock, unpairable 5xx) |
| 87 | State | Refresh error with rows kept (inline "Thử lại") | `MR:140-146`, `UMR:435-436` | — | gap (needs a failing refetch after success; P3) |
| 88 | Button | "Xem thêm" / load-more error / silent `CURSOR_INVALID` retry | `MR:155-166`, `UMR:629-636` | — | gap (needs > 1 page of versions; P3) |
| 89 | Button | Version label (`aria-pressed`) → `aside "Chi tiết phiên bản"`; placeholder before | `MRV:29-40`, `MR:207-211`, `MRD:13-17` | E "SCR-36 version label → Chi tiết phiên bản …" | covered |
| 90 | Network | `GET model-versions/:id` for the selected version (and for the active one) | `UMR:415-425` | E same | covered |
| 91 | Panel | Detail: h2, evaluation badge, Mã / Mã băm / Định dạng / Số đo / Người tạo / Ngày tạo; failure note; seed note | `MRD:15-47`, `UMR:256-299` | E same (fields); failure/seed notes env-dependent | covered (notes: UNKNOWN, depend on data) |
| 92 | Dialog | "Kích hoạt" → dialog title "Kích hoạt {label} cho {family}?", body, warning when the active one is not evaluated | `MRA:20-50`, `UMR:160-162,304-334,575-585` | M (confirm), E "SCR-36 activation dialog …" | covered |
| 93 | Dialog | "Huỷ" and Esc close the dialog with no PUT | `MRA:35-37`, `UMR:594-597`, `MOD:64,77-79` | E "SCR-36 activation dialog …" (PUT guard 0) | covered |
| 94 | Network | Confirm → `PUT model-families/{family}/active {baseVersion, versionId}` 200; "Đang dùng" moves; focus to the card | `UMR:470-560,599-627`, `MR:83-87` | M (record → activate → restore) | covered (env: CP-8) |
| 95 | Toast | "Đã kích hoạt … cho …" + undo ticket / no-undo descriptions; undo publishes "Đã hoàn tác lượt đổi model" | `UMR:132-138,520-557` | — | gap (global state; the restore is done by the UI button, never by toast undo — rule R2) |
| 96 | State | 409 `VERSION_CONFLICT` → conflict notice + "Tải lại" | `MR:195-201`, `UMR:483-487,644-649` | — | gap (needs a concurrent writer of GLOBAL registry state; not safe; P2) |
| 97 | State | Activate error inside the dialog (422 not evaluated / format, 404) | `MRA:31`, `MRE:11-21,76-77` | — | gap (BE rules in `phase08-be.md`; UI path needs a failing PUT on global state; P3) |
| 98 | Permission | Non-admin: header + "Không có quyền truy cập" / "Chỉ quản trị viên hệ thống xem được model AI."; no picker; no `/api/admin/ml` request | `UMR:395-396,450`, `MR:172-178` | E "SCR-36 real engineer …", R9 "SCR-36 [E]/[V]" | covered |
| 99 | Layout | < 1024 px: cards + `Drawer "Chi tiết phiên bản"` | `MR:214-222`, `MRV:80-110` | UI | gap (UI) |

## SCR-37 User Management

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 100 | Network | `GET /api/users` on open (`{total, users}`) | `UUM:536-540`, `src/api/client.ts:1393-1398` | M, E every SCR-37 test | covered |
| 101 | State | Loading: table skeleton (6 or 3 columns) | `UMB:271-280` | — | gap (sub-second; P3) |
| 102 | State | Only the signed-in admin → EmptyState "Chưa có người dùng nào khác" + teaching copy + invite action | `UM:91-101`, `UUM:142-143,994-996` | M (skip branch) | gap (the engineer invitee always exists in E; P3) |
| 103 | State | Read error "Không tải được danh sách người dùng" + `describeError` + "Thử lại" | `UM:103-112`, `UUM:966-970,1184-1186` | E "SCR-37 [mocked response] GET /api/users 500 …" | covered (mock, unpairable 5xx) |
| 104 | Display | Breadcrumb "Quản trị › Người dùng" (no links) | `UM:60-89`, `UUM:1229-1235` | — | gap (display only; P3) |
| 105 | Display | Summary "Người dùng" / "Quản trị" (ACTIVE admins) / "Lời mời đang chờ" | `UMT:97-110`, `UUM:262-271,627-633` | E "SCR-37 summary counts match GET /api/users …" | covered |
| 106 | Input | "Tìm người dùng" filters name/email | `UMT:58-65`, `UUM:351-359` | M | covered |
| 107 | Input | Search folds case (upper-case email) | `UUM:351-359` | E "SCR-37 summary … upper-case email search" | covered |
| 108 | Select | "Vai" / "Trạng thái" filters | `UMT:66-79` | M | covered |
| 109 | State | No match → "Không tìm thấy người dùng" + body + "Xoá tìm kiếm và bộ lọc" | `UMB:39-42,169-178,282-284` | E "SCR-37 search miss with filters …" | covered |
| 110 | Keyboard | "Xoá tìm kiếm và bộ lọc" resets search + both filters and focuses the search box (BUG-082) | `UM:128-137`, `UUM:1066-1070` | E same | covered |
| 111 | Button | "Xem ma trận quyền" → modal "Ma trận quyền theo vai trò"; close button | `UM:174-181,208-216` | M | covered |
| 112 | Display | Matrix: 7 rows × 3 roles, sr-only sentence per cell, values = `permissions.ts` | `UMP:37-79`, `UMG:171-215`, `PERM:49-86` | E "SCR-37 permission matrix …" | covered |
| 113 | Keyboard | Matrix Esc closes; focus returns to the opener | `MOD:56-79`, `FT:183-213` | E same | covered |
| 114 | Button | Row name → `aside "Chi tiết người dùng"`; Esc closes | `UMB:305-311`, `UM:144-157` | M | covered |
| 115 | Network | Detail reads `GET /users/:id/memberships` + `/activity` | `UUM:542-560` | E "SCR-37 detail panel of the engineer …" | covered |
| 116 | Panel | Profile h2 / email / role + status badges; "Dự án tham gia" (blocked reason per project, no select) or "Người này chưa tham gia dự án nào"; "Hoạt động gần đây" (≤ 10) or "Chưa có hoạt động nào"; "Xoá người dùng" section; matrix | `UMD:86-330`, `UUM:880-910`, `UMG:350-351` | E same | covered |
| 117 | Table | Detail open → table keeps 3 columns, status under the name | `UMB:243-258,269,313-317` | E same | covered |
| 118 | Button | "Đóng chi tiết người dùng" | `UMD:105-110` | E same | covered |
| 119 | Link | Activity object link (`objectHref`) | `UMD:177-190`, `UMG:263-290` | — | UNKNOWN (depends on activity kinds of the subject; NEED VERIFICATION) |
| 120 | Validation | Own row: "Bạn không thể tự đổi vai của mình" / "…tự vô hiệu hoá…" replace the controls | `UUM:137-138,287-311` | M "SCR-37 own row …" | covered |
| 121 | Validation | Last active admin: "Đây là quản trị cuối cùng…" replaces role / disable / "Xoá" | `UUM:139,282-284,289-337` | E "SCR-37 summary … own row Xoá follows the last-admin rule" | covered |
| 122 | Select | Row role select "Vai của {name}" → `PATCH /users/:id/role {role, userId}` 200, row flash, toast "Đã đổi vai" + lost rights | `UMB:59,76-101`, `UUM:780-830,1011-1036`, `UMG:226-233` | E "SCR-37 role select on the engineer row …" | covered |
| 123 | Toast | Role toast branches: lost rights list / "Vai mới giữ nguyên mọi việc…" | `UUM:815-820` | E same (both branches) | covered |
| 124 | Toast | Same-type toasts within 5 s merge into "Hoàn tác N thay đổi" | `NB:8,150-181` | — | gap (E waits the window out on purpose; P3) |
| 125 | Toast | Role / enable undo "Hoàn tác" → reverse write, no new toast | `UUM:808-813,857-865` | — | gap (P2; undo path not exercised) |
| 126 | Button | "Vô hiệu hoá" → `POST …/disable` 200; status "Đã vô hiệu hoá"; "Bật lại" | `UMB:142-155`, `UUM:841-866,1040-1057` | E "SCR-37 Vô hiệu hoá then Bật lại …" | covered |
| 127 | Button | "Bật lại" → `POST …/enable` 200; status "Đang hoạt động" | `UMB:145-148` | E same | covered |
| 128 | Button | Row "Xoá" → dialog "Xoá hẳn {name}?" with warning and "Gõ lại {email} để xác nhận." | `UMB:157-163`, `UMD:247-289`, `UUM:150-151` | E "SCR-37 Xoá a pending invitee …" | covered |
| 129 | Validation | Confirm disabled until the typed address matches (trim + lower case) | `UUM:939-953` | E same (wrong → disabled; upper-case exact → enabled) | covered |
| 130 | Button | "Để sau" closes; reopening clears the typed address | `UMD:274-276`, `UUM:1144-1151` | E same | covered |
| 131 | Network | Confirm → `DELETE /users/:id {confirmEmail, userId}` 200; toast "Đã xoá tài khoản"; row gone (no undo, A9) | `UUM:1153-1170` | E same | covered |
| 132 | Button | Detail "Xoá" (danger) opens the same dialog | `UMD:228-240,321-325` | — | gap (same `onOpenRemove`; P3) |
| 133 | Button | "Mời người dùng" opens the invite block (toolbar; also the empty-state action) | `UMT:83-93`, `UM:94-99` | E "SCR-37 invite panel …" | covered |
| 134 | Validation | Empty → submit disabled + "Nhập ít nhất một địa chỉ thư để gửi lời mời" | `UUM:216-230,918-937`, `UMT:139-158` | E same | covered |
| 135 | Validation | Invalid → "Chưa đúng dạng địa chỉ thư: …. Viết theo dạng ten@congty.vn" + "Sửa địa chỉ chưa đúng dạng rồi mới gửi được" | `UUM:145-148,222-226` | E same | covered |
| 136 | Validation | Valid chip "N địa chỉ hợp lệ"; comma/newline split, trim, de-duplicate | `UMT:124-128`, `UMG:319-338` | E same | covered |
| 137 | Keyboard | Esc while typing in the textarea does nothing; Esc with focus outside closes and clears | `SR:23-26`, `UM:145-157`, `UUM:1110-1113` | E same | covered |
| 138 | Button | "Huỷ" closes and clears the invite block | `UMT:149-151`, `UUM:1110-1113` | E same | covered |
| 139 | Select | "Vai cho lời mời" default "Người xem" | `UMT:131-137`, `UUM:485` | E "SCR-37 Gửi lời mời …" (default) | covered (changing it: gap P3) |
| 140 | Submit | "Gửi lời mời" → `POST /users/invitations {emails, role}` 201; block closes; toast "Đã gửi lời mời"; row "Chờ chấp nhận"; pending +1 | `UUM:1116-1142` | E "SCR-37 Gửi lời mời (real, Mailpit sink) …" (M skips it as opt-in) | covered |
| 141 | Toast | Invite failure toast "Không gửi được lời mời" (429 `users_invite`, 422) | `UUM:161,1138-1140` | — | gap (BE rules in `phase08-be.md`; UI path P3) |
| 142 | Button | "Gửi lại" + "Lời mời đã hết hạn" on an expired pending row → `POST …/resend` | `UMB:114-132`, `UUM:1090-1103` | — | gap (needs an expired invitation; not producible without clock control; P2) |
| 143 | Permission | Non-admin: forbidden alert + matrix + "Về bảng điều khiển"; no `GET /api/users` | `UM:159-168`, `UUM:140-141,536-540,1261`, `UMG:245-253` | E "SCR-37 real engineer …", R9 "SCR-37 [E]/[V]" | covered |
| 144 | Navigation | "Về bảng điều khiển" → `/` (router navigate) | `UMC:205-245`, `UUM:1261` | E "SCR-37 real engineer …" | covered |
| 145 | Layout | < 1024 px: cards + `Drawer` detail | `UMB:187-236,286-288`, `UMD:355-366` | UI | gap (UI) |
| 146 | Layout | The < 1024 `Drawer` gets no `label` → `role=dialog` without an accessible name | `UMD:357-364`, `DRW:95-101,212` | — | UNKNOWN (a11y review; no source-backed copy for the name) |

## Summary

- FE rows: 146. covered 99 · gap 34 · UNKNOWN 9 · n/a-by-design 3 (#66 training submit, #80 revert dialog, + #95's
  toast-undo path kept off by R2 counted as gap). Every `gap` above is either env/data-dependent, sub-second, global
  state that must not be written, or owned by the UI-verify spec (`gap (UI)`: #34, #72, #99, #145).
- Mocked UI tests: 4 of 32 in E (12.5 %, ≤ `rules.maxMockedShare` 0.35), all 5xx → `unpairable: 5xx not producible on
  the shared stack` (to be listed in `coverage/phase08-be.md` by the API author): `GET /api/library` 500,
  `GET /api/admin/ml/training-jobs` 500, `GET /api/admin/ml/model-families` 500, `GET /api/users` 500.
- Write guards (not mocks): `PUT …/model-families/*/active`, `POST /api/admin/ml/training-jobs`,
  `POST /api/users/invitations` (validation test only) are aborted + counted; expected count 0.
- Priority gaps: #96 registry 409 conflict (needs a safe second writer), #125 toast undo for role/enable, #142 resend
  on an expired invitation, #20 keyboard sort (a11y), #146 unnamed Drawer (a11y), #29/#30/#59 seed data NEED
  VERIFICATION.
