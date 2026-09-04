# Hợp đồng dữ liệu, quyền và telemetry cho Viewer3D — V3

Khảo sát R-64/R-61/A11/O-01. Không sửa mã nguồn. Mọi dòng xác minh bằng `path:line`
đọc thật tại thời điểm viết. Không đoán — chỗ nào không thấy ghi `NOT FOUND`.

---

## A. Spatial JSON tới màn bằng đường nào

### Kết quả lệnh thật

```
$ rg -n "'spatial'" src/lib/query/queryKeys.ts
(không có kết quả — 'spatial' không phải một QueryDomain)
```

**`NOT FOUND` — không có khoá `queryKeys.spatial.*` nào.** `QueryDomain`
(`queryKeys.ts:3-14`) liệt đủ 11 domain: `drawing, floor, library, progress,
project, quality, room, space, user, version, violation` — không có `spatial`.

### Endpoint `ENDPOINTS.spatial.*` có tồn tại, nhưng trả về CÁI KHÁC

`ENDPOINTS.spatial.floor(projectId, floorId)` (`src/api/endpoints.ts:77-78`) và
`ENDPOINTS.spatial.version(projectId, versionId)` (`endpoints.ts:79-80`) có thật.
Nhưng `ApiClient.spatial` (`src/api/client.ts:233-237`) chỉ có ba phương thức:

| Phương thức | path:line | Chữ ký thật | Kiểu trả về |
|---|---|---|---|
| `readFloor` | `client.ts:491-496` | `(input: ReadSpatialFloorInput) => Promise<ApiResult<Floor>>` | **`Floor`** — decode qua `FloorSchema` (`client.ts:494`) |
| `patchFloor` | `client.ts:482-490` | `(input: PatchSpatialFloorInput) => Promise<ApiResult<Floor>>` | **`Floor`** |
| `readVersion` | `client.ts:497-502` | `(input: ReadSpatialVersionInput) => Promise<ApiResult<Version>>` | **`Version`** — decode qua `VersionSchema` |

`FloorSchema` **không mang tường/phòng/ô mở** — chính docblock của
`viewerShellGateway.ts:16-19,28-30` xác nhận: *"không endpoint nào trả về ba con
số ấy: `FloorSchema` không mang phòng"*. Bản mock (`src/api/__mocks__/client.ts:428`)
xác nhận cùng hình dạng: `readFloor` trả `floors.find(...) ?? makeFallbackFloor(...)`
— một `Floor` (id/name/order/elevationMm/heightMm/drawings), không phải đồ thị.

**Kết luận mục A: `NOT FOUND` theo đúng nghĩa task hỏi.** Không có endpoint/query
key nào trong `src/lib/query/**` hay `src/api/**` trả về `NormalizedSpatial`
(walls/rooms/openings) cho một dự án. `ENDPOINTS.spatial.*` là cái tên gây nhầm —
nó đọc/sửa **metadata một tầng** (`Floor`), không phải đồ thị không gian.

### Vậy `NormalizedSpatial` hiện lấy ở đâu? Toàn bộ từ fixture cục bộ, qua store

Chín màn QC (`FloorManager`, `WallLayerReview`, `RoomLabelReview`,
`ThicknessStandardization`, `ObjectLayerReview`, `DimensionOcrReview`,
`AxisGridManager`, …) đều tự nạp đồ thị bằng `setSpatial(seed, null)` hoặc
`setSpatial(loadedGraph, null)` gọi trong hook riêng của từng màn, KHÔNG qua một
lượt gọi mạng nào cho phần tường/phòng:

- `useFloorManager.ts:429,433-434`: `loadedGraph = floorListQuery.data?.graph ?? null`
  rồi `setSpatial(loadedGraph, null)`. Và `graph` trong `floorListQuery.data` đến
  từ `graph.read()` (`floorManagerGateway.ts:1206,1592`), mặc định đọc
  `useStore.getState().spatial` — nghĩa là gateway thật **đọc lại chính cái store
  nó sắp ghi vào**, có fallback về một đồ thị cục bộ khi store rỗng. Không HTTP nào
  ở giữa.
- Tám màn còn lại: `setSpatial(seed, null)` với `seed` là dữ liệu fixture của
  chính màn đó (`wallLayerReviewGateway.ts`, `roomLabelReviewGateway.ts`, …).

`viewerShellGateway.ts:37,272-284` chỉ nhận đồ thị qua tham số `readSpatial`
(closure đọc `state.spatial` từ `useStore` — xem mục B), **không tự nạp gì từ
mạng**. `createViewerShellGateway` (bản THẬT, `client.ts:272-284`) chỉ gọi API
cho MỘT việc: `readProjectName` (qua `apiClient.projects.read`).

### Hệ quả cho `Viewer3D`

