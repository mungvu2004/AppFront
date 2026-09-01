# S-15 / T1 — Hợp đồng hình học trục (chép nguyên văn chữ ký, chỉ đọc)

Toàn bộ nội dung dưới đây được sao chép nguyên văn từ mã nguồn tại nhánh
`mungvu2004/s15-t1-hopdong-axes` (HEAD `3b08519`), không diễn giải, không rút gọn kiểu.
Mỗi khối kèm `// nguồn: <đường dẫn>:<dòng>`.

---

## A. `src/domain/axes/detect.ts`

```typescript
// nguồn: src/domain/axes/detect.ts:46
export const AXIS_ALIGNMENT_THRESHOLD_MM: Millimetres = millimetres(100);

// nguồn: src/domain/axes/detect.ts:49
export const MIN_WALLS_PER_AXIS = 2;

// nguồn: src/domain/axes/detect.ts:59-71
export interface DetectedAxis {
  readonly direction: AxisDirection;
  /** Where the axis sits: `x` when vertical, `y` when horizontal. */
  readonly coordinateMm: Millimetres;
  /** Lower end of the span its walls cover, measured along the axis. */
  readonly startMm: Millimetres;
  /** Upper end of that span. */
  readonly endMm: Millimetres;
  /** How far the member walls disagree; never more than the tolerance. */
  readonly spreadMm: Millimetres;
  /** Members, ordered by coordinate and then by id. Never fewer than two. */
  readonly wallIds: readonly WallId[];
}

// nguồn: src/domain/axes/detect.ts:74-77
export interface AxisLine {
  readonly start: PointMm;
  readonly end: PointMm;
}

// nguồn: src/domain/axes/detect.ts:216-219
export function detectAxes(
  walls: readonly Wall[],
  thresholdMm: Millimetres = AXIS_ALIGNMENT_THRESHOLD_MM,
): readonly DetectedAxis[]
// @throws RangeError khi thresholdMm không phải một độ dài hữu hạn, không âm.

// nguồn: src/domain/axes/detect.ts:250-252
export function verticalAxes(axes: readonly DetectedAxis[]): readonly DetectedAxis[]
// Trả về các trục đứng, theo x tăng dần (thứ tự đã có sẵn từ detectAxes, filter giữ nguyên thứ tự).

// nguồn: src/domain/axes/detect.ts:255-257
export function horizontalAxes(axes: readonly DetectedAxis[]): readonly DetectedAxis[]
// Trả về các trục ngang, theo y tăng dần.

// nguồn: src/domain/axes/detect.ts:266-277
export function axisLine(axis: DetectedAxis): AxisLine
```

### Câu hỏi quan trọng nhất: `AXIS_ALIGNMENT_THRESHOLD_MM` là ngưỡng GOM, không phải ngưỡng KHOẢNG CÁCH TỐI THIỂU

Đọc trực tiếp JSDoc tại `detect.ts:39-46` và `clusterRuns` (`detect.ts:155-181`):

> "How far apart two wall centrelines may sit and still be **one axis**. A
> hundred millimetres is roughly one wall thickness: two walls whose
> centrelines are that close were set out from the same line…"

`AXIS_ALIGNMENT_THRESHOLD_MM` (100 mm) là ngưỡng **GOM TƯỜNG THÀNH MỘT TRỤC**:
`clusterRuns` nhóm các `AxisRun` có toạ độ cách **run đầu tiên của cụm** (không
phải cách hàng xóm liền kề) không quá `thresholdMm` thành một cụm, rồi
`toAxis` (`detect.ts:184-196`) gộp cụm đó thành MỘT `DetectedAxis` duy nhất
(toạ độ = trung bình cộng). Đây **không phải** là ngưỡng khoảng cách tối thiểu
giữa hai trục khác nhau đã được gán nhãn — module này không có khái niệm đó.
Xem thêm mục G.1 bên dưới: không có validator "hai trục cách nhau dưới 100 mm"
nào tồn tại trong repo.

`MIN_WALLS_PER_AXIS = 2` (`detect.ts:49`) là **số tường tối thiểu để một cụm
được công nhận là trục** — "Two walls or no axis" (`detect.ts:14-17`). Một cụm
chỉ có 1 tường bị loại ở bước `.filter((cluster) => cluster.length >= MIN_WALLS_PER_AXIS)`
(`detect.ts:243`). Đây cũng không phải khoảng cách.

---

## B. `src/domain/axes/label.ts`

