# Khảo sát tầng domain cho FloorManager (S-16 T1)

Chỉ đọc. Mọi ký hiệu dưới đây kèm `grep -n` thật đã chạy trên worktree này. Đơn vị
ghi rõ ở mọi con số: mm (milimét) hay m (mét).

---

## A. `src/domain/axes/alignFloors.ts` (M-11)

### Chữ ký nguyên văn

```
grep -n "export interface FloorPlan\|export interface FloorTransform\|export interface FloorAlignment\b\|export interface FloorAlignmentReport\|export interface AlignFloorsOptions\|export interface FloorIssue\b\|export type FloorIssueKind\|export function alignFloors\|export function ceilingElevationMm\|export function pickBaseFloor\|MIN_CLEAR_HEIGHT_MM\|MAX_CLEAR_HEIGHT_MM\|ALIGNMENT_WARNING_THRESHOLD_MM" src/domain/axes/alignFloors.ts
```
```
61:export const ALIGNMENT_WARNING_THRESHOLD_MM: Millimetres = millimetres(150);
70:export const MIN_CLEAR_HEIGHT_MM: Millimetres = millimetres(2400);
73:export const MAX_CLEAR_HEIGHT_MM: Millimetres = millimetres(6000);
82:export interface FloorPlan {
98:export interface FloorTransform {
113:export type FloorIssueKind = 'alignment' | 'unalignable' | 'clearHeight' | 'overlap';
123:export interface FloorIssue {
136:export interface FloorAlignment {
152:export interface FloorAlignmentReport {
161:export interface AlignFloorsOptions {
417:export function pickBaseFloor(floors: readonly FloorPlan[]): FloorPlan | null {
451:export function ceilingElevationMm(floor: FloorPlan): Millimetres {
548:export function alignFloors(
```

Nội dung đầy đủ từng ký hiệu (chép nguyên văn từ file, dòng ghi kèm):

```ts
// src/domain/axes/alignFloors.ts:82-88
export interface FloorPlan {
  readonly levelId: LevelId;
  readonly name: string;
  readonly floorElevationMm: Millimetres;   // cao độ mặt sàn hoàn thiện, từ datum. Đơn vị: mm
  readonly clearHeightMm: Millimetres;      // sàn tới trần (không phải sàn tới sàn). Đơn vị: mm
  readonly axes: readonly DetectedAxis[];
}

// src/domain/axes/alignFloors.ts:98-103
export interface FloorTransform {
  readonly rotationDeg: FloorRotation;      // 0 | 90 | 180 | 270
  readonly translationMm: PointMm;
  /** Luôn luôn là `1`. Tầng không bao giờ bị co giãn. */
  readonly scale: 1;
}

// src/domain/axes/alignFloors.ts:113
export type FloorIssueKind = 'alignment' | 'unalignable' | 'clearHeight' | 'overlap';

// src/domain/axes/alignFloors.ts:123-133
export interface FloorIssue {
  readonly kind: FloorIssueKind;
  readonly levelId: LevelId;
  readonly relatedLevelId: LevelId | null;  // tầng liên quan, cho vấn đề giữa 2 tầng
  readonly severity: 'attention' | 'violation';
  readonly amountMm: Millimetres;           // độ lệch/chồng lấn, đơn vị mm
  readonly message: string;                 // câu tiếng Việt sẵn có, nêu tên tầng + số mm
}

// src/domain/axes/alignFloors.ts:136-149
export interface FloorAlignment {
  readonly levelId: LevelId;
  readonly name: string;
  readonly isBase: boolean;
  readonly transform: FloorTransform;
  readonly maxResidualMm: Millimetres;      // mm
  readonly matchedAxisCount: number;
  readonly axisCount: number;
  readonly alignedAxes: readonly DetectedAxis[];
}

// src/domain/axes/alignFloors.ts:152-159
export interface FloorAlignmentReport {
  readonly baseLevelId: LevelId | null;
  readonly floors: readonly FloorAlignment[];
  readonly issues: readonly FloorIssue[];
}

// src/domain/axes/alignFloors.ts:161-168
export interface AlignFloorsOptions {
  readonly baseLevelId?: LevelId;
  readonly captureMm?: Millimetres;
  readonly warningThresholdMm?: Millimetres;
}

// src/domain/axes/alignFloors.ts:548-551
export function alignFloors(
  floors: readonly FloorPlan[],
  options: AlignFloorsOptions = {},
): FloorAlignmentReport

// src/domain/axes/alignFloors.ts:451-453
export function ceilingElevationMm(floor: FloorPlan): Millimetres {
  return millimetres(floor.floorElevationMm + floor.clearHeightMm);
}

// src/domain/axes/alignFloors.ts:417
export function pickBaseFloor(floors: readonly FloorPlan[]): FloorPlan | null
```

