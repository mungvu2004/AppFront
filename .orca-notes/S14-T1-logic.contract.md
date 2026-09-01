# S14-T1 — Hợp đồng tầng logic cho DimensionOcrReview

Chỉ đọc mã, không sửa file nào ngoài file này. Mọi chữ ký dán NGUYÊN VĂN từ mã đã mở.

---

## KẾT LUẬN NHANH

1. **Mục C (M-02, độ lệch) — NOT FOUND tại thời điểm khảo sát, ĐÃ GIẢI QUYẾT bằng
   phương án A.** Không có hàm nào trong `src/domain` hay `src/lib` nhận hai độ dài
   `Millimetres` (hoặc hai `number` thuần) và trả về độ lệch tương đối lúc T1 khảo sát.
   `compareLevelScales` và `compareScaleToAiEstimate` (`scale.ts:273,348`) đều nhận
   `MillimetresPerPixel` (tỷ lệ mm/px), không phải hai chiều dài đo được. Điều phối
   viên đã duyệt phương án A (ngoại lệ có phạm vi cho R-68): một task riêng **T9** sẽ
   thêm vào `src/domain/units/compare.ts` hàm `compareLengthToMeasured` — chữ ký đầy đủ
   và cách gọi ở mục C bên dưới. **T5 (và bất kỳ ai dùng hợp đồng này) PHẢI gọi hàm đó,
   KHÔNG được tự viết phép chia/trừ để tính độ lệch.**
2. Câu hỏi bắt buộc của mục C đã hỏi điều phối viên; câu trả lời đầy đủ ghi ở mục C
   bên dưới.
3. **Mục D (lệnh `dimension.*`) — KHÔNG CÓ.** Xác nhận đúng như điều phối viên tin:
   không `DIMENSION_COMMAND_TYPES`, không lệnh `dimension.*` nào trong
   `src/lib/commands/business/` (chỉ có `openingCommands.ts`, `roomFloorCommands.ts`,
   `wallCommands.ts`). Khuôn dựng lệnh thiếu bằng `createCommand` + `changeForUpdate`
   đã có tiền lệ ở `objectLayerReviewGateway.ts:850-1058` (ba lệnh
   `OBJECT_CHANGE_KIND_COMMAND_TYPE`, `OBJECT_CHANGE_SWING_COMMAND_TYPE`,
   `OBJECT_APPROVE_COMMAND_TYPE`) — T5 chép đúng khuôn đó cho `dimension.approve` /
   `dimension.override`.
4. **Mục J (endpoint) — THIẾU.** `src/api/endpoints.ts` không có `ENDPOINTS.dimensions`
   hay tương đương; chỉ có `ENDPOINTS.spatial.floor(projectId, floorId)` — nhận
   `Partial<FloorWriteBody>` chung cho cả tầng, không có chỗ riêng cho danh sách kích
   thước. `src/lib/query/queryKeys.ts` cũng không có domain `dimension` nào (`space`,
   `room`, `drawing`, `quality`, `version`, `violation`… nhưng không `dimension`).
   `src/lib/query/invalidation.ts` **đã có** `editDimension` trong `WRITE_OPERATIONS`
   (dòng 10, 30, 68-72) — làm mất hiệu lực `space.byFloor`, `room.byFloor`,
   `violation.byProject` — nhưng đó là *tác dụng phụ* của việc sửa kích thước lên các
   mô hình khác, không phải một cách đọc/ghi trực tiếp danh sách `Dimension`.
5. **Mục L (ngưỡng "giá trị vô lý") — GẦN ĐÚNG, không khớp hoàn toàn.** Không có hàm
   nào nhận MỘT chiều dài rời rạc và trả lời "số này vô lý" theo đúng nghĩa
   `classifyScaleRange` làm với tỷ lệ. Gần nhất: hằng số xuất công khai
   `MIN_WALL_LENGTH_MM = 100`, `MAX_WALL_THICKNESS_MM = 400`
   (`domain/rules/registry.ts:361-364`) và `MIN_ROOM_AREA_M2`
   (`registry.ts:378-387`) — nhưng đây là ngưỡng cho **tường/phòng**, không phải cho
   một chuỗi kích thước bất kỳ, và chúng chỉ chạy qua rule pass (bước 4 của
   `dispatch`), không chạy "ngay khi gõ". `splitOutliers`/`median`
   (`domain/units/outliers.ts`) cần một TẬP hợp số cùng loại để so, không nhận một
   giá trị đơn lẻ.
6. **QĐ-1 (đường dẫn)**: `ROUTE_PATTERNS.projectDimensions` và `ROUTES.project.dimensions`
   **CHƯA TỒN TẠI** trong `src/routes/paths.ts`. Khuôn `projectWalls` /
   `projectObjects` đã có sẵn (dòng 63, 73, 103-104, 115-116) để T5 chép; lưu ý có sẵn
   một `ROUTE_PATTERNS.layerDimensions = '/layers/dimensions'` KHÔNG có tiền tố dự án —
   đây KHÔNG phải cùng route, đừng nhầm lẫn hai cái.
7. **Bẫy kiểu branded quan trọng nhất của cả hợp đồng**: có HAI kiểu `Millimetres`
   khác nhau trong repo — xem mục A và "Cạm bẫy chung" cuối file.
8. **Bẫy hằng số trùng tên khác giá trị**: `MAX_WALL_THICKNESS_MM` tồn tại HAI lần với
   HAI giá trị khác nhau — `domain/walls/types.ts:46` = 600, `domain/rules/registry.ts:364`
   = 400. Xem "Cạm bẫy chung".
9. Không có `dimensionsOfWall` sẵn có trong `shared.ts`; hàm gần nhất tái dùng được là
   `entitiesOfKind(graph, 'dimension')` lọc thủ công theo `referenceIds`, theo đúng
   khuôn `openingsOfWall` (mục A).
10. `useAutosave` (800 ms) và bộ bốn `expect*` đều tồn tại đúng như mong đợi, chữ ký dán
    ở mục E, K.

---

## A. Thực thể kích thước (D-12)

### `Dimension` — `src/domain/spatial/types.ts:216-227`

