# Hợp đồng tầng lệnh cho S-18 "Chuẩn hoá độ dày tường"

Tài liệu này là hợp đồng ĐÃ XÁC MINH bằng cách đọc mã nguồn — không phỏng đoán. T5
đọc file này để dựng gateway + hook, KHÔNG cần mở lại các file được trích dẫn.

---

## 1. Chữ ký đầy đủ

### `runTransaction` — `src/lib/commands/transaction.ts:53`

```ts
export interface TransactionOptions {
  readonly label?: string; // nhãn tiếng Việt của MỘT mục hoàn tác duy nhất
}

export function runTransaction(
  commands: readonly Command[],
  deps: DispatchDeps,
  options: TransactionOptions = {},
): Promise<DispatchResult>
```

Chạy `commands` như MỘT đơn vị qua đúng năm bước của `dispatch`
(`validate → apply → history → rules → sync`), dưới cùng một khoá
(`runExclusive(SPATIAL_PIPELINE_KEY, …)`, `transaction.ts:60`). Không bao giờ
`reject`; thất bại trả về `{ ok: false, error }`.

### `DispatchDeps` — `src/lib/commands/dispatch.ts:156-163`

```ts
export interface DispatchDeps {
  readonly spatial: SpatialPort;
  readonly history: HistoryPort;
  readonly rules: RulesPort;
  readonly sync: SyncPort;
  readonly now?: () => string; // đồng hồ cho timestamp của batch; mặc định đồng hồ thật
}
```

`SpatialPort` (`dispatch.ts:124-129`): `read(): NormalizedSpatial | null`,
`applyPatches(patches: readonly SpatialPatch[]): void`.
`HistoryPort` (`dispatch.ts:132-136`): `push(entry: UndoEntry): void`,
`drop(entryId: UndoEntryId): void`.
`RulesPort` (`dispatch.ts:145-148`): `run(graph, changes): RuleRunResult`,
`write(result): void`.
`SyncPort` (`dispatch.ts:151-153`): `enqueue(batch: DispatchBatch): MaybePromise<void>`.

### `DispatchResult` — `dispatch.ts:192-199`

```ts
export interface DispatchSuccess {
  readonly entry: UndoEntry;       // mục vừa đẩy vào ngăn xếp hoàn tác
  readonly rules: RuleRunResult;   // kết quả soát luật trên bản vẽ sau khi áp
}
export interface DispatchFailure {
  readonly stage: DispatchStage;               // bước nào chặn
  readonly message: string;                    // câu tiếng Việt
  readonly reasons: readonly string[];         // không bao giờ rỗng
  readonly cause: unknown;
  readonly rolledBack: boolean;
  readonly rollbackIssues: readonly RollbackIssue[];
}
export type DispatchResult = Result<DispatchSuccess, DispatchFailure>;
// Result<T, E> = { ok: true; data: T } | { ok: false; error: E } — src/lib/http/types.ts:3-8
```

### `CommandContext` — `src/lib/commands/business/shared.ts:61-69`

```ts
export interface CommandContext {
  readonly graph: NormalizedSpatial; // bản vẽ tại thời điểm dựng lệnh
  readonly actorId: string;
  readonly id?: CommandId;           // chỉ cho test/replay
  readonly timestamp?: string;       // chỉ cho test/replay
}
```

### `CommandResult` — `shared.ts:71-80`

```ts
export interface CommandRefusal {
  readonly type: CommandType;
  readonly reasons: readonly string[]; // không bao giờ rỗng
}
export type CommandResult = Result<Command, CommandRefusal>;
```

### `Command` — `src/lib/commands/types.ts:75-86`

```ts
export interface Command {
  id: CommandId;               // "C-..."
  type: CommandType;            // string mở, ví dụ "wall.changeThickness"
  timestamp: string;            // ISO 8601
  actorId: string;
  description: string;          // tiếng Việt, hiện trên nhật ký + nút hoàn tác
  changes: readonly EntityChange[];
  scope: CommandScope;           // { entityIds, levelIds, kinds } — tự suy ra, không tự viết
}
```

### `createChangeWallThicknessCommand` / `validateChangeWallThickness` — `src/lib/commands/business/wallCommands.ts:420-489`