### Ba hằng số và ý nghĩa

- `MIN_CLEAR_HEIGHT_MM = 2400` mm (`alignFloors.ts:70`) — chiều cao thông thuỷ thấp nhất một tầng được xây.
- `MAX_CLEAR_HEIGHT_MM = 6000` mm (`alignFloors.ts:73`) — chiều cao thông thuỷ cao nhất còn tính là một tầng (quá số này coi như khoảng trống thông tầng).
- `ALIGNMENT_WARNING_THRESHOLD_MM = 150` mm (`alignFloors.ts:61`) — độ lệch còn lại sau khi ghép trục; vượt ngưỡng thì phát cảnh báo `attention` (bằng bề dày một vách ngăn).

### CÂU HỎI TRỌNG TÂM — cao độ tích luỹ tính bằng hàm nào?

**`ceilingElevationMm(floor)` (`alignFloors.ts:451-453`) chỉ nhận MỘT `FloorPlan` và trả về
`floorElevationMm + clearHeightMm` — đỉnh không khí của CHÍNH tầng đó, không phải cao độ mới
của tầng kế tiếp trong một danh sách.**

Grep toàn file cho mọi chỗ cộng dồn elevation+height:
```
grep -n "elevationMm\|clearHeightMm\|floorElevationMm" src/domain/axes/alignFloors.ts
```
Kết quả: chỉ có `ceilingElevationMm` (dòng 451-453) và `overlapIssues` (dòng 489-525) — hàm này
SO SÁNH cao độ giữa các tầng đã có sẵn (`ceilingElevationMm(lower)` so với `upper.floorElevationMm`)
để phát hiện chồng lấn, **nó không tính lại cao độ cho một danh sách tầng đã sắp theo chiều cao**.
Cả `alignFloors()` và `pickBaseFloor()` đều KHÔNG gán/tính lại `floorElevationMm` — chúng đọc
`floorElevationMm` như dữ liệu đầu vào cố định (`floors: readonly FloorPlan[]`), chỉ tính
`transform` (xoay + tịnh tiến mặt bằng) và các `issues`.

**NOT FOUND: không có hàm nào trong `src/domain/axes/alignFloors.ts` (hay bất kỳ đâu trong
`src/domain`) cộng dồn cao độ cho cả một danh sách tầng (tầng thứ n = tầng thứ n-1 + chiều cao
tầng thứ n-1).**

Mảnh ghép có sẵn GẦN NHẤT — không phải trong `src/domain`, mà là một hàm **private, không export**
trong tầng lệnh:

```
grep -n "const restack\|elevationMm +=\|datumElevationMm" src/lib/commands/business/roomFloorCommands.ts
```
```
668:const restack = (context: CommandContext, levelIds: readonly LevelId[]): StackedLevel[] => {
670:  let elevationMm = context.graph.building.datumElevationMm;
680:    elevationMm += level.heightMm;
778:        `${formatElevationM(context.graph.building.datumElevationMm)}.`,
```

```ts
// src/lib/commands/business/roomFloorCommands.ts:654-684 (không export)
interface StackedLevel {
  readonly level: Level;
  readonly order: number;
  readonly elevationMm: number;
}

const restack = (context: CommandContext, levelIds: readonly LevelId[]): StackedLevel[] => {
  const stacked: StackedLevel[] = [];
  let elevationMm = context.graph.building.datumElevationMm;

  levelIds.forEach((levelId, order) => {
    const level = readOf(context.graph, 'level', levelId);
    if (level === null) return;
    stacked.push({ level, order, elevationMm });
    elevationMm += level.heightMm;
  });

  return stacked;
};
```

Đây là logic tích luỹ THẬT SỰ đang chạy trong repo (dùng bởi lệnh `level.reorder`), nhưng nó
**không được export** khỏi `roomFloorCommands.ts`, nên không gọi thẳng được từ màn hình. Nếu
FloorManager cần hiển thị/tính lại cao độ tích luỹ cho một danh sách tầng, đây là NGHIỆP VỤ
CHƯA CÓ SẴN Ở TẦNG DOMAIN/PUBLIC API — phải hỏi điều phối viên bằng `orca orchestration ask`
theo R-69, không được tự chế công thức trong screen. `datumElevationMm` là điểm bắt đầu
(`Building.datumElevationMm`, `spatial/types.ts:99`, đơn vị mm).

---

## B. `src/domain/axes/copyFloor.ts`

### Chữ ký nguyên văn

