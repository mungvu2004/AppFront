# Hợp đồng lô-gic — lớp 1 (khảo sát mã có sẵn)

> Tài liệu này được sinh bằng cách **đọc mã nguồn thật** và chép nguyên chữ ký. Không diễn giải, không bịa. Mọi mục ghi rõ `đường/dẫn/file.ts:dòng`. Ba worker lớp 2 dùng file này làm đầu vào bắt buộc — KHÔNG tự đi đọc lại tự do, vì các câu hỏi trọng yếu (mục C, và phần "NOT FOUND") đã được điều tra và chốt ở đây.
>
> **CẢNH BÁO ĐÃ ĐỌC TRƯỚC KHI LÀM:** `docs/architecture.md`, `docs/domain-contracts.md`, `docs/components-*.md` là tài liệu cũ, lỗi thời (mô tả `src/lib/scale.ts` và `src/lib/geometry/area.ts` — đã bị xoá khỏi repo). Không dùng chúng. Toàn bộ nội dung dưới đây chỉ lấy từ mã nguồn hiện có trong worktree này.

---

## A. Lệnh nghiệp vụ (S-07) — `src/lib/commands/business/wallCommands.ts`

### A.0 `WALL_COMMAND_TYPES` — `src/lib/commands/business/wallCommands.ts:98-106`

```ts
/** The seven wall commands, as `dispatch` and the telemetry see them. */
export const WALL_COMMAND_TYPES = {
  draw: 'wall.draw',
  dragEnd: 'wall.dragEnd',
  changeThickness: 'wall.changeThickness',
  changeKind: 'wall.changeKind',
  split: 'wall.split',
  merge: 'wall.merge',
  remove: 'wall.delete',
} as const;
```

Dùng để: là bảng bảy loại lệnh tường duy nhất mà `dispatch`, lịch sử và log hoạt động biết tới — **không có `approve`** (xem mục C).

### A.1 `CommandResult` và `CommandContext` — `src/lib/commands/business/shared.ts:61-80`

```ts
/** Everything a builder reads that is not part of the edit itself. */
export interface CommandContext {
  /** The drawing as it is now; snapshots are taken from here. */
  readonly graph: NormalizedSpatial;
  readonly actorId: string;
  /** Only for tests and replay; generated when left out. */
  readonly id?: CommandId;
  /** Only for tests and replay; the current time when left out. */
  readonly timestamp?: string;
}

/** Why an edit was refused, in the words the interface shows. */
export interface CommandRefusal {
  /** The command that was refused, for telemetry; English, never shown. */
  readonly type: CommandType;
  /** Vietnamese sentences, one per problem found. Never empty. */
  readonly reasons: readonly string[];
}

/** What every builder returns: a command to dispatch, or the reasons why not. */
export type CommandResult = Result<Command, CommandRefusal>;
```

`Result<T, E>` đến từ `src/lib/http/types` (`err`/`ok` helpers — `shared.ts:51`). `CommandResult` là `{ ok: true, data: Command } | { ok: false, error: CommandRefusal }`.

### A.2 Bảy lệnh — input + hàm tạo + validate

Mỗi lệnh: `validate*(input, context) -> string[]` (rỗng = hợp lệ), `create*Command(input, context) -> CommandResult`.

**1. `wall.draw`** — `src/lib/commands/business/wallCommands.ts:212-306`

```ts
export interface DrawWallInput {
  readonly id: WallId;
  readonly levelId: LevelId;
  readonly centreline: Segment;
  readonly thicknessMm: number;
  readonly heightMm: number;
  readonly kind: WallKind;
}

export function validateDrawWall(input: DrawWallInput, context: CommandContext): string[]

export function createDrawWallCommand(input: DrawWallInput, context: CommandContext): CommandResult
```

**2. `wall.dragEnd`** — `wallCommands.ts:312-414`

```ts
export interface DragWallEndInput {
  readonly wallId: WallId;
  readonly end: WallEnd; // 'start' | 'end'
  readonly to: Point;
}

export function validateDragWallEnd(input: DragWallEndInput, context: CommandContext): string[]

export function createDragWallEndCommand(
  input: DragWallEndInput,
  context: CommandContext,
): CommandResult
```
Kéo đỉnh tường kéo theo `reflowOpenings` (đổi offset các ô mở gắn trên tường, cùng một command).

**3. `wall.changeThickness`** — `wallCommands.ts:420-489`

```ts
export interface ChangeWallThicknessInput {
  readonly wallId: WallId;
  readonly thicknessMm: number;
}

export function validateChangeWallThickness(
  input: ChangeWallThicknessInput,
  context: CommandContext,
): string[]

export function createChangeWallThicknessCommand(
  input: ChangeWallThicknessInput,
  context: CommandContext,
): CommandResult
```

**4. `wall.changeKind`** — `wallCommands.ts:495-554`

```ts
export interface ChangeWallKindInput {
  readonly wallId: WallId;
  readonly kind: WallKind;
}

export function validateChangeWallKind(
  input: ChangeWallKindInput,
  context: CommandContext,
): string[]

export function createChangeWallKindCommand(
  input: ChangeWallKindInput,
  context: CommandContext,
): CommandResult
```

**5. `wall.split`** — `wallCommands.ts:560-699`

```ts
export interface SplitWallInput {
  readonly wallId: WallId;
  /** Where to cut; dropped onto the centreline by the geometry. */
  readonly at: Point;
  /** Id for the second piece; the first keeps the original. */
  readonly secondWallId: WallId;
}

export function validateSplitWall(input: SplitWallInput, context: CommandContext): string[]

export function createSplitWallCommand(
  input: SplitWallInput,
  context: CommandContext,
): CommandResult
```

**6. `wall.merge`** — `wallCommands.ts:705-860`

```ts
export interface MergeWallsInput {
  readonly wallId: WallId;
  readonly otherWallId: WallId;
}

export function validateMergeWalls(input: MergeWallsInput, context: CommandContext): string[]

export function createMergeWallsCommand(
  input: MergeWallsInput,
  context: CommandContext,
): CommandResult
```

**7. `wall.delete`** — `wallCommands.ts:866-964`

```ts
export interface DeleteWallInput {
  readonly wallId: WallId;
}

export function validateDeleteWall(input: DeleteWallInput, context: CommandContext): string[]

export function createDeleteWallCommand(
  input: DeleteWallInput,
  context: CommandContext,
): CommandResult
```
Xoá tường kéo theo xoá các ô mở của nó, và cập nhật `room.wallIds` / `dimension.referenceIds` — tất cả trong CÙNG MỘT command (một `Ctrl+Z`).

### A.3 `src/lib/commands/business/shared.ts` — mọi export

Dòng ~124-128 — **hằng mặc định review khi tạo mới** (đây là hằng "reviewed: false" task nhắc tới):

```ts
/**
 * The review metadata a newly drawn entity starts with.
 *
 * Drawing is authoring, not approving: the entity comes from a person, so the
 * confidence is total and the source is `human`, but `reviewed` stays false
 * until somebody checks it. Invariant A5 reserves the verified green for that.
 */
export const AUTHORED_BY_HAND = {
  confidence: 1,
  source: 'human',
  reviewed: false,
} as const;
```

Mọi export khác của `shared.ts` (chữ ký rút gọn, đủ để gọi):

```ts
export interface CommandContext { readonly graph: NormalizedSpatial; readonly actorId: string; readonly id?: CommandId; readonly timestamp?: string; }
export interface CommandRefusal { readonly type: CommandType; readonly reasons: readonly string[]; }
export type CommandResult = Result<Command, CommandRefusal>;

export const buildCommand = (
  type: CommandType,
  description: string,
  changes: readonly EntityChange[],
  context: CommandContext,
): Command => /* wraps createCommand(...) — shared.ts:88-101 */

export const refuse = (type: CommandType, reasons: readonly string[]): CommandResult // shared.ts:104
export const accept = (command: Command): CommandResult // shared.ts:111

export const entitiesOfKind = <K extends EntityKind>(graph: NormalizedSpatial, kind: K): readonly EntityByKind[K][] // shared.ts:135
export const idIsTaken = (graph: NormalizedSpatial, id: string): boolean // shared.ts:153
export const readOf = <K extends EntityKind>(graph: NormalizedSpatial, kind: K, id: IdByKind[K]): EntityByKind[K] | null // shared.ts:156
export const openingsOfWall = (graph: NormalizedSpatial, wallId: WallId): readonly GraphOpening[] // shared.ts:169
export const wallsOnLevel = (graph: NormalizedSpatial, levelId: LevelId): readonly GraphWall[] // shared.ts:173
export const levelOfWall = (graph: NormalizedSpatial, wall: GraphWall): Level | null // shared.ts:177

export const WALL_KIND_LABELS: Readonly<Record<WallKind, string>> // shared.ts:191 — { loadBearing: 'tường chịu lực', partition: 'vách ngăn', envelope: 'tường bao' }
export const WALL_KINDS: readonly WallKind[] // shared.ts:198 — ['loadBearing', 'partition', 'envelope']
export const FURNITURE_KIND_LABELS: Readonly<Record<FurnitureKind, string>> // shared.ts:201
export const FURNITURE_KINDS: readonly FurnitureKind[] // shared.ts:213
export const nameOfOpening = (opening: GraphOpening): string // shared.ts:225 — "cửa đi D-3"

export const formatLengthMm = (valueMm: number): string // shared.ts:233
export const formatAreaM2 = (valueM2: number): string // shared.ts:240
export const formatMetres = (valueMm: number): string // shared.ts:243
export const formatElevationM = (valueMm: number): string // shared.ts:247
export const formatAngleDeg = (valueDeg: number): string // shared.ts:251
export const formatCount = (value: number): string // shared.ts:258
export const formatPoint = (point: Point): string // shared.ts:261

export const isFinitePoint = (point: Point): boolean // shared.ts:269
export const toPointMm = (point: Point): PointMm // shared.ts:273
export const toPoint = (point: PointMm): Point // shared.ts:279
export const toSolidWall = (wall: GraphWall, level: Level): SolidWall // shared.ts:307 — @throws RangeError nếu số liệu không hữu hạn
export const withCentrelineOf = (wall: GraphWall, geometry: SolidWall): GraphWall // shared.ts:320
export const relativePositionOf = (opening: GraphOpening, wall: SolidWall): RelativePosition // shared.ts:335
export const offsetOnWall = (opening: AttachedOpening, wall: SolidWall): number // shared.ts:339
export const toAttachedOpening = (opening: GraphOpening, wall: SolidWall): AttachedOpening // shared.ts:343
```

**Bản đồ kind tường graph → kind tường hình học** (`shared.ts:291-295`, dùng nội bộ, KHÔNG export):
```ts
const SOLID_WALL_KIND: Readonly<Record<WallKind, SolidWallKind>> = {
  loadBearing: 'loadBearing',
  partition: 'partition',
  envelope: 'glazed',
};
```
Đây LÀ hàm ánh xạ kind giữa hai vựng "Wall" khác nhau nói ở mục D — nhưng **không export**, chỉ dùng nội bộ trong `toSolidWall`.

---

## B. Nguyên thuỷ lệnh chung — `src/lib/commands/`

### B.1 `types.ts` — chép nguyên (dòng 20-87)

```ts
export type CommandId = `C-${string}`;

/**
 * Names the business action, as a short dot-separated English verb phrase,
 * for example `wall.move` or `room.rename`.
 */
export type CommandType = string;

export interface EntityChangeOfKind<K extends EntityKind> {
  kind: K;
  id: IdByKind[K];
  before: EntityByKind[K] | null;
  after: EntityByKind[K] | null;
}

export type EntityChange = {
  [K in EntityKind]: EntityChangeOfKind<K>;
}[EntityKind];

export interface CommandScope {
  entityIds: readonly EntityId[];
  levelIds: readonly LevelId[];
  kinds: readonly EntityKind[];
}

export interface Command {
  id: CommandId;
  type: CommandType;
  /** Creation time as an ISO 8601 string. */
  timestamp: string;
  actorId: string;
  /** Human-readable description, written in Vietnamese for the activity log. */
  description: string;
  /** Applied in array order; the inverse applies them in reverse order. */
  changes: readonly EntityChange[];
  scope: CommandScope;
}
```

**QUAN TRỌNG:** `CommandType = string` — KHÔNG phải union đóng. Xem mục C.3 để có bằng chứng và ý nghĩa.

### B.2 `createCommand.ts` — chép nguyên (dòng 18-142)

```ts
export interface CommandInput {
  type: CommandType;
  actorId: string;
  /** Human-readable description, written in Vietnamese for the activity log. */
  description: string;
  changes: readonly EntityChange[];
  /** Only for tests and replay; generated when omitted. */
  id?: CommandId
  /** Only for tests and replay; defaults to the current time. */
  timestamp?: string;
}

export const changeForAdd = <K extends EntityKind>(kind: K, entity: EntityByKind[K]): EntityChangeOfKind<K> => ({
  kind,
  id: idOfEntity(entity),
  before: null,
  after: entity,
});

export const changeForRemove = <K extends EntityKind>(kind: K, entity: EntityByKind[K]): EntityChangeOfKind<K> => ({
  kind,
  id: idOfEntity(entity),
  before: entity,
  after: null,
});

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

export const createCommand = (input: CommandInput): Command => {
  for (const change of input.changes) {
    assertChangeIsInvertible(change); // throws nếu before===after===null, hoặc snapshot.id !== change.id
  }
  return {
    id: input.id ?? createCommandId(), // `C-${uuid viết hoa}`
    type: input.type,
    timestamp: input.timestamp ?? new Date().toISOString(),
    actorId: input.actorId,
    description: input.description,
    changes: [...input.changes],
    scope: deriveScope(input.changes), // tự suy ra entityIds/levelIds/kinds từ changes — KHÔNG gõ tay
  };
};
```

`CommandInput.type` nhận **bất kỳ chuỗi nào** — không có bảng kiểm tra `type` nằm trong `createCommand`.

### B.3 `dispatch.ts` — chép nguyên phần công khai

