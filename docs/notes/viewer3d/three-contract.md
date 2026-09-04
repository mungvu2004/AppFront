# Hợp đồng `src/lib/three/build/**` và `src/lib/three/perf/**` — T1

Khảo sát cho màn hình `Viewer3D` sắp dựng. Mọi dòng dưới đây được xác minh bằng cách đọc
mã nguồn thật tại thời điểm viết (không đoán). Đường dẫn tương đối tính từ gốc repo.

**Không có `index.ts` gộp cho `src/lib/three/build/` hay `src/lib/three/perf/`** — mỗi
module phải import theo file cụ thể.

---

## 1. `src/lib/three/build/floor.ts` — dựng một tầng

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `BuildableRoom` | floor.ts:66 | `interface { readonly id: RoomId; readonly outline: readonly PointMm[] }` | Phòng tối thiểu để dựng sàn: đường bao kín, đỉnh đầu không lặp lại ở cuối. |
| `BuildableLevel` | floor.ts:79 | `interface { readonly id: LevelId; readonly elevationMm: Millimetres; readonly heightMm: Millimetres }` | Tầng tối thiểu để dựng: cao độ sàn hoàn thiện và chiều cao thông thuỷ. |
| `SlabPartData` | floor.ts:86 | `interface extends PartUserData { readonly kind: 'floorSlab' \| 'ceiling'; readonly entityId: RoomId; readonly thicknessMm: Millimetres }` | `userData` gắn trên mesh sàn/trần. |
| `OpeningPartData` | floor.ts:93 | `interface extends PartUserData { readonly kind: 'opening'; readonly entityId: OpeningId; readonly wallId: Wall['id'] }` | `userData` gắn trên panel cửa/kính. |
| `BuildFloorInput` | floor.ts:101 | `interface { readonly level: BuildableLevel; readonly walls: readonly Wall[]; readonly rooms: readonly BuildableRoom[]; readonly openings?: readonly Opening[]; readonly slabThicknessMm?: Millimetres }` | Toàn bộ dữ liệu để dựng **một tầng**. Đây là input chính `Viewer3D` phải chuẩn bị từ Spatial JSON. |
| `buildFloorSlab` | floor.ts:251 | `(room: BuildableRoom, level: BuildableLevel, thicknessMm?: Millimetres) => Mesh` | Sàn 150 mm dưới một phòng, mặt trên ở cao độ sàn hoàn thiện. Ném `RangeError` nếu đường bao hỏng. |
| `buildCeiling` | floor.ts:269 | `(room: BuildableRoom, level: BuildableLevel, thicknessMm?: Millimetres) => Mesh` | Trần 150 mm nằm trên đáy trần (soffit). Ném `RangeError` nếu đường bao hỏng. |
| `buildFloorMesh` | floor.ts:294 | `(input: BuildFloorInput) => Group` | **Hàm chính R-01.** Dựng cả tầng: tường (đã khoét lỗ) → sàn từng phòng → trần từng phòng → panel từng ô mở, theo thứ tự cố định. Không gán vật liệu. |

Hằng số tái xuất tại floor.ts:59 (định nghĩa gốc ở `plan.ts`):

| Tên | path:line định nghĩa gốc | Kiểu | Mô tả |
|---|---|---|---|
| `SLAB_THICKNESS_MM` | plan.ts:49 | `Millimetres` = 150 | Độ dày sàn/trần dựng. |
| `OPENING_PANEL_THICKNESS_MM` | plan.ts:59 | `Millimetres` = 40 | Độ dày panel cửa/kính. |

---

## 2. `src/lib/three/build/buildCore.ts` — dựng hình thuần trên worker (R-03)

Không import three.js. `build.worker.ts` chỉ là lớp vỏ mỏng gắn `onmessage`, re-export
nguyên các tên dưới đây từ `buildCore.ts` (build.worker.ts:21-29) — **màn hình và
`buildQueue.ts` import các type này từ `./build.worker`, không phải `./buildCore`.**

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `WallBuildJob` | buildCore.ts:87 | `interface { readonly kind: 'wall'; readonly key: WallId; readonly levelId: LevelId; readonly wall: Wall; readonly openings: readonly Opening[] }` | Một job: dựng lại một tường. |
| `RoomBuildJob` | buildCore.ts:98 | `interface { readonly kind: 'room'; readonly key: RoomId; readonly levelId: LevelId; readonly room: BuildableRoom; readonly level: BuildableLevel; readonly slabThicknessMm?: number }` | Một job: dựng lại sàn+trần một phòng. |
| `BuildJob` | buildCore.ts:108 | `type = WallBuildJob \| RoomBuildJob` | Đơn vị công việc gửi cho worker. |
| `BuiltPartBuffers` | buildCore.ts:111 | `interface { readonly kind: BuildPartKind; readonly entityId: BuildEntityId; readonly levelId: LevelId; readonly position: Float32Array; readonly normal: Float32Array; readonly uv: Float32Array; readonly openingIds: readonly OpeningId[]; readonly refusals: readonly CutRefusal[] }` | Kết quả một mesh, dạng buffer chuyển được qua `postMessage` (transferable). |
| `BuildRequestMessage` | buildCore.ts:126 | `interface { readonly ticket: number; readonly job: BuildJob }` | Thông điệp gửi vào worker. |
| `BuildResponseMessage` | buildCore.ts:132 | `type = { ticket: number; parts: readonly BuiltPartBuffers[] } \| { ticket: number; error: string }` | Thông điệp trả về. |
| `buildParts` | buildCore.ts:617 | `(job: BuildJob) => readonly BuiltPartBuffers[]` | Toàn bộ arithmetic của một job. Gọi được ngoài worker (test dùng trực tiếp). Ném `RangeError` nếu tường/phòng không hợp lệ. |
| `transferablesOf` | buildCore.ts:622 | `(parts: readonly BuiltPartBuffers[]) => Transferable[]` | Danh sách `ArrayBuffer` để `postMessage` chuyển thay vì sao chép. |
| `respondTo` | buildCore.ts:627 | `(message: BuildRequestMessage) => BuildResponseMessage` | Bọc `buildParts` để lỗi thành message thay vì throw xuyên `postMessage`. |

