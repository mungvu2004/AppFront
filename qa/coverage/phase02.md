<!-- qa-sources fe=5afd8b8a -->
# Phase 02 — FE coverage inventory (SCR-05 dashboard + create wizard, SCR-06 notifications, SCR-07 onboarding)

FE source: `F:/App/AppFront` HEAD `5afd8b8a`. Backend rules are in `coverage/phase02-be.md` (separate agent);
BE-rule gaps belong there, not here. Plan rows: `E2E-TEST-PLAN.md` §4 Phase 2 (SCR-05…07).

**Specs** — `M` = `tests/phase02_dashboard.spec.ts` (16, serial, produces CP-2) · `U` = `tests/phase02_dashboard_ui.spec.ts`
(33 states x 1440/1024/768/375, non-serial) · `E` = `tests/phase02_dashboard_edge.spec.ts` (69: 68 runnable + 1 `test.fixme`;
non-serial; the SCR-05 dashboard block plus the earlier wizard / SCR-06 / SCR-07 tests) · `EW` = `tests/phase02_wizard_edge.spec.ts`
(27, non-serial) · `X` = `tests/phase02_notify_edge.spec.ts` (19, non-serial, second real user) · `A` = `tests/phase02_dashboard_api.spec.ts`
(26, API layer; holds the pairs of the mocks). Test names are shortened to their leading words. Nothing here has been run yet
(typecheck + `--list` only).

**Source abbreviations** — `PD` `src/screens/dashboard/ProjectDashboard/ProjectDashboard.tsx` · `UPD` `…/useProjectDashboard.ts` ·
`PDC` `…/ProjectDashboard.container.tsx` · `DS` `…/DashboardSidebar.tsx` · `PCT` `…/ProjectCardTile.tsx` · `PMG` `…/projectMenuGroups.ts` ·
`PG` `…/projectsGateway.ts` · `CPM` `src/screens/project/CreateProjectModal/CreateProjectModal.tsx` · `UCPM` `…/useCreateProjectModal.ts` ·
`SF` `…/StepFloors.tsx` · `CPC` `…/CreateProjectModal.container.tsx` · `NC` `src/screens/system/NotificationCenter/NotificationCenter.tsx` ·
`UNC` `…/useNotificationCenter.ts` · `NCC` `…/NotificationCenter.container.tsx` · `NM` `…/notificationModel.ts` · `NCG` `…/notificationCenterGateway.ts` ·
`WS` `src/screens/onboarding/WelcomeScreen/WelcomeScreen.tsx` · `UWS` `…/useWelcomeScreen.ts` · `WSC` `…/WelcomeScreen.container.tsx` ·
`NF` `src/hooks/useNumericField.ts` · `NUM` `src/lib/format/number.ts` · `SEL` `src/hooks/useSelect.ts` · `SEG` `src/components/ui/SegmentedControl.tsx` ·
`CM` `src/components/canvas/ContextMenu.tsx` · `MOD` `src/components/overlay/Modal.tsx` · `DRW` `src/components/overlay/Drawer.tsx` ·
`TST` `src/components/feedback/Toast.tsx` · `NH` `src/components/feedback/NotificationHost.tsx` · `LIM` `src/domain/project/limits.ts` ·
`UT` `src/lib/mutations/undoTicket.ts` · copy `src/i18n/vi.json` (`dashboard.stats`, `errors.*`).

## Findings from the inventory (source-level; confirm in the run)

| # | What | Source | Edge test that exposes it |
|---|---|---|---|
| F1 | **Main spec stale selector**: rename test opens `menu { name: 'Tùy chọn' }`, the menu is `aria-label="Tuỳ chọn"` (tone mark moved in c6e6b126). Non-exact match is a substring match without Unicode folding → no match | `CM:102`; `M` line 268 | E card menu / rename tests use `Tuỳ chọn` — **fixed in M** (`CARD_MENU = 'Tuỳ chọn'` exact), not yet run |
| F2 | **Main spec likely dead locator**: `drawer.locator('li').filter({ has: markButtons })` with `markButtons` built from `drawer` — the `has` locator is resolved inside each `<li>`, so the drawer-prefixed chain should never match → `row.hover()` times out when unread > 0 (UNKNOWN until run) | `M` lines 369-381 | E mark-one uses a page-rooted `has` — **fixed in M** (page-rooted `has`), not yet run |
| F3 | Create toast "Hoàn tác" sends `DELETE` but nothing invalidates N1 → the undone project probably stays on the dashboard until the 30 s refetch (A8) | `UCPM:670-672`, `CPC:101-111` (no `applyInvalidation`) | E wizard [held response] create … "Hoàn tác" |
| F4 | `/thong-bao`: "Xem tất cả" navigates to the same route and sets `hasLeftRef`; afterwards Esc / backdrop call `goBack`, which returns early → Esc dead on that screen (A12) | `NCC:202-221`, `UNC:767-770` | E on /thong-bao "Xem tất cả" … Esc still leaves |
| F5 | "Mã dự án" has no max length in the FE; BE caps it at 32 → 422, and the FE shows the message under **"Tên dự án"** (`serverNameProblem`) — wrong field | `CPM:109-115`, `UCPM:658-663`, BE `apps/api/projects/schemas.py:27,52` | E wizard 33-character "Mã dự án" |
| F6 | Rename refused by the server for a bidi/control character → toast "Tên dự án cần từ 3 đến 80 ký tự." (length copy for a character problem) | `UPD:201-204`, BE `schemas.py:30-38` | E rename bidi 422 |
| F7 | Numeric fields read "." as a thousands mark: "3.5" = 35 → "Giá trị phải <= 10" (UX: a dot decimal is common) | `NUM:255-266`, `NF:41-46` | E wizard heights |
| F8 | Create dialog width is pinned at 560 px; at 375 px it overflows (documented limitation) | `CPM:10-19, 64` | E compact (JSON records `dialogWidth`) |
| F9 | Injected "unreadable row" fails the WHOLE list when it is > 20 % of the rows (`MAX_INVALID_RATIO = 0.2`): with < 4 real projects one bad row is > 20 % → full "Không tải được danh sách dự án" instead of the partial notice (likely real cause of the edge "unreadable row" failure, besides BUG-142) | `src/api/schemas/decode.ts:7, 205-224` | E / U unreadable row now pad to >= 4 readable rows |

