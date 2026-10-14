# Phase 10 coverage — hệ thống + dev routes (FE)

Nguồn: catalog QA-10 C1–C4 (`backend/dieu-phoi/chay/QA-10/`), khoá 2026-10-14. NotFound (SCR-39), phím tắt (SCR-41) và dev URL trên bản prod chạy trên stack THẬT; tám dev route (SCR-40) chạy trên Vite dev server mock do spec tự bật (`tests/support/p10/devServer.ts`). Spec cũ `phase10_system_routes.spec.ts` (Track B cần bật vite tay) đã thay. Mỗi dòng cần phủ = một `test.step('[id] …')` trong `qa/tests/phase10_*.spec.ts` (cổng: `node tools/coverage-gate.mjs --phase 10`).

# QA-10 S1 — catalog C1 (prefix `10N`): SCR-39 NotFound

Generated 2026-10-14, READ ONLY from source. FE `F:/worktrees/AppFront/p10-int` master **5fcaf502** (FE `file:line` relative to `src/`), BE `F:/App/AppBack` main **dc510655**. Khổ 1920/1440/1024/768 (không 375). Stack: real (f14 bản prod, admin `signInAdmin`).
Cột `existing`: `RT` = `qa/tests/phase10_system_routes.spec.ts` (SCR-39, dòng 61-111; SẼ BỊ XOÁ ở S4), `P1` = `qa/coverage/phase01.md` dòng 98/104.
Viết tắt: NF=`screens/system/NotFound/NotFound.tsx`, UNF=`.../useNotFound.ts`, GW=`.../notFoundGateway.ts`, MD=`.../notFoundModel.ts`, PF=`.../PlanFragment.tsx`, NFC=`.../NotFound.container.tsx`, RTR=`routes/router.tsx`, SB=`routes/SessionBootstrap.tsx`.
Seeds: **DP3** = 3 dự án riêng `createProject` (tên có `TEST_DATA_PREFIX`, `qa/tests/support/phase03Seed.ts`), tạo 1 lần ở `beforeAll`, xoá ở `afterAll`; admin thấy mọi dự án nên 3 dự án này là 3 dự án mới nhất theo `updatedAt` · **AD** admin `signInAdmin` · **AN** chưa đăng nhập (context mới).

## SCR-39 NotFound (route `*`) — files: NF, UNF, GW, MD, PF, NFC, RTR

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10N-A-001 | open | admin mở đường không có `/khong-ton-tai` | h2 'Không tìm thấy trang này' · UNF:98, NF h2 | reason `missing` khi đã đăng nhập, không lỗi mạng (UNF:234-245) | edge | covered | RT L68 | real | AD |
| 10N-A-002 | url | URL giữ nguyên, không bị đẩy đi | pathname = `/khong-ton-tai` · RTR:395 | route `*` render tại chỗ | edge | covered | RT L74 | real | AD |
| 10N-A-003 | recent | Danh sách gần đây: ≤3 link, mỗi link tới `/projects/<id>/floors` | h3 'Dự án gần đây' · UNF:88; href `/projects/<id>/floors` · GW toRecentProjectVm | số link = min(n,`RECENT_PROJECT_LIMIT`=3) = 3 với DP3 | edge | covered | RT L76-88 | real | AD, DP3 |
| 10N-A-004 | recent-click | Bấm link đầu → sang màn tầng của dự án đó | URL = href của link · NF `<Link to>` | link đầu = dự án mới nhất | edge | covered | RT L102-110 | real | AD, DP3 |
| 10N-A-005 | back-direct | Tải thẳng URL rồi bấm 'Quay lại' → thay bằng `/` | button 'Quay lại' · UNF:89; `navigate('/', {replace})` · UNF:296-298 | tải thẳng ⇒ `location.key==='default'` | edge | covered | RT L93-96 | real | AD |
| 10N-A-006 | back-history | Có lịch sử trước đó: 'Quay lại' → `navigate(-1)` về trang trước | URL về trang đứng trước NotFound · UNF:301 | `key!=='default'` ⇒ lùi 1 bước, KHÔNG về `/` | edge | missing | — | real | AD |
| 10N-A-007 | dashboard | 'Về danh sách dự án' → `/` | button 'Về danh sách dự án' · UNF:91,308; URL `/` · ROUTES.dashboard | đã đăng nhập ⇒ primary = dashboardLabel | edge | missing | — | real | AD |
| 10N-A-008 | recent-order | Có >3 dự án: chỉ 3 dự án mới nhất, sắp `updatedAt` giảm dần | 3 hàng, thứ tự mới→cũ · GW createNotFoundGateway sort+slice | oracle = 3 tên DP3 theo thứ tự `updatedAt` từ `GET /api/projects` | edge | missing | — | real | AD, DP3 |
| 10N-A-009 | recency | Nhãn 'Cập nhật <thời gian>' ẩn tới khi hover/focus-visible | 'Cập nhật ' + `formatTimestamp` · GW RECENCY_LABEL_PREFIX; `opacity-0 … group-hover:opacity-100 group-focus-visible:opacity-100` · NF | tên luôn hiện; nhãn opacity 0 → 1 khi hover | ui | missing | — | real | AD, DP3 |

### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10N-B-001 | success | ≥3 dự án, ≥1024: minh hoạ + tiêu đề + mô tả + 2 nút + danh sách + chú thích | svg `aria-hidden` (PF); p 'Trang bạn tìm đã bị xoá hoặc đã chuyển đi nơi khác.' · UNF:105; nút 'Về danh sách dự án', 'Quay lại' | state `success` (UNF:272) | ui | partial | RT L72-78 (chỉ tiêu đề) | real | AD, DP3 |
| 10N-B-002 | partial | 1–2 dự án: tiêu đề + danh sách ngắn | h3 'Dự án gần đây' + đúng n link (n=2) | state `partial` (UNF:264) | edge | missing | — | mock (`page.route` `GET /api/projects` trả 2 dự án; admin thật luôn ≥3) | AD |
| 10N-B-003 | empty | 0 dự án: không h3, không danh sách; 2 nút vẫn có | không 'Dự án gần đây'; `hasRecentProjects` false · NF | state `empty` (UNF:260) | edge | partial | RT L80-84 (nhánh có điều kiện, không chạy được) | mock (`[]`) | AD |
| 10N-B-004 | loading | Trong lúc tải danh sách: nội dung chính đã hiện, chưa có danh sách | h2 'Không tìm thấy trang này' hiện; chưa 'Dự án gần đây' | `isPending` ⇒ state `loading` (UNF:252), vm vẫn render | edge | missing | — | mock (làm chậm `GET /api/projects`) | AD |
| 10N-B-005 | offline | Lỗi mạng nguyên bản ⇒ lý do `offline` | h2 'Chưa kết nối được máy chủ'; p 'Đường truyền đang gián đoạn, nên chưa xác nhận được trang này còn hay không.' · UNF:100,107 | `appError.kind==='network'` (UNF:240) | edge | missing | — | mock (`route.abort('failed')`) | AD |
| 10N-B-006 | error-other | Lỗi không phải mạng (500) ⇒ vẫn `missing`, không danh sách | h2 'Không tìm thấy trang này'; không 'Dự án gần đây' | state `error` nhưng reason `missing` (UNF:244,256) | edge | missing | — | mock (500 JSON) | AD |
| 10N-B-007 | collapsed | Khổ 768 (<1024, `NARROW_QUERY`): không có minh hoạ | không svg `aria-hidden`; vẫn đủ chữ + 3 hàng · NFC:17-33, NF `!isCompact` | state `collapsed` (UNF:268) | ui | missing | — | real | AD, DP3 |
| 10N-B-008 | reduced-motion | `prefers-reduced-motion: reduce` ⇒ chuyển mờ thay vẽ nét | class `nf-plan-fragment-fade` trên svg, `nf-notfound-fade` trên khối · PF, NF | `prefersReducedMotion` đúng nhánh | ui | missing | — | real (`emulateMedia`) | AD |

### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10N-C-001 | caption | Chú thích mã lỗi + đường | 'Mã lỗi: 404 · /khong-ton-tai' · UNF:354 (NOT_FOUND_ERROR_CODE '404' MD, separator ' · ') | nguyên văn theo pathname | edge | missing | — | real | AD |
| 10N-C-002 | caption-query | Chuỗi truy vấn/hash không vào chú thích | `/khong-ton-tai?x=1#h` → 'Mã lỗi: 404 · /khong-ton-tai' · UNF:354 dùng `location.pathname` | không có `?x=1` | edge | missing | — | real | AD |
| 10N-C-003 | deep-unmatched | Đường sâu không khớp: `/projects/<uuid>/khong-co` | NotFound hiện (h2 'Không tìm thấy trang này'), URL giữ nguyên · RTR:395 | không pattern nào khớp hậu tố → `*` | edge | missing | — | real | AD |
| 10N-C-004 | deep-missing-project | Đường có thật, dự án không có: `/projects/<uuid-không-có>/floors` → KHÔNG phải NotFound | không có 'Không tìm thấy trang này'; màn tự báo 'Không tìm thấy dự án này' · `components/feedback/ProjectSpatialGate.tsx:37` | route `projectFloors` khớp nên không rơi vào `*` | edge | missing | — | real | AD |

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10N-D-001 | anonymous | Ẩn danh mở `/khong-ton-tai` → bị đẩy `/login` (không thấy NotFound) | URL `/login…` + notice 'signInRequired' · SB:295-309 | `status==='anonymous'` ⇒ `<Navigate>` trước khi NotFound gắn | edge | partial | P1 #98 | real | AN |

### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10N-E-001 | tab-order | Tab: 'Về danh sách dự án' → 'Quay lại' → link dự án 1..3; Enter kích hoạt | thứ tự DOM · NF | nút trước danh sách; Enter trên nút primary → `/` | edge | missing | — | real | AD, DP3 |
| 10N-E-002 | focus-ring | Link dự án có vòng focus khi Tab | `focus-visible:ring-2 ring-accent` · NF ROW_FOCUS_RING_CLASS; nhãn 'Cập nhật' hiện khi focus | computed `box-shadow`/outline khác none; nhãn opacity 1 | ui | missing | — | real | AD, DP3 |
| 10N-E-003 | landmarks | h2 tiêu đề, h3 gần đây trong `<main>`; svg không vào cây truy cập | role main chứa heading level 2 + level 3; svg `aria-hidden="true"` · PF | getByRole('main') | ui | partial | RT L69,76 (chỉ h2) | real | AD, DP3 |

### F Responsive (chụp 1920/1440/1024/768, `verifyUi`)
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10N-F-001 | layout-success | success 3 khổ rộng + collapsed ở 768: không tràn ngang, cột 560px, ảnh hiện đúng | `CONTENT_COLUMN_PX`=560 · MD; svg ẩn ở 768 | `verifyUi` không lỗi bố cục | ui | partial | RT L87 (1 khổ) | real | AD, DP3 |
| 10N-F-002 | layout-empty | empty (không danh sách) 4 khổ | như B-003 | `verifyUi` sạch | ui | missing | — | mock | AD |
| 10N-F-003 | layout-offline | offline 4 khổ (tiêu đề dài hơn) | như B-005 | `verifyUi` sạch | ui | missing | — | mock | AD |

### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10N-G-001 | list | Mở NotFound đã đăng nhập gọi `GET /api/projects` → 200 mảng | `client.projects.list()` · GW; 200 + mảng JSON | `waitForApi(page,'GET',/^\/api\/projects$/,[200])` | api | covered | RT L69-72 | real | AD |
| 10N-G-002 | telemetry | Báo 1 sự kiện lỗi màn hình `system.not-found` đúng 1 lần mỗi lần gắn | POST `ENDPOINTS.telemetry` (sendBeacon) kind `notFound` · UNF:329-350 | `hasReportedRef` ⇒ đúng 1 POST, kể cả khi danh sách tải xong sau đó | api | missing | — | real | AD |

### Notes
- Bug nghi ngờ: chưa thấy trong mã. Rủi ro cần quan sát khi chạy: (a) `GET /api/projects` lỗi mạng có thể bị react-query retry trước khi thành `offline` (B-005 chờ mốc chắc chắn = h2 'Chưa kết nối được máy chủ' hiện); (b) 10N-C-004 chưa chắc `ProjectSpatialGate` bọc route `floors` — nếu không, ghi hành vi thật (không phải NotFound), không coi là bug.
- Không phủ được trên UI thật (n/a): lý do `forbidden` ('Cần đăng nhập để xem trang này' · UNF:99, nút 'Đăng nhập' · UNF:90, `goToSignIn` giữ `state.from`) — ẩn danh luôn bị `<Navigate>` về `/login` trước khi NotFound gắn (SB:295), chỉ có ở unit `NotFound.test.tsx`/Storybook. Truy vấn danh sách `enabled:!isSignedOut` (UNF:218) cũng không quan sát được trên stack.
- `state` của VM (`loading/error/partial/collapsed/success/empty/forbidden`) không được `NotFound.tsx` render ra DOM; chỉ quan sát qua hệ quả (danh sách, minh hoạ). Số hàng 30 > mốc 25: màn nhỏ nhưng có hai môi trường (thật + mock) và 8 trạng thái.
- A-006 dựng lịch sử bằng `history.pushState({usr:null,key:'p10n',idx:1},'','/khong-ton-tai')` + `popstate` rồi bấm nút (router đọc `key` khác 'default').

| màn | rows | n/a | needed | covered | partial | missing | mock | dev |
|---|---|---|---|---|---|---|---|---|
| SCR-39 NotFound | 30 | 0 | 30 | 6 | 5 | 19 | 7 | 0 |

# QA-10 S1 — catalog C2 (prefix `10K`): SCR-41 phím tắt toàn cục

Built 2026-10-14 từ mã FE `F:/worktrees/AppFront/p10-int` (5fcaf502) + BE main dc510655 (chỉ đọc). Khổ: 1920/1440/1024/768, không mobile.
Viết tắt: GSH=`src/components/shell/GlobalShortcutHelp.tsx`, RT=`src/routes/router.tsx`, SR=`src/lib/input/shortcutRegistry.ts`, SC=`src/lib/tools/shortcuts.ts`, AS=`src/hooks/useAutosave.ts`, FT=`src/lib/input/focusTrap.ts`.
Màn chủ thật (stack f14, admin, CHỈ ĐỌC): NotFound `/duong-khong-ton-tai-xyz` (không có ô nhập), `/projects/<MP>/floors` (MP = dự án main chain, `requireState`; đường dẫn có `:projectId` nên hiện 5 hàng toàn cục), `/` dashboard, `/projects/<MP>/3d` (nhóm canvas). Không ghi vào MP.

