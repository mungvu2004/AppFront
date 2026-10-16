# Phase 09 coverage — ma trận vai (FE)

Nguồn: catalog QA-09 C1–C5 (`backend/dieu-phoi/chay/QA-09/`), khoá 2026-10-14. Stack thật (pool user vai toàn cục); spec mock Track B cũ `phase09_roles_matrix.spec.ts` đã thay. Mỗi dòng cần phủ = một `test.step('[id] …')` trong `qa/tests/phase09_*.spec.ts` (cổng: `node tools/coverage-gate.mjs --phase 09`).

## QA-09 S1 — catalog C1 (prefix `9P`): vỏ + dự án, ma trận vai

Generated 2026-10-14, READ ONLY from source. FE `F:/worktrees/AppFront/p09-int` master **5fcaf502** (every FE `file:line` relative to `src/`), BE `F:/App/AppBack` main **dc510655**.
Khuôn hàng: `QA-03d/flow-catalog.md`. Khổ: 1920/1440/1024/768 (không 375, không `/m/`). Phase 09 chạy trên stack THẬT; vai = vai TOÀN CỤC (`poolUser(admin,'viewer'|'engineer'|'admin',slot)`).
⚑ = viết theo hành vi ĐÚNG, đỏ tới khi sửa. Cột `existing`: `RM` = `qa/tests/phase09_roles_matrix.spec.ts` (Track B mock, SẼ BỊ XOÁ ở S4 → status "partial" nghĩa là RM đã khẳng định nhưng chưa có bản thật).
Nhóm trong id: A flows · B states · C logic · D roles · E a11y · F responsive · G api. Số hàng 1xx = Onboarding, 2xx = SCR-08, 3xx = vỏ/nav/AccessDenied/NotFound/Thông báo, 4xx = F-11.

Viết tắt: PD=`screens/dashboard/ProjectDashboard/ProjectDashboard.tsx`, UPD=`useProjectDashboard.ts`, PDC=`ProjectDashboard.container.tsx`, PMG=`projectMenuGroups.ts`,
WS=`screens/onboarding/WelcomeScreen/WelcomeScreen.tsx`, UWS=`useWelcomeScreen.ts`, CPM=`screens/project/CreateProjectModal/CreateProjectModal.tsx`, UCPM=`useCreateProjectModal.ts`,
PS=`screens/project/ProjectSettings/ProjectSettings.tsx`, UPS=`useProjectSettings.ts`, PSC=`ProjectSettings.container.tsx`, GT=`GeneralTab.tsx`, MT=`MembersTab.tsx`, DZ=`DangerZoneTab.tsx`,
AD=`screens/system/AccessDenied/useAccessDenied.ts`, NF=`screens/system/NotFound/useNotFound.ts`, NC=`screens/system/NotificationCenter/useNotificationCenter.ts`, RT=`routes/router.tsx`, SB=`routes/SessionBootstrap.tsx`,
PM=`lib/auth/permissions.ts`, MLC=`screens/admin/ModelLibrary/ModelLibrary.container.tsx`, PH=`store/projectHydration.ts`.
BE: PR=`apps/api/projects/router.py`, MR=`apps/api/project_members/router.py`, SR=`apps/api/project_settings/router.py`, ACC=`apps/api/projects/access.py`.

Seeds (`data needs`): **MP** dự án main chain (`requireState`; user vai thêm bằng `addProjectMember`, gỡ trong `finally`) · **PV** viewer `p09-shell-viewer` (thành viên MP, chỉ đọc) · **PE** engineer `p09-shell-engineer`
· **PN** viewer `p09-shell-novice`, KHÔNG là thành viên dự án nào · **PEN** engineer `p09-shell-novice-e`, không thành viên · **DP** dự án riêng (`createProject`, engineer là thành viên, xoá trong `finally`) · **AD** admin (`signInAdmin`, đối chứng) · **AN** chưa đăng nhập.

Ma trận nguồn (PM): viewer = mọi khoá false; engineer: `project.create`, `project.settings.edit` = true, `user.manage`/`library.manage`/`ruleset.edit` = false; admin = tất cả true.
BE: `POST /projects` `require_permission("project.create")` (PR:55) · `PATCH /projects/{id}` `project.settings.edit` (PR:67) · `DELETE /projects/{id}` `require_project("admin")` (PR:80) · members POST/DELETE `project.settings.edit` (MR:36) · `PUT .../settings` cùng khoá (SR:34).

## SCR-05 ProjectDashboard (+ CreateProjectModal) — files: PD, UPD, PDC, PMG, CPM, UCPM, PM

### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-A-001 | open | viewer mở thẻ dự án được | thẻ MP mở sang màn dự án, không bị chặn · PDC | viewer là thành viên MP | edge | missing | RM L180 (mock) | real | PV, MP |
| 9P-A-002 | create | engineer: 'Dự án mới' mở CreateProjectModal; tạo xong thẻ mới xuất hiện | button 'Dự án mới' · PD:154-157; modal mở · PDC:73 | `can('create','project',{roles:['engineer']})`=true | edge | missing | — | real | PE (dự án riêng, xoá trong finally) |
| 9P-A-003 | shortcut | engineer bấm `N` (không focus ô nhập) mở modal tạo | modal mở · UPD:420 `enabled: canCreate` | canCreate=true | edge | missing | — | real | PE |

### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-B-001 | forbidden | viewer có dự án → trạng thái `forbidden`, danh sách vẫn hiện, có dòng vai | 'Vai người xem: chỉ có thể mở dự án, không tạo hoặc xoá được.' · PD:198-201 | UPD:403 `role==='viewer'` → 'forbidden' sau khi có dữ liệu | edge | partial | RM L180, phase02 #10, O14 | real | PV, MP |
| 9P-B-002 | loading | viewer: loading hiện TRƯỚC, dòng vai chưa hiện khi đang tải | skeleton rồi mới dòng vai · UPD:402 | `isPending`→'loading' thắng 'forbidden' | edge | missing | — | mock (làm chậm `/api/project-summaries` bằng `page.route`) | PV |
| 9P-B-003 | empty | viewer chưa là thành viên nào → empty KHÔNG có nút tạo, không dòng vai | 'Bạn chưa được thêm vào dự án nào. Khi được mời, dự án sẽ hiện ở đây.'; không 'Tạo dự án mới' · PD:245-249 | empty thắng forbidden (UPD:399-403) | edge | partial | phase02 #7 | real | PN |
| 9P-B-004 | empty | engineer chưa có dự án → empty CÓ nút 'Tạo dự án mới' | label 'Tạo dự án mới' · PD:249 | canCreate=true | edge | missing | — | real | PEN |
| 9P-B-005 | forbidden-modal | CreateProjectModal ở vai viewer | 'Không có quyền tạo dự án' / 'Vai trò hiện tại chỉ được xem, không thể tạo dự án mới. Liên hệ quản trị dự án nếu cần.' · CPM:275-276 | UCPM:673 | edge | n/a | phase02 W38 | n/a | n/a: viewer không có đường UI mở modal (nút ẩn PD:154, phím N tắt UPD:421, Welcome ẩn thẻ 1) — chỉ unit/Storybook |

### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-C-001 | gate | viewer: phím `N` không mở modal | không dialog tạo dự án, 0 request ghi · UPD:420-421 | `enabled:canCreate`=false | edge | missing | — | real | PV |
| 9P-C-002 | gate | engineer: 'Đổi tên' bật, đổi tên thành công (PATCH 200) | 'Đổi tên' không disabled · PMG:24; PATCH `/projects/{id}` 200 · PR:67 | `can('edit','project.settings')` engineer=true | edge | missing | — | real | PE, DP |
| 9P-C-003 | ⚑gate | engineer: 'Xoá' phải khoá/ẩn vì BE chỉ cho admin | 'Xoá' `isDisabled`; THỰC TẾ PMG:25 dùng `canEdit` ⇒ engineer thấy 'Xoá' bật, xác nhận → 403 | FE ≡ BE (PR:80, UPS:757) | edge | missing | — | real (403, không mất dữ liệu) | PE, DP |

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-D-001 | viewer-ui | viewer: KHÔNG có nút 'Dự án mới' (sau khi h1 'Dự án của tôi' + danh sách hiện) | không button 'Dự án mới' · PD:154 | canCreate=false | edge | partial | RM L180 | real | PV, MP |
| 9P-D-002 | viewer-ui | viewer: menu thẻ — 'Đổi tên' và 'Xoá' disabled | `isDisabled` cả hai · PMG:24-25 | `can('edit','project.settings')`=false | edge | partial | RM L180, phase02 #49 | real | PV, MP |
| 9P-D-003 | viewer-be | viewer mở dashboard: 0 request ghi từ dashboard | `recordWrites` rỗng | — | edge | missing | — | real | PV, MP |
| 9P-D-004 | engineer-ui | engineer: 'Dự án mới' hiện; KHÔNG dòng 'Vai người xem…' | có button; không text 'Vai người xem' · PD:154,198 | role≠viewer | edge | missing | — | real | PE, MP |
| 9P-D-005 | admin-ui | admin (đối chứng): 'Dự án mới' hiện, 'Xoá' bật, không dòng vai | như trên | adminPermissions | edge | covered | phase02 dashboard specs | real | AD |
| 9P-D-006 | anon | ẩn danh mở `/` → `/login?next=%2F` | URL đúng; không GET `/api/project-summaries` thành công · SB:406 | session anonymous | edge | covered | phase02 E01 | real | AN |
| 9P-D-007 | non-member | engineer không phải thành viên mở `/projects/<MP>/settings` → nhóm lỗi 'không tìm thấy', không lộ tên | nút 'Về danh sách dự án' (PS:59); BE 404 không 403 (K08) · ACC:53-62 | K08 | edge | missing | — | real | PEN |

### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-E-001 | a11y | viewer: mục menu disabled không kích hoạt bằng Enter; Tab không rơi vào nút vắng; dòng vai đọc được | menu item `isDisabled` · PMG:24-25 | | ui | missing | — | real | PV, MP |

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-F-001 | layout | viewer forbidden (dòng vai + danh sách) 4 khổ | không cuộn ngang, dòng vai không cắt | `verifyUi` | ui | missing | — | real | PV, MP |
| 9P-F-002 | layout | viewer empty (không nút tạo) 4 khổ | EmptyState không nút, không nhảy chiều cao | | ui | missing | — | real | PN |

### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-G-001 | read | viewer `GET /api/project-summaries` 200, chỉ dự án là thành viên | MP có, DP chưa thêm thì không · PR:88 | membership filter | api | missing | — | real | PV |
| 9P-G-002 | write | engineer đổi tên → `PATCH /api/projects/{id}` 200 (viewer 403 ở C6) | 200 · PR:67 | | api | missing | — | real | PE, DP |
| 9P-G-003 | write | engineer `DELETE /api/projects/{id}` → 403, dự án còn (GET 200) | 403 · PR:80 | admin-only | api | missing | — | real | PE, DP |

## Onboarding (WelcomeScreen) — files: WS, UWS

### B/D/F
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-D-101 | viewer-ui | viewer: `forbidden`, chỉ thẻ 3 'Duyệt kết quả và dựng 3D', luôn mở; KHÔNG thẻ 1/2 | note 'Vai người xem chỉ duyệt được kết quả, không tạo dự án và không tải bản vẽ.' · WS:70; không 'Tạo dự án', không 'Tải bản vẽ theo từng tầng' · UWS:389-394 | `session.roles[0]==='viewer'` UWS:277 | edge | missing | — | real | PV |
| 9P-D-102 | engineer-ui | engineer: đủ 3 thẻ ('Tạo dự án', 'Tải bản vẽ theo từng tầng', 'Duyệt kết quả và dựng 3D'), KHÔNG note vai; thẻ 3 khoá 'Cần tải bản vẽ trước.' | UWS:128-138 | role≠viewer | edge | missing | — | real | PEN |
| 9P-D-103 | links | viewer: 'Xem dự án mẫu', 'Bỏ qua' dùng được; hướng dẫn 'Hướng dẫn hai phút chưa sẵn sàng.' dùng `aria-disabled` (không `disabled`) | WS:161-173, UWS:406-423 | | edge | missing | — | real | PV |
| 9P-D-104 | anon | ẩn danh `/onboarding` → `/login?next=%2Fonboarding` | URL đúng · SB:406 | | edge | missing | — | real | AN |
| 9P-F-101 | layout | viewer forbidden (một thẻ) 4 khổ | một thẻ, không lệch | verifyUi | ui | missing | — | real | PV |

## SCR-08 ProjectSettings — files: PS, UPS, PSC, GT, MT, DZ, AddMemberForm.tsx

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-A-201 | engineer-edit | engineer sửa 'Tên dự án' trên DP → tự lưu, PUT settings 200 | chip lưu; PUT 200 · SR:34 | canEdit=true | edge | missing | — | real | PE, DP |
| 9P-A-202 | engineer-members | engineer thêm rồi gỡ một thành viên trên DP | 'Thêm thành viên', 'Gỡ' · MT:65-76; MR POST/DELETE 2xx | `project.settings.edit` engineer=true | edge | missing | — | real | PE, DP, PV |
| 9P-B-201 | forbidden | viewer: chỉ đọc nhưng dữ liệu đủ | h1 'Cài đặt dự án'; 'Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.' · PS:84 | UPS:1314 `!canEdit`→'forbidden' | edge | partial | RM L198, phase03 S40 | real | PV, MP |
| 9P-C-201 | gate | viewer: 0 request ghi sau khi mở các tab | `recordWrites` rỗng | | edge | missing | — | real | PV, MP |
| 9P-C-202 | logic | `canDelete = canEdit && roles.includes('admin')` dùng vai toàn cục phiên (PSC:167): engineer là thành viên DP vẫn không thấy tab nguy hiểm | UPS:757 | | edge | partial | RM L510 | real | PE, DP |
| 9P-D-201 | viewer-ui | viewer tab 'Chung': không ô sửa được; 'Ghi chú' là đoạn văn (— nếu rỗng) | không textarea · GT:71-78 | isReadOnly | edge | partial | RM L198 | real | PV, MP |
| 9P-D-202 | viewer-ui | viewer tab 'Đơn vị' chỉ đọc | `isReadOnly` · UnitsTab.tsx:50 | | edge | missing | — | real | PV, MP |
| 9P-D-203 | viewer-ui | viewer tab 'Thành viên': danh sách + badge vai; KHÔNG ô email/'Thêm thành viên', KHÔNG 'Gỡ' | `canEdit` false → rời DOM · MT:5,48,65,81 | | edge | missing | — | real | PV, MP |
| 9P-D-204 | viewer-ui | viewer: KHÔNG tab 'Vùng nguy hiểm' | tablist = chung/đơn vị/thành viên · UPS:1360 | canDelete=false | edge | partial | RM L198 | real | PV, MP |
| 9P-D-205 | engineer-ui | engineer: không dòng chỉ-xem; KHÔNG tab 'Vùng nguy hiểm'; có 'Thêm thành viên' | UPS:1360 | engineer edit=true, admin=false | edge | partial | RM L510 | real | PE, MP |
| 9P-D-206 | admin-ui | admin (đối chứng): tab 'Vùng nguy hiểm' có; không dòng chỉ-xem | UPS:1360 | | edge | covered | phase03 S2 | real | AD |
| 9P-D-207 | anon | ẩn danh `/projects/<id>/settings` → `/login?next=…` | URL | SB:406 | edge | covered | phase03 E01 | real | AN |
| 9P-D-208 | non-member | không thành viên: không lộ tên dự án, 'Về danh sách dự án' (xem 9P-D-007; hàng này kiểm viewer không thành viên) | BE 404 · ACC:53 | K08 | edge | missing | — | real | PN |
| 9P-E-201 | a11y | viewer: không `<textarea readonly>` (Tab không dừng ở ô mất viền focus); dòng chỉ-xem đọc được | GT:71-76 | A12 | ui | missing | — | real | PV |
| 9P-F-201 | layout | viewer settings chỉ-đọc 4 khổ (Chung, Thành viên) | không cuộn ngang | verifyUi | ui | missing | — | real | PV, MP |
| 9P-G-201 | read | viewer `GET /projects/{id}/settings` 200 | 200 · SR:22 | | api | missing | — | real | PV, MP |
| 9P-G-202 | write | engineer PUT settings 200 / POST member / DELETE member 2xx trên DP (viewer 403 ở C6) | SR:34, MR:36 | | api | missing | — | real | PE, DP |