---

## 3. `src/lib/three/build/buildQueue.ts` — hàng đợi + cầu nối worker↔three.js (R-03)

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `BuildWorkerLike` | buildQueue.ts:60 | `interface { postMessage(message: BuildRequestMessage): void; terminate(): void; onmessage: ((event: MessageEvent<BuildResponseMessage>) => void) \| null }` | Phần tối thiểu của `Worker` mà queue dùng; test thay bằng stub qua đây. |
| `CancelReason` | buildQueue.ts:67 | `type = 'superseded' \| 'disposed'` | Vì sao một job không cho ra hình học. |
| `BuildOutcome` | buildQueue.ts:74 | `type = { status: 'done'; parts: readonly BuiltPartBuffers[] } \| { status: 'cancelled'; reason: CancelReason } \| { status: 'failed'; message: string }` | Kết quả `await` được của một job đã enqueue. **Không có trường phần trăm/tiến độ** — xem mục (a). |
| `BuildQueueOptions` | buildQueue.ts:79 | `interface { readonly createWorker?: () => BuildWorkerLike; readonly maxInFlight?: number }` | Tuỳ chọn khởi tạo `BuildQueue`. `maxInFlight` mặc định 1. |
| `planWallChange` | buildQueue.ts:118 | `(model: BuildFloorInput, wallId: WallId) => readonly BuildJob[]` | Job nhỏ nhất khi một tường đổi: **đúng 1 job** (hoặc 0 nếu id lạ, không throw). |
| `planRoomChange` | buildQueue.ts:136 | `(model: BuildFloorInput, roomId: RoomId) => readonly BuildJob[]` | Job nhỏ nhất khi một phòng đổi: **đúng 1 job** (hoặc 0 nếu id lạ). |
| `planFullBuild` | buildQueue.ts:164 | `(model: BuildFloorInput) => readonly BuildJob[]` | **Mọi job để dựng MỘT tầng từ đầu**: một job/tường + một job/phòng. Số job = `model.walls.length + model.rooms.length`. Với fixture chuẩn của test (`buildQueue.test.ts:47-49`) là 48 tường + 14 phòng = **62 job cho một tầng**. **Chỉ nhận một `BuildFloorInput` — một tầng.** Xem mục CẠM BẪY cho toà 4 tầng. |
| `toGeometry` | buildQueue.ts:176 | `(part: BuiltPartBuffers) => BufferGeometry` | Buffer → `BufferGeometry`, không sao chép dữ liệu đỉnh. |
| `toMesh` | buildQueue.ts:200 | `(part: BuiltPartBuffers) => Mesh` | Buffer → `Mesh` đã `tagPart` giống hệt `wall.ts`/`floor.ts`, không gán vật liệu. |
| `createBuildWorker` | buildQueue.ts:228 | `() => BuildWorkerLike` | Tạo `Worker` thật qua `new URL('./build.worker.ts', import.meta.url)` (Vite). Đây là default của `BuildQueueOptions.createWorker`. |
| `BuildQueue` | buildQueue.ts:241 | `class` | Hàng đợi job, gộp theo entity (`job.key`), trả kết quả qua worker. Chi tiết phương thức công khai bên dưới. |

### `BuildQueue` — mọi phương thức công khai

| Thành viên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| constructor | buildQueue.ts:250 | `(options: BuildQueueOptions = {})` | Không tạo worker ngay — worker chỉ sinh ra ở job đầu tiên (`ensureWorker`, lazily). |
| `pendingCount` | buildQueue.ts:256 | `get pendingCount(): number` | Số job đang chờ, chưa gửi cho worker. |
| `inFlightCount` | buildQueue.ts:261 | `get inFlightCount(): number` | Số job đã gửi, worker chưa trả lời. |
| `isDisposed` | buildQueue.ts:266 | `get isDisposed(): boolean` | Queue đã đóng chưa. |
| `enqueue` | buildQueue.ts:278 | `(job: BuildJob) => Promise<BuildOutcome>` | Xếp một job, **thay thế** job cũ cùng `key` (job cũ được `settle` `cancelled/superseded` ngay). Promise luôn settle — không bao giờ treo. |
| `enqueueAll` | buildQueue.ts:303 | `(jobs: readonly BuildJob[]) => Promise<readonly BuildOutcome[]>` | `Promise.all(jobs.map(enqueue))` — chỉ resolve khi **tất cả** job xong. Không cho biết job nào xong trước job nào. |
| `dispose` | buildQueue.ts:315 | `() => void` | **R-05 cho worker.** Settle mọi job còn treo bằng `cancelled/disposed`, gỡ `onmessage`, `terminate()` worker. An toàn gọi hai lần. |

---

## 4. `src/lib/three/build/merge.ts` — gộp lưới (R-02)

