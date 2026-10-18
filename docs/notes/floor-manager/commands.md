# S-16 T2 — khảo sát tầng lệnh, hoàn tác, dữ liệu máy chủ cho `FloorManager`

Chỉ khảo sát. Không sửa file nguồn nào. Mọi khẳng định "CÓ" dưới đây đều có
`grep -n` thật kèm theo; chỗ nào không dán được thì ghi `NOT FOUND`.

---

## A. `src/lib/commands/` — tầng lệnh

### `createCommand.ts`

```
$ grep -n "export const createCommand\|export const changeForAdd\|export const changeForRemove\|export const changeForUpdate" src/lib/commands/createCommand.ts
36:export const changeForAdd = <K extends EntityKind>(kind: K, entity: EntityByKind[K]): EntityChangeOfKind<K> => ({
44:export const changeForRemove = <K extends EntityKind>(kind: K, entity: EntityByKind[K]): EntityChangeOfKind<K> => ({
52:export const changeForUpdate = <K extends EntityKind>(
128:export const createCommand = (input: CommandInput): Command => {
```

Chữ ký đủ (từ file, nguyên văn):

```ts
export const changeForAdd = <K extends EntityKind>(
  kind: K,
  entity: EntityByKind[K],
): EntityChangeOfKind<K> => ({ kind, id: idOfEntity(entity), before: null, after: entity })

export const changeForRemove = <K extends EntityKind>(
  kind: K,
  entity: EntityByKind[K],
): EntityChangeOfKind<K> => ({ kind, id: idOfEntity(entity), before: entity, after: null })

export const changeForUpdate = <K extends EntityKind>(
  kind: K,
  before: EntityByKind[K],
  after: EntityByKind[K],
): EntityChangeOfKind<K> => { /* throws nếu before.id !== after.id */ return { kind, id: idOfEntity(before), before, after } }

export const createCommand = (input: CommandInput): Command => { /* ném lỗi nếu một change không đảo được */ }

export interface CommandInput {
  type: CommandType;
  actorId: string;
  description: string;
  changes: readonly EntityChange[];
  id?: CommandId;        // chỉ cho test/replay
  timestamp?: string;    // chỉ cho test/replay
}
```

`createCommand` tự tính `scope` (entityIds/levelIds/kinds) từ `changes` —
không nơi gọi nào tự viết `scope` (`createCommand.ts:95-118,140`). Ném lỗi nếu
một `change` có cả `before` và `after` đều `null` (`createCommand.ts:65-75`).

### `types.ts` — CÂU HỎI: `CommandType` đóng hay mở?

```
$ grep -n "export type CommandType" src/lib/commands/types.ts
31:export type CommandType = string;
```

**MỞ.** `CommandType = string` — không phải union đóng.

```
$ grep -n "KNOWN_KINDS\|command.type\|change.kind" src/lib/commands/dispatch.ts
205:const KNOWN_KINDS: ReadonlySet<string> = new Set(Object.keys(ID_PREFIX_BY_KIND));
249:    if (!isFilled(command.type)) {
279:      if (!KNOWN_KINDS.has(change.kind)) {
280:        rejectChange(`loại đối tượng "${change.kind}" không có trong hệ thống.`);
285:      if (!isIdOfKind(change.kind, change.id)) {
```

`validateCommands` (dispatch.ts:220-328) **không so `command.type` với bảng
cho phép nào** — dòng 249 chỉ đòi nó khác rỗng (`isFilled`). Thứ **duy nhất**
bị so bảng là `change.kind`, so với `KNOWN_KINDS` — tập hợp các
`EntityKind` hợp lệ (`ID_PREFIX_BY_KIND`, `dispatch.ts:205`, nguồn tại
`src/domain/spatial/ids.ts:15-23`). Vì `'level'` đã là một `EntityKind` có sẵn
(`ids.ts:16: level: 'L'`), một `command.type` tự đặt như `level.add` —
miễn `change.kind` là `'level'` — đi qua được bước kiểm hợp lệ. Đây đúng là
tiền lệ `axisGridManagerGateway.ts` đã dùng cho `'axis.add'`/`'axis.remove'`/
`'axis.move'` (xem mục F).

Chữ ký `Command`, `EntityChange`, `CommandContext`, `EntityChangeOfKind`:

```ts
// types.ts
export type CommandId = `C-${string}`;
export type CommandType = string;
export interface EntityChangeOfKind<K extends EntityKind> {
  kind: K; id: IdByKind[K];
  before: EntityByKind[K] | null; after: EntityByKind[K] | null;
}
export type EntityChange = { [K in EntityKind]: EntityChangeOfKind<K> }[EntityKind];
export interface CommandScope { entityIds: readonly EntityId[]; levelIds: readonly LevelId[]; kinds: readonly EntityKind[]; }
export interface Command {
  id: CommandId; type: CommandType; timestamp: string; actorId: string;
  description: string; changes: readonly EntityChange[]; scope: CommandScope;
}

// business/shared.ts — CommandContext
export interface CommandContext {
  readonly graph: NormalizedSpatial;
  readonly actorId: string;
  readonly id?: CommandId;        // chỉ test/replay
  readonly timestamp?: string;    // chỉ test/replay
}
```

### `dispatch.ts`

```
$ grep -n "export function dispatch\|history.push\|SPATIAL_PIPELINE_KEY\|runExclusive" src/lib/commands/dispatch.ts
54:import { runExclusive } from '@/lib/mutations/entityQueue';
605:  const batch: DispatchBatch = {
616:    deps.history.push(entry);
692:export const SPATIAL_PIPELINE_KEY = 'spatial-command-pipeline';
700:export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult> {
701:  return runExclusive(SPATIAL_PIPELINE_KEY, () =>
```

Chữ ký:

```ts
export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult>
```

Nhận **một** `Command` (không phải mảng) + `DispatchDeps` (5 cổng: `spatial`,
`history`, `rules`, `sync`, `now?`). Trả `Promise<Result<DispatchSuccess, DispatchFailure>>`
— **không bao giờ reject** (`dispatch.ts:696-699`).

