# T8 — báo cáo nghiệm thu màn `ObjectLayerReview`

Nhánh `mungvu2004/s13-t8-tichhop`, commit `96e9b30`
(`feat(s13-t8): rap man ObjectLayerReview, dang ky route va i18n`).

Mọi con số dưới đây là **kết quả chạy thật**, dán từ đầu ra của lệnh. Không con số
nào được suy ra hay làm tròn (E.10 / R-58).

---

## 1. Ba cổng

| Lệnh | Kết quả | Số đo |
|---|---|---|
| `pnpm typecheck` | **đạt** | 0 lỗi (`tsc --noEmit`, mã thoát 0) |
| `pnpm lint` | **đạt** | 0 lỗi · 0 cảnh báo (`--max-warnings 0`, mã thoát 0) |
| `pnpm test` | **đạt** | 4350 đạt / 0 hỏng / 4350 tổng · 209 file test |

Chạy thêm ngoài yêu cầu, cùng xanh: `pnpm cycles` ("Import vòng: không có") và
`pnpm length` ("169 file đã quét · 24 vượt 250 · 0 vượt 400 · đạt").

`pnpm verify` **không** chạy: bước 6 (kích thước gói) đã đỏ sẵn trên cây đã commit từ
trước lượt này, nên chạy nó chỉ tạo ra một con số đỏ không thuộc về màn này. Ba bước
liên quan tới màn được chạy riêng và dán ở trên.

## 2. Bốn con số nghiệm thu

| # | Đo cái gì | Ngưỡng | Đo được | Ở đâu |
|---|---|---|---|---|
| 1 | Kéo một cửa 20 lần liên tục → số bước lịch sử tăng thêm | 1 | **1** | `useObjectLayerReview.test.ts` — `số lượt kéo: 20 — số bước lịch sử sau đó: 1` |
| 2 | Bật cả ba lớp → số màu dữ liệu hiện cùng lúc | 3 | **3** | nt — `số màu dữ liệu hiện cùng lúc: 3 — --wall-330, --wall-220, --wall-110` |
| 3 | Tổng đối tượng ở bốn nơi | 21 · 21 · 21 · 21 | **21 / 21 / 21 / 21** | `ObjectLayerReview.test.tsx` `[NGHIEM-2]` |
| 4 | `expectSevenStates` | 7/7 | **7/7** | nt `[NGHIEM-1]` |

Đầu ra nguyên văn của phép đo số 3 (đọc từ DOM của màn đã ráp, không đọc lại mô hình):

```
tổng đối tượng — cây lớp:  21 (9 + 7 + 5)
tổng đối tượng — bộ đếm:   21
tổng đối tượng — danh sách: 21
tổng đối tượng — canvas:   21
```

Phép đo dùng trạng thái `success` vì ở `partial` **năm mục dưới ngưỡng đang được lọc
sẵn** — đúng đặc tả — nên danh sách và canvas cố ý hiện ít hơn tổng. Bộ lọc là một câu
trả lời khác, không phải một con số lệch; hàng "5 mục dưới ngưỡng tin cậy, đã lọc sẵn"
cộng nút tắt bộ lọc nằm ngay trên danh sách.

## 3. Khối kiểm luật

Sáu lệnh phải rỗng — **cả sáu đều rỗng**:

```
R-60 view chạm dữ liệu   → (rỗng)
R-64 useState loading    → (rỗng)
R-69 TODO/FIXME/stub     → (rỗng)
R-70 .skip/.only         → (rỗng)
R-71 hằng số thô         → (rỗng)
```

Bốn lệnh phải có kết quả — **cả bốn đều có**:

```
ls $SCREEN               → 18 file (đủ sáu tên chuẩn R-59 + 12 file anh em)
<ScreenErrorBoundary     → ObjectLayerReview.container.tsx:128
expectSevenStates        → ObjectLayerReview.test.tsx (import + lời gọi + in số)
ls $SCREEN/*.container.tsx → ObjectLayerReview.container.tsx
```

## 4. Hai chỗ đặc tả nhiệm vụ sai — đã hỏi và đã được điều phối viên quyết

### 4.1 Số `<Placeholder>` **không** giảm 11 → 10. Nó là 11 → 11.

Nhiệm vụ ghi: trỏ `ROUTE_PATTERNS.layerObjects` vào màn thật, xoá `RouteCanvas` nếu
không còn ai dùng, số `Placeholder` giảm còn 10. Kiểm mã nguồn cho thấy tiền đề sai:

- `RouteCanvas` (`router.tsx:19`) phục vụ **năm** route — `layerObjects`,
  `layerDimensions`, `layerGrids`, `floors`, `layerRooms`. Trỏ một route sang màn thật
  vẫn còn bốn người dùng, nên dòng 19 không xoá được và `grep -c Placeholder` vẫn là 11.
