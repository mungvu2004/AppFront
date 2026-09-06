# Hợp đồng tầng mô hình — PropertyInspector (T1)

> Tài liệu này chỉ đọc mã nguồn thật trong worktree này và chép nguyên chữ ký —
> không đoán tên hàm, không suy diễn hành vi. Mọi mục ghi rõ `đường/dẫn/file.ts:dòng`.
> Vùng đã đọc: `src/lib/viewmodel/**`, `src/domain/spatial/**`, `src/domain/walls/**`,
> `src/domain/openings/**`, `src/domain/rooms/**`, `src/domain/rules/**`,
> `src/domain/units/**`, `src/domain/measure/**`, `src/lib/format/**`,
> `src/store/selectors.ts`, `src/store/selectionSlice.ts`, `src/store/spatialSlice.ts`
> (chỉ đọc). Phần lệnh/store viết (T2), component (T3), hợp đồng props (T4) KHÔNG
> được khảo sát lại ở đây.
>
> Không có mục M1 hay M4 nào ra NOT FOUND ở mức chặn cả màn hình — không cần
> escalate. Rủi ro nghiêm trọng nhất nằm ở M2/M3 (nội thất không có ViewModel) và
> M4/M-12 (ba nhóm luật không được đăng ký mặc định) — xem mục M7.

---

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


## M1. Tra cứu đối tượng theo id (D-12)

**Một đối tượng, theo id:**

- `readEntity<K extends EntityKind>(normalized: NormalizedSpatial, kind: K, id: IdByKind[K]): EntityByKind[K] | null`
  — `src/domain/spatial/applyPatch.ts:275-287`. Trả `null` khi không có id đó hoặc
  entity tìm được không đúng `kind`.
- Hoặc tra thẳng bảng phẳng: `normalized.byId[id]` — kiểu `Readonly<Record<string, SpatialEntity>>`,
  khai ở `src/domain/spatial/normalize.ts:49-55`. Trả `SpatialEntity | undefined`,
  KHÔNG hẹp theo loại (phải tự `isEntityOfKind(kind, entity)`, cùng file dòng 65-66).
- Trong `src/store/selectors.ts`: **NOT FOUND** — không có selector đơn kiểu
  `selectEntityById(state, id)`. Selector duy nhất liên quan đến "chọn" là
  `selectSelectedEntities` (đọc nhiều id cùng lúc, xem dưới). Muốn một đối tượng
  từ store phải tự viết `state.spatial?.byId[id]` tại nơi gọi, hoặc bọc qua
  `readEntity(state.spatial, kind, id)`.

**Nhiều đối tượng cùng lúc (chọn nhiều):**

- `selectSelectedEntities(state: RootState): readonly SpatialEntity[]`
  — `src/store/selectors.ts:313-314`. Đọc `state.selectedIds` và `state.spatial.byId`,
  bỏ qua id trỏ vào đối tượng đã bị xoá (không throw). Có nhớ đệm: `memoizeLatest`
  (cache lời gọi cuối, dòng 41-63) + `keepIfShallowEqualArray` (giữ nguyên tham
  chiếu mảng cũ nếu nội dung không đổi, dòng 66-75) — an toàn gọi mỗi khung hình.
- `state.selectedIds: readonly EntityId[]` khai ở `src/store/selectionSlice.ts:22`.
  API đổi nó: `select(id)`, `deselect(id)`, `setSelection(ids)`, `clearSelection()`
  (dòng 27-32) — thuộc T2, không đào sâu ở đây.
- `SpatialEntity = EntityByKind[EntityKind]` (`src/domain/spatial/normalize.ts:35-46`)
  là hợp của `Level | Wall | Opening | Furniture | Room | Axis | Dimension`. Danh
  sách trả về từ `selectSelectedEntities` có thể trộn nhiều loại — PropertyInspector
  phải tự `isEntityOfKind('wall' | 'opening' | 'room' | 'furniture', entity)` để
  biết đang cầm loại nào trước khi build ViewModel (xem M3).

---

## M2. Kiểu dữ liệu 4 loại đối tượng

### Wall — `src/domain/spatial/types.ts:123-132`