## SCR-05 — Dashboard `/`

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| 1 | Navigation | `/` load: h1 "Dự án của tôi" + list "Danh sách dự án" or empty state | `PD:151, 198, 258-268` | M "SCR-05 load" | covered |
| 2 | Network | `GET /api/project-summaries?limit=500`, every cursor page summed | `PG:60, 87-119` | M load · E header counts · E [mocked response] N1 over two cursor pages | covered (multi-page by mock, paired with A02 N1 cursor paging) |
| 3 | Network | `CURSOR_INVALID` mid-read → restart from page 1 once | `PG:111-119` | E [mocked response] N1 page 2 answers 422 CURSOR_INVALID | covered (mock, paired with A02 N1 forged cursor → 422) |
| 4 | Loading | 6 skeleton cards, sr "đang tải", no sidebar, no count line | `PD:101, 199, 245-250`, `UPD:361` | U `U02_dash_loading` [held response] · E [held response] loading | covered (UI layer) |
| 5 | Error | "Không tải được danh sách dự án" + message + "Thử lại" → refetch | `PD:251-257`, `UPD:352-356, 509` | U `U02_dash_load_error` [mocked response] · E [mocked response] N1 fails (500) | covered (UI layer); unpairable: 5xx |
| 6 | Empty | "Chưa có dự án nào" + "Tạo dự án đầu tiên…" + "Tạo dự án mới" opens the wizard; counters 0 | `PD:258-268`, `UPD:364` | U `U02_dash_empty` [mocked response] · E [mocked response] no project | covered (UI layer); paired: A02 · fresh engineer (`A02_fresh_summaries_default.json`) |
| 7 | Empty | no create right: "Bạn chưa được thêm vào dự án nào…" | `PD:265` | Phase 09 | n/a-by-design (role matrix, Phase 09) |
| 8 | Partial | dropped rows → "Có N dự án chưa đọc được", readable cards still shown; > 20 % bad rows fail the whole list | `UPD:266, 367, 482`, `PD:244`, `PG:98-100`, `src/api/schemas/decode.ts:7, 205-224` | E [mocked response] one row the client cannot decode (now owns 4 fixtures, explicit fulfill — BUG-142) · U `U02_dash_partial` [mocked response] | covered |
| 9 | Partial | filters match nothing → "Không tìm thấy dự án phù hợp" + "Xoá bộ lọc" | `PD:269-275` | M search · E search | covered |
| 10 | Forbidden | viewer: "Vai người xem: chỉ có thể mở dự án…", no "Dự án mới" | `PD:187, 222-227`, `UPD:366` | Phase 09 (R-V_05) | n/a-by-design (Phase 09) |
| 11 | Compact | < 1024: sidebar → SegmentedControl "Lọc theo trạng thái"; 1023 vs 1024 boundary; same filter state | `PD:229-240`, `UPD:90-107, 363`, `DS:59-75` | U `U02_dash_status_filter` (768/375) · E compact | covered; no-match below 1024 = BUG-111 (openError expected at 768/375 in `U02_dash_status_filter` / `U02_dash_search_no_match`) |
| 12 | Error | screen crash → `ScreenErrorBoundary` fallback | `PDC:44-57, 88-95` | — | UNKNOWN — NEED VERIFICATION (no safe way to crash the screen on the real stack) |
| 13 | Display | "{n} dự án" only in success/collapsed/forbidden | `PD:199-201` | E header counts · E unreadable row (hidden in partial) · E loading | covered |
| 14 | Display | 4 stat cards "Tổng dự án / Hoàn thành / Cần QC / Đang xử lý" with derived counts | `DS:22-57`, `UPD:339-350`, `vi.json:415-418` | E header counts | covered |
| 15 | Input | searchbox "Tìm dự án" | `PD:175-183` | M search | covered |
| 16 | Logic | search trims and ignores case | `UPD:272-276` | E search | covered |
| 17 | Button | sidebar status filters `aria-pressed` + counts | `DS:59-75`, `UPD:76-81` | M view controls · E header counts | covered |
| 18 | Button | "Xoá bộ lọc" resets search AND status filter | `UPD:490-493` | E search | covered |
| 19 | Select | sort "Tên A–Z" | `UPD:83-88, 286-287` | M view controls | covered |
| 20 | Select | sort "Số tầng nhiều nhất", "Diện tích lớn nhất" (stable over gateway order) | `UPD:288-291`, `PG:104-106` | E sort | covered |
| 21 | Keyboard | sort combobox: Enter opens, Esc closes, focus back on trigger | `SEL:30-53` | E sort | covered |
| 22 | Segmented | "Kiểu xem" Lưới/Bảng; table headers | `PD:210-218, 281-290` | M view controls · U `U02_dash_table` | covered (BUG-139 fixed) |
| 23 | Keyboard | "Kiểu xem" ArrowRight/ArrowLeft | `SEG:128-140` | E keyboard (view) | covered |
| 24 | Navigation | table row click / Enter opens the project | `PD:293-300` | E keyboard (view) | covered |
| 25 | Menu | table row right-click opens the project menu | `PD:301-304` | E keyboard (view) | covered |
| 26 | Navigation | card click → processing `/pipeline`, qc walls, done `/3d` | `PCT:73`, `UPD:192-196, 221-232` | M card click · E card keyboard · E [mocked response] status routing | covered (qc/done by mock; real pair after CP-5) |
| 27 | Keyboard | Enter on a focused card | `PCT:74-76` | E card keyboard | covered |
| 28 | Button | "Mở {name}" arrow button | `PCT:151-161` | E card keyboard | covered |
| 29 | Menu | "Tuỳ chọn cho {name}" → menu "Tuỳ chọn": Mở / Đổi tên / Xoá | `PCT:97-107`, `PMG:16-28`, `CM:99-102` | M rename + undo (F1 fixed) · M delete · U `U02_dash_card_menu` · E card menu (F1 fixed) | covered |
| 30 | Keyboard | menu: first item focused, ArrowDown/Up wrap, End, Esc closes | `CM:47-94` | E card menu | covered |
| 31 | Menu | right-click on a card | `PCT:77-80` | E card menu | covered |
| 32 | Menu | "Mở" opens the project | `PMG:20` | E card menu | covered |
| 33 | Menu | "Nhân bản" not drawn (no BE contract) | `PMG:21-23`, `PG:57-58` | E card menu (count 0) | n/a-by-design (asserted hidden) |
| 34 | Input | inline rename: Enter → `PATCH /api/projects/:id`, toast "Đã đổi tên thành…" | `PCT:112-125`, `UPD:410-427` | M rename + undo | covered |
| 35 | Keyboard | rename Esc cancels, no PATCH | `PCT:122`, `UPD:498` | E rename edges | covered |
| 36 | Logic | rename blank / unchanged → nothing sent | `UPD:429-434` | E rename edges | covered |
| 37 | Logic | rename blur commits; name trimmed | `PCT:118`, `UPD:432` | E rename edges | covered |
| 38 | Validation | < 3 / > 80 chars → toast "Tên dự án cần từ 3 đến 80 ký tự.", no PATCH; 3 and 80 saved | `UPD:198, 435-438`, `LIM:22-23` | E rename bounds | covered |
| 39 | Error | rename 422 → range toast, old name back | `UPD:201-204, 416-420` | E rename bidi 422 | covered (copy mismatch F6) |
| 40 | Error | rename 404 → "Dự án này không còn nữa.", old name back | `UPD:207-208` | E deleted elsewhere | covered |
| 41 | Error | rename 403 → "Bạn không có quyền đổi tên dự án này." | `UPD:205-206` | E [mocked response] rename refused 403 FORBIDDEN | covered (mock, paired with A02 role_viewer_member_patch_403) |
| 42 | Error | rename other failure → "Không đổi được tên dự án. Hãy thử lại.", old name back, PATCH not retried | `UPD:209-210, 417-420`, `lib/http/retry.ts:25-26` | E [mocked response] rename answered 500 | covered (unpairable: 5xx) |
| 43 | Toast | rename "Hoàn tác" → second PATCH, "Đã khôi phục tên…" | `UPD:423-426` | M rename + undo · U `U02_dash_rename_toast` (real PATCH, own project) | covered |
| 44 | Modal | delete "Xoá dự án?", `"{name}" và toàn bộ bản vẽ…`, "Không hoàn tác được." | `PD:329-353` | M delete (`05_dash_delete_confirm`) · U `U02_dash_delete_confirm` · E delete | covered |
| 45 | Button | "Để nguyên", Esc, "Đóng hộp thoại" → no DELETE | `PD:346-348`, `MOD:64, 78, 163-171` | E delete | covered |
| 46 | Button | "Xoá dự án" → `DELETE` → card leaves, no undo toast (A9) | `PD:349-351`, `UPD:442-459` | M delete (`05_dash_deleted`) · E delete | covered (main happy path) |
| 47 | Error | delete 404 → treated as done | `UPD:450-458` | E deleted elsewhere | covered |
| 48 | Error | delete 403 / other → message inside the dialog; "Để nguyên"/reopen clears it; retry deletes | `UPD:214-219, 446-453, 499-506`, `PD:342` | E [mocked response] delete refused 403 · E [mocked response] delete answered 500 | covered (403 paired with A02 role_viewer_member_delete_403; 500 unpairable) |
| 49 | Permission | "Đổi tên"/"Xoá" disabled without `project.settings.edit` | `PMG:24-25`, `UPD:378` | Phase 09 | n/a-by-design (Phase 09) |
| 50 | Button | "Dự án mới" (with `N` hint) when `canCreate` | `PD:187-191` | M wizard tests · U wizard states | covered |
| 51 | Keyboard | `N` opens the wizard; inert in a text box | `UPD:380-385`, `shortcutRegistry.ts:23-26` | E "N" opens the wizard | covered |
| 52 | Display | account avatar initials (BUG-031) | `PD:186`, `PDC:63` | E header counts | covered |
| 53 | Display | bell slot in the header | `PD:185`, `PDC:72` | M bell | covered |
| 54 | Network | telemetry `project.open` → `POST /api/telemetry` | `UPD:251-253, 391`, `lib/telemetry/sender.ts:104-108` | E telemetry (`test.fixme`) | UNKNOWN — NEED VERIFICATION (flag-gated sender, 10 s batch / sendBeacon; not proven observable) |
| 55 | Navigation | open routes for qc (walls) and done (`/3d`) | `UPD:221-232` | E [mocked response] status routing | covered by mock (re-pair with a real click after CP-5) |
| 55b | Navigation | qc → `/floors` (no `defaultFloorId`) | `UPD:226-227`, `projectSummaries.ts:92-97` | — | n/a-by-design (the schema refuses a qc row without `defaultFloorId`, so the branch is unreachable through N1) |
| 56 | Navigation | Back from a project / reload → search, sort, view back to defaults | `UPD:241-244` | E keyboard (view) · E reload | covered |
| 57 | Display | hero + 2 side cards + grid, DOM order = row order | `PD:143-167` | E sort (order) | covered |
| 58 | Motion | first-appearance stagger only | `UPD:298-303` | — | n/a-by-design (timing; UI layer) |
| 59 | Race | double click "Xoá dự án" while DELETE is in flight → one DELETE | `UPD:443-459`, `PD:349-351` (cf. `UCPM:641-643`) | E [held response] double click on "Xoá dự án" | covered — **expected to fail**: no in-flight guard, button stays enabled (soft assert, finding candidate) |
| 60 | Race | rename optimistic name while PATCH held; toast only after the answer; 2nd Enter sends/opens nothing | `UPD:410-427`, `PCT:119-122` | E [held response] rename | covered |
| 61 | Toast | rename toast leaves after 8 s, no undo after, name persists after reload | `TST:59-93`, `UT:18`, `UPD:423-426` | E rename toast leaves after the 8 s undo window | covered |
| 62 | Display | card badge + "{r}/{t} tường đã duyệt" + counters for qc/done rows | `UPD:315-350` | E [mocked response] status routing | covered (mock) |
| 63 | Table | five headers, not sortable (no `aria-sort`, header click inert) | `PD:284-288`, `Table.tsx:158-174` | E table view: five plain headers | covered |
| 64 | Table | rows follow the sort list ("Tên A–Z" vi collation); Tab moves row → row | `UPD:283-296`, `PD:295` | E table view: five plain headers | covered |
| 65 | Table | rename inside a table row (menu → box in the cell), Esc cancels, click/Enter in the box never open the row | `PD:106-121, 297-304` | E table view rename | covered |
| 66 | Table | 80-char name: full name in the cell, no page-level h-scroll at 1440, last column on screen | `PD:281-316`, `Table.tsx:37`, `LIM:23` | E table view with an 80-character name | covered — last-column check is soft, **likely finding** (name cell does not truncate in a table) |
| 67 | Logic | status filter AND search; sidebar counts ignore the search; filter switch keeps the query | `UPD:273-281, 339-350` | E status filter AND search | covered |
| 68 | Logic | search vs Vietnamese marks: upper case with marks matches; without marks / NFD does not | `UPD:272-276` | E search and Vietnamese marks | covered (asserts source; UX note: no accent folding — typing "nha" never finds "Nhà") |
| 69 | Partial | no-result search → "một phần", no "{n} dự án"; emptying the box → list, line, "thành công" | `UPD:363-368`, `PD:199, 269-275` | E search with no result | covered |
| 70 | Network | delete → N1 re-read (invalidation) → counters / "{n} dự án" −1 without reload | `UPD:456-458`, `lib/query/invalidation.ts:304-308` | E delete re-reads N1 | covered |
| 71 | Error | offline during load (N1 aborted): GET retried, then error card; "Thử lại" recovers | `lib/http/retry.ts:25-26, 70-96`, `PD:251-257` | E [mocked response] offline while the list loads | covered (unpairable: network loss) |
| 72 | Loading | held N1 then 500; "Thử lại" with the read held → skeleton again (query back to pending), then list | `UPD:358-362, 509`, `@tanstack/query-core 5.53.1 query.js:351-360` | E [mocked response] N1 held then 500 | covered (unpairable: 5xx) |
| 73 | Keyboard | Enter on "Tuỳ chọn cho {name}" opens the menu, stays on `/` | `PCT:74-76, 97-107` | E keyboard: Enter on "Tuỳ chọn cho {name}" | covered — **expected to fail**: the article's Enter keydown (PCT:74-76) likely opens the project first (A12 finding candidate) |
| 74 | Keyboard | keyboard-opened menu next to its button; Esc returns focus to the button; delete dialog Esc returns focus too | `PCT:100-103`, `CM:86-94`, `focusTrap.ts:19-23, 173`, `MOD:59-72` | E keyboard focus: Space opens the card menu | covered — soft asserts, **likely findings**: menu at (0,0) for a keyboard click; no focus restore in CM; dialog opener is `body` |
| 75 | Navigation | Back from a project resets status filter + search; Forward reopens | `UPD:241-244` | E Back/Forward with a status filter | covered |
| 76 | Navigation | deep link `/?q=&status=&view=&sort=` ignored → defaults | `UPD:241-244` | E deep link with query parameters | covered (n/a feature: state not in the URL) |
| 77 | Compact | resize 1440 → 900 with the menu open: collapse, menu re-clamped, "Đổi tên" works | `CM:43-45`, `UPD:90-107, 363` | E resize 1440 → 900 with a card menu open | covered |