```ts
export type DispatchStage = 'validate' | 'apply' | 'history' | 'rules' | 'sync';
export const DISPATCH_STAGES = ['validate', 'apply', 'history', 'rules', 'sync'] as const satisfies readonly DispatchStage[];
export const DISPATCH_STAGE_LABELS: Readonly<Record<DispatchStage, string>>; // dispatch.ts:81-87

export type UndoEntryId = `U-${string}`;

export interface DispatchBatch {
  readonly id: UndoEntryId;
  readonly label: string;
  readonly commands: readonly Command[];
  readonly timestamp: string;
}

export interface UndoEntry extends DispatchBatch {
  readonly undoPatches: readonly SpatialPatch[];
}

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

export interface RollbackIssue {
  readonly stage: DispatchStage;
  readonly message: string;
  readonly cause: unknown;
}

export interface DispatchFailure {
  readonly stage: DispatchStage;
  readonly message: string;
  readonly reasons: readonly string[];
  readonly cause: unknown;
  readonly rolledBack: boolean;
  readonly rollbackIssues: readonly RollbackIssue[];
}

export interface DispatchSuccess {
  readonly entry: UndoEntry;
  readonly rules: RuleRunResult;
}

export type DispatchResult = Result<DispatchSuccess, DispatchFailure>;

/** CHỈ kiểm changes (kind hợp lệ, id đúng dạng, snapshot có tồn tại, đúng kind trong đồ thị) — KHÔNG kiểm command.type theo whitelist. */
export function validateCommands(commands: readonly Command[], graph: NormalizedSpatial): string[]
export function validateCommand(command: Command, graph: NormalizedSpatial): string[]

export interface IncrementalRuleRunnerOptions {
  readonly registry?: RuleRegistry;
  readonly onResult?: (result: RuleRunResult) => void;
}
export function createIncrementalRuleRunner(options: IncrementalRuleRunnerOptions = {}): RulesPort

export const SPATIAL_PIPELINE_KEY = 'spatial-command-pipeline';

export interface PipelineInput {
  readonly commands: readonly Command[];
  readonly label: string;
}
export async function runCommandPipeline(input: PipelineInput, deps: DispatchDeps): Promise<DispatchResult>

export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult>
// = runExclusive(SPATIAL_PIPELINE_KEY, () => runCommandPipeline({ commands: [command], label: command.description }, deps))
```

**Năm bước pipeline** (`dispatch.ts:4-33`, docblock): `validate` → `apply` → `history` → `rules` → `sync`. Bước hỏng thì rollback (undo mọi bước trước) và trả `DispatchFailure`.

### B.4 `history.ts` — chép nguyên

```ts
export const MAX_HISTORY_STEPS = 100;

export interface SelectionSnapshot {
  readonly selectedIds: readonly EntityId[];
}
export const NO_SELECTION: SelectionSnapshot = { selectedIds: [] };

export type HistoryDirection = 'undo' | 'redo';

export interface HistoryStep {
  readonly id: UndoEntryId;
  readonly label: string;
  readonly commands: readonly Command[];
  readonly undoPatches: readonly SpatialPatch[];
  readonly redoPatches: readonly SpatialPatch[];
  readonly selectionBefore: SelectionSnapshot;
  readonly selectionAfter: SelectionSnapshot;
  readonly timestamp: string;
  readonly entryIds: readonly UndoEntryId[];
}

export interface HistoryPushInput {
  readonly entry: UndoEntry;
  readonly selectionBefore: SelectionSnapshot;
  readonly selectionAfter: SelectionSnapshot;
}

export interface HistoryTransition {
  readonly direction: HistoryDirection;
  readonly step: HistoryStep;
  readonly patches: readonly SpatialPatch[];
  readonly selection: SelectionSnapshot;
}

export interface HistoryStack {
  push: (input: HistoryPushInput) => HistoryStep;
  undo: () => HistoryTransition | null;   // <-- hàm UNDO
  redo: () => HistoryTransition | null;   // <-- hàm REDO
  canUndo: () => boolean;
  canRedo: () => boolean;
  undoSteps: () => readonly HistoryStep[];
  redoSteps: () => readonly HistoryStep[];
  drop: (entryId: UndoEntryId) => boolean;
  clear: () => void;
}

export function buildHistoryLabel(commands: readonly Command[], fallback: string): string

export interface CreateHistoryStackOptions {
  readonly limit?: number;
  readonly mergeWindowMs?: number;
}
export function createHistoryStack(options: CreateHistoryStackOptions = {}): HistoryStack
```

**Undo/redo hoạt động thế nào (100 bước):**
- `stack.undo()`: pop record khỏi `undoRecords`, đẩy sang `redoRecords`, trả `{ direction: 'undo', patches: step.undoPatches, selection: step.selectionBefore }`. Người gọi tự áp `patches` vào graph và khôi phục `selection`.
- `stack.redo()`: ngược lại, dùng `step.redoPatches` và `step.selectionAfter`.
- `push()` khi `undoRecords.length > limit` (mặc định `MAX_HISTORY_STEPS = 100`) thì `undoRecords.shift()` — bỏ bước cũ nhất. Vậy "hoàn tác 100 bước" nghĩa là: ngăn xếp chỉ giữ tối đa 100 `HistoryStep`; bước thứ 101 đẩy bước 1 rơi khỏi ngăn xếp vĩnh viễn.
- **Gộp run**: `push()` kiểm `runInProgress()` — nếu lệnh mới cùng loại, cùng entity, trong `mergeWindowMs` (mặc định `MERGE_WINDOW_MS` = 400 ms từ `mergeCommands.ts`) so với bước đỉnh ngăn xếp, thì GỘP vào bước đó (`foldIntoStep`) thay vì đẩy bước mới — một lượt kéo tường nhiều frame vẫn là MỘT `Ctrl+Z`.
- **Một lệnh mới sau khi undo cắt nhánh redo**: `push()` luôn `redoRecords = []` trước khi xử lý.

### B.5 `invert.ts` — chép nguyên

```ts
export const UNDO_DESCRIPTION_PREFIX = 'Hoàn tác: ';
export const toggleUndoDescription = (description: string): string

export const invertCommand = (command: Command): Command
// => { ...command, description: toggleUndoDescription(...), changes: [...changes].reverse().map(invertChange) }
// invertChange swaps before <-> after. invertCommand(invertCommand(x)) === x (involution).

export const commandToPatches = (command: Command): readonly SpatialPatch[]
// change.after !== null -> { op: 'add', kind, entity: change.after }
// change.before !== null -> { op: 'remove', kind, id: change.id }
```
Tên hàm thật là **`invertCommand`** (đúng như task đoán).

### B.6 `transaction.ts` — export + signature

```ts
export interface TransactionOptions {
  readonly label?: string; // để trống: 1 lệnh dùng description của nó, nhiều lệnh -> "Gộp N thay đổi"
}

export function runTransaction(
  commands: readonly Command[],
  deps: DispatchDeps,
  options: TransactionOptions = {},
): Promise<DispatchResult>
// = runExclusive(SPATIAL_PIPELINE_KEY, () => runCommandPipeline({ commands, label }, deps))
```
Nhiều lệnh cùng đi qua 5 bước MỘT LẦN — 1 undo entry, 1 rule pass, 1 lượt sync, tất cả-hoặc-không-gì.

### B.7 `mergeCommands.ts` — export + signature

```ts
export const MERGE_WINDOW_MS = COALESCE_WINDOW_MS; // = 400 (từ lib/mutations/coalesce.ts)

export function canMergeCommands(
  earlier: Command,
  later: Command,
  windowMs: number = MERGE_WINDOW_MS,
): boolean
// true khi: cùng type, cùng actorId, cùng tập entityIds (scope), và gap thời gian trong [0, windowMs)

export function mergeCommands(earlier: Command, later: Command): Command
// giữ before của earlier + after của later cho mỗi entity; giữ id/description của earlier, timestamp của later

export function mergeCommandRun(
  commands: readonly Command[],
  windowMs: number = MERGE_WINDOW_MS,
): Command[]
```

---

## C. CÂU HỎI TRỌNG YẾU — lệnh DUYỆT (không tồn tại; cách thay thế)

### C.1 Xác nhận grep — KHÔNG có lệnh duyệt tường

```
$ grep -n -i "approve\|duyệt" src/lib/commands/business/wallCommands.ts src/lib/commands/business/shared.ts
src/lib/commands/business/shared.ts:20: *   entity is authored by a person and not yet approved — `reviewed: false` —
```

Kết quả duy nhất là một dòng DOCBLOCK giải thích tại sao `reviewed: false` khi tạo mới — không phải một lệnh. `WALL_COMMAND_TYPES` chỉ có bảy khoá (`draw, dragEnd, changeThickness, changeKind, split, merge, remove` → `wall.draw / wall.dragEnd / wall.changeThickness / wall.changeKind / wall.split / wall.merge / wall.delete`).

**NOT FOUND: không tồn tại lệnh duyệt tường (approve) trong S-07.**

### C.2 Cách thay thế đã được điều phối viên duyệt

Dựng lệnh `wall.approve` bằng NGUYÊN THUỶ CÔNG KHAI (không phải một builder có sẵn — worker lớp 2 tự viết lệnh gọi các hàm dưới đây, KHÔNG thêm hàm mới vào `src/lib/commands/business/`):

```ts
import { createCommand, changeForUpdate } from '@/lib/commands/createCommand';
import { dispatch } from '@/lib/commands/dispatch';
import type { Wall } from '@/domain/spatial/types';

function buildApproveWallCommand(before: Wall, actorId: string): Command {
  const after: Wall = { ...before, reviewed: true, source: 'human' };

  return createCommand({
    type: 'wall.approve', // chuỗi tự do — xem C.3
    actorId,
    description: `Duyệt tường ${before.id}.`,
    changes: [changeForUpdate('wall', before, after)],
  });
}

// rồi đẩy qua dispatch(command, deps) như mọi lệnh khác.
```

### C.3 Bằng chứng: `CommandType = string`, và `validateCommands` KHÔNG kiểm command type

**Bằng chứng 1 — `CommandType` là `string` mở, không phải union đóng** (`src/lib/commands/types.ts:27-31`):

```ts
/**
 * Names the business action, as a short dot-separated English verb phrase,
 * for example `wall.move` or `room.rename`.
 */
export type CommandType = string;
```

**Bằng chứng 2 — `validateCommands` (`src/lib/commands/dispatch.ts:220-328`) chỉ lặp qua `command.changes`, không có bước nào so `command.type` với một danh sách cho phép.** Trích đoạn đầy đủ các điều kiện được kiểm trên MỖI command (không có điều kiện nào đọc `command.type` để chặn):

```ts
export function validateCommands(commands: readonly Command[], graph: NormalizedSpatial): string[] {
  const reasons: string[] = [];
  if (commands.length === 0) { reasons.push('Không có lệnh nào để chạy.'); return reasons; }
  const staged = new Map<string, SpatialEntity | null>();
  const lookup = (entityId: string): SpatialEntity | null => { /* ... */ };

  for (const command of commands) {
    const code = isFilled(command.id) ? command.id : '(không mã)';
    const rejectCommand = (text: string): void => { reasons.push(`Lệnh ${code}: ${text}`); };

    if (!isFilled(command.id) || !command.id.startsWith('C-')) {
      rejectCommand('mã lệnh phải bắt đầu bằng "C-".');
    }
    if (!isFilled(command.type)) {
      rejectCommand('thiếu loại lệnh.');   // <-- CHỈ kiểm "có type hay không", KHÔNG kiểm type có nằm trong bảng nào
    }
    if (!isFilled(command.actorId)) { rejectCommand('thiếu người thực hiện.'); }
    if (!isFilled(command.description)) { rejectCommand('thiếu mô tả để hiện trên nhật ký và nút hoàn tác.'); }
    if (!isFilled(command.timestamp) || Number.isNaN(Date.parse(command.timestamp))) {
      rejectCommand('thời điểm không đọc được.');
    }
    if (!Array.isArray(command.changes) || command.changes.length === 0) {
      rejectCommand('không có thay đổi nào để áp.');
      continue;
    }
    const scopeEntityIds = new Set<string>(command.scope?.entityIds ?? []);
    const scopeKinds = new Set<string>(command.scope?.kinds ?? []);

    for (const [index, change] of command.changes.entries()) {
      const rejectChange = (text: string): void => { reasons.push(`Lệnh ${code}, thay đổi ${index + 1}: ${text}`); };
      if (!KNOWN_KINDS.has(change.kind)) { rejectChange(`loại đối tượng "${change.kind}" không có trong hệ thống.`); continue; }
      if (!isIdOfKind(change.kind, change.id)) { rejectChange(`mã ${change.id} không phải mã hợp lệ của loại ${change.kind}.`); continue; }
      if (change.before === null && change.after === null) { rejectChange('không có ảnh chụp nào nên không thể hoàn tác.'); continue; }
      for (const snapshot of [change.before, change.after]) {
        if (snapshot !== null && snapshot.id !== change.id) { rejectChange(`ảnh chụp mang mã ${snapshot.id}, khác mã ${change.id} của thay đổi.`); }
      }
      if (!scopeEntityIds.has(change.id) || !scopeKinds.has(change.kind)) { rejectChange(`phạm vi ảnh hưởng của lệnh bỏ sót đối tượng ${change.id}.`); }
      const existing = lookup(change.id);
      if (change.before === null && existing !== null) { rejectChange(`đối tượng ${change.id} đã có trong bản vẽ nên không tạo mới được.`); }
      if (change.before !== null && existing === null) { rejectChange(`đối tượng ${change.id} không còn trong bản vẽ.`); }
      if (existing !== null && !isEntityOfKind(change.kind, existing)) { rejectChange(`đối tượng ${change.id} trong bản vẽ không phải loại ${change.kind}.`); }
      staged.set(change.id, change.after);
    }
  }
  return reasons;
}
```

`KNOWN_KINDS` (`dispatch.ts:205`) là tập **kind của thực thể** (`level, wall, opening, furniture, room, axis, dimension` từ `ID_PREFIX_BY_KIND`), KHÔNG phải tập command type. Không có biến nào tên `KNOWN_COMMAND_TYPES` hay tương tự trong file. → **Xác nhận đúng**: `command.type` chỉ cần khác rỗng (`isFilled`), không bị so với whitelist nào. Điều phối viên đã đúng, không cần `ask`.

### C.4 Trường bắt buộc của `CommandInput` (để dựng lệnh) — `src/lib/commands/createCommand.ts:18-28`

