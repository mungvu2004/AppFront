# T3 — Khảo sát hợp đồng kéo thả, lệnh và hoàn tác (FurnitureLibraryPanel)

Khảo sát Lớp 1, chỉ đọc mã. Mọi chữ ký dưới đây dán nguyên văn kèm `đường-dẫn:dòng`.
`src/screens/**/*Furniture*` và `*Library*`: **NOT FOUND** — màn `FurnitureLibraryPanel`
chưa tồn tại, đúng như đặc tả nói.

---

## (a) I-03 — phiên kéo thả: `src/lib/input/dragDrop.ts` (đã đọc toàn bộ 330 dòng)

Đầu file (dòng 1-33) nói thẳng: dựng cho "one drag from the library to the drawing,
pointer or keyboard". Đây là I-03.

### Kiểu dữ liệu — dán nguyên văn

```ts
// dòng 51-57
export interface DragLibraryItem {
  readonly kind: FurnitureKind;
  readonly widthMm: number;
  readonly depthMm: number;
  /** Vietnamese name, for the status bar and the screen reader. */
  readonly label: string;
}

// dòng 60, 63, 65
export type DragMode = 'pointer' | 'keyboard';
export const KEYBOARD_STEP_MM = 50;
export type NudgeDirection = 'left' | 'right' | 'up' | 'down';

// dòng 68-79
export interface DragSession {
  readonly item: DragLibraryItem;
  /** Minted once at pickup; the id the drop will create. */
  readonly id: FurnitureId;
  /** Where the item's centre is right now, in plan millimetres. */
  readonly centre: Point;
  readonly mode: DragMode;
  /** Current verdict for this exact spot — never stale, never deferred. */
  readonly dropAllowed: boolean;
  /** Vietnamese sentences; empty exactly when `dropAllowed`. */
  readonly blockReasons: readonly string[];
}

// dòng 81-85 — ĐỦ hai nhánh phase, không có nhánh thứ ba
export type DragDropState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'dragging'; readonly session: DragSession };

export const IDLE_DRAG_STATE: DragDropState = { phase: 'idle' };

// dòng 91-101 — ĐỦ năm biến thể sự kiện
export type DragDropEvent =
  | { readonly type: 'start'; readonly item: DragLibraryItem; readonly at: Point; readonly mode: DragMode; }
  | { readonly type: 'move'; readonly at: Point }
  | { readonly type: 'nudge'; readonly direction: NudgeDirection }
  | { readonly type: 'drop' }
  | { readonly type: 'cancel' };

// dòng 104-107
export interface FurnitureDropRequest {
  readonly type: typeof OPENING_COMMAND_TYPES.addFurniture;
  readonly input: AddFurnitureInput;
}

// dòng 109-120 — TỪNG TRƯỜNG của DragDropDeps
export interface DragDropDeps {
  /** The storey being dropped onto. */
  readonly levelId: LevelId;
  /** Mints the furniture id. Called once per session, at pickup. */
  readonly nextId: () => FurnitureId;
  /**
   * Everything wrong with dropping here; empty means allowed. Runs on every
   * start, move and nudge — validating on release only is the interaction
   * this module exists to avoid.
   */
  readonly validateDrop: (input: AddFurnitureInput) => readonly string[];
}

// dòng 122-126
export interface DragDropTransition {
  readonly state: DragDropState;
  /** Emitted exactly once, by the successful drop, and by nothing else. */
  readonly request: FurnitureDropRequest | null;
}

// dòng 184-188 — chữ ký reducer
export function reduceDragDrop(
  state: DragDropState,
  event: DragDropEvent,
  deps: DragDropDeps,
): DragDropTransition
```

### Đây là REDUCER THUẦN — trả lời rõ

- **Ai gọi nó / ai nuôi sự kiện con trỏ:** `reduceDragDrop` không tự lắng nghe gì cả —
  "nothing here touches the DOM" (dòng 21). Đây là hàm thuần `(state, event, deps) => transition`,
  giống hệt `toolMachine` (import ở dòng 44: `ToolPreview` từ `../tools/toolMachine`). Màn
  `FurnitureLibraryPanel` (chưa tồn tại) phải tự đặt `useState<DragDropState>` hoặc tương đương,
  gọi `reduceDragDrop` từ `onPointerDown/onPointerMove/onPointerUp` và từ `onKeyDown` (qua
  `dragEventForKey`), rồi set state bằng `.state` trả về. Đây là state CỤC BỘ của panel/hook, không
  phải state của Zustand store — module ghi rõ "the session never writes" (dòng 30), nó chỉ SINH
  RA một `FurnitureDropRequest`; chỉ khi `request !== null` mới đi tiếp sang lệnh S-07/dispatch S-05.