```ts
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

- `DimensionKind` (`types.ts:213`): `'linear' | 'chain' | 'radial' | 'angular' | 'elevation'`.
- `DimensionId` (`types.ts:86`): `` `M-${string}` ``.
- `referenceIds: readonly EntityId[]` — `EntityId` (`types.ts:89`) là hợp của
  `LevelId | WallId | OpeningId | FurnitureId | RoomId | AxisId | DimensionId`. Không có
  trường riêng `wallIds` — muốn biết một `Dimension` có nhắc tới một `WallId` cụ thể hay
  không phải kiểm `referenceIds.some((id) => id === wallId)` (xem mục A.2 bên dưới).
- `line: Segment` (`types.ts:31-34`): `{ start: Point; end: Point }`, `Point` là
  `{ x: Millimetres; y: Millimetres }` — **không có `z`**, không phải `MeasurePoint` của
  `domain/measure/measure.ts` dù cấu trúc tương thích (xem mục B).
- `valueMm: Millimetres` — giá trị OCR đọc được / dò từ hình học lúc tạo.
- `overrideValueMm?: Millimetres` — giá trị người dùng gõ đè lên. **Đây chính là ô nhập
  của màn**: "chuỗi đọc được" = `valueMm`, số người gõ đè = `overrideValueMm`. Cả hai
  cùng kiểu `Millimetres` của `spatial/types.ts` (xem cảnh báo branded ở dưới).

### `ReviewMetadata` — `src/domain/spatial/types.ts:61-65`

```ts
export interface ReviewMetadata {
  confidence: Confidence;
  source: DataSource;
  reviewed: boolean;
}
```

- **Cờ "đã duyệt": `reviewed: boolean`.** A5 — chỉ người duyệt được đặt `true`. Không có
  lệnh `dimension.*` nào tồn tại để đặt nó (mục D); khuôn đúng là
  `buildApproveObjectCommand` (`objectLayerReviewGateway.ts:1043-1058`) — hàm DUY NHẤT
  đặt `reviewed: true` VÀ LUÔN đặt kèm `source: 'human'` cứng, không tham số nào cho
  phép truyền `source` khác.
- **`confidence: Confidence`** — `Confidence = number` (alias thuần, `types.ts:53`),
  trong `[0, 1]`.
- **`source: DataSource`** — `'ai' | 'human'` (`types.ts:50`).

### Tra kích thước theo tường (`referenceIds` → `WallId`)

**Không có hàm `dimensionsOfWall` sẵn có.** `src/lib/commands/business/shared.ts` có
đúng ba hàm lọc theo khuôn này:

```ts
// shared.ts:135-150
export const entitiesOfKind = <K extends EntityKind>(
  graph: NormalizedSpatial,
  kind: K,
): readonly EntityByKind[K][] => { /* … */ };

// shared.ts:169-170 — khuôn để chép cho dimension
export const openingsOfWall = (graph: NormalizedSpatial, wallId: WallId): readonly GraphOpening[] =>
  entitiesOfKind(graph, 'opening').filter((opening) => opening.wallId === wallId);

// shared.ts:156-160
export const readOf = <K extends EntityKind>(
  graph: NormalizedSpatial,
  kind: K,
  id: IdByKind[K],
): EntityByKind[K] | null => readEntity(graph, kind, id);
```

`openingsOfWall` lọc bằng field trực tiếp (`opening.wallId === wallId`) vì `Opening` có
đúng một tường chủ. `Dimension.referenceIds` là MẢNG (có thể trỏ nhiều thực thể — ví dụ
một kích thước "chuỗi" nối nhiều tường), nên T5 cần viết một hàm tương tự nhưng lọc
bằng `.some()`:

```ts
// Ví dụ gọi đúng — KHÔNG có sẵn, T5 tự viết theo khuôn openingsOfWall:
const dimensionsOfWall = (graph: NormalizedSpatial, wallId: WallId): readonly Dimension[] =>
  entitiesOfKind(graph, 'dimension').filter((dimension) => dimension.referenceIds.some((id) => id === wallId));
