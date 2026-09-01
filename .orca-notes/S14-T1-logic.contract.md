# S14-T1 — Hợp đồng tầng logic cho "Đọc kích thước OCR" (DimensionOcrReview)

> Người viết file này KHÔNG viết mã màn. Mọi chữ ký dưới đây được dán **nguyên
> văn** từ mã đã mở, kèm `đường-dẫn:dòng`. Không có mục nào được viết mà chưa mở
> file nguồn tương ứng.

---

## ⚠️ KẾT LUẬN NHANH — đọc trước khi làm bất cứ gì khác

1. **Mục C (độ lệch M-02) — NOT FOUND.** Quét toàn bộ `src/domain` và `src/lib`,
   không có hàm nào nhận hai `Millimetres` (hay hai `number` thuần) và trả về độ
   lệch tương đối. Hai hàm điều phối viên tìm thấy (`compareLevelScales`,
   `compareScaleToAiEstimate`) đều nhận `MillimetresPerPixel`, một brand khác
   `Millimetres` — TypeScript sẽ chặn việc truyền thẳng `dimension.valueMm` vào
   đó mà không ép kiểu. Xem "BLOCKER" ngay dưới mục C.
2. **⚠️ KHÔNG hỏi được điều phối viên.** Đặc tả bắt buộc `orca orchestration ask`
   khi mục C ra NOT FOUND. Đã thử — cả hai cặp `--dispatch-capability` cấp cho
   phiên này đều báo **"capability is revoked"** cho `heartbeat`, và lệnh `ask`
   báo thẳng **`"ask requires an active supervised Dispatch"`**. Không có Dispatch
   nào đang sống để hỏi. Mục C dưới đây có **khuyến nghị của worker (Phương án
   A)** dựa trên tiền lệ của chính repo, nhưng đó **KHÔNG PHẢI quyết định đã
   duyệt** — lớp sau (T-workers) phải coi mục C là **CHƯA CHỐT** và xin xác nhận
   qua kênh nào đó trước khi dựng lệnh dựa vào nó.
3. **Mục D — KHÔNG có lệnh `dimension.*`.** Xác nhận đúng như điều phối viên
   tin: `grep` toàn `src` ra 0 kết quả. Khuôn dựng bằng `createCommand` +
   `changeForUpdate` (giống ba lệnh `opening.*` mà `objectLayerReviewGateway.ts`
   đã tự dựng) là đường đúng, dán sẵn ở mục D.4.
4. **Mục L (giá trị vô lý) — NOT FOUND.** Không có hàm nào phán "một số đọc
   OCR đơn lẻ là vô lý" (kiểu "phòng dài 30 m"). Gần nhất là cặp
   `classifyScaleRange` + `inferWallThicknessFromScale` (`scale.ts`) — đây là
   MẪU HÌNH (ngưỡng cứng + hàm phân loại), không phải hàm dùng thẳng được cho
   một chiều dài kích thước.
5. **Mục J — không có endpoint `dimensions`.** `src/api/endpoints.ts` không có
   nhóm `dimensions`. Gần nhất: `ENDPOINTS.spatial.floor(projectId, floorId)`
   trả cả `SpatialGraph` (có `dimensions` bên trong). Không có
   `queryKeys.dimension.*` — `dimension` không nằm trong union `QueryDomain`
   của `queryKeys.ts`. `persistDimensionLayer` sẽ NOT FOUND với ĐÚNG lý do đã
   lặp lại hai lần ở hai màn QC anh em (xem J.3).
6. **🔴 CẢNH BÁO NẶNG NHẤT — ba hằng trùng tên, khác giá trị, khác kiểu:**
   `MIN_WALL_THICKNESS_MM` / `MAX_WALL_THICKNESS_MM` / `MIN_WALL_LENGTH_MM` tồn
   tại ở **ba file khác nhau với ba giá trị khác nhau** (bảng đầy đủ ở mục L.2).
   Import sai file là một lỗi ngưỡng ÂM THẦM — không lỗi biên dịch, không lỗi
   test, chỉ ra số sai.
7. **Cảnh báo A5:** cờ "đã duyệt" của `Dimension` là trường `reviewed: boolean`
   (kế thừa từ `ReviewMetadata`, mục A.1). Không có lệnh `dimension.approve`
   nào tồn tại sẵn để đặt nó — phải tự dựng theo khuôn `buildApproveObjectCommand`
   (mục D.4), và lệnh đó PHẢI đặt kèm `source: 'human'` như bản gốc đã làm.
8. **Cảnh báo tự lưu (E):** repo có **HAI cơ chế autosave song song**.
   `hooks/useAutosave.ts` (cũ, KHÔNG báo trình đọc màn hình) và
   `lib/autosave/createAutosave.ts` + `hooks/useSaveIndicator.ts` (mới, CÓ báo
   qua `announcer.announce`). A7 đòi "nói ra trạng thái đó cho trình đọc màn
   hình" ⇒ **PHẢI dùng cặp `createAutosave` + `useSaveIndicator`**, dù CLAUDE.md
   trích dẫn `useAutosave.ts:6` cho A7 — trích dẫn đó trỏ nhầm implementation.
   Ba màn QC/Settings gần nhất (`WallLayerReview`, `ProjectSettings`,
   `AccountSettings`) đều dùng cặp mới; chỉ `ScaleCalibration` (màn cũ hơn) còn
   dùng `useAutosave.ts`.
9. **Cảnh báo hình học:** `centrelineLength()` (`domain/walls/types.ts`) nhận
   một `Wall` **KHÁC HẲN** `Wall` của đồ thị (`domain/spatial/types.ts`) — hai
   `kind` union khác nhau, hai hình dạng trường khác nhau (mục B.4). Không được
   gọi `centrelineLength(graphWall)` thẳng. Muốn "đo lại từ hình học" của MỘT
   dimension: gọi `measureDistance(dimension.line.start, dimension.line.end)`.
10. **Mục K:** tên hàm dựng cây React thật của repo là **`renderWithProviders`**
    (`src/lib/testing/render.tsx:232`), KHÔNG PHẢI `render` như đặc tả gốc rút
    gọn. `expect*` khác giữ đúng tên như đặc tả.

---

## A. Thực thể kích thước (D-12)

### A.1 — `Dimension`, `src/domain/spatial/types.ts:216-227`

```ts
/** Kind of dimension being annotated. */
export type DimensionKind = 'linear' | 'chain' | 'radial' | 'angular' | 'elevation';

/** A dimension string annotated on the drawing. */
export interface Dimension extends ReviewMetadata {
  id: DimensionId;
  levelId: LevelId;
  kind: DimensionKind;
  /** The entities this dimension measures. */
  referenceIds: readonly EntityId[];
  /** The dimension line, from start point to end point. */
  line: Segment;
  valueMm: Millimetres;
  /** Value the user typed over the automatically measured one. */
  overrideValueMm?: Millimetres;
}
```

`Dimension extends ReviewMetadata` (`types.ts:61-65`):

```ts
export interface ReviewMetadata {
  confidence: Confidence;   // number trong [0,1] — dán nhãn `type Confidence = number` (types.ts:53)
  source: DataSource;       // 'ai' | 'human' (types.ts:50)
  reviewed: boolean;        // ⚠️ ĐÂY LÀ CỜ "ĐÃ DUYỆT" — A5
}
```

- **Cờ "đã duyệt" (A5):** trường `reviewed: boolean`. Repo KHÔNG có lệnh nào sẵn
  đặt `reviewed: true` cho `Dimension` — phải tự dựng, xem mục D.4.
- **`confidence`:** trường `confidence: Confidence` (= `number`, [0,1]). Đi qua
  `confidenceLevel()` / `describeConfidence()` để lấy mức (mục F).
- **`source`:** trường `source: DataSource` = `'ai' | 'human'`. AI KHÔNG BAO GIỜ
  được đặt `reviewed: true` — invariant A5 nói rõ trong docstring của
  `ReviewMetadata` (`types.ts:56-59`): *"`reviewed` may only be set once a user
  has approved the object; AI output must never set the flag on its own."*
- **`line: Segment`** — `Segment = { start: Point; end: Point }`
  (`types.ts:31-34`), `Point = { x: Millimetres; y: Millimetres }`
  (`types.ts:25-28`). Toạ độ ĐÃ ở đơn vị mm thật (không phải pixel) — xem
  docstring đầu file `types.ts:4-8`: *"Every coordinate and geometric size is an
  integer number of millimetres."*
- **`valueMm: Millimetres`** — số OCR đọc được, đây chính là "chuỗi đọc được
  4.800 mm" của đặc tả.
- **`overrideValueMm?: Millimetres`** — giá trị người dùng gõ đè lên. **Optional**
  (`?`), không phải `Millimetres | null`. Kiểm `'overrideValueMm' in dimension`
  hoặc `dimension.overrideValueMm !== undefined`, KHÔNG so sánh `!== null`.
- **`kind: DimensionKind`** = `'linear' | 'chain' | 'radial' | 'angular' |
  'elevation'`. Đặc tả chỉ nói tới chuỗi kích thước tuyến tính/chain; `radial` /
  `angular` / `elevation` tồn tại trong kiểu nhưng màn này không bắt buộc xử lý
  hết — kiểm tra với điều phối viên nếu đặc tả yêu cầu lọc theo `kind`.

**Ví dụ đúng** đọc một dimension đơn giản:

```ts
const readingMm = dimension.overrideValueMm ?? dimension.valueMm;
const isApproved = dimension.reviewed; // KHÔNG phải "confidence >= threshold"
```

### A.2 — Tra kích thước theo tường: `referenceIds` trỏ tới `WallId` thế nào

`referenceIds: readonly EntityId[]` là **generic entity ids**, KHÔNG hẹp riêng
`WallId` — một chuỗi kích thước có thể trỏ tới tường, trục, hay lỗ mở tuỳ
`kind`. KHÔNG có trường `wallIds` riêng.

