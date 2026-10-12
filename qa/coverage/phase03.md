<!-- qa-sources fe=39016134 -->
# Phase 03 — FE coverage inventory (SCR-08 settings, SCR-09 floors, SCR-10 upload, SCR-11 quality, SCR-12 processing, SCR-13 graph, SCR-15 CAD)

FE source: `F:/App/AppFront` HEAD `39016134` (QA-03d re-stamp). Rows written before QA-03d keep their `dbdc0d1c` line refs; the QA-03d gap-row tests cite
39016134 lines in the spec. Since QA-03d the per-screen flow catalog `F:/App/AppBack/backend/dieu-phoi/chay/QA-03d/flow-catalog.md` drives new authoring. Backend rules are in
`coverage/phase03-be.md` (separate agent); BE-rule gaps belong there. Plan rows: `E2E-TEST-PLAN.md` §4 Phase 3.

**Specs** — `M` = `tests/phase03_pipeline.spec.ts` (19 tests, serial, CP-2 → CP-5 on the shared project) · `E` =
`tests/phase03_pipeline_edge.spec.ts` (50 tests, non-serial, one own `qa-<runId>-e03-…` project per test, 1 mocked).
No phase-03 `_ui` spec exists at this stamp. Test names are shortened to their leading words.

**Source abbreviations** — `PS` `src/screens/project/ProjectSettings/ProjectSettings.tsx` · `UPS` `…/useProjectSettings.ts` ·
`UPM` `…/useProjectMembers.ts` · `GT` `…/GeneralTab.tsx` · `UT` `…/UnitsTab.tsx` · `MT` `…/MembersTab.tsx` · `AMF` `…/AddMemberForm.tsx` ·
`DZ` `…/DangerZoneTab.tsx` · `RD` `…/ProjectSettingsReloadDialog.tsx` · `MRD` `…/MemberRemoveDialog.tsx` · `SE` `…/settingsErrors.ts` ·
`PSG` `…/projectSettingsGateway.ts` · `FM` `src/screens/qc/FloorManager/FloorManager.tsx` · `FT` `…/FloorTable.tsx` · `FTR` `…/FloorTableRow.tsx` ·
`FSC` `…/FloorSectionCut.tsx` · `UFM` `…/useFloorManager.ts` · `FMG` `…/floorManagerGateway.ts` · `FMC` `…/FloorManager.container.tsx` ·
`FU` `src/screens/upload/FloorUploadScreen/FloorUploadScreen.tsx` · `FUC` `…/FloorUploadCard.tsx` · `FUD` `…/FloorUploadDropZone.tsx` ·
`FUT` `…/FloorUploadTray.tsx` · `FUF` `…/FloorUploadFooter.tsx` · `UFU` `…/useFloorUploadScreen.ts` · `FUG` `…/floorUploadGateway.ts` ·
`VAL` `src/lib/upload/validate.ts` · `IQ` `src/screens/upload/InputQualityGate/InputQualityGate.tsx` · `IQF` `…/InputQualityGateFooter.tsx` ·
`IQR` `…/InputQualityGateReportPanel.tsx` · `IQD` `…/InputQualityGateConfirmDialog.tsx` · `IQO` `…/InputQualityGateImageOverlays.tsx` ·
`IQP` `…/InputQualityGateImagePanel.tsx` · `UIQ` `…/useInputQualityGate.ts` · `PR` `src/screens/pipeline/ProcessingScreen/ProcessingScreen.tsx` ·
`PLP` `…/ProcessingLogPanel.tsx` · `PSL` `…/ProcessingStepList.tsx` · `PSB` `…/ProcessingStepBar.tsx` · `PSU` `…/ProcessingSummary.tsx` ·
`PFC` `…/ProcessingFloorChips.tsx` · `PPP` `…/ProcessingPreviewPanel.tsx` · `UPR` `…/useProcessingScreen.ts` · `PRG` `…/processingGateway.ts` ·
`PG` `src/screens/pipeline/PipelineGraph/PipelineGraph.tsx` · `PGO` `…/PipelineGraphOverview.tsx` · `PGT` `…/pipelineGraphText.ts` ·
`UPG` `…/usePipelineGraph.ts` · `PGG` `…/pipelineGraphGateway.ts` · `CB` `src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.tsx` ·
`CBD` `…/CadBranchConfirmDialog.tsx` · `UCB` `…/useCadBranchConfirm.ts` · `CBT` `…/cadBranchConfirmText.ts` · `CBG` `…/cadBranchConfirmGateway.ts` ·
`PSGATE` `src/components/feedback/ProjectSpatialGate.tsx` · `NF` `src/hooks/useNumericField.ts` · `TST` `src/components/feedback/Toast.tsx` ·
`NH` `src/components/feedback/NotificationHost.tsx` · `NB` `src/lib/mutations/notificationBus.ts`.

## Findings from the inventory (source-level; the edge tests expose them)