Màn `Viewer3D` sắp dựng **không có đường mạng nào để tự nạp Spatial JSON của một
dự án**. Nó buộc phải đọc `NormalizedSpatial` mà một màn QC khác (hoặc luồng khác)
đã `setSpatial(...)` vào store trước đó — đúng cảnh `ViewerShellData.isPartial`
đã lường trước (`viewerShellGateway.ts:80-86`). Nếu người dùng vào thẳng
`Viewer3D` mà chưa từng mở một màn QC nào của dự án đó, `state.spatial === null`
và `readShellData()` trả `EMPTY_SHELL_DATA` (`viewerShellGateway.ts:104-109,161-164`)
— màn về trạng thái `'empty'`, không phải lỗi mạng.

---

## B. Vỏ đã lấy dữ liệu hộ chưa

### `ViewerShellGateway` — chữ ký thật

`src/screens/viewer/ViewerShell/viewerShellGateway.ts:90-95`:

```ts
export interface ViewerShellGateway {
  readonly readProjectName: (projectId: string) => Promise<string | null>;
  readonly readShellData: () => ViewerShellData;
}
```

Hai factory:

| Factory | path:line | Ai cấp |
|---|---|---|
| `createViewerShellGateway(readSpatial, apiClient = mockApiClient)` | `viewerShellGateway.ts:272-284` | **Bản thật** — `readProjectName` gọi `apiClient.projects.read`; `readShellData` gọi `shellDataOf(readSpatial())` — `readSpatial` là closure caller truyền vào (đọc `useStore`), KHÔNG phải fetch. |
| `createViewerShellFixtureGateway(spatial = VIEWER_FIXTURE_SPATIAL, projectName = ...)` | `viewerShellGateway.ts:308-316` | **Bản giả** — cả hai phương thức trả dữ liệu tĩnh, không đụng store, không đụng mạng. |

### `useViewerShell.ts` dùng bản nào — đây là phát hiện quan trọng nhất

```
useViewerShell.ts:344-346
  const gateway = useMemo(
    () => options.gateway ?? createViewerShellFixtureGateway(),
    [options.gateway],
  );
```

**Mặc định của hook là bản GIẢ, không phải bản thật.** `createViewerShellGateway`
(bản thật, nối `apiClient` + `readSpatial`) **không được import** vào
`useViewerShell.ts` — `rg -n "createViewerShellGateway\b" src/screens/viewer` chỉ
khớp định nghĩa (`viewerShellGateway.ts:272`) và không khớp lời gọi nào trong hook.
Bất kỳ ai dựng `Viewer3D` bằng cách gọi `useViewerShell({ projectId })` **không
truyền `gateway`** sẽ luôn thấy đúng bộ mẫu tĩnh 4 tầng · 14 phòng · 248,60 m²,
kể cả trên một dự án thật khác hẳn — không phải bug hiển nhiên vì `readProjectName`
(cũng từ fixture) vẫn trả một cái tên hợp lệ, chỉ là tên/đồ thị sai.

**Việc bắt buộc của `Viewer3D` (hoặc route cha):** truyền
`gateway={createViewerShellGateway(() => useStore.getState().spatial, apiClient)}`
một cách tường minh. Không có rào compile-time nào ép việc này — `options.gateway`
là optional (`useViewerShell.ts:196`).

### `spatial` — vỏ tự nạp hay nhận từ ngoài?

```
useViewerShell.ts:349-350
  const storeSpatial = useStore((state) => state.spatial);
  const spatial = options.spatial !== undefined ? options.spatial : storeSpatial;
```

**Đọc kho theo mặc định** (`useStore((state) => state.spatial)`), **KHÔNG tự fetch
gì**. `options.spatial` là lối tiêm để test/story ép một đồ thị cụ thể mà không
cần dựng `zustand` (docblock hook: *"Vắng mặt thì đọc kho"*, `useViewerShell.ts:198`).

`data` (viewmodel `roomCount`/`totalAreaM2`/`storeys`) được tính theo hai nhánh
(`useViewerShell.ts:358-359`):

```ts
const data = useMemo(
  () => (options.spatial !== undefined ? shellDataOf(spatial) : gateway.readShellData()),
  [gateway, options.spatial, spatial],
);
```

Nếu KHÔNG tiêm `options.spatial`, `data` đến từ `gateway.readShellData()` —
tức phụ thuộc gateway nào đang cắm (xem trên): fixture gateway phớt lờ store hoàn
toàn, gateway thật gọi lại đúng `shellDataOf(readSpatial())` với `readSpatial`
đọc store.

### Màn nội dung `Viewer3D` có lấy lại được dữ liệu vỏ, hay phải tự nạp lần hai?