| màn | rows | n/a | needed | covered | partial | missing | mock | dev |
|---|---|---|---|---|---|---|---|---|
| SCR-41 | 47 | 3 | 38 | 8 (3 vẫn gán bước: spec cũ bị xoá) | 2 | 34 | 0 | 0 |

## SCR-41 Phím tắt toàn cục — files: GSH, RT:175-340, SR:723-783, SC:175-209
Bảng thật đọc registry sống `appShortcutRegistry.listShortcuts()`, chỉ hàng có `description`, bỏ phạm vi `dialog`. Thứ tự nhóm: `Toàn cục` · `Khung nhìn 3D` · `Bảng bên`. Ba hàng `PROJECT_ONLY_IDS` (undo/redo/save) chỉ hiện khi đường dẫn khớp pattern có `:projectId` (GSH:80-89).

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10K-A-001 | open | `?` ngoài ô nhập trên `/projects/<MP>/floors` mở bảng | dialog tên 'Phím tắt' · GSH:176-186 | dialog visible | ui | missing | — | real | MP |
| 10K-A-002 | open | `?` trên NotFound mở bảng | dialog 'Phím tắt' + nút 'Đóng bảng phím tắt' · GSH:176-193 | visible | ui | covered | phase10_system_routes "SCR-41 ? opens", phase01 #101 (spec cũ xoá S4 → vẫn gán bước) | real | admin |
| 10K-A-003 | close | Esc đóng bảng, trang dưới còn nguyên | binding `globalShortcutHelp.close` Escape · GSH:101-109 | dialog hidden, h1 NotFound còn | ui | covered | phase10_system_routes (như trên) | real | admin |
| 10K-A-004 | close | `?` lần hai đóng bảng | `globalShortcutHelp.toggleClose` combo `?` · GSH:110-113 | dialog hidden | ui | missing | — | real | admin |
| 10K-A-005 | close | bấm nút 'Đóng bảng phím tắt' đóng | aria-label 'Đóng bảng phím tắt' · GSH:187-193 | hidden | ui | missing | — | real | admin |
| 10K-A-006 | close | bấm lớp phủ (ngoài hộp) đóng | `onClick={onClose}` trên overlay · GSH:171-178 | hidden | ui | missing | — | real | admin |
| 10K-A-007 | reopen | mở lại lần hai cùng nội dung, không tải thêm chunk | `hasOpenedHelp` giữ cây · RT:302-327 | số hàng như lần 1; 0 request JS mới | ui | missing | — | real | admin |
| 10K-A-008 | open | `?` trên `/login` (ẩn danh) mở bảng | RT:339-343 | visible | ui | covered | phase01_auth_edge "SCR-02 × SCR-41" (#100/#54) — không lặp | real | anon |
| 10K-A-009 | undo | Ctrl+Z trên màn không có lịch sử: không lỗi, không request | `useStore.temporal.getState().undo()` · RT:222 | 0 request ghi, trang không đổi | edge | missing | — | real | MP (đọc) |
| 10K-A-010 | redo | Ctrl+Shift+Z (khác Ctrl+Z) không lỗi, không request | `global.redo` Ctrl+Shift+Z · SR:736-745, RT:226 | 0 request ghi | edge | missing | — | real | MP |
| 10K-A-011 | save | Ctrl+S khi không có bộ tự lưu gắn: không PUT | `flushAutosaves()` rỗng · AS:46-50, RT:236 | 0 request ghi | edge | missing | — | real | MP |
| 10K-A-012 | undo | Ctrl+Z hoàn tác thật một sửa đổi trên màn có lịch sử (WallLayerReview/FloorManager) | `useStore.temporal` undo · RT:222 | giá trị trở lại | edge | partial | phase04_qc_layers, phase06 (toast 'Hoàn tác'; Ctrl+Z chưa xác nhận từng màn) — không lặp ở phase 10 | real | dự án riêng |

### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10K-B-001 | closed | trước `?` đầu tiên không có dialog trong DOM | `hasOpenedHelp` false → không mount · RT:302 | `getByRole('dialog',{name:'Phím tắt'})` count 0 | ui | covered | phase10_system_routes | real | admin |
| 10K-B-002 | lazy | chunk GlobalShortcutHelp chỉ tải sau `?` đầu | `lazy(() => import(...))` · RT:175-179 | trước `?`: 0 request JS tên chứa GlobalShortcutHelp; sau: ≥1, 200 | api | missing | — | real | admin |
| 10K-B-003 | content | hàng 'Hoàn tác thao tác gần nhất' = Ctrl + Z (route có `:projectId`) | SR:730 · GSH:226-246 | `<dt>` đó, Kbd 'Ctrl','Z' | ui | missing | — | real | MP |
| 10K-B-004 | content | hàng 'Làm lại thao tác vừa hoàn tác' = Ctrl + Shift + Z | SR:741 | Kbd 'Ctrl','Shift','Z' | ui | missing | — | real | MP |
| 10K-B-005 | content | hàng 'Lưu ngay thay vì chờ tự lưu' = Ctrl + S | SR:750 | Kbd 'Ctrl','S' | ui | missing | — | real | MP |
| 10K-B-006 | content | hàng 'Mở bảng phím tắt' = ? | SR:768 | Kbd '?' | ui | missing | — | real | MP |
| 10K-B-007 | content | hàng 'Đóng lớp trên cùng' = Esc (nhãn 'Esc', không 'ESCAPE') | SR:778, KEY_CAP_LABELS SR:193-202 | Kbd 'Esc' | ui | missing | — | real | MP |
| 10K-B-008 | content | trên NotFound (không `:projectId`) nhóm 'Toàn cục' chỉ 2 hàng 'Mở bảng phím tắt', 'Đóng lớp trên cùng'; KHÔNG 'Hoàn tác thao tác gần nhất', 'Làm lại thao tác vừa hoàn tác', 'Lưu ngay thay vì chờ tự lưu' (BUG-085) | GSH:73-89 | đúng 2 `<dt>` | ui | missing | — | real | admin |
| 10K-B-009 | content | trên `/projects/<MP>/3d` thêm nhóm 'Khung nhìn 3D' (hàng 'Mở ô tìm đối tượng' Ctrl + F); Ctrl+F không ở nhóm 'Toàn cục' | GSH:55-60 · ObjectSearch.tsx:116-118 | h3 'Khung nhìn 3D' + h3 'Toàn cục' | ui | missing | — | real | MP, WebGL |
| 10K-B-010 | content | chân bảng | 'Nhấn ? hoặc Esc để đóng' (hai Kbd) · GSH:241-243 | text có 'Nhấn', 'để đóng' | ui | missing | — | real | admin |

### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10K-C-001 | typing | `?` gõ trong ô nhập là chữ, không mở bảng | `isTextEntryTarget` · SC:189-209, SR:529-533 | giá trị ô '?', dialog 0 | edge | covered | phase01 #54 | real | anon |
| 10K-C-002 | typing | Ctrl+Z trong ô nhập không bị chiếm (không undo kho) | SR:529-533 | `defaultPrevented===false`, 0 request | edge | partial | phase03_floors_edge:512 | real | MP |
| 10K-C-003 | repeat | giữ `?` (keydown lặp) mở đúng một lần, không bật-tắt | `allowRepeat` mặc định false · SR:563-568 | sau down,down: dialog visible | edge | missing | — | real | admin |
| 10K-C-004 | scope | Ctrl+F ngoài màn 3D không bị chiếm | `global.search` không đăng ký · RT:279-283 | `defaultPrevented===false` | edge | missing | — | real | admin |
| 10K-C-005 | scope | Ctrl+S bị preventDefault (hộp thoại lưu trang không mở) | SR:466 (preventDefault mặc định) | `defaultPrevented===true` | edge | missing | — | real | MP |
| 10K-C-006 | modal | bảng mở nuốt phím khác: `n` trên dashboard không mở wizard | tầng `dialog` modal · SR:596-612 | dialog tạo dự án count 0 | edge | missing | — | real | admin |
| 10K-C-007 | layer | Esc khi bảng mở đóng CHỈ bảng, lớp dưới còn | A12 · GSH:21-31 | panel 'quên mật khẩu' còn | edge | covered | phase01 #54 | real | anon |
| 10K-C-008 | layer | Esc khi không có lớp: `closeDialog` không lỗi, trang đứng yên | `global.closeTopLayer` · RT:320 | URL/h1 giữ, 0 lỗi console | edge | missing | — | real | admin |
| 10K-C-009 | cleanup | điều hướng (history.back) khi bảng đang mở: trạng thái bảng xác định | `isHelpOpen` trong `UndoShortcuts` bọc mọi route · RT:300-309 | ⚑ nghi: bảng vẫn mở trên màn mới | edge | missing | — | real | MP |

### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10K-D-001 | role | bảng không phụ thuộc vai | GSH:80-89 không đọc vai/phiên | n/a — không có nhánh theo vai | — | n/a | — | n/a | — |
| 10K-D-002 | anon | ẩn danh `/login`: `?` mở bảng (2 hàng) | RT:339 | dùng A-008 | edge | covered | phase01 #100 | real | anon |

### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10K-E-001 | role | `role=dialog`, `aria-modal=true`, tên từ h2 'Phím tắt' | GSH:150-155 | thuộc tính | ui | missing | — | real | MP |
| 10K-E-002 | focus | mở bảng: focus vào trong dialog | `trap.activate` rAF · GSH:115-125 | `activeElement` trong dialog | ui | missing | — | real | admin |
| 10K-E-003 | trap | Tab/Shift+Tab xoay vòng trong bảng | `createFocusTrap` · FT | sau N Tab focus vẫn trong dialog | ui | missing | — | real | MP |
| 10K-E-004 | focus | đóng bảng trả focus về phần tử mở | FT:137-143, 184-193 | opener `toBeFocused` | ui | missing | — | real | admin |
| 10K-E-005 | name | nút đóng tên 'Đóng bảng phím tắt' | GSH:190 | getByRole button | ui | covered | phase01_auth_ui U01 | real | admin |
| 10K-E-006 | struct | mỗi nhóm là `<section>` gắn h3 ('Toàn cục'/'Khung nhìn 3D'/'Bảng bên'), hàng `<dl><dt><dd>` | GSH:196-206 | region tên 'Toàn cục' | ui | missing | — | real | MP |
| 10K-E-007 | motion | `prefers-reduced-motion`: bảng chỉ mờ, vẫn mở/đóng | GSH:140-143 | emulateMedia reduce → visible, hidden sau Esc | ui | missing | — | real | admin |

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10K-F-001 | layout | bảng mở trên `/floors` 4 khổ | `max-w-[480px] max-h-[80vh]` · GSH:158 | không tràn ngang | ui | missing | — | real | MP |
| 10K-F-002 | layout | bảng mở trên NotFound (2 hàng) 4 khổ | như trên | căn giữa | ui | missing | — | real | admin |
| 10K-F-003 | layout | bảng dài (3D) 1024/768 cuộn trong hộp, tiêu đề dính `sticky top-0` | GSH:158,184 | nút X còn thấy | ui | missing | — | real | MP, WebGL |
| 10K-F-004 | mobile | 375 | ngoài phạm vi: mobile | — | — | n/a | — | n/a | — |

### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10K-G-001 | no-net | mở/đóng bảng không gọi API nghiệp vụ | thuần FE · GSH | 0 request `/api` ngoài refresh phiên | api | missing | — | real | admin |
| 10K-G-002 | no-net | Ctrl+S/Ctrl+Z/Ctrl+Shift+Z không sinh PUT/POST | AS:46-50 | 0 ghi | api | missing | — | real | MP |
| 10K-G-003 | n/a | endpoint riêng của màn | n/a — màn không có gateway | — | — | n/a | — | n/a | — |

### Notes
- 47 hàng > mốc 25: 6 phím × (hành vi + hàng nội dung) + ba bề mặt (NotFound, project, 3D); nửa số hàng là kiểm nội dung rẻ trong cùng một lần mở.
- ⚑ 10K-C-009 (nghi): `isHelpOpen` nằm trong `UndoShortcuts` bọc mọi route (RT:300) và không reset khi đổi route; history.back khi bảng mở có thể để bảng mở trên màn mới. Đúng: bảng đóng khi đường dẫn đổi (hoặc ít nhất tiêu đề/hàng tính lại theo `useLocation`, GSH:96-97 đã làm phần tính lại).
- Ctrl+F: khai ở `buildGlobalShortcuts` (SR:756) nhưng vỏ không đăng ký (RT:279-283) → đúng thiết kế, ghi để người soát không báo nhầm; hàng 3D đến từ phạm vi canvas.
- BUG-085 đã vá (GSH:73-79); B-008 là phép chặn hồi quy.
- Phím canvas/sidePanel của từng màn thuộc phase sở hữu màn; phase 10 chỉ có B-009 làm bằng chứng nhóm động.
- C-002 cần một ô nhập có sẵn: ô tìm của dashboard `/` (hoặc `/floors`); spec lấy `getByRole('textbox')`/'searchbox' đầu tiên, không có thì ghi bước bỏ.
- Mobile hộp thoại 375 n/a. Hàng `dialog` bị bỏ khỏi bảng: Esc/`?` đóng của chính nó không liệt kê (GSH:34-39).

# QA-10 S1 — catalog C3 (prefix `10D`): dev route nhóm 1 — `/demo`, `/design-system`, `/design-system/states`

Generated 2026-10-14, READ ONLY from source. FE `F:/worktrees/AppFront/p10-int` master **5fcaf502** (+P0), every FE `file:line` relative to `src/`. Khổ 1920/1440/1024/768; không 375/mobile.
Cả ba màn chạy trên **dev server mock** (`qa/tests/support/p10/devServer.ts`, fixture `devTest`: `devPage`/`devBaseURL`, không phiên). Route chỉ tồn tại khi `import.meta.env.DEV` (`routes/router.tsx:130,155`); đối chứng bản prod → NotFound do C4.
Số hàng: 1xx = `/demo`, 2xx = `/design-system`, 3xx = `/design-system/states`. `existing`: `P10` = `qa/tests/phase10_system_routes.spec.ts` (SẼ BỊ XOÁ S4): chỉ khẳng định "heading hiện + URL không đổi + ảnh" cho 3 route (L151-L159 danh sách, L204-L219 vòng lặp) → status `partial` chỉ ở hàng landmark.
⚑ = viết theo hành vi ĐÚNG theo nguồn, đỏ tới khi sửa.

Viết tắt: APP=`App.tsx`, MD=`screens/MotionDemo.tsx`, UMD=`hooks/useMotionDemo.ts`, OSG=`screens/system/StateGallery.tsx` (bảng QA cũ, KHÔNG phải S-47), DSS=`components/shell/DevStateSwitcher.tsx`, DS=`screens/DesignSystem.tsx`,
SG=`screens/system/StateGallery/StateGallery.tsx`, SGT=`…/StateGalleryToolbar.tsx`, SGR=`…/StateGalleryTree.tsx`, SGF=`…/StateGalleryFrames.tsx`, USG=`…/useStateGallery.ts`, SGC=`…/StateGallery.container.tsx`, MAN=`…/stateGalleryManifest.ts`.
Tailwind `bg-bg-selected` = mục đang chọn. `/demo` mở `App` (chứ không phải `DemoSharedControls`…): mục "Shared Controls", "Canvas & Overlays", "Data Entry", "Feedback & States", "List & Review", "App Shell" của `/demo` chỉ kiểm "chọn được + landmark hiện", nội dung sâu thuộc C4.

## DEV-1 `/demo` Demo App (vỏ chọn màn + MotionDemo + bảng QA cũ) — files: APP, MD, UMD, OSG, DSS

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-A-101 | open | mở `/demo` không phiên: h1 'Demo App'; URL giữ `/demo` (không về `/login`) | h1 'Demo App' · APP:70 | DEV route công khai (`DEV_PUBLIC_ROUTE_PATTERNS`) | edge | partial | P10 L204-219 | dev | — |
| 10D-A-102 | list | thanh trái có đúng 9 nút theo thứ tự | 'Design System','Canvas & Overlays','Data Entry','Shared Controls','Feedback & States','List & Review','App Shell','Motion & Transitions','State Gallery (QA)' · APP:44-54 | `Object.entries(screens)` | edge | missing | — | dev | — |
| 10D-A-103 | default | mặc định chọn 'Design System' (nút nền chọn, nội dung = DesignSystem) | h1 'Quiet Blueprint v1.1' trong vùng phải · APP:57 `useState('design-system')`, DS:28 | khởi tạo | edge | missing | — | dev | — |
| 10D-A-104 | nav | bấm 'Motion & Transitions' → MotionDemo | h2 'Chuyển cảnh và nhịp' · MD:60-ish (header) | `setActiveScreen('motion')` APP:79 | edge | missing | — | dev | — |
| 10D-A-105 | nav | bấm 'State Gallery (QA)' → bảng QA cũ | h1 'State Gallery (QA)' · OSG | `states` → `StateGallery` (OSG) | edge | missing | — | dev | — |
| 10D-A-106 | nav | bấm 6 mục còn lại (Canvas & Overlays, Data Entry, Shared Controls, Feedback & States, List & Review, App Shell): mỗi mục đổi nội dung, không sập, nút đang chọn đổi | vùng phải không hiện fallback; nút chọn `bg-bg-selected` · APP:79-84 | không `ScreenCrashFallback` | edge | missing | — | dev | — |
| 10D-A-107 | boundary | đổi màn gắn lại ranh giới lỗi (`key={activeScreen}`): chuyển qua lại giữ không rơi fallback | không hiện fallback · APP:88 | key đổi mỗi lần | edge | missing | — | dev | — |

### B States — MotionDemo
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-B-101 | default | trạng thái đầu: chip 'đổi khung nhìn' nhấn, '8 mục' nhấn, caption '60 khung hình/giây', 8 hàng 'Mục 1'…'Mục 8' | 'Đổi khung nhìn' `aria-pressed=true` · MD:109 (`KIND_LABELS.view`, UMD:105); '8 mục' pressed · MD:146 (UMD:107); '60 khung hình/giây' · MD:91-95 (HEALTHY_FRAME_RATE UMD:32) | kind='view', rowCount=8 | edge | missing | — | dev | — |
| 10D-B-102 | toggle | 'Giả lập máy yếu' bật → '12 khung hình/giây — dưới ngưỡng, mọi thời lượng về mức tức thì'; `aria-pressed=true`; tắt → '60 khung hình/giây' | chuỗi MD:92-95; STRUGGLING_FRAME_RATE=12 UMD:29 | UMD:112 | edge | missing | — | dev | — |
| 10D-B-103 | empty | chip '0 mục' → 'Chưa có mục nào.', không `<ul>` | 'Chưa có mục nào.' · MD:164 | `rows.length===0` | edge | missing | — | dev | — |
| 10D-B-104 | rowcount | chip '3 mục' → 3 hàng; '20 mục' → 20 hàng; '8 mục' → 8; chỉ chip chọn `aria-pressed` | 'Mục N' + 'trễ Xms' · MD:150-170 | `MOTION_DEMO_ROW_COUNTS=[0,3,8,20]` UMD:38 | edge | missing | — | dev | — |
| 10D-B-105 | stagger | trễ hàng cuối ≤ trần: caption 'Mỗi mục trễ thêm {STAGGER_STEP_MS}ms … trễ lâu nhất là {maxRowDelayMs}ms — luôn dưới trần {STAGGER_BUDGET_MS}ms' ; hàng '20 mục' hiện 'trễ Xms' với X ≤ STAGGER_BUDGET_MS | caption MD:176-181 | `lib/motion` hằng STAGGER_* | edge | missing | — | dev | — |
| 10D-B-106 | lowperf-rows | máy yếu bật: mọi 'trễ …ms' = 0ms, 'tổng 0ms · chồng 0ms' | 'trễ 0ms' · MD:170; caption pha MD:131-134 | duration clamp (lib/motion) | edge | missing | — | dev | — |
| 10D-B-107 | reduced-os | hệ điều hành giảm chuyển động (`emulateMedia reducedMotion:'reduce'`) → dòng thông báo | 'Hệ điều hành đang bật giảm chuyển động: mọi thời lượng bằng 0.' · MD:98-102 | `demo.reducedMotion` | edge | missing | — | dev | — |

### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-C-101 | scene | 'Đổi cảnh' đổi lớp 'Mặt bằng 2D' ↔ 'Mô hình 3D'; caption pha thành 'đang ra'/'chồng nhau'/'đang vào' rồi 'đứng yên' | caption `{phase} · tổng {totalMs}ms · chồng {overlapMs}ms` · MD:131-134, PHASE_LABELS MD:38-43 | transition.phase UMD | edge | missing | — | dev | — |
| 10D-C-102 | scene-replace | bấm 'Đổi cảnh' liên tiếp 2 lần giữa chừng: thay lần chạy, không xếp hàng; kết thúc lớp cuối đúng 1 | đúng 1 lớp hiện sau khi 'đứng yên' · MD:136-139 ('thao tác không bao giờ phải chờ') | swapScene thay thế | edge | missing | — | dev | — |
| 10D-C-103 | kind | chọn kind 'đổi màn' / 'đổi tầng': chip đổi pressed, tổng/chồng ms thay đổi theo kind | `aria-pressed` · MD:109-120; totalMs/overlapMs UMD:171+ | UMD plan(kind) | edge | missing | — | dev | — |
| 10D-C-104 | replay | 'Chạy lại' vẽ lại danh sách (`<ul key=replayKey>` mount lại) giữ nguyên số hàng | số 'Mục N' không đổi; phần tử `<ul>` mới · MD:158,164-166 | replayKey++ UMD:41 | edge | missing | — | dev | — |
| 10D-C-105 | os-reduced+lowperf | máy yếu bật + giảm chuyển động OS: không lỗi, ms = 0 | không crash | | edge | missing | — | dev | — |

### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-E-101 | kbd | Tab tới từng nút thanh trái, Enter/Space chọn màn; vòng focus nhìn thấy | `focus-visible:ring-2` · APP:73-76 | | ui | missing | — | dev | — |
| 10D-E-102 | a11y | chip có `aria-pressed`; caption pha `aria-live="polite"` đọc được | MD:131 | | ui | missing | — | dev | — |

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-F-101 | layout | `/demo` mặc định (Design System) 4 khổ | thanh trái 240 px cố định, không cuộn ngang trang | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-102 | layout | MotionDemo (8 mục) 4 khổ | khối 160 px 2 lớp không tràn; hàng không cắt chữ | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-103 | layout | State Gallery (QA) cũ 4 khổ | lưới skeleton + 14 empty-state không cuộn ngang | `verifyUi` | ui | missing | — | dev | — |

### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-G-101 | api | mock client, không BE: mở `/demo` không phát request `/api/*` ra ngoài dev server | n/a: "mock client, không BE" | — | api | n/a | — | n/a | — |

## DEV-2 `/design-system` DesignSystem (Quiet Blueprint v1.1) — files: DS

### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-A-201 | open | mở `/design-system`: h1 'Quiet Blueprint v1.1', 'Foundation Components Demo'; URL giữ | h1 · DS:28, p DS:29 | | edge | partial | P10 L204-219 | dev | — |
| 10D-A-202 | sections | 4 mục h2 theo thứ tự: 'Buttons','Icon Buttons','Segmented Control','Toggle' | DS:34,97,114,159 | | edge | missing | — | dev | — |
| 10D-A-203 | buttons | lưới nút: 4 cột 'Primary','Secondary','Ghost','Danger' × (Default / có icon / Loading / Disabled); số nút khớp | h3 DS:40-75 ('Delete Project','Deleting...','With Icon & Shortcut'…) | 4×4=16 + Sizes | edge | missing | — | dev | — |
| 10D-A-204 | sizes | 'Small (32px)','Medium (36px)','Large (44px / 40px from 640px)' + 2 nút chỉ-icon 'Settings','Loading Settings' | DS:79-90 | | edge | missing | — | dev | — |
| 10D-A-205 | segmented | 3 nhóm: '2D Plan/3D View/Data' (mặc định '2D Plan'), '110 mm/220 mm/330 mm' (mặc định 110), 'Draft/Review/Published' (mặc định Draft, Review disabled) | `role=radiogroup` radio `aria-checked` · SegmentedControl:69,108; DS:116-157 | defaultValue | edge | missing | — | dev | — |

### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-B-201 | loading | nút `loading` (Loading/Deleting...) `aria-busy`/disabled, bấm không có tác dụng | Button loading · DS:44,53,62,71 | | edge | missing | — | dev | — |
| 10D-B-202 | disabled | 4 nút Disabled + IconButton 'Disabled' + Toggle 'Disabled Toggle' đều `disabled`, Tab bỏ qua | DS:45,54,63,72,106,178 | | edge | missing | — | dev | — |
| 10D-B-203 | icon-active | IconButton 'Check (Active)' ở trạng thái active; 'Loading' ở busy | DS:103-105 | `isActive`,`loading` | edge | missing | — | dev | — |
| 10D-B-204 | toggle-default | 'Simple Toggle' không điều khiển: bấm đổi `aria-checked` false→true→false, tức thời | role=switch · Toggle:86-87; DS:166 | uncontrolled | edge | missing | — | dev | — |
| 10D-B-205 | toggle-async | 'Async Toggle' bật: sau ~800ms `aria-checked=true`, trong lúc chờ thể hiện lạc quan/đang tải | 'Optimistic Async (800ms)' · DS:169; DEMO_LATENCY_MS=800 DS:8-9 | optimistic Toggle:36-50 | edge | missing | — | dev | — |
| 10D-B-206 | toggle-fail | 'Error Toggle' bấm: bật tạm rồi lui về `aria-checked=false` sau ~800ms; trang không sập (không lỗi chưa bắt) | 'Optimistic Async (Fails)' · DS:174; rollback Toggle:51-56 | `reject` → catch | edge | missing | — | dev | — |

### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-C-201 | segmented-click | bấm '3D View' → radio chọn đổi, '2D Plan' bỏ chọn; mỗi nhóm độc lập | `aria-checked` · SegmentedControl:69 | | edge | missing | — | dev | — |
| 10D-C-202 | segmented-kbd | focus nhóm, ArrowRight/ArrowLeft đi vòng 3 mục; mục disabled ('Review') bị bỏ qua hoặc không chọn được | ArrowRight/Left · SegmentedControl:127-132 | `(i+1)%n` | edge | missing | — | dev | — |
| 10D-C-203 | segmented-disabled | bấm 'Review' (disabled) không đổi chọn | `disabled:true` DS:149 | | edge | missing | — | dev | — |
| 10D-C-204 | toggle-race | bấm 'Async Toggle' 2 lần liền trong 800ms: kết quả cuối nhất quán (không kẹt lạc quan) | `aria-checked` cuối ổn định | Toggle:36-50 | edge | missing | — | dev | — |

### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-E-201 | a11y-names | tên truy cập: IconButton 'Settings','Check (Active)','Loading','Disabled'; Toggle 'Simple Toggle','Async Toggle','Error Toggle','Disabled Toggle' | `aria-label` · DS:102-106,166-178 | | ui | missing | — | dev | — |
| 10D-E-202 | kbd | Tab đi qua mọi điều khiển không-disabled theo thứ tự DOM; Space/Enter kích hoạt nút và Toggle | | | ui | missing | — | dev | — |

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-F-201 | layout | `/design-system` toàn trang 4 khổ (lưới 4 cột nút cố định `grid-cols-4` DS:36) | không cuộn ngang ở 768/1024 (⚑ nếu cuộn: nút 'With Icon & Shortcut' tràn) | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-202 | layout | trạng thái sau tương tác (toggle async đang chờ + segmented đổi chọn) 4 khổ | không nhảy bố cục | `verifyUi` | ui | missing | — | dev | — |

### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-G-201 | api | mock client, không BE | n/a: "mock client, không BE" | — | api | n/a | — | n/a | — |

## DEV-3 `/design-system/states` StateGallery S-47 (cây 47 màn, thanh công cụ, khung bảy trạng thái) — files: SG, SGT, SGR, SGF, USG, SGC, MAN

Nguồn: 7 trạng thái của view = `forbidden|loading|error|empty|collapsed|partial|success` (SG:136-185; USG:334). Nhãn 7 trạng thái trong khung (SEVEN_STATE_LABELS, `lib/testing/sevenStateScenarios.ts:40`): 'rỗng','đang tải','một phần','lỗi','thành công','không có quyền','thu gọn'. Manifest hiện đủ 7/7 cho mọi màn (không có `null`) ⇒ trạng thái dẫn xuất khi có chọn màn = `success`; `partial` chỉ dựng được trong story (`stateGalleryScenarios.ts`), `forbidden`/`error` không đạt được trên dev.

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-A-301 | open | mở `/design-system/states`: h1 'Duyệt bảy trạng thái'; URL giữ; không `/login` | h1 · SG:~204 PAGE_TITLE | | edge | partial | P10 L204-219 | dev | — |
| 10D-A-302 | initial | chưa chọn màn → 'Chưa chọn màn nào' / 'Chọn một màn ở cây bên trái để xem bảy trạng thái của màn đó.' | EmptyState · SG:136-142 | `selectedScreenId===null` USG:340 | edge | missing | — | dev | — |
| 10D-A-303 | header | tóm tắt: 'Số trạng thái đã có' = `presentCount/totalCount`, 'Số màn' = số màn manifest | dt/dd · SG:CoverageSummary | `galleryCoverage(MAN)`: presentCount=totalCount (không `null`); số màn = `SCREEN_DEFS.length` | edge | missing | — | dev | — |
| 10D-A-304 | tree | cây: `nav` 'Cây màn theo nhóm', tám nhóm 'nhóm A · Xác thực và tài khoản' … 'nhóm H · Xem mô hình và hệ thống' đúng thứ tự A→H (nhóm rỗng không hiện) | h3 · SGR:~120; MAN:27-36 | `SCREEN_GROUPS` | edge | missing | — | dev | — |
| 10D-A-305 | tree-row | mỗi hàng: nhãn màn + huy hiệu 'đã có 7/7' (neutral), sr-only 'Đủ bảy trạng thái' | SGR:ScreenRow, `RATIO_PREFIX='đã có'`, `COMPLETE_HINT` | coverageOfScreen USG:~95 | edge | missing | — | dev | — |
| 10D-A-306 | select | bấm một màn (vd 'Cài đặt tài khoản'): nút `aria-current="true"`; vùng phải hiện h2 = nhãn màn và lưới khung; dải 'Không màn nào còn thiếu trạng thái.' (`role=status`) | SG:155-158; SGF:`<h2>` nhãn; `aria-current` SGR:~63 | state `success` USG:350 | edge | missing | — | dev | — |
| 10D-A-307 | select-other | bấm màn khác: h2 đổi, `aria-current` chuyển, bảng kết quả kiểm (nếu có) bị xoá | USG:300 `setCheckRows(EMPTY)` khi `selectedScreenId` đổi | | edge | missing | — | dev | — |

### A' Khung bảy trạng thái (mỗi trạng thái một dòng: khung hiện)
Mỗi dòng: chọn một màn đủ story (vd 'Cài đặt tài khoản') → `region 'Khung xem trước bảy trạng thái'` có đúng 7 `<li>`; khung có `figcaption` = nhãn + 'Đã có mẫu', và `<code>` tên story. Chép nguyên văn nhãn từ `SEVEN_STATE_LABELS`; tên story ví dụ (account/AccountSettings): Empty, Loading, Partial, ErrorState, Success, Forbidden, Collapsed (MAN:72-80).
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-A-311 | frame | khung 'rỗng' hiện, 'Đã có mẫu', `<code>Empty</code>` | figcaption 'rỗng' · SGF:StateFrame | SEVEN_STATES[0] | edge | missing | — | dev | — |
| 10D-A-312 | frame | khung 'đang tải' hiện, 'Đã có mẫu', `Loading` | 'đang tải' | | edge | missing | — | dev | — |
| 10D-A-313 | frame | khung 'một phần' hiện, `Partial` | 'một phần' | | edge | missing | — | dev | — |
| 10D-A-314 | frame | khung 'lỗi' hiện, `ErrorState` | 'lỗi' | | edge | missing | — | dev | — |
| 10D-A-315 | frame | khung 'thành công' hiện, `Success` | 'thành công' | | edge | missing | — | dev | — |
| 10D-A-316 | frame | khung 'không có quyền' hiện, `Forbidden` | 'không có quyền' | | edge | missing | — | dev | — |
| 10D-A-317 | frame | khung 'thu gọn' hiện, `Collapsed` | 'thu gọn' | | edge | missing | — | dev | — |
| 10D-A-318 | frame-count | đúng 7 khung, 0 khung 'Chưa có mẫu cho trạng thái này' trên mọi màn manifest (so với số `null`=0) | 'Chưa có mẫu cho trạng thái này' vắng · SGF:FRAME_MISSING | `screen.states.length==7`, không `storyExportName===null` | edge | missing | — | dev | — |

### B States (7 trạng thái của view)
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-B-301 | empty | = A-302 (không chọn màn): cây vẫn đầy, chỗ trống ở vùng phải | cây hiện 'Cây màn theo nhóm' · SG:136, USG:340 | | edge | missing | — | dev | — |
| 10D-B-302 | success | có chọn màn, manifest đủ: 'Không màn nào còn thiếu trạng thái.' | SG:155-158, SUCCESS_MESSAGE | `incompleteScreens.length===0` USG:350 | edge | missing | — | dev | — |
| 10D-B-303 | loading | bấm 'Chạy kiểm nhanh': trong ~`MOTION_DURATIONS_MS.standard` vùng phải = `role=status` 'Đang tải bảng trạng thái' (7 khung xương), nút 'Chạy kiểm nhanh' `loading`, bảng kết quả hiện cột 'đang chạy' | SG:99-110 LOADING_LABEL; USG:382-400 | `isCheckRunning` → state 'loading' USG:338 | edge | missing | — | dev | — |
| 10D-B-304 | collapsed | bấm nút 'Thu gọn cây màn' khi đã chọn màn: cây thu thành thanh 40 px, nút 'Mở rộng cây màn', sr-only 'Cây màn đang thu gọn'; vùng phải vẫn hiện khung | SG:83-95,204 | `isCollapsed` → 'collapsed' USG:341 | edge | missing | — | dev | — |
| 10D-B-305 | collapsed-empty | thu gọn khi CHƯA chọn màn: vùng phải vẫn 'Chưa chọn màn nào' (trạng thái ưu tiên 'empty' trước 'collapsed' USG:338-341) | rail + EmptyState | thứ tự nhánh USG | edge | missing | — | dev | — |
| 10D-B-306 | forbidden-prod | `forbidden` (SG:185) và cổng prod (SGC:'Không có quyền truy cập' / 'Trang này chỉ dùng nội bộ trong bản dựng phát triển, không có ở bản dựng thật.') KHÔNG đạt được trên dev server | n/a: cần `isDevelopmentBuild()=false`; đối chứng prod → NotFound do C4 | | edge | n/a | — | n/a: không dựng được trên dev (vitest `StateGallery.test.tsx` phủ) | — |
| 10D-B-307 | error/partial | `error` ('Không đọc được bảng trạng thái' + nút 'thử lại') và `partial` ('Còn màn thiếu trạng thái') cần manifest hỏng/thiếu | n/a: manifest tĩnh đủ 7/7; chỉ story/vitest phủ | | edge | n/a | — | n/a | — |

### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-C-301 | search | gõ 'tài khoản' vào ô 'Tìm màn' (placeholder 'Nhập tên màn cần tìm'): chỉ còn các màn khớp nhãn/name/area, nhóm rỗng biến mất | USG:317-330 lọc `label|name|area` không phân biệt hoa thường | `toLowerCase().includes` | edge | missing | — | dev | — |
| 10D-C-302 | search-area | gõ 'admin' (khớp `area`): ra màn nhóm B | khớp `area` USG:327 | | edge | missing | — | dev | — |
| 10D-C-303 | search-none | gõ chuỗi vô nghĩa 'zzzz': 'Không có màn nào khớp với từ đang tìm', không `<ul>` | SGR:TREE_NO_MATCH (SGR:115) | | edge | missing | — | dev | — |
| 10D-C-304 | search-space | gõ toàn dấu cách: coi như rỗng, hiện đủ cây | `query.trim()` USG:318-320 | | edge | missing | — | dev | — |
| 10D-C-305 | search-keeps-select | màn đang chọn bị lọc mất: vùng phải vẫn giữ màn (hoặc → 'Chưa chọn màn nào' vì `screens.find`) — chốt hành vi ĐÚNG | SG:`screens.find(selectedScreenId)`: màn bị lọc → `selectedScreen===null` → EmptyState (hành vi nguồn) | thứ tự SG:~190 | edge | missing | — | dev | — |
| 10D-C-306 | toggle-dark | công tắc 'Chủ đề tối' bật → `<html class="dark">`; tắt → bỏ; ghi `localStorage` theme | `useTheme` hooks/useTheme.ts:22-30 | | edge | missing | — | dev | — |
| 10D-C-307 | toggle-motion | 'Giảm chuyển động' bật → `<html data-reduced-motion="true">`; tắt → bỏ; rời trang trả lại giá trị cũ | USG:273-290 `REDUCED_MOTION_ATTRIBUTE` | | edge | missing | — | dev | — |
| 10D-C-308 | toggle-grid | 'Lưới đo khoảng cách' bật: dòng 'Lưới đo khoảng cách' + lớp lưới `aria-hidden` trong 7 khung; tắt → mất | SGF:SPACING_GRID_LABEL | | edge | missing | — | dev | — |
| 10D-C-309 | quick-check | 'Chạy kiểm nhanh' (có chọn màn): bảng 'Kết quả bốn phép kiểm theo từng màn', cột 'Bảy trạng thái','Mã màu thô','Chuỗi tiếng Việt','Khả năng tiếp cận'; hàng/màn = số màn manifest; 'Bảy trạng thái' = 'Đạt' mọi hàng; 'Mã màu thô' = 'chờ chạy' + lý do node:fs | SGT:CheckResultTable, STATUS_LABELS 'Đạt'/'chờ chạy'; USG NO_RAW_COLOR_PENDING_DETAIL | `sevenStatesCell` USG:~140 | edge | missing | — | dev | — |
| 10D-C-310 | ⚑quick-check-selected | ⚑ màn ĐANG CHỌN phải có 'Chuỗi tiếng Việt' và 'Khả năng tiếp cận' = 'Đạt' hoặc 'hỏng' thật; màn khác = 'chờ chạy' + 'Chỉ màn đang chọn mới có khung xem trước…' | USG:391 `document.querySelector(PREVIEW_FRAME_SELECTOR)` | THỰC TẾ: lúc timer chạy `isCheckRunning` còn `true` → `state==='loading'` → vùng phải là `LoadingFrames`, `[data-state-gallery-preview]` KHÔNG có trong DOM ⇒ màn đang chọn luôn 'chờ chạy' + 'Chưa tìm thấy khung xem trước đã dựng trong trang…' (USG:81, set `setIsCheckRunning(false)` sau querySelector USG:398) | edge | missing | — | dev | — |
| 10D-C-311 | quick-check-noselect | chạy kiểm nhanh khi chưa chọn màn: mọi hàng 'Chuỗi tiếng Việt'/'Khả năng tiếp cận' = 'chờ chạy' (không chọn màn nào) | PREVIEW_NOT_SELECTED_DETAIL | `screen.id!==selectedScreenId` | edge | missing | — | dev | — |
| 10D-C-312 | quick-check-twice | bấm 'Chạy kiểm nhanh' khi đang chạy: bị bỏ qua (nút loading); chạy lại sau xong: bảng cũ mở lại | USG:382-384 guard `isCheckRunning`; SGT `setIsPanelDismissed(false)` | | edge | missing | — | dev | — |
| 10D-C-313 | panel-empty | `CHECK_EMPTY` 'Chưa chạy phép kiểm nào' chỉ khi `checkRows.length===0` mà panel mở — không đạt được qua UI (mở panel chỉ khi có hàng/đang chạy) | SGT:223 | | edge | n/a | — | n/a: nhánh không tới được qua UI | — |

### D Roles
n/a — dev route không phụ thuộc vai/phiên (ẩn danh mở được).

### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-E-301 | kbd-esc | Esc đóng bảng kết quả kiểm nhanh (lớp trên cùng); sau đó Esc không làm gì; 'Đóng bảng kết quả' đóng được bằng chuột | `useShortcut Escape scope sidePanel enabled:isPanelOpen` · SGT:159; nút aria-label 'Đóng bảng kết quả' SGT | `isPanelOpen` SGT:146 | ui | missing | — | dev | — |
| 10D-E-302 | kbd-esc-closed | Esc khi bảng đã đóng không bắt phím (`enabled:false`) | SGT:159 | | ui | missing | — | dev | — |
| 10D-E-303 | kbd-tree | Tab tới ô 'Tìm màn' rồi các nút màn; Enter/Space chọn; vòng focus nhìn thấy; `aria-current` đúng | SGR:ScreenRow `focus-visible:ring-2` | | ui | missing | — | dev | — |
| 10D-E-304 | kbd-toggles | 3 công tắc `role=switch` có tên 'Chủ đề tối','Giảm chuyển động','Lưới đo khoảng cách' và mô tả; Space bật/tắt | Toggle:86-90; SGT:~85 | | ui | missing | — | dev | — |
| 10D-E-305 | kbd-collapse | nút 'Thu gọn cây màn'/'Mở rộng cây màn' Enter chuyển; focus không mất (nút đổi giữa header và rail ⇒ ⚑ focus có thể rơi về body khi rail thay header) | SG:204 vs SG:83 | | ui | missing | — | dev | — |
| 10D-E-306 | a11y-region | landmark: `section 'Công cụ duyệt'`, `nav 'Cây màn theo nhóm'`, `region 'Khung xem trước bảy trạng thái'`, `<main>` duy nhất; không `<main>` lồng (route dùng `suspendedOutsideMain`, router.tsx:155) | SGT:TOOLBAR_REGION_LABEL, SGR:TREE_NAV_LABEL, SGF:FRAMES_REGION_LABEL | | ui | missing | — | dev | — |

### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-F-301 | layout | trạng thái 'empty' (chưa chọn màn) 4 khổ | cây 280 px + vùng phải; không cuộn ngang | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-302 | layout | trạng thái 'success' (đã chọn, lưới 7 khung) 4 khổ: 1 cột <640 / 2 cột sm / 3 cột xl | không cuộn ngang trang; khung 148 px | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-303 | layout | trạng thái 'collapsed' (rail 40 px) 4 khổ | | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-304 | layout | bảng kết quả kiểm nhanh mở (45–47 hàng, `max-h-[320px]` cuộn trong bảng) 4 khổ | bảng cuộn nội bộ, không đẩy cuộn ngang trang | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-305 | layout | trạng thái 'loading' (7 khung xương) 4 khổ — chụp trong ~150 ms: dùng `page.clock`/làm chậm, hoặc ghi n/a nếu không ổn định | | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-306 | layout | lưới đo bật (lớp lưới đè khung) 4 khổ | khung không đổi kích thước | `verifyUi` | ui | missing | — | dev | — |
| 10D-F-307 | layout | chủ đề tối bật 4 khổ | tương phản chữ/khung đủ | `verifyUi` | ui | missing | — | dev | — |

### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10D-G-301 | api | n/a: "mock client, không BE" (manifest tĩnh `stateGalleryManifest.ts`, không gọi `@/api`) | — | — | api | n/a | — | n/a | — |

### Notes
- ⚑ **10D-C-310** (nghi lỗi quan trọng nhất): `useStateGallery.ts:382-400` — `onRunQuickCheck` đặt `isCheckRunning=true` (→ `state='loading'`, `StateGallery.tsx:99` vẽ `LoadingFrames`, không có `[data-state-gallery-preview]`), rồi trong `setTimeout` `document.querySelector(PREVIEW_FRAME_SELECTOR)` chạy TRƯỚC `setIsCheckRunning(false)` ⇒ `previewFrame===null` ⇒ hai cột 'Chuỗi tiếng Việt' / 'Khả năng tiếp cận' của màn đang chọn luôn 'chờ chạy' ('Chưa tìm thấy khung xem trước đã dựng trong trang…'), không bao giờ 'Đạt'/'hỏng'. Hành vi đúng (theo `SGF` chú thích "chỉ màn ĐANG CHỌN dựng khối này"): màn đang chọn có kết quả thật.
- ⚑ **10D-E-305** (nghi): nút thu gọn nằm trong `<header>`, nút mở rộng nằm trong `CollapsedRail` (`SG:83`, `SG:204`) — header vẫn render cả hai trạng thái (nút ở header đổi nhãn), rail có thêm nút thứ hai; nếu bấm nút rail, focus phải còn ở một nút cùng tên. Kiểm bằng `document.activeElement` sau bấm.
- ⚑ **10D-A-102/105** (đối chiếu): mục 'State Gallery (QA)' của `/demo` là bảng QA cũ (OSG), KHÔNG phải S-47; nếu người dùng/QA kỳ vọng S-47 ở đây thì sai — spec phải khẳng định h1 'State Gallery (QA)' và 'Skeletons (8 Instances)' / 'Empty States (14 Instances)'.
- Số liệu manifest: comment SG/USG nói '47 màn' / 'bốn mươi bảy', `STATE_GALLERY_MANIFEST` dựng từ 45–46 `ScreenDef` (grep `^    id:` = 45) — 10D-A-303 so 'Số màn' với `STATE_GALLERY_MANIFEST.screens.length` đọc thật, không gán cứng 47. Nghi lệch comment so với dữ liệu, chưa xác minh (không chạy được).
- `/demo` + `DemoSharedControls` etc. sâu thuộc C4 (`10E`). `MotionDemo` chỉ tới qua `/demo` → chip 'Motion & Transitions' (không có route riêng).
- Không có bug phase 10 nào đã ghi cho C3 (không đọc `BUG-LOG.md` trong lượt này vì hết hạn).

### Tóm tắt
| màn | rows | n/a | needed | covered | partial | missing | mock | dev |
|---|---|---|---|---|---|---|---|---|
| DEV-1 /demo | 25 | 1 | 24 | 0 | 1 | 23 | 0 | 24 |
| DEV-2 /design-system | 20 | 1 | 19 | 0 | 1 | 18 | 0 | 19 |
| DEV-3 /design-system/states | 49 | 4 | 45 | 0 | 1 | 44 | 0 | 45 |
| **tổng** | 94 | 6 | 88 | 0 | 3 | 85 | 0 | 88 |

# QA-10 · C4 (tiền tố `10E`) — Catalog: dev route nhóm 2 + dev URL trên bản prod + ẩn danh trên dev server

Nguồn: FE `F:/worktrees/AppFront/p10-int` (master 5fcaf502 + helper P0). Chỉ đọc mã. Viết tắt đường dẫn (gốc `src/`):
DE=`screens/DataEntryDemo.tsx` · LR=`screens/ListReviewDemo.tsx` · SD=`screens/ShellDemo.tsx` · CO=`screens/CanvasOverlaysDemo.tsx` · FD=`screens/FeedbackDemo.tsx` ·
RT=`routes/router.tsx` · SB=`routes/SessionBootstrap.tsx` · PA=`routes/paths.ts` · AS=`components/shell/AppShell.tsx` · NF=`hooks/useNumericField.ts` · SEL=`components/ui/Select.tsx` ·
CB=`components/ui/Combobox/ComboboxDropdown.tsx` · ULR=`hooks/useListReview.ts` · TO=`components/feedback/Toast.tsx` · ZC=`components/canvas/ZoomCluster.tsx` · CM=`components/canvas/ContextMenu.tsx`.
Khổ: chỉ 1920/1440/1024/768 (375/mobile = n/a "ngoài phạm vi: mobile"). `DemoSharedControls.tsx` chỉ được `/demo` (App.tsx) dùng → thuộc C3, không liệt kê ở đây.
Test cũ OLD = `qa/tests/phase10_system_routes.spec.ts`: chỉ kiểm landmark + URL không đổi + prod NotFound + bấm thu gọn panel trái ở shell-demo.

## Tóm tắt
| màn | rows | n/a | needed | covered | partial | missing | mock | dev |
|---|---|---|---|---|---|---|---|---|
| SCR-40e-1 `/data-entry-demo` | 34 | 2 | 32 | 1 | 0 | 31 | 0 | 32 |
| SCR-40e-2 `/list-review-demo` | 45 | 2 | 43 | 1 | 0 | 42 | 0 | 43 |
| SCR-40e-3 `/shell-demo` | 33 | 2 | 31 | 2 | 0 | 29 | 0 | 31 |
| SCR-40e-4 `/demo/canvas-overlays` | 33 | 2 | 31 | 1 | 0 | 30 | 0 | 31 |
| SCR-40e-5 `/feedback-demo` | 34 | 2 | 32 | 1 | 0 | 31 | 0 | 32 |
| SCR-40e-6 prod đối chứng + ẩn danh | 18 | 2 | 16 | 12 | 0 | 4 | 0 | 3 (+12 real) |
| **Tổng** | 197 | 12 | 185 | 18 | 0 | 167 | 0 | 172 (+12 real) |

(rows = số dòng có id gồm cả n/a. Số liệu đếm theo bảng dưới; mock = 0 vì mọi trạng thái tạo thật được trên dev server. Khổ 4 viewport nằm trong nhóm F — mỗi dòng F chụp 4 khổ. Quy mô SCR-40e-2/3 vượt ~25 vì màn có 8 trạng thái/nhiều điều khiển; người dùng yêu cầu phủ MỌI điều khiển.)

---
## SCR-40e-1 DataEntryDemo `/data-entry-demo` — files: DE=src/screens/DataEntryDemo.tsx, NF, SEL, CB, `components/ui/{NumericField,Input,FieldRow}.tsx`
Không phiên, mock client. Chữ chính: h1 "Data Entry Components"; ba h2: "NumericField States", "Select & Combobox", "FieldRow Layout (Property Panel)".
### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-A-001 | smoke | Mở `/data-entry-demo`, không phiên | h1 "Data Entry Components" · DE:24; URL giữ nguyên, không về /login | pathOf(url)=route | ui | covered | OLD "dev route … renders without a session" | dev | - |
| 10E-A-002 | happy | NumericField #2 (248,6 m2): gõ "300" → Tab | ô hiện "300", flash ngắn; commit khi blur · NF:handleBlur→commit | formatNumber(300)="300" | edge | missing | - | dev | - |
| 10E-A-003 | happy | #2 focus rồi ArrowUp, Shift+ArrowUp, ArrowDown | 249,6 → 259,6 → 258,6 (bước 1; Shift ×10) · NF:handleKeyDown | 248,6+1; +10; −1 (vi-VN, tối đa 2 số lẻ) | edge | missing | - | dev | - |
| 10E-A-004 | happy | #2 gõ "999" rồi Esc | ô trở lại giá trị commit cuối, không lỗi · NF:Escape | displayText(lastCommitted) | edge | missing | - | dev | - |
| 10E-A-005 | happy | Select (Standard): bấm trigger → chọn "Tường gạch 110" | trigger đổi nhãn "Tường gạch 110", list đóng · SEL, DE:11 | option.label; aria-expanded=false | ui | missing | - | dev | - |
| 10E-A-006 | happy | Select bàn phím: Enter mở → ArrowDown → Enter | chọn option kế tiếp, đóng; Esc khi mở chỉ đóng list · useSelect.ts:50-75 | (highlightedIndex+1) mod 5 | edge | missing | - | dev | - |
| 10E-A-007 | happy | Combobox mở, ô tìm "Tìm kiếm...", gõ "gạch" | danh sách còn "Tường gạch 110","Tường gạch 220" · CB:111, useCombobox.ts:26 | options.filter(fuzzyMatch(label,'gạch'))=2 | edge | missing | - | dev | - |
| 10E-A-008 | happy | Combobox chọn "Vách thạch cao" bằng Enter | trigger hiện "Vách thạch cao"; dropdown đóng | option.label | ui | missing | - | dev | - |
| 10E-A-009 | edge | FieldRow "Mã trục": gõ ký tự vào Input value="A1-B2" (không onChange) | ký tự không ghi được, ô vẫn "A1-B2" · DE:89 | value==="A1-B2" | edge | missing | - | dev | - |
| 10E-A-010 | happy | Tab xuyên trang | ô #5 Disabled và Combobox disabled không nhận focus · DE:47,77 | activeElement ≠ ô disabled | edge | missing | - | dev | - |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-B-001 | state | NumericField #1 Empty | ô rỗng, placeholder "Nhập giá trị...", hậu tố "mm" · DE:31 | value="" | ui | missing | - | dev | - |
| 10E-B-002 | state | #2 Valid/Committed lúc nghỉ | "248,6" + "m2" · DE:35 | formatNumber(248.6,{max 2})="248,6" | ui | missing | - | dev | - |
| 10E-B-003 | state | #3 "Invalid (Min: 50)" lúc nghỉ (value=48) | ⚑ chỉ "48" + "mm", CHƯA có thông báo lỗi dù nhãn ghi "Invalid" (validate chỉ chạy khi gõ/commit) · DE:39, NF:validate | không có thông báo lỗi lúc nghỉ | ui | missing | - | dev | - |
| 10E-B-004 | state | #4 With Hint | "Giá trị thường nằm trong khoảng 8 - 20 mm/px" dưới ô, "21" · DE:43 | hint khớp | ui | missing | - | dev | - |
| 10E-B-005 | state | #5 Disabled | ô disabled, "34" · DE:47 | input.disabled | ui | missing | - | dev | - |
| 10E-B-006 | state | #6 Read-only | "14" không sửa được · DE:51 | readOnly | ui | missing | - | dev | - |
| 10E-B-007 | state | #7 Loading + Select (Loading) | khung skeleton thay ô/trigger (không input, không combobox) · DE:55,73 | 0 input trong khối | ui | missing | - | dev | - |
| 10E-B-008 | state | Combobox (Disabled) value "4" | trigger disabled hiện "Vách gỗ công nghiệp" · DE:77 | option 4 label | ui | missing | - | dev | - |
| 10E-B-009 | state | FieldRow (Property Panel) | nhãn "Diện tích","Mã trục","Loại tường","Khoảng cách"; giá trị "248,6","A1-B2","Tường gạch 220","14"; hint "Giá trị thường nằm trong khoảng 8 - 20 mm" · DE:85-95 | khớp nguyên văn | ui | missing | - | dev | - |
### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-C-001 | edge | #3 gõ "30" (dưới min 50) | lỗi ngay khi gõ: "Giá trị không nhỏ hơn 50 mm." · NF:validate | `Giá trị không nhỏ hơn ${bound(50)}.` | edge | missing | - | dev | - |
| 10E-C-002 | edge | #3 gõ "abc" | "Nhập một số." · NF:validate (G61) | parseNumber undefined ∧ text≠"" | edge | missing | - | dev | - |
| 10E-C-003 | edge | #3 lỗi rồi Tab ra | giá trị gõ giữ nguyên cạnh thông báo lỗi, KHÔNG gọi onChange · NF:commit | err≠null → không onChange | edge | missing | - | dev | - |
| 10E-C-004 | edge | #3 sửa thành "60", blur | lỗi biến mất, hiện "60" · NF:commit | validate(60)=null | edge | missing | - | dev | - |
| 10E-C-005 | edge | #3 ArrowDown từ 48 | ép về min: "50", không lỗi · NF:clamp | max(50,47)=50 | edge | missing | - | dev | - |
| 10E-C-006 | edge | #3 xoá hết chữ | không lỗi (ô trống = xoá giá trị) · NF:validate | text.trim()="" → null | edge | missing | - | dev | - |
| 10E-C-007 | edge | Combobox gõ "zzz" | `Không tìm thấy "zzz"` · CB:206 | filtered=0 | edge | missing | - | dev | - |
### D Roles
| 10E-D-001 | n/a | không phụ thuộc vai | n/a: không phiên, dev server mock | - | - | n/a | - | - | - |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-E-001 | a11y | Trigger Select/Combobox | role=combobox, aria-haspopup=listbox, aria-expanded đổi true/false · SEL | thuộc tính ARIA | ui | missing | - | dev | - |
| 10E-E-002 | a11y | Dropdown Combobox | ô tìm role=combobox aria-autocomplete=list; list role=listbox; dòng role=option, aria-selected đúng dòng chọn · CB:102-172 | thuộc tính ARIA | ui | missing | - | dev | - |
| 10E-E-003 | a11y | Tên truy cập ô NumericField (nhãn h3 không gắn input) | mỗi input có tên không rỗng; nếu rỗng → ⚑ a11y (đọc `Input.tsx` ở S2) · DE:30-55 | accessibleName≠"" | ui | missing | - | dev | - |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-F-001 | resp | Bố cục mặc định (lưới 2 cột, max-w-4xl) | không cuộn ngang, không tràn | scrollWidth≤clientWidth | ui | missing | - | dev | - |
| 10E-F-002 | resp | Lỗi #3 hiện | thông báo lỗi trong cột, không bị cắt | boundingBox trong viewport | ui | missing | - | dev | - |
| 10E-F-003 | resp | Dropdown Select/Combobox mở (portal) | list trong viewport | boundingBox trong viewport | ui | missing | - | dev | - |
### G API/BE
| 10E-G-001 | n/a | API | n/a: mock client, không BE | - | - | n/a | - | - | - |

---
## SCR-40e-2 ListReviewDemo `/list-review-demo` — files: LR=src/screens/ListReviewDemo.tsx, ULR, `components/ui/{Table,TreeItem,Badge,ConfidenceMeter}.tsx`, TO
48 hàng giả W-001..W-048, dày 220, tin cậy 0,62 khi i%5==0 còn lại 0,85+(i%10)/100, "Tầng 01", "Chưa duyệt".
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-A-011 | smoke | Mở `/list-review-demo` | ⚑ chữ "States:" hiện · LR:64 (xem Notes N-1: `useToast` không có `Toast.Provider`) | getByText('States:') visible, URL giữ nguyên | ui | covered | OLD (chưa chắc xanh) | dev | - |
| 10E-A-012 | happy | 8 nút trạng thái | "default","empty","loading","partial","error","success","permission","collapsed"; nút chọn variant primary · LR:36,65-75 | 8 button theo tên | ui | missing | - | dev | - |
| 10E-A-013 | happy | Bấm một hàng | hàng có viền tiêu điểm (ring-2); focusedId=hàng · LR:190, ULR | class ring-2 | ui | missing | - | dev | - |
| 10E-A-014 | happy | Hàng focus: ArrowDown/ArrowUp, biên đầu/cuối | di chuyển 1 hàng; W-001 ArrowUp đứng yên; W-048 ArrowDown đứng yên · ULR:handleKeyDown | clamp [0,47] | edge | missing | - | dev | - |
| 10E-A-015 | happy | Space chọn hàng focus; Shift+Space chọn dải từ hàng chọn gần nhất | "Đã chọn 1 cấu kiện" rồi "Đã chọn N cấu kiện" · ULR:handleSelect, LR:230 | W-002 rồi Shift+Space ở W-005 → 4 | edge | missing | - | dev | - |
| 10E-A-016 | happy | Tick hộp kiểm một hàng | "Đã chọn 1 cấu kiện" xuất hiện; thanh "x/48 tường đã duyệt" biến mất · LR:229-246 | selectedIds=1 | ui | missing | - | dev | - |
| 10E-A-017 | happy | Shift+click hộp kiểm hàng 5 sau khi chọn hàng 2 | chọn dải 2..5 (4 hàng) · LR:199 `nativeEvent.shiftKey` | N=4 | edge | missing | - | dev | - |
| 10E-A-018 | happy | Hộp kiểm tiêu đề bấm 2 lần | "Đã chọn 48 cấu kiện" rồi bỏ chọn hết · LR:136, ULR:handleSelectAll | 48 → 0 | ui | missing | - | dev | - |
| 10E-A-019 | happy | Chọn 2 hàng → "Duyệt danh sách" | 2 hàng đổi badge "Đã duyệt", flash rồi tự bỏ chọn; thanh dưới "2/48 tường đã duyệt" · LR:234, ULR:batchApprove (`durationMs('slow')`) | verifiedCount=2 | ui | missing | - | dev | - |
| 10E-A-020 | happy | Chọn 3 hàng → "Xoá" | 45 hàng còn; toast "Đã xoá 3 cấu kiện" có "Hoàn tác" · LR:237, ULR:handleDeleteSelected | rows=45 | ui | missing | - | dev | - |
| 10E-A-021 | happy | Bấm "Hoàn tác" của toast | 48 hàng trở lại · ULR:undoBackup | rows=48 | ui | missing | - | dev | - |
| 10E-A-022 | happy | Sắp xếp cột "Mã cấu kiện" bấm 3 lần | asc → desc → không sắp; aria-sort ascending → descending → none · ULR:handleSort | hàng đầu W-001 / W-048 / W-001 | edge | missing | - | dev | - |
| 10E-A-023 | happy | Sắp xếp "Độ tin cậy" asc | nhóm 0,62 (10 hàng) lên đầu, hàng đầu W-001 · ULR:sortedData | first=W-001 | edge | missing | - | dev | - |
| 10E-A-024 | happy | TreeItem "Tầng 01" bấm nút mắt | aria-label "Ẩn layer" → "Hiện layer" · TreeItem:136 | nhãn đổi | ui | missing | - | dev | - |
| 10E-A-025 | happy | State "error" → "Thử lại" | về default (48 hàng) · LR:106 | demoState=default | ui | missing | - | dev | - |
| 10E-A-026 | edge | "Thử lại" ở partial (ghost, không onClick) và "Thêm mới" ở empty (onClick rỗng) | không đổi gì, không lỗi console · LR:171,121 | DOM không đổi | edge | missing | - | dev | - |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-B-010 | state | default | 48 hàng; cột "Mã cấu kiện","Chiều dày","Độ tin cậy","Tầng","Trạng thái" + hộp kiểm; W-001: "220 mm", meter "0,62", "Tầng 01", "Chưa duyệt" · LR:19-34,150-215 | formatLength(220,{unit:'mm'}) | ui | missing | - | dev | - |
| 10E-B-011 | state | Hàng cần kiểm tra (tin cậy<0,7) | đúng 10 hàng tô attention (W-001,006,…,046) · LR:177 | count=10 | ui | missing | - | dev | - |
| 10E-B-012 | state | Thanh dưới khi chưa chọn | "0/48 tường đã duyệt" · LR:246 | verifiedCount/rawCount | ui | missing | - | dev | - |
| 10E-B-013 | state | empty | lớp phủ: "Chưa có dữ liệu" / "Hãy thử thay đổi bộ lọc hoặc thêm dự án mới." / nút "Thêm mới" · LR:120-122 | khớp nguyên văn | ui | missing | - | dev | - |
| 10E-B-014 | state | loading | 8 hàng skeleton, không có hàng W-xxx · LR:renderSkeletons | rows W-*=0 | ui | missing | - | dev | - |
| 10E-B-015 | state | partial | dải vàng "Có lỗi khi tải trang 2. Một số dữ liệu có thể bị thiếu." + "Thử lại"; hàng vẫn hiện · LR:170 | khớp; 48 hàng | ui | missing | - | dev | - |
| 10E-B-016 | state | error | lớp phủ "Đã có lỗi xảy ra khi tải dữ liệu" + "Thử lại" · LR:105 | khớp | ui | missing | - | dev | - |
| 10E-B-017 | state | success | lớp phủ "Duyệt dữ liệu thành công!" · LR:129 | khớp | ui | missing | - | dev | - |
| 10E-B-018 | state | permission | lớp phủ "Bạn không có quyền xem dữ liệu này" · LR:112 | khớp | ui | missing | - | dev | - |
| 10E-B-019 | state | collapsed | chỉ còn hộp kiểm + "Mã cấu kiện" (2 cột) · LR:146 | 2 cột | ui | missing | - | dev | - |
| 10E-B-020 | state | Chọn ≥1 hàng | thanh nổi "Đã chọn N cấu kiện" + "Duyệt danh sách" + "Xoá" thay thanh "x/48" · LR:228-246 | loại trừ nhau | ui | missing | - | dev | - |
| 10E-B-021 | edge | ⚑ default → empty/error/permission rồi xem dữ liệu dưới lớp phủ | dữ liệu dưới không đổi (useListReview khởi tạo 1 lần): "0/48 tường đã duyệt" vẫn 48 · LR:45-46 | rawCount=48 sau chuyển empty | edge | missing | - | dev | - |
### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-C-008 | edge | Meter W-001 | role=meter, aria-valuenow=62, aria-label "Độ tin cậy AI: 0,62" · ConfidenceMeter:36-40 | round(0.62×100) | ui | missing | - | dev | - |
| 10E-C-009 | edge | Sắp xếp "Chiều dày" (toàn 220) | thứ tự không đổi (ổn định) · ULR | W-001 vẫn đầu | edge | missing | - | dev | - |
| 10E-C-010 | edge | Duyệt danh sách: sau cửa sổ flash | selection tự xoá, flash tắt · ULR:setTimeout(durationMs('slow')) | selectedIds=0 | edge | missing | - | dev | - |
| 10E-C-011 | edge | Bàn phím khi CHƯA có hàng focus | ArrowDown/Space không làm gì · ULR:`if (!focusedId) return` | không đổi | edge | missing | - | dev | - |
| 10E-C-012 | edge | Shift+Space khi chưa có hàng chọn trước | chỉ chọn 1 hàng · ULR:handleSelect | N=1 | edge | missing | - | dev | - |
| 10E-C-013 | edge | Xoá rồi Hoàn tác hai lần | lần 2 không khôi phục thêm (backup null) · ULR:undoBackup | rows=48 | edge | missing | - | dev | - |
### D Roles
| 10E-D-002 | n/a | không phụ thuộc vai | n/a | - | - | n/a | - | - | - |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-E-004 | a11y | Hộp kiểm tiêu đề và hàng | ⚑ tên truy cập: `<input type=checkbox>` trần, không aria-label (Table.tsx:307-333 có bản đúng "Chọn tất cả"/"Chọn dòng …" nhưng không dùng) · LR:136,197 | accessibleName≠"" (dự kiến fail) | ui | missing | - | dev | - |
| 10E-E-005 | a11y | Cột sắp xếp | aria-sort none/ascending/descending · Table.tsx:172 | thuộc tính | ui | missing | - | dev | - |
| 10E-E-006 | a11y | Vùng bảng tabIndex=0 nhận Tab | thứ tự Tab: nút state → TreeItem → vùng bảng · LR:101 | activeElement theo thứ tự | edge | missing | - | dev | - |
| 10E-E-007 | a11y | TreeItem | role=treeitem; "Kiến trúc" aria-expanded=true; Enter/Space kích hoạt · TreeItem:54-66 | thuộc tính | ui | missing | - | dev | - |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-F-004 | resp | default | không cuộn ngang trang; thanh trái w-64 + bảng không đè | không tràn | ui | missing | - | dev | - |
| 10E-F-005 | resp | collapsed | 2 cột, không cắt chữ | - | ui | missing | - | dev | - |
| 10E-F-006 | resp | Thanh "Đã chọn N cấu kiện" | trong khung, không che nút | boundingBox trong viewport | ui | missing | - | dev | - |
| 10E-F-007 | resp | empty/error/permission/success (lớp phủ) | căn giữa, không tràn | - | ui | missing | - | dev | - |
| 10E-F-008 | resp | loading + partial | 8 skeleton; dải vàng không cắt chữ | - | ui | missing | - | dev | - |
### G API/BE
| 10E-G-002 | n/a | API | n/a: mock client, không BE | - | - | n/a | - | - | - |

---
## SCR-40e-3 ShellDemo `/shell-demo` — files: SD=src/screens/ShellDemo.tsx, AS=components/shell/AppShell.tsx, `components/shell/{Panel,Breadcrumb,StatusBar,ShortcutHelp}.tsx`, `hooks/{useAppShell,useKeyboardMap}.ts`, `components/overlay/CommandPalette.tsx`
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-A-027 | smoke | Mở `/shell-demo` | h2 "Canvas Area" + "Cmd+K to search. [ and ] to toggle panels. Use the dev switch at the bottom right." · SD:55-58 | heading visible, URL giữ nguyên | ui | covered | OLD | dev | - |
| 10E-A-028 | happy | Nút "Thu gọn panel trái ([)" | panel trái ẩn; nhãn đổi "Mở panel trái ([)"; localStorage `appshell:left-collapsed`="true" · AS:209, useAppShell.ts | label flip | ui | covered | OLD (1440) | dev | - |
| 10E-A-029 | happy | Nút "Thu gọn panel phải (])" (chỉ ≥1280) | panel phải ẩn; nhãn "Mở panel phải (])"; `appshell:right-collapsed`="true" · AS:219 | label flip | ui | missing | - | dev | - |
| 10E-A-030 | happy | Phím `[` và `]` | `[` bật/tắt panel trái, `]` panel phải (≥1280); trên hẹp mở Drawer · useKeyboardMap shell.panel.* | trạng thái đổi 2 lần | edge | missing | - | dev | - |
| 10E-A-031 | happy | Nút công cụ "Chọn (V)","Tường (W)","Kích thước (M)","Cửa / lỗ mở (D)" bấm từng nút | công cụ hoạt động đổi (trạng thái nút), con trỏ canvas đổi theo `cursorCssFor` · AS:78 | nút đang chọn = tool vừa bấm | ui | missing | - | dev | - |
| 10E-A-032 | happy | Phím V/W/M/D (scope canvas) | đổi công cụ tương ứng · useKeyboardMap | activeTool theo phím | edge | missing | - | dev | - |
| 10E-A-033 | happy | Nút "Phím tắt (?)" và phím `?` | mở hộp thoại phím tắt; ⚑ có thể mở CẢ `GlobalShortcutHelp` (UndoShortcuts bọc Outlet, RT:~337) lẫn `ShortcutHelp` của AppShell: đếm `role=dialog` · AS:228 | đúng 1 dialog | edge | missing | - | dev | - |
| 10E-A-034 | happy | Nội dung hộp phím tắt (ShortcutHelp) | "Công cụ": V Chọn đối tượng · W Vẽ tường · M Thêm kích thước · D Cửa / lỗ mở; "Chế độ xem": 2 Chuyển sang 2D · 3 Chuyển sang 3D · [ Thu nhỏ · ] Phóng to; "Hệ thống": ⌘K Mở bảng tìm kiếm lệnh · ⌘Z Hoàn tác thay đổi · ? Hiện bảng phím tắt này · Esc Đóng lớp hiện tại · ShortcutHelp.tsx:29-54 | khớp nguyên văn | ui | missing | - | dev | - |
| 10E-A-035 | happy | Đóng hộp bằng Esc và nút "Đóng bảng phím tắt" | đóng; focus trả về phần tử mở · ShortcutHelp.tsx:76,145 | dialog=0; activeElement=nút "Phím tắt (?)" | edge | missing | - | dev | - |
| 10E-A-036 | happy | Ctrl/Cmd+K mở CommandPalette | ô tìm "Tìm lệnh, dự án, tầng, lớp..."; nhóm "Điều hướng" (Đi đến lớp tường · Đi đến lớp kích thước · Chuyển sang chế độ 2D · Chuyển sang chế độ 3D), "Hành động" (Hoàn tác · Xuất bản bản vẽ · Tạo tầng mới), "Hệ thống" (Xem phím tắt · Chuyển giao diện sáng/tối) · CommandPalette:25-35,173 | khớp nguyên văn | ui | missing | - | dev | - |
| 10E-A-037 | happy | CommandPalette: gõ "zzz"; Esc | `Không tìm thấy "zzz"`; Esc đóng · CommandPalette:193 | empty text | edge | missing | - | dev | - |
| 10E-A-038 | happy | Breadcrumb "Dự án mẫu" > "Tầng 01" (chọn nhanh) > "Lớp tường" | nav "Đường dẫn trang"; nút "Chọn nhanh — đang ở Tầng 01" mở listbox "Chọn tầng" 5 mục: Tầng hầm, Tầng 01 (✓), Tầng 02, Tầng 03, Tầng mái; "Lớp tường" aria-current=page · Breadcrumb:21,72,89, AS:128-139 | 5 option; Esc đóng | ui | missing | - | dev | - |
| 10E-A-039 | happy | Chọn "Tầng 02" trong dropdown | dropdown đóng; breadcrumb không đổi (onClick rỗng) · AS:132 | listbox ẩn | edge | missing | - | dev | - |
| 10E-A-040 | happy | Nội dung panel | trái: "Architecture", "v2", "Levels" (Level 01/02/03), "Layers" (Layer 1..Layer 20, cuộn); phải: "Properties", "Dimensions", Length "2400 mm", Height "3200 mm" · SD:7-37 | khớp nguyên văn, 20 layer | ui | missing | - | dev | - |
| 10E-A-041 | happy | Thanh trạng thái | "X: 124,50", "Y: 89,12", "1:100 · 12 mm/px", "Đã lưu lúc 14:32" · StatusBar:37-55 | formatCoord(124.5)="124,50" | ui | missing | - | dev | - |
| 10E-A-042 | happy | Liên kết bỏ qua: Tab đầu tiên | hiện "bỏ qua tới nội dung chính"; Enter đưa focus tới vùng bản vẽ (#main-content) · focusOrder.ts:85-89 | activeElement=main | edge | missing | - | dev | - |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-B-022 | state | Hai panel mở (≥1280) | trái 280px, phải 344px, canvas min 640px | width panels | ui | missing | - | dev | - |
| 10E-B-023 | state | Trái thu gọn | panel trái aria-hidden=true, canvas giãn | aria-hidden | ui | missing | - | dev | - |
| 10E-B-024 | state | Phải thu gọn | tương tự | aria-hidden | ui | missing | - | dev | - |
| 10E-B-025 | state | 1024 (<1280): panel phải thành overlay; không có nút thu gọn phải | `]` mở Drawer "Properties" · AS:rightAsOverlay | không có nút "…panel phải (])" | ui | missing | - | dev | - |
| 10E-B-026 | state | 768 (<1024): panel trái thành Drawer; không có nút thu gọn trái | `[` mở Drawer "Architecture" · AS:leftAsDrawer | không có nút "…panel trái ([)" | ui | missing | - | dev | - |
### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-C-014 | edge | Trạng thái thu gọn giữ qua tải lại | sau reload nhãn vẫn "Mở panel trái ([)"; spec phải khôi phục để không rò rỉ · useAppShell.ts | label sau reload | edge | missing | - | dev | - |
| 10E-C-015 | edge | `[`/`]` khi hộp thoại mở | không đổi panel khi dialog có focus | không đổi | edge | missing | - | dev | - |
### D Roles
| 10E-D-003 | n/a | không phụ thuộc vai | n/a | - | - | n/a | - | - | - |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-E-008 | a11y | Landmark | header "thanh trên cùng", toolbar "thanh công cụ" (vertical), main "vùng bản vẽ", aside "bảng bên phải", footer "thanh trạng thái"; StatusBar "Thanh trạng thái" · AS:191-297, focusOrder.ts:54-79 | getByRole theo tên | ui | missing | - | dev | - |
| 10E-E-009 | a11y | Hộp phím tắt / CommandPalette | role=dialog + aria-labelledby; Tab bẫy trong hộp; đóng trả focus · ShortcutHelp:127, CommandPalette:154 | focus trap | edge | missing | - | dev | - |
| 10E-E-010 | a11y | Nút toolbar | aria-label `${label} (${shortcut})` · AS:78 | 4 tên | ui | missing | - | dev | - |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-F-009 | resp | Hai panel mở, 1920/1440 | rail 56px, status bar 32px, không cuộn ngang | không tràn | ui | missing | - | dev | - |
| 10E-F-010 | resp | Thu gọn trái / phải (≥1280) | canvas giãn, không nhảy bố cục | - | ui | missing | - | dev | - |
| 10E-F-011 | resp | 1024: overlay phải mở | Drawer 400px không che header, đóng được | - | ui | missing | - | dev | - |
| 10E-F-012 | resp | 768: Drawer trái mở; canvas min-w 640 + rail không tràn | không cuộn ngang | scrollWidth | ui | missing | - | dev | - |
| 10E-F-013 | resp | Hộp phím tắt + CommandPalette mở | trong viewport, cuộn được | - | ui | missing | - | dev | - |
### G API/BE
| 10E-G-003 | n/a | API | n/a: mock client, không BE | - | - | n/a | - | - | - |

---
## SCR-40e-4 CanvasOverlaysDemo `/demo/canvas-overlays` — files: CO=src/screens/CanvasOverlaysDemo.tsx, `components/canvas/{ZoomCluster,MiniMap,MeasurementLabel,WallThicknessLegend,SelectionHalo,TransformGizmo,ContextMenu}.tsx`, `hooks/{useMeasurementLabel,useSelectionHalo,useZoomCluster,useContextMenu}.ts`
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-A-043 | smoke | Mở `/demo/canvas-overlays` | h1 "Canvas Overlays Demo" · CO:87 | heading, URL giữ nguyên | ui | covered | OLD | dev | - |
| 10E-A-044 | happy | Nút "Chế độ 3D" | đổi thành "Chế độ 2D"; nền --canvas-3d, hiện mặt đất + TransformGizmo; bấm lại về 2D · CO:90,122 | nhãn đổi; gizmo hiện/ẩn | ui | missing | - | dev | - |
| 10E-A-045 | happy | Nút "Bật/tắt Selection Halo" | halo 200×150 tại (200,200) hiện, bấm lại ẩn · CO:93, useSelectionHalo | visible rồi hidden | ui | missing | - | dev | - |
| 10E-A-046 | happy | Click 1, di chuột, click 2 trên canvas | click 1 bắt đầu đo (đường theo chuột), click 2 chốt: nhãn `formatLength(round(dist_px*12),{unit:'mm'})` · CO:handlePointer*, useMeasurementLabel | round(√(dx²+dy²)×12) | edge | missing | - | dev | - |
| 10E-A-047 | happy | Click 3 sau khi đã chốt | xoá phép đo cũ, bắt đầu đo mới · CO:49 | state measuring, start mới | edge | missing | - | dev | - |
| 10E-A-048 | happy | Chuột phải trên canvas | menu "Tuỳ chọn" 3 mục: "Chỉnh sửa thuộc tính" ⌘E · "Cô lập" I · "Xoá phần tử" ⌫ (huỷ diệt); không hiện menu mặc định trình duyệt · CO:77-81 | 3 menuitem | ui | missing | - | dev | - |
| 10E-A-049 | happy | Menu: ArrowDown/Up/Home/End, Esc, chọn mục | focus mục đầu khi mở; di chuyển vòng; Esc đóng trả focus; chọn mục đóng menu · CM:86-132 | focus theo thứ tự | edge | missing | - | dev | - |
| 10E-A-050 | happy | ZoomCluster: "Phóng to" ×3, "Thu nhỏ", nút phần trăm, "Vừa khung nhìn" | 100→110→120→130→120%; bấm % về 100%; "Vừa khung nhìn" → 85% · ZC, useZoomCluster:3-27 | "Mức thu phóng N%, bấm để về 100%" | ui | missing | - | dev | - |
| 10E-A-051 | happy | MiniMap "Bản đồ thu nhỏ": bấm vùng "Bấm để di chuyển vùng nhìn" | khung viewport dịch theo điểm bấm (left/top %) · MiniMap:89-93 | style left/top đổi | ui | missing | - | dev | - |
| 10E-A-052 | happy | Chú giải độ dày tường: bấm "Lọc theo 110 mm" | aria-pressed=true, nhãn "Đang lọc 110 mm", mục khác mờ, hiện nút "Xoá lọc"; bấm bỏ lọc · Legend:131-171 | aria-pressed đổi | ui | missing | - | dev | - |
| 10E-A-053 | edge | ⚑ Bấm nút trên ZoomCluster/Legend (nằm trong canvas có onPointerDown) | KHÔNG được bắt đầu phép đo; ZoomCluster/Legend không stopPropagation → có thể sinh nhãn đo · CO:105 | không có MeasurementLabel sau khi bấm "Phóng to" | edge | missing | - | dev | - |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-B-027 | state | Nghỉ (idle) 2D | không nhãn đo; legend "success"; ZoomCluster 100%; MiniMap | không MeasurementLabel | ui | missing | - | dev | - |
| 10E-B-028 | state | Đang đo | đường từ điểm 1 đến chuột + nhãn khoảng cách | label hiện | ui | missing | - | dev | - |
| 10E-B-029 | state | Đã chốt | nhãn tại vị trí committed, đường nối từ điểm giữa tới nhãn · MeasurementLabel:40-105 | label + đường nối | ui | missing | - | dev | - |
| 10E-B-030 | state | 3D bật | mặt đất + horizon + gizmo | gizmo visible | ui | missing | - | dev | - |
| 10E-B-031 | state | Halo hiện | khung halo 200×150 | halo visible | ui | missing | - | dev | - |
| 10E-B-032 | state | Menu ngữ cảnh mở | 3 mục, mục đầu có focus | menu visible | ui | missing | - | dev | - |
| 10E-B-033 | state | Bộ lọc legend đang bật | mục đang lọc nổi bật, "Xoá" hiện | aria-pressed | ui | missing | - | dev | - |
### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-C-016 | edge | Chuột phải (button 2) không bắt đầu đo | state vẫn idle · CO:46 | không MeasurementLabel | edge | missing | - | dev | - |
| 10E-C-017 | edge | Click 2 lần cùng một điểm | khoảng cách 0 → nhãn "—" · useMeasurementLabel | "—" | edge | missing | - | dev | - |
| 10E-C-018 | edge | Zoom ép [10,400] | sau 40 lần "Thu nhỏ" = 10%; sau 40 lần "Phóng to" = 400% · useZoomCluster:3-5,22 | 10% / 400% | edge | missing | - | dev | - |
| 10E-C-019 | edge | Halo bật/tắt nhanh 2 lần | không kẹt; hasEntered theo durationMs('instant') | visible cuối đúng | edge | missing | - | dev | - |
| 10E-C-020 | edge | Đổi 2D↔3D giữa chừng phép đo | phép đo giữ nguyên (state ở parent) | label không mất | edge | missing | - | dev | - |
### D Roles
| 10E-D-004 | n/a | không phụ thuộc vai | n/a | - | - | n/a | - | - | - |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-E-011 | a11y | ZoomCluster | nhóm "Cụm thu phóng"; "Thu nhỏ" (title "Thu nhỏ (−)"), "Phóng to" ("Phóng to (+)"), "Vừa khung nhìn" ("Vừa khung (F)"), % ("Bấm để về 100%") · ZC:74-125 | getByRole theo tên | ui | missing | - | dev | - |
| 10E-E-012 | a11y | Menu ngữ cảnh | role=menu aria-label "Tuỳ chọn"; item role=menuitem; separator · CM:141,189,224 | thuộc tính | ui | missing | - | dev | - |
| 10E-E-013 | a11y | Legend | nhóm "Lọc theo độ dày tường"; nút có aria-pressed, nhãn "Đang lọc …"/"Lọc theo …" · Legend:132-171 | thuộc tính | ui | missing | - | dev | - |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-F-014 | resp | 2D nghỉ | canvas lấp đầy, overlay không chồng nhau | không chồng | ui | missing | - | dev | - |
| 10E-F-015 | resp | 3D + halo | gizmo/halo trong canvas | - | ui | missing | - | dev | - |
| 10E-F-016 | resp | Phép đo đã chốt | nhãn không tràn ngoài canvas | - | ui | missing | - | dev | - |
| 10E-F-017 | resp | Menu ngữ cảnh mở gần mép phải/dưới | menu nằm trong viewport (dịch vào) | boundingBox trong viewport | ui | missing | - | dev | - |
| 10E-F-018 | resp | Bộ lọc legend bật | không cắt chữ | - | ui | missing | - | dev | - |
### G API/BE
| 10E-G-004 | n/a | API | n/a: mock client, không BE | - | - | n/a | - | - | - |

---
## SCR-40e-5 FeedbackDemo `/feedback-demo` — files: FD=src/screens/FeedbackDemo.tsx, TO, `components/feedback/{EmptyState,InlineAlert,PipelineStepper,ProgressOverlay,Skeleton}.tsx`, `lib/mutations/undoTicket.ts`
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-A-054 | smoke | Mở `/feedback-demo` | nút "Test Undo Toast" hiện; mặc định trạng thái Empty · FD:59 | button visible, URL giữ nguyên | ui | covered | OLD | dev | - |
| 10E-A-055 | happy | 7 nút trạng thái | "Empty","Loading","Partial","Error","Success","Unprivileged","Collapsed" (chữ đầu hoa); nút chọn nền accent · FD:43-55 | 7 button | ui | missing | - | dev | - |
| 10E-A-056 | happy | "Test Undo Toast" | toast "Đã xoá 1 đối tượng." + nút "Hoàn tác" · FD:59 | khớp | ui | missing | - | dev | - |
| 10E-A-057 | happy | Bấm "Hoàn tác" | toast rời đi; toast mới "Đã hoàn tác thao tác." · FD:20, TO:122 | khớp | ui | missing | - | dev | - |
| 10E-A-058 | happy | "Test Warning Toast" | toast "Mạng chập chờn, đang thử lại." · FD:60 | khớp | ui | missing | - | dev | - |
| 10E-A-059 | happy | "Test Error Toast" | toast "Không thể kết nối đến máy chủ AI." · FD:61 | khớp | ui | missing | - | dev | - |
| 10E-A-060 | happy | Toast tự đóng sau cửa sổ hoàn tác | hết hiệu lực sau UNDO_WINDOW_MS=8000 ms (chờ tới khi toast biến mất, timeout 12 s; không chờ cố định) · TO:68-111, undoTicket.ts:18 | toast detached | edge | missing | - | dev | - |
| 10E-A-061 | happy | Di chuột/focus vào toast | thanh đếm ngược dừng (giữ cửa sổ) · TO:79 | progress không giảm khi hover | edge | missing | - | dev | - |
| 10E-A-062 | happy | Bấm 4 toast liên tiếp (>3 trong hàng đợi) | 2 toast đầu + toast tóm tắt "Đã thực hiện 2 thay đổi" · TO:~270-300 | queue>3 → slots 0,1 + summary(slice(2).length=2) | edge | missing | - | dev | - |
| 10E-A-063 | happy | Bấm "Hoàn tác" trên toast tóm tắt | hoàn tác mục đầu nhóm (handleSummaryUndo) · TO:289 | nhóm giảm 1 | edge | missing | - | dev | - |
| 10E-A-064 | edge | Nút hành động ("Tải lên bản vẽ","Thêm thước đo","Tải ảnh khác","Yêu cầu quyền sửa") | onClick rỗng: bấm không đổi gì, không lỗi console · FD:70,95,107,130 | DOM không đổi | edge | missing | - | dev | - |
| 10E-A-065 | edge | Khung "Bảng điều khiển" (collapsed) bấm | không đổi (cursor-pointer nhưng không handler) · FD:136 | DOM không đổi | edge | missing | - | dev | - |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-B-034 | state | Empty | "Chưa có tầng nào" / "Tải lên một bản vẽ mặt bằng (.png, .jpg, .pdf, .dwg) để bắt đầu." / nút "Tải lên bản vẽ" · FD:68-70 | khớp | ui | missing | - | dev | - |
| 10E-B-035 | state | Loading | ProgressOverlay 45% + PipelineStepper 6 bước (done×2, running, queued×3), "Còn khoảng 2 phút" (bước 3, eta 120 s), progressbar aria-valuenow 65 + Skeleton canvas/property-panel · FD:23-30,75-86, PipelineStepper:63-67 | formatETA(120) | ui | missing | - | dev | - |
| 10E-B-036 | state | Tên bước stepper | "Tiền xử lý ảnh","Nhận diện tường (SegFormer)","Nhận diện cửa và nội thất (YOLOv8)","Đọc kích thước (PaddleOCR)","Chuẩn hoá độ dày tường","Dựng Spatial JSON"; mỗi dòng aria-label "<tên> — <status>" · PipelineStepper:81 | 6 listitem | ui | missing | - | dev | - |
| 10E-B-037 | state | Partial | role=alert "Thiếu kích thước tổng" / "Hệ thống chỉ nhận được một phần kích thước. Bạn nên dùng thước để xác nhận chiều dài tường." + "Thêm thước đo" + khung "Content" · FD:93-96 | khớp | ui | missing | - | dev | - |
| 10E-B-038 | state | Error | "Lỗi phân tích bản vẽ" / "Chất lượng ảnh quá thấp hoặc độ phân giải không đủ để nhận diện tường. Vui lòng tải lên ảnh sắc nét hơn." + "Tải ảnh khác"; stepper: bước 2 failed, mã "SEG-2041", "Lỗi OOM"; không nút "Thử lại" (không onRetry) · FD:105-109,34-38 | khớp | ui | missing | - | dev | - |
| 10E-B-039 | state | Success | "Đã xử lý xong" / "Mô hình 3D đã sẵn sàng." + khung "Content" · FD:117-119 | khớp | ui | missing | - | dev | - |
| 10E-B-040 | state | Unprivileged | "Quyền truy cập hạn chế" / "Bạn chỉ có quyền xem dự án này. Các thay đổi sẽ không được lưu." + "Yêu cầu quyền sửa" · FD:128-131 | khớp | ui | missing | - | dev | - |
| 10E-B-041 | state | Collapsed | thẻ "Bảng điều khiển" + mũi tên · FD:136 | khớp | ui | missing | - | dev | - |
### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-C-021 | edge | Chuyển trạng thái liên tục (7 nút theo vòng) | mỗi lần chỉ một khối nội dung | đúng 1 khối | edge | missing | - | dev | - |
| 10E-C-022 | edge | Toast còn lại khi đổi trạng thái | toast không mất khi đổi trạng thái (provider ở ngoài) | toast còn | edge | missing | - | dev | - |
| 10E-C-023 | edge | Hoàn tác toast hai lần liên tiếp | mỗi toast chỉ hoàn tác một lần; toast rời ngay · TO:122-128 | không nhân đôi | edge | missing | - | dev | - |
### D Roles
| 10E-D-005 | n/a | không phụ thuộc vai | n/a | - | - | n/a | - | - | - |
### E A11y/keyboard
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-E-014 | a11y | Vùng toast | role=region aria-label "Thông báo", aria-live polite; mỗi toast role=status aria-atomic · TO:144,215,223 | thuộc tính | ui | missing | - | dev | - |
| 10E-E-015 | a11y | InlineAlert | role=alert · InlineAlert:44 | thuộc tính | ui | missing | - | dev | - |
| 10E-E-016 | a11y | 7 nút trạng thái + 3 nút toast bằng bàn phím | Tab/Enter dùng được, có vệt focus (ring-2) · FD:46 | focus visible | edge | missing | - | dev | - |
| 10E-E-017 | a11y | ProgressOverlay (trạng thái Loading) | role=dialog aria-modal aria-label=title; kiểm có che nút trạng thái/chiếm focus · ProgressOverlay:25-27 | thuộc tính | ui | missing | - | dev | - |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-F-019 | resp | Empty | căn giữa, không tràn | - | ui | missing | - | dev | - |
| 10E-F-020 | resp | Loading | overlay + stepper + 2 skeleton không chồng/tràn | không chồng | ui | missing | - | dev | - |
| 10E-F-021 | resp | Partial / Error (+stepper lỗi) | chữ dài không cắt | - | ui | missing | - | dev | - |
| 10E-F-022 | resp | 3 toast chồng | toast neo góc, không che nút toast | - | ui | missing | - | dev | - |
| 10E-F-023 | resp | Success / Unprivileged / Collapsed | - | - | ui | missing | - | dev | - |
### G API/BE
| 10E-G-005 | n/a | API | n/a: mock client, không BE | - | - | n/a | - | - | - |

---
## SCR-40e-6 Đối chứng bản prod (stack thật) + ẩn danh trên dev server — files: PA:221-230, RT:96-130 (`DEV_ONLY_ROUTES` chỉ khi `import.meta.env.DEV`), RT:155, SB:332 (`matchesPublicRoute`)
### A User flows
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-A-066 | happy | Prod, admin đăng nhập: `/demo` | h2 "Không tìm thấy trang này", URL vẫn `/demo` · RT:130 | notFoundHeading visible, pathOf=/demo | ui | covered | OLD "dev URLs fall through to NotFound" | real | admin (signInAdmin) |
| 10E-A-067 | happy | Prod: `/design-system` | NotFound, URL giữ nguyên | như trên | ui | covered | OLD | real | admin |
| 10E-A-068 | happy | Prod: `/design-system/states` | NotFound, URL giữ nguyên (RT:155) | như trên | ui | covered | OLD | real | admin |
| 10E-A-069 | happy | Prod: `/data-entry-demo` | NotFound, URL giữ nguyên | như trên | ui | covered | OLD | real | admin |
| 10E-A-070 | happy | Prod: `/list-review-demo` | NotFound, URL giữ nguyên | như trên | ui | covered | OLD | real | admin |
| 10E-A-071 | happy | Prod: `/shell-demo` | NotFound, URL giữ nguyên | như trên | ui | covered | OLD | real | admin |
| 10E-A-072 | happy | Prod: `/demo/canvas-overlays` | NotFound, URL giữ nguyên | như trên | ui | covered | OLD | real | admin |
| 10E-A-073 | happy | Prod: `/feedback-demo` | NotFound, URL giữ nguyên | như trên | ui | covered | OLD | real | admin |
| 10E-A-074 | edge | Đối chứng tree-shake: trong 8 lần vào trên, không có request chunk dev (tên chứa DataEntryDemo/ListReviewDemo/ShellDemo/CanvasOverlaysDemo/FeedbackDemo/StateGallery/DesignSystem) | không request JS nào khớp · RT:96-130 (chú thích "bản prod không có route") | requests.filter(regex)=0 | edge | missing | - | real | admin |
| 10E-A-075 | happy | Dev server, ẩn danh: 5 route C4 (`/data-entry-demo`,`/list-review-demo`,`/shell-demo`,`/demo/canvas-overlays`,`/feedback-demo`) | không bị đẩy về `/login`; URL giữ nguyên · SB:332-336 | pathOf(url)=route (cả 5) | ui | covered | OLD (landmark+URL) | dev | - |
| 10E-A-076 | edge | Đối chứng cổng: dev server, ẩn danh `/khong-ton-tai` | bị đưa về `/login` (cổng còn hoạt động; chỉ dev route là công khai) · SB:332 | pathOf(url) bắt đầu /login | ui | missing | - | dev | - |
### B States
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-B-042 | state | Prod NotFound cho route dev = SCR-39 (chi tiết "Dự án gần đây" thuộc C1) | h2 "Không tìm thấy trang này" | heading | ui | covered | OLD | real | admin |
### C Validation/logic
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-C-024 | edge | `DEV_PUBLIC_ROUTE_PATTERNS` khớp 8 route spec khai báo | tập 8 path = {/demo,/design-system,/data-entry-demo,/list-review-demo,/shell-demo,/demo/canvas-overlays,/feedback-demo,/design-system/states} · PA:221-230 | set equal | edge | covered | OLD "route list matches …" | n/a (import hằng) | - |
### D Roles
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-D-006 | role | Đã đăng nhập (prod) vs ẩn danh (dev) | prod cần phiên → NotFound; dev không cần phiên → màn demo (xem A-066..A-075) | - | ui | covered | OLD | real+dev | admin |
### E A11y/keyboard
| 10E-E-018 | n/a | dùng lại SCR-39 | n/a: do C1 phủ | - | - | n/a | - | - | - |
### F Responsive
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-F-024 | resp | Prod NotFound cho 1 route dev | NotFound hiện đúng bố cục | không tràn | ui | missing | - | real | admin |
### G API/BE
| id | cat | case | expected | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 10E-G-006 | api | Prod: NotFound gọi `GET /api/projects` (danh sách dự án gần đây) khi vào URL dev | phản hồi 200 là mảng · notFoundGateway.ts (xem C1) | 200 + array | api | missing | - | real | admin |
| 10E-G-007 | n/a | Dev ẩn danh | n/a: mock client, không BE | - | - | n/a | - | - | - |

### Notes (bug nghi ngờ)
- ⚑ **N-1 `/list-review-demo` có thể sập khi mở**: LR:42 gọi `useToast()` (TO:33-36 ném "useToast must be used within Toast.Provider" nếu không có provider); route dev chỉ bọc `suspended(<RouteListReviewDemo />)` (RT:123), không có `Toast.Provider` nào ở RT/main (grep: chỉ App.tsx:102 và AccountSettings). Đúng theo nguồn: màn phải hiện "States:"; thực tế có thể vào `RouteErrorScreen`. OLD chưa chắc xanh. S3: FL-10E-03 bước 1 là H.
- ⚑ **N-2 ShellDemo**: `?` có thể mở hai hộp (AppShell `ShortcutHelp` + `GlobalShortcutHelp` của `UndoShortcuts`, RT:~337); Ctrl+K có thể xung đột `global.openSearch`. Chữ "Use the dev switch at the bottom right" (SD:57) không có "dev switch" nào (chữ cũ).
- ⚑ **N-3 DataEntryDemo #3 "Invalid (Min: 50)"** (DE:38): giá trị 48 < min 50 nhưng lúc nghỉ không có lỗi (NF chỉ validate khi gõ/commit) → nhãn sai nghĩa cho người xem.
- ⚑ **N-4 CanvasOverlaysDemo**: nút trên `ZoomCluster`/`WallThicknessLegend` nằm trong div có `onPointerDown` (CO:105), không stopPropagation → bấm "Phóng to"/bộ lọc có thể bắt đầu phép đo (10E-A-053).
- ⚑ **N-5 ListReviewDemo**: hộp kiểm tiêu đề/hàng không có tên truy cập (LR:136,197; Table.tsx:307-333 có bản đúng nhưng không dùng); chuyển sang `empty/error/permission` không đặt lại dữ liệu (10E-B-021); "Thử lại" ở partial và "Thêm mới" ở empty không làm gì.
- Phạm vi: `/demo`, `/design-system`, `/design-system/states` (C3) chỉ xuất hiện ở đây ở dòng prod NotFound A-066..A-068. BUG-LOG: không tìm thấy dòng `| 10 |` khớp màn này.