| # | What | Source | Edge test |
|---|---|---|---|
| F1 | **Resolved (FIX-1483 test side, after FIX-1424 / BUG-287)** — was "main spec stale copy / notice shown from the first paint". The floor screen now has one "Một số thay đổi chưa được lưu" strip (`FM:77, 142-151`, role="status"); the hide-in-3D sentence "Tầng đang ẩn khỏi mô hình 3D sẽ hiện lại sau khi tải lại trang." (`FMG:212`) is added only while a floor is hidden (`UFM:1655-1664`), joined in one `<p>` with the floor-contents sentence (`FMG:210-211`). Main spec asserts absent → hide → present inside the strip | `FMG:205-213`, `UFM:1655-1664`, `FM:142-151` | — (main spec SCR-09 "Ẩn khỏi mô hình 3D") |
| F2 | **FloorManager is never compact**: the route never passes `isCompact` (FMC:113 says the parent must measure and pass it; FMC:211-246 does not), so at < 1024 px the 360 px section cut stays beside a 10-column table | `FMC:113, 211-246`, `FM:142-161` | E SCR-09 at 375 px (expected to FAIL while unfixed) |
| F3 | **"Xoá bản vẽ …" on an attached drawing never reaches the server** (UFU:833 "xoá không gọi máy chủ"), yet the toast says "Đã xoá bản vẽ …"; after a reload the drawing is back and the card has no menu at all (FUC:82-86) — the user cannot remove a server drawing from this screen | `UFU:819-871`, `FUC:82-86` | E SCR-10 attached drawing … reload shows the server copy |
| F4 | **Resolved (FIX-1400, BUG-298)** — was "Bắt đầu xử lý with zero floors does nothing". Zero floors now list one project-level `noFloors` reason "Dự án chưa có tầng nào. Thêm tầng ở màn Quản lý tầng trước khi xử lý." under "Không thể bắt đầu xử lý"; the empty state offers "Thêm tầng" and the drop zone is gone (`canDrop`) | `UFU:115-117, 437, 933-934`, `FU:76-80, 160-166, 229-235`, `FUF:72-87` | E SCR-10 project with no floor (notice + "Thêm tầng" + no drop zone) |
| F5 | **Resolved (FIX-1422, BUG-300)** — was "notes rejection names the wrong part". The sentence now names the field the user sees and the next step: a refused "Ghi chú" → "Chưa lưu được ghi chú. Sửa lại giá trị đó, hệ thống sẽ tự lưu tiếp." | `UPS:1013-1030`, `SE:124-170` | — (since BUG-356 the bidi mark no longer reaches the 422 branch; see S19-S21) |
| F6 | **Resolved (FIX-1384, BUG-313)** — was "SCR-13 never reads anything". The graph now reads #24 `GET /api/projects/{id}` (`readProjectExists`); a 404 `project` shows "Không tìm thấy dự án này" + "Về danh sách dự án" instead of the empty story. Branch report / comparison / node detail are still "unsupported" without a request | `PGG:304-312, 356-358`, `UPG:265-268, 715`, `PG:136-148` | E SCR-13 own project (only #24) / unknown project (404 → not-found) |
| F7 | **"Bắt đầu xử lý" (SCR-10) and "Tiếp tục xử lý" (SCR-11) only navigate** — processing is started by the upload `complete`, not by these buttons | `UFU:980-983`, `UIQ:1263-1269` | E SCR-10 every floor attached (no request on click) |
| F8 | Collapsed upload (< 1024 px) hides the empty invitation sentence: `collapsed` is checked before `empty` | `UFU:1148-1159`, `FU:156-158` | E SCR-10 at 375 px (data in JSON; not asserted) |
| F10 | **Resolved by FIX-1380 (BUG-285)** — was "/pipeline is a dead end after a finished run". The real gateway now has `extractionSummary` (`PRG:808`) read from N16 spatial/layer (`PRG:1006`) once a floor is done; "Báo cáo tổng kết" with "Duyệt lớp tường" / "Hiệu chỉnh tỷ lệ" shows as soon as one floor is done, and still shows (without counts) when N16 fails. The main spec "[BUG-285] SCR-12 Duyệt lớp tường" asserts it (last test of that serial file, BUG-315) | `PRG:808, 1006`, `UPR:733-745, 1208-1276`, `PR:281`, `PSU:18-20, 47-53` | E SCR-10 every floor attached (summary + both buttons, "Hiệu chỉnh tỷ lệ" → scale) |
| F11 | **Main spec stale default**: "Tự động tính cao độ" starts OFF (`useState(false)`); the main SCR-09 elevation test first expects `aria-checked="true"` | `UFM:501`, `M` line 353-354 | E SCR-09 middle floor "Cao độ tầng" (asserts OFF) |
| F12 | **Main spec strict-mode clash**: a floor row without drawing shows "Chưa có bản vẽ" twice (count cell + badge), so `row.getByText('Chưa có bản vẽ', {exact})` in the main "Thêm tầng ×2" test resolves to 2 elements | `UFM:180, 266-270`, `FTR:283-286`, `M` line 260 | E SCR-09 "Tải lên" (asserts count 2) |
| F9 | Settings 5xx load error: whether "Thử lại" shows depends on `toAppError` guessing a kind from text (`KNOWN_HTTP_STATUS_KIND` has no 5xx; `unknown` is not retryable) — UNKNOWN until seen | `PS:61-66`, `src/lib/errors/toAppError.ts:10-18, 193-212, 350` | — (UNKNOWN row S36) |

## SCR-08 Project settings (`/projects/:id/settings`)

