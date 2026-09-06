# T2 — Khảo sát hợp đồng tầng 3D cho FurnitureLibraryPanel

Chỉ đọc mã. Không đề xuất sửa file ngoài whitelist. Mọi chữ ký dán nguyên văn kèm
`đường-dẫn:dòng`.

---

## (a) R-01/R-02 — nạp và tối ưu model

### `src/lib/three/present/assets.ts`

```ts
// assets.ts:38
export type ModelDownloader = (url: string, signal: AbortSignal) => Promise<ArrayBuffer>;

// assets.ts:41
export type ModelParser = (bytes: ArrayBuffer, url: string) => Promise<Object3D>;

// assets.ts:43-54
export interface AssetServiceOptions {
  readonly download?: ModelDownloader;
  readonly parse?: ModelParser;
  readonly dracoDecoderPath?: string;
  readonly timeoutMs?: number;
}

// assets.ts:56-66
export interface AssetService {
  readonly load: (url: string, signal?: AbortSignal) => Promise<Object3D>;
  readonly dispose: () => void;
}

// assets.ts:79 platformDownloader(timeoutMs = REQUEST_TIMEOUT_MS.file): ModelDownloader
// assets.ts:120 gltfParser(dracoDecoderPath?: string): ModelParser
// assets.ts:187 createAssetService(options: AssetServiceOptions = {}): AssetService
// assets.ts:227 noAssetService(): AssetService
```

**Trả lời dứt khoát: KHÔNG có màn nào gọi `createAssetService`.**
`grep -rn "createAssetService" src` → chỉ 2 nơi gọi thật:
- `src/screens/auth/AuthScreen/houseScene.ts:75` — `const assets = createAssetService({ dracoDecoderPath: DRACO_DECODER_PATH });`
  rồi truyền xuống `mountPresentation(canvas, plan, { assets, ... })`.
- Test (`__tests__/assets.test.ts`).

`createAssetService` chỉ được tiêu thụ **nội bộ** qua `PresentationOptions.assets`
(`mount.ts:84`) rồi đưa vào `assembleHouse` (`mount.ts:164-169`). Không có API công
khai nào tách rời khỏi `mountPresentation` để "nạp một .glb rời và lấy kích thước
bao + dung lượng" — `AssetService.load()` trả về `Promise<Object3D>` (một
`Object3D` đã clone), **không kèm bounding box hay dung lượng byte**. Muốn lấy
kích thước bao, bên gọi phải tự `new Box3().setFromObject(root)` sau khi `load()`
trả về; muốn lấy dung lượng byte phải tự đo `ArrayBuffer.byteLength` — không có
hàm nào trong `assets.ts` trả con số đó ra ngoài.

→ **NOT FOUND**: đường vào công khai để "nạp trước một .glb rời, lấy bbox + dung
lượng, chưa gắn vào cảnh". Lệnh đã dùng: `grep -rn "createAssetService\|AssetService" src`.

**Prewarm/preload: NOT FOUND.** Không có hàm `prewarm`/`preload` nào trong
`present/assets.ts`, `catalogue.ts`, `placement.ts`, `plan.ts`, `planLoader.ts`,
`mount.ts`. Lệnh đã dùng: `grep -rn "prewarm\|preload" src/lib/three/present`.
Cái gần nhất là cache theo URL trong `createAssetService` (`assets.ts:190,203-212`:
`cache: Map<string, Promise<Object3D>>`) — gọi `load(url)` hai lần chỉ tải/parse
một lần, nhưng đây là cache-khi-gọi, không phải nạp trước khi trỏ chuột. Nếu spec
đòi "nạp trước khi hover", cách khả dĩ DUY NHẤT với API hiện có là: bên gọi tự tạo
một `AssetService` (qua `createAssetService`) và tự gọi `.load(url)` sớm cho từng
thẻ trong panel — nhưng đây là **đề xuất cách dùng API sẵn có**, không phải hàm mới.

