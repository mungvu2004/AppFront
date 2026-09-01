# T1 — Hợp đồng tầng domain + tầng lệnh cho lỗ mở (openings)

Khảo sát trên nhánh `master`, đọc mã nguồn tại thời điểm viết hợp đồng này. Mọi chữ ký dưới
đây COPY NGUYÊN VĂN từ mã; không diễn giải lại kiểu.

---

## a) M-08 — gắn lỗ mở lên tường

Nguồn: `src/domain/openings/attach.ts`

```ts
export const DEFAULT_ATTACH_RADIUS_MM: Millimetres = millimetres(150);
```
— `src/domain/openings/attach.ts:67`. 150 mm, đo từ **mặt tường** (không phải tim tường).

```ts
export interface OpeningAttachment {
  readonly opening: Opening;
  readonly wallId: WallId | null;
  readonly distanceToCentrelineMm: Millimetres | null;
  readonly distanceToFaceMm: Millimetres | null;
  readonly message: string;
}
```
— `src/domain/openings/attach.ts:70-86`. Kết quả của một lần gắn: đối tượng đã cập nhật
(attached hoặc orphan), tường đích (`null` nếu mồ côi), hai khoảng cách đo được, và câu
tiếng Việt cho nhật ký duyệt.

```ts
export function placeOnWall(wall: Wall, relativePosition: RelativePosition): PointMm
```
— `src/domain/openings/attach.ts:312`. Đổi một fraction (0–1) trên tim tường thành toạ độ
tuyệt đối trên mặt bằng. **`@throws RangeError`** khi `relativePosition` không phải fraction
hợp lệ trong `[0,1]` (kiểm bằng `isValidRelativePosition`).

```ts
export function attachToWall(
  opening: TracedOpening,
  walls: readonly Wall[],
  radiusMm: Millimetres = DEFAULT_ATTACH_RADIUS_MM,
): OpeningAttachment
```
— `src/domain/openings/attach.ts:349`. Gắn một lỗ mở vừa dò (toạ độ tuyệt đối, chưa biết
tường nào) vào tường gần nhất đo từ **thân tường** (kể cả bề dày), chiếu vuông góc lên tim
tường và CHỈ giữ fraction. Không có tường trong bán kính → trả về `OrphanOpening`, không bao
giờ xoá. **`@throws RangeError`** khi `radiusMm` không phải số hữu hạn ≥ 0.
**Hàm thuần** — không tự tính vị trí gần cửa kiểu suy diễn, không tự kiểm chồng lấn (đó là
việc của `validateOpening`/`findOrphans` ở mục b).

```ts
export function openingCentre(wall: Wall, opening: AttachedOpening): PointMm
```
— `src/domain/openings/attach.ts:386`. Toạ độ hiện tại của một lỗ mở ĐÃ gắn, trên đúng
tường chủ của nó. **`@throws Error`** khi `wall.id !== opening.wallId` (tường truyền vào
không phải tường chủ) — đây là ném lỗi thật (`throw new Error`), không trả `null`.

---

## b) Kiểm hợp lệ

Nguồn: `src/domain/openings/validate.ts`

```ts
export interface OpeningRules {
  readonly doorHeightMinMm: Millimetres;
  readonly doorHeightMaxMm: Millimetres;
  readonly doorSillHeightMm: Millimetres;
  readonly windowSillMinMm: Millimetres;
  readonly windowSillMaxMm: Millimetres;
  readonly maxWidthShareOfWall: number;
  readonly movedToleranceMm: Millimetres;
  readonly orphanSuggestionRadiusMm: Millimetres;
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
— `src/domain/openings/validate.ts:54-90`. `orphanSuggestionRadiusMm` (1500 mm) = 10 lần
`DEFAULT_ATTACH_RADIUS_MM` của `attachToWall` — tự động phải chắc chắn, gợi ý thì rộng rãi
hơn vì có người xem lại.

```ts
export type OpeningSeverity = 'critical' | 'warning';

export type OpeningRule =
  | 'sizeNotPositive'
  | 'beyondWallEnd'
  | 'aboveWallTop'
  | 'overlappingOpenings'
  | 'doorHeight'
  | 'doorSill'
  | 'windowSill'
  | 'widthShareOfWall';

export interface OpeningViolation {
  readonly rule: OpeningRule;
  readonly severity: OpeningSeverity;
  readonly openingId: OpeningId;
  readonly wallId: WallId;
  readonly message: string;
  readonly otherOpeningId?: OpeningId;
}
```
— `src/domain/openings/validate.ts:97-128`. Bốn rule đầu là `critical` (bản vẽ tự mâu
thuẫn), bốn rule sau là `warning` (lệch bảng tiêu chuẩn nhưng người dùng có thể chấp nhận).
`otherOpeningId` chỉ có ở `overlappingOpenings`.

```ts
export interface OpeningSpan {
  readonly centreMm: Millimetres;
  readonly lowMm: Millimetres;
  readonly highMm: Millimetres;
}