```

Đây KHÔNG vi phạm R-61: `entitiesOfKind` và phép `.filter().some()` là truy vấn dữ
liệu (không phải công thức hình học/quy đổi đơn vị), đúng cùng bản chất
`openingsOfWall`/`wallsOnLevel` đã làm.

**Cạm bẫy:** `entitiesOfKind(graph, 'dimension')` trả `readonly EntityByKind['dimension'][]`
— cần `graph: NormalizedSpatial` đã dựng qua `normalizeSpatial`, không phải
`SpatialGraph` thô.

### `NormalizedSpatial` — `dimensions` nằm ở đâu

`src/domain/spatial/normalize.ts:49-55`:

```ts
export interface NormalizedSpatial {
  building: Building;
  byId: Readonly<Record<string, SpatialEntity>>;
  byLevel: Readonly<Record<string, readonly EntityId[]>>;
  byKind: Readonly<Record<EntityKind, readonly EntityId[]>>;
  notes: readonly Note[];
}
```

- Đối tượng `Dimension` thật nằm trong `byId[id]`, ép kiểu qua `isEntityOfKind('dimension', entity)`.
- Danh sách id theo loại: `byKind.dimension: readonly EntityId[]` (thứ tự gốc của mảng
  đầu vào — `normalizeSpatial`, dòng 173-177, gọi `registerId('dimension', dimension.id)`).
- Theo tầng: `byLevel[levelId]` cũng chứa id của `Dimension` (dòng 176:
  `registerOnLevel(dimension.levelId, dimension.id)`) — dùng `idsOnLevel(graph, levelId)`
  (`normalize.ts:230-231`) để lấy tất cả thực thể của một tầng rồi lọc kiểu.

---

## B. Đo lại từ hình học (M-15)

### `centrelineLength` — `src/domain/walls/types.ts:92-95`

```ts
export function centrelineLength(wall: Wall): Millimetres {
  return distanceBetween(wall.centreline.start, wall.centreline.end);
}
```

Nhận `Wall` của `domain/walls/types.ts` (hình học — `centreline: WallCentreline` với
`PointMm`), KHÔNG phải `Wall` của đồ thị (`domain/spatial/types.ts`). Trả về
`Millimetres` **branded** (`Quantity<'mm'>` của `domain/units/types.ts`, vì
`walls/types.ts:24` import `Millimetres` từ `'../units/types'`).

### `measureDistance` — `src/domain/measure/measure.ts:134-141`

```ts
export function measureDistance(from: MeasurePoint, to: MeasurePoint): DistanceMeasurement {
  const [dx, dy, dz] = deltaOf(from, to);
  return {
    kind: 'distance',
    points: [from, to],
    lengthMm: roundLength(Math.hypot(dx, dy, dz)),
  };
}
```

- `MeasurePoint` (`measure.ts:61-66`): `{ x: Millimetres; y: Millimetres; z?: Millimetres }`
  — `z` tuỳ chọn, absent đọc là 0. `Millimetres` ở đây cũng là bản **branded** của
  `domain/units/types.ts` (measure.ts import từ `'../units/types'`).
- Trả về `DistanceMeasurement { kind: 'distance'; points: […]; lengthMm: Millimetres }`
  — luôn có giá trị (không `null`), kể cả hai điểm trùng nhau (= 0).

### `measureChain` — `src/domain/measure/measure.ts:164-187`

```ts
export function measureChain(points: readonly MeasurePoint[]): ChainMeasurement | null {
```

Trả `ChainMeasurement { kind: 'chain'; points; segmentsMm: readonly Millimetres[]; totalMm: Millimetres } | null`
(`null` khi < 2 điểm). `totalMm` = tổng các `segmentsMm` (không tính độc lập), nên
không bao giờ lệch giữa "các đoạn" và "tổng" trên cùng lần gọi.

### Hàm ĐÚNG để lấy "chiều dài đo được từ bản vẽ" của một `Dimension`

`Dimension.line: Segment` có `start`/`end` kiểu `Point` (`{x, y}`, alias `Millimetres`
KHÔNG branded của `spatial/types.ts`). Để gọi `measureDistance` (nhận `MeasurePoint`,
`Millimetres` BRANDED của `units/types.ts`), phải tag qua `millimetres()` trước —
đúng như `shared.ts:273-276` làm cho các phép chuyển đổi khác (`toPointMm`):

```ts
// Ví dụ gọi đúng — ghép từ toPointMm (shared.ts:273-276) + measureDistance:
import { toPointMm } from '@/lib/commands/business/shared';
import { measureDistance } from '@/domain/measure/measure';

const measured = measureDistance(toPointMm(dimension.line.start), toPointMm(dimension.line.end));
// measured.lengthMm — "đo từ bản vẽ 4.812 mm" của đặc tả
```

Với một chuỗi kích thước có nhiều đoạn (`kind: 'chain'`), `referenceIds` trỏ tới nhiều
tường: hàm đúng là `measureChain` trên danh sách điểm suy từ các tường đó (không có
hàm sẵn "measureChainOfDimension" — T5 tự ghép điểm từ `referenceIds` + `toPointMm`).

**Cạm bẫy quan trọng nhất mục B**: `Dimension.line.start`/`.end` là `Point` với
`Millimetres` KHÔNG branded (plain `number` alias). Truyền thẳng vào `measureDistance`
(đòi `MeasurePoint` với `Millimetres` BRANDED) **build vẫn qua** vì TypeScript coi một
`number` gán được vào một type kết hợp `number & Brand` chỉ khi đã qua hàm dựng — thực
ra KHÔNG qua được nếu `exactOptionalPropertyTypes`/structural check chặt; phải kiểm khi
viết code thật. An toàn nhất là LUÔN đi qua `millimetres()` / `toPointMm()` trước khi
gọi bất kỳ hàm nào của `src/domain/measure` hay `src/domain/units`.

---

## C. Độ lệch (M-02) — mục quan trọng nhất

**KẾT LUẬN: NOT FOUND tại thời điểm T1 khảo sát — ĐÃ GIẢI QUYẾT bằng phương án A, do
task T9 thực hiện (T1 KHÔNG được tự sửa `src/domain`).** Đã quét toàn bộ `src/domain` và `src/lib`, thử cụ thể:
`domain/units/compare.ts`, `domain/units/outliers.ts`, `domain/measure/constraints.ts`,
`domain/quality/` (`index.ts`, `thresholds.ts`), `lib/format/number.ts`,
`lib/format/measure.ts`, `lib/format/semantic.ts`, `lib/coloring/modes.ts`,
`lib/coloring/scales.ts`. Không hàm nào nhận hai độ dài `Millimetres` (hoặc hai
`number` thuần) và trả về độ lệch tương đối.

Hai hàm điều phối viên đã tìm thấy đều nhận `MillimetresPerPixel`, KHÔNG phải hai
chiều dài:

```ts
// src/domain/units/scale.ts:273
export function compareLevelScales(levels: readonly LevelScale[]): readonly LevelScaleWarning[]
// LevelScale.millimetresPerPixel: MillimetresPerPixel — một TỶ LỆ, không phải một độ dài.

// src/domain/units/scale.ts:348
export function compareScaleToAiEstimate(
  manualRatio: MillimetresPerPixel,
  aiEstimatedRatio: MillimetresPerPixel,
): ScaleAiDeviation
```

`SCALE_THRESHOLDS.levelAgreementLimit = 0.02` (`scale.ts:44`) và
`SCALE_THRESHOLDS.aiDeviationLimit = 0.15` (`scale.ts:66`) đều là ngưỡng cho SO SÁNH
TỶ LỆ (mm/px), không phải ngưỡng 2% mà đặc tả T-01 muốn cho "chuỗi đọc được vs đo từ
bản vẽ". Không có hằng số nào tên `dimensionAgreementLimit` hay tương đương trong
`SCALE_THRESHOLDS` hay bất kỳ module nào khác đã quét.

Gần nhất về HÌNH DẠNG (không phải công dụng): `formatPercent` (`lib/format/number.ts:225`)
CHỈ định dạng một tỷ lệ ĐÃ tính sẵn thành chuỗi — không tự tính tỷ lệ đó.
`compareScaleToAiEstimate` là khuôn code gần nhất để chép (trừ dữ liệu vào), vì nó
cũng trả `{ relativeDeviation, exceedsLimit }` — đúng hình dạng T5 cần cho
"lệch 0,25%", chỉ khác input là hai `Millimetres` thay vì hai `MillimetresPerPixel`.

### Câu hỏi đã hỏi điều phối viên và câu trả lời

Câu hỏi: "M-02: không có hàm nào nhận hai độ dài mm để tính lệch tương đối. Chọn
phương án?" — hai lựa chọn:
- A — thêm hàm vào domain bằng prompt logic riêng.
- B — gateway nhận độ lệch như dữ liệu từ read model.

**Trả lời của điều phối viên (nguyên văn, đã dịch dấu):** "QUYẾT ĐỊNH: phương án A.
Người duyệt đã chấp thuận một ngoại lệ có phạm vi cho R-68.

Một task riêng (T9) sẽ thêm vào `src/domain/units/compare.ts`:
```ts
export interface LengthDeviation { readonly relativeDeviation: number; readonly exceedsLimit: boolean }
export function compareLengthToMeasured(readValue: Millimetres, measuredValue: Millimetres): LengthDeviation
```
Ngưỡng 2% TÁI SỬ DỤNG `SCALE_THRESHOLDS.levelAgreementLimit` (= 0.02) của
`src/domain/units/scale.ts`, KHÔNG khai lại hằng số mới.

Việc của BẠN (T1) bây giờ:
1. Ghi kết luận mục C trong `.orca-notes/S14-T1-logic.contract.md` là: NOT FOUND ở thời
   điểm khảo sát, đã được giải quyết bằng phương án A, và dán đúng chữ ký trên để T5
   gọi lại.
2. Ghi rõ T5 PHẢI gọi `compareLengthToMeasured` và KHÔNG được tự viết phép chia nào.
3. Làm nốt các mục còn lại (A,B,D..L) rồi commit và gửi worker_done kèm số liệu thật.
BẠN KHÔNG được tự sửa `src/domain` — T9 làm việc đó."

### KHUÔN GỌI CHO T5 — bắt buộc, KHÔNG được tự viết phép chia thay thế

`compareLengthToMeasured` **CHƯA TỒN TẠI trong mã tại thời điểm T1 nộp hợp đồng này**
— nó sẽ do **T9** thêm vào `src/domain/units/compare.ts` (file T1 đã đọc ở mục B, hiện
mới có `nearlyEqual`/`compareNearly`/`nearlyEqualLength`/`nearlyEqualPoint`/
`nearlyEqualAngle`, KHÔNG có `compareLengthToMeasured` — xem nội dung đầy đủ đã dán ở
mục B). T5 **PHẢI đợi T9 xong** trước khi cắm màn vào hàm này; T5 không được tự dựng
một bản tạm/stub trong màn để "chạy trước" (vi phạm R-69 — cấm stub).

Chữ ký T9 sẽ tạo, T5 gọi lại NGUYÊN VĂN:

```ts
// src/domain/units/compare.ts (T9 thêm)
export interface LengthDeviation {
  readonly relativeDeviation: number;
  readonly exceedsLimit: boolean;
}

export function compareLengthToMeasured(
  readValue: Millimetres,
  measuredValue: Millimetres,
): LengthDeviation;
```

Ví dụ gọi đúng cho câu "chuỗi đọc được 4.800 mm · đo từ bản vẽ 4.812 mm · lệch 0,25%":

```ts
import { compareLengthToMeasured } from '@/domain/units/compare';
import { millimetres } from '@/domain/units/types';

const deviation = compareLengthToMeasured(
  millimetres(dimension.overrideValueMm ?? dimension.valueMm), // "chuỗi đọc được"
  measureDistance(toPointMm(dimension.line.start), toPointMm(dimension.line.end)).lengthMm, // "đo từ bản vẽ", mục B
);
// deviation.relativeDeviation — dạng 'ratio' (0,0025 = 0,25%), format bằng formatPercent() (mục G)
// deviation.exceedsLimit — true khi |relativeDeviation| > SCALE_THRESHOLDS.levelAgreementLimit (0,02 = 2%)
```

Ngưỡng 2% mà đặc tả T-01 đòi ("chỉ tô màu khi thật sự đáng kể") CHÍNH LÀ
`SCALE_THRESHOLDS.levelAgreementLimit` của `src/domain/units/scale.ts:44` — T9 tái sử
dụng hằng này, KHÔNG khai một hằng `dimensionAgreementLimit` mới. T5 tô màu độ lệch
dựa trên `deviation.exceedsLimit`, KHÔNG tự so `Math.abs(x) > 0.02` bằng tay (đó là
việc R-71 cấm: hằng ngưỡng viết tay trong màn).

---

## D. Tầng lệnh (S-07 + S-05)

### `dispatch` / `runCommandPipeline` — `src/lib/commands/dispatch.ts`

Năm bước cố định, xuất bởi `DISPATCH_STAGES` (`dispatch.ts:72-78`):

```ts
export const DISPATCH_STAGES = ['validate', 'apply', 'history', 'rules', 'sync'] as const;
```

```ts
// dispatch.ts:700-704
export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult> {
  return runExclusive(SPATIAL_PIPELINE_KEY, () =>
    runCommandPipeline({ commands: [command], label: command.description }, deps),
  );
}
```

`DispatchDeps` (`dispatch.ts:156-163`):

```ts
export interface DispatchDeps {
  readonly spatial: SpatialPort;
  readonly history: HistoryPort;
  readonly rules: RulesPort;
  readonly sync: SyncPort;
  readonly now?: () => string;
}
```

`SpatialPort` (`dispatch.ts:124-129`):

```ts
export interface SpatialPort {
  read: () => NormalizedSpatial | null;
  applyPatches: (patches: readonly SpatialPatch[]) => void;
}
```

`HistoryPort` (`dispatch.ts:132-136`):

```ts
export interface HistoryPort {
  push: (entry: UndoEntry) => void;
  drop: (entryId: UndoEntryId) => void;
}
```

`RulesPort` (`dispatch.ts:145-148`):

```ts
export interface RulesPort {
  run: (graph: NormalizedSpatial, changes: readonly ChangedEntity[]) => RuleRunResult;
  write: (result: RuleRunResult) => void;
}
```

`SyncPort` (`dispatch.ts:151-153`):

```ts
export interface SyncPort {
  enqueue: (batch: DispatchBatch) => MaybePromise<void>;
}
```

### `createCommand` — `src/lib/commands/createCommand.ts:128-142`

```ts
export const createCommand = (input: CommandInput): Command => { /* … */ };
```

`CommandInput` (`createCommand.ts:18-28`):

```ts
export interface CommandInput {
  type: CommandType;
  actorId: string;
  description: string;
  changes: readonly EntityChange[];
  id?: CommandId;
  timestamp?: string;
}
```

### `changeForUpdate` — `src/lib/commands/createCommand.ts:52-62`

```ts
export const changeForUpdate = <K extends EntityKind>(
  kind: K,
  before: EntityByKind[K],
  after: EntityByKind[K],
): EntityChangeOfKind<K> => { /* … */ };
```

Ném lỗi nếu `before.id !== after.id`. Cách dựng một lệnh tự hoàn tác được: mang ĐỦ ảnh
`before`/`after` (không phải diff từng trường) — `invertCommand` chỉ hoán đổi hai ảnh
đó, không cần thêm dòng nào cho Ctrl+Z. Ví dụ gọi đúng (khuôn `buildApproveObjectCommand`,
`objectLayerReviewGateway.ts:1043-1058`):

```ts
export function buildApproveDimensionCommand(before: Dimension, actorId: string): Command {
  return createCommand({
    type: DIMENSION_APPROVE_COMMAND_TYPE, // hằng tự đặt, khuôn OBJECT_APPROVE_COMMAND_TYPE
    actorId,
    description: `Duyệt kích thước ${before.id}.`,
    changes: [changeForUpdate('dimension', before, { ...before, reviewed: true, source: 'human' })],
  });
}
```

### `src/lib/commands/business/shared.ts` — `CommandContext`, `buildCommand`, `refuse`, `accept`, `AUTHORED_BY_HAND`

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
): Command => { /* … */ };

// shared.ts:104-108
export const refuse = (type: CommandType, reasons: readonly string[]): CommandResult => { /* … */ };

// shared.ts:111
export const accept = (command: Command): CommandResult => ok(command);

// shared.ts:124-128
export const AUTHORED_BY_HAND = {
  confidence: 1,
  source: 'human',
  reviewed: false,
} as const;
```

### `DIMENSION_COMMAND_TYPES` / lệnh `dimension.*` — XÁC NHẬN KHÔNG CÓ

Đã grep toàn repo: không có `DIMENSION_COMMAND_TYPES` hay chuỗi `'dimension.'` nào
trong `src/lib/commands/business/`. Thư mục đó chỉ có ba file:
`openingCommands.ts`, `roomFloorCommands.ts`, `wallCommands.ts`, `shared.ts`.

**Khuôn `objectLayerReviewGateway.ts` để chép nguyên văn (T5):**

```ts
// objectLayerReviewGateway.ts:857-863
export const OBJECT_CHANGE_KIND_COMMAND_TYPE = 'opening.changeKind';
export const OBJECT_CHANGE_SWING_COMMAND_TYPE = 'opening.changeSwing';
export const OBJECT_APPROVE_COMMAND_TYPE = 'opening.approve';
```

```ts
// objectLayerReviewGateway.ts:1043-1058
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

Lý lẽ hợp lệ (nguyên văn ghi chú tại chỗ, dòng 833-847 và 17-30): `CommandType` là
`string` mở, `validateCommands` (`dispatch.ts:220-328`) chỉ kiểm `command.type` khác
rỗng chứ không so với bảng cho phép — nên một lệnh dựng bằng `createCommand` +
`changeForUpdate` là hợp lệ dù không có mặt trong một danh sách lệnh S-07 nào.

### `commit` — `src/store/commit.ts:17-39`

```ts
export function commit(
  patch: SpatialPatch | readonly SpatialPatch[],
  label: string
): CommitResult {
  // …
}
```

`CommitResult` (`commit.ts:4-8`): `{ undo: () => void; label: string; timestamp: number }`.

**`createCommitSpatialPort` KHÔNG nằm ở `src/store/commit.ts`** — nó là một adapter cấp
màn hình, đã có sẵn ở `objectLayerReviewGateway.ts:1076-1086` (và bản anh em ở
`wallLayerReviewGateway.ts`), khuôn để T5 chép nguyên:

```ts
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

Đây là đường ghi A10 hợp lệ: `SpatialPort.applyPatches` gọi `commit()`, không nơi nào
gọi `set()` hay `_applyPatches()` trực tiếp.

---

## E. Tự lưu (D-07)

### `useAutosave` — `src/hooks/useAutosave.ts:18`

```ts
const AUTOSAVE_DEBOUNCE_MS = 800; // dòng 11 — hằng duy nhất, invariant A7

export function useAutosave(onSave: (data: RootState['spatial']) => Promise<void>) {
  // … trả về saveLabel: string | null, ví dụ "Đã lưu lúc 14:32"
}
```

800 ms là hằng **cục bộ** của chính file này (`AUTOSAVE_DEBOUNCE_MS`), khai là "invariant
A7 itself, not a movement — must never be pulled onto the motion ladder" — nghĩa là
KHÔNG lấy từ `MOTION_DURATIONS_MS` (nó không phải một chuyển động UI, nó là chính sách
tự lưu).

**Lưu ý:** có MỘT bản autosave thứ hai, đầy đủ trạng thái hơn: `src/lib/autosave/createAutosave.ts`
(`Autosave`, `AutosaveState`), và `useSaveIndicator` đọc từ đó, KHÔNG từ `useAutosave.ts`.
Hai cơ chế này KHÔNG dùng chung — T5 cần xác định màn dùng cơ chế nào (khuôn
S-13/WallLayerReview để xem cơ chế nào các màn QC khác đang dùng thật, không đoán).

### `useSaveIndicator` — `src/hooks/useSaveIndicator.ts:72`

```ts
export function useSaveIndicator(autosave: Autosave, options: UseSaveIndicatorOptions = {}): SaveIndicatorResult
```

`SaveIndicatorResult` (`useSaveIndicator.ts:8-12`): `{ detail: string; label: string; state: AutosaveState }`.

A7 "nói ra trạng thái đó cho trình đọc màn hình": dòng 116-124 — khi trạng thái đổi
sang `'saved'`, gọi `announcer.announce(result.detail)` (lời nói bình thường, polite);
khi đổi sang `'failed'` hoặc `'offline'`, gọi `announcer.announce(result.label, 'assertive')`
(ngắt lời). `dirty`/`saving` KHÔNG được thông báo (tránh đọc mỗi phím gõ) — chỉ những
LƯỢT CHUYỂN trạng thái mới được nói, trạng thái đã có sẵn lúc mount thì không.

---

## F. Màu độ tin cậy (P-06)

### `src/lib/format/semantic.ts`

```ts
// dòng 40-41
export const CONFIDENCE_CERTAIN_THRESHOLD = 0.9;
export const CONFIDENCE_SUGGESTED_THRESHOLD = 0.7;

// dòng 79-90
export function confidenceLevel(value: MaybeNumber): ConfidenceLevel {
  if (!isFormattable(value)) return 'unknown';
  if (value >= CONFIDENCE_CERTAIN_THRESHOLD) return 'certain';
  if (value >= CONFIDENCE_SUGGESTED_THRESHOLD) return 'suggested';
  return 'needsReview';
}

// dòng 73-76
export function describeConfidence(value: MaybeNumber): ConfidenceDescription {
  const level = confidenceLevel(value);
  return { level, label: CONFIDENCE_LABELS[level] };
}
```

`ConfidenceLevel = 'certain' | 'suggested' | 'needsReview' | 'unknown'` — CHỈ bốn mức
này, hai ngưỡng 0,9 và 0,7 cho ra ba mức có giá trị + `unknown`.

### Ngưỡng "độ tin cậy thấp" cho bộ lọc của đặc tả

Hai ngưỡng có sẵn của `confidenceLevel` (0,90 và 0,70) **KHÔNG** cho ra đúng số mục mà
đặc tả/nghiệm thu đếm (đây là bài học từ S-13, ghi nguyên văn ở
`objectLayerReviewGateway.ts:309-323`): dùng chúng làm bộ lọc "cần chú ý" sẽ ra một con
số KHÁC con số đặc tả đòi in ra. Tiền lệ `OBJECT_LAYER_CONFIDENCE_THRESHOLD`:

```ts
// objectLayerReviewGateway.ts:324-328
export const OBJECT_LAYER_CONFIDENCE_THRESHOLD = 0.75;

export const isLowConfidenceObject = (confidence: number): boolean =>
  confidence < OBJECT_LAYER_CONFIDENCE_THRESHOLD;
```

Đây là NGƯỠNG SẢN PHẨM riêng của MỘT màn, đặt tên ĐÚNG MỘT CHỖ theo R-71, không phải
băng của `confidenceLevel`. Nếu đặc tả T-01 cũng đếm ra một số cụ thể cho "độ tin cậy
thấp", T5 phải kiểm bộ mẫu của chính DimensionOcrReview trước khi quyết ngưỡng nào cho
ra đúng số đó — **không suy đoán, không dùng lại 0,75 mặc định nếu chưa kiểm**. Câu hỏi
màu (khác câu hỏi lọc) vẫn luôn đi qua `confidenceLevel`/`describeConfidence`.

### `src/lib/coloring/modes.ts` + `scales.ts`

```ts
// modes.ts — bảy chế độ, không có chế độ riêng cho "dimension"; gần nhất là
// aiConfidence (theo review.confidence, mọi PaintSubject không phân biệt loại thực thể).
export const COLORING_MODE_IDS = [
  'default', 'roomUsage', 'area', 'aiConfidence', 'reviewState', 'violationSeverity', 'level',
] as const;

// scales.ts:345-349
export function createLookupScale<Key extends string>(
  table: Readonly<Record<Key, ColorTokenName>>,
): (key: Key | null | undefined) => ColorTokenName { /* … */ }
```

`ColorTokenName` (`scales.ts:135`): union đóng của các tên biến CSS trong
`COLOR_TOKEN_NAMES` (`scales.ts:62-129`). `createQuantileScale` (`scales.ts:308-332`)
cắt tối đa `MAX_SCALE_STEPS = 5` bậc theo tứ phân vị của TẬP dữ liệu đang xem — dùng
được cho độ tin cậy của các `Dimension` nếu T5 muốn tô theo `aiConfidence` giống các
màn QC khác, KHÔNG cần dựng lại `PaintSubject` mới (đã có sẵn `review: ReviewMetadata`
field khớp thẳng với `Dimension`).

---

## G. Định dạng số (P-01)

### `src/lib/format/number.ts`

```ts
// dòng 201-211
export function formatNumber(value: MaybeNumber, options: NumberFormatOptions = {}): string

// dòng 225-239
export function formatPercent(value: MaybeNumber, options: PercentFormatOptions = {}): string

// dòng 255-266
export function parseNumber(text: string): number | undefined
```

`PercentSource` (`number.ts:76`): `'ratio' | 'percent'` — mặc định `'ratio'` đọc `0.125`
là `"12,5%"`; `'percent'` đọc `12.5` (đã nhân 100 sẵn) là `"12,5%"`. Với độ lệch M-02
(một khi mục C có đường), giá trị `relativeDeviation`/`relativeDifference` mà các hàm
`compare*` của `scale.ts` trả về là dạng `'ratio'` (0,02 = 2%) — dùng
`formatPercent(value)` mặc định, KHÔNG cần `{ source: 'percent' }`.

### `src/lib/format/measure.ts`

```ts
// dòng 108-121
export function formatLength(valueMm: MaybeNumber, options: LengthFormatOptions = {}): string
```

`LengthFormatOptions.unit?: 'mm' | 'm'` — cấm CẤM TUYỆT ĐỐI của đặc tả nói "đơn vị là mm
cố định hiển thị bên phải ô": gọi `formatLength(value, { unit: 'mm' })` (ép mm, không để
`formatLength` tự chọn theo độ lớn) là cách đúng để giữ "mm cố định" mà đặc tả đòi,
KHÔNG viết `` `${value} mm` `` thủ công.