- **`dropAllowed` và `blockReasons`:** nằm trong `DragDropState['session']` (khi `phase === 'dragging'`
  — dòng 76-78 trong `DragSession`). Không có ở phase `idle`.
- **`dragGhost` trả về gì (dòng 272-286):** `ToolPreview | null` — cùng vựng preview với
  `toolMachine`, để canvas không cần một renderer thứ hai cho ghost kéo thả. `null` khi
  `state.phase !== 'dragging'`; khi đang kéo trả về
  `{ kind: 'furnitureGhost', centre, boundingBox, furnitureKind, rotationDeg: 0 }`.
- **`dragStatusText` trả về gì (dòng 317-329):** `string | null`. `null` khi không kéo gì.
  Khi kéo: `"đang kéo {label} — thả được ở vị trí này"` nếu `dropAllowed`, ngược lại
  `"đang kéo {label} — không thả được: {blockReasons.join(' ')}"`. Đây là câu tiếng Việt CHO
  SẴN, panel không tự soạn câu trạng thái.
- **`dragEventForKey` xử lý phím nào (dòng 294-311):** `Enter` → `{type:'drop'}`,
  `Escape` → `{type:'cancel'}` (A12 — Esc huỷ phiên), bốn phím mũi tên → `{type:'nudge', direction}`.
  Phím khác trả `null`. Ghi chú dòng 288-293: "consumer stops propagation on the keys this
  answers, so the shortcut arbiter never sees them while an item is in hand" — nghĩa là khi có
  phiên kéo đang mở bằng bàn phím, panel phải tự `stopPropagation`/`preventDefault` các phím này
  TRƯỚC KHI chúng chạy tới `shortcutRegistry` toàn cục (mục (e) dưới).

### Đường bàn phím (A12) — dòng 23-28 + `dragEventForKey`

Enter (khi đã chọn một mục thư viện) → `start` với `mode:'keyboard'` (panel tự phát sự kiện
`start`, không có trong `dragEventForKey` vì nó cần `item`/`at` mà bàn phím không có sẵn — panel
build sự kiện `start` thủ công từ mục đang được chọn/focus). Bốn mũi tên → `nudge`, mỗi bước
đúng `KEYBOARD_STEP_MM` (50mm, dòng 63) qua `NUDGE_VECTORS` (dòng 142-148). Enter lần hai → `drop`.
Khác biệt quan trọng dòng 240-247: nếu `drop` bị chặn (`!dropAllowed`) mà `mode === 'keyboard'`
thì state GIỮ NGUYÊN (`stay(state)`) để người dùng tiếp tục điều khiển; còn `mode === 'pointer'`
thì phiên kết thúc luôn về `idle` vì nút chuột đã nhả, không có gì giữ nó lại.

`boxAround` (dòng 133-136) và `snapToStepMm` (dòng 139-140) cũng export công khai — dùng lại,
không tính tay lại hình học.

---

## (b) S-07 — lệnh thêm đồ đạc: `src/lib/commands/business/openingCommands.ts`

```ts
// dòng 84-94
export const OPENING_COMMAND_TYPES = {
  addOpening: 'opening.add',
  moveOpening: 'opening.move',
  resizeOpening: 'opening.resize',
  removeOpening: 'opening.delete',
  addFurniture: 'furniture.add',
  moveFurniture: 'furniture.move',
  rotateFurniture: 'furniture.rotate',
  resizeFurniture: 'furniture.resize',
  removeFurniture: 'furniture.delete',
} as const;

// dòng 598-606
export interface AddFurnitureInput {
  readonly id: FurnitureId;
  readonly levelId: LevelId;
  readonly kind: FurnitureKind;
  readonly centre: Point;
  readonly boundingBox: BoundingBox;
  readonly rotationDeg: number;
  readonly roomId?: RoomId;
}

// dòng 640 — chữ ký (thân đủ dài, không dán lại toàn bộ thân)
export function validateAddFurniture(input: AddFurnitureInput, context: CommandContext): string[]

// dòng 693-696 — chữ ký
export function createAddFurnitureCommand(
  input: AddFurnitureInput,
  context: CommandContext,
): CommandResult
```