```typescript
// nguồn: src/domain/axes/label.ts:44
export const AXIS_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

// nguồn: src/domain/axes/label.ts:47
export const EXCLUDED_AXIS_LETTERS: readonly string[] = ['I', 'O'];

// nguồn: src/domain/axes/label.ts:50-55
export interface LabelledAxis {
  readonly axis: DetectedAxis;
  readonly label: string;
  /** `user` when a person named it; only then may it be shown as approved. */
  readonly source: 'user' | 'generated';
}

// nguồn: src/domain/axes/label.ts:64-69
export interface AxisLabelOverride {
  readonly direction: AxisDirection;
  /** Where the named axis sits: `x` when vertical, `y` when horizontal. */
  readonly coordinateMm: Millimetres;
  readonly label: string;
}

// nguồn: src/domain/axes/label.ts:72-74
export interface AxisOrigin {
  readonly point: PointMm;
}

// nguồn: src/domain/axes/label.ts:77-79
export const PROJECT_ORIGIN: AxisOrigin = {
  point: { x: millimetres(0), y: millimetres(0) },
};

// nguồn: src/domain/axes/label.ts:82-88
export interface AxisGrid {
  readonly origin: AxisOrigin;
  /** Vertical axes, by rising `x`; their labels are the numbers. */
  readonly vertical: readonly LabelledAxis[];
  /** Horizontal axes, by rising `y`; their labels are the letters. */
  readonly horizontal: readonly LabelledAxis[];
}

// nguồn: src/domain/axes/label.ts:98-110
export interface AxisPosition {
  /** Number of the nearest vertical axis, or `null` when there is none. */
  readonly verticalLabel: string | null;
  /** Letter of the nearest horizontal axis, or `null` when there is none. */
  readonly horizontalLabel: string | null;
  /** Signed distance from that vertical axis. */
  readonly offsetXMm: Millimetres;
  /** Signed distance from that horizontal axis. */
  readonly offsetYMm: Millimetres;
  /** Coordinates measured from the origin. */
  readonly localXMm: Millimetres;
  readonly localYMm: Millimetres;
}

// nguồn: src/domain/axes/label.ts:127-130
export function verticalAxisLabel(index: number): string
// @throws RangeError khi index không phải số nguyên không âm.

// nguồn: src/domain/axes/label.ts:141-152
export function horizontalAxisLabel(index: number): string
// @throws RangeError khi index không phải số nguyên không âm.

// nguồn: src/domain/axes/label.ts:155-157
export function axisLabelAt(direction: AxisDirection, index: number): string

// nguồn: src/domain/axes/label.ts:226-230
export function labelAxes(
  axes: readonly DetectedAxis[],
  overrides: readonly AxisLabelOverride[] = [],
  toleranceMm: Millimetres = AXIS_ALIGNMENT_THRESHOLD_MM,
): readonly LabelledAxis[]

// nguồn: src/domain/axes/label.ts:278-280
export function setOrigin(point: PointMm): AxisOrigin
// @throws RangeError khi một trong hai toạ độ không phải độ dài hữu hạn.

// nguồn: src/domain/axes/label.ts:283-286
export function buildAxisGrid(
  axes: readonly LabelledAxis[],
  origin: AxisOrigin = PROJECT_ORIGIN,
): AxisGrid

// nguồn: src/domain/axes/label.ts:321
export function toAxisPosition(point: PointMm, grid: AxisGrid): AxisPosition

// nguồn: src/domain/axes/label.ts:359
export function fromAxisPosition(position: AxisPosition, grid: AxisGrid): PointMm | null
// null khi label không khớp trục nào trên grid này.

// nguồn: src/domain/axes/label.ts:401
export function describeAxisPosition(position: AxisPosition): string

// nguồn: src/domain/axes/label.ts:431-433
export function describePoint(point: PointMm, grid: AxisGrid): string
```

### Giao trục A-1 có phải là (0,0) không? — KHÔNG, mặc định

`PROJECT_ORIGIN` (`label.ts:76-79`) là gốc **mặc định** của mọi dự án mới —
điểm `{x: 0, y: 0}` bằng tuyệt đối trên mặt bằng — nhưng nó **không gắn với
bất kỳ trục cụ thể nào**, kể cả A-1. Đọc JSDoc đầu file (`label.ts:22-26`):

> "**The origin never changes the reference.** `setOrigin` pins the grid to a
> point so that plain coordinates can be quoted the way a survey quotes them,
> but which axis you are near and how far off it you are do not depend on
> where the origin is."

Nói cách khác: gốc toạ độ (origin) và vị trí trục A/1 là hai khái niệm **độc
lập**. `setOrigin` chỉ dịch chuyển cách đọc toạ độ tuyệt đối (`localXMm`,
`localYMm` trong `AxisPosition`), không di chuyển trục và không quy định trục
nào phải đi qua gốc. Nếu trục `1` (đứng) tình cờ nằm ở `x = 0` và trục `A`
(ngang) tình cờ ở `y = 0`, thì giao điểm `A-1` trùng gốc — nhưng đó là do dữ
liệu hình học của công trình, module này không ép buộc điều đó.

---

## C. `src/domain/axes/alignFloors.ts`

