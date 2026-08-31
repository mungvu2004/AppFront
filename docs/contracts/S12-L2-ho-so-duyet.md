# S12-L2 — Hồ sơ trình người duyệt: màn "Duyệt lớp tường" (S-12)

Gộp lại từ `docs/contracts/S12-L1-kich-thuoc.md` (đo kích thước gói, A3) và
`docs/contracts/S12-L1-no-ngoai-pham-vi.md` (ba món nợ ngoài phạm vi, A4). Viết cho người
duyệt không cần đọc mã vẫn quyết định được.

> **Đã cập nhật sau lượt gộp C1.** Mục 1–4 giữ nguyên như B2 viết: chúng mô tả hiện trạng
> **trước** khi gộp, và các con số ở mục 2 chép nguyên từ hai hồ sơ L1 tại `master` @
> `ae7db03`. **Mục 5, 6 và 7 là phần thêm của C1** và mô tả hiện trạng **sau** khi gộp ba
> nhánh B1 + B2 + B3. Người duyệt đọc mục 5–7 trước khi bấm gộp; bảng số hai cột đầy đủ
> nằm ở `docs/contracts/S12-C1-bao-cao-tich-hop.md`.

---

## 1. Tình hình một đoạn

Màn S-12 "Duyệt lớp tường" (`src/screens/qc/WallLayerReview/`) **đã dựng xong và đã gộp
vào `master`**. Lượt này không thêm tính năng — đây là một vòng nghiệm thu lại (đo kích
thước gói lần đầu, xác minh chéo các món nợ đã ghi) và trả nợ tài liệu còn sót
(`docs/contracts/canvas.md`). Không có dòng mã nào trong `src/` bị sửa ở lượt này.

---

## 2. Bảng số tại HEAD

Đo tại HEAD `ae7db03` (nhánh `mungvu2004/s12-a3-kich-thuoc`, cây làm việc sạch), chép
nguyên từ `S12-L1-kich-thuoc.md`:

| Cổng | Kết quả |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 (0 lỗi, 0 cảnh báo) |
| `pnpm test` | 206 file / 4266 passed / 0 failed |
| `pnpm cycles` | Import vòng: không có |
| `pnpm length` | 161 file đã quét · 18 vượt mức nhắc 250 · **0 vượt mức hỏng 400** |
| `pnpm size` — tổng JS (gzip) | **578,8 KiB** / ngân sách 175 KiB → **VƯỢT 403,8 KiB** |
| `pnpm size` — tổng CSS (gzip) | 9,3 KiB / ngân sách 12 KiB → đạt |
| `pnpm size` — chunk JS lớn nhất (gzip) | 132,9 KiB / ngân sách 170 KiB → đạt (chunk `scene-WfNF36mG.js`, không phải của S-12) |
| Chunk `WallLayerReview` (gzip) | **30,2 KiB** (thô 91,1 KiB), file `dist/assets/index-BvDLQvm7.js` |

**Kết luận:** màn S-12 đóng góp **30,2 KiB gzip** vào gói JS — khoảng **5,2%** tổng JS,
và chỉ bằng **~7,5%** phần vượt ngân sách. Cổng kích thước gói đang đỏ (vượt 403,8 KiB),
nhưng số vượt này gấp gần **13,4 lần** đóng góp riêng của S-12: ba chunk nặng nhất
(`scene-WfNF36mG.js` 132,9 KiB, `index-C9rTj0ED.js` 113,9 KiB, `EmptyState-B1kxPI2r.js`
58,1 KiB) đã hơn 300 KiB và đã tồn tại ở `master` từ trước khi màn này được dựng. **Cổng
đỏ không phải do S-12 gây ra**, và việc gộp màn này không làm cổng đỏ thêm đáng kể.

---

## 3. Ba quyết định cần người duyệt gật hay lắc

### Món 1 — Lưu tường lên máy chủ

- **Hỏi gì:** có mở một prompt logic mới (nhóm T) để thêm đường lưu đồ thị tường lên máy
  chủ không?
- **Nếu gật:** một lượt sửa `src/api/**` (contracts, client, endpoints) và
  `src/lib/query/**` (queryKeys, invalidation) — ước lượng ~5 file, ~30-40 dòng. Nên gộp
  luôn nhu cầu tương tự của màn `ScaleCalibration` (đã ghi nhận cùng khoảng trống) để
  tránh vá hai lần.