| # | Nhóm | Phần tử / trạng thái | Nguồn (file:line) | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| S1 | Tabs | tablist "Nhóm cài đặt": Chung / Đơn vị đo / Thành viên / Vùng nguy hiểm, panels switch | `PS:52, 120-144`, `UPS:507-512, 1279-1290` | M · SCR-08 tablist | covered |
| S2 | Tabs | "Vùng nguy hiểm" only when `canDelete` (admin) | `UPS:1288-1290`, `DZ:45-52` | M · SCR-08 tablist (admin sees it); role variants → Phase 9 | covered |
| S3 | Tabs | tab badge = problem count | `PS:124`, `UPS:808-814` | E · QA-03d [S3] tab badge (4) | covered |
| S4 | Compact | < 1024 px tablist → Select "Nhóm cài đặt" | `PS:112-128`, `UPS:578-597` | E · SCR-08 at 375 px | covered |
| S5 | Input | "Tên dự án" maxlength 80 | `GT:40-46`, `PSG:188` | E · SCR-08 "Tên dự án" blank | covered |
| S6 | Validation | "Chưa nhập tên dự án." (empty / only spaces) | `UPS:421-423` | E · SCR-08 "Tên dự án" blank | covered |
| S7 | Validation | "Tên dự án cần ít nhất 3 ký tự." | `UPS:424-426` | E · SCR-08 "Tên dự án" blank | covered |
| S8 | Validation | "Tên dự án không quá 80 ký tự." (unreachable: maxlength 80) | `UPS:427-429` | — | n/a-by-design (input caps it) |
| S9 | Autosave | local problem blocks the autosave (no PATCH) | `UPS:765-767, 1300` | E · SCR-08 "Tên dự án" blank | covered |
| S10 | Input | "Mã dự án" maxlength 32, hint "Mã ngắn để tra cứu nhanh" (no "bỏ trống cũng được": a saved code cannot be emptied, FIX-1420 / BUG-299) | `GT:48-55`, `PSG:189` | E · SCR-08 saved "Mã dự án" | covered |
| S11 | Validation | saved code / address emptied → "Giá trị đã lưu không xoá trống được; hãy nhập giá trị khác." (FIX-1420, BUG-299) | `UPS:433-447`, `SE:113` | E · SCR-08 saved "Mã dự án" | covered |
| S12 | Input | "Địa chỉ" edit → PATCH name/code/address only | `GT:57-63`, `PSG:267-277, 431-440` | M · SCR-08 "Địa chỉ" | covered |
| S13 | Input | "Địa chỉ" maxlength 200 | `GT:60`, `PSG:190` | E · SCR-08 saved "Mã dự án" | covered |
| S14 | Select | "Loại công trình" (Nhà ở / Thương mại / Công nghiệp / Hỗn hợp / Khác) → PUT settings | `GT:64-70`, `UPS:494-500, 366-369` | E · QA-03d [S14] "Công nghiệp" → PUT buildingType | covered |
| S15 | Textarea | "Ghi chú" → only PUT settings `{baseVersion, body}` + toast | `GT:81-88`, `PSG:279-290` | M · SCR-08 "Ghi chú" | covered |
| S16 | Textarea | counter "N / 500 ký tự"; 500 saves | `UPS:1313-1315`, `PSG:191` | E · SCR-08 "Ghi chú" 500 | covered |
| S17 | Validation | "Ghi chú không quá 500 ký tự." (501) + no PUT | `UPS:449-454` | E · SCR-08 "Ghi chú" 500 | covered |
| S18 | Toast | "Đã lưu cài đặt dự án." + "Hoàn tác" → previous draft saved again | `UPS:1015-1039, 606-607` | E · SCR-08 toast "Hoàn tác" | covered |
| S19 | Server 422 | field → "Giá trị này chưa hợp lệ nên chưa được lưu; hãy sửa lại." (`settingsErrors.ts:110`, no "Chưa lưu hết" box when the 422 names a field; chip "Chưa lưu vì còn ô cần sửa") | `SE:92-107, 111`, `UPS:938-944` | E · QA-03d [S19] code "   " → real 422 `code` (FE accepts what BE strips to empty, F15) | covered |
| S20 | Server 422 | "Chưa lưu hết" + "Chưa lưu được ghi chú. Sửa lại giá trị đó, hệ thống sẽ tự lưu tiếp." (notes; F5 resolved, FIX-1422 / BUG-300) | `PS:97-99`, `SE:124-170`, `UPS:1013-1030` | E · QA-03d [S20] notes "   " → real 422 `body.notes` | covered |
| S21 | Server 422 | name refused → field message + "Chưa lưu được tên dự án. Sửa lại giá trị đó, hệ thống sẽ tự lưu tiếp." (FIX-1422, BUG-300) | `PS:97-99`, `SE:124-170` | E · QA-03d [S21] name + code in one PATCH → "Chưa lưu hết" names both | covered |
| S21a | Validation | bidi / control character in "Tên dự án" / "Mã dự án" / "Địa chỉ" / "Ghi chú" → "<field> có ký tự đảo chiều chữ (U+202E); hãy xoá ký tự đó.", indicator "Chưa lưu vì còn ô cần sửa", no PUT/PATCH (FIX-1622, BUG-356) | `UPS:422-478, 909, 1361`, `SE:112` | E · SCR-08 "Ghi chú" / "Tên dự án" with a bidi mark | covered (notes, name) |
| S22 | Conflict | 409 → "Cài đặt đã đổi ở nơi khác" + sentence + "Tải lại"; nothing saved → no second "Chưa lưu hết" strip (FIX-1422, BUG-300) | `PS:88-95`, `SE:110`, `UPS:1024-1030` | E · SCR-08 settings changed elsewhere | covered |
| S23 | Dialog | reload with unsaved draft → "Tải lại sẽ bỏ thay đổi chưa lưu": "Giữ thay đổi" keeps, "Tải lại" loads server copy | `RD:17-35`, `UPS:1356-1374` | E · SCR-08 settings changed elsewhere | covered |
| S24 | Dialog | reload dialog Esc closes (Modal onClose) | `RD:19` | E · SCR-08 settings changed elsewhere (QA-03d: Esc step) | covered |
| S25 | Select | "Đơn vị chiều dài" Mét / Milimét → PUT ×2 | `UT:45-51`, `UPS:502-505` | M · SCR-08 "Đơn vị chiều dài" | covered |
| S26 | Text | "Đơn vị diện tích" = "Mét vuông — ví dụ …" (read-only line) | `UT:53-56`, `UPS:1319` | E · QA-03d [S26 S28] | covered |
| S27 | NumericField | "Dung sai bắt điểm" 0 → "Giá trị không nhỏ hơn 1 mm.", 121 → "Giá trị không quá 120 mm.", Esc restores, 120 saves | `UT:58-68`, `NF:62-67, 136-141`, `PSG:192-193` | E · SCR-08 "Dung sai bắt điểm" | covered |
| S28 | NumericField | "Ngưỡng tin cậy" 0…1 bounds | `UT:70-79`, `UPS:466-475` | E · QA-03d [S26 S28] 1,5 / -1 refused, 0,5 → 50% | covered |
| S29 | NumericField | "Tỉ lệ bản vẽ" 0,01…1000 + preview sentence | `UT:81-91`, `UPS:478-486, 536-550` | E · QA-03d [S29] 0 / 1001 refused, 2,5 → preview 250 mm | covered |
| S30 | Members | count "1 thành viên", list with role badge | `MT:55-79`, `UPS:1263-1273, 1330` | E · SCR-08 "Thành viên" | covered |
| S31 | Members | add: empty → "Chưa nhập địa chỉ email."; existing member → "Người này đã là thành viên." (no POST); no account → 422 → "Không thêm được: …" | `AMF:17-48`, `UPM:88-105, 154-183`, `PSG:456-468` | E · SCR-08 "Thành viên" | covered |
| S32 | Members | add success → toast "Đã thêm …" + "Hoàn tác" (removes) | `UPM:185-213` | E · QA-03d [S32] real add + undo (skips without an active non-admin account — run-32 skipped) | covered (data-dependent) |
| S33 | Members | "Gỡ {name}" → dialog `Gỡ {name} khỏi dự án?`, self message, Esc / "Để nguyên" close | `MT:65-74`, `MRD:17-38`, `UPM:216-276` | E · SCR-08 "Gỡ" yourself | covered |
| S34 | Members | remove refused → error inside the dialog (MEMBER_LAST_EDITOR) | `MRD:26-30`, `UPM:108-113, 242-247` | E · SCR-08 "Gỡ" yourself | covered |
| S35 | Members | 429 → "Bạn đã thêm nhiều thành viên…" + button locked | `UPM:88-95, 138-145` | E · QA-03d [S35] [mocked response] 429 — run-32 FAIL (F14) | covered (mock, unpairable; app FAIL) |
| S36 | Load error | 5xx → "Không tải được cài đặt dự án" + "Thử lại" (F9) | `PS:61-66, 101-107` | E · QA-03d [S36] [mocked response] 500 — run-32: no "Thử lại", no way out (F9 → F13) | covered (mock, unpairable; app FAIL) |
| S37 | Load error | 404 → same title + "Về danh sách dự án" → "/" | `PS:61-66`, `UPS:1295-1297` | E · SCR-08 unknown project | covered |
| S38 | Loading | Skeleton "property-panel" while reading | `PS:108-109` | E · QA-03d [S38] held N6 read (real, delayed) | covered |
| S39 | Save indicator | `SaveIndicator` top-right (role=status), hidden on load error | `PS:79` | E · QA-03d [S39] "Chưa có thay đổi" → "Đã lưu lúc HH:MM" | covered |
| S40 | Read-only | "Vai hiện tại chỉ xem được cài đặt…" | `PS:82-86`, `GT:90-99` | Phase 9 role matrix (Track B) | n/a-by-design (role) |
| S41 | Danger | "Xoá dự án" dialog: name required, confirm locked until exact; Esc / "Để nguyên" | `PS:156-185`, `UPS:1195-1210` | E · SCR-08 "Xoá dự án" | covered |
| S42 | Danger | delete → DELETE, navigate "/", notice "Đã xoá dự án." | `UPS:1180-1193`, container onProjectDeleted | E · SCR-08 "Xoá dự án" | covered |
| S43 | Danger | "Xoá mọi tầng" dialog (no typed name) → DELETE each floor → toast → "Chưa có tầng nào" | `DZ:57-77`, `UPS:1150-1178`, `PSG:509-540` | E · SCR-08 "Xoá mọi tầng" | covered |
| S44 | Danger | delete failure shown in the dialog message | `UPS:1155-1159, 1184-1188, 1381` | E · QA-03d [S44] project deleted elsewhere → both dialogs show the 404 sentence | covered |
| S45 | Danger | "Chưa có tầng nào" empty state in the danger tab | `DZ:71-76` | E · SCR-08 "Xoá mọi tầng" | covered |