## Vỏ điều hướng + AccessDenied + NotFound + NotificationCenter — files: AD, NF, NC, RT, SB, PM

Không có sidebar/nav toàn cục theo vai: `components/shell/AppShell.tsx` là thanh công cụ demo (nhãn 'Chọn', 'Tường'… không `can()`); điều hướng thật nằm trong từng màn. Route `/admin/*` KHÔNG có guard (RT:386-389), mỗi màn tự chặn (C5).

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-D-301 | nav | mục điều hướng toàn cục theo vai | n/a: không tồn tại trong mã sản phẩm | AppShell demo | edge | n/a | — | n/a | — |
| 9P-D-302 | anon | ẩn danh mở `/thong-bao`, `/tai-khoan`, `/admin/models`, `/admin/users`, `/projects/x/settings` → `/login?next=<mã hoá pathname+search>` | URL khớp · SB:406 | | edge | partial | phase08 #1-2, phase03 E01 | real | AN |
| 9P-D-303 | anon | đăng nhập xong quay lại đúng `next` (viewer → trang cài đặt chỉ-đọc) | URL cuối = next | | edge | missing | — | real | PV, MP |
| 9P-D-304 | access-denied | `/khong-co-quyen` (viewer): tiêu đề, danh tính, hành động | 'Bạn chưa có quyền truy cập'; 'Bạn đang đăng nhập bằng'; nút 'Đăng nhập bằng tài khoản khác', 'Về danh sách dự án' · AD (ACCESS_DENIED_TEXT) | | edge | missing | — | real | PV |
| 9P-D-305 | access-denied | không lộ tên dự án/số liệu khi không được phép nêu | 'Nội dung ở đường dẫn này đang giới hạn người xem, nên nó chưa mở ra cho tài khoản của bạn.' + 'Người quản trị dự án là người cấp được quyền này; hãy nhắn cho họ để được thêm vào danh sách xem.' | AD | edge | missing | — | real | PV |
| 9P-D-306 | access-denied | 'Đăng nhập bằng tài khoản khác' đăng xuất → `/login` | URL `/login…`, phiên xoá | AD signOut | edge | missing | — | real | PV |
| 9P-D-307 | not-found | ẩn danh vào đường dẫn lạ → lý do chưa đăng nhập | 'Cần đăng nhập để xem trang này' / 'Đăng nhập xong bạn sẽ được đưa lại đúng trang vừa mở.' · NF:99,106 | NF:234-249 | edge | missing | — | real | AN |
| 9P-D-308 | not-found | viewer vào đường dẫn lạ → 'Không tìm thấy trang này' (không nhánh forbidden) | NF:98 | | edge | missing | — | real | PV |
| 9P-D-309 | notifications | `/thong-bao`: thông báo lời mời có nút 'Chấp nhận' (viewer cũng dùng được) | NC:182; BE accept-invite · notifications/router.py:48 | | edge | missing | — | real | PV, AD(mời) |
| 9P-D-310 | notifications | hộp thư rỗng: 'Không có thông báo nào' | NC:159 | | edge | missing | — | real | PEN |
| 9P-D-311 | anon | ẩn danh `/thong-bao` → `/login?next=%2Fthong-bao` | URL | SB:406 | edge | missing | — | real | AN |
| 9P-F-301 | layout | AccessDenied + NotFound(chưa đăng nhập) 4 khổ | | verifyUi | ui | missing | — | real | PV, AN |
| 9P-G-301 | read | viewer `GET /api/notifications` 200; `POST /api/notifications/read` 204 trên thông báo của mình | notifications/router.py:25-40 | | api | missing | — | real | PV |

## F-11 — `userRoles` cũ (store) làm admin bị cấm sai ở `/admin/models`

| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9P-D-401 | ⚑F-11 | admin (vai toàn cục) mở MP rồi điều hướng client (không tải lại) sang `/admin/models`: thư viện KHÔNG bị cấm | không hiện 'Không có quyền'; nút quản lý hiện · MLC:126-131 (`storeRoles.length>0 ? storeRoles : session.roles`) | `can('manage','library')` theo `session.roles`; `userRoles` phải = `session.roles` (`hooks/useProjectSpatial.ts:170`) | edge | missing | phase08 #3 (fixme R9) | real | AD, MP |
| 9P-D-402 | ⚑F-11 | engineer mở MP rồi `/admin/models` bằng điều hướng client: thư viện chỉ đọc, KHÔNG nút quản lý, KHÔNG bị cấm | nội dung đọc được | `can('manage','library')`=false | edge | partial | RM L473 (mock) | real | PE, MP |
| 9P-D-403 | ⚑F-11 | vai đổi giữa chừng (pool user admin→engineer qua UserManagement/API) rồi điều hướng client: `userRoles` cũ không được mở nút quản lý | nút quản lý ẩn khi vai mới = engineer | nguồn vai = phiên | edge | missing | — | real | pool user riêng `p09-shell-flip` |

### Notes
- ⚑ 9P-C-003 / 9P-G-003 (UX-High): `projectMenuGroups.ts:25` khoá 'Xoá' bằng `canEdit` (`project.settings.edit`, engineer=true) nhưng BE `DELETE /projects/{id}` đòi admin (PR:80); trang Cài đặt dùng đúng luật admin (UPS:757). Engineer thấy 'Xoá', xác nhận, nhận 403. Đúng: 'Xoá' disabled cho vai không phải admin.
- 9P-B-005: viewer không có đường UI mở modal 'Không có quyền tạo dự án' → n/a (unit/Storybook).
- F-11 (⚑ 9P-D-401..403): MLC:131 ưu tiên `store.userRoles`; PH:218 chỉ gán `userRoles` khi `project===null` (nhánh refreshed) nên có thể là vai của dự án mở trước. Nếu `toProjectSpatial` luôn truyền `session.roles` thì chỉ lệch khi vai phiên đổi sau đó (9P-D-403). Cần xác nhận trên stack thật.
- Nav: không sidebar theo vai (9P-D-301). 9P-D-007/9P-D-208 trùng ý nghĩa nhưng khác vai/seed (PEN engineer vs PN viewer), mỗi hàng một khẳng định.
- Chưa kiểm `F:/App/qa-results/BUG-LOG.md` (`| 09 |`) — điều phối kiểm trước khi ghi bug.
- Khẳng định "không có X" luôn sau mốc chắc chắn (h1 'Dự án của tôi' / 'Cài đặt dự án' + GET đã về).

### Tóm tắt
| màn | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| SCR-05 ProjectDashboard (+ CreateProjectModal) | 24 | 1 | 23 | 2 | 4 | 17 | 1 | 0 |
| Onboarding (WelcomeScreen) | 5 | 0 | 5 | 0 | 0 | 5 | 0 | 0 |
| SCR-08 ProjectSettings | 17 | 0 | 17 | 2 | 5 | 10 | 0 | 0 |
| Vỏ điều hướng + AccessDenied + NotFound + NotificationCenter | 13 | 1 | 12 | 0 | 1 | 11 | 0 | 0 |
| F-11 | 3 | 0 | 3 | 0 | 1 | 2 | 0 | 0 |
| **Tổng** | 62 | 2 | 60 | 4 | 11 | 45 | 1 | 0 |

## QA-09 S1 — catalog C2 (tien to `9U`): tang + tai len + pipeline, ma tran vai

Built 2026-10-14 tu ma nguon: FE `F:/worktrees/AppFront/p09-int` (master 5fcaf502), BE `F:/App/AppBack` main dc510655. Chi doc ma, khong chay stack.
Vai = vai TOAN CUC cua nguoi dung (khong co vai theo du an; `addProjectMember` chi them thanh vien). Ma tran `src/lib/auth/permissions.ts`: `floor.upload` va `layer.edit` = admin/engineer true, viewer false.
Khong 375, khong `/m/`. `data needs` mac dinh `mainProject()+viewer` = du an main chain (chi doc) them thanh vien vai, go trong `finally`. Chu tieng Viet trong `expected` chep nguyen van tu nguon; phan dien giai viet khong dau.
Mã seed: PE du an rieng cho engineer · PV0 du an 0 tang · PF du an co lan chay hong · PC du an co ban ve CAD · NM non-member · ANON khong dang nhap (xem flows-C2.md).

## Tom tat

| man | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| SCR-09 FloorManager | 20 | 0 | 20 | 7 | 4 | 9 | 0 | 0 |
| SCR-10 FloorUploadScreen | 13 | 0 | 13 | 7 | 2 | 4 | 0 | 0 |
| SCR-11 InputQualityGate | 10 | 0 | 10 | 1 | 2 | 7 | 0 | 0 |
| SCR-12 ProcessingScreen | 7 | 0 | 7 | 3 | 2 | 2 | 0 | 0 |
| SCR-13 PipelineGraph | 7 | 0 | 7 | 0 | 1 | 6 | 0 | 0 |
| PipelineFailure (khoi loi trong ProcessingScreen) | 6 | 0 | 6 | 0 | 3 | 3 | 0 | 0 |
| SCR-14 ScaleCalibration | 8 | 0 | 8 | 3 | 2 | 3 | 0 | 0 |
| OverlayComparison | 10 | 0 | 10 | 0 | 0 | 10 | 0 | 0 |
| CadBranchConfirm | 8 | 0 | 8 | 0 | 2 | 6 | 0 | 0 |
| **Tong** | 89 | 0 | 89 | 21 | 18 | 50 | 0 | 0 |

## SCR-09 FloorManager `/projects/:id/floors` — files: FM=src/screens/qc/FloorManager/FloorManager.tsx · FT=FloorTable.tsx · FTR=FloorTableRow.tsx · UFM=useFloorManager.ts · BE=AppBack apps/api/floors/router.py

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-001 | D | viewer: bang tang thay the bang thong bao chi-xem | heading "Không có quyền sửa tầng" + "Vai của bạn chỉ xem được ngăn xếp tầng; mọi thao tác sửa đã được ẩn." (FM:76, UFM:183) | canEdit=can(edit,layer,viewer)=false -> forbiddenNotice != null | ui | covered | phase03_floors_roles_edge FL-09-13/14 + phase09_roles_matrix (Track B, bi xoa S4) | real | mainProject()+viewer |
| 9U-D-002 | D | viewer: nut "Thêm tầng" va "Nhân bản tầng" vang mat | getByRole(button,"Thêm tầng"/"Nhân bản tầng") count 0 (FT:80-81,196,231) | canEdit=false -> FT:196 khong dung action; FT:231 khong render | ui | covered | phase03_floors_roles_edge FL-09-13/14 | real | mainProject()+viewer |
| 9U-D-003 | D | viewer: hang tang khong co o sua ten/cao do/menu hang | khong menu "Đổi tên" / "Nhân bản" / "Xoá tầng" (FT:164-182), khong textbox cao do, khong nut "Sao chép nội thất sang tầng mới" (FTR:59,246-418) | canEdit=false -> FTR:246,266,293,315,418 khong render | ui | covered | phase03_floors_roles_edge FL-09-13/14 | real | mainProject()+viewer |
| 9U-D-004 | D | viewer: khong co lien ket "Tải lên" cho tang "Chưa có bản vẽ" | chu "Chưa có bản vẽ" con, link "Tải lên" count 0 (FTR:54,57,334 `needsDrawing && canEdit`) | FTR:334 | ui | partial | phase03_floors_roles_edge FL-09-13/14 | real | mainProject()+viewer |
| 9U-D-005 | D | viewer: "Đối chiếu lớp phủ" van mo duoc (chi doc) | nut "Đối chiếu lớp phủ" hien khi co onOpenOverlay du canEdit=false (FTR:58,403) | FTR:403 `(canEdit \|\| onOpenOverlay !== undefined)` | ui | missing | - | real | mainProject()+viewer |
| 9U-D-006 | D | viewer: phim tat Ctrl+Z / Alt+click khong lam doi du lieu | Mod+Z khong dang ky (enabled:canEdit, UFM:1530); Alt+click khong doi (FTR:192); khong request ghi | UFM:1530, FTR:192 | edge | missing | - | real | mainProject()+viewer |
| 9U-D-007 | D | viewer: khong co request ghi nao khi vao man | recordWrites(page) rong sau khi bang tang da hien (GET /projects/:id/floors da ve) | moi ham sua chan o hook (UFM:849,867,989) | edge | partial | phase03_floors_roles_edge FL-09-13/14 | real | mainProject()+viewer |
| 9U-D-008 | D | viewer, du an 0 tang: cau trong rieng cho viewer | "Khi người có quyền sửa thêm tầng, ngăn xếp tầng sẽ hiện ở đây." (UFM:1755 viewerEmptyNotice); khong action "Thêm tầng" | state=empty && !canEdit | edge | covered | phase03_floors_roles_edge FL-09-13/14 | real | PV0: createProject 0 tang + viewer member |
| 9U-D-009 | D | viewer: BE tu choi POST /projects/:id/floors | 403 FORBIDDEN (floors/router.py:30 require_project("layer.edit")) | viewer layer.edit=false | api | missing | - | real | mainProject()+viewer; payload hop le, khong tao duoc tang |
| 9U-D-010 | D | viewer: BE tu choi DELETE /floors/:floorId | 403 FORBIDDEN (floors/router.py:26,38 FloorAccess layer.edit) | viewer | api | missing | - | real | mainProject()+viewer |
| 9U-D-011 | D | viewer: BE tu choi PATCH /floors/reorder | 403 FORBIDDEN (floors/router.py:27,52 ListAccess) | viewer | api | missing | - | real | mainProject()+viewer |
| 9U-D-012 | D | viewer: BE tu choi PATCH /projects/:id/floors/:fid/spatial | 403 FORBIDDEN (floors/router.py:67) | viewer | api | missing | - | real | mainProject()+viewer |
| 9U-D-013 | D | engineer: thay "Thêm tầng"; them 1 tang thanh cong | "Thêm tầng" hien, bam -> POST 201 (floors/router.py:30), hang moi xuat hien; khong "Không có quyền sửa tầng" | can(edit,layer,engineer)=true | ui | covered | phase03_floors_roles_edge FL-09-13/14 | real | PE: createProject rieng + engineer member |
| 9U-D-014 | D | engineer: xoa tang vua them | menu "Xoá tầng" -> DELETE /floors/:id 2xx; khong 403 | layer.edit engineer=true | edge | partial | phase03_floors_roles_edge FL-09-13/14 | real | PE |
| 9U-D-015 | D | engineer: sap xep lai tang (PATCH reorder) duoc BE chap nhan | PATCH /floors/reorder 200 (ListAccess layer.edit) | engineer layer.edit=true | edge | missing | - | real | PE >=2 tang |
| 9U-D-016 | D | admin: nhu engineer (doi chung duong) | "Thêm tầng" hien; khong thong bao chi-xem | admin all true | ui | covered | phase03_floors_edge | real | mainProject()+admin |
| 9U-D-017 | D | khong phai thanh vien: khong tim thay du an | "Không tìm thấy dự án này" + "Về danh sách dự án" (ProjectSpatialGate) | require_project -> NOT_FOUND cho non-member | ui | covered | phase03_floors_roles_edge FL-09-13/14 | real | NM |
| 9U-D-018 | D | an danh: chuyen /login?next= | URL /login?next=<floors path> | guard route | edge | missing | - | real | ANON |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-E-001 | E | viewer: thong bao chi-xem co role=status, khong nut khoa bi focus | getByRole(status) chua heading "Không có quyền sửa tầng"; Tab khong dung o "Thêm tầng" (khong ton tai) | statusWithTitle | edge | partial | phase03_floors_roles_edge FL-09-13/14 | real | mainProject()+viewer |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-001 | F | viewer: bo cuc chi-doc 1920/1440/1024/768 | chup 4 kho: thong bao + bang chi-doc khong tran ngang | verifyUi | ui | missing | - | real | mainProject()+viewer |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


