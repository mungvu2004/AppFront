# S-15 / T2 — Hợp đồng tầng lệnh, hoàn tác và trạng thái cho bốn lệnh trục

Khảo sát chỉ đọc, nhánh `mungvu2004/s15-t2-hopdong-lenh` (dựa trên `master`). Người đọc
tài liệu này không có repo trong ngữ cảnh — mọi thứ dưới đây là mã CHÉP NGUYÊN VĂN, kèm
`đường-dẫn:dòng`. Kết luận chốt ở đầu:

**KẾT LUẬN**: Không có lệnh trục nào có sẵn (`axis.add` / `axis.move` / `axis.remove` /
`axis.setOrigin`) và R-68 cấm thêm file vào `src/lib`. `CommandType` là `string` MỞ —
không phải union đóng — và `validateCommands` không so `command.type` với bất kỳ bảng cho
phép nào (chỉ đòi khác rỗng). Vì vậy phương án A (dựng bốn lệnh trục TRONG CỔNG CỦA MÀN
bằng `createCommand` + `changeForUpdate`/`changeForAdd`/`changeForRemove`, đúng khuôn
`wall.approve` của `wallLayerReviewGateway.ts`) là HỢP LỆ về mặt kiểu và về validate. `Axis`
đã là một `EntityKind` có sẵn trong `src/domain/spatial` (prefix id `A-`), nên bốn lệnh
trục không cần một kiểu miền mới nào — chỉ cần bốn hàm dựng `Command` trong file cổng của
màn S-15.

---

## A. `src/lib/commands/createCommand.ts`

```ts
// dòng 18-28
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

// dòng 36-41
export const changeForAdd = <K extends EntityKind>(kind: K, entity: EntityByKind[K]): EntityChangeOfKind<K> => ({
  kind,
  id: idOfEntity(entity),
  before: null,
  after: entity,
});

// dòng 44-49
export const changeForRemove = <K extends EntityKind>(kind: K, entity: EntityByKind[K]): EntityChangeOfKind<K> => ({
  kind,
  id: idOfEntity(entity),
  before: entity,
  after: null,
});

// dòng 52-62
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

// dòng 128-142
export const createCommand = (input: CommandInput): Command => {
  for (const change of input.changes) {
    assertChangeIsInvertible(change);
  }

  return {
    id: input.id ?? createCommandId(),
    type: input.type,
    timestamp: input.timestamp ?? new Date().toISOString(),
    actorId: input.actorId,
    description: input.description,
    changes: [...input.changes],
    scope: deriveScope(input.changes),
  };
};
```

Không có `changeForCreate`/`changeForDelete` — tên thật là `changeForAdd` (before=null) và
`changeForRemove` (after=null), cả hai tại `createCommand.ts:36-49`.

**Ảnh chụp before/after: ĐẦY ĐỦ, không phải diff.** `changeForUpdate` (dòng 52-62) nhận
NGUYÊN hai bản ghi `EntityByKind[K]` đầy đủ (`before`, `after`), không phải một tập trường
đã đổi. Đây là điều kiện duy nhất khiến `invertCommand` (mục D) hoán đổi được hai ảnh chụp
mà không cần biết ngữ nghĩa của lệnh — xem chú thích đầu file `types.ts:1-8`: *"each change
records the FULL snapshot of the entity before and after, never a partial diff"*.

`assertChangeIsInvertible` (dòng 65-75, gọi trong `createCommand`) ném lỗi ngay tại chỗ dựng
nếu một `change` có cả `before` và `after` đều `null`, hoặc nếu id của snapshot khác id của
`change`. Bốn lệnh trục phải tuân theo: `axis.add` dùng `changeForAdd`, `axis.remove` dùng
`changeForRemove`, `axis.move`/`axis.setOrigin` dùng `changeForUpdate`.

---

## B. `src/lib/commands/types.ts`

```ts
// dòng 25
export type CommandId = `C-${string}`;

// dòng 31 — MỞ, không phải union đóng
export type CommandType = string;

// dòng 43-48
export interface EntityChangeOfKind<K extends EntityKind> {
  kind: K;
  id: IdByKind[K];
  before: EntityByKind[K] | null;
  after: EntityByKind[K] | null;
}

// dòng 54-56
export type EntityChange = {
  [K in EntityKind]: EntityChangeOfKind<K>;
}[EntityKind];

// dòng 62-66
export interface CommandScope {
  entityIds: readonly EntityId[];
  levelIds: readonly LevelId[];
  kinds: readonly EntityKind[];
}

// dòng 75-86
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

**Câu trả lời dứt khoát cho câu hỏi "union đóng hay string mở":** `CommandType = string`
(dòng 31), một alias trần trụi, không phải `'wall.move' | 'wall.delete' | ...`. Bình luận
đầu file (`types.ts:27-31`) tự mô tả nó là *"a short dot-separated English verb phrase, for
example `wall.move` or `room.rename`"* — quy ước đặt tên, không phải danh sách đóng.

`validateCommands` (`dispatch.ts:220-328`, xem mục C) **không hề so `command.type` với một
bảng cho phép nào**. Dòng duy nhất kiểm `type` là:

```ts
// dispatch.ts:249-251
if (!isFilled(command.type)) {
  rejectCommand('thiếu loại lệnh.');
}
```

`isFilled` (dòng 207) chỉ đòi chuỗi khác rỗng sau `trim()`. Không có `Set`/`Record` nào liệt
kê các `CommandType` hợp lệ trong toàn bộ `dispatch.ts`. Cái DUY NHẤT bị kiểm theo một bảng
cho phép là **`change.kind`** — dòng 279 kiểm `KNOWN_KINDS.has(change.kind)`, và
`KNOWN_KINDS` (dòng 205) là `new Set(Object.keys(ID_PREFIX_BY_KIND))`, tức bảy kind sẵn có
trong `src/domain/spatial/ids.ts` — `axis` đã nằm trong đó (xem mục J.1 / phần cuối). Vì vậy
một `CommandType` tuỳ ý như `'axis.add'`, `'axis.move'`, `'axis.remove'`,
`'axis.setOrigin'` đi qua `validateCommands` không vướng gì, **miễn là `change.kind`
là một trong bảy kind đã biết** — đúng điều kiện `axis` đã thoả.

Đây chính là câu trả lời "phương án A có hợp lệ không": **CÓ**, vì không có bảng
`CommandType` nào để đối chiếu.

---

## C. `src/lib/commands/dispatch.ts`

```ts
// dòng 64
export type DispatchStage = 'validate' | 'apply' | 'history' | 'rules' | 'sync';

// dòng 72-78
export const DISPATCH_STAGES = [
  'validate',
  'apply',
  'history',
  'rules',
  'sync',
] as const satisfies readonly DispatchStage[];