### `src/domain/units/parse.ts`

```ts
// dòng 206
export function parseLength(input: string, options: ParseLengthOptions = {}): ParseLengthResult
```

`ParseLengthResult = { ok: true; value: Millimetres } | { ok: false; error: 'unreadable' }`.
`ParseLengthOptions.defaultUnit?: 'mm' | 'cm' | 'dm' | 'm'` (mặc định `'mm'`). Đọc được cả
dấu phẩy thập phân Việt Nam, dấu chấm phân nhóm nghìn, và đơn vị hậu tố
(`"4,8 m"`, `"4800"`, `"3.500"`).

### A15 — định dạng ở viewmodel, dấu thập phân là dấu phẩy

`formatNumber`/`formatPercent` dùng `Intl.NumberFormat('vi-VN', …)` (`number.ts:36`,
`169-187`) — đây LÀ hàm lo việc đó; không viewmodel nào tự viết dấu phẩy/chấm tay.
`sharedLengthUnit` (`semantic.ts:179-182`) là ví dụ một hàm viewmodel dùng lại
`formatLength` đúng cách (chọn đơn vị theo giá trị lớn hơn giữa hai vế một thay đổi).

---

## H. Phím tắt (I-01, I-02)

### `src/lib/input/shortcutRegistry.ts`