## SCR-09 Floor manager (`/projects/:id/floors`)

| # | Nhóm | Phần tử / trạng thái | Nguồn (file:line) | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| F1r | Button | "Thêm tầng" → POST floors ×2 (CP-3), badge "Chưa có bản vẽ" | `FT:227-245`, `UFM:1290-1313` | M · SCR-09 "Thêm tầng" ×2 | covered |
| F2r | Toast | "Đã thêm tầng." + "Hoàn tác" → DELETE the new floor | `FMG:595`, `UFM:870-874, 999-1012` | E · SCR-09 "Thêm tầng" → toast | covered |
| F3r | Input | "Tên tầng {name}" Enter → PATCH spatial; Escape reverts | `FTR:223-247` | M · SCR-09 rename | covered |
| F4r | Validation | rename empty / > 120 / control-bidi → "Chưa đổi được tên tầng — …" toast, no PATCH | `FMG:828-833, 857-873`, `UFM:1165-1176, 671-681` | E · SCR-09 "Tên tầng" refusals | covered |
| F5r | Validation | rename to the same name → "Tên tầng không đổi nên không có gì để lưu." | `FMG:877-881` | E · QA-03d [F5r] | covered |
| F6r | NumericField | "Chiều cao tầng" commit → PATCH spatial | `FTR:266-279` | M · SCR-09 "Chiều cao tầng" | covered |
| F7r | Keyboard | row Alt+ArrowUp → PATCH reorder; Mod+Z restores | `FTR:146-169`, `UFM:1399-1428, 1441-1450` | M · SCR-09 middle row | covered |
| F8r | Keyboard | Alt+Arrow at the stack edges → no-op | `FTR:58-63` | E · SCR-09 Alt+ArrowUp on the first row | covered |
| F9r | Drag | grip "Đổi thứ tự tầng {name}" drag/drop + insertion line | `FTR:204-221`, `FT:121-146` | E · QA-03d [F9r] HTML5 drag events + insertion line + PATCH reorder | covered |
| F10r | Section | "Thu gọn lát cắt" / "Hiện lát cắt"; band click selects row | `FSC:144-155`, `FM:143-146` | M · SCR-09 "Thu gọn lát cắt" | covered |
| F11r | Keyboard | band Enter/Space selects; aria-pressed, ", đang chọn" | `FSC:94-117` | E · SCR-09 Enter on a section band | covered |
| F12r | Button | "Nhân bản tầng" (selected row) | `FT:232-243` | M · SCR-09 band … "Nhân bản tầng" visible | covered (visible only) |
| F13r | Switch | "Tự động tính cao độ" starts OFF (elevation inputs editable); toggling hides them | `FT:310-317`, `UFM:501, 1048-1059` | M · SCR-09 "Tự động tính cao độ" (stale start state, F11); E · SCR-09 middle floor "Cao độ tầng" | covered |
| F14r | Validation | elevation into a neighbour → violation notice names the floor, no PATCH | `UFM:1190-1200`, `FMG:465-512`, `FM:135-139` | E · SCR-09 middle floor "Cao độ tầng" | covered |
| F15r | Menu | "Thao tác khác cho tầng {name}" → "Ẩn khỏi mô hình 3D" / "Hiện trong mô hình 3D"; the hide sentence joins the "Một số thay đổi chưa được lưu" strip only while a floor is hidden (F1 resolved) | `FT:171-175`, `UFM:1079-1100, 1655-1664` | M · SCR-09 "Thao tác khác…"; U · U03_floors_hidden_in_3d | covered |
| F16r | Menu | "Đổi tên" focuses the name input | `FT:159-162` | E · SCR-09 row menu "Đổi tên" | covered |
| F17r | Menu | "Nhân bản" → in-row "Sao chép nội thất sang tầng mới" + "Nhân bản"; Escape cancels | `FT:164-170`, `FTR:147-151, 321-333` | E · SCR-09 row menu "Nhân bản" | covered |
| F18r | Menu | duplicate → POST "{name} (bản sao)" + toast "Đã nhân bản tầng …" | `UFM:366-373, 1315-1365`, `FMG:588-589` | E · SCR-09 row menu "Nhân bản" | covered |
| F19r | Menu | duplicate with "Sao chép nội thất" on → contents notice (session only) | `UFM:1349-1360`, `FMG:205-208` | E · QA-03d [F19r] announcer records the contents sentence | covered |
| F20r | Menu | "Xoá tầng" (no confirm) → DELETE + toast "Đã xoá tầng …" + undo re-creates | `FT:176-181`, `UFM:1367-1397, 875-876`, `FMG:585` | E · SCR-09 row menu "Xoá tầng" | covered |
| F21r | Undo | undo after the 570 s restore window → "Đã quá thời gian khôi phục tầng…" | `UFM:196, 204` | E · QA-03d [F21r] `page.clock.setSystemTime` +571 s, Mod+Z | covered |
| F22r | Limit | 50-floor cap → "Dự án đã đủ 50 tầng…" | `UFM:191, 1276-1288` | E · QA-03d [F22r] 50 floors | covered |
| F23r | Link | "Tải lên" on a row without drawing → /upload | `FTR:284-298`, `FMC:217-223` | E · SCR-09 "Tải lên" | covered |
| F24r | Breadcrumb | "Dự án" → "/" | `FM:98-108`, `FMC:225-227` | E · SCR-09 row menu "Đổi tên" … breadcrumb | covered |
| F25r | Empty | no floor → "Chưa có tầng nào" + notice + "Thêm tầng" | `FT:189-199`, `UFM:177-178` | E · SCR-09 project with no floor | covered |
| F26r | Error | 404 → "Không tìm thấy dự án này" + "Về danh sách dự án"; no section cut | `FT:201-212`, `UFM:1614-1627`, `FM:93` | E · SCR-09 unknown project | covered |
| F27r | Error | 5xx → "Không đọc được danh sách tầng" + "Thử lại" | `FT:214-223`, `UFM:1104-1106` | E · SCR-09 [mocked response] GET floors 500 | covered (mock, unpairable: 5xx) |
| E · QA-03d [S35] member add 429 | `POST /api/projects/:id/members` 429 `RATE_LIMITED`, Retry-After 5 | unpairable: `members_add` 60 / 3600 s per actor is shared with Phase 2 |
| E · QA-03d [S36] settings read 500 | `GET /api/projects/:id/settings` 500 | unpairable: 5xx |
| E · QA-03d [U17] chunk 500 | `POST …/uploads/:uid/chunks` 500 (then real) | unpairable: 5xx |
| E · QA-03d [U30] upload project read 500 | `GET /api/projects/:id` 500 | unpairable: 5xx |
| E · QA-03d [Q14] quality read 500 | `GET …/floors/:fid/quality` 500 | unpairable: 5xx |
| E · QA-03d [Q18] focus floor still measuring | real #30 body, `isMeasured` flipped | unpairable: transient worker state (fake ML measures within seconds) |
| E · QA-03d [P13] N7 read 500 | `GET …/drawings/uploads/latest` 500 | unpairable: 5xx |
| F28r | Loading | table skeleton + pulsing section | `FT:263-264`, `FSC:158-159` | E · QA-03d [F28r] held floor list | covered |
| F29r | Compact | < 1024 px section below the table (F2) | `FMC:113`, `FM:142-161` | E · SCR-09 at 375 px | covered (expected FAIL, F2) |
| F30r | Forbidden | viewer notice "Không có quyền sửa tầng" | `FM:113-122`, `UFM:179, 1654` | Phase 9 (Track B) | n/a-by-design (role) |
| F31r | Footer | "{n} tầng · tổng cao … · …" + caption | `FT:307-321` | E · QA-03d [F31r] footer + both captions | covered |
| F32r | Server errors | FLOOR_ID_TAKEN / LIMIT / REORDER_MISMATCH / ID_AMBIGUOUS sentences | `UFM:207-230` | E · QA-03d [F32r] ×2: FLOOR_LIMIT_REACHED (49 + one by API), FLOOR_REORDER_MISMATCH (floor added by API) real; FLOOR_ID_TAKEN / FLOOR_ID_AMBIGUOUS n/a — the FE mints a fresh level id per floor | covered (2 of 4; 2 n/a) |

