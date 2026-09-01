# S13 — ObjectLayerReview · đặc tả gốc và quyết định điều phối

> File này là **nguồn duy nhất** cho mọi chuỗi tiếng Việt có dấu mà bạn viết vào mã.
> Đặc tả gửi qua CLI đã bị bỏ dấu để tránh lỗi mã hoá — **file này mới là bản đúng**.
> Mọi nhãn người dùng đọc phải chép từ đây, **có dấu đầy đủ**, viết thường kiểu câu (A6).

---

## Phần I — Đặc tả gốc (nguyên văn)

**[CONTEXT]**
Route `/du-an/:projectId/tang/:floorId/lop/doi-tuong`. 21 đối tượng: 9 cửa đi, 7 cửa sổ,
5 nội thất. Hiện 9/21 đã duyệt.
Người dùng: người duyệt phần lớn chỉ xác nhận, thỉnh thoảng đổi một cửa đi thành cửa sổ.
Dùng lại QC-SHELL, **không định nghĩa lại vỏ**.

**[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]**
- M-08 gắn lỗ mở lên tường: kiểm chồng lấn, chiều mở, vị trí hợp lệ. M-09 trôi lỗ mở khi
  tường đổi và kiểm hợp lệ.
- S-07 lệnh: đổi loại, đổi chiều mở, di chuyển, xoá, duyệt. S-05 điều phối, S-06 lịch sử.
- S-10, S-11 vùng chọn; D-06 gộp lệnh 400ms khi kéo liên tục; D-04 cập nhật lạc quan.
- P-06 màu độ tin cậy và màu lớp dữ liệu; P-01 định dạng "900 × 2.200 mm".
- R-07 bay khung nhìn tới đối tượng (dùng khi bấm vào tường chủ).

**[ĐỌC FILE NÀO]**
- `src/domain/openings/**`, `src/lib/commands/business/**`, `src/lib/selection/**`,
  `src/lib/mutations/**`, `src/lib/coloring/**`
- `src/components/canvas/{SelectionHalo,MeasurementLabel,WallThicknessLegend,ContextMenu}.tsx`
- `src/components/ui/{Select,Slider,Radio,NumericField,SegmentedControl,ConfidenceMeter,Badge,IconButton}.tsx`

**[BỐ CỤC]**
Theo QC-SHELL. Riêng màn này:
- **Panel trái:** bộ đếm "9/21 đối tượng đã duyệt". Cây lớp có ba lớp con bật tắt được, mỗi
  lớp một ô màu và một số đếm: Cửa đi (9) · Cửa sổ (7) · Nội thất (5) · tổng 21 đối tượng.
  Dưới là hàng chip lọc theo loại: cửa đơn · cửa đôi · cửa sổ · giường · sofa · bàn ăn ·
  bồn cầu · chậu rửa. Dưới cùng là danh sách gộp theo ba nhóm gấp được, mỗi dòng:
  mã · kích thước · tường chủ · độ tin cậy.
- **Canvas:** đối tượng vẽ bằng **ký hiệu kiến trúc**, không phải khung bao. Cửa đi có cung
  mở, cửa sổ hai vạch song song nét 4-2. Viền 1px màu dữ liệu của lớp, nền 6%. Tường hạ
  xuống `--wall-idle` để đối tượng nổi lên. Hộp chọn có 4 tay cầm 6px.
- **Panel phải khi chọn:** tiêu đề "Đối tượng", mã "#D-007" mono-lg, Select loại có biểu
  tượng, rồi FieldRow: chiều rộng 900 mm · chiều cao 2.200 mm · tường chứa nó dạng liên kết
  bấm được "#W-014" · vị trí trên tường là Slider 0–1 có số chữ đều · hướng mở là bốn radio
  biểu tượng · ConfidenceMeter. Riêng cửa sổ có thêm FieldRow "cao độ bệ cửa 900 mm".

**[NỐI LOGIC]**
- Gắn vào tường, chặn chồng lấn, gợi ý vị trí hợp lệ: **tất cả gọi M-08**. Màn không tự
  tính vị trí gắn.