**Đây là module `mergeByMaterial`/`collectMeshes`, KHÔNG PHẢI `mergeStatic`/`collectStatic`
— xem mục CẠM BẪY.**

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `VertexRange` | merge.ts:57 | `interface { readonly start: number; readonly count: number }` | Một đoạn của buffer đỉnh đã gộp. |
| `MergedPart` | merge.ts:64 | `interface extends VertexRange { readonly entityId: BuildEntityId; readonly kind: BuildPartKind; readonly levelId: LevelId }` | Nơi một entity nằm trong buffer gộp. |
| `InstancedPart` | merge.ts:71 | `interface { readonly entityId: BuildEntityId; readonly kind: BuildPartKind; readonly levelId: LevelId; readonly instanceId: number }` | Entity nào ứng với instance nào. |
| `MergedBatch` | merge.ts:79 | `interface { readonly kind: 'merged'; readonly key: string; readonly mesh: Mesh; readonly parts: readonly MergedPart[] }` | Nhiều part gộp vào một buffer, một draw call. |
| `InstancedBatch` | merge.ts:89 | `interface { readonly kind: 'instanced'; readonly key: string; readonly mesh: InstancedMesh; readonly parts: readonly InstancedPart[] }` | Một hình học vẽ nhiều lần (nội thất lặp lại). |
| `MergeBatch` | merge.ts:98 | `type = MergedBatch \| InstancedBatch` | Một batch, kiểu nào cũng được. |
| `PartLocation` | merge.ts:101 | `interface { readonly batch: MergeBatch; readonly part: MergedPart \| InstancedPart }` | Kết quả tra cứu theo entity id. |
| `MergeSkipReason` | merge.ts:107 | `type = 'noPartData' \| 'multipleMaterials' \| 'noGeometry'` | Vì sao một mesh không được gộp. |
| `SkippedMesh` | merge.ts:116 | `interface { readonly name: string; readonly reason: MergeSkipReason; readonly message: string }` | Mesh bị bỏ qua, kèm câu tiếng Việt. |
| `MergeResult` | merge.ts:131 | `interface { readonly batches: readonly MergeBatch[]; readonly index: ReadonlyMap<BuildEntityId, readonly PartLocation[]>; readonly skipped: readonly SkippedMesh[] }` | Kết quả `mergeByMaterial`/`mergeGroup`. |
| `MergeOptions` | merge.ts:139 | `interface { readonly materialKey?: (mesh: Mesh) => string; readonly instanceThreshold?: number }` | `instanceThreshold` mặc định 2. |
| `collectMeshes` | merge.ts:407 | `(root: Object3D) => readonly Mesh[]` | Mọi `Mesh` (không tính `InstancedMesh`) trong một subtree, không đụng gì. |
| `mergeByMaterial` | merge.ts:433 | `(meshes: readonly Mesh[], options: MergeOptions = {}) => MergeResult` | **Hàm chính R-02.** Gộp theo vật liệu; hình học lặp ≥ ngưỡng thì instance, còn lại gộp buffer. Ném `RangeError` nếu `instanceThreshold < 2`. |
| `mergeGroup` | merge.ts:486 | `(root: Object3D, options: MergeOptions = {}) => MergeResult` | `mergeByMaterial(collectMeshes(root), options)` — bản tiện dụng. |
| `locateParts` | merge.ts:491 | `(result: MergeResult, entityId: BuildEntityId) => readonly PartLocation[]` | Mọi part vẽ một entity (phòng có 2: sàn + trần). |
| `partAtVertex` | merge.ts:501 | `(batch: MergedBatch, vertexIndex: number) => MergedPart \| null` | Tìm part chứa một đỉnh, nhị phân trên bảng range. |
| `HitLike` | merge.ts:524 | `interface { readonly object: Object3D; readonly face?: { readonly a: number } \| null \| undefined; readonly instanceId?: number \| undefined }` | Phần tối thiểu một raycast hit cần có. |
| `entityAtHit` | merge.ts:549 | `(result: MergeResult, hit: HitLike) => BuildEntityId \| null` | Raycast hit → entity id, dù batch gộp hay chưa gộp. |
| `selectionRanges` | merge.ts:575 | `(batch: MergedBatch, entityIds: Iterable<BuildEntityId>) => readonly VertexRange[]` | Đoạn buffer cần tô để highlight các entity đã chọn. |

---

## 5. `src/lib/three/build/lod.ts` — ba mức chi tiết (R-02)

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `DetailLevel` | lod.ts:43 | `type = 'full' \| 'reduced' \| 'block'` | Ba rung. |
| `DETAIL_LEVELS` | lod.ts:46 | `readonly DetailLevel[] = ['full', 'reduced', 'block']` | Thứ tự từ chi tiết nhất đến rẻ nhất. |
| `REDUCED_DISTANCE_M` | lod.ts:49 | `number = 25` | Từ đây trở đi bỏ panel cửa/kính. |
| `BLOCK_DISTANCE_M` | lod.ts:52 | `number = 60` | Từ đây trở đi chỉ còn khối đặc (bỏ luôn trần, không khoét lỗ). |
| `DETAIL_DISTANCES_M` | lod.ts:55 | `Readonly<Record<DetailLevel, number>> = { full: 0, reduced: 25, block: 60 }` | Khoảng cách mỗi rung bắt đầu. |
| `detailLevelAt` | lod.ts:119 | `(distanceM: number) => DetailLevel` | Khoảng cách → rung nên vẽ. Ném `RangeError` nếu không phải số hữu hạn không âm. |
| `readDetail` | lod.ts:134 | `(object: Object3D) => DetailLevel \| null` | Đọc lại rung đã gắn trên `userData.detail`. |
| `buildFloorAtDetail` | lod.ts:152 | `(input: BuildFloorInput, detail: DetailLevel) => Group` | Dựng một tầng ở một rung cụ thể (gọi `buildFloorMesh` rồi bỏ bớt). |
| `buildFloorLod` | lod.ts:165 | `(input: BuildFloorInput) => LOD` | Dựng cả ba rung, trả về `THREE.LOD` sẵn sàng gắn vào scene. **Đây là hàm màn nên gọi thay vì tự gọi `buildFloorMesh` trực tiếp**, vì nó cho three.js tự chuyển rung theo khoảng cách camera. |

