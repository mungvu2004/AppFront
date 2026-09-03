# Dữ liệu cho S-18 ThicknessStandardization — khảo sát M-05 / P-06 / P-01 / P-03

Tài liệu chỉ đọc, không sửa mã. Ghi bởi T2 cho T5 (hook) / T6 (canvas) / T7 (panel) dùng.
Mọi khẳng định kèm `đường-dẫn:số-dòng`. Phần "NOT FOUND" ở cuối liệt kê những gì đặc tả
S-18 giả định mà không tìm thấy trong mã.

Nhắc lại quyết định đã chốt của điều phối viên (không quyết lại ở đây):

- **X1 (phương án A):** màn S-18 khai `WALL_THICKNESS_CHOICES`/bộ nhóm riêng trong thư mục
  màn (theo tiền lệ `src/screens/qc/WallLayerReview/types.ts:168`), **vẫn gọi**
  `suggestStandardThickness` của M-05 để hiển thị cột đối chiếu, **không sửa** `src/domain`.
- **X2:** `Wall.thicknessMm` domain là `number`; `'CONCRETE_COLUMN'` chỉ sống ở
  `src/types/spatial.ts`. Cột BTCT hiển thị/đếm được nhưng chưa có lệnh áp.

---

## 1. M-05 đầy đủ — `src/domain/walls/cleanup.ts`

### Hằng số

- `STANDARD_THICKNESSES_MM: readonly Millimetres[]` — `cleanup.ts:70-72` —
  `[100, 150, 200, 220, 300, 400]`, mỗi phần tử được gói qua `millimetres()`.
- `THICKNESS_SUGGESTION_LIMIT_MM: Millimetres` — `cleanup.ts:75` — `15` (mm). Đây là
  tham số mặc định thứ hai của cả hai hàm dưới, có thể override.

### `nearestStandardThickness` — `cleanup.ts:599-618`

```ts
function nearestStandardThickness(
  thicknessMm: Millimetres,
  limitMm: Millimetres = THICKNESS_SUGGESTION_LIMIT_MM,
): Millimetres | null
```

Trả về giá trị chuẩn **gần nhất** trong `STANDARD_THICKNESSES_MM`, hoà bằng cách chọn giá
trị chuẩn nhỏ hơn (`cleanup.ts:610`). Trả `null` khi khoảng cách đã bằng 0 (đã chuẩn) **hoặc**
lớn hơn/bằng `limitMm` (`cleanup.ts:613`) — tức là "quá xa để coi là làm tròn". Đây là hàm
**thuần, nhận một số, KHÔNG cần cả mảng `Wall`** — xem mục "Cách gọi M-05 dễ nhất" bên dưới.

Ví dụ đã xác nhận qua chính logic: `nearestStandardThickness(millimetres(195))` → `200`
(khoảng cách 5 < 15), KHÔNG phải `220` như câu chuyện gốc của S-18 (đã chốt ở X1).

### `suggestStandardThickness` — `cleanup.ts:628-654`

```ts
function suggestStandardThickness(
  walls: readonly Wall[],       // Wall của CHÍNH module cleanup, xem mục 2
  limitMm: Millimetres = THICKNESS_SUGGESTION_LIMIT_MM,
): readonly ThicknessSuggestion[]
```

Lặp qua `walls`, gọi `nearestStandardThickness` cho từng tường, bỏ qua tường không có gợi ý
(`suggestedMm === null`). **Không bao giờ ghi vào tường** — đây là lời hứa bằng lời trong
docblock `cleanup.ts:620-627` ("Nothing here writes to a wall") và bằng cấu trúc: hàm trả về
mảng suggestion độc lập, không đụng tới `walls` truyền vào.

### `ThicknessSuggestion` — `cleanup.ts:104-112`

```ts
interface ThicknessSuggestion {
  readonly wallId: WallId;
  readonly currentMm: Millimetres;
  readonly suggestedMm: Millimetres;
  readonly differenceMm: Millimetres;   // luôn dương — cleanup.ts:641
  readonly message: string;             // câu tiếng Việt sẵn — cleanup.ts:647-649
}
```

`message` đã ghép sẵn kiểu: `"Có thể đưa độ dày tường ${wall.id} từ ${formatLength(...)} về
chuẩn ${formatLength(...)}, lệch ${formatLength(...)}."` — dùng `formatLength` NỘI BỘ của
`cleanup.ts` (`cleanup.ts:194-199`, dấu phẩy thập phân, khác `@/lib/format/measure`, xem mục 3).

### `CleanupResult` — `cleanup.ts:115-120`

