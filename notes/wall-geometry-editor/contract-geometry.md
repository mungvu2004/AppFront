# Hợp đồng hình học nghiệp vụ — WallGeometryEditor (S-19/T2)

Khảo sát tại HEAD `eb2ff16` (nhánh `mungvu2004/wge-t2-geometry`), thực hiện bởi
worker khảo sát S-19/T2. Không sửa mã sản phẩm, chỉ đọc `src/domain/**` (và nơi
liên đới ở `src/lib/commands/business/**`, `src/lib/tools/**`, `src/lib/versioning/**`)
rồi ghi lại chữ ký thật. Mọi khẳng định kèm đường dẫn + số dòng; ví dụ gọi lấy
nguyên văn từ test.

Tóm tắt kết luận nhanh cho bốn lỗ hổng điều phối viên nêu (chi tiết ở mục
`## KIỂM KÊ LỖ HỔNG`):

1. "Vết vẽ gốc của AI" (hình học gốc trước khi sửa) — **NOT FOUND**.
2. Bắt điểm theo trục có tên ("Trục B") — **NOT FOUND**.
3. `ToolId` cho chế độ sửa đỉnh (S-08) — **NOT FOUND**; và **KHÔNG**, màn không tự
   khai được một tool tại chỗ mà không sửa `src/lib`.
4. Kiểm đa giác tự cắt (`selfIntersect`) — **NOT FOUND**; `checkWallOverlap` +
   `wallCrossingText` thay thế được **toàn bộ** trường hợp khi hình đã là tập
   `Wall[]` của một tầng, nhưng **không** thay được khi hình còn là một chuỗi
   điểm chưa dựng thành tường (ví dụ ghost đang kéo).

---

## Nhóm A — bắt điểm (M-03)

Nguồn: `src/domain/units/snap.ts`, `src/domain/units/compare.ts`,
`src/domain/units/types.ts`, `src/domain/units/__tests__/snap.test.ts`.

### 1. `snapToTargets` — chữ ký đầy đủ

`src/domain/units/snap.ts:224-228`:

```ts
export function snapToTargets(
  point: PointMm,
  targets: readonly SnapTarget[],
  options: SnapToTargetsOptions = {},
): SnapResult
```

`SnapToTargetsOptions` (`snap.ts:85-93`):

```ts
export interface SnapToTargetsOptions {
  readonly captureRadiusMm?: Millimetres;
  readonly gridEnabled?: boolean;
  readonly gridStepMm?: Millimetres;
  readonly disabledKinds?: readonly SnapTargetKind[];
}
```

`SnapResult` (`snap.ts:46-56`):

```ts
export interface SnapResult {
  readonly point: PointMm;
  readonly kind: SnapTargetKind | null;
  readonly targetId: string | null;
  readonly distanceMm: Millimetres;
  readonly snapped: boolean;
}
```

`SnapTarget`, mọi nhánh union (`snap.ts:41-43`):

```ts
export type SnapTarget =
  | { readonly kind: AnchorKind; readonly id: string; readonly position: PointMm }
  | { readonly kind: 'perpendicular'; readonly id: string; readonly segment: SnapSegment };
```

`SnapSegment` (`snap.ts:35-38`):

```ts
export interface SnapSegment {
  readonly start: PointMm;
  readonly end: PointMm;
}
```

`AnchorKind` và `SnapTargetKind` (`snap.ts:29,32`):

```ts
export type AnchorKind = 'wallVertex' | 'intersection' | 'midpoint';
export type SnapTargetKind = AnchorKind | 'perpendicular' | 'grid';
```

### 2. `SNAP_THRESHOLDS` và `SNAP_PRIORITY` — giá trị thật

`snap.ts:59-80`:

```ts
export const SNAP_THRESHOLDS = {
  gridStepMm: millimetres(50),
  angleStepDeg: degrees(15),
  captureRadiusMm: millimetres(120),
} as const;

export const SNAP_PRIORITY: readonly SnapTargetKind[] = [
  'wallVertex',
  'intersection',
  'midpoint',
  'perpendicular',
  'grid',
];
```

### 3. `snapToGrid`, `snapAngle`, `perpendicularFoot`, `distanceBetween`

`snap.ts:101-105`:
```ts
export function snapToGrid(
  point: PointMm,
  stepMm: Millimetres = SNAP_THRESHOLDS.gridStepMm,
  enabled = true,
): PointMm
```

`snap.ts:124-128`:
```ts
export function snapAngle(
  angle: Degrees,
  stepDeg: Degrees = SNAP_THRESHOLDS.angleStepDeg,
  enabled = true,
): Degrees
```
Ném `RangeError` khi `stepDeg` không dương (`snap.ts:132-134`).

`snap.ts:156`:
```ts
export function perpendicularFoot(point: PointMm, segment: SnapSegment): PointMm | null
```
Trả `null` khi đoạn không có độ dài, hoặc chân đường vuông góc rơi ngoài đoạn
(`snap.ts:160-167`).

`snap.ts:145-147`:
```ts
export function distanceBetween(first: PointMm, second: PointMm): Millimetres {
  return millimetres(Math.hypot(first.x - second.x, first.y - second.y));
}
```

### 4. Ví dụ gọi `snapToTargets`, lấy nguyên văn từ test

`src/domain/units/__tests__/snap.test.ts:198-211`:

```ts
it('prefers a wall vertex 100 mm away over a grid node 20 mm away', () => {
  const cursor = point(120, 0);
  const vertex = anchor('wallVertex', 'W-001', 20, 0);

  const result = snapToTargets(cursor, [vertex]);

  expect(distanceBetween(cursor, snapToGrid(cursor))).toBeCloseTo(20, 6);
  expect(result.kind).toBe('wallVertex');
  expect(result.targetId).toBe('W-001');
  expect(result.snapped).toBe(true);
  expect(result.distanceMm).toBeCloseTo(100, 6);
  expectPoint(result.point, point(20, 0));
});
```

### 5. Câu hỏi bắt buộc — `SnapResult` có gọi TÊN loại bắt điểm không?

`SnapResult.kind: SnapTargetKind | null` (`snap.ts:50`) là trường DUY NHẤT mang
thông tin loại bắt điểm — một trong `'wallVertex' | 'intersection' | 'midpoint'
| 'perpendicular' | 'grid'`. Không có trường tiếng Việt kèm theo (không có
`label`, không có `displayName`).

**Ánh xạ kind → nhãn tiếng Việt (ví dụ "Vuông góc") CHƯA tồn tại ở đâu trong
repo.** Đã tìm:
```
grep -rniE "wallVertex|SnapTargetKind|'intersection'|'midpoint'|'perpendicular'" src/components src/screens src/hooks src/lib
```
Kết quả chỉ có `src/screens/pipeline/ScaleCalibration/{types.ts:227, useScaleCalibration.ts}`
và `src/screens/qc/AxisGridManager/useAxisGridManager.ts:692-707` — cả hai đều
**dùng** `SnapTargetKind`/`'wallVertex'` nhưng không định nghĩa bảng nhãn tiếng
Việt nào cho nó. Màn `WallGeometryEditor` phải tự đặt bảng nhãn, theo đúng khuôn
mẫu `Readonly<Record<K, string>>` đã dùng ở nơi khác trong domain (ví dụ
`OPENING_KIND_LABELS` ở `src/domain/openings/types.ts:61-65`, hay
`REFLOW_STATUS_LABELS` ở `src/domain/openings/reflow.ts:71-75`) — nhưng bảng đó
phải đặt **trong thư mục màn**, vì đặc tả cấm sửa `src/domain/**`.

---

## Nhóm B — tường: nối, tách, làm sạch (M-04, M-05)

Nguồn: `src/domain/walls/{types,joints,cleanup,edit}.ts`,
`src/domain/walls/__tests__/{cleanup,joints}.test.ts`,
`src/lib/commands/business/wallCommands.ts` (nơi các câu từ chối tiếng Việt thật
sự sống).

### 6. `Wall` và các kiểu liên quan — dán nguyên văn interface `Wall`

`src/domain/walls/types.ts:61-70`:

```ts
export interface Wall {
  readonly id: WallId;
  readonly kind: WallKind;
  readonly centreline: WallCentreline;
  readonly thicknessMm: Millimetres;
  /** Height of the bottom of the wall, from the datum. */
  readonly baseElevationMm: Millimetres;
  /** Height of the top of the wall, from the datum. */
  readonly topElevationMm: Millimetres;
}
```

`WallCentreline` (`types.ts:49-52`):
```ts
export interface WallCentreline {
  readonly start: PointMm;
  readonly end: PointMm;
}
```

`WallKind`, `WALL_KINDS` (`types.ts:37,40`):
```ts
export type WallKind = 'loadBearing' | 'partition' | 'railing' | 'glazed';
export const WALL_KINDS: readonly WallKind[] = ['loadBearing', 'partition', 'railing', 'glazed'];
```

`WallEnd`, `WALL_ENDS` (`types.ts:73,76`):
```ts
export type WallEnd = 'start' | 'end';
export const WALL_ENDS: readonly WallEnd[] = ['start', 'end'];
```

`WallId` là re-export từ `src/domain/spatial/types.ts` (`types.ts:25`:
`import type { WallId } from '../spatial/types';`) — không định nghĩa lại ở
`walls/types.ts`.

Ghi chú quan trọng cho màn: đây là `Wall` của `src/domain/walls/**`
(centreline + thickness). Đây **không phải** cùng một kiểu `Wall` với
`src/domain/spatial/types.ts` (đồ thị đã chuẩn hoá, có `ReviewMetadata`
`source`/`reviewed`/`confidence` — xem LỖ HỔNG 1). Hai kiểu tên trùng nhưng
khác namespace, khác trường.

### 7. `resolveJoints`, `resolveWallShapes`

`src/domain/walls/joints.ts:677-680`:
```ts
export function resolveJoints(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): ResolveJointsResult
```

`joints.ts:700-703`:
```ts
export function resolveWallShapes(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): ResolveWallShapesResult
```

`DEFAULT_JOINT_THRESHOLD_MM = millimetres(50)` (`joints.ts:63`).

`Joint`, `JointKind`, `JointId`, `JointMember`, `WallEndRef`, `UnresolvedJoint`,
`ResolveJointsResult`, `WallShape` (`joints.ts:72-134`):