## SCR-10 FloorUploadScreen `/projects/:id/upload` — files: FU=src/screens/upload/FloorUploadScreen/FloorUploadScreen.tsx · UFU=useFloorUploadScreen.ts · FUC=FloorUploadCard.tsx · BE=apps/api/drawings/router.py

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-019 | D | viewer: dong chi-doc hien | "Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa." (UFU:112) | canEdit=can(upload,floor,viewer)=false -> readOnlyNotice (UFU:1321) | ui | covered | phase03_upload_roles_edge FL-10-11..15 + phase09_roles_matrix (Track B, bi xoa S4) | real | mainProject()+viewer |
| 9U-D-020 | D | viewer: khong vung tha / o chon tep | testid dropzone + file input count 0; nut "Chọn tệp" vang (UFU:103,454 canDrop) | canDrop=canEdit&&... | ui | covered | phase03_upload_roles_edge FL-10-11..15 | real | mainProject()+viewer |
| 9U-D-021 | D | viewer: danh sach tang van doc duoc | heading "Tầng 1" hien (FU:210); the tang isReadOnly: khong chon trang, khong "Xoá bản vẽ …" (UFU:1206-1208,1232) | isReadOnly=true | ui | covered | phase03_upload_roles_edge FL-10-11..15 | real | mainProject()+viewer |
| 9U-D-022 | D | viewer: nut chinh "Bắt đầu xử lý" bi an (khong khoa mo) | getByRole(button,"Bắt đầu xử lý") count 0 (UFU:115,1261 isSubmitHidden; BUG-536) | isSubmitHidden=!canEdit | ui | partial | phase03_upload_roles_edge FL-10-11..15 | real | mainProject()+viewer |
| 9U-D-023 | D | viewer: tha tep (drop event) khong dua tep vao | fireDrag khong sinh badge/the doi; khong POST /drawings/uploads | UFU:1358 `if (!canEdit) return` | edge | covered | phase03_upload_roles_edge FL-10-11..15 | real | mainProject()+viewer |
| 9U-D-024 | D | viewer: BE tu choi khoi tao tai len | POST /projects/:id/floors/:fid/drawings/uploads -> 403 FORBIDDEN (drawings/router.py:36,50 floor.upload) | viewer floor.upload=false | api | partial | phase03_upload_roles_edge FL-10-15 (api trong buoc) | real | mainProject()+viewer |
| 9U-D-025 | D | viewer: BE tu choi chunk / complete | POST .../uploads/:uid/chunks va /complete -> 403 FORBIDDEN (drawings/router.py:70,80); upload_id gia khong lo 404 thay 403 | _upload_gate truoc resolver | api | missing | - | real | mainProject()+viewer |
| 9U-D-026 | D | engineer: thay vung tha + "Bắt đầu xử lý"; tai len 1 ban ve | dropzone hien, khong dong chi-doc; init 200 (FL-10-12) | can(upload,floor,engineer)=true | ui | covered | phase03_upload_roles_edge FL-10-11..15 | real | PE: createDrawingProject rieng |
| 9U-D-027 | D | admin: vung tha hien (doi chung) | dropzone hien, khong dong chi-doc | admin true | ui | covered | phase03_upload_edge | real | mainProject()+admin |
| 9U-D-028 | D | non-member: khong mo duoc man tai len | "Không tìm thấy dự án này" (gate) | NOT_FOUND | ui | covered | phase03_upload_roles_edge FL-10-11..15 FL-10-13 | real | NM |
| 9U-D-029 | D | an danh: chuyen /login?next= | URL /login?next=<upload path> | guard | edge | missing | - | real | ANON |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-E-002 | E | viewer: dong chi-doc doc duoc, Tab khong dung o dropzone | dong chi-doc la <p> (FU:257-258) khong role=status: ghi thuc te; khong phan tu tuong tac bi khoa | FU:257 | edge | missing | - | real | mainProject()+viewer |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-002 | F | viewer: bo cuc chi-doc 4 kho | chup 1920/1440/1024/768: dong chi-doc + the tang | verifyUi | ui | missing | - | real | mainProject()+viewer |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


## SCR-11 InputQualityGate `/projects/:id/quality` — files: IQ=src/screens/upload/InputQualityGate/InputQualityGate.tsx · IQF=InputQualityGateFooter.tsx · UIQ=useInputQualityGate.ts · BE=apps/api/quality/router.py

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-030 | D | viewer: hai cot day du, chan trang khong co nut hanh dong | "Tiếp tục xử lý" va "Tải bản vẽ khác" count 0; khong checkbox "Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này" (UIQ:145-147; IQF:21-25,57; areActionsHidden UIQ:1056) | status=forbidden -> areActionsHidden | ui | partial | phase03_quality_edge (khong theo vai) / phase09_roles_matrix (Track B, bi xoa S4) | real | mainProject()+viewer |
| 9U-D-031 | D | viewer: khong keo/chon 4 goc, khong "Làm thẳng" | handler UIQ:1146,1159,1192 return khi !canEdit; khong POST corners/straighten | canEdit=false | edge | missing | - | real | mainProject()+viewer |
| 9U-D-032 | D | viewer: BE tu choi POST .../corners | 403 FORBIDDEN (quality/router.py:25,40 floor.upload) | viewer | api | missing | - | real | mainProject()+viewer |
| 9U-D-033 | D | viewer: BE tu choi POST .../straighten | 403 FORBIDDEN (quality/router.py:49) | viewer | api | missing | - | real | mainProject()+viewer |
| 9U-D-034 | D | viewer: BE cho GET bao cao chat luong (thanh vien) | GET .../quality 200 (quality/router.py:30 member gate): viewer doc duoc | _member_gate | api | missing | - | real | mainProject()+viewer |
| 9U-D-035 | D | engineer: co "Tiếp tục xử lý" / "Tải bản vẽ khác" | 2 nut hien khi co ban ve (canEdit=true); "Tải bản vẽ khác" ve /upload (khong ghi) | can(upload,floor,engineer) | ui | partial | phase03_quality_edge | real | PE: du an rieng da tai len |
| 9U-D-036 | D | engineer: POST corners duoc BE chap nhan (du an rieng) | 2xx voi payload hop le | engineer floor.upload true | edge | missing | - | real | PE |
| 9U-D-037 | D | admin: nut hanh dong hien (doi chung) | 2 nut hien | admin true | ui | covered | phase03_quality_edge | real | mainProject()+admin |
| 9U-D-038 | D | an danh: chuyen /login?next= | URL /login?next=<quality path> | guard | edge | missing | - | real | ANON |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | E | n/a | khong co hanh vi ban phim rieng theo vai | - | - | n/a | - | n/a | - |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-003 | F | viewer: bo cuc forbidden 4 kho (khong nut chan trang) | chup 4 kho; <1024 collapsed van khong nut | verifyUi | ui | missing | - | real | mainProject()+viewer |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


## SCR-12 ProcessingScreen `/projects/:id/pipeline` — files: PS=src/screens/pipeline/ProcessingScreen/ProcessingScreen.tsx · UPS=useProcessingScreen.ts · PG=processingGateway.ts

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-039 | D | viewer: hai cot day du, theo doi duoc tien trinh | state=forbidden: danh sach buoc + nhat ky hien (PS:27); khong "Huỷ xử lý" | canEdit=can(upload,floor,viewer)=false -> forbidden (UPS:800) | ui | covered | phase03_processing_roles_edge FL-12-10/11 | real | mainProject()+viewer |
| 9U-D-040 | D | viewer: khong nut "Huỷ xử lý" / "Xác nhận huỷ" | count 0 (PS:64-67); luu y cancelProcessing:false (PG:826) -> nut vang CA voi engineer | canCancel=supports.cancelProcessing&&canEdit (UPS:870) | ui | covered | phase03_processing_roles_edge FL-12-10/11 | real | mainProject()+viewer |
| 9U-D-041 | D | viewer: khong request ghi, chi GET progress | recordWrites rong; GET .../progress 200 (drawings/router.py:102 member gate) | read-only | edge | partial | phase03_processing_roles_edge FL-12-10/11 | real | mainProject()+viewer |
| 9U-D-042 | D | engineer: khong co "Huỷ xử lý" vi cancelProcessing:false (khong phai loi vai) | count 0 voi engineer; ghi nhan hanh vi thuc (PG:826-830) | UPS:870 | ui | partial | phase03_processing_roles_edge FL-12-10/11 FL-12-11 | real | PE |
| 9U-D-043 | D | admin: theo doi tien trinh (doi chung) | man tai xong, khong forbidden | admin | ui | covered | phase03_processing_edge | real | mainProject()+admin |
| 9U-D-044 | D | an danh: chuyen /login?next= | URL /login?next=<pipeline path> | guard | edge | missing | - | real | ANON |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | E | n/a | khong co hanh vi ban phim rieng theo vai | - | - | n/a | - | n/a | - |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-004 | F | viewer: bo cuc forbidden 4 kho | chup 4 kho | verifyUi | ui | missing | - | real | mainProject()+viewer |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


## SCR-13 PipelineGraph `/projects/:id/pipeline/graph` — files: PGR=src/screens/pipeline/PipelineGraph/PipelineGraph.tsx · UPG=usePipelineGraph.ts · PGT=pipelineGraphText.ts

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-045 | D | viewer: chi Tong quan, kem cau giai thich | "Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây." (PGT:211, PGR:85) | DETAIL_MODE_ROLES=[admin] (UPG:80) -> state forbidden | ui | missing | - | real | mainProject()+viewer |
| 9U-D-046 | D | viewer: khong khoi gap chi tiet, khong nut doi nhanh | count 0 cua nut doi nhanh va "Chi tiết kỹ thuật"; khong request ghi | canSeeDetail=false | ui | missing | - | real | mainProject()+viewer |
| 9U-D-047 | D | engineer: CUNG forbidden (chi admin xem chi tiet) | engineer thay dung dong giai thich nhu viewer (xem F9U-3) | DETAIL_MODE_ROLES chi admin (UPG:80) | ui | missing | - | real | PE |
| 9U-D-048 | D | engineer o du an chua chay: cau forbidden, khong "Chưa có lượt xử lý nào để kể lại" | thu tu state: error -> forbidden -> empty (UPG:540-548) | forbidden dung truoc empty (F9U-4) | ui | missing | - | real | PE chua tai ban ve |
| 9U-D-049 | D | admin: thay khoi chi tiet va nut doi nhanh | khong dong forbidden; "Chi tiết kỹ thuật" mo duoc | admin | ui | partial | phase03_graph_cad_edge | real | mainProject()+admin |
| 9U-D-050 | D | an danh: chuyen /login?next= | URL /login?next=<pipeline/graph> | guard | edge | missing | - | real | ANON |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | E | n/a | khong co hanh vi ban phim rieng theo vai | - | - | n/a | - | n/a | - |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-005 | F | viewer: bo cuc forbidden 4 kho | chup 4 kho | verifyUi | ui | missing | - | real | mainProject()+viewer |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


## PipelineFailure (khoi loi trong ProcessingScreen) — files: PF=src/screens/pipeline/PipelineFailure/PipelineFailure.tsx · UPF=usePipelineFailure.ts · PFT=pipelineFailureText.ts

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-051 | D | viewer, lan chay hong: khong co 3 huong di tiep | "Thử lại với ngưỡng thấp hơn", "Tải lên bản vẽ rõ hơn", "Bỏ qua tầng đó" count 0 (PFT:58-60; UPF:605-630; nextSteps=null) | canAct=can(upload,floor,viewer)=false -> forbidden | ui | partial | phase03_processing_roles_edge FL-12-10/11 (nhanh failed) | real | PF + viewer member |
| 9U-D-052 | D | viewer: khoi "Chi tiết kỹ thuật" bien mat han | toggle "Chi tiết kỹ thuật" (PFT:50) count 0; khong nut "Sao chép" | technicalDetails=null o forbidden | ui | partial | phase03_processing_roles_edge FL-12-10/11 | real | PF |
| 9U-D-053 | D | viewer: thong bao loi van doc duoc, kem ma loi | khoi canh bao van hien cau tieng Viet + "Mã lỗi: …" | forbidden chi bo nut/nhat ky | ui | missing | - | real | PF |
| 9U-D-054 | D | engineer: 3 huong di tiep hien du | 3 nut hien (hoac cau supportRetryUnsupported khi retryStep chua co) | canAct true | ui | partial | phase03_processing_roles_edge FL-12-10/11 FL-12-11 | real | PF + engineer |
| 9U-D-055 | D | admin: nhu engineer (doi chung) | 3 nut hien | admin | ui | missing | - | real | PF |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | E | n/a | khong co hanh vi ban phim rieng theo vai | - | - | n/a | - | n/a | - |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-006 | F | viewer: bo cuc loi-forbidden 4 kho | chup 4 kho | verifyUi | ui | missing | - | real | PF |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


## SCR-14 ScaleCalibration `/projects/:id/floors/:floorId/scale` — files: SC=src/screens/pipeline/ScaleCalibration/ScaleCalibration.tsx · USC=useScaleCalibration.ts · SCP=ScaleCalibrationPanel.tsx · BE=apps/api/spatial_write/router.py

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-056 | D | viewer: tieu de forbidden + cau giai thich | heading "Bạn không có quyền hiệu chỉnh tỷ lệ" (SC:77) + "Bản vẽ vẫn xem và phóng to được, nhưng không kéo được đường tham chiếu. Nhờ người có quyền sửa dự án đặt tỷ lệ giúp." (USC:210) | canEdit=can(edit,layer,viewer)=false -> forbidden (USC:1652) | ui | covered | phase09_roles_matrix (Track B, bi xoa S4) | real | tang khong loi nan anh (loi se che forbidden, F9U-5) |
| 9U-D-057 | D | viewer: van xem/phong to ban ve; canvas khong keo duoc | img "Bản vẽ đã nắn của …" hien; canvas isInteractive=false (USC:1858); keo khong sinh request | canvas.isInteractive=canEdit | ui | partial | phase09_roles_matrix (Track B, bi xoa S4) | real | mainProject()+viewer |
| 9U-D-058 | D | viewer: khong nut "Áp dụng tỷ lệ", khoi phuong phap khong bam duoc | count 0 (USC:212,1919 areActionsHidden); pointer-events-none (SCP:92; BUG-601) | areActionsHidden=!canEdit | ui | covered | phase09_roles_matrix (Track B, bi xoa S4) | real | mainProject()+viewer |
| 9U-D-059 | D | viewer: BE tu choi PUT .../spatial/layer (ghi ti le) | 403 FORBIDDEN (spatial_write/router.py:45-50 layer.edit) | viewer | api | missing | - | real | mainProject()+viewer |
| 9U-D-060 | D | engineer: dat ti le, "Áp dụng tỷ lệ" duoc | nut hien; PUT spatial/layer 200 tren du an rieng | can(edit,layer,engineer) | edge | partial | phase03_pipeline.spec (ngoai vai) | real | PE |
| 9U-D-061 | D | admin: nut hien (doi chung) | "Áp dụng tỷ lệ" hien | admin | ui | covered | phase03_pipeline.spec | real | mainProject()+admin |
| 9U-D-062 | D | an danh: chuyen /login?next= | URL /login?next=<scale path> | guard | edge | missing | - | real | ANON |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | E | n/a | khong co hanh vi ban phim rieng theo vai | - | - | n/a | - | n/a | - |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-007 | F | viewer: bo cuc forbidden 4 kho | chup 4 kho (canvas + thong bao) | verifyUi | ui | missing | - | real | mainProject()+viewer |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