```ts
// dòng 354-356
export function createShortcutRegistry(options: ShortcutRegistryOptions = {}): ShortcutRegistry

// dòng 200-217
export interface ShortcutDefinition {
  readonly id: string;
  readonly combo: string;
  readonly scope: ShortcutScope;
  readonly description?: string;
  readonly allowRepeat?: boolean;
  readonly preventDefault?: boolean;
  onTrigger(event: ShortcutKeyEvent): void;
}

// dòng 53
export type ShortcutScope = 'dialog' | 'sidePanel' | 'canvas' | 'global';

// dòng 110-157
export function parseCombo(combo: string): ParsedCombo
```

Đăng ký/huỷ: KHÔNG gọi `createShortcutRegistry`/`registry.register` trực tiếp trong màn
— cửa vào React là `useShortcut` (`src/hooks/useShortcut.ts:91-129`):

```ts
export function useShortcut(definition: ShortcutDefinition, options: UseShortcutOptions = {}): void
```

Huỷ đăng ký tự động khi component unmount (cleanup effect gọi `unregister()` +
`release()` — dòng 124-127 của `useShortcut.ts`).

### A12 — Esc đóng lớp trên cùng

`shortcutRegistry.ts:475-479`: một scope MODAL (chỉ `'dialog'`, tập `MODAL_SCOPES`) nuốt
mọi phím nó không bind, TRỪ `Escape` — `Escape` luôn rơi xuống scope `global` để chạm
`handlers.closeTopLayer()` (`buildGlobalShortcuts`, dòng 636-644), bất kể dialog nào
đang mở. Đây là cơ chế đảm bảo A12, không phải quy ước T5 phải tự cài đặt lại.