// dòng 81-87
export const DISPATCH_STAGE_LABELS: Readonly<Record<DispatchStage, string>> = {
  validate: 'kiểm hợp lệ',
  apply: 'áp vào dữ liệu',
  history: 'đẩy vào ngăn xếp hoàn tác',
  rules: 'chạy lại luật liên quan',
  sync: 'xếp hàng đồng bộ',
};
```

Năm bước THẬT (tên hàm/khối mã, không phải chỉ nhãn):

1. **validate** — `validateCommands(input.commands, before)` gọi tại `dispatch.ts:576`,
   hàm định nghĩa tại `dispatch.ts:220-328`.
2. **apply** — vòng lặp `deps.spatial.applyPatches(commandToPatches(command))` tại
   `dispatch.ts:584-601`.
3. **history** — `deps.history.push(entry)` tại `dispatch.ts:605-626`, `entry` dựng từ
   `DispatchBatch` + `undoPatchesOf(input.commands)`.
4. **rules** — `deps.rules.run(after, staleEntities)` rồi `deps.rules.write(...)` tại
   `dispatch.ts:628-668`.
5. **sync** — `await deps.sync.enqueue(batch)` tại `dispatch.ts:670-681`.

Toàn bộ nằm trong `runCommandPipeline` (`dispatch.ts:468-684`), gọi từ `dispatch()`
(`dispatch.ts:700-704`, khoá `runExclusive(SPATIAL_PIPELINE_KEY, ...)`) hoặc từ
`runTransaction()` (`transaction.ts:53-63`, cùng khoá).

### Bốn cổng (ports)

```ts
// dòng 94
export type UndoEntryId = `U-${string}`;

// dòng 97-105
export interface DispatchBatch {
  readonly id: UndoEntryId;
  /** Vietnamese label for the undo toast, e.g. `Xoá tường`. */
  readonly label: string;
  /** Applied in array order. */
  readonly commands: readonly Command[];
  /** Creation time as an ISO 8601 string. */
  readonly timestamp: string;
}

// dòng 113-115
export interface UndoEntry extends DispatchBatch {
  readonly undoPatches: readonly SpatialPatch[];
}

// dòng 124-129
export interface SpatialPort {
  /** The graph as it is now; `null` before a floor has been loaded. */
  read: () => NormalizedSpatial | null;
  /** Applies patches in order, as one step. */
  applyPatches: (patches: readonly SpatialPatch[]) => void;
}

// dòng 132-136
export interface HistoryPort {
  push: (entry: UndoEntry) => void;
  /** Removes an entry again when a later step fails. Unknown ids are ignored. */
  drop: (entryId: UndoEntryId) => void;
}

// dòng 145-148
export interface RulesPort {
  run: (graph: NormalizedSpatial, changes: readonly ChangedEntity[]) => RuleRunResult;
  write: (result: RuleRunResult) => void;
}

// dòng 151-153
export interface SyncPort {
  enqueue: (batch: DispatchBatch) => MaybePromise<void>;
}

// dòng 156-163
export interface DispatchDeps {
  readonly spatial: SpatialPort;
  readonly history: HistoryPort;
  readonly rules: RulesPort;
  readonly sync: SyncPort;
  /** Clock for the batch timestamp; the wall clock when left out. */
  readonly now?: () => string;
}
```

### Kết quả

```ts
// dòng 170-175
export interface RollbackIssue {
  readonly stage: DispatchStage;
  readonly message: string;
  readonly cause: unknown;
}

// dòng 177-190
export interface DispatchFailure {
  readonly stage: DispatchStage;
  readonly message: string;
  readonly reasons: readonly string[];
  readonly cause: unknown;
  readonly rolledBack: boolean;
  readonly rollbackIssues: readonly RollbackIssue[];
}

// dòng 192-197
export interface DispatchSuccess {
  readonly entry: UndoEntry;
  readonly rules: RuleRunResult;
}

// dòng 199
export type DispatchResult = Result<DispatchSuccess, DispatchFailure>;
```

### `validateCommands` — chữ ký đầy đủ

```ts
// dòng 220
export function validateCommands(commands: readonly Command[], graph: NormalizedSpatial): string[]

// dòng 331-333
export function validateCommand(command: Command, graph: NormalizedSpatial): string[] {
  return validateCommands([command], graph);
}
```

Trả về mảng câu tiếng Việt (rỗng = hợp lệ). Không so `command.type` với bảng — xem mục B.
Có kiểm: id lệnh bắt đầu `"C-"` (245-247), `type`/`actorId`/`description`/`timestamp` khác
rỗng, `changes` không rỗng, `change.kind` thuộc `KNOWN_KINDS`, `change.id` đúng dạng của
`change.kind` (qua `isIdOfKind`, dòng 285), snapshot không cả hai `null`, snapshot mang đúng
id của change, `scope.entityIds`/`scope.kinds` phủ đủ mọi change (dòng 305-307 — chính là lý
do `createCommand` phải tự tính `scope` bằng `deriveScope`, không được truyền tay), và tính
nhất quán tồn tại/không tồn tại của entity so với đồ thị + đúng kind.

### `createIncrementalRuleRunner` — chữ ký đầy đủ

```ts
// dòng 395-400
export interface IncrementalRuleRunnerOptions {
  readonly registry?: RuleRegistry;
  readonly onResult?: (result: RuleRunResult) => void;
}

// dòng 409-422
export function createIncrementalRuleRunner(options: IncrementalRuleRunnerOptions = {}): RulesPort {
  let state: RuleRunState = EMPTY_RUN_STATE;

  return {
    run: (graph, changes) =>
      options.registry === undefined
        ? runRules(graph, { previous: state, changes })
        : runRules(graph, { registry: options.registry, previous: state, changes }),
    write: (result) => {
      state = result.state;
      options.onResult?.(result);
    },
  };
}
```

Nằm trong `dispatch.ts` (không phải module khác).

### `dispatch()` — chữ ký đầy đủ

```ts
// dòng 692
export const SPATIAL_PIPELINE_KEY = 'spatial-command-pipeline';

// dòng 700-704
export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult> {
  return runExclusive(SPATIAL_PIPELINE_KEY, () =>
    runCommandPipeline({ commands: [command], label: command.description }, deps),
  );
}
```

`dispatch` nhận đúng MỘT `Command`; `runTransaction` (mục D) nhận một mảng.

---

## D. `src/lib/commands/history.ts` và `invert.ts`

### `history.ts`

```ts
// dòng 41
export const MAX_HISTORY_STEPS = 100;

// dòng 50-53, 56
export interface SelectionSnapshot {
  readonly selectedIds: readonly EntityId[];
}
export const NO_SELECTION: SelectionSnapshot = { selectedIds: [] };

// dòng 61-79
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

// dòng 82-88
export interface HistoryPushInput {
  readonly entry: UndoEntry;
  readonly selectionBefore: SelectionSnapshot;
  readonly selectionAfter: SelectionSnapshot;
}