## SCR-10 Floor upload (`/projects/:id/upload`)

| # | Nhóm | Phần tử / trạng thái | Nguồn (file:line) | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| U1 | Upload | file input → tray → "Gán cho tầng khác" → init/chunks/complete → "Đã gắn kèm" (CP-4) | `FUD:71-90`, `FUT:55-72`, `UFU:740-783` | M · SCR-10 setInputFiles(drawing.png) | covered |
| U2 | Input | `accept=".png,.jpg,.pdf"`, `multiple`, formats line | `FUD:71-100`, `UFU:1189-1199`, `VAL:62-66` | E · SCR-10 "Chọn tệp" | covered |
| U3 | Button | "Chọn tệp" opens the file chooser | `FUD:91-98` | E · SCR-10 "Chọn tệp" | covered |
| U4 | Validation | unsupported format → "Định dạng … chưa nhận được. Định dạng hỗ trợ: …" | `UFU:178-182`, `VAL:257-266` | M · SCR-10 .txt; E · "Chọn tệp" (.txt), drag (.docx) | covered |
| U5 | Validation | > 100 MiB → "Tệp nặng …, vượt trần … của một tệp." | `UFU:173-177`, `VAL:246-255` | E · SCR-10 file over 100 MiB | covered |
| U6 | Validation | PDF without header → "Không đọc được nội dung tệp .pdf." | `UFU:188-189`, `VAL:306-339` | E · SCR-10 unreadable .pdf | covered |
| U7 | Validation | PDF > 20 pages → "Tệp có N trang, vượt trần 20 trang." | `UFU:183-186`, `VAL:280-285` | E · SCR-10 unreadable .pdf and a 21-page .pdf | covered |
| U8 | Tray | "Đóng" on a refusal dismisses it | `FUT:84-94` | M · SCR-10 .txt; E · PDF refusals | covered |
| U9 | Tray | count "N tệp" | `FUT:38-41`, `UFU:1115` | E · SCR-10 PDF refusals | covered |
| U10 | Tray | trash "Xoá bản vẽ {name}" → toast + "Hoàn tác" restores | `FUT:74-81`, `UFU:819-871` | E · SCR-10 tray trash | covered |
| U11 | PDF | multi-page PDF assigned → "Chọn trang" (Trang 1…N), no init until picked | `FUC:263-279`, `UFU:245-251, 569-573, 1000-1006` | E · SCR-10 3-page .pdf | covered |
| U12 | PDF | page picked → upload starts | `UFU:794-806` | E · QA-03d [U12] "Trang 2" → init pageIndex 1 | covered |
| U13 | CAD | .dwg → 422 CAD_NOT_SUPPORTED sentence + "Lỗi"; no "Bản vẽ CAD · độ chính xác cao" pill on the refused card (FIX-1404, BUG-304) | `FUC:41, 237-241, 283-295`, `UFU:1074`, `FUG:85, 189-194` | E · SCR-10 .dwg | covered |
| U14 | Card | card menu "Tuỳ chọn của tầng {name}" aria-expanded, Esc closes | `FUC:77-155` | E · SCR-10 attached drawing | covered |
| U15 | Card | "Xoá bản vẽ" on an attached file is local; undo restores; reload shows server copy without menu (F3) | `UFU:819-871`, `FUC:82-86` | E · SCR-10 attached drawing | covered |
| U16 | Card | "Huỷ" during upload (canCancelUpload) | `FUC:112-124`, `UFU:1219-1221` | E · QA-03d [U16 U20] held chunk → "Huỷ" → "Chờ xử lý" | covered |
| U17 | Card | "Thử lại" on a retryable failure | `FUC:125-137`, `UFU:1222-1232` | E · QA-03d [U17] [mocked response] chunk 500 → "Thử lại" — run-32 Env FAIL (drawings_init 429) | covered (mock, unpairable; not verified) |
| U18 | Card | auto-match from file name + "Ghép tự động từ tên tệp — kiểm tra lại" (attention badge) | `UFU:705-735, 1060-1061`, `VAL:340-383` | E · QA-03d [U18] "mat-bang-tang-2.png" → Tầng 2 + hint — run-32 Env FAIL (429 on init, "Hệ thống đang bận") | covered (not verified) |
| U19 | Card | reassign to an occupied floor → displaced file back to the tray | `UFU:752-768` | E · QA-03d [U19] displaced file back to the tray — run-32 Env FAIL (429) | covered (not verified) |
| U20 | Card | 2px progress rail + sr-only progressbar while uploading | `FUC:157-175, 297` | E · QA-03d [U16 U20] sr-only progressbar "Đã tải N% của …" | covered |
| U21 | Drag | dragenter lights the drop zone, dragleave clears it, drop accepts files | `FU:177-191`, `FUD:61`, `UFU:1208-1218` | E · SCR-10 drag over the page | covered |
| U22 | Footer | counter "N / M tầng đã có bản vẽ" (count-up + sr-only status) | `FUF:64-111`, `UFU:1120-1127` | E · SCR-10 floors without drawings / no floor / every floor attached | covered |
| U23 | Footer | "Bắt đầu xử lý" blocked → notice lists file-less floors | `FUF:73-88`, `UFU:876-959` | M · SCR-10 "Bắt đầu xử lý"; E · floors without drawings | covered |
| U24 | Footer | blocked reason "… chưa chọn trang của bản vẽ." (multi-page PDF, no page; "… chưa tải xong bản vẽ." stays for a waiting/failed file) | `UFU:945-961` | E · SCR-10 3-page .pdf | covered |
| U25 | Footer | blocked reason "… chưa nhập cao độ." / elevation out of range / duplicate elevation | `UFU:904-948` | E · QA-03d [U25] overlap sentence. Out-of-range elevation n/a: BE #25 refuses it (422 `floors.0.elevationMm`, same -30…300 m); "chưa nhập cao độ" n/a (every floor has an elevation) | covered (overlap; rest n/a) |
| U26 | Footer | "Bắt đầu xử lý" ready → navigate /pipeline only (F7) | `UFU:980-983` | E · SCR-10 every floor attached | covered |
| U27 | Footer | zero floors → block notice "Dự án chưa có tầng nào. Thêm tầng …" (F4 resolved) | `UFU:933-934` | E · SCR-10 project with no floor | covered |
| U28 | Empty | floors without drawings → "Chưa có tầng nào có bản vẽ…" | `FU:156-158`, `UFU:1155` | E · SCR-10 floors without drawings | covered |
| U29 | Empty | no floor → "Dự án chưa có tầng nào" | `FU:149-150` | E · SCR-10 project with no floor | covered |
| U30 | Error | load error → "Không tải được danh sách tầng" (+ "Thử lại" when retryable); a 404 → "Không tìm thấy dự án này" + "Về danh sách dự án", no drop zone (FIX-1401, BUG-311) | `FU:140-153`, `UFU:1200-1208, 1245-1247` | E · QA-03d [U30] [mocked response] #24 500 — run-32: no "Thử lại", no way out (F13) | covered (mock, unpairable; app FAIL) |
| U31 | Breadcrumb | "Dự án" → "/" (+ project name crumb) | `FU:194-204` | E · SCR-10 project with no floor | covered |
| U32 | Offline | "Đang làm việc ngoại tuyến" + await-network sentence | `FU:206-208`, `UFU:577-640` | E · QA-03d [U32] `context.setOffline` (real offline) — locator fixed after run-32, not re-run | covered (not re-run) |
| U33 | Compact | < 1024 px stacked cards, no horizontal scroll | `FUC:201`, `UFU:1153` | E · SCR-10 at 375 px | covered |
| U34 | Forbidden | read-only notice, no drop zone | `FU:210-220`, `UFU:109` | Phase 9 (Track B) | n/a-by-design (role) |
| U35 | Loading | 3 skeleton rows | `FU:143-148` | E · QA-03d [U35] held #24 | covered |