- Kéo liên tục gộp thành **một** lệnh theo D-06 (cửa sổ 400ms).
- Đổi loại bằng ô chọn hoặc phím; mỗi lần đổi là một lệnh S-07, hoàn tác được.
- Đối tượng không gắn được vào tường nào: hiện badge cần chú ý "Chưa gắn vào tường nào"
  kèm hành động "Gắn vào tường gần nhất" — hành động này gọi M-08, không tự tìm.
- Bấm liên kết tường chủ thì chọn tường đó và bay khung nhìn tới bằng R-07.

**[TƯƠNG TÁC & CHUYỂN ĐỘNG]**
- Bật tắt một lớp con: đối tượng của lớp đó mờ dần kèm dịch dọc 4px trong 240ms, so le 24ms.
- Đổi loại: ký hiệu trên canvas biến hình trong 240ms và đổi màu bằng chạy màu.
- Kéo Slider vị trí: đối tượng trượt dọc tường chủ theo thời gian thực, hiện số đo khoảng
  cách tới **hai đầu tường** bằng MeasurementLabel.
- Phím riêng: `D` / `W` / `F` đặt nhóm loại · `1` / `2` / `3` đổi loại trong nhóm · các phím
  chung theo QC-SHELL.

**[BẢY TRẠNG THÁI]**
1. **Rỗng** — AI không tìm thấy đối tượng nào; giải thích rằng nhận diện nội thất phụ thuộc
   kiểu vẽ, kèm nút thêm thủ công.
2. **Đang tải.**
3. **Một phần** — 5 mục dưới ngưỡng 0,75 được lọc sẵn; hoặc nhánh nội thất lỗi trong khi
   cửa vẫn xong: lớp nội thất hiện một hàng cần chú ý, **không chặn cả màn**.
4. **Lỗi.**
5. **Xong** — 21/21.
6. **Không có quyền.**
7. **Thu gọn.**

**[CẤM TUYỆT ĐỐI]**
- Không tự tính vị trí gắn cửa, không tự kiểm chồng lấn.
- Vẽ bằng ký hiệu kiến trúc, **không phải khung bao**.
- Không quá ba màu dữ liệu hiện cùng lúc.
- Không biểu tượng tô đầy màu cho loại đối tượng.
- Số 21 = 9 + 7 + 5 phải đúng ở mọi nơi xuất hiện.
- Mọi đối tượng phải nói rõ tường nào chứa nó, hoặc bị gắn cờ nếu không có.
- Không tạo component mới.

**[NGHIỆM THU]**
- `pnpm typecheck`, `pnpm lint`, `pnpm test` → xanh; `expectSevenStates` 7/7.
- Kéo một cửa 20 lần liên tục → lịch sử chỉ tăng **1** bước. In số bước.
- Đếm màu dữ liệu hiện cùng lúc khi bật cả ba lớp → đúng 3.
- In tổng số đối tượng ở cả bốn nơi (cây lớp, bộ đếm, danh sách, canvas) → phải cùng bằng 21.

**[KHÔNG ĐƯỢC SỬA FILE NÀO]**
- `src/lib/**`, `src/api/**`, `src/domain/**`, `src/store/**`, `src/components/**`,
  `AGENTS.md`, các màn đã xong.

---

## Phần II — Quyết định điều phối đã chốt (bắt buộc theo, không hỏi lại)

Thứ tự ưu tiên: `LUAT_MAN_HINH.md` → `RULE.md` → `CLAUDE.md` → prompt màn hình.
Bốn điểm dưới đây là chỗ prompt nói khác luật; **theo luật**, đã quyết xong.

### QĐ-1 — Đường dẫn tiếng Anh, không phải `/du-an/.../lop/doi-tuong`

Đặc tả viết route tiếng Việt. Repo đặt đường dẫn bằng tiếng Anh; màn anh em là
`projectWalls: '/projects/:id/floors/:floorId/layers/walls'`. Màn này dùng:

```ts
projectObjects: `${PROJECTS_ROOT}/:id/floors/:floorId/layers/objects`
```

Ngoại lệ tiếng Việt duy nhất trong repo là `account: '/tai-khoan'`, đã ghi chú rõ là ngoại lệ.

### QĐ-2 — `src/routes.tsx` không còn tồn tại

R-65 sửa ngày 21-08-2026 tách nó thành thư mục `src/routes/`: `paths.ts` (lá, không import gì)
· `router.tsx` · `index.ts`. **Màn nhập `@/routes/paths`**, không bao giờ nhập `@/routes`
(sẽ tạo vòng import, `pnpm cycles` sẽ đỏ). T8 sửa cả `paths.ts` và `router.tsx`.

### QĐ-3 — Ba lệnh còn thiếu: dựng trong thư mục màn từ nguyên thuỷ công khai

`src/lib/commands/business/openingCommands.ts` **không có** `opening.changeKind`,
`opening.changeSwing`, `opening.approve`. R-68 cấm sửa `src/lib/**`.

**Đã duyệt:** dựng cả ba **ngay trong `objectLayerReviewGateway.ts`** bằng `createCommand`
và `runTransaction` — đúng tiền lệ đã được duyệt của màn anh em
(`wallLayerReviewGateway.ts:482-505`, `buildApproveWallCommand`, kèm chú thích
*"dựng bằng nguyên thuỷ công khai … Điều phối viên đã duyệt"*).

Ràng buộc kèm theo:
- **A5** — lệnh duyệt là đường **duy nhất** đặt `reviewed: true`, và luôn đặt kèm
  `source: 'human'`. Đầu ra của AI không bao giờ được đặt nó.
- Mỗi lệnh phải **hoàn tác được** và có `description` tiếng Việt có dấu.
- Đổi loại cửa đi ↔ cửa sổ phải đi qua `validateOpening` của M-08 trước khi nhận;
  không tự kiểm chồng lấn.
- Chép nguyên khuôn chú thích của màn anh em, giải thích vì sao được phép dựng ở đây.

### QĐ-4 — 240ms không có trong thang chuyển động; dùng **260ms**

Đặc tả viết "240ms" ba lần. Thang chuyển động có **đúng năm giá trị: 120 · 180 · 260 · 340 ·
700 ms** (`MOTION_DURATIONS_MS` trong `src/lib/motion/tokens.ts`), và luật ESLint
`local/no-raw-duration` ở mức `error` chặn mọi con số khác.

**Đã quyết: mọi chỗ đặc tả ghi 240ms thì dùng 260ms, lấy từ `MOTION_DURATIONS_MS`.**
Không viết số thô. Độ so le 24ms là *stagger* chứ không phải *duration* — nếu nó cũng bị
luật chặn thì báo lại bằng `escalation`, đừng tự bịa một con số khác.

### QĐ-5 — Sáu file R-59 + file anh em

R-59 đòi sáu file: `index.ts` · `ObjectLayerReview.tsx` · `useObjectLayerReview.ts` ·
`ObjectLayerReview.container.tsx` · `ObjectLayerReview.stories.tsx` ·
`ObjectLayerReview.test.tsx`. Màn anh em cần tới 21 file — mục D cho phép tách file anh em
khi view vượt 400 dòng (R-22), miễn `index.ts` giữ nguyên đường nhập.
**"Không tạo component mới" nói về `src/components/**`**, không cấm file anh em trong thư mục màn.

---

## Phần III — Bản đồ sở hữu file (một file đúng một chủ)

Ghi đè file của worker khác là hỏng cả nhánh. Chỉ ghi file trong cột của bạn.

