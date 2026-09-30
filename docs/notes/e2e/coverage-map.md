# Bản đồ độ phủ — mỗi bề mặt × mỗi bất biến

Tệp này trả lời đúng một câu trong mười giây: **còn hở chỗ nào.**

Đo **2026-09-30**. Kế hoạch đầy đủ: `plan.md`. Câu phải hỏi: `questions.md`.

---

## Cách đọc

Bốn giá trị, và chỉ bốn:

| Giá trị | Nghĩa |
|---|---|
| `e2e` | kế hoạch này có một ca e2e chứng minh được nó |
| `đơn vị` | tầng đơn vị **đã** chứng minh; e2e **không** lặp lại |
| `chưa phủ` | không ai chứng minh. Đây là cột phải đọc trước |
| `n/a` | không áp dụng cho bề mặt này, **kèm lý do** |

`n/a` không phải chỗ để trốn. Mỗi ô `n/a` có một lý do ở bảng chú thích dưới bảng chính.

Bảy bất biến: **A6** nhãn tiếng Việt viết thường kiểu câu · **A7** không nút lưu, tự lưu
800 ms có nói ra · **A8** hoàn tác được kèm toast · **A9** không hoàn tác được thì hỏi
trước · **A11** bảy trạng thái, không màn trắng · **A12** bàn phím hạng nhất, Esc đóng
đúng một lớp · **A15** dấu thập phân là dấu phẩy.

---

## 0. Ba dòng đọc trước bảng

**A7 đã chứng minh bằng máy cho cả 35 màn có route: 0 nút mang chữ "lưu".** Nên cột A7 của
35 màn ấy đọc `e2e` nhờ **một** ca quét-toàn-bộ, không phải 35 ca. Nửa sau của A7 — "tự lưu
800 ms và **nói ra** cho trình đọc màn hình" — thì khác, và nó hở rộng: **không cờ
`persist*` nào bật ở cả tầng QC** (`roomLabelReviewGateway.ts:445`,
`floorManagerGateway.ts:1257`, `thicknessStandardizationGateway.ts:221`,
`persistWallLayer: false`), nên bảy màn QC **không** có chỗ nào nói "đã lưu".

**A11 đã đo: 35/35 màn không trắng, không nổ.** Nên cột A11 không phải danh sách lỗ — nó
là danh sách trạng thái nào trong bảy trạng thái e2e **với tới được**. `loading`, `partial`
và `collapsed` phần lớn nằm ở tầng đơn vị, và bảng nói thẳng điều đó thay vì để trống.

**A12 là cột hở nhất, và hở đúng ở 14 màn không route.** `SCOPE_PRIORITY`
(`lib/input/shortcutRegistry.ts:59`) đặt `dialog`/`sidePanel`/`canvas` trước `global`, nên
thứ tự đóng là **theo phạm vi trước, theo thời điểm đăng ký sau (LIFO)** — **không** theo
lớp nào nhìn thấy nằm trên. Đã đo bằng 8 kịch bản trên vỏ 3D. Không một bài kiểm nào trong
repo hiện khẳng định thứ tự ấy.

---

## 0b. Đếm máy — 63 bề mặt × 7 bất biến = 441 ô

Đếm bằng script trên chính các bảng dưới đây, không đếm tay:

| Giá trị | Số ô | Ghi chú |
|---|---|---|
| `e2e` | **120** | kế hoạch có ca. **Không** nghĩa "đã xanh" — chưa dòng test nào được viết |
| `đơn vị` | **84** | tầng đơn vị đã chứng minh; e2e cố ý không lặp |
| `không áp dụng` | **119** | mỗi ô kèm lý do ở bảng của nhóm |
| **`chưa phủ`** | **34** | **đây là cột phải đọc trước** |
| ô có giá trị kèm điều kiện | 84 | ví dụ "e2e (chỉ `loading`)", "`đơn vị`, e2e nếu Q1=A" — script không xếp được vào một ô, đọc thẳng bảng của nhóm |

Con số 441 lớn hơn 49 × 7 = 343 vì một bề mặt có thể có nhiều hàng (ví dụ Pascal vỏ tách
thành cờ-tắt và cờ-bật), và hai bề mặt bị **BỎ** (`ConnectionStates`, `StateGallery`) vẫn
giữ hàng để không ai mất dấu chúng.

### 34 ô `chưa phủ`, nhóm theo bất biến

| Bất biến | Số ô | Ở đâu |
|---|---|---|
| **A7** — tự lưu có nói ra | **8** | `projectScale` · `projectObjects` · `projectDimensions` · `projectRooms` · `projectFloors` · `projectThickness` · `WallGeometryEditor` — **cả tầng QC**, cộng một panel |
| **A15** — dấu thập phân | **9** | `mobileViewer` · `projectSettings` · `ProcessingScreen` · `PipelineFailure` · `PropertyInspector` · `HistoryPanel` · `WallGeometryEditor` · `projectVersions` · `ConnectionStates` |
| **A12** — bàn phím, Esc | **6** | `projectGrids` · `projectFloors` · `projectRules` · `projectRuleSettings` · `projectVersions` · `ConnectionStates` |
| **A8** — hoàn tác kèm toast | **6** | `NotificationCenter` · `dashboard` · `PipelineFailure` · `projectPipelineGraph` · `projectOverlay` · `projectRuleSettings` |
| **A6** — nhãn tiếng Việt | **3** | `login` · `onboarding` · `dashboard` |
| **A9** — hỏi trước bằng hộp thoại | **3** | `NotificationCenter` · `ShareDialog` · `projectOverlay` |