```ts
export interface ChangeWallThicknessInput {
  readonly wallId: WallId;
  readonly thicknessMm: number;
}

export function validateChangeWallThickness(
  input: ChangeWallThicknessInput,
  context: CommandContext,
): string[] // rỗng = hợp lệ

export function createChangeWallThicknessCommand(
  input: ChangeWallThicknessInput,
  context: CommandContext,
): CommandResult
```

Lý do từ chối (mảng câu tiếng Việt, `wallCommands.ts:430-451`): không tìm thấy
tường; độ dày ngoài khoảng `MIN_WALL_THICKNESS_MM`–`MAX_WALL_THICKNESS_MM`
(60–600 mm, `src/domain/walls/types.ts`); độ dày mới **bằng hệt** độ dày cũ
(no-op) → bị từ chối, KHÔNG sinh lệnh. Khi chấp nhận, mô tả lệnh tự nêu độ dày
chuẩn gần nhất nếu có (`nearestStandardThickness`, `wallCommands.ts:477-484`).

### `createHistoryStack` / `HistoryStack` / `HistoryStep` / `HistoryPushInput` / `HistoryTransition` — `src/lib/commands/history.ts`

```ts
export const MAX_HISTORY_STEPS = 100; // history.ts:41

export interface HistoryPushInput {           // history.ts:82-88
  readonly entry: UndoEntry;
  readonly selectionBefore: SelectionSnapshot;
  readonly selectionAfter: SelectionSnapshot;
}

export interface HistoryStep {                // history.ts:61-79
  readonly id: UndoEntryId;
  readonly label: string;
  readonly commands: readonly Command[];       // >1 phần tử khi là một transaction
  readonly undoPatches: readonly SpatialPatch[];
  readonly redoPatches: readonly SpatialPatch[];
  readonly selectionBefore: SelectionSnapshot;
  readonly selectionAfter: SelectionSnapshot;
  readonly timestamp: string;
  readonly entryIds: readonly UndoEntryId[];   // >1 khi các bước nhỏ đã fold vào nhau
}

export interface HistoryTransition {          // history.ts:91-98
  readonly direction: 'undo' | 'redo';
  readonly step: HistoryStep;
  readonly patches: readonly SpatialPatch[];   // áp thẳng vào graph
  readonly selection: SelectionSnapshot;       // rồi khôi phục vùng chọn này
}

export interface HistoryStack {               // history.ts:100-128
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

export function createHistoryStack(options?: {
  limit?: number;        // mặc định MAX_HISTORY_STEPS
  mergeWindowMs?: number; // mặc định MERGE_WINDOW_MS (= COALESCE_WINDOW_MS, 400 ms)
}): HistoryStack
```

### `createUndoTicket` / `UndoTicket` — `src/lib/mutations/undoTicket.ts:18-77`

```ts
export const UNDO_WINDOW_MS = 8000; // A8

export interface CreateUndoTicketOptions {
  description: string;
  now?: () => number;
  ttlMs?: number; // mặc định UNDO_WINDOW_MS
  undo: () => void;
}
export interface UndoTicket {
  description: string;
  expiresAt: number;
  getStatus: () => 'active' | 'expired' | 'used';
  id: string;
  undo: () => Result<void, 'expired'>;
}
export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket
```

### `invertCommand` — `src/lib/commands/invert.ts:43-47`

```ts
export function invertCommand(command: Command): Command
```

Hoán đổi `before`/`after` của MỌI `change`, đảo thứ tự mảng `changes`, và bật/tắt
tiền tố `"Hoàn tác: "` trên `description` (`toggleUndoDescription`,
`invert.ts:21-24`). Là một phép **đối hợp** (involution):
`invertCommand(invertCommand(x)) === x` (về giá trị).

---

## 2. Đường dựng MỘT lệnh lô cho N tường — QUYẾT ĐỊNH: chọn (a), có tiền lệ đã chạy