## SCR-11 Input quality gate (`/projects/:id/quality`)

| # | Nhóm | Phần tử / trạng thái | Nguồn (file:line) | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| Q1 | Report | "Báo cáo chất lượng" metrics + "Phát hiện" or pass notice | `IQR:279-333`, `UIQ:917-921` | M · SCR-11 load | covered |
| Q2 | Keyboard | ArrowLeft / ArrowRight switch floor | `UIQ:1089-1103` | M · SCR-11 load (keys pressed) | covered (weak: single-floor drawing) |
| Q3 | Table | "Các tầng đã đo" row click / Enter, aria-current | `IQR:216-259` | E · QA-03d [Q3] two measured floors (`drawingSeed.createMeasuredFloorsProject`) | covered (not run: 429 stop) |
| Q4 | Corners | "Chọn góc thủ công", handle arrows 1%, Esc | `IQO:280-300`, `UIQ:1105-1117` | M · SCR-11 "Chọn góc thủ công" (skips when no finding) | covered (data-dependent) |
| Q5 | Corners | "Gửi bốn góc đã chọn" → confirm "Cắt và nắn bản vẽ tầng … theo bốn góc" | `UIQ:160-169` | — | n/a-by-design (destructive; Phase 11) |
| Q6 | Dialog | "Tự động nắn" → "Nắn thẳng bản vẽ tầng …" → "Huỷ" (no POST) | `IQD:17-41`, `UIQ:155-159` | M · SCR-11 "Tự động nắn" (skips when no finding); U · U03_quality_straighten_dialog on an 8°-skewed drawing it uploads (`support/drawingSeed.ts`, BUG-364) | covered |
| Q7 | Dialog | confirm "Nắn thẳng" / "Cắt và nắn" | `IQD:33-35` | — | n/a-by-design (destructive; Phase 11) |
| Q8 | Footer | acknowledgement checkbox only with a `poor` metric; blocked note | `IQF:33-55`, `UIQ:1018-1040` | M · SCR-11 "Tiếp tục xử lý" (conditional); U · U03_quality_ack_blocked on the 8°-skewed drawing ("poor" skew, BUG-364) | covered |
| Q9 | Footer | "Tiếp tục xử lý" → /pipeline | `UIQ:1263-1269` | M · SCR-11 "Tiếp tục xử lý" | covered |
| Q10 | Footer | aria-disabled + reason when no drawing / reading / read failed | `IQF:37-77`, `UIQ:1020-1027` | E · SCR-11 floors without a drawing | covered (no-drawing branch) |
| Q11 | Footer | "Tải bản vẽ khác" → /upload | `IQF:67-69`, `UIQ:1270` | E · SCR-11 footer "Tải bản vẽ khác" | covered |
| Q12 | Empty | no drawing → "Chưa có bản vẽ để kiểm tra" + "Tải bản vẽ lên" | `IQ:145-153`, `UIQ:517-521` | E · SCR-11 floors without a drawing | covered |
| Q13 | Error | 404 project → "Không tìm thấy dự án này" + "Về danh sách dự án"; footer hidden | `IQ:131-144`, `UIQ:856-859, 1038` | E · SCR-11 unknown project | covered |
| Q14 | Error | other read failure → "Không đọc được kết quả kiểm tra chất lượng" + "Thử lại" | `IQ:61-62, 133-144` | E · QA-03d [Q14] [mocked response] #30 500 | covered (mock, unpairable; not run) |
| Q15 | Write error | "Chưa xử lý được bản vẽ" + focus return | `IQ:85-119, 156-164` | E · QA-03d [Q15] floor deleted elsewhere → real 404 on straighten | covered (not run) |
| Q16 | Hover | finding / metric hover ↔ image region highlight | `IQR:99-209`, `IQO:146-160` | E · QA-03d [Q16] hover + focus → region border-2 | covered (not run) |
| Q17 | Comparison | "Tỉ lệ lộ ảnh sau khi nắn" slider after a straighten | `IQP:63-64` | — | n/a-by-design (only after a destructive write) |
| Q18 | Partial | "Mới có N/M tầng đo xong…" | `UIQ:923-940` | E · QA-03d [Q18] [mocked response] real #30 body, floor flipped to not measured | covered (mock, unpairable: transient worker state; not run) |
| Q19 | Breadcrumb | "Dự án" → "/" | `IQ:203-208`, `UIQ:1274` | E · SCR-11 footer "Tải bản vẽ khác" … breadcrumb | covered |
| Q20 | Compact | < 1024 px report becomes a bottom sheet | `IQ:72-77, 176-178` | E · QA-03d [Q20] 375 px report under the drawing | covered (not run) |
| Q21 | Forbidden | actions hidden for read-only roles | `IQF:21-25, 57` | Phase 9 (Track B) | n/a-by-design (role) |