// dòng 91-98
export interface HistoryTransition {
  readonly direction: HistoryDirection;
  readonly step: HistoryStep;
  readonly patches: readonly SpatialPatch[];
  readonly selection: SelectionSnapshot;
}

// dòng 100-128
export interface HistoryStack {
  push: (input: HistoryPushInput) => HistoryStep;
  undo: () => HistoryTransition | null;
  redo: () => HistoryTransition | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undoSteps: () => readonly HistoryStep[];
  redoSteps: () => readonly HistoryStep[];
  drop: (entryId: UndoEntryId) => boolean;
  clear: () => void;
}

// dòng 254-259, 267 (chữ ký factory)
export interface CreateHistoryStackOptions {
  readonly limit?: number;
  readonly mergeWindowMs?: number;
}
export function createHistoryStack(options: CreateHistoryStackOptions = {}): HistoryStack
```

`buildHistoryLabel(commands, fallback)` (`history.ts:192-203`) — nhãn hiển thị trên màn
lịch sử, ví dụ `"Kéo tường W-000014AAAA"`; dùng `ACTION_LABELS` (dòng 135-147, đã có sẵn
`add`/`remove`/`move`/`update`… — đủ cho bốn lệnh trục nếu `CommandType` kết thúc bằng
`.add`/`.move`/`.remove`) và `KIND_LABELS` (dòng 150-158, đã có `axis: 'trục'`).

### `MỘT Command chứa NHIỀU Change có phải MỘT bước lịch sử không?**

**CÓ, dứt khoát.** Bằng chứng ở `dispatch.ts:605-626`: một lệnh `dispatch(command, deps)`
tạo ra ĐÚNG MỘT `DispatchBatch`/`UndoEntry` (`id: createUndoEntryId()` gọi một lần), và
`HistoryPort.push(entry)` được gọi ĐÚNG MỘT LẦN cho toàn bộ `command.changes` (dù
`command.changes` có bao nhiêu phần tử). `stepFromEntry` (`history.ts:227-239`) dựng một
`HistoryStep` DUY NHẤT từ `input.entry` — không có vòng lặp nào tách các `changes` của một
lệnh thành nhiều bước. `HistoryStack.undo()` (dòng 327-342) pop đúng MỘT `StackRecord` và áp
`record.step.undoPatches` — tức TOÀN BỘ patch nghịch đảo của TOÀN BỘ `changes` trong lệnh đó
— trong một lần gọi `applyPatches`.

Với `runTransaction` (nhiều `Command` cùng lúc, mục D tiếp theo), điều này vẫn đúng ở mức
GỘP CAO HƠN: `runCommandPipeline` nhận `input.commands: readonly Command[]` và vẫn chỉ tạo
MỘT `batch`/MỘT `entry`/MỘT lệnh `history.push` (`dispatch.ts:605-626`), bất kể
`input.commands.length` là bao nhiêu.

**Hệ quả cho "căn tự động = một lần Ctrl+Z":** nếu lệnh "căn chỉnh tự động" của bốn trục
được dựng thành N `Change` (một cho mỗi trục bị dịch) nhưng gói trong MỘT `Command` duy nhất
(một lần gọi `createCommand({ changes: [...] })` với mảng nhiều `EntityChange`), thì
`dispatch(oneCommand, deps)` sẽ tự động cho ra đúng một bước lịch sử, đúng một lần Ctrl+Z.
KHÔNG cần `runTransaction`/`mergeCommands` cho trường hợp này — chỉ cần nhét nhiều
`changeForUpdate('axis', before, after)` vào MỘT mảng `changes` của MỘT lệnh
`axis.autoAlign` (tên tự đặt, không cần có sẵn — mục B đã chứng minh `CommandType` mở).
Dùng `runTransaction` chỉ cần thiết khi các thay đổi phải đóng gói thành NHIỀU `Command`
riêng (ví dụ mỗi trục có `CommandType` khác nhau) nhưng vẫn phải đứng chung một bước hoàn
tác — xem mục dưới.

### `mergeCommands.ts` và `transaction.ts` — CÓ cơ chế gộp nhiều lệnh thành một bước

```ts
// mergeCommands.ts:34
export const MERGE_WINDOW_MS = COALESCE_WINDOW_MS; // 400 ms, từ src/lib/mutations/coalesce.ts

// mergeCommands.ts:48-52
export function canMergeCommands(
  earlier: Command,
  later: Command,
  windowMs: number = MERGE_WINDOW_MS,
): boolean

// mergeCommands.ts:87
export function mergeCommands(earlier: Command, later: Command): Command

// mergeCommands.ts:114-117
export function mergeCommandRun(
  commands: readonly Command[],
  windowMs: number = MERGE_WINDOW_MS,
): Command[]
```

`mergeCommands`/`mergeCommandRun` gộp một CHUỖI LỆNH LIÊN TIẾP (ví dụ kéo chuột nhiều
frame) đi qua nhiều lượt `dispatch` riêng thành một `Command`, dựa trên
`canMergeCommands` (cùng `type`, cùng `actorId`, cùng tập `entityIds`, cách nhau dưới
`MERGE_WINDOW_MS`). Đây là cơ chế fold Ở TẦNG HistoryStack khi PUSH (xem
`history.ts:281-325`, `runInProgress`/`foldIntoStep`) — không phải cơ chế gộp N `Command`
độc lập được `dispatch` một lần. Với yêu cầu "căn tự động một lần Ctrl+Z", `mergeCommands`
KHÔNG phải công cụ cần dùng (nó gộp các lượt dispatch cách nhau theo thời gian, không gộp
trong-cùng-một-lượt).

```ts
// transaction.ts:25-33
export interface TransactionOptions {
  readonly label?: string;
}

// transaction.ts:53-57
export function runTransaction(
  commands: readonly Command[],
  deps: DispatchDeps,
  options: TransactionOptions = {},
): Promise<DispatchResult>
```

`runTransaction` chạy NHIỀU `Command` (có thể khác `type`) qua CÙNG năm bước, MỘT LẦN, sinh
ra ĐÚNG MỘT `UndoEntry` (vì nó gọi `runCommandPipeline({ commands: batch, label }, deps)`,
cùng hàm mà `dispatch()` gọi cho một lệnh — xem `dispatch.ts:605-626` ở trên). Đây LÀ cơ chế
đúng nếu "căn tự động" cần N `Command` tách biệt (ví dụ mỗi trục một `Command` để nhật ký
hoạt động liệt kê riêng từng trục) nhưng vẫn phải là một bước Ctrl+Z duy nhất.

### `invert.ts`