```ts
export interface CommandInput {
  type: CommandType;          // BẮT BUỘC — chuỗi tự do, vd 'wall.approve'
  actorId: string;            // BẮT BUỘC
  description: string;        // BẮT BUỘC — tiếng Việt, hiện trên nhật ký + toast hoàn tác
  changes: readonly EntityChange[]; // BẮT BUỘC — ít nhất 1 change, mỗi change không được cả before/after đều null
  id?: CommandId;              // tuỳ chọn — tự sinh `C-${uuid}` nếu bỏ trống
  timestamp?: string;          // tuỳ chọn — tự lấy giờ hiện tại nếu bỏ trống
}
```
KHÔNG có trường `scope` trong `CommandInput` — `scope` được `createCommand` tự suy ra (`deriveScope`) từ `changes`, không được gõ tay.

### C.5 Lệnh `wall.approve` tự hoàn tác được không?

**CÓ, tự động, không cần viết gì thêm.** Vì:
1. `changeForUpdate('wall', before, after)` tạo ra một `EntityChange` mang ĐẦY ĐỦ snapshot `before` (bản ghi trước khi duyệt) và `after` (bản ghi sau khi duyệt) — `createCommand.ts:51-62`.
2. `invertCommand` (mục B.5) chỉ hoán đổi `before`/`after` của mọi `change` và đảo thứ tự mảng — không cần biết ý nghĩa nghiệp vụ của `wall.approve` là gì.
3. `dispatch` → bước `history` đẩy `UndoEntry` mang `undoPatches = commandToPatches(invertCommand(command))` — xem `dispatch.ts:449-451, 605-613`.
4. Vậy `Ctrl+Z` sau khi duyệt sẽ áp patch `{ op: 'add', kind: 'wall', entity: before }` (bản ghi có `reviewed: false` như trước khi duyệt) — trả nguyên trạng.

Không cần một hàm `invertApproveWall` riêng; đây chính là lý do tài liệu shared.ts nói "every command is invertible by construction".

---

## D. Đồ thị không gian — `src/domain/spatial/`

### D.1 `types.ts` — chép nguyên các kiểu được yêu cầu

```ts
/** Whether the data came from the AI model or from a person. */
export type DataSource = 'ai' | 'human';

/** A confidence score within [0, 1]. */
export type Confidence = number;

export interface ReviewMetadata {
  confidence: Confidence;
  source: DataSource;
  reviewed: boolean;
}

export type LevelId = `L-${string}`;
export type WallId = `W-${string}`;
export type OpeningId = `D-${string}`;
export type FurnitureId = `F-${string}`;
export type RoomId = `R-${string}`;
export type AxisId = `A-${string}`;
export type DimensionId = `M-${string}`;
export type EntityId = LevelId | WallId | OpeningId | FurnitureId | RoomId | AxisId | DimensionId;

export interface Level extends ReviewMetadata {
  id: LevelId;
  name: string;
  order: number;
  elevationMm: Millimetres;
  heightMm: Millimetres;
  areaM2?: SquareMetres;
  scaleMillimetresPerPixel?: MillimetresPerPixel;
}

/** Structural role of a wall. */
export type WallKind = 'loadBearing' | 'partition' | 'envelope';

/** A wall run on one level. */
export interface Wall extends ReviewMetadata {
  id: WallId;
  levelId: LevelId;
  centreline: Segment;
  thicknessMm: Millimetres;
  heightMm: Millimetres;
  kind: WallKind;
  openingIds: readonly OpeningId[];
}

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
```

`EntityKind` (bản kind, thực chất khai ở `ids.ts`, xem D.3): `'level' | 'wall' | 'opening' | 'furniture' | 'room' | 'axis' | 'dimension'`.

### D.2 `normalize.ts` — chép nguyên

```ts
export interface EntityByKind {
  level: Level;
  wall: Wall;
  opening: Opening;
  furniture: Furniture;
  room: Room;
  axis: Axis;
  dimension: Dimension;
}

export type SpatialEntity = EntityByKind[EntityKind];

export interface NormalizedSpatial {
  building: Building;
  byId: Readonly<Record<string, SpatialEntity>>;
  byLevel: Readonly<Record<string, readonly EntityId[]>>;
  byKind: Readonly<Record<EntityKind, readonly EntityId[]>>;
  notes: readonly Note[];
}

export const isEntityOfKind = <K extends EntityKind>(kind: K, entity: SpatialEntity): entity is EntityByKind[K] =>
  isIdOfKind(kind, entity.id);

export const resolveLevelId = (
  entity: SpatialEntity,
  byId: Readonly<Record<string, SpatialEntity>>,
): LevelId | null // level -> null; opening -> level của wall chủ; còn lại -> entity.levelId

export const normalizeSpatial = (graph: SpatialGraph): NormalizedSpatial
export const denormalizeSpatial = (normalized: NormalizedSpatial): SpatialGraph
// denormalizeSpatial(normalizeSpatial(g)) deep-equals g

export const idsOnLevel = (normalized: NormalizedSpatial, levelId: LevelId): readonly EntityId[] =>
  normalized.byLevel[levelId] ?? NO_IDS;
```

### D.3 `applyPatch.ts` — chép nguyên

```ts
export type SpatialPatch = {
  [K in EntityKind]: AddPatch<K> | UpdatePatch<K> | RemovePatch<K>;
}[EntityKind];
// AddPatch<K>    = { op: 'add'; kind: K; entity: EntityByKind[K] }         — chèn hoặc THAY THẾ nếu id đã có
// UpdatePatch<K> = { op: 'update'; kind: K; id: IdByKind[K]; changes: Partial<EntityByKind[K]> } — gộp nông
// RemovePatch<K> = { op: 'remove'; kind: K; id: IdByKind[K] }             — xoá khỏi mọi chỉ mục, KHÔNG xoá con

export const applyPatch = (
  normalized: NormalizedSpatial,
  patches: readonly SpatialPatch[],
): NormalizedSpatial
// copy-on-write có chọn lọc; không đổi gì thì trả về CHÍNH object cũ (===)

export const applySinglePatch = (normalized: NormalizedSpatial, patch: SpatialPatch): NormalizedSpatial =>
  applyPatch(normalized, [patch]);

export const readEntity = <K extends EntityKind>(
  normalized: NormalizedSpatial,
  kind: K,
  id: IdByKind[K],
): EntityByKind[K] | null
```

### D.4 `ids.ts` — export + signature

```ts
export const ID_PREFIX_BY_KIND = {
  level: 'L', wall: 'W', opening: 'D', furniture: 'F', room: 'R', axis: 'A', dimension: 'M',
} as const;
export type EntityKind = keyof typeof ID_PREFIX_BY_KIND;
export interface IdByKind { level: LevelId; wall: WallId; opening: OpeningId; furniture: FurnitureId; room: RoomId; axis: AxisId; dimension: DimensionId; }

export const createId = <K extends EntityKind>(kind: K): IdByKind[K]
export const isIdOfKind = <K extends EntityKind>(kind: K, id: string): id is IdByKind[K]
export const readKindFromId = (id: string): EntityKind | null
export const isValidId = (id: string): boolean
```

### D.5 `integrity.ts` — export + signature

```ts
export type IntegritySeverity = 'critical' | 'warning';
export type IntegrityRule =
  | 'duplicateId' | 'missingReference' | 'levelMembership'
  | 'zeroLengthWall' | 'roomOutline' | 'levelElevationOrder';

export interface IntegrityIssue {
  rule: IntegrityRule;
  severity: IntegritySeverity;
  entityId: string;
  message: string; // tiếng Việt
}

export const checkIntegrity = (normalized: NormalizedSpatial): IntegrityIssue[]
// chạy 6 rule: duplicateId, missingReference, levelMembership, zeroLengthWall, roomOutline, levelElevationOrder — chỉ đọc, không sửa

export const hasCriticalIssue = (issues: readonly IntegrityIssue[]): boolean
export const countBySeverity = (issues: readonly IntegrityIssue[]): Record<IntegritySeverity, number>
```

### D.6 CẢNH BÁO BẮT BUỘC — HAI kiểu `Wall` khác nhau trong repo

**`src/domain/spatial/types.ts:123-132` — Wall của ĐỒ THỊ (graph), CÓ review, dùng trong store/lệnh/API:**
```ts
export interface Wall extends ReviewMetadata {
  id: WallId;
  levelId: LevelId;
  centreline: Segment;
  thicknessMm: Millimetres;
  heightMm: Millimetres;
  kind: WallKind; // 'loadBearing' | 'partition' | 'envelope'  — BA giá trị
  openingIds: readonly OpeningId[];
}
```

**`src/domain/walls/types.ts:61-70` — Wall HÌNH HỌC, KHÔNG review, dùng trong `joints.ts`/`edit.ts`/`cleanup.ts` (tính đa giác, cắt/gộp/dọn):**
```ts
export interface Wall {
  readonly id: WallId;
  readonly kind: WallKind; // 'loadBearing' | 'partition' | 'railing' | 'glazed'  — BỐN giá trị, KHÁC bộ trên
  readonly centreline: WallCentreline;
  readonly thicknessMm: Millimetres;
  /** Height of the bottom of the wall, from the datum. */
  readonly baseElevationMm: Millimetres;
  /** Height of the top of the wall, from the datum. */
  readonly topElevationMm: Millimetres;
}
```

**Khác biệt cần nhớ:**
| | `domain/spatial/types.ts` (đồ thị) | `domain/walls/types.ts` (hình học) |
|---|---|---|
| Review | CÓ (`ReviewMetadata`: confidence/source/reviewed) | KHÔNG |
| `kind` | `loadBearing \| partition \| envelope` | `loadBearing \| partition \| railing \| glazed` |
| Cao độ | `heightMm` (tương đối so với sàn tầng) + tầng có `elevationMm` riêng | `baseElevationMm`/`topElevationMm` (TUYỆT ĐỐI so với datum công trình) |
| Dùng ở | store, lệnh nghiệp vụ, API, viewmodel | `joints.ts`, `edit.ts`, `cleanup.ts` (tính hình học thuần) |

**Hàm chuyển đổi CÓ tồn tại**, nhưng KHÔNG export công khai — nằm nội bộ trong `src/lib/commands/business/shared.ts:291-317`:

```ts
// shared.ts:291-295 (không export)
const SOLID_WALL_KIND: Readonly<Record<WallKind, SolidWallKind>> = {
  loadBearing: 'loadBearing',
  partition: 'partition',
  envelope: 'glazed',
};

// shared.ts:307 (CÓ export)
export const toSolidWall = (wall: GraphWall, level: Level): SolidWall => ({
  id: wall.id,
  kind: SOLID_WALL_KIND[wall.kind],
  centreline: { start: toPointMm(wall.centreline.start), end: toPointMm(wall.centreline.end) },
  thicknessMm: millimetres(wall.thicknessMm),
  baseElevationMm: millimetres(level.elevationMm),
  topElevationMm: millimetres(level.elevationMm + wall.heightMm),
});

// shared.ts:320 (CÓ export) — chiều ngược lại, chỉ cập nhật centreline
export const withCentrelineOf = (wall: GraphWall, geometry: SolidWall): GraphWall => ({
  ...wall,
  centreline: { start: toPoint(geometry.centreline.start), end: toPoint(geometry.centreline.end) },
});
```

`toSolidWall`/`withCentrelineOf` **ĐƯỢC export** từ `src/lib/commands/business/shared.ts` — worker lớp 2 có thể `import { toSolidWall, withCentrelineOf } from '@/lib/commands/business/shared'` (đây là `src/lib`, ĐƯỢC PHÉP import theo mục 0.4, KHÔNG phải import xuyên tầng cấm). Không có bản `railing` ở phía đồ thị (đồ thị không có kiểu `railing`) — ánh xạ này KHÔNG một-một hai chiều đầy đủ (envelope ↔ glazed, nhưng railing không có phía đồ thị tương ứng); `toSolidWall` chỉ đi MỘT CHIỀU đồ thị → hình học.

**NOT FOUND: không có hàm chuyển đổi công khai đặt TÊN CHUNG kiểu "toGraphWallKind" hay hàm đảo ngược `SOLID_WALL_KIND`.** Nếu màn lớp 2 cần hiển thị `kind` hình học (`railing`) dưới dạng đồ thị, phải tự ánh xạ TRƯỜNG (không tính hình học) — ví dụ khi hiển thị badge kind trong danh sách dùng `WALL_KIND_LABELS` (đồ thị, 3 giá trị) từ `src/lib/commands/business/shared.ts:191-195`, KHÔNG dùng bộ nhãn 4 giá trị của domain hình học.

---

## E. Store (S-01/S-03) — `src/store/`

### E.1 `commit.ts` — chép nguyên (dòng 1-39)

```ts
import { useStore } from './index';
import type { SpatialPatch } from '../domain/spatial/applyPatch';

export interface CommitResult {
  undo: () => void;
  label: string;
  timestamp: number;
}

/**
 * The single gateway for all spatial data mutations.
 * Returns an object allowing undo, plus metadata for toasts.
 *
 * @param patch One patch, or an ordered batch applied as a single undo step.
 * @param label The Vietnamese label describing the action (e.g. "Xoá tường").
 */
export function commit(
  patch: SpatialPatch | readonly SpatialPatch[],
  label: string
): CommitResult {
  const store = useStore.getState();
  const timestamp = Date.now();
  store._applyPatches(Array.isArray(patch) ? patch : [patch as SpatialPatch]);
  store.setLastCommit(label, timestamp);
  return {
    undo: () => { useStore.temporal.getState().undo(); }, // zundo
    label,
    timestamp,
  };
}
```

**ĐÂY LÀ ĐƯỜNG GHI DUY NHẤT** (bất biến A10, luật `local/no-direct-set`) — component KHÔNG được gọi `store.set()` hay `store._applyPatches()` trực tiếp, chỉ được gọi `commit(patch, label)`.

**Lưu ý quan trọng:** `commit()` nhận `SpatialPatch` (từ `applyPatch.ts`), KHÔNG nhận `Command`. Để dùng lệnh nghiệp vụ (mục A) qua store, cần chuyển `Command` → `SpatialPatch[]` bằng `commandToPatches(command)` (mục B.5) trước khi gọi `commit`, HOẶC dùng đường `dispatch()` (mục B.3) độc lập với `commit` — `dispatch.ts` có `SpatialPort` riêng, không đi qua `commit()`. **Đây là hai đường ghi song song trong mã hiện có** — worker lớp 2 cần hỏi điều phối viên màn nào dùng đường nào nếu không rõ, KHÔNG tự đoán.

### E.2 Các slice — interface nguyên văn