## OverlayComparison `/projects/:id/floors/:floorId/overlay` — files: OC=src/screens/viewer/OverlayComparison/OverlayComparison.tsx · UOC=useOverlayComparison.ts · OCT=OverlayComparisonToolbar.tsx · OCP=OverlayComparisonPanel.tsx

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-063 | D | viewer: bang canh bao chi-xem | "Bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa." (UOC:128,878) | canEdit=can(edit,layer,viewer)=false -> forbidden | ui | missing | - | real | mainProject()+viewer |
| 9U-D-064 | D | viewer: nut "Xác nhận mô hình khớp bản vẽ" khoa + ly do | disabled; ly do "Chỉ người có quyền sửa mới xác nhận được." (UOC:112,122,1008) | !canEdit | ui | missing | - | real | mainProject()+viewer |
| 9U-D-065 | D | viewer: o "Dung sai" khoa | disabled (OCP:135) | canEdit prop | ui | missing | - | real | mainProject()+viewer |
| 9U-D-066 | D | viewer: khoa can chinh, keo/nudge khong sinh request ghi | OCT:222 disabled; isAlignmentLocked=true (UOC:1241) | isLockedByUser\|\|!canEdit | edge | missing | - | real | mainProject()+viewer |
| 9U-D-067 | D | viewer: thanh cong cu khong lap cau thu hai (BUG-636) | OCT:232 khong render ly do lan nua; chi 1 cau o bang canh bao | viewer | ui | missing | - | real | mainProject()+viewer |
| 9U-D-068 | D | viewer: BE tu choi ghi ket qua doi chieu (PUT spatial/layer) | 403 FORBIDDEN (spatial_write/router.py:50) | viewer | api | missing | - | real | mainProject()+viewer |
| 9U-D-069 | D | engineer: nut xac nhan khong bi khoa vi vai | neu thieu do thi ly do "Cần đo được vùng lệch trước khi xác nhận." (UOC:123), khong "Chỉ người có quyền sửa mới xác nhận được." | canEdit true | ui | missing | - | real | PE |
| 9U-D-070 | D | admin: nut xac nhan khong khoa vi vai (doi chung) | khong ly do confirmNeedsEdit | admin | ui | missing | - | real | mainProject()+admin |
| 9U-D-071 | D | an danh: chuyen /login?next= | URL /login?next=<overlay path> | guard | edge | missing | - | real | ANON |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | E | n/a | khong co hanh vi ban phim rieng theo vai | - | - | n/a | - | n/a | - |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-008 | F | viewer: bo cuc bang canh bao 4 kho | chup 4 kho | verifyUi | ui | missing | - | real | mainProject()+viewer |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


## CadBranchConfirm `/projects/:id/floors/:floorId/cad-confirm` — files: CB=src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.tsx · UCB=useCadBranchConfirm.ts · CBT=cadBranchConfirmText.ts

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | A | n/a | luong ghi / hanh vi thuong khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | B | n/a | trang thai phu thuoc vai nam o nhom D (forbidden) | - | - | n/a | - | n/a | - |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | C | n/a | validation khong phu thuoc vai: phase 03 | - | - | n/a | - | n/a | - |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-D-072 | D | viewer: tieu de forbidden + cau giai thich | heading "Không có quyền xử lý CAD" (CB:97) + "Bạn không có quyền chỉnh sửa lớp của dự án này, nên không chốt được nhánh xử lý. Liên hệ quản trị viên để được cấp quyền." (UCB:119) | canEdit=can(edit,layer,viewer)=false -> forbidden (UCB:606) | ui | missing | - | real | PC: du an co ban ve CAD (helper moi) |
| 9U-D-073 | D | viewer: "Dùng đường từ CAD" khoa; "Vẫn dùng AI" van mo (nhanh AI khong bao gio bi chan, khong ghi gi) | CAD disabled (isCadChoiceDisabled UCB:680); AI enabled (UCB:699-700, :717-720) — sửa 2026-10-16 theo p09-rr | forbidden | ui | missing | - | real | PC |
| 9U-D-074 | D | viewer: khong mo buoc 2 / khong "Nhập hình học" | "Nhập hình học" (CBT:156) khong bat duoc (UCB:932); stage hai khong mo (CB:425) | state!=forbidden | ui | missing | - | real | PC |
| 9U-D-075 | D | viewer: khong request ghi khi bam lua chon | recordWrites rong | canEdit false | edge | missing | - | real | PC |
| 9U-D-076 | D | engineer: chot nhanh va nhap hinh hoc duoc (du an rieng) | 2 lua chon bam duoc; "Nhập hình học" bam duoc sau khi gan lop | canEdit true | edge | partial | phase03_graph_cad_edge | real | PC + engineer |
| 9U-D-077 | D | admin: lua chon bam duoc (doi chung) | 2 nut khong disabled | admin | ui | partial | phase03_graph_cad_edge | real | PC |
| 9U-D-078 | D | an danh: chuyen /login?next= | URL /login?next=<cad-confirm> | guard | edge | missing | - | real | ANON |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | E | n/a | khong co hanh vi ban phim rieng theo vai | - | - | n/a | - | n/a | - |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9U-F-009 | F | viewer: bo cuc forbidden 4 kho | chup 4 kho | verifyUi | ui | missing | - | real | PC |

### G API/BE

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| - | G | n/a | BE theo vai o nhom D (layer api) va C6 `B09` | - | - | n/a | - | n/a | - |


### Notes (bug nghi ngo ⚑; chua co trong BUG-LOG `| 09 |`)

- ⚑ F9U-1 (can C6 xac nhan): FE khoa 6 man cho viewer; flow 09 phai thay 403 `FORBIDDEN` cho tung ghi. Theo ma: `floors/router.py:26-30`, `drawings/router.py:36`, `quality/router.py:25`, `spatial_write/router.py:50` deu `require_project(<khoa>)` => du kien 403. Neu BE cho qua -> High (bao mat).
- ⚑ F9U-2: `ProcessingScreen` `cancelProcessing:false` (`processingGateway.ts:826`) nen "Huỷ xử lý" khong bao gio hien voi BAT KY vai nao (khong phai loi vai; dong D engineer chi ghi nhan).
- ⚑ F9U-3 (Medium, UX/ma tran): `PipelineGraph` chi mo chi tiet cho `admin` (`usePipelineGraph.ts:80`); engineer (co `layer.edit`/`floor.upload`) cung nhan "Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị…". Khong co khoa `pipeline.inspect` trong `permissions.ts` => lech khoi `can()`.
- ⚑ F9U-4 (Low): `forbidden` dung truoc `empty` o `PipelineGraph` (`usePipelineGraph.ts:540-548`): engineer o du an chua chay thay cau forbidden thay vi "Chưa có lượt xử lý nào để kể lại".
- ⚑ F9U-5 (Medium, logic): thu tu `error` truoc `forbidden` o ScaleCalibration (`useScaleCalibration.ts:1652`): tang loi nan anh che mat thong bao chi-doc cua viewer (test cu phai doi sang tang L2). Viewer tren tang loi khong thay ly do chi-doc.
- Ghi chu: vai theo du an (BUG-513 "engineer chi la viewer member") khong tao duoc tren BE that (membership khong co vai) => n/a o day. `OverlayComparison` role=null (vai chua biet) la chi-doc (`OverlayComparison.tsx:117`), chi doc nguon, khong co dong mock.

## QA-09 C3 — catalog (tiền tố `9Q`): QC lớp, phần ma trận vai

Nguồn: FE p09-int 5fcaf502, BE main dc510655, chỉ đọc mã. Viết tắt đường dẫn theo từng mục. Vai thật = vai toàn cục (`poolUser(admin,role,slot)`); khổ 1920/1440/1024/768. Mobile và `/m/`: ngoài phạm vi.
Cổng chung 6 màn: `can('edit','layer',{roles})` => `canEdit`, `isViewerRole=!canEdit`, state `forbidden` (viewer thắng error/loading/empty/collapsed theo từng hook). Ma trận: viewer false, engineer true, admin true (permissions.ts; BE `layer.edit` packages/domain/permissions/matrix.py:47). Mọi ghi đi qua autosave `PUT /api/projects/:p/floors/:f/spatial/layer` (spatial_write/router.py:45-50 `require_project("layer.edit")`); GET layer chỉ cần thành viên (spatial_read/router.py:71). Phía BE đầy đủ thuộc C6 (B09).
Seed: **QV** dự án main chain (`runtime-session.json`) + viewer `p09-qc-viewer` qua `asMember`/`addProjectMember`, gỡ trong `finally`, CHỈ ĐỌC · **QE** dự án riêng `createQcProject(api,"p09qc-e",[...])` (layerSeed.ts:186) + engineer `p09-qc-engineer`, xoá cuối luồng · **QA** admin đọc dự án main chain · **QN** dự án riêng + user không là thành viên · **QV2** dự án riêng 2 tầng (1 tầng có lớp, 1 không).

## Tóm tắt

| màn | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| SCR-16 | 14 | 0 | 14 | 1 | 3 | 10 | 0 | 0 |
| SCR-17 | 11 | 0 | 11 | 1 | 2 | 8 | 0 | 0 |
| SCR-18 | 10 | 0 | 10 | 1 | 1 | 8 | 0 | 0 |
| SCR-19 | 9 | 0 | 9 | 1 | 0 | 8 | 0 | 0 |
| SCR-20 | 10 | 0 | 10 | 1 | 2 | 7 | 0 | 0 |
| SCR-21 | 9 | 0 | 9 | 1 | 2 | 6 | 0 | 0 |
| **C3** | **63** | 0 | 63 | 6 | 10 | 47 | 0 | 0 |

## SCR-16 Lớp tường (WallLayerReview) — files: W=src/screens/qc/WallLayerReview/{useWallLayerReview.ts,WallLayerInspector.tsx,WallLayerToolRail.tsx}

Route: `ROUTES.project.walls(projectId, floorId)` (e2e/fixtures/routes.ts; kiểm tên khi viết spec).

### A User flows
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### B States
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### C Validation/logic
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-A-001 | roles | viewer mở lớp tường có dữ liệu: state `forbidden`, chọn một đoạn thì thấy câu chỉ-xem | `Bạn đang xem với vai người xem, nên không duyệt hay sửa được đoạn tường nào. Nhờ người có quyền sửa dự án duyệt giúp.` (W/useWallLayerReview.ts:222,1847; WallLayerInspector.tsx:213-215) | viewer: canEdit=false -> isViewerRole -> state forbidden; câu hiện trong inspector sau khi chọn | ui | partial | old R-V_16 (mock, xoá S4); phase04 #50 | real | QV |
| 9Q-A-002 | roles | viewer: không có nút duyệt/bỏ qua, độ dày chỉ đọc | vắng nút `Duyệt đoạn này`, vắng nút `Bỏ qua`, vắng radiogroup `Độ dày tường` (thay bằng ReadOnlyThickness) (WallLayerInspector.tsx:130-132,213-225) | viewer: các điều khiển ghi count=0 | ui | partial | old R-V_16 | real | QV |
| 9Q-A-003 | roles | viewer: thanh công cụ chỉ đọc, không có nút Nối đoạn | WallLayerToolRail readOnly=true: mergeButton=null, công cụ sửa bị chặn (W/WallLayerToolRail.tsx:100-131) | viewer: không có nút `Nối đoạn`; công cụ isEditTool không kích hoạt | ui | missing | - | real | QV |
| 9Q-A-004 | roles | viewer: canvas không tương tác (không menu chuột phải, không kéo) | `isInteractive:false` (useWallLayerReview.ts:1906); chuột phải không mở menu; `onOpenRowMenu` bỏ qua (:926-936) | viewer: chuột phải + phím mở menu trên hàng danh sách -> không có menu | edge | missing | - | real | QV |
| 9Q-A-005 | roles | viewer: phím tắt ghi bị tắt | các `useShortcut` ghi `enabled: canEdit` (useWallLayerReview.ts:1340-1468); Enter/Delete/M trên đoạn chọn -> không PUT | viewer: recordWrites(page) sau phím = 0 PUT | edge | missing | - | real | QV |
| 9Q-A-006 | roles | viewer mở, chọn, rê, đợi autosave: không có request ghi nào | không có `PUT .../spatial/layer` (lõi bảo mật: autosave không bật khi chỉ đọc) | viewer: recordWrites trong 3 s sau mốc đã tải = [] | api | missing | - | real | QV |
| 9Q-A-007 | roles | viewer gọi thẳng PUT spatial/layer (cùng dự án) | 403 (BE `require_project("layer.edit")` spatial_write/router.py:45-50) — phía BE thuộc C6; ở đây khẳng định FE không gửi và BE từ chối khi gọi tay | viewer: apiAs(user).put -> 403 FORBIDDEN (đối chiếu B09) | api | missing | - | real | QV |
| 9Q-A-008 | roles | engineer thấy đủ điều khiển và duyệt một đoạn thành công | có `Duyệt đoạn này`, radiogroup `Độ dày tường`, `Nối đoạn`; duyệt -> PUT layer 200, bộ đếm tăng | engineer: canEdit=true; PUT .../spatial/layer = 200 | ui | partial | phase04 W specs (admin) | real | QE: dự án riêng createQcProject + engineer |
| 9Q-A-009 | roles | engineer Hoàn tác (Mod+Z) trả đoạn về chưa duyệt | undo ngăn xếp màn (useWallLayerReview.ts:993-1007) | engineer: sau undo PUT lần hai 200, bộ đếm về cũ | edge | missing | - | real | QE |
| 9Q-A-010 | roles | admin đối chứng: cùng điều khiển như engineer | có `Duyệt đoạn này`, không có câu chỉ-xem | admin: canEdit=true | ui | covered | phase04 W (admin) | real | QA: dự án main chain, đọc |
| 9Q-A-011 | roles | ẩn danh vào /projects/:id/floors/:f/walls -> /login?next= | URL chứa `/login?next=` + đường cũ; không gọi API layer | anon: không cookie -> chuyển hướng | edge | missing | - | real | không cần dữ liệu |
| 9Q-A-012 | roles | tài khoản không phải thành viên dự án mở lớp tường | GET layer 404 (K08: 404 thắng 403, projects/access.py) -> màn lỗi/NotFound theo C1, không lộ dữ liệu | non-member: GET .../spatial/layer = 404 | edge | missing | - | real | QN: dự án riêng + user không thêm |

### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-A-014 | a11y | viewer: tiêu điểm không rơi vào nút bị ẩn; câu chỉ-xem đọc được | câu chỉ-xem là văn bản trong inspector (không nút); Tab đi qua hàng danh sách rồi canvas, không nút ghi | viewer: Tab 6 lần không focus control ghi | edge | missing | - | real | QV |

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-A-013 | responsive | viewer: màn lớp tường chỉ-xem ở 4 khổ (1920/1440/1024/768) | chụp đủ 4 khổ, câu chỉ-xem không cắt, không cuộn ngang | verifyUi 4 khổ | ui | missing | - | real | QV |

### G API/BE
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

## SCR-17 Lớp đối tượng (ObjectLayerReview) — files: O=src/screens/qc/ObjectLayerReview/{useObjectLayerReview.ts,ObjectLayerReview.tsx,ObjectLayerToolRail.tsx,ObjectLayerInspector.tsx}

Route: `ROUTES.project.objects(projectId, floorId)` (e2e/fixtures/routes.ts; kiểm tên khi viết spec).