**`Viewer3D` PHẢI TỰ ĐỌC store lần nữa (qua `useStore`), KHÔNG nhận `spatial` từ
vỏ.** `ViewerShellProps` không mang trường `spatial`/`NormalizedSpatial` nào —
kiểm bằng:

```
$ rg -n "spatial|NormalizedSpatial" src/screens/viewer/ViewerShell/viewerShellTypes.ts
(không có kết quả — 0 dòng khớp)
```

Vỏ dùng `spatial` (đọc từ store, mục trên) CHỈ để tính ba con số thanh trạng
thái (`storeysOf`, `roomCount`, `totalAreaM2`, `footprintOf` cho hộp bao camera —
`useViewerShell.ts:442-266` xem mục camera-contract.md) và để lọc/tính `state`
bảy trạng thái A11. Đồ thị đó **không đi qua `ViewerShellProps.frame` hay
`sceneActions`** xuống `renderScene` — hàm màn nội dung nhận (`options.renderScene`,
`useViewerShell.ts:206-209`) chỉ nhận `(frame, actions)`, không có `spatial`
trong chữ ký đó (xác nhận bằng đọc `viewerShellTypes.ts`, 0 khớp trên).

**Đây KHÔNG phải nạp hai lần theo nghĩa hai lượt HTTP** (vì như mục A đã nói,
không có lượt HTTP nào cho tường/phòng ở cả hai chỗ) — nhưng **đúng một lỗi
thiết kế "đọc store hai lần độc lập"**: `Viewer3D` phải tự gọi
`useStore((state) => state.spatial)` (hoặc tương đương) THAY VÌ nhận lại đúng
`NormalizedSpatial` mà vỏ vừa đọc để tính `ViewerShellData`. Hai lượt đọc cùng
một field store trong cùng một cây React không đắt (không phải hai request), nhưng
là hai nguồn sự thật tách rời: nếu sau này `Viewer3D` nhận `spatial` qua props
tiêm được (như `options.spatial` của vỏ) mà vỏ và màn nội dung tiêm hai giá trị
khác nhau, chúng lệch nhau ngay lập tức. Kết luận cho người dựng `Viewer3D`:
đọc `state.spatial` **một lần duy nhất** ở tầng cao nhất (route hoặc chính
`Viewer3D`), truyền xuống cả `useViewerShell({ spatial })` lẫn hàm dựng
`BuildFloorInput` (mục C) bằng cùng một giá trị — không để mỗi bên tự
`useStore` độc lập.

---

## C. Từ Spatial JSON sang `BuildFloorInput`

### `NOT FOUND` — không có hàm chuyển đổi nào

```
$ rg -n "buildFloorInput|toBuildFloor|floorInputOf" src
(không có kết quả)
```

Không có hàm nào trong `src/domain/**` hay `src/lib/**` nhận `NormalizedSpatial`
(hoặc một phần của nó) và trả về `BuildFloorInput`
(`src/lib/three/build/floor.ts:101-106`, khai trong `three-contract.md` mục 1).
`useFloorLifecycle.ts:61` nhận thẳng `BuildFloorInput | null` làm tham số —
**hook đó không tự dựng nó, caller phải đưa sẵn**.

### Phép chuyển từng tầng — cái nào có sẵn, cái nào KHÔNG, và vì sao

**1. `Level` → `BuildableLevel` — GẦN NHƯ có sẵn, một cái bẫy kiểu.**

`domain/spatial/types.ts:104-117` `Level` đã có đúng ba field `BuildableLevel`
cần (`id`, `elevationMm`, `heightMm`) — nhưng **kiểu `Millimetres` của hai module
là HAI KIỂU KHÁC NHAU CÙNG TÊN**:

- `domain/spatial/types.ts:15` khai `export type Millimetres = number;` — số
  trần, không có brand.
- `domain/units/types.ts:26-34` khai `Millimetres = Quantity<'mm'> = number &
  UnitBrand<'mm'>` — **có brand**, và `BuildableLevel.elevationMm`/`heightMm`
  (`floor.ts:81-82`) dùng ĐÚNG kiểu có brand này (`floor.ts:36` import từ
  `@/domain/units/types`).

Một `number` trần (kể cả đã gán kiểu `spatial.Millimetres`) **không gán được**
cho `units.Millimetres` — TypeScript coi đây là lỗi kiểu thật (brand mismatch),
không phải cảnh báo. Người viết converter phải bọc từng giá trị qua
`millimetres(value)` (`domain/units/types.ts:84`) trước khi đưa vào
`BuildableLevel`, đúng cách `useViewerShell.ts:256-263` đã làm khi gọi
`toSceneLength(millimetres(...))`.

