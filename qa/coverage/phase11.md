# Phase 11 coverage — phá huỷ + đăng xuất (FE)

Nguồn: catalog QA-11 C1–C3 (`backend/dieu-phoi/chay/QA-11/`), khoá 2026-10-14. Stack thật, dữ liệu riêng tự seed (không phá main chain/CP-2/phiên admin chung). Main chain `phase11_teardown.spec.ts` giữ nguyên. Mỗi dòng cần phủ = một `test.step('[id] …')` trong `qa/tests/phase11_*.spec.ts` (cổng: `node tools/coverage-gate.mjs --phase 11`).

# QA-11 C1 — catalog phase 11 phá huỷ: tầng / bản vẽ / chất lượng (tiền tố `11F`, slug `floors`)

FE `F:/worktrees/AppFront/p11-int` 5fcaf502, BE `F:/App/AppBack` main dc510655 (chỉ đọc). Khuôn `QA-03d/flow-catalog.md`. Khổ: chỉ 1920/1440/1024/768.
Viết tắt đường dẫn gốc `src/screens/...`. Test hiện có: `qa/tests/phase03_{upload,quality,floors}_*.spec.ts`, `phase05_3d_viewer_edge.spec.ts`, `phase04_qc_layers_edge.spec.ts`.

## SCR-10 FloorUploadScreen (gỡ bản vẽ + "Hoàn tác xoá bản vẽ") — files: UFU=src/screens/upload/FloorUploadScreen/useFloorUploadScreen.ts, FUC=FloorUploadCard.tsx, FUT=FloorUploadTray.tsx, UGW=floorUploadGateway.ts, UT=src/lib/mutations/undoTicket.ts

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-A-001 | A | trash trên thẻ tầng → gỡ ngay, KHÔNG hộp thoại xác nhận | nút `Xoá bản vẽ {tên tệp}`; không `alertdialog` (UFU:933-935 "xoá xảy ra NGAY, không hộp thoại") | `removeFile` chạy đồng bộ (UFU:927-935); `getByRole(alertdialog)` count 0 | edge | covered | phase03_upload_edge 10-A-026 | real | dự án riêng + 1 bản vẽ gắn tầng 1 (`createProject`+`drawingSeed`) |
| 11F-A-002 | A | toast sau gỡ nói đúng chữ, `role=status` | "Đã xoá bản vẽ {tên tệp}" (UFU:977) | `options.onToast` message (UFU:976-981) | edge | covered | phase03_upload_edge 10-A-025 | real | như trên |
| 11F-A-003 | A | "Hoàn tác" trong hạn → tệp trở lại, KHÔNG request nào (xoá không gọi máy chủ) | nút "Hoàn tác"; `recordWrites` rỗng sau mốc toast đóng (UFU:928-960) | `ticket.undo()` → `setAttachments` thêm lại (UFU:941-961); vé 8 s (UT:18) | edge | covered | phase03_upload_edge 10-A-025 | real | như trên |
| 11F-A-004 | A | gỡ tệp ở khay → tiêu điểm sang thùng rác lân cận, không về `<body>` | `document.activeElement` là nút `Xoá bản vẽ …` còn lại hoặc vùng khay (FUT:39-48) | `removeAndKeepFocus` (FUT:42-48) | edge | partial | phase03_upload_edge 10-A-025 (không khẳng định tiêu điểm) | real | 2 tệp trong khay |
| 11F-A-005 | A | bấm đúp thùng rác → chỉ MỘT toast, một lượt gỡ | đúng 1 toast "Đã xoá bản vẽ …"; lần 2 vô hiệu vì tệp đã khỏi `attachments` (UFU:927-931) | `findAttachment(fileId) === null` → return | edge | missing |  | real | 1 tệp khay |
| 11F-A-006 | A | "Hoàn tác" bấm hai lần → tệp không nhân đôi | 1 thẻ/tệp sau lần 2 (UFU:956-960) | `previous.some(a => a.id === removed.id) ? previous`; vé `used` (UT:36) | edge | missing |  | real | như 005 |
| 11F-A-007 | A | tầng cũ đã nhận tệp khác trong lúc chờ → "Hoàn tác" trả tệp về KHAY và đọc thông báo | tệp ở khay + câu `displacedSentence(tên)` (UFU:951-966) | `occupied` → `toTray()` + `announce` (NO-393) | edge | covered | phase03_upload_edge 10-A-028 | real | 2 tệp + 1 tầng |
| 11F-A-008 | A | quá 8 s (đồng hồ giả) → toast biến mất, "Hoàn tác" không còn; tệp không quay lại | toast gone; khay trống (UT:18 `UNDO_WINDOW_MS`=8000) | `afterUndoWindow`/vé hết hạn; dùng `page.clock` (không ngủ 8 s) | edge | covered | phase03_upload_edge 10-A-029 | real | 1 tệp khay |
| 11F-A-009 | A | gỡ tệp đã gắn lên máy chủ chỉ là gỡ cục bộ: tải lại trang → bản vẽ máy chủ còn, KHÔNG DELETE nào | sau reload thẻ tầng vẫn có tệp; không `DELETE` trong log | `removeFile` không gọi gateway ghi (UFU:931-935 "xoá không gọi máy chủ") | edge | covered | phase03_upload_edge 10-A-026 | real | tầng 1 có bản vẽ đã `complete` |
| 11F-A-010 | A | gỡ tệp đang tải → huỷ lượt tải; "Hoàn tác" tải lại từ đầu | trạng thái "Đang tải" → sau undo `startUpload` lại (UFU:969-971) | `cancelTask` + `startUpload(removed, floorId)` | edge | missing |  | mock | tệp lớn bị chặn bằng route giữ (chỉ trạng thái đang tải) |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-B-001 | B | gỡ tệp duy nhất của tầng → bộ đếm giảm và lý do chặn "… chưa có bản vẽ." trở lại | bộ đếm "N / M tầng đã có bản vẽ" giảm 1; nút chính khoá với lý do tầng đó (UFU:985-1010) | `blockReasons` đọc `attachmentByFloor` | edge | partial | phase03_upload_edge 10-A-034 (đi chiều ngược) | real | dự án 2 tầng, tầng 1 có tệp |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-D-001 | D | viewer: không có thùng rác | `canRemoveFile=false`, `removeLabel=null` → không nút `Xoá bản vẽ …` (UFU:1206-1233) | `canEdit` false | edge | partial | phase09_roles_matrix (chung) | real | viewer thành viên (`poolUser` p11-floors-viewer) |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-E-001 | E | thùng rác có nhãn đúng, Enter/Space kích hoạt, toast `role=status` có "Hoàn tác" trong thứ tự Tab | aria-label `Xoá bản vẽ {tên}`; toast `getByRole(status)` (FUT:97, FUC:151) | nhãn lấy từ `removeLabel` (UFU:1207,1233) | edge | partial | phase03_upload_edge 10-E (focus nút Xoá, dòng 386) | real | 1 tệp khay |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-F-001 | F | thẻ tầng + toast hoàn tác ở 4 khổ | không tràn ngang, toast không che nút chính (1920/1440/1024/768) | `verifyUi` đo bố cục | ui | missing |  | real | 1 tệp gắn tầng |
| 11F-F-002 | F | khay tệp có thùng rác + toast ở 4 khổ | như trên | `verifyUi` | ui | missing |  | real | 2 tệp khay |
| 11F-F-900 | F | khổ 375 / `/m/` | n/a ngoài phạm vi: mobile | brief quyết định nền | n/a | n/a |  | n/a |  |

## SCR-11 InputQualityGate ("Tự động nắn" → "Nắn thẳng", "Cắt và nắn") — files: UIQ=src/screens/upload/InputQualityGate/useInputQualityGate.ts, IQD=InputQualityGateConfirmDialog.tsx, IQGW=inputQualityGateway.ts, IQE=inputQualityWriteErrors.ts

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-A-101 | A | "Tự động nắn" chỉ MỞ hộp thoại, chưa có POST | nút "Tự động nắn" (UIQ:168); `recordWrites` rỗng sau khi hộp thoại hiện | `onStraighten` → `setPendingWrite` (UIQ:1142-1150) | edge | covered | phase03_quality_edge FL-11-01 (11-E-009) | real | tầng nghiêng riêng (`drawingSeed` skew), engineer thành viên |
| 11F-A-102 | A | hộp thoại nắn đúng chữ | tiêu đề "Nắn thẳng bản vẽ tầng {tên}"; thân "Máy chủ sẽ thay ảnh gốc bằng ảnh đã nắn và xử lý lại tầng này; việc này không hoàn tác được."; nút "Huỷ" + "Nắn thẳng" (UIQ:156-160) | `COPY.*` + IQD:25-34 | edge | covered | phase03_quality_edge 11-E-009 | real | như trên |
| 11F-A-103 | A | "Huỷ" đóng hộp thoại, không POST, tiêu điểm về nút mở | hộp thoại gone; không POST; focus = "Tự động nắn" | `onCancelWrite` (UIQ:1249-1253) | edge | partial | phase03_quality_edge 11-E-009 (tiêu điểm); không khẳng định "không POST" | real | như trên |
| 11F-A-104 | A | Esc đóng hộp thoại, không POST | không POST sau khi hộp thoại đóng | IQD:22 `onClose={onCancelWrite}` | edge | covered | phase03_quality_edge 11-A-026 | real | như trên |
| 11F-A-105 | A | Enter khi tiêu điểm ở "Huỷ" KHÔNG xác nhận | không POST; hộp thoại đóng | nút Huỷ `variant=ghost` onClick onCancelWrite (IQD:30) | edge | missing |  | real | như trên |
| 11F-A-106 | A | "Nắn thẳng" → đúng MỘT `POST …/floors/{id}/quality/straighten` có Idempotency-Key, 200 | status 200, header `idempotency-key` ≠ rỗng | `keyFor("straighten:{floorId}")` (IQGW:177-181) | edge | covered | phase03_quality_edge 11-A-027 | real | như trên |
| 11F-A-107 | A | sau nắn: đọc "Đã nắn thẳng bản vẽ", phát hiện nghiêng biến mất | `role=status` "Đã nắn thẳng bản vẽ" (UIQ:170 straightenedAnnouncement) | `finishWrite` | edge | covered | phase03_quality_edge 11-A-027 | real | như trên |
| 11F-A-108 | A | không có toast "Hoàn tác" sau nắn (không hoàn tác được) | 0 nút "Hoàn tác" trong 1 s sau mốc thông báo (UIQ:25,417) | vé không tồn tại | edge | missing |  | real | như trên |
| 11F-A-109 | A | hộp thoại cắt đúng chữ | tiêu đề "Cắt và nắn bản vẽ tầng {tên} theo bốn góc"; thân "Máy chủ sẽ cắt, nắn lại bản vẽ theo bốn góc và xử lý lại tầng này; việc này không hoàn tác được."; nút "Cắt và nắn" (UIQ:161-165) | `COPY.cornersConfirm*` | edge | covered | phase03_quality_edge 11-A-021 | real | tầng thiếu khung |
| 11F-A-110 | A | "Huỷ" ở hộp thoại cắt → tay nắm góc còn, không POST | không POST; còn chế độ chọn góc | `onCancelWrite` (UIQ:1250) | edge | covered | phase03_quality_edge 11-A-022 | real | như trên |
| 11F-A-111 | A | "Cắt và nắn" → POST …/quality/corners có Idempotency-Key + 4 tỉ lệ, 200 | 200; thoát chế độ chọn góc; phát hiện khung biến mất | `keyFor("corners:{floorId}", body)` (IQGW:183-191) | edge | covered | phase03_quality_edge 11-A-023 | real | như trên |
| 11F-A-112 | A | bấm đúp "Nắn thẳng"/"Cắt và nắn" trong hộp thoại → đúng MỘT POST | 1 request ghi (nút `disabled={isBusy}` + `isWriteLocked`, UIQ:1191-1195) | `settle(slot)` + khoá ghi | edge | missing |  | mock | giữ phản hồi bằng route (≤0,35 mock) |
| 11F-A-113 | A | thử lại sau mất mạng dùng CÙNG Idempotency-Key | 2 request cùng header `idempotency-key` | `keyFor(slot, body)` giữ khoá theo slot (IQGW:177-181) | edge | missing |  | mock | abort lần 1 rồi cho qua |