```typescript
// nguồn: src/domain/axes/alignFloors.ts:49
export type FloorRotation = 0 | 90 | 180 | 270;

// nguồn: src/domain/axes/alignFloors.ts:52
export const FLOOR_ROTATIONS: readonly FloorRotation[] = [0, 90, 180, 270];

// nguồn: src/domain/axes/alignFloors.ts:61
export const ALIGNMENT_WARNING_THRESHOLD_MM: Millimetres = millimetres(150);

// nguồn: src/domain/axes/alignFloors.ts:64
export const AXIS_MATCH_CAPTURE_MM: Millimetres = millimetres(500);

// nguồn: src/domain/axes/alignFloors.ts:67
export const MIN_MATCHED_AXES = 2;

// nguồn: src/domain/axes/alignFloors.ts:70
export const MIN_CLEAR_HEIGHT_MM: Millimetres = millimetres(2400);

// nguồn: src/domain/axes/alignFloors.ts:73
export const MAX_CLEAR_HEIGHT_MM: Millimetres = millimetres(6000);

// nguồn: src/domain/axes/alignFloors.ts:82-88
export interface FloorPlan {
  readonly levelId: LevelId;
  readonly name: string;
  readonly floorElevationMm: Millimetres;
  readonly clearHeightMm: Millimetres;
  readonly axes: readonly DetectedAxis[];
}

// nguồn: src/domain/axes/alignFloors.ts:98-103
export interface FloorTransform {
  readonly rotationDeg: FloorRotation;
  readonly translationMm: PointMm;
  /** Always `1`. Floors are never stretched to fit. */
  readonly scale: 1;
}

// nguồn: src/domain/axes/alignFloors.ts:106-110
export const IDENTITY_TRANSFORM: FloorTransform = {
  rotationDeg: 0,
  translationMm: { x: millimetres(0), y: millimetres(0) },
  scale: 1,
};

// nguồn: src/domain/axes/alignFloors.ts:113
export type FloorIssueKind = 'alignment' | 'unalignable' | 'clearHeight' | 'overlap';

// nguồn: src/domain/axes/alignFloors.ts:123-133
export interface FloorIssue {
  readonly kind: FloorIssueKind;
  readonly levelId: LevelId;
  /** The other floor involved, for an issue about a pair. */
  readonly relatedLevelId: LevelId | null;
  readonly severity: 'attention' | 'violation';
  /** How much is wrong, in millimetres. */
  readonly amountMm: Millimetres;
  /** Vietnamese sentence naming the floor and the millimetres. */
  readonly message: string;
}

// nguồn: src/domain/axes/alignFloors.ts:136-149
export interface FloorAlignment {
  readonly levelId: LevelId;
  readonly name: string;
  readonly isBase: boolean;
  readonly transform: FloorTransform;
  /** Worst distance left between a matched axis and its partner. */
  readonly maxResidualMm: Millimetres;
  /** Axes that found a partner on the base floor. */
  readonly matchedAxisCount: number;
  /** Axes the floor has in total. */
  readonly axisCount: number;
  /** The floor's axes moved onto the base floor. */
  readonly alignedAxes: readonly DetectedAxis[];
}

// nguồn: src/domain/axes/alignFloors.ts:152-159
export interface FloorAlignmentReport {
  /** The floor everything else was matched to; `null` when there are none. */
  readonly baseLevelId: LevelId | null;
  /** One entry per input floor, in the order they were given. */
  readonly floors: readonly FloorAlignment[];
  /** Alignment issues first, then the vertical stack, both by floor order. */
  readonly issues: readonly FloorIssue[];
}

// nguồn: src/domain/axes/alignFloors.ts:161-168
export interface AlignFloorsOptions {
  /** Force the base floor instead of letting the best-surveyed one win. */
  readonly baseLevelId?: LevelId;
  /** How far apart two axes may be and still be paired. */
  readonly captureMm?: Millimetres;
  /** Residual past which a warning is raised. */
  readonly warningThresholdMm?: Millimetres;
}

// nguồn: src/domain/axes/alignFloors.ts:209
export function applyFloorTransform(point: PointMm, transform: FloorTransform): PointMm

// nguồn: src/domain/axes/alignFloors.ts:224
export function transformAxis(axis: DetectedAxis, transform: FloorTransform): DetectedAxis

// nguồn: src/domain/axes/alignFloors.ts:417
export function pickBaseFloor(floors: readonly FloorPlan[]): FloorPlan | null
// null khi danh sách rỗng.

// nguồn: src/domain/axes/alignFloors.ts:451-453
export function ceilingElevationMm(floor: FloorPlan): Millimetres
// = floor.floorElevationMm + floor.clearHeightMm

// nguồn: src/domain/axes/alignFloors.ts:548-551
export function alignFloors(
  floors: readonly FloorPlan[],
  options: AlignFloorsOptions = {},
): FloorAlignmentReport
```

### Sau khi gọi `alignFloors`, độ lệch còn lại của MỖI tầng đọc ở trường nào?

`FloorAlignmentReport.floors[i].maxResidualMm` (`alignFloors.ts:142`) —
"Worst distance left between a matched axis and its partner", đơn vị
milimét. Tầng chuẩn (`isBase: true`) luôn có `maxResidualMm: millimetres(0)`
(gán cứng tại `alignFloors.ts:575`). Ngoài ra `matchedAxisCount` /
`axisCount` (cùng interface) cho biết bao nhiêu trục đã khớp trên tổng số.
Nếu độ lệch vượt `ALIGNMENT_WARNING_THRESHOLD_MM` (150 mm, mặc định, có thể
ghi đè qua `AlignFloorsOptions.warningThresholdMm`), một `FloorIssue` với
`kind: 'alignment'`, `severity: 'attention'` được thêm vào
`FloorAlignmentReport.issues` (`alignFloors.ts:619-630`), `amountMm` của
issue đó **chính là** `maxResidualMm`.