```
grep -n "export interface FloorContents\|export interface CopyFloorOptions\|export interface CopyFloorResult\|export type IdFactory\|export function copyFloor\|export function floorEntityIds\|includeOpenings\|includeRooms\|includeFurniture\|includeAxes\|includeDimensions\|throw new" src/domain/axes/copyFloor.ts
```
```
58:export interface FloorContents {
77:export type IdFactory = (kind: EntityKind, sourceId: EntityId) => EntityId;
85:export interface CopyFloorOptions {
89:  readonly includeOpenings?: boolean;
90:  readonly includeRooms?: boolean;
91:  readonly includeFurniture?: boolean;
92:  readonly includeAxes?: boolean;
93:  readonly includeDimensions?: boolean;
97:export interface CopyFloorResult {
230:export function copyFloor(
236:    throw new RangeError(`Cannot copy level ${source.levelId} onto itself.`);
239:  const includeOpenings = options.includeOpenings ?? true;
240:  const includeRooms = options.includeRooms ?? true;
241:  const includeFurniture = options.includeFurniture ?? true;
242:  const includeAxes = options.includeAxes ?? true;
243:  const includeDimensions = options.includeDimensions ?? true;
253:      throw new Error(`copyFloor: minted id ${created} for ${sourceId} is not a valid ${kind} id.`);
256:      throw new Error(`copyFloor: minted id ${created} for ${sourceId} is already in use.`);
460:export function floorEntityIds(contents: FloorContents): EntityId[] {
```

```ts
// src/domain/axes/copyFloor.ts:58-66
export interface FloorContents {
  readonly levelId: LevelId;
  readonly walls: readonly Wall[];
  readonly openings: readonly Opening[];
  readonly rooms: readonly Room[];
  readonly furniture: readonly Furniture[];
  readonly axes: readonly Axis[];
  readonly dimensions: readonly Dimension[];
}

// src/domain/axes/copyFloor.ts:77
export type IdFactory = (kind: EntityKind, sourceId: EntityId) => EntityId;

// src/domain/axes/copyFloor.ts:85-94
export interface CopyFloorOptions {
  readonly createId?: IdFactory;
  readonly reservedIds?: Iterable<string>;
  readonly includeOpenings?: boolean;
  readonly includeRooms?: boolean;
  readonly includeFurniture?: boolean;
  readonly includeAxes?: boolean;
  readonly includeDimensions?: boolean;
}

// src/domain/axes/copyFloor.ts:97-108
export interface CopyFloorResult {
  readonly contents: FloorContents;
  readonly idMap: ReadonlyMap<EntityId, EntityId>;
  readonly droppedSourceIds: readonly EntityId[];
  readonly copiedCount: number;
}

// src/domain/axes/copyFloor.ts:230-234
export function copyFloor(
  source: FloorContents,
  targetLevelId: LevelId,
  options: CopyFloorOptions = {},
): CopyFloorResult

// src/domain/axes/copyFloor.ts:460-469
export function floorEntityIds(contents: FloorContents): EntityId[]
```

### 5 cờ `include*` — mặc định và ý nghĩa

Tường (`walls`) LUÔN được copy, không có cờ tắt. Cả 5 cờ dưới đây mặc định `true` (tắt là hành
động chủ ý):

| Cờ | Mặc định | Dòng |
|---|---|---|
| `includeOpenings` | `true` | `copyFloor.ts:239` |
| `includeRooms` | `true` | `copyFloor.ts:240` |
| `includeFurniture` | `true` | `copyFloor.ts:241` |
| `includeAxes` | `true` | `copyFloor.ts:242` |
| `includeDimensions` | `true` | `copyFloor.ts:243` |

### Mọi trường hợp `throw`

1. `RangeError` — `copyFloor.ts:236`: `targetLevelId === source.levelId` (copy tầng vào chính nó).
2. `Error` — `copyFloor.ts:253`: `createId` (factory tự truyền) trả về id sai kind
   (`isIdOfKind(kind, created)` là `false`).
3. `Error` — `copyFloor.ts:256`: id do factory mint ra đã bị trùng (`taken.has(created)`), kể cả
   khi dùng factory tự truyền hay factory mặc định (`hashedIdFactory`).

Ghi chú: các trường hợp không throw — đối tượng mất tham chiếu (opening trỏ tới wall không có
trong `idMap`, dimension mất một đầu tham chiếu) chỉ bị **bỏ qua và đẩy vào `droppedSourceIds`**
(`copyFloor.ts:308-315`, `420-426`), KHÔNG throw.

```ts
// src/domain/axes/copyFloor.ts:460-469
export function floorEntityIds(contents: FloorContents): EntityId[] {
  return [
    ...contents.walls.map((wall) => wall.id),
    ...contents.openings.map((opening) => opening.id),
    ...contents.rooms.map((room) => room.id),
    ...contents.furniture.map((item) => item.id),
    ...contents.axes.map((axis) => axis.id),
    ...contents.dimensions.map((dimension) => dimension.id),
  ];
}
```