```ts
export type JointKind = 'corner' | 'tee' | 'cross';
export type JointId = `J-${string}`;
export interface WallEndRef {
  readonly wallId: WallId;
  readonly end: WallEnd;
}
export interface JointMember extends WallEndRef {
  readonly bearingDeg: Degrees;
}
export interface Joint {
  readonly id: JointId;
  readonly kind: JointKind;
  readonly position: PointMm;
  readonly members: readonly JointMember[];
  readonly primaryWallId: WallId;
}
export type UnresolvedJointReason = 'tooManyEnds' | 'selfJoin';
export interface UnresolvedJoint {
  readonly position: PointMm;
  readonly members: readonly WallEndRef[];
  readonly reason: UnresolvedJointReason;
}
export interface ResolveJointsResult {
  readonly joints: readonly Joint[];
  readonly unresolved: readonly UnresolvedJoint[];
}
export interface WallShape {
  readonly wallId: WallId;
  readonly outline: readonly PointMm[];
  readonly startJointId: JointId | null;
  readonly endJointId: JointId | null;
}
```

### 8. `cleanupWalls`

`src/domain/walls/cleanup.ts:671`:
```ts
export function cleanupWalls(walls: readonly Wall[], options: CleanupOptions = {}): CleanupResult
```

`CLEANUP_THRESHOLDS` — giá trị thật (`cleanup.ts:58-67`):
```ts
export const CLEANUP_THRESHOLDS = {
  sliverLengthMm: MIN_WALL_LENGTH_MM,   // = millimetres(30), từ edit.ts:35
  weldGapMm: millimetres(100),
  straightenAngleDeg: degrees(1.5),
  mergeOverlapMm: millimetres(80),
} as const;
```

`CleanupStep` (`cleanup.ts:78`):
```ts
export type CleanupStep = 'removeSliver' | 'weldGap' | 'straighten' | 'mergeOverlap';
```

`CleanupChange`, `CleanupResult`, `CleanupOptions` (`cleanup.ts:89-127`):
```ts
export interface CleanupChange {
  readonly id: CleanupChangeId;
  readonly step: CleanupStep;
  readonly pass: number;
  readonly message: string;   // câu tiếng Việt, VD: "Đã xoá tường W-... chỉ dài 12,0 mm..."
  readonly wallIds: readonly WallId[];
  readonly before: readonly Wall[];
  readonly after: readonly Wall[];
  readonly position: number;
}
export interface CleanupResult {
  readonly walls: readonly Wall[];
  readonly log: readonly CleanupChange[];
  readonly thicknessSuggestions: readonly ThicknessSuggestion[];
}
export interface CleanupOptions {
  readonly sliverLengthMm?: Millimetres;
  readonly weldGapMm?: Millimetres;
  readonly straightenAngleDeg?: Degrees;
  readonly mergeOverlapMm?: Millimetres;
}
```

`canUndoCleanupChange` (`cleanup.ts:740-744`), `undoCleanupChange`
(`cleanup.ts:753-768`):
```ts
export function canUndoCleanupChange(walls: readonly Wall[], change: CleanupChange): boolean
export function undoCleanupChange(
  walls: readonly Wall[],
  change: CleanupChange,
): readonly Wall[] | null
```

### 9. `splitWall`, `mergeWalls` — và câu từ chối tiếng Việt lấy từ đâu

`src/domain/walls/edit.ts:147-152`:
```ts
export function splitWall(
  wall: Wall,
  at: PointMm,
  secondId: WallId,
  options: SplitWallOptions = {},
): SplitWallResult
```

`edit.ts:204-208`:
```ts
export function mergeWalls(
  first: Wall,
  second: Wall,
  options: MergeWallsOptions = {},
): MergeWallsResult
```

`SplitWallOptions`, `SplitWallResult`, `SplitRefusal` (`edit.ts:41-46,62-65`):
```ts
export type SplitRefusal = 'pointOffWall' | 'pieceTooShort';
export type SplitWallResult =
  | { readonly ok: true; readonly walls: readonly [Wall, Wall] }
  | { readonly ok: false; readonly reason: SplitRefusal };
export interface SplitWallOptions {
  readonly minPieceLengthMm?: Millimetres;
}
```

`MergeWallsOptions`, `MergeWallsResult`, `MergeRefusal` (`edit.ts:49-76`):
```ts
export type MergeRefusal =
  | 'sameWall' | 'kindMismatch' | 'thicknessMismatch'
  | 'elevationMismatch' | 'angleTooWide' | 'tooFarApart';
export type MergeWallsResult =
  | { readonly ok: true; readonly wall: Wall; readonly removedId: WallId }
  | { readonly ok: false; readonly reason: MergeRefusal };
export interface MergeWallsOptions {
  readonly maxAngleDeg?: Degrees;
  readonly maxStrayMm?: Millimetres;
}
```

`MIN_WALL_LENGTH_MM = millimetres(30)` (`edit.ts:35`),
`MAX_MERGE_ANGLE_DEG = degrees(2)` (`edit.ts:38`).

`wallBearing`, `orientationDifference`, `overlapAlongLine` (`edit.ts:117,128,272`):
```ts
export function wallBearing(wall: Wall): Degrees
export function orientationDifference(first: Wall, second: Wall): Degrees
export function overlapAlongLine(first: Wall, second: Wall): Millimetres
```