### `FloorTransform` mang gì để "căn tự động" áp được vào tầng?

Đúng hai bậc tự do (`alignFloors.ts:13-18`, không bao giờ scale — `scale: 1`
cố định theo kiểu literal):

- `rotationDeg: FloorRotation` — một trong bốn góc `0 | 90 | 180 | 270`
  (độ), quay quanh **gốc mặt bằng (plan origin)**, áp dụng **trước** tịnh tiến
  (`alignFloors.ts:93-96`, hàm `rotatePoint` tại `alignFloors.ts:195-206`).
- `translationMm: PointMm` — tịnh tiến sau khi quay, đơn vị milimét, có dấu
  (`{x, y}`).
- `scale: 1` — hằng số, không phải tuỳ chọn; kiểu literal `1` khiến việc scale
  không thể lọt qua compiler.

Để áp transform lên một điểm bất kỳ của tầng: `applyFloorTransform(point, transform)`
(`alignFloors.ts:209`). Để áp lên một trục đã dò được (dời cả hai đầu mút, tự
suy ra hướng mới sau khi quay): `transformAxis(axis, transform)`
(`alignFloors.ts:224`). Cả hai hàm này là public và đã export.

---

## D. `src/domain/units/snap.ts`

```typescript
// nguồn: src/domain/units/snap.ts:59-66
export const SNAP_THRESHOLDS = {
  /** Grid pitch, in millimetres. */
  gridStepMm: millimetres(50),
  /** Angle pitch, in degrees. */
  angleStepDeg: degrees(15),
  /** How far the cursor reaches for an anchor. */
  captureRadiusMm: millimetres(120),
} as const;

// nguồn: src/domain/units/snap.ts:85-93
export interface SnapToTargetsOptions {
  /** How far the cursor reaches; anything further is ignored. */
  readonly captureRadiusMm?: Millimetres;
  /** Snap to the grid when nothing better is in reach. Defaults to on. */
  readonly gridEnabled?: boolean;
  readonly gridStepMm?: Millimetres;
  /** Kinds to ignore entirely, so each can be switched off on its own. */
  readonly disabledKinds?: readonly SnapTargetKind[];
}

// nguồn: src/domain/units/snap.ts:101-105
export function snapToGrid(
  point: PointMm,
  stepMm: Millimetres = SNAP_THRESHOLDS.gridStepMm,
  enabled = true,
): PointMm

// nguồn: src/domain/units/snap.ts:124-128
export function snapAngle(
  angle: Degrees,
  stepDeg: Degrees = SNAP_THRESHOLDS.angleStepDeg,
  enabled = true,
): Degrees
// @throws RangeError khi stepDeg không phải góc dương hữu hạn.

// nguồn: src/domain/units/snap.ts:224-228
export function snapToTargets(
  point: PointMm,
  targets: readonly SnapTarget[],
  options: SnapToTargetsOptions = {},
): SnapResult
```

Kiểu phụ trợ liên quan (chưa được liệt kê riêng trong đặc tả nhưng nằm trong
cùng chữ ký):

```typescript
// nguồn: src/domain/units/snap.ts:29
export type AnchorKind = 'wallVertex' | 'intersection' | 'midpoint';

// nguồn: src/domain/units/snap.ts:32
export type SnapTargetKind = AnchorKind | 'perpendicular' | 'grid';

// nguồn: src/domain/units/snap.ts:41-43
export type SnapTarget =
  | { readonly kind: AnchorKind; readonly id: string; readonly position: PointMm }
  | { readonly kind: 'perpendicular'; readonly id: string; readonly segment: SnapSegment };

// nguồn: src/domain/units/snap.ts:46-56
export interface SnapResult {
  readonly point: PointMm;
  readonly kind: SnapTargetKind | null;
  readonly targetId: string | null;
  readonly distanceMm: Millimetres;
  readonly snapped: boolean;
}

// nguồn: src/domain/units/snap.ts:74-80
export const SNAP_PRIORITY: readonly SnapTargetKind[] = [
  'wallVertex',
  'intersection',
  'midpoint',
  'perpendicular',
  'grid',
];
```

### Có cách nào bắt điểm vào TIM TƯỜNG (wall centreline) không?

**Không trực tiếp bằng tên "centreline", nhưng CÓ hai con đường gián tiếp
sẵn có, do người gọi tự truyền vào — module không tự đọc danh sách tường:**

1. **`'perpendicular'`** trong `SnapTargetKind` (`snap.ts:32`) — bắt điểm vào
   chân đường vuông góc hạ từ điểm xuống một `SnapSegment { start, end }`
   (`snap.ts:35-38`), tính bởi `perpendicularFoot(point, segment)`
   (`snap.ts:156`). Nếu người gọi truyền `segment = wall.centreline` (kiểu
   `Segment` của `wall`, xem `src/domain/walls/types.ts`) làm một
   `SnapTarget` có `kind: 'perpendicular'`, thì đây chính là bắt vào tim
   tường tại điểm bất kỳ dọc theo nó (không chỉ hai đầu mút).