export function openingSpan(wall: Wall, opening: AttachedOpening): OpeningSpan
```
— `src/domain/openings/validate.ts:131-135,226`. Đoạn tường (tính từ đầu `start`) mà lỗ mở
chiếm, suy từ fraction đã lưu — luôn khớp khi tường bị kéo/xoay.

```ts
export interface OrphanReport {
  readonly opening: OrphanOpening;
  readonly suggestedWallId: WallId | null;
  readonly suggestedPosition: RelativePosition | null;
  readonly distanceToFaceMm: Millimetres | null;
  readonly message: string;
}
```
— `src/domain/openings/validate.ts:138-152`.

```ts
export function validateOpening(
  opening: AttachedOpening,
  wall: Wall,
  siblings: readonly Opening[] = [],
  rules: OpeningRules = OPENING_RULES,
): readonly OpeningViolation[]
```
— `src/domain/openings/validate.ts:250`. Kiểm MỘT lỗ mở, theo thứ tự cố định: hình học
trước (kích thước dương, không vượt tường, không cao hơn tường, không chồng lấn với
`siblings` cùng tường), tiêu chuẩn sau (chiều cao cửa, ngưỡng cửa, ngưỡng cửa sổ, tỉ lệ chiều
rộng/tường). `siblings` có thể là TOÀN BỘ danh sách lỗ mở của bản vẽ — hàm tự lọc ra cái nào
cùng tường. **`@throws Error`** khi `wall.id !== opening.wallId`.

```ts
export function validateOpenings(
  openings: readonly Opening[],
  walls: readonly Wall[],
  rules: OpeningRules = OPENING_RULES,
): readonly OpeningViolation[]
```
— `src/domain/openings/validate.ts:398`. Kiểm TOÀN BỘ lỗ mở đã gắn trên bản vẽ; một cặp
chồng lấn chỉ báo MỘT LẦN (từ id nhỏ hơn). Bỏ qua orphan (việc của `findOrphans`) và lỗ mở
trỏ tới tường không tồn tại (việc của `spatial/integrity.ts`). **Trả mảng rỗng**, không phải
`null`, khi không có vi phạm.

```ts
export function findOrphans(
  openings: readonly Opening[],
  walls: readonly Wall[],
  rules: OpeningRules = OPENING_RULES,
): readonly OrphanReport[]
```
— `src/domain/openings/validate.ts:451`. Liệt kê lỗ mở mồ côi, mỗi cái kèm tường đáng gợi ý
(bán kính rộng hơn `attachToWall`, xem `OPENING_RULES.orphanSuggestionRadiusMm`). KHÔNG gắn
gì cả — chấp nhận gợi ý nghĩa là gọi lại `attachToWall` bằng tay. **Trả mảng rỗng** khi không
có orphan nào.

```ts
export type OrphanReason =
  | 'noUsableWall'
  | 'noWallInRange'
  | 'centreUnknown';

export const ORPHAN_REASON_LABELS: Readonly<Record<OrphanReason, string>> = {
  noUsableWall: 'Chưa có tường nào để gắn',
  noWallInRange: 'Không có tường nào trong bán kính tìm kiếm',
  centreUnknown: 'Không có toạ độ hợp lệ để chiếu',
};
```
— `src/domain/openings/types.ts:157-170`.

---

## c) M-09 — trôi lỗ mở (reflow)

Nguồn: `src/domain/openings/reflow.ts`

```ts
export type ReflowStatus = 'unchanged' | 'moved' | 'needsDecision';

export const REFLOW_STATUS_LABELS: Readonly<Record<ReflowStatus, string>> = {
  unchanged: 'Giữ nguyên',
  moved: 'Đã dịch chuyển',
  needsDecision: 'Cần người dùng quyết định',
};

export function describeReflowStatus(status: ReflowStatus): string
```
— `src/domain/openings/reflow.ts:62-80`.

```ts
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
— `src/domain/openings/reflow.ts:98-122`.

```ts
export function reflowOpenings(
  previousWall: Wall,
  nextWall: Wall,
  openings: readonly Opening[],
  rules: OpeningRules = OPENING_RULES,
): ReflowResult
```
— `src/domain/openings/reflow.ts:304`. Fraction lưu sẵn được GIỮ NGUYÊN khi tường bị kéo,
co, xoay; lỗ mở lồi ra ngoài đầu tường bị kéo vào trong (`slidInsideWall`); lỗ mở rộng hơn cả
tường thì GIỮ NGUYÊN vị trí và rơi vào `needsDecision`. **`@throws Error`** khi
`previousWall.id !== nextWall.id`. **`@throws RangeError`** khi một fraction lưu sẵn không
hợp lệ.

```ts
export function reflowOpeningsAcrossSplit(
  originalWall: Wall,
  pieces: readonly [Wall, Wall],
  openings: readonly Opening[],
  rules: OpeningRules = OPENING_RULES,
): ReflowResult
```
— `src/domain/openings/reflow.ts:355`. Chia lỗ mở của một tường bị cắt làm đôi cho đúng
mảnh chứa tâm của nó; lỗ mở vắt qua điểm cắt bị gắn cờ `needsDecision` và giữ nguyên vị trí
(không tự quyết cắt đôi lỗ mở). **`@throws Error`** khi hai mảnh trùng id, không nối nhau ở
điểm cắt, hoặc không phủ đúng tường gốc. **`@throws RangeError`** khi tường gốc không có
chiều dài, hoặc điểm cắt rơi đúng vào một đầu tường.

`ReflowReason` (nội bộ nhưng cần biết để đọc message):
`'positionKept' | 'wallReshaped' | 'slidInsideWall' | 'straddlesCut' | 'openingWiderThanWall' | 'wallHasNoLength'`
— `src/domain/openings/reflow.ts:83-95`.

---

## d) Kiểu dữ liệu

Nguồn: `src/domain/openings/types.ts` (trừ `SwingDirection` — xem cuối mục).

```ts
export type OpeningKind = 'door' | 'window' | 'void';

export const OPENING_KINDS: readonly OpeningKind[] = ['door', 'window', 'void'];

export const OPENING_KIND_LABELS: Readonly<Record<OpeningKind, string>> = {
  door: 'Cửa đi',
  window: 'Cửa sổ',
  void: 'Lỗ trống',
};

export function describeOpeningKind(kind: OpeningKind): string
```
— `src/domain/openings/types.ts:50-70`.

> **CẢNH BÁO NGAY TẠI ĐÂY:** `OpeningKind` của **domain** (`'door' | 'window' | 'void'`,
> file trên) và `OpeningKind` của **spatial graph** (`'door' | 'window'`, KHÔNG có `'void'`,
> `src/domain/spatial/types.ts:135`) là **hai kiểu khác nhau cùng tên**, xuất từ hai module
> khác nhau. Đồ thị đang lưu (`Opening.kind` ở `spatial/types.ts:144`) dùng bản 2 giá trị.
> Một tấm ảnh dò ra `'void'` (không có leaf/kính) KHÔNG CÓ chỗ đứng trong `GraphOpening.kind`
> hiện tại — xem mục "CẢNH BÁO CHO T5" cuối file.

```ts
export type RelativePosition = number;

export const AT_WALL_START: RelativePosition = 0;
export const AT_WALL_END: RelativePosition = 1;
export const RELATIVE_POSITION_EPSILON = 1e-9;

export function isValidRelativePosition(value: number): boolean
export function clampRelativePosition(value: RelativePosition): RelativePosition
```
— `src/domain/openings/types.ts:83-119`. **`RelativePosition` là alias của `number` trần**,
KHÔNG phải brand type (khác với `Millimetres`, xem cảnh báo cuối file).

