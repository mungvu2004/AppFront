# S12-L1 — Hồ sơ ba món nợ NGOÀI phạm vi sửa của màn S-12

Nhánh `mungvu2004/s12-a4-dossier`, dựng trên `master @ ae7db03`. Nguồn ba món nợ:
`docs/contracts/T8-bao-cao-tich-hop.md` mục (d), điểm 1/3/4. Nhiệm vụ này **không sửa mã**
— chỉ dựng hồ sơ để người duyệt quyết định miễn trừ R-68 hay không cho từng món.

Mọi khẳng định dưới đây đã chạy `rg` trước khi viết (R-69). Chỗ nào không tìm thấy, ghi
thẳng **KHÔNG TÌM THẤY** kèm lệnh đã chạy, không suy đoán.

---

## Món nợ 1 — Không có đường lưu tường lên máy chủ

### 1. Hiện trạng
`wallLayerReviewGateway.ts:335` (cổng thật) và `:407-408` (cổng mock có điều kiện `canPersist`)
— cả hai đường `persistWallLayer` đều trả `unsupported('persistWallLayer')`
(`unsupported()` định nghĩa tại `wallLayerReviewGateway.ts:172-178`). Màn dùng
"hệ tự lưu thứ 2" (`createAutosave` + `useSaveIndicator`), có trạng thái
`failed`/`offline` để NÓI RA sự thật này thay vì bịa một lượt lưu đã xong
(`useWallLayerReview.ts:51-68`, đặc biệt dòng 63: *"`persistWallLayer` hôm nay chưa có
endpoint"*). Mọi thay đổi tường chỉ sống trong store + ngăn xếp hoàn tác 100 bước
(`WallLayerReview.container.tsx:46-54`).

### 2. Vì sao màn không tự trả được
`persistWallLayer` gọi `ENDPOINTS.spatial.floor` qua `PatchSpatialFloorInput.body:
Partial<FloorWriteBody>` — nhưng `FloorWriteBody` (`src/api/client.ts:87-92`) chỉ kế thừa
`name`/`order`/`elevationMm`/`heightMm`/`drawings` từ `FloorPayload`
(`src/api/contracts.ts:87-94`), không có trường mảng tường nào. `ENDPOINTS.spatial`
(`src/api/endpoints.ts:76-81`) chỉ có `.floor` và `.version`, không có `.walls`. Sửa hai
điều này bắt buộc chạm `src/api/**` — nằm ngoài ba nhóm R-68 cho phép
(`LUAT_MAN_HINH.md:190-194`). Gateway của màn đã tự ghi nhận đúng lý do này tại
`wallLayerReviewGateway.ts:37-47`.

### 3. Thứ còn thiếu ở tầng logic
- `src/api/contracts.ts` — một kiểu wire cho đồ thị tường, ví dụ
  `WallGraphWirePayload` (mảng bản ghi tường: id, centreline hai điểm, thicknessMm,
  heightMm, kind, reviewed), cộng hàm `toWallGraphWirePayload` cùng khuôn
  `toFloorWirePayload` (`contracts.ts:169-176`).
- `src/api/client.ts:87-92` — `FloorWriteBody` cần thêm trường tuỳ chọn (`walls?:
  WallGraphWirePayload`) HOẶC một kiểu input riêng (ví dụ `PatchSpatialWallsInput { body:
  WallGraphWirePayload; floorId: string; projectId: string } extends
  WriteRequestOptions`) nếu backend muốn tách khỏi PATCH floor.
- `src/api/endpoints.ts:76-81` — một hàm địa chỉ mới trong khối `spatial`, ví dụ
  `spatial.walls: (projectId, floorId) => \`${PROJECTS_ROOT}/${projectId}/floors/${floorId}/spatial/walls\``.
  **KHÔNG TÌM THẤY** xác nhận từ backend về việc tường đi chung PATCH `.floor` hay có
  endpoint riêng — đây là quyết định thiết kế, không phải khoảng trống có thể đoán.
- `src/api/client.ts:234` (`ApiClient.patchFloor`) hoặc một phương thức chị em mới
  (`patchWalls`) trên interface `ApiClient`.
- `src/lib/query/queryKeys.ts:3-14` — `QueryDomain` hiện chỉ có
  `drawing|floor|library|progress|project|quality|room|space|user|version|violation`,
  **không có `wall`**. Cần thêm `'wall'` vào union, một `wallByFloorRoot` và
  `queryKeys.wall.byFloor(floorId)`, đúng khuôn `roomByFloorRoot`/`queryKeys.room.byFloor`
  (`queryKeys.ts:58,111`).
- `src/lib/query/invalidation.ts:56-60` — `invalidationMap.editWall` hiện chỉ trả về ba
  khoá `space`/`room`/`violation`; cần thêm `queryKeys.wall.byFloor(floorId)` một khi khoá
  đó tồn tại, để một lượt lưu thật làm mới đúng cache.

`rg -n "ENDPOINTS.*walls|spatial.*walls" src/api` → **KHÔNG TÌM THẤY** (rỗng).
`rg -n "'wall'" src/lib/query/queryKeys.ts` → **KHÔNG TÌM THẤY** (rỗng, domain không có).

### 4. Thay đổi tối thiểu
| File | Sửa gì | Ước lượng |
|---|---|---|
| `src/api/contracts.ts` | Kiểu wire tường + hàm map | ~15-20 dòng |
| `src/api/client.ts` | Mở rộng `FloorWriteBody` hoặc thêm input riêng + phương thức `ApiClient` | ~8-12 dòng |
| `src/api/endpoints.ts` | Một hàm địa chỉ | ~2 dòng |
| `src/lib/query/queryKeys.ts` | Thêm `'wall'` vào `QueryDomain`, một root, một factory | ~5 dòng |
| `src/lib/query/invalidation.ts` | Thêm một khoá vào mảng `editWall` | ~1-2 dòng |

Cộng: **~5 file, ~30-40 dòng ngoài phạm vi màn.** Trong màn, `wallLayerReviewGateway.ts`
tự sửa `persistWallLayer` để gọi API thật thay vì trả `unsupported` — phần này VẪN nằm
trong `src/screens/qc/WallLayerReview/**`, được phép.

**Cắm vào `createOptimisticMutation`/`queryKeys` sẵn có như thế nào:** không cần dựng
tầng thứ hai (R-64). `createOptimisticMutation` (`src/lib/mutations/createOptimisticMutation.ts:67-75`)
nhận một `OptimisticMutationConfig` với đúng sáu trường (`affectedKeys`, `afterSuccess`,
`applyOptimistic`, `callServer`, `entityId`, `rollback` — `createOptimisticMutation.ts:8-21`)
— không trường nào cần đổi chữ ký. Việc còn lại của lô-gic nhóm T chỉ là cấp cho hook của
màn một `affectedKeys: () => [queryKeys.wall.byFloor(floorId)]` và một `callServer` gọi
`apiClient.patchWalls(...)`; hook `useWallLayerReview.ts` tự lắp `useMutation(createOptimisticMutation(...))`
— việc lắp đó nằm trong màn, được phép.

### 5. Đụng ai
`FloorWriteBody`/`PatchSpatialFloorInput` KHÔNG chỉ mình S-12 dùng:
- `src/api/__mocks__/client.ts:242` (`applyFloorBody`) — phải cập nhật nếu thêm trường.
- `src/screens/pipeline/ScaleCalibration/scaleCalibrationGateway.ts:38-41` — màn Hiệu
  chỉnh tỷ lệ đã ghi nhận **cùng một khoảng trống** cho việc lưu tỷ lệ ("`FloorWriteBody`
  không có trường tỷ lệ nào, và không endpoint nào nhận nó"). Một lượt sửa `FloorWriteBody`
  nên tính luôn nhu cầu của màn kia, tránh hai lượt vá trùng lặp.
- `invalidationMap.editWall` hiện chỉ một nơi gọi: `useWallLayerReview.ts:667`
  (`rg -n "'editWall'" src/` xác nhận). Thêm một khoá vào mảng trả về của nó không phá
  nơi gọi khác vì không nơi nào khác gọi `'editWall'` qua `applyInvalidation` — các kết quả
  khác của `rg` (`invalidation.test.ts`, `coalesce.test.ts`, `undoTicket.test.ts`) chỉ
  dùng chuỗi `'editWall'` làm nhãn loại thông báo hoàn tác, một khái niệm khác, không gọi
  hàm này.

### 6. Nhóm prompt logic đề xuất
**Nhóm T** (theo đúng tiền lệ đã ghi tại `T8-bao-cao-tich-hop.md:219`: *"Cần một lượt
lô-gic nhóm T để thêm đường lưu tường"*) — một prompt kiểu "T-xx: endpoint lưu đồ thị
tường", gộp luôn khoảng trống tương tự của `ScaleCalibration` nếu người duyệt đồng ý.

---

## Món nợ 2 — MiniMap lái được bằng chuột, chưa lái được bằng bàn phím

### 1. Hiện trạng
`src/components/canvas/MiniMap.tsx:90-97` — `<div role="button" tabIndex={0}>` có
`onKeyDown` bắt đúng `Enter`/`Space`, gọi `e.preventDefault()`, nhưng nhánh thân rỗng
(chỉ một dòng chú thích `// Nhảy về trung tâm`, không một lệnh nào). Hook đứng sau nó,
`src/hooks/useMiniMap.ts:32-118`, có `jumpTo` nội bộ (dòng 57-73) chỉ được gọi từ
`handlePointerDown`/`handleClick` (chuột) — không có hàm nào trong `MiniMapState`
(`useMiniMap.ts:10-22`) mà bàn phím gọi được.

### 2. Vì sao màn không tự trả được
`MiniMap.tsx` và `useMiniMap.ts` nằm ở `src/components/canvas/**` và `src/hooks/**` —
cả hai đều ngoài ba nhóm R-68 cho phép (`LUAT_MAN_HINH.md:190-194`). Đây là component
dùng chung, không phải của riêng màn S-12.

### 3. Thứ còn thiếu ở tầng logic
- `src/hooks/useMiniMap.ts` — `MiniMapState` (dòng 10-22) cần thêm một hàm, ví dụ
  `jumpToCentre: () => void`, gọi `jumpTo` (dòng 57-73) với toạ độ tâm bản đồ
  (`mapRef.current` rộng/cao chia đôi) thay vì toạ độ con trỏ chuột. Chữ ký đề xuất:
  `readonly jumpToCentre: () => void;` thêm vào interface `MiniMapState`, trả về từ hàm
  `useMiniMap` (dòng 105-117).
- `src/components/canvas/MiniMap.tsx:37-53` — destructure thêm `jumpToCentre` từ
  `useMiniMap`, rồi tại `onKeyDown` (dòng 91-97) gọi `jumpToCentre()` thay cho thân rỗng.

`rg -n "jumpToCentre|jumpToCenter" src/` → **KHÔNG TÌM THẤY** (rỗng — hàm này chưa tồn tại
dưới bất cứ tên nào).

### 4. Thay đổi tối thiểu
| File | Sửa gì | Ước lượng |
|---|---|---|
| `src/hooks/useMiniMap.ts` | Thêm `jumpToCentre` vào `MiniMapState` + cài đặt trong hook | ~10 dòng |
| `src/components/canvas/MiniMap.tsx` | Gọi `jumpToCentre()` trong nhánh Enter/Space | ~2 dòng |

Cộng: **2 file, ~12 dòng.** Đây là món nợ nhỏ nhất trong ba món.

### 5. Đụng ai
`rg -n "<MiniMap" src/` cho ra **năm** nơi gọi:
- `src/screens/qc/WallLayerReview/WallLayerCanvas.tsx:370` — chính màn S-12, có truyền
  `initialViewport`/`onViewportChange`.
- `src/screens/pipeline/ScaleCalibration/ScaleCalibrationCanvas.tsx:442` — màn Hiệu chỉnh
  tỷ lệ, gọi `<MiniMap />` trần (không props).
- `src/screens/CanvasOverlaysDemo.tsx:120` — màn demo (một trong chín màn của
  `App.tsx`), gọi trần.
- `src/components/canvas/MiniMap.stories.tsx:18` và
  `src/components/canvas/CanvasIntegration.stories.tsx:123` — story, không phải màn.

Hai màn thật ngoài S-12 (`ScaleCalibration`, `CanvasOverlaysDemo`) đều gọi `<MiniMap />`
trần, nên sửa xong thì cả hai TỰ ĐỘNG có phím tắt này — không cần đổi gì ở phía chúng.

**Sửa có làm đỏ bài kiểm nào đang xanh không:**
`rg -n "MiniMap" src/ -g "*.test.*"` → chỉ hai file khớp: `src/hooks/useMiniMap.test.ts`
và `src/screens/qc/WallLayerReview/WallLayerReview.test.tsx`. Đọc cả hai:
`useMiniMap.test.ts` (91 dòng) chỉ kiểm giá trị khởi tạo, hover, và `handleClick`/`jumpTo`
qua chuột (dòng 6-91) — **không có phép kiểm nào gọi `onKeyDown` hay khẳng định nhánh
Enter/Space rỗng.** `WallLayerReview.test.tsx:35` chỉ nhắc "MiniMap" trong một dòng chú
thích giải thích component dùng chung, không phải một phép kiểm. Kết luận: **không bài
kiểm nào đang xanh khẳng định hành vi rỗng hiện tại; thêm `jumpToCentre` không làm đỏ gì.**

### 6. Nhóm prompt logic đề xuất
Đây không phải endpoint (T) hay phép đo (M); đề xuất **nhóm K** (bàn phím/khả năng tiếp
cận của component dùng chung) — "K-xx: MiniMap — Enter/Space nhảy về tâm khung nhìn".

---

## Món nợ 3 — Công cụ đo vẫn là `null`

### 1. Hiện trạng
`useWallLayerReview.ts:1360-1370` gán cứng `measurement: null` với chú thích *"`null` là
câu trả lời THẬT — một nhãn đo bịa ra sẽ là một số đo không ai đo (R-69)"*. Nút "đo" đã có
trên thanh công cụ (`WallLayerToolRail.tsx:50`: `{ id: 'measure', label: 'đo', icon: Ruler,
kbd: 'M', isEditTool: false }`) và bấm/gõ `M` đổi được `toolRail.activeTool` sang
`'measure'` thật (`useWallLayerReview.test.ts:640-641`), nhưng đó là TOÀN BỘ những gì hoạt
động — không cử chỉ đo nào tới được máy công cụ.

### 2. Vì sao màn không tự trả được — VÀ một phát hiện cần nêu rõ
`wallLayerHatch.ts:169-215` (chú thích đầu `WallLayerCanvasViewProps`) khẳng định
`WallLayerCanvasProps` gốc (`types.ts:297-315`) là hợp đồng đóng băng không ai còn sửa. Sự
thật xác minh được qua `rg` phức tạp hơn khẳng định "cần chạm tầng bị cấm" của nhiệm vụ:

- **Tầng logic (domain/lib) đã có đủ mọi hàm cần thiết, không thiếu gì:**
  `measureDistance(from: MeasurePoint, to: MeasurePoint): DistanceMeasurement`
  (`src/domain/measure/measure.ts:134`) đã là hàm thuần tính khoảng cách; nó là hàm mà
  chính `MEASURE_TOOL` trong `src/lib/tools/tools.ts:378-418` (đăng ký ở `TOOLS.measure`,
  `tools.ts:537`) đã gọi ở bước `complete` (dòng 406-418) để trả về
  `ToolOutcome { kind: 'measurement', measurement }` (`toolMachine.ts:240`). Quy đổi
  px→mm cũng có sẵn: `Scale.pixelsToMillimetres` (`src/domain/units/scale.ts:98,143`) —
  đúng hàm màn ĐÃ DÙNG cho `cursorLabel` của thanh trạng thái
  (`WallLayerCanvas.tsx:162-187`, `useWallLayerReview.ts:310`).
- **Cái thật sự thiếu nằm TRONG chính các file của màn**, không phải ở tầng bị R-68 chặn:
  1. `runToolEvent` (`useWallLayerReview.ts:840-867`) chỉ được gọi với
     `{ type: 'activate', tool }` (từ `activateTool`, dòng 869-874) — **không nơi nào
     trong màn phát `{ type: 'input', ... }` hay `{ type: 'hover', ... }`**
     (`rg -n "type: 'input'|type: 'hover'" src/screens/qc/WallLayerReview/` →
     **KHÔNG TÌM THẤY**). Vì vậy KHÔNG chỉ riêng `measure` mà **`drawWall`/`splitWall`
     cũng chưa nhận được cử chỉ nào** — đây là lỗ hổng chung của cả tầng gesture, không
     phải một khiếm khuyết riêng của công cụ đo.
  2. Khi `runToolEvent` nhận một outcome khác `'selection'`, nó gọi thẳng
     `run((context) => toolOutcomeToCommand(outcome, context))` (dòng 864) —
     và `toolOutcomeToCommand` (`wallLayerReviewGateway.ts:519-540`, **một file của
     chính màn**) trả `null` cho mọi outcome không phải `kind: 'command'` (dòng 523-525),
     tức là một `outcome.kind === 'measurement'` bị ÂM THẦM BỎ, không có nhánh nào lưu nó
     vào state để hiện lên canvas.
  3. `WallLayerCanvasViewProps` (`wallLayerHatch.ts:263-322`, **một file mở rộng của
     chính màn**, đã cộng `onPointerMove`/`measurement`/`onZoomIn`/… vào hợp đồng gốc theo
     đúng khuôn "MỞ RỘNG kiểu ở file riêng" mà `types.ts` cho phép) hoàn toàn CÓ THỂ cộng
     thêm một handler bấm điểm nữa (ví dụ `onMeasurePick`) theo đúng cách bảy trường T8 đã
     thêm — không có gì trong hợp đồng "đóng băng" ngăn việc mở rộng thêm.

**Kết luận xác minh được:** khác với món nợ 1 và 2 (chắc chắn phải chạm `src/api`/`src/lib/query`
và `src/components`/`src/hooks`), món nợ 3 **KHÔNG có bằng chứng rg nào cho thấy phải
chạm `src/lib`, `src/domain`, `src/api`, `src/store`, hay `src/components`**. Toàn bộ phần
còn thiếu — nối click vào `runToolEvent`, xử lý outcome `'measurement'`, mở rộng
`WallLayerCanvasViewProps` — nằm trong `src/screens/qc/WallLayerReview/**`, tức là **trong
phạm vi R-68 vốn đã cho phép**. Đây là phát hiện ngược với tiền đề "cả ba món đều cần
miễn trừ R-68" nêu ở đầu nhiệm vụ; ghi lại đúng như `rg` cho thấy, theo đúng luật làm việc
đã yêu cầu (rg trước, khẳng định sau).

### 3. Thứ còn thiếu ở tầng logic
**Không thiếu hàm nào ở tầng logic** (domain/lib) cho một cử chỉ đo hai điểm cơ bản. Cái
thiếu là dây nối, toàn bộ trong file màn:
- `wallLayerHatch.ts` — thêm vào `WallLayerCanvasViewProps` (sau dòng 321): một handler
  bấm điểm, ví dụ `readonly onMeasurePick: (at: WallLayerPointerReading) => void;`
  (tái dùng kiểu `WallLayerPointerReading` đã có, dòng 121 của import).
- `useWallLayerReview.ts` — trong `runToolEvent` (dòng 840-867), thêm một nhánh
  `if (outcome.kind === 'measurement') { ...lưu vào state, return; }` TRƯỚC dòng 864, và
  một `useState<WallLayerMeasurementPx | null>` để giữ kết quả cho tới khi huỷ (`cancel`)
  hoặc đổi công cụ.
- `WallLayerCanvas.tsx` — trong `<svg>` (nơi đã có `onPointerMove`/`onPointerLeave`, dòng
  174-191), thêm `onClick` gọi `onMeasurePick` với đúng điểm px vừa tính bằng
  `getScreenCTM().inverse()` — cùng khuôn `handlePointerMove` (dòng 174-187), không một
  phép hình học mới nào.

### 4. Thay đổi tối thiểu
| File (đều trong `src/screens/qc/WallLayerReview/**`) | Sửa gì | Ước lượng |
|---|---|---|
| `wallLayerHatch.ts` | Thêm 1-2 trường/handler vào `WallLayerCanvasViewProps` | ~5 dòng |
| `useWallLayerReview.ts` | Nhánh xử lý outcome `'measurement'` + state giữ kết quả + build `WallLayerMeasurementPx` (gọi `scale.pixelsToMillimetres`, `formatLength` đã import sẵn dòng 99) | ~25-35 dòng |
| `WallLayerCanvas.tsx` | `onClick` trên `<svg>`, tái dùng biến đổi toạ độ đã có | ~10-15 dòng |

Cộng: **~3 file, ~40-55 dòng, toàn bộ trong phạm vi R-68 đã cho phép.** Không có dòng nào
ngoài `src/screens/qc/WallLayerReview/**`.

**Cử chỉ đo cần đúng những hàm xử lý nào trên hợp đồng canvas:** tối thiểu một cặp
`onMeasurePick` (bấm điểm đầu, rồi điểm cuối — cùng một hàm, phân biệt bằng state hiện có
`measurement === null` hay không) cộng việc TÁI DÙNG `onPointerMove` đã có (dòng 320-321
của `wallLayerHatch.ts`) làm điểm "đang di" giữa hai lần bấm — không cần thêm field
pointer-move riêng.

**`MeasurementLabel` đã nhận đủ props để hiện một số đo thật chưa?** ĐÃ ĐỦ. So khớp:
`MeasurementLabelProps` (`src/components/canvas/MeasurementLabel.tsx:9-18`: `state`,
`startPoint`, `currentPoint`, `midPoint`, `distanceFormatted`) khớp 1-1 về hình dạng với
`WallLayerMeasurementPx` (`wallLayerHatch.ts:239-246`: `state`, `startPx`, `currentPx`,
`midPx`, `distanceLabel`) — đúng cách `WallLayerCanvas.tsx:344-350` đã truyền. Không cần
sửa `MeasurementLabel.tsx` (mà cũng không được phép, nó ở `src/components/canvas/**`).

### 5. Đụng ai
Không đụng ai ngoài màn: `WallLayerCanvasViewProps`, `runToolEvent`, và `<svg>` của
`WallLayerCanvas.tsx` đều là các định danh riêng của `WallLayerReview`
(`rg -n "WallLayerCanvasViewProps|runToolEvent" src/` → chỉ khớp trong thư mục màn này).
`measureDistance`/`Scale.pixelsToMillimetres`/`MEASURE_TOOL` là hàm ĐỌC (import), không
sửa, nên không rủi ro cho nơi gọi khác của `src/lib/tools/**`.

### 6. Nhóm prompt logic đề xuất
**Không cần một prompt logic mới.** Vì toàn bộ việc còn lại nằm trong
`src/screens/qc/WallLayerReview/**`, đây là một lượt HOÀN THIỆN MÀN bình thường (cùng loại
T5-T8 đã chạy cho chính màn này), không phải một prompt nhóm M cần miễn trừ R-68. Nếu vẫn
muốn xếp hàng theo mã, gợi ý **T9** (tiếp nối đúng số của T5-T8), không phải nhóm M.

---

## Bảng tóm tắt cho người duyệt

| Món nợ | Tầng phải chạm | Rủi ro nếu miễn trừ R-68 | Rủi ro nếu để nguyên | Đề xuất |
|---|---|---|---|---|
| 1. Lưu tường lên máy chủ | `src/api/**` (contracts, client, endpoints), `src/lib/query/**` (queryKeys, invalidation) | Thay đổi `FloorWriteBody` là thay đổi hợp đồng dùng chung với `ScaleCalibration`; cần quyết định thiết kế backend (walls đi chung PATCH `.floor` hay endpoint riêng) trước khi viết, không phải việc một màn tự quyết được | Màn tiếp tục chạy trong bộ nhớ vô thời hạn — người dùng mất dữ liệu duyệt tường khi rời trang, dù có ngăn xếp hoàn tác 100 bước | **Tách thành prompt logic riêng** (nhóm T) — gộp luôn nhu cầu tương tự của `ScaleCalibration` để tránh vá hai lần |
| 2. MiniMap chưa lái được bằng bàn phím | `src/hooks/useMiniMap.ts`, `src/components/canvas/MiniMap.tsx` | Thấp: thêm đúng một hàm thuần (`jumpToCentre`) + một lời gọi; không bài kiểm xanh nào khẳng định hành vi rỗng hiện tại (đã `rg` xác nhận); 2 màn khác dùng component đều hưởng lợi, không cần sửa gì thêm | Vi phạm A12 tồn tại trong một component dùng chung bởi 3 nơi gọi (2 màn thật + 1 demo); người dùng chỉ-bàn-phím không di chuyển được bản đồ nhỏ ở cả ba nơi | **Miễn trừ R-68 ngay** — sửa nhỏ, cô lập, không rủi ro hồi quy đo được |
| 3. Công cụ đo (`measurement`) vẫn `null` | *(xác minh lại: KHÔNG tầng nào ngoài `src/screens/qc/WallLayerReview/**`)* | Không áp dụng — không cần miễn trừ vì không cần chạm tầng bị cấm | Nút "đo" trên thanh công cụ tiếp tục là nút chết (vi phạm A2) dù mọi hàm cần thiết đã có sẵn ở tầng logic | **Để nguyên, ghi nợ** — đây là việc hoàn thiện màn bình thường (nối `runToolEvent` + mở rộng `WallLayerCanvasViewProps`, toàn bộ trong phạm vi R-68 đã cho phép), không phải một khoản nợ cần miễn trừ hay một prompt logic mới |

---

## Cổng đã chạy (không sửa mã — chỉ đọc)

```
$ pnpm typecheck
> tsc --noEmit
ĐẠT — exit 0, không lỗi.

$ pnpm lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
ĐẠT — 0 lỗi, 0 cảnh báo.

$ pnpm test
 Test Files  206 passed (206)
      Tests  4266 passed (4266)
ĐẠT — 206 file / 4266 passed / 0 failed.
```

Ba con số khớp đúng yêu cầu: **206 file / 4266 passed / 0 failed.**