**`spatialSlice.ts` (dòng 14-27):**
```ts
export interface SpatialSlice {
  spatial: NormalizedSpatial | null;
  spatialLoading: boolean;
  versionId: string | null;
  setSpatial: (spatial: NormalizedSpatial | null, versionId: string | null) => void;
  setSpatialLoading: (spatialLoading: boolean) => void;
  setVersionId: (versionId: string | null) => void;
  /** Mutation gateway reserved for `commit(patch, label)`; never call it from a component. */
  _applyPatches: (patches: readonly SpatialPatch[]) => void;
}
```

**`selectionSlice.ts` (dòng 4-36):**
```ts
export type SelectionLayer = 'wall' | 'door' | 'window' | 'furniture' | 'dimension' | 'room';
export type SelectionMode = 'single' | 'multiple' | 'byKind';

export interface SelectionSlice {
  selectedIds: readonly EntityId[];
  hoveredId: EntityId | null;
  selectionMode: SelectionMode;
  activeLayer: SelectionLayer | null;
  select: (id: EntityId) => void;
  deselect: (id: EntityId) => void;
  setSelection: (ids: readonly EntityId[]) => void;
  clearSelection: () => void;
  setHovered: (id: EntityId | null) => void;
  setSelectionMode: (selectionMode: SelectionMode) => void;
  setActiveLayer: (activeLayer: SelectionLayer | null) => void;
}
```

**`toolSlice.ts` (dòng 4-37):**
```ts
export type ToolKind = 'select' | 'pan' | 'drawWall' | 'placeOpening' | 'placeFurniture' | 'measure';

export interface ToolOptions {
  wallThicknessMm: Millimetres;
  wallKind: WallKind;
  snapEnabled: boolean;
  gridSizeMm: Millimetres;
}

export interface ToolSlice {
  activeTool: ToolKind;
  toolOptions: ToolOptions;
  toolInteracting: boolean;
  setActiveTool: (activeTool: ToolKind) => void;
  setToolOptions: (options: Partial<ToolOptions>) => void;
  setToolInteracting: (toolInteracting: boolean) => void;
}
```

**`historySlice.ts` (dòng 3-13):**
```ts
export interface HistoryEvent { id: string; label: string; timestamp: number; }
export interface HistorySlice {
  lastCommitLabel: string | null;
  lastCommitTimestamp: number | null;
  setLastCommit: (label: string, timestamp: number) => void;
}
```
Lưu ý: `HistorySlice` ở store KHÔNG phải ngăn xếp undo/redo thật (đó là `zundo` `temporal` + `src/lib/commands/history.ts`) — nó chỉ giữ nhãn/giờ của lượt commit gần nhất để hiện UI.

**`viewSlice.ts` (dòng 5-99, phần kiểu):**
```ts
export type ViewMode = '2d' | '3d';
export type ViewLayer = 'wall' | 'opening' | 'furniture' | 'room' | 'axis' | 'dimension' | 'note';
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 20;
export const DEFAULT_COLOR_MODE: ColoringModeId = 'default';
export function migrateColorMode(stored: unknown): ColoringModeId

export interface ViewSlice {
  zoom: number;
  viewCenter: Point;
  viewMode: ViewMode;
  hiddenLayers: readonly ViewLayer[];
  colorMode: ColoringModeId;
  setZoom: (zoom: number) => void;
  setViewCenter: (viewCenter: Point) => void;
  setViewMode: (viewMode: ViewMode) => void;
  toggleLayerVisibility: (layer: ViewLayer) => void;
  setColorMode: (colorMode: ColoringModeId) => void;
}
```

**`uiSlice.ts` (dòng 3-37):**
```ts
export type ThemeMode = 'light' | 'dark';
export type PanelSide = 'left' | 'right';
export type DialogKind = 'createProject' | 'createFloor' | 'deleteEntities' | 'publishVersion';
export const MIN_PANEL_WIDTH_PX = 240;
export const MAX_PANEL_WIDTH_PX = 640;

export interface UiSlice {
  theme: ThemeMode;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftPanelWidthPx: number;
  rightPanelWidthPx: number;
  openDialog: DialogKind | null;
  setTheme: (theme: ThemeMode) => void;
  setPanelOpen: (side: PanelSide, open: boolean) => void;
  setPanelWidth: (side: PanelSide, widthPx: number) => void;
  showDialog: (dialog: DialogKind) => void;
  closeDialog: () => void;
}
```

**`draftSlice.ts` (dòng 43-73):**
```ts
export interface EditEntityDraft {
  kind: 'editEntity';
  entityId: EntityId;
  preview: SpatialEntity; // toàn bộ entity, KHÔNG phải diff
}
export interface CreateEntityDraft {
  kind: 'createEntity';
  entity: SpatialEntity;
}
export type DraftOperation = EditEntityDraft | CreateEntityDraft;
export const draftEntityId = (operation: DraftOperation): EntityId

export interface DraftSlice {
  draftOperations: readonly DraftOperation[];
  stageDraftOperation: (operation: DraftOperation) => void;
  amendDraftOperation: (index: number, operation: DraftOperation) => void;
  discardDraft: () => void;
}
```

### E.3 `selectors.ts` — selector có ghi nhớ (memoized), signature

```ts
export interface RoomWithArea { readonly room: Room; readonly areaM2: SquareMetres; }
export const selectRoomsWithArea = (state: RootState): readonly RoomWithArea[]
export const selectTotalAreaM2 = (state: RootState): SquareMetres

export const BUILDING_VIOLATIONS_KEY = 'building';
export type ViolationsByFloor = Readonly<Record<string, readonly Violation[]>>;
export const selectViolations = (state: RootState): readonly Violation[]
export const selectViolationsByFloor = (state: RootState): ViolationsByFloor
export const selectFloorViolations = (state: RootState, levelId: LevelId): readonly Violation[]

export const selectSelectedEntities = (state: RootState): readonly SpatialEntity[]

export interface RuleRunDiagnostics { readonly evaluated: readonly RuleTask[]; readonly reusedTaskCount: number; }
export const getRuleRunDiagnostics = (): RuleRunDiagnostics | null
export const resetSelectorCaches = (): void
```
Cơ chế ghi nhớ: `memoizeLatest` (chỉ nhớ lần gọi gần nhất), `keepIfShallowEqualArray`/`keepIfShallowEqualRecord` (giữ tham chiếu cũ nếu nội dung giống hệt) — module-level cache (KHÔNG phải React hook), phải gọi `resetSelectorCaches()` giữa các test.

### E.4 `index.ts` — cách lấy store

```ts
export type RootState = ProjectSlice & SpatialSlice & DraftSlice & SelectionSlice &
  ToolSlice & ViewSlice & HistorySlice & UiSlice & PipelineSlice;

export const PERSIST_STORAGE_KEY = 'appfront-view-ui';
export const PERSIST_VERSION = 2;

export const useStore = create<RootState>()( devtools( nameActions( persist( temporal( ... ) ) ) ) );
```
Hook duy nhất: **`useStore`** (từ `zustand`), bọc `devtools` → `nameActions` → `persist` → `temporal` (zundo, `limit: 100`, chỉ theo dõi `state.spatial`). `useStore.temporal.getState().undo()`/`.redo()` là API hoàn tác của zundo — đây LÀ cơ chế `commit().undo` gọi (mục E.1). Chỉ `spatial`, `viewMode`, `zoom`, v.v. (các trường liệt kê ở `partialize`) được lưu localStorage; `openDialog` KHÔNG được lưu (dialog chặn không tự mở lại sau reload).

### E.5 CẢNH BÁO — `toolSlice.ToolKind` LỆCH với `toolMachine.ToolId`

**Xác nhận đúng, lệch 6 so với 8:**

`src/store/toolSlice.ts:5`:
```ts
export type ToolKind = 'select' | 'pan' | 'drawWall' | 'placeOpening' | 'placeFurniture' | 'measure';
```
→ **6 giá trị**.

`src/lib/tools/toolMachine.ts:84-92`:
```ts
export type ToolId =
  | 'select'
  | 'pan'
  | 'drawWall'
  | 'placeOpening'
  | 'placeFurniture'
  | 'measure'
  | 'splitWall'
  | 'annotate';
```
→ **8 giá trị**. `toolMachine.ts:79-82` tự ghi chú: "The first six match the ids the tool slice already stores... `splitWall` and `annotate` are new here." — đây là NỢ ĐÃ BIẾT, không phải lỗi gõ. Worker lớp 2 nếu cần kích hoạt tool `splitWall`/`annotate` qua store phải TỰ mở rộng `ToolKind` của `toolSlice.ts` hoặc dùng `ToolId` của `toolMachine.ts` trực tiếp (không đi qua `toolSlice`) — quyết định này nằm ngoài phạm vi khảo sát, cần hỏi điều phối viên nếu màn cần cả `splitWall`/`annotate`.

---

## F. Dữ liệu máy chủ (R-64) — `src/lib/query/`, `src/lib/mutations/`, `src/api/`

### F.1 `queryKeys.ts` — chép nguyên các nhánh liên quan (space, floor, drawing, version, progress; kèm các nhánh khác cùng file)

```ts
export type QueryKey = readonly unknown[];

export const queryKeys = {
  drawing: {
    byFloor: /* (floorId: string) => readonly ['drawing', 'byFloor', string] */
  },
  floor: {
    detail: /* (floorId: string) => readonly ['floor', 'detail', string] */
    list: /* (projectId: string) => readonly ['floor', 'list', string] */
  },
  library: { detail: /* (libraryItemId) */, list: /* () */ },
  progress: {
    byFloor: /* (floorId: string) => readonly ['progress', 'byFloor', string] */
  },
  project: { detail: /* (projectId) */, list: /* () */, members: /* (projectId) */ },
  quality: {
    assessment: /* (floorId: string) => readonly ['quality', 'assessment', string] */
  },
  room: {
    byFloor: /* (floorId: string) => readonly ['room', 'byFloor', string] */
  },
  space: {
    byFloor: /* (floorId: string) => readonly ['space', 'byFloor', string] */
  },
  user: { current: /* () */, list: /* () */ },
  version: {
    byFloor: /* (floorId: string) => readonly ['version', 'byFloor', string] */
  },
  violation: {
    byProject: /* (projectId: string) => readonly ['violation', 'byProject', string] */
  },
} as const;
```
Mỗi factory (`queryKeys.drawing.byFloor(id)` v.v.) trả về mảng đã `Object.freeze`; và có `.root()` trả về `[domain, branch]` không kèm tham số — dùng để invalidate rộng hơn.

**NOT FOUND: không có nhánh `wall` riêng trong `queryKeys`** — dữ liệu tường nằm trong `space.byFloor` / `room.byFloor` (xem `invalidation.ts` bên dưới).

### F.2 `cachePolicy.ts` — export + signature

```ts
export const CACHE_POLICY_TIERS = ['default', 'static', 'aiProgress', 'spatialDraft'] as const;
export type CachePolicyTier = (typeof CACHE_POLICY_TIERS)[number];

export interface CachePolicyEntry { staleTime: number; gcTime: number; }
export interface ResolvedCachePolicy extends CachePolicyEntry { tier: CachePolicyTier; }

export const CACHE_POLICY = {
  default: { gcTime: 600_000, staleTime: 30_000 },
  branches: { static: 300_000, aiProgress: 0, spatialDraft: 10_000 },
  retry: { query: 1, mutation: 0 },
} as const;

export function listCachePolicyDefaults(): ReadonlyArray<{ queryKey: QueryKey } & ResolvedCachePolicy>
export function resolveCachePolicyTier(queryKey: QueryKey): CachePolicyTier
export function resolveCachePolicy(queryKey: QueryKey): ResolvedCachePolicy
```
`drawing`, `room`, `space` → tier `spatialDraft` (staleTime 10s); `library`, `user` → `static` (300s); `progress` → `aiProgress` (staleTime 0, luôn coi là cũ).

### F.3 `invalidation.ts` — chép nguyên (đặc biệt `editWall`)

```ts
export const WRITE_OPERATIONS = [
  'createProject', 'editFloor', 'editWall', 'moveFurniture', 'editDimension',
  'changeAxis', 'rerunRules', 'restoreVersion', 'straightenDrawing', 'setDrawingCorners',
] as const;
export type WriteOperation = (typeof WRITE_OPERATIONS)[number];

interface FloorScopedParams { projectId: string; floorId: string; }
export interface WriteOperationParamsMap {
  createProject: Record<string, never>;
  editFloor: FloorScopedParams;
  editWall: FloorScopedParams;
  moveFurniture: FloorScopedParams;
  editDimension: FloorScopedParams;
  changeAxis: FloorScopedParams;
  rerunRules: FloorScopedParams;
  restoreVersion: FloorScopedParams;
  straightenDrawing: FloorScopedParams;
  setDrawingCorners: FloorScopedParams;
}

export const invalidationMap: InvalidationMap = {
  // ...
  editWall: ({ projectId, floorId }) => [
    queryKeys.space.byFloor(floorId),
    queryKeys.room.byFloor(floorId),
    queryKeys.violation.byProject(projectId),
  ],
  // ...
};

export function applyInvalidation<TOperation extends WriteOperation>(
  queryClient: QueryClient,
  operation: TOperation,
  params: WriteOperationParamsMap[TOperation],
): void
```
`editWall` làm mất hiệu lực ĐÚNG BA khoá: `space.byFloor`, `room.byFloor`, `violation.byProject` — KHÔNG đụng `drawing.byFloor` (ảnh gốc không đổi khi sửa tường).

### F.4 `prefetch.ts`, `queryClient.ts` — export + signature

```ts
// prefetch.ts
export interface PrefetchOnHoverHandlers { onPointerEnter: () => void; onPointerLeave: () => void; }
export function prefetchOnHover<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  fetcher: QueryFunction<TData>,
  delayMs = 200,
): PrefetchOnHoverHandlers

// queryClient.ts
export function normalizeQueryError(error: unknown): AppError
export function createQueryClient(overrides: DefaultOptions = {}): QueryClient
export const queryClient = createQueryClient(); // instance dùng chung toàn app
```

### F.5 `mutations/createOptimisticMutation.ts` — chép nguyên signature + kiểu options

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
Mutation cùng `entityId` được xếp hàng tuần tự qua `runExclusive` (`entityQueue.ts`) — không chạy chồng.

### F.6 `mutations/undoTicket.ts` — chép nguyên (D-05, 8000 ms)