`validateAddFurniture` (dòng 640-690) kiểm: định dạng id + trùng id (`isIdOfKind`, `idIsTaken`),
tầng tồn tại, `kind` nằm trong `FURNITURE_KINDS`, khung bao là hình chữ nhật thật (`boxReasons`),
tâm nằm trong khung bao, góc xoay hữu hạn, và nếu có `roomId` thì phòng tồn tại, cùng tầng, và
tâm nằm trong ranh phòng (`outlineContains` — domain, không tính tay). `createAddFurnitureCommand`
(dòng 693-728) gọi lại `validateAddFurniture`, refuse nếu có lý do, ngược lại dựng `Furniture`
với `AUTHORED_BY_HAND` (nguồn `human`, xem `shared.ts`) và trả `accept(buildCommand(...))` với
một câu tiếng Việt mô tả (dùng cho nút hoàn tác/nhật ký).

**`CommandContext` khai ở đâu:** `src/lib/commands/business/shared.ts:62-70`:
```ts
export interface CommandContext {
  readonly graph: NormalizedSpatial;
  readonly actorId: string;
  readonly id?: CommandId;
  readonly timestamp?: string;
}
```
**Một màn lấy nó bằng cách nào:** ví dụ thật — `objectLayerReviewGateway.ts:782-785`:
```ts
export const commandContextOf = (
  graph: NormalizedSpatial,
  actorId: string,
): CommandContext => ({ graph, actorId });
```
Panel gọi `commandContextOf(graph, actorId)` với `graph` đọc từ store (`useStore.getState().spatial`
hoặc selector tương đương) và `actorId` của phiên hiện tại.

---

## (c) S-05 — điều phối lệnh

### `src/store/commit.ts` — cửa ghi DUY NHẤT (A10)

```ts
// dòng 98-101
export function commit(
  patch: SpatialPatch | readonly SpatialPatch[],
  label: string
): CommitResult
```
`CommitResult` (dòng 9-13): `{ undo: () => void; label: string; timestamp: number }`. `commit`
là hàm DUY NHẤT gọi `store._applyPatches` — mọi component/hook khác bị luật `local/no-direct-set`
chặn không cho gọi `set()` trực tiếp. `commit` cũng tự dọn bản nháp (`discardPreview()`, dòng 131)
và ghi `store.setLastCommit(label, timestamp)` (dòng 134) — đây là nguồn dữ liệu của toast hoàn
tác ở mục (d). Cùng file còn có `previewEdit`/`discardPreview` (dòng 179-205) — đường DUY NHẤT
cho bản nháp tạm thời (`local/no-draft-write-outside-commands` khoá `stageDraftOperation`/
`amendDraftOperation`/`discardDraft` ngoài `src/store`), panel dùng để "kéo tới đâu vẽ ghost tới
đó" nếu cần xem trước trên chính đồ thị đã lưu — nhưng I-03 đã tự có `dragGhost`/`ToolPreview`
riêng, không đụng graph thật cho tới khi thả, nên khả năng cao panel KHÔNG cần `previewEdit` cho
việc kéo thả furniture (ghost vẽ trên canvas 3D bằng `ToolPreview`, không phải bằng bản nháp
của store).

### `commandBus`/`dispatch`/`executor` — CÓ, tên thật là `dispatch`

`src/lib/commands/dispatch.ts:700-704`:
```ts
export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult> {
  return runExclusive(SPATIAL_PIPELINE_KEY, () =>
    runCommandPipeline({ commands: [command], label: command.description }, deps),
  );
}
```
`DispatchDeps` (dòng 156-163): `{ spatial: SpatialPort; history: HistoryPort; rules: RulesPort;
sync: SyncPort; now?: () => string }`. `SpatialPort` (dòng 124-129):
```ts
export interface SpatialPort {
  read: () => NormalizedSpatial | null;
  applyPatches: (patches: readonly SpatialPatch[]) => void;
}
```
Đây là **năm bước** ghi trong đặc tả T3 (validate → apply → history → rules → sync) — `dispatch`
gọi `runCommandPipeline`, và cổng ghi `applyPatches` được CÀI bằng `commit` (không viết `set()`
trực tiếp). Khuôn thật đang chạy — `objectLayerReviewGateway.ts:1076-1086`:
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
Và `runObjectCommand` (dòng 1151-1158 của gateway) là hàm hook thật sự gọi:
```ts
export async function runObjectCommand(
  command: Command,
  bundle: ObjectLayerDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);
  return dispatch(command, bundle.deps);
}
```