```ts
// dòng 15
export const UNDO_DESCRIPTION_PREFIX = 'Hoàn tác: ';

// dòng 21-24
export const toggleUndoDescription = (description: string): string =>
  description.startsWith(UNDO_DESCRIPTION_PREFIX)
    ? description.slice(UNDO_DESCRIPTION_PREFIX.length)
    : `${UNDO_DESCRIPTION_PREFIX}${description}`;

// dòng 43-47
export const invertCommand = (command: Command): Command => ({
  ...command,
  description: toggleUndoDescription(command.description),
  changes: [...command.changes].reverse().map((change) => invertChange(change)),
});

// dòng 70-71
export const commandToPatches = (command: Command): readonly SpatialPatch[] =>
  command.changes.map((change) => changeToPatch(change));
```

**Cách `invertCommand` đảo:** HOÁN ĐỔI `before`/`after` của từng `change` (hàm nội bộ
`invertChange`, dòng 29-35: `{ kind, id, before: change.after, after: change.before }`),
KHÔNG tính toán lại gì cả. Đây là lý do trực tiếp khiến `changeForUpdate` với ảnh chụp đầy đủ
tự động hoàn tác được — không một dòng mã bổ sung nào cần viết ở tầng lệnh trục.
`invertCommand` cũng đảo THỨ TỰ mảng `changes` (`.reverse()`), quan trọng khi một lệnh có
nhiều `change` phụ thuộc trình tự.

---

## E. `src/store/commit.ts`

```ts
// toàn bộ file, dòng 1-39
import { useStore } from './index';
import type { SpatialPatch } from '../domain/spatial/applyPatch';

export interface CommitResult {
  undo: () => void;
  label: string;
  timestamp: number;
}

export function commit(
  patch: SpatialPatch | readonly SpatialPatch[],
  label: string
): CommitResult {
  const store = useStore.getState();
  const timestamp = Date.now();

  store._applyPatches(Array.isArray(patch) ? patch : [patch as SpatialPatch]);
  store.setLastCommit(label, timestamp);

  return {
    undo: () => {
      // zundo provides temporal api on useStore
      useStore.temporal.getState().undo();
    },
    label,
    timestamp,
  };
}
```

**CẢNH BÁO nối dây quan trọng:** `CommitResult.undo` ở trên gọi `useStore.temporal.getState().undo()`
— tức ngăn xếp **zundo** riêng của store, KHÁC HẲN ngăn xếp `HistoryStack` 100 bước của
`src/lib/commands/history.ts` (mục D). Tiền lệ `wallLayerReviewGateway.ts` KHÔNG dùng
`CommitResult.undo` — nó chỉ dùng `commit()` làm nơi GHI (`applyPatches`), còn hoàn tác đi
qua `dispatchBundle.history.undo()` của chính `HistoryStack` (xem mục G). Bốn lệnh trục PHẢI
theo đúng khuôn này: gọi `commit(patches, label)` chỉ để ghi, không bao giờ gọi
`commitResult.undo()`.

### `createCommitSpatialPort` — chép nguyên hàm từ tiền lệ

```ts
// wallLayerReviewGateway.ts:589-599
export function createCommitSpatialPort(
  graph: WallLayerGraphPort,
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

Đây là cách nối `commit()` vào `SpatialPort.applyPatches` của `dispatch`: `read` uỷ quyền
cho một `graph.read()` tiêm được (mặc định đọc thẳng `useStore.getState().spatial`, xem
`wallLayerReviewGateway.ts:326-328`), `applyPatches` gọi `commit(patches, labelOf())` với
nhãn lấy từ một closure `labelOf` — closure này được `createWallLayerDispatchDeps` (mục G)
cập nhật ngay trước mỗi lượt `dispatch` qua `setLabel`.

---

## F. `src/lib/mutations/undoTicket.ts`

```ts
// dòng 18
export const UNDO_WINDOW_MS = 8000;

// dòng 20-22
export type UndoTicketStatus = 'active' | 'expired' | 'used';
export type UndoTicketError = 'expired';

// dòng 24-29
export interface CreateUndoTicketOptions {
  description: string;
  now?: () => number;
  ttlMs?: number;
  undo: () => void;
}

// dòng 31-37
export interface UndoTicket {
  description: string;
  expiresAt: number;
  getStatus: () => UndoTicketStatus;
  id: string;
  undo: () => Result<void, UndoTicketError>;
}

// dòng 45-77
export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? UNDO_WINDOW_MS;
  const expiresAt = now() + ttlMs;
  let used = false;

  const getStatus = (): UndoTicketStatus => {
    if (used) return 'used';
    return now() >= expiresAt ? 'expired' : 'active';
  };

  const undo = (): Result<void, UndoTicketError> => {
    if (getStatus() !== 'active') {
      return { error: 'expired', ok: false };
    }
    used = true;
    options.undo();
    return { data: undefined, ok: true };
  };

  return { description: options.description, expiresAt, getStatus, id: createUuid(), undo };
}
```

### `createWallUndoTicket` — tiền lệ, chép nguyên hàm

```ts
// wallLayerReviewGateway.ts:685-704
export interface CreateWallUndoTicketOptions {
  readonly wallId: WallId;
  readonly undo: () => void;
  readonly now: () => number;
}

export function createWallUndoTicket(options: CreateWallUndoTicketOptions): UndoTicket {
  return createUndoTicket({
    description: deleteToastDescription(options.wallId),
    now: options.now,
    undo: options.undo,
  });
}
```

### Cách vé hoàn tác nối vào toast (A8) — hợp đồng đầy đủ

**KHÔNG dùng `Toast.Provider`/`useUndoableToast`.** Có hai hệ toast trong repo:

1. `Toast.Provider` (`src/components/feedback/Toast.tsx`) + `useUndoableToast`
   (`src/hooks/useUndoableToast.ts`) — nghe MỌI lượt `commit()` qua
   `state.lastCommitLabel`/`lastCommitTimestamp`, và nút "Hoàn tác" của nó gọi
   `useStore.temporal.getState().undo()` — ngăn xếp **zundo**, khác ngăn xếp S-06.
2. `NotificationHost` (`src/main.tsx:66`, vẽ `appNotificationBus` bằng `Toast.Item`) — nút
   "Hoàn tác" gọi thẳng `undoTicket.undo()`, tức đúng vé `createUndoTicket` ở trên.

Tiền lệ dùng **hệ 2**. Nguyên văn cách gọi tại `useWallLayerReview.ts:985-1021`:

```ts
const onDelete = useCallback(
  (wallId: WallId) => {
    void run((context) => {
      const result = buildDeleteWallCommand({ wallId }, context);
      return result.ok ? result.data : null;
    }).then(() => {
      const ticket = createWallUndoTicket({
        wallId,
        now: gateway.now,
        undo: () => {
          applyUndo();
          setFlashingWallId(wallId);
        },
      });

      undoTicketRef.current = ticket;

      notifications.publish({
        type: WALL_DELETE_NOTIFICATION_TYPE,
        title: ticket.description,
        description: '',
        undoTicket: ticket,
      });
    });
  },
  [applyUndo, gateway, notifications, run],
);
```

`notifications` là `NotificationBus` (`src/lib/mutations/notificationBus.ts`), mặc định
`appNotificationBus` (`useWallLayerReview.ts:964`, `import { appNotificationBus } from
'@/hooks/useNotifications'`). Chữ ký:

```ts
// notificationBus.ts:9-14
export interface NotificationInput {
  description: string;
  title: string;
  type: string;
  undoTicket?: UndoTicket | undefined;
}