**Ba chỗ hở đáng đọc trước tất cả:**

1. **A7 hở 8 ô, và 6 trong 8 là cả tầng QC.** Lý do đã đo: trên đường e2e đi qua (bộ mẫu +
   `VITE_USE_MOCK_API`), không cờ `persist*` nào bật, nên không màn QC nào **nói** "đã lưu".
   Hai màn có dựng `createAutosave` (`useRoomLabelReview.ts:602`,
   `useThicknessStandardization.ts:534`) nhưng không đi qua `useSaveIndicator`. Xem
   `questions.md` **Q2**.
2. **A6 hở đúng ở `dashboard`, và đó là route `/`.** Nó là màn **duy nhất trong 49** không
   gọi `expectVietnamese`, và `ProjectDashboard.tsx:343-345` đọc **khoá trạng thái thô tiếng
   Anh** cho trình đọc màn hình. Một lỗ sản phẩm nằm đúng trong một lỗ độ phủ. Xem **Q10h**.
3. **A15 hở 9 ô, nhưng không phải vì khó.** Phần lớn là màn chưa có dữ liệu nên **chưa có
   số nào để đọc**. Nó sẽ tự đóng lại khi `questions.md` **Q1** được chốt.

---

## 0c. Quyết định đã chốt, và chúng đổi bảng thế nào

`questions.md` đã chốt cả 24 câu. Ba chốt đổi cách đọc bảng dưới đây — áp chúng **khi đọc**,
tôi không sửa tay 63 hàng của worker để khỏi làm hỏng chú thích của từng nhóm.

### Q1 = A′ ⇒ mọi ô ghi `e2e *` đọc là **`e2e`**

Hai nhóm (V7, V12) đánh dấu `e2e *` hoặc `†`/`[bơm]` cho ô **phụ thuộc cửa bơm kho**, kèm
câu "nếu Q1 = B thì ô rơi về `chưa phủ`". Q1 chốt **A′** — dùng cửa, qua fixture
`seedSpatial`, kèm một **ca mồi không bơm** cho mỗi màn QC.

⇒ Mọi ô ấy là **`e2e`**. Và mỗi màn QC có thêm **một** hàng không nằm trong bảng: ca mồi,
thứ đỏ lên đúng ngày sản phẩm có đường nạp thật (xem `plan.md` mục 6.1).

### QA/B-2 ⇒ ba ô sửa giá trị

Cả hai vai đối nghịch đều sai ở vòng 1 về ba ô này; vòng 2 mới có người mở tệp test ra.

| Ô | Bảng dưới ghi | **Đúng là** | Bằng chứng |
|---|---|---|---|
| `RoomAreaPanel · A7` | `không áp dụng` | **`đơn vị`** | `RoomAreaPanel.test.tsx:223` — *"cửa sổ đủ rộng để lượt tự lưu 800 ms của A7 … chạy xong"*; `:262` chạy một lượt đổi tên bị từ chối |
| `RoomAreaPanel · A8` | `không áp dụng` ("panel chỉ đọc") | **`chưa phủ`** | panel **ghi** thật — `RoomAreaPanel.rows.tsx:152-156`, `useRoomAreaPanel.ts:353,433,462` |
| `HistoryPanel · A7` | `không áp dụng` ("panel chỉ đọc") | **`chưa phủ`** | nhảy lịch sử là undo/redo trên kho — `useHistoryPanel.ts:13,262-276` |

Hai ô `chưa phủ` ấy **không** sinh ca riêng: chúng lấp bằng **một khẳng định** thêm vào
`V7-ROOMS-03` (cùng việc ấy làm được từ panel). Rẻ hơn một ca mới.

### QA/B-3 ⇒ bảy ô `forbidden` thành một lưới

Bảy ca "vai `viewer` từng màn" gộp thành **một** lưới sinh từ dữ liệu: một bảng
`[màn, chuỗi mong đợi]`, bảy lời gọi `test()`. Giá trị ô không đổi; chỉ số **đơn vị bảo
trì** đổi (xem `plan.md` mục 0.1).

### Số ô `chưa phủ` sau khi chốt: **36**

34 đếm được bằng máy, cộng **2** ô của QA/B-2 vừa sửa từ `không áp dụng` sang `chưa phủ`.

Con số này vẫn là **sàn**, không phải số chính xác: 84 ô mang giá trị kèm điều kiện mà
script không xếp được vào một ô (ví dụ "e2e (chỉ `loading`)"). Muốn con số thật thì đọc
bảng của từng nhóm — đó là lý do chúng được giữ nguyên chữ của worker.

---

## 1. Bảng chính



### Nhóm V1