```ts
export interface Wall extends ReviewMetadata {
  id: WallId;
  levelId: LevelId;
  centreline: Segment;       // { start: Point; end: Point }
  thicknessMm: Millimetres;  // = number (KHÔNG có nhãn đơn vị ở module này, xem M6/M7 #9)
  heightMm: Millimetres;
  kind: WallKind;            // 'loadBearing' | 'partition' | 'envelope' — BA giá trị
  openingIds: readonly OpeningId[];
}
```
cộng `ReviewMetadata` (`types.ts:61-65`): `confidence: number`, `source: 'ai'|'human'`, `reviewed: boolean`.

Đối chiếu với các ô spec đòi:

| Ô spec đòi | Có/Không | Ghi chú |
|---|---|---|
| độ dày (110/220/330) | Có trường, KHÔNG có ràng buộc 3 giá trị | `thicknessMm` là số tự do trong một khoảng liên tục — xem M7 #7 |
| chiều dài | **NOT FOUND** trường sẵn | Không lưu trực tiếp; phải tính từ `centreline` (`Math.hypot`, xem `segmentLengthMm` nội bộ `src/lib/viewmodel/toViewModel.ts:163-167`) |
| chiều cao | Có | `heightMm`, đo từ sàn tầng (`Level.elevationMm` riêng, `types.ts:109`) |
| loại tường | Có | `kind` |
| tường nối (joints) | **NOT FOUND** trên kiểu này | Không có trường liệt kê joint/node. Có `resolveJoints`/`resolveWallShapes` (`src/domain/walls/joints.ts:677-746`) nhưng chạy trên một kiểu `Wall` KHÁC (xem M7 #6), không nhận thẳng `Wall` của đồ thị |
| số lỗ mở | Có | `openingIds.length` |

### Opening — `src/domain/spatial/types.ts:141-152`

```ts
export interface Opening extends ReviewMetadata {
  id: OpeningId;
  wallId: WallId;
  kind: OpeningKind;         // 'door' | 'window'
  offsetMm: Millimetres;     // từ điểm start của centreline tới MÉP TRÁI ô mở
  widthMm: Millimetres;
  heightMm: Millimetres;
  sillHeightMm: Millimetres; // cửa đi dùng 0
  swing: SwingDirection;     // 'left' | 'right' | 'double' | 'sliding' | 'fixed'
}
```

| Ô spec đòi | Có/Không | Ghi chú |
|---|---|---|
| chiều rộng | Có | `widthMm` |
| chiều cao | Có | `heightMm` |
| cao độ bậu (sill) | Có | `sillHeightMm` |
| chiều mở (opensTowards/swing) | Tên trường thật là **`swing`** | `opensTowards` **NOT FOUND** trong domain — chỉ tồn tại ở tầng trình diễn 3D (`src/lib/three/present/plan.ts`, `joinery.ts`, ngoài vùng đọc của khảo sát này) |
| tường chủ (host wall) | Có | `wallId` |

### Room — `src/domain/spatial/types.ts:188-197`

```ts
export interface Room extends ReviewMetadata {
  id: RoomId;
  levelId: LevelId;
  name: string;
  usage: RoomUsage;          // 8 giá trị: livingRoom/bedroom/kitchen/bathroom/corridor/stairwell/utility/other
  outline: readonly Point[]; // khép kín, KHÔNG lặp đỉnh đầu ở cuối
  areaM2: SquareMetres;
  wallIds: readonly WallId[];
}
```

| Ô spec đòi | Có/Không | Ghi chú |
|---|---|---|
| tên | Có | `name` (rỗng → nhãn `UNNAMED_ROOM_LABEL`, xem M3) |
| công năng/function | Có | `usage`, nhãn Việt ở `ROOM_USAGE_LABELS` (`src/domain/rules/registry.ts:390-399`) |
| diện tích | Có | `areaM2`, tính sẵn theo domain (không tính lại ở viewmodel, xem M3) |
| số cửa | Không có trường sẵn, nhưng **ĐÃ CÓ tiện ích** (lỗ hổng #3) | `openingsOfRoom` + `countOpeningsByKind`, `src/domain/spatial/roomOpenings.ts` |
| số cửa sổ | Không có trường sẵn, nhưng **ĐÃ CÓ tiện ích** (lỗ hổng #3) | cùng trên |

Đây là thông tin quan trọng: đếm cửa/cửa sổ của một phòng đòi phải tự duyệt
`room.wallIds` → mỗi `wall.openingIds` → tra `opening.kind`. Hàm nội bộ duy nhất
làm đúng việc này trong repo là `openingsOfRoom(context, room, kind)`
(`src/domain/rules/function/index.ts:430-454`, không export, chỉ dùng trong module
đó) — nó cần nguyên một `RuleContext` (đồ thị đã chuẩn hoá + `levelId`), không
dùng được như một tiện ích độc lập nhận `(room, walls, openings)` đơn giản.

### Furniture (nội thất) — `src/domain/spatial/types.ts:166-174`

```ts
export interface Furniture extends ReviewMetadata {
  id: FurnitureId;
  levelId: LevelId;
  roomId?: RoomId;
  kind: FurnitureKind;       // 8 giá trị: table/chair/bed/wardrobe/kitchenCabinet/sanitaryFixture/stair/other
  centre: Point;
  boundingBox: BoundingBox;  // { min: Point; max: Point }
  rotationDeg: Degrees;
}
```

| Ô spec đòi | Có/Không | Ghi chú |
|---|---|---|
| kích thước bao (bounding box) | Có | `boundingBox.min` / `boundingBox.max` |
| góc xoay | Có | `rotationDeg` |

Kiểu dữ liệu của cả 4 loại đều đủ trường ở tầng domain. Nhưng xem M3: tầng
viewmodel — thứ PropertyInspector thực sự tiêu thụ — **không có builder cho
Furniture**. Đây là điểm chết quan trọng nhất của toàn bộ khảo sát này (M7 #1).

---

## M3. Nhóm thuộc tính theo loại (P-03)

`src/lib/viewmodel/toViewModel.ts` — bốn (không phải bốn, xem dưới) hàm build:

```ts
export function toWallViewModel(wall: Wall): ViewModel        // dòng 312-327
export function toOpeningViewModel(opening: Opening): ViewModel // dòng 335-351
export function toRoomViewModel(room: Room): ViewModel         // dòng 360-376
export function toViolationViewModel(violation: Violation): ViewModel // dòng 386-400
export function toViewModel(input: ViewModelInput): ViewModel  // dòng 416-427 — switch theo input.kind
export function toViewModels(inputs: readonly ViewModelInput[]): ViewModel[] // dòng 430-432
```

`toFurnitureViewModel` — **~~NOT FOUND~~ ĐÃ VÁ (lỗ hổng #11, U2): hàm và nhánh `'furniture'`
của `ViewModelInput` nay có thật trong `lib/viewmodel/toViewModel.ts`.** Đoạn dưới giữ nguyên
làm lịch sử.

~~`toFurnitureViewModel` — NOT FOUND.~~ `ViewModelInput` (`src/lib/viewmodel/types.ts:147-151`)
chỉ có 4 nhánh: `'wall' | 'opening' | 'room' | 'violation'`. Không có nhánh `'furniture'`.
`toViewModel(input)` do đó KHÔNG THỂ nhận một `Furniture` — gọi nó với đối tượng
nội thất không biên dịch được (không khớp `ViewModelInput`).

**`ViewModel` có ĐÚNG 6 trường** (`src/lib/viewmodel/types.ts:123-134`):
`id: string`, `label: string`, `secondaryLine: string`,
`attributes: readonly ViewAttribute[]`, `statusCode: ViewStatusCode`,
`iconCode: ViewIconCode`.

**`ViewAttribute` có 3 trường** (`types.ts:108-115`): `label: string`,
`value: string` (đã định dạng sẵn, không phải số), `unit?: string` (**vắng mặt**
chứ không phải `undefined` khi không có đơn vị hoặc khi giá trị là dấu gạch
thiếu — xem docblock dòng 103-107).

**KHÔNG có nhóm đặt tên kiểu "Kích thước hình học" / "Vật liệu" / "Quan hệ".**
`attributes` là MỘT MẢNG PHẲNG, thứ tự cố định theo đúng thứ tự khai trong hàm
build. Ví dụ tường (`toWallViewModel`, dòng 317-323): `[Bề dày, Chiều dài,
Chiều cao, Ô mở, Độ tin cậy]`. Ví dụ lỗ mở (dòng 340-347): `[Bề rộng, Chiều cao,
Cao bệ, Vị trí trên tường, Chiều mở, Độ tin cậy]`. Ví dụ phòng (dòng 367-372):
`[Diện tích, Chu vi, Tường bao, Độ tin cậy]`. Không có tham số hay kiểu nào cho
phép gắn nhãn nhóm; muốn hiện dạng nhóm trên panel, PropertyInspector phải tự
chia mảng phẳng này ở tầng trình bày (view/layout), không phải việc của tầng
mô hình.

---

## M4. Kiểm tra sau khi đổi (M-04, M-08, M-12)

### M-04 — kiểm tra hình học tường sau khi đổi độ dày/chiều dài

Trên kiểu `Wall` mà `toViewModel`/rule registry thực sự dùng
(`domain/spatial/types.Wall`): **không có một hàm đơn lẻ "kiểm tra hình học
tường"**. Đường duy nhất chạm được là chạy lại bộ luật:

```ts
runRules(graph: NormalizedSpatial, options?: RunRulesOptions): RuleRunResult
// src/domain/rules/runner.ts:384-388
```

hai luật liên quan (cả hai nằm trong `BUILT_IN_RULES`, luôn bật mặc định — xem M-12):

- `wallThicknessRule` — mã `WALL-THICKNESS`, mức `warning`, cảnh báo khi
  `thicknessMm` ngoài khoảng 60–400 mm — `src/domain/rules/registry.ts:414-442`.
- `wallLengthRule` — mã `WALL-LENGTH`, mức `critical`, báo khi chiều dài
  centreline < 100 mm — `src/domain/rules/registry.ts:444-469`.

Kết quả là `Violation[]`, không phải một hàm trả `boolean`/"hợp lệ hay không".

Trên kiểu `Wall` KHÁC (`domain/walls/types.Wall`, dùng cho joints/edit/cleanup —
xem M7 #6) có công cụ mạnh hơn nhưng KHÔNG tới được từ `domain/spatial/types.Wall`
mà không qua một hàm chuyển đổi ngoài vùng đọc (`toSolidWall`, chỉ export ở
`src/lib/commands/business/shared.ts`):

- `assertUsableWall(wall: Wall): void` — `src/domain/walls/types.ts:118-134`,
  ném `RangeError` nếu dày ngoài **60–600 mm** (khác khoảng cảnh báo 60–400 mm ở
  trên!), dài bằng 0, hoặc đỉnh không cao hơn đáy.
- `resolveWallShapes(walls, thresholdMm?): ResolveWallShapesResult` —
  `src/domain/walls/joints.ts:700-746`, tính lại toàn bộ đa giác tường (kể cả
  các node nối) sau khi hình dạng tường đổi.

### M-08 — kiểm tra lỗ mở còn vừa tường không

Trên kiểu Opening của đồ thị (`domain/spatial/types.Opening`, dùng offset tuyệt
đối): luật có sẵn

```ts
// mã 'OPENING-IN-WALL', mức critical
// src/domain/rules/registry.ts:471-508
```
so `opening.offsetMm >= 0 && opening.offsetMm + opening.widthMm <= chiều dài tường
chủ`. Chạy qua `runRules`, trả `Violation`.

Trên kiểu Opening/Wall hình học (`domain/openings/types.AttachedOpening`, dùng
phân số vị trí `relativePosition`) có kiểm tra đầy đủ hơn nhiều:

```ts
export function validateOpening(
  opening: AttachedOpening,
  wall: Wall, // domain/walls/types.Wall
  siblings?: readonly Opening[],
  rules?: OpeningRules,
): readonly OpeningViolation[]
// src/domain/openings/validate.ts:250-385
```

kiểm kích thước dương (`sizeNotPositive`), tràn khỏi tường (`beyondWallEnd`),
đỉnh cao hơn tường (`aboveWallTop`), hai ô mở chồng nhau (`overlappingOpenings`),
và chuẩn cửa/cửa sổ (`doorHeight`/`doorSill`/`windowSill`/`widthShareOfWall`).
Hàm này KHÔNG nhận `Opening`/`Wall` của đồ thị trực tiếp — cùng vấn đề "hai kiểu
song song" ở M7 #6.

### M-12 — bộ luật để cảnh báo ngay

Chạy: `src/domain/rules/runner.ts:384-388`.
```ts
export function runRules(
  graph: NormalizedSpatial,
  options: RunRulesOptions = {}, // { registry?, previous?: RuleRunState, changes?: ChangedEntity[] }
): RuleRunResult
```
`options.changes` để chỉ chạy lại phần bị ảnh hưởng (tăng tốc trên model lớn);
bỏ trống thì chạy lại toàn bộ.

Trả về (`runner.ts:112-123`):
```ts
export interface RuleRunResult {
  readonly violations: readonly Violation[];
  readonly state: RuleRunState;   // đưa lại cho lượt chạy sau
  readonly evaluated: readonly RuleTask[];
  readonly reusedTaskCount: number;
  readonly ranInWorker: boolean;
}
```

`Violation` (`src/domain/rules/registry.ts:134-139`):
```ts
export interface Violation {
  readonly entityId: string;
  readonly message: string;    // câu tiếng Việt
  readonly suggestion: string; // câu tiếng Việt
  readonly ruleCode: RuleCode; // chuỗi HOA, vd 'WALL-THICKNESS'
  readonly severity: RuleSeverity;
  readonly levelId: LevelId | null;
}
```

**LỌC Violation THEO ID MỘT ĐỐI TƯỢNG: NOT FOUND.** Không có selector hay hàm
nào trong toàn vùng đọc (kể cả `src/store/selectors.ts`) lọc `Violation[]` theo
`entityId`. Có sẵn:
```ts
selectViolations(state: RootState): readonly Violation[] // selectors.ts:270-271 — TẤT CẢ
selectViolationsByFloor(state): ViolationsByFloor         // selectors.ts:274-275 — theo TẦNG
selectFloorViolations(state, levelId): readonly Violation[] // selectors.ts:278-279 — theo TẦNG
```
không cái nào lọc theo thực thể. Cách thay thế duy nhất: tự
`selectViolations(state).filter((v) => v.entityId === id)` tại nơi gọi — một
phép lọc mảng ghép lại, không phải một hàm có sẵn trong repo.

`RuleSeverity` có **đúng 3 mức** (`registry.ts:57`): `'critical' | 'warning' | 'suggestion'`.
Nhãn tiếng Việt tại `RULE_SEVERITY_LABELS` (`registry.ts:63-67`):
`{ critical: 'nghiêm trọng', warning: 'cảnh báo', suggestion: 'gợi ý' }`.
`toViewModel.ts` ánh xạ severity → `statusCode` (3 giá trị: `violation` / `attention`
/ `neutral`) qua `VIOLATION_STATUS_CODES` (`toViewModel.ts:276-280`) và icon qua
`VIOLATION_ICON_CODES` (dòng 282-286).

**Rủi ro lớn — xem M7 #2:** `defaultRuleRegistry()` (registry dùng chung mà
`selectViolations` gọi qua `runRules(spatial)` không truyền `options.registry`,
`src/store/selectors.ts`) ~~chỉ có 8 luật gốc `BUILT_IN_RULES`~~ — **ĐÃ VÁ (lỗ hổng #6, U3): nay
là cả sổ 25 luật của `src/domain/rules/defaults.ts`, 23 trong đó bật.** Đoạn dưới giữ nguyên làm
lịch sử: khi khảo sát, nó chỉ có 8 luật gốc `BUILT_IN_RULES`
(`registry.ts:663-672`). Ba nhóm luật khác — hình học 7 luật
(`GEOMETRY_RULES`, `src/domain/rules/geometry/index.ts:1132-1140`), công năng 7
luật kể cả `FURNITURE-CLASH` (`FUNCTION_RULES`,
`src/domain/rules/function/index.ts:1110-1118`), fit-out 3 luật
(`FITOUT_RULES`, `src/domain/rules/fitout/index.ts:418-422`) — chỉ được thêm vào
MỘT registry nếu có ai chủ động gọi `registerGeometryRules`/`registerFunctionRules`/
`registerFitoutRules` lên registry đó. Không nơi nào trong `src/main.tsx`/`src/App.tsx`
gọi ba hàm này (xác nhận qua đọc `src/screens/qc/RoomLabelReview/roomLabelReviewGateway.ts:809-823`,
nơi một màn khác đã phải tự dựng một `RuleRegistry` RIÊNG cho chính nó bằng
`createRuleRegistry()` + `registerFunctionRules(registry)` vì lý do đúng như trên).

---

## M5. Định dạng số (P-01)

`src/lib/format/number.ts` — nhận **số trần**, không mang ý nghĩa đơn vị:

```ts
export function formatNumber(value: MaybeNumber, options?: NumberFormatOptions): string
// dòng 201-211. vi-VN: '.' nhóm nghìn, ',' thập phân.
// formatNumber(4250, { fractionDigits: 2 }) === "4.250,00"

export function formatPercent(value: MaybeNumber, options?: PercentFormatOptions): string
// dòng 225-239. options.source: 'ratio' (mặc định, 0-1) | 'percent' (đã nhân 100)

export function parseNumber(text: string): number | undefined
// dòng 255-266. Chiều ngược: "4.250,50" -> 4250.5
```

`src/lib/format/measure.ts` — mọi hàm nhận **số ĐÃ CÓ Ý NGHĨA ĐƠN VỊ CỤ THỂ**:

```ts
export function formatLength(valueMm: MaybeNumber, options?: LengthFormatOptions): string
// dòng 108-121. NHẬN MILLIMET.
// Mặc định TỰ CHỌN đơn vị theo độ lớn: |valueMm| < METRE_THRESHOLD_MM (=1000mm)
// giữ mm (0 chữ số thập phân); từ 1000mm trở lên đổi ra m (2 chữ số thập phân).
// formatLength(4250) === "4,25 m"  — KHÔNG PHẢI "4.250,00 mm"!
// Muốn đúng dạng "4.250,00 mm" phải ép: formatLength(4250, { unit: 'mm', fractionDigits: 2 })

export function formatArea(areaM2: MaybeNumber, options?: MeasureFormatOptions): string
// dòng 131-137. NHẬN MÉT VUÔNG (không phải mm²). formatArea(248.6) === "248,60 m²"

export function formatAngle(angleDeg: MaybeNumber, options?: MeasureFormatOptions): string
// dòng 151-157. NHẬN ĐỘ (degrees), 1 chữ số thập phân, KHÔNG gấp về [0,360)
```
(`formatScaleDensity`/`formatDrawingScaleRatio`, dòng 178-226, là tỉ lệ bản vẽ —
không liên quan PropertyInspector.)

**Tóm tắt hàm nào nhận mm, hàm nào nhận m:** chỉ `formatLength` nhận **mm** làm
input (luôn luôn — bất kể nó hiện ra dạng mm hay tự đổi sang m). **NOT FOUND:**
không có hàm định dạng nào trong `src/lib/format` nhận thẳng **mét (m)** làm
input; muốn hiện theo m phải tự đổi trước (`valueMm / MILLIMETRES_PER_METRE`)
rồi gọi `formatNumber`, hoặc gọi `formatLength(valueMm, { unit: 'm' })` (vẫn
truyền mm vào, chỉ ép đơn vị hiện ra). `formatArea` nhận **m²** (khớp với
`Room.areaM2` vốn đã lưu ở m² trong domain, không cần đổi).

Dấu thập phân LÀ dấu phẩy (khớp A15) vì `LOCALE = 'vi-VN'` cố định tại
`src/lib/format/number.ts:36`, không tham số hoá được.

---

## M6. Đơn vị

`src/domain/units/types.ts`:

**Hằng số quy đổi:**
```ts
export const MILLIMETRES_PER_METRE = 1000;                          // dòng 55
export const MILLIMETRES_PER_DECIMETRE = 100;                       // dòng 58
export const MILLIMETRES_PER_CENTIMETRE = 10;                       // dòng 61
export const SQUARE_MILLIMETRES_PER_SQUARE_METRE = 1_000_000;       // dòng 64
export const DEGREES_PER_TURN = 360;                                // dòng 67
export const RADIANS_PER_TURN = Math.PI * 2;                        // dòng 70
```

**Kiểu có nhãn (phantom-typed, xoá lúc runtime):** `Millimetres`, `Metres`,
`SquareMetres`, `Degrees`, `Radians`, `Pixels`, `MillimetresPerPixel` — mọi kiểu
là `number & UnitBrand<'...'>` (dòng 25-52).

**Hàm dựng — cổng duy nhất nhận số trần** (ném `RangeError` nếu không hữu hạn):
```ts
export function millimetres(value: number): Millimetres   // dòng 84-87
export function metres(value: number): Metres             // dòng 90-93
export function squareMetres(value: number): SquareMetres // dòng 96-99
export function degrees(value: number): Degrees           // dòng 102-105
export function radians(value: number): Radians           // dòng 108-111
```

**Quy đổi:**
```ts
export function metresToMillimetres(value: Metres): Millimetres      // dòng 118-120
export function millimetresToMetres(value: Millimetres): Metres      // dòng 123-125
export function degreesToRadians(value: Degrees): Radians            // dòng 128-130
export function radiansToDegrees(value: Radians): Degrees            // dòng 133-135
export function normaliseDegrees(value: Degrees): Degrees            // dòng 138-141, gấp về [0,360)
export function rectangleArea(width: Millimetres, height: Millimetres): SquareMetres // dòng 144-146
```

**Làm tròn:**
```ts
export const DEFAULT_ROUNDING_STEP: Millimetres = millimetres(1);    // dòng 153
export function roundMeasurement(value: Millimetres, step = DEFAULT_ROUNDING_STEP): Millimetres
// dòng 171-181 — làm tròn nửa xa 0 (2,5 -> 3; -2,5 -> -3)
```

**Cảnh báo:** `domain/spatial/types.ts:16` cũng khai `export type Millimetres = number;`
— một kiểu KHÔNG gắn nhãn, trùng tên với `Quantity<'mm'>` có nhãn ở
`domain/units/types.ts:34`. Đây là hai kiểu `Millimetres` khác nhau, cùng tên,
ở hai module khác nhau — xem M7 #9.

---

## M7. Điểm chết / rủi ro

1. **Spec đòi PropertyInspector hiện thuộc tính của "Nội thất" như một trong 4
   loại đối tượng — NOT FOUND.** Không có `toFurnitureViewModel`, không có nhánh
   `'furniture'` trong `ViewModelInput`. Nơi gần nhất đã tìm:
   `src/lib/viewmodel/toViewModel.ts` (chỉ có wall/opening/room/violation) và
   `src/lib/viewmodel/types.ts:147-151`. Kiểu `Furniture` đủ trường ở tầng domain
   (`src/domain/spatial/types.ts:166-174`) nhưng không có cầu nối sang ViewModel.
   Nếu người dùng chọn một món nội thất, `selectSelectedEntities` vẫn trả về nó
   (là `SpatialEntity` hợp lệ), nhưng không có cách build một `ViewModel` cho nó
   bằng hàm có sẵn trong repo.

2. **Spec đòi ba nhóm luật QC bổ sung (hình học/công năng/fit-out, 17 luật, gồm
   cả `FURNITURE-CLASH`) tự động cảnh báo ngay khi đổi — NOT FOUND ở mức "mặc
   định đã bật".** `defaultRuleRegistry()` mà `src/store/selectors.ts` dùng chỉ
   có 8 `BUILT_IN_RULES` (`src/domain/rules/registry.ts:663-672`). Không nơi nào
   trong `src/main.tsx`/`src/App.tsx` gọi `registerGeometryRules`/
   `registerFunctionRules`/`registerFitoutRules`. Bằng chứng: một màn khác
   (`src/screens/qc/RoomLabelReview/roomLabelReviewGateway.ts:809-823`) đã phải
   tự dựng registry RIÊNG cho chính nó vì lý do này. PropertyInspector nếu chỉ
   gọi `selectViolations(state)` sẽ KHÔNG BAO GIỜ thấy cảnh báo nội thất chồng
   tường, phòng thiếu cửa sổ, đường thoát nạn quá xa, v.v. — trừ khi tự đăng ký
   ba nhóm luật này vào một registry riêng (theo đúng khuôn mà RoomLabelReview
   đã làm).

3. **Không có hàm/selector lọc `Violation[]` theo id một thực thể — NOT FOUND.**
   Nơi gần nhất đã tìm: `src/store/selectors.ts:274-279` (`selectViolationsByFloor`/
   `selectFloorViolations` chỉ lọc theo TẦNG). Cách thay thế duy nhất: tự
   `.filter((v) => v.entityId === id)` trên `selectViolations(state)` tại nơi gọi.

4. **Spec đòi trường `opensTowards` cho chiều mở cửa — NOT FOUND trong domain.**
   Trường thật là `swing: SwingDirection` (`src/domain/spatial/types.ts:151`,
   5 giá trị: left/right/double/sliding/fixed). `opensTowards` chỉ tồn tại ở tầng
   trình diễn 3D (`src/lib/three/present/plan.ts`, `joinery.ts`), ngoài vùng đọc
   được giao cho khảo sát này.

5. **Spec đòi "số cửa, số cửa sổ" cho một phòng — NOT FOUND trường sẵn, và
   NOT FOUND hàm tiện ích công khai để tính.** `Room` (`src/domain/spatial/types.ts:188-197`)
   không có `openingIds`/`doorCount`/`windowCount`. Hàm duy nhất tính đúng việc
   này, `openingsOfRoom` (`src/domain/rules/function/index.ts:430-454`), không
   export và cần một `RuleContext` đầy đủ, không dùng được như tiện ích rời.

6. **Hai kiểu `Wall`/`Opening` song song, không liên thông, trong cùng repo —
   rủi ro lớn nhất cho M4/M-04/M-08.**
   - `domain/spatial/types.Wall` (`types.ts:123-132`, có `ReviewMetadata`,
     `kind` 3 giá trị, `heightMm` tương đối) — đây là kiểu `toViewModel.ts`,
     `rules/registry.ts` và store dùng.
   - `domain/walls/types.Wall` (`types.ts:61-70`, KHÔNG `ReviewMetadata`, `kind`
     4 giá trị gồm cả `railing`/`glazed`, `baseElevationMm`/`topElevationMm`
     tuyệt đối) — đây là kiểu `joints.ts`/`edit.ts`/`cleanup.ts` dùng, có
     `assertUsableWall`, `resolveWallShapes` mạnh hơn nhiều so với luật
     `WALL-THICKNESS`/`WALL-LENGTH` phía trên.
   - Tương tự, `domain/openings/types.Opening` (dùng `relativePosition` phân số,
     có `AttachedOpening`/`OrphanOpening`) khác `domain/spatial/types.Opening`
     (dùng `offsetMm` tuyệt đối). `validateOpening` (`domain/openings/validate.ts:250`)
     kiểm nhiều hơn luật `OPENING-IN-WALL` nhưng chỉ nhận kiểu thứ hai này.
   - Cầu nối DUY NHẤT là một chiều đồ thị → hình học,
     `toBuildFloorInput`/`toSolidWall`/`toAttachedOpening`
     (`src/domain/spatial/toBuildFloorInput.ts:171-216`), cần một `Level` đi
     kèm và chỉ phục vụ việc dựng mesh 3D — không phải đường để PropertyInspector
     lấy kết quả kiểm tra hình học chi tiết hơn. Muốn dùng `validateOpening`/
     `assertUsableWall` từ PropertyInspector phải tự chuyển đổi qua lại, và
     phần chuyển đổi công khai đó nằm ở `src/lib/commands/business/shared.ts`
     (thuộc T2, ngoài whitelist sửa file của khảo sát này).

7. **Spec giả định độ dày tường chỉ nhận 3 giá trị chuẩn (110/220/330) —
   NOT FOUND ràng buộc này ở bất kỳ đâu trong domain.** `thicknessMm` là một số
   tự do. Ràng buộc gần nhất chỉ là khoảng liên tục, và bản thân khoảng đó CŨNG
   KHÔNG THỐNG NHẤT giữa hai module:
   - `domain/walls/types.ts:43,46` — `MIN_WALL_THICKNESS_MM = 60`,
     `MAX_WALL_THICKNESS_MM = 600` (dùng trong `assertUsableWall`, ném lỗi).
   - `domain/rules/registry.ts:361,364` — hằng số **CÙNG TÊN** nhưng giá trị
     khác: `MIN_WALL_THICKNESS_MM = 60`, `MAX_WALL_THICKNESS_MM = 400` (dùng
     trong luật `WALL-THICKNESS`, chỉ cảnh báo).
   Không có bảng enum {110, 220, 330} nào trong vùng đã đọc.

8. **Không có hàm "kiểm tra hình học tường sau khi đổi" dạng đơn — chỉ có bộ
   luật chạy lại toàn bộ.** Xem M4/M-04. Muốn kiểm một tường vừa đổi độ dày/chiều
   dài, cách duy nhất trên kiểu đồ thị là gọi lại `runRules` (hoặc dựa vào lượt
   chạy lại tăng dần qua `options.changes`) rồi tự đọc `Violation[]` có
   `ruleCode` là `WALL-THICKNESS`/`WALL-LENGTH` và `entityId` là tường đó (lại
   gặp NOT FOUND #3 ở trên: phải tự lọc theo entityId).

9. **Hai kiểu tên `Millimetres` khác nhau, cùng tên, ở hai module khác nhau —
   dễ nhầm khi import.** `domain/spatial/types.ts:16` khai
   `export type Millimetres = number;` (không nhãn); `domain/units/types.ts:34`
   khai `export type Millimetres = Quantity<'mm'>` (có nhãn phantom, không thể
   gán lẫn với `number` trần mà không qua `millimetres()`). Cùng tên loại,
   import nhầm module không báo lỗi biên dịch rõ ràng ngay tại chỗ vì cả hai
   đều "trông giống `number`" ở phía gọi.