**Hook của màn được phép gọi gì để CHẠY `createAddFurnitureCommand`:** đúng khuôn màn QC anh em —
hook gọi `createAddFurnitureCommand(input, commandContextOf(graph, actorId))`; nếu
`result.accepted` (kiểu `CommandResult`, xem `accept`/`refuse` ở `shared.ts`) thì lấy
`result.command` và gọi `dispatch(command, deps)` (hoặc hàm bọc kiểu `runObjectCommand`), với
`deps.spatial` cài bằng `createCommitSpatialPort`/tương đương trỏ về `commit`. Hook **KHÔNG BAO
GIỜ** gọi `commit`/`_applyPatches` trực tiếp bằng patch tự tay — patch phải tới từ `Command.changes`
mà `createAddFurnitureCommand` sinh ra. Toàn bộ mảng import cần thiết: `dispatch`, `DispatchDeps`,
`SpatialPort`, `Command`, `CommandResult` từ `@/lib/commands/dispatch` và `@/lib/commands/business/shared`
và `@/lib/commands/types`.

**Luật A10 nhắc lại:** `local/no-direct-set` (CLAUDE.md, `project.js:65`) cấm component gọi `set()`
của store; `local/no-draft-write-outside-commands` cấm ghi bản nháp ngoài `src/store`. Panel/hook
của `FurnitureLibraryPanel` chỉ được đứng ở phía TRÊN `dispatch`/`commit` — không viết patch tay.

---

## (d) A8/D-05 — hoàn tác + toast

### `src/lib/mutations/undoTicket.ts`
```ts
// dòng 18 — R-71: nguồn DUY NHẤT của 8000, cấm viết tay hằng số này lần thứ hai
export const UNDO_WINDOW_MS = 8000;

// dòng 40-45 (interface), 60-71 (factory) — chữ ký factory
export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket
```
`CreateUndoTicketOptions`: `{ description: string; now?: () => number; ttlMs?: number;
undo: () => void }`; mặc định `ttlMs` là chính `UNDO_WINDOW_MS`.

### Khuôn THẬT đang chạy cho "thả xong → toast mời hoàn tác 8 giây"

Có HAI cơ chế song song trong repo, panel mới nên đi theo cơ chế đơn giản hơn — đã có sẵn và
đã gắn dây tới `commit`:

1. **`useUndoableToast` (`src/hooks/useUndoableToast.ts:14-40`)** — đây là khuôn A8 thật sự đơn
   giản nhất và đã nối với `commit`:
   ```ts
   export function useUndoableToast(): UndoableToastState | null
   ```
   Đọc `state.lastCommitLabel` / `state.lastCommitTimestamp` (do `commit()` ghi ở
   `store/historySlice.ts:15-19` qua `setLastCommit`), hết `UNDO_WINDOW_MS` thì tự ẩn, và
   `onUndo` gọi `useStore.temporal.getState().undo()` — **không** dùng `UndoTicket`/`notificationBus`
   ở đây. Panel không cần code thêm gì cho toast — mọi `commit()` tự động sinh ra
   `lastCommitLabel`/`lastCommitTimestamp`, và `useUndoableToast` (đã tồn tại, chạy ở tầng shell)
   tự hiện toast 8 giây với nút hoàn tác. Chỉ cần đảm bảo panel gọi `commit` (qua `dispatch`) đúng
   cách ở mục (c) — không cần tự viết logic toast.
2. **`notificationBus.ts` + `createUndoTicket`** — cơ chế gộp nhiều thông báo cùng loại trong
   `groupWindowMs` (5000ms mặc định) thành một, dùng ở nơi cần gộp nhiều lượt hoàn tác (ví dụ xoá
   hàng loạt). `Toast.tsx` (`src/components/feedback/Toast.tsx`) là các thành phần UI thô
   (`ToastProvider`, `useToast`, `Toast.*`) — KHÔNG tự đọc `lastCommitLabel`; nó là bộ khung hiển
   thị chung, không phải nguồn A8. `FurnitureLibraryPanel` không cần đụng vào `notificationBus`
   trừ khi có yêu cầu gộp nhiều lượt kéo-thả liên tiếp thành một toast.

**Nguồn hằng 8000 — xác nhận đúng R-71:** `UNDO_WINDOW_MS` (`undoTicket.ts:18`), được `Toast`/
`useUndoableToast` import lại đúng một chỗ (`useUndoableToast.ts:3`). Không viết tay `8000` ở
đâu khác.

---