```ts
interface CleanupResult {
  readonly walls: readonly Wall[];
  readonly log: readonly CleanupChange[];
  readonly thicknessSuggestions: readonly ThicknessSuggestion[];  // không áp cho `walls`
}
```

### `cleanupWalls` — `cleanup.ts:671-718`

```ts
function cleanupWalls(walls: readonly Wall[], options: CleanupOptions = {}): CleanupResult
```

Chạy 4 bước dọn hình học (xoá sliver, hàn khe hở, nắn trục, gộp chồng lấn) tới điểm cố định,
rồi trả `thicknessSuggestions: suggestStandardThickness(current)` ở nhánh thành công
(`cleanup.ts:702-707`). **Không đổi `thicknessMm` của bất kỳ tường nào** — 4 bước chỉ sửa
`centreline`, không chạm `thicknessMm` (đọc toàn bộ thân 4 hàm `removeSlivers`/`weldGaps`/
`straightenWalls`/`mergeOverlaps`, không có bước nào gán `thicknessMm`).

### Cách gọi M-05 dễ nhất — tiền lệ đã có trong `src/lib`

`src/lib/commands/business/wallCommands.ts:477` (lệnh `wall.changeThickness`) đã gọi M-05
kiểu này:

```ts
const standardMm = nearestStandardThickness(millimetres(input.thicknessMm));
```

Tức là: **không cần dựng cả object `Wall` của module cleanup** để lấy gợi ý — chỉ cần bọc số
mm thô bằng `millimetres()` (từ `@/domain/units/types`, `types.ts:84`) rồi gọi
`nearestStandardThickness` cho từng tường của màn. Muốn dùng thẳng `suggestStandardThickness(walls)`
thì `walls` phải đúng hình dạng `Wall` của `src/domain/walls/types.ts:61-70` (`centreline:
WallCentreline` với `PointMm` gắn nhãn, `thicknessMm: Millimetres` gắn nhãn, cộng `kind`,
`baseElevationMm`, `topElevationMm`) — **khác hình dạng** `Wall` của `src/domain/spatial/types.ts`
mà màn QC dùng thật (xem mục 2), nên phải tự ánh xạ từng trường nếu muốn gọi hàm nhận mảng.
Gọi `nearestStandardThickness` từng tường một là đường ít ma sát hơn và đã có tiền lệ thật.

---

## 2. Kiểu Wall dùng thật ở màn QC

Có **BA** kiểu `Wall` khác nhau trong repo, không phải hai:

| # | Nơi khai | `id` | `thicknessMm`/`thickness_mm` | Dùng ở đâu |
|---|---|---|---|---|
| 1 | `src/domain/spatial/types.ts:123-132` (`Wall`) | `WallId` (`spatial/types.ts:71`) | `thicknessMm: Millimetres` — **`Millimetres = number` KHÔNG gắn nhãn** (`spatial/types.ts:16`) | **Đồ thị thật của app** — `wallCommands.ts:39` import `Wall as GraphWall` từ đây; `toWallViewModel` (`toViewModel.ts:50,312`) nhận đúng kiểu này |
| 2 | `src/domain/walls/types.ts:61-70` (`Wall`) | `WallId` (import lại từ `../spatial/types`) | `thicknessMm: Millimetres` — **gắn nhãn** `Quantity<'mm'>` (`domain/units/types.ts:34`) | Chỉ nội bộ `src/domain/walls/**` (cleanup.ts, edit.ts, joints.ts) — kiểu hình học dùng để dọn tường, khác mảng dữ liệu treo trên đồ thị |
| 3 | `src/types/spatial.ts:16-20` (`Wall`) | `id: string` trần | `thickness_mm: WallThickness` = `110 \| 220 \| 330 \| 'CONCRETE_COLUMN'` (`spatial.ts:14`) | Định dạng JSON "phẳng" cũ (tham chiếu điểm bằng id chuỗi `from`/`to`), dùng ở `materialMap.wallStrokeToken` (tham số) và story `CanvasIntegration.stories.tsx:91` |

**Trả lời dứt khoát:** màn QC (S-12 `WallLayerReview`, tiền lệ trực tiếp) dùng kiểu **#1**
— `src/domain/spatial/types.ts`. Bằng chứng, không suy luận:

- `WallLayerReview/types.ts:112` — `import type { Confidence, Point, WallId } from
  '@/domain/spatial/types';`
- `WallLayerReview/types.ts:44-54` — chính file này giải thích: *"`Wall.thicknessMm`,
  `Point.x/y` của đồ thị đều là `number` trần... gắn nhãn ở đây chỉ thêm một lượt ép kiểu
  không đổi được gì, vì nguồn dữ liệu vốn đã trần."*