**Kết luận dứt khoát: (a) — N lệnh `createChangeWallThicknessCommand` đưa vào
MỘT lời gọi `runTransaction` — sinh ĐÚNG MỘT bước lịch sử.** Đây KHÔNG phải suy
đoán: `runCommandPipeline` (`dispatch.ts:468-684`) — cái mà cả `dispatch` lẫn
`runTransaction` cùng gọi — chỉ gọi `deps.history.push(entry)` **đúng một lần**
cho mỗi lần chạy pipeline (`dispatch.ts:605-626`), bất kể `input.commands` có
bao nhiêu phần tử:

```ts
// dispatch.ts:605-611
const batch: DispatchBatch = {
  id: createUndoEntryId(),
  label: input.label,
  commands: [...input.commands],   // CẢ N lệnh nằm trong MỘT batch
  timestamp: now(),
};
const entry: UndoEntry = { ...batch, undoPatches: undoPatchesOf(input.commands) };
pushedEntry = entry;
const pushed = attempt(() => { deps.history.push(entry); }); // GỌI ĐÚNG MỘT LẦN
```

Và `HistoryStack.push` (`history.ts:298-325`) tạo đúng MỘT `StackRecord` mới cho
mỗi lời gọi `push` (trừ khi fold vào bước liền trước — xem mục 3, KHÔNG áp dụng
cho transaction). Vậy giả thiết "(a) sinh N bước" trong đặc tả gốc là SAI với mã
hiện tại — (a) đã đúng là một bước, không cần phương án (b).

**Tiền lệ đã chạy trong repo, đúng khuôn N-lệnh-khác-loại → một bước:**
`src/screens/qc/FloorManager/floorManagerGateway.ts:1022-1037`:

```ts
/** Chạy NHIỀU lệnh như MỘT bước lịch sử. */
export async function runFloorTransaction(
  commands: readonly Command[],
  bundle: FloorManagerDispatchDeps,
  label: string,
): Promise<DispatchResult> {
  bundle.setLabel(label);
  return runTransaction(commands, bundle.deps, { label });
}
```

(dùng cho `createChangeFloorHeightCommands` — 2 lệnh `level.changeHeight` +
`level.reorder`, gộp bằng đúng cơ chế này — `floorManagerGateway.ts:41-54`).
T5 chép đúng khuôn `runFloorTransaction`, đặt tên `runWallThicknessTransaction`
(hoặc tương đương) trong thư mục màn mới, KHÔNG import chéo từ `FloorManager`.

**Vì sao KHÔNG chọn (b) (một lệnh mang N `changeForUpdate`, khuôn
`buildNormalizeNamesCommand`, `RoomLabelReview/roomLabelReviewGateway.ts:1325-1347`):**
khuôn (b) tồn tại vì `mergeCommands` không gộp được các lệnh cùng loại nhưng
khác tập thực thể — nhưng đó là lý do để KHÔNG dùng một vòng lặp `dispatch()`
riêng lẻ cho từng phòng, chứ không phải lý do để bỏ `runTransaction`.
`runTransaction` không đi qua `mergeCommands` ở đường này chút nào (`mergeCommands`
chỉ chạy bên trong `HistoryStack.push` để fold một `push` MỚI vào bước NGAY
TRƯỚC nó — mục 3). Dùng (a) còn giữ được validate-per-wall có sẵn của
`createChangeWallThicknessCommand` (khoảng 60–600 mm, no-op) mà (b) phải tự
chép lại bằng tay.

**Khuôn ráp cho T5** (trong gateway của màn mới):

```ts
const context = commandContextOf(graph, actorId); // MỘT graph snapshot cho cả lô — an toàn
                                                     // vì mỗi lệnh nhắm một wallId khác nhau,
                                                     // không có lệnh nào cần đọc kết quả lệnh trước
const built = targets.map((t) => createChangeWallThicknessCommand(t, context));
const commands = built.filter((r): r is Extract<typeof r, { ok: true }> => r.ok).map((r) => r.data);

if (commands.length === 0) {
  // Không tường nào thực sự đổi (đã đúng chuẩn, hoặc ngoài khoảng) — KHÔNG gọi
  // runTransaction: validateCommands([], graph) từ chối với 'Không có lệnh nào
  // để chạy.' (dispatch.ts:223-227). Trạng thái "không có gì để áp" là của màn.
} else {
  await runTransaction(commands, bundle.deps, { label: `Chuẩn hoá độ dày ${commands.length} tường.` });
}
```