## SCR-05 — "Tạo dự án mới" wizard

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| W1 | Modal | dialog "Tạo dự án mới", "Bước n / 3" (visible + sr) | `CPM:242-262`, `UCPM:684` | M validation · E step 1 | covered |
| W2 | Validation | blank / spaces → "Chưa nhập tên dự án.", "Tiếp tục" disabled | `UCPM:142-146, 486` | M validation · E step 1 | covered |
| W3 | Validation | < 3 → "Tên dự án cần ít nhất 3 ký tự." | `UCPM:147-149` | E step 1 | covered |
| W4 | Validation | > 80 → "Tên dự án không quá 80 ký tự." | `UCPM:150-152`, `CPM:104` (maxLength) | E step 1 (value capped at 80) | n/a-by-design (unreachable by typing; asserted) |
| W5 | Logic | code auto from name: NFD, đ→d, `DA-`, 24-char slug | `UCPM:165-178, 533-535` | E step 1 | covered |
| W6 | Logic | hand-edited code stops the auto code | `UCPM:538-542` | E step 1 | covered |
| W7 | Input | "Địa chỉ", "Loại công trình" (5 options, default "Nhà ở"), "Ghi chú" | `CPM:117-149`, `UCPM:71-79` | M full create · E review | covered (type / notes not on the wire: `CPC:57-75`, asserted via `sentKeys` JSON) |
| W8 | Keyboard | Esc on an open "Loại công trình" list closes the list only | `UCPM:625`, `SEL:51-53` | E Esc | covered |
| W9 | Keyboard | Esc: pristine closes; dirty warns (+hint); typing hides it; second Esc closes | `UCPM:523-526, 618-639`, `CPM:248-257` | U `U02_wizard_discard_esc` · E Esc · E "N" | covered (UI layer) |
| W10 | Button | "Huỷ" pristine closes; dirty → "Đóng, bỏ thay đổi" | `UCPM:624-639`, `CPM:254` | M validation · M discard | covered |
| W11 | Button | "Đóng hộp thoại" and backdrop → same `requestClose` | `MOD:108-117, 163-171` | E close controls | covered |
| W12 | Logic | reopening starts a blank form at step 1 | `CPM:309-328` | E Esc | covered |
| W13 | Step 2 | 4 default floors "Tầng trệt…Tầng 3", no height | `UCPM:82, 185-197` | M create · E heights | covered |
| W14 | Validation | row "Chưa nhập chiều cao thông thuỷ." / "Chưa tính được cao độ…" | `UCPM:111-125, 233-244` | E heights · E cap | covered |
| W15 | Validation | numeric "Giá trị phải >= 2" / "<= 10"; refused values never committed | `NF:41-72, 105-111`, `LIM:34-35` | U `U02_wizard_height_refused` · E heights | covered (UI layer) |
| W16 | Logic | "." read as thousands mark ("3.5" = 35) | `NUM:255-266` | E heights | covered (F7) |
| W17 | Logic | "Áp cho mọi tầng" disabled until a committed height | `UCPM:491, 590-594`, `SF:139-146` | E heights | covered |
| W18 | Display | elevations cumulative "0,0 m / 2,5 m …" | `UCPM:138-140, 246-276`, `alignFloors.ts:451-453` | E heights · E review | covered |
| W19 | Toggle | "Có tầng hầm" → "Tầng hầm" first, negative elevation | `SF:34-40`, `UCPM:279-304, 596-606` | M full create · E rows | covered |
| W20 | Button | "Thêm tầng" → "Tầng N" without height | `UCPM:185-187, 559-566` | E rows | covered |
| W21 | Boundary | 50 floors → "Thêm tầng" disabled | `UCPM:490`, `SF:125`, `LIM:27` | U `U02_wizard_floor_cap` · E floor cap | covered (UI layer) |
| W22 | Validation | elevation > 300 m → "Cao độ vượt giới hạn cho phép (-30 đến 300 mét)." | `UCPM:127-136, 260-265`, `LIM:30-31` | E floor cap | covered |
| W23 | Validation | elevation < -30 m (basement) | `UCPM:289-292` | — | n/a-by-design (max height 10 m → basement ≥ -10 m; unreachable) |
| W24 | Button | "Xoá {tầng}" | `SF:107-114`, `UCPM:568-571` | E rows | covered |
| W25 | Input | "Tên tầng …" edit | `SF:87-92`, `UCPM:573-576` | E rows | covered |
| W26 | Empty | no floor → "Chưa có tầng nào" + "Thêm tầng", state "rỗng", "Tiếp tục" disabled | `SF:58-64`, `UCPM:487, 498` | U `U02_wizard_no_floors` · E rows | covered (UI layer) |
| W27 | Alert | overlap collision + "Xem tầng" focuses the row | `SF:42-56`, `UCPM:306-327`, `CPM:204-212` | — | UNKNOWN — NEED VERIFICATION (floors are stacked ceiling-to-floor; no input path found that yields an `overlap` issue) |
| W28 | Step 3 | review rows, "—" for blanks, floor list with elevations | `CPM:163-193` | E review | covered |
| W29 | Button | "Quay lại" keeps every field | `UCPM:614-616` | E review | covered |
| W30 | Network | `POST /api/projects` body (name, draft, floors, code/address) + `Idempotency-Key` | `CPC:57-75, 90`, `lib/http/client.ts:30` | M create CP-2 · M full create · E held create | covered |
| W31 | Loading | submitting: "Tạo dự án" busy, "Huỷ"/"Quay lại" disabled, sr "đang tải" | `CPM:276-296`, `UCPM:496` | E [held response] create | covered |
| W32 | Logic | double click → one POST | `UCPM:641-643` | E [held response] create | covered |
| W33 | Toast | "Đã tạo dự án "{name}"." | `UCPM:668-673` | M create CP-2 · M full create · U `U02_dash_create_toast` | covered |
| W34 | Toast | create "Hoàn tác" → `DELETE`; card should leave (A8) | `UCPM:670-672`, `CPC:101-111` | E [held response] create (own project only, R6) | covered (F3 suspected) |
| W35 | Error | 422 (code > 32) → violation notice, "Tạo dự án" locked, message under name; editing the name clears it | `UCPM:199-208, 484, 531, 658-663` | U `U02_wizard_server_422` (real 422, no mock) · E 33-character code | covered (UI layer) (F5) |
| W36 | Error | 409 → "Tên dự án đã trùng…" | `UCPM:204-206` | — | n/a-by-design on this BE (BE `projects/service.py:244`: no route answers 409) |
| W37 | Error | network loss → "Không liên lạc được với máy chủ…" | `UCPM:207`, `lib/http/client.ts:591-598`, `vi.json:15` | E [mocked response] network lost | covered |
| W38 | Forbidden | viewer: "Không có quyền tạo dự án" | `CPM:214-240` | Phase 09 | n/a-by-design (Phase 09) |
| W39 | Compact | < 1024: step 1 one column, state "thu gọn"; width pinned 560 | `CPM:10-19, 95`, `UCPM:334-351, 494` | E compact | covered (F8) |
| W40 | Error | wizard crash fallback | `CPC:285-300` | — | UNKNOWN — NEED VERIFICATION (not producible) |
| W41 | Validation | "Địa chỉ" 201 chars → BE 422 → "Kiểm tra lại…" notice, state "lỗi"; 200 chars → 201 created | `CPM:118-123`, `UCPM:658-663`, BE `schemas.py:28, 53` | EW "Địa chỉ" boundary | covered (was gap) |
| W42 | Keyboard | wizard opened with `N`: pristine form shows no error, focus in "Tên dự án" | `CPM:105`, `UCPM:142-146, 483-484`, `FT:179`, `MOD:163-171` | EW [BUG-133] | covered — expected to FAIL (BUG-133) |
| W43 | Keyboard | `n` inside the open wizard: off a text field swallowed (dialog scope modal), in a field it types | `shortcutRegistry.ts:16-21`, `MOD:77-80`, `UPD:382-385` | EW [BUG-133] | covered |
| W44 | a11y | focus trap: Shift+Tab on first → last, Tab on last → first, Tab never leaves (steps 1 and 2); close returns focus to "Dự án mới" | `FT:56-68, 114-134, 138-142`, `MOD:59-72` | EW focus trap | covered |
| W45 | Keyboard | "Loại công trình": ArrowDown/Up open on the current value, arrows wrap, Enter selects, Tab closes without selecting; review shows the choice | `SEL:24-29, 41-76`, `CPM:124-141, 164-165, 177` | EW "Loại công trình" by keyboard | covered |
| W46 | Display | header gap title → "Bước 1 / 3" ≤ 24 px | `MOD:157`, `CPM:247, 259` | EW [BUG-122] | covered — expected to FAIL (BUG-122) |
| W47 | Logic | row height parsing: "3,5", "  2,5 ", "1e1" (= 10, parseFloat) commit; "-3" / "3.5" (= 35) refused, committed height kept; "" and "abc" ERASE the height silently (chain breaks) | `NUM:255-266`, `NF:41-72, 86-111`, `NFC:62, 71`, `UCPM:578-583` | EW row height parsing | covered ("abc" erasing and "1e1" accepted = finding candidates, Logic/Low) |
| W48 | Logic | apply field "3.5" after a 3 m apply: floors not erased; expected applied as 3,5 m | `NUM:262`, `NF:44, 58`, `UCPM:585-594` | EW [BUG-132] | covered — expected to FAIL (BUG-132: stale 3 m re-applied) |
| W49 | Logic | apply → edit one row restacks; apply again overwrites the edit; a new row starts empty; apply field keeps its value | `UCPM:468, 559-566, 585-594`, `UCPM:246-276` | EW "Áp cho mọi tầng" then edit one | covered |
| W50 | Toggle | basement by keyboard (Space), own height → "-4,0 m"/"-10,0 m", datum stays 0; "Thêm tầng" still "Tầng 4"; deleting the basement row unticks the switch; re-tick = fresh row without height | `Toggle.tsx:80-92`, `UCPM:279-304, 563, 596-606, 697` | EW basement by keyboard | covered |
| W51 | Keyboard | rename by keyboard keeps focus (MOD onClose ref); Enter on "Xoá {tầng}" removes it; focus pulled back into the dialog | `SF:87-113`, `UCPM:568-576`, `MOD:45-55`, `FT:129-134` | EW floor rows by keyboard | covered |
| W52 | Logic | after deleting a middle floor, "Thêm tầng" repeats an existing name ("Tầng 3" twice, two "Xoá Tầng 3") | `UCPM:185-187, 563` | EW floor rows by keyboard | covered (pinned; finding candidate Logic/Low — duplicate floor names + ambiguous a11y names) |
| W53 | Boundary | 50 floors then "Có tầng hầm" → 51 rows (cap is "basement included") | `LIM:25-27`, `UCPM:490, 596-606` | EW floor cap with a basement | covered — expected to FAIL (NEW finding candidate: setHasBasement skips the cap) |
| W54 | Validation | fresh step 2 shows no row error before a touch | `UCPM:233-244` | EW [BUG-120] | covered — expected to FAIL (BUG-120) |
| W55 | Logic | "Quay lại" to step 1 and back keeps basement, renamed/added rows, per-row and shared heights; step-1 edit does not reset floors | `UCPM:528-536, 614-616`, `CPM:264-273` | EW "Quay lại" to step 1 and back | covered |
| W56 | Display | review with 80-char name, 200-char address, 32-char code, 3-line notes: full text, no clipped value, no sideways scroll | `CPM:174-181`, `FR:66-76` | EW review shows long values whole | covered (notes line breaks not kept — recorded, not asserted) |
| W57 | Display | review label/value on one line; floor levels labelled "Cao độ" | `FR:66, 71`, `CPM:183-190` | EW [BUG-121] | covered — expected to FAIL (BUG-121) |
| W58 | Modal | discard on step 2 ("Huỷ" twice) and step 3 (Esc); warning survives "Quay lại"; backdrop closes; reopen blank; no POST | `UCPM:614-639`, `MOD:108-117`, `CPM:309-328` | EW discard on steps 2 and 3 | covered |
| W59 | Compact | 375 px discard warning: fields do not jump; "bên cạnh" copy vs button below | `CPM:248-257` | EW [BUG-123] | covered — expected to FAIL (BUG-123) |
| W60 | Compact | 375 px step 2: no sideways scroll, "Tiếp tục" on screen and clickable to step 3 | `CPM:63-64`, `MOD:132`, `SF:67` | EW [BUG-110] | covered — expected to FAIL (BUG-110) |
| W61 | Keyboard | Enter on "Tiếp tục" (step 2) leaves focus on "Tạo dự án" (same DOM node) → next Enter creates without viewing the review; Enter ×2 → ONE POST | `CPM:287-295`, `UCPM:641-643` | EW [held response] keyboard create | covered (focus carry-over = finding candidate UX/Low) |
| W62 | Network | "Loại công trình" / "Ghi chú" are not sent (no wire field) | `CPC:57-75` (TODO :71) | EW [held response] keyboard create | covered (data typed by the user is dropped — known TODO) |
| W63 | Logic | reopen after a successful create starts blank at step 1 (B-V3-02) | `CPM:309-328` | EW [held response] keyboard create | covered |
| W64 | Logic | padded name/code trimmed in POST, spaces-only address omitted; toast/card use trimmed name; review shows a blank cell (not "—") for the spaces-only address | `UCPM:646-653, 669`, `CPC:72-73`, `CPM:176` | EW padded and whitespace-only fields | covered (review blank vs "—" = finding candidate UI/Info) |
| W65 | Logic | duplicate project name accepted (201), no "trùng" message, two cards | BE `service.py:243-244`, `UCPM:204-206` | EW duplicate name | covered |
| W66 | Error | 422 on the code marks "Mã dự án" (not "Tên dự án"); fixing the code alone unlocks the form | `UCPM:484, 486, 531, 658-663` | EW [BUG-129] code 422 | covered — expected to FAIL (BUG-129) |
| W67 | Validation | blank ("   ") floor name: FE has no check, POST sends it untrimmed, BE 422 → generic notice, form locked | `UCPM:482-489, 573-576`, `CPC:60`, BE `schemas.py:31-39, 54` | EW blank floor name | covered (FE↔BE gap = finding candidate Logic/Low) |
| W68 | Logic | Esc while creating: requestClose has no isSubmitting guard → discard warning, second Esc closes; the held POST still creates the project + toast | `UCPM:624-635, 655-675`, `CPM:313-316` | EW [held response] Esc while creating | covered (pinned; "bỏ thay đổi" that still saves = finding candidate Logic/Low) |
| W69 | Error | create 500: one POST (not retried), "Hệ thống đã ghi nhận…" notice, review kept; expected "Tạo dự án" usable to retry | `RTY:3, 91-93`, `TAE:10-18`, `vi.json:63`, `UCPM:489, 661` | EW [BUG-129] [mocked response] create 500 | covered — unpairable: 5xx; last assertion expected to FAIL (BUG-129) |
| W70 | Network | create 503 once → retried with the same Idempotency-Key, one project | `RTY:3-5, 25-26`, `HTC:400-411, 487-524`, `CPC:90` | EW [mocked response] create 503 once | covered — unpairable: 5xx (503) |
| W71 | Network | network abort on the first attempt → silent retry, same key, one project, no notice | `RTY:17-23, 95`, `HTC:568-583` | EW [mocked response] network abort on the first create attempt | covered — unpairable: network loss |
| W72 | Keyboard | floor reorder | `SF:28-153` (no reorder control) | — | n/a-by-design (rows are ordered by insertion; no move/drag control in source) |
| W73 | Boundary | message when the 50-floor cap is reached | `SF:120-128` (button only disabled) | E floor cap (dashboard edge) | UNKNOWN — NEED VERIFICATION (no copy in source; plan wording not found) |

