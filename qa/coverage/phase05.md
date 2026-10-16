<!-- qa-sources fe=d50bb248 be=dc510655 -->
# Phase 05 - 3D (Pascal): FE coverage inventory

Scope after F-15: SCR-23 Pascal viewer `/projects/:p/3d` (`PascalViewerRoute`, Pascal `<Editor>` in a second React root;
`Viewer3D/` is unrouted) with its side panels 23R (Dien tich phong), 23F (Thu vien do dac), 23H (Lich su thao tac);
SCR-24 `/3d/exploded` and SCR-26 `/3d/pascal` are redirects to `/3d`; SCR-25 Measurement Tool `/3d/measure` (on ViewerShell);
SCR-27 Mobile Viewer `/m/du-an/:p` (Pascal `mode:'view'`); X5 cross-screen roles. 23W (wall geometry editor) has no route
after F-15: 18 catalog rows, all n/a. FE source: AppFront master `d50bb248`. Backend rules: `coverage/phase05-be.md`.

This file does not copy the catalog. Row text, expected values, app-source `file:line` and the row -> step reverse index are in
`F:/App/AppBack/backend/dieu-phoi/chay/QA-05c/`: `catalog-C1..C5.md` (rows), `flows-C1..C5.md` (flows, reverse index),
`packs.md`, `coverage-ids.txt` (779 ids = 735 FE steps + 44 pytest ids). Each FE id is exactly one `test.step('[<id>] ...')`:
`grep -n "\[<id>\]" qa/tests/phase05_*.spec.ts`. All `file:line` below were read from the specs of this branch (`qa/phase05`).

Test files (under `qa/tests/`, helpers in `qa/tests/support/p05/`):
- **pipeline** `phase05_pipeline.spec.ts` - main chain, serial (FL-M-23-01 / 02).
- **viewer** `phase05_viewer_{edge,mocked_edge,ui}.spec.ts` - SCR-23 shell, SCR-24, SCR-26.
- **panels_a** `phase05_panels_a_{edge,mocked_edge,ui}.spec.ts` - 23R + 23F. **panels_b** `phase05_panels_b_{edge,mocked_edge,ui}.spec.ts` - 23H.
- **measure** `phase05_measure_{edge,mocked_edge,ui}.spec.ts` - SCR-25. **mobile** `phase05_mobile_{edge,mocked_edge,ui}.spec.ts` - SCR-27.
- **roles** `phase05_roles_edge.spec.ts` - FL-27-11 and X5.
- API specs `phase05_3d_api.spec.ts`, `phase05_3d_viewer_api.spec.ts` - see `phase05-be.md`.
- Layers: `edge` = real stack; `mocked` = `[mocked response]` (own `_mocked_edge` file or FL-xx-U mock flow, pair listed below);
  `ui` = `verifyUi` at 4 widths. `e2e/pascal-viewer.spec.ts` and `e2e/v9/exploded.spec.ts` (outside `qa/`) are NOT counted.

Reading the tables: `rows` / `n/a` come from the catalog summary of the screen, `needed` = rows - n/a = ids in `coverage-ids.txt`,
`covered-by` = number of those ids that have a `test.step` in each spec (static count, no run result). n/a rows are dead AppFront
code, vendor-only behaviour or negative source facts, each with a reason in the catalog.
The previous inventory (fa991a0d) described the old `Viewer3D` and paired mocks by stale line numbers; it is replaced (BUG-391, BUG-496).

## SCR-23 Pascal viewer (`/projects/:p/3d`)

| SCR | rows | n/a | needed | covered-by |
|---|---|---|---|---|
| SCR-23 | 128 | 5 | 123 | 123/123 steps: pipeline 9; viewer_edge 80; viewer_mocked_edge 22; viewer_ui 12 |

