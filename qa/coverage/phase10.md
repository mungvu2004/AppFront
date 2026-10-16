# Phase 10 coverage — NotFound, phím tắt, dev URL trên bản prod (FE)

Nguồn: catalog QA-10 C1–C4 (`backend/dieu-phoi/chay/QA-10/`), khoá 2026-10-14. NotFound (SCR-39), phím tắt (SCR-41) và dev URL trên bản prod chạy trên stack THẬT; trang demo (SCR-40, chỉ bản dev) n/a. Spec cũ `phase10_system_routes.spec.ts` (Track B cần bật vite tay) đã thay. Mỗi dòng cần phủ = một `test.step('[id] …')` trong `qa/tests/phase10_*.spec.ts` (cổng: `node tools/coverage-gate.mjs --phase 10`).

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
| 10K-B-009 | content | trên `/projects/<MP>/3d` (PascalViewer, router.tsx:382) nhóm 'Khung nhìn 3D' có hàng 'Mở hoặc đóng bảng lịch sử thao tác' Ctrl + H; không còn hàng 'Mở ô tìm đối tượng' (Ctrl+F bỏ, docs/pascal/05-dung-man-pascal.md §7) | GSH:55-60 · PascalViewer.container.tsx:300-306 | h3 'Khung nhìn 3D' + h3 'Toàn cục' | ui | missing | — | real | MP, WebGL |
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
| 10K-C-009 | cleanup | điều hướng (history.back) khi bảng đang mở: trạng thái bảng xác định | `isHelpOpen` trong `UndoShortcuts` bọc mọi route · RT:300-309 | bảng đóng khi đường dẫn đổi (router.tsx UndoShortcuts effect trên pathname; vitest router.test.tsx 10K-C-009) | edge | missing | — | real | MP |

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
| 10K-F-003 | layout | bảng trên /3d (Pascal) 1024/768 cao <= 80vh, nút X còn thấy, tiêu đề dính `sticky top-0` | GSH:158,184 | nút X còn thấy | ui | missing | — | real | MP, WebGL |
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

# C3 (`10D`) và C4 (`10E`, SCR-40e-1..5 + dòng muộn 10E-C-025): n/a — trang demo chỉ có ở bản dev

Người dùng 2026-10-16 (QA-10, trước R1): "trang demo thì test làm gì ?? nó đấy ý nghĩa gì đâu" → bỏ 260 dòng (10D-* 88, 10E-* 172). Tám dev route (`DEV_ONLY_ROUTES`, `STATE_GALLERY_DEV_ONLY_ROUTES` chỉ khi `import.meta.env.DEV`, src/routes/router.tsx:130,155) không có trong bản build thật; người dùng không bao giờ thấy chúng. Còn phủ: bản prod mở URL dev → NotFound (SCR-40e-6 bên dưới). Bảng gốc: `backend/dieu-phoi/chay/QA-10/catalog-C3.md`, `catalog-C4.md`. Nghi ngờ trên component dùng chung mà demo để lộ (Toast, Breadcrumb, NumericField, AppShell `?`) kiểm bằng vitest trên chính component (QA-10 timeline).

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
| 10E-A-075 | happy | Dev server, ẩn danh: 5 route C4 (`/data-entry-demo`,`/list-review-demo`,`/shell-demo`,`/demo/canvas-overlays`,`/feedback-demo`) | không bị đẩy về `/login`; URL giữ nguyên · SB:332-336 | pathOf(url)=route (cả 5) | ui | n/a (dev server) | OLD (landmark+URL) | dev | - |
| 10E-A-076 | edge | Đối chứng cổng: dev server, ẩn danh `/khong-ton-tai` | bị đưa về `/login` (cổng còn hoạt động; chỉ dev route là công khai) · SB:332 | pathOf(url) bắt đầu /login | ui | n/a (dev server) | - | dev | - |
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