## SCR-06 — Notifications (bell drawer on `/`, route `/thong-bao`)

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| N1 | Button | bell "Thông báo" (exact) with `aria-expanded` | `NC:371-411` | M bell · E badge | covered |
| N2 | Display | badge = unread count on bell + drawer header, independent of the filter | `NC:303-307, 401-409`, `UNC:252, 800-803` | X two real invites · X filter "Nhắc đến tôi" · E badge | covered (real data, deterministic) |
| N3 | a11y | live region "Có 2 …" / "Không còn …" / "Không có thông báo nào" | `UNC:915-922` | X two real invites · X "chấp nhận" · X empty inbox · E badge · E [mocked response] list | covered (real) |
| N4 | Network | `GET /api/notifications` at bell mount | `NCG:274-280`, `UNC:447-450` | M · E | covered |
| N5 | Network | SSE `GET /api/streams/notifications` subscription | `NCG:304-319`, `UNC:543` | E badge (request seen) | covered |
| N6 | Realtime | arrival over SSE: badge + row without a list re-read | `UNC:522-543`, `NCG:304-319`, BE `invite_sinks.py:1-5`, `stream_providers.py` | X realtime | covered (member add while the dashboard is open) |
| N7 | Loading | skeleton rows; "Đánh dấu tất cả đã đọc" disabled | `NC:239, 243-244` | E [mocked response] list held then 500 | covered |
| N8 | Error | "Không tải được thông báo" + "Thử lại" | `NC:245-253`, `UNC:902-904` | U `U02_notif_load_error` [mocked response] · E [mocked response] list | covered (UI layer); unpairable: 5xx |
| N9 | Empty | "Không có thông báo mới" + description; same under every filter (BUG-126 copy question) | `NC:254-255`, `UNC:877-879` | X empty inbox (real) · U `U02_notif_empty` · E filters (when no row) · M settle | covered (real empty inbox) |
| N10 | Partial | non-empty inbox, filter matches nothing → "Có thể chưa cập nhật", no row | `NC:259`, `UNC:881-883` | X filter "Nhắc đến tôi" · U `U02_notif_filter_mentions` · E filters | covered (real) |
| N11 | Forbidden | `enabledKinds` empty | `NC:260-262`, `UNC:873-875` | — | n/a-by-design (not wired: `UNC:58-64`, all kinds on) |
| N12 | Filter | radiogroup "Lọc thông báo": Tất cả / Chưa đọc / Nhắc đến tôi, ArrowRight wraps | `NC:322-328`, `NM:109-118`, `UNC:325-334` | M bell · E filters | covered |
| N13 | Button | "Đánh dấu đã đọc" + toast "Hoàn tác" → no POST | `NC:187-198`, `UNC:687-715` | M mark-read + undo (F2 fixed) · U `U02_notif_row_hover` | covered (data-dependent: both skip with reason until the admin has notifications (Phase 3 / CP-5)) |
| N14 | Logic | POST `/read` at the end of the 8 s window even with the toast hovered; late "Hoàn tác" ignored | `UNC:672-708`, `UT:45-77`, `TST:66-70, 128-129`, `NH:68-69` | E mark one read | covered (data-dependent) |
| N15 | Button | "Đánh dấu tất cả đã đọc" with unread: rows read at once, ONE `POST /read` with the visible ids after 8 s, no `read-all`; persisted | `UNC:644-647, 687-708, 793-798` | X mark all (2 real unread) · M mark-all + undo (`06_notif_mark_all`) · E mark all | covered (send path; undo path stays in E) |
| N16 | Error | mark-read POST 500 → rollback (row unread, badge back) + "Có thể chưa cập nhật" | `UNC:598-611, 678, 881`, `createOptimisticMutation.ts:54-58` | X [mocked response] POST /read 500 | covered (unpairable: 5xx) |
| N17 | Navigation | unread row click → immediate `POST /read {ids:[id]}` → `/projects/{id}/settings` → drawer closed; read after reload | `UNC:726-738`, `NCG:96-101, 135-136`, `PS:93` | X row click in the drawer · E clicking a notification | covered (real; E's admin version is data-dependent) |
| N18 | Button | "chấp nhận" → `POST /api/notifications/{id}/accept-invite` `{}` 200, drawer and route kept, row read, badge cleared; idempotent | `NCG:178-184, 297-302`, `UNC:613-632, 755-765`, `NC:231-236`, BE `notifications/service.py:191-210` | X "chấp nhận" | covered (real) |
| N18b | Button | "Xem kết quả" / "xem lỗi" / "Xem bình luận" navigate | `NCG:180-183`, `UNC:757-759` | — | gap (aiCompleted / violationFound / commentMention need Phase 3/4 data) |
| N19 | Button | "Mở cài đặt thông báo" → `/tai-khoan`, drawer closes | `UNC:772-775` | E settings | covered |
| N20 | Button | "Xem tất cả" → `/thong-bao` | `UNC:767-770` | E "Xem tất cả" | covered |
| N21 | Keyboard | Esc closes, focus back to the bell | `DRW:74-95` | E badge | covered |
| N22 | Backdrop | click outside closes | `DRW:131-141` | E badge | covered |
| N23 | Route | `/thong-bao` pinned open; Esc → `navigate(-1)` or `/` (direct load) | `NCC:195-223` | M route · U `U02_notif_route` · E "Xem tất cả" (history) | covered (BUG-143 fixed) |
| N24 | Route | `/thong-bao` → "Xem tất cả" → Esc must still leave | `NCC:202-221` | E on /thong-bao | covered (F4 suspected) |
| N25 | Route | row click on `/thong-bao` (direct load) lands on the target and the 180 ms close does not bounce to `/` | `NCC:198-218`, `NC:221-229` | X row click on /thong-bao | covered (real) |
| N26 | Compact | < 1024 bottom sheet, "Mức 1–3" (`aria-pressed`), heights 88 px / 40 % / 90 % | `DRW:27-33, 70, 196-260` | E compact | covered |
| N27 | Error | crash fallback card | `NCC:64-79` | — | UNKNOWN — NEED VERIFICATION (not producible) |
| N28 | Keyboard | Enter on the bell → focus on "Đánh dấu tất cả đã đọc"; Shift+Tab wraps to "Xem tất cả", Tab wraps back; Tab reaches a row; focus-within reveals "Đánh dấu đã đọc"; Enter opens the row | `FT:126-133, 183`, `NC:161-169, 187-192` | X keyboard | covered |
| N29 | UI | gear tooltip placed while the drawer slides: with nothing unread the gear gets the opening focus; tooltip must sit on the gear, no horizontal scroll (BUG-114) | `NC:239, 313-318`, `FT:39-44, 183`, `IB:58-63`, `TT:37-63`, `DRW:118-120` | X BUG-114 | covered (expected to fail while BUG-114 is open) |
| N30 | Logic | mark one read then leave for `/thong-bao` inside the window → POST still sent once at ~8 s (gateway path), row read on the route after invalidation | `UNC:649-652, 672-685` | X leave then sent | covered (route instance may show the row unread meanwhile, `UNC:455-458` — recorded, not asserted) |
| N31 | Logic | mark one read, leave, "Hoàn tác" on the app-wide toast → nothing sent, row unread on the server | `UNC:696-705`, `TST:95-104` | X leave then undo | covered |
| N32 | Responsive | `/thong-bao` at 1440 / 1024 after the slide: 400 px panel, 8 px from the right edge, filters + "Xem tất cả" on screen, no horizontal scroll (BUG-124) | `DRW:67, 70, 158-159`, `NCC:223` | X BUG-124 1440 · X BUG-124 1024 | covered (expected to fail while BUG-124 is open) |
| N33 | Responsive | `/thong-bao` at 375 after the slide: sheet full width, 90 % height, title on one line, snap targets ≥ 24 px (BUG-125, BUG-137 settle) | `DRW:33, 72, 195-260`, `NC:295-299` | X BUG-125/137 375 | covered |
| N34 | Navigation | `/thong-bao` → "Xem tất cả" → Esc must still leave (BUG-113) | `NCC:202-221` | E on /thong-bao | covered in E — not duplicated here |
| N35 | Pagination | "Xem thêm" / paging | `NCG:274-280` (one bare array, no cursor), BE `notifications/router.py:25-29` | — | n/a-by-design (no paging in FE or BE) |

## SCR-07 — Onboarding `/onboarding`

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| O1 | Navigation | seen flag `appfront:onboarding-welcome-seen:<uid>` → redirect `/` | `WSC:136-142`, `UWS:164, 180-187` | M onboarding | covered |
| O2 | Display | greeting from the user's name ("Chào {fullName}, bắt đầu trong ba bước") | `UWS:301-305` | X no project · M (regex) · E cards | covered (invitee's real name) |
| O3 | Cards | states from the newest project: 1 done, 2 open, 3 locked "Cần tải bản vẽ trước." (`aria-describedby`) | `UWS:222-228, 268-273, 345-396`, `WS:200-242` | M onboarding cards (`07_onboard_cards`) · E cards | covered |
| O4 | Cards | 2 done / 3 open / all done → "Vào danh sách dự án" + flag set automatically | `UWS:294-297, 435-438`, `WS:316-320` | — | gap (needs a project with walls / fully reviewed — Phase 3/4 data) |
| O5 | Button | card 1 "Tạo dự án" opens the create dialog on `/onboarding` | `UWS:317-323`, `WSC:82-103` | U `U02_onboarding_create_dialog` · E card 1 | covered (UI layer) |
| O6 | Button | "Tải bản vẽ" → `/projects/{newest}/upload`, flag not set | `UWS:325-328, 294-297` | M onboarding cards · E cards | covered |
| O7 | Button | "Duyệt kết quả" → walls / floors | `UWS:330-339` | — | gap (needs walls > 0, Phase 3) |
| O8 | Link | "Xem dự án mẫu" → `/`, flag not set, screen shows again | `UWS:341-343, 405-408` | E links | covered |
| O9 | Link | "Xem hướng dẫn 2 phút" `aria-disabled` + reason, Enter does nothing | `WS:150-185`, `UWS:413-420` | E links | covered |
| O10 | Link | "Bỏ qua" (+ note "Màn chào sẽ không hiện lại…") sets the flag → `/` | `UWS:400-403`, `WS:336-341` | M skip · E links · E double skip | covered |
| O11 | Logic | double click "Bỏ qua" → one navigation | `UWS:256-264` | E double skip | covered |
| O12 | Loading | busy cards (`role=status aria-busy`), links hidden | `WS:245-257, 322` | E [mocked response] N1 held then 500 | covered |
| O13 | Error | "Không đọc được tiến độ" + description + "Thử lại" | `WS:67, 294-301`, `UWS:145, 449` | E [mocked response] | covered |
| O14 | Forbidden | viewer: only card 3, note | `UWS:277-282, 389-394`, `WS:312-314` | Phase 09 | n/a-by-design (Phase 09) |
| O15 | Compact | cards stack below 1024 | `WS:88-93` | E compact | covered |
| O16 | Empty | no project: card 1 open, "Tải bản vẽ" locked "Cần tạo dự án trước.", "Duyệt kết quả" locked "Cần tải bản vẽ trước.", no finish button, flag not set | `UWS:268-273, 285, 294-297, 345-396`, `WS:228-237, 316` | X no project (real) · U `U02_onboarding_no_project` [mocked response] | covered (real user, no mock) |
| O17 | Storage | `localStorage` throwing → treated as not seen | `UWS:180-198` | — | n/a-by-design (private-window only) |
| O18 | Error | crash fallback | `WSC:59-73` | — | UNKNOWN — NEED VERIFICATION (not producible) |
| O19 | Storage | seen flag is per user: another user's key does not hide the screen; "Bỏ qua" writes only `prefix+ownId`; direct load then redirects to `/` | `UWS:164-198, 400-403`, `WSC:136-142` | X seen flag per user | covered |
| O20 | a11y | quiet links at 375: Tab order sample → tutorial (aria-disabled) → skip; targets ≥ 24 × 24 px (BUG-127); Enter on "Bỏ qua" → `/` | `WS:149-185, 322-341`, WCAG 2.2 SC 2.5.8 | X BUG-127 | covered (size part expected to fail while BUG-127 is open) |
| O21 | Logic | create a project from card 1 on `/onboarding` → cards should move to "card 1 done" | `WSC:82-103`, `CPC:101-111` (no N1 invalidation, F3) | — | UNKNOWN — NEED VERIFICATION (intended refresh not stated in source) |