// notificationBus.ts:33-37
export interface NotificationBus {
  list: () => readonly Notification[];
  publish: (input: NotificationInput) => void;
  subscribe: (listener: NotificationListener) => () => void;
}
```

`applyUndo` (được truyền làm `ticket.undo`) chính là hàm gọi `dispatchBundle.history.undo()`
— tức khi người dùng bấm "Hoàn tác" trên toast, nó chạy trên NGĂN XẾP S-06 (`HistoryStack`),
không phải zundo. Bốn lệnh trục nên theo đúng khuôn: dựng một `UndoTicket` riêng (đặt tên
kiểu `createAxisUndoTicket`) gọi `createUndoTicket` với `undo` trỏ vào `history.undo()` của
chính bộ `dispatchBundle` của màn trục, rồi `notifications.publish({ type, title, description:
'', undoTicket })`.

---

## G. Tiền lệ cổng màn — `src/screens/qc/WallLayerReview/wallLayerReviewGateway.ts`

### Khối khai báo khả năng (chép nguyên văn, dòng 135-181)

```ts
export const WALL_LAYER_CAPABILITIES = [
  'readBackground',
  'readWallGraph',
  'writeWallGraph',
  'persistWallLayer',
] as const;

export type WallLayerCapability = (typeof WALL_LAYER_CAPABILITIES)[number];

export const WALL_LAYER_MISSING_CAPABILITIES = ['persistWallLayer'] as const;

export type WallLayerMissingCapability = (typeof WALL_LAYER_MISSING_CAPABILITIES)[number];

export const WALL_LAYER_MISSING_ENDPOINTS: Readonly<
  Record<WallLayerMissingCapability, string>
> = {
  persistWallLayer:
    'ENDPOINTS.spatial.floor chấp nhận một đồ thị không gian trong thân yêu cầu — chưa có; PatchSpatialFloorInput.body là Partial<FloorWriteBody> (src/api/client.ts:87-92,144-148), chỉ mang name/order/elevationMm/heightMm/drawings, không có chỗ cho mảng tường',
};

export interface WallLayerUnsupported {
  readonly supported: false;
  readonly capability: WallLayerMissingCapability;
  readonly missing: string;
}

export interface WallLayerSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type WallLayerCapabilityResult<TValue> =
  | WallLayerSupported<TValue>
  | WallLayerUnsupported;

export function unsupported(capability: WallLayerMissingCapability): WallLayerUnsupported {
  return {
    supported: false,
    capability,
    missing: WALL_LAYER_MISSING_ENDPOINTS[capability],
  };
}
```

Đây là khuôn cho một hàm `unsupported()` của màn trục: `AXIS_GRID_CAPABILITIES`,
`AXIS_GRID_MISSING_CAPABILITIES` (chắc chắn phải gồm ít nhất một khả năng lưu lưới trục lên
máy chủ — xem mục J.2, KHÔNG TÌM THẤY endpoint), `AXIS_GRID_MISSING_ENDPOINTS`.

### `buildApproveWallCommand` + hằng loại lệnh + mô tả (chép nguyên văn, dòng 482-507)

```ts
export const WALL_APPROVE_COMMAND_TYPE = 'wall.approve';

export const approveDescription = (wallId: WallId): string => `Duyệt tường ${wallId}.`;

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

Đây LÀ mẫu chính xác Layer 2 phải chép cho bốn lệnh trục: một hằng `AXIS_<VERB>_COMMAND_TYPE
= 'axis.add' | 'axis.move' | 'axis.remove' | 'axis.setOrigin'` mỗi lệnh, một hàm mô tả tiếng
Việt trả về câu khác rỗng (validate đòi, mục C), và một hàm `build...Command(...)` gọi
`createCommand({ type, actorId, description, changes: [changeForAdd/changeForUpdate/changeForRemove('axis', ...)] })`.
Với "đặt gốc toạ độ", nếu gốc toạ độ không phải một entity riêng mà là trường trên `Level`
hoặc trên đồ thị, thì `changeForUpdate('level', before, after)` là kind phù hợp thay vì
`'axis'` — cần xác nhận hình dạng dữ liệu "gốc toạ độ" trước khi dựng (không có trong phạm vi
khảo sát này, xem mục J).

### `createCommitSpatialPort`, `createWallLayerDispatchDeps`, `runWallCommand`

`createCommitSpatialPort` đã chép ở mục E. Hai hàm còn lại:

```ts
// dòng 602-607
export interface WallLayerDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — SpatialPort đọc nó để đặt tên cho commit. */
  readonly setLabel: (label: string) => void;
}

// dòng 609-617
export interface CreateWallLayerDispatchOptions {
  readonly graph: WallLayerGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

// dòng 627-662
export function createWallLayerDispatchDeps(
  options: CreateWallLayerDispatchOptions,
): WallLayerDispatchDeps {
  const history = options.history ?? createHistoryStack();
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        history.push({
          entry,
          selectionBefore: options.selectionBefore(),
          selectionAfter: options.selectionAfter(),
        });
      },
      drop: (entryId) => {
        history.drop(entryId);
      },
    },
    rules: createIncrementalRuleRunner(),
    sync: {
      enqueue: () => {
        options.onSynced();
      },
    },
  };

  return {
    deps,
    history,
    setLabel: (next) => {
      label = next;
    },
  };
}

// dòng 665-672
export async function runWallCommand(
  command: Command,
  bundle: WallLayerDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);
  return dispatch(command, bundle.deps);
}
```

Lưu ý `sync.enqueue` ở đây KHÔNG gọi API thật — nó chỉ gọi `options.onSynced()` (đánh dấu
bản vẽ bẩn cho tự lưu A7). Đây là hệ quả trực tiếp của việc `persistWallLayer` chưa có
đường (mục J.2) — màn trục chắc chắn cũng phải làm vậy trừ khi có endpoint lưới trục.

### `createWallLayerReviewGateway` và `createMockWallLayerReviewGateway`

Chữ ký:

```ts
// dòng 302-310, 322-324
export interface CreateWallLayerReviewGatewayOptions {
  readonly apiClient?: ApiClient;
  readonly graph?: WallLayerGraphPort;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextWallId?: () => WallId;
}
export function createWallLayerReviewGateway(
  options: CreateWallLayerReviewGatewayOptions = {},
): WallLayerReviewGateway

// dòng 387-401, 404-406
export interface WallLayerGatewaySeed {
  readonly graph?: NormalizedSpatial | null;
  readonly failReadBackground?: boolean;
  readonly failReadWallLayer?: boolean;
  readonly withoutImage?: boolean;
  readonly canPersist?: boolean;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextWallId?: () => WallId;
}
export function createMockWallLayerReviewGateway(
  seed: WallLayerGatewaySeed = {},
): WallLayerReviewGateway
```