**2. `Room` → `BuildableRoom` — có sẵn GẦN NHƯ trọn vẹn.** `domain/spatial/types.ts:188-196`
`Room.outline: readonly Point[]` (Point = `{x,y}` số trần,
`spatial/types.ts:24-27`) khớp cấu trúc với `PointMm` (`domain/units/compare.ts:41-43`,
cũng `{x,y}` nhưng có brand `Millimetres`). `viewerShellFixture.ts` (dùng bởi
`viewerShellGateway.ts:46`) đã có sẵn `toPointMm` đúng việc "Point số trần →
PointMm có brand" — converter Room chỉ cần lấy `{id, outline: room.outline.map(toPointMm)}`,
KHÔNG cần viết công thức hình học mới (R-61 tôn trọng). `RoomId` giữa hai module
là CÙNG một kiểu (cả `floor.ts:41` và `spatial/types.ts` đều import/khai từ
`@/domain/spatial/types`), không lệch.

**3. `Wall` (đồ thị) → `Wall` (mà `floor.ts` cần) — KHÔNG có sẵn, và đây là khoảng
trống lớn nhất.** Hai kiểu **CÙNG TÊN `Wall`, HOÀN TOÀN KHÁC HÌNH DẠNG**:

| Field | `domain/spatial/types.ts:123-132` (đồ thị server) | `domain/walls/types.ts:61-70` (mà `floor.ts:101,40` cần qua `BuildFloorInput.walls`) |
|---|---|---|
| id | `WallId` | `WallId` (cùng kiểu) |
| levelId | **có** | **không có field này** |
| centreline | `Segment` (`spatial/types.ts:29-32`, `Point` số trần) | `WallCentreline` (`walls/types.ts:49-52`, `PointMm` có brand) |
| thicknessMm | `Millimetres` (spatial, không brand) | `Millimetres` (units, có brand) |
| heightMm | **có** (một số duy nhất) | **không có** |
| baseElevationMm/topElevationMm | **không có** | **có, hai số** |
| kind | `'loadBearing' \| 'partition' \| 'envelope'` (`spatial/types.ts:119`) | `'loadBearing' \| 'partition' \| 'railing' \| 'glazed'` (`walls/types.ts:37`) |
| openingIds | **có** | **không có** |

Ba khoảng trống người viết converter PHẢI tự quyết định, không hàm nào có sẵn trả
lời hộ:

- **`heightMm` (một số) → `baseElevationMm`/`topElevationMm` (hai số).** Đồ thị
  không nói tường bắt đầu từ đâu theo phương đứng — converter phải tự suy
  `baseElevationMm` từ `level.elevationMm` của tầng chứa tường và
  `topElevationMm = baseElevationMm + wall.heightMm`, giả định tường bắt đầu
  đúng cao độ sàn hoàn thiện. Đây là một quyết định nghiệp vụ (tường có thể
  không bắt đầu từ sàn — lan can, tường chắn mái), không phải phép chuyển đơn vị.
- **`kind: 'envelope'` không có đích.** `WallKind` của `domain/walls/types.ts`
  không có `'envelope'` — chỉ có `railing`/`glazed` thay cho nó. Converter phải
  tự quyết ánh xạ `'envelope'` sang một trong bốn giá trị của `WallKind` đích
  (khả năng hợp lý nhất là `'loadBearing'` cho tường bao ngoài, nhưng không dòng
  code nào xác nhận điều này — phải hỏi hoặc chọn có ghi chú rõ).
  `'railing'`/`'glazed'` (đích) không có nguồn tương ứng ở đồ thị (`'loadBearing'
  \| 'partition' \| 'envelope'`) — converter đầy đủ phải xử lý luôn chiều
  ngược: những gì đồ thị KHÔNG BAO GIỜ tạo ra ở đích.
- **Mất `openingIds` là CHỦ Ý, không phải thiếu sót của converter.**
  `BuildFloorInput.openings?: readonly Opening[]` (`floor.ts:105`) là một mảng
  RIÊNG ở cấp `BuildFloorInput`, không nằm trên từng `Wall` — `buildWallMesh`
  (`wall.ts:181`, dùng bởi `buildFloorMesh`) nhận `options.openings` lọc theo
  `wall.id` tại chỗ gọi (`BuildWallOptions.openings?`, `wall.ts:89`). Converter
  KHÔNG cần chép `openingIds` sang `Wall` đích; nó cần chuyển TOÀN BỘ
  `spatial.byKind.opening` (đã lọc theo tầng) thành mảng `Opening` top-level của
  `BuildFloorInput` — `Opening` (đồ thị, `domain/spatial/types.ts`) và `Opening`
  mà `floor.ts`/`wall.ts` dùng (`@/domain/openings/types`, `wall.ts` import) lại
  là **một cặp `Opening` cùng-tên-khác-module thứ hai** cần soát riêng, ngoài
  phạm vi khảo sát này (không đọc `domain/openings/types.ts` ở đây — cờ để
  người viết converter tự kiểm bằng `rg -n "interface Opening" src/domain`).