## Mocked UI tests and their API pair

| Test | Response faked | Pair |
|---|---|---|
| E SCR-05 [mocked response] N1 fails (500) | `GET /api/project-summaries` 500 | unpairable: 5xx not producible on the shared stack |
| E SCR-05 [mocked response] no project | `GET /api/project-summaries` 200 `{items: []}` | paired: `phase02_dashboard_api.spec.ts` "A02 · fresh engineer" (`A02_fresh_summaries_default.json`) |
| E SCR-05 [mocked response] one row the client cannot decode | real body + 1 invalid row (>= 4 readable, F9) | unpairable: the BE never emits a row failing the FE's strict decode |
| E SCR-05 [mocked response] rename answered 500 | `PATCH /api/projects/:id` 500 | unpairable: 5xx |
| E SCR-05 [mocked response] rename refused 403 FORBIDDEN | `PATCH /api/projects/:id` 403 `{code: FORBIDDEN}` | paired: A "A02 · role/owner matrix" `role_viewer_member_patch_403` |
| E SCR-05 [mocked response] delete refused 403 FORBIDDEN | `DELETE /api/projects/:id` 403 | paired: same test, `role_viewer_member_delete_403` |
| E SCR-05 [mocked response] delete answered 500 | `DELETE /api/projects/:id` 500 (then real 200) | unpairable: 5xx |
| E SCR-05 [mocked response] status routing | N1 with 2 fixture rows turned qc / done | unpairable now: needs Phase 3/4 data (upload + reviewed walls); re-pair after CP-5 |
| E SCR-05 [mocked response] offline while the list loads | N1 aborted (`internetdisconnected`) | unpairable: network loss |
| E SCR-05 [mocked response] N1 held then 500 | N1 500 (retry read real, held) | unpairable: 5xx |
| E SCR-05 [mocked response] N1 over two cursor pages | real N1 split into 2 pages with a fake `nextCursor` | paired: A "A02 · N1: … id ASC cursor paging" |
| E SCR-05 [mocked response] N1 page 2 answers 422 CURSOR_INVALID | page 2 → 422 `{code: CURSOR_INVALID}` | paired: A "A02 · N1: … forged cursor → 422 CURSOR_INVALID" |
| E wizard [mocked response] network lost on create | `POST /api/projects` aborted | unpairable: network loss |
| E SCR-06 [mocked response] list read held then 500 | `GET /api/notifications` 500 | unpairable: 5xx |
| E SCR-07 [mocked response] N1 held then 500 | `GET /api/project-summaries` 500 | unpairable: 5xx |
| U `U02_dash_load_error` | `GET /api/project-summaries` 500 | unpairable: 5xx |
| U `U02_dash_empty` | `GET /api/project-summaries` 200 `{items: []}` | paired: "A02 · fresh engineer" |
| U `U02_dash_partial` | real N1 + readable fillers + one row with id `not-a-project-id` | unpairable: the BE never emits a row failing the strict decode |
| U `U02_notif_load_error` | `GET /api/notifications` 500 | unpairable: 5xx |
| U `U02_onboarding_no_project` | `GET /api/project-summaries` 200 `{items: []}` | paired: "A02 · fresh engineer" |
| EW create 500 | `POST /api/projects` 500 | unpairable: 5xx |
| EW create 503 once | `POST /api/projects` 503 once, then real (same `Idempotency-Key`) | unpairable: 5xx |
| EW network abort on the first create attempt | `POST /api/projects` aborted once, then real | unpairable: network loss |
| X POST /read fails (500) | `POST /api/notifications/read` 500 | unpairable: 5xx |