Giá trị: `e2e` · `đơn vị` · `chưa phủ` · `không áp dụng`. Ô `không áp dụng` có lý do trong ngoặc.

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| login | `chưa phủ` (chờ Q1: nhãn hoa đầu câu ≠ "viết thường") | không áp dụng (không sửa dữ liệu) | không áp dụng (đăng nhập không phải thay đổi dữ liệu) | không áp dụng (không hành động mất mát) | `e2e` (empty/partial/success); `error`/`forbidden`/`loading` = đơn vị | `e2e` (Tab thật; Esc vô hại) | không áp dụng (không số) |
| onboarding | `chưa phủ` (chờ Q1) | không áp dụng (cờ localStorage không phải tự lưu) | không áp dụng ("Bỏ qua" chỉ ghi cờ cục bộ) | không áp dụng (không hành động mất mát) | `e2e` (success; viewer/error chưa đo → đơn vị) | `e2e` (Tab; Esc vô hại) | không áp dụng (không số thập phân) |
| accessDenied | `e2e` (một ca quét toàn cục — nhãn đã đo viết thường) | không áp dụng (màn thông tin) | không áp dụng (không thay đổi dữ liệu) | không áp dụng (không hành động mất mát) | `e2e` (success); 3 mã 403 & các nhánh = đơn vị | `e2e` (Tab, hai lối ra); Esc **chưa đo** | không áp dụng (không số) |
| notFound | `e2e` (ca quét toàn cục) | không áp dụng (điều hướng thuần) | không áp dụng (điều hướng thuần) | không áp dụng (không hành động mất mát) | `e2e` (success); chưa-đăng-nhập/`empty`/`error` = đơn vị | `e2e` (Tab; `quay lại` theo lịch sử); Esc **chưa đo** | không áp dụng (ngày giờ, không thập phân) |
| mobileViewer | `e2e` (ca quét toàn cục) | không áp dụng (xem, không sửa) | không áp dụng (không thay đổi dữ liệu) | không áp dụng (không hành động mất mát) | `e2e` (chỉ `empty`); `success` **không kiểm được** → đơn vị (86 bài) | `e2e` (Esc "không có gì để đóng"); đóng tấm thông tin = đơn vị | `chưa phủ` (số đo chỉ ở `success`, không kiểm được) |

Số ô `chưa phủ`: **3** (login·A6, onboarding·A6, mobileViewer·A15).

---


### Nhóm V2

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| CollaborationLayer | đơn vị | không áp dụng ¹ | không áp dụng ¹ | không áp dụng ² | đơn vị | e2e | không áp dụng ³ |
| EditorTour | đơn vị | không áp dụng ⁴ | không áp dụng ⁵ | không áp dụng ⁵ | đơn vị | e2e | không áp dụng ⁶ |
| NotificationCenter | đơn vị ⁷ | không áp dụng ⁸ | chưa phủ | chưa phủ | đơn vị | e2e | không áp dụng ⁹ |
| StateGallery (BỎ) | đơn vị | không áp dụng ¹⁰ | không áp dụng ¹⁰ | không áp dụng ¹⁰ | đơn vị | đơn vị | không áp dụng ¹⁰ |
| ConnectionStates (BỎ) | đơn vị | không áp dụng ¹¹ | không áp dụng ¹¹ | không áp dụng ¹¹ | đơn vị | chưa phủ | chưa phủ |

¹ Cả bốn năng lực tắt, không thay đổi dữ liệu nào tới được (`collaborationGateway.ts:84-89`). ² Panel xung đột cần A9 nhưng **không có đường mở** trên màn. ³ Không số thập phân trên lớp này. ⁴ Chỉ một khoá UI `localStorage`, không phải dữ liệu dự án, không có bộ đếm 800 ms. ⁵ Không đổi dữ liệu; đường quay lại là chip `xem hướng dẫn`. ⁶ `bước N trên M` là số nguyên. ⁷ Nhãn mã viết hoa chữ đầu câu — phải đối chiếu `LUAT_MAN_HINH.md` trước khi khẳng định "đạt" (chưa đối chiếu). ⁸ Hành động tức thì, không ô nhập. ⁹ Số chưa đọc nguyên, ngày `dd/mm/yyyy`. ¹⁰ Công cụ dev, không dữ liệu người dùng. ¹¹ Lớp chỉ đọc (`queueStore.ts` docblock: "một lớp không bao giờ ghi").
`ConnectionStates` A12/A15 ghi `chưa phủ` thay vì `đơn vị` vì tôi **không đọc** `ConnectionStates.test.tsx` đủ để khẳng định `Escape`/định dạng số có trong 35 bài (chỉ thấy tên `describe`); và bề mặt này không dựng được nên `chưa phủ` ở tầng e2e là đúng.

**Số ô `chưa phủ`: 4** (NotificationCenter A8, A9; ConnectionStates A12, A15).

---


### Nhóm V3

Chú giải: `e2e` = mục có ca e2e (đề xuất), không phải "đã xanh"; `đơn vị` = phủ ở `*.test.ts[x]`, e2e không lặp; `chưa phủ` = chưa có bằng chứng nào; `không áp dụng` = bề mặt không có thứ bất biến ấy.

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| dashboard | chưa phủ | không áp dụng (không có dữ liệu tự lưu, danh sách cục bộ) | chưa phủ | e2e | e2e | e2e | e2e |
| CreateProjectModal | đơn vị | không áp dụng (nút "tạo dự án" tường minh, không tự lưu) | e2e | e2e | e2e | e2e | e2e |
| projectSettings | đơn vị | e2e | e2e | e2e | e2e | e2e | chưa phủ |
| ShareDialog | đơn vị | đơn vị | đơn vị | chưa phủ | đơn vị | đơn vị | không áp dụng (không có số thập phân hiển thị; kích thước nhúng là px nguyên) |