```ts
export interface OpeningCore {
  readonly id: OpeningId;
  readonly kind: OpeningKind;
  readonly widthMm: Millimetres;
  readonly heightMm: Millimetres;
  readonly sillHeightMm: Millimetres;
  readonly swing: SwingDirection;
}

export interface AttachedOpening extends OpeningCore {
  readonly wallId: WallId;
  readonly relativePosition: RelativePosition;
}

export interface OrphanOpening extends OpeningCore {
  readonly wallId: null;
  readonly centre: PointMm;
  readonly orphanReason: OrphanReason;
}

export type Opening = AttachedOpening | OrphanOpening;

export interface TracedOpening extends OpeningCore {
  readonly centre: PointMm;
}

export function isAttached(opening: Opening): opening is AttachedOpening
export function isOrphan(opening: Opening): opening is OrphanOpening
```
— `src/domain/openings/types.ts:131-212`. Trạng thái gắn/mồ côi nằm trong KIỂU (type guard),
không phải cờ boolean: `AttachedOpening.wallId: WallId`, `OrphanOpening.wallId: null`.

```ts
export type SwingDirection = 'left' | 'right' | 'double' | 'sliding' | 'fixed';
```
— `src/domain/spatial/types.ts:138`. Đây là kiểu DUY NHẤT, `domain/openings/types.ts:37`
chỉ `export type { SwingDirection }` lại từ đây, không định nghĩa riêng.

---

## e) S-07 — lệnh cho lỗ mở và đồ đạc

Nguồn: `src/lib/commands/business/openingCommands.ts`

```ts
export const OPENING_COMMAND_TYPES = {
  addOpening: 'opening.add',
  moveOpening: 'opening.move',
  resizeOpening: 'opening.resize',
  removeOpening: 'opening.delete',
  addFurniture: 'furniture.add',
  moveFurniture: 'furniture.move',
  rotateFurniture: 'furniture.rotate',
  removeFurniture: 'furniture.delete',
} as const;
```
— `src/lib/commands/business/openingCommands.ts:83-92`. **Đúng 8 lệnh, không hơn.**

### 1. Thêm lỗ mở
```ts
export interface AddOpeningInput {
  readonly id: OpeningId;
  readonly levelId: LevelId;
  readonly kind: OpeningKind;          // OpeningKind của SPATIAL graph: 'door' | 'window'
  readonly centre: Point;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
  readonly swing: SwingDirection;
}
export function validateAddOpening(input: AddOpeningInput, context: CommandContext): string[]
export function createAddOpeningCommand(input: AddOpeningInput, context: CommandContext): CommandResult
```
— `:201-211,225,289`. Tự tìm tường chủ bằng `attachToWall` (không nhận `wallId` từ người
gọi) — đây là hàm DUY NHẤT trong toàn bộ mã T1 tự làm việc gắn cửa, và nó gọi thẳng
`attachToWall` ở mục (a), không tự tính lại. Refuse khi lỗi hình học HOẶC khi
`criticalReasonsFor` (bọc `validateOpening`) thấy vi phạm `critical`.

### 2. Di chuyển lỗ mở
```ts
export interface MoveOpeningInput {
  readonly openingId: OpeningId;
  readonly offsetMm: number;   // khoảng cách MỚI từ đầu tim tường tới MÉP TRÁI lỗ mở
}
export function validateMoveOpening(input: MoveOpeningInput, context: CommandContext): string[]
export function createMoveOpeningCommand(input: MoveOpeningInput, context: CommandContext): CommandResult
```
— `:351-355,358,382`.

### 3. Đổi kích thước lỗ mở
```ts
export interface ResizeOpeningInput {
  readonly openingId: OpeningId;
  readonly widthMm?: number;
  readonly heightMm?: number;
  readonly sillHeightMm?: number;
}
export function validateResizeOpening(input: ResizeOpeningInput, context: CommandContext): string[]
export function createResizeOpeningCommand(input: ResizeOpeningInput, context: CommandContext): CommandResult
```
— `:417-422,433,497`. Đổi rộng thì mép trái tự bù lại một nửa mức tăng để TÂM giữ nguyên
(`:517`).

### 4. Xoá lỗ mở
```ts
export interface DeleteOpeningInput {
  readonly openingId: OpeningId;
}
export function validateDeleteOpening(input: DeleteOpeningInput, context: CommandContext): string[]
export function createDeleteOpeningCommand(input: DeleteOpeningInput, context: CommandContext): CommandResult
```
— `:542-544,547,565`. Xoá kéo theo gỡ khỏi `wall.openingIds` trong CÙNG một lệnh (một undo
step, không phải hai).

### 5–8. Đồ đạc (kèm vì đặc tả yêu cầu `create*FurnitureCommand`)
```ts
export interface AddFurnitureInput {
  readonly id: FurnitureId;
  readonly levelId: LevelId;
  readonly kind: FurnitureKind;
  readonly centre: Point;
  readonly boundingBox: BoundingBox;
  readonly rotationDeg: number;
  readonly roomId?: RoomId;
}
export function validateAddFurniture(input: AddFurnitureInput, context: CommandContext): string[]
export function createAddFurnitureCommand(input: AddFurnitureInput, context: CommandContext): CommandResult

export interface MoveFurnitureInput { readonly furnitureId: FurnitureId; readonly to: Point; }
export function validateMoveFurniture(input: MoveFurnitureInput, context: CommandContext): string[]
export function createMoveFurnitureCommand(input: MoveFurnitureInput, context: CommandContext): CommandResult

export interface RotateFurnitureInput { readonly furnitureId: FurnitureId; readonly rotationDeg: number; }
export function validateRotateFurniture(input: RotateFurnitureInput, context: CommandContext): string[]
export function createRotateFurnitureCommand(input: RotateFurnitureInput, context: CommandContext): CommandResult

export interface DeleteFurnitureInput { readonly furnitureId: FurnitureId; }
export function validateDeleteFurniture(input: DeleteFurnitureInput, context: CommandContext): string[]
export function createDeleteFurnitureCommand(input: DeleteFurnitureInput, context: CommandContext): CommandResult
```
— `:608-616,650,703,744-747,765,802,837-840,843,874,909-911,914,926`.

