# Hợp đồng tầng lệnh / store / tự lưu — PropertyInspector

Khảo sát T2, chỉ đọc mã đã có trong `master` tại thời điểm khảo sát. Không đoán tên hàm:
mọi chữ ký dưới đây trích thẳng từ file, kèm `file:dòng`. Mục nào tầng lệnh không cung cấp
thì ghi `NOT FOUND` và nêu chỗ gần nhất.

Bối cảnh: PropertyInspector là panel phải 344px trong `Viewer3D`. Mọi ô nhập phải TẠO LỆNH
rồi điều phối qua `dispatch`, không được ghi thẳng vào store (A10). Tài liệu này không phải
kế hoạch thực thi — nó là bản kê những gì tầng lệnh/store/tự lưu THẬT SỰ có, để T5 (hook) và
T3 (component) dựa vào mà không phải đọc lại toàn bộ `src/lib/commands` và `src/store`.

> ## CẬP NHẬT 2026-09-06 — mười hai lỗ hổng của khảo sát này ĐÃ ĐƯỢC VÁ
>
> Bản khảo sát dưới đây đúng với `master` **tại thời điểm khảo sát**. Từ lượt U1–U8
> (nhánh `mungvu2004/fix-u8-integrate`) mười hai kết luận `NOT FOUND` của nó đã có lời
> giải trong mã, nên mọi mục `NOT FOUND` phải đọc kèm bảng này:
>
> | # | Lỗ hổng của khảo sát | Lời giải hiện có |
> |---|---|---|
> | 1 | Không lệnh nào ghi `Wall.heightMm` | `createChangeWallHeightCommand` (`lib/commands/business/wallCommands.ts`) — hạ xuống dưới đỉnh một ô mở bị TỪ CHỐI kèm lý do tiếng Việt |
> | 2 | Không lệnh nào ghi lại kích thước `boundingBox` của nội thất | `createResizeFurnitureCommand` (`lib/commands/business/openingCommands.ts`) — giữ nguyên tâm, giãn hộp quanh tâm |
> | 3 | `openingsOfRoom` không export, đòi cả một `RuleContext` | `src/domain/spatial/roomOpenings.ts` — hàm thuần `openingsOfRoom(room, walls, openings)` + `countOpeningsByKind` |
> | 4 | Không có khái niệm khuôn mẫu thuộc tính ở bất cứ tầng nào | `PropertyTemplate` + `ENDPOINTS.propertyTemplates` + `queryKeys.template.byProject` + `WriteOperation` `createPropertyTemplate` |
> | 5 | Không endpoint nào nhận lớp không gian, nên tự lưu NÍN | `SpatialApi.writeLayer` + `ENDPOINTS.spatial.layer`; panel gửi thật qua `propertyInspectorGateway.persistProperties` |
> | 6 | `defaultRuleRegistry` chỉ đăng ký 8/25 luật | `src/domain/rules/defaults.ts` — 25 luật đăng ký, 23 bật, `FURNITURE-CLASH` hiện thật ở nhóm "Kiểm tra" |
> | 7 | Không có lệnh xả tự lưu, nên Ctrl+S không có gì để gọi | `useAutosaveFlush` + `flushAutosaves` (`hooks/useAutosave.ts`), nối vào Ctrl+S ở `routes/router.tsx` |
> | 8 | Không có màn tìm kiếm cho Ctrl+F | `ObjectSearch` đăng ký `Ctrl+F` ở phạm vi `canvas` (`screens/viewer/Viewer3D/ObjectSearch.tsx`) |
> | 9 | Không có bảng phím tắt toàn cục cho phím `?` | `GlobalShortcutHelp` (`components/shell/`), đọc thẳng `appShortcutRegistry.listShortcuts()` |
> | 10 | Escape ở tầng vỏ chưa được nối | `UndoShortcuts` đăng ký `global.closeTopLayer` → `uiSlice.closeDialog()` |
> | 11 | Không có `toFurnitureViewModel` | `lib/viewmodel/toViewModel.ts` — thêm hàm và nhánh `'furniture'` của `ViewModelInput` |
> | 12 | Không có kênh xem trước 3D gọi được từ tầng màn hình | `previewEdit`/`discardPreview` (`store/commit.ts`), `selectDraftPreviewGraph`, `lib/three/preview/`, `ViewerSceneHandle.preview` |
>
> Ba mục `NOT FOUND` khác của khảo sát KHÔNG được vá và vẫn đúng nguyên văn: đổi chiều mở
> (`swing`) của một ô mở đã có — panel dựng lệnh riêng trong cổng của nó; đổi tường chủ của
> một ô mở; và `isInterior` của tường — dòng đó CỐ Ý giữ chỉ đọc vì nó suy từ `kind`, ghi
> vào nó sẽ làm mất `loadBearing` không có đường lấy lại.

---

## C1. Lệnh sửa thuộc tính (S-07)

### Tường (`src/lib/commands/business/wallCommands.ts`)

Bảy loại lệnh tường khai tại `WALL_COMMAND_TYPES` (`wallCommands.ts:98-106`): `wall.draw` ·
`wall.dragEnd` · `wall.changeThickness` · `wall.changeKind` · `wall.split` · `wall.merge` ·
`wall.delete`. Panel chỉ cần bốn hàm dưới — vẽ/cắt/nối không thuộc panel thuộc tính.

**Đổi độ dày**
```ts
interface ChangeWallThicknessInput { wallId: WallId; thicknessMm: number }         // wallCommands.ts:420-423
function validateChangeWallThickness(input: ChangeWallThicknessInput, context: CommandContext): string[]        // wallCommands.ts:426-452
function createChangeWallThicknessCommand(input: ChangeWallThicknessInput, context: CommandContext): CommandResult  // wallCommands.ts:461-489
```
`CommandContext` (đầu vào `context`) lấy từ `business/shared.ts:61-69`: `{ graph: NormalizedSpatial;
actorId: string; id?: CommandId; timestamp?: string }`. `graph` là đồ thị đang sửa — panel đọc
từ store (`useStore.getState().spatial` hoặc tương đương), KHÔNG tự giữ bản sao. `CommandResult`
(`shared.ts:80`) là `Result<Command, CommandRefusal>` của `@/lib/http/types`; nhánh lỗi
`CommandRefusal` (`shared.ts:72-77`) mang `reasons: readonly string[]` tiếng Việt để hiện ngay
dưới ô nhập — validate đã chạy TRƯỚC khi build, nên panel không cần gọi `validateChangeWallThickness`
riêng, chỉ cần đọc `result.error.reasons` khi `result.ok === false`.
Việc dựng `context` mẫu: `commandContextOf(graph, actorId)` (`screens/qc/WallLayerReview/wallLayerReviewGateway.ts:510-513`) — một hàm một dòng, không phải API của tầng lệnh, panel tự viết lại một bản tương tự trong thư mục màn.