- **Nếu lắc:** màn tiếp tục lưu trong bộ nhớ trình duyệt (kho + ngăn xếp hoàn tác 100
  bước); người dùng mất dữ liệu duyệt tường khi rời trang, dù mọi thao tác vẫn hoàn tác
  được trong phiên.
- **A4 đề xuất:** tách thành prompt logic riêng (nhóm T), gộp chung nhu cầu của
  `ScaleCalibration`.

### Món 2 — MiniMap chưa lái được bằng bàn phím

- **Hỏi gì:** có miễn trừ R-68 (phạm vi sửa của một prompt màn) để sửa thẳng
  `src/hooks/useMiniMap.ts` và `src/components/canvas/MiniMap.tsx` — hai file dùng chung,
  ngoài thư mục màn S-12 — không?
- **Nếu gật:** thêm một hàm thuần `jumpToCentre` vào `useMiniMap` (~10 dòng) và một lời
  gọi trong nhánh Enter/Space của `MiniMap.tsx` (~2 dòng). Ba nơi gọi `<MiniMap>` (hai màn
  thật — S-12 và `ScaleCalibration` — cộng một màn demo) đều tự động có phím tắt, không
  cần sửa gì thêm ở phía chúng. Đã xác minh không bài kiểm nào đang xanh khẳng định hành
  vi rỗng hiện tại, nên sửa không làm đỏ test nào.
- **Nếu lắc:** vi phạm A12 (bàn phím là đường đi hạng nhất) tiếp tục tồn tại ở một
  component dùng chung, ảnh hưởng cả ba nơi gọi nó.
- **A4 đề xuất:** **miễn trừ R-68 ngay** — sửa nhỏ, cô lập, không rủi ro hồi quy đo được.

### Món 3 — Công cụ đo vẫn trả `null`

- **Hỏi gì:** có cần miễn trừ R-68 cho món nợ này không?
- **Nếu gật:** không cần làm gì thêm ở bước xin miễn trừ — nhưng A4 đã xác minh lại và
  phát hiện **không cần miễn trừ**, vì mọi phần còn thiếu nằm trọn trong thư mục màn.
- **Nếu lắc (giữ nguyên, ghi nợ):** nút "đo" trên thanh công cụ tiếp tục là nút chết,
  nhưng đây là việc hoàn thiện màn bình thường có thể làm ở một lượt sau (gợi ý mã T9,
  nối tiếp T5-T8), không phải một khoản nợ cần xin phép trước.
- **A4 đề xuất:** **KHÔNG cần miễn trừ** — toàn bộ tầng logic (domain/lib) đã có đủ hàm
  cần thiết; phần thiếu chỉ là dây nối, và dây nối đó nằm trọn trong
  `src/screens/qc/WallLayerReview/**`.

**Đã kiểm chéo, không phải lời khai một chiều.** Món 3 là chỗ A4 tự lật ngược tiền đề ban
đầu của chính nhiệm vụ mình (ban đầu giả định cả ba món đều cần miễn trừ R-68). Điều phối
viên đã xác minh độc lập ba ký hiệu mà A4 dựa vào để lật kết luận, và cả ba đều có thật:
`measureDistance` (`src/domain/measure/measure.ts:134`), `pixelsToMillimetres`
(`src/domain/units/scale.ts:98,143`), và `MEASURE_TOOL` (`src/lib/tools/tools.ts:378`,
đăng ký dưới khoá `measure` ở dòng 537). Người duyệt có thể tin kết luận "không cần miễn
trừ" của món 3 là đã được kiểm tra hai lần, không chỉ dựa trên báo cáo của một lượt.

---

## 4. Việc còn nợ sau lượt này

Chép từ mục (d) của `docs/contracts/T8-bao-cao-tich-hop.md`, chỉ giữ những món không ai
trong DAG này (A3, A4, B1, B2) xử lý:

- **Phím `Space`** (giữ để tạm kéo khung nhìn) chưa đăng ký — hợp đồng canvas hiện không
  có chỗ nhận một cử chỉ kéo liên tục, nên không đăng ký một phím không làm gì là đúng
  (A2 tồn tại để chặn việc đó), không phải một lỗi cần vá gấp.
- **`expectVietnamese` nới đúng một chữ tiếng Anh: `"zoom"`** — đến từ `ZoomCluster`
  (`aria-label="Điều khiển zoom"`, "Zoom hiện tại 100%…"), một component dùng chung nằm
  ngoài phạm vi sửa của màn S-12; cùng tiền lệ với `ScaleCalibration.test.tsx`.