- `layerObjects = '/layers/objects'` **không mang** `:id`/`:floorId`, nên màn cắm vào đó
  sẽ luôn hiện cảnh báo "Thiếu mã dự án hoặc mã tầng".

Điều phối viên đã kiểm lại và chọn **phương án A**: chỉ thêm route mới
`projectObjects = '/projects/:id/floors/:floorId/layers/objects'`, **không** đụng
`layerObjects`, **không** đụng `RouteCanvas`, và báo trung thực 11 → 11. Mục đích của
R-66 vẫn đạt: `projectObjects` là route MỚI, có đủ tham số, chưa bao giờ là placeholder
để mà xoá — màn không bị bỏ quên không ai tới được.

### 4.2 Nút "thêm thủ công" của trạng thái rỗng đã có hành động thật

`ObjectLayerReviewModel` (T4 đóng băng, T5 cài đặt) không có hành động thêm đối tượng
nào, nên nút mà đặc tả đòi sẽ là một nút chết (A2/R-73 cấm). Điều phối viên chỉ ra rằng
đường lô-gic **đã tồn tại** ở tầng dưới (`createAddOpeningCommand` của
`src/lib/commands/business/openingCommands.ts`, đã được `buildAddOpeningCommand` của
cổng gọi lại) và quyết: nối dây nốt thay vì bỏ nút.

Đã cài đặt:

- `manualDoorProposalOf` (cổng) đề nghị **đúng một chỗ** — giữa tim đoạn tường đầu tiên
  của tầng, toạ độ do `placeOnWall` của M-08 trả — rồi để `createAddOpeningCommand` chạy
  `attachToWall` + `validateOpening` phán quyết. Màn **không** tự tính vị trí gắn,
  **không** tự kiểm chồng lấn, và **không** đi tìm một tường thứ hai khi bị từ chối: nó
  phát ra câu từ chối của domain.
- Kích thước cửa thêm tay đọc từ bộ mẫu, `AT_WALL_MIDDLE` suy từ `AT_WALL_START`/
  `AT_WALL_END` của domain — không hằng số viết tay (R-71).
- `onAddManually` trên mô hình + hook; dòng bộ mẫu của đối tượng mới sống trong hook để
  `objectsOf` thấy nó (cổng mang bộ mẫu hằng, không sửa được).
- A5 giữ nguyên: lệnh thêm gắn `AUTHORED_BY_HAND` (`reviewed: false`); bài kiểm khẳng
  định bộ đếm sau khi thêm là `0/1 đối tượng đã duyệt`, không phải `1/1`.

Bài kiểm `trạng thái rỗng > nút "thêm thủ công" thêm thật một đối tượng, qua lệnh của
S-07` bấm nút thật và đòi một dòng thật xuất hiện trong danh sách.

## 5. File đã sửa ngoài năm file R-59

Ngoài `ObjectLayerReview.tsx`, `.container.tsx`, `index.ts`, `.stories.tsx`,
`.test.tsx`, `src/routes/paths.ts`, `src/routes/router.tsx`, `src/i18n/vi.json`:

| File | Sửa gì | Vì sao |
|---|---|---|
| `objectLayerReviewGateway.ts` | thêm `manualDoorProposalOf`, `ManualObjectProposal`, hai chuỗi `addNoWall`/`addRefused` | mục 4.2 — điều phối viên duyệt |
| `objectLayerTypes.ts` | thêm `ObjectLayerReviewModel.onAddManually` | nt |
| `useObjectLayerReview.ts` | thêm state dòng bộ mẫu thêm tay, `seed` gộp, `onAddManually` | nt |
| `ObjectLayerList.tsx` | `focus-visible:ring-inset` → `focus-visible:ring-offset-2` | `expectAccessible` báo "viền tiêu điểm thiếu offset 2px" ở cả năm dòng; sửa mã chứ không nới phép kiểm (R-70) |

`src/lib/**`, `src/api/**`, `src/domain/**`, `src/store/**`, `src/components/**`,
`AGENTS.md` và mọi màn đã xong: **không đụng một dòng nào**.

## 6. i18n

`src/i18n/vi.json` nhận một khoá gốc mới `objectLayerReview` gộp đủ bốn mảnh
(`T4-routes`, `T5`, `T6`, `T7`) cộng những chuỗi T8 tự thêm (`filter.lowConfidenceOnly`,
`add.noWall`, `add.refused`, `route.*`). Đây không phải trang trí: `expectVietnamese`
đọc `vi.json` làm từ điển, và trước khi thêm khoá nó **đã bắt** chuỗi `sofa` ở cả sáu
trạng thái. Thêm khoá là cách sửa đúng, không phải `allowWords`.