**Bẫy cần tránh**: nếu `targets` chứa trùng `wallId` (hai dòng cùng sửa một
tường), cả hai lệnh được dựng từ CÙNG một `context.graph` gốc — `validateCommands`
không so khớp `before` theo giá trị (chỉ so null/không-null,
`dispatch.ts:311-317`), nên lệnh thứ hai vẫn qua được và áp full-snapshot đè lên
lệnh thứ nhất (lệnh sau thắng, không lỗi nhưng lãng phí một bước hoàn tác chứa
một thay đổi vô nghĩa). Loại trùng `wallId` bằng `Map` TRƯỚC khi dựng lệnh.

**Cấm áp trước khi bấm**: đúng theo cấm tuyệt đối của đặc tả — bước dựng `commands`
ở trên là THUẦN (không gọi `runTransaction`); chỉ nhánh xử lý sự kiện "bấm Áp"
mới gọi `runTransaction`. Kéo ngưỡng/xem trước chỉ được đọc `createChangeWallThicknessCommand`
kiểu "khô" (không dispatch) hoặc `suggestStandardThickness` (mục 7) để tính bảng xem trước.

**Ghi chú phụ, không chặn T5**: bước 2 "áp vào store" của `runCommandPipeline`
gọi `deps.spatial.applyPatches(commandToPatches(command))` **mỗi lệnh một lần**
(vòng lặp `dispatch.ts:584-601`), không phải một lần cho cả lô. Vì `SpatialPort.applyPatches`
của màn này luôn cài bằng `commit(patches, label)` (`src/store/commit.ts:17-38`,
gọi `store._applyPatches` rồi `store.setLastCommit`), một `runTransaction` với N
lệnh gọi `commit()` N lần → zundo (`temporal` trong `src/store/index.ts:50-69`,
`equality: (a,b) => a.spatial === b.spatial`) ghi N bản nháp riêng vì mỗi lần
`_applyPatches` thay hẳn tham chiếu `state.spatial`. **Việc này vô hại cho T5**:
cả họ màn QC (`WallLayerReview`, `RoomLabelReview`, `FloorManager`) đã xác nhận
KHÔNG bọc `Toast.Provider`/`useUndoableToast` — thứ duy nhất đọc ngăn xếp zundo —
quanh màn của mình, đúng lý do ghi ở
`WallLayerReview.container.tsx:46-62`: "Bọc provider đó quanh màn sẽ cho mỗi
lượt xoá HAI toast, và cái thứ hai hoàn tác bằng một ngăn xếp khác, để lại lịch
sử của màn lệch pha." T5 áp dụng nguyên xi: không `Toast.Provider`, Ctrl+Z đi
qua `HistoryStack` (mục 3), toast hoàn tác đi qua `notificationBus` (mục 6).

---

## 3. Đếm số bước lịch sử trong bài kiểm

Đọc trực tiếp `HistoryStack`, KHÔNG có bảng đếm nào khác:

- `history.undoSteps().length` — số bước có thể hoàn tác. Sau khi
  `runTransaction` với N lệnh chạy xong: `=== 1` (đúng một `StackRecord` được
  đẩy — mục 2).
- `history.canUndo()` — `true`/`false`, tương đương `undoSteps().length > 0`
  (`history.ts:361`).
- Sau khi hoàn tác (gọi `history.undo()` một lần): `undoSteps().length === 0`
  (record chuyển từ `undoRecords` sang `redoRecords`, `history.ts:327-342`) và
  `canRedo() === true`.

**Vì sao transaction không bị fold vào bước trước nó** (nên số 1 ở trên chắc
chắn là MỘT bước mới, không lẫn với thao tác trước): `runInProgress`
(`history.ts:281-296`) chỉ fold khi CẢ bước đang mở lẫn lệnh mới đều là
`soleCommand` — tức `commands.length === 1`. Một transaction N ≥ 2 lệnh có
`input.entry.commands.length > 1` → `soleCommand` trả `null` → `run === null` →
không fold, luôn mở bước mới. Đúng như chú thích tại chỗ: "A transaction never
folds, in either direction: the user asked for those commands to move as one
unit" (`history.ts:277-280`).