### C Validation/logic

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-C-101 | C | tầng đã có chỉnh tay → từ chối với câu đúng | "Tầng này đã có tỉ lệ hoặc hình học do người chỉnh, nên không nắn hay cắt lại bản vẽ được nữa." (IQE:23-24) | `QUALITY_LAYER_REVIEWED` (BE quality/service.py:120) | edge | covered | phase03_quality_edge FL-11-07 | real | tầng có lớp PUT #35 |
| 11F-C-102 | C | bản vẽ vừa đổi (`QUALITY_DRAWING_CHANGED`) → câu + đọc lại kết quả đo | "Bản vẽ của tầng vừa đổi, kết quả đo đã được đọc lại; hãy xem rồi thử lại." + GET assess lại | IQE:22, reread=true | edge | covered | phase03_quality_edge FL-11-09 [mocked] | mock | route 409 |
| 11F-C-103 | C | bốn góc không hợp lệ → 422 `VALIDATION field=corners` | "Bốn góc chưa tạo thành một khung hợp lệ; hãy chọn lại." (IQE:25) | IQE:67 | edge | covered | phase03_quality_edge FL-11-02 (422) | real | tầng thiếu khung, kéo góc chéo |
| 11F-C-104 | C | mất mạng/hết giờ khi ghi → "Chưa chắc máy chủ đã nhận thao tác; kết quả đo đang được đọc lại." | câu đó + đọc lại | IQE:30, kind network/timeout | edge | covered | phase03_quality_edge FL-11-09 [mocked] | mock | abort |
| 11F-C-105 | C | các mã còn lại → đúng câu (ảnh quá lớn, PDF không đọc, tệp hỏng, hàng đợi đầy) | "Ảnh bản vẽ lớn hơn mức xử lý được; hãy tải bản vẽ nhỏ hơn." / "Không đọc được trang PDF của bản vẽ; hãy tải lại tệp." / "Tệp bản vẽ bị hỏng; hãy tải lại tệp." / "Hàng xử lý đang đầy; hãy thử lại sau ít phút." | IQE:26-29 | edge | covered | phase03_quality_edge FL-11-09 [mocked] | mock | route 4 mã |
| 11F-C-106 | C | lỗi khi ghi → dữ liệu còn nguyên: danh sách phát hiện, số liệu, ảnh không đổi; hộp thoại đóng, nút dùng lại được | phát hiện cũ còn; nút "Tự động nắn" bật lại | `failWrite` không đổi báo cáo (UIQ) | edge | partial | phase03_quality_edge FL-11-09 | mock | route 500 |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-D-101 | D | viewer: "Tự động nắn"/"Chọn góc thủ công" không dùng được | nút khoá/ẩn; không POST | `canEdit` false (UIQ:1143) | edge | covered | phase03_quality_edge FL-11-05 | real | viewer p11-floors-viewer |
| 11F-D-102 | D | vai bị hạ giữa phiên → "Nắn thẳng" nhận 403, câu từ chối, dữ liệu nguyên | 403 + câu `describeApiFailure`; ảnh gốc không đổi | BE quality/router.py:25 `floor.upload` | edge | covered | phase03_quality_edge FL-11-06 | real | engineer rồi hạ viewer (slot p11-floors-flip) |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-E-101 | E | hộp thoại: `aria-modal`, có nhãn, tiêu điểm bị nhốt | `dialog` modal có tên = tiêu đề; Tab không thoát | Modal.Root (IQD:22) | edge | covered | phase03_quality_edge 11-E-009 | real | như 101 |
| 11F-E-102 | E | tiêu điểm đầu vào hộp thoại và trả về nút mở khi đóng bằng Esc | focus trong hộp thoại lúc mở; về "Tự động nắn" khi đóng | Modal | edge | partial | phase03_quality_edge 11-E-009 (chỉ Huỷ) | real | như trên |
| 11F-E-103 | E | đang ghi: nút Huỷ/xác nhận `disabled`, Esc bị bỏ qua | cả hai `disabled`; Esc không đóng | `isBusy` (IQD:30-33), `onCancelWrite` bỏ qua khi `isWriting` | edge | covered | phase03_quality_edge 11-B-019 | mock | giữ phản hồi |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-F-101 | F | hộp thoại nắn ở 4 khổ | không tràn, nút trong khung | `verifyUi` | ui | missing |  | real | như 101 |
| 11F-F-102 | F | hộp thoại cắt + chế độ chọn góc ở 4 khổ | như trên | `verifyUi` | ui | missing |  | real | như 109 |
| 11F-F-901 | F | khổ 375 / `/m/` | n/a ngoài phạm vi: mobile | brief | n/a | n/a |  | n/a |  |

## SCR-09 FloorManager ("Xoá tầng" không xác nhận + "Hoàn tác" <8 s) — files: UFM=src/screens/qc/FloorManager/useFloorManager.ts, FT=FloorTable.tsx, FGW=floorManagerGateway.ts; BE=apps/api/floors/{router,service}.py

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-A-201 | A | menu "Tuỳ chọn" → "Xoá tầng": DELETE /api/floors/:id NGAY, không hộp thoại | `DELETE` 200 ngay; 0 `alertdialog` (UFM:62-67; FT:180-184) | `onRemoveFloor` → `removeRequest` (UFM:1456-1477, 784-790) | edge | covered | phase03_floors_edge 09-A-029 | real | dự án riêng 3 tầng (`createProject` + POST floors) |
| 11F-A-202 | A | toast "Đã xoá tầng {tên}." có nút "Hoàn tác" | chữ "Đã xoá tầng Tầng 2." (FGW:586) | `removeFloorToastDescription` | edge | covered | phase03_floors_edge 09-A-029 | real | như trên |
| 11F-A-203 | A | "Hoàn tác" trong 8 s → POST /projects/:id/floors cùng body.id; hàng quay lại | `POST` 201; cùng id (BE khôi phục tầng xoá mềm trong cửa sổ `floor_restore_window_s`=600) | `applyUndo` → `inverseRequestsOf` (UFM:982-1068); BE floors/service.py `create_floor` | edge | covered | phase03_floors_edge 09-A-029 | real | như trên |
| 11F-A-204 | A | nội dung tầng (tường/phòng) cũng trở lại sau hoàn tác | PATCH …/spatial khôi phục; đếm đối tượng bằng trước khi xoá | `createRemoveFloorCommand` giữ `before` đầy đủ (FGW:771-830) | edge | partial | phase03_floors_edge 09-A-029 (chỉ hàng bảng) | real | tầng có đối tượng seed |
| 11F-A-205 | A | xoá tầng đang chọn → bỏ chọn | không còn hàng `aria-selected`; panel chi tiết đóng (UFM:1464) | `setSelectedFloorId(null)` | edge | missing |  | real | như trên |
| 11F-A-206 | A | bấm đúp "Xoá tầng" → đúng MỘT DELETE | 1 `DELETE` | `runExclusive(queueKey)` (UFM:998) | edge | missing |  | real | tầng phụ |
| 11F-A-207 | A | sau khi toast tắt, Mod+Z vẫn khôi phục trong 570 s | POST khôi phục; hàng về | `FLOOR_RESTORE_WINDOW_MS`=570000 (UFM:209, 1015-1022) | edge | missing |  | real | dùng `page.clock` |
| 11F-A-208 | A | quá 570 s → từ chối với câu hết hạn, không POST | "Chưa hoàn tác được thay đổi tầng" + "Đã quá thời gian khôi phục tầng, tầng đã xoá không lấy lại được." | `undoExpired` (UFM:201) | edge | missing |  | real | `page.clock.fastForward` |
| 11F-A-209 | A | xoá lại tầng vừa khôi phục → DELETE lần nữa 200, toast mới | `DELETE` 200 lần 2; toast mới | chuỗi xoá→hoàn tác→xoá | edge | missing |  | real | như 203 |
| 11F-A-210 | A | hoàn tác từ toast khi đã có bước mới hơn → từ chối, không request | "Thay đổi này không còn là thay đổi gần nhất nên không hoàn tác được từ thông báo." (UFM:202) | `undoNotLatest` (UFM:996-1003) | edge | partial | phase03_floors_edge 09-A-033 (cho đổi tên) | real | xoá tầng A, đổi tên B, bấm Hoàn tác toast A |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-B-201 | B | xoá tầng đã mất ở nơi khác → DELETE 404, hàng quay lại, toast lỗi | toast "Chưa lưu được thay đổi tầng" + câu `floorGone` | `reportFailure` (UFM:751-763) | edge | covered | phase03_floors_edge 09-B-018 | real | API xoá trước |
| 11F-B-202 | B | hoàn tác bị 409 (mã đã có) → câu "Mã tầng đã có trong dự án, thao tác vừa rồi đã được huỷ." | câu đó | `idTaken` (UFM:196) | edge | covered | phase03_floors_edge 09-B-026 | real | API POST cùng id |
| 11F-B-203 | B | xoá tầng cuối → "Chưa có tầng nào" | empty state | FT empty | edge | covered | phase03_floors_edge 09-A-031 | real | dự án 1 tầng |
| 11F-B-204 | B | hậu quả máy chủ: GET /projects/:id/floors không còn tầng; tải lại trang vẫn mất | mảng không chứa id; GET …/floors/:id/… → 404 `resource:"floor"` | BE `delete_floor` `_mark_deleted` + `get_floor` bỏ tầng xoá (floors/service.py:177-199) | api | missing | py:apps/api/floors/tests/test_routes_delete.py (BE) | real | như 201 |
| 11F-B-205 | B | URL cũ của tầng đã xoá (…/floors/:id/…): màn NotFound/AccessDenied, không treo | NotFound (SCR-39) hoặc thông báo tầng không còn | router + `floorGone` | edge | missing |  | real | dùng id vừa xoá |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-D-201 | D | viewer: "Xoá tầng" vắng/khoá | không mục "Xoá tầng"; chữ `forbiddenNotice` "Vai của bạn chỉ xem được ngăn xếp tầng; mọi thao tác sửa đã được ẩn." | UFM:183 + `canEdit` | edge | partial | phase09_roles_matrix | real | viewer |
| 11F-D-202 | D | engineer (có `layer.edit`) xoá và hoàn tác được | DELETE 200 rồi POST 201 | BE FloorAccess `layer.edit` (floors/router.py:26) | edge | missing |  | real | engineer p11-floors-engineer |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-E-201 | E | menu "Tuỳ chọn" bằng bàn phím; toast "Hoàn tác" `role=status` tới được bằng Tab | mục "Xoá tầng" Enter; nút "Hoàn tác" trong thứ tự Tab | FT:180-184 | edge | partial | phase03_floors_edge 09-E-013 (cho thêm tầng) | real | như 201 |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-F-201 | F | bảng tầng + toast xoá ở 4 khổ | không tràn, toast không che hàng | `verifyUi` | ui | partial | phase03_floors_ui (không có toast xoá) | real | như 201 |
| 11F-F-902 | F | khổ 375 / `/m/` | n/a ngoài phạm vi: mobile | brief | n/a | n/a |  | n/a |  |

## SCR-21 ThicknessStandardization (xem trước → "Áp dụng", "Hoàn tác") — files: UTS=src/screens/qc/ThicknessStandardization/useThicknessStandardization.ts, TAB=ThicknessApplyBar.tsx

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-A-301 | A | ⚑ KHÔNG có nút "Áp cho mọi tầng" ở màn này (nút đó thuộc ScaleCalibration SCR-14, phase 04) | n/a: thay bằng cổng xem trước "Xem trước" → "Áp dụng" (TAB:60-63) | grep không có "Áp cho mọi tầng" trong thư mục này | n/a | n/a | phase04 owner SCR-14 | n/a |  |
| 11F-A-302 | A | "Xem trước" mở bảng, CHƯA ghi gì | không PATCH …/spatial và không autosave sau mốc bảng hiện (UTS:765-768) | `onOpenPreview` → `previewPlan` | edge | partial | phase04_qc_layers_edge | real | dự án riêng, tường độ dày lệch nhóm |
| 11F-A-303 | A | "Huỷ" ở bảng xem trước → bảng đóng, không ghi | không PATCH | `onCancelPreview` (UTS:769-771) | edge | missing |  | real | như trên |
| 11F-A-304 | A | mọi đoạn bị dung sai chặn → "Áp dụng" khoá | `disabled` khi `totalWalls === unchangedWalls.length` (TAB:205) | BUG-637 | edge | partial | phase04_qc_layers_edge | real | dung sai lớn |
| 11F-A-305 | A | "Áp lại cho mọi tường lệch nhóm" có tường đã duyệt → cảnh báo, chưa ghi | tiêu đề "Áp lại cho mọi tường lệch nhóm sẽ đổi tường đã duyệt"; "{n} tường đã duyệt sẽ bị đổi. Đề nghị loại các tường này khỏi lượt áp lại." (TAB:63-67) | `reapplyWarning` (UTS:796-) | edge | partial | phase04_qc_layers_edge | real | có tường đã duyệt |
| 11F-A-306 | A | "Huỷ" của cảnh báo → cảnh báo đóng, không ghi | cảnh báo gone; không PATCH | `onDismissReapplyWarning` (TAB:158) | edge | missing |  | real | như trên |
| 11F-A-307 | A | "Loại tường đã duyệt ra rồi xem trước" → bảng xem trước không chứa tường đã duyệt | bảng xem trước; số tường giảm | `onReapplyFilter(true)` (TAB:142) | edge | missing |  | real | như trên |
| 11F-A-308 | A | "Xem trước cho tất cả" → bảng xem trước gồm cả tường đã duyệt | bảng hiện | `onReapplyFilter(false)` (TAB:151) | edge | missing |  | real | như trên |
| 11F-A-309 | A | "Áp dụng" → MỘT lượt `runTransaction`, đúng các hàng đã xem, toast mời hoàn tác | toast "Chuẩn hoá độ dày {n} tường." có "Hoàn tác"; PATCH autosave 1 lô | `runBatch` (UTS:644-680), `standardizeDescription` | edge | partial | phase04_qc_layers_edge | real | như trên |
| 11F-A-310 | A | nút "Hoàn tác" của thanh hoàn tác lượt áp và thu hồi toast | tường về độ dày cũ; toast gone | `onUndo` + `withdraw` (UTS:613-618) | edge | partial | phase04_qc_layers_edge | real | như trên |
| 11F-A-311 | A | Mod+Z trong màn = cùng việc với "Hoàn tác" (không rơi xuống undo toàn cục) | tường hoàn lại | `useShortcut Mod+Z` (UTS:878-885) | edge | missing |  | real | như trên |
| 11F-A-312 | A | hoàn tác khi đã có bước mới hơn → từ chối, không đổi | toast từ chối `thicknessStandardization.undoRefused` | `undoIfNewest` (UTS:646-655) | edge | missing |  | real | áp rồi sửa tường khác |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-B-301 | B | sau "Áp dụng" tải lại trang → độ dày mới còn (autosave lên máy chủ) | GET spatial có độ dày mới | `autosave.notifyChange` | edge | missing |  | real | như trên |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-D-301 | D | viewer: không áp/hoàn tác được | nút khoá hoặc màn chỉ đọc; không PATCH | `canEdit` (UTS:597) | edge | partial | phase09_roles_matrix | real | viewer |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-F-301 | F | bảng xem trước + danh sách "tường không đổi được" ở 4 khổ | không tràn | `verifyUi` | ui | missing |  | real | như trên |
| 11F-F-302 | F | cảnh báo áp lại ở 4 khổ | không tràn | `verifyUi` | ui | missing |  | real | như 305 |
| 11F-F-903 | F | khổ 375 / `/m/` | n/a ngoài phạm vi: mobile | brief | n/a | n/a |  | n/a |  |

## SCR-25 MeasurementTool (xoá phép đo đã ghim + hoàn tác) — files: UMT=src/screens/viewer/MeasurementTool/useMeasurementTool.ts, MTL=MeasurementList.tsx, MUT=src/lib/mutations/measurement.ts; BE=apps/api/measurements/router.py