### Kết luận mục C

`Viewer3D` **không làm được** nếu chỉ ghép `NormalizedSpatial` thẳng vào
`BuildFloorInput` — TypeScript sẽ chặn ở biên `Millimetres` (brand) trước tiên,
và dù có ép kiểu qua thì hình học tường sẽ sai (thiếu `baseElevationMm`/
`topElevationMm`, `kind` không khớp enum). Cần một hàm converter mới (được phép
viết trong phạm vi màn `Viewer3D`, vì đây là "tính toán không nằm trong màn hình"
— mục B của CLAUDE.md nói đưa xuống hook/`src/lib`, và converter này ăn khớp quy
tắc R-61 "không tự chế công thức HÌNH HỌC" vì nó không tính hình học mới, chỉ ánh
xạ field — nhưng ba quyết định nghiệp vụ ở trên (base elevation, kind mapping,
Opening thứ hai) phải được xác nhận trước khi viết, không tự đoán).

---

## D. Vai và quyền

### `ProjectRole` khai ở đâu, bao nhiêu vai

`src/types/project.ts:1`:

```ts
export type ProjectRole = 'admin' | 'engineer' | 'viewer';
```

**Đúng ba vai.** Dùng lại nguyên bản ở `src/lib/auth/permissions.ts:3`
(`AUTH_ROLES = ['admin', 'engineer', 'viewer'] as const satisfies readonly
ProjectRole[]`).

### Vai nào bị gỡ công cụ sửa

`src/lib/auth/permissions.ts:56-76`: bảng `viewerPermissions` có toàn bộ tám
khoá quyền là `false` (`floor.upload`, `layer.edit`, `model.export`,
`project.create`, `project.settings.edit`, `share.create`; `library.manage`/
`user.manage` cũng `false` cho cả `engineer`). Cụ thể cho công cụ sửa của
`Viewer3D`: `layer.edit` — `admin: true, engineer: true, viewer: false`
(`permissions.ts:84-88`, giá trị lấy từ `adminPermissions`/`engineerPermissions`/
`viewerPermissions` khai `permissions.ts:45-76`).

**`viewer` là vai duy nhất bị gỡ công cụ sửa.** `admin` và `engineer` có cùng
quyền `layer.edit` (cả hai đều `true`).

### Trạng thái "không có quyền" của A11 lấy vai ở đâu

`useViewerShell.ts:480`:

```ts
const canEdit = can('edit', 'layer', roles === undefined ? {} : { roles });
```

`can(action, resource, ctx)` (`permissions.ts:127-141`) đọc `ctx.roles ?? []` rồi
`roles.some((role) => permissions[role] ?? false)` — **OR qua mọi vai được
truyền**, không phải vai "cao nhất" hay vai đầu tiên. `roles` đến từ
`UseViewerShellOptions.roles?: readonly ProjectRole[]` (`useViewerShell.ts:194`)
— **hook không tự đọc phiên đăng nhập nào**; caller (route hoặc `Viewer3D`) phải
tự truyền `roles` vào, nguồn danh sách vai đó nằm ngoài phạm vi khảo sát này
(không thấy trong `src/store/**` hay `src/lib/auth/**` một chỗ đọc "vai của
người dùng hiện tại trên dự án này" — có khả năng nó nằm trong
`Project.members[].role` — `src/types/project.ts:4-9` — nhưng không có hàm nào
tra từ `userId` hiện tại ra `role` của chính người đó; `rg -n "currentUserRole|
myRole" src` cho 0 kết quả — `NOT FOUND`).

Điều kiện vào trạng thái `'forbidden'` (`useViewerShell.ts:487-489`):

```ts
if (!canEdit && roles !== undefined) {
  return 'forbidden';
}
```

**`roles === undefined` KHÔNG BAO GIỜ vào `'forbidden'`** — thiếu `roles` hoàn
toàn (không truyền gì) được coi là "chưa biết vai, coi như chỉ xem được nhưng
không chặn màn", khác với "đã biết vai và vai đó là `viewer`" (chặn). Đây là một
điểm caller phải cố ý: quên truyền `roles` không tạo ra trạng thái `forbidden`
dù người dùng thực sự là `viewer` — nó chỉ ẩn công cụ sửa
(`tools` lọc `!tool.requiresEdit || state !== 'forbidden'`, `useViewerShell.ts:506-512`,
nhưng vì `state` không phải `'forbidden'` nên **filter này không lọc gì cả khi
quên truyền `roles`** — mọi công cụ, kể cả `requiresEdit: true`, vẫn hiện).