### A User flows
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### B States
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### C Validation/logic
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-B-001 | roles | viewer mở lớp đối tượng: vùng và thanh trạng thái hiện, thanh công cụ rỗng | region `Lớp đối tượng` thấy; toolbar `Công cụ lớp đối tượng` count=1 nhưng 0 nút (O/ObjectLayerToolRail.tsx:120 `!isViewerRole &&`) | viewer: rail.getByRole(button)=0 | ui | partial | old R-V_17; phase04 #77 | real | QV |
| 9Q-B-002 | roles | viewer: câu chỉ-xem `Bạn đang xem — không sửa được lớp này.` | chữ từ OBJECT_LAYER_TEXT.forbidden (objectLayerReviewGateway.ts:1262) — xác định nơi hiển thị khi chạy; nếu không hiện ở đâu thì ghi bug UX | viewer: getByText(exact) visible HOẶC ghi nhận không hiện | ui | missing | - | real | QV |
| 9Q-B-003 | roles | viewer: canvas bỏ mọi callback sửa | `editing = {}` (ObjectLayerReview.tsx:189-191), `isInteractive=!isViewerRole`; chuột phải không mở menu | viewer: contextmenu trên đối tượng -> không có menu | edge | missing | - | real | QV |
| 9Q-B-004 | roles | viewer: inspector chỉ đọc (xoay cửa, vị trí, xoá, gắn tường) | nhóm `Hướng mở` là div chỉ đọc (ObjectLayerInspector.tsx:337), PositionField chỉ đọc (ObjectLayerPositionField.tsx:36), vắng `Xoá đối tượng` và `Gắn vào tường gần nhất` (:314,391) | viewer: các nút ghi count=0 sau khi chọn đối tượng | ui | missing | - | real | QV |
| 9Q-B-005 | roles | viewer: trạng thái rỗng không có `Thêm thủ công` | EmptyState action=null cho viewer (ObjectLayerReview.tsx:98-108); có thể là `Mở lớp tường` nếu onOpenWallLayer | viewer trên tầng không đối tượng: getByRole(button,"Thêm thủ công")=0 | edge | missing | - | real | QV2: dự án riêng 2 tầng (createQcProject layered=1) |
| 9Q-B-006 | roles | viewer: phím tắt ghi tắt, không PUT | `enabled: canEdit` (useObjectLayerReview.ts:1266-1377) | viewer: recordWrites=[] sau Delete/Enter | api | missing | - | real | QV |
| 9Q-B-007 | roles | engineer thêm/duyệt một đối tượng thành công | có nút `Chọn nhóm … (phím …)`; duyệt -> PUT layer 200 | engineer: canEdit=true | ui | partial | phase04 O specs (admin) | real | QE |
| 9Q-B-008 | roles | engineer xoá một đối tượng rồi Hoàn tác | `Xoá đối tượng` -> PUT 200; undo -> PUT 200 | engineer | edge | missing | - | real | QE |
| 9Q-B-009 | roles | admin đối chứng | thanh công cụ có nút, không có chữ chỉ-xem | admin | ui | covered | phase04 O (admin) | real | QA |
| 9Q-B-010 | roles | ẩn danh vào lớp đối tượng -> /login?next= | `/login?next=` | anon | edge | missing | - | real | - |

### E A11y/keyboard
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-B-011 | responsive | viewer: màn lớp đối tượng chỉ-xem 4 khổ | 4 khổ, thanh công cụ rỗng không để khoảng trống lạ | verifyUi | ui | missing | - | real | QV |

### G API/BE
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

## SCR-18 Duyệt kích thước OCR (DimensionOcrReview) — files: D=src/screens/qc/DimensionOcrReview/{useDimensionOcrReview.ts,DimensionOcrReview.tsx,DimensionOcrRow.tsx,dimensionOcrText.ts}

Route: `ROUTES.project.dimensions(projectId, floorId)` (e2e/fixtures/routes.ts; kiểm tên khi viết spec).

### A User flows
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### B States
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### C Validation/logic
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-C-001 | roles | viewer mở duyệt kích thước: câu chỉ-xem dưới danh sách | `Vai trò hiện tại chỉ được xem, không được chỉnh sửa lớp kích thước OCR. Liên hệ quản trị dự án nếu cần.` (D/dimensionOcrText.ts:217-219; DimensionOcrReview.tsx:328-331) | viewer: viewerRoleNotice hiện, thay lối vào duyệt bàn phím | ui | missing | phase04 #89 = gap (R9 không mở SCR-18) | real | QV |
| 9Q-C-002 | roles | viewer: không có lối vào duyệt bàn phím, không nút duyệt từng hàng | vắng nút bật duyệt bàn phím; hàng không có nút duyệt (DimensionOcrRow.tsx:360 `isViewerRole || isReviewed ? null`) | viewer: nút duyệt count=0 | ui | missing | - | real | QV |
| 9Q-C-003 | roles | viewer: ô giá trị bị khoá | `NumericField disabled` (DimensionOcrRow.tsx:259) | viewer: input giá trị toBeDisabled | ui | missing | - | real | QV |
| 9Q-C-004 | roles | viewer: canvas không tương tác, mô tả ẩn đọc được | `aria-describedby` trỏ `<p class=sr-only>` chứa mô tả forbidden (DimensionOcrCanvas.tsx:191,236-238); `pointer-events-none` | viewer: click chuỗi kích thước không chọn | edge | missing | - | real | QV |
| 9Q-C-005 | roles | viewer: phím R / Enter / Mod+Z không làm gì, không PUT | `enabled: canEdit` (useDimensionOcrReview.ts:907,952,964) | viewer: recordWrites=[] | api | missing | - | real | QV |
| 9Q-C-006 | roles | engineer sửa giá trị một kích thước và duyệt | ô nhập mở, lưu -> PUT layer 200 | engineer | ui | partial | phase04 D specs (admin) | real | QE |
| 9Q-C-007 | roles | engineer duyệt bàn phím: R bật, Enter duyệt, Esc thoát | phím tắt `canEdit` | engineer | edge | missing | - | real | QE |
| 9Q-C-008 | roles | admin đối chứng | không có câu chỉ-xem | admin | ui | covered | phase04 D (admin) | real | QA |
| 9Q-C-009 | roles | ẩn danh -> /login?next= | `/login?next=` | anon | edge | missing | - | real | - |

### E A11y/keyboard
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-C-010 | responsive | viewer: màn kích thước OCR chỉ-xem 4 khổ | 4 khổ | verifyUi | ui | missing | - | real | QV |

### G API/BE
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

## SCR-19 Lưới trục (AxisGridManager) — files: X=src/screens/qc/AxisGridManager/{useAxisGridManager.ts,AxisGridManager.tsx,AxisGridLeftPanel.tsx}

Route: `ROUTES.project.axes(projectId, floorId)` (e2e/fixtures/routes.ts; kiểm tên khi viết spec).

### A User flows
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### B States
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### C Validation/logic
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-D-001 | roles | viewer mở lưới trục: tiêu đề + câu chỉ-xem | InlineAlert title `Không có quyền sửa trục` (X/AxisGridManager.tsx:113,186) + `Vai trò hiện tại chỉ được xem, không được chỉnh sửa các trục. Liên hệ quản trị dự án nếu cần.` (useAxisGridManager.ts:164-165) | viewer: state forbidden | ui | missing | phase04 #103 = gap | real | QV |
| 9Q-D-002 | roles | viewer: vắng nút thêm trục và xoá trục | AxisGridLeftPanel.tsx:126,170 `isViewerRole ? null` | viewer: nút thêm/xoá count=0 | ui | missing | - | real | QV |
| 9Q-D-003 | roles | viewer: `Căn chỉnh tự động` khoá kèm lý do | `Vai người xem không căn chỉnh được các tầng.` (useAxisGridManager.ts:178,1197-1198) | viewer: nút disabled + lý do hiển thị | ui | missing | - | real | QV (>=2 tầng có trục) |
| 9Q-D-004 | roles | viewer: không có câu `Trục chỉ giữ trong phiên này — tải lại trang sẽ mất các thay đổi.` | `unsavedNotice: canEdit ? ... : null` (useAxisGridManager.ts:1290) | viewer: getByText(unsaved)=0 | ui | missing | - | real | QV |
| 9Q-D-005 | roles | viewer: canvas không kéo/thêm; phím tắt tắt | `isInteractive=false`, `enabled: canEdit` (useAxisGridManager.ts:1012) | viewer: kéo trục không đổi; không request ghi | edge | missing | - | real | QV |
| 9Q-D-006 | roles | engineer thêm một trục: chỉ trong phiên (không có endpoint ghi) | trục mới hiện; câu `Trục chỉ giữ trong phiên này — tải lại trang sẽ mất các thay đổi.` hiện; KHÔNG có PUT (BUG-578) | engineer: recordWrites=[] sau thêm | edge | missing | - | real | QE |
| 9Q-D-007 | roles | admin đối chứng | không có câu chỉ-xem | admin | ui | covered | phase04 X (admin) | real | QA |
| 9Q-D-008 | roles | ẩn danh -> /login?next= | `/login?next=` | anon | edge | missing | - | real | - |

### E A11y/keyboard
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-D-009 | responsive | viewer: màn lưới trục chỉ-xem 4 khổ | 4 khổ | verifyUi | ui | missing | - | real | QV |

### G API/BE
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

## SCR-20 Nhãn phòng (RoomLabelReview) — files: R=src/screens/qc/RoomLabelReview/{useRoomLabelReview.ts,RoomLabelReview.tsx,RoomLabelInspector.tsx,RoomLabelLeftPanel.tsx}

Route: `ROUTES.project.rooms(projectId, floorId)` (e2e/fixtures/routes.ts; kiểm tên khi viết spec).

### A User flows
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### B States
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### C Validation/logic
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-E-001 | roles | viewer mở nhãn phòng: tiêu đề + câu chỉ-xem ở cột trái | InlineAlert `Không có quyền sửa lớp phòng` (R/RoomLabelReview.tsx:93,182) + `Bạn đang xem với vai người xem: đổi tên, đổi công năng, gộp, tách và duyệt đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa lớp phòng.` (useRoomLabelReview.ts:161-162) | viewer: state forbidden, có cả khi tầng không có phòng (G41) | ui | partial | old R-V_20 (mock); phase04 #125 | real | QV |
| 9Q-E-002 | roles | viewer: inspector chỉ có nhãn `Chỉ xem`, trường chỉ đọc | Badge `Chỉ xem` (RoomLabelInspector.tsx:100,158-163); tên/công năng isReadOnly (:126,134); vắng `Duyệt`, gộp, tách | viewer: nút ghi count=0 | ui | missing | - | real | QV |
| 9Q-E-003 | roles | viewer: cột trái không có nút hành động hàng loạt | RoomLabelLeftPanel.tsx:148 `!panel.isViewerRole &&` | viewer: nút count=0 | ui | missing | - | real | QV |
| 9Q-E-004 | roles | viewer: canvas có mô tả ẩn, không chọn phòng | `Bản vẽ vẫn xem được, nhưng không chọn được phòng nào ở đây. Nhờ người có quyền sửa dự án duyệt giúp.` (RoomLabelCanvas.tsx:277; roomLabelCanvasGeometry.ts:226) | viewer: sr-only text có trong DOM, click phòng không chọn | edge | missing | - | real | QV |
| 9Q-E-005 | roles | viewer: không PUT sau thao tác/phím | `enabled: canEdit` (useRoomLabelReview.ts:880) | viewer: recordWrites=[] | api | missing | - | real | QV |
| 9Q-E-006 | roles | engineer đổi tên phòng + duyệt thành công | PUT layer 200 | engineer | ui | partial | phase04 R specs (admin) | real | QE |
| 9Q-E-007 | roles | engineer gộp rồi Hoàn tác | `canEdit` (useRoomLabelReview.ts:683); undo 200 | engineer | edge | missing | - | real | QE |
| 9Q-E-008 | roles | admin đối chứng | không có `Chỉ xem` | admin | ui | covered | phase04 R (admin) | real | QA |
| 9Q-E-009 | roles | ẩn danh -> /login?next= | `/login?next=` | anon | edge | missing | - | real | - |

### E A11y/keyboard
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-E-010 | responsive | viewer: màn nhãn phòng chỉ-xem 4 khổ | 4 khổ | verifyUi | ui | missing | - | real | QV |

### G API/BE
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

## SCR-21 Chuẩn hoá độ dày (ThicknessStandardization) — files: T=src/screens/qc/ThicknessStandardization/{useThicknessStandardization.ts,ThicknessStandardization.tsx,ThicknessGroupTable.tsx,ThicknessSegmentTable.tsx}

Route: `ROUTES.project.thickness(projectId, floorId)` (e2e/fixtures/routes.ts; kiểm tên khi viết spec).

### A User flows
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### B States
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### C Validation/logic
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-F-001 | roles | viewer mở chuẩn hoá độ dày: tiêu đề + câu chỉ-xem | InlineAlert `Không có quyền sửa độ dày tường` (T/ThicknessStandardization.tsx:115,347) + câu viewerRoleNotice (useThicknessStandardization.ts:134) | viewer: state forbidden | ui | partial | old R-V_21 (mock); phase04 #144 | real | QV |
| 9Q-F-002 | roles | viewer: thanh áp dụng KHÔNG được dựng | không có `ThicknessApplyBar` (ThicknessStandardization.tsx:375 và chú thích :53-58) | viewer: vắng nút áp dụng chuẩn hoá | ui | missing | - | real | QV |
| 9Q-F-003 | roles | viewer: bảng nhóm không có cột chấp nhận, bảng đoạn không có ô chọn/dải hành động | ThicknessGroupTable.tsx:60,79; ThicknessSegmentTable.tsx:192 | viewer: checkbox count=0 | ui | missing | - | real | QV |
| 9Q-F-004 | roles | viewer: phím tắt tắt, không PUT | `enabled: canEdit` (useThicknessStandardization.ts:887) | viewer: recordWrites=[] | api | missing | - | real | QV |
| 9Q-F-005 | roles | engineer áp chuẩn hoá một nhóm thành công | PUT layer 200; cảnh báo áp lại nếu có | engineer | ui | partial | phase04 T specs (admin) | real | QE |
| 9Q-F-006 | roles | engineer Hoàn tác lượt chuẩn hoá | Mod+Z -> PUT 200 | engineer | edge | missing | - | real | QE |
| 9Q-F-007 | roles | admin đối chứng | có thanh áp dụng | admin | ui | covered | phase04 T (admin) | real | QA |
| 9Q-F-008 | roles | ẩn danh -> /login?next= | `/login?next=` | anon | edge | missing | - | real | - |

### E A11y/keyboard
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9Q-F-009 | responsive | viewer: màn độ dày chỉ-xem 4 khổ | 4 khổ | verifyUi | ui | missing | - | real | QV |

### G API/BE
(không có dòng phụ thuộc vai ở nhóm này; hành vi chung thuộc phase 04)

### Notes
- Không có bug chắc chắn từ đọc mã (mọi điều khiển ghi đều qua `canEdit`). Nghi vấn cần xác nhận khi chạy:
  1. ⚑ SCR-17 `OBJECT_LAYER_TEXT.forbidden` (`Bạn đang xem — không sửa được lớp này.`, objectLayerReviewGateway.ts:1262) có thể không hiển thị ở đâu (BUG-601 đổi câu nhưng chỉ thấy 1 chỗ định nghĩa) -> 9Q-B-002 quyết định; nếu không hiện, ghi UX Low.
  2. ⚑ DimensionOcrKeyboardMode.tsx:151 gán cứng `isViewerRole={false}`; an toàn nếu lối vào bị chặn cho viewer (useDimensionOcrReview.ts:952 `enabled: canEdit`) -> 9Q-C-002/005 kiểm không có đường URL/state nào bật chế độ này cho viewer.
  3. ⚑ Autosave của viewer: nếu bất kỳ đường nào gửi PUT layer khi viewer chỉ mở/chọn thì BE 403 (UX lỗi vai); viewer mà BE cho qua = bug bảo mật High (C6 xác nhận). Dòng H `recordWrites` của 6 màn.
  4. ⚑ SCR-19 engineer thêm/xoá trục chỉ giữ trong phiên (BUG-578, không endpoint) -> 9Q-D-006 khẳng định không PUT và cảnh báo hiện, tránh nhầm "đã lưu".
  5. ⚑ Non-member: GET layer 404 (K08). FE phải hiện màn lỗi/NotFound không rò dữ liệu — 9Q-A-012 (1 dòng đại diện; 5 màn kia cùng đường gateway).
- Vai theo dự án (`userRoles`) và F-11 thuộc C1. Phase 04 #89/#103 (SCR-18/19 forbidden) là gap R9, nay do 9Q-C-001, 9Q-D-001 phủ.
- Quy mô: 6 màn × 9-14 dòng (viewer 5-7, engineer 2, admin/anon/F 3); thấp hơn mốc 6-10/vai vì hành vi sửa không phụ thuộc vai đã ở phase 04, không tách thêm.

## Catalog C4 (9V) - Viewer + quy tắc + xuất, ma trận vai (phase 09)

Nguồn: FE p09-int 5fcaf502, BE main dc510655 (chỉ đọc).

## Tóm tắt