**Câu tiếng Việt giải thích cho mỗi nhánh từ chối KHÔNG nằm trong
`domain/walls/edit.ts`** — `edit.ts` chỉ trả về mã lý do (`SplitRefusal` /
`MergeRefusal`, các union string trần, không kèm câu). Câu tiếng Việt thật nằm
ở tầng lệnh, tách hẳn khỏi domain:

`src/lib/commands/business/wallCommands.ts:714-717`:
```ts
const SPLIT_REFUSAL_REASONS: Readonly<Record<SplitRefusal, string>> = {
  pointOffWall: 'Điểm cắt không rơi vào đoạn tim tường nên không cắt được.',
  pieceTooShort: 'Cắt ở đây sẽ để lại một đoạn ngắn hơn mức tối thiểu.',
};
```

`wallCommands.ts:856-863`:
```ts
const MERGE_REFUSAL_REASONS: Readonly<Record<MergeRefusal, string>> = {
  sameWall: 'Hai mã tường trỏ về cùng một tường.',
  kindMismatch: 'Hai tường khác loại nên không gộp được.',
  thicknessMismatch: 'Hai tường khác độ dày nên không gộp được.',
  elevationMismatch: 'Hai tường khác cao độ nên không gộp được.',
  angleTooWide: 'Hai tường lệch phương quá nhiều nên không nằm trên cùng một đường.',
  tooFarApart: 'Hai tường nằm cách nhau quá xa nên đường gộp sẽ không phủ hết chỗ nối.',
};
```
→ Bảng này đứng trong `src/lib/commands/business/**`, không phải trong
`src/domain/**`. Màn được phép **đọc** (import) từ `src/lib/commands/**` (cấm
chỉnh sửa `src/lib`, không cấm dùng); nếu màn cần câu giải thích cho trạng thái
4 ("từ chối kèm giải thích"), nó gọi các builder lệnh (`wall.split`,
`wall.merge`) đã trả sẵn câu này qua `validateSplitWall` / `validateMergeWalls`
(`wallCommands.ts:720,866`) — không cần tự viết lại bảng.

`cleanupWalls` thì khác: `CleanupChange.message` (mục 8) đã là câu tiếng Việt
đầy đủ ngay trong domain (`cleanup.ts:253` v.v.), không cần lớp lệnh trung
gian.

---

## Nhóm C — ô mở trôi theo tường (M-09)

Nguồn: `src/domain/openings/{types,attach,reflow,validate}.ts`,
`src/domain/openings/__tests__/{attach,reflow}.test.ts`.

### 10. `reflowOpenings`, `reflowOpeningsAcrossSplit`

`src/domain/openings/reflow.ts:304-309`:
```ts
export function reflowOpenings(
  previousWall: Wall,
  nextWall: Wall,
  openings: readonly Opening[],
  rules: OpeningRules = OPENING_RULES,
): ReflowResult
```

`reflow.ts:355-360`:
```ts
export function reflowOpeningsAcrossSplit(
  originalWall: Wall,
  pieces: readonly [Wall, Wall],
  openings: readonly Opening[],
  rules: OpeningRules = OPENING_RULES,
): ReflowResult
```

`ReflowResult`, `ReflowChange`, `ReflowStatus`, `ReflowReason` (`reflow.ts:62-122`):
```ts
export type ReflowStatus = 'unchanged' | 'moved' | 'needsDecision';
export type ReflowReason =
  | 'positionKept' | 'wallReshaped' | 'slidInsideWall'
  | 'straddlesCut' | 'openingWiderThanWall' | 'wallHasNoLength';
export interface ReflowChange {
  readonly before: AttachedOpening;
  readonly after: AttachedOpening;
  readonly status: ReflowStatus;
  readonly reason: ReflowReason;
  readonly driftMm: Millimetres;
  readonly message: string;
}
export interface ReflowResult {
  readonly openings: readonly AttachedOpening[];
  readonly changes: readonly ReflowChange[];
  readonly needsDecision: readonly OpeningId[];
}
```

`REFLOW_STATUS_LABELS` — giá trị thật (`reflow.ts:71-75`):
```ts
export const REFLOW_STATUS_LABELS: Readonly<Record<ReflowStatus, string>> = {
  unchanged: 'Giữ nguyên',
  moved: 'Đã dịch chuyển',
  needsDecision: 'Cần người dùng quyết định',
};
```

`describeReflowStatus` (`reflow.ts:78-80`):
```ts
export function describeReflowStatus(status: ReflowStatus): string {
  return REFLOW_STATUS_LABELS[status];
}
```

### 11. `attachToWall`, `placeOnWall`, `openingCentre`

`src/domain/openings/attach.ts:349-353`:
```ts
export function attachToWall(
  opening: TracedOpening,
  walls: readonly Wall[],
  radiusMm: Millimetres = DEFAULT_ATTACH_RADIUS_MM,
): OpeningAttachment
```

`attach.ts:312`:
```ts
export function placeOnWall(wall: Wall, relativePosition: RelativePosition): PointMm
```

`attach.ts:386`:
```ts
export function openingCentre(wall: Wall, opening: AttachedOpening): PointMm
```

`DEFAULT_ATTACH_RADIUS_MM = millimetres(150)` (`attach.ts:67`).

`OpeningAttachment` (`attach.ts:70-86`):
```ts
export interface OpeningAttachment {
  readonly opening: Opening;
  readonly wallId: WallId | null;
  readonly distanceToCentrelineMm: Millimetres | null;
  readonly distanceToFaceMm: Millimetres | null;
  readonly message: string;
}
```