| Flow | Test (file:line) | Layer | Steps | Title |
|---|---|---|---|---|
| FL-M-23-01 | `phase05_pipeline.spec.ts:114` | pipeline | 6 | open /3d: mount, render, pixels, CSP |
| FL-M-23-02 | `phase05_pipeline.spec.ts:168` | pipeline | 3 | Pascal edit → PUT layer → reload keeps it |
| FL-23-01 | `phase05_viewer_edge.spec.ts:165` | edge | 14 | open, header, summary, no exit, no writes, presence overlay |
| FL-23-02 | `phase05_viewer_edge.spec.ts:280` | edge | 8 | collapse / expand, keys E and R, mount once, help dialog |
| FL-23-03 | `phase05_viewer_edge.spec.ts:367` | edge | 7 | history side panel: click, Ctrl+H, Esc order |
| FL-23-04 | `phase05_viewer_edge.spec.ts:432` | edge | 8 | autosave timing, flush, announcer, undo / redo |
| FL-23-05 | `phase05_viewer_edge.spec.ts:526` | edge | 5 | delete through the gate: admitted, mass delete, missing confirm, template button |
| FL-23-06 | `phase05_viewer_edge.spec.ts:578` | edge | 5 | room selection, template, vendor chrome a11y, wall height rule |
| FL-23-07 | `phase05_viewer_edge.spec.ts:640` | edge | 4 | measurement tool, delete toast, Esc conflicts |
| FL-23-08 | `phase05_viewer_edge.spec.ts:701` | edge | 4 | grid snap chips (S20) |
| FL-23-09 | `phase05_viewer_edge.spec.ts:749` | edge | 4 | offline, no-change, 409 from a second writer |
| FL-23-10 | `phase05_viewer_edge.spec.ts:796` | edge | 4 | empty project |
| FL-23-11 | `phase05_viewer_edge.spec.ts:832` | edge | 4 | furniture-only graph, level count, project switch, bundle once |
| FL-23-12 | `phase05_viewer_edge.spec.ts:870` | edge | 6 | viewer member read-only |
| FL-23-13 | `phase05_viewer_edge.spec.ts:934` | edge | 4 | engineer saves, revision chain, echo, demotion |
| FL-23-14 | `phase05_viewer_edge.spec.ts:985` | edge | 7 | access: non-member, unknown id, anonymous (all three routes) |
| FL-23-15 | `phase05_viewer_mocked_edge.spec.ts:105` | mocked | 6 | [mocked response] bundle loading, PASCAL-01, retry URLs — pairs with FL-M-23-01 (real mount) |
| FL-23-16 | `phase05_viewer_mocked_edge.spec.ts:173` | mocked | 7 | [mocked response] converter / root failures, no GPU, flag, partial, template 500 — pairs with FL-23-01, FL-... |
| FL-23-17 | `phase05_viewer_mocked_edge.spec.ts:304` | mocked | 5 | [mocked response] project gate: loading, 500, abort, refresh banner — pairs with FL-23-01 / FL-23-14 |
| FL-23-18 | `phase05_viewer_mocked_edge.spec.ts:381` | mocked | 5 | [mocked response] save failures on #35 — pairs with FL-M-23-02 / FL-23-09 |
| FL-23-U1 | `phase05_viewer_ui.spec.ts:83` | ui | 5 | rendered states |
| FL-23-U2 | `phase05_viewer_ui.spec.ts:167` | mocked | 4 | [mocked response] loading / partial / error / gate error — pairs with FL-23-U1 |
| FL-23-U3 | `phase05_viewer_ui.spec.ts:231` | ui | 4 | empty, 404, exploded, viewer |

Mock -> real pairing (each `[mocked response]` flow; the real flow shows the same state on the live stack):