**Cách hai factory chia nhau:** cùng trả về một `interface WallLayerReviewGateway` duy nhất
(dòng 245-264 — `supports`, `readBackground`, `readWallLayer`, `graph`, `persistWallLayer`,
`nextWallId`, `actorId`, `now`). `createWallLayerReviewGateway` là bản THẬT — gọi
`apiClient.spatial.readFloor`, đọc store thật qua `useStore.getState().spatial`, và luôn trả
`persistWallLayer: () => unsupported('persistWallLayer')` vì chưa có endpoint.
`createMockWallLayerReviewGateway` là bản CÓ DỮ LIỆU — dùng chung một bộ mẫu
(`WALL_LAYER_FIXTURE_LEVEL`, `WALL_LAYER_FIXTURE_WALLS`) cho cả test lẫn story (R-70: không
bịa bảng dữ liệu thứ hai), có cờ `seed.*` để ép từng trạng thái của bảy trạng thái (mục I),
và mã tường mới sinh tất định (`counter` cục bộ, không phải `Math.random`). Container
(`WallLayerReviewContainer`, mục dưới) tiêm `gateway?: WallLayerReviewGateway` — khi không
tiêm gì thì hook tự dựng bản thật ĐÚNG MỘT LẦN.

---

## H. `src/lib/query` — hợp đồng trạng thái máy chủ (R-64)

### `queryKeys.ts` — chữ ký đầy đủ

```ts
export type QueryKey = readonly unknown[];

type QueryDomain =
  | 'drawing' | 'floor' | 'library' | 'progress' | 'project'
  | 'quality' | 'room' | 'space' | 'user' | 'version' | 'violation';

export type QueryKeyOf<TFactory> = TFactory extends (...args: infer TArgs) => infer TKey
  ? TArgs extends readonly unknown[]
    ? TKey extends QueryKey ? TKey : never
    : never
  : never;

export const queryKeys = {
  drawing: { byFloor: (floorId: string) => readonly ['drawing', 'byFloor', string] },
  floor: {
    detail: (floorId: string) => readonly ['floor', 'detail', string],
    list: (projectId: string) => readonly ['floor', 'list', string],
  },
  library: {
    detail: (libraryItemId: string) => readonly ['library', 'detail', string],
    list: () => readonly ['library', 'list'],
  },
  progress: { byFloor: (floorId: string) => readonly ['progress', 'byFloor', string] },
  project: {
    detail: (projectId: string) => readonly ['project', 'detail', string],
    list: () => readonly ['project', 'list'],
    members: (projectId: string) => readonly ['project', 'members', string],
  },
  quality: { assessment: (floorId: string) => readonly ['quality', 'assessment', string] },
  room: { byFloor: (floorId: string) => readonly ['room', 'byFloor', string] },
  space: { byFloor: (floorId: string) => readonly ['space', 'byFloor', string] },
  user: { current: () => readonly ['user', 'current'], list: () => readonly ['user', 'list'] },
  version: { byFloor: (floorId: string) => readonly ['version', 'byFloor', string] },
  violation: { byProject: (projectId: string) => readonly ['violation', 'byProject', string] },
} as const;
```

**KHÔNG có `queryKeys.space.byFloor` hay bất kỳ khoá nào riêng cho trục/lưới** — trục sống
trong `space.byFloor(floorId)` cùng với tường/phòng (đúng khoá `queryKeys.space.byFloor`,
`queryKeys.ts:113-115`, cùng khoá mà `WallLayerReview` đã dùng cho `readWallLayer`, xem mục
H bên dưới). Không có domain `'axis'`/`'grid'` trong `QueryDomain` (dòng 3-14).

### `cachePolicy.ts` — chữ ký đầy đủ

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

`TIER_BY_DOMAIN` (dòng 77-84) ánh xạ domain đầu tiên của key sang tier: `drawing`/`room`/
`space` → `spatialDraft` (staleTime 10s). Domain `space` phủ luôn trục (vì trục đọc qua
`queryKeys.space.byFloor`), nên trục kế thừa tier `spatialDraft` mà không cần đăng ký gì
thêm.