---

## C. `src/domain/spatial/` — mô hình đa tầng (D-11) và đếm theo tầng (D-12)

### `types.ts` — `Level` (MỌI trường)

```
grep -n "export interface Level\b\|export interface ReviewMetadata\|export interface Building\|export interface SpatialGraph\|export type LevelId\|export type Millimetres\|export type SquareMetres" src/domain/spatial/types.ts
```
```
16:export type Millimetres = number;
19:export type SquareMetres = number;
61:export interface ReviewMetadata {
68:export type LevelId = `L-${string}`;
95:export interface Building extends ReviewMetadata {
104:export interface Level extends ReviewMetadata {
245:export interface SpatialGraph {
```

```ts
// src/domain/spatial/types.ts:104-117
export interface Level extends ReviewMetadata {
  id: LevelId;                    // 'L-...'
  name: string;
  order: number;                  // thứ tự từ dưới lên, tầng trệt = 0
  elevationMm: Millimetres;       // mm — cao độ tầng
  heightMm: Millimetres;          // mm — chiều cao tầng (sàn-sàn, không phải thông thuỷ)
  areaM2?: SquareMetres;          // m² — tuỳ chọn
  scaleMillimetresPerPixel?: MillimetresPerPixel; // mm/px — tuỳ chọn, chưa hiệu chỉnh thì chưa có
}

// src/domain/spatial/types.ts:61-65
export interface ReviewMetadata {
  confidence: Confidence;   // [0, 1]
  source: DataSource;       // 'ai' | 'human'
  reviewed: boolean;
}

// src/domain/spatial/types.ts:95-101
export interface Building extends ReviewMetadata {
  name: string;
  address?: string;
  datumElevationMm: Millimetres;  // mm — datum +0.000
  grossFloorAreaM2?: SquareMetres; // m²
}

// src/domain/spatial/types.ts:245-255
export interface SpatialGraph {
  building: Building;
  levels: readonly Level[];
  walls: readonly Wall[];
  openings: readonly Opening[];
  furniture: readonly Furniture[];
  rooms: readonly Room[];
  axes: readonly Axis[];
  dimensions: readonly Dimension[];
  notes: readonly Note[];
}

// src/domain/spatial/types.ts:16, 19, 68
export type Millimetres = number;   // KHÔNG branded — khác với units/types.ts!
export type SquareMetres = number;  // KHÔNG branded
export type LevelId = `L-${string}`;
```

**BẪY QUAN TRỌNG:** `Millimetres`/`SquareMetres` ở đây (`spatial/types.ts:16,19`) là alias
`number` TRẦN, không phải branded `Quantity<'mm'>` như `src/domain/units/types.ts`. Hai kiểu
cùng tên nhưng KHÁC MODULE — `Level.heightMm: Millimetres` (spatial) nhận thẳng `number`, còn
`millimetres()` (units) trả về giá trị được gắn nhãn không gán trực tiếp cho nhau nếu import
nhầm module. Ghi rõ import đúng nguồn khi viết FloorManager.

### `normalize.ts`

```
grep -n "export interface NormalizedSpatial\|export const normalizeSpatial\|export const denormalizeSpatial\|export const idsOnLevel\|export const resolveLevelId\|export const isEntityOfKind\|export interface EntityByKind" src/domain/spatial/normalize.ts
```
```
35:export interface EntityByKind {
49:export interface NormalizedSpatial {
65:export const isEntityOfKind = <K extends EntityKind>(kind: K, entity: SpatialEntity): entity is EntityByKind[K] =>
74:export const resolveLevelId = (
107:export const normalizeSpatial = (graph: SpatialGraph): NormalizedSpatial => {
217:export const denormalizeSpatial = (normalized: NormalizedSpatial): SpatialGraph => ({
230:export const idsOnLevel = (normalized: NormalizedSpatial, levelId: LevelId): readonly EntityId[] =>
```