### Loader thật
`gltfParser` (`assets.ts:120-149`) nhập động `three/examples/jsm/loaders/GLTFLoader.js`
và `DRACOLoader.js` — **chỉ trong hàm này**. Đây là "nội bộ tầng present", màn
KHÔNG được tự import hai loader này (đúng với cấm tuyệt đối trong đặc tả).

---

## (b) R-04 — ngân sách hiệu năng

### `src/lib/three/perf/budget.ts`

```ts
// budget.ts:92-98
export const SCENE_BUDGET: SceneBudget = Object.freeze({
  maxDrawCalls: 150,
  maxTriangles: 900_000,
  maxMaterials: 40,
  maxGraphicsMemoryMb: 350,
  minFrameRate: Object.freeze({ desktop: 45, mobile: 30 }),
});

// budget.ts:219 checkBudget(reading: BudgetReading, profile: DeviceProfile = 'desktop'): readonly BudgetWarning[]
// budget.ts:257 isWithinBudget(reading: BudgetReading, profile?): boolean
// budget.ts:269 detectDeviceProfile(): DeviceProfile
// budget.ts:471 measureScene(root: Object3D, options: MeasureSceneOptions = {}): SceneReading
// budget.ts:566 readRenderInfo(info: RenderInfoLike, graphicsMemoryMb: number): SceneReading
// budget.ts:138-146 export interface BudgetWarning { metric; measured; limit; message }
// budget.ts:64-69 export interface FrameRateFloors { desktop; mobile }
```

**Câu hỏi then chốt — ngưỡng một-model đơn lẻ: KHÔNG CÓ.**
`SCENE_BUDGET` chỉ có bốn trần **theo cảnh** (draw calls/triangles/materials/
graphics memory) cộng hai sàn fps theo máy. Không trường nào tên
`maxTrianglesPerModel`, `maxModelSizeMb`, hay tương tự.
Lệnh đã dùng: `grep -rn "PerModel\|perModel\|singleModel\|itemBudget" src/lib/three/perf`
→ không có kết quả.

**Đề xuất suy ra ngưỡng một-model TỪ hằng đã có** (không bịa số mới, chỉ tham
chiếu `SCENE_BUDGET` làm mẫu số): panel có thể tự tính "tỉ lệ nặng" bằng cách đo
model rời qua `measureScene(root)` (dùng được ngay vì hàm này nhận `Object3D`
bất kỳ, không cần renderer — `budget.ts:471`) rồi so `triangles` với
`SCENE_BUDGET.maxTriangles` như một **phần trăm ngân sách cảnh** (ví dụ: model
chiếm bao nhiêu % của 900.000 tam giác), thay vì so với một trần tuyệt đối mới.
Đây là quan sát để điều phối viên quyết, không phải giá trị tôi tự đặt.

### Đọc fps và draw calls
- `readRenderInfo(info: RenderInfoLike, graphicsMemoryMb)` đọc thẳng
  `WebGLRenderer.info.render.calls` / `.triangles` (`budget.ts:546-573`).
- Viewer3D đã có sẵn bộ đo chạy trong `viewer3dScene.ts`:
  `PerfMonitor` (`perf/monitor.ts`) được khởi tạo tại `viewer3dScene.ts:515-536`
  với `read: () => readRenderInfo(renderer.info, graphicsMemoryMb)`, gọi
  `monitor.frame()` mỗi khung (`viewer3dScene.ts:510`).
- **Con số công khai ra ngoài `ViewerSceneHandle` chỉ có `frameRate()`**
  (`viewer3dTypes.ts:282,197-201`):
  ```ts
  export interface ViewerSceneFrameRate {
    readonly averageFps: number;
    readonly durationMs: number;
    readonly triangleCount: number;
  }
  ```
  **`ViewerSceneHandle.frameRate()` không lộ `drawCalls` ra ngoài** — đúng, đây
  là con số đã kiểm tra ở public interface. NHƯNG `SceneReading.drawCalls` **TỒN
  TẠI** (`budget.ts:109`) và có hai đường lấy công khai từ `src/lib/three/perf/budget.ts`:
  `measureScene(root)` (dòng 471, đi bộ scene tự đếm) và
  `readRenderInfo(info, graphicsMemoryMb)` (dòng 566, đọc thẳng
  `renderer.info.render.calls`). Nghiệm thu "in fps + số lệnh vẽ trước/sau khi
  kéo 5 đồ" LÀM ĐƯỢC bằng hai hàm này — xem PHẦN QUYẾT ĐỊNH bên dưới.