### `EDITING_ROLES` — một nguồn thứ hai cùng nội dung, KHÔNG được `useViewerShell.ts` dùng

`viewerShellGateway.ts:319`:

```ts
export const EDITING_ROLES: readonly ProjectRole[] = Object.freeze(['admin', 'engineer']);
```

Hằng số này **không được import bởi `useViewerShell.ts`** (`rg -n
"EDITING_ROLES" src/screens/viewer` chỉ khớp định nghĩa, không khớp lời gọi nào
khác trong `ViewerShell/`) — quyền sửa thật sự được quyết định hoàn toàn qua
`can('edit', 'layer', …)` ở mục trên. `EDITING_ROLES` là dữ liệu trùng, có nguy
cơ lệch nếu ai đó sau này thêm vai thứ tư vào `ProjectRole` mà chỉ sửa
`permissionMatrix` chứ quên `EDITING_ROLES` (hoặc ngược lại) — không có test nào
đối chiếu hai nguồn này với nhau (khác với `COLOR_TOKEN_NAMES` hay
`TELEMETRY_EVENT_NAMES`, vốn có test đối chiếu hai chiều theo
`selection-coloring-contract.md`).

---

## E. Telemetry O-01

**Không khảo sát lại từ đầu — `selection-coloring-contract.md` mục (a) đã trả
lời đầy đủ, xác minh lại bằng đúng lệnh gốc:**

```
$ rg -in "fps|frameRate|frame_rate" src/lib/telemetry/
(không có kết quả — 0 dòng khớp, xác nhận lại)
```

**`O-01 NOT FOUND`** — `TELEMETRY_EVENT_NAMES`/`TELEMETRY_EVENT_SCHEMA`
(`src/lib/telemetry/events.ts:369-380,340-351`) có đúng 10 sự kiện, không sự
kiện nào tên fps/frameRate.

fps CÓ được đo, nhưng chỉ để hạ chất lượng render và hiển thị trạng thái —
KHÔNG chảy tới telemetry:

- `src/lib/three/perf/monitor.ts:119` — `PerfSample.frameRate: number`, tính ở
  `monitor.ts:323` (`frames * 1000 / durationMs`), lấy mẫu mỗi 500 ms
  (`SAMPLE_INTERVAL_MS`, `monitor.ts:69`).
- `src/screens/viewer/ViewerShell/useViewerShell.ts:842` — đọc `perf.frameRate`
  để hiển thị `"${fps} fps"` trên `ViewerStatusBar`. `perf` đến từ
  `UseViewerShellOptions.perf?: { frameRate, triangles } | null`
  (`useViewerShell.ts:204`) — **tiêm từ ngoài, hook không tự đo**. Người dựng
  `Viewer3D` phải tự chạy `PerfMonitor` (three-contract.md mục 10) và truyền kết
  quả vào `useViewerShell({ perf })`.

**Thêm sự kiện fps trung bình bắt buộc sửa `src/lib/telemetry/**`** (thêm shape
vào `TELEMETRY_EVENT_SCHEMA`, thêm tên vào `TELEMETRY_EVENT_NAMES`, hai bảng này
có test đối chiếu hai chiều) — thư mục đó **bị cấm sửa trong task V3** (mục 3 của
đặc tả gốc: `KHÔNG ĐƯỢC SỬA FILE NÀO: src/lib/**`). Việc "ghi fps trung bình vào
telemetry" không làm được trong phạm vi một task chỉ được sửa
`docs/notes/viewer3d/**` hay chỉ được sửa `src/screens/viewer/**` — phải giao
cho một task có quyền sửa `src/lib/telemetry/**`, giống kết luận đã chốt ở
`selection-coloring-contract.md` mục 16 (CẠM BẪY).

**Không có đường "rời màn" nào gọi hàm ghi fps trung bình** vì bản thân sự kiện
đó không tồn tại — câu hỏi "gọi lúc nào?" trong đặc tả (rời màn? theo chu kỳ?)
không trả lời được vì tiền đề (hàm ghi tồn tại) sai.

---

## F. Vòng đời dữ liệu khi rời màn

### R-05 (GPU) — có đường, đã khảo ở three-contract.md, không lặp lại chi tiết

`useFloorLifecycle.ts:150-153` giải phóng qua `disposeFloor` trong cleanup của
`useEffect`, ghép với build trong effect (three-contract.md mục 9). Đây là mảnh
DUY NHẤT của "rời màn" có hàm sẵn.

### Cache query (react-query) — `NOT FOUND` một hàm huỷ chuyên biệt

```
$ rg -n "cancelQueries|removeQueries" src/lib/query src/screens/viewer
(không có kết quả)
```