### `invalidation.ts` — chữ ký đầy đủ, ĐÃ CÓ `changeAxis`

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
  changeAxis: ({ projectId, floorId }) => [
    queryKeys.drawing.byFloor(floorId),
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

**PHÁT HIỆN QUAN TRỌNG:** `'changeAxis'` ĐÃ LÀ một `WriteOperation` có sẵn, khai tại
`invalidation.ts:5-16` (mảng) và `invalidation.ts:74-79` (danh sách khoá làm mất hiệu lực).
Bốn lệnh trục của Layer 2 nên gọi `applyInvalidation(queryClient, 'changeAxis', { projectId,
floorId })` sau mỗi lượt `dispatch` thành công — đúng khuôn `useWallLayerReview.ts` gọi
`applyInvalidation(queryClient, 'editWall', {...})` (cần xác nhận tên hàm `invalidate` cục
bộ trong hook đó khi dựng Layer 2, không nằm trong phạm vi khảo sát này).

### `createOptimisticMutation` — chữ ký đầy đủ

```ts
// createOptimisticMutation.ts:8-21
export interface OptimisticMutationConfig<TVariables, TResult> {
  affectedKeys: (variables: TVariables) => readonly QueryKey[];
  afterSuccess: (result: TResult, variables: TVariables) => void;
  applyOptimistic: (variables: TVariables) => void;
  callServer: (variables: TVariables) => Promise<TResult>;
  entityId: (variables: TVariables) => string;
  rollback: (variables: TVariables) => void;
}

// createOptimisticMutation.ts:67-75
export function createOptimisticMutation<TVariables, TResult>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TVariables, TResult>,
): UseMutationOptions<TResult, AppError, TVariables>
```

**KHÔNG dùng cho bốn lệnh trục theo khuôn hiện có.** `WallLayerReview` (tiền lệ được chỉ
định) không dùng `createOptimisticMutation` cho các lệnh nghiệp vụ — nó dùng `dispatch`
trực tiếp (đường "trong bộ nhớ", vì `persistWallLayer` chưa có endpoint, mục G/J). Chỉ
`readBackground`/`readWallLayer` đi qua `useQuery`; các lệnh (`onDelete`, `onSplit`,
`onMerge`, `onChangeThickness`) gọi `run(...)` → `runWallCommand` → `dispatch`, không qua
`useMutation`/`createOptimisticMutation`. Bốn lệnh trục nên theo đúng khuôn này trừ khi có
quyết định khác của điều phối viên.

### Ví dụ gọi thật từ một màn qc đã dựng xong — `isLoading`/`isError`

```ts
// useWallLayerReview.ts:617-625
const backgroundQuery = useQuery({
  queryKey: queryKeys.drawing.byFloor(floorId),
  queryFn: ({ signal }) => gateway.readBackground({ floorId, projectId, signal }),
});

const wallLayerQuery = useQuery({
  queryKey: queryKeys.space.byFloor(floorId),
  queryFn: ({ signal }) => gateway.readWallLayer({ floorId, projectId, signal }),
});

// useWallLayerReview.ts:1175-1176
const hasError = wallLayerQuery.isError;
const isLoading = backgroundQuery.isPending || wallLayerQuery.isPending || graph === null;
```

Chú ý: dùng `.isPending`, không phải `.isLoading` (API TanStack Query v5), và HAI lượt đọc
TÁCH BẠCH dưới hai khoá khác nhau — bình luận `useWallLayerReview.ts:609-614` giải thích lý
do (lỗi ảnh nền không được lây sang trạng thái lỗi của lớp dữ liệu chính, xem A11 trạng thái
4). Không có `useQuery` nào cho `queryKeys.space.byFloor` riêng cho trục — nếu Layer 2 đọc
trục qua cùng đồ thị `NormalizedSpatial` (đã có `axes: Axis[]`, xem phần cuối), nó có thể
DÙNG LẠI đúng `wallLayerQuery`-shaped call trên cùng khoá `queryKeys.space.byFloor(floorId)`
thay vì thêm một khoá query mới.

---

## I. Bảy trạng thái

### `expectSevenStates.ts`

```ts
// dòng 38-43
export interface ScreenRenderResult {
  readonly container: HTMLElement;
  readonly unmount?: () => void;
}

// dòng 46
export type ScreenRenderer = (scenario: SevenStateScenario) => ScreenRenderResult;

// dòng 122-125
export function expectSevenStates(
  renderScreen: ScreenRenderer,
  scenarios: readonly SevenStateScenario[],
): void
```

### `sevenStateScenarios.ts`

```ts
// dòng 26-34 — TÊN ĐÚNG của bảy trạng thái
export const SEVEN_STATES = [
  'empty', 'loading', 'partial', 'error', 'success', 'forbidden', 'collapsed',
] as const;
export type SevenState = (typeof SEVEN_STATES)[number];

// dòng 40-48
export const SEVEN_STATE_LABELS: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng', loading: 'đang tải', partial: 'một phần', error: 'lỗi',
  success: 'thành công', forbidden: 'không có quyền', collapsed: 'thu gọn',
};

// dòng 62-76 — hình dạng dữ liệu kịch bản
export interface SevenStateScenario {
  readonly state: SevenState;
  readonly label: string;
  readonly rows: readonly SevenStateRow[];
  readonly totalCount: number;
  readonly isLoading: boolean;
  readonly isCollapsed: boolean;
  readonly canView: boolean;
  readonly error: unknown;
}

// dòng 101-116, 127
export interface SevenStateScenarioOptions {
  readonly totalCount?: number;
  readonly partialCount?: number;
  readonly createRow?: (index: number) => SevenStateRow;
  readonly overrides?: Partial<Record<SevenState, Partial<SevenStateScenario>>>;
}
export function createSevenStateScenarios(
  options: SevenStateScenarioOptions = {},
): readonly SevenStateScenario[]
```

`SevenStateRow` (dòng 51-54): `{ readonly id: string; readonly label: string }` — hình dạng
tối thiểu; một màn trục dùng `overrides` để thêm trường riêng (ví dụ mã trục làm `id`).

### `ScreenErrorBoundary.tsx` — props đầy đủ

```ts
// dòng 43-48
export interface ScreenErrorFallback {
  readonly report: ScreenErrorReport;
  readonly retry: () => void;
}

// dòng 50-58
export interface ScreenErrorBoundaryProps {
  readonly screenId: string;
  readonly children: ReactNode;
  readonly renderFallback: (fallback: ScreenErrorFallback) => ReactNode;
  readonly onError?: (report: ScreenErrorReport) => void;
}
```

### Cách `*.container.tsx` của một màn qc đã dựng bọc nó — chép nguyên khối, từ `WallLayerReview.container.tsx:140-223`

```tsx
function WallLayerReviewCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-state-violation-tint" />}
        title={report.description.title}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

export function WallLayerReviewContainer(props: WallLayerReviewContainerProps) {
  return (
    <ScreenErrorBoundary
      key={`${props.projectId}:${props.floorId}`}
      renderFallback={({ report, retry }) => (
        <WallLayerReviewCrashFallback report={report} retry={retry} />
      )}
      screenId={WALL_LAYER_REVIEW_SCREEN_ID}
    >
      <WiredWallLayerReview {...props} />
    </ScreenErrorBoundary>
  );
}
```

`key={...projectId:floorId}` đảm bảo ranh giới GẮN LẠI khi đổi tầng/dự án — cùng ý
`key={activeScreen}` của `src/App.tsx` (R-62). Fallback dựng bằng `EmptyState` từ
`report.description`, không bao giờ trắng (A11).

---

## J. MỤC "KHÔNG TÌM THẤY"

### J.1 — Lệnh trục có sẵn (`axis.add` / `axis.move` / `axis.remove` / `axis.setOrigin`)

**KHÔNG TÌM THẤY.** Lệnh dùng:
```
grep -n "axis" -r -i src/lib/commands --include=*.ts | grep -v __tests__
```
Kết quả DUY NHẤT: `src/lib/commands/history.ts:156` — `axis: 'trục'`, một mục trong bảng
nhãn hiển thị `KIND_LABELS` (dùng để đặt tên bước lịch sử), KHÔNG phải một lệnh. Không có
file nào tên `axisCommands.ts` trong `src/lib/commands/business/` (thư mục đó chỉ có
`wallCommands.ts`, `openingCommands.ts`, `roomFloorCommands.ts`, `shared.ts` — điều phối
viên đã xác nhận).

**Đề xuất ghép từ nguyên thuỷ đã có** (không viết mã, chỉ nêu tên hàm): bốn lệnh trục dựng
bằng `createCommand` (mục A) + `changeForAdd`/`changeForUpdate`/`changeForRemove` (mục A),
với `kind: 'axis'` — hợp lệ vì `'axis'` đã là một `EntityKind` có sẵn trong
`src/domain/spatial/ids.ts:15-23` (prefix `'A'`) và `src/domain/spatial/types.ts:203-210`
(interface `Axis`, xem cuối tài liệu). Bốn hằng `CommandType` tự đặt (`'axis.add'`,
`'axis.move'`, `'axis.remove'`, `'axis.setOrigin'` hoặc tương đương) — hợp lệ vì `CommandType`
là `string` mở (mục B).

### J.2 — Endpoint lưu lưới trục hoặc gốc toạ độ xuống máy chủ

**KHÔNG TÌM THẤY.** Lệnh dùng:
```
grep -rn "axis" -i src/api/endpoints.ts src/api/client.ts
```
Không có kết quả nào. Toàn bộ `ENDPOINTS` (`src/api/endpoints.ts:18-82`) chỉ có các nhóm
`auth`, `drawings`, `featureFlags`, `floors`, `projects`, `quality`, `spatial` (`floor` +
`version`). Endpoint gần nhất là `ENDPOINTS.spatial.floor(projectId, floorId)`
(`endpoints.ts:76-78`), nhưng thân yêu cầu của nó — `PatchSpatialFloorInput.body:
Partial<FloorWriteBody>` (`src/api/client.ts:144-148`) — kế thừa `FloorWriteBody`
(`client.ts:87-92`) từ `FloorPayload` (`src/api/contracts.ts:87-94`):

```ts
export interface FloorPayload {
  areaM2?: FloorAreaM2;
  drawings?: Drawing[];
  elevationMm?: FloorElevationMm;
  heightMm?: FloorHeightMm;
  name?: FloorName;
  order?: FloorOrder;
}
```

Không có trường nào cho mảng trục (`axes`) hay gốc toạ độ (`origin`) — CÙNG khoảng trống mà
`wallLayerReviewGateway.ts` đã ghi nhận cho tường (`WALL_LAYER_MISSING_ENDPOINTS.persistWallLayer`,
mục G). **Đề xuất:** màn trục lặp lại đúng khuôn `unsupported('persistAxisGrid')` (hoặc tên
tương đương) — chạy TRONG BỘ NHỚ (store + `HistoryStack` 100 bước), tự lưu (A7) chỉ đánh dấu
bẩn qua `SyncPort.enqueue` gọi `onSynced()`, KHÔNG bịa một endpoint. Việc thêm đường lưu lưới
trục lên máy chủ là việc riêng của nhóm lô-gic (giống ghi chú "Khoảng trống đã biết" ở
`WallLayerReview.container.tsx:64-72`), không phải việc của task dựng màn.

### J.3 — Cách một màn phát toast có nút Hoàn tác

**CÓ**, tại `src/screens/qc/WallLayerReview/useWallLayerReview.ts:1016-1021` (gọi
`notifications.publish({ type, title, description: '', undoTicket })`) nối với
`src/lib/mutations/notificationBus.ts:35` (`NotificationBus.publish`) và vẽ bởi
`src/components/feedback/NotificationHost.tsx` (đăng ký tại `src/main.tsx:66`). Tên hàm/hook
thật: `createUndoTicket` (`src/lib/mutations/undoTicket.ts:45`), `appNotificationBus`
(nhập từ `@/hooks/useNotifications` tại `useWallLayerReview.ts:102`), phương thức
`notifications.publish(...)`. Chép đầy đủ ở mục F.

**KHÔNG dùng** `useUndoableToast` (`src/hooks/useUndoableToast.ts`) hay `Toast.Provider`
(`src/components/feedback/Toast.tsx`) cho việc này — hai thứ đó nối vào ngăn xếp zundo của
store, không phải ngăn xếp S-06 mà `dispatch`/`HistoryStack` dùng; dùng nhầm sẽ cho ra HAI
toast cho một lượt xoá và một cái hoàn tác sai ngăn xếp — xem cảnh báo nguyên văn tại
`WallLayerReview.container.tsx:46-62` (mục I).

---

## Phụ lục — `Axis` đã có sẵn trong `src/domain/spatial` (không cần kiểu miền mới)

```ts
// src/domain/spatial/types.ts:61-65
export interface ReviewMetadata {
  confidence: Confidence;
  source: DataSource;
  reviewed: boolean;
}

// src/domain/spatial/types.ts:82-83
export type AxisId = `A-${string}`;

// src/domain/spatial/types.ts:199-210
export type AxisDirection = 'horizontal' | 'vertical';

export interface Axis extends ReviewMetadata {
  id: AxisId;
  levelId: LevelId;
  /** Label drawn on the sheet, for example `A` or `12`. */
  label: string;
  direction: AxisDirection;
  line: Segment; // { start: Point; end: Point } — types.ts:31-34
}

// src/domain/spatial/ids.ts:15-23
export const ID_PREFIX_BY_KIND = {
  level: 'L', wall: 'W', opening: 'D', furniture: 'F', room: 'R', axis: 'A', dimension: 'M',
} as const;
export type EntityKind = keyof typeof ID_PREFIX_BY_KIND;

// src/domain/spatial/ids.ts:87-93
export const createId = <K extends EntityKind>(kind: K): IdByKind[K] => { /* ... */ };

// src/domain/spatial/ids.ts:108-116
export const isIdOfKind = <K extends EntityKind>(kind: K, id: string): id is IdByKind[K] => { /* ... */ };

// src/domain/spatial/normalize.ts:224
axes: collectByKind(normalized, 'axis'), // NormalizedSpatial.axes: readonly Axis[]
```

`createId('axis')` sinh id đúng dạng `A-XXXXXXXXXX` (10 ký tự thân, base36 hoa) mà
`isIdOfKind('axis', id)` và `validateCommands` chấp nhận — không cần viết một bộ sinh id
riêng cho trục.

**Route đã đăng ký:** `src/routes/paths.ts:54,95` có `layerGrids:
`${LAYERS_ROOT}/grids`` và `src/routes/router.tsx:91` đã map
`ROUTE_PATTERNS.layerGrids` (hiện còn là `<RouteCanvas>` placeholder theo "Trạng thái hiện
tại" của `CLAUDE.md`). `WallLayerReview.container.tsx:110-115` đã có sẵn mục điều hướng
`axes: ROUTES.layerGrids` trong `LAYER_ROUTE` của lớp tường — nghĩa là màn S-15 khi dựng
xong có thể được điều hướng tới TỪ màn lớp tường mà không cần sửa `WallLayerReview.container.tsx`
(vì tệp đó nằm ngoài danh sách trắng của Layer 2, nhưng route đích đã tồn tại sẵn để trỏ tới).

**Bàn phím Ctrl+Z (tiền lệ, không phải kết luận bắt buộc cho Layer 2):**
`useWallLayerReview.ts:1281-1290` đăng ký `Mod+Z` ở `scope: 'canvas'` qua `useShortcut`,
`onTrigger: onUndo` gọi `dispatchBundle.history.undo()` (mục D) — KHÔNG một
`addEventListener('keydown')` nào. Bình luận `useWallLayerReview.ts:80-85` giải thích vì sao
đăng ký ở tầng `canvas` (đứng trên tầng `global` của `buildGlobalShortcuts` trong
`SCOPE_PRIORITY`) không đụng độ với `findOverlaps`. Layer 2 nên theo đúng khuôn này cho
Ctrl+Z của màn trục.