2. **`'wallVertex'`** trong `AnchorKind` (`snap.ts:29`) — bắt vào một điểm cụ
   thể (`position: PointMm`) mà người gọi gắn nhãn `kind: 'wallVertex'`;
   thường là hai đầu mút của centreline, không phải một điểm bất kỳ trên nó.

`snapToTargets` **không tự tạo** danh sách target từ tường — nó chỉ nhận
`targets: readonly SnapTarget[]` do người gọi truyền vào (`snap.ts:226`) và
lưới (`SNAP_THRESHOLDS.gridStepMm`, có thể tắt qua `gridEnabled: false`).
Việc dựng `SnapTarget[]` từ danh sách `Wall[]` (đọc `wall.centreline`, sinh
ra các `wallVertex`/`perpendicular`/`intersection`/`midpoint` target) là
trách nhiệm của tầng gọi (hook hoặc `src/lib`), **chưa có sẵn trong
`domain/units/snap.ts`**.

---

## E. `src/domain/units/types.ts` và `src/domain/units/scale.ts`

`Millimetres` và `Pixels` là **kiểu nhãn (branded quantity)**, KHÔNG phải số
thường ở mức kiểu — nhưng ở runtime chúng vẫn là `number` nguyên bản (nhãn bị
xoá lúc build, không tốn chi phí boxing):

```typescript
// nguồn: src/domain/units/types.ts:23-31
declare const UNIT_BRAND: unique symbol;

interface UnitBrand<TUnit extends string> {
  readonly [UNIT_BRAND]: TUnit;
}

export type Quantity<TUnit extends string> = number & UnitBrand<TUnit>;

// nguồn: src/domain/units/types.ts:34
export type Millimetres = Quantity<'mm'>;

// nguồn: src/domain/units/types.ts:49
export type Pixels = Quantity<'px'>;

// nguồn: src/domain/units/types.ts:52
export type MillimetresPerPixel = Quantity<'mm/px'>;
```

**QUAN TRỌNG — hàm dựng `pixels()` KHÔNG nằm trong `units/types.ts`.**
`units/types.ts` chỉ có các hàm dựng: `millimetres()` (`types.ts:84`),
`metres()` (`types.ts:90`), `squareMetres()` (`types.ts:96`), `degrees()`
(`types.ts:102`), `radians()` (`types.ts:108`). Hàm `pixels()` và
`millimetresPerPixel()` nằm ở **`src/domain/units/scale.ts`**:

```typescript
// nguồn: src/domain/units/types.ts:84-87
export function millimetres(value: number): Millimetres
// @throws RangeError khi value không phải số hữu hạn.

// nguồn: src/domain/units/scale.ts:79-82
export function pixels(value: number): Pixels
// @throws RangeError khi value không phải số hữu hạn.
// "Tag a raw number as pixels. The one gate where an untyped value enters."

// nguồn: src/domain/units/scale.ts:85-88
export function millimetresPerPixel(value: number): MillimetresPerPixel
// @throws RangeError khi value không phải số hữu hạn.
```

Mọi hàm quy đổi mm ↔ px, và `Scale`:

```typescript
// nguồn: src/domain/units/scale.ts:95-101
export interface Scale {
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** Convert a distance measured on the image into a real length. */
  readonly pixelsToMillimetres: (value: Pixels) => Millimetres;
  /** Convert a real length into a distance on the image. */
  readonly millimetresToPixels: (value: Millimetres) => Pixels;
}

// nguồn: src/domain/units/scale.ts:137-146
export function scaleFromRatio(ratio: MillimetresPerPixel): Scale
// @throws RangeError khi ratio không phải số dương hữu hạn.
// Trả về Scale với pixelsToMillimetres = (px) => millimetres(px * ratio)
// và millimetresToPixels = (mm) => pixels(mm / ratio).

// nguồn: src/domain/units/scale.ts:149-160
export function createScale(input: {
  readonly pixelLength: Pixels;
  readonly realLength: Millimetres;
}): Scale
// @throws RangeError khi pixelLength hoặc realLength không dương.
// Dựng Scale từ đúng MỘT cặp đo (px, mm thật) — gọi scaleFromRatio(millimetresPerPixel(realLength / pixelLength)).
```

Quy đổi mm ↔ px **KHÔNG** phải hàm top-level rời (không có
`millimetresToPixels(mm, ratio)` đứng một mình) — nó luôn đi qua một `Scale`
đã dựng sẵn (`scale.pixelsToMillimetres(...)` / `scale.millimetresToPixels(...)`),
tức là màn phải giữ một giá trị `Scale` (từ `scaleFromRatio` hoặc `createScale`
hoặc kết quả `inferScale(...).scale` khi `status === 'inferred'`) rồi gọi
phương thức trên đó — không tự nhân/chia `ratio` bằng tay (phạm R-71/A15 nếu
làm ở view).

`MILLIMETRES_PER_METRE`, dùng khi cần đổi mm ↔ m (không liên quan px):

```typescript
// nguồn: src/domain/units/types.ts:55
export const MILLIMETRES_PER_METRE = 1000;
```

---

## F. `src/lib/format/number.ts` và `src/lib/format/measure.ts`