Tất cả tám `create*Command` đều trả `CommandResult = Result<Command, CommandRefusal>`
(`src/lib/commands/business/shared.ts:80`) — KHÔNG NÉM LỖI khi bị từ chối, refuse trả về
`{ ok: false, error: { type, reasons } }` qua hàm `refuse()` (`shared.ts:104`).
Thực thể mới luôn có `AUTHORED_BY_HAND = { confidence: 1, source: 'human', reviewed: false }`
(`shared.ts:124-128`) — KHÔNG BAO GIỜ `reviewed: true` từ tầng lệnh S-07 này.

---

## f) D-06 — gộp lệnh (coalesce & merge)

Hai cơ chế KHÁC NHAU, đừng nhầm:

**1. `coalesce` (`src/lib/mutations/coalesce.ts`)** — gộp lệnh phía HÀNG ĐỢI ĐỒNG BỘ
(payload gửi server), không đụng tới undo stack.
```ts
export const COALESCE_WINDOW_MS = 400;

export interface Command<TValue> {
  kind: string; previousValue: TValue; targetId: string; timestamp: number; value: TValue;
}
export interface CoalescedCommand<TValue> {
  kind: string; mergedCount: number; previousValue: TValue; targetId: string; timestamp: number; value: TValue;
}

export function coalesce<TValue>(
  commands: readonly Command<TValue>[],
  windowMs: number = COALESCE_WINDOW_MS,
): CoalescedCommand<TValue>[]
```
— `:1-18,36`. Đây là `Command<TValue>` RIÊNG của `lib/mutations`, KHÔNG PHẢI `Command` của
`lib/commands/types.ts` (mục dưới) — hai kiểu trùng tên, khác module, khác việc.

**2. `mergeCommands` (`src/lib/commands/mergeCommands.ts`)** — gộp lệnh phía UNDO STACK.
```ts
export const MERGE_WINDOW_MS = COALESCE_WINDOW_MS; // = 400, cùng một hằng gốc

export function canMergeCommands(
  earlier: Command,
  later: Command,
  windowMs: number = MERGE_WINDOW_MS,
): boolean

export function mergeCommands(earlier: Command, later: Command): Command

export function mergeCommandRun(
  commands: readonly Command[],
  windowMs: number = MERGE_WINDOW_MS,
): Command[]
```
— `:34,48,87,114`. `Command` ở đây LÀ `lib/commands/types.ts` `Command` (mục lệnh S-07/
`createCommand`).

### Cách một chuỗi 20 lần kéo biến thành ĐÚNG MỘT bước lịch sử

`createHistoryStack().push()` (`src/lib/commands/history.ts:298-325`) gọi `runInProgress()`
(`:281-296`), và bên trong đó gọi `canMergeCommands(open, next, mergeWindowMs)` cho MỖI lệnh
mới đẩy vào. Với 20 lệnh `opening.move` liên tiếp trên CÙNG một `openingId`, CÙNG
`actorId`, mỗi lệnh cách lệnh trước dưới 400 ms:

```ts
// Ví dụ gọi thật, phía trên là create..., không phải push trực tiếp:
const stack = createHistoryStack(); // MERGE_WINDOW_MS mặc định = 400

// Kéo lần 1 (nhả chuột giữa chừng animation frame 1)
const cmd1 = createMoveOpeningCommand({ openingId: 'D-000001AAAA', offsetMm: 100 }, ctx);
if (cmd1.ok) stack.push({ entry: toUndoEntry(cmd1.data), selectionBefore, selectionAfter });

// Kéo lần 2..20, mỗi lần cách lần trước < 400 ms, CÙNG openingId
const cmd2 = createMoveOpeningCommand({ openingId: 'D-000001AAAA', offsetMm: 104 }, ctx);
if (cmd2.ok) stack.push({ entry: toUndoEntry(cmd2.data), selectionBefore, selectionAfter });
// ... lặp tới lệnh thứ 20 (offsetMm: 100 -> 480 chẳng hạn)

stack.undoSteps().length; // === 1, KHÔNG PHẢI 20
```

Vì sao đúng MỘT bước: `foldChange` (`mergeCommands.ts:73-74`) giữ `before` của lệnh SỚM
NHẤT và `after`/`timestamp` của lệnh MUỘN NHẤT cho mỗi `EntityChange` cùng id — nên `undo`
đưa lỗ mở về đúng chỗ TRƯỚC khi kéo bắt đầu (`offsetMm: 100` ban đầu, không phải một bước ở
giữa), và `redo` đưa nó tới đúng chỗ CUỐI (`offsetMm: 480`). `history.ts:foldIntoStep`
(`:241-252`) còn giữ `selectionBefore` của bước gốc và `selectionAfter` của lần push mới
nhất, nên Ctrl+Z một lần khôi phục ĐÚNG vùng chọn của lúc bắt đầu kéo. Gộp CHỈ khớp khi cùng
`type`, cùng `actorId`, cùng tập `scope.entityIds` (`canMergeCommands`, `mergeCommands.ts:
48-67`) — người khác kéo cùng lỗ mở, hoặc gộp cách nhau ≥ 400 ms, thì KHÔNG gộp, mở bước mới.

---

## g) D-04 — cập nhật lạc quan (optimistic)

Nguồn: `src/lib/mutations/createOptimisticMutation.ts`, `undoTicket.ts`, `flushPolicy.ts`

```ts
export interface OptimisticMutationConfig<TVariables, TResult> {
  affectedKeys: (variables: TVariables) => readonly QueryKey[];
  afterSuccess: (result: TResult, variables: TVariables) => void;
  applyOptimistic: (variables: TVariables) => void;
  callServer: (variables: TVariables) => Promise<TResult>;
  entityId: (variables: TVariables) => string;
  rollback: (variables: TVariables) => void;
}

export function createOptimisticMutation<TVariables, TResult>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TVariables, TResult>,
): UseMutationOptions<TResult, AppError, TVariables>
```
— `createOptimisticMutation.ts:8-21,67`. Áp thay đổi ngay (`applyOptimistic`), gọi server
(`callServer`), lỗi thì phục hồi snapshot cache + gọi `rollback`. Mutation cùng `entityId`
được xếp hàng qua `runExclusive` (`entityQueue.ts:10`) — không chạy chồng lên nhau.