## (e) A12 — bàn phím

### Đăng ký đúng luật (R-54 cấm tự `addEventListener('keydown')`)

`src/lib/input/shortcutRegistry.ts` là registry thuần (không React). Hàm đăng ký:
```ts
// dòng 370-372
export function createShortcutRegistry(
  options: ShortcutRegistryOptions = {},
): ShortcutRegistry

// register (nội bộ registry, trả unregister) — dòng 399 trở đi
const register = (definition: ShortcutDefinition): (() => void) => { ... }
```
Registry dùng chung toàn ứng dụng: `export const appShortcutRegistry: ShortcutRegistry =
createShortcutRegistry();` (dòng 710). `registry.attach(window)` (nội bộ) là **CHỖ DUY NHẤT**
gọi `addEventListener('keydown', ...)` trong toàn repo (ghi rõ ở `useShortcut.ts:10-16`).

### `src/hooks/useShortcut.ts` — mặt React

```ts
// dòng 91-94
export function useShortcut(
  definition: ShortcutDefinition,
  options: UseShortcutOptions = {},
): void

// dòng 144-147
export function useShortcutScope(
  scope: ShortcutScope,
  options: UseShortcutScopeOptions = {},
): void
```
Panel đăng ký phím riêng (nếu cần, ví dụ phím tắt mở nhanh thư viện) bằng `useShortcut({id, combo,
scope, onTrigger}, options)` — KHÔNG được tự `addEventListener`. Nếu panel là một lớp modal
(popover/dialog chọn đồ), gọi thêm `useShortcutScope('nội dung-phạm-vi', {active})` để claim scope,
làm phím `W` v.v. phía sau không còn tác dụng trong khi panel mở.

**Esc đóng lớp trên cùng:** hằng số `id: 'global.closeTopLayer'`, `combo: 'Escape'`, `scope:
'global'`, `preventDefault: false` (`shortcutRegistry.ts:669-678`, trong `buildGlobalShortcuts`)
gọi `handlers.closeTopLayer()`. Luật riêng cho Escape (dòng 18-22, 491-493 của cùng file): "Escape
always falls through to the global close-top-layer handler" — MỘT modal scope không nuốt được
phím Escape dù nó không tự đăng ký gì cho phím đó. Nghĩa là nếu `FurnitureLibraryPanel` mở như
một lớp (panel/drawer), Esc sẽ tự đóng nó qua `closeTopLayer` MIỄN LÀ shell đã nối
`useGlobalShortcuts` (đã có, `useShortcut.ts:172-217`) — panel không cần tự bắt Esc để đóng
chính mình, TRỪ trường hợp đang có phiên kéo thả I-03 đang mở (mục (a)): lúc đó Esc phải được
`dragEventForKey('Escape')` bắt trước và `stopPropagation`, để Esc huỷ phiên kéo thay vì đóng cả
panel — đúng chú thích dòng 288-293 của `dragDrop.ts`.

---

## (f) Trạng thái đồ đạc hiện có trên tầng — mục "Đã phát hiện"

**Kiểu dữ liệu** — `src/domain/spatial/types.ts`:
```ts
// dòng 68
export type LevelId = `L-${string}`;

// dòng 155-163
export type FurnitureKind =
  | 'table' | 'chair' | 'bed' | 'wardrobe' | 'kitchenCabinet'
  | 'sanitaryFixture' | 'stair' | 'other';

// dòng 166-174
export interface Furniture extends ReviewMetadata {
  id: FurnitureId;
  levelId: LevelId;
  roomId?: RoomId;
  kind: FurnitureKind;
  centre: Point;
  boundingBox: BoundingBox;
  rotationDeg: Degrees;
}

// dòng 61-65 — ReviewMetadata mà Furniture kế thừa
export interface ReviewMetadata {
  confidence: Confidence; // number trong [0,1]
  source: DataSource;     // 'ai' | 'human'
  reviewed: boolean;
}
```

**Selector đọc danh sách furniture của tầng hiện tại, nhóm theo `kind`: NOT FOUND.**