Năm bước, luôn đúng thứ tự (`DISPATCH_STAGES`, `dispatch.ts:72-78`): `validate
→ apply → history → rules → sync`. `history.push` được gọi **đúng một lần**
cho toàn bộ pipeline (`dispatch.ts:616`, bên trong `runCommandPipeline`), bất
kể `command.changes` có bao nhiêu phần tử — batch nhận **tất cả**
`input.commands` (một hoặc nhiều `Command`, xem `PipelineInput`) và tạo
**một** `UndoEntry` cho cả batch. Với `dispatch(command, deps)` (một
`Command` duy nhất), số lần `history.push` cho một lệnh nhiều `changes` là
**1** — không phải một lần mỗi `change`. Đây chính là cơ chế khiến
`buildAutoAlignCommand` của `axisGridManagerGateway.ts` gộp nhiều tầng vào một
`Ctrl+Z`.

`UndoEntry` (`dispatch.ts:113-115`):

```ts
export interface UndoEntry extends DispatchBatch {
  readonly undoPatches: readonly SpatialPatch[];
}
```

sinh tại `dispatch.ts:605-611`: `id` (prefix `U-`), `label` (mô tả tiếng Việt
của lệnh), `commands` (mảng đã dispatch), `timestamp`, và `undoPatches` —
tính bằng `undoPatchesOf(input.commands)` = đảo từng lệnh
(`invertCommand`) rồi đổi ra `SpatialPatch[]`, theo **thứ tự ngược**.

### `invert.ts`

```
$ grep -n "export const invertCommand\|export const commandToPatches\|invertChange" src/lib/commands/invert.ts
29:const invertChange = (change: EntityChange): EntityChange =>
43:export const invertCommand = (command: Command): Command => ({
70:export const commandToPatches = (command: Command): readonly SpatialPatch[] =>
```

```ts
export const invertCommand = (command: Command): Command
export const commandToPatches = (command: Command): readonly SpatialPatch[]
```

`invertCommand` **không tính lại gì** — nó chỉ hoán đổi `before`/`after` của
từng `change` và đảo thứ tự mảng `changes` (invert.ts:29-47). Vì vậy: **một
lệnh cần mang ẢNH CHỤP ĐẦY ĐỦ before/after (không phải diff)** để tự hoàn tác
được — đúng bất biến ghi ở đầu `types.ts:4-7` ("never a partial diff"). Một
`changeForAdd` chỉ có `after` thì hoàn tác = xoá (`op: 'remove'`,
`invert.ts:58-59`); `changeForRemove` chỉ có `before` thì hoàn tác = thêm lại
(`op: 'add'`, `invert.ts:55`).

### `history.ts`, `transaction.ts`, `mergeCommands.ts` — cái màn có thể cần