`AttachedOpening`, `RelativePosition` (`src/domain/openings/types.ts:83,145-149`):
```ts
export type RelativePosition = number;
export interface AttachedOpening extends OpeningCore {
  readonly wallId: WallId;
  readonly relativePosition: RelativePosition;
}
```

### 12. `validateOpening`, `validateOpenings`, `openingSpan`, `findOrphans`

`src/domain/openings/validate.ts:250-255`:
```ts
export function validateOpening(
  opening: AttachedOpening,
  wall: Wall,
  siblings: readonly Opening[] = [],
  rules: OpeningRules = OPENING_RULES,
): readonly OpeningViolation[]
```

`validate.ts:398-402`:
```ts
export function validateOpenings(
  openings: readonly Opening[],
  walls: readonly Wall[],
  rules: OpeningRules = OPENING_RULES,
): readonly OpeningViolation[]
```

`validate.ts:226`:
```ts
export function openingSpan(wall: Wall, opening: AttachedOpening): OpeningSpan
```

`validate.ts:451-455`:
```ts
export function findOrphans(
  openings: readonly Opening[],
  walls: readonly Wall[],
  rules: OpeningRules = OPENING_RULES,
): readonly OrphanReport[]
```

`OpeningViolation`, `OpeningRule`, `OpeningSeverity`, `OPENING_RULES`
(`validate.ts:81-90,97,100-116,119-128`):
```ts
export type OpeningSeverity = 'critical' | 'warning';
export type OpeningRule =
  | 'sizeNotPositive' | 'beyondWallEnd' | 'aboveWallTop' | 'overlappingOpenings'
  | 'doorHeight' | 'doorSill' | 'windowSill' | 'widthShareOfWall';
export interface OpeningViolation {
  readonly rule: OpeningRule;
  readonly severity: OpeningSeverity;
  readonly openingId: OpeningId;
  readonly wallId: WallId;
  readonly message: string;
  readonly otherOpeningId?: OpeningId;
}
export const OPENING_RULES: OpeningRules = {
  doorHeightMinMm: millimetres(1800),
  doorHeightMaxMm: millimetres(2400),
  doorSillHeightMm: millimetres(0),
  windowSillMinMm: millimetres(400),
  windowSillMaxMm: millimetres(1500),
  maxWidthShareOfWall: 0.8,
  movedToleranceMm: millimetres(1),
  orphanSuggestionRadiusMm: millimetres(1500),
};
```

**Trường chứng minh bằng số "cửa trên tường vẫn đúng vị trí tương đối":**
`AttachedOpening.relativePosition` (`openings/types.ts:148`, kiểu
`RelativePosition = number`, phân số `[0,1]` dọc centreline — xem
`types.ts:83-89`). Đây chính là bất biến `reflowOpenings` giữ nguyên khi tường
đổi hình (`reflow.ts:15-16`: "**The stored fraction is what is kept**"), và
`openingSpan(wall, opening).centreMm` (`validate.ts:226-234`,
`centreMm = opening.relativePosition * centrelineLength(wall)`) là con số
milimét cụ thể màn có thể hiện ra để so trước/sau. `ReflowChange.driftMm`
(`reflow.ts:104`) là số đo độ lệch tuyệt đối trên mặt bằng nếu cần cảnh báo.

---

## Nhóm D — hình học không hợp lệ (trạng thái 4 và 3)

Nguồn: `src/domain/rules/geometry/{index,messages}.ts`,
`src/domain/rules/{registry,runner}.ts`, `src/domain/rooms/{graph,detect,area}.ts`.

### 13. `checkWallOverlap` — tường cắt nhau, và cạnh gây lỗi

`src/domain/rules/geometry/index.ts:410`:
```ts
export const checkWallOverlap: GeometryCheck = (context) => { ... }
```
`GeometryCheck = (context: RuleContext) => readonly GeometryFinding[]`
(`index.ts:125`).

`GeometryFinding` (`index.ts:119-122`):
```ts
export interface GeometryFinding extends RuleFinding {
  readonly relatedIds: readonly string[];
}
```
(`RuleFinding` = `{ entityId, message, suggestion }`, `registry.ts:124-131`.)

**Có** — kết quả chỉ ra đúng cặp/cạnh gây lỗi: mỗi `finding` mang
`relatedIds: [wall.id, secondWall.id]` (subject trước, `index.ts:437-441,452-457`),
và với trường hợp cắt ngang, `wallCrossingText` (`messages.ts:85-94`) nhận
`at: { x, y }` — **toạ độ chính xác điểm cắt** (`index.ts:453`, tính bằng
`properCrossingOf`, `index.ts:255-271`). Trường mang toạ độ đó:
`WallCrossingInput.at` (`messages.ts:78-83`). Với trường hợp chồng dọc cùng
đường, `wallOverlapAlongText` (`messages.ts:67-76`) mang `overlapMm` — độ dài
đoạn chồng.

### 14. `checkDanglingWallEnds`, `checkRoomClosure` — vòng hở, kích thước khe hở