| màn | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| 9V-A Viewer/Pascal/panels | 24 | 1 | 23 | 0 | 0 | 23 | 0 | 0 |
| 9V-B SCR-25 Measure | 14 | 1 | 13 | 0 | 1 | 12 | 1 | 0 |
| 9V-C SCR-28/ViolationDetail | 10 | 1 | 9 | 0 | 0 | 9 | 0 | 0 |
| 9V-D SCR-29 RuleSettings | 13 | 1 | 12 | 0 | 0 | 12 | 0 | 0 |
| 9V-E SCR-30 Export | 11 | 1 | 10 | 0 | 0 | 10 | 0 | 0 |
| 9V-F SCR-31 JSON | 9 | 1 | 8 | 0 | 0 | 8 | 0 | 0 |
| 9V-G SCR-32 Versions | 12 | 1 | 11 | 0 | 0 | 11 | 0 | 0 |
| 9V-H ShareDialog | 9 | 1 | 8 | 0 | 1 | 7 | 0 | 0 |
| TỔNG | 102 | 8 | 94 | 0 | 2 | 92 | 1 | 0 |

Quy ước: file viết tắt theo gốc FE `F:/worktrees/AppFront/p09-int` (5fcaf502). `PV`=src/screens/viewer/PascalViewer, `VS`=ViewerShell, `V3`=Viewer3D, `RA`=RoomAreaPanel, `FL`=FurnitureLibraryPanel, `HP`=HistoryPanel, `WG`=WallGeometryEditor, `MT`=MeasurementTool, `RR`=src/screens/rules/RuleReport, `RS`=RuleSettings, `EP`=src/screens/export/ExportPanel, `SJ`=SpatialJsonViewer, `VH`=VersionHistory, `SD`=ShareDialog. `OLD`=qa/tests/phase09_roles_matrix.spec.ts (SẼ XOÁ ở S4). Ma trận FE (`src/lib/auth/permissions.ts`): `layer.edit` A/E=true V=false; `model.export` A/E=true V=false; `share.create` A/E=true V=false; `ruleset.edit` A=true E/V=false. Slot pool: `p09-viewer-viewer`, `p09-viewer-engineer`, `p09-viewer-admin`. Route: ROUTES.project.{viewer,viewerPascal,measure,rules,ruleSettings,export,data,versions}(projectId) (`src/routes/paths.ts:152-173`). Dự án = main chain (thêm user vai bằng `addProjectMember`, gỡ trong `finally`); ghi của engineer/admin → dự án riêng (`createProject`) hoặc hoàn tác trong `finally`. Cột `existing`: OLD = có khẳng định trong spec cũ (mock) cần chuyển sang thật.

## 9V-A · PascalViewer + ViewerShell + Viewer3D + RoomAreaPanel + WallGeometryEditor + FurnitureLibraryPanel + HistoryPanel — files: PV=PascalViewer/PascalViewer.container.tsx,usePascalEdits.ts · VS=ViewerShell/useViewerShell.ts,ViewerInspector.tsx · V3=Viewer3D/useViewer3D.ts,Viewer3D.tsx · RA=RoomAreaPanel/* · FL=FurnitureLibraryPanel/* · HP=HistoryPanel/*
### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-A-001 | flow | engineer mở `/3d`: inspector không bị khoá | không có "Chỉ xem" · VS/useViewerShell.ts:581-588 | `can('edit','layer')`=true ⇒ state≠forbidden | ui | missing | — | real | main chain + engineer |
| 9V-A-002 | flow | engineer sửa tên phòng trong RoomAreaPanel rồi đổi lại | ô tên phòng sửa được, commit qua `runCommand` · RA/useRoomAreaPanel.ts:459-477 | canEdit=true | edge | missing | — | real | dự án riêng |
| 9V-A-003 | flow | admin (đối chứng): viewer 3D tải, không "Chỉ xem" | như 9V-A-001 | admin canEdit=true | ui | missing | — | real | main chain + admin |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-A-010 | state | ẩn danh vào `/projects/:id/3d` | chuyển `/login?next=%2Fprojects%2F<id>%2F3d` | không phiên | edge | missing | — | real | không |
| 9V-A-011 | state | ẩn danh vào `/3d/pascal` | chuyển `/login?next=…%2F3d%2Fpascal` | không phiên | edge | missing | — | real | không |
### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-A-020 | logic | viewer: Pascal `readOnly` ⇒ lệnh sửa bị từ chối kèm lý do | "Vai của bạn chỉ được xem, không sửa được mô hình." · PV/usePascalEdits.ts:58,191 | `readOnly ?? !can('edit','layer')` PV/PascalViewer.container.tsx:166 | edge | missing | — | real | main chain + viewer |
| 9V-A-021 | logic | viewer: Pascal không phát request ghi khi thao tác công cụ | `recordWrites(page)` rỗng sau khi thử kéo/xoá · PV/usePascalEdits.ts:208 | readOnly chặn trước API | edge | missing | — | real | main chain + viewer |
| 9V-A-022 | logic | viewer: phím tắt sửa (Delete/Ctrl+Z) không ghi | không PUT/DELETE · PV/usePascalViewer.ts:271-474 (`readOnly` vào mount) | readOnly | edge | missing | — | real | main chain + viewer |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-A-030 | role | viewer: inspector hiện InlineAlert | tiêu đề "Chỉ xem" + "Bạn đang xem ở vai người xem nên không sửa được mô hình." · VS/ViewerInspector.tsx:82-89 | canEdit=false ∧ roles≠undefined ⇒ forbidden VS/useViewerShell.ts:588 | edge | missing | phase05 #29 gap | real | main chain + viewer |
| 9V-A-031 | role | viewer: 3D có ghi chú `sr-only` | "Bạn đang xem ở vai người xem nên không sửa được hình học trên mô hình 3D." · V3/Viewer3D.tsx:268-273 | forbidden | edge | missing | phase05 #38 gap | real | main chain + viewer |
| 9V-A-032 | role | viewer: RoomAreaPanel chỉ xem, tên phòng là chữ tĩnh | "Bảng chỉ xem — không có quyền sửa tên phòng." · RA/RoomAreaTable.tsx:81,128-136 (nhánh trả sớm riêng: "Không xem được diện tích" / "Vai của bạn trong dự án này chỉ xem được mô hình, chưa xem được bảng diện tích phòng." RA/RoomAreaPanel.chrome.tsx:66-67 — chốt nhánh hiện theo nguồn khi chạy) | isViewerRole ⇒ forbidden RA/useRoomAreaPanel.model.ts:563 | edge | missing | — | real | main chain + viewer |
| 9V-A-033 | role | viewer: 0 `textbox` tên phòng | RA/RoomAreaTable.Row.tsx:59 | canRename=false | edge | missing | — | real | main chain + viewer |
| 9V-A-034 | role | viewer: FurnitureLibrary `forbidden`: ghi chú + thẻ khoá | "Bạn đang xem ở vai chỉ xem nên không kéo mô hình vào bản vẽ được." · FL/FurnitureLibraryPanel.tsx:77; thẻ "Chỉ xem được, không kéo vào bản vẽ." FL/FurnitureLibraryPanelCard.tsx:47 | canPlaceModel=false | edge | missing | — | real | main chain + viewer |
| 9V-A-035 | role | viewer: không có "Thay thế tất cả", `onUploadModel`=null (không tải mô hình lên) | nút vắng · FL/FurnitureLibraryPanel.container.tsx:34-37,115-129 | `can('manage','library')`=false | edge | missing | — | real | main chain + viewer |
| 9V-A-036 | role | engineer: kéo được nhưng KHÔNG có điều khiển tải mô hình lên | thẻ không khoá; không có tải lên · FL/FurnitureLibraryPanel.container.tsx:121,129 | edit layer=true, manage library=false | edge | missing | — | real | main chain + engineer |
| 9V-A-037 | role | viewer: HistoryPanel `forbidden` giữ dòng thời gian, mất nút nhảy | "Chỉ xem được lịch sử" · HP/HistoryPanel.chrome.tsx:63; `canJump`=false HP/historyPanelGateway.ts:246 | edit layer=false | edge | missing | — | real | main chain + viewer |
| 9V-A-038 | role | engineer: HistoryPanel có nút nhảy trạng thái (nhảy rồi quay lại) | nút nhảy hiện/bật · HP/historyPanelGateway.ts:246 | canJump=true | edge | missing | — | real | dự án riêng |
| 9V-A-039 | role | viewer: toolbar "Công cụ khung nhìn" GỠ nút sửa hình học (không chỉ mờ) | 0 nút sửa tường · WG/useWallGeometryEditor.ts:1073 | viewer ⇒ gỡ | edge | missing | — | real | main chain + viewer |
| 9V-A-040 | role | engineer: bật sửa tường chọn được (không ghi) | nút sửa tường hiện, bật được · WG/useWallGeometryEditor.ts:1073 | canEdit | edge | missing | — | real | main chain + engineer |
| 9V-A-041 | role | viewer: cả màn không phát request ghi sau khi mở + thao tác đọc | `recordWrites` rỗng (chỉ GET) | viewer không ghi | edge | missing | — | real | main chain + viewer |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-A-050 | a11y | viewer: InlineAlert "Chỉ xem" là thông báo (`alert`/`status`), không cướp focus | `document.activeElement` không đổi | InlineAlert attention | edge | missing | — | real | main chain + viewer |
| 9V-A-051 | a11y | viewer: Tab qua toolbar không dừng ở nút sửa (đã gỡ) | thứ tự Tab chỉ qua công cụ xem | WG:1073 | edge | missing | — | real | main chain + viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-A-060 | resp | viewer: inspector "Chỉ xem" + bảng phòng + panel đồ đạc khoá + lịch sử chỉ xem (1920/1440/1024/768) | không tràn ngang, ghi chú không bị cắt | verifyUi | ui | missing | — | real | main chain + viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-A-070 | api | viewer PUT spatial layer | 403 — `require_project("layer.edit")` apps/api/spatial_write/router.py:50 | thuộc C6 (B09) | n/a | n/a | — | n/a | — |