**KHÔNG có hàm lọc sẵn tên `wallsOfDimension` hay tương tự — NOT FOUND.** Phải
tự ghép hai hàm nguyên thuỷ đã có, đúng khuôn `openingsOfWall` /
`wallsOnLevel` của `src/lib/commands/business/shared.ts:169-174`:

```ts
// business/shared.ts:169-174 — khuôn có sẵn cho MỘT kind cụ thể
export const openingsOfWall = (graph: NormalizedSpatial, wallId: WallId): readonly GraphOpening[] =>
  entitiesOfKind(graph, 'opening').filter((opening) => opening.wallId === wallId);

export const wallsOnLevel = (graph: NormalizedSpatial, levelId: LevelId): readonly GraphWall[] =>
  entitiesOfKind(graph, 'wall').filter((wall) => wall.levelId === levelId);
```

Ghép được cho `dimension` — CHÉP đúng mẫu này (R-61 cho phép, vì `entitiesOfKind`
và `readOf` là nguyên thuỷ có sẵn, không phải công thức mới):

```ts
import { isIdOfKind } from '@/domain/spatial/ids';         // ids.ts:108
import { entitiesOfKind, readOf } from '@/lib/commands/business/shared'; // shared.ts:135-160

/** Tường mà một dimension trỏ tới, đúng thứ tự referenceIds, bỏ id không phải tường. */
const wallsReferencedBy = (graph: NormalizedSpatial, dimension: Dimension): readonly GraphWall[] =>
  dimension.referenceIds
    .filter((id): id is WallId => isIdOfKind('wall', id))
    .map((id) => readOf(graph, 'wall', id))
    .filter((wall): wall is GraphWall => wall !== null);

/** Mọi dimension của MỘT tầng — cùng khuôn `wallsOnLevel`. */
const dimensionsOnLevel = (graph: NormalizedSpatial, levelId: LevelId): readonly Dimension[] =>
  entitiesOfKind(graph, 'dimension').filter((dimension) => dimension.levelId === levelId);
```

`entitiesOfKind<K extends EntityKind>(graph, kind): readonly EntityByKind[K][]`
(`shared.ts:135-150`) đã GENERIC theo `EntityKind`, và `'dimension'` là một
`EntityKind` hợp lệ (`ids.ts:15-23`, `normalize.ts:35-43`) — gọi
`entitiesOfKind(graph, 'dimension')` chạy được ngay, không cần viết thêm gì ở
tầng domain.

`readOf<K extends EntityKind>(graph, kind, id): EntityByKind[K] | null`
(`shared.ts:156-160`) — bọc `readEntity` của `domain/spatial/applyPatch.ts`.

### A.3 — `NormalizedSpatial` chứa `dimensions` ở đâu

**KHÔNG có trường `dimensions` trực tiếp trên `NormalizedSpatial`.** Đây là
điểm dễ nhầm nhất: `SpatialGraph` (dạng lồng, thô, `types.ts:245-255`) CÓ
`dimensions: readonly Dimension[]`, nhưng `NormalizedSpatial` (dạng phẳng,
`normalize.ts:49-55`) thì KHÔNG:

```ts
// normalize.ts:49-55 — hình dạng THẬT của NormalizedSpatial
export interface NormalizedSpatial {
  building: Building;
  byId: Readonly<Record<string, SpatialEntity>>;
  byLevel: Readonly<Record<string, readonly EntityId[]>>;
  byKind: Readonly<Record<EntityKind, readonly EntityId[]>>;
  notes: readonly Note[];
}
```