### Khuôn đăng ký của S-13 (`useObjectLayerReview.ts:1121-1209`)

```ts
useShortcut(
  {
    id: 'objectLayerReview.layer.door',
    combo: 'D',
    scope: 'canvas',
    description: OBJECT_LAYER_TEXT.shortcutLayer,
    onTrigger: () => onSelectLayer('door'),
  },
  { ...shortcutOptions, enabled: canEdit },
);
// … và một binding combo: 'Escape', scope: 'canvas', onTrigger: () => onSelect(null),
//   { ...shortcutOptions, enabled: selectedObjectId !== null } — đóng thanh tra khi có
//   đối tượng đang chọn, không cần claim scope 'dialog' vì đây không phải hộp thoại.
```

`id` phải là chuỗi duy nhất theo khuôn `<tênMàn>.<hànhĐộng>` (ví dụ
`dimensionOcrReview.approve`), KHÔNG trùng với bất kỳ `id` nào của màn khác — registry
chỉ cảnh báo trùng (`warn`) trong cùng MỘT `scope`, không chặn build.

---

## I. Bay khung nhìn (R-07)

### `useCanvasViewport` — `src/hooks/useCanvasViewport.ts:81`

```ts
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

`ContentBounds` (`useCanvasViewport.ts:17-22`): `{ minX; minY; maxX; maxY }` (số thuần,
KHÔNG branded).

`FlyToBoundsOptions` (`useCanvasViewport.ts:24-38`):

```ts
export interface FlyToBoundsOptions {
  readonly padding?: number; // mặc định 40 px
  readonly reducedMotion?: boolean;
  readonly scheduler?: FrameScheduler;
}
```

`ViewportState` (`useCanvasViewport.ts:11-15`): `{ x: number; y: number; zoom: number }`.

`flyToBounds` chạy trên slot `'slow'` (340 ms, decelerate) của hệ chuyển động —
KHÔNG phải 260 ms. Ví dụ gọi đúng (khuôn `useScaleCalibration.ts:729-752`, chọn một
hàng kích thước rồi bay tới hộp bao của nó):

```ts
const min = toPixelPoint(currentFrame, row.boundingBox.min);
const max = toPixelPoint(currentFrame, row.boundingBox.max);
flyToBounds({ minX: min.x, minY: min.y, maxX: max.x, maxY: max.y }, size.width, size.height);
```

---

## J. Trạng thái máy chủ (R-64)

### `src/lib/query/queryKeys.ts:66-132`

```ts
export const queryKeys = {
  drawing: { byFloor: (floorId: string) => […] },
  floor: { detail: (floorId: string) => […], list: (projectId: string) => […] },
  project: { detail, list, members },
  quality: { assessment: (floorId: string) => […] },
  room: { byFloor: (floorId: string) => […] },
  space: { byFloor: (floorId: string) => […] },
  user: { current, list },
  version: { byFloor: (floorId: string) => […] },
  violation: { byProject: (projectId: string) => […] },
  library: { detail, list },
  progress: { byFloor: (floorId: string) => […] },
} as const;
```

**Không có `queryKeys.dimension`.** Domain gần nhất là `queryKeys.space.byFloor(floorId)`
(dữ liệu không gian đang sửa nói chung) hoặc `queryKeys.room.byFloor(floorId)` — T5
phải hỏi/quyết xem kích thước đọc chung khoá với `space` hay cần một domain
`dimension` riêng (nợ mới, cần một prompt logic bổ sung nếu T5 quyết định vậy — theo
đúng R-69, không tự thêm domain vào `queryKeys.ts` vì đó là `src/lib`, ngoài phạm vi
sửa của màn).

### `src/lib/query/cachePolicy.ts:25-71`

```ts
export const CACHE_POLICY_TIERS = ['default', 'static', 'aiProgress', 'spatialDraft'] as const;
export const CACHE_POLICY = {
  default: { gcTime: 600_000, staleTime: 30_000 },
  branches: { static: 300_000, aiProgress: 0, spatialDraft: 10_000 },
  retry: { query: 1, mutation: 0 },
} as const;