## 9V-B · SCR-25 MeasurementTool — files: MT=MeasurementTool/useMeasurementTool.ts,MeasurementTool.tsx,MeasurementList.tsx · route `/projects/:id/3d/measure`
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-B-001 | flow | engineer đo, ghim, xoá phép đo (ghi + dọn) | "Ghim phép đo (phím Enter)" bật; sau ghim có "Xoá"; xoá xong danh sách rỗng · MT/MeasurementTool.tsx:197 | BE `layer.edit` apps/api/measurements/router.py:21,30,41 | edge | missing | — | real | dự án riêng |
| 9V-B-002 | flow | admin (đối chứng): ghim được | như 9V-B-001, ngắn | — | edge | missing | — | real | dự án riêng |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-B-010 | state | ẩn danh | chuyển `/login?next=…%2F3d%2Fmeasure` | — | edge | missing | — | real | không |
### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-B-020 | logic | xoá phép đo bị BE 403 (chỉ phản hồi giả) | "Bạn không có quyền xoá phép đo trong dự án này" · MT/useMeasurementTool.ts:217,832-836 | 403 giả lập | edge | missing | phase05 #107 gap | mock | phản hồi giả 403 DELETE |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-B-030 | role | viewer: vẫn đo được (phím `m` bật công cụ Đo) | nút Đo `aria-pressed=true` · MT/MeasurementTool.tsx:26-33 | forbidden KHÔNG chặn đo | edge | missing | OLD | real | main chain + viewer |
| 9V-B-031 | role | viewer: caption chặn ghim (`role=alert`) | "Bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. vẫn đo và đọc số bình thường." · MT/useMeasurementTool.ts:200-202,993 | shell.state=forbidden | edge | missing | OLD, phase05 #110 | real | main chain + viewer |
| 9V-B-032 | role | viewer: "Ghim phép đo (phím Enter)" disabled khi có phép đo nháp | `toBeDisabled` · MT/MeasurementTool.tsx:197, useMeasurementTool.ts:787 | canPin=false | edge | missing | OLD | real | main chain + viewer |
| 9V-B-033 | role | viewer: phím Enter KHÔNG ghim (không POST /measurements) | recordWrites không có POST · MT/useMeasurementTool.ts:942 | canPin=false | edge | missing | — | real | main chain + viewer |
| 9V-B-034 | role | viewer: danh sách phép đo không có nút "Xoá" | 0 nút "Xoá" · MT/MeasurementList.tsx:89,152 | B-V9-41 | edge | missing | OLD (phase05 #110) | real | main chain có phép đo (admin tạo trước, xoá sau) + viewer |
| 9V-B-035 | role | engineer: ghim được, không caption chặn | nút bật; 0 caption | edit layer=true | edge | missing | — | real | dự án riêng |
| 9V-B-036 | role | `roles===undefined` KHÔNG vào forbidden (chưa biết vai ≠ không quyền) — ghi nhận, khẳng định bằng 9V-B-031 sau khi vai tới | MT/useMeasurementTool.ts:266 | thiết kế | edge | partial | — | real | n/a (đã phủ bởi 9V-B-031) |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-B-050 | a11y | viewer: caption `role=alert`, focus giữ ở viewport | alert chứa caption | OLD:337 | edge | missing | OLD | real | main chain + viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-B-060 | resp | viewer: caption chặn ghim 4 khổ | không tràn/cắt | verifyUi | ui | missing | — | real | main chain + viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-B-070 | api | viewer POST/DELETE measurements ⇒ 403 | `require_project("layer.edit")` measurements/router.py:21 | C6 (B09) | n/a | n/a | — | n/a | — |

## 9V-C · SCR-28 RuleReport + ViolationDetail — files: RR=rules/RuleReport/useRuleReport.ts,RuleReport.tsx · VD=rules/ViolationDetail/*
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-C-001 | flow | engineer: có "Chạy kiểm tra lại" và "Xác nhận đã xử lý" | cả hai nút hiện · RR/RuleReport.tsx:358 | canEdit mặc định true RR/useRuleReport.ts:367 | edge | missing | — | real | main chain + engineer |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-C-010 | state | ẩn danh | chuyển `/login?next=…%2Frules` | — | edge | missing | — | real | không |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-C-030 | role | ⚑ viewer: màn KHÔNG có cổng vai FE — heading "Kiểm tra luật không gian" tải, thấy "Chạy kiểm tra lại" + "Xác nhận đã xử lý" | hành vi thực tế theo nguồn · RR/useRuleReport.ts:367,573-574 (`forbidden` chỉ khi `!capabilities.canEdit`, route không truyền) | nếu hành động ghi BE ⇒ bug bảo mật; thuần client ⇒ bug UX | edge | missing | OLD (gap) | real | main chain + viewer |
| 9V-C-031 | role | viewer bấm "Chạy kiểm tra lại": ghi lại request ghi (recordWrites); có 2xx ghi ⇒ ⚑ High; 403 ⇒ ⚑ UX | danh sách request ghi | BE không có router rule-run (chỉ GET/PUT `rule-config`) ⇒ nhiều khả năng thuần client | edge | missing | — | real | main chain + viewer |
| 9V-C-032 | role | viewer: nút "Bỏ qua" từng vi phạm — quan sát hiện/ẩn | ghi nhận · RR/useRuleReport.ts:573; RuleReport.test.tsx:676 | — | edge | missing | — | real | main chain + viewer |
| 9V-C-033 | role | viewer: ViolationDetail mở được; "Vi phạm trước"/"Vi phạm sau" theo hasPrevious/hasNext (chỉ đọc) | VD/ViolationDetail.tsx:158-166 | read-only | edge | missing | — | real | main chain + viewer |
| 9V-C-034 | role | engineer: "Xác nhận đã xử lý" xong không lỗi | thông báo thành công | canEdit | edge | missing | — | real | dự án riêng |
### E A11y
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-C-050 | a11y | viewer: "Xác nhận đã xử lý" focus bằng Tab, tên truy cập đúng | `getByRole('button',{name:'Xác nhận đã xử lý'})` | — | edge | missing | — | real | main chain + viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-C-060 | resp | viewer: báo cáo luật 4 khổ | không tràn | verifyUi | ui | missing | — | real | main chain + viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-C-070 | api | không có endpoint ghi rule-run/dismiss trong apps/api (chỉ `rule-config` GET/PUT) | C6 xác nhận | rules/router.py:21,29 | n/a | n/a | — | n/a | — |

## 9V-D · SCR-29 RuleSettings — files: RS=rules/RuleSettings/useRuleSettings.ts,RuleSettings.tsx,RuleSettingsRow.tsx,RuleSettingsGroups.tsx,ruleSettingsGateway.ts
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-D-001 | flow | admin bật/tắt một luật rồi khôi phục (PUT rule-config) | switch "Bật hoặc tắt luật: lỗ mở nằm trọn…" đổi được; PUT 200; khôi phục trong finally · RS/useRuleSettings.ts:384 | `ruleset.edit` A=true | edge | missing | — | real | dự án riêng |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-D-010 | state | ẩn danh | chuyển `/login?next=…` (path `ROUTES.project.ruleSettings`) | — | edge | missing | — | real | không |
| 9V-D-011 | state | không phải thành viên ⇒ N21 403 | "Không có quyền xem cài đặt bộ luật" · RS/RuleSettings.tsx:301; RS/useRuleSettings.ts:250-251 | 403 đọc | edge | missing | — | real | user chưa thêm vào dự án |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-D-030 | role | viewer: dải lý do chỉ đọc | "Chỉ quản trị viên đổi được bộ luật; bạn đang xem ở quyền chỉ đọc." · RS/ruleSettingsGateway.ts:98 | `can('edit','ruleset')`=false | edge | missing | OLD | real | main chain + viewer |
| 9V-D-031 | role | viewer: switch luật disabled | switch `/^Bật hoặc tắt luật: lỗ mở nằm trọn/` disabled · RS/RuleSettingsRow.tsx:100,151 | isReadOnly | edge | missing | OLD | real | main chain + viewer |
| 9V-D-032 | role | viewer: ô ngưỡng chỉ đọc | mọi input trong nhóm readonly/disabled · RS/RuleSettingsGroups.tsx:69,143 | isReadOnly | edge | missing | — | real | main chain + viewer |
| 9V-D-033 | role | viewer: 0 request PUT rule-config | recordWrites rỗng | — | edge | missing | — | real | main chain + viewer |
| 9V-D-034 | role | engineer: CÙNG chữ + switch disabled như viewer (engineer không sửa được bộ luật) | chữ 9V-D-030 · RS/useRuleSettings.ts:384 | `ruleset.edit` E=false | edge | missing | OLD | real | main chain + engineer |
| 9V-D-035 | role | engineer: ô ngưỡng chỉ đọc | như 9V-D-032 | — | edge | missing | — | real | main chain + engineer |
| 9V-D-036 | role | admin (đối chứng): dải lý do KHÔNG hiện | 0 phần tử chữ chỉ đọc | A=true | edge | missing | — | real | main chain + admin |
### E A11y
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-D-050 | a11y | viewer: switch disabled; dải lý do là văn bản đọc được (không chỉ màu) | `getByText` exact | RS/RuleSettingsRow.tsx:100 | edge | missing | — | real | main chain + viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-D-060 | resp | viewer + engineer: dải lý do + nhóm luật chỉ đọc 4 khổ | không tràn | verifyUi | ui | missing | — | real | main chain + viewer/engineer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-D-070 | api | viewer/engineer PUT `/projects/{id}/rule-config` ⇒ 403; GET cho mọi thành viên | `require_project("ruleset.edit")` rules/router.py:33; GET :23 | C6 (B09); ⚑ nếu BE cho engineer sửa ⇒ lệch ma trận | n/a | n/a | — | n/a | — |

## 9V-E · SCR-30 ExportPanel — files: EP=export/ExportPanel/ExportPanel.tsx,useExportPanel.ts,exportPanelGateway.ts,ExportPanelFooter.tsx
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-E-001 | flow | engineer: "Xuất" hiện và bật, không có tiêu đề cấm | nút "Xuất" enabled; 0 heading "Không có quyền xuất bản vẽ" · EP/ExportPanelFooter.tsx:64 | `can('export','model')`=true | edge | missing | OLD (mock) | real | main chain có tầng đã duyệt + engineer |
| 9V-E-002 | flow | admin (đối chứng): như 9V-E-001 | — | — | edge | missing | — | real | main chain + admin |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-E-010 | state | ẩn danh | chuyển `/login?next=…%2Fexport` | — | edge | missing | — | real | không |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-E-030 | role | viewer: màn cấm | heading "Không có quyền xuất bản vẽ" · EP/ExportPanel.tsx:211 | model.export V=false | edge | missing | OLD (phase06 #77) | real | main chain + viewer |
| 9V-E-031 | role | viewer: chữ phụ | "Chỉ quản trị viên và kỹ sư của dự án xuất được mô hình; bạn đang xem ở quyền chỉ đọc." · EP/exportPanelGateway.ts:260-261 | permissionCaption | edge | missing | OLD | real | main chain + viewer |
| 9V-E-032 | role | viewer: 0 nút "Xuất", 0 thẻ định dạng | `getByRole('button',{name:'Xuất',exact:true})` count 0 · EP/ExportPanel.tsx:208 | trả sớm | edge | missing | OLD | real | main chain + viewer |
| 9V-E-033 | role | viewer: 0 request ghi/tải bản xuất | recordWrites rỗng | — | edge | missing | — | real | main chain + viewer |
| 9V-E-035 | role | engineer: xuất .json thật (tải về) — chỉ kiểm lời gọi | tải xuống bắt được, tên tệp đúng | opt-in | edge | missing | — | real | dự án riêng có tầng duyệt |
### E A11y
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-E-050 | a11y | viewer: icon khoá `aria-hidden`; không có phần tử tương tác nào trong panel | Tab ra ngoài panel | EP/ExportPanel.tsx:209-211 | edge | missing | — | real | main chain + viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-E-060 | resp | viewer: màn cấm 4 khổ | căn giữa, không cắt | verifyUi | ui | missing | OLD (1440) | real | main chain + viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-E-070 | api | không có endpoint xuất riêng trong apps/api (xuất ở client `src/lib/export`); viewer vẫn GET dữ liệu nguồn (BE cho mọi thành viên) ⇒ chỉ FE chặn | ghi nhận | spatial_read/router.py:58-65 | n/a | n/a | — | n/a | — |

## 9V-F · SCR-31 SpatialJsonViewer — files: SJ=export/SpatialJsonViewer/SpatialJsonViewer.container.tsx,SpatialJsonViewer.tsx,useSpatialJsonViewer.ts
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-F-001 | flow | engineer: mở JSON, ô tìm + cây hiện | ô tìm (label JSON_SEARCH) và cây `role=tree` | roles.length>0 | edge | missing | — | real | main chain + engineer |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-F-010 | state | ẩn danh | chuyển `/login?next=…%2Fdata` | — | edge | missing | — | real | không |
| 9V-F-011 | state | không phải thành viên (GET spatial 403/404) | "Bạn không có quyền xem dữ liệu không gian của dự án này. Hãy hỏi quản trị viên dự án để được cấp quyền xem." · SJ/useSpatialJsonViewer.ts:69; tiêu đề "Không có quyền xem dữ liệu" SJ/SpatialJsonViewer.tsx:53 | BE `require_project()` spatial_read/router.py:65 | edge | missing | — | real | user chưa là thành viên |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-F-030 | role | viewer: JSON không cổng vai (`canView = roles.length > 0`) — xem được, thấy `"name": "Tầng …"`, 0 "Không có quyền xem dữ liệu" | SJ/SpatialJsonViewer.container.tsx:139-140 | viewer có quyền ĐỌC (BE GET mọi thành viên) ⇒ đúng thiết kế | edge | missing | OLD (gap) | real | main chain + viewer |
| 9V-F-031 | role | viewer: không có nút ghi/sửa JSON | 0 nút "Lưu"/"Sửa" | — | edge | missing | — | real | main chain + viewer |
| 9V-F-032 | role | viewer: 0 request ghi | recordWrites rỗng | — | edge | missing | — | real | main chain + viewer |
### E A11y
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-F-050 | a11y | cây JSON điều hướng bằng phím (ArrowRight mở nhánh) cho viewer | `aria-expanded` đổi | phase06 #84 | edge | missing | — | real | main chain + viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-F-060 | resp | viewer: JSON viewer 4 khổ | không tràn | verifyUi | ui | missing | — | real | main chain + viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-F-070 | api | GET `/projects/{id}/spatial` ẩn danh 401, không thành viên 403/404 | `require_project()` | C6 | n/a | n/a | — | n/a | — |

## 9V-G · SCR-32 VersionHistory — files: VH=export/VersionHistory/VersionHistory.container.tsx,VersionHistory.tsx,versionHistoryModel.ts,useVersionHistory.ts
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-G-001 | flow | engineer: gắn nhãn phiên bản rồi gỡ; nút khôi phục + ô nhãn hiện | VH/VersionHistory.container.tsx:143 | `can('edit','layer')`=true | edge | missing | — | real | dự án riêng ≥2 phiên bản |
| 9V-G-002 | flow | engineer: khôi phục phiên bản trong dự án riêng (ghi thật) | khôi phục thành công, có phiên bản mới | BE layer.edit versions/router.py:34,62 | edge | missing | — | real | dự án riêng |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-G-010 | state | ẩn danh | chuyển `/login?next=…%2Fversions` | — | edge | missing | — | real | không |
| 9V-G-011 | state | không phải thành viên ⇒ forbidden | "Bạn không có quyền xem lịch sử phiên bản của bản vẽ này." · VH/VersionHistory.tsx:85 | isForbiddenRead VH/useVersionHistory.ts:486 | edge | missing | — | real | user chưa là thành viên |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-G-030 | role | viewer: lý do chỉ đọc | "Vai trò của bạn trên dự án này chỉ đọc được lịch sử, nên nút phục hồi không hiện" · VH/versionHistoryModel.ts:494 | canRestore=false | edge | missing | OLD (phase06 #123) | real | main chain + viewer |
| 9V-G-031 | role | viewer: 0 nút khôi phục, 0 điều khiển nhãn | count 0 · VH/VersionHistory.tsx:139-144 | — | edge | missing | OLD | real | main chain + viewer |
| 9V-G-032 | role | viewer vẫn xem danh sách (navigation VERSION_LIST) và mở từng phiên bản | điều hướng hiện; chọn được | read | edge | missing | OLD | real | main chain + viewer |
| 9V-G-033 | role | ⚑ viewer: nút xuất phiên bản — cổng `onExportVersion !== undefined`, KHÔNG theo vai ⇒ quan sát hiện/ẩn | ghi nhận · VH/VersionHistory.container.tsx:144; VersionHistory.tsx:165-169 | hiện cho viewer trong khi ma trận `model.export` V=false ⇒ lệch UX | edge | missing | — | real | main chain + viewer |
| 9V-G-034 | role | viewer: 0 request ghi (POST restore / PATCH label) | recordWrites rỗng | — | edge | missing | — | real | main chain + viewer |
### E A11y
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-G-050 | a11y | viewer: lý do chỉ đọc là văn bản liền danh sách | `getByText` exact | — | edge | missing | — | real | main chain + viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-G-060 | resp | viewer: lịch sử phiên bản chỉ đọc 4 khổ | không tràn | verifyUi | ui | missing | OLD (1440) | real | main chain + viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-G-070 | api | viewer POST restore / PATCH label ⇒ 403; GET cho thành viên | `_Editor`=`require_project("layer.edit")` versions/router.py:34,62,85 | C6 | n/a | n/a | — | n/a | — |

## 9V-H · ShareDialog — files: SD=export/ShareDialog/useShareDialog.ts,shareDialogGateway.ts,ShareDialogLink.tsx (mở từ ExportPanel; route `/projects/:id/share`, ShareDialog/index.ts:14)
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-H-001 | flow | engineer: mở hộp chia sẻ, tạo liên kết | nút tạo liên kết bật (`form.canSubmit`) · SD/ShareDialogLink.tsx:176 | `can('create','share')`=true | edge | missing | — | real | dự án riêng + engineer |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-H-010 | state | ẩn danh vào `/projects/:id/share` | chuyển `/login?next=…%2Fshare` | — | edge | missing | — | real | không |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-H-030 | role | viewer: màn Xuất đã cấm nên không có lối mở hộp chia sẻ | 0 nút mở chia sẻ ở màn Xuất · EP/ExportPanel.tsx:208 | model.export V=false | edge | missing | — | real | main chain + viewer |
| 9V-H-031 | role | viewer (qua route `/share`): lý do không có quyền | "Chỉ quản trị viên và kỹ sư của dự án tạo được liên kết chia sẻ; hãy nhờ một người trong hai vai đó tạo giúp" · SD/shareDialogGateway.ts:116-117; useShareDialog.ts:658 | `noPermissionReason` khi `!canCreateLink` | edge | missing | — | real | main chain + viewer |
| 9V-H-032 | role | viewer: nút tạo liên kết disabled/vắng; 0 request tạo | SD/useShareDialog.ts:280 | share.create V=false | edge | missing | — | real | main chain + viewer |
| 9V-H-033 | role | `roles` mặc định rỗng (`NO_ROLES`) ⇒ forbidden (an toàn mặc định) — ghi nhận, phủ bởi 9V-H-031 | SD/ShareDialog.container.tsx:55,101 | thiết kế | edge | partial | — | real | n/a |
### E/F/G
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9V-H-050 | a11y | viewer: lý do chặn đọc được (văn bản, không chỉ tooltip) | `getByText` exact | — | edge | missing | — | real | main chain + viewer |
| 9V-H-060 | resp | viewer: hộp chia sẻ bị chặn 4 khổ | không cắt | verifyUi | ui | missing | — | real | main chain + viewer |
| 9V-H-070 | api | không có endpoint ghi chia sẻ trong apps/api (liên kết sinh ở client `lib/export/shareLink`) | C6 xác nhận | — | n/a | n/a | — | n/a | — |

### Notes
- ⚑1 (cao, xác nhận khi chạy) RuleReport KHÔNG có cổng vai FE: `canEdit` mặc định true, route không truyền (RR/useRuleReport.ts:367) ⇒ viewer thấy "Chạy kiểm tra lại"/"Xác nhận đã xử lý". apps/api/rules chỉ có GET/PUT `rule-config`; nếu hành động ghi BE ⇒ bug bảo mật; thuần client ⇒ bug UX lệch ma trận (9V-C-030/031).
- ⚑2 RuleSettings: FE `ruleset.edit` E=false; BE `require_project("ruleset.edit")` (rules/router.py:33). C6 xác nhận BE cũng E=false; lệch ⇒ bug (9V-D-070).
- ⚑3 VersionHistory nút xuất phiên bản bị cổng bởi `onExportVersion !== undefined`, không theo `model.export` (VH/container.tsx:144) ⇒ viewer có thể thấy nút xuất trong khi ExportPanel cấm (9V-G-033).
- ⚑4 Export/Share không có endpoint ghi BE (sinh ở client): chỉ FE chặn viewer; viewer vẫn GET dữ liệu nguồn (BE cho mọi thành viên) ⇒ chặn ở UX, ghi nhận (9V-E-070, 9V-H-070).
- ⚑5 Pascal: `forbidden` không còn từ cờ (F-15, usePascalViewer.ts:556); chỉ `readOnly` ngăn lệnh sửa — 9V-A-020/021 khẳng định không có request ghi khi viewer thao tác.
- ⚑6 Measure: viewer có caption chặn ghim; 9V-B-033 khẳng định Enter không phát POST. FE cho ghim mà BE 403 ⇒ bug UX.
- Mobile `/m/` (MobileViewer) và 375: ngoài phạm vi. Test cũ OLD (SCR-25/28/29/30/31/32 viewer; SCR-29/30 engineer) ánh xạ ở `flows-C4.md`.
- Dòng `*-070` (và 9V-A-070): `n/a` ở C4, thuộc C6/B09; tính vào cột n/a.

## QA-09 S1 — catalog C5 (`9A`): quan tri SCR-34..37, ma tran vai (viewer / engineer / admin / an danh)

Built 2026-10-14 from source only (FE `F:/worktrees/AppFront/p09-int` @ 5fcaf502, BE `F:/App/AppBack` main dc510655). Desktop 1920/1440/1024/768 only; no 375, no `/m/`.
Abbrev: `ML`=src/screens/admin/ModelLibrary · `TJ`=src/screens/admin/TrainingJobs · `MR`=src/screens/admin/ModelRegistry · `UM`=src/screens/admin/UserManagement ·
`PERM`=src/lib/auth/permissions.ts. Phase 08 (admin, same screens) already covers admin behaviour; here only role-dependent parts + one positive admin line per screen.
Matrix (PERM:44-95): `library.manage` / `user.manage` = admin only; engineer and viewer both false. Training + Registry gate = `roles.includes('admin')`
(TJ/trainingJobsGateway.ts:39, MR/modelRegistryGateway.ts:24), session roles only (no project fallback).
Library gate = `can('manage','library',{roles})` with roles = store `userRoles` (project) if non-empty else session roles (ML/ModelLibrary.container.tsx:126-131) -> F-11 (row 9A-D-009, owned by C1).
Routes have NO guard (router.tsx:389-392); each screen gates itself. Anonymous -> `/login?next=<path>` is the shared auth guard.
Data: `poolUser(admin,'viewer'|'engineer'|'admin','p09-admin-<role>')` + `signInPoolUser`. status = missing unless stated. stack = real for every row (no mock needed).

Summary
| man | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| SCR-34 ModelLibrary | 14 | 1 | 13 | 0 | 2 | 11 | 0 | 0 |
| SCR-35 TrainingJobs | 12 | 0 | 12 | 0 | 3 | 9 | 0 | 0 |
| SCR-36 ModelRegistry | 10 | 0 | 10 | 0 | 2 | 8 | 0 | 0 |
| SCR-37 UserManagement | 19 | 1 | 18 | 0 | 6 | 12 | 0 | 0 |
| **total** | **55** | **2** | **53** | **0** | **13** | **40** | **0** | **0** |

`partial` = asserted only by the mock-server spec `qa/tests/phase09_roles_matrix.spec.ts` (deleted in S4) -> must be redone on the real stack.
`n/a` = owned by another part (C1 / C6). Last-admin guard is unsafe and kept in Notes only.

## SCR-34 ModelLibrary `/admin/models` — files: ML=src/screens/admin/ModelLibrary
### A User flows
(nothing role-dependent beyond D)
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-B-001 | State | viewer deep link settles: never a forbidden empty state (library is read-only, not blocked) | no heading "Không có quyền truy cập"; list visible (ML/ModelLibrary.tsx:6-10) | `state`='forbidden' in the hook (useModelLibrary.ts:507) but the view has no forbidden branch -> table renders | ui | missing | - | real | viewer |
### C Validation/logic
(none)
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-D-001 | Read-only | viewer sees the read-only banner | "Vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện" (useModelLibrary.ts:102-103, ModelLibrary.tsx:103) | `can('manage','library',{roles:['viewer']})`=false -> `readOnlyReason` non-null | ui | missing | - | real | viewer |
| 9A-D-002 | Read | viewer: catalogue still lists items, search box present | search textbox + >=1 item | ModelLibrary.tsx:6-10 "bảng vẫn vẽ đủ" | ui | missing | - | real | viewer; library non-empty |
| 9A-D-003 | Affordance | viewer: no write control in DOM (R-69: removed, not disabled) | toolbar only search / category / view-mode; no upload/edit/delete button | ModelLibraryToolbar.tsx:6; types.ts:26 | ui | missing | - | real | viewer |
| 9A-D-004 | Read | viewer opens an item detail: detail shown, still no write action | detail panel opens; no edit/delete button | ModelLibraryDetail.tsx has no manage controls | ui | missing | - | real | viewer |
| 9A-D-005 | Read-only | engineer sees the same banner | same text as 9A-D-001 | `can('manage','library',{roles:['engineer']})`=false | ui | partial | roles_matrix "SCR-34 [E]" (mock) | real | engineer |
| 9A-D-006 | Read | engineer: table renders, search + a sample item visible | rows visible | same | ui | partial | roles_matrix "SCR-34 [E]" | real | engineer; library seeded |
| 9A-D-007 | Positive | admin: no banner, rows visible (reference) | banner text count 0 | `readOnlyReason`=null when canManage | ui | missing | phase08 | real | admin pool user without project role |
| 9A-D-008 | Anon | anonymous GET `/admin/models` | URL `/login?next=%2Fadmin%2Fmodels` | auth guard | ui | missing | - | real | none |
| 9A-D-009 | Stale role | F-11: admin with lower project `userRoles` opens `/admin/models` -> wrongly read-only | owned by C1 (`9P`), not duplicated | ModelLibrary.container.tsx:126-131 | ui | n/a (owned by C1) | roles_matrix "SCR-34 [A] F-11" (fixme) | real | - |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-E-001 | Alert | viewer: banner is `role=alert` and focus is not moved into it | alert has the banner text; activeElement outside it | InlineAlert.tsx:44 | ui | missing | - | real | viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-F-001 | Layout | viewer read-only banner at 1920/1440/1024/768 | banner not clipped, no horizontal scroll | verifyUi | ui | missing | - | real | viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-G-001 | Authz | viewer: `GET /api/library` 200 (BE needs only a principal), consistent with FE read-only | 200 on the page's list request | library/router.py:3,17 | ui | missing | - | real | viewer |
| 9A-G-011 | Authz | engineer: same `GET /api/library` 200 | 200 | same | ui | missing | - | real | engineer |

## SCR-35 TrainingJobs `/admin/training/jobs` — files: TJ=src/screens/admin/TrainingJobs
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-D-010 | Forbidden | viewer: heading | "Không có quyền truy cập" (TJ/TrainingJobs.tsx:37) | `canManageTraining(['viewer'])`=false -> forbidden (useTrainingJobs.ts:580) | ui | partial | roles_matrix "SCR-35 [V]" | real | viewer |
| 9A-D-011 | Forbidden | viewer: body | "Chỉ quản trị viên hệ thống xem được trang huấn luyện." (TrainingJobs.tsx:38) | same | ui | partial | roles_matrix "SCR-35 [V]" | real | viewer |
| 9A-D-012 | Affordance | viewer: no "Tạo lượt huấn luyện", no tabs, no filters | counts 0 (TrainingJobs.tsx:5-6: kept in every state except forbidden) | early return at TrainingJobs.tsx:133 | ui | missing | - | real | viewer |
| 9A-D-013 | Forbidden | engineer: heading + body (same two strings) | both visible | `roles.includes('admin')` false | ui | partial | roles_matrix "SCR-35 [E]" | real | engineer |
| 9A-D-014 | Affordance | engineer: no "Tạo lượt huấn luyện", no tabs | count 0 | same | ui | missing | - | real | engineer |
| 9A-D-015 | Positive | admin: "Tạo lượt huấn luyện" + tabs visible, no forbidden heading (reference) | button visible (TrainingJobs.tsx:36) | admin | ui | missing | phase08 | real | admin pool user |
| 9A-D-016 | Anon | anonymous GET `/admin/training/jobs` | `/login?next=%2Fadmin%2Ftraining%2Fjobs` | auth guard | ui | missing | - | real | none |
| 9A-D-017 | Mid-session | admin pool user opens screen; admin API demotes THIS pool user to viewer; next list refetch -> 403 locks the screen | heading "Không có quyền truy cập" without reload; no further `/api/admin/ml/*` requests | useTrainingJobs.ts:569-580; phase08 row 71 (gap) | ui | missing | phase08 gap #71 | real | own pool user `p09-admin-flip`; role restored in `finally` |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-E-002 | Structure | forbidden EmptyState: lock icon decorative, no focusable action inside | no button/link in the empty state; title "Không có quyền truy cập" is the heading | TrainingJobs.tsx:137 (`Lock aria-hidden`) | ui | missing | - | real | viewer |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-F-002 | Layout | viewer forbidden state at 4 khổ | centered, no clip | verifyUi | ui | missing | - | real | viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-G-002 | No request | viewer: once forbidden is shown, zero requests to `/api/admin/ml/*` | request log empty for that prefix | `enabled = !isSessionUnknown && isAdmin && !writeForbidden` (useTrainingJobs.ts:402); BE `require_admin` admin_ml_jobs/router.py:30 | api | missing | - | real | viewer |
| 9A-G-003 | No request | engineer: same | empty | same | api | missing | - | real | engineer |

## SCR-36 ModelRegistry `/admin/training/models` — files: MR=src/screens/admin/ModelRegistry
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-D-018 | Forbidden | viewer: heading + body | "Không có quyền truy cập" + "Chỉ quản trị viên hệ thống xem được model AI." (ModelRegistry.tsx:38-39,172-176) | `canManageModels(['viewer'])`=false | ui | partial | roles_matrix "SCR-36 [V]" | real | viewer |
| 9A-D-019 | Affordance | viewer: no "Kích hoạt", no family select, no version table | counts 0 (ModelRegistry.tsx:5: header + select kept in every state except forbidden) | early return | ui | missing | - | real | viewer |
| 9A-D-020 | Forbidden | engineer: heading + body (same strings) | both visible | same | ui | partial | roles_matrix "SCR-36 [E]" | real | engineer |
| 9A-D-021 | Affordance | engineer: no "Kích hoạt", no family select | count 0 | same | ui | missing | - | real | engineer |
| 9A-D-022 | Positive | admin: version table visible; a "Kích hoạt" button (or disabled-with-reason) present; NOT clicked | no forbidden heading; button "Kích hoạt" count >= 1 when an evaluated version exists (ModelRegistryVersionTable.tsx:5,17,52) | admin | ui | missing | phase08 | real | admin pool user |
| 9A-D-023 | Anon | anonymous GET `/admin/training/models` | `/login?next=%2Fadmin%2Ftraining%2Fmodels` | auth guard | ui | missing | - | real | none |
| 9A-D-024 | Positive | admin: header + family select visible | select present | ModelRegistry.tsx:5 | ui | missing | phase08 | real | admin pool user |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-F-003 | Layout | engineer forbidden state at 4 khổ | centered, no clip | verifyUi | ui | missing | - | real | engineer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-G-004 | No request | viewer: zero `/api/admin/ml/*` once forbidden shown | empty | useModelRegistry.ts:395-396; `require_admin` admin_ml_registry/router.py:31 | api | missing | - | real | viewer |
| 9A-G-005 | No request | engineer: same | empty | same | api | missing | - | real | engineer |

## SCR-37 UserManagement `/admin/users` — files: UM=src/screens/admin/UserManagement
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-D-025 | Forbidden | viewer: alert text | "Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì" (useUserManagement.ts:141) | `canManageUsers(['viewer'])`=false -> forbidden (UserManagement.tsx:159) | ui | partial | roles_matrix "SCR-37 [V]" | real | viewer |
| 9A-D-026 | Matrix | viewer: permission matrix still shown, 7 rows x 3 role columns, values = PERM | matrix visible | forbidden shows ONLY matrix (UserManagement.tsx:6) | ui | partial | roles_matrix `USERS_MATRIX` | real | viewer |
| 9A-D-027 | Data | viewer: no user list: no "Vai của <name>" select, no other pool user's email | none in DOM | no list in forbidden | ui | partial | roles_matrix "row count 0" | real | viewer; other users exist |
| 9A-D-028 | Affordance | viewer: no "Mời người dùng", no "Tìm người dùng" | count 0 | toolbar not rendered | ui | partial | roles_matrix `USERS_INVITE` | real | viewer |
| 9A-D-029 | Forbidden | engineer: alert text (same string) | same as D-025 | `can('manage','user',engineer)`=false | ui | partial | roles_matrix "SCR-37 [E]" | real | engineer |
| 9A-D-030 | Matrix | engineer: matrix shown | same as D-026 | same | ui | missing | - | real | engineer |
| 9A-D-031 | Affordance | engineer: no list rows, no "Mời người dùng" | counts 0 | same | ui | partial | roles_matrix "SCR-37 [E]" | real | engineer; other users exist |
| 9A-D-032 | Self guard | admin: own row shows the reason, no role select | "Bạn không thể tự đổi vai của mình" (useUserManagement.ts:137,295); no `Vai của <own name>` select | `isSelfUser` | ui | missing | phase08 #121 (last-admin only) | real | admin pool user in list; other admins exist |
| 9A-D-033 | Self guard | admin: own row disable control replaced by reason | "Bạn không thể tự vô hiệu hoá tài khoản của mình" (useUserManagement.ts:138,307) | same | ui | missing | - | real | same |
| 9A-D-034 | Positive | admin: ANOTHER user's row has an enabled "Vai của <name>" select (not changed) | select enabled, no reason | `roleChangeBlockedReason` null for others | ui | missing | phase08 #122 | real | another pool user in list |
| 9A-D-035 | Anon | anonymous GET `/admin/users` | `/login?next=%2Fadmin%2Fusers` | auth guard | ui | missing | - | real | none |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-E-003 | Alert | viewer: forbidden notice is `role=alert`; focus not moved into it | alert visible | InlineAlert.tsx:44 | ui | missing | - | real | viewer |
| 9A-E-004 | Text reason | admin self row: blocked reason is visible text, not a bare disabled control | text next to the name | UM/types.ts:17 | ui | missing | - | real | admin |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-F-004 | Layout | viewer forbidden (alert + matrix) at 4 khổ | matrix not clipped, no horizontal page scroll | verifyUi | ui | missing | - | real | viewer |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 9A-G-006 | No request | viewer: zero `GET /api/users` once the alert is shown | no request | UserManagement.tsx:156; BE `require_permission("user.manage")` users/router.py:45 | api | missing | - | real | viewer |
| 9A-G-007 | No request | engineer: same | none | same | api | missing | - | real | engineer |
| 9A-G-008 | Authz | admin API: `PATCH /api/users/<self id>/role` rejected | 422 `USER_SELF_MODIFICATION` (users/errors.py:5; service.py:148-156; needs >1 active admin) | forbid_self | api | missing | - | real | admin pool user |
| 9A-G-009 | Authz | admin API: `POST /api/users/<self id>/disable` rejected | 422 `USER_SELF_MODIFICATION`, still active | service.py:302 | api | missing | - | real | same |
| 9A-G-010 | Authz | viewer / engineer direct `/api/users*` -> 403 | owned by C6 (`B09`) | require_permission | api | n/a (owned by C6) | - | real | - |

### Notes
- Last-admin guard (`USER_LAST_ADMIN`, 422) needs a sole active admin -> unsafe, in no flow; phase 08 row 121 covers the FE text.
- No real invitation and no change of another real user's role in phase 09 (phase 08 owns those). The only role change is on the flow's own pool user (FL-9A-05), restored in `finally`.
- Suspect bugs (⚑), to verify on the real stack:
  - ⚑1 (High UX, F-11) ModelLibrary.container.tsx:126-131: store `userRoles` (project role) wins over session role -> an admin who opened a lower-role project sees the read-only banner on `/admin/models`; Training/Registry/Users use session roles only (inconsistent). Correct: system role. Row 9A-D-009 (C1).
  - ⚑2 (Low) useModelLibrary.ts:507 sets `state='forbidden'` for non-managers while the view deliberately renders the table; any consumer keyed on that state misreads viewers. Check 9A-B-001 for a flash of forbidden UI.
  - ⚑3 (Medium) Request leak: if a viewer/engineer still fires any `/api/admin/ml/*` or `GET /api/users` (9A-G-002..007) even though BE 403s, it is a bug (and noisy toast risk).
  - ⚑4 (Medium) Mid-session demotion (9A-D-017): if the screen keeps admin controls after the 403 instead of locking into forbidden -> bug (BE denies, FE allows).
  - ⚑5 (Low) No in-app link to `/admin/*` (phase08 F-10); only URL-reachable (sidebar rows belong to C1).
- Pointers: F-11 -> C1; direct-call 403 matrix -> C6.