### A User flows

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-A-401 | A | trash `Xoá {tên}` → DELETE /api/projects/:p/measurements/:id 204, hàng biến mất ngay (lạc quan) | 204; hàng gone; KHÔNG hộp thoại (MTL:152-160) | `deleteMeasurement` (MUT:152-170) | edge | covered | phase05_3d_viewer_edge SCR-25 (xoá) | real | dự án riêng + 2 phép đo (POST #17) |
| 11F-A-402 | A | phím Delete trên hàng đang rê → xoá giống nút | DELETE 204 | UMT:923 | edge | covered | phase05_3d_viewer_edge "Delete key on the hovered row" | real | như trên |
| 11F-A-403 | A | toast hoàn tác chữ đúng | "Hoàn tác xoá \"{tên}\"" kèm nút "Hoàn tác" (MUT:176) | `publishUndo` (UMT:389-) | edge | partial | phase05_3d_viewer_edge (nút Hoàn tác thấy) | real | như trên |
| 11F-A-404 | A | "Hoàn tác" → POST nguyên bản ghi (id cũ), hàng quay lại | POST 200/201 cùng id; hàng hiện | `postMeasurementToServer` (MUT:176-205); BE 200 khi gửi lại đúng bản đã lưu (measurements/router.py:30-38) | edge | partial | phase05_3d_viewer_edge | real | như trên |
| 11F-A-405 | A | hoàn tác khi id bị chiếm (409 ID_TAKEN) → đánh số lại và POST lần 2 | hàng hiện với id mới | `resolveUndoConflict` (MUT:184-195) | edge | missing |  | real | API tạo bản ghi cùng id trong lúc chờ |
| 11F-A-406 | A | bấm đúp trash → đúng MỘT DELETE | 1 `DELETE` | hàng đã khỏi danh sách lạc quan | edge | missing |  | real | như trên |
| 11F-A-407 | A | qua 8 s: nút "Hoàn tác" biến mất; tải lại — không còn hàng, GET danh sách không chứa id | `Hoàn tác` count 0; GET #16 không id | `UNDO_WINDOW_MS` 8000 | edge | covered | phase05_3d_viewer_edge (8 s window) | real | như trên |

### B States

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-B-401 | B | xoá phép đo đã mất ở nơi khác → 404 → "Phép đo này đã bị xoá ở nơi khác", hàng gone | toast đó | UMT:216, 826-842 | edge | covered | phase05_3d_viewer_edge SCR-25 deleted elsewhere | real | API xoá trước |
| 11F-B-402 | B | 5xx khi xoá → "Chưa xoá được phép đo, hãy thử lại", hàng còn | toast đó; hàng quay lại sau rollback | UMT:215 | edge | missing |  | mock | route 500 |
| 11F-B-403 | B | 403 khi xoá → "Bạn không có quyền xoá phép đo trong dự án này" | toast đó | UMT:217 | edge | missing |  | mock | route 403 |
| 11F-B-404 | B | hoàn tác lỗi → "Chưa hoàn tác được việc xoá phép đo" | toast đó | UMT:218, 370-376 | edge | missing |  | mock | route POST 500 |

### D Roles

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-D-401 | D | viewer: không trash; chú thích quyền | không nút `Xoá …`; "Bạn không có quyền ghim phép đo trong dự án này. Liên hệ quản trị dự án." | `canPin` false (MTL:236; scenarios:363) | edge | partial | phase09_roles_matrix | real | viewer |

### E A11y/keyboard

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-E-401 | E | trash có nhãn `Xoá {tên}`, tới được bằng Tab | focus + Enter xoá | MTL:154 | edge | missing |  | real | như 401 |

### F Responsive

| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11F-F-401 | F | danh sách phép đo + toast hoàn tác ở 4 khổ | không tràn | `verifyUi` | ui | missing |  | real | như 401 |
| 11F-F-904 | F | khổ 375 / `/m/` | n/a ngoài phạm vi: mobile | brief | n/a | n/a |  | n/a |  |

### Notes

- ⚑ SCR-21: brief nói "Áp cho mọi tầng có xác nhận" nhưng màn ThicknessStandardization KHÔNG có nút đó (chỉ "Xem trước" → "Áp dụng", "Hoàn tác", "Áp lại cho mọi tường lệch nhóm"); "Áp tỉ lệ cho mọi tầng" thuộc ScaleCalibration SCR-14 (phase 04). Đã thay bằng dòng 11F-A-301 (n/a) và dòng cho cổng xem trước.
- ⚑ SCR-09: brief ghi "POST mới id mới" khi hoàn tác xoá tầng; nguồn thì POST lại CÙNG id (BE `create_floor` khôi phục tầng xoá mềm, cửa sổ `floor_restore_window_s`=600 s, floors/settings.py:19; FE giữ 570 s, UFM:209). Oracle theo nguồn; test 09-A-029 cũng khẳng định cùng id.
- ⚑ SCR-10 (UFU:927-981): "Xoá bản vẽ" chỉ gỡ cục bộ, không có DELETE: bản vẽ đã gắn lên máy chủ sống lại sau tải lại trang, trong khi toast nói "Đã xoá bản vẽ …". Kết hợp 11F-A-009 (đã có test xác nhận hành vi) — người dùng có thể tưởng bản vẽ đã mất; hỏi chủ sản phẩm có phải ý đồ (không có endpoint xoá bản vẽ?).
- ⚑ SCR-09 Notes: `FLOOR_RESTORE_WINDOW_MS` 570 s nghĩa là "Hoàn tác" bằng Mod+Z vẫn khôi phục sau khi toast 8 s tắt (UFM:1015-1022); cần xác nhận là ý đồ (11F-A-207/208).
- SCR-11 nắn/cắt "không hoàn tác được": không có vé (UIQ:25,417) — 11F-A-108 khẳng định không có "Hoàn tác". Idempotency: khoá theo slot `straighten:{floorId}`/`corners:{floorId}` (IQGW:177-191); thử lại cùng khoá — 11F-A-113.
- SCR-25: xoá có toast hoàn tác 8 s (MUT:176); BE xoá cứng, 204 (measurements/router.py:41-44). Phase 09 roles matrix chỉ phủ vai ở mức chung.
- Không có dòng `n/a-by-design → Phase 11` thuộc 5 màn này trong `qa/coverage/*.md` (grep `Phase 11|phase 11|P11` chỉ ra một dòng không liên quan, phase03.md:222).
- Endpoint BE (DELETE floors #11, POST straighten/corners, DELETE measurements #18) thuộc C4 (`B11`); ở đây chỉ hành vi FE + hậu quả quan sát được (11F-B-204).

## Summary

| màn | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| 10 | 16 | 1 | 15 | 6 | 4 | 5 | 1 | 0 |
| 11 | 27 | 1 | 26 | 17 | 3 | 6 | 7 | 0 |
| 09 | 20 | 1 | 19 | 6 | 5 | 8 | 0 | 0 |
| 21 | 17 | 2 | 15 | 0 | 6 | 9 | 0 | 0 |
| 25 | 15 | 1 | 14 | 4 | 3 | 7 | 3 | 0 |
| **Σ** | 95 | 6 | 89 | 33 | 21 | 35 | 11 | 0 |


# QA-11 S1 — catalog C2 (prefix `11P`, slug `project`): xoá mọi tầng / xoá dự án / gỡ thành viên / thẻ dashboard / phục hồi phiên bản / khôi phục luật / URL thực thể đã xoá

Generated 2026-10-14, READ ONLY from source. FE `F:/worktrees/AppFront/p11-int` master **5fcaf502** (FE `file:line` tương đối `src/screens/` trừ khi ghi khác), BE `F:/App/AppBack` main **dc510655**. Khuôn: `QA-03d/flow-catalog.md`, mẫu `QA-09/catalog-C1.md`. Khổ 1920/1440/1024/768 (không 375, không `/m/`).
⚑ = viết theo hành vi ĐÚNG, đỏ tới khi sửa. Nhóm trong id: A flows · B states · C logic · D roles · E a11y · F responsive · G api (đánh số chạy suốt tệp theo nhóm; cột `cat` là khoá ngắn). Cột `existing`: tệp spec hiện có (đọc tiêu đề test/step, chưa chạy).
Quyết định điều phối: main chain `phase11_teardown` giữ nguyên; mọi hành vi của nó có dòng ở đây (covered khi đã có bản trên dữ liệu riêng của p03/phase02, partial khi chỉ main chain) + luồng MỚI trên dữ liệu tự seed. Dòng `covered` và `n/a` KHÔNG gán luồng.

## Tóm tắt

| màn | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| SCR-08 | 49 | 1 | 48 | 17 | 9 | 22 | 6 | 0 |
| SCR-05 | 15 | 1 | 14 | 6 | 1 | 7 | 2 | 0 |
| SCR-32 | 16 | 0 | 16 | 0 | 4 | 12 | 2 | 0 |
| SCR-29 | 10 | 0 | 10 | 0 | 3 | 7 | 1 | 0 |
| SCR-39/38 | 12 | 2 | 10 | 1 | 1 | 8 | 0 | 0 |
| **tổng** | 102 | 4 | 98 | 24 | 18 | 56 | 11 | 0 |

Viết tắt FE (src/screens): DZ=`project/ProjectSettings/DangerZoneTab.tsx`, UPS=`project/ProjectSettings/useProjectSettings.ts`, PS=`project/ProjectSettings/ProjectSettings.tsx`, PSC=`project/ProjectSettings/ProjectSettings.container.tsx`, PSG=`project/ProjectSettings/projectSettingsGateway.ts`, MT=`MembersTab.tsx`, MRD=`MemberRemoveDialog.tsx`, UPM=`useProjectMembers.ts` (ba tệp cuối cùng thư mục ProjectSettings), PD=`dashboard/ProjectDashboard/ProjectDashboard.tsx`, UPD=`useProjectDashboard.ts`, PDC=`ProjectDashboard.container.tsx`, PMG=`projectMenuGroups.ts` (cùng thư mục), VH=`export/VersionHistory/VersionHistory.tsx`, UVH=`useVersionHistory.ts`, VHM=`versionHistoryModel.ts`, VHG=`versionHistoryGateway.ts`, VHC=`VersionHistory.container.tsx`, RS=`rules/RuleSettings/RuleSettings.tsx`, URS=`useRuleSettings.ts`, NF=`system/NotFound/useNotFound.ts`. BE: PR=`apps/api/projects/router.py`, MR=`apps/api/project_members/router.py`, ACC=`apps/api/projects/access.py`.

Seeds (`data needs`): **AP** admin + dự án riêng 2 tầng (`withAdminProject`, xoá trong finally) · **MP** `withMemberProject` + 1 thành viên pool · **EM** engineer pool `p11-project-eng` là thành viên dự án riêng · **VP** viewer pool `p11-project-viewer` thành viên · **VF** dự án riêng có tầng ≥2 phiên bản (`createQcProject` + `writeLayer`) · **RP** dự án riêng đã sửa luật (khác mặc định) · **AN2** admin tạo dự án qua modal.

Ma trận vai nguồn: DELETE dự án = `require_project("admin")` (PR:80); `canDelete` FE = canEdit && roles.includes("admin") (UPS:757); Gỡ thành viên = `project.settings.edit` (MR:36).

## SCR-08 ProjectSettings — Vùng nguy hiểm + Thành viên — files: DZ, UPS, PS, PSC, MT, MRD, UPM, PSG

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-A-001 | fl_open | admin mở tab "Vùng nguy hiểm": hai thẻ "Xoá mọi tầng" + "Xoá dự án" khi còn tầng | span "Xoá mọi tầng" + p `Xoá toàn bộ 2 tầng cùng bản vẽ và mô hình của chúng. Không hoàn tác được.` · DZ:59-60, UPS:1407-1410 | floorCount>0 (DZ:40,56) | edge | covered | p03_settings_edge 08-B-042; teardown SCR-08 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-002 | fl_cancel | "Xoá mọi tầng" mở hộp thoại; Esc và "Để nguyên" đóng, 0 DELETE tầng | dialog "Xoá mọi tầng của dự án?" · UPS:546; nút "Để nguyên" · PS:176-178 | cancelDanger UPS:1205 (không gọi gateway) | edge | covered | p03_settings_edge 08-A-026 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-003 | fl_msg | hộp thoại tầng đúng câu hậu quả, KHÔNG có ô gõ tên | "Mọi tầng cùng bản vẽ và mô hình của chúng sẽ bị xoá vĩnh viễn. Không hoàn tác được." · UPS:551-552; không có "Gõ lại tên dự án để xác nhận" · PS:164 | dangerConfirmationExpected=null khi action≠deleteProject (UPS:1270) | edge | covered | teardown SCR-08 floors; p03 FL-08-06 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-004 | fl_confirm | xác nhận → mỗi tầng một DELETE; toast; dialog đóng; ở lại trang | toast `Đã xoá 2 tầng của dự án.` · UPS:1239; mỗi `DELETE /api/floors/:id` 2xx, 0 DELETE project | runDeleteAllFloors UPS:1222-1245; gateway lặp từng tầng (PSG:535-540) | edge | covered | teardown SCR-08 (CP-2); p03 FL-08-06 (dự án riêng) | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-005 | fl_after | sau xoá mọi tầng: GET /api/projects/:id/floors = [], tab hiện EmptyState, thẻ "Xoá mọi tầng" biến mất, dự án còn (GET 200) | "Chưa có tầng nào" / "Dự án chưa có tầng nào, nên ở đây chưa có gì để xoá ngoài chính dự án." · DZ:72-75 | invalidate floor.list + renameProject (UPS:1231-1233); hasFloors=false | edge | partial | p03_settings_edge 08-B-041 (EmptyState); thiếu GET floors=[] và dự án còn | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-006 | pj_wrong | tên sai → nút xác nhận "Xoá dự án" khoá; đúng tên → bật | dialog "Xoá dự án này?" · UPS:547; Input "Gõ lại tên dự án để xác nhận" + hint = tên đã lưu · PS:166-169 | canConfirmDanger UPS:1272-1275: `text.trim()===expected.trim()` | edge | covered | teardown SCR-08 xoá dự án; p03 08-E-006/08-A-024 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-007 | pj_cancel | Esc / "Để nguyên" khi tên đã gõ đúng: 0 DELETE /api/projects, dự án còn (GET 200); mở lại → ô nhập rỗng | hộp đóng; mở lại ô rỗng · UPS:1198-1203 (openDanger xoá text) | cancelDanger UPS:1205-1209 | edge | partial | p03 08-E-006 (Esc đóng, focus về); thiếu 0 DELETE + ô rỗng khi mở lại | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-008 | pj_confirm | gõ đúng tên → DELETE /api/projects/:id; toast "Đã xoá dự án."; về "/"; thẻ biến mất | `PROJECT_DELETED_NOTICE` = "Đã xoá dự án." · UPS:259; navigate ROUTES.dashboard · PSC:143 | runDeleteProject UPS:1249-1262 | edge | covered | teardown SCR-08 (CP-2); p03 FL-08-06 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-009 | pj_gone | sau xoá dự án: GET /api/projects/:id → 404, "/" tải lại không còn thẻ, GET /api/projects không chứa id | 404 NOT_FOUND; danh sách không chứa id | invalidateProjectQueries("deleteProject") UPS:849, 1258; BE PR:80 | edge | partial | teardown (thẻ biến mất, CP-2); thiếu GET 404 + tải lại | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-010 | mem_remove | "Gỡ {name}" → hộp thoại, "Gỡ" → DELETE /api/projects/:id/members/:uid; toast; danh sách co lại | title `Gỡ {name} khỏi dự án?`; "Người này sẽ không còn truy cập được dự án. Muốn quay lại phải thêm lại."; toast `Đã gỡ {name} khỏi dự án.` · UPM:267-271, 259 | confirmRemoveMember UPM:238-261 | edge | covered | p03_settings_edge 08-A-018 | real | MP (admin + dự án riêng + 1 thành viên pool) |
| 11P-A-011 | mem_cancel | "Để nguyên"/Esc: 0 DELETE member | "Để nguyên" · UPM:38 | cancelRemoveMember UPM:229 | edge | covered | p03_settings_edge 08-A-020 | real | MP (admin + dự án riêng + 1 thành viên pool) |
| 11P-A-012 | mem_self | tự gỡ mình → câu riêng; DELETE 200; về "/" KHÔNG toast | "Bạn sẽ mất quyền xem dự án này. Muốn quay lại phải nhờ người khác thêm lại." · UPM:269; onSelfRemoved navigate · PSC:130 | UPM:252-255 | edge | covered | p03_settings_edge 08-A-019 | real | MP (admin + dự án riêng + 1 thành viên pool) |
| 11P-A-013 | mem_after | người bị gỡ: thẻ dự án biến mất ở "/", mở URL dự án → trạng thái không tìm thấy (không 403, không lộ tên) | GET /api/projects/:id → 404 (K08, ACC:53-62); UI nút "Về danh sách dự án" | thành viên bị gỡ mất quyền | edge | missing | — | real | EM (engineer pool p11-project-eng là thành viên; admin gỡ qua API) |
| 11P-A-014 | mem_twice | gỡ lần 2 (đã bị gỡ trước) → 404 coi như xong: hộp đóng, toast | 404 `member` → alreadyGone · UPM:243-244 |  | edge | covered | p03_settings_edge 08-B-038 | real | MP (admin + dự án riêng + 1 thành viên pool) |

### B States
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-B-001 | busy | khi DELETE dự án đang chạy (giữ phản hồi): nút xác nhận loading, "Để nguyên" + ô nhập disabled; Esc không đóng | `disabled={isDangerRunning}` · PS:168, 176, 183; cancelDanger return khi chạy · UPS:1206 | isDangerRunning UPS:1205, 1275 | edge | missing | — | mock (giữ phản hồi `page.route`) | AP (admin + dự án riêng 2 tầng) |
| 11P-B-002 | pj_500 | DELETE dự án 5xx: InlineAlert trong hộp, hộp mở, dự án còn (GET 200), nút bật lại | InlineAlert violation = `describeError(...).description` · UPS:1253, PS:161-163 | setDangerFailure; không navigate | edge | missing | — | mock (5xx khi xoá không tạo thật được) | AP (admin + dự án riêng 2 tầng) |
| 11P-B-003 | pj_403 | DELETE dự án 403 FORBIDDEN: câu quyền trong hộp, dự án còn | mô tả lỗi 403 từ describeError (UPS:1253) |  | edge | missing | — | mock | AP (admin + dự án riêng 2 tầng) |
| 11P-B-004 | fl_partial | một DELETE tầng hỏng giữa chừng → toast attention; tầng hỏng còn trong danh sách | `Đã xoá ${deleted} tầng; còn ${n} tầng chưa xoá được.` state attention · UPS:1241-1243 | failedFloorIds.length>0 | edge | missing | — | mock (1 DELETE /api/floors/:id → 500) | AP (admin + dự án riêng 2 tầng) |
| 11P-B-005 | fl_404 | GET dự án 404 khi xác nhận "Xoá mọi tầng" → câu 404 trong hộp, 0 DELETE tầng |  |  | edge | covered | p03_settings_edge 08-B-047 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-B-006 | mem_500 | DELETE member 5xx: role=alert trong hộp, hộp giữ nguyên, thành viên còn trong danh sách | `<p role="alert">` · MRD:122-126; removeFailureSentence UPM:108-116 | setRemoveError; không đóng (UPM:246) | edge | missing | — | mock | MP (admin + dự án riêng + 1 thành viên pool) |
| 11P-B-007 | mem_last | gỡ người sửa cuối: câu MEMBER_LAST_EDITOR trong hộp, dữ liệu còn | "Không gỡ được: dự án cần ít nhất một người sửa được cài đặt." · UPM:35 | removeFailureSentence UPM:111-113 | edge | missing | — | mock (BE chặn thật khó dựng với vai toàn cục) | MP (admin + dự án riêng + 1 thành viên pool) |
| 11P-B-008 | missing_proj | mở /projects/<id đã xoá>/settings: trạng thái error, nút "Về danh sách dự án" (không "Thử lại"), bấm về "/" | `isProjectMissing` = loadAppError.kind==="notFound" · UPS:1371; nút BACK_TO_PROJECTS_LABEL · PS:61-64 | 404 → lối ra là danh sách (PS:60) | edge | missing | — | real | AP (xoá qua API trước khi mở) |
| 11P-B-009 | viewer_forb | viewer: màn forbidden; không tab "Vùng nguy hiểm", không nút "Gỡ" | state forbidden khi !canEdit · UPS (state memo `if (!canEdit) return "forbidden"`); MT:68 `props.canEdit &&` | canEdit=can(edit project.settings) viewer=false | edge | partial | p03_settings_roles_edge (viewer) | real | VP (viewer pool thành viên dự án riêng) |

### C Validation/logic
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-C-001 | trim | tên đã lưu / gõ thừa khoảng trắng đầu-cuối vẫn mở khoá (so sánh trim hai phía) | nút bật khi gõ `  <tên>  ` | UPS:1274 `.trim()===.trim()` | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-C-002 | case | gõ khác hoa/thường → vẫn khoá (so sánh phân biệt hoa thường) | nút khoá khi gõ tên đảo hoa-thường | UPS:1274 so sánh chuỗi chặt | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-C-003 | enter_locked | Enter trong ô nhập khi nút khoá: 0 DELETE, hộp vẫn mở | không request ghi | nút `disabled` · PS:182; Input không nằm trong form | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-C-004 | dbl | bấm đúp "Xoá dự án" (xác nhận) → đúng 1 DELETE /api/projects/:id | 1 request | confirmDanger early-return khi !canConfirmDanger · UPS:1278 (xem ⚑ Notes) | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-C-005 | req | DELETE /api/projects/:id đúng method/path, không body; 2xx; không DELETE tầng lẻ | method DELETE, path `/api/projects/{id}` | PSG deleteProject | edge | partial | teardown SCR-08 (path+2xx) | real | AP (admin + dự án riêng 2 tầng) |
| 11P-C-006 | nodel_floors | "Xoá mọi tầng" không xoá dự án: GET /api/projects/:id = 200, tên còn |  | runDeleteAllFloors không gọi deleteProject | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-C-007 | race_name | đổi tên đang lưu rồi mở "Xoá dự án": hint hiện tên ĐÃ LƯU | hint = saved.name | UPS:1270 `saved?.name ?? snapshot?.name` | edge | covered | p03_settings_edge 08-A-024 | real | AP (admin + dự án riêng 2 tầng) |

### D Roles
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-D-001 | admin | admin: thấy tab "Vùng nguy hiểm" và cả hai nút (đối chứng) | tab "Vùng nguy hiểm" · UPS:1360 | canDelete=canEdit && roles.includes("admin") · UPS:757 | edge | covered | p03_settings_edge | real | AP (admin + dự án riêng 2 tầng) |
| 11P-D-002 | eng_nodanger | engineer (thành viên): KHÔNG có tab "Vùng nguy hiểm", CÓ nút "Gỡ {name}" | tabs không chứa danger · UPS:1360; "Gỡ" · MT:68-74 | canDelete=false (UPS:757), canEdit=true | edge | partial | p03_settings_roles_edge | real | EM (engineer pool thành viên dự án riêng) |
| 11P-D-003 | eng_delete403 | engineer gọi thẳng DELETE /api/projects/:id → 403, dự án còn nguyên | HTTP 403 FORBIDDEN; GET dự án 200 sau đó | BE `require_project("admin")` PR:80 | edge | missing | — | real (403 không phá dữ liệu) | EM |
| 11P-D-004 | viewer_member403 | viewer gọi thẳng DELETE /api/projects/:id/members/:uid → 403, thành viên còn | HTTP 403 | BE project.settings.edit MR:36 | edge | missing | — | real | VP |
| 11P-D-005 | viewer_proj403 | viewer gọi thẳng DELETE /api/projects/:id → 403; dự án còn | HTTP 403 | PR:80 | edge | missing | — | real | VP |
| 11P-D-006 | anon | ẩn danh mở /projects/:id/settings → /login?next=… | chuyển hướng /login | thuộc 11U (cổng phiên, C3) | edge | n/a | 11U-* (C3) | n/a | n/a: sở hữu C3 |

### E A11y/keyboard
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-E-001 | fl_dialog | hộp "Xoá mọi tầng của dự án?": role=dialog, focus vào trong, Tab giữ trong hộp, Esc đóng, focus về nút "Xoá mọi tầng" | Modal.Root focus-trap · PS:156 | A12 | edge | partial | p03_settings_edge 08-E-006 (chỉ hộp xoá dự án) | real | AP (admin + dự án riêng 2 tầng) |
| 11P-E-002 | pj_dialog | hộp "Xoá dự án này?" đủ a11y như trên |  |  | edge | covered | p03_settings_edge 08-E-006 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-E-003 | mem_dialog | hộp "Gỡ {name} khỏi dự án?" focus/Tab/Esc |  |  | edge | covered | p03_settings_edge 08-E-009 | real | MP (admin + dự án riêng + 1 thành viên pool) |
| 11P-E-004 | locked_key | nút xác nhận khoá: Tab bỏ qua nút disabled, Enter/Space không gửi | nút `disabled` · PS:182 |  | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-E-005 | toast_status | toast "Đã xoá dự án." / `Đã xoá N tầng của dự án.` role=status | `getByRole("status")` · teardown SCR-08 |  | edge | covered | teardown SCR-08 | real | AP (admin + dự án riêng 2 tầng) |

### F Responsive
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-F-001 | ui_fl | hộp "Xoá mọi tầng của dự án?" 4 khổ: không tràn, hai nút trong khung | width 480 · PS:156 |  | ui | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-F-002 | ui_pj | hộp "Xoá dự án này?" 4 khổ; tên dự án dài (80 ký tự) trong hint không tràn ngang | hint = tên · PS:169 |  | ui | missing | — | real | AP (tên 80 ký tự) |
| 11P-F-003 | ui_mem | hộp "Gỡ {name} khỏi dự án?" 4 khổ (tên dài) |  |  | ui | missing | — | real | MP (admin + dự án riêng + 1 thành viên pool) |
| 11P-F-004 | ui_tab | tab "Vùng nguy hiểm" 4 khổ (2 thẻ) và nhánh EmptyState "Chưa có tầng nào" | DZ:57, 72 |  | ui | missing | — | real | AP (admin + dự án riêng 2 tầng) |

### G API/BE
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-G-001 | g_proj | DELETE /api/projects/:id: admin 2xx; xoá lần 2 → 404 |  | BE PR:80-85 | edge | partial | teardown (lần 1); lần 2 ở B11 (C4) | real | AP (admin + dự án riêng 2 tầng) |
| 11P-G-002 | g_floors | mỗi tầng DELETE /api/floors/:id 2xx; tầng đã xoá → GET 404 |  | BE floors/router.py:38 | edge | partial | teardown SCR-08 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-G-003 | g_casc | sau xoá dự án: GET /api/projects/:id/floors và /floors/:fid → 404 (xoá dây chuyền) | 404 | BE xoá dự án kéo theo tầng | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-G-004 | g_mem | DELETE /api/projects/:id/members/:uid: path đúng; 2xx |  | BE MR:73 | edge | covered | p03_settings_edge 08-A-018 | real | MP (admin + dự án riêng + 1 thành viên pool) |

## SCR-05 ProjectDashboard — xoá dự án + hoàn tác tạo — files: PD, UPD, PDC, PMG

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-A-015 | d_menu | menu thẻ "Xoá" → hộp "Xoá dự án?" với câu `"{name}" và toàn bộ bản vẽ, mô hình liên quan sẽ bị xoá vĩnh viễn.` + "Không hoàn tác được." | PD:287-296; PMG:25 | requestDelete UPD:544 | edge | covered | phase02_dashboard 509; phase02_dashboard_edge E02 L960 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-016 | d_cancel | "Để nguyên"/Esc/"Đóng hộp thoại": 0 DELETE | PD:296-298 | cancelDelete UPD:548 | edge | covered | phase02_dashboard_edge E02 L960 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-017 | d_confirm | "Xoá dự án" → DELETE 200, thẻ rời, KHÔNG toast, KHÔNG hoàn tác | UPD:480 "A9 asked already, so no undo toast" | confirmDelete UPD:481-502 | edge | covered | phase02_dashboard 509; E02 L960 | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-018 | d_reload | sau xoá, tải lại "/": thẻ vẫn không còn; GET /api/projects/:id → 404 |  | invalidation deleteProject UPD:501 | edge | missing | — | real | AP (2 dự án riêng) |
| 11P-A-019 | d_undo_create | toast tạo dự án có "Hoàn tác": bấm (dự án riêng vừa tạo) → DELETE /api/projects/<id mới>, thẻ biến mất; không đụng dự án chính (R6) | PDC:25 "Hoàn tác deletes it through the same gateway" | R6: chỉ bấm với dự án tự tạo | edge | missing | — | real | AN2 (admin tạo dự án qua modal; xoá trong finally) |
| 11P-A-020 | d_undo_exp | "Hoàn tác" tạo dự án hết hạn sau 8 s: bấm muộn không DELETE | UNDO_WINDOW_MS = 8000 (lib/mutations/undoTicket.ts:18) | dùng `page.clock` nếu toast tự đóng bằng setTimeout (xác nhận file:line khi viết) | edge | missing | — | real | AN2 |

### B States
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-B-010 | d_500 | DELETE 5xx: "Không xoá được dự án. Hãy thử lại." trong hộp; hộp mở; thẻ còn | UPD:235; InlineAlert PD:292 |  | edge | covered | phase02_dashboard_edge E02 L1275 [mocked] | mock | AP (admin + dự án riêng 2 tầng) |
| 11P-B-011 | d_403 | engineer xác nhận xoá: DELETE 403 thật → "Bạn không có quyền xoá dự án này." trong hộp, dự án còn | UPD:234 | BE PR:80 | edge | missing | — | real (BE 403, không mất dữ liệu) | EM |
| 11P-B-012 | d_404 | DELETE 404 (người khác đã xoá trong lúc hộp mở): coi như xong, thẻ rời, hộp đóng | UPD:490 "someone else already deleted it" |  | edge | missing | — | real (xoá qua API khi hộp đang mở) | AP (admin + dự án riêng 2 tầng) |

### C Validation/logic
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-C-008 | d_dbl | bấm đúp "Xoá dự án": 1 DELETE | UPD:161 isDeleting; deleteInFlight UPD:284 |  | edge | covered | phase02_dashboard_edge E02 L1307 (giữ phản hồi) | mock | AP (admin + dự án riêng 2 tầng) |
| 11P-C-009 | d_gate | ⚑ engineer: "Xoá" bật dù BE chỉ cho admin | PMG:25 `isDisabled: !canEdit`; đúng: khoá/ẩn như canDelete SCR-08 (UPS:757) | FE ≡ BE (PR:80) | edge | missing | — (cùng 9P-C-003, QA-09) | real | EM |
| 11P-C-010 | d_req | DELETE /api/projects/:id đúng 1 request cho 1 xác nhận (đọc header Idempotency-Key thật, ghi lại) |  | gateway.remove | edge | partial | phase02_dashboard_edge E02 L960 | real | AP (admin + dự án riêng 2 tầng) |

### D Roles
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-D-007 | d_viewer | viewer: "Xoá" disabled | PMG:25 |  | edge | n/a | 9P-D-002 (QA-09 C1) | n/a | n/a: sở hữu QA-09 |

### E A11y/keyboard
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-E-006 | d_kbd | hộp xoá: Enter trên "Để nguyên" đóng, Space trên "Xoá dự án" xoá |  |  | edge | covered | phase02_dashboard_edge E02 L2966 | real | AP (admin + dự án riêng 2 tầng) |

### F Responsive
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-F-005 | ui_d | hộp "Xoá dự án?" 4 khổ (tên dài trong câu hậu quả) | PD:287 |  | ui | missing | — | real | AP (admin + dự án riêng 2 tầng) |

### G API/BE
_(không có dòng riêng ở màn này — xem các nhóm khác)_

## SCR-32 VersionHistory — Phục hồi — files: VH, UVH, VHM, VHG, VHC

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-A-021 | v_btn | chọn phiên bản KHÔNG phải "Hiện tại": nút "Phục hồi phiên bản này" bật; phiên bản hiện tại: nút ẩn | VH:179-189 | canRestore && !isCurrent | edge | partial | phase06_rules_export_versions L603 (main chain) | real | VF (dự án riêng, tầng ≥2 phiên bản) |
| 11P-A-022 | v_dialog | bấm → hộp `Phục hồi phiên bản {label} của {floor}?` + caption + "Riêng lịch sử hoàn tác (Ctrl+Z) của mọi tầng sẽ được xoá." + nút "Phục hồi"/"Để nguyên" | VHM:539-543; RESTORE_CAPTION VHM:502; UNDO_HISTORY_CLEARED VHM:509 | buildRestoreConfirm VHM:517 | edge | partial | phase06 L603 (tiêu đề) | real | VF |
| 11P-A-023 | v_cancel | "Để nguyên"/Esc: 0 request phục hồi, lớp tầng không đổi | VHM:542 | cancelRestore | edge | missing | — | real | VF |
| 11P-A-024 | v_confirm | "Phục hồi" → POST restore (baseVersion = revision hiện tại); toast; bản phục hồi ở đầu danh sách, trạng thái cũ giữ thành phiên bản riêng | toast `Đã phục hồi phiên bản v{n} của {floor}; hoàn tác được trong 8 giây` · UVH:439-442 | runRestore UVH:424-444 | edge | partial | phase06 L603 (main chain, R3) | real | VF |
| 11P-A-025 | v_wipe | phục hồi XOÁ mọi sửa lớp sau phiên bản đích: GET lớp tầng = nội dung bản đích; sửa đặt sau đó mất | layer GET trùng bản đích | plan §3 "wipes every layer edit made after that version" | edge | missing | — | real | VF (ghi lớp bằng layerSeed.writeLayer sau v1) |
| 11P-A-026 | v_undo | "Hoàn tác" trong 8 s → toast "Đã hoàn tác lượt phục hồi"; lớp về trạng thái trước phục hồi | UVH:395 | runUndo / undoTicket | edge | missing | — | real | VF |
| 11P-A-027 | v_undo_exp | hết 8 s: "Hoàn tác" không còn dùng được (không ngủ 8 s) | UNDO_WINDOW_MS 8000 | `page.clock` (vé dùng Date.now) | edge | missing | — | real | VF |
| 11P-A-028 | v_same | phiên bản trùng hiện trạng: toast "Phiên bản này trùng với hiện trạng", không thêm phiên bản | UVH:433 | outcome.unchanged | edge | missing | — | real | VF |
| 11P-A-029 | v_discard | tầng có sửa chưa lưu: hộp "{Tầng} còn thay đổi chưa lưu được; tiếp tục sẽ bỏ chúng" + "Bỏ thay đổi và tiếp tục"/"Huỷ"; "Huỷ" giữ nguyên, không phục hồi | VHM:522-530 | flushFirst "discarded"/"cancelled" UVH:334-343 | edge | missing | — | real | VF (sửa lớp trong UI, chưa tự lưu) |

### B States
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-B-013 | v_conflict | 409 conflict → banner nạp lại (reload), lớp tầng không đổi | UVH:429-431 banner kind reload |  | edge | missing | — | mock (409) | VF |
| 11P-B-014 | v_5xx | 5xx → banner lỗi "Chưa phục hồi được" / "Máy chủ chưa nhận lượt phục hồi. Thử lại sau ít phút." | VHM:406, 412 | writeErrorNotice("restore") | edge | missing | — | mock | VF |

### C Validation/logic
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-C-011 | v_nodup | bấm đúp "Phục hồi": đúng 1 POST | 1 request | confirmRestore UVH:516-523 | edge | missing | — | real | VF |

### D Roles
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-D-008 | v_viewer | viewer: không có nút phục hồi/gắn nhãn; có câu lý do | "Vai trò của bạn trên dự án này chỉ đọc được lịch sử, nên nút phục hồi không hiện" · VHM:493-494 | canRestore=can(edit layer) viewer=false · VHC:143 | edge | missing | — | real | VP |

### E A11y/keyboard
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-E-007 | v_a11y | hộp phục hồi: focus vào, Tab giữ, Esc đóng, focus về nút | Modal.Root VH:195 |  | edge | missing | — | real | VF |

### F Responsive
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-F-006 | ui_v | hộp phục hồi và hộp "…còn thay đổi chưa lưu được…" 4 khổ | VH:195; VHM:525 |  | ui | missing | — | real | VF |

### G API/BE
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-G-005 | g_v | POST restore: path/method/baseVersion đúng; PUT lớp sau phục hồi không ghi đè (không late writes) | VHG:213 | phase06 L688 kiểm late writes | edge | partial | phase06 L603-688 (main chain) | real | VF |

## SCR-29 RuleSettings — Khôi phục mặc định — files: RS, URS

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-A-030 | r_footer | khi cấu hình khác mặc định: footer "Cấu hình đã khác mặc định." + nút "Khôi phục mặc định"; đã mặc định thì ẩn | RS:257, 324-328 | showRestoreDefaults = hasContent && !isDefault && canEditRules | edge | partial | phase06 L316, 347 (main chain) | real | RP (dự án riêng đã sửa luật) |
| 11P-A-031 | r_noconfirm | bấm "Khôi phục mặc định": KHÔNG hộp thoại xác nhận; áp ngay + toast | toast "Đã trả bộ luật về mặc định." · URS:1079-1081 | onRestoreDefaults → applyConfig (A8: hoàn tác thay xác nhận) | edge | partial | phase06 L347 | real | RP |
| 11P-A-032 | r_put | PUT /api/projects/:id/rule-config sau reset; GET lại = mặc định; footer biến mất | PUT cùng đường với GET (ruleSettingsGateway) | autosave.notifyChange URS:690 | edge | missing | — | real | RP |
| 11P-A-033 | r_undo | toast "Hoàn tác" trong 8 s khôi phục đúng cấu hình trước | URS:699-705 | result.undo() | edge | missing | — | real | RP |
| 11P-A-034 | r_undo_exp | hết 8 s: vé hết hạn, bấm muộn không PUT | UNDO_WINDOW_MS | `page.clock`; vé có `now` tiêm (URS:693) | edge | missing | — | real | RP |
| 11P-A-035 | r_preset | áp bộ luật sẵn rồi reset: mỗi lần một toast/vé riêng; vé cũ không ghi đè vé mới | một vé cho mỗi thay đổi · URS:688-693 | BUG-463 generation | edge | partial | phase06 L347 (preset → reset) | real | RP |

### B States
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-B-015 | r_5xx | PUT sau reset trả 5xx/409: tự lưu báo lỗi, UI không giả "đã lưu" | RuleSettingsReloadDialog | autosave error state | edge | missing | — | mock | RP |

### C Validation/logic
_(không có dòng riêng ở màn này — xem các nhóm khác)_

### D Roles
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-D-009 | r_roles | engineer/viewer: không có nút "Khôi phục mặc định" và 0 PUT | RS:257 `capabilities.canEditRules` | permission ruleset.edit: chỉ admin | edge | missing | — | real | VP (viewer; engineer đối chứng ở QA-09) |

### E A11y/keyboard
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-E-008 | r_kbd | nút bấm được bằng Enter/Space; toast có nút "Hoàn tác" tới được bằng Tab | RS:327 |  | edge | missing | — | real | RP |

### F Responsive
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-F-007 | ui_r | footer sticky "Khôi phục mặc định" + toast 4 khổ | RS:324 `sticky bottom-0` |  | ui | missing | — | real | RP |

### G API/BE
_(không có dòng riêng ở màn này — xem các nhóm khác)_

## SCR-39/38 Hậu quả: URL thực thể đã xoá (NotFound/AccessDenied/thông báo) — files: NF, ACC, PSC

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-A-036 | n_settings | /projects/<id đã xoá>/settings → xem 11P-B missing_proj |  |  | edge | n/a | 11P-B-* (missing_proj) | n/a | n/a: gộp, tránh gán hai lần |
| 11P-A-037 | n_3d | /projects/<id đã xoá>/3d (admin còn phiên) → không crash; "Không tìm thấy trang này" hoặc lỗi dự án + lối ra; không lộ tên dự án | TITLE_BY_REASON.missing · NF:98; "Trang bạn tìm đã bị xoá hoặc đã chuyển đi nơi khác." · NF:103 | 404 dự án (K08) | edge | missing | teardown SCR-01 (chỉ sau đăng xuất → /login?next) | real | AP (xoá qua API) |
| 11P-A-038 | n_floor | URL tầng đã xoá (route tầng của SCR-09/10) → không-tìm-thấy, không crash | như trên |  | edge | missing | — | real | AP (xoá 1 tầng qua API) |
| 11P-A-039 | n_versions | /projects/<id đã xoá>/versions và /rules/settings → trạng thái không-tìm-thấy, không form trống đọc như "ổn" |  |  | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-040 | n_recent | NotFound: mục "Dự án gần đây" KHÔNG còn chứa dự án vừa xoá | heading "Dự án gần đây" · NF:88; ≤3 mục | nguồn = GET /api/projects | edge | missing | — | real | AP (+1 dự án còn) |
| 11P-A-041 | n_back | NotFound "Quay lại" / "Về danh sách dự án" đưa về "/" và thẻ đã xoá không còn | NF:89, 91 |  | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |
| 11P-A-042 | n_notif | thông báo cũ trỏ tới dự án đã xoá: bấm → đích không-tìm-thấy, không crash | route mục thông báo → route dự án | K08 | edge | missing | — | real (cần thông báo seed; nếu helper không có: n/a + lý do khi viết) | AP + 1 thông báo |
| 11P-A-043 | n_bus | sau xoá dự án từ SCR-08: bus nhận {title:"Đã xoá dự án.", type:"project.deleted"}, toast ở lại sau điều hướng | appNotificationBus.publish · PSC:141 | toast sống qua navigate | edge | covered | teardown SCR-08 (toast) | real | AP (admin + dự án riêng 2 tầng) |

### B States
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-B-016 | n_denied | URL dự án đã xoá KHÔNG sang /khong-co-quyen (BE trả 404, không 403) | ACC:53-62 | K08 | edge | missing | — | real | AP (admin + dự án riêng 2 tầng) |

### C Validation/logic
_(không có dòng riêng ở màn này — xem các nhóm khác)_

### D Roles
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-D-010 | n_member_after | người bị gỡ mở URL dự án → cùng NotFound (xem 11P-A mem_after) |  |  | edge | n/a | 11P-A-* (mem_after) | n/a | n/a: gộp |

### E A11y/keyboard
_(không có dòng riêng ở màn này — xem các nhóm khác)_

### F Responsive
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-F-008 | ui_n | NotFound "Không tìm thấy trang này" 4 khổ sau khi xoá | NF:98 |  | ui | missing | — | real | AP (admin + dự án riêng 2 tầng) |

### G API/BE
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11P-G-006 | g_n | GET /api/projects/<đã xoá> 404 NOT_FOUND; cùng mã với "không phải thành viên" (không lộ tồn tại) |  | K08 | edge | partial | xem B11 (C4) | real | AP (admin + dự án riêng 2 tầng) |

### Notes

- ⚑ **d_gate** (PMG:25): menu thẻ "Xoá" dùng `canEdit` (`project.settings.edit`), nhưng BE chỉ cho admin xoá (PR:80) và SCR-08 dùng `canDelete` (UPS:757). Engineer thấy "Xoá" bật, xác nhận → 403 "Bạn không có quyền xoá dự án này." (UPD:234). Đúng: khoá/ẩn như SCR-08. (Trùng 9P-C-003 của QA-09; phase 11 là lần đầu xác nhận 403 thật không mất dữ liệu.)
- ⚑ **dbl** (UPS:1276-1281): `confirmDanger` đọc `canConfirmDanger` từ closure render, `setDangerRunning(true)` bất đồng bộ — hai click trong cùng tick có thể gửi hai DELETE. Kiểm đúng 1 request; nếu 2 → bug (dashboard đã có `deleteInFlight` ref UPD:284, SCR-08 thì không).
- ⚑ **v_wipe/v_dialog**: caption nói phục hồi "không xoá phiên bản nào" (VHM:502) nhưng kế hoạch §3 ghi phục hồi xoá mọi sửa lớp sau phiên bản và Ctrl+Z bị xoá (VHM:509); hoàn tác chỉ 8 s (UVH:395). Kiểm nội dung lớp thật sau phục hồi VÀ sau hoàn tác.
- ⚑ **r_noconfirm** (RS:324-328, URS:1079): "Khôi phục mặc định" không xác nhận; hoàn tác duy nhất là toast 8 s — bỏ lỡ thì mất cấu hình tuỳ biến. Theo thiết kế A8 (kế hoạch ghi "no confirm"); chỉ khẳng định không có dialog + vé hoạt động.
- ⚑ **mem_self** (UPM:252-255): tự gỡ mình về "/" im lặng (không toast, R6 cấm làm trên dự án chính); chỉ chạy trên dự án riêng (đã ở p03 08-A-019).
- `existing` của p03/phase02/phase06 đọc theo tiêu đề test/step; "covered" cần xác nhận lại khi chạy (chưa mở thân từng test).
- Dòng `n/a`: anon (sở hữu C3), d_viewer (9P-D-002), n_settings và n_member_after (gộp, tránh gán hai lần). Không có dòng `unsafe`: mọi thao tác phá huỷ chạy trên dự án riêng.
- `n_notif` cần ≥1 thông báo seed trỏ tới dự án; nếu helper không có thì ghi n/a + lý do khi viết (không bỏ im lặng).
- Quy mô: ~8-15 dòng/thao tác phá huỷ đạt cho xoá dự án (14), xoá mọi tầng (14), gỡ thành viên (12); phục hồi 17, khôi phục luật 11, thẻ dashboard 14. Dòng `covered` nhiều ở SCR-08/SCR-05 vì p03/phase02 đã phủ trên dự án riêng.



# QA-11 S1 — catalog C3 (prefix `11U`): người dùng + phiên

Generated 2026-10-14, READ ONLY from source. FE `F:/worktrees/AppFront/p11-int` master **5fcaf502** (every FE `file:line` relative to `src/`), BE `F:/App/AppBack` main **dc510655**.
Khuôn hàng: `QA-03d/flow-catalog.md`; mẫu `QA-09/catalog-C1.md`. Khổ: 1920/1440/1024/768 (không 375, không `/m/`). Phase 11 chạy trên stack THẬT (f14), `--workers 4`.
⚑ = viết theo hành vi ĐÚNG, đỏ tới khi sửa. Cột `existing`: `T` = `qa/tests/phase11_teardown.spec.ts` (main chain, GIỮ NGUYÊN; chỉ có SCR-37 `test.skip(true,'opt-in…')` không thân, SCR-38 ×2, SCR-01 ×1).
Nhóm trong id: A flows · B states · C logic · D roles · E a11y · F responsive · G api. Số: 1xx = SCR-37, 2xx = SCR-33 (tài khoản), 3xx = SCR-38, 4xx = SCR-01 (cổng phiên).

Viết tắt FE: UM=`screens/admin/UserManagement/UserManagement.tsx`, UMH=`…/useUserManagement.ts`, UMD=`…/UserManagementDetail.tsx`, UMT=`…/UserManagementTable.tsx`, UMG=`…/userManagementGateway.ts`,
AS=`screens/account/AccountSettings/AccountSettings.tsx`, DZ=`…/DangerZone.tsx`, SS=`…/SessionsSection.tsx`, UAA=`…/useAccountAuth.ts`, AAG=`…/accountAuthGateway.ts`, PW=`…/PasswordSection.tsx`,
AD=`screens/system/AccessDenied/useAccessDenied.ts`, SB=`routes/SessionBootstrap.tsx`, SES=`lib/auth/session.ts`, EV=`lib/auth/events.ts`, VI=`i18n/vi.json` (khối `auth`), AUS=`screens/auth/AuthScreen/useAuthScreen.ts`.
BE: UR=`apps/api/users/router.py`, US=`apps/api/users/service.py`, AR=`apps/api/auth/router.py`, MR=`apps/api/me/router.py`.

Seeds (`data needs`) — mọi hàng phá huỷ chỉ chạm dữ liệu RIÊNG:
**FU** = user tươi do luồng mời (admin `POST /api/users/invitations` → thư Mailpit → `POST /api/auth/invitations/accept`; helper MỚI `inviteFreshUser(admin, role, slug)`, email `testEmail('p11-session-<slug>')`), xoá/dọn bằng `DELETE /api/users/:id` trong `finally`;
**FA** = FU vai admin (đối chứng "còn ≥ 2 admin", không đụng admin chung); **PU** = `poolUser(admin,'engineer'|'viewer','p11-session-<vai>')` + `signInPoolUser` (phiên MỚI, chỉ đăng xuất phiên đó); **AD** = `admin.storage.json` CHỈ ĐỌC/ghi qua UI quản trị, KHÔNG đăng xuất;
**AN** = chưa đăng nhập. Không bao giờ vô hiệu/xoá/đổi mật khẩu pool user hay admin chung.

Nguồn chính: UM hàng thao tác `UMT:139-163` (nhãn `Vô hiệu hoá`/`Bật lại`/`Xoá`, `UMT:45-47`); khoá bị chặn `UMH:303-337` (`selfDisableBlocked` `UMH:138`, `lastAdminBlocked` `UMH:139`, `removeBlockedReason` chỉ khi quản trị cuối `UMH:337`);
hộp xoá `UMD:250-287` (tiêu đề `Xoá hẳn {user.name}?`, nút `Xác nhận xoá vĩnh viễn` tắt tới `removeConfirm.canConfirm` `UMH:940-960`); xoá `UMH:1153-1183`; vô hiệu/bật lại `UMH:841-875`.
BE: `POST /users/{id}/disable|enable` `UR:95-108` + `US:297-322` (thu hồi phiên, `bump_token_version`, `revoke_tokens`); `DELETE /users/{id}` `UR:111-121` + `US:441-460` (xoá mềm, `confirm_email`, `forbid_self`, thu hồi phiên).
`/tai-khoan`: khối `Phiên đăng nhập` + `Vùng nguy hiểm` chỉ vào DOM khi `capabilities.sessions/deleteAccount` (`AS:161-175`) — thật: cả hai `false` (`AAG:142`, "BE chưa có phiên và xoá tài khoản").

## SCR-37 UserManagement — files: UM, UMH, UMD, UMT, UMG (+ BE UR, US)

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-A-101 | open | admin mở `/admin/users`: hàng của FU có nút 'Vô hiệu hoá' và 'Xoá' | nút 'Vô hiệu hoá' · UMT:45,157; nút 'Xoá' · UMT:47,161 | FU không phải mình, không phải quản trị cuối (`UMH:303-337`) | edge | missing | T SCR-37 (skip, không thân) | real | AD, FU |
| 11U-A-102 | disable | bấm 'Vô hiệu hoá' → `POST /api/users/{id}/disable`; hàng đổi trạng thái 'Đã vô hiệu hoá', nút thành 'Bật lại' | 'Đã vô hiệu hoá' · UMG:138; nút 'Bật lại' · UMT:46,147 | `applyOptimistic status:'disabled'` UMH:677-683 rồi `gateway.disableUser` | edge | missing | T SCR-37 (skip) | real | AD, FU |
| 11U-A-103 | disable | toast sau vô hiệu hoá: tiêu đề 'Đã vô hiệu hoá tài khoản', mô tả = tên FU, có nút 'Hoàn tác' | 'Đã vô hiệu hoá tài khoản' · UMH:157,849-853; có `undoTicket` UMH:856 | `variables.isUndo=false` → `gateway.notify` kèm vé | edge | missing | — | real | AD, FU |
| 11U-A-104 | undo | 'Hoàn tác' trong hạn → `POST …/enable` (không toast thứ hai), hàng về 'Đang hoạt động'/nút 'Vô hiệu hoá' | không toast mới · UMH:845-847 (`isUndo` return) | undo gọi `runSetEnabled enabled:!…, isUndo:true` UMH:858-865 | edge | missing | — | real | AD, FU |
| 11U-A-105 | enable | hàng đã vô hiệu: bấm 'Bật lại' → `POST …/enable`; toast 'Đã bật lại tài khoản' | 'Đã bật lại tài khoản' · UMH:158,849 | FU đã có mật khẩu → status `active` (US:316) | edge | missing | T SCR-37 (skip) | real | AD, FU |
| 11U-A-106 | login | user bị vô hiệu đăng nhập lại (form `/login`) bị từ chối, hiện tiêu đề | 'Tài khoản đã bị vô hiệu' / 'Tài khoản này không còn được phép đăng nhập. Liên hệ quản trị dự án để mở lại.' · VI auth.errors.accountDisabled; AUS:266 | `AR:178-179` `account.status != "active"` → `ACCOUNT_DISABLED` | edge | missing | — | real | FU (đã disable), AN |
| 11U-A-107 | session | FU đang có phiên mở; admin vô hiệu → `GET /api/me` của FU 401 và lần điều hướng/gọi kế tiếp của tab FU chuyển `/login` kèm 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.' | VI auth.notices.sessionEnded; SB:293-306 | `US:305-308` revoke_sessions + bump_token_version + revoke_tokens | edge | missing | — | real | AD, FU (ngữ cảnh trình duyệt riêng) |
| 11U-A-108 | login | bật lại → FU đăng nhập lại được (200, vào `/`) | h1 'Dự án của tôi' · auth.ts DASHBOARD_TITLE | `US:316` status về `active` | edge | missing | — | real | AD, FU |
| 11U-A-109 | remove | bấm 'Xoá' trên hàng → hộp 'Xoá hẳn {name}?' mở cho đúng FU (không phải người đang chọn khác) | tiêu đề 'Xoá hẳn {user.name}?' · UMD:254 | `removeConfirm.user` đọc `removeUserId` không `detail.user` (UMD:26-32, B-V12b-01) | edge | missing | T SCR-37 (skip) | real | AD, FU, thêm FU2 để chọn nhầm |
| 11U-A-110 | remove | nút 'Xoá' trong panel chi tiết (mục 'Xoá người dùng') mở cùng hộp | 'Xoá hẳn người dùng này khỏi hệ thống.' · UMD:234; nút 'Xoá' · UMD:236 | `onOpenRemove` UMD:225-239 | edge | missing | — | real | AD, FU |
| 11U-A-111 | remove | gõ đúng email → 'Xác nhận xoá vĩnh viễn' → `DELETE /api/users/{id}`; hộp đóng; hàng biến khỏi bảng | nút 'Xác nhận xoá vĩnh viễn' · UMD:282 | `UMH:1153-1170` rồi `setRemoveUserId(null)` | edge | missing | T SCR-37 (skip) | real | AD, FU |
| 11U-A-112 | remove | toast sau xoá: 'Đã xoá tài khoản', mô tả = email, KHÔNG có 'Hoàn tác' | 'Đã xoá tài khoản' · UMH:162,1167-1172 | không `undoTicket` (UMH:1168-1169) | edge | missing | — | real | AD, FU |
| 11U-A-113 | login | user đã xoá đăng nhập lại bị từ chối như sai thông tin (không lộ "đã xoá") | 'Sai thư điện tử hoặc mật khẩu' · VI auth.errors.invalidCredentials | `AR:142-153` bỏ `deleted_at` → không thấy tài khoản → `INVALID_CREDENTIALS` AR:176-177 | edge | missing | — | real | FU (đã xoá), AN |
| 11U-A-114 | session | phiên đang mở của FU đã xoá chết: `GET /api/me` 401, tab chuyển `/login` | 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.' · VI auth.notices.sessionEnded | `US:452-455` revoke_sessions reason deleted + bump + revoke_tokens | edge | missing | — | real | AD, FU (ngữ cảnh riêng) |
| 11U-A-115 | after | xoá xong: `GET /api/users/{id}/memberships` 404 và danh sách `GET /api/users` không còn email; panel chi tiết đóng | 404 `NOT_FOUND resource=user` · US:92-95,249-252; `setSelectedUserId(null)` UMH:1165 | xoá mềm `deleted_at` | edge | missing | — | real | AD, FU |
| 11U-A-116 | repeat | xoá lần 2 cùng id (qua API admin) → 404, không lỗi 5xx | 404 `NOT_FOUND` · US:92-95 | `open_scope` không thấy user đã xoá mềm | api | missing | — | real | FU (đã xoá) |
| 11U-A-117 | free | email được giải phóng: mời lại đúng email đã xoá → 201 (không `USER_EMAIL_TAKEN`) | 201 · UR:55; US:441 docstring "email được giải phóng" | `deleted_at` bỏ khỏi khoá email | api | missing | — | real | FU (đã xoá) → mời lại, dọn bằng xoá lần nữa |

### B States
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-B-121 | error | `DELETE /api/users/{id}` trả 5xx → toast lỗi, hộp còn/ hàng còn nguyên | 'Không xoá được tài khoản' · UMH:163,1175-1177 | `notifyFailure` trong nhánh reject; không `setRemoveUserId(null)` | edge | missing | — | mock (`page.route` DELETE 500; cặp: 11U-A-111) | AD, FU |
| 11U-B-122 | error | `POST …/disable` trả 5xx → hàng hoàn về 'Đang hoạt động' (rollback lạc quan), toast lỗi | 'Không đổi được trạng thái tài khoản' · UMH:159,873 | `applyOptimistic` + rollback + `notifyFailure` | edge | missing | — | mock (cặp: 11U-A-102) | AD, FU |
| 11U-B-123 | after | xoá FU đang được chọn (panel chi tiết mở) → panel đóng, không để panel của người đã xoá | `setSelectedUserId((c)=>c===userId?null:c)` · UMH:1165 | panel đóng sau xoá | edge | missing | — | real | AD, FU |
| 11U-B-124 | disabled-row | hàng đã vô hiệu không còn nút 'Vô hiệu hoá' (chỉ 'Bật lại') và 'Xoá' vẫn còn | `row.status==='disabled'` → chỉ 'Bật lại' · UMT:145-148; 'Xoá' · UMT:151-155 | khoá bật lại không bị chặn (UMH:300-302) | edge | missing | — | real | AD, FU |

### C Validation/logic
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-C-131 | dialog | nội dung hộp: cảnh báo + gợi ý gõ lại + ô 'Địa chỉ thư' | 'Xoá hẳn gỡ luôn phần ghi công của người này trong lịch sử và không hoàn tác được; gõ đúng địa chỉ thư của họ để xác nhận' · UMH:150-151; 'Gõ lại {email} để xác nhận.' · UMD:259-262; nhãn 'Địa chỉ thư' · UMD:264 | `<code>` chứa đúng `user.email` | edge | missing | — | real | AD, FU |
| 11U-C-132 | gate | ô trống → 'Xác nhận xoá vĩnh viễn' bị khoá | `disabled={!removeConfirm.canConfirm}` · UMD:278 | `isMatch=false` khi trống (UMH:940-955) | edge | missing | T SCR-37 (skip) | real | AD, FU |
| 11U-C-133 | gate | gõ sai email (đúng tên, sai miền) → vẫn khoá; bấm cưỡng bức không gửi `DELETE` | nút khoá · UMD:278 | `typed.trim().toLowerCase() === user.email.trim().toLowerCase()` UMH:941-942 | edge | missing | — | real | AD, FU |
| 11U-C-134 | gate | gõ email khác HOA/THƯỜNG và có khoảng trắng hai đầu → mở khoá | nút 'Xác nhận xoá vĩnh viễn' bật | so khớp không phân biệt hoa thường, trim (UMH:941-942) | edge | missing | — | real | AD, FU |
| 11U-C-135 | cancel | 'Để sau' đóng hộp, KHÔNG có request ghi, hàng còn | nút 'Để sau' · UMD:273-275 | `onCloseRemove` xoá `removeEmail` (UMH:1143-1146); không mutation | edge | missing | — | real | AD, FU |
| 11U-C-136 | cancel | Esc đóng hộp, không `DELETE`, ô email được xoá khi mở lại | `Modal.Root onClose={actions.onCloseRemove}` · UMD:251 | sau mở lại ô trống (`onOpenRemove` đặt `''` UMH:1139-1142) | edge | missing | — | real | AD, FU |
| 11U-C-137 | double | bấm đúp 'Xác nhận xoá vĩnh viễn' gửi đúng MỘT `DELETE` | một request · `canConfirm` có `!removeMutation.isPending` UMH:951-953 | khoá trong lúc đang gửi | edge | missing | — | real | AD, FU |
| 11U-C-138 | self | quản trị đăng nhập xem hàng CỦA MÌNH: không nút 'Vô hiệu hoá', thay bằng câu | 'Bạn không thể tự vô hiệu hoá tài khoản của mình' · UMH:138,307 | `isSelf` (id hoặc email) UMH:268-270 | edge | missing | — | real | FA (đăng nhập là FA; còn ≥ 2 admin vì có admin chung) |
| 11U-C-139 | self | ⚑ hàng của chính mình vẫn có nút 'Xoá' (chỉ quản trị cuối bị chặn); gõ email mình + xác nhận → BE từ chối, tài khoản CÒN, toast lỗi. Đúng ra: FE chặn như vô hiệu hoá (câu lý do) | 'Không xoá được tài khoản' · UMH:163; nên có câu chặn tự xoá | FE `UMH:337` chỉ `lastAdmin`; BE `US:148-156` `forbid_self` → `USER_SELF_MODIFICATION` | edge | missing | — | real (an toàn: FA tự đăng nhập, BE từ chối; nếu BE cho xoá thì chỉ mất FA) | FA |
| 11U-C-140 | last-admin | quản trị cuối: 'Vô hiệu hoá' và 'Xoá' bị thay bằng 'Đây là quản trị cuối cùng, hệ thống cần ít nhất một người giữ vai này' | `lastAdminBlocked` · UMH:139,309,337 | `activeAdminCount<=1` | edge | missing | — | unsafe (cần chỉ còn 1 admin; stack có admin chung + FA, không được xoá/hạ admin chung — chỉ unit `useUserManagement.test.ts`) | — |
| 11U-C-141 | order | vô hiệu hoá trên hàng bị chặn gọi qua phím/hàm → không gửi request, hiện thông báo lý do | `description: row.disableBlockedReason` · UMH:1048-1053 | `onSetEnabled` chặn trước mutation | edge | n/a | — | n/a | n/a-by-design: nút bị chặn không có trên DOM (UMT:149-150) — chỉ unit `useUserManagement.test.ts` |

### D Roles
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-D-151 | role | engineer mở `/admin/users`: trạng thái forbidden, không bảng, không 'Vô hiệu hoá'/'Xoá' | 'Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì' · UMH:140-141 | `canManage=false` → 'forbidden' (UMH:~1010 state ladder) | edge | missing | — | real | PU(engineer) |
| 11U-D-152 | role | viewer: cùng trạng thái forbidden | cùng câu · UMH:140 | `user.manage` false cho viewer (PM) | edge | missing | — | real | PU(viewer) |
| 11U-D-153 | api | engineer gọi `POST /api/users/{id}/disable` và `DELETE /api/users/{id}` (thân đúng) lên FU → 403, FU còn nguyên (memberships 200) | 403 `FORBIDDEN` · UR:45 `require_permission("user.manage")` | quyền chặn trước service | api | missing | — | real | PU(engineer), FU |
| 11U-D-154 | api | ẩn danh `DELETE /api/users/{id}` và `POST …/disable` → 401 | 401 `UNAUTHENTICATED` | `require_permission` cần phiên | api | missing | — | real | AN, FU |

### E A11y/keyboard
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-E-161 | focus | mở hộp xoá: tiêu điểm vào trong hộp (ô 'Địa chỉ thư' hoặc đầu hộp), Tab xoay vòng trong hộp | focus trong `[role=dialog]` · UMD:251 `Modal.Root` | bẫy tiêu điểm của Modal | edge | missing | — | real | AD, FU |
| 11U-E-162 | keyboard | Enter trong ô email khi chưa khớp KHÔNG gửi `DELETE`; khi nút khoá, Space/Enter trên nút không làm gì | không request · `disabled` UMD:278 | `onConfirmRemove` thoát sớm nếu `!canConfirm` UMH:1154-1156 | edge | missing | — | real | AD, FU |
| 11U-E-163 | focus | đóng hộp bằng Esc/'Để sau': tiêu điểm về nút 'Xoá' đã mở nó | focus trả về nút kích hoạt | Modal trả tiêu điểm | edge | missing | — | real | AD, FU |
| 11U-E-164 | aria | hộp có `role=dialog` tên 'Xoá hẳn {name}?' ⚑ hành động không đảo được nên nên là `alertdialog` | tên truy cập 'Xoá hẳn {name}?' · UMD:254 | `Modal.Root` đặt role=dialog (A9 yêu cầu hỏi trước) | edge | missing | — | real | AD, FU |
| 11U-E-165 | live | toast sau vô hiệu/xoá nằm trong vùng `role=status` | 'Đã vô hiệu hoá tài khoản' / 'Đã xoá tài khoản' trong `role=status` | Toast.Provider | edge | missing | — | real | AD, FU |
| 11U-E-166 | label | ô có nhãn 'Địa chỉ thư' (`getByLabel`) và nút khoá có thuộc tính `disabled` | `label="Địa chỉ thư"` · UMD:264 | Input có nhãn | edge | missing | — | real | AD, FU |

### F Responsive (chụp 4 khổ, `_ui`)
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-F-171 | ui | hộp 'Xoá hẳn {name}?' trạng thái ô trống (nút khoá) | width 480 · UMD:251 | không tràn, nút trong khung | ui | missing | — | real | AD, FU |
| 11U-F-172 | ui | hộp với email khớp (nút bật) | cùng hộp | nút danger bật | ui | missing | — | real | AD, FU |
| 11U-F-173 | ui | bảng: hàng thường ('Vô hiệu hoá','Xoá') và hàng đã vô hiệu ('Bật lại','Xoá') ở 768 không cắt nút | UMT:139-163 | `flex-wrap` hàng thao tác | ui | missing | — | real | AD, FU |
| 11U-F-174 | ui | panel chi tiết có mục 'Xoá người dùng' | aria-label 'Xoá người dùng' · UMD:231 | bố cục panel cạnh bảng ở 1024/768 | ui | missing | — | real | AD, FU |
| 11U-F-175 | ui | câu chặn 'Bạn không thể tự vô hiệu hoá tài khoản của mình' xuống dòng, không cắt | UMH:138 | `BLOCKED_REASON_CLASS` cho phép xuống dòng (UMT:~50) | ui | missing | — | real | FA |

### G API/BE
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-G-181 | req | vô hiệu: `POST /api/users/{id}/disable` thân `{}`, 200 `AdminUser.status='disabled'` | UR:95-101 | `EmptyBody` | api | missing | — | real | AD(api), FU |
| 11U-G-182 | req | vô hiệu lần 2 → 200, không ghi hoạt động mới (idempotent) | US:299 docstring "Đã disabled → 200, không ghi gì" | `if status != "disabled"` | api | missing | — | real | FU |
| 11U-G-183 | req | bật lại: `POST …/enable` → 200 `status='active'` | UR:103-108; US:316 | có `password_hash` → active | api | missing | — | real | FU |
| 11U-G-184 | req | xoá: `DELETE /api/users/{id}` thân `{confirmEmail}`, 200 trả `AdminUser` dựng trước khi xoá | UR:111-121; US:442 | W13 thân xác nhận | api | missing | — | real | FU |
| 11U-G-185 | header | mọi `POST`/`DELETE` ghi từ UI mang `Idempotency-Key` (một giá trị duy nhất mỗi lượt) | header có `Idempotency-Key` | hợp đồng W (BE-00 §W) cho ghi | edge | missing | — | real | AD, FU |

## SCR-33 AccountSettings (`/tai-khoan`) — files: AS, DZ, SS, UAA, AAG, PW (+ BE MR)

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-A-201 | absent | `/tai-khoan` KHÔNG có khối 'Phiên đăng nhập' trong DOM (không phải tắt) | không có 'Phiên đăng nhập' · AS:161-165 | `vm.auth.sessions===null` (AAG:142) | edge | missing | — | real | FU |
| 11U-A-202 | absent | KHÔNG có khối 'Vùng nguy hiểm' / nút 'Xoá tài khoản' | không có 'Vùng nguy hiểm' · AS:172-176 | `vm.auth.danger===null` | edge | missing | — | real | FU |
| 11U-A-203 | n/a | 'Đăng xuất' từng phiên (`Đăng xuất khỏi {device}`) + dòng 'Thiết bị này' + 'Chưa có phiên nào đang mở.' | SS:111-129 | khối không vào DOM | edge | n/a | — | n/a | n/a-by-design: BE v1 chưa có danh sách/thu hồi phiên (AAG:141; MR chỉ có /me, PATCH /me, avatar) — chỉ unit `SessionsSection.test.tsx` |
| 11U-A-204 | n/a | vé 'Hoàn tác' 8 s thu hồi phiên ('Đã đăng xuất khỏi {device}'), gửi nốt khi rời màn | UAA:92,531-563 | cần `revokeSession` | edge | n/a | — | n/a | n/a-by-design: cùng 11U-A-203 |
| 11U-A-205 | n/a | 'Xoá tài khoản' → hộp 'Xoá tài khoản này?' → gõ 'Địa chỉ thư' → 'Xoá vĩnh viễn' (Để sau) | DZ:63,75,90,112 | cần `deleteAccount` | edge | n/a | — | n/a | n/a-by-design: BE chưa có xoá tài khoản tự phục vụ (không có `DELETE /me`) — chỉ unit `DangerZone.test.tsx` |
| 11U-A-206 | n/a | lỗi xoá: 'Địa chỉ vừa gõ không khớp với tài khoản này.' / 'Không xoá được tài khoản lúc này. Thử lại sau ít phút.'; `onDeleted` không có người gọi | UAA:95-96,610-632 | — | edge | n/a | — | n/a | n/a-by-design: ⚑ xem Notes — `onDeleted` không được nối ở đâu nên dù bật năng lực, xoá xong cũng không đăng xuất |
| 11U-A-207 | pwd | đổi mật khẩu ở FU: thông báo + phiên khác của FU bị đăng xuất (`GET /api/me` 401 ở ngữ cảnh thứ hai) | 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.' · UAA:86 | `US:211-217` `revoke_sessions(except_sid=session_id)` | edge | missing | — | real | FU (hai ngữ cảnh) |
| 11U-A-208 | pwd | ngữ cảnh THỨ HAI bị thu hồi chuyển `/login` ('Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.'); ngữ cảnh đổi mật khẩu còn phiên | VI auth.notices.sessionEnded; `except_sid` | phiên hiện tại giữ | edge | missing | — | real | FU |

### G API/BE
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-G-211 | contract | `DELETE /api/me` và `GET /api/me/sessions` chưa tồn tại → 404/405 (khẳng định v1 để FE giữ năng lực tắt) | 404 hoặc 405 · MR (chỉ GET/PATCH /me, PUT /me/avatar `MR:109,137,264`) | không có route | api | missing | — | real | FU |

## SCR-38 AccessDenied (`/khong-co-quyen`) — files: AD, `screens/system/AccessDenied/*`, SES, EV (+ BE AR)

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-A-301 | render | trang hiện tiêu đề, dòng định danh, câu lý do, người cấp quyền, mã lỗi | 'Bạn chưa có quyền truy cập' · AD:98; 'Bạn đang đăng nhập bằng' + email · AD:105; 'Nội dung ở đường dẫn này đang giới hạn người xem, nên nó chưa mở ra cho tài khoản của bạn.' · AD:101; 'Mã lỗi: 403 · /khong-co-quyen' · AD:126 | email = pool user | edge | partial | T SCR-38 (mở trang nhưng không khẳng định nội dung) | real | PU |
| 11U-A-302 | nav | 'Về danh sách dự án' → `/` (h1 'Dự án của tôi'), phiên còn | nút 'Về danh sách dự án' · AD:109 | điều hướng thuần | edge | covered | T 'SCR-38 "Về danh sách dự án" → /' | real | PU (bản riêng trên phiên mới) |
| 11U-A-303 | logout | 'Đăng nhập bằng tài khoản khác' → `POST /api/auth/logout` (<300) → `/login` | nút 'Đăng nhập bằng tài khoản khác' · AD:108; AD:443-448 | `signOut()` rồi `navigate(login,{state:{from}})` | edge | covered | T 'SCR-38 "Đăng nhập bằng tài khoản khác"…' (dùng phiên admin chung — KHÔNG lặp) | real | PU |
| 11U-A-304 | after | sau đăng xuất `/` chuyển `/login` (không còn phiên) | URL `/login` · SB:293-306 | trạng thái `anonymous` | edge | covered | T cùng test | real | PU |
| 11U-A-305 | from | `state.from='/khong-co-quyen'` đi cùng điều hướng; đăng nhập lại (PU) rồi trở về đường dẫn `from` hợp lệ | `navigate(ROUTES.login,{state:{from}})` · AD:447 | `AuthScreen` lọc bằng `safeDestination` (AD:441) | edge | missing | — | real | PU |
| 11U-A-306 | error | `POST /api/auth/logout` lỗi mạng/5xx → VẪN sang `/login`, phiên cục bộ đã xoá (mở `/` → `/login`) | AD:436-446 "điều hướng nằm trong `finally`"; SES:196-211 try/catch | `signOut()` xoá phiên cục bộ trước khi gọi máy chủ | edge | missing | — | mock (`page.route` logout abort; cặp: 11U-A-303) | PU |
| 11U-A-307 | double | bấm đúp 'Đăng nhập bằng tài khoản khác' gửi đúng MỘT `POST /api/auth/logout` | một request | `signOut` idempotent / điều hướng | edge | missing | — | real | PU |
| 11U-A-308 | revoke | refresh token CŨ sau logout: `POST /api/auth/refresh` (cookie cũ) → 401 | 401 `SESSION_REVOKED` · auth/sessions.py:449-453 (S4 chốt) | `revoke_by_cookie` AR:293 | api | missing | — | real | PU (giữ cookie trước khi logout) |
| 11U-A-309 | revoke | logout chỉ thu hồi phiên của cookie đó: ngữ cảnh thứ hai CÙNG user vẫn `GET /api/me` 200 | 200 · AR:285-294 | `revoke_by_cookie(refresh_cookie_of(request))` | api | missing | — | real | PU (2 ngữ cảnh) |
| 11U-A-310 | repeat | logout lặp với cookie đã thu hồi → 204 | 204 · AR:285 docstring "lặp lại vẫn 204" | idempotent | api | missing | — | real | PU |
| 11U-A-311 | back | sau đăng xuất bấm Back từ `/login` về `/khong-co-quyen`: không hiện nội dung bảo vệ, quay lại `/login?next=%2Fkhong-co-quyen` | URL `/login?next=…` · SB:293-306,406 | cổng phiên `anonymous` | edge | missing | — | real | PU |

### D Roles
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-D-312 | role | engineer (vai không quản trị) cũng thấy và dùng được hai nút (không phụ thuộc vai) | hai nút · AD:108-109 | không gate theo vai | edge | missing | — | real | PU(viewer) |

### E A11y/keyboard
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-E-321 | keyboard | Tab tới 'Đăng nhập bằng tài khoản khác' rồi Enter kích hoạt đăng xuất (một request); thứ tự Tab có tên đúng | tên nút chính xác · AD:108 | nút thật `<button>` | edge | missing | — | real | PU |
| 11U-E-322 | name | hai nút có tên truy cập đúng, không nút thừa | 'Về danh sách dự án', 'Đăng nhập bằng tài khoản khác' | getByRole exact | edge | missing | — | real | PU |

### F Responsive
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-F-331 | ui | `/khong-co-quyen` (mặc định, có email) 4 khổ | AD:98-126 | không tràn, hai nút trong khung | ui | missing | — | real | PU |

### G API/BE
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-G-341 | resp | `POST /api/auth/logout` 204 và `Set-Cookie` xoá cả hai cookie | 204 · AR:285-294 `clear_auth_cookies` | cookie hết hạn | api | missing | — | real | PU |
| 11U-G-342 | origin | ⚑ `POST /api/auth/logout` với Origin lạ: trả lỗi và XOÁ cookie nhưng KHÔNG thu hồi phiên → phiên còn sống ở server dù cookie đã xoá | AR:288-293 `require_origin` lỗi → `clear_auth_cookies(denied)` không `revoke_by_cookie` | đúng ra: hoặc 403 không đụng cookie, hoặc thu hồi thật | api | missing | — | real | PU |

## SCR-01 cổng phiên (SessionBootstrap, login) — files: SB, SES, EV, AUS (+ `screens/system/CollaborationLayer/CollaborationLayer.container.tsx`)

### A User flows
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-A-401 | gate | ẩn danh mở `/projects/<id>/3d` → `/login?next=%2Fprojects%2F<id>%2F3d`, thông báo | 'Hãy đăng nhập để tiếp tục.' · VI auth.notices.signInRequired; SB:406 | `state.notice:'signInRequired'` SB:301-303 | edge | partial | T 'SCR-01 /projects/<deleted-id>/3d after logout' (chỉ URL, phụ thuộc admin chung bị đăng xuất, không khẳng định thông báo) | real | AN, id dự án BẤT KỲ (`unknownProjectId()`) |
| 11U-A-402 | gate | phiên kết thúc khi đang mở ứng dụng (sau logout cục bộ) → `/login` với thông báo | 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.' · VI auth.notices.sessionEnded; SB:360-376,299-300 | `authenticated→anonymous` ⇒ `sessionEnded` | edge | missing | — | real | PU |
| 11U-A-403 | gate | ẩn danh mở `/` → `/login` KHÔNG có `next`, không thông báo | URL `/login` · SB:301-303 (BUG-007) | `pathname===ROUTES.dashboard` ⇒ không state | edge | partial | T (đoạn cuối SCR-38 test) | real | AN |
| 11U-A-404 | next | đăng nhập lại từ `/login?next=…` quay về đúng đích | URL = đích · AuthScreen `safeDestination` | `next` hợp lệ | edge | missing | — | real | PU |
| 11U-A-405 | tab | hai tab cùng ngữ cảnh: đăng xuất ở tab A → tab B (đang ở trang bảo vệ) tự về `/login` không cần thao tác | `onSignedOut({source:'broadcast'})` · SES:243-253; EV:108-112 | BroadcastChannel `signed-out` | edge | missing | — | real | PU (2 page cùng context) |
| 11U-A-406 | tab | tab B hiện thông báo kết thúc phiên sau broadcast | 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.' | SB:372-375 | edge | missing | — | real | PU |
| 11U-A-407 | deleted | URL dự án/tầng đã xoá khi đã đăng nhập → NotFound/AccessDenied (không trắng) | owner C2 (`11P`) | — | edge | n/a | — | n/a | n/a: thuộc phần C2 (dự án đã xoá → SCR-39/AccessDenied) |

### F Responsive
| id | cat | case | expected (exact copy · file:line) | oracle | layer | status | existing | stack | data needs |
|---|---|---|---|---|---|---|---|---|---|
| 11U-F-411 | ui | `/login` với thông báo 'Hãy đăng nhập để tiếp tục.' 4 khổ | VI auth.notices.signInRequired | InlineAlert attention | ui | missing | — | real | AN |
| 11U-F-412 | ui | `/login` với 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.' 4 khổ | VI auth.notices.sessionEnded | idem | ui | missing | — | real | PU |
| 11U-F-413 | ui | `/login` với 'Tài khoản đã bị vô hiệu' 4 khổ | VI auth.errors.accountDisabled | AUS:298-303 | ui | missing | — | real | FU (đã disable) |

### Notes
- ⚑ **11U-C-139** `UMH:337`: `removeBlockedReason` chỉ tính `lastAdmin`; khác `disableBlockedReason` (`UMH:303-310`) không có nhánh `isSelf`. Hàng của chính mình vẫn có nút 'Xoá'; BE `US:148-156` `forbid_self` (USER_SELF_MODIFICATION / USER_LAST_ADMIN) từ chối → người dùng gõ cả email rồi mới thấy 'Không xoá được tài khoản'. Đúng theo nguồn: chặn trước bằng câu lý do như `selfDisableBlocked`.
- ⚑ **11U-E-164** `UMD:251` hộp xoá hẳn là `Modal.Root` (`role=dialog`), không `alertdialog`, dù là hành động không hoàn tác (brief nêu `role=alertdialog`). Nếu `Modal` không có prop `role`, đây là nợ dùng chung — hàng viết theo hành vi đúng.
- ⚑ **11U-G-342** `AR:288-293`: Origin lạ → phản hồi lỗi kèm `clear_auth_cookies` nhưng KHÔNG `revoke_by_cookie`. Cookie bị xoá phía trình duyệt, refresh token vẫn sống ở server (phiên "mồ côi" không thu hồi được tới hết hạn).
- ⚑ **11U-A-206** `AAG:142`/`UAA:218`: `onDeleted` không có chỗ nối (grep `onDeleted` chỉ ở `useAccountAuth.ts`); khi BE có xoá tài khoản và bật `deleteAccount`, `confirmDelete` đóng hộp rồi không đăng xuất/đi `/login` → người dùng ở lại màn với phiên đã chết. Hiện bị che vì năng lực `false`.
- Tìm `Phase 11|phase 11|P11` trong `qa/coverage/*.md`: chỉ `phase01.md:171` (SCR-38 → covered phase 11). Không có dòng n/a-by-design trỏ P11 cho SCR-33/SCR-37 → các dòng 11U-A-203…206 là n/a vì tắt năng lực, không phải vì kế hoạch.
- Không có điều khiển 'Đăng xuất' nào khác trong `src/` ngoài SessionsSection (ẩn) và AccessDenied: đường đăng xuất duy nhất ở web là 11U-A-303. `bootstrap.ts`/`useCollaborationLayer` không phát đăng xuất riêng (CollaborationLayer chỉ nghe sự kiện auth qua SES:243-253).
- C4 (`B11`) giữ các cặp BE thuần: `DELETE` sai `confirmEmail` (`USER_CONFIRM_EMAIL_MISMATCH` US:111-114), `forbid_self`, `USER_LAST_ADMIN` ở API. C3 chỉ giữ hàng có đường UI/phiên.
- SCR-37 hiện có `phase11_teardown` thân rỗng (`test.skip(true,'opt-in: no invitee')`): mọi hành vi vẫn cần luồng MỚI trên FU riêng (helper `inviteFreshUser` chưa có; `inviteAndAccept` ở `phase03Seed.ts:314` không export và đặt tên pool).
- Chưa kiểm được: số dòng `UMH` trạng thái 'forbidden' (UMH ~1010) và `BLOCKED_REASON_CLASS` (UMT ~50) ghi xấp xỉ `~`; mọi cặp dòng khác đã đọc.

## Summary
| màn | rows | n/a | needed | covered | partial | missing | mock | unsafe |
|---|---|---|---|---|---|---|---|---|
| SCR-37 | 52 | 1 | 51 | 0 | 0 | 51 | 2 | 1 |
| SCR-33 | 9 | 4 | 5 | 0 | 0 | 5 | 0 | 0 |
| SCR-38 | 17 | 0 | 17 | 3 | 1 | 13 | 1 | 0 |
| SCR-01 | 10 | 1 | 9 | 0 | 2 | 7 | 0 | 0 |
| **Tổng** | 88 | 6 | 82 | 3 | 3 | 76 | 3 | 1 |

(`needed` gồm hàng unsafe — không có bước luồng; `mock` tính trong needed; `missing` gồm unsafe.)