**Đổi loại tường**
```ts
interface ChangeWallKindInput { wallId: WallId; kind: WallKind }                   // wallCommands.ts:495-498
function validateChangeWallKind(input: ChangeWallKindInput, context: CommandContext): string[]                  // wallCommands.ts:501-520
function createChangeWallKindCommand(input: ChangeWallKindInput, context: CommandContext): CommandResult        // wallCommands.ts:523-554
```

**Kéo đầu/cuối tường** (nếu panel có ô nhập toạ độ, không chỉ đọc)
```ts
interface DragWallEndInput { wallId: WallId; end: WallEnd /* 'start' | 'end' */; to: Point }  // wallCommands.ts:312-316
function validateDragWallEnd(input: DragWallEndInput, context: CommandContext): string[]      // wallCommands.ts:325-359
function createDragWallEndCommand(input: DragWallEndInput, context: CommandContext): CommandResult  // wallCommands.ts:368-414
```
Lệnh này TỰ kéo theo ô mở trên tường qua `reflowOpenings` (`wallCommands.ts:391`) — mọi ô mở bị
dịch offset nằm trong CÙNG một `Command.changes`, nên một Ctrl+Z hoàn tác cả tường lẫn ô mở.

### Ô mở (`src/lib/commands/business/openingCommands.ts`)

Tám loại lệnh chung một file, khai tại `OPENING_COMMAND_TYPES` (`openingCommands.ts:83-92`):
`opening.add` · `opening.move` · `opening.resize` · `opening.delete` · `furniture.add` ·
`furniture.move` · `furniture.rotate` · `furniture.delete`.

**Di chuyển dọc tường** (đổi vị trí, không đổi tường chủ)
```ts
interface MoveOpeningInput { openingId: OpeningId; offsetMm: number }              // openingCommands.ts:351-355
function validateMoveOpening(input: MoveOpeningInput, context: CommandContext): string[]        // openingCommands.ts:358-379
function createMoveOpeningCommand(input: MoveOpeningInput, context: CommandContext): CommandResult  // openingCommands.ts:382-411
```

**Đổi kích thước** (rộng / cao / cao độ bậu cửa sổ — đúng ba trường spec đòi)
```ts
interface ResizeOpeningInput {                                                     // openingCommands.ts:417-422
  openingId: OpeningId;
  widthMm?: number;
  heightMm?: number;
  sillHeightMm?: number;
}
function validateResizeOpening(input: ResizeOpeningInput, context: CommandContext): string[]        // openingCommands.ts:433-488
function createResizeOpeningCommand(input: ResizeOpeningInput, context: CommandContext): CommandResult  // openingCommands.ts:497-536
```
Ba trường là optional — panel chỉ gửi trường người dùng vừa đổi, không phải gửi đủ ba. Tâm ô mở
được giữ nguyên: `offsetMm` (mép trái) tự dịch lùi nửa độ tăng rộng (`openingCommands.ts:517`),
panel không tự tính lại `offsetMm`.

**Xoá**
```ts
interface DeleteOpeningInput { openingId: OpeningId }                              // openingCommands.ts:542-544
function validateDeleteOpening(input: DeleteOpeningInput, context: CommandContext): string[]
function createDeleteOpeningCommand(input: DeleteOpeningInput, context: CommandContext): CommandResult
```

**NOT FOUND — đổi chiều mở (swing) của một ô mở ĐÃ CÓ.** `swing: SwingDirection` chỉ được đặt ở
lúc TẠO (`AddOpeningInput.swing`, dùng tại `openingCommands.ts:210,220,326`); `ResizeOpeningInput`
(`openingCommands.ts:417-422`) không mang trường `swing`, và không hàm `validate…`/`create…Command`
nào khác trong file đổi trường này trên một ô mở đang tồn tại. Nơi gần nhất: `AddOpeningInput`
(`openingCommands.ts:~200-224`, đọc quanh dòng 210) — chỉ dùng được lúc thêm mới.

**NOT FOUND — đổi tượng chủ (đổi ô mở sang tường khác).** Không `Input` nào trong tám lệnh mang
một `wallId` ĐÍCH khác `wallId` đang gắn; `MoveOpeningInput` chỉ có `offsetMm` (di chuyển DỌC
tường hiện tại). Không có hàm `reattachOpening`/`changeOpeningHost` nào trong repo.

### Phòng (`src/lib/commands/business/roomFloorCommands.ts`)

Sáu loại lệnh khai tại `ROOM_FLOOR_COMMAND_TYPES` (`roomFloorCommands.ts:67`, không trích được
nguyên văn object trong khảo sát này — xem file). Panel cần hai lệnh đầu.

**Đổi tên**
```ts
interface RenameRoomInput { roomId: RoomId; name: string }                         // roomFloorCommands.ts:161-164
function validateRenameRoom(input: RenameRoomInput, context: CommandContext): string[]          // roomFloorCommands.ts:167-206
function createRenameRoomCommand(input: RenameRoomInput, context: CommandContext): CommandResult  // roomFloorCommands.ts:209-236
```
Validate tự chặn tên trùng trong CÙNG tầng (`roomFloorCommands.ts:194-203`) và tên rỗng/quá dài
(`MAX_ROOM_NAME_LENGTH`, dòng 183-188) — panel không tự viết lại hai luật này.

**Đổi công năng**
```ts
interface ChangeRoomUsageInput { roomId: RoomId; usage: RoomUsage }                 // roomFloorCommands.ts:242-245
function validateChangeRoomUsage(input: ChangeRoomUsageInput, context: CommandContext): string[]  // roomFloorCommands.ts:248-269
function createChangeRoomUsageCommand(input: ChangeRoomUsageInput, context: CommandContext): CommandResult  // roomFloorCommands.ts:278-305
```

### Nội thất (`src/lib/commands/business/openingCommands.ts`, cùng file với ô mở)

**Di chuyển**
```ts
interface MoveFurnitureInput { furnitureId: FurnitureId; to: Point }                // openingCommands.ts:744-747
function validateMoveFurniture(input: MoveFurnitureInput, context: CommandContext): string[]      // openingCommands.ts:765-799
function createMoveFurnitureCommand(input: MoveFurnitureInput, context: CommandContext): CommandResult  // openingCommands.ts:802-831
```