**Cách hoàn tác một bước** (khuôn `applyUndo`,
`WallLayerReview/useWallLayerReview.ts:938-953`):

```ts
const transition = dispatchBundle.history.undo(); // HistoryTransition | null
if (transition === null) return; // không còn gì để hoàn tác
dispatchBundle.deps.spatial.applyPatches(transition.patches); // MỘT lần áp cho cả lô
setSelection(transition.selection.selectedIds); // khôi phục vùng chọn (A8 — AutoCAD-style)
autosave.notifyChange();
invalidate();
```

Lưu ý: `applyPatches(transition.patches)` gọi `commit()` **đúng một lần** cho
toàn bộ patch hoàn tác (khác với lượt áp ban đầu gọi N lần — xem mục 2), vì
`transition.patches` đã là một mảng phẳng duy nhất
(`undoPatchesOf`, `dispatch.ts:449-450`).

---

## 4. `resolveJoints` / `resolveWallShapes` (M-04) — `src/domain/walls/joints.ts:677-746`

```ts
export const DEFAULT_JOINT_THRESHOLD_MM: Millimetres = millimetres(50); // joints.ts:63

export function resolveJoints(
  walls: readonly Wall[],                       // Wall của src/domain/walls/types, KHÔNG phải graph Wall
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): { joints: readonly Joint[]; unresolved: readonly UnresolvedJoint[] }
// @throws RangeError khi một tường không dùng được; Error khi hai tường trùng mã

export function resolveWallShapes(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): {
  shapes: readonly WallShape[];   // { wallId, outline: readonly PointMm[], startJointId, endJointId }
  joints: readonly Joint[];
  unresolved: readonly UnresolvedJoint[];
}
```

Hàm THUẦN: không ghi vào bất cứ đâu, không nhận `NormalizedSpatial`. Nhận toàn
bộ danh sách `Wall` (domain) của MỘT TẦNG cùng lúc — bắt buộc phải là **cả
tầng**, không phải chỉ N tường vừa đổi độ dày, vì góc/khớp nối (`Joint`) phụ
thuộc vào tường LÂN CẬN: đổi độ dày một tường làm dịch điểm góc của mọi tường
nối với nó (`faceCorner`, `joints.ts:447-467`, dùng `halfThicknessMm`).

**NOT FOUND — không có đường "gắn ngược" vào graph qua tầng lệnh.** Không một
`Command`/`SpatialPatch`/trường nào trong `NormalizedSpatial`/`Wall` (graph)
lưu `Joint` hay `WallShape`; `resolveWallShapes` được gọi lại MỖI LẦN cần vẽ,
hoàn toàn ở tầng đọc/viewmodel — đúng như `WallLayerReview` đã làm
(`wallLayerReviewGateway.ts:726-756`, hàm `toWallShapes`):

```ts
export function toWallShapes(
  walls: readonly Wall[], level: Level, statusOf: (wall: Wall) => ViewStatusCode,
): readonly WallShapeViewModel[] {
  const resolved = resolveWallShapes(walls.map((wall) => toGeometryWall(wall, level)));
  // ... map outline theo wallId, KHÔNG ghi gì trở lại graph
}
```

**Cho T5**: sau khi `runTransaction` trả `ok: true`, hook đọc lại graph
(`gateway.graph.read()`), lấy toàn bộ tường của tầng bằng
`wallsOnLevel(graph, levelId)` (`shared.ts:173-174`), rồi tự gọi lại
`resolveWallShapes`/`toWallShapes` (chép khuôn của `WallLayerReview`, không
import chéo) để vẽ lại outline — đây là việc của VIEWMODEL, không phải của
`dispatch`/`runTransaction`.

---

## 5. Khuôn dispatch của màn anh em — `WallLayerReview/wallLayerReviewGateway.ts`