Kích thước sống ở BA chỗ gián tiếp:
- `byId[dimensionId]` — thực thể đầy đủ, key là `DimensionId` (tiền tố `M-`).
- `byKind.dimension` — mảng `DimensionId[]`, **giữ nguyên thứ tự gốc**
  (`normalize.ts:12-13`: *"in the original array order, which is what makes
  `denormalizeSpatial` give the input back untouched"*).
- `byLevel[levelId]` — trộn CHUNG với mọi kind khác trên tầng đó (tường, phòng,
  trục…), phải lọc lại bằng `isEntityOfKind('dimension', entity)`
  (`normalize.ts:65-66`) nếu đọc qua đường này.

Cách đọc ĐÚNG là `entitiesOfKind(graph, 'dimension')` (mục A.2) — không viết
tay vòng lặp `byKind.dimension.map(id => byId[id])`, vì `entitiesOfKind` đã làm
đúng việc đó kèm kiểm `isEntityOfKind` (an toàn khi `byId` có dữ liệu hỏng).

---

## B. Đo lại từ hình học (M-15)

### B.1 — `centrelineLength`, `src/domain/walls/types.ts:93-95`

```ts
/** Length of the centreline. */
export function centrelineLength(wall: Wall): Millimetres {
  return distanceBetween(wall.centreline.start, wall.centreline.end);
}
```

Trả về `Millimetres` (branded, `Quantity<'mm'>` — `domain/units/types.ts:34`).

### B.2 — `measureDistance` / `measureChain`, `src/domain/measure/measure.ts:134-187`

```ts
export interface DistanceMeasurement {
  readonly kind: 'distance';
  readonly points: readonly [MeasurePoint, MeasurePoint];
  readonly lengthMm: Millimetres;
}

export function measureDistance(from: MeasurePoint, to: MeasurePoint): DistanceMeasurement {
  const [dx, dy, dz] = deltaOf(from, to);
  return {
    kind: 'distance',
    points: [from, to],
    lengthMm: roundLength(Math.hypot(dx, dy, dz)),
  };
}

export interface ChainMeasurement {
  readonly kind: 'chain';
  readonly points: readonly MeasurePoint[];
  readonly segmentsMm: readonly Millimetres[];
  readonly totalMm: Millimetres;
}

/** `null` cho fewer than two points. */
export function measureChain(points: readonly MeasurePoint[]): ChainMeasurement | null { /* … */ }
```

`MeasurePoint` (`measure.ts:61-66`):

```ts
export interface MeasurePoint {
  readonly x: Millimetres;
  readonly y: Millimetres;
  readonly z?: Millimetres;   // optional — thiếu = 0 (đo trên mặt bằng)
}
```

Trả về `Millimetres`, ĐO THẬT theo `Math.hypot` qua cả 3 trục (z mặc định 0
cho pick trên mặt bằng). `roundLength` làm tròn 1e-6 mm — không tự làm tròn lần
nữa ở tầng trên (A15: định dạng ở viewmodel, không phải phép tính lại).

### B.3 — Hàm ĐÚNG để lấy "chiều dài đo được từ bản vẽ" của MỘT dimension

`Dimension.line: Segment` **đã** là toạ độ mm thật (không phải pixel — xem A.1).
Vì vậy "đo lại từ hình học" của chính chuỗi kích thước đó là:

```ts
import { measureDistance } from '@/domain/measure/measure';

const measuredMm = measureDistance(dimension.line.start, dimension.line.end).lengthMm;
```

`Point` (spatial/types.ts) thoả cấu trúc `MeasurePoint` (cả hai đều
`{ x: Millimetres; y: Millimetres }`, `z` optional) nên truyền thẳng được,
không cần chuyển đổi.

Với `kind: 'chain'` (nhiều đoạn nối tiếp), nếu `referenceIds` cho một dãy điểm
liên tiếp thì dùng `measureChain(points)` thay vì gọi `measureDistance` lặp —
`measureChain` tự cộng dồn `segmentsMm` thành `totalMm` (không cộng tay, tránh
sai số làm tròn kép — `measure.ts:156-161`).

### B.4 — ⚠️ BẪY: `centrelineLength` KHÔNG nhận `Wall` của đồ thị

`centrelineLength(wall: Wall)` đòi `Wall` của
`src/domain/walls/types.ts:61-70`:

```ts
export type WallKind = 'loadBearing' | 'partition' | 'railing' | 'glazed'; // walls/types.ts:37
export interface Wall {
  readonly id: WallId;
  readonly kind: WallKind;
  readonly centreline: WallCentreline;      // { start: PointMm; end: PointMm }
  readonly thicknessMm: Millimetres;
  readonly baseElevationMm: Millimetres;    // cao độ TUYỆT ĐỐI
  readonly topElevationMm: Millimetres;
}
```

Còn `Wall` của đồ thị (`src/domain/spatial/types.ts:120-132`, cái mà
`referenceIds` trỏ tới qua `WallId`) có `kind: 'loadBearing' | 'partition' |
'envelope'` (KHÁC UNION), `centreline: Segment`, và `heightMm` +
`ReviewMetadata` thay vì `baseElevationMm`/`topElevationMm`. **Hai kiểu tên
trùng `Wall`, không tương thích nhau** — TypeScript sẽ báo lỗi nếu truyền
`GraphWall` thẳng vào `centrelineLength`.

Đường chuyển đổi ĐÃ CÓ, đừng viết lại: `toSolidWall(wall: GraphWall, level:
Level): SolidWall` (`business/shared.ts:307-317`) — cần thêm `Level` vì đồ thị
lưu `heightMm` tương đối còn hình học cần cao độ tuyệt đối. Nếu chỉ cần
**chiều dài** centreline của một tường đồ thị, KHÔNG cần đi vòng qua
`toSolidWall` — gọi thẳng `measureDistance(wall.centreline.start,
wall.centreline.end).lengthMm` (mục B.3), vì `centreline: Segment` của đồ thị
đã đủ hai điểm, và `MeasurePoint` chấp nhận `Point` trực tiếp.

---

## C. Độ lệch (M-02) — ⚠️ NOT FOUND, ĐANG CHỜ QUYẾT ĐỊNH

### C.1 — Kết quả quét

Đã mở và soát TOÀN BỘ các file sau, tìm hàm nhận hai `Millimetres` (hay hai
`number`) trả về độ lệch tương đối:

| File | Có hàm phù hợp? |
|---|---|
| `src/domain/units/compare.ts` | KHÔNG — chỉ có `nearlyEqual`/`nearlyEqualLength`/`compareNearly` (so sánh **có bằng nhau trong dung sai không**, trả `boolean`/`-1\|0\|1`, không trả tỉ lệ lệch) |
| `src/domain/units/outliers.ts` | KHÔNG — `median`/`splitOutliers` là thống kê robust trên MỘT tập mẫu (index-based), không so hai giá trị đơn |
| `src/domain/units/scale.ts` | Có 2 hàm, cả hai nhận `MillimetresPerPixel` — xem C.2 |
| `src/domain/measure/constraints.ts` | KHÔNG — chỉ có khoá hướng (`lockDirection`), không có so sánh độ lệch |
| `src/domain/quality/thresholds.ts` + `index.ts` | KHÔNG — bốn ngưỡng chất lượng ảnh (độ phân giải/nghiêng/tương phản/nhiễu), không liên quan độ dài |
| `src/domain/rooms/*`, `src/domain/axes/*`, `src/domain/walls/*` | Đã quét chữ ký export — không có hàm `compare*`/`*Deviation` nào nhận hai độ dài |
| `src/lib/format/*` | KHÔNG — chỉ định dạng, không tính toán (đúng vai trò của lib/format) |
| `src/lib/coloring/*` | KHÔNG — tô màu theo lượng tử vị, không so hai giá trị |
| Toàn `src/domain`, `src/lib` (grep `relativeDeviation\|relativeDifference\|percentDifference\|deviationOf\|compareLengths\|compareValues\|relativeError`) | 4 file khớp, cả 4 đều là `scale.ts`, `ScaleCalibration/*` — không có hàm chung nào khác |

### C.2 — Hai hàm điều phối viên đã tìm thấy, và vì sao KHÔNG dùng thẳng được

```ts
// domain/units/scale.ts:44 — ngưỡng 2% đặc tả nói tới
export const SCALE_THRESHOLDS = {
  // …
  levelAgreementLimit: 0.02,
  // …
  aiDeviationLimit: 0.15,
} as const;

// domain/units/scale.ts:273
export function compareLevelScales(levels: readonly LevelScale[]): readonly LevelScaleWarning[]

// domain/units/scale.ts:348
export function compareScaleToAiEstimate(
  manualRatio: MillimetresPerPixel,
  aiEstimatedRatio: MillimetresPerPixel,
): ScaleAiDeviation
```

`MillimetresPerPixel = Quantity<'mm/px'>` (`units/types.ts:52`) là brand
**KHÁC** `Millimetres = Quantity<'mm'>` (`units/types.ts:34`). Cả hai đều
`number & UnitBrand<...>` ở runtime (brand bị xoá lúc chạy — `units/types.ts:23-31`
nói thẳng: *"The tag is erased at runtime, so there is no boxing cost"*), nên
về mặt VẬN HÀNH gọi `compareScaleToAiEstimate(4800 as MillimetresPerPixel, 4812
as MillimetresPerPixel)` sẽ ra đúng số `-0.0025` (≈ −0,25%, khớp ví dụ đặc tả)
— **nhưng TypeScript sẽ từ chối truyền `Millimetres` vào tham số kiểu
`MillimetresPerPixel` mà không ép kiểu (`as`)**. Ép kiểu một brand sai chính là
thứ hệ thống brand này TỒN TẠI ĐỂ CHẶN (xem docstring `units/types.ts:9-16`).
Dùng thẳng hàm này là phá vỡ chính bất biến mà `units/types.ts` dựng ra.

Ngoài lỗi kiểu, còn có vấn đề Ý NGHĨA: `compareScaleToAiEstimate` so sánh **hai
tỉ lệ bản vẽ** (mm mỗi pixel) của CÙNG một bản vẽ, không phải "một số đọc OCR"
với "một số đo lại từ hình học" của MỘT chuỗi kích thước. Ngưỡng `0.15` của nó
(`aiDeviationLimit`) không khớp ngưỡng `2%` đặc tả đòi — trùng hợp chỉ ở chỗ
`levelAgreementLimit = 0.02` khớp con số 2%, nhưng đó là ngưỡng cho việc so
**hai tầng với nhau**, không phải so **đọc với đo**.

### C.3 — BLOCKER: không hỏi được điều phối viên

Đặc tả yêu cầu dừng và chạy:

```
orca orchestration ask --question "M-02: không có hàm nào nhận hai độ dài mm để tính lệch tương đối. Chọn phương án?" \
  --options "A-them-ham-vao-domain-bang-prompt-logic-rieng,B-gateway-nhan-do-lech-nhu-du-lieu-tu-read-model"
```

Đã thử với CẢ HAI cặp `--dispatch-capability`/`--dispatch-id` cấp trong phần mở
đầu của phiên này:

```
$ orca orchestration send --type heartbeat … --dispatch-capability dcap_ROVQFevpwLOtUfe_...
Dispatch ctx_22d60427c04d capability is revoked.

$ orca orchestration send --type heartbeat … --dispatch-capability dcap_2y4xW0ingdQjRNdbxM7eyAnTdRvkW4lf...
Dispatch ctx_3717b5b8fbb7 capability is revoked.

$ orca orchestration check --terminal term_8aaa0621-90ce-48a7-b015-b0027be71cc8
No messages.

$ orca orchestration ask --dispatch-capability dcap_ROVQFevpwLOtUfe_... --question "…" --timeout-ms 15000
ask requires an active supervised Dispatch.
```

Cả hai Dispatch cấp cho phiên đều đã bị thu hồi TRƯỚC KHI worker này gửi bất
kỳ thông điệp nào — không phải lỗi do worker gây ra trong lúc chạy. Không có
Dispatch nào khác đang hoạt động để `ask` gửi câu hỏi tới.

### C.4 — Khuyến nghị của worker (CHƯA PHẢI QUYẾT ĐỊNH ĐÃ DUYỆT)

Dựa theo chính triết lý của repo (`CLAUDE.md` mục B: *"Tính toán không nằm
trong màn hình. Đưa xuống hook hoặc `src/lib`"*; `LUAT_MAN_HINH.md` R-61: *"hook
chỉ nối lại logic đã có; không chứa công thức tự chế"*) và tiền lệ
`compareLevelScales`/`compareScaleToAiEstimate` (cùng một file, cùng công thức
`(a - b) / b`, cùng kiểu trả `{ relativeDeviation, exceedsLimit }`), **Phương án
A (thêm hàm vào domain)** khớp kiến trúc hiện có hơn hẳn Phương án B: phép tính
`(đọc - đo) / đo` là một công thức thuần, không cần trạng thái hay dữ liệu từ
read-model, và mọi phép so sánh có dung sai khác trong `domain/units` đều nằm ở
tầng domain, không ở gateway màn hình.

**Đề xuất cụ thể** (chỉ để tham khảo — KHÔNG được coi là đã duyệt):

```ts
// domain/units/compare.ts, cạnh nearlyEqualLength — hoặc domain/units/scale.ts
// cạnh compareScaleToAiEstimate, tuỳ điều phối viên chọn nơi đặt

export interface LengthDeviation {
  readonly relativeDeviation: number; // dấu giữ nguyên: dương = đọc lớn hơn đo
  readonly exceedsLimit: boolean;
}

/**
 * So một số đọc được (OCR) với chiều dài đo lại từ hình học của cùng một
 * chuỗi kích thước. `measuredMm` là mẫu số — độ lệch tính theo TỈ LỆ so với
 * hình học thật, không theo số đọc được.
 */
export function compareReadingToMeasured(
  readingMm: Millimetres,
  measuredMm: Millimetres,
  limit = 0.02, // ngưỡng đề xuất — CẦN điều phối viên xác nhận nó có = SCALE_THRESHOLDS.levelAgreementLimit không, hay là hằng riêng của màn này
): LengthDeviation {
  if (measuredMm <= 0) {
    return { relativeDeviation: 0, exceedsLimit: false };
  }
  const relativeDeviation = (readingMm - measuredMm) / measuredMm;
  return { relativeDeviation, exceedsLimit: Math.abs(relativeDeviation) > limit };
}
```

**KHÔNG được tự thêm hàm này vào `src/domain` mà không có sự đồng ý của điều
phối viên** — đây chính là điều R-68/R-69 của `LUAT_MAN_HINH.md` cấm ("cần một
hàm chưa có ở tầng logic thì dừng và đề xuất một prompt logic mới, không tự
thêm"). T-worker lớp sau đọc tới đây phải tự tìm cách xác nhận với điều phối
viên (qua kênh nào đang sống lúc đó) trước khi hiện thực hàm này hoặc phương án
B.

---

## D. Tầng lệnh (S-07 + S-05)

### D.1 — `dispatch` / `runCommandPipeline`, `src/lib/commands/dispatch.ts`

Năm bước, đúng thứ tự, KHÔNG đổi được (`dispatch.ts:72-78`):

```ts
export type DispatchStage = 'validate' | 'apply' | 'history' | 'rules' | 'sync';
export const DISPATCH_STAGES = ['validate', 'apply', 'history', 'rules', 'sync'] as const satisfies readonly DispatchStage[];
```

Bốn cổng (`dispatch.ts:124-163`):

```ts
export interface SpatialPort {
  read: () => NormalizedSpatial | null;
  applyPatches: (patches: readonly SpatialPatch[]) => void;
}

export interface HistoryPort {
  push: (entry: UndoEntry) => void;
  drop: (entryId: UndoEntryId) => void;
}

export interface RulesPort {
  run: (graph: NormalizedSpatial, changes: readonly ChangedEntity[]) => RuleRunResult;
  write: (result: RuleRunResult) => void;
}

export interface SyncPort {
  enqueue: (batch: DispatchBatch) => MaybePromise<void>;
}

export interface DispatchDeps {
  readonly spatial: SpatialPort;
  readonly history: HistoryPort;
  readonly rules: RulesPort;
  readonly sync: SyncPort;
  readonly now?: () => string;
}
```

Hàm chạy MỘT lệnh (`dispatch.ts:700-704`):

```ts
export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult> {
  return runExclusive(SPATIAL_PIPELINE_KEY, () =>
    runCommandPipeline({ commands: [command], label: command.description }, deps),
  );
}
```

`DispatchResult = Result<DispatchSuccess, DispatchFailure>` (`dispatch.ts:199`)
— `DispatchSuccess = { entry: UndoEntry; rules: RuleRunResult }`
(`dispatch.ts:192-197`), `DispatchFailure` mang `stage`, `message`, `reasons`
(tiếng Việt), `cause`, `rolledBack`, `rollbackIssues` (`dispatch.ts:177-190`).
`dispatch()` KHÔNG BAO GIỜ reject — luôn trả `{ ok: false, error }` khi hỏng
(`dispatch.ts:696-699`).

### D.2 — `createCommand` và `changeForUpdate`, `src/lib/commands/createCommand.ts`

```ts
// createCommand.ts:18-28
export interface CommandInput {
  type: CommandType;
  actorId: string;
  description: string;
  changes: readonly EntityChange[];
  id?: CommandId;
  timestamp?: string;
}

// createCommand.ts:128-142
export const createCommand = (input: CommandInput): Command => { /* … */ };

// createCommand.ts:52-62
export const changeForUpdate = <K extends EntityKind>(
  kind: K,
  before: EntityByKind[K],
  after: EntityByKind[K],
): EntityChangeOfKind<K> => {
  if (before.id !== after.id) {
    throw new Error(`Command change cannot update across ids: ${before.id} -> ${after.id}.`);
  }
  return { kind, id: idOfEntity(before), before, after };
};
```

`changeForAdd` (`createCommand.ts:36-41`) và `changeForRemove`
(`createCommand.ts:44-49`) cũng có sẵn, cùng khuôn. `createCommand` tự dựng
`scope` từ `changes` (`deriveScope`, `createCommand.ts:95-118`) — KHÔNG được tự
tay viết `scope`.

**Ảnh `before`/`after` PHẢI là snapshot ĐẦY ĐỦ**, không phải diff từng trường
(`types.ts:34-41`: *"Snapshots are complete entities, never partial diffs,
which is what makes every command invertible without extra bookkeeping"*).

### D.3 — `CommandContext`, `buildCommand`, `refuse`, `accept`, `AUTHORED_BY_HAND` — `src/lib/commands/business/shared.ts`

```ts
// shared.ts:61-69
export interface CommandContext {
  readonly graph: NormalizedSpatial;
  readonly actorId: string;
  readonly id?: CommandId;
  readonly timestamp?: string;
}

// shared.ts:88-101
export const buildCommand = (
  type: CommandType,
  description: string,
  changes: readonly EntityChange[],
  context: CommandContext,
): Command => createCommand({ /* … */ });

// shared.ts:71-77, 103-111
export interface CommandRefusal {
  readonly type: CommandType;
  readonly reasons: readonly string[];
}
export type CommandResult = Result<Command, CommandRefusal>;
export const refuse = (type: CommandType, reasons: readonly string[]): CommandResult => /* … */;
export const accept = (command: Command): CommandResult => ok(command);

// shared.ts:124-128
export const AUTHORED_BY_HAND = {
  confidence: 1,
  source: 'human',
  reviewed: false,
} as const;
```

`AUTHORED_BY_HAND` dùng khi TẠO MỚI một thực thể do người vẽ tay (không phải
duyệt một thực thể AI đã có) — `reviewed: false` vẫn giữ nguyên, vì "vẽ" khác
"duyệt" (A5, docstring `shared.ts:19-24`).

### D.4 — ⚠️ KHÔNG có `DIMENSION_COMMAND_TYPES` hay lệnh `dimension.*` — xác nhận

Grep `DIMENSION_COMMAND_TYPES\|'dimension\.` trên toàn `src` ra ĐÚNG MỘT kết
quả giả (`domain/axes/copyFloor.ts` — biến vòng lặp tên `dimension`, không phải
tên loại lệnh). Không có lệnh `dimension.*` nào tồn tại ở S-07.

**Khuôn đúng để dựng lệnh thiếu** — `objectLayerReviewGateway.ts` đã tự dựng
BA lệnh `opening.*` không có sẵn ở S-07 (`opening.changeKind`,
`opening.changeSwing`, `opening.approve`) bằng đúng nguyên thuỷ công khai này.
Dán nguyên văn lệnh DUYỆT — đây là khuôn T-lớp sau sẽ chép cho
`dimension.approve`:

```ts
// objectLayerReviewGateway.ts:863, 886, 1043-1058
export const OBJECT_APPROVE_COMMAND_TYPE = 'opening.approve';

export const approveDescription = (id: string): string => `Duyệt đối tượng ${id}.`;

/**
 * Lệnh duyệt một đối tượng — lỗ mở hoặc đồ đạc.
 *
 * A5: đây là đường DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm
 * `source: 'human'` — không có tham số nào cho phép nơi gọi truyền `source`,
 * nên đầu ra AI không có đường nào bật được cờ xanh "đã xác minh".
 */
export function buildApproveObjectCommand(
  before: GraphOpening | Furniture,
  actorId: string,
): Command {
  const isOpening = 'wallId' in before;
  const changes = isOpening
    ? [changeForUpdate('opening', before, { ...before, reviewed: true, source: 'human' })]
    : [changeForUpdate('furniture', before, { ...before, reviewed: true, source: 'human' })];

  return createCommand({
    type: OBJECT_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveDescription(displayIdOf(before.id)),
    changes,
  });
}
```

Áp cho `Dimension` — thay `'opening'`/`'furniture'` bằng `'dimension'`:

```ts
export const DIMENSION_APPROVE_COMMAND_TYPE = 'dimension.approve';

export function buildApproveDimensionCommand(before: Dimension, actorId: string): Command {
  return createCommand({
    type: DIMENSION_APPROVE_COMMAND_TYPE,
    actorId,
    description: `Duyệt kích thước ${before.id}.`,
    changes: [changeForUpdate('dimension', before, { ...before, reviewed: true, source: 'human' })],
  });
}
```

Điều kiện hợp lệ theo `dispatch.ts:220-328` (`validateCommands`): `CommandType`
là `string` mở (`types.ts:31`), `validateCommands` chỉ kiểm `command.type` khác
rỗng, KHÔNG so với bảng cho phép — nên `'dimension.approve'` hợp lệ dù không
đăng ký ở đâu khác. Lệnh tự hoàn tác được vì `changeForUpdate` mang đủ
before/after (mục D.2), `invertCommand` chỉ hoán đổi hai ảnh đó.

Nếu màn cần lệnh SỬA GIÁ TRỊ (`overrideValueMm`), theo đúng khuôn trên:

```ts
export const DIMENSION_OVERRIDE_COMMAND_TYPE = 'dimension.override';

export function buildOverrideDimensionCommand(
  before: Dimension,
  overrideValueMm: Millimetres,
  actorId: string,
): Command {
  return createCommand({
    type: DIMENSION_OVERRIDE_COMMAND_TYPE,
    actorId,
    description: `Sửa kích thước ${before.id} thành ${formatLengthMm(overrideValueMm)}.`, // shared.ts:233-237
    changes: [changeForUpdate('dimension', before, { ...before, overrideValueMm })],
  });
}
```

⚠️ Việc sửa `overrideValueMm` có nên tự RETRACT `reviewed`/đổi `source` hay
không là câu hỏi CHÍNH SÁCH QC, không phải câu hỏi tầng lệnh — đúng lời cảnh báo
đã ghi ở `shared.ts:19-24`: *"Whether an edit should retract an existing
approval is a QC policy question, not a command-layer one, so an update carries
the metadata it found."* Bản mẫu trên GIỮ NGUYÊN metadata cũ (chỉ đổi
`overrideValueMm`) — nếu đặc tả đòi khác thì đó là quyết định của điều phối
viên, không tự chọn.

### D.5 — `createCommitSpatialPort` / `commit`, `src/store/commit.ts`

```ts
// store/commit.ts:4-8, 17-20
export interface CommitResult {
  undo: () => void;
  label: string;
  timestamp: number;
}

export function commit(
  patch: SpatialPatch | readonly SpatialPatch[],
  label: string
): CommitResult
```

Cổng ghi hợp A10, dựng bằng `commit` — khuôn `createCommitSpatialPort`
(`objectLayerReviewGateway.ts:1076-1086`):

```ts
export interface ObjectLayerGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

export function createCommitSpatialPort(
  graph: ObjectLayerGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}
```

Và bộ ráp năm cổng đầy đủ (`objectLayerReviewGateway.ts:1113-1148`, gộp lệnh
liên tiếp qua `createHistoryStack({ mergeWindowMs: MERGE_WINDOW_MS })` —
`MERGE_WINDOW_MS === COALESCE_WINDOW_MS` = 400 ms, một hằng gốc):

```ts
export interface ObjectLayerDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  readonly setLabel: (label: string) => void;
}

export interface CreateObjectLayerDispatchOptions {
  readonly graph: ObjectLayerGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

export function createObjectLayerDispatchDeps(
  options: CreateObjectLayerDispatchOptions,
): ObjectLayerDispatchDeps { /* … */ }

export async function runObjectCommand(
  command: Command,
  bundle: ObjectLayerDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);
  return dispatch(command, bundle.deps);
}
```

Đổi tên `ObjectLayer*` → `Dimension*` là đủ để chép nguyên khuôn này cho
`DimensionOcrReview` — KHÔNG có gì trong đây riêng cho `opening`/`furniture`.

---

## E. Tự lưu (D-07)

### E.1 — Ngoại lệ cũ: `src/hooks/useAutosave.ts` (ĐỪNG dùng cho màn mới)

```ts
// hooks/useAutosave.ts:11, 18
const AUTOSAVE_DEBOUNCE_MS = 800;

export function useAutosave(onSave: (data: RootState['spatial']) => Promise<void>) {
  // … setTimeout(…, AUTOSAVE_DEBOUNCE_MS) …
  return saveLabel; // string | null — KHÔNG báo trình đọc màn hình
}
```

`useAutosave` trả một `string | null` (`"Đã lưu lúc 14:32"` hoặc
`"Lưu thất bại"`), KHÔNG gọi `announcer.announce(...)` ở đâu cả — không đáp ứng
phần "nói ra trạng thái đó cho trình đọc màn hình" của A7. CLAUDE.md trích dẫn
`hooks/useAutosave.ts:6` cho A7 — trích dẫn đó chỉ đúng phần "800 ms", không
đúng phần "nói ra cho trình đọc màn hình".

### E.2 — Cơ chế ĐÚNG cho A7: `createAutosave` + `useSaveIndicator`

```ts
// lib/autosave/createAutosave.ts:1-24
export type AutosaveState = 'dirty' | 'failed' | 'offline' | 'saved' | 'saving';

export interface CreateAutosaveOptions<TChanges> {
  debounceMs?: number;
  getChanges: () => TChanges | undefined;
  isOnline?: () => boolean;
  maxWaitMs?: number;
  now?: () => number;
  save: (changes: TChanges) => Promise<void>;
}

export interface Autosave {
  getLastSavedAt: () => number | undefined;
  getState: () => AutosaveState;
  notifyChange: () => void;
  saveNow: () => Promise<void>;
  subscribe: (listener: (state: AutosaveState) => void) => () => void;
}

const DEFAULT_DEBOUNCE_MS = 800; // đúng con số A7, cùng nguồn triết lý với hằng ở E.1

export function createAutosave<TChanges>(options: CreateAutosaveOptions<TChanges>): Autosave
```

```ts
// hooks/useSaveIndicator.ts:8-19, 72
export interface SaveIndicatorResult {
  detail: string;
  label: string;
  state: AutosaveState;
}

export interface UseSaveIndicatorOptions {
  now?: () => number;
  tickIntervalMs?: number;
  announcer?: Announcer;
}

export function useSaveIndicator(autosave: Autosave, options: UseSaveIndicatorOptions = {}): SaveIndicatorResult
```

`useSaveIndicator` gọi `announcer.announce(result.detail)` khi chuyển sang
`'saved'` (polite) và `announcer.announce(result.label, 'assertive')` khi
`'failed'`/`'offline'` (`useSaveIndicator.ts:116-124`) — ĐÂY là phần đáp ứng A7
mà `useAutosave.ts` không có.

**Ví dụ đúng, chép nguyên khuôn `useWallLayerReview.ts:680-704`** (màn QC anh
em gần nhất, ĐÃ dùng cặp này chứ không phải `useAutosave.ts`):

```ts
const autosaveRef = useRef<Autosave | null>(null);
const persistRef = useRef({ floorId, gateway, projectId });
persistRef.current = { floorId, gateway, projectId };

autosaveRef.current ??= createAutosave<NormalizedSpatial>({
  getChanges: () => useStore.getState().spatial ?? undefined,
  save: async (changes) => {
    const current = persistRef.current;
    const result = await current.gateway.persistWallLayer({
      floorId: current.floorId,
      projectId: current.projectId,
      graph: changes,
    });

    if (!result.supported) {
      // Một khả năng chưa có endpoint KHÔNG được biến thành một lượt lưu đã
      // xong: ném ra là cách duy nhất để thanh trạng thái nói ra sự thật.
      throw new Error(result.missing);
    }
  },
});

const autosave = autosaveRef.current;
const saveIndicator = useSaveIndicator(autosave);
```

Vì `persistDimensionLayer` cũng sẽ NOT FOUND (mục J.3, cùng lý do
`FloorWriteBody`), khuôn `throw new Error(result.missing)` ở trên áp dụng y
nguyên: tự lưu của `DimensionOcrReview` sẽ luôn hiện trạng thái lỗi thật (không
bịa "đã lưu") cho tới khi endpoint có thật.

Tiền lệ dùng cặp này: `WallLayerReview`, `ProjectSettings`, `AccountSettings`.
Chỉ `ScaleCalibration` (màn cũ hơn, thuộc `pipeline`, không phải `qc`) còn dùng
`useAutosave.ts` — đó là màn CŨ, không phải khuôn để chép (giống cách
`hooks/useShareLinks.ts` là ngoại lệ đi trước theo R-64).

---

## F. Màu độ tin cậy (P-06)

### F.1 — `confidenceLevel`, `describeConfidence`, hai ngưỡng — `src/lib/format/semantic.ts`

```ts
// semantic.ts:37, 40-41
export type ConfidenceLevel = 'certain' | 'suggested' | 'needsReview' | 'unknown';
export const CONFIDENCE_CERTAIN_THRESHOLD = 0.9;
export const CONFIDENCE_SUGGESTED_THRESHOLD = 0.7;

// semantic.ts:43-48
export interface ConfidenceDescription {
  readonly level: ConfidenceLevel;
  readonly label: string; // "AI chắc chắn" | "AI đề xuất" | "Cần kiểm tra" | "—"
}

// semantic.ts:73-76
export function describeConfidence(value: MaybeNumber): ConfidenceDescription

// semantic.ts:79-90
export function confidenceLevel(value: MaybeNumber): ConfidenceLevel {
  if (!isFormattable(value)) return 'unknown';
  if (value >= CONFIDENCE_CERTAIN_THRESHOLD) return 'certain';
  if (value >= CONFIDENCE_SUGGESTED_THRESHOLD) return 'suggested';
  return 'needsReview';
}
```

```ts
// ví dụ đúng, y nguyên docstring semantic.ts:67-71
describeConfidence(0.95)  // { level: 'certain',     label: 'AI chắc chắn' }
describeConfidence(0.72)  // { level: 'suggested',   label: 'AI đề xuất' }
describeConfidence(0.4)   // { level: 'needsReview', label: 'Cần kiểm tra' }
describeConfidence(null)  // { level: 'unknown',     label: '—' }
```

**KHÔNG có băng nào trong hai ngưỡng 0,9/0,7 này cho ra đúng "5 mục dưới
0,75"** — y hệt tình huống của S-13 (xem F.3).

### F.2 — `ColorTokenName`, `createLookupScale` — `src/lib/coloring/scales.ts`, `modes.ts`

```ts
// scales.ts:135
export type ColorTokenName = (typeof COLOR_TOKEN_NAMES)[number];

// scales.ts:345-349
export function createLookupScale<Key extends string>(
  table: Readonly<Record<Key, ColorTokenName>>,
): (key: Key | null | undefined) => ColorTokenName
```

Chế độ tô theo độ tin cậy đã có sẵn, KHÔNG cần dựng lại — `createAiConfidenceMode`
(`modes.ts:416-429`) cắt theo NGŨ PHÂN VỊ của các đối tượng ĐANG HIỂN THỊ
(`createQuantileScale`, `direction: 'descending'` — phần kém tin cậy nhất tô
đậm nhất), KHÔNG dùng hai ngưỡng cố định 0,9/0,7 để tô màu:

```ts
// modes.ts:416-429
function createAiConfidenceMode(subjects: readonly PaintSubject[]): ColoringMode {
  const scale = createQuantileScale(
    readingsOf(subjects, (subject) => subject.review.confidence),
    { direction: 'descending' },
  );
  return {
    id: 'aiConfidence',
    label: COLORING_MODE_LABELS.aiConfidence,
    bands: rangeBands(scale, (value) => formatPercent(value, { fractionDigits: 0 })),
    breaks: scale.breaks,
    paint: (subject) => scale.tokenOf(subject.review.confidence),
  };
}
```

`PaintSubject` (`modes.ts:85-98`) cần `review: ReviewMetadata` — `Dimension`
thoả trực tiếp vì `extends ReviewMetadata` (mục A.1); các trường khác
(`usage`, `areaM2`, `worstSeverity`) đặt `null` cho một dimension.

### F.3 — Ngưỡng "cần chú ý" của BỘ LỌC màn (khác với ngưỡng TÔ MÀU)

Tiền lệ `OBJECT_LAYER_CONFIDENCE_THRESHOLD` (`objectLayerReviewGateway.ts:324-328`):

```ts
/**
 * Ngưỡng "cần chú ý" của màn — 0,75.
 *
 * Con số này là YÊU CẦU SẢN PHẨM, không phải một băng của hệ thiết kế… Hai
 * băng có sẵn của `confidenceLevel` cắt ở 0,90 và 0,70 nên không băng nào cho
 * ra năm — dùng chúng làm bộ lọc sẽ cho 10 hoặc 3, tức là một con số KHÁC con
 * số đặc tả đòi in ra.
 */
export const OBJECT_LAYER_CONFIDENCE_THRESHOLD = 0.75;

export const isLowConfidenceObject = (confidence: number): boolean =>
  confidence < OBJECT_LAYER_CONFIDENCE_THRESHOLD;
```

Nếu đặc tả của `DimensionOcrReview` đòi lọc "độ tin cậy thấp" theo một con số
CỤ THỂ (khớp một bộ mẫu cố định, kiểu "N mục dưới ngưỡng"), đặt hằng riêng ĐÚNG
MỘT CHỖ theo khuôn trên — KHÔNG tái dùng `CONFIDENCE_SUGGESTED_THRESHOLD` (0,7)
nếu con số đặc tả đòi khác 0,7 (R-71: không hằng số viết tay, nhưng cũng không
ép một ngưỡng SẢN PHẨM vào một hằng THIẾT KẾ chỉ vì tên nghe giống).

---

## G. Định dạng số (P-01)

### G.1 — `formatNumber`, `formatPercent`, `PercentSource` — `src/lib/format/number.ts`

```ts
// number.ts:75-92
export type PercentSource = 'ratio' | 'percent';

export interface PercentFormatOptions {
  readonly fractionDigits?: number;
  readonly maxFractionDigits?: number;
  readonly source?: PercentSource;
  // 'ratio' (mặc định): 0.125 → "12,5%" — quy ước của điểm tin cậy và scale check
  // 'percent': 12.5 → "12,5%" — cho giá trị đã nhân sẵn 100 (kiểu progressPercent)
}

// number.ts:57-73
export interface NumberFormatOptions {
  readonly fractionDigits?: number;
  readonly maxFractionDigits?: number;
  readonly grouping?: boolean;
}

// number.ts:201-211
export function formatNumber(value: MaybeNumber, options: NumberFormatOptions = {}): string
// formatNumber(1234567.891)                // "1.234.567,891"
// formatNumber(3.5, { fractionDigits: 2 }) // "3,50"

// number.ts:225-239
export function formatPercent(value: MaybeNumber, options: PercentFormatOptions = {}): string
// formatPercent(0.125)                       // "12,5%"
// formatPercent(0.8, { fractionDigits: 0 })  // "80%"
```

Độ lệch của mục C, nếu tính ra `relativeDeviation = -0.0025`, hiện đúng
`"lệch 0,25%"` của đặc tả bằng:

```ts
formatPercent(Math.abs(relativeDeviation), { fractionDigits: 2 }) // "0,25%"
```

(dùng `Math.abs` vì đặc tả không đòi dấu; nếu cần dấu +/− thì bỏ `Math.abs` và
tự thêm ký hiệu — KHÔNG có formatter sẵn nào tự thêm dấu `+`/`−` cho phần trăm).

### G.2 — `formatLength` — `src/lib/format/measure.ts:108-121`

```ts
export interface LengthFormatOptions {
  readonly unit?: LengthDisplayUnit; // 'mm' | 'm'
  readonly fractionDigits?: number;
}

export function formatLength(valueMm: MaybeNumber, options: LengthFormatOptions = {}): string
// formatLength(850)                  // "850 mm"
// formatLength(3450)                 // "3,45 m"
// formatLength(3450, { unit: 'mm' }) // "3.450 mm"
```

**CẤM TUYỆT ĐỐI của đặc tả nói "đơn vị là mm cố định hiển thị bên phải ô"** —
nghĩa là PHẢI truyền `{ unit: 'mm' }` tường minh, KHÔNG để `formatLength` tự
chọn đơn vị theo độ lớn (mặc định của nó tự đổi sang mét từ 1000 mm trở lên,
`METRE_THRESHOLD_MM`, `measure.ts:37`) — nếu không, "4.800 mm" sẽ hiện thành
"4,80 m", sai định dạng cố định mà đặc tả đòi.

### G.3 — `parseNumber`, `parseLength` — `src/domain/units/parse.ts`

```ts
// number.ts:255-266
export function parseNumber(text: string): number | undefined
// parseNumber("4.250,50") // 4250.5 — đọc tiếng Việt (dấu chấm nghìn, dấu phẩy thập phân)

// units/parse.ts:29-47, 206-258
export type LengthUnit = 'mm' | 'cm' | 'dm' | 'm';
export type ParseErrorCode = 'unreadable';
export type ParseLengthResult =
  | { readonly ok: true; readonly value: Millimetres }
  | { readonly ok: false; readonly error: ParseErrorCode };

export interface ParseLengthOptions {
  readonly defaultUnit?: LengthUnit; // mặc định 'mm'
}

export function parseLength(input: string, options: ParseLengthOptions = {}): ParseLengthResult
```

Ô nhập của `overrideValueMm` (nếu màn cho gõ đè) đi qua `parseLength`, KHÔNG
qua `parseNumber` + tự nhân đơn vị — `parseLength` đã xử lý cả hậu tố đơn vị
(`"3,5 m"`, `"350cm"`) và trả thẳng `Millimetres` branded.

### G.4 — A15: định dạng ở viewmodel, dấu thập phân là dấu phẩy

Cả `formatNumber`/`formatPercent`/`formatLength` đều dùng `Intl.NumberFormat('vi-VN')`
(hằng `LOCALE = 'vi-VN'`, `number.ts:36`) — dấu phẩy thập phân, dấu chấm phân
nghìn, TỰ ĐỘNG, không ai được tự ráp chuỗi bằng `toFixed`/`.replace(',', '.')`
(đây chính là điều `local/no-raw-number` chặn). Mọi số hiện trên
`DimensionOcrReview` (giá trị đọc, giá trị đo, % lệch) phải đi qua BA hàm này ở
tầng hook/viewmodel — KHÔNG gọi chúng trong `<Name>.tsx` theo nghĩa "view tự
tính", nhưng GỌI chúng để format chuỗi cuối cùng thì được (đó chính là việc của
viewmodel — xem D mục "tách màn phức tạp làm hai" của CLAUDE.md).

---

## H. Phím tắt (I-01, I-02)

### H.1 — `createShortcutRegistry`, `ShortcutDefinition`, `ShortcutScope`, `parseCombo` — `src/lib/input/shortcutRegistry.ts`

```ts
// shortcutRegistry.ts:53
export type ShortcutScope = 'dialog' | 'sidePanel' | 'canvas' | 'global';

// shortcutRegistry.ts:200-217
export interface ShortcutDefinition {
  readonly id: string;         // 'global.undo', 'canvas.deleteFloor.confirm' — PHẢI nói rõ NƠI, không chỉ VIỆC
  readonly combo: string;      // 'Ctrl+Shift+Z', '?', 'Escape' — Ctrl khớp cả Cmd
  readonly scope: ShortcutScope;
  readonly description?: string;   // tiếng Việt, thường, kiểu câu (A6)
  readonly allowRepeat?: boolean;  // mặc định: một lần bấm, một lần gọi
  readonly preventDefault?: boolean;
  onTrigger(event: ShortcutKeyEvent): void;
}

// shortcutRegistry.ts:110-157
export function parseCombo(combo: string): ParsedCombo
// throws nếu combo có 0 hoặc >1 phím chính; throws nếu combo là 'Tab' (A12: Tab
// là đường di chuyển bàn phím, không feature nào được lấy nó)

// shortcutRegistry.ts:354-356, 676
export function createShortcutRegistry(options: ShortcutRegistryOptions = {}): ShortcutRegistry
export const appShortcutRegistry: ShortcutRegistry = createShortcutRegistry();
```

`ShortcutRegistry.register(definition): () => void` — trả hàm huỷ đăng ký, gọi
trong cleanup của `useEffect`. Thứ tự phân giải: `dialog` → `sidePanel` →
`canvas` → `global` (`SCOPE_PRIORITY`, `shortcutRegistry.ts:59-64`); chỉ
`dialog` là MODAL (nuốt hết phím nó không bind, trừ Escape —
`shortcutRegistry.ts:71, 475-479`).

### H.2 — Cách đăng ký thật, chép từ `useObjectLayerReview.ts:1121-1206`

```ts
useShortcut({
  id: 'objectLayer.deleteObject',
  combo: 'D',
  scope: 'canvas',
  // …
  onTrigger: () => { /* … */ },
});
```

(dùng `useShortcut` — `src/hooks/useShortcut.ts` — chứ không gọi
`appShortcutRegistry.register` trực tiếp trong component; `useShortcut` tự lo
đăng ký/huỷ theo vòng đời component). Escape của canvas ở màn S-13
(`useObjectLayerReview.ts:1196-1206`) CHỦ ĐỘNG rơi xuống `global` — comment tại
đó nói thẳng lý do (A12): không phải mọi Escape phải bind ở canvas, tầng
`global` đã có `global.closeTopLayer` (`shortcutRegistry.ts:636-644`) làm việc
đó cho toàn ứng dụng.

### H.3 — Nhóm phím toàn cục có sẵn, KHÔNG tự đăng ký lại

`buildGlobalShortcuts` / `registerGlobalShortcuts`
(`shortcutRegistry.ts:585-664`) đã đăng ký `Ctrl+Z` (undo), `Ctrl+Shift+Z`
(redo), `Ctrl+S` (lưu ngay), `Ctrl+F` (tìm kiếm), `?` (bảng phím tắt),
`Escape` (đóng lớp trên cùng) ở tầng `global` — màn KHÔNG được đăng ký lại các
combo này ở scope `canvas`/`dialog` trừ khi thật sự cần một hành vi RIÊNG cho
màn đó khi phím đó được bấm trong ngữ cảnh màn (ví dụ Escape đóng một popover
riêng của canvas trước khi rơi xuống global).

---

## I. Bay khung nhìn (R-07)

### I.1 — `useCanvasViewport`, `flyToBounds`, `ContentBounds`, `FlyToBoundsOptions`, `ViewportState` — `src/hooks/useCanvasViewport.ts`

```ts
// useCanvasViewport.ts:11-15, 17-22, 24-38
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FlyToBoundsOptions {
  readonly padding?: number;         // mặc định 40 (canvas px)
  readonly reducedMotion?: boolean;  // để trống ở mã sản phẩm — hook tự đọc OS
  readonly scheduler?: FrameScheduler;
}

// useCanvasViewport.ts:81, 228-234
export function useCanvasViewport(initialState?: Partial<ViewportState>): {
  viewport: ViewportState;
  pan: (dx: number, dy: number) => void;
  zoomTo: (zoomLevel: number, centerX?: number, centerY?: number) => void;
  fitToContent: (contentBounds: ContentBounds, canvasWidth: number, canvasHeight: number, padding?: number) => void;
  flyToBounds: (
    contentBounds: ContentBounds,
    canvasWidth: number,
    canvasHeight: number,
    options?: FlyToBoundsOptions,
  ) => void;
}
```

`flyToBounds` chạy ở slot `'slow'` (340 ms, `createTransition({ duration:
'slow', easing: 'enter', reducedMotion })` — `useCanvasViewport.ts:190`) —
KHÔNG viết số `340` thô, hằng số duy nhất là `MOTION_DURATIONS_MS.slow`
(`lib/motion/tokens.ts:62-67`). `fitToContent` là bản NHẢY TỨC THÌ (không hoạt
ảnh) cùng công thức, dùng khi không cần bay mượt.

`flyToBounds` bị SUPERSEDE (không xếp hàng) nếu gọi lại giữa chừng — animation
mới bắt đầu từ vị trí THẬT hiện tại (`viewportRef`), không từ đích animation cũ
(`useCanvasViewport.ts:88-93, 166-167`). Dưới `reducedMotion`, viewport nhảy
thẳng tới đích ở frame đầu tiên, không chạy animation nào.

---

## J. Trạng thái máy chủ (R-64)

### J.1 — `queryKeys` — `src/lib/query/queryKeys.ts:3-14`

```ts
type QueryDomain =
  | 'drawing' | 'floor' | 'library' | 'progress' | 'project'
  | 'quality' | 'room' | 'space' | 'user' | 'version' | 'violation';
```

**KHÔNG có domain `'dimension'`** trong union này — NOT FOUND cho một
`queryKeys.dimension.*` chuyên dụng. Domain gần nhất về mặt dữ liệu không gian
là `'space'` (`queryKeys.space.byFloor(floorId)`, `queryKeys.ts:113-115`) và
`'room'` (`queryKeys.room.byFloor(floorId)`, `queryKeys.ts:110-112`) — cả hai
đều là khoá theo TẦNG, không theo loại thực thể cụ thể; kích thước có lẽ nên
dùng `queryKeys.space.byFloor(floorId)` nếu tái dùng domain có sẵn, hoặc thêm
`'dimension'` vào `QueryDomain` — **quyết định này thuộc điều phối viên**, T1
chỉ xác nhận domain hiện KHÔNG có.

### J.2 — `cachePolicy`, `invalidation` — `src/lib/query/cachePolicy.ts`, `invalidation.ts`

```ts
// cachePolicy.ts:6, 77-84
export const CACHE_POLICY_TIERS = ['default', 'static', 'aiProgress', 'spatialDraft'] as const;
const TIER_BY_DOMAIN: Readonly<Record<string, CachePolicyTier>> = {
  drawing: 'spatialDraft',
  library: 'static',
  progress: 'aiProgress',
  room: 'spatialDraft',
  space: 'spatialDraft',
  user: 'static',
};
// domain không liệt kê ở đây rơi về 'default' (staleTime 30s, gcTime 10m)
```

```ts
// invalidation.ts:5-16
export const WRITE_OPERATIONS = [
  'createProject', 'editFloor', 'editWall', 'moveFurniture', 'editDimension',
  'changeAxis', 'rerunRules', 'restoreVersion', 'straightenDrawing', 'setDrawingCorners',
] as const;
```

**`editDimension` ĐÃ CÓ SẴN** trong `WRITE_OPERATIONS` và trong
`invalidationMap` (`invalidation.ts:68-72`):

```ts
editDimension: ({ projectId, floorId }) => [
  queryKeys.space.byFloor(floorId),
  queryKeys.room.byFloor(floorId),
  queryKeys.violation.byProject(projectId),
],
```

Đây là bằng chứng gián tiếp là hạ tầng invalidation ĐÃ TÍNH TỚI việc sửa kích
thước (làm mất hiệu lực `space`/`room`/`violation` của tầng đó) dù chưa có
`queryKeys.dimension.*` riêng — dùng thẳng `applyInvalidation(queryClient,
'editDimension', { projectId, floorId })` sau khi lệnh `dimension.override`
(mục D.4) chạy xong là hợp lý, KHÔNG cần đợi domain `'dimension'` được thêm.

```ts
// invalidation.ts:122-132
export function applyInvalidation<TOperation extends WriteOperation>(
  queryClient: QueryClient,
  operation: TOperation,
  params: WriteOperationParamsMap[TOperation],
): void
```

### J.3 — `createOptimisticMutation`, `notificationBus`, `UndoTicket` — `src/lib/mutations/`

```ts
// createOptimisticMutation.ts:8-21, 67-70
export interface OptimisticMutationConfig<TVariables, TResult> {
  affectedKeys: (variables: TVariables) => readonly QueryKey[];
  afterSuccess: (result: TResult, variables: TVariables) => void;
  applyOptimistic: (variables: TVariables) => void;
  callServer: (variables: TVariables) => Promise<TResult>;
  entityId: (variables: TVariables) => string; // dùng để hàng đợi các mutation trùng thực thể
  rollback: (variables: TVariables) => void;
}

export function createOptimisticMutation<TVariables, TResult>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TVariables, TResult>,
): UseMutationOptions<TResult, AppError, TVariables>
```

```ts
// undoTicket.ts:18, 31-37, 45
export const UNDO_WINDOW_MS = 8000; // A8: cửa sổ hoàn tác 8 giây

export interface UndoTicket {
  description: string;
  expiresAt: number;
  getStatus: () => UndoTicketStatus;   // 'active' | 'expired' | 'used'
  id: string;
  undo: () => Result<void, UndoTicketError>;
}

export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket
```

`notificationBus.ts` — `createNotificationBus(options?): NotificationBus`
(`notificationBus.ts:79`), `NotificationInput`/`Notification`/`NotificationListener`
(`notificationBus.ts:9-25`) — chưa cần đọc sâu cho T1, ghi lại vị trí để T
lớp sau tự tra khi cần toast.

### J.4 — `src/api/endpoints.ts` — KHÔNG có nhóm `dimensions`

```ts
// endpoints.ts:18-82 — CÁC NHÓM THẬT SỰ TỒN TẠI
export const ENDPOINTS = {
  auth: { login, register },
  drawings: { chunk, complete, initUpload, progress },
  featureFlags: { read },
  floors: { create, delete, list, reorder },
  projects: { create, delete, list, read, update },
  quality: { assess, corners, straighten },
  spatial: {
    floor: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/spatial`,
    version: (projectId: string, versionId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/versions/${versionId}`,
  },
} as const;
```

`ENDPOINTS.spatial.floor(projectId, floorId)` là nơi GẦN NHẤT — nó đọc/ghi CẢ
`SpatialGraph` (có `dimensions` bên trong, mục A.3), không có endpoint tách
riêng cho kích thước.

**`persistDimensionLayer` sẽ NOT FOUND — cùng lý do đã lặp lại hai lần** ở
`WallLayerReview` (`wallLayerReviewGateway.ts:39-44`) và `ObjectLayerReview`
(`objectLayerReviewGateway.ts:44-49,223-228`):

```ts
export interface FloorWriteBody extends Omit<FloorPayload, 'elevationMm' | 'heightMm' | 'name' | 'order'> {
  elevationMm: FloorElevationMm;
  heightMm: FloorHeightMm;
  name: FloorName;
  order: FloorOrder;
}
// api/client.ts:87-92

export interface PatchSpatialFloorInput extends WriteRequestOptions {
  body: Partial<FloorWriteBody>;
  floorId: string;
  projectId: string;
}
// api/client.ts:144-148
```

`FloorWriteBody` chỉ mang `name`/`order`/`elevationMm`/`heightMm`/`drawings` —
KHÔNG có chỗ cho mảng tường, đối tượng, HAY kích thước. `ENDPOINTS.spatial.floor`
có thật nhưng thân yêu cầu PATCH không nhận được một đồ thị không gian đầy đủ.

**Khuôn nợ đúng (T-lớp sau chép, đổi tên):**

```ts
export const DIMENSION_LAYER_CAPABILITIES = [
  'readBackground', 'readDimensionGraph', 'writeDimensionGraph', 'persistDimensionLayer',
] as const;

export const DIMENSION_LAYER_MISSING_CAPABILITIES = ['persistDimensionLayer'] as const;

export const DIMENSION_LAYER_MISSING_ENDPOINTS = {
  persistDimensionLayer:
    'ENDPOINTS.spatial.floor chấp nhận một đồ thị không gian trong thân yêu cầu — chưa có; ' +
    'PatchSpatialFloorInput.body là Partial<FloorWriteBody> (src/api/client.ts:87-92,144-148), ' +
    'chỉ mang name/order/elevationMm/heightMm/drawings, không có chỗ cho mảng kích thước',
} as const;
```

`readDimensionGraph` cũng NOT FOUND cùng lý do `readObjectGraph`/`readWallGraph`
đã ghi (đồ thị sống trong `src/store`, không endpoint nào trả nó riêng) — cổng
đọc qua cửa tiêm được, mặc định là chính store.

---

## K. Bộ khẳng định (`src/lib/testing/`)

```ts
// expectSevenStates.ts:122-125
export function expectSevenStates(
  renderScreen: ScreenRenderer,
  scenarios: readonly SevenStateScenario[],
): void

// expectAccessible.ts:960-963
export function expectAccessible(
  subject: TestSubject,
  options: AccessibilityOptions = {},
): void

// expectVietnamese.ts:714
export function expectVietnamese(subject: TestSubject, options: VietnameseOptions = {}): void

// expectNoRawColor.ts:307
export function expectNoRawColor(target: string, options: NoRawColorOptions = {}): void
```

⚠️ **`render` KHÔNG PHẢI tên hàm thật.** Tên export đúng là
**`renderWithProviders`**:

```ts
// render.tsx:232-235
export function renderWithProviders(
  ui: RenderableUi,
  options: RenderWithProvidersOptions = {},
): ProvidedRenderResult
```

```ts
// ví dụ đúng — render.tsx / expectAccessible.ts / expectVietnamese.ts đều dùng khuôn này
const { translate } = renderWithProviders(<DimensionOcrReviewContainer {...props} />);
expectAccessible(renderWithProviders(<QcScreen />));
expectVietnamese(renderWithProviders(<QcScreen />));
```

`fixtures.ts` (`src/lib/testing/fixtures.ts`) và `fakeClock.ts` —

```ts
// fakeClock.ts:34, 82
export const FAKE_CLOCK_START = new Date('2026-08-17T14:32:00+07:00');
export function installFakeClock(options: FakeClockOptions = {}): FakeClock
```

`sevenStateScenarios.ts:127`:

```ts
export function createSevenStateScenarios(/* … */): readonly SevenStateScenario[]
```

Bảy trạng thái (`sevenStateScenarios.ts:26`, xem cũng `A11` của CLAUDE.md):
`Rỗng · Đang tải · Một phần · Lỗi · Xong · Không có quyền · Thu gọn`.

---

## L. Giá trị vô lý — ⚠️ NOT FOUND, kèm cảnh báo hằng số trùng tên nghiêm trọng

### L.1 — Không có hàm chuyên dụng cho MỘT số đọc OCR đơn lẻ

Đặc tả đòi: gõ một số hàm ý "phòng dài 30 mét" thì gợi ý hiện NGAY, không cần
màn tự đặt ngưỡng (R-71). **Không có hàm nào trong `src/domain` làm đúng việc
đó cho một chiều dài kích thước tuỳ ý.**

Gần nhất là cặp MẪU HÌNH (không phải hàm dùng thẳng) ở
`src/domain/units/scale.ts:321-329, 380-389`:

```ts
export type ScaleRangeStatus = 'inRange' | 'belowRange' | 'aboveRange';

export function classifyScaleRange(ratio: MillimetresPerPixel): ScaleRangeStatus {
  if (ratio < SCALE_THRESHOLDS.minMillimetresPerPixel) return 'belowRange';
  if (ratio > SCALE_THRESHOLDS.maxMillimetresPerPixel) return 'aboveRange';
  return 'inRange';
}

export interface ImpliedWallThickness {
  readonly thicknessMm: Millimetres;
  readonly implausible: boolean;
}

export function inferWallThicknessFromScale(
  ratio: MillimetresPerPixel,
  referenceWallWidthPx: Pixels,
): ImpliedWallThickness {
  const thicknessMm = millimetres(referenceWallWidthPx * ratio);
  return { thicknessMm, implausible: thicknessMm > MAX_WALL_THICKNESS_MM };
}
```

Đây là NƠI DUY NHẤT repo có từ khoá `implausible` gắn với một phép đo hình học
— MẪU: một hằng ngưỡng đặt tên rõ + một hàm phân loại thuần trả về cờ
`implausible`/status ba nhánh. `useScaleCalibration.ts:1133-1141` dùng nó để
hiện cảnh báo `kind: 'implausible'` NGAY khi gõ (`types.ts:588`: *"Mỗi lần gõ
vào ô 'Chiều dài thật'. Gợi ý vô lý hiện NGAY, không đợi rời ô"* — cùng yêu cầu
UX với đặc tả của T1). Nhưng hàm này CHỈ áp cho suy luận bề dày tường từ TỈ LỆ
BẢN VẼ, không áp thẳng cho một chiều dài kích thước OCR đọc được.

`splitOutliers`/`median` (`domain/units/outliers.ts`, mục C.1) là thống kê
robust trên MỘT TẬP mẫu cùng loại — dùng được nếu màn có NHIỀU kích thước cùng
lúc và muốn tìm "outlier trong lô", nhưng KHÔNG trả lời được "một con số đơn lẻ
30.000 mm có vô lý không" khi chưa có tập so sánh.

### L.2 — 🔴 CẢNH BÁO: BA hằng cùng tên, khác giá trị, khác kiểu

| Hằng | File | Giá trị | Kiểu |
|---|---|---|---|
| `MIN_WALL_THICKNESS_MM` | `domain/walls/types.ts:43` | `60` | `Millimetres` (branded) |
| `MIN_WALL_THICKNESS_MM` | `domain/rules/registry.ts:361` | `60` | `number` thuần |
| `MAX_WALL_THICKNESS_MM` | `domain/walls/types.ts:46` | **`600`** | `Millimetres` (branded) |
| `MAX_WALL_THICKNESS_MM` | `domain/rules/registry.ts:364` | **`400`** | `number` thuần |
| `MIN_WALL_LENGTH_MM` | `domain/rules/registry.ts:367` | `100` | `number` thuần |
| `MIN_WALL_LENGTH_MM` | `domain/walls/edit.ts:35` | `30` | `Millimetres` (branded) |

Hai giá trị `60`/`60` trùng nhau là MAY MẮN, không phải đảm bảo — `400` vs
`600` cho `MAX_WALL_THICKNESS_MM` và `100` vs `30` cho `MIN_WALL_LENGTH_MM`
LỆCH THẬT. `scale.ts:387` (`inferWallThicknessFromScale`, mục L.1) import
`MAX_WALL_THICKNESS_MM` từ **`../rules/registry`** (= 400), không phải từ
`walls/types.ts` (= 600) — nếu T-lớp sau cần một ngưỡng "bề dày tường vô lý",
PHẢI import đúng file `scale.ts` đã import (`domain/rules/registry`), và ghi rõ
trong code vì sao chọn file đó, KHÔNG đoán theo tên biến.

### L.3 — Đề xuất cho T-lớp sau (không phải quyết định đã duyệt)

Không có ngưỡng "chiều dài phòng vô lý" nào có sẵn cho lô-gic của T1 dùng
thẳng. Nếu đặc tả cần một con số cụ thể (ví dụ "trên 20 m nghi ngờ"), đó là
NGƯỠNG SẢN PHẨM MỚI (giống `OBJECT_LAYER_CONFIDENCE_THRESHOLD`, mục F.3) —
phải hỏi điều phối viên theo đúng quy trình R-69/R-71 của `LUAT_MAN_HINH.md`,
KHÔNG tự đặt. Nếu chỉ cần phát hiện "kích thước này khác lạ so với các kích
thước khác trong cùng bản vẽ" (không phải một ngưỡng tuyệt đối), `splitOutliers`
(mục C.1, `domain/units/outliers.ts:83-114`) là hàm ĐÚNG, thuần, đã có sẵn.

---

## Phụ lục — Danh sách file đã mở để dựng hợp đồng này

`domain/spatial/types.ts` · `domain/spatial/normalize.ts` · `domain/spatial/ids.ts`
· `domain/units/scale.ts` · `domain/units/compare.ts` · `domain/units/outliers.ts`
· `domain/units/types.ts` · `domain/units/snap.ts` · `domain/units/parse.ts`
· `domain/measure/measure.ts` · `domain/measure/constraints.ts`
· `domain/walls/types.ts` · `domain/walls/edit.ts` · `domain/rules/registry.ts`
· `domain/quality/thresholds.ts` · `domain/rooms/*` (chữ ký export) ·
`domain/axes/*` (chữ ký export) · `domain/openings/validate.ts` (chữ ký export)
· `lib/commands/dispatch.ts` · `lib/commands/createCommand.ts`
· `lib/commands/types.ts` · `lib/commands/business/shared.ts`
· `lib/commands/business/openingCommands.ts` (trích) · `store/commit.ts`
· `hooks/useAutosave.ts` · `hooks/useSaveIndicator.ts`
· `lib/autosave/createAutosave.ts` · `lib/format/semantic.ts`
· `lib/format/number.ts` · `lib/format/measure.ts` · `lib/coloring/modes.ts`
· `lib/coloring/scales.ts` · `lib/input/shortcutRegistry.ts`
· `hooks/useCanvasViewport.ts` · `lib/motion/tokens.ts` · `lib/query/queryKeys.ts`
· `lib/query/cachePolicy.ts` · `lib/query/invalidation.ts`
· `lib/mutations/createOptimisticMutation.ts` · `lib/mutations/undoTicket.ts`
· `lib/mutations/notificationBus.ts` (chữ ký export) · `api/endpoints.ts`
· `api/client.ts` (trích `FloorWriteBody`/`PatchSpatialFloorInput`)
· `lib/testing/expectSevenStates.ts` · `lib/testing/expectAccessible.ts`
· `lib/testing/expectVietnamese.ts` · `lib/testing/expectNoRawColor.ts`
· `lib/testing/render.tsx` · `lib/testing/fakeClock.ts`
· `lib/testing/sevenStateScenarios.ts` · `routes/paths.ts`
· `screens/qc/ObjectLayerReview/objectLayerReviewGateway.ts` (đầy đủ, 1161/2328
dòng đầu — phần liên quan tầng lệnh, đủ cho mục D/E) ·
`screens/qc/WallLayerReview/wallLayerReviewGateway.ts` (trích, mục nợ) ·
`screens/qc/WallLayerReview/useWallLayerReview.ts` (trích, mục tự lưu)
· `screens/qc/ObjectLayerReview/useObjectLayerReview.ts` (trích, phím tắt)
· `screens/pipeline/ScaleCalibration/*` (trích, mẫu hình "vô lý")
· `domain/axes/copyFloor.ts` (trích, xác nhận không có lệnh `dimension.*`)
· `LUAT_MAN_HINH.md` · `CLAUDE.md`