```ts
// src/domain/spatial/normalize.ts:35-43
export interface EntityByKind {
  level: Level; wall: Wall; opening: Opening; furniture: Furniture;
  room: Room; axis: Axis; dimension: Dimension;
}

// src/domain/spatial/normalize.ts:49-55
export interface NormalizedSpatial {
  building: Building;
  byId: Readonly<Record<string, SpatialEntity>>;
  byLevel: Readonly<Record<string, readonly EntityId[]>>;
  byKind: Readonly<Record<EntityKind, readonly EntityId[]>>;
  notes: readonly Note[];
}

// src/domain/spatial/normalize.ts:107
export const normalizeSpatial = (graph: SpatialGraph): NormalizedSpatial

// src/domain/spatial/normalize.ts:217
export const denormalizeSpatial = (normalized: NormalizedSpatial): SpatialGraph

// src/domain/spatial/normalize.ts:230-231
export const idsOnLevel = (normalized: NormalizedSpatial, levelId: LevelId): readonly EntityId[] =>
  normalized.byLevel[levelId] ?? NO_IDS;

// src/domain/spatial/normalize.ts:74-89
export const resolveLevelId = (
  entity: SpatialEntity,
  byId: Readonly<Record<string, SpatialEntity>>,
): LevelId | null
// level → null; opening → level của wall nó cắm vào; còn lại → entity.levelId

// src/domain/spatial/normalize.ts:65-66
export const isEntityOfKind = <K extends EntityKind>(kind: K, entity: SpatialEntity): entity is EntityByKind[K] =>
  isIdOfKind(kind, entity.id);
```

### `ids.ts`

```
grep -n "export const ID_PREFIX_BY_KIND\|export type EntityKind\|export const createId\|export const isIdOfKind\|export const readKindFromId\|export const isValidId" src/domain/spatial/ids.ts
```
```
15:export const ID_PREFIX_BY_KIND = {
26:export type EntityKind = keyof typeof ID_PREFIX_BY_KIND;
87:export const createId = <K extends EntityKind>(kind: K): IdByKind[K] => {
108:export const isIdOfKind = <K extends EntityKind>(kind: K, id: string): id is IdByKind[K] => {
119:export const readKindFromId = (id: string): EntityKind | null => {
130:export const isValidId = (id: string): boolean => readKindFromId(id) !== null;
```

```ts
// src/domain/spatial/ids.ts:15-23
export const ID_PREFIX_BY_KIND = {
  level: 'L', wall: 'W', opening: 'D', furniture: 'F', room: 'R', axis: 'A', dimension: 'M',
} as const;

// src/domain/spatial/ids.ts:87
export const createId = <K extends EntityKind>(kind: K): IdByKind[K]

// src/domain/spatial/ids.ts:108
export const isIdOfKind = <K extends EntityKind>(kind: K, id: string): id is IdByKind[K]

// src/domain/spatial/ids.ts:119
export const readKindFromId = (id: string): EntityKind | null

// src/domain/spatial/ids.ts:130
export const isValidId = (id: string): boolean
```

### `integrity.ts` — chạy được trên `SpatialGraph`/`NormalizedSpatial`?

```
grep -n "export const checkIntegrity\|export const hasCriticalIssue\|export const countBySeverity\|export type IntegrityRule\|export type IntegritySeverity\|export interface IntegrityIssue" src/domain/spatial/integrity.ts
```
```
17:export type IntegritySeverity = 'critical' | 'warning';
20:export type IntegrityRule =
29:export interface IntegrityIssue {
397:export const checkIntegrity = (normalized: NormalizedSpatial): IntegrityIssue[] => [
407:export const hasCriticalIssue = (issues: readonly IntegrityIssue[]): boolean =>
411:export const countBySeverity = (
```

Cả 3 hàm nhận **`NormalizedSpatial`** (không nhận `SpatialGraph` thô) — phải gọi
`normalizeSpatial(graph)` trước:

```ts
// src/domain/spatial/integrity.ts:397
export const checkIntegrity = (normalized: NormalizedSpatial): IntegrityIssue[]

// src/domain/spatial/integrity.ts:407-408
export const hasCriticalIssue = (issues: readonly IntegrityIssue[]): boolean

// src/domain/spatial/integrity.ts:411-416
export const countBySeverity = (
  issues: readonly IntegrityIssue[],
): Record<IntegritySeverity, number> => ({
  critical: issues.filter((issue) => issue.severity === CRITICAL).length,
  warning: issues.filter((issue) => issue.severity === WARNING).length,
});
```

**LƯU Ý ĐẶT TÊN TRÙNG:** có HAI hàm tên `countBySeverity` khác nhau, khác module, khác chữ ký:

- `src/domain/spatial/integrity.ts:411` — `(issues: IntegrityIssue[]) => Record<IntegritySeverity, number>`
  (chỉ 2 khoá: `critical` | `warning`).
- `src/domain/rules/healthScore.ts:91` — `(violations: Violation[]) => SeverityCounts`
  (3 khoá: `critical` | `warning` | `suggestion`).

Import đúng nguồn theo việc đang làm — nhầm module là lỗi biên dịch (khác kiểu tham số) nhưng
tên hàm giống hệt nhau nên rất dễ nhầm khi đọc lướt.

### CÂU HỎI TRỌNG TÂM — đếm tường/phòng/tổng diện tích của MỘT tầng

Đoạn mã ghép, chỉ dùng hàm có sẵn:

```ts
import { normalizeSpatial, idsOnLevel } from '@/domain/spatial/normalize';
import { isEntityOfKind } from '@/domain/spatial/normalize';

const normalized = normalizeSpatial(graph);
const ids = idsOnLevel(normalized, levelId);              // mọi id trên tầng này
const walls = ids.map((id) => normalized.byId[id]).filter((e) => e && isEntityOfKind('wall', e));
const rooms = ids.map((id) => normalized.byId[id]).filter((e) => e && isEntityOfKind('room', e));
const wallCount = walls.length;
const roomCount = rooms.length;
const areaM2 = rooms.reduce((sum, room) => sum + room.areaM2, 0);  // m², cộng tay — xem dưới
```

**Tổng diện tích PHẢI cộng tay từ `Room.areaM2`.** Không có hàm domain nào tự cộng diện tích
theo tầng cho sẵn. Trường: `Room.areaM2: SquareMetres` (`spatial/types.ts:195`, đơn vị **m²**,
kiểu `number` trần — KHÔNG branded, xem bẫy ở mục C.types.ts trên).

Có 2 hàm cộng sẵn liên quan, nhưng KHÔNG hàm nào khớp thẳng "cộng `areaM2` theo tầng":

1. `src/domain/rooms/area.ts:204` — `totalArea(outlines: readonly (readonly PointMm[])[]): SquareMetres`
   — cộng diện tích THẬT từ tập outline (không phải từ `Room.areaM2` đã lưu), dùng khi cần tính
   lại diện tích từ hình học chứ không phải đọc trường đã có.
2. Mẫu cộng trực tiếp `room.areaM2` bằng `reduce` đã có tiền lệ trong repo (không phải hàm dùng
   lại, mà là cách viết tại chỗ):
   ```
   grep -n "reduce.*areaM2" src/domain/rooms/detect.ts
   459:  return squareMetres(rooms.reduce((total, room) => total + room.areaM2, 0));
   ```
   Đây là cách làm giống hệt đoạn mã ghép ở trên — `reduce` cộng thẳng `room.areaM2`, bọc lại
   bằng `squareMetres()` (units) nếu cần kiểu branded ở nơi gọi.

**Tiền lệ dựng bảng "một dòng mỗi tầng" đã có trong repo**, đáng để FloorManager soi theo cùng
khuôn (không copy được vì nằm ngoài whitelist, chỉ đọc để hiểu mẫu):

```
grep -n "export function buildLevelSummaryPage\|const wallCounts\|const roomCounts\|function tallyByLevel" src/lib/export/exportPdf.ts
```
`src/lib/export/exportPdf.ts:275-330` — hàm `buildLevelSummaryPage(graph, violations, footer)`
dựng đúng bảng "1 dòng / tầng" (tên tầng, số tường, số phòng, số ô mở, số vi phạm, điểm sức
khoẻ) bằng `tallyByLevel()` (đếm walls/rooms/openings theo `levelId`, dòng 184-197) ghép với
`groupViolationsByLevel()`.

---

## D. `src/domain/rules/healthScore.ts` (thay P-03)

```
grep -n "export function groupViolationsByLevel\|export interface LevelViolationGroup\|export function explainHealthScore\|export interface HealthScore\|export function computeHealthScore\|export function countBySeverity\|export type SeverityCounts\|export function worstSeverityOf\|export function sortBySeverity\|export const SEVERITY_PENALTY" src/domain/rules/healthScore.ts
```
```
49:export const SEVERITY_PENALTY: Readonly<Record<RuleSeverity, number>> = {
56:export type SeverityCounts = Readonly<Record<RuleSeverity, number>>;
59:export interface HealthScore {
73:export interface LevelViolationGroup {
91:export function countBySeverity(violations: readonly Violation[]): SeverityCounts {
102:export function worstSeverityOf(violations: readonly Violation[]): RuleSeverity | null {
123:export function computeHealthScore(violations: readonly Violation[]): number {
135:export function explainHealthScore(violations: readonly Violation[]): HealthScore {
172:export function groupViolationsByLevel(
218:export function sortBySeverity(violations: readonly Violation[]): Violation[] {
```

