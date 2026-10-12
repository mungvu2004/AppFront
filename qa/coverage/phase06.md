<!-- qa-sources fe=508f6e65 -->
# Phase 06 — Rules, export, data, versions: FE coverage inventory

Screens SCR-28 Rule Report (`/projects/:p/rules`), SCR-29 Rule Settings (`/projects/:p/rules/settings`), SCR-30 Export
Panel (`/projects/:p/export`), SCR-31 Spatial JSON Viewer (`/projects/:p/data`), SCR-32 Version History
(`/projects/:p/versions`). Source `F:/App/AppFront` @ 508f6e65. Backend rules (N21/N22 rule-config body rules and 409,
N17–N20 version list/snapshot/restore/label rules, `VERSION_FLOOR_MISMATCH`, `LAYER_INTEGRITY_BROKEN`, viewer 403,
label length 422) live in `coverage/phase06-be.md` (API spec), not here.

Test keys:
- **M** `tests/phase06_rules_export_versions.spec.ts` (serial; own pipeline project seeded in `beforeAll` via `support/drawingSeed.ts` createPipelineProject + one #35 layer write = CP-6 on its own floor, QA-06) — title quoted by key words.
- **E** `tests/phase06_rules_export_versions_edge.spec.ts` (non-serial, own project per test) — `E06 · …` titles.
- **R9** `tests/phase09_roles_matrix.spec.ts` (Track B mock, viewer / engineer).
- **UI** dedicated UI-verify spec `phase06_*_ui.spec.ts` (owner: qa-verify-ui step; not counted here).

Path short names: `RR/` = `src/screens/rules/RuleReport/`, `RS/` = `src/screens/rules/RuleSettings/`,
`EP/` = `src/screens/export/ExportPanel/`, `SJ/` = `src/screens/export/SpatialJsonViewer/`,
`VH/` = `src/screens/export/VersionHistory/`, `PSG` = `src/components/feedback/ProjectSpatialGate.tsx`,
`NF` = `src/hooks/useNumericField.ts`.

## Shared — project gate (all five routes)

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 1 | Network | `GET /api/projects/:p` + `GET /api/projects/:p/spatial` (N15) on open | `PSG:62-68`, `hooks/useProjectSpatial.ts:104-145` | M every test, E every seeded test (`openProjectRoute`) | covered |
| 2 | State | 404 project → `role=alert` "Không tìm thấy dự án này" + description | `PSG:36-38,47-60,73-75`; routes `RR/RuleReport.container.tsx:223-230`, `RS/RuleSettings.container.tsx:147-155`, `EP/ExportPanel.container.tsx:220-229`, `SJ/SpatialJsonViewer.container.tsx:227-231`, `VH/VersionHistory.container.tsx:246-252` | E "SCR-28…32 unknown project id" (all five routes) | covered |
| 3 | Navigation | "Về danh sách dự án" → `/` | `PSG:39,56` | E "SCR-28…32 unknown project id" | covered |
| 4 | Error | N15 5xx with no graph → gate EmptyState (errors.unknown) | `PSG:77-90` | — (same gate proven by `phase05_3d_viewer_edge` "[mocked response] GET …/spatial 500") | gap (P3; shared component already covered in phase 05) |
| 5 | Error | N15 refresh fails with graph loaded → "Không tải lại được mô hình." + "Thử lại" | `PSG:95-101` | — | gap (needs a 5xx after a first 200 on the same page; mock only, P3) |
| 6 | State | Route without project id → "Thiếu mã dự án" / "Không xác định được dự án" / "…bản vẽ" | `RR/RuleReport.container.tsx:67-69,199-205`, `RS/RuleSettings.container.tsx:42-44,113-123`, `EP/ExportPanel.container.tsx:86-88,181-191`, `SJ/SpatialJsonViewer.container.tsx:64-66,215-225`, `VH/VersionHistory.container.tsx:69-71,238-244` | — | n/a-by-design (router patterns always carry `:projectId`) |
| 7 | Crash | ScreenErrorBoundary fallback EmptyState from `report.description` | `RR/RuleReport.container.tsx:82-95,207-219`, `RS/RuleSettings.container.tsx:65-78`, `EP/ExportPanel.container.tsx:110-123`, `SJ/SpatialJsonViewer.container.tsx:116-129`, `VH/VersionHistory.container.tsx:117-130` | — | gap (no safe way to make a screen throw on the real stack) |

## SCR-28 Rule Report

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 8 | Layout | Breadcrumb text "Dự án › Kiểm tra luật không gian" (`nav "Đường dẫn trang"`, not links) | `RR/RuleReport.tsx:80-92` | M every SCR-28 test (heading); UI | covered (text only) |
| 9 | Button | "Chạy kiểm tra lại" → `query.refetch` (runs `runRules` in the browser, no request); `loading` spinner | `RR/RuleReport.tsx:300-304`, `RR/useRuleReport.ts:632-647` | M "Chạy kiểm tra lại shows the four summary figures", E "Chạy kiểm tra lại runs in the browser (no request)" | covered (no write / N15 re-read asserted; one `GET rule-config` seen after the click — focus refetch of the stale config query, recorded in the JSON, not asserted) |
| 10 | State | Summary strip Tổng số kiểm tra / Đạt / Cảnh báo / Vi phạm (count-up) | `RR/RuleReportSummary.tsx:55-86`, `RR/useRuleReport.ts:462-476` | M "four summary figures", E "a rule switched off through rule-config" (value), E "level filter Đạt" (Đạt = list length) | covered |
| 11 | Text | Last-run label (`formatTimestamp`) | `RR/RuleReport.tsx:288-290`, `RR/useRuleReport.ts:598-601` | M "four summary figures" (screenshot) | covered (visual only) |
| 12 | Link | "Cài đặt bộ luật" → `/rules/settings` (SPA via `onClickCapture`) | `RR/RuleReport.tsx:291-298`, `RR/RuleReport.container.tsx:153-162`, `RR/useRuleReport.ts:706` | M "Cài đặt bộ luật, Xem…", E "Back right after a toggle" (SPA nav) | covered |
| 13 | Segmented | "Lọc theo mức độ": Tất cả / Vi phạm / Cảnh báo / Đạt | `RR/RuleReportSummary.tsx:155-162`, `RR/RuleReportLabels.tsx:95-100`, `RR/useRuleReport.ts:501-518` | M "filters…" (Vi phạm, Tất cả), E "level filter Đạt…; Cảnh báo…" | covered |
| 14 | State | "Đạt" filter → passed-rule list (name + group label) / "Chưa có luật nào chạy xong mà không ra lỗi." | `RR/RuleReport.tsx:207-213`, `RR/RuleReportGroups.tsx:342-353`, `RR/useRuleReport.ts:531-552` | E "level filter Đạt lists exactly the passed rules" | covered |
| 15 | Select | "Nhóm luật" (Tất cả nhóm luật + 5 groups) | `RR/RuleReportSummary.tsx:164-175`, `RR/RuleReportLabels.tsx:74-89` | M "filters…", E "filters with no match" | covered |
| 16 | Select | "Tầng" (Tất cả các tầng + levels seen in rows) | `RR/RuleReportSummary.tsx:100-123,177-188`, `RR/useRuleReport.ts:479-499` | M "filters…" | covered |
| 17 | State | Filtered to nothing → "Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm." | `RR/RuleReport.tsx:227-233`, `RR/useRuleReport.ts:693-696` | E "filters with no match" | covered |
| 18 | State | Unfiltered, no open row → "Không còn mục nào đang mở trong danh sách này." | `RR/RuleReport.tsx:231` | — | gap (needs `ready` with zero visible rows and no filter: only reachable with resolved rows, see #22; P3) |
| 19 | Disclosure | Group expander `<h3><button aria-expanded>` title "{rule} · {group}", summary "{severity} · N mục chưa xử lý" | `RR/RuleReportGroups.tsx:78-115,297-335` | M "filters…", E "group expander by keyboard" | covered |
| 20 | Keyboard | Expander by Enter (open / close); table headers Mức độ / Mô tả / Tầng / Mã đối tượng | `RR/RuleReportGroups.tsx:91-101,239-251` | E "group expander by keyboard" | covered |
| 21 | Button | Row message → selects row (pulse) + opens ViolationDetail (`aside "Chi tiết vi phạm"`) when a floor is known | `RR/RuleReportGroups.tsx:158-170`, `RR/RuleReport.container.tsx:139-186` | M "filters, group expander, row opens ViolationDetail" | covered (ViolationDetail's own controls belong to that screen) |
| 22 | State | "Đã xử lý" group (rows gone since the previous run in this session), open by default, toggle | `RR/RuleReport.tsx:235-245,267`, `RR/RuleReportGroups.tsx:366-391`, `RR/useRuleReport.ts:433-456` | — | gap (needs the model to change under an open report and a re-run on the new graph; the store graph only refreshes on navigation, which resets the session list — P3) |
| 23 | Button | "Xem" → `/projects/:p/3d`; Back returns to the report | `RR/RuleReportGroups.tsx:131-143`, `RR/useRuleReport.ts:624-630` | M "Cài đặt bộ luật, Xem…", E "Chạy kiểm tra lại … Xem → /3d and Back" | covered |
| 24 | Button | "Xác nhận đã xử lý": disabled while violations > 0; enabled → `/export` | `RR/RuleReport.tsx:277,348-358`, `RR/useRuleReport.ts:660-666` | M "…disabled state", E "floor without a layer → done … → /export" | covered |
| 25 | State | done: "Không phát hiện vi phạm nào." + "N luật đã chạy…" + badge "Lượt chạy này không có vi phạm"; no filter bar | `RR/RuleReport.tsx:138-154,203-205,271`, `RR/useRuleReport.ts:585` | E "floor without a layer → done" | covered |
| 26 | Button | "Sang bước xuất bản" → `/export` | `RR/RuleReport.tsx:149-151` | E "floor without a layer → done" | covered |
| 27 | State | empty: "Chưa có mô hình để kiểm tra luật" (graph null), no re-run button | `RR/RuleReport.tsx:169-177,300`, `RR/useRuleReport.ts:577-579` | — | n/a-by-design (the gate always loads a graph with ≥ 1 level for a real project; graph stays null only on error, which the gate shows itself) |
| 28 | State | loading: table skeleton | `RR/RuleReport.tsx:193-201`, `RR/useRuleReport.ts:573-575` | — | gap (transient; needs throttling, P3) |
| 29 | Error | rule-config read fails → "Không chạy được lượt kiểm tra" + "Không tải được cấu hình bộ luật của dự án." + "Thử lại" (refetch) | `RR/RuleReport.tsx:179-191`, `RR/useRuleReport.ts:137,569-571,635-637,698` | E "[mocked response] GET rule-config 500" (unpairable: 5xx) | covered |
| 30 | Error | `runRules` throws → same EmptyState with "Không chạy được bộ kiểm tra trên mô hình này." | `RR/useRuleReport.ts:134,405-410,698` | — | gap (no input makes the domain runner throw on a valid graph) |
| 31 | State | partial: per skipped group "nhóm …: N luật chưa chạy được…" + link "Thêm tầng cho mô hình" / "Mở màn nhãn phòng" | `RR/RuleReport.tsx:106-124`, `RR/useRuleReport.ts:311-354,581-583` | — | n/a-by-design (only when the model has no level; a project always has a floor) |
| 32 | Config | Report follows the saved rule-config (disabled rule not run → total − 1) | `RR/useRuleReport.ts:380-389`, `store/selectors ruleRegistryFor` | E "a rule switched off through rule-config (N22)" | covered |
| 33 | Permission | forbidden state (report without edit rights) | `RR/useRuleReport.ts:367,565-567`, `RR/RuleReport.container.tsx:226-229` (no `canEdit` passed) | R9 "SCR-28 [V] gap: rules report is ungated" | n/a-by-design (F-03: unreachable from the route) |
| 34 | Layout | Compact card list (`isCompact`) / 3D preview aside (`canPreview3d` false) | `RR/RuleReportGroups.tsx:208-237`, `RR/RuleReport.tsx:338-345`, `RR/ruleReportGateway.ts:48-54` | UI (375 px rendering of the table) | n/a-by-design (route never passes `isCompact`; preview capability false) |

## SCR-29 Rule Settings

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 35 | Network | `GET /api/projects/:p/rule-config` (N21) on open | `RS/useRuleSettings.ts:409-412`, `RS/ruleSettingsGateway.ts:250-262` | M, E `openSettings` | covered |
| 36 | Text | Header "Cài đặt bộ luật không gian" + "N/M luật đang bật" | `RS/RuleSettings.tsx:262-268` | E "group switches … all groups off" (0/M) | covered |
| 37 | Toggle | "Bật hoặc tắt luật: …" → autosave 800 ms `PUT rule-config {baseVersion, body}` + toast | `RS/RuleSettingsRow.tsx:140-147`, `RS/useRuleSettings.ts:488-583,658-690,928-935` | M "toggle a rule autosaves PUT…", E "switch a rule off, then Hoàn tác" | covered |
| 38 | Toast | Undo "Hoàn tác" → store undo → second PUT (override removed, base = first answer) | `RS/useRuleSettings.ts:672-687`, `RS/RuleSettings.container.tsx:158-167` | E "switch a rule off, then Hoàn tác" | covered |
| 39 | Toggle | "Bật hoặc tắt cả nhóm: …" → every rule of the group; "N luật, K đang bật."; toast "Tắt nhóm …." | `RS/RuleSettingsGroups.tsx:66-73`, `RS/useRuleSettings.ts:750-770,937-944` | E "group switches" | covered |
| 40 | Alert | All rules off → "Mọi luật đều đang tắt: …" (violation) | `RS/RuleSettings.tsx:190-192`, `RS/useRuleSettings.ts:240-241,890` | E "group switches … all groups off" | covered |
| 41 | Select | "Mức độ của luật: …" → Nghiêm trọng / Cảnh báo / Gợi ý; PUT severity; toast "Đổi mức của luật …." | `RS/RuleSettingsRow.tsx:26-36,54-81`, `RS/useRuleSettings.ts:946-953` | E "Mức độ của luật → Gợi ý" | covered |
| 42 | Input | Per-rule threshold NumericField (aria-label = spec label, unit) → PUT thresholds; toast "Đổi ngưỡng …." | `RS/RuleSettingsRow.tsx:89-108`, `RS/useRuleSettings.ts:962-1008` | E "threshold Bề dày tường tối thiểu … 45 is saved" | covered |
| 43 | Validation | Out of band → "Giá trị không quá {max} {unit}." / "Giá trị không nhỏ hơn {min} {unit}.", nothing committed | `NF:67-75,82-95`, `components/ui/Input.tsx:110-117` | E "threshold … 250 / 10 refused" | covered |
| 44 | Validation | Spec-level refusal (`outOfRangeText` for `tile` units, error on the field) | `RS/useRuleSettings.ts:298-307,974-982` | — | gap (NumericField refuses first with the same band, so the hook branch is unreachable through the UI — P3) |
| 45 | Keyboard | Esc on a refused field → last committed value, refusal cleared; ArrowUp/Down step | `NF:143-150` | E "threshold … Esc restores" (Esc) | covered (arrows: gap, P3) |
| 46 | Input | "Ngưỡng chung" card fields (labelled NumericField) / "Chưa có ngưỡng chung nào để chỉnh." | `RS/RuleSettingsGroups.tsx:107-155`, `RS/useRuleSettings.ts:773-789,1014-1025` | E "nav Ngưỡng chung" (field present) | covered (edit of a general field: gap, same path as #42) |
| 47 | Presets | "Bộ luật sẵn" buttons (label, caption, "N luật sẽ đổi") → PUT; toast "Áp bộ luật …: N luật đã đổi." | `RS/RuleSettingsPresets.tsx:21-62`, `RS/useRuleSettings.ts:792-801,1035-1057` | M "preset Văn phòng, then Khôi phục mặc định" | covered (toast text: gap, P3) |
| 48 | Button | Footer "Cấu hình đã khác mặc định." + "Khôi phục mặc định" (only when not default) → PUT `{overrides:{}}`; toast | `RS/RuleSettings.tsx:257,318-325`, `RS/useRuleSettings.ts:1059-1062` | M "preset…Khôi phục mặc định", E "group switches … Khôi phục mặc định" | covered |
| 49 | Navigation | Side nav "Mục cài đặt bộ luật" `#rule-settings-*` links, `aria-current` | `RS/RuleSettings.tsx:120-161` | E "nav Ngưỡng chung" | covered |
| 50 | Navigation | Collapsed nav Select "Mục cài đặt" (status `collapsed`) | `RS/RuleSettings.tsx:121-133`, `RS/useRuleSettings.ts:826-828` | — | n/a-by-design (route passes no `isCompact`, `RS/RuleSettings.container.tsx:152`) |
| 51 | Conflict | PUT 409 VERSION_CONFLICT → "Bộ luật vừa được đổi ở nơi khác…" + "Tải lại" | `RS/ruleSettingsGateway.ts:298-327`, `RS/useRuleSettings.ts:573-580`, `RS/RuleSettings.tsx:182-188` | E "rule-config changed elsewhere → PUT 409" (real 409) | covered |
| 52 | Dialog | "Tải lại bộ luật?" (unsaved edits): "Để sau" / "Bỏ thay đổi và tải lại" → GET + hydrate | `RS/RuleSettingsReloadDialog.tsx:17-36`, `RS/useRuleSettings.ts:620-648` | E "rule-config changed elsewhere" | covered |
| 53 | Error | Other save failures (RULE_* codes, VALIDATION, FORBIDDEN, connection, fallback; GENERAL field on its card) | `RS/ruleSettingsGateway.ts:298-327`, `RS/RuleSettings.tsx:182-188,228-230` | — | gap (BE answers are proven in the API spec; UI copy for non-409 codes needs a body the FE never sends — mock-only, P3) |
| 54 | Autosave | Leave the screen inside 800 ms → unmount flush still PUTs | `RS/useRuleSettings.ts:587-614` | E "Back right after a toggle … unmount flush" | covered |
| 55 | Indicator | SaveIndicator (saving / saved caption) + status `partial` "Đang tải thêm dữ liệu bộ luật…" while saving | `RS/RuleSettings.tsx:195-197,269`, `RS/useRuleSettings.ts:852-854` | M "toggle…" (screenshot), UI | covered (transient text not asserted) |
| 56 | Text | Rule row: sentence, "Soi trên … · chỉnh được: …", "Đang ảnh hưởng N đối tượng" / "Chưa có dữ liệu để đánh giá"; "Đã được thay thế bởi …" | `RS/RuleSettingsRow.tsx:149-157,183`, `RS/useRuleSettings.ts:210-229,317-329,699-727` | M (screenshot), UI | covered (visual only) |
| 57 | Error | N21 read fails → "Không tải được cài đặt bộ luật" + describeError description | `RS/RuleSettings.tsx:274-282`, `RS/useRuleSettings.ts:844-846,871-877` | E "[mocked response] GET rule-config 500" (unpairable: 5xx) | covered |
| 58 | Permission | N21 403 → "Không có quyền xem cài đặt bộ luật"; read-only reason "Chỉ quản trị viên đổi được bộ luật…" + switches read-only | `RS/RuleSettings.tsx:292-300,178-180`, `RS/ruleSettingsGateway.ts:97-98,240-248`, `RS/useRuleSettings.ts:376-379,831-833` | R9 "SCR-29 [V] load", R9 "SCR-29 [E] edit controls" | covered (Track B) |
| 59 | State | empty "Chưa có mô hình để áp bộ luật" (graph null) / loading skeleton | `RS/RuleSettings.tsx:272,284-290`, `RS/useRuleSettings.ts:835-850` | — | n/a-by-design (graph null unreachable, see #27); loading: gap (transient) |

## SCR-30 Export Panel

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 60 | Tour | EditorTour (lazy) — backdrop swallows the first click | `EP/ExportPanel.container.tsx:207` | M, E `openExport` (`dismissTour`) | covered |
| 61 | Radio | "Định dạng xuất" cards (`role=radio`) .glb / .pdf / .png / .json; audience sentence; last size | `EP/ExportPanelFormats.tsx:83-156`, `EP/useExportPanel.ts:130-148,500-517` | M ".glb options…", E ".png / .pdf cannot be delivered" | covered |
| 62 | Keyboard | Format card by Space | `EP/ExportPanelFormats.tsx:87-93` | E ".png / .pdf … Space on .json" | covered |
| 63 | Disclosure | "Tuỳ chọn" (`aria-expanded`) per format: .glb "Mức độ chi tiết mô hình" + "Gồm đồ nội thất"; .pdf 4 checkboxes; .png view + width; .json "Gồm độ tin cậy từng đối tượng" | `EP/ExportPanelOptions.tsx:105-197,222-249` | M ".glb options…", M ".json…", E ".png / .pdf … their options", E ".json without Gồm độ tin cậy" | covered |
| 64 | Checkbox | "Gồm lưới trục" (`canIncludeAxisGrid` false) | `EP/ExportPanelOptions.tsx:127-135` | — | n/a-by-design (capability false, `EP/exportPanelGateway.ts:241-243`) |
| 65 | Checkbox | "Phạm vi" floor checkboxes + "Đã duyệt"/"Chưa duyệt" badge + unreviewed caption | `EP/ExportPanelOptions.tsx:65-96` | M ".glb options, scope checkboxes", E "preflight on an unreviewed floor" (badge + caption) | covered |
| 66 | Preflight | "Kiểm tra trước khi xuất" rows: approval / violations / unreviewed objects, tone dot | `EP/ExportPanelPreflight.tsx:19-69`, `EP/exportPanelGateway.ts:300-341` | M ".glb options… preflight", E "preflight on an unreviewed floor", E ".glb with every floor unchecked" | covered |
| 67 | Link | Preflight "Sửa" → `/floors`, `/rules`, `/floors/:f/layers/objects` (SPA) | `EP/ExportPanelPreflight.tsx:43-62`, `EP/useExportPanel.ts:699-708`, `EP/exportPanelGateway.ts:319,328,336-339` | E "preflight … Sửa opens the floors … objects" | covered (violations "Sửa" → `/rules`: gap, needs a rule run stored before the export screen, P3) |
| 68 | Button | "Xuất" .json → blob `<a download>`; file `<slug>_<YYYY-MM-DD_HH-mm-ss>.json`; confidence stripped when unchecked | `EP/useExportPanel.ts:416-427`, `EP/exportPanelGateway.ts:398-430,747-756,866-883` | M ".json Xuất downloads…", E ".json without Gồm độ tin cậy…" | covered |
| 69 | Button | "Xuất" .glb → worker; file `<slug>_T<n>_<stamp>.glb` (binary glTF) | `EP/useExportPanel.ts:394-414`, `lib/export/exportGlb.ts:124-161` | E ".glb export downloads …" | covered |
| 70 | Edge | .glb with no floor selected → "Chưa chọn tầng nào để xuất."; "Xuất" is a no-op | `EP/useExportPanel.ts:659-674`, `EP/exportPanelGateway.ts:310-313` | E ".glb with every floor unchecked" | covered |
| 71 | Progress | Footer while running: step "Đang dựng hình"/"Đang mã hoá", count, progressbar, "Huỷ" (cancel) | `EP/ExportPanelFooter.tsx:31-58`, `EP/useExportPanel.ts:151-166,550-571,676-678` | E ".glb export" (progress gone after the run) | gap ("Huỷ" mid-run: the small fixture finishes before a click lands; needs a large model, P3) |
| 72 | State | .pdf / .png: blocked caption on the card, `partial` notice, no "Xuất"; page count "N trang" | `EP/ExportPanelFormats.tsx:34-57,107-112,124`, `EP/ExportPanelFooter.tsx:64`, `EP/useExportPanel.ts:173-178,512,580-597` | M ".pdf is not downloadable", E ".png / .pdf cannot be delivered" | covered |
| 73 | History | "Tệp đã xuất" table (file, time, size) + "Chỉ trong phiên làm việc này…"; "Tải lại" re-delivers; gone after reload | `EP/ExportPanel.tsx:105-160`, `EP/useExportPanel.ts:536-548,687-696` | M ".json…" (row), E ".json without… Tải lại … reload empties" | covered |
| 74 | Error | Export failure → InlineAlert + "thử lại" + hint "Thử hạ mức chi tiết…" (code) | `EP/ExportPanel.tsx:246-253`, `EP/useExportPanel.ts:181-184,470-482,680-685` | — | gap (no real input makes the worker fail; mocking a worker is not a network fake — P3) |
| 75 | Button | "Chia sẻ" (only when `SHARE_LINKS_SUPPORTED`) | `EP/ExportPanel.tsx:237-241`, `EP/useExportPanel.ts:716`, `lib/export/shareLink.ts:354` | E ".png / .pdf … no Chia sẻ" | covered (absent as designed, G7) |
| 76 | Text | Footer destination caption "Tệp tải về thư mục tải xuống…" | `EP/ExportPanelFooter.tsx:61-63`, `EP/useExportPanel.ts:169-170` | M (screenshot) | covered (visual only) |
| 77 | Permission | forbidden "Không có quyền xuất bản vẽ" + "Chỉ quản trị viên và kỹ sư…" | `EP/ExportPanel.tsx:195-205`, `EP/exportPanelGateway.ts:260-266`, `EP/useExportPanel.ts:604-606,730` | R9 "SCR-30 [V] Xuất", R9 "SCR-30 [E] Xuất present" | covered (Track B) |
| 78 | State | empty "Chưa có gì được duyệt để xuất" + "Đi duyệt tầng" | `EP/ExportPanel.tsx:207-230`, `EP/useExportPanel.ts:616-618` | — | n/a-by-design (needs graph null or no floor; a project always has a floor) |
| 79 | Layout | `collapsed` (isCompact) one-column layout | `EP/ExportPanel.tsx:255`, `EP/useExportPanel.ts:600-602` | UI (375 px) | n/a-by-design (route passes no `isCompact`) |

## SCR-31 Spatial JSON Viewer

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 80 | Input | "Tìm theo khoá hoặc giá trị" → match label "i / n" (`aria-live`), matches flashed, ancestors opened | `SJ/SpatialJsonViewer.tsx:90-106`, `SJ/useSpatialJsonViewer.ts:117-144,173-183`, `SJ/SpatialJsonTree.tsx:74` | M "search, next match…", E "search a seeded room" | covered |
| 81 | Edge | No match → "0 / 0"; "Kết quả trước/sau" inert | `SJ/useSpatialJsonViewer.ts:178-180,213-238` | E "search … no match → 0 / 0" | covered |
| 82 | Button | "Kết quả sau" / "Kết quả trước" → selects the match | `SJ/SpatialJsonViewer.tsx:108-119`, `SJ/useSpatialJsonViewer.ts:213-238` | M "search, next match…", E "search … Kết quả sau selects it" | covered (wrap-around of "Kết quả trước": gap, P3) |
| 83 | Button | "Mở rộng tất cả" / "Thu gọn tất cả" | `SJ/SpatialJsonViewer.tsx:123-134`, `SJ/useSpatialJsonViewer.ts:200-206` | M "…expand…" | covered |
| 84 | Tree | `role=tree` rows: click selects, chevron toggles, `aria-expanded`, `[n]` count | `SJ/SpatialJsonTree.tsx:58-143` | M "…ArrowRight…", E "tree keyboard" | covered |
| 85 | Keyboard | ArrowRight opens, ArrowLeft closes, Enter/Space selects | `SJ/SpatialJsonTree.tsx:80-101` | M (ArrowRight), E "tree keyboard" (ArrowRight, ArrowLeft, Enter) | covered |
| 86 | Segmented | "Cách hiện cấu trúc" Cây / Thô; Thô pins the JSON tab | `SJ/SpatialJsonViewer.tsx:34-37,136-141,207` | M "…raw", E "Thô pins the JSON tab" | covered |
| 87 | Tabs | "Cách xem nội dung" JSON / Xem trước | `SJ/SpatialJsonDetail.tsx:40-43,136-158` | M "…preview…", E "Thô pins…", E "tree keyboard" | covered |
| 88 | State | Preview: no selection "Chọn một nút ở cây bên trái…"; entity "Mã đối tượng" + 3D note | `SJ/SpatialJsonDetail.tsx:75-126` | E "tree keyboard … Xem trước" | covered |
| 89 | Text | Raw JSON (600-line cap: "Còn N dòng nữa…") | `SJ/SpatialJsonDetail.tsx:31,45-73` | — | gap (needs a model whose JSON passes 600 lines; the QC fixture is smaller — P3) |
| 90 | Text | Validity line "Hợp lệ theo hợp đồng Spatial JSON — 0 lỗi." / "N lỗi nghiêm trọng · M cảnh báo." + issue list | `SJ/SpatialJsonViewer.tsx:152-168`, `SJ/spatialJsonModel.ts:262-272`, `SJ/SpatialJsonViewer.container.tsx:103-108,142-156` | E "search a seeded room" (line read + JSON) | covered (issue list rows: gap, needs an integrity issue the BE accepts — UNKNOWN) |
| 91 | Text | Footer size + counts "N tầng · N tường · …" | `SJ/SpatialJsonViewer.tsx:215-218`, `SJ/spatialJsonModel.ts:238-250` | E "floor without a layer" (all 0), E "search a seeded room" (read) | covered |
| 92 | Button | "Sao chép nhánh đang chọn" (no `onCopy` on the route → no-op) | `SJ/SpatialJsonViewer.tsx:143-148`, `SJ/useSpatialJsonViewer.ts:254-260`, `SJ/SpatialJsonViewer.container.tsx:229` | E "floor without a layer … copy is inert" | covered (n/a-by-design: inert) |
| 93 | Button | "Tải xuống .json" (only with `onDownload`) | `SJ/SpatialJsonViewer.tsx:219-228` | E "floor without a layer … no Tải xuống .json" | covered (absent as designed) |
| 94 | State | empty "Chưa có dữ liệu không gian" (no entity), no validity line | `SJ/SpatialJsonViewer.tsx:39-41,152,187-194`, `SJ/useSpatialJsonViewer.ts:158-164` | E "floor without a layer" | covered |
| 95 | State | loading skeleton / `partial` "Đang làm mới dữ liệu…" | `SJ/SpatialJsonViewer.tsx:45,170-174,183-186`, `SJ/useSpatialJsonViewer.ts:158-168,270` | — | gap (transient, P3) |
| 96 | Error | Broken graph → "Không đọc được dữ liệu không gian" + "Mở lại từ quản lý tầng" | `SJ/SpatialJsonViewer.tsx:72-83`, `SJ/SpatialJsonViewer.container.tsx:68-69,142-156,169-171` | — | gap (needs a graph `denormalizeSpatial` rejects; BE validates layers — UNKNOWN whether producible) |
| 97 | Permission | forbidden "Không có quyền xem dữ liệu" (no role) | `SJ/SpatialJsonViewer.tsx:60-70`, `SJ/SpatialJsonViewer.container.tsx:139-140` | R9 "SCR-31 [V] gap: JSON viewer loads for a viewer" | covered (Track B; forbidden only without any role) |
| 98 | Layout | < 1024 px: no detail pane, tree fills; 375 px | `SJ/SpatialJsonViewer.container.tsx:62,78-100`, `SJ/SpatialJsonViewer.tsx:176-212` | E "narrow window (768 px…) … 375 px" | covered |

## SCR-32 Version History

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 99 | Network | N17 `GET /versions?floorId=` (infinite), N18 snapshots (≤ 2 concurrent, first 10) | `VH/useVersionHistory.ts:153-191`, `VH/versionHistoryGateway.ts:48-57` | M "floor, uncheck default pair…", E every SCR-32 test | covered |
| 100 | Select | "Tầng" (always above the content, even empty/error) | `VH/VersionHistory.tsx:40-54`, `VH/useVersionHistory.ts:599-602` | M "floor…", E "?floorId= … Tầng switches back", E "[mocked response] GET versions 500 … Tầng kept" | covered |
| 101 | Navigation | `?floorId=` deep link picks the floor; kept on reload | `VH/VersionHistory.container.tsx:192-206` | E "?floorId= opens the second floor" | covered |
| 102 | State | Project not loaded → `role=status` "Dự án chưa nạp xong" skeleton | `VH/VersionHistory.container.tsx:73,208-214` | — | gap (transient, P3) |
| 103 | State | No floor → "Dự án chưa có tầng" | `VH/VersionHistory.container.tsx:75-77,216-222` | — | n/a-by-design (a project always has a floor) |
| 104 | State | empty "{Tầng} chưa có phiên bản nào" + "Phiên bản được lưu khi AI…" | `VH/VersionHistory.tsx:65-73`, `VH/useVersionHistory.ts:489,603` | E "floor without versions" | covered |
| 105 | Error | N17 fails → "Không tải được lịch sử phiên bản" + "Máy chủ chưa trả được…" | `VH/VersionHistory.tsx:85-93`, `VH/useVersionHistory.ts:480-487`, `VH/versionHistoryGateway.ts:57` | E "[mocked response] GET versions 500" (unpairable: 5xx) | covered |
| 106 | Permission | N17 403 / project 404 → "Không đủ quyền xem" | `VH/VersionHistory.tsx:75-83`, `VH/versionHistoryModel.ts:449-461` | — | gap (403 needs a non-member read the gate already stops; viewer can read — P3) |
| 107 | List | "Danh sách phiên bản": rows by day, `vN`, avatar, "Hiện tại", tag badge, relative time, diff dots | `VH/VersionList.tsx:55-162`, `VH/versionHistoryModel.ts:181-237` | M, E "pipeline floor: newest version is Hiện tại" | covered |
| 108 | Checkbox | "Chọn phiên bản vN để so sánh": default pair = two newest full; third pick disabled; unpick one → "Chưa chọn đủ hai phiên bản để so sánh" | `VH/VersionList.tsx:80-85`, `VH/versionHistoryCompare.ts:44,51-62,85-135` | M "uncheck default pair, check two", E "pipeline floor … unticking it" | covered |
| 109 | Text | One version only → "Mới có một phiên bản nên chưa có gì để so sánh…" | `VH/versionHistoryCompare.ts:33-34,58`, `VH/VersionCompare.tsx:173-178` | — | gap (the pipeline always writes two versions; P3) |
| 110 | Tabs | "Cách xem khác biệt" Thay đổi / JSON / Trực quan + left/right version Selects + counts | `VH/VersionCompare.tsx:180-248`, `VH/versionHistoryCompare.ts:26-30` | M "…tabs Thay đổi / JSON / Trực quan" | covered (left/right Selects: gap, P3) |
| 111 | Button | "Xem thêm phiên bản" (cursor page) | `VH/VersionHistory.tsx:123-127`, `VH/useVersionHistory.ts:545-549` | M "…Xem thêm phiên bản" (branch only when > 50) | gap (needs > 50 versions, `VH/versionHistoryGateway.ts:51`; P3) |
| 112 | Row | Snapshot read failed → "Chưa tải được nội dung bản này" + "Thử lại tải nội dung vN"; metadata-only retention notice | `VH/VersionList.tsx:97-114`, `VH/versionHistoryModel.ts:389-391`, `VH/versionHistoryGateway.ts:54` | — | gap (N18 failure is mock-only; retention needs > MAX_FULL_VERSIONS versions — P3) |
| 113 | Button | "Phục hồi phiên bản này": absent when the reviewed (right) version is "Hiện tại"; disabled with no right version | `VH/VersionHistory.tsx:163-175` | E "pipeline floor: newest … no Phục hồi; … restore disabled" | covered |
| 114 | Dialog | Restore confirm "Phục hồi phiên bản vN của {Tầng}?" + caption + "Lịch sử hoàn tác (Ctrl+Z)…"; "Để nguyên" / Esc | `VH/VersionHistory.tsx:179-195`, `VH/versionHistoryModel.ts:473-512`, `VH/useVersionHistory.ts:505-529` | M "restore the AI version", E "restore on an own floor: Để nguyên and Esc send nothing" | covered |
| 115 | Restore | "Phục hồi" → `POST …/versions/:v/restore` 201; toast "Đã phục hồi phiên bản vN của {Tầng}; hoàn tác được trong 8 giây" | `VH/useVersionHistory.ts:409-451` | M "restore the AI version" (walls equal snapshot), E "restore on an own floor" (toast) | covered |
| 116 | Toast | Restore "Hoàn tác" → revertRestore → "Đã hoàn tác lượt phục hồi"; retry / expired / used notices | `VH/useVersionHistory.ts:354-407`, `VH/versionHistoryGateway.ts:99-112,257-298`, `VH/versionHistoryModel.ts:394` | E "restore on an own floor … Hoàn tác" | covered (expired / used / retry notices: gap, P3) |
| 117 | Conflict | Restore 409 → "Tầng vừa đổi ở nơi khác" + "{name} đã sửa tầng này sau lúc bạn mở trang…" + "Tải lại" (re-read the layer) | `VH/versionHistoryGateway.ts:86-131`, `VH/useVersionHistory.ts:421-426,536-544`, `VH/VersionHistory.tsx:99-106` | E "the floor changed after the page opened → restore 409" (real 409) | covered |
| 118 | Dialog | Unsaved floor edits before a restore → "… còn thay đổi chưa lưu được; tiếp tục sẽ bỏ chúng" | `VH/versionHistoryModel.ts:489-498`, `VH/useVersionHistory.ts:316-338` | — | gap (needs an unsaved layer edit of the same floor alive on the versions screen; P3) |
| 119 | Error | Restore / label write errors → "Đã hiểu" banner (FORBIDDEN, LAYER_INTEGRITY_BROKEN, …) | `VH/versionHistoryModel.ts:382-439` | — | gap (BE codes proven in the API spec; UI copy is mock-only, P3) |
| 120 | Dialog | "Gắn nhãn phiên bản này" → "Gắn nhãn phiên bản vN": "Nhãn" (max 60), hint, "Huỷ" / Esc, submit by Enter → `PATCH …/label` | `VH/VersionHistory.tsx:158-162,197-208`, `VH/VersionLabelDialog.tsx:14-58` | M "Gắn nhãn phiên bản này sends PATCH label", E "label dialog: 60-character cap…" | covered |
| 121 | Toast | Label toast "Đã gắn nhãn" / "Đã gỡ nhãn" + "Hoàn tác" (previous label re-sent) | `VH/useVersionHistory.ts:454-476,531-535` | E "label dialog … toast Đã gắn nhãn whose Hoàn tác clears the label" | covered (NOTE: M asserts no toast, F-09; the route now passes `onToast={addToast}`, `VH/VersionHistory.container.tsx:225`) |
| 122 | Button | "Xuất phiên bản này" (only with `onExportVersion`) | `VH/VersionHistory.tsx:153-157` | — | n/a-by-design (the route passes none) |
| 123 | Permission | Viewer: restore and label absent + "Vai trò của bạn trên dự án này chỉ đọc được lịch sử…" | `VH/VersionHistory.tsx:139-144`, `VH/versionHistoryModel.ts:464-465`, `VH/VersionHistory.container.tsx:143` | R9 "SCR-32 [V] restore and label absent" | covered (Track B) |
| 124 | Layout | < 1024 px: Select "phiên bản" replaces the list (status `collapsed`, also when empty) | `VH/VersionHistory.container.tsx:67,86-108`, `VH/VersionHistory.tsx:108-116`, `VH/useVersionHistory.ts:488` | E "narrow window (768 px) → version Select" | covered |

## Summary

- FE rows: 124 — covered 88 (incl. 4 Track-B-only rows and 3 "absent as designed" rows), gap 23, n/a-by-design 13,
  UNKNOWN 0 (two gaps carry an UNKNOWN reason: #90 issue rows, #96 broken graph).
- Edge spec: 34 tests, 3 `[mocked response]` (8.8 % < 35 %), all three `unpairable` (5xx): rule-config GET on
  SCR-28 and SCR-29, versions GET on SCR-32 — rows for `coverage/phase06-be.md`.
- Gap priority: (1) luồng chính — none open; (2) lỗi — #74 export failure, #53/#119 non-409 save/write copy, #96
  broken graph; (3) biên — #71 export cancel, #111 "Xem thêm phiên bản", #112 snapshot retry/retention, #118 discard
  dialog, #22 "Đã xử lý" group; (4) hiển thị — loading skeletons (#28, #59, #95, #102), #89 600-line cap, #109
  one-version sentence.