Ghi chú cho ô: (1) `dashboard · A6 = chưa phủ` vì `ProjectDashboard.test.tsx` không dùng `expectVietnamese` (đo lớp 2) và `role="status"` sr-only in tiếng Anh (F1); ca quét A6 xuyên màn bắt được nó nhưng không thuộc riêng mục này. (2) `dashboard · A8 = chưa phủ`: đổi tên/nhân bản có `onUndo` (`useProjectDashboard.ts:383,395`) nhưng chưa đo trên trình duyệt và không có bài đơn vị. (3) `dashboard · A11 = e2e` gồm `success`/`collapsed`/`partial`/`forbidden` (đo); `loading`/`error`/`empty` là đơn vị. `smoke.spec.ts` phủ chống-màn-trắng ở `/` — ô này không đòi thêm. (4) `CreateProjectModal · A8 = e2e` chỉ cho **toast + nút Hoàn tác có mặt**; **kết quả bấm "Hoàn tác" chưa đo** (đơn vị có bài "tạo xong có hoàn tác"). (5) `CreateProjectModal · A9 = e2e`: cảnh báo "đóng và bỏ các thay đổi chưa lưu?" (Esc form bẩn), không phải xác nhận xoá. (6) `projectSettings · A11 = e2e` cho `success`/`forbidden`/`partial`; `error`/`collapsed` **chưa đo**. (7) `ShareDialog · A12 = đơn vị`: e2e chỉ có sau cửa nạp-kho (Q1) và V3-SHARE-1 là điều kiện; nếu Q1 = A, ô đổi thành `e2e`. (8) A7 quét "không nút lưu" 35 màn là **một** ca dùng chung, không tính ở đây.

**Số ô `chưa phủ`: 4** (dashboard·A6, dashboard·A8, projectSettings·A15, ShareDialog·A9).

---


### Nhóm V4

Bốn giá trị: `e2e` = kế hoạch có ca; `đơn vị` = tầng đơn vị đã phủ, e2e không lặp; `chưa phủ` = không ai chứng minh; `không áp dụng`, kèm lý do. Dấu `†` = phần đã đo hoặc chưa đo nêu ở chú thích.

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| projectUpload | `e2e` (1) | `không áp dụng` (2) | `e2e` (3) | `không áp dụng` (4) | `e2e` (5) | `e2e` (6) | `e2e` (7) |
| projectQuality | `e2e` (1) | `không áp dụng` (2) | `e2e` (3) | `không áp dụng` (8) | `e2e` (9) | `e2e` | `e2e` (7) |
| ProcessingScreen | `e2e` (1) | `không áp dụng` (2) | `không áp dụng` (10) | `đơn vị` (11) | `e2e` (12) | `đơn vị` (13) | `chưa phủ` (14) |
| PipelineFailure | `đơn vị` (15) | `không áp dụng` (2) | `chưa phủ` (16) | `đơn vị` (17) | `đơn vị` | `đơn vị` (18) | `chưa phủ` (14) |

Chú thích:
1. Một ca quét chữ dùng chung; chữ hoa đầu câu phụ thuộc Q2 của nhóm QC-a (chưa chốt). `PipelineFailure`: đơn vị phủ tiếng Việt và giọng điệu; không có e2e vì không dựng được.
2. Màn không sửa dữ liệu dự án; 0/35 màn có nút "lưu" đã chứng minh bằng máy (HOP-DONG mục 2) — thay cho ca riêng.
3. Toast + "Hoàn tác" đã đo ở cả hai (`upload`: xoá bản vẽ; `quality`: nắn thẳng); **bấm "Hoàn tác" và `Ctrl+Z` chưa đo** ở cả hai — ca chỉ tới bước toast cho tới khi đo.
4. Xoá bản vẽ hoàn tác được (vé 8 s), không hộp thoại.
5. `success` + `forbidden` đã đo; `empty` không dựng được từ mock mặc định; `error` chưa đo.
6. Menu thẻ tự bắt Esc cục bộ (không qua registry); **menu có đóng khi Esc: chưa đo**; Tab chưa đo — nên ô mang `e2e` nhưng phần dựng được hẹp.
7. Một ca quét bắt dấu chấm ở vị trí **thập phân** (không bắt nhóm nghìn). `upload`: đã đo dấu phẩy "cao độ -3,00 m", "100,0 MB"; `quality`: probe `dotDecimals: []`.
8. "Tiếp tục xử lý" không phải hành động mất mát; cổng xác nhận là ô kiểm **inline** (đặc tả cấm hộp thoại). Xem P1 về việc nút đi tiếp dù chưa tích.
9. `partial` (mặc định, đo) + `forbidden` (đo); `success`/`empty` không dựng được từ mock mặc định; `error` chưa đo.
10. Màn theo dõi, không sửa dữ liệu.
11. Huỷ xử lý = xác nhận inline (đơn vị); e2e không dựng được ở `empty`.
12. `empty` và `forbidden` với tới được (đo); các trạng thái khác cần `floorUploads`.
13. Nhóm huỷ bắt Esc cục bộ; không dựng được ở `empty`; đơn vị phủ.
14. Định dạng số của nhánh có tiến độ/thất bại không dựng được ở e2e; chưa có bằng chứng đơn vị được nêu.
15. Xem chú thích 1.
16. [V4] không ghi hoàn tác cho "Thử lại bước này"/"Bỏ qua tầng đó" ở đơn vị.
17. Đơn vị phủ "hành động mất mát nói cái mất trước khi bấm" — dạng inline, không hộp thoại. Xem P3 về chữ A9.
18. Đơn vị: "Esc không có lớp nào để đóng"; nút gấp là nút thật.

Số ô `chưa phủ` của nhóm: **3** (ProcessingScreen A15 · PipelineFailure A8 · PipelineFailure A15).

---