`src/lib/query/invalidation.ts` chỉ có `applyInvalidation` (`invalidation.ts:122-132`)
— chạy SAU một `WriteOperation` thành công (`editWall`, `moveFurniture`, …,
`invalidation.ts:5-16`), không phải khi rời màn. Không có hàm nào tên
`cancelPendingQueries`/`invalidateOnLeave`/tương tự trong `src/lib/query/**`.

**`useViewerShell.ts` không tự huỷ `projectQuery` khi unmount** — `rg -n
"useEffect.*return|cancelQueries" src/screens/viewer/ViewerShell/useViewerShell.ts`
không khớp gì ngoài các cleanup đã liệt ở phím tắt (`useViewerShell.ts:731-738`,
huỷ đăng ký `ShortcutDefinition`, không liên quan query). Hành vi thật khi rời
màn hoàn toàn phụ thuộc **`gcTime`** của react-query — vì `queryKeys.project.*`
không nằm trong `TIER_BY_DOMAIN` (`cachePolicy.ts:77-84`, chỉ có `drawing,
library, progress, room, space, user`), nó rơi về tier `'default'`:
`staleTime: 30_000`, `gcTime: 600_000` (`cachePolicy.ts:34-37`). Rời màn 10 phút
mới bị garbage-collect; trong 10 phút đó quay lại màn dùng ngay cache cũ (đúng
chủ đích của `gcTime`, không phải một lỗi).

**Vậy: R-05 dọn GPU chủ động, còn cache query để react-query tự quản theo
`gcTime` mặc định — không có, và không cần, một hàm "huỷ query đang bay" riêng
cho `Viewer3D`.** Nếu `Viewer3D` tự thêm một `useQuery` (vd. cho `readProjectName`
qua gateway thật), request đang bay khi unmount được `useQuery` của react-query
tự `AbortController` theo cơ chế built-in của thư viện — không phải thứ
`src/lib/query/**` của repo này tự viết, nên không có `path:line` nội bộ để trích.

---

## G. Cạm bẫy

1. **`Millimetres` là hai kiểu khác nhau cùng tên** — `domain/spatial/types.ts:15`
   (số trần) và `domain/units/types.ts:34` (brand `Quantity<'mm'>`). `BuildFloorInput`
   (three-contract.md) dùng brand; `NormalizedSpatial` (đồ thị server) dùng số
   trần. Gán thẳng sẽ vỡ ở biên compile, không phải lúc chạy — xem mục C.1.

2. **`Wall` là hai kiểu khác nhau cùng tên, hình dạng khác hẳn nhau** —
   `domain/spatial/types.ts:123-132` (đồ thị) vs `domain/walls/types.ts:61-70`
   (mà `BuildFloorInput.walls` cần). Không có converter — mục C.3. Nhầm lẫn hai
   `Wall` này khi viết import (`import type { Wall } from '@/domain/spatial/types'`
   thay vì `'@/domain/walls/types'`) sẽ qua được TypeScript ở nhiều chỗ vì cả hai
   type đều tồn tại hợp lệ — lỗi chỉ lộ ra khi gán cho `BuildFloorInput.walls`.

3. **`exactOptionalPropertyTypes: true`** (`tsconfig.json:19`) — mọi field
   optional trong hợp đồng của mục này (`ViewerShellData.isPartial` không optional
   nên an toàn, nhưng `UseViewerShellOptions.spatial?`, `.perf?`, `.gateway?`,
   `.forceState?`) KHÔNG được gán `undefined` tường minh khi optional — phải
   dùng spread điều kiện (`...(value !== undefined ? { key: value } : {})`)
   đúng khuôn `applyProjectBody`/`applyFloorBody`
   (`src/api/__mocks__/client.ts:230-250`) đã dùng cho `Partial<...>`, chứ không
   viết `{ spatial: maybeUndefined }` thẳng.

4. **Mặc định của `useViewerShell` là fixture gateway, không phải gateway thật**
   (`useViewerShell.ts:345`) — xem mục B. Đây là cạm bẫy nghiêm trọng nhất của
   toàn bộ hợp đồng này: viết `Viewer3D` mà không tự truyền `gateway` sẽ CHẠY
   ĐƯỢC, KHÔNG BÁO LỖI, và hiện đúng bộ mẫu 4 tầng · 14 phòng — nhìn giống hệt
   dữ liệu thật đủ để qua mắt review nhanh.

5. **`readShellData()` (đường không tiêm `options.spatial`) và
   `state.spatial` đọc trực tiếp bởi `Viewer3D` (mục B) là HAI LƯỢT ĐỌC STORE
   ĐỘC LẬP** — cùng giá trị tại một thời điểm, nhưng không có gì đảm bảo cả hai
   luôn được gọi lại đồng thời trong cùng một render nếu sau này một trong hai
   phía thêm tầng memo hoá riêng. Xem khuyến nghị ở cuối mục B.