`index.ts:481`:
```ts
export const checkDanglingWallEnds: GeometryCheck = (context) => { ... }
```
`danglingEndText` (`messages.ts:111-129`) nhận `DanglingEndInput`
(`messages.ts:100-109`):
```ts
export interface DanglingEndInput {
  readonly wallId: string;
  readonly at: { readonly x: number; readonly y: number };
  readonly nearestGapMm: number | null;   // ← khe hở bằng số, milimét
  readonly nearestWallId: string | null;
  readonly toleranceMm: number;
}
```

`index.ts:557`:
```ts
export const checkRoomClosure: GeometryCheck = (context) => { ... }
```
`roomNotClosedText` (`messages.ts:149-160`) nhận `RoomNotClosedInput`
(`messages.ts:135-147`):
```ts
export interface RoomNotClosedInput {
  readonly roomId: string;
  readonly roomName: string;
  readonly uncoveredMm: number;   // ← tổng chiều dài hở, milimét
  readonly perimeterMm: number;
  readonly gapCount: number;
  readonly worstGapAt: { readonly x: number; readonly y: number };
  readonly worstGapMm: number;    // ← khe hở dài nhất, milimét — dùng cho nút "Đóng khe hở"
}
```

**Có, kích thước khe hở là số thật**: `nearestGapMm` (dangling end) và
`worstGapMm`/`uncoveredMm` (room closure) đều là `number` tính trực tiếp từ
hình học (`index.ts:497-511` và `index.ts:612-626`), không phải suy diễn từ
câu chữ.

### 15. `RuleFinding`, `GeometryFinding`, `RuleContext`, `Rule` — chạy một rule lẻ

`RuleContext`, `Rule`, `RuleFinding` — `src/domain/rules/registry.ts:111-114,144-162,124-131`:
```ts
export interface RuleContext {
  readonly graph: NormalizedSpatial;
  readonly levelId: LevelId | null;
}
export interface RuleFinding {
  readonly entityId: string;
  readonly message: string;
  readonly suggestion: string;
}
export interface Rule {
  readonly code: RuleCode;
  readonly name: string;
  readonly group: RuleGroup;
  readonly severity: RuleSeverity;
  readonly scope: RuleScope;
  readonly dependsOn: readonly RuleSubject[];
  readonly check: RuleCheck;
}
```

**CÓ — màn gọi được một rule mà không chạy cả bộ.** Mỗi hàm kiểm (ví dụ
`checkWallOverlap`, `checkDanglingWallEnds`, `checkRoomClosure`) được export
riêng lẻ và là hàm thuần `(context: RuleContext) => readonly GeometryFinding[]`
(`index.ts:410,481,557`) — gọi thẳng, không cần `runRules`/`registry` gì cả.
Bằng chứng: các test ở `src/domain/rules/__tests__/geometry.test.ts` gọi trực
tiếp `checkWallOverlap({ graph, levelId })` mà không dựng registry. `runRules`
(`src/domain/rules/runner.ts:384`) vẫn chạy được incremental theo một rule nếu
cần (qua `changes` trỏ đúng subject, `runner.ts:218-274`), nhưng cách đơn giản
nhất cho một rule lẻ là gọi thẳng hàm `check` xuất sẵn.

### 16. `buildWallGraph`, `detectRooms`, `computeArea`, `signedAreaMm2`, `computeCentroid`, `outlineContains` — chữ ký

`src/domain/rooms/graph.ts:677-680`:
```ts
export function buildWallGraph(
  walls: readonly Wall[],
  weldGapMm: Millimetres = DEFAULT_WELD_GAP_MM,
): PlanarWallGraph
```

`src/domain/rooms/detect.ts:413-416`:
```ts
export function detectRooms(
  walls: readonly Wall[],
  options: DetectRoomsOptions = {},
): DetectRoomsResult
```

`src/domain/rooms/area.ts:192,179,235,278`:
```ts
export function computeArea(outline: readonly PointMm[]): SquareMetres
export function signedAreaMm2(outline: readonly PointMm[]): number
export function computeCentroid(outline: readonly PointMm[]): PointMm
export function outlineContains(outline: readonly PointMm[], point: PointMm): boolean
```

---

## KIỂM KÊ LỖ HỔNG

### LỖ HỔNG 1 — "vết vẽ gốc của AI" (snap thứ tư + chip "Lệch so với bản vẽ gốc")

**NOT FOUND.** Không có nơi nào lưu hình học GỐC của một bức tường trước khi
người dùng sửa.

Lệnh đã chạy:
```
Read src/domain/walls/types.ts   (135 dòng, toàn văn) — interface Wall không có
  trường nào kiểu "hình học trước sửa" / "originalCentreline" / "traced*".
grep -rniE "aiOriginal|originalGeometry|previousGeometry|originalCentreline|
  originalWall|beforeAi|traceOrigin" src/domain src/store src/api src/lib
  → chỉ khớp tham số hàm `originalWall: Wall` trong reflow.ts (là tường TRƯỚC
    một lần cắt trong CÙNG một thao tác, không phải hình học gốc do AI vẽ).
grep -n "aiOriginalMm" src/components/ui/ThicknessField.tsx
  → xác nhận đúng gợi ý trong đặc tả: đây là một CON SỐ ĐỘ DÀY (mm), không
    phải hình học (centreline/toạ độ).
find src/lib/versioning → conflict.ts, diff.ts, mergeStrategies.ts, restore.ts.
Read toàn văn diff.ts, restore.ts.
grep -rniE "'ai'|\"ai\"|aiGenerated|aiTraced|isAiOrigin|modelOrigin|
  source:\s*'model'|creatorId" src/lib/versioning src/store src/api src/domain
Read src/domain/spatial/types.ts:50-64 (DataSource, ReviewMetadata).
```