```ts
/**
 * How long an undo stays available: invariant A8's eight seconds.
 */
export const UNDO_WINDOW_MS = 8000;

export type UndoTicketStatus = 'active' | 'expired' | 'used';
export type UndoTicketError = 'expired';

export interface CreateUndoTicketOptions {
  description: string;
  now?: () => number;
  ttlMs?: number;
  undo: () => void;
}

export interface UndoTicket {
  description: string;
  expiresAt: number;
  getStatus: () => UndoTicketStatus;
  id: string;
  undo: () => Result<void, UndoTicketError>;
}

export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket
```

### F.7 `mutations/notificationBus.ts`, `coalesce.ts`, `entityQueue.ts`, `flushPolicy.ts` — export + signature

```ts
// notificationBus.ts
export interface NotificationInput { description: string; title: string; type: string; undoTicket?: UndoTicket | undefined; }
export interface Notification { createdAt: number; description: string; id: string; title: string; type: string; undoTicket?: UndoTicket | undefined; }
export type NotificationListener = (notifications: readonly Notification[]) => void;
export interface CreateNotificationBusOptions { groupWindowMs?: number; maxVisible?: number; now?: () => number; }
export interface NotificationBus { list: () => readonly Notification[]; publish: (input: NotificationInput) => void; subscribe: (listener: NotificationListener) => () => void; }
export function createNotificationBus(options: CreateNotificationBusOptions = {}): NotificationBus

// coalesce.ts
export const COALESCE_WINDOW_MS = 400;
export interface Command<TValue> { kind: string; previousValue: TValue; targetId: string; timestamp: number; value: TValue; }
export interface CoalescedCommand<TValue> { kind: string; mergedCount: number; previousValue: TValue; targetId: string; timestamp: number; value: TValue; }
export function coalesce<TValue>(commands: readonly Command<TValue>[], windowMs: number = COALESCE_WINDOW_MS): CoalescedCommand<TValue>[]

// entityQueue.ts
export type EntityQueueTask<TResult> = () => Promise<TResult>;
export function runExclusive<TResult>(entityId: string, task: EntityQueueTask<TResult>): Promise<TResult>

// flushPolicy.ts
export interface CreateFlushPolicyOptions<TValue> { idleMs?: number; maxQueueSize?: number; onFlush: (commands: readonly CoalescedCommand<TValue>[]) => void; windowMs?: number; }
export interface FlushPolicy<TValue> { changeFloor: () => void; enqueue: (command: Command<TValue>) => void; flush: () => void; }
export function createFlushPolicy<TValue>(options: CreateFlushPolicyOptions<TValue>): FlushPolicy<TValue>
```