```ts
export const UNDO_WINDOW_MS = 8000; // invariant A8: 8 giây

export interface CreateUndoTicketOptions {
  description: string; now?: () => number; ttlMs?: number; undo: () => void;
}
export interface UndoTicket {
  description: string; expiresAt: number;
  getStatus: () => UndoTicketStatus; id: string;
  undo: () => Result<void, UndoTicketError>;
}
export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket
```
— `undoTicket.ts:18,24-37,45`. Gọi `undo()` sau khi hết hạn KHÔNG chạy hành động, trả
`{ ok: false, error: 'expired' }`.

```ts
export interface CreateFlushPolicyOptions<TValue> {
  idleMs?: number; maxQueueSize?: number;
  onFlush: (commands: readonly CoalescedCommand<TValue>[]) => void;
  windowMs?: number;
}
export interface FlushPolicy<TValue> {
  changeFloor: () => void; enqueue: (command: Command<TValue>) => void; flush: () => void;
}
export function createFlushPolicy<TValue>(options: CreateFlushPolicyOptions<TValue>): FlushPolicy<TValue>
```
— `flushPolicy.ts:5-16,25`. Đệm lệnh, xả (gọi `coalesce` rồi `onFlush`) khi: im lặng
`idleMs` (mặc định 400 ms), đầy `maxQueueSize` (mặc định 20), lệnh mới không nối được vào
lô đang đệm, hoặc gọi `changeFloor()` tay.

---

## h) S-10/S-11 — vùng chọn

Nguồn: `src/lib/selection/selectionOps.ts`, `revealPolicy.ts`, `marquee.ts`

```ts
export type SelectableKind = Exclude<EntityKind, 'level'>;

export interface LayerState { readonly visible: boolean; readonly locked: boolean; }
export const DEFAULT_LAYER_STATE: LayerState = Object.freeze({ locked: false, visible: true });
export type LayerStates = Partial<Readonly<Record<SelectableKind, LayerState>>>;

export interface SelectionContext {
  readonly spatial: NormalizedSpatial;
  readonly activeLevelId: LevelId;
  readonly layers: LayerStates;
}
export type Selection = readonly EntityId[];
export type SelectionCombine = 'replace' | 'add' | 'subtract';

export const readLayerState = (layers: LayerStates, kind: SelectableKind): LayerState
export const isSelectable = (id: EntityId, context: SelectionContext): boolean
export const selectableIds = (context: SelectionContext): EntityId[]

export const selectSingle = (
  selection: Selection, id: EntityId, context: SelectionContext,
): Selection

export const toggleSelection = (
  selection: Selection, id: EntityId, context: SelectionContext,
): Selection

export const combineSelection = (
  selection: Selection, ids: readonly EntityId[], mode: SelectionCombine, context: SelectionContext,
): Selection
```
— `selectionOps.ts:42,45-69,78,95,118,155,167,224`. `selectSingle` clear hết nếu id không
`isSelectable`; `toggleSelection` cho phép BỎ chọn một id dù layer của nó vừa bị khoá (bỏ
chọn không kiểm eligibility, chỉ THÊM mới kiểm). Mọi thao tác trả về CHÍNH mảng cũ nếu không
đổi gì (`keepIfUnchanged`) — không tạo reference mới vô ích.

```ts
export type SyncTarget = 'canvas2d' | 'scene3d' | 'list';
export const SUMMARY_THRESHOLD = 500;
export type KindCounts = Readonly<Record<SelectableKind, number>>;
export interface RevealRequest { readonly target: SyncTarget; readonly id: EntityId; }

export const countByKind = (selection: Selection): KindCounts
export const describeSelection = (selection: Selection): SelectionDetail
export const revealAnchor = (selection: Selection): EntityId | null
export const planReveals = (
  selection: Selection, detail: SelectionDetail, visible: VisibleByTarget,
): RevealRequest[]
```
— `revealPolicy.ts:31,46,49,64,97,112,128,144`. Chọn > 500 đối tượng → các consumer chỉ
nhận `countsByKind`, KHÔNG nhận danh sách đầy đủ (ngân sách dựng UI, không phải luật nghiệp
vụ). `revealAnchor` = id CUỐI trong mảng selection (đối tượng vừa chọn thêm).