Chi tiết:

- `Wall` của `src/domain/walls/types.ts:61-70` (dùng cho hình học đang sửa
  trong màn này) không có trường nào giữ centreline/hình học cũ.
- `src/domain/spatial/types.ts:50-64` có `DataSource = 'ai' | 'human'` và
  `ReviewMetadata { confidence, source, reviewed }`, và `Wall` của
  `spatial/types.ts` (đồ thị đã chuẩn hoá — khác `domain/walls/types.ts`,
  xem mục 6) kế thừa `ReviewMetadata`. Nhưng đây chỉ là **cờ trạng thái**
  (tường này do AI dò hay người vẽ, đã được duyệt hay chưa) — **không lưu giá
  trị hình học nào của lần trước**. `reviewed` chuyển `true` không làm mất
  cũng không giữ lại centreline cũ.
- `src/lib/versioning/diff.ts:7-11` có `VersionSnapshot = Record<EntityKind,
  Record<string, EntityRecord>>` — mỗi phiên bản (`VersionEntry`,
  `restore.ts:11-13`) giữ một snapshot TOÀN BỘ project dưới dạng bản ghi
  **không định kiểu** (`EntityRecord { [field: string]: unknown }`). Về lý
  thuyết, nếu ứng dụng lưu một phiên bản ngay sau khi AI dò xong (trước khi
  người dùng sửa), thì `sourceVersion.snapshot.wall[wallId]` có thể chứa
  centreline gốc. Nhưng:
  1. Không có hàm nào trong `versioning/**` đọc riêng "hình học gốc của một
     tường" — chỉ có `diffEntityKind` (`diff.ts:56-90`) so **hai phiên bản**
     theo từng trường, dùng cho lịch sử chỉnh sửa chung, không gắn với khái
     niệm "bản AI".
  2. Chỉ 50 phiên bản gần nhất giữ snapshot đầy đủ
     (`MAX_FULL_VERSIONS = 50`, `restore.ts:20`); phiên bản cũ hơn bị rút gọn
     còn metadata, mất snapshot.
  3. Không có bằng chứng nào cho thấy app tạo một phiên bản mốc ngay sau khi
     AI dò xong và trước khi người dùng chạm vào.
  4. Id một bức tường KHÔNG ổn định qua `splitWall`/`mergeWalls`
     (mục 9: `splitWall` sinh `secondId` mới, `mergeWalls` xoá một trong hai
     id) — đúng những thao tác M-04/M-05 mà màn này gọi lại sau mỗi lệnh. Vậy
     kể cả nếu có snapshot AI, việc dò "tường này ứng với record nào ở phiên
     bản gốc" không tầm thường và không có hàm nào làm sẵn.

**Kết luận:** không có đường nào, kể cả gián tiếp qua `versioning`, hiện đọc
ra được "hình học gốc do AI vẽ" của một tường cụ thể. (a) loại bắt điểm thứ tư
và (b) chip "Lệch so với bản vẽ gốc: 12 mm" **không dựng được** với dữ liệu
hiện có.

### LỖ HỔNG 2 — bắt điểm theo trục có tên ("Trục B")

**NOT FOUND.**

Lệnh đã chạy:
```
Read src/domain/units/snap.ts (toàn văn) — SnapTargetKind chỉ có 5 nhánh.
Read src/domain/axes/detect.ts, src/domain/axes/label.ts (toàn văn).
```

`SnapTargetKind = AnchorKind | 'perpendicular' | 'grid'` (`snap.ts:29,32`) —
**không có nhánh nào cho trục**. `DetectedAxis` (`axes/detect.ts:59-71`) và
`LabelledAxis`/`labelAxes` (`axes/label.ts:50-55,226-262`) tồn tại và đầy đủ
(direction, coordinateMm, span, nhãn số/chữ theo đúng quy ước công trường —
xem `axes/label.ts:1-30`), nhưng **không có hàm nào đưa một `DetectedAxis` vào
`snapToTargets`**. Nếu một trục được đưa vào như một `SnapTarget`, nó chỉ có
thể mượn nhánh `'perpendicular'` (đường thẳng, có `segment`) hoặc bị đối xử
như một anchor điểm (`wallVertex`/`intersection`/`midpoint`) — cả hai đều
**không tự gọi tên đúng là "trục"**: `SnapResult.kind` sẽ trả về
`'perpendicular'` hoặc một trong ba anchor kind, chứ không có giá trị `'axis'`
nào để hiển thị "Trục B".

**Kết luận:** không có cách nào hiện tại khiến kết quả bắt điểm tự gọi đúng
tên là trục; cần thêm nhánh `SnapTargetKind` mới (sửa `src/domain/units/snap.ts`
— bị cấm sửa theo đặc tả màn) mới dựng được.

### LỖ HỔNG 3 — công cụ chế độ sửa (S-08)

**NOT FOUND** cho `ToolId`; và **KHÔNG**, màn không tự khai được tool tại chỗ.

Lệnh đã chạy:
```
grep -n "TOOL_IDS|ToolId|reduceTool|ToolDefinition" src/lib/tools/toolMachine.ts
Read src/lib/tools/toolMachine.ts:1-115, 315-380 (toàn văn phần khai báo).
```