export function resolveCachePolicy(queryKey: QueryKey): ResolvedCachePolicy
```

`TIER_BY_DOMAIN` (`cachePolicy.ts:77-84`) map domain đầu tiên của query key → tier;
domain không có trong bảng rơi về `'default'` (30s stale). Không có domain `dimension`
trong bảng này — nếu T5 tạo `queryKeys.dimension`, nó sẽ mặc định tier `'default'` trừ
khi được thêm vào `TIER_BY_DOMAIN` (sửa `src/lib` — ngoài phạm vi T5, cần hỏi).

### `src/lib/query/invalidation.ts`

```ts
// dòng 5-16
export const WRITE_OPERATIONS = [
  'createProject', 'editFloor', 'editWall', 'moveFurniture', 'editDimension',
  'changeAxis', 'rerunRules', 'restoreVersion', 'straightenDrawing', 'setDrawingCorners',
] as const;

// dòng 68-72 — ĐÃ CÓ SẴN cho editDimension
editDimension: ({ projectId, floorId }) => [
  queryKeys.space.byFloor(floorId),
  queryKeys.room.byFloor(floorId),
  queryKeys.violation.byProject(projectId),
],

// dòng 122-132
export function applyInvalidation<TOperation extends WriteOperation>(
  queryClient: QueryClient,
  operation: TOperation,
  params: WriteOperationParamsMap[TOperation],
): void
```

`editDimension` đã tồn tại và làm mất hiệu lực đúng ba khoá khi một kích thước bị sửa
— T5 gọi `applyInvalidation(queryClient, 'editDimension', { projectId, floorId })` sau
khi lệnh `dimension.override`/`dimension.approve` chạy qua `dispatch` thành công, KHÔNG
tự viết `invalidateQueries` rời rạc.

### `createOptimisticMutation` — `src/lib/mutations/createOptimisticMutation.ts:67-75`

```ts
export function createOptimisticMutation<TVariables, TResult>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TVariables, TResult>,
): UseMutationOptions<TResult, AppError, TVariables>
```

`OptimisticMutationConfig` (`createOptimisticMutation.ts:8-21`): `affectedKeys`,
`afterSuccess`, `applyOptimistic`, `callServer`, `entityId`, `rollback` — sáu trường,
tất cả bắt buộc.

### `notificationBus` — `src/lib/mutations/notificationBus.ts:79`

```ts
export function createNotificationBus(options: CreateNotificationBusOptions = {}): NotificationBus
```

`NotificationBus.publish(input: NotificationInput): void` — nhóm các publish CÙNG
`type` trong `groupWindowMs` (mặc định 5000 ms) thành MỘT thông báo có ticket hoàn tác
gộp (`buildGroupedTicket`).

### `UndoTicket`/`createUndoTicket` — `src/lib/mutations/undoTicket.ts:45`

```ts
export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket
```

`UNDO_WINDOW_MS = 8000` (dòng 18) — cửa sổ hoàn tác 8 giây của A8, nguồn DUY NHẤT của
con số này (dùng chung bởi `useUndoableToast`, `components/feedback/Toast`, và ticket).
`UndoTicket.undo()` trả `Result<void, 'expired'>` — gọi sau khi hết hạn không chạy hành
động, trả lỗi `'expired'`.

### `src/api/endpoints.ts` — endpoint kích thước

**KHÔNG CÓ.** `ENDPOINTS` (`endpoints.ts:18-82`) có các nhóm `auth`, `drawings`,
`featureFlags`, `floors`, `projects`, `quality`, `spatial` — KHÔNG có `dimensions`.
Gần nhất: `ENDPOINTS.spatial.floor(projectId, floorId)` (dòng 77-78) — patch CHUNG cho
cả tầng, không có tham số riêng cho danh sách `Dimension`.

Khuôn nợ để ghi (kiểu `OBJECT_LAYER_MISSING_ENDPOINTS`,
`objectLayerReviewGateway.ts:223-228`):

```ts
export const DIMENSION_REVIEW_MISSING_ENDPOINTS = {
  persistDimensionLayer:
    'ENDPOINTS.spatial.floor chấp nhận Partial<FloorWriteBody>, không có chỗ cho danh sách Dimension riêng — chưa có endpoint ghi kích thước.',
} as const;
```

---

## K. Bộ khẳng định

`src/lib/testing/`:

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

`ScreenRenderer = (scenario: SevenStateScenario) => ScreenRenderResult` (`expectSevenStates.ts:46`,
`38-44`) — `renderScreen` là một hàm callback, KHÔNG phải kết quả render sẵn.
`expectAccessible`/`expectVietnamese` nhận `TestSubject` (container hoặc kết quả render
`@testing-library/react`) trực tiếp, không cần callback. `render`, `fixtures`,
`fakeClock`, `sevenStateScenarios` là các file phụ trợ cùng thư mục
(`src/lib/testing/render.ts`, `fixtures.ts`, `fakeClock.ts`, `sevenStateScenarios.ts` —
chưa mở, chỉ xác nhận sự tồn tại qua các import ở nơi khác).

---

## L. Giá trị vô lý (gợi ý khi gõ số hàm ý "phòng dài 30 mét")

**KẾT LUẬN: GẦN ĐÚNG, không có hàm khớp hoàn toàn.** Không tồn tại một hàm dạng
`classifyLengthPlausibility(valueMm): 'inRange' | 'implausible'` cho một chiều dài ĐƠN
LẺ bất kỳ — khác với `classifyScaleRange` (`scale.ts:321-329`) vốn làm đúng việc này
cho một TỶ LỆ.

### `src/domain/rules/registry.ts` — hằng số xuất công khai

```ts
// dòng 361-364
export const MIN_WALL_THICKNESS_MM = 60;
export const MAX_WALL_THICKNESS_MM = 400; // ⚠️ khác giá trị với domain/walls/types.ts, xem "Cạm bẫy chung"
export const MIN_WALL_LENGTH_MM = 100;
export const MIN_DOOR_WIDTH_MM = 700;

