# Hợp đồng tầng tương tác 3D và tầng lệnh — WallGeometryEditor (S-19/T1)

Khảo sát tại HEAD nhánh `mungvu2004/wge-t1-interaction`. Đọc toàn văn:
`src/lib/three/interaction/{dragSession,gizmo,raycast,hitTest}.ts` và thư mục
`__tests__` của nó; `src/lib/commands/{business/wallCommands,business/shared,
dispatch,history,mergeCommands,createCommand,types,transaction,invert}.ts` và
`src/lib/commands/__tests__/*` + `src/lib/commands/business/__tests__/*`;
`src/store/{commit,spatialSlice,historySlice,draftSlice,selectors}.ts` và
`src/store/__tests__/draftPreview.test.ts`; `src/domain/spatial/{applyPatch,
normalize}.ts` (phần `SpatialPatch`/`NormalizedSpatial` mà nhóm C cần).

Kết luận ngắn: **13/14 mục có thật, y hệt như đặc tả nêu**, dẫn được số dòng và
ví dụ gọi thật lấy từ test. Một mục (14) **sai vị trí**: không có selector nào
trong `src/store/selectors.ts` lấy một `Wall` theo `WallId` hay lấy ô mở theo
tường — hàm thật nằm ở `src/lib/commands/business/shared.ts`, đọc thẳng
`NormalizedSpatial`, không phải một selector kiểu Zustand nhận `RootState`. Hai
mục đặc tả đã báo trước là không tồn tại (`GizmoHud.tsx`,
`MeasurementOverlay.tsx`) — xác nhận đúng, xem mục NOT FOUND.

---

## 1. `createDragSession(options)` — `src/lib/three/interaction/dragSession.ts`

Hàm quan trọng nhất của cả nhóm A. Nguyên văn `DragSessionOptions<TInput>`
(dòng 119-129):

```ts
export interface DragSessionOptions<TInput> {
  readonly handle: GizmoHandle;
  readonly anchor: GizmoAnchor;
  /** The ray the pointer was on when the handle was grabbed. */
  readonly startRay: PickRay;
  readonly binding: CommandBinding<TInput>;
  /** Called for every preview, including the last one. */
  readonly onPreview?: (preview: DragPreview) => void;
  readonly gridStepMm?: Millimetres;
  readonly angleStepDeg?: Degrees;
}
```

`DragSession` (dòng 131-143):

```ts
export interface DragSession {
  readonly handle: GizmoHandle;
  move: (ray: PickRay) => DragPreview;
  drop: () => DragOutcome;
  cancel: () => DragPreview;
  current: () => DragPreview;
  isFinished: () => boolean;
}
```

`DragOutcome` (dòng 83-89) — union ba nhánh:

```ts
export type DragOutcome =
  | { readonly kind: 'committed'; readonly command: Command; readonly delta: GizmoDelta }
  | { readonly kind: 'refused'; readonly reasons: readonly string[] }
  | { readonly kind: 'nothingToDo' };
```

`DragPhase` (dòng 59): `'dragging' | 'committed' | 'cancelled'`.

`DragPreview` (dòng 68-80):

```ts
export interface DragPreview {
  readonly phase: DragPhase;
  readonly delta: GizmoDelta | null;
  readonly measurement: string | null;
  readonly status: ViewStatusCode;
  readonly blocked: boolean;
  readonly reasons: readonly string[];
}
```

`CommandBinding<TInput>` (dòng 111-117):

```ts
export interface CommandBinding<TInput> {
  readonly context: CommandContext;
  readonly toInput: (delta: GizmoDelta) => TInput | null;
  readonly validate: (input: TInput, context: CommandContext) => readonly string[];
  readonly build: (input: TInput, context: CommandContext) => CommandResult;
}
```

**Ai gọi `commit`? Phiên kéo tự gọi hay người dùng phiên phải gọi?**
`dragSession.ts` **không import** `commit` lẫn `dispatch` (đã soát toàn bộ
phần import ở đầu file, dòng 38-52: chỉ `domain/units/types`,
`lib/commands/business/shared` (kiểu), `lib/commands/types` (kiểu),
`lib/viewmodel/types`, và `./gizmo`). `drop()` (dòng 247-284) gọi
`binding.build(...)` để DỰNG một `Command`, rồi trả nó ra trong nhánh
`{ kind: 'committed', command, delta }` — chú thích dòng 84-85 nói thẳng:
*"The one command this drag produces. Dispatching it is the caller's job."*
Tức là: **phiên kéo tự BUILD lệnh (qua `binding.build`), nhưng KHÔNG tự
`dispatch`/`commit` nó** — người gọi (hook `useWallGeometryEditor` của T6)
phải tự lấy `outcome.command` ở nhánh `'committed'` rồi gọi `dispatch(command,
deps)` (mục 9) hoặc một đường viết khác.

**Bằng chứng "200 khung hình → đúng một lệnh"** —
`__tests__/gizmo.test.ts:509-531`:

```ts
it('builds one command after two hundred frames of dragging', () => {
  const { binding, counts } = countingBinding();
  const session = createDragSession({
    anchor: TABLE_ANCHOR,
    binding,
    handle: { axis: 'x', mode: 'translate' },
    startRay: tableStartRay(),
  });

  for (let frame = 1; frame <= 200; frame += 1) {
    session.move(tableRayAfter(frame));
  }

  expect(counts.built).toBe(0);

  const outcome = session.drop();

  expect(counts.built).toBe(1);
  expect(outcome.kind).toBe('committed');
});
```