---

## 6. `src/lib/three/build/scene.ts` — biên đơn vị và gắn thẻ

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `SceneLength` | scene.ts:48 | `type = number` | Đơn vị scene (mét), phân biệt với `Millimetres`. |
| `toSceneLength` | scene.ts:55 | `(valueMm: Millimetres) => SceneLength` | **Điểm quy đổi mm→m duy nhất của package.** Ném `RangeError` nếu không phải số hữu hạn. |
| `sceneVector2` | scene.ts:60 | `(firstMm: Millimetres, secondMm: Millimetres) => Vector2` | Cặp độ dài mm → điểm 2D scene. |
| `scenePoint` | scene.ts:71 | `(point: PointMm, elevationMm: Millimetres) => Vector3` | Toạ độ mặt bằng + cao độ → điểm 3D scene. `plan.x→x`, cao độ→`y`, `plan.y→z`. |
| `BuildPartKind` | scene.ts:90 | `type = 'level' \| 'wall' \| 'floorSlab' \| 'ceiling' \| 'opening' \| 'furniture'` | Loại object dựng. |
| `BuildEntityId` | scene.ts:93 | `type = LevelId \| WallId \| RoomId \| OpeningId \| FurnitureId` | Mọi id model mà một object dựng có thể trỏ về. |
| `PartUserData` | scene.ts:103 | `interface { readonly kind: BuildPartKind; readonly entityId: BuildEntityId; readonly levelId: LevelId }` | Thẻ gắn trên mọi object dựng, đọc qua `readPartData`. |
| `tagPart` | scene.ts:116 | `<TObject extends Object3D>(object: TObject, data: PartUserData) => TObject` | Gắn `userData` + đặt `object.name = data.entityId`. Cách DUY NHẤT để gắn thẻ. |
| `readPartData` | scene.ts:142 | `(object: Object3D) => PartUserData \| null` | Đọc lại thẻ, kiểm hình dạng runtime (không tin `any` của three). |

---

## 7. `src/lib/three/build/wall.ts` — dựng tường (dùng bởi `buildFloorMesh`)

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `WallPartData` | wall.ts:81 | `interface extends PartUserData { readonly kind: 'wall'; readonly entityId: WallId; readonly openingIds: readonly OpeningId[]; readonly refusals: readonly CutRefusal[] }` | `userData` của mesh tường. |
| `BuildWallOptions` | wall.ts:89 | `interface { readonly levelId: LevelId; readonly openings?: readonly Opening[] }` | Tham số phụ cho `buildWallMesh`. |
| `wallFrame` | wall.ts:141 | `(wall: Wall) => Matrix4` | Khung toạ độ riêng của tường (dọc/lên/ngang), dùng để đặt panel cửa vào đúng lỗ. Ném `RangeError` nếu tường không hợp lệ. |
| `buildWallMesh` | wall.ts:181 | `(wall: Wall, options: BuildWallOptions) => Mesh` | Đùn centreline thành khối đặc, khoét cửa/sổ. Ném `RangeError` nếu độ dày ngoài 60–600 mm, centreline dài 0, hoặc đỉnh không cao hơn đáy. |

---

## 8. `src/lib/three/perf/budget.ts` — ngân sách hiệu năng (R-04)

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `FrameRateFloors` | budget.ts:64 | `interface { readonly desktop: number; readonly mobile: number }` | Sàn khung hình theo loại máy. |
| `SceneBudget` | budget.ts:72 | `interface { readonly maxDrawCalls: number; readonly maxTriangles: number; readonly maxMaterials: number; readonly maxGraphicsMemoryMb: number; readonly minFrameRate: FrameRateFloors }` | Hình dạng ngân sách. |
| `SCENE_BUDGET` | budget.ts:92 | `SceneBudget` (đóng băng) = `{ maxDrawCalls: 150, maxTriangles: 900_000, maxMaterials: 40, maxGraphicsMemoryMb: 350, minFrameRate: { desktop: 45, mobile: 30 } }` | **Ngân sách DUY NHẤT** — xem mục (c) cho số cụ thể. |
| `DeviceProfile` | budget.ts:101 | `type = 'desktop' \| 'mobile'` | Loại máy đang đo. |
| `SceneReading` | budget.ts:108 | `interface { readonly drawCalls: number; readonly triangles: number; readonly materials: number; readonly graphicsMemoryMb: number }` | Kết quả đo một scene. |
| `BudgetReading` | budget.ts:124 | `interface extends SceneReading { readonly frameRate?: number }` | `SceneReading` + khung hình tuỳ chọn. |
| `BudgetMetric` | budget.ts:130 | `type = 'drawCalls' \| 'triangles' \| 'materials' \| 'graphicsMemory' \| 'frameRate'` | Mục nào của ngân sách bị vượt. |
| `BudgetWarning` | budget.ts:138 | `interface { readonly metric: BudgetMetric; readonly measured: number; readonly limit: number; readonly message: string }` | Một lần vượt ngân sách, kèm câu tiếng Việt. |
| `checkBudget` | budget.ts:219 | `(reading: BudgetReading, profile: DeviceProfile = 'desktop') => readonly BudgetWarning[]` | Không bao giờ throw. Mảng rỗng = trong ngân sách. |
| `isWithinBudget` | budget.ts:257 | `(reading: BudgetReading, profile: DeviceProfile = 'desktop') => boolean` | `checkBudget(...).length === 0`. |
| `detectDeviceProfile` | budget.ts:269 | `() => DeviceProfile` | Đọc `matchMedia('(pointer: coarse)')` + `navigator.maxTouchPoints`; ngoài trình duyệt trả `'desktop'` (sàn khắt khe hơn, tránh bỏ lọt hồi quy). |
| `MaterialKey` | budget.ts:301 | `type = (material: Material) => string` | Hàm quyết định hai vật liệu là "một". |
| `tokenMaterialKey` | budget.ts:332 | `(material: Material) => string` | Đếm vật liệu theo tên/token thay vì theo object identity — dùng để đo scene VỪA DỰNG XONG, CHƯA TÔ MÀU (mặc định `MeshBasicMaterial` mới trên mỗi mesh sẽ đếm sai nếu không dùng key này). |
| `MeasureSceneOptions` | budget.ts:337 | `interface { readonly materialKey?: MaterialKey }` | Tuỳ chọn cho `measureScene`. |
| `measureScene` | budget.ts:471 | `(root: Object3D, options: MeasureSceneOptions = {}) => SceneReading` | Đi qua scene, đếm draw call/tam giác/vật liệu, **ước lượng** bộ nhớ đồ hoạ (tổng byte buffer + texture, cộng 1/3 cho mipmap). Bỏ qua object ẩn (`visible === false`). Không render gì, chạy được không cần WebGL context (test dùng cái này). |
| `RenderInfoLike` | budget.ts:546 | `interface { readonly render: { readonly calls: number; readonly triangles: number }; readonly programs?: { readonly length: number } \| null }` | Phần tối thiểu của `WebGLRenderer.info` cần đọc. |
| `readRenderInfo` | budget.ts:566 | `(info: RenderInfoLike, graphicsMemoryMb: number) => SceneReading` | Đọc số thật renderer vừa vẽ (sau frustum culling); bộ nhớ vẫn phải lấy từ `measureScene` vì WebGL không báo. |