```ts
// src/domain/rules/healthScore.ts:49-53
export const SEVERITY_PENALTY: Readonly<Record<RuleSeverity, number>> = {
  critical: 8, warning: 3, suggestion: 1,
};

// src/domain/rules/healthScore.ts:56
export type SeverityCounts = Readonly<Record<RuleSeverity, number>>;

// src/domain/rules/healthScore.ts:59-70
export interface HealthScore {
  readonly score: number;          // [0,100], nguyên
  readonly penalty: number;
  readonly clampedPenalty: number;
  readonly counts: SeverityCounts;
  readonly total: number;
  readonly worstSeverity: RuleSeverity | null;
}

// src/domain/rules/healthScore.ts:73-80
export interface LevelViolationGroup {
  readonly levelId: LevelId | null;   // null = phát hiện toàn nhà, không thuộc tầng nào
  readonly violations: readonly Violation[];
  readonly counts: SeverityCounts;
  readonly score: number;             // điểm sức khoẻ RIÊNG CỦA TẦNG NÀY, 0-100
}

// src/domain/rules/healthScore.ts:172-174
export function groupViolationsByLevel(
  violations: readonly Violation[],
): readonly LevelViolationGroup[]

// src/domain/rules/healthScore.ts:123-125, 135
export function computeHealthScore(violations: readonly Violation[]): number
export function explainHealthScore(violations: readonly Violation[]): HealthScore

// src/domain/rules/healthScore.ts:91, 102, 218
export function countBySeverity(violations: readonly Violation[]): SeverityCounts
export function worstSeverityOf(violations: readonly Violation[]): RuleSeverity | null
export function sortBySeverity(violations: readonly Violation[]): Violation[]
```

### CÂU HỎI TRỌNG TÂM — một dòng bảng hiện "tiến độ QC" của một tầng thì lấy con số nào?

**Cách đọc ĐÚNG MỘT: `groupViolationsByLevel(violations).find(g => g.levelId === level.id)?.score`**
— là **ĐIỂM SỨC KHOẺ 0–100** (`HealthScore`/nhóm theo tầng), KHÔNG PHẢI tỷ lệ đã duyệt/tổng.
Đây chính xác là cách `src/lib/export/exportPdf.ts:280-306` đã dùng để dựng cột điểm trong bảng
tổng kết theo tầng (`group?.score ?? HEALTH_SCORE_MAX` — tầng không có vi phạm được điểm tối đa
`HEALTH_SCORE_MAX = 100`, `healthScore.ts:43`).

**NOT FOUND: không có khái niệm "đã duyệt / tổng" (approved ratio) theo tầng ở
`src/domain/rules/healthScore.ts` hay bất kỳ đâu trong `src/domain`.** `healthScore.ts` không hề
đọc trường `reviewed` (grep `"reviewed"` trong file này ra 0 kết quả). Tỷ lệ đã duyệt/tổng đang
tồn tại RIÊNG RẼ, TỰ CHẾ theo từng screen QC (mỗi cái đếm một loại entity, không có tầng):

```
grep -n "reviewed.*length" src/screens/qc/WallLayerReview/useWallLayerReview.ts src/screens/qc/ObjectLayerReview/objectLayerReviewGateway.ts src/screens/qc/DimensionOcrReview/dimensionOcrReviewGateway.ts
```
```
src/screens/qc/WallLayerReview/useWallLayerReview.ts:1180:      reviewed: walls.filter((wall) => wall.reviewed).length,
src/screens/qc/ObjectLayerReview/objectLayerReviewGateway.ts:1553:  reviewed: objects.filter((object) => object.reviewed).length,
src/screens/qc/DimensionOcrReview/dimensionOcrReviewGateway.ts:728:  reviewed: dimensions.filter((dimension) => dimension.reviewed).length,
```

Mỗi nơi tự đếm `X.filter(x => x.reviewed).length` cho MỘT loại đối tượng (tường / vật thể / kích
thước), trong hook/gateway của chính màn đó — không phải hàm dùng chung, và không gộp theo tầng.
Nếu FloorManager cần "đã duyệt/tổng" theo tầng (gộp mọi loại entity), phần này CHƯA CÓ Ở TẦNG
DOMAIN — phải hỏi điều phối viên bằng `orca orchestration ask`, không tự chế công thức.

**Kết luận dùng cho FloorManager: dùng điểm sức khoẻ 0–100 từ `groupViolationsByLevel`, không
dùng tỷ lệ đã duyệt.**

---

## E. `src/domain/measure/**` và `src/domain/units/**`

```
grep -n "MILLIMETRES_PER_METRE\|export function millimetres\|export function squareMetres\|DEFAULT_ROUNDING_STEP" src/domain/units/types.ts
```
```
55:export const MILLIMETRES_PER_METRE = 1000;
64:export const SQUARE_MILLIMETRES_PER_SQUARE_METRE = MILLIMETRES_PER_METRE * MILLIMETRES_PER_METRE;
84:export function millimetres(value: number): Millimetres {
96:export function squareMetres(value: number): SquareMetres {
153:export const DEFAULT_ROUNDING_STEP: Millimetres = millimetres(1);
```