"[held response]" tests (SCR-05 loading in E and U, wizard create in E and EW) use the real response, only delayed — not mocks.
X and its N/O rows use a second real user (invitee made through the real invitation mail), no mocks except the one above.

## Summary

- FE rows: **208** (SCR-05 dashboard 78, wizard 73, SCR-06 36, SCR-07 21) — covered **182**, gap **3**, UNKNOWN **8**, n/a-by-design **15**.
  Per screen (covered / gap / UNKNOWN / n/a): dashboard 70 / 0 / 2 / 6 · wizard 65 / 0 / 3 / 5 · SCR-06 32 / 1 / 1 / 2 · SCR-07 15 / 2 / 2 / 2.
- BE rows: see `coverage/phase02-be.md` (separate agent).
- Tests per spec: `phase02_dashboard.spec.ts` 16 · `phase02_dashboard_ui.spec.ts` 33 · `phase02_dashboard_edge.spec.ts` 69 (68 runnable
  + 1 fixme) · `phase02_wizard_edge.spec.ts` 27 · `phase02_notify_edge.spec.ts` 19 · `phase02_dashboard_api.spec.ts` 26 (API layer).
- Mocked share: 24 mocked of 164 phase-02 UI tests (16 M + 33 U + 69 E + 27 EW + 19 X) = **14.6 %** (limit 35 %). By file: U 5, E 15, EW 3,
  X 1, M 0. Pairing: 7 paired with an API test, 17 unpairable with reason, 0 pair needed (one API test: user with no project → `items: []`,
  covers E no project, U `U02_dash_empty`, U `U02_onboarding_no_project`).