---

## 9. `src/lib/three/perf/dispose.ts` — dọn tài nguyên (R-05)

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `DisposeReport` | dispose.ts:142 | `interface { readonly objects: number; readonly geometries: number; readonly materials: number; readonly released: number; readonly textures: number; readonly retained: number }` | Những gì MỘT LẦN GỌI `disposeFloor` vừa giải phóng (không phải số đang sống). |
| `DisposeFloorOptions` | dispose.ts:162 | `interface { readonly materials?: MaterialCache; readonly disposeMaterials?: boolean; readonly retain?: ReadonlySet<BufferGeometry \| Material>; readonly detach?: boolean }` | Tuỳ chọn đóng một tầng. |
| `disposeFloor` | dispose.ts:215 | `(root: Object3D, options: DisposeFloorOptions = {}) => DisposeReport` | **Hàm chính R-05.** Giải phóng geometry + material + texture của cả subtree (kể cả object ẩn, kể cả các rung `LOD`), gỡ khỏi parent, `clear()` từng node. An toàn gọi hai lần. |
| `TrackedResource` | dispose.ts:326 | `type = 'geometries' \| 'materials' \| 'textures'` | Ba loại tài nguyên theo dõi được. |
| `TRACKED_RESOURCES` | dispose.ts:329 | `readonly TrackedResource[] = ['geometries', 'materials', 'textures']` | Thứ tự cố định. |
| `ResourceCounts` | dispose.ts:336 | `type = Readonly<Record<TrackedResource, number>>` | Số lượng đang sống của mỗi loại. |
| `LeakWarning` | dispose.ts:339 | `interface { readonly resource: TrackedResource; readonly counts: readonly number[]; readonly growth: number; readonly message: string }` | Một chuỗi tăng liên tục — dấu hiệu rò rỉ. |
| `ResourceLedgerOptions` | dispose.ts:349 | `interface { readonly growthLimit?: number; readonly historyLimit?: number }` | `growthLimit` mặc định 3, `historyLimit` mặc định 32. |
| `ResourceLedger` | dispose.ts:410 | `class` | Đếm tài nguyên đang sống bằng **subscription** vào sự kiện `dispose` của three (không quét lại scene). Chi tiết bên dưới. |

### `ResourceLedger` — mọi phương thức công khai

| Thành viên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| constructor | dispose.ts:424 | `(options: ResourceLedgerOptions = {})` | |
| `counts` | dispose.ts:430 | `get counts(): ResourceCounts` | **Đây là API đọc số đang sống** — `{geometries, materials, textures}`, KHÔNG PHẢI byte/MB. Xem mục (b). |
| `history` | dispose.ts:439 | `get history(): readonly ResourceCounts[]` | Các mẫu đã lấy, cũ nhất trước. |
| `track` | dispose.ts:455 | `(root: Object3D) => ResourceCounts` | Đăng ký mọi geometry/material/texture một subtree đang giữ. Gọi lại trên cùng subtree không đếm trùng. |
| `trackGeometry` | dispose.ts:470 | `(geometry: BufferGeometry) => void` | Đăng ký một geometry riêng lẻ. |
| `trackMaterial` | dispose.ts:475 | `(material: Material) => void` | Đăng ký một material + texture nó dùng. |
| `trackTexture` | dispose.ts:483 | `(texture: Texture) => void` | Đăng ký một texture riêng lẻ. |
| `sample` | dispose.ts:497 | `() => readonly LeakWarning[]` | Lấy một mẫu, báo cảnh báo edge-triggered nếu một loại tăng liên tục `growthLimit + 1` mẫu. |
| `forget` | dispose.ts:530 | `() => void` | Ngừng theo dõi tất cả, KHÔNG giải phóng gì (không phải cách đóng một tầng). |

---