| Mocked flow (file:line) | `[mocked response]` steps (id@line: response) | Real pair (file:line) |
|---|---|---|
| FL-23-15 `phase05_viewer_mocked_edge.spec.ts:105` | `23-B-002`@111: bundle held →<br>`23-E-004`@121: skeleton is aria-hidden and stops pulsing under reduced motion<br>`23-B-010`@133: reload with the bundle aborted → PASCAL-01 card with<br>`23-E-015`@143: Tab reaches<br>`23-B-011`@154: that request carries attempt=1, still PASCAL-01<br>`23-B-012`@160: bundle back, R → attempt=2 200, rendered | FL-M-23-01 `phase05_pipeline.spec.ts:114` |
| FL-23-16 `phase05_viewer_mocked_edge.spec.ts:173` | `23-B-014`@178: toPascal chunk aborted once → PASCAL-01;<br>`23-B-015`@206: Pascal sub-chunk aborted after mount →<br>`23-B-016`@225: ⚑ no GPU → AppFront card<br>`26-A-008`@241: feature flag scene.pascal-viewer:false no longer blocks<br>`23-B-006`@257: N15 + 1 dimension → partial:<br>`23-B-007`@266: N15 + 3 dimensions + 1 note → one line per kind<br>`23-G-009`@280: POST property-templates 500 on a selected room → | FL-23-01 `phase05_viewer_edge.spec.ts:165`<br>FL-23-06 `phase05_viewer_edge.spec.ts:578` |
| FL-23-17 `phase05_viewer_mocked_edge.spec.ts:304` | `23-B-001`@312: N15 delayed →<br>`23-B-019`@323: #24 500 →<br>`23-B-020`@334: N15 500,<br>`23-B-021`@355: N15 aborted →<br>`23-B-022`@364: stale refetch 500 after leaving to rules and back → | FL-23-01 `phase05_viewer_edge.spec.ts:165`<br>FL-23-14 `phase05_viewer_edge.spec.ts:985` |
| FL-23-18 `phase05_viewer_mocked_edge.spec.ts:381` | `23-B-025`@402: PUT 503 →<br>`23-B-026`@411: next edit after the temporary failure saves (PUT 200,<br>`23-B-030`@427: PUT 422 issues rooms.0.name →<br>`23-B-031`@433: PUT 422 LAYER_INTEGRITY_BROKEN count 2 →<br>`23-B-032`@438: PUT 400 → | FL-M-23-02 `phase05_pipeline.spec.ts:168`<br>FL-23-09 `phase05_viewer_edge.spec.ts:749` |
| FL-23-U2 `phase05_viewer_ui.spec.ts:167` | `23-F-001`@177: bundle held → loading<br>`23-F-003`@190: N15 + dimensions → partial box<br>`23-F-005`@202: bundle aborted → PASCAL-01<br>`23-F-010`@214: N15 500 → gate error | FL-23-U1 `phase05_viewer_ui.spec.ts:83` |

## SCR-23 side panels 23R (Dien tich phong) and 23F (Thu vien do dac)

| SCR | rows | n/a | needed | covered-by |
|---|---|---|---|---|
| SCR-23R | 109 | 8 | 101 | 101/101 steps: panels_a_edge 91; panels_a_mocked_edge 2; panels_a_ui 8 |
| SCR-23F | 60 | 3 | 57 | 57/57 steps: panels_a_edge 52; panels_a_ui 5 |

| Flow | Test (file:line) | Layer | Steps | Title |
|---|---|---|---|---|
| FL-23R-01 | `phase05_panels_a_edge.spec.ts:130` | edge | 11 | thanh icon + khung bảng Diện tích phòng |
| FL-23R-02 | `phase05_panels_a_edge.spec.ts:224` | edge | 11 | hàng phòng Q1: dòng phụ, chọn/rê, sao chép, công năng |
| FL-23R-03 | `phase05_panels_a_edge.spec.ts:313` | edge | 15 | RA1: thu gọn → mở rộng, sắp xếp, tổng (oracle) |
| FL-23R-04 | `phase05_panels_a_edge.spec.ts:436` | edge | 11 | RA1: lọc tầng + mở bảng toàn trang |
| FL-23R-05 | `phase05_panels_a_edge.spec.ts:545` | edge | 8 | RA1: toàn trang sắp/sao chép/Esc + chỉ đọc |
| FL-23R-06 | `phase05_panels_a_edge.spec.ts:636` | edge | 12 | RA1: đổi tên → lưu → hoàn tác → tải lại → 409 |
| FL-23R-07 | `phase05_panels_a_edge.spec.ts:764` | edge | 11 | RA1: đổi tên — các nhánh cạnh, phím, đặt đồ |
| FL-23R-08 | `phase05_panels_a_edge.spec.ts:916` | edge | 5 | RA2: một phần, lỗi, rò lọc tầng, thứ tự nhóm |
| FL-23R-09 | `phase05_panels_a_edge.spec.ts:969` | edge | 4 | RA3: rỗng + kiểm khe hở tường |
| FL-23RF-01 | `phase05_panels_a_edge.spec.ts:1015` | edge | 6 | vai xem trên cả hai bảng |
| FL-23RF-02 | `phase05_panels_a_edge.spec.ts:1082` | edge | 5 | kỹ sư: đổi tên, dải phát hiện, kéo thả, rồi bị hạ vai |
| FL-23F-01 | `phase05_panels_a_edge.spec.ts:1168` | edge | 15 | Thư viện: mở, ảnh, chip (oracle) |
| FL-23F-02 | `phase05_panels_a_edge.spec.ts:1272` | edge | 15 | Thư viện: tìm kiếm (oracle) |
| FL-23F-03 | `phase05_panels_a_edge.spec.ts:1384` | edge | 14 | Thư viện: dải "Đã phát hiện" → xem trước → áp → hoàn tác |
| FL-23R-M1 | `phase05_panels_a_mocked_edge.spec.ts:44` | mocked | 2 | [mocked response] đổi tên khi PUT đứt mạng / 500 — cặp thật FL-23R-06 bước 4 (23R-G-001) |
| FL-23R-U1 | `phase05_panels_a_ui.spec.ts:94` | ui | 4 | RA1: bảng thu gọn → mở rộng → đổi tên → toàn trang |
| FL-23R-U2 | `phase05_panels_a_ui.spec.ts:172` | ui | 2 | RA2: một phần → lỗi |
| FL-23R-U3 | `phase05_panels_a_ui.spec.ts:211` | ui | 1 | RA3: rỗng + kiểm khe hở |
| FL-23RF-U1 | `phase05_panels_a_ui.spec.ts:237` | ui | 2 | vai xem |
| FL-23F-U1 | `phase05_panels_a_ui.spec.ts:277` | ui | 4 | FX: lưới → chọn thẻ → xem trước → tìm rỗng |

Mock -> real pairing (each `[mocked response]` flow; the real flow shows the same state on the live stack):

| Mocked flow (file:line) | `[mocked response]` steps (id@line: response) | Real pair (file:line) |
|---|---|---|
| FL-23R-M1 `phase05_panels_a_mocked_edge.spec.ts:44` | `23R-G-007`@57: PUT aborted (network loss),<br>`23R-G-008`@65: PUT 500, | `23R-G-001`@679 `phase05_panels_a_edge.spec.ts:679` (FL-23R-06) |

## SCR-23 side panel 23H (Lich su thao tac); 23W is unrouted

| SCR | rows | n/a | needed | covered-by |
|---|---|---|---|---|
| SCR-23H | 70 | 23 | 47 | 47/47 steps: panels_b_edge 38; panels_b_mocked_edge 4; panels_b_ui 5 |

| Flow | Test (file:line) | Layer | Steps | Title |
|---|---|---|---|---|
| FL-23H-01 | `phase05_panels_b_edge.spec.ts:84` | edge | 11 | rail một tab, mở lần đầu (chunk muộn, 0 API), trạng thái rỗng, đóng bằng tab |
| FL-23H-02 | `phase05_panels_b_edge.spec.ts:179` | edge | 15 | phím và bộ lọc: Ctrl+H, chip, combobox người, Esc nhiều lớp |
| FL-23H-03 | `phase05_panels_b_edge.spec.ts:322` | edge | 6 | Esc thu khung, đặt lại bộ lọc, reload, tách tầng, ⚑ lượt sửa Pascal vào lịch sử |
| FL-23H-04 | `phase05_panels_b_edge.spec.ts:392` | edge | 6 | vai và trạng thái không có cột bảng |
| FL-23H-05 | `phase05_panels_b_mocked_edge.spec.ts:60` | mocked | 4 | [mocked response] Pascal đang nạp / lỗi và chunk bảng chậm / hỏng |
| FL-23H-06 | `phase05_panels_b_ui.spec.ts:52` | ui | 5 | bảng lịch sử ở 4 khổ |

Mock -> real pairing (each `[mocked response]` flow; the real flow shows the same state on the live stack):

| Mocked flow (file:line) | `[mocked response]` steps (id@line: response) | Real pair (file:line) |
|---|---|---|
| FL-23H-05 `phase05_panels_b_mocked_edge.spec.ts:60` | `23H-B-014`@73: Pascal still loading: the rail is there and the tab opens the panel ov...<br>`23H-B-001`@84: slow panel chunk →<br>`23H-B-013`@92: PASCAL-01 →<br>`23H-B-011`@102: ⚑ panel chunk lost → only the panel reports it; the 3D screen stays | `23H-A-003`@105 `phase05_panels_b_edge.spec.ts:105` (FL-23H-01)<br>`23H-A-004`@115 `phase05_panels_b_edge.spec.ts:115` (FL-23H-01)<br>`e2e/pascal-viewer.spec.ts:703` (outside `qa/`, not counted) |

## SCR-24 Exploded View and SCR-26 Pascal Viewer (both redirect to `/3d`)

| SCR | rows | n/a | needed | covered-by |
|---|---|---|---|---|
| SCR-24 | 14 | 0 | 14 | 14/14 steps: viewer_edge 13; viewer_ui 1 |
| SCR-26 | 8 | 0 | 8 | 8/8 steps: viewer_edge 7; viewer_mocked_edge 1 |

| Flow | Test (file:line) | Layer | Steps | Title |
|---|---|---|---|---|
| FL-24-01 | `phase05_viewer_edge.spec.ts:1053` | edge | 10 | exploded redirect and level mode |
| FL-26-01 | `phase05_viewer_edge.spec.ts:1158` | edge | 6 | /3d/pascal keeps query and hash |

## SCR-25 Measurement Tool (`/projects/:p/3d/measure`)

| SCR | rows | n/a | needed | covered-by |
|---|---|---|---|---|
| SCR-25 | 207 | 10 | 197 | 190/197 steps: 3d_viewer_api 10; measure_edge 152; measure_mocked_edge 14; measure_ui 14 |

| Flow | Test (file:line) | Layer | Steps | Title |
|---|---|---|---|---|
| FL-25-01 | `phase05_measure_edge.spec.ts:165` | edge | 15 | open on two storeys: landmarks, top bar, status, corner controls, empty list |
| FL-25-02 | `phase05_measure_edge.spec.ts:282` | edge | 15 | storeys, separation, tool rail, shortcut sheet |
| FL-25-03 | `phase05_measure_edge.spec.ts:439` | edge | 15 | camera: presets, ViewCube, 2D, zoom, wheel, double-click, keys |
| FL-25-04 | `phase05_measure_edge.spec.ts:582` | edge | 4 | pan, minimap, focus rings, reduced motion |
| FL-25-05 | `phase05_measure_edge.spec.ts:630` | edge | 14 | point-to-point: snap chip, draft, pin, id and value oracle |
| FL-25-06 | `phase05_measure_edge.spec.ts:765` | edge | 12 | keyboard pin, one send, every way a draft is dropped |
| FL-25-07 | `phase05_measure_edge.spec.ts:904` | edge | 9 | height, perpendicular, floor area, third click |
| FL-25-08 | `phase05_measure_edge.spec.ts:1013` | edge | 4 | unsnapped picks and projection edges |
| FL-25-09 | `phase05_measure_edge.spec.ts:1058` | edge | 15 | seeded list: units, area, count, hover, hide, reload |
| FL-25-10 | `phase05_measure_edge.spec.ts:1188` | edge | 5 | collapse and re-open |
| FL-25-11 | `phase05_measure_edge.spec.ts:1236` | edge | 9 | delete, undo, Delete key, ids across deletes |
| FL-25-12 | `phase05_measure_edge.spec.ts:1334` | edge | 4 | another session: id taken, undo conflict, deleted elsewhere |
| FL-25-13 | `phase05_measure_edge.spec.ts:1410` | edge | 5 | point budget: limit, no retry, 201-point draft, room freed |
| FL-25-14 | `phase05_measure_edge.spec.ts:1485` | edge | 6 | keyboard and AT semantics |
| FL-25-15 | `phase05_measure_edge.spec.ts:1548` | edge | 8 | viewer member: read-only but can measure |
| FL-25-16 | `phase05_measure_edge.spec.ts:1627` | edge | 4 | engineer member, then role lost while open |
| FL-25-17 | `phase05_measure_edge.spec.ts:1702` | edge | 4 | gate and auth |
| FL-25-18 | `phase05_measure_edge.spec.ts:1752` | edge | 4 | empty and partial projects |
| FL-25-M1 | `phase05_measure_mocked_edge.spec.ts:65` | mocked | 4 | [mocked response] #16 read failures — pairs FL-25-01 [25-G-006] (real 200) |
| FL-25-M2 | `phase05_measure_mocked_edge.spec.ts:131` | mocked | 4 | [mocked response] write failures — pairs FL-25-05 [25-A-029], FL-25-12 [25-C-029] / [25-C-036], FL-25-11 [2... |
| FL-25-M3 | `phase05_measure_mocked_edge.spec.ts:220` | mocked | 6 | [mocked response] gate, loading, crumb name, axes — pairs FL-25-01 [25-G-001] [25-G-004] [25-B-002] |
| FL-25-U1 | `phase05_measure_ui.spec.ts:70` | ui | 6 | admin states on one project |
| FL-25-U2 | `phase05_measure_ui.spec.ts:218` | ui | 4 | read-only and gate states |
| FL-25-U3 | `phase05_measure_ui.spec.ts:309` | mocked | 4 | [mocked response] error and loading states — pairs FL-25-U1 / FL-25-01 |

Mock -> real pairing (each `[mocked response]` flow; the real flow shows the same state on the live stack):

| Mocked flow (file:line) | `[mocked response]` steps (id@line: response) | Real pair (file:line) |
|---|---|---|
| FL-25-M1 `phase05_measure_mocked_edge.spec.ts:65` | `25-B-007`@83: GET #16 -> 500: alert<br>`25-B-008`@92: unroute:<br>`25-B-009`@107: reload with the GET #16 aborted: the same alert text<br>`25-B-010`@114: reload with a record id | `25-G-006`@194 `phase05_measure_edge.spec.ts:194` (FL-25-01) |
| FL-25-M2 `phase05_measure_mocked_edge.spec.ts:131` | `25-C-031`@149: POST #17 -> 500, then aborted: toast<br>`25-C-030`@169: POST -> 409 MEASUREMENT_ID_TAKEN twice with a GET between: toast<br>`25-C-035`@189: DELETE -> 500: toast<br>`25-C-037`@199: real delete, then the undo POSTs -> 409 + 409: toast | `25-A-029`@724 `phase05_measure_edge.spec.ts:724` (FL-25-05)<br>`25-C-029`@1358 `phase05_measure_edge.spec.ts:1358` (FL-25-12)<br>`25-C-036`@1378 `phase05_measure_edge.spec.ts:1378` (FL-25-12)<br>`25-A-039`@1289 `phase05_measure_edge.spec.ts:1289` (FL-25-11) |
| FL-25-M3 `phase05_measure_mocked_edge.spec.ts:220` | `25-B-001`@238: N15 held: main aria-busy=<br>`25-B-020`@251: reload, N15 -> 500: alert<br>`25-B-021`@263: reload, N15 aborted:<br>`25-B-022`@273: SPA to the project settings and back with the second N15 -> 500: band<br>`25-G-003`@287: UNKNOWN — NEED VERIFICATION (which read is the 2nd): reload, GET /api/...<br>`25-C-016`@300: N15 answer + 2 axes (vertical x = 2000, horizontal y = 3000), top view... | `25-G-001`@175 `phase05_measure_edge.spec.ts:175` (FL-25-01)<br>`25-G-004`@182 `phase05_measure_edge.spec.ts:182` (FL-25-01)<br>`25-B-002`@203 `phase05_measure_edge.spec.ts:203` (FL-25-01) |
| FL-25-U3 `phase05_measure_ui.spec.ts:309` | `25-F-011`@320: #16 -> 500: the alert and<br>`25-F-012`@340: N15 held: the skeleton fills the viewport<br>`25-F-013`@372: N15 -> 500: the error EmptyState is centred<br>`25-F-014`@389: POST #17 -> 500: the failed-pin toast is visible | FL-25-U1 `phase05_measure_ui.spec.ts:70`<br>FL-25-01 `phase05_measure_edge.spec.ts:165` |

## SCR-27 Mobile Viewer (`/m/du-an/:p`) and X5 roles

| SCR | rows | n/a | needed | covered-by |
|---|---|---|---|---|
| SCR-27 | 126 | 11 | 115 | 115/115 steps: mobile_edge 76; mobile_mocked_edge 16; mobile_ui 16; roles_edge 7 |
| SCR-X5 | 9 | 0 | 9 | 9/9 steps: roles_edge 9 |

| Flow | Test (file:line) | Layer | Steps | Title |
|---|---|---|---|---|
| FL-27-01 | `phase05_mobile_edge.spec.ts:90` | edge | 11 | open, landmarks, wire, success, weak network |
| FL-27-02 | `phase05_mobile_edge.spec.ts:179` | edge | 11 | floors and "Chế độ xem" |
| FL-27-03 | `phase05_mobile_edge.spec.ts:285` | edge | 11 | camera and measuring |
| FL-27-04 | `phase05_mobile_edge.spec.ts:395` | edge | 14 | info sheet, snaps, keyboard |
| FL-27-05 | `phase05_mobile_edge.spec.ts:549` | edge | 5 | wall pick, partial, Esc order |
| FL-27-06 | `phase05_mobile_edge.spec.ts:605` | edge | 4 | room pick, hit targets, read-only wire |
| FL-27-07 | `phase05_mobile_edge.spec.ts:669` | edge | 4 | furniture-only model, network monitor |
| FL-27-08 | `phase05_mobile_edge.spec.ts:720` | edge | 6 | empty, long name, SPA switch |
| FL-27-09 | `phase05_mobile_edge.spec.ts:800` | edge | 5 | compact 320 |
| FL-27-10 | `phase05_mobile_edge.spec.ts:852` | edge | 5 | not found and bad routes |
| FL-27-12 | `phase05_mobile_mocked_edge.spec.ts:75` | mocked | 4 | [mocked response] loading and name fallbacks |
| FL-27-13 | `phase05_mobile_mocked_edge.spec.ts:142` | mocked | 6 | [mocked response] weak device, forbidden, ping |
| FL-27-14 | `phase05_mobile_mocked_edge.spec.ts:231` | mocked | 6 | [mocked response] gate read errors |
| FL-27-15 | `phase05_mobile_ui.spec.ts:67` | ui | 7 | model states |
| FL-27-16 | `phase05_mobile_ui.spec.ts:189` | ui | 5 | data states |
| FL-27-17 | `phase05_mobile_ui.spec.ts:257` | mocked | 4 | [mocked response] error, forbidden, loading, gate error |
| FL-27-11 | `phase05_roles_edge.spec.ts:61` | edge | 4 | desktop invite by role |
| FL-X5-01 | `phase05_roles_edge.spec.ts:122` | edge | 4 | viewer member walks /3d → /3d/measure → mobile |
| FL-X5-02 | `phase05_roles_edge.spec.ts:203` | edge | 4 | non-members get one K08 answer |
| FL-X5-03 | `phase05_roles_edge.spec.ts:273` | edge | 4 | anonymous round trip and demotion |

Mock -> real pairing (each `[mocked response]` flow; the real flow shows the same state on the live stack):

| Mocked flow (file:line) | `[mocked response]` steps (id@line: response) | Real pair (file:line) |
|---|---|---|
| FL-27-12 `phase05_mobile_mocked_edge.spec.ts:75` | `27-B-001`@83: H: M:chunk-delay → role=<br>`27-B-002`@94: M:N15-delay → floating<br>`27-A-002`@106: M:#24-blank-name →<br>`27-A-009`@114: M:N15-blank-level → floor row | FL-27-01 `phase05_mobile_edge.spec.ts:90`<br>FL-27-02 `phase05_mobile_edge.spec.ts:179` |
| FL-27-13 `phase05_mobile_mocked_edge.spec.ts:142` | `27-B-010`@151: H: M:webgl-off → weak-device layer, no canvas host<br>`27-E-009`@160: The way out is a link at least 44 px tall<br>`27-B-011`@167: <br>`27-B-012`@173: ⚑ M:mount-abort → a retry action, not only<br>`27-B-013`@188: M:refresh-roles-empty → forbidden layer, no floating note<br>`27-B-008`@198: M:ping-503 → weak-network note after the first ping | FL-27-01 `phase05_mobile_edge.spec.ts:90`<br>FL-27-11 `phase05_roles_edge.spec.ts:61` |
| FL-27-14 `phase05_mobile_mocked_edge.spec.ts:231` | `27-B-017`@239: H: M:#24-500 → read-error alert with retry, no region<br>`27-B-018`@249: Retry refetches #24 and N15, the viewer renders<br>`27-B-019`@259: Reload with M:N15-500 → the same alert<br>`27-B-020`@269: Reload with M:N15-abort →<br>`27-B-021`@282: ⚑ N15 refresh fails while the store holds the graph (SPA re-entry)<br>`27-G-003`@300: Reload with M:rule-config-500 → the viewer still reaches | FL-27-10 `phase05_mobile_edge.spec.ts:852`<br>FL-27-01 `phase05_mobile_edge.spec.ts:90` |
| FL-27-17 `phase05_mobile_ui.spec.ts:257` | `27-F-012`@275: H: weak-device error (M:webgl-off)<br>`27-F-013`@288: Forbidden (M:refresh-roles-empty)<br>`27-F-015`@300: Loading note (M:N15-delay)<br>`27-F-016`@317: Gate read error (M:#24-500) | FL-27-16 `phase05_mobile_ui.spec.ts:189`<br>FL-27-13 `phase05_mobile_mocked_edge.spec.ts:142`<br>FL-27-14 `phase05_mobile_mocked_edge.spec.ts:231` |