**Xoay** (đây là câu trả lời cho "góc xoay nội thất — CÓ")
```ts
interface RotateFurnitureInput { furnitureId: FurnitureId; rotationDeg: number }    // openingCommands.ts:837-840
function validateRotateFurniture(input: RotateFurnitureInput, context: CommandContext): string[]  // openingCommands.ts:843-866
function createRotateFurnitureCommand(input: RotateFurnitureInput, context: CommandContext): CommandResult  // openingCommands.ts:874-903
```
Góc tự gấp về `[0, 360)` bằng `normaliseDegrees` (`openingCommands.ts:892`) — panel không tự mod 360.

**~~NOT FOUND~~ — ĐÃ VÁ (lỗ hổng #2, U1): `ResizeFurnitureInput` /
`createResizeFurnitureCommand` nay có thật trong `openingCommands.ts`, giữ nguyên tâm và giãn
hộp bao quanh tâm. Đoạn dưới giữ nguyên làm lịch sử của quyết định.**

~~NOT FOUND — đổi kích thước nội thất.~~ `Furniture.boundingBox` (`src/domain/spatial/types.ts:172`,
kiểu `BoundingBox`) là trường DUY NHẤT mang kích thước, nhưng trong cả tám lệnh của
`openingCommands.ts` không hàm nào ghi lại `boundingBox` để THAY ĐỔI kích thước — `movedFurniture`
(`openingCommands.ts:750-761`, dùng bởi `createMoveFurnitureCommand`) chỉ DỊCH hộp bao theo cùng
độ dịch của `centre`, giữ nguyên kích thước. Không `ResizeFurnitureInput`/`createResizeFurnitureCommand`
nào tồn tại. Nơi gần nhất nếu cần dựng: `movedFurniture` (dòng 750) cho thấy khuôn đọc/ghi
`boundingBox`, và `RotateFurnitureInput` (dòng 837) cho thấy khuôn một lệnh nội thất.

---

## C2. Điều phối (S-05) + ghi store (A10)

### `dispatch` — `src/lib/commands/dispatch.ts`

```ts
function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult>   // dispatch.ts:700-704
```
Năm bước, LUÔN đúng thứ tự này (`dispatch.ts:72-78`, `DISPATCH_STAGES`):

| # | Bước | Việc |
|---|---|---|
| 1 | `validate` | `validateCommands` (dòng 220) so lệnh với đồ thị; hỏng thì store KHÔNG bị đụng |
| 2 | `apply` | `deps.spatial.applyPatches(commandToPatches(command))` — ghi duy nhất |
| 3 | `history` | `deps.history.push(entry)` — một mục hoàn tác |
| 4 | `rules` | `deps.rules.run` rồi `deps.rules.write` — chỉ chạy lại luật bị ảnh hưởng |
| 5 | `sync` | `deps.sync.enqueue(batch)` — xếp hàng đồng bộ / đánh dấu bẩn cho tự lưu |

Lỗi ở bất kỳ bước nào (trừ bước 1) sẽ ROLLBACK các bước trước đó (`dispatch.ts:485-542`) — panel
không cần tự viết logic hoàn tác khi dispatch thất bại giữa chừng.

`SpatialPort` (`dispatch.ts:124-129`) là cổng DUY NHẤT `dispatch` dùng để ghi:
```ts
interface SpatialPort {
  read: () => NormalizedSpatial | null;
  applyPatches: (patches: readonly SpatialPatch[]) => void;
}
```

### `commit` — `src/store/commit.ts`

```ts
function commit(patch: SpatialPatch | readonly SpatialPatch[], label: string): CommitResult  // commit.ts:17-39
interface CommitResult { undo: () => void; label: string; timestamp: number }                 // commit.ts:4-8
```
Bên trong: `store._applyPatches(...)` rồi `store.setLastCommit(label, timestamp)` (`commit.ts:25,28`).
`CommitResult.undo` gọi thẳng `useStore.temporal.getState().undo()` (zundo, `commit.ts:34`) — đây
là ngăn xếp hoàn tác KHÁC với ngăn xếp `history.ts` ở mục C3; xem cảnh báo ở đó.

### Đường dây đã có tiền lệ: `SpatialPort.applyPatches` = `commit()`

Sáu màn QC hiện có (`WallLayerReview`, `ObjectLayerReview`, `FloorManager`,
`ThicknessStandardization`, `RoomLabelReview`, `DimensionOcrReview`, `AxisGridManager`) đều nối
`dispatch` với `commit` theo đúng một khuôn, tài liệu hoá tại
`screens/qc/WallLayerReview/wallLayerReviewGateway.ts:9-20` (nguyên văn: *"Quyết định đã chốt của
điều phối viên: lệnh nghiệp vụ S-07 đi qua dispatch, và SpatialPort.applyPatches của dispatch được
cài bằng commit(patches, label)"*). Hàm dựng cổng ghi, chép lại nguyên khối
(`wallLayerReviewGateway.ts:589-599`):
```ts
function createCommitSpatialPort(graph: WallLayerGraphPort, labelOf: () => string): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => { commit(patches, labelOf()); },
  };
}
```
PropertyInspector nên đi lại đúng đường này (không phải phát minh cổng ghi mới): `commit` chỉ
được GỌI TỪ BÊN TRONG adapter này, không bao giờ trực tiếp từ hook/component của panel.

### Đường đi từ "người dùng gõ số" đến "store đổi" — 5 bước, tên hàm thật

1. **View** — ô nhập trong PropertyInspector gọi `onChange`/`onCommit` của hook màn (T3/T5 sở hữu).
2. **Hook màn dựng lệnh** — gọi `createChangeWallThicknessCommand(input, context)`
   (`wallCommands.ts:461`), với `context = { graph: useStore.getState().spatial, actorId }`
   (khuôn `commandContextOf`, `wallLayerReviewGateway.ts:510-513`). Nếu `result.ok === false`, hiện
   `result.error.reasons` ngay dưới ô nhập, KHÔNG gọi dispatch.
3. **Điều phối** — `await dispatch(result.data, deps)` (`dispatch.ts:700`), với `deps.spatial`
   là `createCommitSpatialPort(...)` (mục trên).
4. **Ghi store** — bên trong bước `apply` của `dispatch`, `commit(patches, label)` (`commit.ts:17`)
   gọi `store._applyPatches` rồi `store.setLastCommit`.
5. **Hoàn tất** — bước `history` của `dispatch` đẩy vào ngăn xếp `history.ts` (mục C3, KHÔNG phải
   `useStore.temporal`); bước `sync` gọi `deps.sync.enqueue`, nơi PropertyInspector đánh dấu bản
   vẽ bẩn để tự lưu (mục C6) nhận biết.

### Luật `local/no-direct-set` — cách dùng đúng

`eslint-rules/no-direct-set.js:44-76` cấm gọi `set(...)` trần hoặc `<bất kỳ>.setState(...)` ở MỌI
nơi ngoài `src/store/**` và `src/lib/testing/**` (khai tại `.eslintrc.cjs`, dẫn lại ở
`no-direct-set.js:18-23`). Hệ quả cho panel: không gọi `useStore.setState`, không gọi action nào
của slice trực tiếp (`store.setSelection`, v.v. dùng được vì đó không phải ghi dữ liệu không gian —
chỉ `_applyPatches`/spatial-mutating actions mới đi qua `commit`). Cách dùng đúng DUY NHẤT để đổi
dữ liệu không gian: build lệnh (mục C1) → `dispatch` (mục này) → `commit` chạy bên trong adapter.
Panel không bao giờ import `commit` để gọi trực tiếp — `commit` chỉ xuất hiện trong file cổng
(gateway) của màn, đúng khuôn `wallLayerReviewGateway.ts:589-599`.

---

## C3. Lịch sử / hoàn tác (S-06)

### `src/lib/commands/history.ts` — ngăn xếp thật, KHÔNG phải zundo

```ts
function createHistoryStack(options?: CreateHistoryStackOptions): HistoryStack  // history.ts:267-388
interface HistoryStack {                                                        // history.ts:100-128
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
`MAX_HISTORY_STEPS = 100` (`history.ts:41`). Một bước ghi CẢ lựa chọn trước/sau
(`SelectionSnapshot`, `history.ts:50-53`) — undo trả lại đúng vùng chọn lúc đó, không chỉ dữ liệu.

### `invert.ts` — vì sao một lệnh đổi độ dày 220→330 hoàn tác được bằng MỘT Ctrl+Z

```ts
function invertCommand(command: Command): Command      // invert.ts:43-47
function commandToPatches(command: Command): readonly SpatialPatch[]  // invert.ts:70-71
```
`invertCommand` chỉ HOÁN ĐỔI `before`/`after` của từng `EntityChange` (invert.ts:29-35) — vì
`changeForUpdate` (`createCommand.ts:52-62`) luôn lưu ĐỦ ảnh chụp hai đầu (không phải diff từng
trường), việc hoàn tác một lệnh 220→330 không cần biết ý nghĩa của trường `thicknessMm`: nó chỉ
áp lại `before` (220) làm `after` mới. Đây là lý do "mọi lệnh tự hoàn tác được bằng cấu trúc" mà
`createCommand.ts:1-8` nói tới.

### Ai gọi `undo()` — hai khuôn khác nhau đang tồn tại song song

- **Khuôn cũ** (`ScaleCalibration`): `useStore.temporal.getState().undo()` — zundo, gọi trực tiếp
  (`screens/pipeline/ScaleCalibration/useScaleCalibration.ts` dùng `commit()` trực tiếp, không qua
  `dispatch`; ví dụ `useUndoableToast.ts:26`).
- **Khuôn mới, 6/7 màn QC hiện có** (`WallLayerReview`, `ObjectLayerReview`, `FloorManager`,
  `ThicknessStandardization`, `RoomLabelReview`, `DimensionOcrReview`, `AxisGridManager`):
  `dispatchBundle.history.undo()` — ví dụ `screens/qc/WallLayerReview/useWallLayerReview.ts:943`.
  `dispatchBundle` được dựng bằng `createWallLayerDispatchDeps`-kiểu factory (khuôn tại
  `wallLayerReviewGateway.ts:627-662`): `deps.history.push` gọi `history.push` của CHÍNH ngăn xếp
  `createHistoryStack()` này, không phải action nào của store.

Vì PropertyInspector đi qua `dispatch` (bắt buộc theo bối cảnh nhiệm vụ), Ctrl+Z của panel PHẢI
theo khuôn thứ hai: `dispatchBundle.history.undo()` trả về `HistoryTransition` gồm `patches` (áp
lại) và `selection` (khôi phục) — nơi gọi tự áp `patches` qua CHÍNH `SpatialPort` (tức lại gọi
`commit`), không có API "undo tự áp" sẵn trong `HistoryStack`.

### Phím tắt Ctrl+Z — `src/lib/input/shortcutRegistry.ts`

Đăng ký sẵn (`shortcutRegistry.ts:589-599`, nguyên văn rút gọn):
```ts
{ id: 'global.undo', combo: 'Ctrl+Z', ... handlers.undo() }
{ id: 'global.redo', combo: 'Ctrl+Shift+Z' (xem dòng 599-605), ... handlers.redo() }
```
`handlers.undo`/`handlers.redo` là hai hàm TIÊM VÀO từ nơi đăng ký (`UndoRedoHandlers`,
`shortcutRegistry.ts:567-568`) — bản thân registry không biết undo cái gì. PropertyInspector không
tự đăng ký một binding `Ctrl+Z` thứ hai; nó nằm trong `Viewer3D` đã có, và theo A12 nội dung soạn
thảo (ô nhập text) tắt mọi phím tắt kể cả Ctrl+Z, trả undo lại cho trình duyệt
(`shortcutRegistry.ts:25-26`) — nghĩa là một ô số đang focus không nhận Ctrl+Z của ứng dụng, đúng
hành vi chuẩn của input.

---

## C4. Gộp lệnh 400ms khi kéo (D-06)

### `src/lib/commands/mergeCommands.ts`

```ts
const MERGE_WINDOW_MS = COALESCE_WINDOW_MS;    // mergeCommands.ts:34, giá trị = 400 (coalesce.ts:1)
function canMergeCommands(earlier: Command, later: Command, windowMs = MERGE_WINDOW_MS): boolean  // mergeCommands.ts:48-67
function mergeCommands(earlier: Command, later: Command): Command                                  // mergeCommands.ts:87-104
function mergeCommandRun(commands: readonly Command[], windowMs = MERGE_WINDOW_MS): Command[]      // mergeCommands.ts:114-133
```
Điều kiện gộp (`canMergeCommands`, dòng 48-67): CÙNG `type`, CÙNG `actorId`, CÙNG tập `entityIds`
(`targetKey`, dòng 37), và khoảng cách hai `timestamp` `< windowMs`. Kết quả giữ `before` của lệnh
ĐẦU và `after` của lệnh CUỐI (dòng 87-104) — nên dù một cú kéo phát ra 50 lệnh trung gian, sau khi
gộp chỉ còn đúng MỘT lệnh 220→330.

**Hằng số 400ms nằm ở `src/lib/mutations/coalesce.ts:1`** (`COALESCE_WINDOW_MS = 400`) — đây là
NGUỒN GỐC thật; `mergeCommands.ts:34` chỉ re-export cùng con số cho tầng lệnh. Theo R-71, panel
KHÔNG được viết lại số `400`; nếu cần cửa sổ này, import `MERGE_WINDOW_MS` từ
`@/lib/commands/mergeCommands` hoặc `COALESCE_WINDOW_MS` từ `@/lib/mutations/coalesce`.

### Ai thực sự gọi việc gộp này — quan trọng cho panel Slider

`mergeCommands`/`canMergeCommands` KHÔNG được gọi từ `dispatch.ts` hay `runCommandPipeline` — mỗi
lệnh gửi vào `dispatch` được coi là MỘT bước hoàn tác riêng ngay khi `deps.history.push` chạy.
Việc gộp chỉ xảy ra ở tầng NGĂN XẾP: `createHistoryStack().push` tự gọi `canMergeCommands`/
`mergeCommands` bên trong (`history.ts:281-325`, hàm nội bộ `runInProgress`) — TRƯỚC KHI một bước
mới được đẩy vào `undoRecords`, nó kiểm bước TRÊN CÙNG có gộp được không.

**Hệ quả cho Slider kéo độ dày:** panel KHÔNG được gọi `dispatch` một lần duy nhất ở cuối kéo rồi
coi là xong `local/no-raw-number` cho các bước — panel phải gọi `dispatch(createChangeWallThicknessCommand(...))`
ở MỖI lần giá trị hiển thị đổi trong lúc kéo (mỗi `onChange` của Slider, không phải chỉ
`onPointerUp`), và để `HistoryStack.push` bên trong `dispatchBundle` tự gộp các lệnh liên tiếp
trong 400ms thành một bước. Nếu panel debounce/throttle sự kiện Slider để chỉ gọi `dispatch` một
lần lúc thả tay, đó là lựa chọn của panel (giảm số lần validate/rules chạy) — KHÔNG phải một yêu
cầu của tầng lệnh, và không ảnh hưởng tới việc gộp (một lệnh duy nhất thì không có gì để gộp).
Xem thêm C5 về việc panel không có đường xem trước 3D tức thời — điều này ảnh hưởng tới việc chọn
gọi `dispatch` mỗi `onChange` hay debounce lúc thả tay.

---

## C5. Xem trước 3D thời gian thực trong lúc kéo *** MỤC QUAN TRỌNG NHẤT ***

### KẾT LUẬN CŨ: NOT FOUND — ~~không có kênh xem trước 3D gọi được từ tầng màn hình~~

**ĐÃ VÁ (lỗ hổng #12, U7).** Cả bốn bằng chứng dưới đây đã được gỡ đúng chỗ chúng nằm:
`src/store/commit.ts` mở `previewEdit`/`discardPreview` (người sản xuất nháp hợp lệ, nằm trong
chính `src/store` nên `local/no-draft-write-outside-commands` không bị nới một chữ);
`selectDraftPreviewGraph` hợp nhất nháp với đồ thị; `ViewerSceneHandle.preview(...)` là một
đường hình học BỔ SUNG không đi qua `BuildQueue`; lớp vẽ đè sống ở `src/lib/three/preview`,
không phải `DragPreview` của gizmo. Bốn đoạn dưới giữ nguyên làm lịch sử của quyết định.

Đã ESCALATE và được điều phối viên xác nhận (không mở rộng `src/store`/`src/lib` cho việc này —
nằm trong vùng CẤM SỬA của nhiệm vụ). Bốn bằng chứng độc lập, mỗi bằng chứng một mình đã đủ chặn:

**(1) `draftSlice` tồn tại nhưng không ai sản xuất draft trong production.**
`src/store/draftSlice.ts:64-92` khai `stageDraftOperation`/`amendDraftOperation`/`discardDraft`.
Toàn repo, ba hàm này CHỈ được gọi từ `src/store/__tests__/slices.test.ts` (nhiều dòng, ví dụ
`slices.test.ts:184,189,195,202-204`) và từ `src/store/index.ts:113` (`discardDraft`, khi đổi
tầng — dọn dẹp, không phải sản xuất). Không component/hook/gateway nào trong `src/screens` hay
`src/hooks` gọi `stageDraftOperation`. Luật `local/no-draft-write-outside-commands`
(`eslint-rules/no-draft-write-outside-commands.js:1-39`) còn KHOÁ CỨNG: ba hàm này chỉ được phép
gọi từ file có đường dẫn chứa `/src/store/` (dòng 16: `if (filename.includes('/src/store/'))
return {};` — mọi file khác gọi là lỗi ESLint). PropertyInspector nằm ở `src/screens/**`, nên
dù muốn, panel KHÔNG được phép tự gọi ba hàm này.

**(2) Không nơi nào đọc `draftOperations` để vẽ lại 3D.**
`useViewer3D` (`screens/viewer/Viewer3D/useViewer3D.ts:301`) chỉ đọc
`useStore((state) => state.spatial)` — không đọc `state.draftOperations` ở đâu trong file. Bản
thân tầng trình diễn (`src/lib/three/present/mount.ts`, `src/screens/viewer/Viewer3D/viewer3dScene.ts`)
nằm trong `src/lib` hoặc chỉ nhận dữ liệu qua tham số hàm — theo bảng ranh giới import ở
CLAUDE.md mục 0.4, `src/lib/**` KHÔNG được import `store`, nên dù muốn, mã dựng cảnh 3D cũng
không thể tự đọc `draftOperations` của store.

**(3) `mountViewerScene(...).update(frame)` không nhận hình học mới — chỉ nhận trạng thái khung nhìn.**
Chữ ký `ViewerSceneHandle.update` (`viewer3dScene.ts:804-812`) nhận đúng một `ViewerSceneFrame`
(chọn/ẩn/cô lập/camera/mặt cắt/`reducedMotion` — xem `applyFrame`, dòng 537-586), KHÔNG có tham
số hình học. Khi `state.spatial` đổi (ví dụ panel đổi `thicknessMm`), `useViewer3D`'s `conversion`
(dòng 326-349) tính lại `levels` — một MẢNG MỚI mỗi lần `spatial` đổi — và `useEffect` dựng cảnh
(dòng 477-513) phụ thuộc `[canvas, levels, mountScene, buildAttempt]`, nên nó DỌN (`dispose`) và
DỰNG LẠI TOÀN BỘ cảnh qua `BuildQueue`/worker (`viewer3dScene.ts:648-690`) — một tiến trình BẤT
ĐỒNG BỘ, hiện `phase: 'building'` với thanh tiến độ (`useViewer3D.ts:521-529`), không phải một
khung hình tức thời. Gọi lại chu trình này ở MỖI lần Slider phát `onChange` (hàng chục lần/giây)
nghĩa là hàng chục lần dispose + spawn worker jobs mỗi giây — không phải "xem trước", mà là làm
treo trình duyệt.

**(4) `DragPreview` của `dragSession.ts` là cho GIZMO 3D, không phải Slider 2D.**
`src/lib/three/interaction/dragSession.ts` có cơ chế xem trước thật (`DragPreview`,
dòng 68-80, phát qua `onPreview` mỗi lần `move()`) — nhưng đây là vòng đời của một cái NẮM (handle)
đang bị kéo BẰNG CHUỘT TRONG KHÔNG GIAN 3D của chính `Viewer3D` (kéo tay cầm resize/move tường
ngay trên khung nhìn — xem mô tả đầu file, dòng 1-36). Nó không nhận và không phát ra bất cứ thứ
gì liên quan tới một `<input type="range">` trong panel bên phải. Không có cầu nối nào giữa
`DragPreview` và PropertyInspector, và dựng một cầu nối như vậy là "chế kênh mới" — điều nhiệm vụ
cấm.

### Đường đi hợp lệ DUY NHẤT hiện nay: commit lúc thả chuột, không xem trước tức thời trong lúc kéo

Panel giữ giá trị đang kéo bằng `useState` NỘI BỘ của hook màn (không ghi store), chỉ hiển thị số
đó trong CHÍNH PropertyInspector; gọi `dispatch`/`commit` đúng MỘT lần khi người dùng thả tay
(`onPointerUp`/`onChange` cuối cùng của control, tuỳ component T3 chọn). Model 3D chỉ đổi SAU khi
thả tay, khi `dispatch` chạy xong và `useViewer3D` dựng lại cảnh — cái giá phải trả này cần nói
rõ với người dùng (ví dụ panel tự hiện chỉ báo "đang dựng lại mô hình" trong lúc `phase ===
'building'`, đọc từ `Viewer3DModel.buildProgressLabel`, `useViewer3D.ts:521-529`).

Khuôn tương tự đã có trong `ScaleCalibration` (không qua `dispatch`, nhưng cùng nguyên tắc "giữ
giá trị kéo cục bộ, chỉ ghi khi xong"): `useScaleCalibration.ts:497`
(`const [drag, setDrag] = useState<DragSession | null>(null)`) giữ toạ độ đang kéo hoàn toàn
trong state cục bộ của hook; `onApply` (`useScaleCalibration.ts:945-969`) là nơi DUY NHẤT gọi
`commit(...)`, một lần, khi người dùng bấm áp dụng — không phải mỗi lần toạ độ nhúc nhích.

**Ghi rõ nợ:** đây là giới hạn thật của kiến trúc hiện có tại thời điểm khảo sát, không phải giới
hạn cố ý của đặc tả S-12/D-06. Nếu sản phẩm sau này cần xem trước tức thời, việc cần làm nằm ở
`src/store` (thêm reader cho `draftOperations` mà `local/no-draft-write-outside-commands` cho
phép) và `src/lib/three`/`useViewer3D` (thêm một đường cập nhật hình học không qua `BuildQueue`
worker) — CẢ HAI đều nằm trong vùng [KHÔNG ĐƯỢC SỬA FILE NÀO] của nhiệm vụ này.

---

## C6. Tự lưu (D-07) + chỉ báo lưu (D-08)

### Hai cài đặt autosave KHÁC NHAU đang tồn tại song song — đọc kỹ trước khi chọn

**(A) `src/lib/autosave/createAutosave.ts` — engine tổng quát, có debounce+retry+offline.**
```ts
type AutosaveState = 'dirty' | 'failed' | 'offline' | 'saved' | 'saving';           // createAutosave.ts:3
interface CreateAutosaveOptions<TChanges> {                                         // createAutosave.ts:5-12
  debounceMs?: number; getChanges: () => TChanges | undefined; isOnline?: () => boolean;
  maxWaitMs?: number; now?: () => number; save: (changes: TChanges) => Promise<void>;
}
interface Autosave {                                                                // createAutosave.ts:14-20
  getLastSavedAt: () => number | undefined; getState: () => AutosaveState;
  notifyChange: () => void; saveNow: () => Promise<void>;
  subscribe: (listener: (state: AutosaveState) => void) => () => void;
}
function createAutosave<TChanges>(options: CreateAutosaveOptions<TChanges>): Autosave  // createAutosave.ts:37-198
```
`DEFAULT_DEBOUNCE_MS = 800` (`createAutosave.ts:22`) — panel KHÔNG viết lại số 800, dùng mặc định
hoặc import hằng nếu cần so sánh. Retry 5s/15s/45s theo `retrySchedule.ts` (không đọc chi tiết ở
khảo sát này — xem file cùng thư mục). `notifyChange()` là hàm panel/gateway gọi mỗi khi có thay
đổi cần lưu (không tự theo dõi store) — engine này KHÔNG tự biết về `spatial`, nó nhận
`getChanges()` do caller cấp.

```ts
function useSaveIndicator(autosave: Autosave, options?: UseSaveIndicatorOptions): SaveIndicatorResult  // useSaveIndicator.ts:72-128
interface SaveIndicatorResult { detail: string; label: string; state: AutosaveState }   // useSaveIndicator.ts:8-12
```
Đây là hook CHỈ ĐỌC (comment tự khai tại `useSaveIndicator.ts:65-71`: không bao giờ tự gọi
`notifyChange`/`saveNow`). `label` là chuỗi đã format sẵn kiểu "Đã lưu lúc 14:32" (qua
`formatClockTime`, `buildSavedResult`, dòng 27-43) hoặc "Đã lưu 2 phút trước" nếu quá
`SAVED_RELATIVE_THRESHOLD_MS = 60_000` (dòng 21). Có tự thông báo cho trình đọc màn hình
(`announcer.announce`, dòng 116-124) khi trạng thái đổi sang `saved`/`failed`/`offline`.

**(B) `src/hooks/useAutosave.ts` — hook riêng, TỰ VIẾT debounce, KHÔNG dùng `createAutosave`.**
```ts
function useAutosave(onSave: (data: RootState['spatial']) => Promise<void>): string | null  // useAutosave.ts:18-49
```
Tự `setTimeout` 800ms (`AUTOSAVE_DEBOUNCE_MS`, `useAutosave.ts:11`), tự đọc `state.spatial` từ
store BÊN TRONG hook (dòng 19), trả về CHUỖI thô (`"Đã lưu lúc 14:32"` hoặc `"Lưu thất bại"`) chứ
không phải `AutosaveState`. Đây là hook `ConnectedSaveIndicator` (`components/feedback/
SaveIndicator.tsx:104`) đang dùng thật — KHÔNG phải `useSaveIndicator` ở (A).

### `SaveIndicator` — props thật (chỉ đọc, không sửa)

```ts
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';                  // SaveIndicator.tsx:11
interface SaveIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {          // SaveIndicator.tsx:13-17
  saveState: SaveState; label?: string | null; flash?: boolean;
}
```
Để hiện "Đã lưu lúc 14:32", panel truyền `saveState="saved"` và `label="Đã lưu lúc 14:32"`
(`SaveIndicator.tsx:35-38`: nhánh `'saved'` dùng `label || 'Đã lưu'`).

**CẢNH BÁO CHO C8 — hai bộ từ vựng trạng thái KHÔNG khớp nhau.** `SaveState` của component
(`idle | pending | saving | saved | error`) khác `AutosaveState` của (A) (`dirty | failed |
offline | saved | saving`). Không có hàm map sẵn nào trong repo chuyển `AutosaveState` →
`SaveState` (không tìm thấy `toSaveState`/tương tự trong khảo sát này). Cụ thể lệch:
- `AutosaveState.dirty` ≈ `SaveState.pending` (tên khác, ý gần giống)
- `AutosaveState.offline` — KHÔNG có `SaveState` tương ứng (component không có nhánh "mất mạng")
- `AutosaveState.failed` ≈ `SaveState.error`

Nếu container của panel dùng (A) `createAutosave` + `useSaveIndicator` (bộ đầy đủ hơn, có
offline/retry) để feed vào `SaveIndicator` component đã có sẵn, container đó phải TỰ VIẾT hàm map
5→5 trạng thái này — không có sẵn trong tầng lệnh, và `offline` sẽ phải gộp vào một trong bốn
`SaveState` còn lại (khuyến nghị `'error'`, nhưng đây là quyết định của T3/T5, không phải sự thật
có sẵn trong mã).

---

## C7. Tầng máy chủ (R-64)

### `src/lib/query` — panel cần gì

```ts
const queryKeys: {                                                                   // queryKeys.ts:66-132
  drawing: { byFloor: (floorId: string) => QueryKey };
  floor: { detail: (floorId: string) => QueryKey; list: (projectId: string) => QueryKey };
  project: { detail: (projectId: string) => QueryKey; ... };
  room: { byFloor: (floorId: string) => QueryKey };
  space: { byFloor: (floorId: string) => QueryKey };
  quality: { assessment: (floorId: string) => QueryKey };
  ... // xem file cho đủ danh sách
}
```
Không có khoá riêng cho "wall"/"opening"/"furniture" — dữ liệu không gian dùng chung
`queryKeys.space.byFloor(floorId)` (dòng 113-115) — đúng khoá `WallLayerReview` dùng
(`wallLayerReviewGateway.ts:220-226`, comment giải thích lý do).

```ts
const CACHE_POLICY_TIERS = ['default', 'static', 'aiProgress', 'spatialDraft'] as const;  // cachePolicy.ts:6
function resolveCachePolicy(queryKey: QueryKey): ResolvedCachePolicy                       // cachePolicy.ts:118-126
```
Domain `space`/`room`/`drawing` map sẵn vào tier `spatialDraft` (`TIER_BY_DOMAIN`, cachePolicy.ts:77-84)
— `staleTime` 10s (dòng 59). Panel không tự đặt `staleTime` trong `useQuery`, để mặc định qua
`queryClient.setQueryDefaults` (đăng ký ở `queryClient.ts`, không đọc chi tiết trong khảo sát này).

```ts
const WRITE_OPERATIONS = [ 'createProject','editFloor','editWall','moveFurniture',
  'editDimension','changeAxis','rerunRules','restoreVersion','straightenDrawing',
  'setDrawingCorners' ] as const;                                                    // invalidation.ts:5-16
function applyInvalidation<T extends WriteOperation>(queryClient, operation: T,
  params: WriteOperationParamsMap[T]): void                                          // invalidation.ts:122-132
```
**~~NOT FOUND~~ — ĐÃ VÁ (lỗ hổng #5, U4): `WRITE_OPERATIONS` nay có `editOpening`, `editRoom`,
`persistSpatialLayer` và `createPropertyTemplate`, mỗi mục kèm entry `invalidationMap` riêng.
Đoạn dưới giữ nguyên làm lịch sử.**

~~NOT FOUND — không có `WriteOperation` cho `editOpening`/`editRoom`/`renameRoom`/`resizeOpening`.~~
Danh sách chỉ có `editWall` (làm mất hiệu lực `space.byFloor`, `room.byFloor`,
`violation.byProject` — dòng 56-60) và `moveFurniture` (dòng 62-66). Nếu panel sửa Opening hoặc
Room, KHÔNG có entry `invalidationMap` sẵn khớp tên — nơi gần nhất là dùng lại `editWall` (vì cùng
làm mất hiệu lực đúng ba khoá `space`/`room`/`violation` mà một lệnh opening/room cũng cần), nhưng
đây là một lựa chọn của T5, không phải một entry có sẵn.

### `src/lib/mutations` — chữ ký panel cần

```ts
function runExclusive<TResult>(entityId: string, task: () => Promise<TResult>): Promise<TResult>  // entityQueue.ts:10-27
```
`dispatch`/`runTransaction` đã tự khoá bằng `runExclusive(SPATIAL_PIPELINE_KEY, ...)`
(`dispatch.ts:701`, `transaction.ts:60`) — panel KHÔNG cần tự gọi `runExclusive` khi đã đi qua
`dispatch`.

```ts
const COALESCE_WINDOW_MS = 400;                                                      // coalesce.ts:1, nguồn thật của 400ms mục C4
```

```ts
interface OptimisticMutationConfig<TVariables, TResult> {                            // createOptimisticMutation.ts:8-21
  affectedKeys: (variables: TVariables) => readonly QueryKey[];
  afterSuccess: (result: TResult, variables: TVariables) => void;
  applyOptimistic: (variables: TVariables) => void;
  callServer: (variables: TVariables) => Promise<TResult>;
  entityId: (variables: TVariables) => string;
  rollback: (variables: TVariables) => void;
}
function createOptimisticMutation<TVariables, TResult>(queryClient, config): UseMutationOptions<TResult, AppError, TVariables>  // createOptimisticMutation.ts:67-75
```
Đây là cho MUTATION MÁY CHỦ (gọi API), KHÔNG phải cho `dispatch`/`commit` — `dispatch` đã tự optimistic
(ghi store ngay ở bước `apply`, trước khi `sync` chạy). Panel dùng `createOptimisticMutation` chỉ
nếu có một lệnh gọi thẳng API riêng ngoài `dispatch` (ví dụ `persistWallLayer`-kiểu, xem mẫu
`wallLayerReviewGateway.ts:254-257` — hiện `NOT FOUND` ở đó, cùng lớp vấn đề).

```ts
function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket   // undoTicket.ts:45-77
const UNDO_WINDOW_MS = 8000;                                              // undoTicket.ts:18, A8
function createNotificationBus(options?: CreateNotificationBusOptions): NotificationBus  // notificationBus.ts:79-189
```
Dùng cho toast hoàn tác 8 giây của A8 khi panel có thao tác XOÁ tức thì (ví dụ nếu panel có nút
xoá ô mở) — khuôn đã dùng tại `createWallUndoTicket` (`wallLayerReviewGateway.ts:698-704`).

### Khuôn container: dữ liệu + trạng thái tải, KHÔNG viết `useState` cho `isLoading`/`error`

```ts
const query = useQuery({ queryKey: queryKeys.space.byFloor(floorId), queryFn: ... });
// query.isLoading, query.isError, query.data — ĐÂY là nguồn duy nhất của "đang tải"/"lỗi" (R-64)
```
Ví dụ thật đang chạy: `useViewer3D.ts:315-318` (`projectQuery`) và cách nó gộp vào bảy trạng thái
màn ở `useViewer3D.ts:544-577` (`state = useMemo(...)`, đọc `projectQuery.isLoading`/`isError`
cùng các cờ khác — KHÔNG một `useState<boolean>` nào tự giữ "đang tải"). PropertyInspector đọc dữ
liệu tường/ô mở/phòng đang sửa từ CHÍNH `state.spatial` của store (đồng bộ, không qua `useQuery` —
đây là dữ liệu ĐANG SỬA, không phải một lượt gọi mạng), giống cách `WallLayerReviewGateway.graph`
tách bạch "đồ thị đang sửa" (đọc store, đồng bộ) khỏi "dữ liệu máy chủ" (qua `useQuery`) —
xem chú thích `wallLayerReviewGateway.ts:204-226`.

---

## C8. Điểm chết / rủi ro — tổng hợp mọi NOT FOUND

| # | Spec đòi | NOT FOUND | Nơi gần nhất |
|---|---|---|---|
| 1 | Đổi chiều mở (swing) một ô mở đã có | Không có input/hàm nào ghi `swing` ngoài lúc tạo | `AddOpeningInput.swing`, `openingCommands.ts:~210,220,326` |
| 2 | Đổi tượng chủ (đổi ô mở sang tường khác) | Không `Input` nào mang `wallId` đích khác wallId hiện tại | `MoveOpeningInput` (chỉ đổi `offsetMm`), `openingCommands.ts:351-355` |
| 3 | Đổi kích thước / scale nội thất | **ĐÃ VÁ — lỗ hổng #2 (U1)** | `createResizeFurnitureCommand`, `openingCommands.ts` |
| 4 | Xem trước 3D tức thời trong lúc kéo Slider (C5) | **ĐÃ VÁ — lỗ hổng #12 (U7)** | `store/commit.ts` `previewEdit`; `selectDraftPreviewGraph`; `lib/three/preview/`; `ViewerSceneHandle.preview` |
| 5 | `WriteOperation` cho sửa Opening/Room (để `applyInvalidation`) | **ĐÃ VÁ — lỗ hổng #5 (U4)** | `editOpening`/`editRoom`/`persistSpatialLayer`/`createPropertyTemplate`, `invalidation.ts` |
| 6 | Map `AutosaveState` → `SaveState` của `SaveIndicator` | **ĐÃ VÁ — lỗ hổng #7 (U5)**: `offline` gộp vào `'pending'`, không phải `'error'` | `lib/autosave/toSaveIndicatorState.ts` |
| 7 | Một hệ autosave DUY NHẤT | **ĐÃ VÁ — lỗ hổng #7 (U5)**: `hooks/useAutosave` nay chỉ là lớp bọc React của `createAutosave`; `flushAutosaves` cho Ctrl+S xả đúng engine đang gắn | `hooks/useAutosave.ts` |
| 8 | `ROOM_FLOOR_COMMAND_TYPES` đầy đủ (chỉ trích được vị trí khai, không trích nguyên văn object trong khảo sát này) | Không phải NOT FOUND — chỉ là giới hạn của khảo sát này, xem trực tiếp `roomFloorCommands.ts:67` khi cần đủ 6 tên | `roomFloorCommands.ts:67` |

Mục 1 và 2 vẫn đúng nguyên văn (chưa vá, và không nằm trong mười hai lỗ hổng): đổi `swing` của
một ô mở đã có được panel dựng bằng nguyên thuỷ công khai trong chính cổng của nó, còn đổi tường
chủ thì chưa ai cần. Mọi mục còn lại là giới hạn THẬT của tầng lệnh/store tại thời điểm khảo sát
(không phải do người khảo sát bỏ sót) — nếu T3/T5 cần các khả năng này, phải quay lại xin quyết định của điều
phối viên trước khi tự dựng, vì lời giải nằm trong `src/store`/`src/lib` — vùng nhiệm vụ này
(và các nhiệm vụ dùng tầng lệnh khác) không được sửa.