Lệnh đã chạy và kết quả nguyên văn:
```
$ grep -n "furniture\|currentLevel\|activeLevel\|selectedLevel" src/store/selectors.ts src/store/spatialSlice.ts src/store/index.ts
(không có dòng nào khớp)

$ grep -rn "Furniture" src/store/
src/store/toolSlice.ts:5:export type ToolKind = 'select' | 'pan' | 'drawWall' | 'placeOpening' | 'placeFurniture' | 'measure';
src/store/__tests__/slices.test.ts: (chỉ dùng trong test, không phải selector sản phẩm)

$ grep -rln "currentLevelId\|activeLevelId\|selectedLevelId" src/
src/lib/export/screenshotQueue.ts
src/lib/selection/marquee.ts
src/lib/selection/selectionOps.ts
src/lib/selection/__tests__/selection.test.ts
src/screens/qc/ObjectLayerReview/useObjectLayerReview.ts
src/screens/qc/WallLayerReview/useWallLayerReview.ts
src/screens/viewer/Viewer3D/useViewer3D.ts
```
Kết luận: **không có khái niệm "tầng hiện tại" ở tầng store toàn cục** — mỗi màn (Object Layer
Review, Wall Layer Review, Viewer3D) tự giữ `currentLevelId`/`selectedLevelId` riêng trong hook
của chính nó, rồi tự lọc `entitiesOfKind(graph, 'furniture').filter(f => f.levelId === currentLevelId)`
(xem `graphFurnitureOf` ở `objectLayerReviewGateway.ts:644-645` làm ví dụ đọc KHÔNG lọc tầng, và
`solidWallsOf` cùng file làm ví dụ lọc CÓ tầng). Không có hàm `groupBy`/`countBy` theo `kind` cho
furniture ở bất cứ đâu trong `src/store` hay `src/screens` (lệnh grep `groupBy|countBy|byKind` +
lọc `furniture` không ra kết quả). `FurnitureLibraryPanel` phải tự viết phép nhóm theo `kind`
trong HOOK của chính nó (mục D — tính toán không nằm trong màn hình, xuống hook/`src/lib`), đọc
từ `entitiesOfKind(graph, 'furniture')` (hàm đã có ở `shared.ts`) rồi lọc/`reduce` theo `levelId`
và `kind` tại chỗ — đây không phải "logic đã có" nên KHÔNG được coi là có sẵn selector, phải tự
viết mới trong phạm vi được phép của panel.

**Trường "đây là do YOLO phát hiện" (nguồn/độ tin cậy):** CÓ, nhưng không đặt tên "YOLO" — đó
chính là `ReviewMetadata` mà mọi thực thể (kể cả `Furniture`) kế thừa: `source: 'ai' | 'human'`
và `confidence: number`. `source === 'ai'` và `reviewed === false` là dấu hiệu "đầu ra máy dò,
chưa người duyệt xem" (xem A5 và `reviewMetadataOf` ở `objectLayerReviewGateway.ts:485-490`:
`source: entry.reviewed ? 'human' : 'ai'`). Không có trường riêng nào tên `detectedBy`/`yoloSource`
— tên miền chung là `source`/`confidence` của `ReviewMetadata`, dùng lại cho mọi lớp đối tượng,
không riêng furniture.

---

## Tổng kết đường nối cho hook của `FurnitureLibraryPanel` (không phải kết luận, chỉ là điểm nối)

1. Thư viện đồ đạc → `DragLibraryItem[]` (panel tự cung cấp, không phải I-03).
2. Kéo (chuột hoặc bàn phím) → vòng `reduceDragDrop(state, event, deps)` cục bộ trong hook, với
   `deps.validateDrop = (input) => validateAddFurniture(input, commandContextOf(graph, actorId))`.
3. `request !== null` sau `drop` → `createAddFurnitureCommand(request.input, context)`.
4. `result.accepted` → `dispatch(result.command, dispatchDeps)` với `dispatchDeps.spatial` cài
   bằng cổng gọi `commit(patches, label)` (khuôn `createCommitSpatialPort`).
5. `commit` tự ghi `lastCommitLabel`/`lastCommitTimestamp` → `useUndoableToast` (đã có, ở tầng
   shell) tự hiện toast 8 giây (`UNDO_WINDOW_MS`) với nút hoàn tác gọi
   `useStore.temporal.getState().undo()`.
6. Esc trong lúc kéo → `dragEventForKey('Escape')` → `cancel`, panel tự `stopPropagation` để
   `shortcutRegistry` toàn cục không đồng thời đóng panel; Esc khi KHÔNG kéo → đi tới
   `global.closeTopLayer` như bình thường, không cần panel tự bắt.

## Mục hỏi điều phối viên — không có, mọi mục đều tìm được chữ ký thật hoặc xác nhận NOT FOUND
có lệnh grep kèm theo. Không mục nào chặn đường tiếp theo của T3.