`move()` chỉ tính, xem trước, kiểm hợp lệ (`binding.validate`) — không bao giờ
build. Chỉ `drop()` build, và `finish('committed')` chạy TRƯỚC khi build nên
một `drop()` thứ hai luôn trả `{ kind: 'nothingToDo' }` dù gọi bao nhiêu lần
(`gizmo.test.ts:572-587`).

**Esc (`cancel()`, dòng 286-296):** không build, không rollback — chỉ phát một
`emptyPreview('cancelled')` (`delta: null`). Bản vẽ đã lưu chưa từng bị đụng
tới trong lúc kéo (chỉ có preview), nên huỷ = không làm gì cả. Bằng chứng
`gizmo.test.ts:659-707` ("puts the drawing back exactly as it was, and builds
nothing"): sau 120 khung hình kéo rồi `cancel()`, `mirror.read()` (bản nháp mô
phỏng) trở lại y hệt `TABLE`, và `SPATIAL.byId[TABLE_ID]` (dữ liệu đã lưu)
không đổi suốt.

---

## 2. `measureDrag(...)` — `src/lib/three/interaction/gizmo.ts`

Chữ ký (dòng 333-339):

```ts
export function measureDrag(
  handle: GizmoHandle,
  anchor: GizmoAnchor,
  startRay: PickRay,
  currentRay: PickRay,
  options: GizmoSnapOptions = {},
): GizmoDelta | null
```

`GizmoSnapOptions` (dòng 320-323):

```ts
export interface GizmoSnapOptions {
  readonly gridStepMm?: Millimetres;
  readonly angleStepDeg?: Degrees;
}
```

`GizmoDelta` (dòng 133-153) — union ba nhánh theo `mode`:

```ts
export type GizmoDelta =
  | { readonly mode: 'translate'; readonly axis: GizmoAxis; readonly offsetMm: Millimetres }
  | { readonly mode: 'rotate'; readonly axis: GizmoAxis; readonly angleDeg: Degrees }
  | {
      readonly mode: 'scale';
      readonly axis: GizmoAxis;
      readonly lengthMm: Millimetres;
      readonly factor: number;
    };
```

`GizmoAnchor` (dòng 114-125):

```ts
export interface GizmoAnchor {
  readonly position: Vector3;
  readonly sizeMm?: Readonly<Partial<Record<GizmoAxis, Millimetres>>>;
}
```

`PickRay` (dòng 108-111): `{ readonly origin: Vector3; readonly direction: Vector3 }`
(thoả mãn bởi `THREE.Ray`).

`GizmoHandle` (dòng 91-94): `{ readonly mode: GizmoMode; readonly axis: GizmoAxis }`.

`GizmoMode` (dòng 58): `'translate' | 'rotate' | 'scale'`.

`GizmoAxis` (dòng 73): `'x' | 'y' | 'z'` — trục CẢNH (scene), không phải trục
mặt bằng; `plan x → scene x, plan y → scene z` (chú thích đầu file, dòng 18-26).