---

## 5. Bốn quyết định người duyệt đã chốt — đã thi hành

Bốn món ở mục 3 (và một món phát sinh) đã có phán quyết. Ghi lại ở đây để người duyệt
không phải quyết lại; **cả bốn đều đã thi hành xong hoặc đã ghi nợ đúng chỗ**.

| # | Quyết định | Trạng thái sau lượt gộp C1 |
|---|---|---|
| 1 | **A-13 — ngưỡng gạch chéo "cần chú ý" đặt ở 0,70** | **Đã làm** (nhánh B1). Làm bằng cách dùng lại `isLowConfidence` của `@/components/canvas/materialMap` (`= confidenceLevel(...) === 'needsReview'`), **không viết một hằng số ngưỡng nào vào thư mục màn** — đúng R-71 (một nguồn sự thật, màn đọc chứ không chép). Băng "AI đề xuất" (0,70 ≤ x < 0,90) do đó KHÔNG còn bị tính là độ tin cậy thấp; có bài kiểm khẳng định đúng điều này. |
| 2 | **B-07 — MiniMap được MIỄN TRỪ R-68** | **Đã làm** (nhánh B3). Đúng hai file sản phẩm như món 2 của mục 3 xin phép: `src/hooks/useMiniMap.ts` (thêm `jumpToCentre`) và `src/components/canvas/MiniMap.tsx` (nối vào nhánh Enter/Space). Kèm hai file kiểm mới. Soát phạm vi R-68 của C1 xác nhận nhóm "ngoài phạm vi" đúng bằng **bốn** file này và không có file thứ năm. |
| 3 | **B-04 — `wall.approve` dựng ở tầng màn → GHI NỢ** | **Ghi nợ, không chặn lượt gộp này.** Tách ra prompt lô-gic nhóm T sau. Người duyệt gộp được S-12 mà không phải chờ món này. |
| 4 | **B-05 — lưu tường lên máy chủ → prompt lô-gic nhóm T riêng** | **Ghi nợ.** Đúng đề xuất của A4 ở món 1 mục 3: gộp chung nhu cầu tương tự của `ScaleCalibration` để tránh vá hai lần. Cho tới lúc đó, màn lưu trong bộ nhớ trình duyệt. |

---

## 6. Năm điều nhánh B1 tự khai là còn treo

Đây là lời khai của chính nhánh làm việc, chép nguyên, **không phải phát hiện của người
soát**. C1 không sửa món nào trong năm món này — lượt gộp là gộp và đo, không viết tiếp.

1. **`A-04` mới làm nửa.** Chọn nhiều tường bằng **Ctrl-bấm** thì được (có bài kiểm:
   "Ctrl-bấm cộng dồn vùng chọn thay vì thay cả vùng"), nhưng **khoanh vùng marquee chưa
   làm**. Nút "nối đoạn" vẫn chỉ bật khi đúng hai tường được chọn, nên phần đã làm là đủ
   cho việc nối đoạn; phần thiếu là cách chọn nhanh nhiều tường.
2. **`A-07` cố ý không đổi bộ mẫu.** Bộ mẫu 48 tường / 12 đã duyệt giữ nguyên, có chủ ý.
3. **Toast hoàn tác đi qua `appNotificationBus`, KHÔNG qua `Toast.Provider`.** Lý do:
   provider đó tự phát thêm một toast mỗi lần commit và hoàn tác bằng zundo — sai ngăn xếp
   của màn này. Đây là lựa chọn kiến trúc có lý do, không phải chỗ quên nối dây.
4. **Khoá `shortcuts.approve` trong `src/i18n/vi.json` được giữ** dù không còn nơi đọc,
   vì đặc tả cấm xoá khoá.
5. **Ảo hoá của `WallLayerList` không vẽ hàng nào trong môi trường kiểm** — 0 phần tử
   `role="option"` ở cả bảy trạng thái, nên chưa một bài kiểm DOM nào từng nhìn thấy một
   hàng danh sách. **Món này C1 đã điều tra xong: xem mục 7.**

---

## 7. Kết luận điều tra "danh sách rỗng" — (a) hiện tượng của jsdom, sản phẩm không sao

**Câu hỏi:** người dùng thật có nhìn thấy hàng danh sách không?
**Trả lời: có.** Danh sách rỗng chỉ xuất hiện trong jsdom, và nguyên nhân nằm hoàn toàn ở
môi trường kiểm, không ở mã màn.