**Cách bắn toast hoàn tác:** `NotificationBus.publish({ ..., undoTicket })` — nếu `undoTicket` có giá trị, toast hiện nút "Hoàn tác" và tự biến mất khi `ticket.expiresAt` tới (được `createNotificationBus`'s `scheduleRemoval` hẹn giờ). Nhiều publish cùng `type` trong `groupWindowMs` (mặc định 5000 ms) được GỘP thành một toast, vé hoàn tác gộp (`buildGroupedTicket`) hoàn TẤT CẢ theo thứ tự ngược (`[...tickets].reverse()`).

### F.8 `src/api/endpoints.ts` — chép nguyên nhánh spatial

```ts
export const API_BASE_PATH = '/api';

export const ENDPOINTS = {
  auth: { login: `${AUTH_ROOT}/login`, register: `${AUTH_ROOT}/register` },
  drawings: { chunk, complete, initUpload, progress }, // (projectId, uploadId/floorId) => string
  featureFlags: { read: FEATURE_FLAGS_ROOT },
  floors: { create, delete, list, reorder },
  projects: { create, delete, list, read, update },
  quality: {
    assess: (projectId: string, floorId: string): string => `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/quality`,
    corners: (projectId: string, floorId: string): string => `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/quality/corners`,
    straighten: (projectId: string, floorId: string): string => `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/quality/straighten`,
  },
  spatial: {
    floor: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/spatial`,
    version: (projectId: string, versionId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/versions/${versionId}`,
  },
} as const;
```

**NOT FOUND: không có endpoint riêng cho tường** (không có `ENDPOINTS.wall.*` hay tương tự). Bằng chứng: `ENDPOINTS` chỉ có bảy nhóm khoá (`auth, drawings, featureFlags, floors, projects, quality, spatial`), và `spatial` chỉ có `floor`/`version`, không có `wall`. Sửa tường đi qua `spatial.floor(projectId, floorId)` (PATCH toàn bộ dữ liệu không gian của tầng) — xem `src/api/__mocks__/client.ts` `spatial.patchFloor`.

### F.9 `src/api/__mocks__/client.ts` — cách một màn lấy dữ liệu giả trong test/story

`createMockApiClient()` (và instance sẵn `mockApiClient`, cùng alias `createApiClientMock`) trả về một `ApiClient` đầy đủ (cùng shape với client thật ở `src/api/client.ts`), có state nội bộ (project/floors/qualityFloors) và các hàm `async ({...}) => ok(...)` cho từng nhóm: `auth`, `drawings`, `featureFlags`, `floors`, `projects`, `quality`, `spatial` (`patchFloor`, `readFloor`, `readVersion`). Dữ liệu mẫu lấy từ `SAMPLE_BUILDING`/`SAMPLE_TOTAL_AREA_M2` (`@/domain/spatial/__fixtures__/sampleBuilding` — bộ mẫu chuẩn A14: 34 phòng, 248,60 m²) và `MOCK_SPATIAL_PROJECT` (`../../mocks/spatial`). Một màn/story dùng client giả bằng cách truyền `createMockApiClient()` vào chỗ màn nhận `ApiClient` (qua context/props — không thấy DI framework nào khác trong phạm vi khảo sát).

---

## G. Tự lưu (D-07)

### G.1 CẢNH BÁO BẮT BUỘC — CÓ HAI HỆ THỐNG TỰ LƯU KHÁC NHAU trong repo

**Hệ 1 — `src/hooks/useAutosave.ts`** (chép nguyên toàn văn, dòng 1-49):

```ts
import { useEffect, useState, useRef } from 'react';
import type { RootState } from '../store';
import { useStore } from '../store';
import { formatClockTime } from '../lib/format/datetime';

/**
 * Invariant A7: there is no save button, and the system saves 800 ms after the
 * last edit. This is the invariant itself, not a movement — it must never be
 * pulled onto the motion ladder.
 */
const AUTOSAVE_DEBOUNCE_MS = 800;

export function useAutosave(onSave: (data: RootState['spatial']) => Promise<void>) {
  const spatial = useStore((state) => state.spatial);
  const [saveLabel, setSaveLabel] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!spatial) return;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); }
    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave(spatial);
        const now = new Date();
        setSaveLabel(`Đã lưu lúc ${formatClockTime(now)}`);
      } catch (err) {
        console.error('Autosave failed', err);
        setSaveLabel('Lưu thất bại');
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => { if (timeoutRef.current) { clearTimeout(timeoutRef.current); } };
  }, [spatial, onSave]);

  return saveLabel;
}
```
Hằng **800 ms** (A7) là `AUTOSAVE_DEBOUNCE_MS`. Đây là hook TỰ VIẾT `useState`/`useEffect`/`setTimeout` tay, đọc thẳng `state.spatial` từ store, KHÔNG có retry, KHÔNG có phát hiện offline, trả về MỘT chuỗi `saveLabel` (`string | null`).

**Hệ 2 — `src/lib/autosave/createAutosave.ts` (thuần, không React) + `src/hooks/useSaveIndicator.ts` (bọc React):**

`src/lib/autosave/createAutosave.ts:3-198` (chữ ký):
```ts
export type AutosaveState = 'dirty' | 'failed' | 'offline' | 'saved' | 'saving';

export interface CreateAutosaveOptions<TChanges> {
  debounceMs?: number;      // mặc định DEFAULT_DEBOUNCE_MS = 800
  getChanges: () => TChanges | undefined;
  isOnline?: () => boolean;
  maxWaitMs?: number;       // mặc định DEFAULT_MAX_WAIT_MS = 5_000
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

export function createAutosave<TChanges>(options: CreateAutosaveOptions<TChanges>): Autosave
```
Máy trạng thái đầy đủ: debounce 800 ms mặc định, KHÔNG để thay đổi liên tục trì hoãn lưu quá `maxWaitMs` (5000 ms), retry theo `retrySchedule.ts` (5s/15s/45s) khi lưu lỗi, chuyển `offline` khi mất mạng (kiểm tra lại mỗi 5000 ms).

`src/hooks/useSaveIndicator.ts:8-128` (chữ ký):
```ts
export interface SaveIndicatorResult { detail: string; label: string; state: AutosaveState; }
export interface UseSaveIndicatorOptions { now?: () => number; tickIntervalMs?: number; announcer?: Announcer; }

export function useSaveIndicator(autosave: Autosave, options: UseSaveIndicatorOptions = {}): SaveIndicatorResult
```
Đây LÀ nguồn cho "Đã lưu lúc 14:32" ở thanh trạng thái — `buildSavedResult` nội bộ dùng `formatClockTime` + `viMessages.common.saved_at` khi ≤ `SAVED_RELATIVE_THRESHOLD_MS` (60 000 ms), sau đó chuyển sang tương đối ("Đã lưu N phút trước") qua `viMessages.autosave.savedRelative`. `useSaveIndicator` là READ-ONLY view lên một instance `Autosave` có sẵn (không tự tạo) — component cha phải tự `createAutosave(...)` và truyền vào.

**Kết luận cho worker lớp 2:** `useAutosave` (Hệ 1) và `useSaveIndicator` + `createAutosave` (Hệ 2) là HAI CƠ CHẾ ĐỘC LẬP, không gọi lẫn nhau. `useSaveIndicator.ts` không đọc `useAutosave.ts` và ngược lại. Nếu màn cần thanh trạng thái "Đã lưu lúc..." đầy đủ 7 trạng thái (kể cả `offline`/`failed`) thì dùng Hệ 2 (`createAutosave` + `useSaveIndicator`); nếu chỉ cần một debounce 800 ms đơn giản gắn thẳng vào `state.spatial` thì Hệ 1 đã có sẵn. **Không tự trộn hai hệ — hỏi điều phối viên màn đang cần hệ nào nếu đặc tả không nói rõ.**

---

## H. Viewmodel (A15, A4, A5) — `src/lib/viewmodel/`

### H.1 `types.ts` — chép nguyên

```ts
export const VIEW_STATUS_CODES = ['verified', 'attention', 'violation', 'neutral'] as const;
export type ViewStatusCode = (typeof VIEW_STATUS_CODES)[number];

export const VIEW_ICON_CODES = [
  'wallLoadBearing', 'wallPartition', 'wallEnvelope',
  'openingDoor', 'openingWindow', 'room',
  'violationCritical', 'violationWarning', 'violationSuggestion',
] as const;
export type ViewIconCode = (typeof VIEW_ICON_CODES)[number];

export interface ViewAttribute {
  readonly label: string;
  readonly value: string;   // đã format sẵn, KHÔNG bao giờ là số
  readonly unit?: string;   // 'mm' | 'm' | 'm²' | '%'; VẮNG MẶT khi không có đơn vị
}

export interface ViewModel {
  readonly id: string;
  readonly label: string;
  readonly secondaryLine: string;
  readonly attributes: readonly ViewAttribute[];
  readonly statusCode: ViewStatusCode;
  readonly iconCode: ViewIconCode;
}

export type ViewModelInput =
  | { readonly kind: 'wall'; readonly wall: Wall }
  | { readonly kind: 'opening'; readonly opening: Opening }
  | { readonly kind: 'room'; readonly room: Room }
  | { readonly kind: 'violation'; readonly violation: Violation };

export type ViewModelKind = ViewModelInput['kind'];
```

### H.2 `toViewModel.ts` — chép nguyên các hàm được yêu cầu

```ts
export function toWallViewModel(wall: Wall): ViewModel
export function toOpeningViewModel(opening: Opening): ViewModel
export function toRoomViewModel(room: Room): ViewModel
export function toViolationViewModel(violation: Violation): ViewModel
export function toViewModel(input: ViewModelInput): ViewModel
export function toViewModels(inputs: readonly ViewModelInput[]): ViewModel[]

export const UNNAMED_ROOM_LABEL = 'Phòng chưa đặt tên';
export const VIOLATION_ID_SEPARATOR = ':';
```

### H.3 CÂU HỎI TRỌNG YẾU — hằng ngưỡng độ tin cậy 0,75

**Grep đã chạy lại** trong đúng ba thư mục điều phối viên chỉ định:

```
$ grep -rn "0\.75\|0,75" src/lib/viewmodel/ src/lib/coloring/ src/domain/
src/domain/openings/__tests__/reflow.test.ts:286:      door('2', '1', 0.75),
src/domain/openings/__tests__/reflow.test.ts:295:      door('2', '1', 0.75),
src/domain/quality/thresholds.ts:95: * Từ 0,75 trở lên, nét mảnh nhất trên bản vẽ vẫn sống sót qua bước nhị phân
src/domain/quality/thresholds.ts:98: * 0,75 nghĩa là mực chỉ đi được một phần tư quãng đường về phía trắng giấy. Với
src/domain/quality/thresholds.ts:103:export const CONTRAST_GOOD_SCORE = 0.75;
```

**Giải thích từng kết quả — KHÔNG cái nào là ngưỡng độ tin cậy của thực thể:**
1. `openings/__tests__/reflow.test.ts:286,295` — `door('2', '1', 0.75)` là toạ độ THỬ NGHIỆM (vị trí tương đối của một cửa trong test fixture), không phải hằng số ngưỡng.
2. `src/domain/quality/thresholds.ts:103` — `CONTRAST_GOOD_SCORE = 0.75` là ngưỡng **độ tương phản ẢNH ĐẦU VÀO** (đo mực/giấy khi quét bản vẽ, dùng ở khâu đánh giá chất lượng ảnh T-05/`quality`), HOÀN TOÀN KHÁC với "độ tin cậy AI" (`confidence` trên từng thực thể `Wall/Opening/Room`). Đây KHÔNG nằm trong `src/lib/viewmodel/` hay `src/lib/coloring/`, và về ý nghĩa nghiệp vụ nó đo chất lượng ẢNH chứ không đo độ tin của một đối tượng đã dò ra.

**NOT FOUND: không có hằng ngưỡng 0,75 ở đâu trong mã dùng để phân loại độ tin cậy của thực thể (wall/opening/room).**

**Quyết định đã duyệt (KHÔNG viết số 0,75 vào màn — R-71):** màn lấy trạng thái từ `toWallViewModel(wall).statusCode` (một trong bốn: `verified | attention | violation | neutral`), KHÔNG tự tính ngưỡng, KHÔNG đọc `wall.confidence` rồi so sánh số trong component.

### H.4 Logic `toWallViewModel` ánh xạ `reviewed -> verified` (A5) — chép nguyên

`src/lib/viewmodel/toViewModel.ts:204-226`:
```ts
/**
 * Which of the four codes an entity of the graph asks for.
 *
 * `verified` comes from `reviewed` and from nothing else. The graph only lets a
 * person set that flag — AI output must never set it — so invariant A5 holds by
 * construction here: an AI result at 99% confidence is `neutral`, never green.
 *
 * Everything below AI-certain is `attention`, because an unapproved reading the
 * model is unsure about is exactly what a reviewer is looking for. `violation`
 * is reserved for a broken rule and is never derived from a score.
 */
function reviewStatus(review: ReviewMetadata): ViewStatusCode {
  if (review.reviewed) {
    return 'verified';
  }
  return confidenceLevel(review.confidence) === 'certain' ? 'neutral' : 'attention';
}

/** The confidence reading every graph entity carries. */
function confidenceAttribute(review: ReviewMetadata): ViewAttribute {
  return ratioAttribute('Độ tin cậy', review.confidence);
}
```
`confidenceLevel` đến từ `@/lib/format/semantic` (import ở `toViewModel.ts:53`) — đây là nơi DUY NHẤT có logic phân loại "certain"/không, KHÔNG phải một hằng số `0.75` bị chép tay ở viewmodel. `toWallViewModel` (dòng 312-327) gọi `reviewStatus(wall)` làm `statusCode` và `confidenceAttribute(wall)` là MỘT trong các `attributes` (nhãn "Độ tin cậy", đơn vị `%`) — số này CHỈ để HIỂN THỊ, không dùng để tô màu ngoài qua `statusCode`.

---

## I. Hình học tường (M-03/M-04/M-05) — `src/domain/walls/`, `src/domain/units/`

### I.1 `joints.ts` — chép nguyên các kiểu/hàm yêu cầu

```ts
export const DEFAULT_JOINT_THRESHOLD_MM: Millimetres = millimetres(50);
export type JointKind = 'corner' | 'tee' | 'cross';
export type JointId = `J-${string}`;

export interface WallEndRef { readonly wallId: WallId; readonly end: WallEnd; }
export interface JointMember extends WallEndRef { readonly bearingDeg: Degrees; }
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
  readonly outline: readonly PointMm[]; // đóng, ngược kim đồng hồ, ≥4 đỉnh, KHÔNG lặp đỉnh đầu ở cuối
  readonly startJointId: JointId | null;
  readonly endJointId: JointId | null;
}
export interface ResolveWallShapesResult {
  readonly shapes: readonly WallShape[];
  readonly joints: readonly Joint[];
  readonly unresolved: readonly UnresolvedJoint[];
}

export function resolveJoints(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): ResolveJointsResult

export function resolveWallShapes(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): ResolveWallShapesResult
```
`resolveWallShapes` là **nguồn DUY NHẤT** của đa giác tường để vẽ canvas (docblock `joints.ts:14`: "So the ends are welded first, and only then is the shape of each wall worked out"). Cả hai hàm `@throws RangeError` nếu tường không dùng được (dày ngoài 60–600 mm, dài 0, top ≤ base) và `@throws Error` nếu hai tường trùng id.

### I.2 `edit.ts` — chép nguyên

```ts
export const MIN_WALL_LENGTH_MM: Millimetres = millimetres(30);
export const MAX_MERGE_ANGLE_DEG: Degrees = degrees(2);

export type SplitRefusal = 'pointOffWall' | 'pieceTooShort';
export type SplitWallResult =
  | { readonly ok: true; readonly walls: readonly [Wall, Wall] }
  | { readonly ok: false; readonly reason: SplitRefusal };

export type MergeRefusal =
  | 'sameWall' | 'kindMismatch' | 'thicknessMismatch'
  | 'elevationMismatch' | 'angleTooWide' | 'tooFarApart';
export type MergeWallsResult =
  | { readonly ok: true; readonly wall: Wall; readonly removedId: WallId }
  | { readonly ok: false; readonly reason: MergeRefusal };

export interface SplitWallOptions { readonly minPieceLengthMm?: Millimetres; }
export interface MergeWallsOptions { readonly maxAngleDeg?: Degrees; readonly maxStrayMm?: Millimetres; }

export function wallBearing(wall: Wall): Degrees
export function orientationDifference(first: Wall, second: Wall): Degrees // trong [0, 90]

export function splitWall(
  wall: Wall,
  at: PointMm,
  secondId: WallId,
  options: SplitWallOptions = {},
): SplitWallResult

export function mergeWalls(
  first: Wall,
  second: Wall,
  options: MergeWallsOptions = {},
): MergeWallsResult

export function overlapAlongLine(first: Wall, second: Wall): Millimetres
```
Gộp CHỈ khi: cùng `kind`, cùng `thicknessMm`, cùng dải cao độ (`baseElevationMm`/`topElevationMm`), lệch phương < `maxAngleDeg` (mặc định 2°). Tường kết quả giữ id của tường dài hơn (`chooseAnchor`), hai đầu ngoài cùng giữ NGUYÊN VẸN toạ độ.

### I.3 `cleanup.ts` — chép nguyên

```ts
export const CLEANUP_THRESHOLDS = {
  sliverLengthMm: MIN_WALL_LENGTH_MM,       // = 30 mm
  weldGapMm: millimetres(100),
  straightenAngleDeg: degrees(1.5),
  mergeOverlapMm: millimetres(80),
} as const;

export const STANDARD_THICKNESSES_MM: readonly Millimetres[] = [100, 150, 200, 220, 300, 400].map(
  (value) => millimetres(value),
);

export const THICKNESS_SUGGESTION_LIMIT_MM: Millimetres = millimetres(15);

export type CleanupStep = 'removeSliver' | 'weldGap' | 'straighten' | 'mergeOverlap';
export type CleanupChangeId = `C-${string}`;

export interface CleanupChange {
  readonly id: CleanupChangeId;
  readonly step: CleanupStep;
  readonly pass: number;
  readonly message: string; // tiếng Việt
  readonly wallIds: readonly WallId[];
  readonly before: readonly Wall[];
  readonly after: readonly Wall[];
  readonly position: number;
}

export interface ThicknessSuggestion {
  readonly wallId: WallId;
  readonly currentMm: Millimetres;
  readonly suggestedMm: Millimetres;
  readonly differenceMm: Millimetres;
  readonly message: string;
}

export interface CleanupResult {
  readonly walls: readonly Wall[];
  readonly log: readonly CleanupChange[];
  readonly thicknessSuggestions: readonly ThicknessSuggestion[]; // KHÔNG BAO GIỜ tự áp — người dùng quyết
}

export interface CleanupOptions {
  readonly sliverLengthMm?: Millimetres;
  readonly weldGapMm?: Millimetres;
  readonly straightenAngleDeg?: Degrees;
  readonly mergeOverlapMm?: Millimetres;
}

export function nearestStandardThickness(
  thicknessMm: Millimetres,
  limitMm: Millimetres = THICKNESS_SUGGESTION_LIMIT_MM,
): Millimetres | null

export function suggestStandardThickness(
  walls: readonly Wall[],
  limitMm: Millimetres = THICKNESS_SUGGESTION_LIMIT_MM,
): readonly ThicknessSuggestion[]

export function cleanupWalls(walls: readonly Wall[], options: CleanupOptions = {}): CleanupResult

export function canUndoCleanupChange(walls: readonly Wall[], change: CleanupChange): boolean
export function undoCleanupChange(walls: readonly Wall[], change: CleanupChange): readonly Wall[] | null
```
`STANDARD_THICKNESSES_MM` (100/150/200/220/300/400 mm) và `nearestStandardThickness` là **nguồn cho bộ lọc "chỉ hiện độ dày không chuẩn"**: một tường có độ dày KHÔNG nằm trong tập này (và có gợi ý chuẩn gần trong `THICKNESS_SUGGESTION_LIMIT_MM` = 15 mm) là ứng viên của bộ lọc đó.

### I.4 `types.ts` (`domain/walls/`) — chép nguyên

```ts
export type WallKind = 'loadBearing' | 'partition' | 'railing' | 'glazed';
export const WALL_KINDS: readonly WallKind[] = ['loadBearing', 'partition', 'railing', 'glazed'];
export const MIN_WALL_THICKNESS_MM: Millimetres = millimetres(60);
export const MAX_WALL_THICKNESS_MM: Millimetres = millimetres(600);

export interface WallCentreline { readonly start: PointMm; readonly end: PointMm; }
export interface Wall {
  readonly id: WallId;
  readonly kind: WallKind;
  readonly centreline: WallCentreline;
  readonly thicknessMm: Millimetres;
  readonly baseElevationMm: Millimetres;
  readonly topElevationMm: Millimetres;
}

export type WallEnd = 'start' | 'end';
export const WALL_ENDS: readonly WallEnd[] = ['start', 'end'];

export function isThicknessInRange(thicknessMm: Millimetres): boolean
export function endPoint(wall: Wall, end: WallEnd): PointMm
export function centrelineLength(wall: Wall): Millimetres
export function verticalRangesOverlap(first: Wall, second: Wall): boolean
export function assertUsableWall(wall: Wall): void // @throws RangeError
```

### I.5 `src/domain/units/` — chép nguyên

**`snap.ts`:**
```ts
export type AnchorKind = 'wallVertex' | 'intersection' | 'midpoint';
export type SnapTargetKind = AnchorKind | 'perpendicular' | 'grid';
export interface SnapSegment { readonly start: PointMm; readonly end: PointMm; }
export type SnapTarget =
  | { readonly kind: AnchorKind; readonly id: string; readonly position: PointMm }
  | { readonly kind: 'perpendicular'; readonly id: string; readonly segment: SnapSegment };
export interface SnapResult {
  readonly point: PointMm;
  readonly kind: SnapTargetKind | null;
  readonly targetId: string | null;
  readonly distanceMm: Millimetres;
  readonly snapped: boolean;
}

export const SNAP_THRESHOLDS = {
  gridStepMm: millimetres(50),
  angleStepDeg: degrees(15),
  captureRadiusMm: millimetres(120),
} as const;

export const SNAP_PRIORITY: readonly SnapTargetKind[] = ['wallVertex', 'intersection', 'midpoint', 'perpendicular', 'grid'];

export function snapToGrid(point: PointMm, stepMm: Millimetres = SNAP_THRESHOLDS.gridStepMm, enabled = true): PointMm
export function snapAngle(angle: Degrees, stepDeg: Degrees = SNAP_THRESHOLDS.angleStepDeg, enabled = true): Degrees
export function distanceBetween(first: PointMm, second: PointMm): Millimetres
export function perpendicularFoot(point: PointMm, segment: SnapSegment): PointMm | null

export interface SnapToTargetsOptions {
  readonly captureRadiusMm?: Millimetres;
  readonly gridEnabled?: boolean;
  readonly gridStepMm?: Millimetres;
  readonly disabledKinds?: readonly SnapTargetKind[];
}
export function snapToTargets(
  point: PointMm,
  targets: readonly SnapTarget[],
  options: SnapToTargetsOptions = {},
): SnapResult
```

**`types.ts`:**
```ts
export type Millimetres = Quantity<'mm'>;
export function millimetres(value: number): Millimetres // @throws RangeError nếu không hữu hạn — CỔNG DUY NHẤT để gắn nhãn mm
export const MILLIMETRES_PER_METRE = 1000;
```
(Chỉ trích những gì mục I yêu cầu — file còn có `Metres`, `Degrees`, `Radians`, `Pixels`, `MillimetresPerPixel`, `roundMeasurement`, v.v. đã đọc nhưng không nằm trong danh sách bắt buộc.)

**`compare.ts`:**
```ts
export interface PointMm { readonly x: Millimetres; readonly y: Millimetres; }
export function compareNearly(first: number, second: number, epsilon = DEFAULT_EPSILON): -1 | 0 | 1
```
(`DEFAULT_EPSILON = 0.001` mm — dung sai tuyệt đối, KHÔNG tương đối.)

### I.6 Định dạng số / quy đổi đơn vị — `MILLIMETRES_PER_METRE` và `src/lib/format/`

`MILLIMETRES_PER_METRE = 1000` — khai ở `src/domain/units/types.ts:55` (mục I.5 trên).

**`src/lib/format/number.ts` — chép nguyên phần công khai:**
```ts
export const MISSING_VALUE = '—';
export type MaybeNumber = number | null | undefined;

export interface NumberFormatOptions {
  readonly fractionDigits?: number;
  readonly maxFractionDigits?: number;
  readonly grouping?: boolean; // mặc định true — chấm ngăn nghìn
}

export type PercentSource = 'ratio' | 'percent';
export interface PercentFormatOptions {
  readonly fractionDigits?: number;
  readonly maxFractionDigits?: number;
  readonly source?: PercentSource;
}

export function isFormattable(value: MaybeNumber): value is number
export function formatNumber(value: MaybeNumber, options: NumberFormatOptions = {}): string
export function formatPercent(value: MaybeNumber, options: PercentFormatOptions = {}): string
export function parseNumber(text: string): number | undefined
```
Dùng `Intl.NumberFormat('vi-VN')` — dấu CHẤM ngăn nghìn, dấu PHẨY thập phân (đúng như A15 yêu cầu).

**`src/lib/format/measure.ts` — chép nguyên phần công khai:**
```ts
export type LengthDisplayUnit = 'mm' | 'm';
export const METRE_THRESHOLD_MM = MILLIMETRES_PER_METRE; // = 1000

export interface LengthFormatOptions { readonly unit?: LengthDisplayUnit; readonly fractionDigits?: number; }
export interface MeasureFormatOptions { readonly fractionDigits?: number; }

export const A3_SHORT_EDGE_MM = 297;

export function formatLength(valueMm: MaybeNumber, options: LengthFormatOptions = {}): string
export function formatArea(areaM2: MaybeNumber, options: MeasureFormatOptions = {}): string
export function formatAngle(angleDeg: MaybeNumber, options: MeasureFormatOptions = {}): string
export function formatScaleDensity(millimetresPerPixel: MaybeNumber, options: NumberFormatOptions = {}): string
export function formatDrawingScaleRatio(millimetresPerPixel: MaybeNumber, shortEdgePx: MaybeNumber): string
```

**Hàm nào format ra `"4.250,00 mm"`:** gọi `formatLength(4250, { unit: 'mm', fractionDigits: 2 })`. Cơ chế: `formatLength` ép đơn vị `'mm'` (bỏ qua auto-chọn theo ngưỡng `METRE_THRESHOLD_MM`), rồi gọi `formatNumber(4250, { fractionDigits: 2 })` → `"4.250,00"` (dấu chấm ngăn nghìn, dấu phẩy 2 số lẻ) rồi nối hậu tố `" mm"`. Mặc định (không truyền `unit`), `formatLength(4250)` sẽ TỰ CHỌN đơn vị mét (vì `4250 ≥ METRE_THRESHOLD_MM = 1000`) và trả `"4,25 m"` — muốn ra đúng chuỗi `"4.250,00 mm"` PHẢI truyền `unit: 'mm'` tường minh.

---

## J. Bàn phím (I-01) và công cụ (S-08)

### J.1 `src/lib/input/shortcutRegistry.ts` — chép nguyên các kiểu/hàm yêu cầu

```ts
export type ShortcutScope = 'dialog' | 'sidePanel' | 'canvas' | 'global';
export const SCOPE_PRIORITY: readonly ShortcutScope[] = ['dialog', 'sidePanel', 'canvas', 'global'];

export interface ParsedCombo { readonly code: ShortcutCode; readonly mod: boolean; readonly alt: boolean; readonly shift: boolean; }
export function parseCombo(combo: string): ParsedCombo // Ctrl/Cmd/Meta/Control -> mod=true; Tab bị CẤM (throw)
export function formatCombo(parsed: ParsedCombo): string // 'Mod+Shift+Z'

export interface ShortcutKeyEvent {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  readonly repeat?: boolean;
  preventDefault?(): void;
}

export interface ShortcutDefinition {
  readonly id: string;
  readonly combo: string;
  readonly scope: ShortcutScope;
  readonly description?: string;
  readonly allowRepeat?: boolean;
  readonly preventDefault?: boolean;
  onTrigger(event: ShortcutKeyEvent): void;
}

export interface ShortcutOverlap { readonly scope: ShortcutScope; readonly combo: string; readonly registrantIds: readonly string[]; }
export interface ShortcutListenerTarget {
  addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
}

export interface ShortcutRegistry {
  register(definition: ShortcutDefinition): () => void;
  claimScope(scope: ShortcutScope): () => void;
  handleKeyDown(event: ShortcutKeyEvent, target: ShortcutTarget | null): boolean;
  attach(target: ShortcutListenerTarget): () => void;
  findOverlaps(): readonly ShortcutOverlap[];
  reportOverlaps(): readonly ShortcutOverlap[];
}

export interface ShortcutRegistryOptions { readonly isDev?: boolean; warn?(message: string): void; }

export function createShortcutRegistry(options: ShortcutRegistryOptions = {}): ShortcutRegistry

export interface GlobalShortcutHandlers {
  undo(): void;
  redo(): void;
  save(): void;
  openSearch(): void;
  openShortcutHelp(): void;
  closeTopLayer(): void;
}

export const buildGlobalShortcuts = (handlers: GlobalShortcutHandlers): readonly ShortcutDefinition[]
export const registerGlobalShortcuts = (registry: ShortcutRegistry, handlers: GlobalShortcutHandlers): (() => void)

/** Registry dùng chung toàn app; component KHÔNG được attach() thẳng vào window — dùng useShortcut/useShortcutListener. */
export const appShortcutRegistry: ShortcutRegistry = createShortcutRegistry();
```
Quy tắc arbitration: **thứ tự ưu tiên `dialog > sidePanel > canvas > global`**; chỉ `dialog` là MODAL (nuốt hết phím nó không bind, TRỪ `Escape` luôn xuyên xuống `global.closeTopLayer`).

### J.2 `src/lib/input/dragDrop.ts` — liệt kê export

```ts
export interface DragLibraryItem { readonly kind: FurnitureKind; readonly widthMm: number; readonly depthMm: number; readonly label: string; }
export type DragMode = 'pointer' | 'keyboard';
export const KEYBOARD_STEP_MM = 50;
export type NudgeDirection = 'left' | 'right' | 'up' | 'down';
export interface DragSession { readonly item: DragLibraryItem; readonly id: FurnitureId; readonly centre: Point; readonly mode: DragMode; readonly dropAllowed: boolean; readonly blockReasons: readonly string[]; }
export type DragDropState = { readonly phase: 'idle' } | { readonly phase: 'dragging'; readonly session: DragSession };
export const IDLE_DRAG_STATE: DragDropState;
export type DragDropEvent = { type: 'start'; item: DragLibraryItem; at: Point; mode: DragMode } | { type: 'move'; at: Point } | { type: 'nudge'; direction: NudgeDirection } | { type: 'drop' } | { type: 'cancel' };
export interface FurnitureDropRequest { readonly type: typeof OPENING_COMMAND_TYPES.addFurniture; readonly input: AddFurnitureInput; }
export interface DragDropDeps { readonly levelId: LevelId; readonly nextId: () => FurnitureId; readonly validateDrop: (input: AddFurnitureInput) => readonly string[]; }
export interface DragDropTransition { readonly state: DragDropState; readonly request: FurnitureDropRequest | null; }
export const boxAround = (centre: Point, widthMm: number, depthMm: number): BoundingBox
export const snapToStepMm = (value: number, stepMm: number = KEYBOARD_STEP_MM): number
export function reduceDragDrop(state: DragDropState, event: DragDropEvent, deps: DragDropDeps): DragDropTransition
export const dragGhost = (state: DragDropState): ToolPreview | null
export function dragEventForKey(key: string): DragDropEvent | null // Enter->drop, Escape->cancel, Arrow*->nudge
export function dragStatusText(state: DragDropState): string | null
```
Liên quan phím: kéo-thả dùng `Enter`/`Escape`/mũi tên — KHÔNG dùng chuột-only, và các phím này CHIẾM DỤNG trong lúc một phiên kéo đang chạy (consumer tự chặn không cho lan tới `shortcutRegistry`).

### J.3 `src/hooks/useShortcut.ts` — chép nguyên các hook + kiểu options

```ts
export interface UseShortcutOptions { readonly registry?: ShortcutRegistry; readonly enabled?: boolean; }
export function useShortcut(definition: ShortcutDefinition, options: UseShortcutOptions = {}): void

export interface UseShortcutScopeOptions { readonly registry?: ShortcutRegistry; readonly active?: boolean; }
export function useShortcutScope(scope: ShortcutScope, options: UseShortcutScopeOptions = {}): void

export function useGlobalShortcuts(
  handlers: GlobalShortcutHandlers,
  options: Pick<UseShortcutOptions, 'registry'> = {},
): void

export function useShortcutListener(options: Pick<UseShortcutOptions, 'registry'> = {}): void
```
Cơ chế "lease": listener `window.addEventListener('keydown', …)` DUY NHẤT toàn app, được giữ sống bằng đếm tham chiếu (mỗi hook `useShortcut`/`useShortcutScope`/`useGlobalShortcuts`/`useShortcutListener` đang mount giữ +1, unmount thì -1, về 0 thì gỡ).

### J.4 `src/lib/tools/toolMachine.ts` — chép nguyên các kiểu/hàm yêu cầu

```ts
export type ToolId =
  | 'select' | 'pan' | 'drawWall' | 'placeOpening' | 'placeFurniture' | 'measure'
  | 'splitWall' | 'annotate';

export const TOOL_IDS = [
  'select', 'pan', 'drawWall', 'placeOpening', 'placeFurniture', 'measure', 'splitWall', 'annotate',
] as const satisfies readonly ToolId[];

export type ToolPhase = 'ready' | 'drawing' | 'confirming';
export const TOOL_PHASES = ['ready', 'drawing', 'confirming'] as const satisfies readonly ToolPhase[];
export const TOOL_PHASE_LABELS: Readonly<Record<ToolPhase, string>>; // { ready: 'sẵn sàng', drawing: 'đang vẽ', confirming: 'xác nhận' }

export interface ToolSettings {
  readonly wallThicknessMm: number;
  readonly wallHeightMm: number;
  readonly wallKind: WallKind;
  readonly openingKind: OpeningKind;
  readonly openingWidthMm: number;
  readonly openingHeightMm: number;
  readonly openingSillHeightMm: number;
  readonly openingSwing: SwingDirection;
  readonly furnitureKind: FurnitureKind;
  readonly furnitureWidthMm: number;
  readonly furnitureDepthMm: number;
  readonly furnitureRotationDeg: number;
}
export const DEFAULT_TOOL_SETTINGS: ToolSettings; // wallThicknessMm:110, wallHeightMm:2800, wallKind:'partition', openingKind:'door', openingWidthMm:900, openingHeightMm:2200, openingSillHeightMm:0, openingSwing:'left', furnitureKind:'table', furnitureWidthMm:1200, furnitureDepthMm:700, furnitureRotationDeg:0

export interface ToolContext {
  readonly levelId: LevelId;
  readonly settings: ToolSettings;
  readonly nextId: <K extends EntityKind>(kind: K) => IdByKind[K];
}

export interface ToolBuild {
  readonly values: readonly ToolInputValue[];
  readonly hoverAt: Point | null;
  readonly draftId: EntityId | null;
  readonly context: ToolContext;
}

export interface ToolDefinition {
  readonly id: ToolId;
  readonly label: string;
  readonly description: string;
  readonly steps: readonly ToolStep[];
  readonly creates: EntityKind | null;
  readonly preview: (build: ToolBuild) => ToolPreview | null;
  readonly complete: (build: ToolBuild) => ToolOutcome | null;
}
export type ToolRegistry = Readonly<Record<ToolId, ToolDefinition>>;

export interface ToolMachineState {
  readonly tool: ToolId;
  readonly phase: ToolPhase;
  readonly values: readonly ToolInputValue[];
  readonly hoverAt: Point | null;
  readonly draftId: EntityId | null;
  readonly preview: ToolPreview | null;
  readonly pending: ToolOutcome | null;
}
export const createToolState = (tool: ToolId): ToolMachineState

export type ToolEvent =
  | { readonly type: 'activate'; readonly tool: ToolId }
  | { readonly type: 'input'; readonly value: ToolInputValue }
  | { readonly type: 'hover'; readonly at: Point }
  | { readonly type: 'commit' }
  | { readonly type: 'cancel' };

export interface ToolTransition { readonly state: ToolMachineState; readonly outcome: ToolOutcome | null; readonly discarded: boolean; }
export interface ToolDeps { readonly tools: ToolRegistry; readonly context: ToolContext; }

export const pendingStep = (state: ToolMachineState, tools: ToolRegistry): ToolStep | null

export function reduceTool(state: ToolMachineState, event: ToolEvent, deps: ToolDeps): ToolTransition
```

### J.5 CẢNH BÁO — tool nối/merge

**NOT FOUND: không có tool "nối/merge" trong `ToolId`/`TOOLS`.** Grep xác nhận:
```
$ grep -n "'merge'\|mergeWall" src/lib/tools/toolMachine.ts src/lib/tools/tools.ts
(không có kết quả nào khớp id tool)
```
Có `splitWall` (id `'splitWall'`, `label: 'cắt'`) trong cả `ToolId` và `TOOLS`, nhưng KHÔNG có tool tương ứng cho `wall.merge`. Nối tường là **hành động theo VÙNG CHỌN** (chọn hai tường rồi gọi `createMergeWallsCommand` từ mục A trực tiếp qua một nút/phím trên thanh công cụ vùng chọn), **KHÔNG phải một chế độ công cụ (`ToolDefinition`)** — không có bước "1 điểm"/"1 tường" nào trong `toolMachine` cho việc gộp.

### J.6 `src/lib/tools/tools.ts` — bảng 8 tool + phím đã đăng ký

```ts
export const TOOLS: ToolRegistry = {
  select: SELECT_TOOL, pan: PAN_TOOL, drawWall: DRAW_WALL_TOOL,
  placeOpening: PLACE_OPENING_TOOL, placeFurniture: PLACE_FURNITURE_TOOL,
  measure: MEASURE_TOOL, splitWall: SPLIT_WALL_TOOL, annotate: ANNOTATE_TOOL,
};
export const toolById = (id: ToolId): ToolDefinition => TOOLS[id];
```

`src/lib/tools/shortcuts.ts` — **BẢNG PHÍM ĐÃ ĐĂNG KÝ** (chép nguyên, dòng 81-90, 124-147):
```ts
export const TOOL_SHORTCUTS: Readonly<Record<ToolId, ShortcutCode>> = {
  select: 'V',
  pan: 'H',
  drawWall: 'W',
  placeOpening: 'D',
  placeFurniture: 'F',
  measure: 'M',
  splitWall: 'X',
  annotate: 'G',
};

export type ToolModifier = 'lockAxis' | 'suspendSnap' | 'panOverride';
export const MODIFIER_SHORTCUTS: readonly ModifierShortcut[] = [
  { modifier: 'lockAxis',    code: 'SHIFT', keyLabel: 'Shift',      label: 'khoá phương', ... },
  { modifier: 'suspendSnap', code: 'ALT',   keyLabel: 'Alt',        label: 'tạm tắt bắt điểm', ... },
  { modifier: 'panOverride', code: 'SPACE', keyLabel: 'Phím cách',  label: 'tạm chuyển sang di chuyển khung nhìn', ... },
];

export const RESERVED_KEYS: readonly ShortcutCode[] = ['ESCAPE', 'ENTER', 'TAB'];
```
`buildGlobalShortcuts` (mục J.1) còn chiếm: `Ctrl+Z` (undo), `Ctrl+Shift+Z` (redo), `Ctrl+S` (save), `Ctrl+F` (search), `?` (bảng phím), `Escape` (đóng lớp trên).
`dragDrop.ts` (mục J.2) còn chiếm `Enter`/`Escape`/4 phím mũi tên TRONG LÚC một phiên kéo-thả đang chạy.

**BẢNG ĐỐI CHIẾU 12 phím task yêu cầu kiểm (V, W, M, J, K, Enter, Backspace, Space, F, 1, 2, 3, Ctrl+Z):**

| Phím | Đã bị chiếm bởi | Ghi chú |
|---|---|---|
| `V` | Tool `select` (`TOOL_SHORTCUTS.select`) | ĐỤNG nếu màn mới gán `V` cho việc khác |
| `W` | Tool `drawWall` | ĐỤNG |
| `M` | Tool `measure` | ĐỤNG |
| `J` | **KHÔNG AI CHIẾM** | grep toàn `src/` không thấy `combo`/`TOOL_SHORTCUTS`/`MODIFIER_SHORTCUTS` nào dùng `J` |
| `K` | **KHÔNG AI CHIẾM** | như trên, `K` tự do |
| `Enter` | `RESERVED_KEYS` (cấm gán cho tool) + `dragDrop.dragEventForKey` dùng làm `drop` khi đang kéo-thả | KHÔNG được `parseCombo`/tool nào bind `Enter` làm phím tắt tool; nhưng vẫn có nghĩa cố định trong luồng kéo-thả và trong `toolMachine` là phím "xác nhận" theo quy ước ngầm (không phải binding cứng, do màn tự lắng nghe) |
| `Backspace` | **KHÔNG AI CHIẾM** — không tìm thấy trong `shortcuts.ts`, `shortcutRegistry.ts`, `dragDrop.ts`, `useShortcut.ts` | Grep xác nhận (xem dưới) |
| `Space` | Modifier `panOverride` (giữ để tạm pan) | ĐỤNG nếu màn cần `Space` làm phím bấm một lần (vd mở/đóng) — `Space` ở đây là HELD, không phải PRESSED |
| `F` | Tool `placeFurniture` | ĐỤNG |
| `1`, `2`, `3` | **KHÔNG AI CHIẾM** | không có trong `TOOL_SHORTCUTS`, `MODIFIER_SHORTCUTS`, `RESERVED_KEYS`, hay `buildGlobalShortcuts` |
| `Ctrl+Z` | `global.undo` (`buildGlobalShortcuts`, scope `global`) | ĐỤNG — đừng gán lại |

**Grep chứng minh J/K/Backspace/1/2/3 tự do:**
```
$ grep -rn "combo:.*['\"]J['\"]\|combo:.*['\"]K['\"]\|combo:.*Backspace\|combo:.*['\"]1['\"]\|combo:.*['\"]2['\"]\|combo:.*['\"]3['\"]" src/ --include="*.ts" --include="*.tsx"
(không có kết quả)
$ grep -rln "'Backspace'\|\"Backspace\"" src/ --include="*.ts" --include="*.tsx"
(không có kết quả)
```

### J.7 `src/lib/tools/shortcutTable.ts` — bảng phím cho màn trợ giúp

```ts
export type ShortcutSectionId = 'tools' | 'modifiers';
export const SHORTCUT_SECTION_LABELS: Readonly<Record<ShortcutSectionId, string>>; // { tools: 'công cụ', modifiers: 'phím bổ trợ' }
export type ShortcutSubject = { readonly kind: 'tool'; readonly tool: ToolId } | { readonly kind: 'modifier'; readonly modifier: ToolModifier };
export interface ShortcutRow { readonly id: string; readonly code: ShortcutCode; readonly keyLabel: string; readonly action: string; readonly description: string; readonly subject: ShortcutSubject; }
export interface ShortcutSection { readonly id: ShortcutSectionId; readonly title: string; readonly rows: readonly ShortcutRow[]; }

export function buildShortcutTable(tools: ToolRegistry = TOOLS): readonly ShortcutSection[]
export const SHORTCUT_TABLE: readonly ShortcutSection[] = buildShortcutTable();
export const shortcutRows = (table: readonly ShortcutSection[] = SHORTCUT_TABLE): readonly ShortcutRow[]
export const shortcutRowFor = (code: ShortcutCode, table: readonly ShortcutSection[] = SHORTCUT_TABLE): ShortcutRow | null
```
Toàn bộ hàng của bảng phím trợ giúp SINH TỰ ĐỘNG từ `TOOL_SHORTCUTS` + định nghĩa tool (`tools.ts`) + `MODIFIER_SHORTCUTS` — không có bảng phím thứ hai để chép tay/sai lệch.

---

## K. Vùng chọn (S-10/S-11) — `src/lib/selection/`

### K.1 `selectionOps.ts` — chép nguyên

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
export const selectableKindOf = (id: EntityId): SelectableKind | null
export const isSelectable = (id: EntityId, context: SelectionContext): boolean
export const selectableIds = (context: SelectionContext): EntityId[]

export const isSelected = (selection: Selection, id: EntityId): boolean
export const selectSingle = (selection: Selection, id: EntityId, context: SelectionContext): Selection
export const toggleSelection = (selection: Selection, id: EntityId, context: SelectionContext): Selection
export const selectAllOfKind = (selection: Selection, kind: SelectableKind, context: SelectionContext): Selection
export const invertSelection = (selection: Selection, context: SelectionContext): Selection
export const clearSelection = (selection: Selection): Selection
export const combineSelection = (
  selection: Selection,
  ids: readonly EntityId[],
  mode: SelectionCombine,
  context: SelectionContext,
): Selection
```
Mọi hàm là pure `(selection, …, context) -> selection`; không đổi gì thì trả LẠI CHÍNH mảng cũ (===) để tránh re-render thừa.

### K.2 `marquee.ts` — chép nguyên

```ts
export type MarqueeMode = 'window' | 'crossing';
export interface Marquee { readonly start: Point; readonly end: Point; }

export const marqueeMode = (marquee: Marquee): MarqueeMode // end.x >= start.x -> 'window', ngược lại 'crossing'
export const marqueeBox = (marquee: Marquee): BoundingBox

export const marqueeHits = (marquee: Marquee, context: SelectionContext): EntityId[]
export const applyMarquee = (
  selection: Selection,
  marquee: Marquee,
  combine: SelectionCombine,
  context: SelectionContext,
): Selection
```
`window` (kéo trái→phải): chỉ bắt đối tượng NẰM TRỌN trong khung. `crossing` (kéo phải→trái): bắt mọi đối tượng CHẠM khung (kể cả bao trọn khung).

### K.3 `syncChannel.ts` — chép nguyên

```ts
export interface SelectionEvent {
  readonly target: SyncTarget;
  readonly selection: Selection;
  readonly detail: SelectionDetail;
  readonly reveal: RevealRequest | null;
  readonly coalesced: number;
}
export type SelectionListener = (event: SelectionEvent) => void;
export type FrameHandle = number;

export interface FrameScheduler { schedule(run: () => void): FrameHandle; cancel(handle: FrameHandle): void; }
export const defaultFrameScheduler: FrameScheduler; // requestAnimationFrame, fallback setTimeout(...,0)

export interface CreateSelectionChannelOptions { scheduler?: FrameScheduler; }
export interface SelectionChannel {
  subscribe: (target: SyncTarget, listener: SelectionListener) => () => void;
  reportVisible: (target: SyncTarget, ids: readonly EntityId[]) => void;
  push: (selection: Selection) => void;
  flush: () => void;
  dispose: () => void;
}

export function createSelectionChannel(options: CreateSelectionChannelOptions = {}): SelectionChannel
```
Đây LÀ cơ chế S-11 đồng bộ hai chiều canvas ↔ danh sách: `push()` gom NHIỀU thay đổi trong một frame thành MỘT publish (`coalesced` đếm số lần gộp); `reportVisible()` là kênh MỘT CHIỀU vào (không bao giờ publish) — cấu trúc này khiến vòng lặp thông báo (list → canvas → scene → list) KHÔNG THỂ hình thành.

### K.4 `revealPolicy.ts` — chép nguyên

```ts
export type SyncTarget = 'canvas2d' | 'scene3d' | 'list';
export const SYNC_TARGETS: readonly SyncTarget[] = Object.freeze(['canvas2d', 'scene3d', 'list']);
export const SUMMARY_THRESHOLD = 500;

export type KindCounts = Readonly<Record<SelectableKind, number>>;
export type SelectionDetail = { readonly mode: 'full' } | { readonly mode: 'summary'; readonly countsByKind: KindCounts };
export interface RevealRequest { readonly target: SyncTarget; readonly id: EntityId; }
export type VisibleByTarget = Partial<Readonly<Record<SyncTarget, readonly EntityId[]>>>;

export const countByKind = (selection: Selection): KindCounts
export const describeSelection = (selection: Selection): SelectionDetail // > SUMMARY_THRESHOLD (500) -> 'summary'
export const revealAnchor = (selection: Selection): EntityId | null // id CUỐI CÙNG trong selection (mới chọn nhất)

export const planReveals = (
  selection: Selection,
  detail: SelectionDetail,
  visible: VisibleByTarget,
): RevealRequest[]
```
Đây LÀ nguồn cho "hàng tương ứng cuộn vào tầm nhìn": `planReveals` trả về danh sách target CẦN di chuyển (target nào CHƯA thấy `revealAnchor` trong `visible[target]`), target nào đã thấy thì để yên (tránh giật màn hình). Selection > 500 đối tượng (`summary` mode) thì KHÔNG yêu cầu ai di chuyển — không có hàng để cuộn tới khi danh sách đã gộp thành số đếm.

---

## NOT FOUND — những thứ đặc tả nói có mà mã không có

1. **Lệnh duyệt tường (`wall.approve`) trong `WALL_COMMAND_TYPES`.**
   ```
   $ grep -n -i "approve\|duyệt" src/lib/commands/business/wallCommands.ts src/lib/commands/business/shared.ts
   src/lib/commands/business/shared.ts:20: *   entity is authored by a person and not yet approved — `reviewed: false` —
   ```
   Chỉ là một dòng docblock giải thích, không phải lệnh. → Cách thay thế: mục C.2.

2. **Hằng ngưỡng độ tin cậy `0,75` để phân loại trạng thái xem (verified/attention/…) trong `src/lib/viewmodel/`, `src/lib/coloring/`, `src/domain/`.**
   ```
   $ grep -rn "0\.75\|0,75" src/lib/viewmodel/ src/lib/coloring/ src/domain/
   src/domain/openings/__tests__/reflow.test.ts:286:      door('2', '1', 0.75),
   src/domain/openings/__tests__/reflow.test.ts:295:      door('2', '1', 0.75),
   src/domain/quality/thresholds.ts:95: * Từ 0,75 trở lên, nét mảnh nhất trên bản vẽ vẫn sống sót qua bước nhị phân
   src/domain/quality/thresholds.ts:98: * 0,75 nghĩa là mực chỉ đi được một phần tư quãng đường về phía trắng giấy. Với
   src/domain/quality/thresholds.ts:103:export const CONTRAST_GOOD_SCORE = 0.75;
   ```
   Hai dòng đầu là dữ liệu THỬ NGHIỆM (không phải hằng số), ba dòng cuối là `CONTRAST_GOOD_SCORE` — ngưỡng ĐỘ TƯƠNG PHẢN ẢNH ĐẦU VÀO, khác hoàn toàn "độ tin cậy thực thể". → Quyết định: mục H.3, dùng `toWallViewModel(wall).statusCode`.

3. **Hàm chuyển đổi công khai, có tên riêng, giữa `Wall` (đồ thị) và `Wall` (hình học) — kiểu "toGraphWallKind"/"fromSolidWallKind".**
   ```
   $ grep -rn "toGraphWall\|fromSolidWall\|graphWallFrom\|solidWallKindToGraph" src/
   (không có kết quả)
   ```
   Chỉ có `toSolidWall`/`withCentrelineOf` (một chiều đồ thị → hình học, `src/lib/commands/business/shared.ts:307,320`, ĐÃ EXPORT) và bản đồ nội bộ KHÔNG export `SOLID_WALL_KIND` (`shared.ts:291-295`). → Xem mục D.6.

4. **Endpoint API riêng cho tường (`ENDPOINTS.wall.*`).**
   ```
   $ grep -n "wall" src/api/endpoints.ts
   (không có kết quả nào trong ENDPOINTS — chỉ có auth/drawings/featureFlags/floors/projects/quality/spatial)
   ```
   Sửa tường đi qua `ENDPOINTS.spatial.floor(projectId, floorId)`. → Xem mục F.8.

5. **Tool "nối/merge" trong `ToolId`/`TOOLS`.**
   ```
   $ grep -n "'merge'\|mergeWall" src/lib/tools/toolMachine.ts src/lib/tools/tools.ts
   (không có kết quả nào đặt tên tool 'merge')
   ```
   Nối tường là hành động theo vùng chọn (gọi `createMergeWallsCommand` trực tiếp), không phải một `ToolDefinition`. → Xem mục J.5.

6. **Phím tắt cho `J`, `K`, `Backspace`, `1`, `2`, `3`.**
   ```
   $ grep -rn "combo:.*['\"]J['\"]\|combo:.*['\"]K['\"]\|combo:.*Backspace\|combo:.*['\"]1['\"]\|combo:.*['\"]2['\"]\|combo:.*['\"]3['\"]" src/ --include="*.ts" --include="*.tsx"
   (không có kết quả)
   $ grep -rln "'Backspace'\|\"Backspace\"" src/ --include="*.ts" --include="*.tsx"
   (không có kết quả)
   ```
   Sáu phím này CHƯA bị chiếm bởi tool, modifier, phím toàn cục hay `RESERVED_KEYS` — an toàn để màn lớp 2 tự gán, miễn không trùng `RESERVED_KEYS = ['ESCAPE', 'ENTER', 'TAB']`. → Xem bảng đối chiếu ở mục J.6.

---

## Bổ sung — hai lưu ý không nằm trong khung A–K nhưng ảnh hưởng trực tiếp lớp 2

- **Store có HAI ĐƯỜNG GHI song song trong mã hiện có**: `commit(patch, label)` (nhận `SpatialPatch[]`, mục E.1) và `dispatch(command, deps)` (nhận `Command`, dùng `SpatialPort` riêng, mục B.3). Cả hai đều tồn tại thật trong mã, không phải một trong hai là NOT FOUND — nhưng chúng KHÔNG tự động nối với nhau (không có glue code `dispatch` → `commit` hay ngược lại trong phạm vi các file đã đọc). Nếu màn lớp 2 dùng lệnh nghiệp vụ (mục A/C) để đổi dữ liệu, phải tự quyết định gọi qua `dispatch()` (đầy đủ 5 bước, có rule/sync) hay chuyển `Command` → patches (`commandToPatches`) rồi gọi `commit()` (đơn giản hơn, có `useStore.temporal` hoàn tác qua zundo) — **hỏi điều phối viên nếu đặc tả màn không nói rõ**.
- **Hai hệ tự lưu độc lập** (`useAutosave.ts` vs `createAutosave.ts`+`useSaveIndicator.ts`) — xem mục G.1. Không trộn.