### `src/lib/format/number.ts` — mọi hàm xuất ra

```typescript
// nguồn: src/lib/format/number.ts:33
export const MISSING_VALUE = '—';

// nguồn: src/lib/format/number.ts:55
export type MaybeNumber = number | null | undefined;

// nguồn: src/lib/format/number.ts:57-73
export interface NumberFormatOptions {
  readonly fractionDigits?: number;
  readonly maxFractionDigits?: number;
  readonly grouping?: boolean;
}

// nguồn: src/lib/format/number.ts:76
export type PercentSource = 'ratio' | 'percent';

// nguồn: src/lib/format/number.ts:78-92
export interface PercentFormatOptions {
  readonly fractionDigits?: number;
  readonly maxFractionDigits?: number;
  readonly source?: PercentSource;
}

// nguồn: src/lib/format/number.ts:165-167
export function isFormattable(value: MaybeNumber): value is number

// nguồn: src/lib/format/number.ts:201
export function formatNumber(value: MaybeNumber, options: NumberFormatOptions = {}): string
// Ví dụ (JSDoc tại number.ts:195-199):
//   formatNumber(1234567.891)                 -> "1.234.567,891"
//   formatNumber(3.5, { fractionDigits: 2 })  -> "3,50"
//   formatNumber(2026, { grouping: false })   -> "2026"
//   formatNumber(null)                        -> "—"

// nguồn: src/lib/format/number.ts:225
export function formatPercent(value: MaybeNumber, options: PercentFormatOptions = {}): string
// Ví dụ (JSDoc tại number.ts:219-223):
//   formatPercent(0.125)                       -> "12,5%"
//   formatPercent(0.8, { fractionDigits: 0 })  -> "80%"
//   formatPercent(50, { source: 'percent' })   -> "50%"
//   formatPercent(undefined)                   -> "—"

// nguồn: src/lib/format/number.ts:255
export function parseNumber(text: string): number | undefined
// Ngược của formatNumber: "4.250,50" -> 4250.5. Chuỗi rỗng/không đọc được -> undefined (không bao giờ NaN).
```

### `src/lib/format/measure.ts` — mọi hàm xuất ra

```typescript
// nguồn: src/lib/format/measure.ts:28
export type LengthDisplayUnit = 'mm' | 'm';

// nguồn: src/lib/format/measure.ts:37
export const METRE_THRESHOLD_MM = MILLIMETRES_PER_METRE; // = 1000

// nguồn: src/lib/format/measure.ts:56-66
export interface LengthFormatOptions {
  readonly unit?: LengthDisplayUnit;
  readonly fractionDigits?: number;
}

// nguồn: src/lib/format/measure.ts:68-71
export interface MeasureFormatOptions {
  readonly fractionDigits?: number;
}

// nguồn: src/lib/format/measure.ts:83
export const A3_SHORT_EDGE_MM = 297;

// nguồn: src/lib/format/measure.ts:108
export function formatLength(valueMm: MaybeNumber, options: LengthFormatOptions = {}): string
// ĐỊNH DẠNG MILIMÉT khi |valueMm| < 1000 (0 chữ số thập phân); ĐỊNH DẠNG MÉT khi >= 1000
// (2 chữ số thập phân). Ví dụ (measure.ts:100-106):
//   formatLength(850)                  -> "850 mm"
//   formatLength(3450)                 -> "3,45 m"
//   formatLength(12400)                -> "12,40 m"
//   formatLength(850, { unit: 'm' })   -> "0,85 m"
//   formatLength(3450, { unit: 'mm' }) -> "3.450 mm"
//   formatLength(null)                 -> "—"

// nguồn: src/lib/format/measure.ts:131
export function formatArea(areaM2: MaybeNumber, options: MeasureFormatOptions = {}): string
// Ví dụ (measure.ts:126-129): formatArea(248.6) -> "248,60 m²"; formatArea(1234.5) -> "1.234,50 m²".

// nguồn: src/lib/format/measure.ts:151
export function formatAngle(angleDeg: MaybeNumber, options: MeasureFormatOptions = {}): string
// Ví dụ (measure.ts:146-149): formatAngle(90) -> "90,0°"; formatAngle(-45.25) -> "-45,3°".

// nguồn: src/lib/format/measure.ts:178
export function formatScaleDensity(
  millimetresPerPixel: MaybeNumber,
  options: NumberFormatOptions = {},
): string
// Ví dụ (measure.ts:173-176): formatScaleDensity(12) -> "12 mm/px".

// nguồn: src/lib/format/measure.ts:209
export function formatDrawingScaleRatio(
  millimetresPerPixel: MaybeNumber,
  shortEdgePx: MaybeNumber,
): string
// Ví dụ (measure.ts:205-207): formatDrawingScaleRatio(12, 2475) -> "1:100".
```

**Hàm nào cho ra dấu phẩy thập phân theo A15:** tất cả các hàm trên đều đi
qua `formatNumber` (`number.ts:201`), mà bên trong dùng
`new Intl.NumberFormat('vi-VN', ...)` (`number.ts:36,171-176`) — locale
`vi-VN` tự sinh dấu phẩy thập phân và dấu chấm phân nhóm nghìn, không có nơi
nào ráp chuỗi số bằng tay.