- **`history.ts`**: `createHistoryStack()` — ngăn xếp 100 bước
  (`MAX_HISTORY_STEPS`), giữ `SelectionSnapshot` hai chiều, tự gộp các bước
  liên tiếp cùng loại trong `MERGE_WINDOW_MS` (`canMergeCommands`). Có
  `push`/`undo`/`redo`/`canUndo`/`canRedo`/`undoSteps`/`redoSteps`/`drop`/
  `clear`. `buildHistoryLabel` tự sinh nhãn tiếng Việt từ `command.type` +
  `scope` (vd `Kéo tường W-...`) — dùng bảng `ACTION_LABELS`
  (`history.ts:135-147`, có `add`/`remove`/`move`/`update`…) và `KIND_LABELS`
  (`history.ts:150-158`, **đã có `level: 'tầng'`**). Vậy nếu màn đặt
  `command.type` kết thúc bằng `.add`/`.remove` (như `level.add`,
  `level.remove`) thì nhãn lịch sử tự sinh đúng ("Thêm tầng ...", "Xoá tầng
  ..."), không cần viết tay.
- **`transaction.ts`**: `runTransaction(commands, deps, options?)` — chạy
  NHIỀU `Command` như một khối nguyên tử (một `UndoEntry`, một rule pass, một
  lượt sync). Màn `FloorManager` không rõ có cần transaction hay không (mỗi
  thao tác thêm/nhân bản/xoá/đổi thứ tự tầng đã diễn tả được bằng MỘT
  `Command` nhiều `changes`, giống `buildAutoAlignCommand`), nhưng nếu một
  thao tác của màn phải sinh ra nhiều `Command` riêng (ví dụ vừa xoá tầng vừa
  đổi lại thứ tự các tầng còn lại bằng hai lệnh khác `type`) thì đây là chỗ
  gộp chúng thành một Ctrl+Z.
- **`mergeCommands.ts`**: `MERGE_WINDOW_MS` (= `COALESCE_WINDOW_MS` = 400 ms),
  `canMergeCommands`, `mergeCommands`, `mergeCommandRun`. Dùng khi kéo-thả
  liên tục (vd kéo thanh đổi cao độ); **không liên quan** tới xoá tầng (xoá
  không lặp) hay thêm/nhân bản tầng (không phải thao tác lặp lại nhanh).

---

## B. `src/lib/commands/business/roomFloorCommands.ts`

```
$ grep -n "export const ROOM_FLOOR_COMMAND_TYPES" -A8 src/lib/commands/business/roomFloorCommands.ts
67:export const ROOM_FLOOR_COMMAND_TYPES = {
68:  renameRoom: 'room.rename',
69:  changeRoomUsage: 'room.changeUsage',
70:  mergeRooms: 'room.merge',
71:  splitRoom: 'room.split',
72:  changeLevelElevation: 'level.changeElevation',
73:  reorderLevels: 'level.reorder',
74:} as const;
```

Đủ 6 khoá — **xác nhận đặc tả gốc sai**: chỉ có `level.changeElevation` và
`level.reorder` cho tầng; 4 khoá còn lại (`room.*`) không liên quan tầng.
**Không có `level.add` / `level.duplicate` / `level.remove` trong file này.**

### `ChangeLevelElevationInput` + `validateChangeLevelElevation` + `createChangeLevelElevationCommand`

```
$ grep -n "ChangeLevelElevationInput\|export function validateChangeLevelElevation\|export function createChangeLevelElevationCommand" src/lib/commands/business/roomFloorCommands.ts
553:export interface ChangeLevelElevationInput {
559:export function validateChangeLevelElevation(
613:export function createChangeLevelElevationCommand(
```

```ts
export interface ChangeLevelElevationInput {
  readonly levelId: LevelId;
  readonly elevationMm: number;
}
export function validateChangeLevelElevation(
  input: ChangeLevelElevationInput, context: CommandContext,
): string[]
export function createChangeLevelElevationCommand(
  input: ChangeLevelElevationInput, context: CommandContext,
): CommandResult   // = Result<Command, CommandRefusal>
```

**CÂU HỎI TRỌNG TÂM 1 — chặn trùng cao độ?**

```
$ grep -n "level.elevationMm\|below\|above\|reasons.push" src/lib/commands/business/roomFloorCommands.ts | sed -n '1,20p'
575:  if (nearlyEqualLength(millimetres(level.elevationMm), millimetres(input.elevationMm))) {
576:    reasons.push(
577:      `Tầng "${level.name}" đã ở cao độ ${formatElevationM(level.elevationMm)} nên không có gì thay đổi.`,
581:  const stack = levelsInOrder(context);
582:  const position = stack.findIndex((candidate) => candidate.id === level.id);
583:  const below = position > 0 ? stack[position - 1] : undefined;
584:  const above = position >= 0 ? stack[position + 1] : undefined;
586:  if (below !== undefined && compareNearly(below.elevationMm + below.heightMm, input.elevationMm) > 0) {
587:    reasons.push(
588:      `Tầng "${below.name}" ở ${formatElevationM(below.elevationMm)} cao ` +
589:        `${formatMetres(below.heightMm)} nên đỉnh của nó ở ${formatElevationM(below.elevationMm + below.heightMm)}; ` +
590:        `cao độ mới ${formatElevationM(input.elevationMm)} nằm thấp hơn.`,
594:  if (above !== undefined && compareNearly(input.elevationMm + level.heightMm, above.elevationMm) > 0) {
595:    reasons.push(
596:        `${formatElevationM(input.elevationMm)} thì tầng "${level.name}" cao ` +
597:        `${formatMetres(level.heightMm)} sẽ chạm lên tầng "${above.name}" đang ở ` +
598:        `${formatElevationM(above.elevationMm)}.`,
```

**CÓ, nhưng chỉ MỘT PHẦN, và câu chữ không nói "trùng cao độ".** Thân hàm
kiểm ba việc:

1. (dòng 575-579) cao độ mới trùng đúng cao độ **hiện tại của chính tầng đó**
   → từ chối vì "không có gì thay đổi" (không phải lỗi trùng-với-tầng-khác).
2. (dòng 583-591) tầng **ngay dưới** trong ngăn xếp (`below`, xác định bằng
   `Level.order`, không phải bằng so mọi cặp cao độ): nếu đỉnh của tầng dưới
   (`below.elevationMm + below.heightMm`) cao hơn cao độ mới → từ chối, nêu
   tên **cả hai tầng** ("Tầng below... cao độ mới ... nằm thấp hơn").
3. (dòng 594-600) tầng **ngay trên** (`above`): nếu đáy tầng mới + chiều cao
   tầng hiện tại chạm vào cao độ tầng trên → từ chối, nêu tên **cả hai
   tầng** ("... sẽ chạm lên tầng above...").

Hai kiểm tra 2 và 3 **sẽ** bắt được trường hợp đặt trùng cao độ với đúng
tầng liền kề (chồng lấn = 0 hoặc âm vẫn `> 0`), và câu lỗi **có nêu tên cả
hai tầng**. Nhưng: **không có phép so cao độ mới với TẤT CẢ các tầng khác**
(chỉ so với 2 tầng liền kề theo `order` hiện tại) — một tầng cách xa trong
ngăn xếp (không phải hàng xóm liền kề) có thể được đặt trùng cao độ mà không
bị chặn ở đây, và không có thông điệp nào dùng đúng cụm từ "trùng cao độ".
Vì đặc tả bắt buộc chặn trùng cao độ **giữa hai tầng bất kỳ**, kết luận:
**NOT FOUND: chặn trùng cao độ giữa hai tầng bất kỳ (chỉ có chặn chồng lấn
với hai tầng liền kề theo thứ tự xếp chồng hiện tại)** — cổng của màn
`FloorManager` phải tự thêm bước so cao độ mới với **mọi** tầng khác (không
chỉwhich liền kề) nếu muốn thoả đặc tả, hoặc điều phối viên phải chấp nhận
"liền kề là đủ" như một quyết định sản phẩm.

**CÂU HỎI TRỌNG TÂM 2 — có tự tính lại cao độ tầng trên không?**

```
$ grep -n "createChangeLevelElevationCommand\|changeForUpdate('level'" src/lib/commands/business/roomFloorCommands.ts
613:export function createChangeLevelElevationCommand(
639:      [changeForUpdate('level', level, { ...level, elevationMm: input.elevationMm })],
```

**KHÔNG.** `createChangeLevelElevationCommand` sinh đúng **một**
`changeForUpdate('level', ...)` cho **đúng một tầng** — `elevationMm` được
ghi thẳng bằng `input.elevationMm` (dòng 639), không có vòng lặp nào chạm
tới tầng khác. Docstring ngay phía trên (`roomFloorCommands.ts:605-611`) nói
rõ: *"Only that storey moves... Neighbours are never nudged out of the way —
a stack that no longer fits is a decision for a person, not for a command."*
→ **màn KHÔNG được tự cộng cao độ các tầng phía trên khi gọi lệnh này**,
đúng lệnh cấm ở mục 3 của đặc tả.

Ngược lại, `createReorderLevelsCommand` (dòng 751-789) **CÓ** tính lại cao độ
— nhưng của **mọi** tầng theo thứ tự mới, bằng hàm `restack`
(dòng 668-684): xếp chồng từ `context.graph.building.datumElevationMm`, mỗi
tầng `elevationMm = tầng dưới nó + heightMm của tầng dưới`. Đây không phải
"màn tự cộng" — công thức nằm trong tầng lệnh (`restack`), gọi qua
`createReorderLevelsCommand`, không phải logic màn tự chế.

### `ReorderLevelsInput` + `validateReorderLevels` + `createReorderLevelsCommand`

```
$ grep -n "export interface ReorderLevelsInput\|export function validateReorderLevels\|export function createReorderLevelsCommand" src/lib/commands/business/roomFloorCommands.ts
649:export interface ReorderLevelsInput {
687:export function validateReorderLevels(
751:export function createReorderLevelsCommand(
```

```ts
export interface ReorderLevelsInput {
  readonly levelIds: readonly LevelId[]; // TOÀN BỘ tầng, từ dưới lên
}
export function validateReorderLevels(input, context): string[]
export function createReorderLevelsCommand(input, context): CommandResult
```

Validate đòi ≥2 tầng, không lặp id, không thiếu tầng nào (so với
`levelsInOrder(context)`), mọi `heightMm` > 0, và có ít nhất một tầng thực
sự đổi `order`/`elevationMm` — nếu không sẽ từ chối với "không có gì thay
đổi" (dòng 743-744). `createReorderLevelsCommand` sinh **một** `Command` với
`changes` là `changeForUpdate('level', ...)` cho **mỗi tầng thực sự đổi**
(không đổi thì không có `change`, dòng 761-789) — tức MỘT lệnh, MỘT
`UndoEntry` cho cả lượt sắp xếp lại toàn bộ ngăn xếp (giống
`buildAutoAlignCommand` của trục).

### `shared.ts` — helper dùng chung, mọi lệnh tầng mới phải tuân theo

```
$ grep -n "^export " src/lib/commands/business/shared.ts
```
(đã đọc trực tiếp; các export chính đáng chú ý cho `FloorManager`)

- `CommandContext`, `CommandRefusal`, `CommandResult` (`shared.ts:61,72,80`)
- `buildCommand(type, description, changes, context)` — bọc `createCommand`,
  chuyển tiếp `context.id`/`context.timestamp` (chỉ test/replay)
  (`shared.ts:88-101`).
- `refuse(type, reasons)` / `accept(command)` — dựng `CommandResult`
  (`shared.ts:104,111`).
- `AUTHORED_BY_HAND = { confidence: 1, source: 'human', reviewed: false }`
  (`shared.ts:124-128`) — **A5**: mọi tầng MỚI (thêm/nhân bản) phải mang bộ
  ba này, không được tự đặt `reviewed: true`.
- `entitiesOfKind(graph, kind)`, `idIsTaken(graph, id)`, `readOf(graph, kind, id)`
  — đọc đồ thị an toàn theo kiểu (`shared.ts:135-160`).
- `formatElevationM`, `formatMetres`, `formatCount`, `formatAreaM2` — mọi số
  hiển thị trên thông điệp lỗi/mô tả đi qua đây (R-71/A15), không viết tay
  `toFixed`.

**Không có helper nào sẵn để tạo `Level` mới** (không có `createLevelEntity`
kiểu như `createAxisEntity` của `axisGridManagerGateway.ts`) — cổng của màn
`FloorManager` phải tự dựng object `Level` cho thêm/nhân bản tầng, đúng
khuôn `createAxisEntity` (mục F).

---

## C. `src/lib/mutations/` (D-05 vé hoàn tác)

```
$ grep -n "export const UNDO_WINDOW_MS\|export function createUndoTicket\|export interface UndoTicket\b\|export type UndoTicketStatus\|export interface CreateUndoTicketOptions" src/lib/mutations/undoTicket.ts
18:export const UNDO_WINDOW_MS = 8000;
20:export type UndoTicketStatus = 'active' | 'expired' | 'used';
24:export interface CreateUndoTicketOptions {
31:export interface UndoTicket {
45:export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket {
```

```ts
export const UNDO_WINDOW_MS = 8000; // đúng 8 giây A8

export type UndoTicketStatus = 'active' | 'expired' | 'used';
export type UndoTicketError = 'expired';

export interface CreateUndoTicketOptions {
  description: string;
  now?: () => number;
  ttlMs?: number;   // mặc định UNDO_WINDOW_MS
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

Vé dùng/hết hạn (`undoTicket.ts:45-77`): `getStatus()` trả `'used'` nếu đã
gọi `undo()` thành công, `'expired'` nếu `now() >= expiresAt`, ngược lại
`'active'`. Gọi `undo()` khi không `'active'` trả về `{ ok: false, error:
'expired' }` **và không chạy hàm `undo` gốc** (dòng 59-62) — kể cả khi lý do
là đã `used` chứ không phải hết giờ, message trả về vẫn là `'expired'` (đây
là kiểu lỗi duy nhất `UndoTicketError` khai). Gọi lần đầu trong cửa sổ:
`used = true`, chạy `options.undo()`, trả `{ ok: true }`.

### `createOptimisticMutation.ts`

```
$ grep -n "export interface OptimisticMutationConfig\|export function createOptimisticMutation" src/lib/mutations/createOptimisticMutation.ts
8:export interface OptimisticMutationConfig<TVariables, TResult> {
67:export function createOptimisticMutation<TVariables, TResult>(
```

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

Dùng thế nào cho một thao tác ghi: gọi `createOptimisticMutation(queryClient,
config)` rồi truyền kết quả thẳng vào `useMutation(...)` của react-query. Bên
trong: huỷ query đang chạy cho `affectedKeys(variables)`, chụp ảnh cache, gọi
`applyOptimistic` ngay (hiện thay đổi trước khi server xác nhận), gọi
`callServer`; thành công thì gọi `afterSuccess` (thường để invalidate theo
`invalidationMap`), lỗi thì phục hồi ảnh chụp + gọi `rollback` rồi ném
`AppError`. Các lượt cùng `entityId` được xếp hàng qua `runExclusive` (không
chạy chồng nhau, `createOptimisticMutation.ts:6,73`).

### `notificationBus.ts`, `coalesce.ts`, `entityQueue.ts`, `flushPolicy.ts` — cái nào màn cần

- **`notificationBus.ts`** (`createNotificationBus`): CẦN — đây là nơi toast
  hoàn tác 8 giây thực sự hiện ra. `publish({ description, title, type,
  undoTicket })` — nếu `undoTicket` có mặt, `scheduleRemoval` tự đặt
  `setTimeout` xoá thông báo đúng lúc `ticket.expiresAt` (`notificationBus.ts:109-120`),
  tức đúng khi vé 8 giây hết hạn — không hằng số nào viết tay ở đây. Cùng
  loại publish trong `groupWindowMs` (mặc định 5000 ms) gộp thành một thông
  báo dùng `formatUndoGroupLabel` (`i18n/vi.json` → `common.undo_group`).
  Xoá NHIỀU tầng liên tiếp (nếu màn cho phép) sẽ tự gộp qua đường này, không
  cần màn tự viết logic gộp.
- **`coalesce.ts`**: KHÔNG cần trực tiếp — đây là công thức gộp lệnh gửi lên
  server theo lô (dùng trong `flushPolicy`), phục vụ khi một thực thể bị sửa
  liên tục (kéo). Xoá/thêm/nhân bản/đổi thứ tự tầng là các thao tác rời rạc,
  không phải chuỗi kéo liên tục — không cần `coalesce` trực tiếp, nhưng
  `MERGE_WINDOW_MS` của `mergeCommands.ts` **tái dùng đúng hằng
  `COALESCE_WINDOW_MS` này** (`mergeCommands.ts:23,34`) nên nó vẫn nằm trong
  đường đi gián tiếp.
- **`entityQueue.ts`** (`runExclusive`): CẦN gián tiếp — `dispatch`,
  `runTransaction` và `createOptimisticMutation` đều tự dùng nó
  (`dispatch.ts:54,701`); màn không cần gọi trực tiếp trừ khi có một thao
  tác ghi ngoài luồng `dispatch`/`createOptimisticMutation`.
- **`flushPolicy.ts`** (`createFlushPolicy`): KHÔNG cần — đây là chính sách
  gộp+xả một hàng đợi lệnh ghi liên tục lên server (dùng cho kiểu thao tác
  vẽ/kéo tường), không khớp với các thao tác tầng rời rạc của
  `FloorManager`.

---

## D. `src/lib/query/` (R-64)

```
$ grep -n "^export const queryKeys" -A2 src/lib/query/queryKeys.ts
66:export const queryKeys = {
```

```
$ grep -n "floor:\|level" src/lib/query/queryKeys.ts
70:  floor: {
71:    detail: createQueryKeyFactory(floorDetailRoot, (floorId: string) => [...floorDetailRoot, floorId] as const),
72:    list: createQueryKeyFactory(floorListRoot, (projectId: string) => [...floorListRoot, projectId] as const),
73:  },
```

Tên đúng là `queryKeys` (không phải `queryKeys` khác tên gì). Chưa có domain
`level` nào trong `QueryDomain` (`queryKeys.ts:3-14`: chỉ `drawing | floor |
library | progress | project | quality | room | space | user | version |
violation`) — danh sách tầng của một dự án dùng domain `floor`.

**CÂU HỎI — có key nào cho danh sách tầng của một dự án chưa? Tên đúng là
gì?**

**CÓ.** `queryKeys.floor.list(projectId: string)` → khoá
`['floor', 'list', projectId]` (`queryKeys.ts:52,71-72`). Đây đúng là khoá
`FloorManager` phải cắm vào để đọc danh sách tầng — không phải "NOT FOUND".
Cũng có `queryKeys.floor.detail(floorId: string)` → `['floor', 'detail',
floorId]` (`queryKeys.ts:53,71`) cho một tầng riêng lẻ, nếu màn cần đọc chi
tiết một tầng ngoài danh sách.

`cachePolicy.ts` — domain `floor` **không** có trong `TIER_BY_DOMAIN`
(`cachePolicy.ts:77-84`: chỉ `drawing/library/progress/room/space/user`) nên
`queryKeys.floor.*` rơi vào tier **`default`**: `staleTime` 30 000 ms,
`gcTime` 600 000 ms (`cachePolicy.ts:34-37`).

`invalidation.ts` — `invalidationMap` (`invalidation.ts:48-116`) **không có
khoá `WriteOperation` nào tên `addFloor`/`deleteFloor`/`reorderFloors`**;
bảy toán tử hiện có (`WRITE_OPERATIONS`, dòng 5-16) là
`createProject/editFloor/editWall/moveFurniture/editDimension/changeAxis/
rerunRules/restoreVersion/straightenDrawing/setDrawingCorners`. Gần nhất là
`editFloor: ({ projectId, floorId }) => [queryKeys.floor.detail(floorId),
queryKeys.floor.list(projectId)]` (`invalidation.ts:51-54`) — làm mất hiệu
lực đúng hai khoá `FloorManager` cần, nhưng tên toán tử ngụ ý sửa MỘT tầng,
không phải thêm/xoá/sắp xếp lại. **NOT FOUND: toán tử `invalidationMap` dành
riêng cho thêm/nhân bản/xoá/sắp xếp lại tầng** — cổng của màn có hai lựa
chọn không cần sửa `src/lib`: (a) tự gọi
`queryClient.invalidateQueries({ queryKey: queryKeys.floor.list(projectId) })`
trực tiếp sau khi ghi (đúng khuôn mà `axisGridManagerGateway.ts` không cần
vì nó không dùng `invalidationMap`/react-query — nó ghi thẳng qua `commit`),
hoặc (b) tái dùng `editFloor` cho từng tầng bị ảnh hưởng. R-68 cấm thêm khoá
mới vào `invalidationMap` (đó là sửa `src/lib`), nên cổng màn phải tự
invalidate bằng tay nếu đi qua react-query, **hoặc** đi thẳng qua `commit` +
`HistoryStack` như trục đã làm và không đụng tới tầng query/mutation này chút
nào (xem mục F — cách `axisGridManagerGateway.ts` chọn).

---

## E. `src/api/endpoints.ts` + kiểu yêu cầu/phản hồi

```
$ grep -n "floors:\|spatial:" -A6 src/api/endpoints.ts
42:  floors: {
43:    create: FLOORS_ROOT,
44:    delete: (floorId: string): string => `${FLOORS_ROOT}/${floorId}`,
45:    list: FLOORS_ROOT,
46:    reorder: `${FLOORS_ROOT}/reorder`,
47:  },
...
76:  spatial: {
77:    floor: (projectId: string, floorId: string): string =>
78:      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/spatial`,
79:    version: (projectId: string, versionId: string): string =>
80:      `${PROJECTS_ROOT}/${projectId}/versions/${versionId}`,
81:  },
```

**PHÁT HIỆN QUAN TRỌNG — khác với tiền lệ trục:** `ENDPOINTS.floors` có
**CẢ BỐN** đường: `create`, `delete(floorId)`, `list`, `reorder`. Khớp với
`FloorsApi` trong `src/api/client.ts`:

```
$ grep -n "export interface FloorsApi" -A5 src/api/client.ts
197:export interface FloorsApi {
198:  create(input: CreateFloorInput): Promise<ApiResult<Floor>>;
199:  delete(input: DeleteFloorInput): Promise<ApiResult<Floor>>;
200:  list(options?: RequestOptions): Promise<ApiResult<Floor[]>>;
201:  reorder(input: ReorderFloorsInput): Promise<ApiResult<Floor[]>>;
202:}
```

```
$ grep -n "export interface FloorWriteBody\|export interface CreateFloorInput\|export interface ReorderFloorsInput\|export interface DeleteFloorInput\|export interface PatchSpatialFloorInput" src/api/client.ts
87:export interface FloorWriteBody extends Omit<FloorPayload, 'elevationMm' | 'heightMm' | 'name' | 'order'> {
94:export interface CreateFloorInput extends WriteRequestOptions {
98:export interface ReorderFloorsInput extends WriteRequestOptions {
104:export interface DeleteFloorInput extends WriteRequestOptions {
144:export interface PatchSpatialFloorInput extends WriteRequestOptions {
```

```ts
export interface FloorWriteBody extends Omit<FloorPayload, 'elevationMm'|'heightMm'|'name'|'order'> {
  elevationMm: FloorElevationMm;
  heightMm: FloorHeightMm;
  name: FloorName;
  order: FloorOrder;
  // kế thừa từ FloorPayload: areaM2?, drawings?
}
export interface CreateFloorInput extends WriteRequestOptions { body: FloorWriteBody; }
export interface ReorderFloorsInput extends WriteRequestOptions { body: { floorIds: string[] }; }
export interface DeleteFloorInput extends WriteRequestOptions { floorId: string; }
export interface PatchSpatialFloorInput extends WriteRequestOptions {
  body: Partial<FloorWriteBody>; floorId: string; projectId: string;
}
```

(`FloorPayload`: `src/api/contracts.ts:87-94` — `areaM2?`, `drawings?`,
`elevationMm?`, `heightMm?`, `name?`, `order?`.)

**CÂU HỎI TRỌNG TÂM 3 — có endpoint TẠO / XOÁ / đổi thứ tự tầng không? Thân
yêu cầu ghi tầng mang được trường nào?**

**CÓ CẢ BA**, khác hẳn tiền lệ trục (nơi `persistAxisGrid`/`persistAxisOrigin`
là `NOT FOUND` tuyệt đối):

- **Tạo tầng**: `ENDPOINTS.floors.create` (`POST /floors`, thân
  `FloorWriteBody`: `name`, `order`, `elevationMm`, `heightMm`, `areaM2?`,
  `drawings?`) → `floors.create(input)` trả `Promise<ApiResult<Floor>>`
  (`client.ts:198,392-396`). Nhân bản tầng dùng được endpoint này: gọi
  `create` với các trường sao chép từ tầng gốc (tên đổi, id do server cấp).
- **Xoá tầng**: `ENDPOINTS.floors.delete(floorId)` (`DELETE
  /floors/:floorId`), input chỉ cần `floorId` → `floors.delete(input)`
  (`client.ts:199,401-405`). Không cần thân yêu cầu, đúng khớp với "xoá tầng
  dùng vé hoàn tác 8 giây chứ KHÔNG hộp thoại" — server xoá ngay, hoàn tác ở
  client là tạo lại qua `floors.create` khi vé còn hiệu lực.
- **Đổi thứ tự**: `ENDPOINTS.floors.reorder` (`PATCH /floors/reorder`),
  thân `{ floorIds: string[] }` → `floors.reorder(input)` trả
  `Promise<ApiResult<Floor[]>>` (`client.ts:201,408-416`). Khớp thẳng với
  `ReorderLevelsInput.levelIds` của tầng lệnh (mục B) — thứ tự trong mảng là
  thứ tự xếp chồng.
- **Đổi cao độ** (không phải tạo/xoá/sắp xếp, nhưng liên quan): đi qua
  `ENDPOINTS.spatial.floor(projectId, floorId)` (`PATCH .../spatial`), thân
  `Partial<FloorWriteBody>` → `spatial.patchFloor(input)`
  (`client.ts:234,482-490`). Đây là con đường sẵn có để lưu
  `level.changeElevation` lên server.

**Floor (API) và Level (domain) là hai kiểu riêng, không dùng chung id
brand:**

```
$ grep -n "export interface FloorWireInput" -A9 src/api/contracts.ts
107:export interface FloorWireInput {
108:  areaM2?: FloorAreaM2;
109:  drawings?: Drawing[];
110:  elevationMm: FloorElevationMm;
111:  heightMm: FloorHeightMm;
112:  id: string;
113:  name: string;
114:  order: FloorOrder;
```

`Floor.id` (và `FloorWireInput.id`) là `string` trần — không phải `LevelId`
có brand (`domain/spatial/ids.ts`). Cổng của màn phải tự đổi qua lại giữa
`Floor` (máy chủ) và `Level` (đồ thị đang sửa) — đúng loại "chỗ hai vựng gặp
nhau" mà `axisGridManagerGateway.ts` đã làm cho trục
(`createAxisGridSampleGraph`, mục F).

---

## F. `src/screens/qc/AxisGridManager/axisGridManagerGateway.ts` — khuôn phải chép

Cấu trúc file (1297 dòng), theo đúng thứ tự xuất hiện:

1. **JSDoc đầu file** (dòng 1-61) — ghi lại NGUYÊN quyết định kiến trúc Q1
   (lệnh trục dựng trong cổng bằng `createCommand` + `changeFor*`, vì
   `CommandType` mở và chỉ `change.kind` bị so bảng), quyết định đã sửa về
   gốc toạ độ, và hai việc `NOT FOUND` (`persistAxisGrid`/
   `persistAxisOrigin`). **`FloorManager` nên mở đầu file gateway của mình
   bằng đúng khuôn JSDoc này** — nhưng phần "hai việc chưa có đường" sẽ khác
   nhau: trục có 2 `NOT FOUND` tuyệt đối, tầng có 0 (mục E đã chỉ ra ba việc
   thêm/xoá/sắp xếp và đổi cao độ đều có endpoint thật).

2. **Danh sách khả năng** (dòng 131-179):
   ```ts
   export const AXIS_GRID_CAPABILITIES = ['readAxisLayer', 'readAxisGraph',
     'writeAxisGraph', 'persistAxisGrid', 'persistAxisOrigin'] as const;
   export type AxisGridCapability = (typeof AXIS_GRID_CAPABILITIES)[number];
   export const AXIS_GRID_MISSING_CAPABILITIES = ['persistAxisGrid', 'persistAxisOrigin'] as const;
   export type AxisGridMissingCapability = (typeof AXIS_GRID_MISSING_CAPABILITIES)[number];
   export const AXIS_GRID_MISSING_ENDPOINTS: Readonly<Record<AxisGridMissingCapability, string>> = { ... };
   export interface AxisGridUnsupported { readonly supported: false; readonly capability: ...; readonly missing: string; }
   export interface AxisGridSupported<TValue> { readonly supported: true; readonly value: TValue; }
   export type AxisGridCapabilityResult<TValue> = AxisGridSupported<TValue> | AxisGridUnsupported;
   export function unsupported(capability): AxisGridUnsupported { ... }
   ```
   Khuôn cho `FloorManager`: `FLOOR_MANAGER_CAPABILITIES` (vd `readFloors`,
   `writeFloorGraph`, `persistAddFloor`, `persistDuplicateFloor`,
   `persistRemoveFloor`, `persistReorderFloors`, `persistChangeElevation`),
   `FLOOR_MANAGER_MISSING_CAPABILITIES` — theo khảo sát mục E, danh sách này
   **có thể rỗng** (mọi khả năng đều có endpoint thật), khác hẳn trục. Nếu
   rỗng thì không cần `unsupported()`/nhánh `supported: false` cho các thao
   tác CRUD tầng — nhưng vẫn giữ hình dạng `CapabilityResult<TValue>` cho
   nhất quán và để đường lùi nếu một khả năng nào đó (vd `nhân bản tầng` cần
   endpoint riêng chứ không tái dùng `create`) hoá ra không đi được khi
   T5 viết code thật.

3. **Hằng số ngưỡng riêng của màn** (dòng 182-199): `MIN_AXIS_SPACING_MM` —
   ví dụ cho việc đặt hằng cạnh hàm dùng nó khi `src/domain` chưa có module
   phù hợp, thay vì viết vào `src/lib`.

4. **Hình học/đọc đồ thị thuần** (dòng 201-611): `boundsOfPoints`,
   `levelsOf`, `levelOf`, `axesOfLevel`, `wallsOfLevel`,
   `detectAxesOfLevel`, `floorPlansOf`… — đọc `NormalizedSpatial` ra dạng
   màn cần, gọi hàm `src/domain` có sẵn, không tự tính hình học.
   `FloorManager` tương ứng cần ít nhất `levelsOf(graph)` (đã có sẵn, dùng
   lại được nguyên hàm — cùng file, cùng chữ ký) để liệt kê tầng theo đúng
   thứ tự đồ thị giữ.

5. **Tầng lệnh dựng trong cổng** (dòng 688-879): ba khối,
   - hằng tên loại lệnh (`AXIS_COMMAND_TYPES`, dòng 699-706) — khuôn cho
     `FLOOR_COMMAND_TYPES = { add: 'level.add', duplicate: 'level.duplicate',
     remove: 'level.remove' } as const` (ba lệnh còn thiếu theo mục kết
     luận);
   - hàm mô tả tiếng Việt cho từng loại (`addAxisDescription`,
     `removeAxisDescription`…, dòng 709-725) — mô tả này là nhãn hoạt động
     VÀ (nếu `command.type` kết thúc bằng `.add`/`.remove` mà không khớp
     `ACTION_LABELS`/`KIND_LABELS` của `history.ts`) là nguồn cho
     `buildHistoryLabel` fallback;
   - hàm dựng `Command | null` (`buildAddAxisCommand`,
     `buildRemoveAxisCommand`, `buildMoveAxisCommand`, dòng 743-798) — mỗi
     hàm gọi `createCommand` + đúng một trong `changeForAdd`/
     `changeForRemove`/`changeForUpdate`, trả `null` khi không có gì để
     làm (validateCommands sẽ từ chối lệnh rỗng, nên tránh dựng nó).
     **Không có hàm `create*Entity` nào cho `Level` trong repo** (chỉ có
     `createAxisEntity`, dòng 612-658, cho `Axis`) — cổng `FloorManager`
     phải tự viết `createLevelEntity(input): Level`, theo đúng khuôn: dùng
     `AUTHORED_BY_HAND`-tương-đương (`confidence: 1, source: 'human',
     reviewed: false`, mục B/A5), `id` từ `createId('level')`,
     `elevationMm`/`heightMm`/`order` từ input người dùng hoặc tính đơn giản
     (không gọi công thức nghiệp vụ mới — chỉ gán).

6. **Đường ghi qua `dispatch`** (dòng 881-976):
   ```ts
   export interface AxisGridGraphPort { readonly read: () => NormalizedSpatial | null; }
   export function createCommitSpatialPort(graph, labelOf): SpatialPort { ... commit(patches, labelOf()) ... }
   export interface AxisGridDispatchDeps { readonly deps: DispatchDeps; readonly history: HistoryStack; readonly setLabel: (label: string) => void; }
   export interface CreateAxisGridDispatchOptions { readonly graph; readonly selectionBefore; readonly selectionAfter; readonly onSynced; readonly history?: HistoryStack; }
   export function createAxisGridDispatchDeps(options): AxisGridDispatchDeps { ... }
   export async function runAxisCommand(command, bundle): Promise<DispatchResult> { bundle.setLabel(command.description); return dispatch(command, bundle.deps); }
   export const NO_AXIS_SELECTION: SelectionSnapshot = NO_SELECTION;
   ```
   `SpatialPort.applyPatches` gọi thẳng `commit(patches, label)` của store
   (A10) — **không** `set()`. `sync.enqueue` gọi `onSynced()` (đánh dấu bẩn
   cho autosave A7), **không tự POST lên server** ở đây — với trục vì không
   có endpoint; với tầng, `FloorManager` có thể (và nên, vì endpoint có
   thật) làm khác: `sync.enqueue` hoặc một cổng riêng gọi thật
   `floors.create`/`floors.delete`/`floors.reorder`/`spatial.patchFloor` sau
   khi `commit` đã cập nhật đồ thị cục bộ — đây là điểm khác biệt lớn nhất
   với khuôn trục, T5 cần được nói rõ.

7. **Vé hoàn tác** (dòng 978-1015): `AXIS_AUTO_ALIGN_NOTIFICATION_TYPE`,
   `AXIS_REMOVE_NOTIFICATION_TYPE` (hằng chuỗi loại thông báo),
   `removeToastDescription(label)`, `createAxisUndoTicketOptions`,
   `createAxisUndoTicket(options)` — bọc `createUndoTicket` của
   `src/lib/mutations/undoTicket.ts`, không viết lại `UNDO_WINDOW_MS`.
   `undo` trỏ vào `history.undo()` của `HistoryStack` (ngăn xếp S-06),
   **không phải** `CommitResult.undo` của zundo. Khuôn thẳng cho lượt xoá
   tầng của `FloorManager`: `FLOOR_REMOVE_NOTIFICATION_TYPE`,
   `removeFloorToastDescription(name)`, `createFloorUndoTicket(...)`.

8. **`interface AxisGridManagerGateway`** (dòng 1043-1066): `supports:
   Readonly<Record<AxisGridCapability, boolean>>`, các phương thức đọc/ghi
   (`readAxisLayer`, `graph`, `persistAxisGrid`, `persistAxisOrigin`,
   `nextAxisId`, `scale`, `actorId`, `now`). Khuôn cho
   `FloorManagerGateway`: `supports`, `readFloors`, `graph`,
   `persistAddFloor`/`persistDuplicateFloor`/`persistRemoveFloor`/
   `persistReorderFloors`/`persistChangeElevation` (tất cả CÓ đường thật
   theo mục E — kiểu trả `Promise<Floor>`/`Promise<Floor[]>` thật, không
   cần bọc `CapabilityResult` nếu không có khả năng nào `NOT FOUND`),
   `nextLevelId`, `actorId`, `now`.

9. **`createAxisGridManagerGateway(options)`** — cổng thật (dòng 1087-1115):
   `graph` mặc định đọc `useStore.getState().spatial`; `supports` khai cứng
   `true`/`false` theo từng khả năng; `persistAxisGrid`/`persistAxisOrigin`
   trả `unsupported(...)`. Khuôn cho `FloorManager`: cổng thật gọi
   `apiClient.floors.create/delete/reorder` và
   `apiClient.spatial.patchFloor` thật (không có nhánh `unsupported` cho các
   khả năng này), rồi `commit` + `dispatch` để đồ thị cục bộ khớp phản hồi.

10. **Bộ mẫu cho test/story (R-73)** (dòng 1117-1297):
    `AXIS_GRID_SAMPLE_BUILDING`, `createAxisGridSampleGraph(options)`,
    `AXIS_GRID_SAMPLE_LEVEL_ID`, `interface AxisGridGatewaySeed`,
    `createMockAxisGridManagerGateway(seed)`. Cổng mẫu dùng CHUNG một bộ dữ
    liệu (`axisGridFixture.ts`) cho cả test và story — không bịa bảng dữ
    liệu thứ hai (R-70). `FloorManager` cần một `floorManagerFixture.ts`
    tương tự và `createMockFloorManagerGateway(seed)` cùng khuôn — `seed`
    nên có ít nhất `graph?`, `failReadFloors?`, `actorId?`, `now?`,
    `nextLevelId?`.

---

## Kết luận

**Thêm tầng / nhân bản tầng / xoá tầng GHÉP ĐƯỢC bằng nguyên thuỷ có sẵn —
KHÔNG cần sửa `src/lib`.** Cả ba dùng `createCommand` + `changeForAdd`/
`changeForRemove` với `kind: 'level'` (EntityKind có sẵn), giống hệt cách
`axisGridManagerGateway.ts` đã làm cho `axis.add`/`axis.remove`/`axis.move`.
`CommandType` mở (`string`) nên `level.add`/`level.duplicate`/`level.remove`
không cần đăng ký ở đâu cả — `validateCommands` chỉ so `change.kind`.

Ba mảnh còn thiếu, T5 cần làm (không phải "thiếu nguyên thuỷ", mà là "chưa
ai viết"):

1. **`createLevelEntity(input): Level`** trong gateway — không có sẵn hàm
   nào dựng `Level` mới (khác trục, nơi `createAxisEntity` đã có sẵn).
2. **Chặn trùng cao độ giữa hai tầng bất kỳ** — `validateChangeLevelElevation`
   chỉ chặn chồng lấn với hai tầng liền kề (mục B, câu hỏi trọng tâm 1); nếu
   đặc tả đòi so với TẤT CẢ tầng, gateway của màn phải tự thêm bước đó
   (đọc `levelsOf(graph)`, so từng cặp bằng `nearlyEqualLength`) — vẫn không
   phải sửa `src/lib`, chỉ là logic cổng, đúng như trục tự viết
   `findSpacingViolation`.
3. **Đường ghi thật lên server** — khác trục (`NOT FOUND` tuyệt đối), tầng
   **CÓ** endpoint thật cho cả bốn việc (tạo/xoá/sắp xếp/đổi cao độ — mục
   E). Gateway thật nên gọi `apiClient.floors.*` và
   `apiClient.spatial.patchFloor` thay vì trả `unsupported(...)` — đây là
   khác biệt kiến trúc quan trọng nhất so với tiền lệ trục, và điều phối
   viên/T5 cần quyết định rõ: đồ thị cục bộ (`commit`) đi trước rồi đồng bộ
   server sau (như trục định làm nếu có đường), hay đợi phản hồi server rồi
   mới `commit` (kiểu `createOptimisticMutation`). Khảo sát này không tự
   chọn thay — đó là quyết định kiến trúc của điều phối viên.

Không phát hiện thêm `NOT FOUND` nào khác ngoài hai điểm ở mục B (câu hỏi 1)
và mục D (toán tử `invalidationMap` riêng cho tầng).

---

## Kết quả cổng chất lượng (chạy trên cây hiện có, chưa sửa gì)

- `pnpm typecheck` — **ĐẠT**. `tsc --noEmit` không in lỗi nào (exit 0).
- `pnpm lint` — **ĐẠT**. `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` không in cảnh báo/lỗi nào (exit 0).
- `pnpm test` / `pnpm coverage` / `pnpm build` / `pnpm e2e` — **chưa chạy**
  (ngoài phạm vi khảo sát chỉ-đọc; không ghi "đạt" cho các bước này, theo
  E.10).