```ts
// src/domain/units/types.ts:55
export const MILLIMETRES_PER_METRE = 1000;
// src/domain/units/types.ts:58
export const MILLIMETRES_PER_DECIMETRE = 100;
// src/domain/units/types.ts:61
export const MILLIMETRES_PER_CENTIMETRE = 10;
// src/domain/units/types.ts:64
export const SQUARE_MILLIMETRES_PER_SQUARE_METRE = MILLIMETRES_PER_METRE * MILLIMETRES_PER_METRE; // = 1_000_000

// src/domain/units/types.ts:84 — CỔNG DUY NHẤT nhận number trần cho mm
export function millimetres(value: number): Millimetres
// src/domain/units/types.ts:90
export function metres(value: number): Metres
// src/domain/units/types.ts:96 — CỔNG DUY NHẤT nhận number trần cho m²
export function squareMetres(value: number): SquareMetres

// src/domain/units/types.ts:153 — LÀM TRÒN MẶC ĐỊNH: 1 mm
export const DEFAULT_ROUNDING_STEP: Millimetres = millimetres(1);
// src/domain/units/types.ts:171-181
export function roundMeasurement(value: Millimetres, step: Millimetres = DEFAULT_ROUNDING_STEP): Millimetres
```

**CÓ** hàm làm tròn mặc định: `roundMeasurement(value, step = DEFAULT_ROUNDING_STEP)` — bước
mặc định `DEFAULT_ROUNDING_STEP = 1` mm, làm tròn nửa-ra-xa-0 (`2.5 → 3`, `-2.5 → -3`).

Đây là `Millimetres`/`SquareMetres` **BRANDED** (`Quantity<'mm'>`, `Quantity<'m2'>`,
`units/types.ts:34,40`) — khác với `Millimetres`/`SquareMetres` KHÔNG branded của
`spatial/types.ts` (xem bẫy ở mục C).

`src/domain/measure/measure.ts` là "thước dây" đo tay (khoảng cách, chuỗi điểm, góc, diện tích
đa giác, chiều cao) — không liên quan trực tiếp tới FloorManager (không tính cao độ tầng, không
đếm đối tượng), chỉ ghi nhận có tồn tại: `MeasurePoint`, `measureDistance`, `measureChain`,
`measureAngle`, `measurePolygonArea`, `measureHeight` — đều pure, trả `null` khi không đo được
thay vì `0`.

---

## Tổng kết dùng ngay cho FloorManager

1. **Cao độ tích luỹ theo danh sách tầng: NOT FOUND ở tầng domain/public.** Mảnh gần nhất là
   hàm `restack` private trong `src/lib/commands/business/roomFloorCommands.ts:668-684` (không
   export). → HỎI điều phối viên trước khi viết công thức trong screen.
2. **Đếm tường/phòng/tổng diện tích một tầng:** `normalizeSpatial(graph)` +
   `idsOnLevel(normalized, levelId)` + lọc bằng `isEntityOfKind('wall'|'room', entity)` + đếm
   `.length`; diện tích cộng tay `rooms.reduce((s, r) => s + r.areaM2, 0)` (m², tiền lệ tại
   `src/domain/rooms/detect.ts:459`). Không có hàm domain nào cộng sẵn diện tích theo tầng.
3. **"Tiến độ QC" một dòng tầng = điểm sức khoẻ 0-100** từ
   `groupViolationsByLevel(violations)`, đọc trường `.score` của nhóm khớp `levelId` (mặc định
   `HEALTH_SCORE_MAX = 100` khi tầng sạch). KHÔNG có tỷ lệ đã duyệt/tổng theo tầng ở tầng domain
   — NOT FOUND.
4. Đơn vị: `Level.elevationMm`/`heightMm` là **mm** (số nguyên, không branded — `spatial/types.ts`);
   màn hiện mét thì tự quy đổi bằng `millimetresToMetres()`/`MILLIMETRES_PER_METRE` (branded,
   `units/types.ts`) — hai module định nghĩa `Millimetres` khác nhau, đừng lẫn.
5. `alignFloors()` / `copyFloor()` không sửa `floorElevationMm`/`elevationMm` của tầng — chúng
   chỉ tính `transform` mặt bằng (xoay/tịnh tiến) và copy nội dung, không đụng tới cao độ.

---

## Kết quả `pnpm typecheck` và `pnpm lint`

Không sửa file nguồn nào (chỉ tạo file ghi chú này). Đã chạy cả hai lệnh trên worktree này:

- `pnpm typecheck` (`tsc --noEmit`): **ĐẠT** — thoát mã 0, không in lỗi nào.
- `pnpm lint` (`eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`):
  **ĐẠT** — thoát mã 0, không in lỗi/cảnh báo nào.

(`pnpm test`, `pnpm coverage`, `pnpm build`, `pnpm cycles`, `pnpm length`: **chưa chạy** — ngoài
phạm vi tác vụ này, không ghi "đạt" cho các bước này theo E.10/R-58.)