## 10. `src/lib/three/perf/monitor.ts` — theo dõi khung hình + tự hạ chất lượng (R-04)

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `SAMPLE_INTERVAL_MS` | monitor.ts:69 | `number = 500` | Chu kỳ đóng cửa sổ đo. |
| `DEGRADE_WINDOW_MS` | monitor.ts:72 | `number = 3_000` | Khung hình phải thấp liên tục bao lâu mới hạ chất lượng. |
| `DEGRADE_FRAME_RATE` | monitor.ts:81 | `number = SCENE_BUDGET.minFrameRate.mobile` **= 30** | Ngưỡng kích hoạt hạ chất lượng — LUÔN LÀ 30, bất kể `profile` truyền vào là gì. Xem mục (c). |
| `ShadowQuality` | monitor.ts:90 | `type = 'soft' \| 'hard'` | Chất lượng lọc bóng đổ. |
| `shadowMapTypeFor` | monitor.ts:99 | `(quality: ShadowQuality) => ShadowMapType` | `'soft'→PCFSoftShadowMap`, `'hard'→PCFShadowMap`. |
| `coarserDetail` | monitor.ts:104 | `(detail: DetailLevel) => DetailLevel` | Rung LOD kế tiếp rẻ hơn (hoặc giữ nguyên nếu đã ở `'block'`). |
| `PerfSample` | monitor.ts:111 | `interface { readonly atMs: number; readonly durationMs: number; readonly frames: number; readonly frameRate: number; readonly drawCalls: number; readonly triangles: number; readonly materials: number; readonly graphicsMemoryMb: number; readonly drawCallsPerSecond: number; readonly trianglesPerSecond: number; readonly warnings: readonly BudgetWarning[] }` | Một cửa sổ 500 ms đã đóng. |
| `DegradeAction` | monitor.ts:135 | `interface { readonly detail: DetailLevel; readonly shadows: ShadowQuality; readonly frameRate: number; readonly belowMs: number; readonly message: string }` | Quyết định hạ chất lượng — chỉ MÔ TẢ, không tự áp dụng. |
| `PerfMonitorOptions` | monitor.ts:148 | `interface { readonly read: () => SceneReading; readonly now?: () => number; readonly profile?: DeviceProfile; readonly sampleIntervalMs?: number; readonly degradeWindowMs?: number; readonly detail?: DetailLevel; readonly onSample?: (sample: PerfSample) => void; readonly onWarning?: (warnings: readonly BudgetWarning[], sample: PerfSample) => void; readonly onDegrade?: (action: DegradeAction) => void }` | `read` bắt buộc — thường là `() => measureScene(scene)` hoặc `() => readRenderInfo(renderer.info, mb)`. |
| `PerfMonitor` | monitor.ts:212 | `class` | Đếm frame, đo mỗi 500 ms, hạ chất lượng đúng một lần khi cần. Không tự có timer — phải gọi `.frame()` từ vòng vẽ của caller. Chi tiết bên dưới. |

### `PerfMonitor` — mọi phương thức công khai

| Thành viên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| constructor | monitor.ts:237 | `(options: PerfMonitorOptions)` | |
| `lastSample` | monitor.ts:253 | `get lastSample(): PerfSample \| null` | `null` trước 500 ms đầu tiên. |
| `detail` | monitor.ts:258 | `get detail(): DetailLevel` | Rung NÊN vẽ ngay bây giờ (chỉ đọc — monitor không tự đổi LOD của renderer). |
| `shadows` | monitor.ts:263 | `get shadows(): ShadowQuality` | Chất lượng bóng NÊN dùng ngay bây giờ. |
| `isDegraded` | monitor.ts:268 | `get isDegraded(): boolean` | Đã hạ chất lượng chưa. |
| `degradeAction` | monitor.ts:273 | `get degradeAction(): DegradeAction \| null` | Quyết định đã áp dụng, hoặc `null`. |
| `frame` | monitor.ts:284 | `() => void` | Gọi mỗi khung hình, sau khi render. |
| `reset` | monitor.ts:299 | `() => void` | Quên hết, quay lại `detail` ban đầu — dùng khi đổi project/dựng lại scene. |

---

## 11. `src/lib/three/perf/materialCache.ts` — phụ trợ cho R-05 (không nằm trong danh sách bắt buộc, nhưng `disposeFloor` cần)

| Tên | path:line | Chữ ký | Mô tả |
|---|---|---|---|
| `MaterialCache` | materialCache.ts:98 | `class` | Vật liệu cấp theo khoá, đếm tham chiếu — để `disposeFloor` biết vật liệu nào được chia sẻ giữa nhiều tầng và không giải phóng nhầm. |
| `sharedMaterialCache` | materialCache.ts:248 | `const MaterialCache` | Cache dùng chung mức module, cho viewer không có lý do giữ cache riêng. |
| `PaintedKinds` | materialCache.ts:255 | `type = ReadonlyMap<BuildPartKind, Material>` | Kết quả `paintByPartKind`. |
| `paintByPartKind` | materialCache.ts:279 | `(root: Object3D, cache: MaterialCache, create: (kind: BuildPartKind) => Material) => PaintedKinds` | Tô màu cả tầng theo `BuildPartKind`, một vật liệu chung cho mỗi loại (48 tường → 1 material). |

---

## (a) R-03 có đường báo TIẾN ĐỘ PHẦN TRĂM không?

**`NOT FOUND`.**

Đọc kỹ `BuildQueue` (buildQueue.ts:241-398) và `BuildQueueOptions` (buildQueue.ts:79):
không có trường callback tiến độ nào (`onProgress`, `onJobDone`, v.v.), không có sự kiện
nào phát ra khi một job settle. `enqueue()` trả `Promise<BuildOutcome>` cho MỘT job;
`enqueueAll()` trả `Promise<readonly BuildOutcome[]>` bằng `Promise.all` — chỉ resolve khi
**tất cả** đã xong, không cho biết đã xong bao nhiêu job giữa chừng.