6. **`applyInvalidation` không có `WriteOperation` nào tên liên quan `Viewer3D`**
   — `WRITE_OPERATIONS` (`invalidation.ts:5-16`) toàn thao tác chỉnh sửa 2D
   (`editWall`, `moveFurniture`, `editDimension`, …). `Viewer3D` là màn CHỈ XEM
   (mục 3 đặc tả gốc: "không tạo geometry hoặc material trong màn") — nó không
   cần và không nên gọi `applyInvalidation` cho bất kỳ thao tác nào của riêng
   nó; mọi invalidation liên quan dữ liệu nó hiển thị đến từ CÁC MÀN QC khác đã
   sửa dữ liệu trước đó.

7. **`EDITING_ROLES` (mục D) là dữ liệu song song không được dùng** — đọc nó để
   suy luận quyền thay vì gọi `can('edit', 'layer', …)` sẽ cho kết quả TRÙNG bây
   giờ (cả hai đều `['admin', 'engineer']`) nhưng không có gì buộc chúng luôn
   trùng trong tương lai.

8. **`roles === undefined` không kích hoạt `'forbidden'`** (mục D) — quên
   truyền `roles` cho `useViewerShell` không ẩn công cụ sửa, nó chỉ khiến
   `canEdit` tính ra `false` một cách vô hại mà không đổi `state`. Đây là khác
   biệt giữa "chưa biết quyền" và "biết là không có quyền" mà A11 phân biệt rõ,
   dễ gõ nhầm khi test bảy trạng thái (ép `forceState: 'forbidden'` sẽ che luôn
   nhánh này, nên test THẬT của trạng thái forbidden phải truyền `roles: ['viewer']`,
   không chỉ `forceState`).

9. **Mock trả về mảng có thể đã bị đóng băng gián tiếp qua `Object.freeze`** ở
   một số hằng (`EMPTY_STOREYS`, `EMPTY_FOOTPRINT`, `VIEWER_MISSING_CAPABILITIES`
   — tất cả `viewerShellGateway.ts:58-60,101,201-206`) — mọi giá trị "rỗng mặc
   định" trong file này đóng băng. Converter mục C nếu tái dùng các hằng này làm
   giá trị khởi tạo rồi `.push()`/mutate trực tiếp sẽ ném `TypeError` runtime
   (strict mode), không phải lỗi biên dịch.

---

## Tổng kết số liệu (bắt buộc theo mục 5.3 của task)

- **Số mục đã xác minh bằng path:line thật:** 62 dòng trích dẫn riêng biệt (đếm
  theo mỗi tham chiếu `path:line` xuất hiện trong bảy mục A–G ở trên, không đếm
  trùng cùng một trích dẫn lặp lại giữa các mục).
- **Số `NOT FOUND`:** 5 — (A) không endpoint/query key trả `NormalizedSpatial`
  cho một dự án; (C) không hàm chuyển `NormalizedSpatial` → `BuildFloorInput`;
  (D) không hàm tra "vai của người dùng hiện tại trên dự án này"
  (`currentUserRole`/`myRole`); (E) O-01 không tồn tại (đã có ở
  selection-coloring-contract.md, xác minh lại); (F) không hàm "huỷ query đang
  bay khi rời màn" chuyên biệt cho `Viewer3D`.
- **(B) Vỏ có nạp dữ liệu hộ không — một dòng:** KHÔNG với `NormalizedSpatial`
  (`ViewerShellProps` không có trường đó, `Viewer3D` phải tự `useStore` lại) và
  mặc định của `useViewerShell` còn dùng **gateway giả** trừ khi caller tự
  truyền `gateway` thật — hai lỗ hổng cộng lại là rủi ro lớn nhất của DAG này.
- **(C) Có hàm chuyển sang `BuildFloorInput` không — một dòng:** KHÔNG; `Level`
  gần dùng được ngay (chỉ cần bọc `millimetres()` qua brand), `Room` có sẵn công
  cụ phụ trợ (`toPointMm`) nên chuyển gần như trực tiếp, nhưng `Wall` cần một
  converter mới với ba quyết định nghiệp vụ chưa có câu trả lời trong kho mã
  (suy `baseElevationMm`/`topElevationMm` từ `heightMm`, ánh xạ `kind:
  'envelope'` sang `WallKind` đích, và xử lý `Opening` — một cặp kiểu
  cùng-tên-khác-module thứ hai ngoài phạm vi khảo sát này).

## Kết quả `pnpm typecheck` / `pnpm lint`

Task này CHỈ thêm một file Markdown (`docs/notes/viewer3d/data-gateway-contract.md`),
không sửa mã nguồn TypeScript nào — xem log nguyên văn ở cuối báo cáo `worker_done`.