## SCR-12 Processing (`/projects/:id/pipeline`)

| # | Nhóm | Phần tử / trạng thái | Nguồn (file:line) | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| P1 | Stream | SSE progress → "Đã xong N/N tầng" (CP-5) | `UPR:172-178` | M · SCR-12 load /pipeline | covered |
| P2 | Tabs | "Xem trước" / "Nhật ký"; role=log | `PR:132-159`, `PLP:69-95` | M · SCR-12 tabs | covered |
| P3 | Button | "Khoá cuộn tự động" aria-pressed | `PLP:70-78` | M · SCR-12 tabs | covered |
| P4 | Button | "Sao chép nhật ký" → clipboard | `PLP:79-84`, `UPR:770-772`, `PRG:986-997` | E · SCR-10 every floor attached … log copy | covered |
| P5 | Empty log | "Chưa có dòng nhật ký nào" | `PLP:87-88` | E · log copy (branch recorded in JSON) | covered (data-dependent) |
| P6 | Steps | "Mở chi tiết bước …" / "Đóng chi tiết bước …" | `PSL:195-205` | U · U03_pipeline_step_detail (skips: the real gateway answers `stepDetails` unsupported, `PRG` PROCESSING_MISSING_CAPABILITIES, so no step has detail lines — BUG-364) | n/a-by-design (capability not wired) |
| P7 | Cancel | "Huỷ xử lý" not rendered (unsupported) | `PR:103-126`, `UPR:790` | M · SCR-12 "Huỷ xử lý"; E · SCR-12 project with no run | covered |
| P8 | Background | "Để chạy nền và thông báo cho tôi" only while a run is not final | `PR:97-101`, `UPR:791-792` | E · QA-03d [P8] upload left `receiving` (init + chunk, no complete) → button + notice | covered (not run) |
| P9 | Summary | "Duyệt lớp tường" → walls of the first done floor (FIX-1380, BUG-285) | `PSU:47-49`, `UPR:1220-1232` | M · [BUG-285] SCR-12 "Duyệt lớp tường" (last in the file); E · SCR-10 every floor attached (visible) | covered |
| P10 | Summary | "Hiệu chỉnh tỷ lệ" → scale of the first done floor (FIX-1380, BUG-285) | `PSU:50-52`, `UPR:1220-1232` | E · SCR-10 every floor attached (click → /scale) | covered |
| P11 | Empty | no run → "Chưa có bước nào để theo dõi" + "Tải bản vẽ" → /upload + "Chưa có lượt xử lý nào đang chạy." | `PR:196-202`, `UPR:795-797, 1240` | E · SCR-12 project with no run | covered |
| P12 | Empty compact | < 1024 px no run is still empty (not collapsed) | `UPR:726-731` | E · SCR-12 at 375 px | covered |
| P13 | Error | read failure → alert + "Thử lại" + code + "Liên hệ hỗ trợ" → /tai-khoan; a 404 project → only "Không tìm thấy dự án này" + "Về danh sách dự án" (FIX-1385, BUG-312) | `PR:250-272`, `UPR:752-757, 1312-1336` | E · QA-03d [P13] [mocked response] N7 500 → retry / code / support → /tai-khoan | covered (mock, unpairable; not run) |
| P14 | Failure | failed step → PipelineFailure screen ("Sao chép mã lỗi") | `UPR:1280-1310`, container | M · SCR-12 (failure branch only on a real failure) | UNKNOWN (fake ML does not fail; not producible safely) |
| P15 | Chips | "Tiến độ theo tầng" chips aria-current | `PFC:20-50` | E · QA-03d [P15 P16] finished run chips | covered (not run) |
| P16 | Floors | "Số đối tượng đã nhận theo tầng" list | `PR:162-182` | E · QA-03d [P15 P16] objects list | covered (not run) |
| P17 | Queue | "Đang chờ hàng đợi — vị trí N" | `PR:239-241`, `UPR:183-184` | — | n/a (needs a queued run: a worker backlog is not producible safely on the shared stack) |
| P18 | Compact | step bar "Bước đang xử lý" + bottom sheet | `PR:187, 206-215`, `PSB:57-75` | E · QA-03d [P18] 375 px step bar + details | covered (not run) |
| P19 | Preview | "Xem trước bản vẽ đang xử lý" / no-floor empty | `PPP:47-77` | M · SCR-12 tabs ("Xem trước" selected) | covered (weak) |

## SCR-13 Pipeline graph (`/projects/:id/pipeline/graph`)

| # | Nhóm | Phần tử / trạng thái | Nguồn (file:line) | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| G1 | Empty | "Chưa có lượt xử lý nào để kể lại" (F-06) | `PG:147-152`, `PGT:208-209` | M · SCR-13 load; E · SCR-13 own project | covered |
| G2 | Overview | reason "Chưa có lượt xử lý nào, nên chưa biết hồ sơ đi nhánh nào." | `PGO:324`, `PGT:159` | E · SCR-13 own project | covered |
| G3 | Disclosure | "Chi tiết kỹ thuật" absent in empty state | `PG:146-153, 71-121` | E · SCR-13 own project | covered |
| G4 | Branch switch | "Đổi sang nhánh ảnh quét" absent (switchBranch unsupported) | `UPG:661-675`, `PGG:297` | E · SCR-13 own project | covered |
| G5 | Network | only #24 `GET /api/projects/{id}`; an unknown project → 404 → not-found strip (F6 resolved) | `PGG:304-312, 356-358` | E · SCR-13 own project; E · SCR-13 unknown project | covered |
| G6 | Detail mode, rerun, zoom, node select | detail graph controls | `PG:71-121`, `PGT:186-206` | — | n/a-by-design (unreachable with the real gateway, F-06) |
| G7 | Error | alert + "Thử lại" + code | `PG:166-178` | — | n/a-by-design (no read → no failure) |