```ts
// wallLayerReviewGateway.ts:510-513
export const commandContextOf = (
  graph: NormalizedSpatial,
  actorId: string,
): CommandContext => ({ graph, actorId });

// wallLayerReviewGateway.ts:589-599
export function createCommitSpatialPort(
  graph: WallLayerGraphPort,        // { read: () => NormalizedSpatial | null }
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => { commit(patches, labelOf()); }, // A10: KHÔNG gọi set()
  };
}

// wallLayerReviewGateway.ts:602-662
export interface WallLayerDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  readonly setLabel: (label: string) => void;
}
export interface CreateWallLayerDispatchOptions {
  readonly graph: WallLayerGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  readonly onSynced: () => void;      // bước sync — đánh dấu bẩn cho tự lưu (A7)
  readonly history?: HistoryStack;
}
export function createWallLayerDispatchDeps(
  options: CreateWallLayerDispatchOptions,
): WallLayerDispatchDeps

// wallLayerReviewGateway.ts:665-672
export async function runWallCommand(
  command: Command,
  bundle: WallLayerDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description); // nhãn của lượt = mô tả của CHÍNH lệnh
  return dispatch(command, bundle.deps);
}
```

**T5 phải chép NGUYÊN VĂN bốn hàm/kiểu trên** (đổi tên `WallLayer` →
`ThicknessStandardization` hoặc tên màn thật) vào file gateway của thư mục màn
MỚI — cấm import từ `src/screens/qc/WallLayerReview/**` (ranh giới màn, R-68).
Thêm một hàm `runXxxTransaction` chép khuôn `runFloorTransaction`
(`floorManagerGateway.ts:1029-1037`, trích ở mục 2) thay vì `runWallCommand`,
vì T5 cần chạy N lệnh chứ không phải một.

---

## 6. Vé hoàn tác D-05 và `notificationBus`

`notificationBus.ts` (`src/lib/mutations/notificationBus.ts`) — **CÓ**, đầy đủ:

```ts
export interface NotificationInput {
  description: string;
  title: string;
  type: string;
  undoTicket?: UndoTicket | undefined;
}
export interface Notification extends NotificationInput { createdAt: number; id: string; }
export interface NotificationBus {
  list: () => readonly Notification[];
  publish: (input: NotificationInput) => void;
  subscribe: (listener: (notifications: readonly Notification[]) => void) => () => void;
}
export function createNotificationBus(options?: {
  groupWindowMs?: number; // mặc định 5000
  maxVisible?: number;    // mặc định 3
  now?: () => number;
}): NotificationBus
```

Các publish CÙNG `type` trong `groupWindowMs` (5000 ms) gộp thành MỘT thông
báo, vé hoàn tác gộp (`buildGroupedTicket`, `notificationBus.ts:48-70`) hoàn
tác NGƯỢC thứ tự tất cả các vé con khi bấm một lần.

**Nối vào toast hoàn tác — khuôn `onDelete`,
`WallLayerReview/useWallLayerReview.ts:985-1025`:**

```ts
const ticket = createWallUndoTicket({           // wallLayerReviewGateway.ts:685-704
  wallId, now: gateway.now,
  undo: () => { applyUndo(); setFlashingWallId(wallId); },
});
undoTicketRef.current = ticket;
notifications.publish({
  type: WALL_DELETE_NOTIFICATION_TYPE,
  title: ticket.description,
  description: '',           // NotificationHost ghép tiêu đề+mô tả bằng " — " khi khác nhau
  undoTicket: ticket,
});
```

`createWallUndoTicket` (`wallLayerReviewGateway.ts:685-704`) là một lớp bọc
**riêng của WallLayerReview**, mô tả cứng "Đã xoá tường {id}." — **KHÔNG dùng lại
được** cho lượt chuẩn hoá độ dày (không phải xoá, không phải một wallId). T5
phải tự viết một hàm tương đương trong thư mục màn mới, gọi thẳng
`createUndoTicket` (generic, `src/lib/mutations/undoTicket.ts:45`) với:
- `description`: câu tiếng Việt riêng, ví dụ `Đã chuẩn hoá độ dày ${n} tường.`
  (mirror `normalizeDescription`, `roomLabelReviewGateway.ts:1293-1294`);
- `undo`: gọi lại đúng khuôn `applyUndo` ở mục 3 (`history.undo()` +
  `deps.spatial.applyPatches(transition.patches)` + khôi phục vùng chọn);
