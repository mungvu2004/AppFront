# S12-L2 — Hồ sơ trình người duyệt: màn "Duyệt lớp tường" (S-12)

Gộp lại từ `docs/contracts/S12-L1-kich-thuoc.md` (đo kích thước gói, A3) và
`docs/contracts/S12-L1-no-ngoai-pham-vi.md` (ba món nợ ngoài phạm vi, A4). Không đo lại,
không đo thêm — mọi con số dưới đây chép nguyên từ hai hồ sơ đó. Viết cho người duyệt
không cần đọc mã vẫn quyết định được.

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