---

## (c) R-05 — dọn khi bỏ

### `src/lib/three/perf/dispose.ts`

```ts
// dispose.ts:142-160 export interface DisposeReport { objects; geometries; materials; released; textures; retained }
// dispose.ts:162-194 export interface DisposeFloorOptions { materials?; disposeMaterials?; retain?; detach? }
// dispose.ts:215 export function disposeFloor(root: Object3D, options: DisposeFloorOptions = {}): DisposeReport
// dispose.ts:410 export class ResourceLedger { track(); trackGeometry(); trackMaterial(); trackTexture(); sample(); forget(); get counts(); get history() }
```

**Ai gọi `disposeFloor`, lúc nào** (`grep -rn "disposeFloor(" src`):
- `src/hooks/useFloorLifecycle.ts:152` — `disposeFloor(built, { materials: cache })`,
  khi một tầng bị thay/gỡ khỏi lifecycle của hook (đóng tầng cũ khi đổi tầng).
- `src/screens/viewer/Viewer3D/viewer3dScene.ts:986` — `disposeFloor(group, { materials: sharedMaterialCache })`,
  đóng một storey khi `update()` bỏ nó khỏi khung nhìn hoặc lúc `dispose()` toàn cảnh.
- `src/lib/three/preview/previewLayer.ts:109` — `disposeFloor(shown, { disposeMaterials: false })`,
  khi lớp xem trước (draft) bị thay/gỡ — **không** đóng vật liệu vì chúng mượn từ
  mô hình thật.

**Đồ đạc (`furniture`) không có chỗ dọn riêng nào** ngoài ba nơi trên: một khi
model glb được `assets.load()` rồi gắn vào cây scene của một storey, nó bị dọn
cùng lúc storey đó bị `disposeFloor` — không có API `disposeFurniture` riêng.
`AssetService.dispose()` (`assets.ts:217-222`) chỉ dọn **cache nội bộ của chính
service đó** (bản gốc trước khi clone), không dọn bản đã clone và gắn vào scene.
→ Nếu panel tự giữ một `AssetService` để prewarm, panel phải tự gọi
`.dispose()` của service đó lúc unmount; còn model đã đặt vào bản vẽ được dọn
qua `disposeFloor` như mọi phần khác của storey — đây là điều panel KHÔNG được
tự làm (cấm tự tính va chạm/tự quản lý renderer), nó là việc của
`viewer3dScene.ts`/`useFloorLifecycle.ts`.

---

## (d) R-08 — kiểm va chạm khi đặt

### `src/lib/commands/business/openingCommands.ts` — nguyên văn