**Cách nghiệm.** Dựng cùng một cây `WallLayerReviewContainer` (trạng thái `success`) hai
lượt, **không sửa một dòng mã sản phẩm nào**. Lượt B chỉ khác lượt A ở chỗ dựng lại đúng
hai thứ trình duyệt thật luôn có mà jsdom không có.

| | Lượt A — jsdom nguyên trạng | Lượt B — có bảng kiểu + phép đo khung |
|---|---|---|
| `<div role="listbox">` có mặt | có | có |
| chiều cao `getTotalSize()` | `height: 1920px` (48 hàng × 40 px) | `height: 1920px` |
| số phần tử `role="option"` | **0** | **23** |
| hàng đầu đọc được | — | `#W-001 · 330 mm · 0,76` |

23 hàng đúng bằng số hàng vừa một khung cuộn cao 600 px (15 hàng × 40 px) cộng `overscan: 8`
mà `WallLayerList` khai — con số khớp đúng công thức, không phải một số ngẫu nhiên.

**Chuỗi nhân quả, đã lần tới tận gốc.**

1. `WallLayerList` lấy phần tử cuộn qua `findScrollParent`, hàm này đi ngược cây tổ tiên
   tìm phần tử có `getComputedStyle(...).overflowY` bằng `auto` hay `scroll`. Trong trình
   duyệt thật, phần tử đó là `<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">`
   bọc ngay ngoài danh sách (`WallLayerLeftPanel.tsx:350`) — tìm thấy ở **bước đi đầu tiên**.
2. **jsdom không nạp bảng kiểu nào**, nên lớp Tailwind `overflow-y-auto` không sinh ra
   giá trị tính toán: `getComputedStyle(...).overflowY` trả chuỗi rỗng cho mọi phần tử.
   Vòng lặp đi hết cây mà không tìm được gì.
3. Nhánh dự phòng cuối hàm trả `document.scrollingElement`. Trong môi trường kiểm này,
   **`document.scrollingElement` là `undefined`** (đã đo trực tiếp), nên `?? null` cho ra
   `null`.
4. `getScrollElement()` trả `null` → `@tanstack/react-virtual` không bao giờ đặt được
   `scrollElement` → `observeElementRect` thoát sớm → `outerSize` đứng ở 0 →
   `calculateRange` trả `null` khi `outerSize > 0` sai (`virtual-core@3.8.3`, dòng 439) →
   `getVirtualItems()` trả mảng rỗng.

Điểm 3 đáng ghi lại: nhánh dự phòng của `findScrollParent` **không** chịu được một môi
trường mà `document.scrollingElement` vắng mặt. Trong trình duyệt thật điều đó không xảy
ra (và kể cả có, bước 1 đã tìm thấy phần tử cuộn nên không bao giờ tới nhánh dự phòng),
nên **đây không phải lỗi người dùng gặp** — chỉ là một chỗ dự phòng mỏng hơn vẻ ngoài.

**Bài kiểm dùng để nghiệm là bài kiểm TẠM và KHÔNG được commit.** Nó phải giả lập bảng
kiểu (`getComputedStyle`), phép đo khung (`clientHeight`, `getBoundingClientRect`) và
`ResizeObserver` cùng lúc — ba lớp giả cho một khẳng định, quá nhiều giàn giáo để thành
một bài kiểm thật đáng tin. Giữ nó lại sẽ là một bài kiểm chủ yếu kiểm chính bộ giả của
nó. Vì vậy C1 xoá nó sau khi đo và giữ số đo ở đây.

**Việc còn nợ (không chặn gộp):** chưa một bài kiểm DOM nào nhìn thấy một hàng danh sách,
nên hành vi của một hàng (chọn, rê chuột, nháy nền, chấm trạng thái, huy hiệu "cần chú ý")
chỉ được kiểm gián tiếp qua tầng hook. Cách đúng để trả nợ này là một bài kiểm Playwright
trong trình duyệt thật — nơi bảng kiểu có thật nên không cần lớp giả nào — chứ không phải
thêm giàn giáo vào jsdom. Đề nghị làm ở một lượt riêng, sau khi `src/routes/router.tsx`
được gắn thật (hiện `main.tsx` vẫn dựng thẳng `<App />`, nên màn chưa có đường vào trình
duyệt để Playwright mở).