`TOOL_IDS` — liệt kê TOÀN BỘ, thật (`toolMachine.ts:84-104`):
```ts
export type ToolId =
  | 'select' | 'pan' | 'drawWall' | 'placeOpening'
  | 'placeFurniture' | 'measure' | 'splitWall' | 'annotate';

export const TOOL_IDS = [
  'select', 'pan', 'drawWall', 'placeOpening',
  'placeFurniture', 'measure', 'splitWall', 'annotate',
] as const satisfies readonly ToolId[];
```
Không có `editVertex`, `moveVertex`, `dragVertex`, hay bất kỳ id nào cho sửa
đỉnh tường.

`ToolRegistry = Readonly<Record<ToolId, ToolDefinition>>` (`toolMachine.ts:340`,
chú thích ngay trên "A complete record, so a new id fails the build",
`toolMachine.ts:339`) — đây là một **union đóng**: `ToolId` là kiểu string
literal cố định 8 giá trị, và `ToolRegistry` bắt buộc có đủ 8 khoá đó, không
hơn không kém (TypeScript sẽ báo lỗi build nếu registry thiếu hoặc thừa khoá).
Muốn thêm một `ToolId` thứ chín, bắt buộc phải sửa union `ToolId` tại
`toolMachine.ts:84-92` — tức sửa `src/lib/**`, việc đặc tả màn cấm tuyệt đối
("KHÔNG ĐƯỢC SỬA FILE NÀO: `src/lib/**`...").

**Kết luận:** không có `ToolId` sẵn cho sửa đỉnh; và không, `reduceTool`/
`ToolDefinition` không cho một màn tự khai thêm một tool cục bộ mà không đổi
`src/lib/tools/toolMachine.ts` — `ToolId` không phải kiểu mở (không phải
`string`, không có nhánh "khác"), nó là union đóng đúng 8 giá trị.

### LỖ HỔNG 4 — kiểm đa giác tự cắt

**NOT FOUND.**

Lệnh đã chạy:
```
grep -rniE "selfIntersect|segmentsIntersect|self-intersect|polygonSelfIntersect|
  isSimplePolygon" src/domain src/lib
→ không có kết quả nào.
```

Không có hàm nào tên `selfIntersect`, `segmentsIntersect`, hay tương đương
trong toàn bộ `src/domain/**` và `src/lib/**`.

**`checkWallOverlap` (`rules/geometry/index.ts:410`, mục 13) thay thế được tới
đâu:**
- Với dữ liệu đã là `Wall[]` của một tầng (`entitiesInScope(context, 'wall')`,
  `index.ts:411`), `checkWallOverlap` so **mọi cặp tường** trong tầng
  (vòng lặp đôi `index.ts:414-459`), không chỉ các cặp liền kề trong một chuỗi
  — nên nó phát hiện được đúng trường hợp một chuỗi tường tạo thành đa giác tự
  cắt: hai cạnh không liền kề của "đa giác" (hai `Wall` bất kỳ) cắt nhau ở
  giữa (không phải tại đầu mút, nhờ `properCrossingOf` loại trừ giao tại nút
  nối, `index.ts:255-271`) sẽ bị báo là `wallCrossingText`. Về mặt phát hiện
  hình học, đây là **thay thế đầy đủ** cho "polygon tự cắt", miễn đa giác đó
  đã được dựng thành các đối tượng `Wall`.
- **Giới hạn:** `checkWallOverlap` cần `Wall[]` thật (có `id`, `thicknessMm`,
  `centreline`) đọc qua `RuleContext`/đồ thị đã chuẩn hoá
  (`entitiesInScope`, `registry.ts:175-192`). Nó **không** áp dụng được cho
  một chuỗi điểm thô (`PointMm[]`) chưa dựng thành tường — ví dụ ghost đang
  kéo trong lúc người dùng vẽ, hay một polygon tạm trong bộ nhớ của tool trước
  khi phát lệnh `commit`. Cho trường hợp đó, đặc tả nếu cần kiểm tự cắt ngay
  trong lúc kéo sẽ phải tự viết phép kiểm đoạn-cắt-đoạn cho mảng điểm — không
  có sẵn hàm nào trong domain làm việc này trên `PointMm[]` trần.

**Kết luận:** không có hàm kiểm tự cắt chuyên dụng; `checkWallOverlap` thay
thế đầy đủ cho polygon/chuỗi tường đã dựng thành `Wall[]` của một tầng, nhưng
không thay thế được cho một chuỗi điểm chưa dựng thành tường.

---

## NOT FOUND (tổng hợp)

- Ánh xạ `SnapTargetKind` → nhãn tiếng Việt (mục 5).
- Hình học gốc do AI vẽ trước khi người dùng sửa, ở bất kỳ tầng nào kể cả
  `versioning` (LỖ HỔNG 1).
- Nhánh trục trong `SnapTargetKind`, và đường nối `DetectedAxis` vào
  `snapToTargets` (LỖ HỔNG 2).
- `ToolId` cho sửa đỉnh tường; cơ chế khai tool cục bộ trong thư mục màn
  (LỖ HỔNG 3).
- Hàm kiểm đa giác/chuỗi tường tự cắt chính nó (LỖ HỔNG 4).