| Task | File nó sở hữu |
|---|---|
| T4 | `objectLayerTypes.ts` · `objectLayerFixture.ts` · `.orca-notes/T4-routes.fragment.md` |
| T5 | `objectLayerReviewGateway.ts` · `useObjectLayerReview.ts` · `objectLayerReviewScenarios.ts` · `useObjectLayerReview.test.ts` |
| T6 | `ObjectLayerCanvas.tsx` · `objectLayerSymbols.ts` · `ObjectLayerLeftPanel.tsx` · `ObjectLayerList.tsx` |
| T7 | `ObjectLayerInspector.tsx` · `ObjectLayerStatusBar.tsx` · `ObjectLayerToolRail.tsx` |
| T8 | `index.ts` · `ObjectLayerReview.tsx` · `ObjectLayerReview.container.tsx` · `ObjectLayerReview.stories.tsx` · `ObjectLayerReview.test.tsx` · `src/routes/paths.ts` · `src/routes/router.tsx` · `src/i18n/vi.json` |

`src/routes/paths.ts`, `src/routes/router.tsx`, `src/i18n/vi.json` **chỉ T8 được chạm**.
Ai cần thêm chuỗi thì ghi vào `.orca-notes/T<n>-i18n.fragment.md` cho T8 gộp.

---

## Phần IV — Chuỗi tiếng Việt chuẩn (chép nguyên văn, có dấu)

Nhãn viết thường kiểu câu (A6). Ngoại lệ chữ hoa: mã đối tượng, mã tường, tên phím.

| Vai trò | Chuỗi |
|---|---|
| Tiêu đề màn | `lớp đối tượng` |
| Bộ đếm | `9/21 đối tượng đã duyệt` |
| Lớp con 1 | `cửa đi` |
| Lớp con 2 | `cửa sổ` |
| Lớp con 3 | `nội thất` |
| Tổng cây lớp | `tổng 21 đối tượng` |
| Chip lọc | `cửa đơn` · `cửa đôi` · `cửa sổ` · `giường` · `sofa` · `bàn ăn` · `bồn cầu` · `chậu rửa` |
| Tiêu đề panel phải | `Đối tượng` |
| FieldRow | `chiều rộng` · `chiều cao` · `tường chứa nó` · `vị trí trên tường` · `hướng mở` · `độ tin cậy` |
| FieldRow riêng cửa sổ | `cao độ bệ cửa` |
| Badge cần chú ý | `Chưa gắn vào tường nào` |
| Hành động của badge | `Gắn vào tường gần nhất` |
| Trạng thái rỗng — tiêu đề | `chưa nhận ra đối tượng nào` |
| Trạng thái rỗng — giải thích | `nhận diện nội thất phụ thuộc kiểu vẽ của bản gốc, nên bản vẽ ít ký hiệu quy ước có thể không ra kết quả nào.` |
| Trạng thái rỗng — nút | `thêm thủ công` |
| Trạng thái một phần | `5 mục dưới ngưỡng tin cậy, đã lọc sẵn` |
| Hàng cần chú ý của lớp nội thất | `nhận diện nội thất lỗi, cửa vẫn xong` |
| Trạng thái xong | `21/21 đối tượng đã duyệt` |
| Không có quyền | `bạn không có quyền xem lớp đối tượng của dự án này` |
| Đơn vị hiển thị | `900 × 2.200 mm` (P-01, dấu thập phân là **dấu phẩy**, dấu nghìn là **dấu chấm**) |

Chuỗi mới nào bạn thêm cũng phải nằm trong `.orca-notes/T<n>-i18n.fragment.md`
để T8 đưa vào `src/i18n/vi.json` (R-67) — không thêm khoá thì `expectVietnamese`
soát lọt, im lặng.

---

## Phần V — Quyết định bổ sung sau tầng 1

### QĐ-6 — `Slider` vẫn dùng, kèm phương án dự phòng đã đọc mã

T2 kết luận `src/components/ui/Slider.tsx` vẽ vòng focus bằng **trạng thái**
(`isFocused && 'ring-2 ring-accent ring-offset-2'`, dòng 154) chứ không bằng
`:focus-visible`, nên khi render tĩnh thì `classList` không có `ring-2` và
`expectAccessible` báo lỗi `focus-ring`.

**Nhưng** đã kiểm chứng bằng cách chạy thật: `src/screens/upload/InputQualityGate`
vừa nhập `Slider` vừa gọi `expectAccessible`, và **19/19 test xanh**.