### Nhóm V5

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| projectPipelineGraph | đơn vị | không áp dụng ¹ | chưa phủ | đơn vị | e2e | không áp dụng ² | không áp dụng ³ |
| projectScale | đơn vị | chưa phủ ⁴ | đơn vị ⁵ | không áp dụng ⁶ | e2e | e2e | e2e |
| projectCadConfirm | đơn vị | không áp dụng ⁷ | không áp dụng ⁸ | không áp dụng ⁹ | e2e | e2e | không áp dụng ³ |

¹ Không nhập dữ liệu nào. ² Đo 0 nút, không lớp nào mở/đóng, `Escape` không có binding (grep NOT FOUND); Tab **chưa đo**. ³ Không số thập phân ở trạng thái dựng được (`0/0 lớp` nguyên). ⁴ Cổng thật **không lưu** (`persistScale` false; thanh trạng thái nói "chưa lưu lên máy chủ") ⇒ tự lưu 800 ms không xảy ra; không ai chứng minh. ⁵ `useScaleCalibration.test.ts:411` phủ trên kho gắn sẵn; ở route thật `Áp dụng` **không làm gì** (PHÁT HIỆN 1) — e2e không chứng minh được hoàn tác. ⁶ Áp tỷ lệ thiết kế là hoàn tác được (A8), không cần hộp thoại. ⁷ Không nút lưu; `rememberChoice` không lưu. ⁸ Không đổi dữ liệu: chọn nhánh chỉ điều hướng (đo 0 yêu cầu ghi). ⁹ Đo: không phải hành động không hoàn tác được; không hộp thoại xác nhận thứ hai (mã cấm lồng).

**Số ô `chưa phủ`: 2** (projectPipelineGraph A8; projectScale A7).

---


### Nhóm V6

Bốn giá trị: `e2e` = kế hoạch này có ca; `đơn vị` = tầng đơn vị đã phủ, e2e không lặp; `chưa phủ` = không ai chứng minh; `không áp dụng`, kèm lý do. Mọi ô `e2e` của nhóm này **đi qua cửa nạp-kho (dev)** và không chứng minh tải từ máy chủ; ô `e2e` có dấu `†` là ca **dự kiến ĐỎ ngay** (phát hiện, không phải bài xanh); ô có `‡` nghĩa "ca mô tả hiện trạng có nợ, không phải bài đạt A7".

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| projectWalls | `e2e` † | `e2e` ‡ | `e2e` | `không áp dụng` (1) | `đơn vị` (2) | `e2e` | `e2e` (3) |
| projectObjects | `e2e` (4) | `chưa phủ` (5) | `đơn vị` | `không áp dụng` (1) | `đơn vị` (2) | `đơn vị` (6) | `e2e` (3) |
| projectDimensions | `e2e` (4) | `chưa phủ` (5) | `đơn vị` | `không áp dụng` (7) | `đơn vị` (2) | `e2e` (8) | `e2e` (3) |
| projectGrids | `e2e` (4) | `đơn vị` (9) | `đơn vị` | `không áp dụng` (1) | `đơn vị` (2) | `chưa phủ` (10) | `đơn vị` |