**mm hay m — quyết định ở đâu:** `formatLength` là hàm DUY NHẤT tự chọn đơn
vị theo độ lớn (`chooseUnit`, `measure.ts:86-88`, ngưỡng `METRE_THRESHOLD_MM
= 1000`). `formatArea`, `formatAngle`, `formatScaleDensity` không chọn đơn
vị — đơn vị của chúng cố định theo tên hàm (m², độ, mm/px).

---

## G. Mục "KHÔNG TÌM THẤY"

### G.1 — Hàm/hằng kiểm tra hai trục cách nhau dưới 100 mm (validator khoảng cách tối thiểu giữa hai trục)

**KHÔNG TÌM THẤY.**

Lệnh grep đã dùng:
```
rg "MIN_.*AXIS|AXIS.*MIN|axisSpacing|SPACING" src
rg "adjacent|neighbour|neighbor|nextAxis|axisGap|spacingMm|distanceToNext" -i src/domain
```
Kết quả: không có hằng số hay hàm nào tên dạng `MIN_AXIS_SPACING`,
`axisSpacing`, `tooClose`, hay validator so hai trục **đã gán nhãn** (`LabelledAxis`)
với nhau về khoảng cách tối thiểu. `AXIS_ALIGNMENT_THRESHOLD_MM`
(`detect.ts:46`, xem mục A) là ngưỡng GOM tường trước khi trục tồn tại, không
phải validator sau khi trục đã có.

**Đề xuất ghép từ nguyên thuỷ đã có** (không viết mã ở đây): với hai
`LabelledAxis` cùng hướng (`direction` giống nhau), tính
`Math.abs(first.axis.coordinateMm - second.axis.coordinateMm)` rồi so với một
ngưỡng 100 mm — nhưng **ngưỡng 100 mm dùng cho việc này phải là một hằng số
mới, có tên riêng, đặt tại `src/domain` và được review**, R-71 cấm hằng số
viết tay ở view; không được tái dùng `AXIS_ALIGNMENT_THRESHOLD_MM` cho mục
đích này vì đó là ngữ nghĩa khác (xem mục A). Đây là chỗ cần hỏi điều phối
viên trước khi màn viết mã bịa ra hằng số.

### G.2 — Hàm tính khoảng cách giữa một trục và trục kế tiếp trong cùng nhóm

**KHÔNG TÌM THẤY.**

Lệnh grep đã dùng: (giống G.1, cộng thêm)
```
rg "nextAxis|axisGap" src/domain/axes
```
Không có hàm nào tên `nextAxis`, `axisGap`, hay tương tự trong
`src/domain/axes/*.ts`.

**Đề xuất ghép từ nguyên thuỷ đã có:** `verticalAxes(axes)` /
`horizontalAxes(axes)` (`detect.ts:250,255`) trả về mảng đã sắp theo toạ độ
tăng dần **trong cùng một hướng** (thứ tự sinh ra bởi `clusterRuns` +
`byCoordinateThenId`, `detect.ts:144-153,162-181` — tăng dần theo
`coordinateMm`, hoà bằng `wallId`). Khoảng cách giữa trục `i` và trục kế tiếp
`i+1` trong cùng nhóm hướng chỉ là
`horizontalAxes(axes)[i+1].coordinateMm - horizontalAxes(axes)[i].coordinateMm`
(tương tự cho `verticalAxes`) — một phép trừ trực tiếp, không cần hàm mới, vì
mảng đã đảm bảo thứ tự tăng dần theo hợp đồng của `detectAxes`.

### G.3 — Hàm dựng đường bao (outline/bounds) của một tầng để vẽ bóng ma

**KHÔNG TÌM THẤY** (không có trong `src/domain`; chỉ có bản sao chép cục bộ
per-screen, không phải primitive dùng chung).

Lệnh grep đã dùng:
```
rg "function computeBoundingBox|function boundsOf|function wallsBounds|function floorBounds|function computeBounds" src
rg "BoundingBox" src/domain
rg "boxAround|marqueeBox" src
```
Kết quả: `src/domain/spatial/types.ts:37-40` khai báo kiểu
`export interface BoundingBox { min: Point; max: Point; }`, nhưng đây chỉ là
KIỂU DỮ LIỆU, không phải hàm dựng từ danh sách điểm/tường. Hai hàm dựng hộp
bao **hai điểm** (không phải N điểm của một tầng) tồn tại ở `src/lib`, không
phải `src/domain`:
- `boxAround(centre: Point, widthMm: number, depthMm: number): BoundingBox`
  — `src/lib/input/dragDrop.ts:133` (bản sao thứ hai, cùng chữ ký, tại
  `src/lib/tools/tools.ts:119`, module-local không export).
- `marqueeBox(marquee: Marquee): BoundingBox` — `src/lib/selection/marquee.ts:101`.