Ví dụ gọi thật, dựng một `GizmoDelta` translate (`gizmo.test.ts` phần fixture
dùng cho `describeDelta`, dòng ~370-386, và toàn bộ khối "a drag produces
exactly one command" gọi gián tiếp qua `createDragSession`).

`null` nghĩa là **không đo được** (con trỏ nhìn dọc trục, hoặc resize không có
kích thước gốc) — KHÔNG có nghĩa "không đổi gì"; một kéo về đúng điểm xuất phát
vẫn trả một `GizmoDelta` có giá trị 0 (xem `isZeroDelta`).

---

## 3. Các hàm phụ của gizmo — `src/lib/three/interaction/gizmo.ts`

- `isZeroDelta(delta: GizmoDelta): boolean` — dòng 394-403. `translate`:
  `offsetMm === 0`; `rotate`: `angleDeg === 0`; `scale`: `factor === 1`.
- `describeDelta(delta: GizmoDelta): string` — dòng 421-432. Ví dụ thật,
  `gizmo.test.ts:383-387`:
  ```ts
  expect(
    describeDelta({ axis: 'x', factor: 2, lengthMm: millimetres(1_250), mode: 'scale' }),
  ).toBe('trục X: 1,25 m');
  ```
- `gizmoStatus(phase: GizmoPhase): ViewStatusCode` — dòng 443-445. Ví dụ thật,
  `gizmo.test.ts:389-394`:
  ```ts
  expect(gizmoStatus('blocked')).toBe('violation');
  expect(gizmoStatus('dragging')).toBe('neutral');
  expect(gizmoStatus('hover')).toBe('neutral');
  expect(gizmoStatus('idle')).toBe('neutral');
  ```
  Chỉ có `violation` hoặc `neutral` — KHÔNG có nhánh nào trả `attention` hay
  `verified` (đúng invariant A4: bốn màu trạng thái không được có ở đây, và A2:
  gizmo mang màu nhấn vì nó là gizmo, không phải vì nó "xin" trạng thái).
- `axisDirection(axis: GizmoAxis): Vector3` — dòng 192-194.
- `closestPointOnAxis(ray, origin, axis): number | null` — dòng 205-229.
- `intersectAxisPlane(ray, origin, axis): Vector3 | null` — dòng 238-257.
- `angleAroundAxis(offset: Vector3, axis: GizmoAxis): Degrees` — dòng 273-282.
  Quanh trục `y` đọc theo toạ độ MẶT BẰNG (`atan2(scene.z, scene.x)`), khớp
  đúng `Furniture.rotationDeg`; hai trục ngang theo quy tắc bàn tay phải thông
  thường.

**[CẤM TUYỆT ĐỐI] "Không tự viết gizmo, không tự tính giao điểm"** áp dụng
trực tiếp ở đây: bốn hàm hình học trên (`closestPointOnAxis`,
`intersectAxisPlane`, `angleAroundAxis`, và toàn bộ `measureDrag`) là nơi DUY
NHẤT phép tính này được viết; T6 gọi lại, không viết lại.

---

## 4. Hằng số của gizmo — `src/lib/three/interaction/gizmo.ts`

Giá trị THẬT, không mô tả:

```ts
export const GIZMO_GRID_STEP_MM: Millimetres = SNAP_THRESHOLDS.gridStepMm;   // dòng 168 — lấy lại từ domain/units/snap, KHÔNG phải hằng viết tay ở đây
export const GIZMO_ANGLE_STEP_DEG: Degrees = SNAP_THRESHOLDS.angleStepDeg;   // dòng 171 — cùng nguồn
export const GIZMO_HANDLES: readonly GizmoHandle[] = ...                    // dòng 97-99 — 9 handle: 3 mode × 3 trục
export const GIZMO_AXIS_LABELS: Readonly<Record<GizmoAxis, string>> =
  Object.freeze({ x: 'X', y: 'Y', z: 'Z' });                                 // dòng 84-88 — CHỮ HOA (A6 cho phép mã trục)
export const GIZMO_MODES: readonly GizmoMode[] =
  Object.freeze(['translate', 'rotate', 'scale'] as const);                  // dòng 61-65
export type GizmoPhase = 'idle' | 'hover' | 'dragging' | 'blocked';          // dòng 156
```

`GIZMO_GRID_STEP_MM`/`GIZMO_ANGLE_STEP_DEG` không phải số cụ thể viết ở đây —
chúng ĐỌC LẠI `SNAP_THRESHOLDS` của `@/domain/units/snap`, để "handle 3D và
con trỏ 2D bắt cùng một lưới" (chú thích dòng 28-33). T6 không được viết lại
50 mm / 15° ở màn.

---

## 5. `createPointerPicker(options)` — `src/lib/three/interaction/raycast.ts`

```ts
export function createPointerPicker(options: PointerPickerOptions): PointerPicker  // dòng 298
```

`PointerPicker` (dòng 269-277):

```ts
export interface PointerPicker {
  pointerDown: (input: PointerInput) => void;
  pointerMove: (input: PointerInput) => void;
  pointerUp: (input: PointerInput) => void;
  pointerLeave: (input: PointerInput) => void;
  dispose: () => void;
}
```

`PickEvent` (dòng 121-136) — union hai nhánh `hover` | `pick`:

```ts
export type PickEvent =
  | { readonly type: 'hover'; readonly hit: EntityHit | null; readonly pointer: PointerPosition }
  | {
      readonly type: 'pick';
      readonly hit: EntityHit | null;
      readonly pointer: PointerPosition;
      readonly additive: boolean;
    };
```

`createScenePick(options: ScenePickOptions): PickAt` — dòng 217. `PickAt`
(dòng 140): `(pointer: PointerPosition) => EntityHit | null`.

`toNormalizedDevice(pointer, viewport): Vector2` — dòng 201-203.

`PointerInput` (dòng 110-118): `PointerPosition & { readonly additive?: boolean }`.

`ViewportSize` (dòng 104-107): `{ readonly width: number; readonly height: number }`.

`PickerTimers` (dòng 150-153):
`{ setTimeout: (run, delayMs) => TimerHandle; clearTimeout: (handle) => void }`.

Hằng số thật:

```ts
export const MAX_RAYCASTS_PER_SECOND = 30;                              // dòng 69
export const MIN_RAYCAST_INTERVAL_MS = Math.ceil(1_000 / MAX_RAYCASTS_PER_SECOND); // dòng 82 — = 34
export const CLICK_SLOP_PX = 4;                                         // dòng 91
```

Ví dụ gọi thật đầy đủ, `__tests__/raycast.test.ts:201-226` (soát trần 30
ray/giây):

```ts
const picker = createPointerPicker({
  now: clock.now,
  onEvent: () => {},
  pick,
  timers: clock.timers,
});

for (let step = 0; step < 600; step += 1) {
  picker.pointerMove({ x: step, y: 0 });
  clock.advance(5);
}
```

**Chốt A12 liên quan trực tiếp tới màn:** trong lúc kéo (`press.dragging ===
true`), picker KHÔNG bắn ray hover nào (`raycast.ts:388-399`, xác nhận bằng
test "hovers nothing while a drag is in progress",
`raycast.test.ts:408-422`) — T6 không cần tự tắt hover khi gizmo đang kéo,
picker tự làm.

---

## 6. `resolveHit`, `firstEntityHit` — `src/lib/three/interaction/hitTest.ts`

```ts
export function resolveHit(
  intersection: RayIntersection,
  options: HitTestOptions = {},
): EntityHit | null                                                     // dòng 167-170

export function firstEntityHit(
  intersections: readonly RayIntersection[],
  options: HitTestOptions = {},
): EntityHit | null                                                     // dòng 202-205

export function isPickableKind(kind: SelectableKind | null, layers: LayerStates): boolean  // dòng 116
```

`EntityHit` (dòng 76-88):

```ts
export interface EntityHit {
  readonly entityId: BuildEntityId;
  readonly kind: SelectableKind;
  readonly levelId: LevelId;
  readonly point: Vector3;
  readonly distance: number;
  readonly object: Object3D;
}
```

`HitTestOptions` (dòng 91-102): `{ readonly merge?: MergeResult | null;
readonly layers?: LayerStates }`.

`RayIntersection` (dòng 61-66): `HitLike & { readonly distance: number;
readonly point: Vector3 }`.

Ví dụ gọi thật, `raycast.test.ts:553` (đọc trực tiếp một mesh rời, không qua
range table):

```ts
expect(resolveHit(intersectionOn(mesh, 0))?.entityId).toBe(LOOSE_WALL);
```

Và `raycast.test.ts:647-649` cho `isPickableKind`:

```ts
expect(isPickableKind('wall', {})).toBe(true);
expect(isPickableKind(null, {})).toBe(false);
```

---

## 7. Bốn lệnh của màn — `src/lib/commands/business/wallCommands.ts`

```ts
export const WALL_COMMAND_TYPES = {
  draw: 'wall.draw',
  dragEnd: 'wall.dragEnd',
  changeThickness: 'wall.changeThickness',
  changeHeight: 'wall.changeHeight',
  changeKind: 'wall.changeKind',
  split: 'wall.split',
  merge: 'wall.merge',
  remove: 'wall.delete',
} as const;                                                              // dòng 100-109

export const WALL_END_LABELS: Readonly<Record<WallEnd, string>> = {
  start: 'đầu',
  end: 'cuối',
};                                                                        // dòng 116-119
```

### `createDragWallEndCommand` (dòng 371-417)

```ts
export interface DragWallEndInput {
  readonly wallId: WallId;
  readonly end: WallEnd;      // 'start' | 'end'
  readonly to: Point;
}
export function validateDragWallEnd(input: DragWallEndInput, context: CommandContext): string[]   // dòng 328-362
export function createDragWallEndCommand(input: DragWallEndInput, context: CommandContext): CommandResult // dòng 371
```

`validateDragWallEnd` trả **mảng rỗng** khi hợp lệ (kiểu `string[]`, không
phải `null`). Kéo openings đi theo (`reflowOpenings`) NẰM TRONG cùng một lệnh.

Ví dụ gọi thật, `src/lib/commands/business/__tests__/business.test.ts:432-433`:

```ts
createDragWallEndCommand({ wallId: SOUTH_WALL, end: 'end', to: { x: 8000, y: 0 } }, context)
```

### `createSplitWallCommand` (dòng 768-844)

```ts
export interface SplitWallInput {
  readonly wallId: WallId;
  readonly at: Point;
  readonly secondWallId: WallId;
}
export function validateSplitWall(input: SplitWallInput, context: CommandContext): string[]  // dòng 720-758
export function createSplitWallCommand(input: SplitWallInput, context: CommandContext): CommandResult // dòng 768
```

Mảng rỗng khi hợp lệ. Điểm cắt được **rơi xuống tim tường** bởi chính hình học
(`domain/walls/edit.splitWall`), không phải màn tự chiếu.

Ví dụ gọi thật, `business.test.ts:450-453`:

```ts
createSplitWallCommand(
  { wallId: SOUTH_WALL, at: { x: 2500, y: 0 }, secondWallId: SPLIT_PIECE_ID },
  context,
)
```

### `createMergeWallsCommand` (dòng 924-1005)

```ts
export interface MergeWallsInput {
  readonly wallId: WallId;
  readonly otherWallId: WallId;
}
export function validateMergeWalls(input: MergeWallsInput, context: CommandContext): string[]  // dòng 866-914
export function createMergeWallsCommand(input: MergeWallsInput, context: CommandContext): CommandResult // dòng 924
```

Mảng rỗng khi hợp lệ. Tường DÀI HƠN giữ mã, tường kia bị xoá — cả hai đều nằm
trong CÙNG một lệnh (một `changeForUpdate` + một `changeForRemove` +
`changeForUpdate`/`changeForAdd` cho các opening bị di).

Ví dụ gọi thật, `business.test.ts:457-458`:

```ts
createMergeWallsCommand({ wallId: RUN_WALL_LEFT, otherWallId: RUN_WALL_RIGHT }, context)
```

### `createChangeWallHeightCommand` (dòng 604-634)

```ts
export interface ChangeWallHeightInput {
  readonly wallId: WallId;
  readonly heightMm: number;
}
export function validateChangeWallHeight(input: ChangeWallHeightInput, context: CommandContext): string[]  // dòng 545-589
export function createChangeWallHeightCommand(input: ChangeWallHeightInput, context: CommandContext): CommandResult // dòng 604
```

Mảng rỗng khi hợp lệ. **Không sửa/xoá ô mở khi tường hạ thấp cắt qua đỉnh ô
mở** — bị TỪ CHỐI thẳng (`openingHeadReasons`, dòng 517-542), câu nêu đúng tên
ô mở và còn thiếu bao nhiêu mm.

Ví dụ gọi thật, `geometryCommands.test.ts:187`:

```ts
createChangeWallHeightCommand({ wallId: WALL, heightMm }, context)
```

### `CommandResult` — `src/lib/commands/business/shared.ts:81`

```ts
export type CommandResult = Result<Command, CommandRefusal>;
```

`Result<T, E>` từ `@/lib/http/types` — `{ ok: true; data: T } | { ok: false;
error: E }` (`lib/http/types.ts:3,114,116`). `CommandRefusal` (shared.ts:73-78):

```ts
export interface CommandRefusal {
  readonly type: CommandType;
  readonly reasons: readonly string[];   // không bao giờ rỗng — refuse() tự chèn câu mặc định nếu rỗng (shared.ts:105-109)
}
```

---

## 8. `CommandContext` — `src/lib/commands/business/shared.ts:62-70`

```ts
export interface CommandContext {
  readonly graph: NormalizedSpatial;
  readonly actorId: string;
  readonly id?: CommandId;         // chỉ cho test/replay
  readonly timestamp?: string;     // chỉ cho test/replay
}
```

Hai trường BẮT BUỘC màn phải cấp thật: `graph` (đọc từ đâu ra `NormalizedSpatial`
— xem mục 13/14: đó chính là `state.spatial`, hoặc bản xem trước qua
`selectDraftPreviewGraph`) và `actorId` (chuỗi có tên, không phải rỗng —
`dispatch`'s `validateCommands` từ chối `actorId` rỗng, `dispatch.ts:253`).
`id`/`timestamp` để trống trong sản phẩm thật — `createCommand` tự sinh
(`createCommand.ts:134,136`).

**Tiền lệ thật duy nhất trong repo** (ngoài danh sách bắt buộc đọc của tác vụ
này, nhưng cùng tầng `src/screens` nên có giá trị tham khảo trực tiếp cho T6):
`src/screens/qc/WallLayerReview/wallLayerReviewGateway.ts:510-513`:

```ts
export const commandContextOf = (
  graph: NormalizedSpatial,
  actorId: string,
): CommandContext => ({ graph, actorId });
```

---

## 9. `dispatch(...)` — `src/lib/commands/dispatch.ts`

```ts
export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult>  // dòng 700-704
```

Năm bước, đúng thứ tự (`DISPATCH_STAGES`, dòng 72-78):
`'validate' → 'apply' → 'history' → 'rules' → 'sync'` — nhãn tiếng Việt ở
`DISPATCH_STAGE_LABELS` (dòng 81-87): `kiểm hợp lệ / áp vào dữ liệu / đẩy vào
ngăn xếp hoàn tác / chạy lại luật liên quan / xếp hàng đồng bộ`.

`DispatchDeps` (dòng 156-163):

```ts
export interface DispatchDeps {
  readonly spatial: SpatialPort;
  readonly history: HistoryPort;
  readonly rules: RulesPort;
  readonly sync: SyncPort;
  readonly now?: () => string;
}
```

`SpatialPort` (dòng 124-129):

```ts
export interface SpatialPort {
  read: () => NormalizedSpatial | null;
  applyPatches: (patches: readonly SpatialPatch[]) => void;
}
```

`HistoryPort` (dòng 132-136): `{ push: (entry: UndoEntry) => void; drop:
(entryId: UndoEntryId) => void }`. `RulesPort` (dòng 145-148): `{ run: (graph,
changes) => RuleRunResult; write: (result) => void }`. `SyncPort` (dòng
151-153): `{ enqueue: (batch: DispatchBatch) => MaybePromise<void> }`.

`createIncrementalRuleRunner(options?)` (dòng 409-422) dựng sẵn một
`RulesPort` chuẩn, giữ `RuleRunState` giữa các lần gọi để chỉ chạy lại luật bị
lệnh làm STALE.

**Kiểu trả về** — `DispatchResult = Result<DispatchSuccess, DispatchFailure>`
(dòng 199). KHÔNG BAO GIỜ ném lỗi ra ngoài (chú thích hàm `dispatch`, dòng
696-699: "Never rejects"). `DispatchSuccess` (192-197): `{ entry: UndoEntry;
rules: RuleRunResult }`. `DispatchFailure` (177-190):

```ts
export interface DispatchFailure {
  readonly stage: DispatchStage;
  readonly message: string;             // câu tiếng Việt
  readonly reasons: readonly string[];  // câu tiếng Việt, không bao giờ rỗng
  readonly cause: unknown;
  readonly rolledBack: boolean;
  readonly rollbackIssues: readonly RollbackIssue[];
}
```

**Cách nó báo một lệnh bị TỪ CHỐI:** trả về `{ ok: false, error }` với
`error.stage === 'validate'` (khi hình học/hợp lệ hỏng) và `error.reasons` là
mảng câu tiếng Việt lấy nguyên từ `validateCommands`/`validate*Command` của
tầng nghiệp vụ — KHÔNG có mã lỗi tiếng Việt sinh riêng ở `dispatch`, nó chỉ
CHUYỂN TIẾP câu đã có. Bằng chứng thật, `dispatch.test.ts:402-412`:

```ts
const result = await dispatch(command, harness.deps);

expect(result.ok).toBe(false);

if (result.ok) { ... }

expect(result.error.stage).toBe('validate');
expect(result.error.message).toBe('Lệnh không hợp lệ nên đã bị chặn trước khi chạm vào dữ liệu.');
expect(result.error.reasons).toEqual([ ... ]);
```

Và ví dụ THÀNH CÔNG, `dispatch.test.ts:304-306`:

```ts
const result = await dispatch(buildThickenWallCommand(), harness.deps);

expect(result.ok).toBe(true);
```

**Đây chính là trạng thái 4 "từ chối kèm giải thích" của A11:** T6 đọc
`result.error.reasons` (khi `dispatch()`) hoặc `outcome.reasons` (khi
`DragOutcome.kind === 'refused'`, mục 1) — CÙNG một loại câu tiếng Việt, vì cả
hai đều bắt nguồn từ `validate*` của nhóm B.

---

## 10. D-06 — gộp lệnh: `src/lib/commands/mergeCommands.ts`

```ts
export const MERGE_WINDOW_MS = COALESCE_WINDOW_MS;   // dòng 34 — lấy từ @/lib/mutations/coalesce, = 400 (coalesce.ts:1)

export function canMergeCommands(earlier: Command, later: Command, windowMs = MERGE_WINDOW_MS): boolean  // dòng 48-51
export function mergeCommands(earlier: Command, later: Command): Command                                  // dòng 87
export function mergeCommandRun(commands: readonly Command[], windowMs = MERGE_WINDOW_MS): Command[]       // dòng 114-117
```

`canMergeCommands` đòi: cùng `type`, cùng `actorId`, cùng tập `scope.entityIds`
(sắp xếp rồi so), và khoảng cách hai `timestamp` nằm trong `[0, windowMs)`
(dòng 61-66 — đúng bằng cửa sổ thì KHÔNG gộp). `mergeCommands` giữ `before` của
lệnh ĐẦU và `after`/`timestamp` của lệnh CUỐI (dòng 87-104). `mergeCommandRun`
gộp một MẢNG lệnh, trái sang phải, từng cặp một qua `canMergeCommands` (dòng
114-133) — đây là hàm TIỆN ÍCH gộp cả lô, KHÔNG phải thứ được gọi tự động bên
trong `HistoryStack.push` (xem dưới).

**Trả lời dứt khoát — để một phiên kéo 40 khung hình sinh ĐÚNG MỘT bước hoàn
tác, T6 KHÔNG cần gọi `mergeCommandRun` (hay bất cứ hàm gộp nào) một lần lúc
thả tay, và `commit`/`dispatch` cũng không "tự gộp" theo nghĩa gộp NHIỀU LỆNH
đã dispatch:**

Bằng chứng: `createDragSession` (mục 1) chỉ build **một** `Command` duy nhất,
tại `drop()`, bất kể bao nhiêu khung hình `move()` đã chạy trước đó
(`gizmo.test.ts:509-531`, đã dẫn ở mục 1). Vì vậy một phiên kéo hoàn chỉnh chỉ
tạo ra **một** lời gọi `dispatch(command, deps)` — không có gì để gộp, vì
không có lệnh thứ hai nào được sinh ra trong lúc kéo. Bảo đảm "một phiên kéo
một bước hoàn tác" nằm ở **cấu trúc của `dragSession.ts`** (chỉ `drop()` có
đường tới `binding.build`), không nằm ở tầng gộp lệnh.

Tầng gộp (`canMergeCommands`/`mergeCommands`, và cơ chế tương đương trong
`store/commit.ts` — mục 12) chỉ có tác dụng khi có **NHIỀU lệnh RIÊNG BIỆT**
được dispatch/commit gần nhau về thời gian (ví dụ nhiều lần bấm mũi tên bàn
phím nudge cùng một tường, hoặc nhiều phiên kéo/thả liên tiếp trong 400 ms) —
lúc đó việc gộp diễn ra TỰ ĐỘNG bên trong `HistoryStack.push()`
(`history.ts:281-296`, gọi thẳng `canMergeCommands`/`mergeCommands`, không qua
`mergeCommandRun`), KHÔNG cần T6 tự gọi gì thêm. Bằng chứng,
`history.test.ts:320-346` ("folds consecutive edits inside the window into one
step"): ba lệnh `dragCommand` đẩy vào `stack.push()` ở 0 ms/100 ms/200 ms →
`stack.undoSteps()` có **đúng 1** phần tử, `undoPatches` đưa về trạng thái
TRƯỚC lệnh đầu, `redoPatches` đưa tới trạng thái SAU lệnh cuối.

---

## 11. `createHistoryStack`, `HistoryStack` — `src/lib/commands/history.ts`

```ts
export const MAX_HISTORY_STEPS = 100;                                    // dòng 41
export function createHistoryStack(options: CreateHistoryStackOptions = {}): HistoryStack  // dòng 267
```

`HistoryStack` (dòng 100-128):

```ts
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
```

`HistoryStep` (dòng 61-79) mang `id, label, commands, undoPatches, redoPatches,
selectionBefore, selectionAfter, timestamp, entryIds`. `HistoryPushInput`
(82-88): `{ entry: UndoEntry; selectionBefore: SelectionSnapshot;
selectionAfter: SelectionSnapshot }`. `HistoryTransition` (91-98): `{
direction: 'undo' | 'redo'; step: HistoryStep; patches: readonly
SpatialPatch[]; selection: SelectionSnapshot }`. `buildHistoryLabel(commands,
fallback): string` (192-203) — nhãn tự sinh kiểu "Kéo tường W-000014AAAA" từ
`type`/`scope` của lệnh, KHÔNG cần T6 tự viết nhãn cho từng loại lệnh.

**Đếm bước hoàn tác bằng cách nào — cho T7 in ra "lịch sử tăng đúng 1":**

CÓ HAI cơ chế đếm THẬT trong repo, không lệ thuộc nhau, tuỳ đường ghi T6 chọn:

1. **Nếu màn dùng `dispatch()` + một `HistoryStack` riêng** (đúng khuôn
   `createWallLayerDispatchDeps` của màn chị em S-12,
   `wallLayerReviewGateway.ts:627-662` — KHÔNG thuộc danh sách đọc bắt buộc
   của tác vụ này, dẫn thêm vì là tiền lệ thật DUY NHẤT): đếm bằng
   `historyStack.undoSteps().length`. Bằng chứng, `history.test.ts:335-337`:
   ```ts
   const steps = stack.undoSteps();
   expect(steps).toHaveLength(1);
   ```
2. **Nếu màn ghi thẳng qua `commit()` của `src/store`** (không qua
   `dispatch`/`HistoryStack`): đếm bằng `useStore.temporal.getState()
   .pastStates.length` (zundo) — đây là ngăn xếp hoàn tác THẬT SỰ chạy khi
   người dùng bấm Ctrl+Z trên toàn ứng dụng (`store/index.ts:50-69`, theo dõi
   ĐÚNG MỘT trường `spatial`, `limit: 100`). Bằng chứng,
   `store/__tests__/draftPreview.test.ts:67,141`:
   ```ts
   const undoSteps = (): number => useStore.temporal.getState().pastStates.length;
   // ...
   commit({ op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: target } }, '...');
   expect(undoSteps()).toBe(1);
   ```

Hai cơ chế KHÔNG loại trừ nhau: nếu `SpatialPort.applyPatches` của
`dispatch()` được cài bằng `commit()` (đúng khuôn S-12,
`wallLayerReviewGateway.ts:589-599`), thì MỘT `dispatch()` thành công đẩy
CẢ HAI bộ đếm lên đồng thời — nhưng `Ctrl+Z` thật sự chạy trên bộ đếm nào là
quyết định T6 phải chốt tường minh (S-12 chốt dùng `HistoryStack.undo()`, XEM
`useWallLayerReview.ts:938-953`, KHÔNG dùng `useStore.temporal.getState()
.undo()` — đây là tiền lệ, không phải luật bắt buộc). T7 phải hỏi T6 dùng cơ
chế nào trước khi viết bài kiểm đếm.

---

## 12. `commit`, `previewEdit`, `discardPreview` — `src/store/commit.ts`

```ts
export function commit(patch: SpatialPatch | readonly SpatialPatch[], label: string): CommitResult  // dòng 98-145
export function previewEdit(entityId: EntityId, preview: SpatialEntity): void                        // dòng 179-193
export function discardPreview(): void                                                               // dòng 201-205
```

`CommitResult` (dòng 9-13): `{ undo: () => void; label: string; timestamp:
number }` — `undo()` gọi `useStore.temporal.getState().undo()` (zundo), KHÔNG
phải `HistoryStack.undo()` (mục 11 — hai chuyện khác nhau, đừng lẫn).

**Ba lời hứa của bản nháp**, dán NGUYÊN VĂN chú thích cuối file (dòng
162-174):

> - **Không bao giờ vào lịch sử hoàn tác.** `temporal` chỉ theo dõi `spatial`
>   (`store/index.ts`, `partialize`), và bản nháp không nằm trong `spatial`.
> - **Không bao giờ được tự lưu ra máy chủ.** `useAutosave` cũng chỉ đọc
>   `state.spatial`; bản nháp không có đường nào tới đó.
> - **Bị dọn khi người dùng thả tay.** Lúc ấy lệnh thật chạy qua `commit`, và
>   `commit` dọn bản nháp trước khi trả về — xem dưới.

**Ai dọn bản nháp khi nào — chính xác cho Esc:**

- **Thả tay (thao tác thật thành công):** `commit()` TỰ dọn — dòng 131 gọi
  `discardPreview()` **vô điều kiện**, ngay sau khi `store._applyPatches(...)`
  chạy xong, TRƯỚC khi trả `CommitResult`. T6 **không cần** tự gọi
  `discardPreview()` sau một `commit()` thành công — gọi thêm cũng vô hại vì
  `discardPreview()` tự kiểm `draftOperations.length > 0` trước khi ghi (dòng
  201-205).
- **Esc / huỷ / lệnh bị từ chối (không có thao tác thật nào chạy):** T6 PHẢI
  tự gọi `discardPreview()` — không ai khác gọi hộ. Đây đúng là điều
  `dragSession.cancel()` (mục 1) KHÔNG tự làm (nó chỉ phát preview rỗng,
  không đụng store) — T6 nối `cancel()` với `discardPreview()` trong hook.

Ví dụ gọi thật đủ cả ba hàm, `store/__tests__/draftPreview.test.ts:89-142`:

```ts
for (let step = 0; step < DRAG_STEP_COUNT; step += 1) {
  previewEdit(wall.id, { ...wall, thicknessMm: wall.thicknessMm + step });
}
// 30 lượt gọi previewEdit → ĐÚNG MỘT thao tác nháp (amend, không append):
expect(staged).toHaveLength(1);

// ...

commit(
  { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: target } },
  `Đổi độ dày tường thành ${String(target)} mm.`,
);
expect(useStore.getState().draftOperations).toStrictEqual([]);   // commit() đã tự dọn
expect(selectDraftPreviewGraph(useStore.getState())).toBeNull();
```

```ts
discardPreview();  // không có nháp nào → không ghi gì (idempotent)
```

Đọc bản xem trước qua selector `selectDraftPreviewGraph`/`selectDraftEntityIds`
của `src/store/selectors.ts:372-373,390-391` — đây LÀ chỗ T6 lấy đồ thị có
preview để 3D vẽ đè, không tự ghép `draftOperations` bằng tay.

---

## 13. `SpatialPatch`, `SpatialEntity`, `NormalizedSpatial`

`SpatialPatch` — `src/domain/spatial/applyPatch.ts:25-54`, union ba nhánh theo
`op`:

```ts
interface AddPatch<K extends EntityKind>    { op: 'add';    kind: K; entity: EntityByKind[K] }
interface UpdatePatch<K extends EntityKind> { op: 'update'; kind: K; id: IdByKind[K]; changes: Partial<EntityByKind[K]> }
interface RemovePatch<K extends EntityKind> { op: 'remove'; kind: K; id: IdByKind[K] }
export type SpatialPatch = { [K in EntityKind]: AddPatch<K> | UpdatePatch<K> | RemovePatch<K> }[EntityKind];
```

**Chú ý cho T6:** `commandToPatches` (`src/lib/commands/invert.ts:51-63`, dùng
bởi `dispatch`) chỉ BAO GIỜ sinh ra `'add'` hoặc `'remove'` — KHÔNG BAO GIỜ
`'update'` (một `changeForUpdate` được dịch thành `'add'` với snapshot ĐẦY ĐỦ,
vì "add" trong `applyPatch` vừa chèn vừa THAY THẾ toàn bộ, dòng 55 chú thích
"`add` both inserts and replaces"). Nhánh `'update'` (patch từng phần) chỉ
xuất hiện khi AI GỌI `commit()` TRỰC TIẾP với một `UpdatePatch` tay viết (đúng
như ví dụ `draftPreview.test.ts:134` ở mục 12) — không phải đường của tầng
lệnh (nhóm B). Nếu T6 đi qua `dispatch()`, patch luôn là `add`/`remove` đầy
đủ snapshot.

`SpatialEntity` — `src/domain/spatial/normalize.ts:46`:
`export type SpatialEntity = EntityByKind[EntityKind];` (hợp của bảy loại thực
thể: `level, wall, opening, furniture, room, axis, dimension` — `EntityByKind`,
dòng 35-43).

`NormalizedSpatial` — `normalize.ts:49-55`:

```ts
export interface NormalizedSpatial {
  building: Building;
  byId: Readonly<Record<string, SpatialEntity>>;
  byLevel: Readonly<Record<string, readonly EntityId[]>>;
  byKind: Readonly<Record<EntityKind, readonly EntityId[]>>;
  notes: readonly Note[];
}
```

---

## 14. Selector lấy `Wall` theo `WallId`, và ô mở gắn trên một tường

**KHÔNG có trong `src/store/selectors.ts`.** Đã đọc toàn văn file đó (415
dòng) — nó chỉ có: `selectRoomsWithArea`, `selectTotalAreaM2`,
`selectViolations`, `selectViolationsByFloor`, `selectFloorViolations`,
`selectSelectedEntities`, `selectDraftPreviewGraph`, `selectDraftEntityIds`,
`getRuleRunDiagnostics`, `resetSelectorCaches`. Không hàm nào tên có
"Wall"/"Opening", không hàm nào nhận `WallId` làm tham số.

**Hàm THẬT làm đúng việc này nằm ở `src/lib/commands/business/shared.ts`**,
nhận thẳng một `NormalizedSpatial` (không phải `RootState` của Zustand — T6
phải tự truyền `state.spatial` hoặc đồ thị xem trước vào):

```ts
export const readOf = <K extends EntityKind>(
  graph: NormalizedSpatial,
  kind: K,
  id: IdByKind[K],
): EntityByKind[K] | null => readEntity(graph, kind, id);          // shared.ts:157-161, bọc readEntity của applyPatch.ts:275-287

export const openingsOfWall = (graph: NormalizedSpatial, wallId: WallId): readonly GraphOpening[] =>
  entitiesOfKind(graph, 'opening').filter((opening) => opening.wallId === wallId);  // shared.ts:170-171
```

Cách gọi cho một `Wall`: `readOf(graph, 'wall', wallId)` (trả `Wall | null`).
Ví dụ gọi thật, chính `wallCommands.ts:169` (`lookupWall`):
`readOf(context.graph, 'wall', wallId)`.

Cách gọi cho ô mở của một tường: `openingsOfWall(graph, wallId)` — ví dụ thật,
`wallCommands.ts:190` (`attachedOpeningsOf`): `openingsOfWall(context.graph,
wall.id)`.

`graph` truyền vào phải là `state.spatial` (đọc thẳng store) hoặc
`selectDraftPreviewGraph(state)` (mục 12) khi cần đọc CẢ bản xem trước — hai
nguồn khác nhau, `readOf`/`openingsOfWall` không tự biết chọn.

---

## NOT FOUND

- `src/components/viewer/GizmoHud.tsx` — **NOT FOUND.** Thư mục
  `src/components/viewer/` không tồn tại (đã `ls src/components/` — không có
  thư mục con `viewer`). Điều phối viên đã báo trước khoản sai này.
- `src/components/viewer/MeasurementOverlay.tsx` — **NOT FOUND.** Cùng lý do
  trên.
- Selector `selectWallById` / `selectOpeningsOnWall` (hay tên tương đương)
  trong `src/store/selectors.ts` — **NOT FOUND.** Xem mục 14: chức năng có
  thật nhưng ở `src/lib/commands/business/shared.ts` (`readOf`,
  `openingsOfWall`), nhận `NormalizedSpatial` thẳng, không phải một selector
  Zustand nhận `RootState`.
- File test riêng cho `dragSession.ts` (kiểu `dragSession.test.ts`) — **NOT
  FOUND** như một file độc lập; các bài kiểm `createDragSession` nằm chung
  trong `src/lib/three/interaction/__tests__/gizmo.test.ts` (dòng 45-48 import
  `createDragSession` từ `../dragSession`). Không phải thiếu kiểm thử — chỉ
  không tách file.
- File test riêng cho `hitTest.ts` (kiểu `hitTest.test.ts`) — **NOT FOUND**
  như một file độc lập; các bài kiểm `resolveHit`/`firstEntityHit`/
  `isPickableKind` nằm chung trong
  `src/lib/three/interaction/__tests__/raycast.test.ts` (dòng 21 import từ
  `../hitTest`).