**Cách suy ra phần trăm mà màn phải tự làm:** gọi `enqueue()` riêng cho từng job (không
dùng `enqueueAll`), gắn `.then()` lên từng promise để tăng biến đếm `settledCount`, và tính
`settledCount / totalCount * 100`. `totalCount` lấy từ độ dài mảng `planFullBuild(model)`
trả về.

Với "dựng mô hình 4 tầng": `planFullBuild` chỉ nhận **một** `BuildFloorInput` (một tầng).
Muốn tổng số job của 4 tầng, màn phải gọi `planFullBuild` bốn lần (một lần mỗi tầng) rồi
cộng độ dài bốn mảng lại làm `totalCount`, và enqueue tất cả job của cả bốn tầng (cùng một
`BuildQueue`, vì nó chỉ khởi một worker) để đếm `settledCount` chung.

---

## (b) R-05 chứng minh không rò rỉ bằng cách nào?

**`ResourceLedger` đếm SỐ LƯỢNG object đang sống** (`geometries`/`materials`/`textures`),
đọc ra bằng getter `ledger.counts` (dispose.ts:430) → `{geometries: number, materials:
number, textures: number}`. Đây là ba số nguyên (đếm object), **KHÔNG PHẢI dung lượng
byte/MB**.

`disposeFloor(root, options)` trả về `DisposeReport` (dispose.ts:142) — nhưng đó là số
tài nguyên **vừa giải phóng trong lần gọi này** (`geometries`, `materials`, `released`,
`textures`, `retained`, `objects`), không phải số đang sống cộng dồn.

**API duy nhất cho "dung lượng GPU" bằng MB** là `measureScene(root).graphicsMemoryMb`
(budget.ts:471, field `graphicsMemoryMb` khai ở budget.ts:113) — và module tự ghi rõ đây
là **ước lượng** (tổng byte buffer đỉnh + texture, cộng 1/3 cho mipmap), không phải số
driver thật báo, vì WebGL không cung cấp số đó.

**Vậy để "in dung lượng GPU sau mỗi lần vào/ra 5 lần" như nghiệm thu đòi hỏi**, màn phải
tự lắp ba mảnh:
1. Sau mỗi lần build tầng: `ledger.track(group)` để đăng ký tài nguyên.
2. Sau mỗi lần rời màn: gọi `disposeFloor(group, { materials: cache })`.
3. Gọi `measureScene(scene).graphicsMemoryMb` (hoặc `ledger.counts` cho số object) và in
   ra sau mỗi vòng vào/ra — không có hàm nào tự làm việc này thay màn.

`ledger.sample()` (dispose.ts:497) là công cụ phát hiện rò rỉ tự động: cảnh báo khi một
loại tài nguyên tăng liên tục 3 mẫu (mặc định) mà không giảm — hữu ích để viết test nhưng
không phải là con số "dung lượng GPU" nghiệm thu yêu cầu in ra màn hình.

---

## (c) Ngưỡng của R-04 là số nào?

- `SCENE_BUDGET.minFrameRate.desktop` = **45**
- `SCENE_BUDGET.minFrameRate.mobile` = **30**
- `DEGRADE_FRAME_RATE` (monitor.ts:81) = `SCENE_BUDGET.minFrameRate.mobile` = **30**,
  **cố định**, không đổi theo `profile` truyền vào `PerfMonitor`.

**Đường hạ chất lượng, chính xác từng bước** (monitor.ts:212-407):

1. Caller tạo `new PerfMonitor({ read, profile, onDegrade, ... })` và gọi `monitor.frame()`
   sau mỗi khung hình render (không có timer nội bộ).
2. Mỗi 500 ms (`SAMPLE_INTERVAL_MS`), monitor tự đóng một cửa sổ đo: đọc `read()`, tính
   `frameRate = frames * 1000 / durationMs`, tạo `PerfSample`, gọi `onSample?.(sample)`.
3. `checkBudget` chạy trên sample đó với `profile` truyền vào — nếu có mục vượt (kể cả
   `frameRate` dưới sàn `minFrameRate[profile]`, tức 45 desktop / 30 mobile), gọi
   `onWarning?.(fresh, sample)` — **edge-triggered**, chỉ báo khi mục đó MỚI vượt, không
   báo lặp lại mỗi 500 ms trong khi vẫn đang vượt.
4. Song song, `considerDegrade` theo dõi RIÊNG một điều kiện: `sample.frameRate < 30`
   (hằng số `DEGRADE_FRAME_RATE`, không phải `minFrameRate[profile]`). Nếu đúng, bắt đầu
   (hoặc tiếp tục) đếm thời gian `lowSinceMs`. Khi khoảng thời gian liên tục dưới 30
   fps đạt ≥ 3000 ms (`DEGRADE_WINDOW_MS`), monitor:
   - tính `detail = coarserDetail(rung hiện tại)` (full→reduced→block, dừng ở block),
   - đặt `shadows = 'hard'` (luôn tắt bóng mềm, không có mức trung gian),
   - gọi `onDegrade?.(action)` — **CHỈ MỘT LẦN cho cả phiên** (`this.applied` khác `null`
     thì `considerDegrade` return sớm ở dòng đầu, không bao giờ hạ lần hai).
5. **`PerfMonitor` KHÔNG tự áp dụng gì lên three.js.** Nó chỉ đổi state nội bộ
   (`detail`, `shadows` đọc qua getter) và gọi callback. **Ai phải nghe:** caller (màn
   hình hoặc hook sở hữu renderer) — hoặc lắng nghe `onDegrade` rồi tự đổi
   `LOD.levels`/`renderer.shadowMap.type = shadowMapTypeFor(action.shadows)`, hoặc đọc
   `monitor.detail`/`monitor.shadows` mỗi khung hình và áp dụng liên tục.