- Open gaps, by priority: (main flow) O4 / O7 later onboarding steps (2 done / 3 open / "Duyệt kết quả"), N18b inline actions
  "Xem kết quả" / "xem lỗi" / "Xem bình luận" — all blocked by Phase 3/4 data (re-run after CP-5); #55 / #26 qc and done open routes are
  covered by mock only (re-pair with a real click after CP-5). UNKNOWN (need verification): #12, W40, N27, O18 crash fallbacks (not producible),
  W27 overlap alert (no input path), W73 cap message (no copy in source), #54 telemetry beacon (`test.fixme`), O21 onboarding refresh after create.
  Closed in this pass: #3, #41, #42, #48, #55, W41, N6, N16, N18 (accept), N25, O16.
- Run notes: nothing run yet. Test-side bugs fixed in the specs, not yet run: BUG-139 (`columnheader` role, M/U table), BUG-140
  (`endsWithCount` regex via `String.raw`), BUG-141 (wait registered after `goto`/`reload`: local `gotoThenApi` in M, `navigateAndWaitForApi` in E;
  shared `apiWatch.ts` untouched), BUG-142 (unreadable-row mock: explicit fulfil + >= 4 readable rows, see F9), BUG-143 (`settled()` before
  measuring drawers / sheets / modals), F1 (menu label `Tuỳ chọn`), F2 (page-rooted `has`); also BUG-134/135/136/137 evidence shots in E.
  F3/F4/F5/F9 are suspected product bugs the edge tests should expose. Expected failures while the bugs are open: BUG-133, 122, 132,
  120, 121, 123, 110, 129 x2 and the 50-floor cap with basement (W53) in EW; BUG-114, 124 x2, 125, 127 in X; #59 (double "Xoá dự án") and #73
  (Enter on "Tuỳ chọn cho {name}") in E. Open unknowns for the first run: `settled()` relies on framer-motion leaving a still box;
  BUG-110 at 375 may stop `U02_dash_create_toast` / `U02_wizard_server_422` / `U02_wizard_review_long_name` before step 3.