```ts
// openingCommands.ts:598-606
export interface AddFurnitureInput {
  readonly id: FurnitureId;
  readonly levelId: LevelId;
  readonly kind: FurnitureKind;
  readonly centre: Point;
  readonly boundingBox: BoundingBox;
  readonly rotationDeg: number;
  readonly roomId?: RoomId;
}

// openingCommands.ts:640-690
export function validateAddFurniture(input: AddFurnitureInput, context: CommandContext): string[] {
  const reasons: string[] = [];

  if (!isIdOfKind('furniture', input.id)) {
    reasons.push(`Mã đồ đạc "${input.id}" không đúng định dạng của một mã đồ đạc.`);
  } else if (idIsTaken(context.graph, input.id)) {
    reasons.push(`Bản vẽ đã có đối tượng mang mã ${input.id}.`);
  }

  if (readOf(context.graph, 'level', input.levelId) === null) {
    reasons.push(`Không tìm thấy tầng ${input.levelId} để đặt đồ đạc lên.`);
  }

  if (!FURNITURE_KINDS.includes(input.kind)) {
    reasons.push(`Loại đồ đạc "${input.kind}" không có trong hệ thống.`);
  }

  reasons.push(...boxReasons(input.boundingBox));

  if (!isFinitePoint(input.centre)) {
    reasons.push('Toạ độ tâm đồ đạc không đọc được.');
  } else if (reasons.length === 0 && !boxContains(input.boundingBox, input.centre)) {
    reasons.push(
      `Tâm đồ đạc ở ${formatPoint(input.centre)} nằm ngoài khung bao từ ` +
        `${formatPoint(input.boundingBox.min)} tới ${formatPoint(input.boundingBox.max)}.`,
    );
  }

  if (!Number.isFinite(input.rotationDeg)) {
    reasons.push('Góc xoay đồ đạc không đọc được.');
  }

  if (input.roomId !== undefined) {
    const room = readOf(context.graph, 'room', input.roomId);

    if (room === null) {
      reasons.push(`Không tìm thấy phòng ${input.roomId} để gán đồ đạc vào.`);
    } else if (room.levelId !== input.levelId) {
      reasons.push(
        `Phòng ${room.id} ở tầng ${room.levelId} còn đồ đạc đặt trên tầng ${input.levelId}.`,
      );
    } else if (isFinitePoint(input.centre) && !roomContains(room, input.centre)) {
      reasons.push(
        `Tâm đồ đạc ở ${formatPoint(input.centre)} nằm ngoài ranh phòng "${room.name}" ` +
          `${room.id} rộng ${formatAreaM2(room.areaM2)}.`,
      );
    }
  }

  return reasons;
}

// openingCommands.ts:693-728
export function createAddFurnitureCommand(
  input: AddFurnitureInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateAddFurniture(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.addFurniture, reasons);
  }

  const widthMm = input.boundingBox.max.x - input.boundingBox.min.x;
  const depthMm = input.boundingBox.max.y - input.boundingBox.min.y;

  const item: Furniture = {
    ...AUTHORED_BY_HAND,
    id: input.id,
    levelId: input.levelId,
    kind: input.kind,
    centre: { ...input.centre },
    boundingBox: { min: { ...input.boundingBox.min }, max: { ...input.boundingBox.max } },
    rotationDeg: normaliseDegrees(degrees(input.rotationDeg)),
    ...(input.roomId === undefined ? {} : { roomId: input.roomId }),
  };

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.addFurniture,
      `Thêm ${FURNITURE_KIND_LABELS[input.kind]} ${input.id} cỡ ${formatLengthMm(widthMm)} × ` +
        `${formatLengthMm(depthMm)} tại ${formatPoint(input.centre)}, xoay ` +
        `${formatAngleDeg(item.rotationDeg)}` +
        (input.roomId === undefined ? '.' : ` trong phòng ${input.roomId}.`),
      [changeForAdd('furniture', item)],
      context,
    ),
  );
}
```

**`CommandContext`** (`src/lib/commands/business/shared.ts:62-70`):
```ts
export interface CommandContext {
  readonly graph: NormalizedSpatial;
  readonly actorId: string;
  readonly id?: CommandId;
  readonly timestamp?: string;
}
```
`graph` là bản vẽ hiện tại (đọc, không ghi); nó không do panel tự dựng — panel
lấy từ nơi đã có `graph` sẵn (selector store), đúng luật A10 (ghi qua `commit()`,
không `set()` — nhưng đây là *đọc*, không phải ghi).

**Trả về khi hợp lệ**: mảng rỗng `[]`. **Khi không hợp lệ**: mảng chuỗi tiếng
Việt, mỗi phần tử một lý do (không giới hạn số lượng — có thể nhiều câu cùng
lúc, ví dụ vừa sai kích thước vừa ngoài ranh phòng). Đây đúng là nguồn sinh
"một câu lý do" nhưng thực ra CÓ THỂ RA NHIỀU CÂU — panel cần hiển thị được
danh sách, không chỉ câu đầu tiên.