## SCR-15 CAD branch confirm (`/projects/:id/floors/:fid/cad-confirm`)

| # | Nhóm | Phần tử / trạng thái | Nguồn (file:line) | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| C1 | Dialog | "Phát hiện tệp CAD" → "Huỷ" → "Chưa có lớp nào để ánh xạ" (F-07) | `CBD:72-76`, `CB:86, 149-152` | M · SCR-15 load | covered |
| C2 | Dialog | Esc closes → hand-off "Chuyển sang nhánh nhận dạng ảnh" + AI notice | `CB:229-258, 270`, `UCB:719-721` | E · SCR-15 Esc closes the dialog | covered |
| C3 | Dialog | "Vẫn dùng AI" → /pipeline, no write | `CBD:77-83`, `UCB:688-715` | E · SCR-15 "Vẫn dùng AI" | covered |
| C4 | Dialog | "Dùng đường từ CAD" → stage 2 "Ánh xạ lớp và xem trước hình học" | `CBD:84-91`, `CB:343-372`, `UCB:701-705` | E · SCR-15 Esc … "Dùng đường từ CAD" | covered |
| C5 | Stage 2 | "Thu gọn bảng lớp" ↔ "Mở bảng lớp" | `CB:347-350` | E · SCR-15 Esc … | covered |
| C6 | Dialog | "Ghi nhớ lựa chọn cho dự án này" absent (rememberChoice unsupported) | `CBD:57-70`, `UCB:435` | E · SCR-15 "Vẫn dùng AI" | covered |
| C7 | Stage 2 | layer role select, import options, "Nhập hình học", preview hover | `CB:184-222`, `CBT:150-160` | — | n/a-by-design (no layers from the real gateway, F-07) |
| C8 | Error | "Không thể đọc tệp CAD" + "Đọc lại tệp" + "Mã lỗi: …" | `CB:88, 288-307` | — | n/a-by-design (inspect unsupported → never errors) |

## Unknown project id (all screens, real 404)

| # | Screen | State | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| X1 | SCR-08 | "Không tải được cài đặt dự án" + "Về danh sách dự án" → "/" | `PS:61-66, 101-107` | E · SCR-08 unknown project | covered |
| X2 | SCR-09 | "Không tìm thấy dự án này" + "Về danh sách dự án" → "/" | `FT:201-212` | E · SCR-09 unknown project | covered |
| X3 | SCR-10 | "Không tìm thấy dự án này" + "Về danh sách dự án" → "/"; no drop zone, no "Thử lại" | `FU:140-153` | E · SCR-10 unknown project | covered |
| X4 | SCR-11 | "Không tìm thấy dự án này" + "Về danh sách dự án"; footer hidden | `IQ:131-144` | E · SCR-11 unknown project | covered |
| X5 | SCR-12 | "Không tìm thấy dự án này" + "Về danh sách dự án" → "/"; no "Thử lại" / code / "Liên hệ hỗ trợ" | `PR:250-257`, `UPR:1315-1326` | E · SCR-12 unknown project | covered |
| X6 | SCR-13 | #24 404 → "Không tìm thấy dự án này" + "Về danh sách dự án" → "/" (F6 resolved) | `PGG:304-312`, `PG:136-148` | E · SCR-13 unknown project | covered |

## Mocked tests and their pairs

| Test | Mocked response | Pair |
|---|---|---|
| E · SCR-09 [mocked response] GET floors 500 | `GET /api/projects/:id/floors` 500 | unpairable: 5xx is not producible on the shared stack — needs its "unpairable" row in `coverage/phase03-be.md` (BE agent) |

## QA-03d (gap rows, run-32-p03fe)

- 41 new edge tests (`QA-03d` describes at the end of `phase03_pipeline_edge.spec.ts`, row id in each title) + an Esc step in the existing
  settings-conflict test (S24); one additive helper `support/drawingSeed.ts` `createMeasuredFloorsProject`. Edge: 50 → 91; FE layers 107 → 148;
  mocked 1 → 8 (5.4 %).
- Live run (headless, web ccd645a5): SCR-08 + SCR-09: 19 passed, 1 skipped (S32 data), 2 app failures (S35, S36). SCR-10: 4 passed, 3 Env (429 on
  `drawings_init` — the run stopped there per brief: U17, U18, U19), 1 app failure (U30), 1 test bug fixed (U32), 1 test removed (U25 out-of-range:
  BE refuses it at #25). SCR-11 / SCR-12 gap tests (11) not run yet.
- **F13** a 5xx on the settings / upload load (S36, U30) is a dead end: no "Thử lại" — no action at all (500 not in RETRYABLE_STATUSES → `toAppError`
  not retryable) while the sentence says "Hãy thử lại sau ít phút"; SCR-09 recovers with "Thử lại". **F14** member add 429: the http client retries
  the idempotent POST on 429 (BE Retry-After ≤ 10, core/ratelimit.py:92) and the user gets "Máy chủ phản hồi quá lâu…" instead of UPM:34 + the locked
  button. **F15** FE accepts a code / notes of only spaces (checks the trimmed text, sends the raw one); BE strips and 422s (S19/S20 assert the field
  sentence that results).
- Remaining gap rows: none open (Q16 hover, P15-P18 display rows covered but unverified live; P17, F32r ID_TAKEN/AMBIGUOUS, U25 range → n/a).

## Summary

- FE rows: **173** (SCR-08 45, SCR-09 32, SCR-10 35, SCR-11 21, SCR-12 19, SCR-13 7, SCR-15 8, unknown-project 6; findings F1–F12 not counted).
  covered **121** · gap **38** · UNKNOWN **2** (S36, P14) · n/a-by-design **12**.
- Edge tests: **50** in `phase03_pipeline_edge.spec.ts` (49 real, 1 mocked). Mocked share for phase 03 UI layers: 1 of 69 (19 M + 50 E) ≈ **1.4 %** (limit 35 %).
- Author run `run-17-author` (`phase03-edge`): 44 passed / 6 failed; 5 were test bugs (fixed: auto-elevation default, duplicate "Chưa có bản vẽ" text,
  unroute matcher identity, aria-disabled click needs `force`, summary actions absent by source) and re-run in `phase03-r2-edge`;
  1 is an app failure left failing: F2 (SCR-09 at 375 px). F3/F7 are asserted as the source behaves and listed as findings; F1/F4/F5/F6/F10 are resolved by the QA-03b fixes (FIX-1424/1400/1422/1384/1380) and now asserted as fixed.
- Open gaps by priority: (main flow) U12 page pick → upload, U18 auto-match, U19 displacement, Q3 multi-floor table; (errors) U16/U17 cancel/retry mid-upload,
  U32 offline, Q14 quality 5xx, S44 danger refusal; (edges) F5r same-name rename, F21r restore window, U25 elevation reasons;
  (display / UI-spec candidates) S3, S26, S38, S39, F28r, F31r, U20, U35, P15–P18, Q16, Q20.