Chú thích:
1. Xoá hoàn tác được bằng toast (tường: đơn vị `useWallLayerReview.test.ts:506-526` [V6]; đối tượng `:854`; trục `removeToastDescription`, `useAxisGridManager.ts:763` [✓]); không có việc nào cần hộp thoại A9.
2. Đơn vị phủ đủ bảy trạng thái ở cả bốn (7/7). e2e chỉ thêm `success` sau nạp kho; `loading` là skeleton-mãi (khiếm khuyết), `error` không có đường mạng, `forbidden` viewer **chưa đo** trong trình duyệt.
3. Một ca quét chữ sau nạp kho bắt dấu chấm ở vị trí thập phân; **kết quả chưa đo** (probe `dotDecimals` chạy lúc chưa tiêm). Nếu nó bắt được vi phạm thì thành phát hiện, không phải sửa mã.
4. Một ca quét chữ dùng chung; nhãn hoa-đầu-câu phụ thuộc Q2.
5. `persist…: false` ở cổng (`objectLayerReviewGateway.ts:1762`, `dimensionOcrReviewGateway.ts:1042` [V6]) nhưng **hành vi thanh trạng thái sau thao tác ghi chưa đo** [V6 #3]. Không suy ra từ tường.
6. Phím `D/W/F/1/2/Esc` đã qua sổ phím thật trong jsdom (`useObjectLayerReview.test.ts:687-770` [V6]); ca O-1/O-2 chờ đo, nếu trùng tường thì không thêm.
7. Duyệt/sửa kích thước hoàn tác được (đơn vị `useDimensionOcrReview.test.ts:480` [V6]).
8. Phím `R` đã đo mở khối chế độ bàn phím ([V6]); `Esc` với hàng đang chọn **chưa đo**.
9. Đơn vị phủ `supported:false` (`useAxisGridManager.test.ts:485-530` [V6]) và màn nói "chưa lưu được". Tự lưu 800 ms thật: không thực hiện được (không endpoint).
10. Màn không đăng ký Esc; chỉ có `Mod+Z`; bàn phím đi hàng trục **chưa đo**.

Số ô `chưa phủ` của nhóm: **3** (objects A7 · dimensions A7 · grids A12).

---


### Nhóm V7

Giá trị: `e2e` · `đơn vị` · `chưa phủ` · `không áp dụng`. Mọi ô `e2e` của nội dung/sửa **đi qua cửa nạp-kho** (†, chờ `questions.md` Q1); ô không † (`rooms`/`thickness` `empty`, `floors` hai câu nợ) sống dù Q1 = B.

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| projectRooms | `e2e` (ca quét toàn cục; chờ Q2 của V6) | `chưa phủ` (màn không nói về lưu; không `persist`) | `e2e` † (đổi tên → toast → `Hoàn tác`) | `e2e` † (gộp/tách phòng hỏi trước — **chưa đo**, cần đo trước khi viết) | `e2e` (`empty` thật không cửa; `success` †); `error`/`forbidden` chưa đo, phần còn lại đơn vị | `e2e` † (`Ctrl+Z` ngoài ô nhập); Esc trong hộp thoại **chưa đo** | `e2e` † (`248,60 m²`, `18,40 m²`) |
| projectFloors | `e2e` (ca quét toàn cục; chờ Q2 của V6) | `chưa phủ` (ghim hiện trạng hai câu nợ, không phải bài đạt A7) | `đơn vị` (xoá + vé 8 s; e2e ghi thật chưa đo) | `không áp dụng` (xoá ngay không hộp thoại, hoàn tác được theo thiết kế A8) | `e2e` (hai câu nợ không cửa; `success` †); `loading` mãi — xem Q3 | `chưa phủ` (chỉ `Mod+Z`; Esc/Tab chưa đo) | `e2e` † (`3,9 m`, `14,1 m`) |
| projectThickness | `e2e` (ca quét toàn cục; chờ Q2 của V6) | `chưa phủ` (bốn `role="status"` là thẻ đếm, không phải tự lưu) | `đơn vị` (áp = một bước + `Hoàn tác`; e2e chưa đo được) | `đơn vị` (cảnh báo áp lại, `Huỷ` = Esc) | `e2e` (`empty` thật không cửa; `success` †); phần còn lại đơn vị | `e2e` † (Esc đóng xem trước, đã đo) | `e2e` † (`Độ tin cậy AI: 0,77`) |

Số ô `chưa phủ`: **4** (rooms·A7, floors·A7, floors·A12, thickness·A7).

---


### Nhóm V8

Chú giải: `e2e` = có ca e2e trong kế hoạch (đã có ở `viewer3d.spec.ts` hoặc đề xuất ở mục tương ứng), **không** phải "đã xanh"; `đơn vị` = đã phủ ở `*.test.ts[x]` và e2e không lặp; `chưa phủ` = không có bằng chứng nào; `không áp dụng` = bề mặt không có thứ bất biến ấy.

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| projectViewer | đơn vị | không áp dụng (màn xem, không ghi dữ liệu) | không áp dụng (không ghi; hoàn tác thuộc panel) | không áp dụng (không có việc không hoàn tác được) | e2e | e2e | e2e |
| ViewerShell | đơn vị | không áp dụng (vỏ không ghi) | không áp dụng (vỏ không ghi) | không áp dụng (vỏ không ghi) | e2e | e2e | e2e |
| PropertyInspector | đơn vị | đơn vị | đơn vị | không áp dụng (mọi ghi hoàn tác được, N1) | e2e | e2e | chưa phủ |
| RoomAreaPanel | đơn vị | không áp dụng (panel chỉ đọc) | không áp dụng (không ghi) | không áp dụng (không ghi) | e2e | e2e | đơn vị |
| HistoryPanel | đơn vị | không áp dụng (panel chỉ đọc) | đơn vị | không áp dụng (không có việc không hoàn tác được) | e2e | e2e | chưa phủ |
| FurnitureLibraryPanel | đơn vị | không áp dụng (ghi bị khoá ở giao diện, P3) | đơn vị | đơn vị | e2e | e2e | e2e |
| WallGeometryEditor | đơn vị | chưa phủ | đơn vị | không áp dụng (mọi sửa hoàn tác được, N1) | e2e | e2e | chưa phủ |

Ghi chú cho ô: (1) `RoomAreaPanel · A15 = đơn vị` vì N1 khẳng định tổng 14 dòng đúng A14; ca e2e (RA-2) chờ **Q2** — nếu Q2=(A) thì ô đổi thành `e2e`. (2) `PropertyInspector · A11 = e2e` chỉ cho `loading` (PI-1e), **không** cho `success` (chưa có đường). (3) `FurnitureLibraryPanel · A12 = e2e` chỉ cho `viewer3d.panels.close` (S3); nhánh `furnitureLibraryPanel.cancel` **chưa đo** (ô vẫn `e2e` vì bảng đã có ca; phần chưa đo ghi ở mục 6.8). (4) A6 `đơn vị` = `expectVietnamese` (chuỗi tiếng Anh sót/chữ mất dấu), **không** khẳng định "viết thường kiểu câu" — đó là ca quét e2e xuyên màn, không thuộc mục nào ở đây. (5) A7 quét "không nút lưu" 35 màn là **một** ca dùng chung, không tính vào bảng này.

**Số ô `chưa phủ`: 4** (PropertyInspector·A15, HistoryPanel·A15, WallGeometryEditor·A7, WallGeometryEditor·A15).

---


### Nhóm V9

Giá trị chỉ một trong `e2e` · `đơn vị` · `chưa phủ` · `không áp dụng`. Ô `không áp dụng` kèm lý do ở bảng chú thích ngay dưới.
Ô mang `*` là **có điều kiện** (xem chú thích) nhưng vẫn ghi giá trị mặc định đúng nhất hôm nay.

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| `projectExploded` | đơn vị | không áp dụng ¹ | không áp dụng ² | không áp dụng ² | e2e * | e2e * | e2e |
| `projectMeasure` | đơn vị | không áp dụng ³ | đơn vị | không áp dụng ⁴ | e2e | e2e | e2e |
| `projectOverlay` | đơn vị | không áp dụng ⁵ | chưa phủ | chưa phủ | e2e | e2e ⁶ | đơn vị |

¹ không có dữ liệu người dùng ghi; độ tách là trạng thái xem tạm (đọc lướt `useExplodedView.ts`, chưa dò từng dòng).
² không có thao tác ghi để hoàn tác/hỏi.
³ phép đo ghim bằng hành động rõ ràng, không tự lưu 800 ms.
⁴ xoá phép đo có hoàn tác (A8), nên không thuộc A9.
⁵ `xác nhận` là hành động rõ ràng (A5), không tự lưu.
⁶ ô này là **kế hoạch** (ca `Tab`→mũi tên O-3), nhưng dữ kiện "mũi tên đổi radio" **chưa đo** — nếu đo ra không chạy thì ô đổi thành `chưa phủ`.
\* `projectExploded` A11: `empty` + `forbidden` là e2e không cần bơm; `success` cần bơm `[bơm]` (Q1-A). A12: `E`/`Space` cần bơm.

`chưa phủ` = **2** ô (`projectOverlay` A8, A9).

---


### Nhóm V10

Bốn giá trị: `e2e` = kế hoạch có ca (gồm cả ca đã có sẵn trong spec); `đơn vị` = tầng đơn vị đã phủ, e2e không lặp; `chưa phủ`; `không áp dụng` kèm lý do.

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| projectViewerPascal — cờ tắt (V10-a) | `e2e` (1) | `không áp dụng` (2) | `không áp dụng` (3) | `không áp dụng` (3) | `e2e` (4) | `không áp dụng` (5) | `không áp dụng` (6) |
| projectViewerPascal — cờ bật (V10-b) | `e2e` (1) | `không áp dụng` (2) | `không áp dụng` (3) | `không áp dụng` (3) | `e2e` (7) | `e2e` (8) | `không áp dụng` (6) |

Chú thích:
1. Một ca quét chữ dùng chung của cả đợt; nhãn AppFront vẽ đo khớp nguyên văn ([V10] mục 2). Nhãn fork = nợ đã ghi (`docs/pascal/00-quyet-dinh.md:202`), ghi một lần, không có nhãn fork nào hiện ra ở route này. Câu chữ hoa "3D" thuộc câu A6 chung.
2. Màn chỉ đọc; 0 nút lưu.
3. Không sửa dữ liệu; thu/mở khung là trạng thái giao diện.
4. `forbidden` (đã có, bài 1). Các trạng thái khác thuộc V10-b.
5. Cờ tắt không dựng khung nào để đóng; phím `Escape` `scope:'canvas'`, `enabled: enabled && !isCollapsed` (`usePascalViewer.ts:301-310` [✓]); giá trị `enabled` khi cờ tắt **chưa đo**, nên tôi ghi lý do "không có lớp để đóng" (đúng theo DOM đo: 0 hộp) chứ không khẳng định phím vô hiệu.
6. Bốn số hiện ra đều là số đếm nguyên (`4 · 16 · 0 · 14`), không có số thập phân.
7. `success` + `collapsed` + `error` (`PASCAL-01`) e2e; `partial`/`empty`/`PASCAL-02`/`PASCAL-03`: tầng đơn vị (33 bài); `partial` và `empty` trên trình duyệt **chưa đo**.
8. `Esc` thu (đã có), `E` mở lại (đo), `?`→`Esc` đóng đúng một lớp (một nửa đã đo; **chưa đo** với cảnh đã dựng xong).

Số ô `chưa phủ` của nhóm: **0**. (Ghi rõ: đó là vì các phần không kiểm được đã được xếp vào `đơn vị` kèm chú thích, không phải vì không có khoảng trống — khoảng trống thật của bề mặt nằm ở trường 13: hình đúng sai, hiệu năng, CSP thật, vai `viewer`.)

---


### Nhóm V11

Một dòng cho cả nhóm (16 bề mặt editor, cùng số phận). Giá trị chỉ một trong `e2e` · `đơn vị` · `chưa phủ` · `không áp dụng`; ô `không áp dụng` kèm lý do.

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| Pascal editor (16 bề mặt, 6 nhóm; **không dựng**) | không áp dụng ¹ | không áp dụng ² | không áp dụng ² | không áp dụng ² | không áp dụng ² | không áp dụng ² | không áp dụng ² |

¹ nhãn toàn bộ của fork, tiếng Anh ⇒ nợ A6 **đã ghi** (`docs/pascal/00-quyet-dinh.md:202`); không dựng ⇒ không lên màn ⇒ không ca. Ghi một lần, không mười sáu.
² bề mặt không được dựng (`PascalFrame.tsx:9` chỉ nhập `viewer`; grep `pascal-app/editor` trong `src` = 0) nên không có gì để chứng minh.
Ca hàng rào **H-1** không phải ô của bất biến nào — nó bảo vệ *ranh giới* "bề mặt chưa hiện"; ghi ở chú thích `plan.md` chứ không thành ô. (Câu hỏi Q-V11-2 nói về việc có nên đổi cả hàng này thành `chưa phủ`.)
`chưa phủ` = **0** ô.

---


### Nhóm V12

Giá trị chỉ một trong `e2e` · `đơn vị` · `chưa phủ` · `không áp dụng`. Ô `không áp dụng` kèm lý do ở chú thích. Ô `e2e *` = **có điều kiện `[bơm]`** (chỉ nếu `questions.md` Q1 cho phép cửa bơm; nếu không thì ô rơi về `chưa phủ`).

| Bề mặt | A6 | A7 | A8 | A9 | A11 | A12 | A15 |
|---|---|---|---|---|---|---|---|
| `projectRules` | đơn vị | không áp dụng ¹ | không áp dụng ² | không áp dụng ² | e2e | chưa phủ | không áp dụng ³ |
| `projectRuleSettings` | đơn vị | e2e * | chưa phủ | không áp dụng ⁴ | e2e | chưa phủ | không áp dụng ⁵ |
| `ViolationDetail` | đơn vị | không áp dụng ¹ | không áp dụng ⁶ | không áp dụng ⁶ | e2e * | e2e * | e2e * |
| `projectExport` | đơn vị | không áp dụng ⁷ | không áp dụng ⁷ | không áp dụng ⁷ | e2e | e2e * | e2e * |
| `projectData` | đơn vị | không áp dụng ¹ | không áp dụng ¹ | không áp dụng ¹ | e2e | đơn vị | e2e * |
| `projectVersions` | đơn vị | không áp dụng ⁸ | đơn vị | đơn vị | e2e | chưa phủ | chưa phủ |
| `account` | đơn vị | e2e | đơn vị | e2e | đơn vị ⁹ | e2e | không áp dụng ¹⁰ |
| `billing` | đơn vị | không áp dụng ¹¹ | không áp dụng ¹² | e2e | e2e | e2e | e2e |
| `adminModels` | đơn vị | không áp dụng ¹ | không áp dụng ¹³ | không áp dụng ¹³ | e2e | e2e | e2e |
| `adminUsers` | đơn vị | không áp dụng ¹⁴ | e2e | e2e | e2e | e2e | không áp dụng ¹⁵ |

Chú thích ô `không áp dụng`:
¹ màn chỉ đọc — không có dữ liệu để lưu/hoàn tác/hỏi.
² `Xác nhận đã xử lý` chỉ điều hướng sang `/export` (`useRuleReport.ts:602`); không thao tác ghi.
³ toàn số nguyên (`tổng số kiểm tra`, `đạt`, `cảnh báo`, `vi phạm`); phần thập phân (`độ tin cậy 0,82`) thuộc `ViolationDetail`.
⁴ áp bộ luật sẵn có "đường hoàn tác" theo đơn vị (`RuleSettings.test.tsx:435`) ⇒ thuộc A8, không thuộc A9. Xem ô A8: **chưa phủ** vì route không nối toast (F3).
⁵ ô ngưỡng là số nhập, chưa đo hiển thị thập phân; không có số định dạng để khẳng định.
⁶ không có hành động sửa nào hiện ở nơi gọi thật (`canAutoFix:false`, `ruleReportGateway.ts:48-52`); đơn vị `:747` phủ chuỗi sửa → `Ctrl+Z` trên dữ liệu test.
⁷ xuất không đổi dữ liệu; `huỷ` giữa chừng không hộp thoại; tự lưu không có (`tệp đã xuất` chỉ trong phiên).
⁸ không có gì để lưu; màn chết.
⁹ `success` do AC-1 chạy trên đó; các trạng thái còn lại (`loading`/`error`/`partial`/`forbidden`/`collapsed`/`empty`) do 151 bài đơn vị; **không dựng được bằng `page.route`** (nguồn bộ nhớ). Cột này ghi `đơn vị` vì phần lớn 7 trạng thái ở đó, không phải vì `success` không có e2e.
¹⁰ không số thập phân trên màn (V12).
¹¹ không nút lưu; nâng gói là mutation có xác nhận.
¹² nâng gói **không hoàn tác được** ⇒ thuộc A9 (V12 đo: không toast sau nâng, đúng luật).
¹³ không hành động ghi nào hiện (kể cả với `admin`).
¹⁴ hành động ghi có xác nhận/hoàn tác, không tự lưu 800 ms.
¹⁵ chỉ ngày và số nguyên.

Ô `e2e *` cụ thể: `projectRuleSettings` A7 (RS-2) · `ViolationDetail` A11/A12/A15 (VD-1…VD-4) · `projectExport` A12 (EX-4/EX-5) và A15 (EX-3) · `projectData` A15 (DA-2). Nếu Q1 = B: các ô ấy thành `chưa phủ` (riêng `projectRuleSettings` A7 và `projectData` A15 có phần `đơn vị` — A7 đơn vị `:292` chỉ khẳng định "không nút lưu", **không** khẳng định 800 ms thật; A15 đơn vị `:213` khẳng định dấu phẩy trên fixture). Đếm: **5 ô `chưa phủ` chắc chắn** (`projectRules` A12 · `projectRuleSettings` A8, A12 · `projectVersions` A12, A15 — và không đếm ô `e2e *`).

Ô `e2e` không `*`: `projectRules` A11 · `projectRuleSettings` A11 · `projectExport` A11 · `projectData` A11 · `projectVersions` A11 · `account` A7, A9, A12 · `billing` A9, A11, A12, A15 · `adminModels` A11, A12, A15 · `adminUsers` A8, A9, A11, A12.

---