**Quyết định:** T7 **dùng `Slider` đúng như đặc tả** ("vị trí trên tường là Slider 0–1").
Nếu `expectAccessible` báo lỗi `focus-ring` ở Slider, dùng đường dự phòng đã đọc trong
`expectAccessible.ts:645-668`: **bọc Slider trong một phần tử cha mang class
`focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2`.**
`focusRingOwner` đi ngược lên cha tìm đúng `focus-within:ring-2`, nên vòng focus được
tính là có chủ. Cách này **không đụng `src/components/**`** (R-68) và giữ nguyên đặc tả.

Tuyệt đối **không** sửa `src/components/ui/Slider.tsx`. Nếu cả hai đường đều hỏng thì
gửi `escalation`, đừng tự đổi sang điều khiển khác.

### QĐ-7 — Token màu và thời lượng: tên chính xác

Lấy từ hợp đồng T2, dùng đúng tên này, không gõ mã màu thô (A1):

- Tường: `--wall-110` · `--wall-220` · `--wall-330` · `--wall-idle`
  (khai ở `src/styles/globals.css:180-183`, dùng qua Tailwind `wall.110/220/330/idle`).
  Đặc tả nói "tường hạ xuống `--wall-idle`" → dùng `wall-idle`.
- Độ tin cậy: **không có token riêng**. Dùng `confidenceLevel()` của `@/lib/format/semantic`
  rồi ánh xạ sang `state-attention` / `state-verified` / `text-muted` — đúng ba màu trạng thái
  của A4, và A5 cấm đầu ra AI đặt màu "đã xác minh".
- Thời lượng: `MOTION_DURATIONS_MS` ở `src/lib/motion/tokens.ts:62-67` =
  `{ instant: 120, fast: 180, standard: 260, slow: 340 }`, thêm `AMBIENT_LOOP_MS = 700`.
  **240ms không tồn tại** → dùng `MOTION_DURATIONS_MS.standard` (260ms), theo QĐ-4.

### QĐ-8 — "QC-SHELL" **không phải** `src/components/shell`. SỬA LẠI ĐIỀU PHỐI ĐÃ GHI.

T3 đã kiểm bằng grep và đọc mã: màn anh em `WallLayerReview` **không import**
`AppShell`, `Panel`, hay `StatusBar` từ `src/components/shell/`. Nó tự dựng layout ba
cột bằng `div` trần (`WallLayerReview.tsx:108-140`), và tự viết `WallLayerStatusBar.tsx`
nhận **ba chuỗi đã định dạng sẵn** thay vì số thô.

**Đặc tả nhiệm vụ gửi cho T6/T7/T8 qua CLI có ghi "cắm vào AppShell + Panel + StatusBar".
Câu đó SAI. Quyết định này thắng.**

- **QC-SHELL = khuôn layout ba cột của `WallLayerReview.tsx`**, chép cấu trúc đó:
  rail công cụ trái · panel trái · `<section>` canvas ở giữa · inspector phải · status bar
  dưới cùng; thu gọn bằng cờ `isCollapsed` đổi `className` tại chỗ.
- **Không** dùng `src/components/shell/StatusBar.tsx`: nó nhận `x, y` số thô rồi tự
  `toFixed(2)` bên trong view — đúng thứ `local/no-raw-number` cấm, và nó nằm trong
  **sổ nợ** của `CLAUDE.md`. Đó là nợ, không phải khuôn để chép.
- **Không** dùng `src/components/shell/Panel.tsx`: màn anh em viết thẳng
  `<div className="... rounded-[12px] bg-bg-surface shadow-panel">`.
- `ObjectLayerStatusBar` nhận **chuỗi đã định dạng sẵn** từ hook, không nhận số thô (A15).

Việc này **không** vi phạm "dùng lại QC-SHELL, không định nghĩa lại vỏ": vỏ QC ở repo này
là khuôn của màn QC anh em, và chép đúng khuôn đó chính là dùng lại nó.