// dòng 378-387
export const MIN_ROOM_AREA_M2: Readonly<Record<RoomUsage, number>> = { livingRoom: 12, bedroom: 9, … };
```

Các hằng này CHỈ áp dụng qua `Rule.check` bên trong `wallThicknessRule`, `wallLengthRule`,
`roomMinAreaRule` (đã đăng ký trong `BUILT_IN_RULES`, dòng 663-672) — chạy khi bước 4
(`rules`) của `dispatch` re-run sau khi một lệnh ĐÃ commit, KHÔNG chạy "ngay khi gõ" vào
một ô nhập còn chưa xác nhận. Không có bản xuất riêng dạng hàm thuần
(`isWallLengthPlausible(valueMm): boolean`) tách khỏi `Rule.check` — muốn dùng NGAY khi
gõ, T5 phải TỰ so sánh giá trị gõ với các hằng số ĐÃ XUẤT này (import trực tiếp, không
viết số thô — hợp lệ theo R-71 vì hằng có nguồn), ví dụ:

```ts
import { MIN_WALL_LENGTH_MM, MAX_WALL_THICKNESS_MM } from '@/domain/rules/registry';

const isImplausibleWallDimension = (valueMm: number): boolean =>
  valueMm < MIN_WALL_LENGTH_MM || valueMm > MAX_WALL_THICKNESS_MM * 75; // ví dụ minh hoạ — KHÔNG có hằng "MAX_ROOM_LENGTH_MM" sẵn có
```

**Không có hằng "chiều dài phòng tối đa" nào** tương ứng ví dụ "phòng dài 30 mét" của
đặc tả — `MIN_ROOM_AREA_M2` chỉ giới hạn DIỆN TÍCH tối thiểu, không giới hạn CHIỀU DÀI
tối đa. Đây là một khoảng trống thật, không phải do quét thiếu.

### `src/domain/units/outliers.ts` — `splitOutliers`, `median`

```ts
// dòng 39-54
export function median(values: readonly number[]): number | null

// dòng 83-114
export function splitOutliers(values: readonly number[], threshold: number): OutlierSplit
```

`OutlierSplit` (`outliers.ts:27-36`): `{ keptIndices; rejectedIndices; median; absoluteDeviation }`.
Cả hai hàm nhận một MẢNG số cùng loại (ví dụ nhiều chuỗi kích thước OCR đọc trên cùng
bản vẽ, như `inferScale` dùng cho các tỷ lệ ứng viên, `scale.ts:206-207`) — KHÔNG nhận
một giá trị đơn lẻ, nên không trực tiếp trả lời "giá trị NÀY vô lý" cho một ô đang gõ
dở, chỉ trả lời "giá trị này lệch khỏi TẬP các giá trị khác đã có".

### `src/domain/measure/constraints.ts`

Chỉ có `ORTHOGONAL_LOCK_STEP_DEG` (90°) và `DIRECTION_LOCK_STEP_DEG` (45°) — hằng góc
cho khoá trục khi kéo (Shift), KHÔNG có ngưỡng "giá trị vô lý" nào cho chiều dài.

### Kết luận đề xuất cho T5

Không có "hàm phán vô lý cho một dimension" sẵn có. Gần nhất theo NGỮ CẢNH của
`Dimension.referenceIds`:
- nếu `referenceIds` trỏ một `WallId` → so `overrideValueMm` với
  `MIN_WALL_LENGTH_MM`/`MAX_WALL_THICKNESS_MM` (`rules/registry.ts`) — lưu ý đây là
  ngưỡng CHIỀU DÀI TƯỜNG, không phải ngưỡng riêng cho "kích thước ghi chú".
- nếu `referenceIds` trỏ một `RoomId` → KHÔNG có ngưỡng chiều dài sẵn có; chỉ có
  `MIN_ROOM_AREA_M2` (diện tích).
- Không có ngưỡng chung "mọi Dimension bất kể referenceIds trỏ đâu". Nếu đặc tả T-01
  đòi một ngưỡng chung (ví dụ "> 20000mm luôn đáng ngờ"), đây là **NOT FOUND thật sự**
  và cần một prompt logic bổ sung — không tự bịa hằng số trong màn (R-71, R-68).

---

## Cạm bẫy chung (đọc trước khi viết `use<Name>.ts`)

1. **HAI kiểu `Millimetres` khác nhau, tên giống hệt nhau:**
   - `src/domain/spatial/types.ts:16` — `export type Millimetres = number;` (alias
     THUẦN, không branded). `Dimension.valueMm`, `Dimension.overrideValueMm`,
     `Point.x`/`.y` đều dùng bản NÀY.
   - `src/domain/units/types.ts:34` — `export type Millimetres = Quantity<'mm'>`
     (branded thật, `number & UnitBrand<'mm'>`). Mọi hàm của `domain/measure/measure.ts`,
     `domain/units/scale.ts`, `domain/walls/types.ts` dùng bản NÀY.
   - Hệ quả: truyền thẳng `dimension.valueMm` (bản #1) vào `measureDistance`/
     `centrelineLength`/bất kỳ hàm nào của `domain/units`/`domain/measure` (đòi bản #2)
     có thể KHÔNG typecheck tuỳ ngữ cảnh — phải qua `millimetres()` (constructor duy
     nhất tại `domain/units/types.ts:84-87`) trước. `shared.ts:273-276` (`toPointMm`)
     là khuôn chuyển đổi đã có sẵn cho toạ độ; không có hàm tương đương sẵn cho một
     giá trị `Millimetres` đơn lẻ — gọi thẳng `millimetres(dimension.valueMm)`.

2. **`MAX_WALL_THICKNESS_MM` tồn tại HAI lần, HAI giá trị khác nhau:**
   - `src/domain/walls/types.ts:46` = `millimetres(600)` — "Thickest wall the model
     accepts" (giới hạn CỨNG cho hình học có thể dựng được, ném lỗi nếu vượt qua
     `assertUsableWall`).
   - `src/domain/rules/registry.ts:364` = `400` — "Thickest wall before the line is
     more likely two walls traced as one" (ngưỡng CẢNH BÁO mềm của rule QC, không ném
     lỗi). Import SAI file sẽ cho ngưỡng lệch 200mm không báo lỗi gì — kiểm đường dẫn
     import kỹ khi dùng hằng này.

3. **`useShortcut` có HAI chữ ký nhìn giống nhau ở hai nơi gọi khác nhau** — thực ra
   CHỈ MỘT chữ ký thật: `useShortcut(definition, options?)` (hai tham số). Code ở
   `useScaleCalibration.ts` gọi `useShortcut({...})` với MỘT object vì phần `options`
   được bỏ qua (dùng mặc định `{}`), KHÔNG phải một overload khác.

4. **`flyToBounds` nhận bounds dạng `{minX, minY, maxX, maxY}` (số thuần), KHÔNG nhận
   `BoundingBox` của `domain/spatial/types.ts` (`{min: Point; max: Point}`)** — phải tự
   destructure trước khi gọi, đúng như `useScaleCalibration.ts:742-749` làm.

5. **`ROUTE_PATTERNS.layerDimensions` (`/layers/dimensions`, không tiền tố dự án) đã
   tồn tại và KHÔNG PHẢI route T5 cần** — route đúng cho màn dự án cụ thể phải tự thêm
   theo khuôn `projectWalls`/`projectObjects` (mục KẾT LUẬN NHANH #6), tên khác
   (`projectDimensions`), không tái dùng hay sửa `layerDimensions` đang có.