Hàm gấp N-điểm-thành-hộp-bao duy nhất trong repo là `boundsOfPoints`, nhưng nó
**không nằm trong domain hay lib dùng chung** — mỗi màn QC tự định nghĩa bản
riêng của mình, hoạt động trên toạ độ PIXEL (không phải mm của tầng):
`src/screens/qc/WallLayerReview/wallLayerReviewGateway.ts:954`,
`src/screens/qc/ObjectLayerReview/objectLayerReviewGateway.ts:1992`,
`src/screens/qc/DimensionOcrReview/dimensionOcrReviewGateway.ts:541`. Chính
JSDoc của bản đầu tiên (`wallLayerReviewGateway.ts:945-953`) xác nhận:
"`src/domain` có `BoundingBox` và `boxAround`/`marqueeBox` (hai điểm), nhưng
KHÔNG có hàm nào gấp một đa giác N đỉnh thành hộp bao."

**Đề xuất ghép từ nguyên thuỷ đã có:** không có primitive N-điểm nào để tái
dùng nguyên trạng. Muốn có outline (mm) của một tầng cho bóng ma, phải viết
một hàm gấp `Math.min`/`Math.max` mới trên toạ độ của `FloorPlan.axes` (qua
`axisLine(axis)` — `detect.ts:266` — lấy `start`/`end` của từng trục) hoặc
trên `wall.centreline` của toàn bộ `Wall[]` tầng đó; đây là logic hình học
MỚI, không lắp ráp được từ hàm có sẵn, nên KHÔNG được viết ở tầng màn hình
(vi phạm ranh giới 0.4 nếu đặt sai chỗ) — cần hỏi điều phối viên xem có nên
thêm một hàm domain mới hay tái dùng `boundsOfPoints` kiểu pattern đã có ở
ba màn QC kia (chấp nhận trùng lặp có chủ đích, như JSDoc của chúng đã biện
minh).

### G.4 — Hàm chuyển `FloorTransform` thành danh sách bản vá (patch) ghi vào store

**KHÔNG TÌM THẤY.**

Lệnh grep đã dùng:
```
rg "FloorTransform" src
rg "kind: 'axis'|updateAxis|moveAxis|translateAxis|SpatialPatch =|type SpatialPatch" src/domain/spatial/applyPatch.ts
```
`FloorTransform` chỉ xuất hiện ở `src/domain/axes/alignFloors.ts` và
`src/domain/axes/__tests__/alignFloors.test.ts` — không nơi nào trong
`src/store/**` hay `src/lib/mutations/**` biết về kiểu này. `SpatialPatch`
(`src/domain/spatial/applyPatch.ts:52-54`) là một union generic theo
`EntityKind`: `AddPatch<K> | UpdatePatch<K> | RemovePatch<K>`, ghi qua
`commit(patch, label)` (`src/store/commit.ts:18-25`, xem A10) — nó không có
biến thể riêng cho "áp FloorTransform".

**Đề xuất ghép từ nguyên thuỷ đã có:** không có hàm sẵn để gọi thẳng. Đường
ghép hợp lý (không viết mã ở đây, chỉ nêu tên hàm để lắp): với mỗi
`FloorAlignment` trả về từ `alignFloors` (mục C), lặp qua từng `Wall`/`Axis`/…
của tầng đó, dùng `applyFloorTransform(point, transform)` (`alignFloors.ts:209`)
để dời từng điểm hình học của `wall.centreline`, và `transformAxis(axis, transform)`
(`alignFloors.ts:224`) để dời từng trục, rồi bọc mỗi kết quả vào một
`UpdatePatch<'wall'>` / `UpdatePatch<'axis'>` (`applyPatch.ts:32-37`,
`op: 'update', kind, id, changes`) và gộp thành mảng `SpatialPatch[]` truyền
cho `commit(patches, label)`. Đây là logic ráp nối MỚI (không tồn tại sẵn) —
việc quyết định viết nó ở đâu (hook riêng theo mục D, hay thêm vào
`alignFloors.ts`) là quyết định của người viết màn, không phải của task này.

---

## Tóm tắt cho người viết màn (không lặp lại phần trên, chỉ điều hướng)

- Ngưỡng gom trục: mục A. Không có ngưỡng khoảng cách tối thiểu giữa hai
  trục — phải hỏi trước khi bịa hằng số (G.1).
- Gốc toạ độ độc lập với trục A-1: mục B.
- Độ lệch còn lại sau căn tầng: `FloorAlignment.maxResidualMm`; cách áp
  transform: `applyFloorTransform`/`transformAxis` — mục C.
- Bắt tim tường: qua `kind: 'perpendicular'` do người gọi tự dựng target,
  không có sẵn — mục D.
- `pixels()` nằm ở `scale.ts`, KHÔNG ở `types.ts` — mục E.
- Định dạng số/độ dài luôn qua `formatNumber`/`formatLength` (dấu phẩy tự
  động từ `vi-VN`) — mục F.
- Bốn thứ ở mục G đều KHÔNG có sẵn: validator khoảng cách tối thiểu, khoảng
  cách trục kế tiếp (nhưng suy được từ mảng đã sắp), outline tầng cho bóng
  ma, và patch builder cho `FloorTransform`. Cả bốn cần hỏi điều phối viên
  trước khi bất kỳ task Lớp 2 nào viết mã cho chúng (R-69).