6. **Màn có được tự can thiệp không:** không có API công khai nào để ép hạ chất lượng
   thủ công hay ghi đè `detail`/`shadows` từ ngoài — chỉ `reset()` để quay lại rung ban
   đầu (dùng khi đổi project). Nói cách khác, màn không được "tự ý" hạ hay nâng chất
   lượng ngoài đường mà `PerfMonitor` quyết định; A9-style, mọi thay đổi rung phải đi qua
   `onDegrade`.

---

## CẠM BẪY

1. **`mergeStatic`/`collectStatic` không tồn tại trong `src/lib/three/build/**`.** Đặc
   tả màn khai hai tên này nhưng chúng thực sự nằm ở
   `src/lib/three/present/merge.ts:175,235` — một module KHÁC, phục vụ cảnh trình diễn
   cố định (nhà mẫu ở `/login`, xem `present/assemble.ts`), làm việc trên
   `.glb` nội thất + decal, và **không có bảng range để chọn lại từng entity** (chính
   docstring của nó nói rõ: *"A presentation has no selection... a smaller tool for a
   smaller job"*). Hàm gộp lưới đúng cho `Viewer3D` (dựng từ Spatial JSON, cần chọn lại
   từng tường/phòng) là `mergeByMaterial`/`mergeGroup`/`collectMeshes` trong
   `src/lib/three/build/merge.ts`. Dùng nhầm `mergeStatic` cho một tầng dựng từ plan sẽ
   mất khả năng click-chọn một tường sau khi gộp.

2. **`planFullBuild` chỉ dựng MỘT tầng.** "Dựng mô hình 4 tầng" đòi hỏi gọi
   `planFullBuild` (hoặc chuẩn bị `BuildFloorInput`) **bốn lần**, một lần mỗi
   `BuildableLevel`, rồi enqueue gộp cả bốn danh sách job vào cùng một `BuildQueue`.
   Không có hàm "dựng cả toà nhà" cấp cao hơn.

3. **`BuildQueue.enqueueAll` không cho tiến độ giữa chừng.** Muốn phần trăm thật (mục a),
   phải tự gọi `enqueue()` cho từng job, không gọi `enqueueAll()`.

4. **`ResourceLedger.counts` là số object, không phải MB.** Nghiệm thu đòi in dung lượng
   GPU phải dùng `measureScene(...).graphicsMemoryMb` (một ước lượng, có ghi rõ trong
   docstring của `budget.ts`), không phải `ledger.counts`.

5. **`DEGRADE_FRAME_RATE` (30) khác `SCENE_BUDGET.minFrameRate[profile]`.** Một scene
   desktop chạy ở 35 fps sẽ bị `checkBudget` báo `frameRate` vượt ngân sách (dưới sàn 45)
   nhưng **KHÔNG** kích hoạt `onDegrade` (vì 35 > 30). Đừng lẫn hai ngưỡng khi viết toast
   cảnh báo hiệu năng.

6. **`PerfMonitor` không tự đổi LOD/shadow map.** Phải tự lắng nghe `onDegrade` (hoặc
   đọc `.detail`/`.shadows` mỗi khung hình) và áp dụng tay lên `LOD.levels` /
   `renderer.shadowMap.type`. Bỏ qua bước này thì monitor "hạ chất lượng" nhưng scene
   thật vẫn vẽ như cũ.

7. **`toSceneLength`/`sceneVector2`/`scenePoint` là điểm quy đổi mm→m DUY NHẤT.** Không
   viết phép chia `/1000` nào khác trong màn — nếu Spatial JSON đưa thẳng toạ độ vào
   three.js mà không qua các hàm này thì trục sẽ sai đơn vị.

8. **`buildFloorMesh`/`buildWallMesh`/`toMesh` không gán vật liệu.** Bắt buộc phải tự tô
   màu (qua `paintByPartKind` + token màu) trước khi đo bằng `measureScene`, nếu không
   `measureScene` mặc định đếm theo object identity sẽ báo hàng chục vật liệu giả (một
   `MeshBasicMaterial` mới cho mỗi mesh) — vượt `SCENE_BUDGET.maxMaterials` (40) ngay cả
   khi scene chưa hề tô màu. Dùng `tokenMaterialKey` nếu cần đo TRƯỚC khi tô.

9. **`disposeFloor` không giải phóng geometry được chia sẻ nếu đã đưa vào `options.retain`
   — nhưng mặc định KHÔNG retain gì.** Nếu màn dùng `mergeByMaterial` để tạo
   `InstancedMesh` (chia sẻ geometry gốc) rồi đóng tầng gốc bằng `disposeFloor` mà quên
   truyền `retain`, batch instanced sẽ mất geometry đang vẽ dở.

10. **Worker chỉ sinh ra ở job đầu tiên (`BuildQueue` lazy).** Gọi `new BuildQueue()`
    trong render đầu của component không tự khởi worker; nếu component unmount trước khi
    `enqueue` lần đầu, `dispose()` vẫn an toàn (không có gì để terminate) — nhưng đừng
    hiểu nhầm "queue đã tạo" nghĩa là "worker đã chạy".

11. **`plan.ts` không nằm trong danh sách hàm màn được gọi** nhưng là nơi định nghĩa gốc
    `SLAB_THICKNESS_MM`/`OPENING_PANEL_THICKNESS_MM` mà `floor.ts` chỉ re-export — nếu
    cần đổi hằng số này phải sửa `plan.ts`, sửa ở `floor.ts` sẽ vỡ vì đó là `export {...}`
    không phải khai báo.

12. **Không có `index.ts` gộp** cho `build/` hay `perf/` — mọi import phải trỏ file cụ
    thể (`@/lib/three/build/buildQueue`, `@/lib/three/perf/monitor`, v.v.), khớp quy tắc
    "nhập theo module cụ thể" đã ghi trong `CLAUDE.md`.