**Va chạm hình học thật sự**: `validateAddFurniture` KHÔNG kiểm chồng lấn với
đồ đạc khác đã có trong phòng (không có "furniture-furniture overlap" check) —
chỉ kiểm: mã hợp lệ, tầng tồn tại, loại hợp lệ, khung bao dương, tâm nằm trong
khung bao, góc xoay hữu hạn, và (nếu có `roomId`) phòng tồn tại + đúng tầng +
tâm nằm trong ranh phòng qua `roomContains` (`outlineContains`, dòng 636-637,
636 gọi `@/domain/spatial/...` outline test — hình học thật nằm ở
`src/domain`, không lặp lại ở đây, đúng nguyên tắc "không tính hình học trong
tầng lệnh"). Không có kiểm "chồng lên tường" hay "chồng lên đồ khác" ở đây.
→ Nếu đặc tả màn đòi cấm thả chồng lên đồ khác, đó là lỗ hổng cần hỏi điều phối
viên — **không tồn tại trong `validateAddFurniture` hiện tại**.

### `src/lib/three/interaction/hitTest.ts` + `raycast.ts`

`hitTest.ts` **không quyết điểm bắt vào sàn/tường cho việc ĐẶT đồ** — nó là tra
ngược "tia trúng mesh nào → id thực thể nào" để **CHỌN** thực thể có sẵn trong
cảnh (`resolveHit`, `firstEntityHit` — dòng 167, 202), dùng `MergeResult` từ
`build/merge.ts` và layer visibility/lock (`isPickableKind`, dòng 116).

`raycast.ts` là bộ đếm nhịp raycast cho pointer (throttle 30 lần/giây, phân
biệt click/drag bằng `CLICK_SLOP_PX`) — cũng phục vụ **chọn/hover**, không
phải "điểm rơi của đồ đang kéo".

→ **NOT FOUND**: một hàm quyết "điểm bắt (snap) vào sàn/tường khi ĐẶT đồ đạc
mới" trong `interaction/`. Lệnh đã dùng:
`grep -rn "snap\|drop\|placement" src/lib/three/interaction`.
Cơ chế đặt đồ đạc hiện có (xem mục dưới) hoạt động hoàn toàn trên **toạ độ
mặt bằng 2D (mm)**, không đi qua raycast 3D — `centre`/`boundingBox` trong
`AddFurnitureInput` là `Point` phẳng (x, y mm), không phải toạ độ world 3D.
Việc quy đổi từ một điểm thả trong khung nhìn 3D (Viewer3D) sang toạ độ mặt
bằng 2D không có trong `interaction/hitTest.ts`/`raycast.ts` — nếu panel thả
vào Viewer3D (không phải canvas 2D), đây là lỗ hổng thật sự cần hỏi điều
phối viên.

### PHÁT HIỆN QUAN TRỌNG — cơ chế kéo-thả đã có sẵn, chưa màn nào dùng

`src/lib/input/dragDrop.ts` là một **bộ máy trạng thái thuần** (reducer) đã viết
đầy đủ cho đúng use case này:

```ts
// dragDrop.ts:68-79
export interface DragSession {
  readonly item: DragLibraryItem;
  readonly id: FurnitureId;
  readonly centre: Point;
  readonly mode: DragMode;
  readonly dropAllowed: boolean;
  readonly blockReasons: readonly string[];
}

// dragDrop.ts:109-120
export interface DragDropDeps {
  readonly levelId: LevelId;
  readonly nextId: () => FurnitureId;
  readonly validateDrop: (input: AddFurnitureInput) => readonly string[];
}

// dragDrop.ts:184 export function reduceDragDrop(state, event, deps): DragDropTransition
// dragDrop.ts:272 export const dragGhost = (state: DragDropState): ToolPreview | null
```

`validateDrop` chạy trên **mỗi** `start`/`move`/`nudge` (`sessionAt`, dòng
164-175) — nghĩa là bên gọi tiêm thẳng `validateAddFurniture` (mục d ở trên)
làm `validateDrop`, và `blockReasons`/`dropAllowed` luôn đúng khi đang kéo,
đúng yêu cầu "xem trước trước khi áp" và "một câu lý do khi rơi vào chỗ không
đặt được" (thực ra có thể nhiều câu — xem trên).

Đã có hook React bọc sẵn: `src/hooks/useDragDropSession.ts`
(`useDragDropSession(options): DragDropSessionApi` — dòng 74), lo vòng đời
session, announcer, phím tắt (Enter/Escape/mũi tên), và trả `ghost: ToolPreview | null`.

**Nhưng: `grep -rn "useDragDropSession" src` chỉ ra 2 file — chính hook và test
của nó. Không màn nào (`screens/**`) gọi nó.** Đây là tầng logic hoàn thành
nhưng chưa cắm — giống mô tả "trạng thái hiện tại" trong CLAUDE.md về
`lib/query`/`lib/mutations`. `FurnitureLibraryPanel` PHẢI cắm vào
`useDragDropSession` này, không dựng lại một bộ kéo-thả khác.

**Giới hạn quan trọng của ghost có sẵn**: `dragGhost` trả một `ToolPreview`
loại `furnitureGhost` (`dragDrop.ts:279-285`, định nghĩa tại
`toolMachine.ts:186-192`):
```ts
{
  readonly kind: 'furnitureGhost';
  readonly centre: Point;          // mm, mặt bằng 2D
  readonly boundingBox: BoundingBox;
  readonly furnitureKind: FurnitureKind;
  readonly rotationDeg: number;
}
```
Đây là dữ liệu **hình học phẳng** cho lớp bản nháp 2D (`draftSlice`), KHÔNG
phải một mesh 3D hay vật liệu đơn sắc. `grep -rn "furnitureGhost" src` chỉ ra
đúng 3 nơi: định nghĩa type, `dragDrop.ts` phát ra nó, và test — **không nơi
nào trong `viewer3dScene.ts` hay `ViewerSceneHandle.preview` tiêu thụ
`furnitureGhost`.**

---

## (e) `src/lib/three/build/**` — không có `ToolPreview` 3D cho furniture

`grep -rln "ToolPreview" src/lib/three/build` → không có kết quả. Thư mục
`build/` (`buildCore.ts`, `floor.ts`, `wall.ts`, `merge.ts`, `lod.ts`,
`buildQueue.ts`, `plan.ts`, `scene.ts`) chỉ dựng **hình học tường/sàn/storey**
từ đồ thị mặt bằng — không có khái niệm "đồ đạc đang kéo" ở tầng này.

**Cơ chế preview 3D DUY NHẤT đang chạy** là `ViewerSceneHandle.preview`
(`viewer3dTypes.ts:298-313`) + `src/lib/three/preview/previewLayer.ts`
(`createPreviewLayer`, dòng 46 gọi ở trên) — nhưng cơ chế này phục vụ
**xem trước khi sửa tường/sàn** (kéo một `Slider` chỉnh kích thước tường), đọc
từ `selectDraftPreviewGraph` (`store/selectors`) và dựng lại đúng MỘT bức
tường bằng `buildFloorMesh` (`narrowFloorInput`, `preview/previewModel.ts`).
Nó **không nhận một `Object3D` đã tải (.glb)** — API của nó
(`PreviewLayerOptions`, `previewLayer.ts:48-59`) chỉ nhận `materialOf` +
`build?: (input: BuildFloorInput) => Group`, tức là nó tự dựng lại hình học
tường/sàn, không hiển thị một model rời.

→ **NOT FOUND: không có cơ chế nào trong `lib/three/build/**` hay
`lib/three/preview/**` để vẽ "bóng model .glb đơn sắc trên nền lún" trong lúc
kéo.** Đây là lỗ hổng thật, chặn thẳng yêu cầu "ảnh xem trước đơn sắc trên
nền lún" trong đặc tả màn. Lệnh đã dùng:
`grep -rln "ToolPreview" src/lib/three/build src/lib/three/preview`,
`grep -rn "furnitureGhost" src`.

---

## TÓM TẮT LỖ HỔNG CHẶN ĐƯỜNG MÀN (đã hỏi điều phối viên, xem log `orca orchestration ask`)

1. Không có API công khai để nạp một `.glb` rời + lấy bbox/dung lượng trước khi
   gắn vào cảnh (mục a).
2. Không có ngưỡng ngân sách cho MỘT model (chỉ có ngân sách cả cảnh) — có thể
   suy ra tỉ lệ % từ `SCENE_BUDGET.maxTriangles`, không có số tuyệt đối mới
   (mục b).
3. `ViewerSceneHandle` không có accessor công khai cho *draw calls* — chỉ có
   `frameRate()` với `averageFps`/`durationMs`/`triangleCount` (mục b).
4. `validateAddFurniture` không kiểm chồng lấn đồ-đồ, chỉ kiểm khung bao/phòng
   (mục d) — cần xác nhận đây có phải yêu cầu của đặc tả màn hay không.
5. `hitTest.ts`/`raycast.ts` không có hàm quy đổi điểm thả trong khung nhìn 3D
   sang toạ độ mặt bằng 2D mm mà `AddFurnitureInput` cần (mục d).
6. Không có bộ máy vẽ "bóng model .glb đơn sắc" trong `build/`/`preview/` —
   `ViewerSceneHandle.preview` chỉ dựng lại tường/sàn, không hiển thị một
   `Object3D` đã tải. `dragGhost`/`useDragDropSession` có sẵn nhưng phát ra
   dữ liệu 2D phẳng (`furnitureGhost`), không tiêu thụ được bởi cảnh 3D hiện
   tại (mục d, e).

---

## PHÁN QUYẾT ĐIỀU PHỐI VIÊN (2026-09-06)

Trả lời cho năm lỗ hổng nêu trên, theo `orca orchestration ask`. Đây là quyết
định cuối, không phải quan sát của người khảo sát.

**(1) Nạp .glb rời + bbox/dung lượng — GIẢI TÁN, không phải lỗ hổng.**
Màn KHÔNG được tự nạp `.glb` (cấm tuyệt đối). Kích thước bao và dung lượng tệp
đến từ **siêu dữ liệu của mục thư viện**, do task T1b đang thêm vào `src/api`
(`LibraryItem`: `widthMm`/`depthMm`/`heightMm`/`fileSizeBytes`/`triangleCount`).
Màn chỉ **đọc số**, không mở file. Khi thả, lệnh `S-07` (`createAddFurnitureCommand`)
thêm `Furniture` vào store; tầng 3D dựng nó từ plan/`CATALOGUE` như mọi
`Furniture` khác — panel không tự gọi `createAssetService`.
"Nạp trước khi trỏ chuột" (yêu cầu D-03) = nạp trước **truy vấn chi tiết** qua
`src/lib/query/prefetch.ts` (siêu dữ liệu, không phải file `.glb`).

**(2) Ngưỡng một-model — ĐÚNG là không có, cách suy ra: KHÔNG bịa hằng số mới.**
Cảnh báo "model này nặng" kích hoạt khi **THÊM model này sẽ đẩy CẢ CẢNH vượt
ngân sách đã có**: lấy `SceneReading` hiện tại của cảnh, cộng thêm chi phí của
mục thư viện (`triangleCount` từ `LibraryItem`, không phải đo file), gọi
`checkBudget()` (`budget.ts:219`) trên tổng đó, rồi đọc `BudgetWarning`
(`budget.ts:138-146`). Chỉ dùng hằng đã khai trong `SCENE_BUDGET`
(`budget.ts:92-98`) — giữ đúng R-71, và cảnh báo kiểu này còn đúng hơn một
ngưỡng một-model tuỳ tiện vì nó phản ánh trạng thái cảnh thật lúc kéo.
Chữ ký dùng: `checkBudget(reading: BudgetReading, profile?: DeviceProfile): readonly BudgetWarning[]`
(`budget.ts:219`); `BudgetReading extends SceneReading` với `frameRate?: number`
(`budget.ts:124-127`); `BudgetWarning { metric; measured; limit; message }`
(`budget.ts:138-146`).

**(3) `drawCalls` công khai — SAI trong bản khảo sát ban đầu, đã sửa ở trên.**
`SceneReading.drawCalls` tồn tại (`budget.ts:109`), lấy được qua
`measureScene(root: Object3D, options?): SceneReading` (`budget.ts:471`) hoặc
`readRenderInfo(info: RenderInfoLike, graphicsMemoryMb: number): SceneReading`
(`budget.ts:566`, đọc thẳng `renderer.info.render.calls`). Nghiệm thu cuối
(in fps + số lệnh vẽ trước/sau khi kéo 5 đồ) **làm được** bằng hai hàm này.
Điều KHÔNG có, và vẫn đúng như khảo sát: `ViewerSceneHandle.frameRate()` không
lộ `drawCalls` ra ngoài module cảnh (`viewer3dTypes.ts:197-201`) — ai cần con
số đó từ ngoài `viewer3dScene.ts` phải có đường lấy riêng, không phải qua
`frameRate()`.

**(4) Chồng lấn đồ-đồ chưa được kiểm — GHI NHẬN, KHÔNG PHẢI LỖI CỦA MÀN.**
`validateAddFurniture` (R-08) là thực quyền DUY NHẤT quyết định đặt được hay
không; màn tuyệt đối không tự kiểm va chạm. Phạm vi kiểm của nó (khung bao,
tầng, phòng — xem mục d) là phạm vi sản phẩm có hôm nay. Đây là **khoảng trống
đã biết ở tầng logic**, không phải việc màn phải bù đắp, và không được lặp lại
trong `FurnitureLibraryPanel`. Điều phối viên sẽ báo cáo lỗ hổng này riêng.

**(5) Bóng .glb đơn sắc lúc kéo — LỖ HỔNG THẬT, và màn SẼ KHÔNG LẤP NÓ.**
Vá lỗ này đòi sửa `src/lib/three/**` hoặc `Viewer3D` (màn đã xong) — cả hai đều
nằm ngoài phạm vi sửa của `FurnitureLibraryPanel` (whitelist chỉ cho phép sửa
file của chính panel). Phạm vi đã chốt cho màn: panel **điều khiển đúng phiên
kéo** qua `reduceDragDrop`/`useDragDropSession`, rồi **chia dữ liệu ra ngoài**
qua props của container (theo R-73) để người sở hữu cảnh 3D cắm vào mà không
cần viết thêm logic:

- `preview: ToolPreview | null` — kết quả của
  `dragGhost(state: DragDropState): ToolPreview | null` (`dragDrop.ts:272`).
- `statusText: string | null` — kết quả của
  `dragStatusText(state: DragDropState): string | null` (`dragDrop.ts:317`).
- `dropAllowed` + `blockReasons` (từ `DragSession`, `dragDrop.ts:68-79`) — màn
  tự hiển thị "một câu lý do" (thực ra có thể nhiều câu) trong panel.

Ghi nhận việc cần làm sau (KHÔNG phải việc của `FurnitureLibraryPanel`): **bóng
3D của model chưa vẽ được — cần một task logic riêng nối `ToolPreview`
(`furnitureGhost`) vào cảnh 3D.** Màn chỉ lo sẵn dữ liệu (`preview`/`statusText`/
`dropAllowed`/`blockReasons`), không tự vẽ.

---

## ĐIỂM TÍCH CỰC — đã có, chỉ cần cắm vào

- `src/lib/input/dragDrop.ts` + `src/hooks/useDragDropSession.ts`: bộ máy
  kéo-thả hoàn chỉnh, thuần, có test, tiêm `validateAddFurniture` làm
  `validateDrop`, phát đúng MỘT `FurnitureDropRequest` mỗi phiên, hỗ trợ cả
  bàn phím (A12). Chưa màn nào gọi — panel PHẢI dùng cái này, không viết lại.
- `validateAddFurniture` (`openingCommands.ts:640`) đã trả mảng lý do tiếng
  Việt sẵn sàng hiển thị nguyên văn.
- `disposeFloor`/`ResourceLedger` đã có mẫu dùng rõ ràng ở ba nơi
  (`useFloorLifecycle.ts`, `viewer3dScene.ts`, `previewLayer.ts`) — panel
  không cần tự gọi, chỉ cần không giữ tham chiếu riêng tới mesh đã gắn.