- `now`: `gateway.now` (tiêm được, không gọi `Date.now()` trực tiếp trong màn).

`NotificationHost` (`src/main.tsx`) là nơi DUY NHẤT vẽ `appNotificationBus`
bằng `Toast.Item`; nút "Hoàn tác" của nó gọi thẳng `undoTicket.undo()`. Cửa sổ
8000 ms (`UNDO_WINDOW_MS`) do chính `createUndoTicket` mang mặc định — không
tham số thời lượng nào cần truyền tay (R-71). Container của T5 **không được**
bọc `Toast.Provider` quanh màn (lý do ở mục 2).

---

## 7. Bản kê NOT FOUND / phát hiện thêm

- **M-04 không có đường "gắn ngược" vào graph** — mục 4. `resolveWallShapes` là
  hàm đọc thuần, gọi lại mỗi lần vẽ; không có patch/command nào ghi `Joint`
  hay outline vào `NormalizedSpatial`.
- **Không có `wall.standardizeThickness` hay lệnh lô nào có sẵn** trong
  `WALL_COMMAND_TYPES` (`wallCommands.ts:98-106`, đúng bảy lệnh — không có lệnh
  thứ tám cho lô). T5 dựng lô bằng cách gọi lại `createChangeWallThicknessCommand`
  N lần + `runTransaction`, KHÔNG dựng một `CommandType` mới bằng nguyên thuỷ
  công khai (khác với `wall.approve`/`room.approve`/`room.normalizeNames` — ba
  lệnh đó tồn tại vì hành vi của chúng — duyệt, đổi tên hàng loạt — không nằm
  trong bảy lệnh S-07; đổi độ dày THÌ đã có sẵn, không cần dựng lệnh mới).
- **`persistWallLayer`/lưu tường lên máy chủ — NOT FOUND**, cùng lỗ hổng đã ghi
  ở `WallLayerReview`: `PatchSpatialFloorInput.body` là
  `Partial<FloorWriteBody>` (`src/api/client.ts:87-92,144-148`), không có
  trường mảng tường. Màn S-18 (nếu cũng sửa `thicknessMm` qua cùng cơ chế
  store-only) thừa hưởng đúng giới hạn này: chạy trong bộ nhớ (kho + ngăn xếp
  100 bước), không có đường đẩy lên máy chủ.
- **Tìm thấy, không phải NOT FOUND — rất liên quan đến màn "chuẩn hoá":**
  `suggestStandardThickness(walls, limitMm?)` và `nearestStandardThickness`
  (`src/domain/walls/cleanup.ts:599-654`):
  ```ts
  export const STANDARD_THICKNESSES_MM = [100, 150, 200, 220, 300, 400].map(millimetres); // cleanup.ts:70-72
  export const THICKNESS_SUGGESTION_LIMIT_MM: Millimetres = millimetres(15);              // cleanup.ts:75
  export interface ThicknessSuggestion {
    readonly wallId: WallId;
    readonly currentMm: Millimetres;
    readonly suggestedMm: Millimetres;
    readonly differenceMm: Millimetres;
    readonly message: string; // câu tiếng Việt có sẵn
  }
  export function suggestStandardThickness(
    walls: readonly Wall[], limitMm: Millimetres = THICKNESS_SUGGESTION_LIMIT_MM,
  ): readonly ThicknessSuggestion[]
  ```
  Đây là hàm THUẦN của `src/domain`, không ghi gì — đúng nguồn để T5 tính bảng
  xem trước (danh sách tường lệch chuẩn + độ dày đề nghị) TRƯỚC khi người dùng
  bấm áp, thay vì tự chế công thức làm tròn trong màn (R-61/R-71). `walls` ở
  đây là `Wall` domain (`toSolidWall`), không phải graph `Wall`.
- **`mergeCommands` không áp dụng cho lô nhiều tường khác nhau** — đã xác nhận
  lại (mục 2): chỉ gộp hai lệnh cùng `type`, cùng `actorId`, cùng
  `targetKey` (tập thực thể, `mergeCommands.ts:37,48-67`). Không phải hướng
  dùng cho lô N tường — dùng `runTransaction` (mục 2), không dùng `mergeCommands`.