- `wallCommands.ts:39,45,46,477` — tầng lệnh nghiệp vụ (nơi ghi thật vào đồ thị) đọc
  `Wall` kiểu #1, và khi cần gọi M-05 thì **bọc số bằng `millimetres()` tại chỗ gọi**
  chứ không đổi kiểu `Wall` toàn cục — xem mục 1.

**S-18 nên theo đúng tiền lệ này:** hook dùng `Wall`/`WallId` từ `@/domain/spatial/types`
(`thicknessMm: number` trần), và khi cần gọi `nearestStandardThickness`/`suggestStandardThickness`
của M-05 thì bọc từng số bằng `millimetres()` như `wallCommands.ts:477` đã làm — **không**
dùng `Wall` của `src/domain/walls/types.ts` (kiểu #2) làm kiểu chính của màn, và **không**
dùng `src/types/spatial.ts` (kiểu #3, định dạng JSON cũ không còn khớp đồ thị hiện tại).

### `WallId`, `Millimetres`, `millimetres()`

- `WallId` — `src/domain/spatial/types.ts:71` — `type WallId = \`W-${string}\`;`
- `Millimetres` (đồ thị, KHÔNG gắn nhãn) — `src/domain/spatial/types.ts:16` —
  `type Millimetres = number;` — đây là kiểu `Wall.thicknessMm` của màn QC dùng thật.
- `Millimetres` (gắn nhãn, `Quantity<'mm'>`) — `src/domain/units/types.ts:34` — dùng bởi
  M-05 (`cleanup.ts`) và mọi hàm hình học trong `src/domain/walls/**`, `src/domain/units/**`.
- `millimetres(value: number): Millimetres` (gắn nhãn) — `src/domain/units/types.ts:84-87` —
  hàm DUY NHẤT được phép biến `number` trần thành `Millimetres` gắn nhãn; ném `RangeError`
  nếu `value` không hữu hạn (`assertFinite`, `types.ts:77-81`). Đây là hàm hook S-18 sẽ gọi
  tại ranh giới, mỗi khi đưa `wall.thicknessMm` (trần) sang cho `nearestStandardThickness`
  (đòi gắn nhãn) — đúng như `wallCommands.ts:477` đã làm.

---

## 3. P-01 định dạng số — `src/lib/format/**`

### `src/lib/format/number.ts` — tầng thấp nhất

- `formatNumber(value: MaybeNumber, options?: NumberFormatOptions): string` — `number.ts:201`
  — notation `vi-VN`, dấu chấm nhóm nghìn + dấu phẩy thập phân. `MISSING_VALUE = '—'`
  (`number.ts:33`) cho `null`/`undefined`/`NaN`/`±Infinity`.
- `formatPercent(value, options?)` — `number.ts:225` — `0.125` → `"12,5%"` (mặc định
  `source: 'ratio'`).
- `parseNumber(text: string): number | undefined` — `number.ts:255` — chiều ngược, đọc
  `"4.250,50"` → `4250.5`.

### `src/lib/format/measure.ts` — viết theo đơn vị bản vẽ

- `formatLength(valueMm: MaybeNumber, options?: LengthFormatOptions): string` — `measure.ts:108`
  — **đây là hàm cho ô "độ dày đo được".** Mặc định tự chọn đơn vị theo độ lớn (< 1000 mm
  thì "mm", ≥ 1000 mm thì "m", `measure.ts:86-88`), và mặc định **0 chữ số thập phân** ở
  đơn vị mm (`MILLIMETRE_FRACTION_DIGITS = 0`, `measure.ts:40`). Muốn "một chữ số thập phân,
  chữ đều" như spec S-18 xin thì gọi:

  ```ts
  formatLength(thicknessMm, { unit: 'mm', fractionDigits: 1 })
  // ví dụ: formatLength(195, { unit: 'mm', fractionDigits: 1 }) === '195,0 mm'
  ```

  Ép `unit: 'mm'` để cột không tự nhảy sang "m" (độ dày tường luôn < 1000 mm nên thực ra
  không cần ép, nhưng ép cho chắc và cho rõ ý ở chỗ gọi). "Chữ đều" (căn số thẳng cột) là
  việc của CSS, không phải hàm định dạng — tiền lệ đã có ở màn anh em S-12:
  `src/screens/qc/WallLayerReview/WallLayerLeftPanel.tsx:281` dùng className
  `"font-mono font-semibold tabular-nums"`.

- **"Sai lệch" (`differenceMm` của `ThicknessSuggestion`):** không có hàm định dạng riêng
  cho "sai lệch" — vẫn là `formatLength`, gọi trên `differenceMm`:
  `formatLength(differenceMm, { unit: 'mm' })` (hoặc kèm `fractionDigits: 1` nếu cột cũng
  cần chữ đều). Không nhầm với `LengthDeviation`/`compareLengthToMeasured` của
  `src/domain/units/compare.ts:127-163` — cái đó là độ lệch TƯƠNG ĐỐI (phần trăm) giữa số đọc
  trên dimension string và số đo hình học, một khái niệm khác, **không dùng cho cột "sai
  lệch độ dày" của S-18**.

- `formatArea`, `formatAngle`, `formatScaleDensity`, `formatDrawingScaleRatio` — không liên
  quan trực tiếp tới độ dày tường, liệt kê cho đủ: `measure.ts:131,151,178,209`.

### `src/lib/format/semantic.ts` — câu và nhãn dựng trên hai file trên

- `describeConfidence(value: MaybeNumber): ConfidenceDescription` — `semantic.ts:73` — trả
  `{ level, label }`, xem mục 7.
- `confidenceLevel(value: MaybeNumber): ConfidenceLevel` — `semantic.ts:79` — chỉ trả level,
  không kèm nhãn; đây là hàm `materialMap.isLowConfidence` gọi (`materialMap.ts:145`).
- `formatChange(entry: ChangeEntry): string` — `semantic.ts:248` — câu diff kiểu "Tường
  W-014 dày 200 mm → 220 mm", dùng `FIELD_DESCRIPTORS['thickness_mm']` (`semantic.ts:159`,
  phrase "dày", quantity `'lengthMm'`) — có thể tham khảo cho câu hoạt động/log của S-18
  nhưng đây là hàm cho DIFF LỊCH SỬ, không phải cho ô độ dày của bảng chính.

**Nhắc A15:** cả ba file trên đều nằm ở `src/lib/format/**`, tức tầng dưới hook — gọi chúng
TRONG HOOK (`useThicknessStandardization.ts` hay tên tương đương của T5), không gọi trong
view. View chỉ nhận chuỗi đã format sẵn qua props.

---

## 4. P-03 viewmodel — `src/lib/viewmodel/**`

- `toWallViewModel(wall: Wall): ViewModel` — `toViewModel.ts:312-327` — `wall` ở đây là
  `Wall` từ `@/domain/spatial/types` (import dòng `toViewModel.ts` ở đầu file, cùng nguồn
  với `types.ts:50`). Trả về **một thẻ chung cho MỘT tường** (`id`, `label`, `secondaryLine`,
  `attributes[]`, `statusCode`, `iconCode`) — hình dạng dùng chung cho tường/ô mở/phòng/vi
  phạm, KHÔNG phải hình dạng theo cột như `WallRowViewModel` của S-12
  (`WallLayerReview/types.ts:217-238`). `attributes` của một tường gồm 5 mục cố định
  (`toViewModel.ts:317-323`): Bề dày, Chiều dài, Chiều cao, Ô mở, Độ tin cậy — thứ tự và tên
  nhãn KHÔNG có mục nào là "độ lệch so với chuẩn", vì `toWallViewModel` không biết gì về M-05.
- `VIEW_STATUS_CODES = ['verified', 'attention', 'violation', 'neutral'] as const` —
  `viewmodel/types.ts:65` — bốn mã, đúng A4. `reviewStatus` (hàm nội bộ quyết định mã này
  cho một tường, `toViewModel.ts:215-221`) chỉ trả `'verified'` khi `review.reviewed === true`
  — đúng A5, AI không bao giờ tự đặt được mã này.

**Nhóm theo độ dày: KHÔNG có hàm nào.** Đã tìm trong `src/lib/viewmodel/**`, `src/domain/**`,
toàn bộ `src/lib/**` với từ khoá `groupBy`/`byThickness`/`thicknessGroup`/`groupWalls` — không
có kết quả nào liên quan (bốn nơi khớp từ khoá `groupBy` là `three/build/merge.ts`,
`export/exportPdf.ts`, `domain/walls/joints.ts`, `domain/rules/geometry/index.ts`, không cái
nào nhóm tường theo độ dày). **Ghi NOT FOUND chính thức**: T5 phải tự nhóm 48 dòng theo độ
dày TRONG HOOK, bằng `Array.prototype.reduce`/`Map` thường — đây là việc GHÉP DỮ LIỆU
(gom danh sách theo khoá), không phải công thức hình học, nên được phép theo R-61 (hook chỉ
nối lại logic đã có + phép ghép dữ liệu thường).

---

## 5. P-06 dải biểu đồ — tô xám tường ở độ mờ thấp, không vi phạm ranh giới import

**Hàm đúng: `wallStrokeToken`, KHÔNG viết `var(--wall-220)` trực tiếp trong view mới —
nhưng cả hai đều lint sạch, khác nhau ở quy ước.**

- `wallStrokeToken(thickness: WallThickness): string` — `src/components/canvas/materialMap.ts:21-34`
  — trả `'var(--wall-110)'` / `'var(--wall-220)'` / `'var(--wall-330)'` /
  `'var(--text-primary)'` (BTCT) / `'var(--wall-idle)'` (mặc định).
  `materialMap.ts:1-8` tự đặt luật: *"NGUỒN THẬT DUY NHẤT cho màu sắc canvas... Cấm gọi
  `color=` tự do ngoài file này."* — đây là quy ước của module, không phải luật ESLint riêng,
  nhưng mọi noi đã dùng màu tường trong repo đều theo nó (xem danh sách bên dưới).
- Đã kiểm `eslint-rules/no-raw-color.js:16` (regex `#hex`/`rgb(`/`hsl(`) — chuỗi
  `var(--wall-220)` **không khớp regex này**, nên viết thẳng `var(--wall-220)` trong style
  KHÔNG bị `local/no-raw-color` chặn. Nhưng viết thẳng phá quy ước "một nguồn màu duy nhất"
  của `materialMap.ts`, nên vẫn nên gọi `wallStrokeToken(...)`.
- Cách ghép với độ mờ thấp: **`opacity` là số CSS riêng, tách khỏi màu, không phải phần của
  token.** Tiền lệ y hệt spec S-18 xin, đã chạy trong S-12:
  `src/screens/qc/WallLayerReview/WallLayerList.tsx:161-170` —
  ```tsx
  style={{
    backgroundImage: 'repeating-linear-gradient(45deg, var(--state-attention) 0, ...)',
    opacity: 0.06,
  }}
  ```
  và `WallLayerList.tsx:179` — `style={{ backgroundColor: wallStrokeToken(row.thicknessMm as
  WallThickness) }}`. Với dải P-06 (nền phẳng, không phải hatch), khuôn tương ứng là:
  ```tsx
  style={{ backgroundColor: wallStrokeToken(band), opacity: 0.08 }}
  ```
  Viết `opacity: 0.08` là một literal số, không phải màu và không phải `toFixed`/quy đổi đơn
  vị, nên không đụng `local/no-raw-color` lẫn `local/no-raw-number` — đúng như
  `WallLayerList.tsx:168` đã làm với `0.06` mà không bị lint chặn.

**Ranh giới import — đã kiểm bằng cách đọc chính rule, không suy luận từ comment:**
`eslint-rules/no-data-layer-in-view.js:52` khai `DATA_LAYERS = ['src/api', 'src/store',
'src/domain', 'src/lib/http']` — CHỈ bốn tầng này bị chặn trong file view (`.tsx` trực tiếp
trong `src/screens/**`, loại trừ `.container/.test/.stories`, xem `no-data-layer-in-view.js:43-49,126-129`).
`src/components/**` **không nằm trong danh sách này** → view của S-18 import
`wallStrokeToken` từ `@/components/canvas/materialMap` là hợp lệ. Bản thân `materialMap.ts`
chỉ import `@/lib/format/semantic`, `@/lib/format/number` (type `MaybeNumber`), và
`../../types/spatial` (type `WallThickness`, `materialMap.ts:13`) — không import gì từ bốn
tầng cấm, nên chuỗi import bắc cầu cũng sạch.

**Kết luận cho T6/T7:** gọi `wallStrokeToken(...)` từ `@/components/canvas/materialMap`, để
`opacity` là prop CSS riêng (0.08 theo spec, hoặc token nếu sau này có), KHÔNG viết `var(--wall-*)`
tay trong file view mới của S-18.

---

## 6. Token cho nháy hàng — thay `#EEF4EF`

**`var(--bg-flash)`** — đúng token, đúng nghĩa, và đúng luôn cả giá trị hex spec xin.

- `src/styles/globals.css:178` (chủ đề sáng) — `--bg-flash: #eef4ef;` — **khớp chính xác**
  `#EEF4EF` mà spec S-18 xin (chỉ khác hoa/thường trong hex, cùng một màu).
- `src/styles/globals.css:118` (chủ đề tối) — `--bg-flash: #1f2b23;`.
- Khai trong Tailwind: `tailwind.config.ts:40` — `colors.bg.flash = 'var(--bg-flash)'` →
  dùng qua className `bg-bg-flash`.
- **Vì sao không dùng `--state-verified-tint`** dù giá trị hex trùng y hệt ở cả hai chủ đề
  (`globals.css:167` sáng = `#eef4ef`, `globals.css:107` tối = `#1f2b23`, cùng số với
  `--bg-flash`): tên `state-verified-*` mang nghĩa A5 ("xanh đã xác minh chỉ đánh dấu việc
  người duyệt", `CLAUDE.md` mục A5). Nháy hàng của S-18 là phản hồi "vừa áp dụng/vừa hoàn
  tác một thay đổi độ dày", không phải "tường này đã được duyệt" — dùng nhầm token verified
  cho một nháy KHÔNG liên quan tới duyệt sẽ đọc sai ý định dù màu giống hệt. `--bg-flash` là
  token trung lập, đã có sẵn đúng cho việc này.
- **Tiền lệ dùng thật, không phải suy đoán:** `src/components/ui/Table.tsx:75,87` — prop
  `isFlash?: boolean` của `Table.Row`, áp `'bg-bg-flash hover:bg-bg-flash'` khi `true`. Đây
  là **đúng cơ chế nháy một dòng bảng** mà P-06/S-18 cần, đã có component lõi hỗ trợ sẵn — T6/T7
  không cần tự viết className, chỉ cần truyền `isFlash` cho `Table.Row` đã dựng (KHÔNG được
  tạo component mới theo CẤM TUYỆT ĐỐI, và đây cũng không cần tạo gì mới).
- Thời lượng nháy: **không phải chuyện của token màu**, nhưng liên quan trực tiếp — xem mục
  X3/X4 đã chốt, `durationMs('slow')` = 340 ms. Tiền lệ y hệt tình huống "nháy hàng sau khi
  đổi": `src/screens/qc/WallLayerReview/useWallLayerReview.ts:980` —
  `setTimeout(() => setFlashingWallId(null), durationMs('slow'))`, và hook dùng chung
  `src/hooks/useCommitFlash.ts:18` cũng tắt nháy sau `durationMs('slow')`. Khuôn cho T5:
  set một `flashedWallId`/`flashedGroupKey` state, tắt bằng `setTimeout(..., durationMs('slow'))`,
  dọn `clearTimeout` khi unmount — đúng khuôn `useCommitFlash.ts:13-22`.

---

## 7. `confidenceLevel` / độ tin cậy — `src/lib/format/semantic.ts`

- `CONFIDENCE_CERTAIN_THRESHOLD = 0.9` — `semantic.ts:40`.
- `CONFIDENCE_SUGGESTED_THRESHOLD = 0.7` — `semantic.ts:41`.
- Ba mức + nhãn (`CONFIDENCE_LABELS`, `semantic.ts:50-55`):

  | Điều kiện (thang 0–1) | `level` | Nhãn tiếng Việt |
  |---|---|---|
  | `value >= 0.9` | `'certain'` | "AI chắc chắn" |
  | `0.7 <= value < 0.9` | `'suggested'` | "AI đề xuất" |
  | `value < 0.7` (nhưng đọc được) | `'needsReview'` | "Cần kiểm tra" |
  | không đọc được (`null`/`undefined`/`NaN`/`±Infinity`) | `'unknown'` | `"—"` (= `MISSING_VALUE`) |

- Hàm dùng cho cột "độ tin cậy" của bảng 48 dòng: `describeConfidence(value): { level, label }`
  (`semantic.ts:73-76`) nếu cột cần cả level (để chọn token) lẫn nhãn hiển thị cùng lúc; hoặc
  `confidenceLevel(value): ConfidenceLevel` (`semantic.ts:79-90`) nếu chỉ cần level để chọn
  token/gạch chéo (như `materialMap.isLowConfidence`, `materialMap.ts:144-146`, đã dùng đúng
  `confidenceLevel` chứ không tự đặt ngưỡng — xem comment `materialMap.ts:134-138` kể lại lỗi
  cũ khi tự đặt 0,75 riêng).
- **Không có điểm số nào là `'verified'`** — nhắc lại đúng A5, và `semantic.ts:14-16` tự nói:
  *"no level here is called 'verified'"*.

---

## 8. P-04 trạng thái màn — `src/lib/testing/expectSevenStates.ts` + `sevenStateScenarios.ts`

### Bảy trạng thái, tên chính xác — `sevenStateScenarios.ts:26-34`

```ts
const SEVEN_STATES = ['empty', 'loading', 'partial', 'error', 'success', 'forbidden', 'collapsed'] as const;
```

Nhãn tiếng Việt (`SEVEN_STATE_LABELS`, `sevenStateScenarios.ts:40-48`): rỗng / đang tải /
một phần / lỗi / thành công / không có quyền / thu gọn. **Đúng thứ tự này**, không phải
`'done'` — nhắc lại tiền lệ `WallLayerReview/types.ts:26-28` đã chọn `'success'`.

### Hình dạng kịch bản — `SevenStateScenario`, `sevenStateScenarios.ts:62-76`

```ts
interface SevenStateScenario {
  readonly state: SevenState;
  readonly label: string;
  readonly rows: readonly SevenStateRow[];   // { id: string; label: string }
  readonly totalCount: number;
  readonly isLoading: boolean;
  readonly isCollapsed: boolean;
  readonly canView: boolean;   // false CHỈ ở 'forbidden'
  readonly error: unknown;     // khác null CHỈ ở 'error'
}
```

Dựng bằng `createSevenStateScenarios(options?: SevenStateScenarioOptions):
readonly SevenStateScenario[]` (`sevenStateScenarios.ts:127-183`) — mặc định 48 dòng
(`SAMPLE_TOTAL_COUNT`, `sevenStateScenarios.ts:79`, đúng bộ mẫu chuẩn A14), 14 dòng ở trạng
thái `partial` (`SAMPLE_PARTIAL_COUNT`, `sevenStateScenarios.ts:82`). Có `options.overrides`
theo từng state và `options.createRow` để đổi hình dạng dòng cho khớp `WallRowViewModel` của
S-18 — cách dùng y hệt cảnh báo đầu file `sevenStateScenarios.ts:12-15`: *"A screen with a
different shape overrides the fields it cares about"*.

### Bốn chữ ký còn lại

- `expectSevenStates(renderScreen: ScreenRenderer, scenarios: readonly SevenStateScenario[]): void`
  — `expectSevenStates.ts:122-125`. `ScreenRenderer = (scenario: SevenStateScenario) =>
  ScreenRenderResult` (`expectSevenStates.ts:46`), `ScreenRenderResult = { container:
  HTMLElement; unmount?: () => void }` (`expectSevenStates.ts:38-43`). Ném lỗi tiếng Việt khi
  thiếu/lặp trạng thái, khi render ném lỗi, hoặc khi màn ra trắng.
- `expectAccessible(subject: TestSubject, options?: AccessibilityOptions): void` —
  `expectAccessible.ts:960-963`.
- `expectVietnamese(subject: TestSubject, options?: VietnameseOptions): void` —
  `expectVietnamese.ts:714`.
- `renderWithProviders(ui: RenderableUi, options?: RenderWithProvidersOptions):
  ProvidedRenderResult` — `render.tsx:232-235` — bọc sẵn `QueryClientProvider` + store reset +
  translator tiếng Việt; `unmount` cũng dọn query cache.
- `installFakeClock(options?: FakeClockOptions): FakeClock` — `fakeClock.ts:82-103` — và bản
  tự dọn `withFakeClock<T>(body, options?): Promise<T>` — `fakeClock.ts:116-127`. `FakeClock`
  có `now`, `epochMs`, `advance(durationMs): Promise<void>`, `runAllTimers`,
  `flushMicrotasks(turns?)`, `restore` (`fakeClock.ts:43-59`). Mốc giờ mặc định
  `FAKE_CLOCK_START = new Date('2026-08-17T14:32:00+07:00')` (`fakeClock.ts:34`) — dùng
  `clock.advance(340)` (đúng `durationMs('slow')`) để test tắt nháy hàng của mục 6.

---

## 9. Bản kê NOT FOUND — mọi giả định của spec S-18 không thấy trong mã

1. **220 mm là kết quả làm tròn của 195 mm theo M-05** — SAI, đã chốt ở X1. M-05 cho ra
   **200 mm** (`nearestStandardThickness`, `cleanup.ts:599-618`, với `STANDARD_THICKNESSES_MM`
   = `cleanup.ts:70`). 220 chỉ đúng nếu đối chiếu với `WALL_THICKNESS_CHOICES` của S-12
   (`WallLayerReview/types.ts:168`), một bộ nhóm KHÁC.
2. **Nháy màu `#EEF4EF`** — không tồn tại làm mã màu thô hợp lệ ở tầng giao diện (vi phạm A1
   + `local/no-raw-color`). Đã tìm ra token đúng nghĩa và đúng giá trị:
   `var(--bg-flash)` (mục 6) — coi đây là NOT FOUND-nhưng-đã-giải, không phải NOT FOUND treo.
3. **Chuyển động 240 ms / 400 ms** — không tồn tại trong `MOTION_DURATIONS_MS`
   (`src/lib/motion/tokens.ts:62-67`, chỉ có 120/180/260/340). Đã thay bằng `standard` (260)
   và `slow` (340) theo X3/X4 đã chốt.
4. **Hàm nhóm tường theo độ dày (bất kỳ tên nào: `groupByThickness`, `groupWalls`,...)** —
   không có trong `src/lib/viewmodel/**`, `src/domain/**`, hay bất kỳ đâu trong `src/lib/**`
   (đã grep toàn repo, mục 4). T5 tự nhóm trong hook.
5. **Lệnh nghiệp vụ áp một `ThicknessSuggestion` hàng loạt / áp gợi ý chuẩn hoá** — không có
   lệnh nào tên kiểu `wall.applyStandardThickness` hay `wall.standardize*` trong
   `src/lib/commands/business/wallCommands.ts` (chỉ có bảy lệnh: `draw`, `dragEnd`,
   `changeThickness`, `changeKind`, `split`, `merge`, `remove` — đúng bảy tên
   `WALL_COMMAND_TYPES` mà `WallLayerReview/types.ts:81-82` đã ghi nhận cho S-12, kiểm tra
   lại thấy vẫn đúng cho S-18). Muốn "áp" một gợi ý chuẩn hoá thì phải gọi
   `createChangeWallThicknessCommand({ wallId, thicknessMm: suggestedMm }, context)` — lệnh
   ĐÃ CÓ (`wallCommands.ts:461-486`) — **từng tường một**, không có phiên bản hàng loạt.
   **Nếu T5 cần áp hàng loạt "đồng ý tất cả gợi ý"**, đây là chỗ THIẾU LỆNH thật — dừng và
   hỏi điều phối viên trước khi tự chế vòng lặp gọi lệnh 48 lần trong một hành động không
   chia nhỏ (CẤM TUYỆT ĐỐI "không tách thành nhiều bước hoàn tác" có thể mâu thuẫn với việc
   gọi lệnh đơn lẻ 48 lần — cần quyết định kiến trúc, không phải việc T2 tự đoán).

### Phát hiện thêm — NGOÀI hợp đồng đã xác minh, T5 cần biết để khỏi tìm lại

**`standardizeThickness` — `src/lib/geometry/standardize.ts:17-34`** — một hàm chuẩn hoá độ
dày THỨ BA, khác cả M-05 lẫn `WALL_THICKNESS_CHOICES` của S-12, chưa nơi nào trong spec S-18
hay hợp đồng X1/X2 nhắc tới:

```ts
function standardizeThickness(rawThicknessMm: number): StandardizeResult
// StandardizeResult = { original_mm: number; standardized: WallThickness }
```

Ngưỡng cố định (`standardize.ts:20-28`, có test khoá lại từng biên ở
`standardize.test.ts:5-29`): `< 165` → `110`; `165 ≤ x < 275` → `220`; `275 ≤ x ≤ 350` → `330`;
`> 350` → `'CONCRETE_COLUMN'`. Đây là hàm DUY NHẤT trong repo tự tính ra được nhãn
`'CONCRETE_COLUMN'` từ một số đo thô — đúng thứ X2 nói "chưa có đường biểu diễn" ở tầng
`src/domain`, nhưng **đã có** ở tầng `src/lib/geometry` (không phải `src/domain`, nên không
vi phạm "cột thứ tư chưa có lệnh áp" — đây chỉ là PHÂN LOẠI/GỢI Ý HIỂN THỊ, không ghi vào
đâu cả, giống hệt tinh thần `suggestStandardThickness` của M-05).

**Không có nơi nào khác gọi hàm này** (đã grep toàn repo — chỉ chính nó và file test của nó).
Đây là mã kiểu "đã viết xong, đúng theo kế hoạch, chưa màn nào cắm vào" — cùng tính chất với
`src/lib/query`/`src/lib/mutations` mà `CLAUDE.md` mục "Trạng thái hiện tại" đã cảnh báo
("không phải mã chết").

**T2 CHỈ ghi lại phát hiện này, không quyết dùng hay không dùng** — việc này đụng trực tiếp
tới X1/X2 (bộ nhóm nào là "chuẩn" cho màn S-18, và cột BTCT lấy nhãn từ đâu), nên nằm ngoài
phạm vi "khảo sát, ghi một file" của T2. **T5 nên hỏi điều phối viên** trước khi quyết có dùng
`standardizeThickness` cho cột BTCT hay không, vì nó cho ra một bộ ngưỡng (165/275/350) khác
cả `THICKNESS_SUGGESTION_LIMIT_MM` (±15 mm quanh 6 mốc của M-05) lẫn ranh giới ngầm giữa ba
mốc `WALL_THICKNESS_CHOICES` (110/220/330, không có ngưỡng số tường minh, chỉ là ba lựa chọn
rời rạc của điều khiển). Dùng cả ba nguồn ngưỡng khác nhau trong cùng một màn mà không có
quyết định rõ ràng sẽ cho ba con số "chuẩn hoá" khác nhau cho cùng một tường.