```ts
export type MarqueeMode = 'window' | 'crossing';
export interface Marquee { readonly start: Point; readonly end: Point; }

export const marqueeMode = (marquee: Marquee): MarqueeMode
export const marqueeBox = (marquee: Marquee): BoundingBox
export const marqueeHits = (marquee: Marquee, context: SelectionContext): EntityId[]
export const applyMarquee = (
  selection: Selection, marquee: Marquee, combine: SelectionCombine, context: SelectionContext,
): Selection
```
— `marquee.ts:56,59,97,101,407,448`. Kéo TRÁI→PHẢI = "window" (chỉ bắt đối tượng NẰM HẲN
trong khung); kéo PHẢI→TRÁI = "crossing" (bắt mọi đối tượng khung CHẠM tới, kể cả nuốt trọn
khung). Test theo **hình chiếu thật** (`Footprint`) của từng loại — tường là hình chữ nhật
theo bề dày, lỗ mở là đoạn tường nó chiếm, đồ đạc là khung bao đã xoay, phòng là outline —
KHÔNG test theo bounding box thô (đúng luật "vẽ bằng ký hiệu kiến trúc, không phải khung
bao" ở mục cấm).

---

## i) R-07 — bay khung nhìn (fly-to-bounds)

Nguồn: `src/hooks/useCanvasViewport.ts`

```ts
export interface ViewportState { x: number; y: number; zoom: number; }

export interface ContentBounds { minX: number; minY: number; maxX: number; maxY: number; }

export interface FlyToBoundsOptions {
  readonly padding?: number;          // mặc định 40 px
  readonly reducedMotion?: boolean;   // để trống ở mã sản phẩm — hook tự đọc OS
  readonly scheduler?: FrameScheduler;
}
```
— `:11-38`.

```ts
export function useCanvasViewport(initialState?: Partial<ViewportState>)
```
— `:81`. Trả về (KHÔNG có interface export riêng cho return type — đọc trực tiếp từ
`return` statement, `:228-234`):
```ts
{
  viewport: ViewportState;
  pan: (dx: number, dy: number) => void;
  zoomTo: (zoomLevel: number, centerX?: number, centerY?: number) => void;
  fitToContent: (
    contentBounds: { minX: number; minY: number; maxX: number; maxY: number },
    canvasWidth: number,
    canvasHeight: number,
    padding?: number,
  ) => void;
  flyToBounds: (
    contentBounds: ContentBounds,
    canvasWidth: number,
    canvasHeight: number,
    options?: FlyToBoundsOptions,
  ) => void;
}
```
`flyToBounds` (định nghĩa đầy đủ tại `:159-226`) bay tới khung hình qua slot chuyển động
`slow` (340 ms), triệt tiêu dần; gọi lại giữa chừng thì HUỶ lượt bay đang chạy và bay tiếp
từ vị trí THẬT trên màn (`viewportRef`), không phải từ closure cũ. Dưới `reducedMotion`,
viewport nhảy thẳng tới đích ở frame đầu, không chạy animation. `fitToContent` (`:129-146`)
làm cùng việc nhưng NHẢY THẲNG, không animation — là hàm mà `flyToBounds` "phái sinh" theo
lời docstring nhưng thực ra hai hàm hiện cài đặt TÁCH RỜI nhau trong file (`targetViewportFor`
dùng chung công thức, nhưng `fitToContent` không gọi `targetViewportFor`) — xem cảnh báo
cuối file.

---

## KHÔNG TÌM THẤY — ba việc màn duyệt lỗ mở cần mà tầng lệnh chưa có

Lệnh đã chạy:
```
grep -rn "changeKind\|changeSwing\|approve" src/lib/commands/business/openingCommands.ts
```
Kết quả: **rỗng, exit code 1** (không khớp dòng nào).

Đối chiếu rộng hơn để chắc chắn không có ở chỗ khác trong tầng lệnh:
```
grep -rn "changeKind\|changeSwing" src/domain src/lib
```
Kết quả thật: CHỈ khớp trong `src/lib/commands/business/wallCommands.ts` (`wall.changeKind`,
đổi loại TƯỜNG — `loadBearing`/`partition`/`envelope`, dòng 4,102,492,530,536,546) và một
dòng test liên quan. **Không có `changeKind`/`changeSwing` nào cho lỗ mở** ở bất cứ đâu
trong `src/domain` hay `src/lib`.

```
grep -rn "approve" src/lib/commands/business
```
Kết quả thật: chỉ một dòng chú thích trong `shared.ts:20` ("chưa được duyệt — `reviewed:
false`"), không có hàm `approve*` hay `*ApproveOpening*` nào.

### 1. Đổi loại lỗ mở (door ↔ window)
**KHÔNG TÌM THẤY.** Không có `changeKindOpening`/`ResizeOpeningInput.kind`/tương đương nào
trong `openingCommands.ts`. `ResizeOpeningInput` (mục e, `:417-422`) chỉ có
`widthMm?`/`heightMm?`/`sillHeightMm?` — không có `kind?`.

### 2. Đổi chiều mở (swing)
**KHÔNG TÌM THẤY.** Không có input nào trong tám lệnh của `OPENING_COMMAND_TYPES` mang
trường `swing` để SỬA — `swing` chỉ xuất hiện ở `AddOpeningInput.swing` (lúc TẠO MỚI,
`:210`), không có lệnh nào đổi `swing` của một lỗ mở đã tồn tại.

### 3. Duyệt một đối tượng (đặt `reviewed: true`)
**KHÔNG TÌM THẤY cho lỗ mở.** `grep -rln "reviewed: true" src --include=*.ts` (loại trừ
test) chỉ khớp sáu file, toàn bộ thuộc `src/screens/qc/WallLayerReview/**` và hai fixture —
KHÔNG có file nào của `openingCommands.ts` hay bất cứ đâu trong `src/domain/openings`. Cách
DUY NHẤT hiện có trong repo để đặt `reviewed: true` là khuôn `buildApproveWallCommand` cho
TƯỜNG (xem mục ngay dưới) — chưa có bản tương đương cho lỗ mở.

---

## Khuôn mẫu T5 phải dùng — `wall.approve` dựng bằng nguyên thuỷ công khai

Chép NGUYÊN VĂN từ `src/screens/qc/WallLayerReview/wallLayerReviewGateway.ts:475-507`
(kèm chú thích gốc ngay phía trên hàm, dòng 487-497):

```ts
/**
 * Loại của lệnh duyệt.
 *
 * Không nằm trong `WALL_COMMAND_TYPES` vì lệnh này không tồn tại ở S-07; hằng
 * đặt tên ở đây là chỗ DUY NHẤT chuỗi đó được viết, nên nhật ký hoạt động, đo
 * đạc và bài kiểm cùng đọc một nguồn (R-71).
 */
export const WALL_APPROVE_COMMAND_TYPE = 'wall.approve';

/** Câu mô tả trên nút hoàn tác và nhật ký hoạt động — `validateCommands` đòi nó khác rỗng. */
export const approveDescription = (wallId: WallId): string => `Duyệt tường ${wallId}.`;

/**
 * Lệnh duyệt một tường.
 *
 * A5: đây là đường DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm
 * `source: 'human'` — không có tham số nào cho phép nơi gọi truyền `source`,
 * nên đầu ra AI không có đường nào bật được cờ xanh "đã xác minh".
 *
 * Ảnh chụp `before`/`after` là ĐẦY ĐỦ (`changeForUpdate` giữ nguyên hai bản
 * ghi, không phải diff từng trường), nên `invertCommand` hoàn tác được lệnh này
 * mà không cần biết nó nghĩa là gì.
 */
export function buildApproveWallCommand(before: Wall, actorId: string): Command {
  const after: Wall = { ...before, reviewed: true, source: 'human' };

  return createCommand({
    type: WALL_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveDescription(before.id),
    changes: [changeForUpdate('wall', before, after)],
  });
}
```

Và đoạn giải thích VÌ SAO ĐƯỢC PHÉP, chép NGUYÊN VĂN từ docstring đầu file (dòng 22-35):

> ## Lệnh duyệt `wall.approve` — dựng bằng nguyên thuỷ công khai
>
> `WALL_COMMAND_TYPES` (`wallCommands.ts:98-106`) chỉ có bảy lệnh và **không có
> lệnh duyệt**. Điều phối viên đã duyệt cách dựng bằng `createCommand` +
> `changeForUpdate` (hợp đồng lô-gic mục C.2), hợp lệ vì `CommandType` là
> `string` mở và `validateCommands` chỉ kiểm `command.type` khác rỗng, không so
> với một bảng cho phép (mục C.3). Lệnh tự hoàn tác được vì `changeForUpdate`
> mang ĐỦ ảnh chụp `before`/`after`, và `invertCommand` chỉ hoán đổi hai ảnh đó
> (mục C.5) — không cần thêm một dòng nào cho `Ctrl+Z`.
>
> **A5 ép ngay ở kiểu dựng lệnh:** {@link buildApproveWallCommand} là đường DUY
> NHẤT đặt `reviewed: true`, và nó luôn đặt kèm `source: 'human'`. Không có
> tham số nào cho phép người gọi truyền `source`, nên không tồn tại đường để
> đầu ra AI bật cờ xanh "đã xác minh".

**T5 dùng chính khuôn này** để dựng ba lệnh còn thiếu ngay trong thư mục màn (không sửa
`src/lib/commands/business/openingCommands.ts`):
- `opening.changeKind` (đổi door ↔ window)
- `opening.changeSwing` (đổi chiều mở)
- `opening.approve` (đặt `reviewed: true`, LUÔN kèm `source: 'human'`, LUÔN qua
  `createCommand` + `changeForUpdate('opening', before, after)` — không đường nào khác).

### Chữ ký `createCommand` dùng trong khuôn trên

```ts
export interface CommandInput {
  type: CommandType;
  actorId: string;
  description: string;
  changes: readonly EntityChange[];
  id?: CommandId;
  timestamp?: string;
}

export const changeForUpdate = <K extends EntityKind>(
  kind: K,
  before: EntityByKind[K],
  after: EntityByKind[K],
): EntityChangeOfKind<K> // ném Error nếu before.id !== after.id

export const createCommand = (input: CommandInput): Command
```
— `src/lib/commands/createCommand.ts:18-28,52-62,128`. `createCommand` NÉM `Error` khi bất
kỳ `change` nào không invertible (cả `before` và `after` đều `null`) — nhưng
`changeForUpdate` không bao giờ tạo ra tình huống đó vì cả hai tham số bắt buộc, không
optional.

### Chữ ký `runTransaction` và `TransactionOptions`

```ts
export interface TransactionOptions {
  readonly label?: string;
}

export function runTransaction(
  commands: readonly Command[],
  deps: DispatchDeps,
  options: TransactionOptions = {},
): Promise<DispatchResult>
```
— `src/lib/commands/transaction.ts:25-33,53`. Chạy nhiều lệnh như MỘT khối: tất cả qua được
bước kiểm hợp lệ hay không có gì được áp; SINH ĐÚNG MỘT undo entry. **Không bao giờ reject**
— thất bại trả `DispatchResult` dạng `{ ok: false, error: DispatchFailure }` nêu bước hỏng
(`stage`), lý do tiếng Việt (`reasons`), nguyên nhân gốc (`cause`), và đã rollback chưa
(`rolledBack`).

`DispatchDeps` (cổng mà `runTransaction`/`dispatch` cần, dùng khi test/dựng story — xem
`wallLayerReviewGateway.ts` mục "Đường ghi"):
```ts
export interface DispatchDeps {
  readonly spatial: SpatialPort;   // { read, applyPatches } — applyPatches PHẢI là commit(...) của store, không phải set()
  readonly history: HistoryPort;   // { push, drop }
  readonly rules: RulesPort;       // { run, write }
  readonly sync: SyncPort;         // { enqueue }
  readonly now?: () => string;
}
```
— `src/lib/commands/dispatch.ts:156-163`.

### A5 — nhắc lại tường minh

**Chỉ lệnh duyệt của NGƯỜI mới được đặt `reviewed: true`, và LUÔN kèm `source: 'human'`.**
Đầu ra của AI (kết quả dò bản vẽ) không bao giờ được đặt cờ này. Bằng chứng bằng mã: hàm
duyệt (`buildApproveWallCommand`) không có tham số `source` — người gọi KHÔNG THỂ truyền
`source: 'ai'` dù có muốn; và mọi lệnh TẠO MỚI trong tầng S-07 dùng `AUTHORED_BY_HAND`
(`shared.ts:124-128`, xem mục e) — cố định `reviewed: false`, không có lệnh tạo nào đặt
`true`. Một lệnh `opening.approve` mà T5 dựng PHẢI theo đúng khuôn: không tham số
`source`, không tham số `confidence`, chỉ nhận `(before: GraphOpening, actorId: string)`.

---

## CẢNH BÁO CHO T5

1. **`Millimetres` KHÔNG PHẢI cùng một kiểu ở hai chỗ.** `src/domain/units/types.ts:34` định
   nghĩa `Millimetres = Quantity<'mm'>` — MỘT BRAND TYPE, không gán được từ `number` trần,
   phải qua hàm `millimetres(value)` (ném `RangeError` nếu không hữu hạn). Nhưng
   `src/domain/spatial/types.ts:16` định nghĩa `Millimetres = number` — KHÔNG BRAND, một
   alias trần. `domain/openings/**` dùng bản BRAND (import từ `units/types`); đồ thị lưu
   (`GraphOpening.widthMm` v.v., kiểu `Opening` ở `spatial/types.ts:141-152`) dùng bản
   NUMBER TRẦN. `openingCommands.ts` phải gọi `millimetres(input.widthMm)` mỗi khi băng
   qua ranh giới này (xem `tracedFrom`, `:214-222`) — quên gọi thì TypeScript vẫn cho qua ở
   phía `number → Millimetres` chỗ nào lỡ dùng `as`, nhưng đúng chỗ thì phải qua constructor.
   **`RelativePosition` cũng là `number` trần** (`domain/openings/types.ts:83`), không brand
   — dễ nhầm với một fraction bất kỳ, không có gì ngăn truyền `5.0` vào chỗ cần `[0,1]` ngoài
   validate runtime (`isValidRelativePosition`).

2. **Hàm nào ném lỗi (throw), hàm nào trả refuse/null — không đồng nhất, phải tra từng hàm:**
   - `placeOnWall` → `throw RangeError` khi fraction ngoài `[0,1]`.
   - `openingCentre` → `throw Error` khi wall không phải chủ.
   - `validateOpening` → `throw Error` khi wall không phải chủ (CÙNG kiểu lỗi nhưng khác câu).
   - `reflowOpenings` → `throw Error` (khác id) hoặc `throw RangeError` (fraction hỏng).
   - `reflowOpeningsAcrossSplit` → `throw Error` (id trùng/không nối nhau/không phủ đủ) hoặc
     `throw RangeError` (không chiều dài / cắt đúng đầu tường).
   - `attachToWall` → `throw RangeError` CHỈ khi `radiusMm` âm/vô hạn; KHÔNG BAO GIỜ ném lỗi
     vì không tìm được tường — trường hợp đó trả `OrphanOpening`, không throw.
   - Tám hàm `create*Command` trong `openingCommands.ts` → KHÔNG BAO GIỜ throw ra ngoài cho
     input sai; luôn trả `CommandResult` (`refuse(...)` chứa `reasons: string[]`).
   - `createCommand` → `throw Error` nếu một `change` có cả `before` và `after` đều `null`.
   - `runTransaction`/`dispatch` → KHÔNG BAO GIỜ reject; luôn `Promise<DispatchResult>` với
     `{ ok: false, error }`.
   Một màn duyệt lỗ mở gọi lẫn `domain/openings/*` (ném Error/RangeError trực tiếp — PHẢI
   try/catch hoặc kiểm trước) và `commands/business/*` (không ném — kiểm `result.ok`) là hai
   kiểu lỗi khác hẳn nhau trên cùng một màn hình.

3. **Mảng rỗng thay vì `null`:** `validateOpenings` trả `[]` khi sạch vi phạm (không phải
   `null`); `findOrphans` trả `[]` khi không có orphan; `mergeCommandRun([])` trả `[]`.
   Ngược lại, `attachToWall`/`reflowOpenings`/`reflowOpeningsAcrossSplit` **không bao giờ**
   trả mảng rỗng kiểu "không có gì" — chúng luôn trả đúng MỘT `OpeningAttachment` /
   `ReflowResult` có cấu trúc đầy đủ, kể cả khi kết quả là "không thay đổi gì"
   (`ReflowStatus: 'unchanged'`).

4. **`OpeningKind` domain (`'door'|'window'|'void'`) ≠ `OpeningKind` spatial graph
   (`'door'|'window'`)** — xem mục d. Một màn hình đổi loại lỗ mở KHÔNG THỂ cho người dùng
   chọn `'void'` nếu ghi thẳng vào `GraphOpening.kind`, vì kiểu đó không nhận `'void'`. Đây
   chính là lỗ hổng khiến "đổi loại lỗ mở" (mục KHÔNG TÌM THẤY #1) chưa có lệnh: quyết định
   `'void'` ánh xạ ra sao vào đồ thị (một `OpeningKind` thứ ba trong graph? một cờ riêng?)
   là quyết định của T5, không phải quyết định đã có sẵn trong mã.

5. **`ResizeOpeningInput` không có `swing`** — muốn đổi swing bắt buộc phải dựng lệnh mới
   theo khuôn `buildApproveWallCommand`, KHÔNG tái dùng được `createResizeOpeningCommand`.

6. **`AddOpeningInput.centre` là điểm TUYỆT ĐỐI**, còn lệnh sửa (`MoveOpeningInput`) lại
   nhận `offsetMm` (khoảng cách từ đầu tường tới MÉP TRÁI, không phải TÂM, không phải
   fraction). Ba đơn vị định vị khác nhau cho cùng một khái niệm "vị trí lỗ mở" xuất hiện
   trên cùng một domain (điểm tuyệt đối ở `attach.ts`/`AddOpeningInput`, fraction
   `RelativePosition` ở `domain/openings/**`, offset-mm-tính-từ-mép-trái ở `GraphOpening`/
   lệnh S-07) — một màn hình hiển thị số phải chọn ĐÚNG MỘT trong ba và tự quy đổi
   (`relativePositionOf`/`offsetOnWall`, `shared.ts:335-340`), không được lẫn.

7. **`fitToContent` và `flyToBounds` là hai cài đặt TÁCH RỜI**, không dùng chung một hàm nội
   bộ cho phần zoom/toạ độ dù công thức giống hệt nhau (so `useCanvasViewport.ts:129-146` với
   `:51-76` + `:180-192`) — sửa công thức fit ở một chỗ (ví dụ đổi cách tính `MIN_ZOOM`) mà
   quên chỗ kia sẽ làm `fitToContent` và `flyToBounds` lệch nhau trên cùng một `ContentBounds`.

8. **`src/domain/quality/thresholds.ts` không liên quan tới lỗ mở.** File này CHỈ định
   nghĩa ba mức chất lượng ẢNH ĐẦU VÀO (`resolution`/`skew`/`contrast`/`noise` —
   `ImageQualityLevel`, `classifyResolution`, v.v.), dùng cho màn `InputQualityGate`, không
   export bất kỳ ngưỡng nào cho cửa/cửa sổ. Ngưỡng cho lỗ mở nằm ở `OPENING_RULES`
   (`domain/openings/validate.ts`, mục b) — đừng nhầm hai bảng ngưỡng với nhau.

9. **`OPENING_COMMAND_TYPES` không phải một `enum` đóng ở tầng kiểm.** `validateCommands`
   (`dispatch.ts:220`) chỉ đòi `command.type` khác rỗng, KHÔNG so với bảng cho phép — đúng
   cơ chế cho phép khuôn `wall.approve`/`opening.approve` tồn tại mà không cần khai báo
   trong `OPENING_COMMAND_TYPES`, nhưng cũng có nghĩa gõ sai một chuỗi loại lệnh (lỗi chính
   tả) sẽ KHÔNG bị chặn ở bước validate — chỉ lộ ra khi tra nhãn ở `history.ts:ACTION_LABELS`
   thất bại và rơi về mô tả mặc định.
