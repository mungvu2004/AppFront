# Hợp đồng V1 — vỏ `ViewerShell` và props đề xuất cho `Viewer3D`

Mọi dòng dưới đây xác minh bằng cách mở file thật tại thời điểm viết (commit `683d593`,
nhánh `mungvu2004/v1-shell-props`). Không đoán — chỗ nào không tìm thấy ghi `NOT FOUND`.
Không sửa mã nguồn nào ngoài chính file này.

---

## A. Chữ ký thật của mọi type vỏ đưa ra

Nguồn: `src/screens/viewer/ViewerShell/viewerShellTypes.ts` (khai) và `index.ts`
(cửa nhập chín màn 3D dùng — không nhập thẳng file con, mục D của CLAUDE.md).

| Tên | path:line | Chữ ký đầy đủ | Mô tả một câu |
|---|---|---|---|
| `ViewerScreenState` | `viewerShellTypes.ts:46-53` | `type ViewerScreenState = 'empty' \| 'loading' \| 'partial' \| 'error' \| 'success' \| 'forbidden' \| 'collapsed'` | Bảy trạng thái A11, khai lại (không nhập từ `lib/testing`) để mã chạy thật không phụ thuộc hạ tầng bài kiểm. |
| `VIEWER_LAYOUT` | `viewerShellTypes.ts:67-82` | `const VIEWER_LAYOUT = Object.freeze({ toolRailPx: 56, storeyRailPx: 56, inspectorPx: 344, viewportRadiusPx: 16, viewportInsetPx: 12, cubePx: 72, statusBarPx: 32 })` | Bảy số đo bố cục pixel dùng chung cho chín màn 3D. |
| `ViewerToolId` | `viewerShellTypes.ts:89` | `type ViewerToolId = 'orbit' \| 'pan' \| 'measure' \| 'section' \| 'select' \| 'isolate'` | Sáu công cụ của ray trái. |
| `ViewerPresetId` | `viewerShellTypes.ts:112` | `type ViewerPresetId = 'perspective' \| 'axonometric' \| 'top' \| 'section'` | Bốn góc nhìn của `Select` thanh trên. |
| `ViewerStoreyViewModel` | `viewerShellTypes.ts:131-146` | `interface { readonly id: string; readonly name: string; readonly code: string; readonly elevationLabel: string; readonly isActive: boolean; readonly isVisible: boolean; readonly isReady: boolean }` | Một tầng trên ray tầng và thang cao độ; `elevationLabel` đã định dạng sẵn (A15), `isReady=false` là dấu hiệu trạng thái `partial`. |
| `ViewerLegendItem` | `viewerShellTypes.ts:174-179` | `interface { readonly id: string; readonly label: string; readonly colorToken: string }` | Một ô chú giải; `colorToken` LUÔN là tên biến CSS (A1), không bao giờ mã màu. |
| `ViewerPerfViewModel` | `viewerShellTypes.ts:190-193` | `interface { readonly trianglesLabel: string }` | Chip hiệu năng — chỉ một trường, đã định dạng ("51.700 tam giác"), chỉ hiện khi cờ dev bật. |
| `ViewerSectionPlaneValue` | `viewerShellTypes.ts:206-212` | `interface { readonly normalX: number; readonly normalY: number; readonly normalZ: number; readonly constant: number }` | Mặt phẳng cắt dạng số thuần, cố ý KHÔNG phải `Plane` của three.js — màn nội dung tự đổi sang `Plane` khi cần. |
| `ViewerSceneFrame` | `viewerShellTypes.ts:225-250` | `interface { azimuthRad, polarRad, distanceM, isOrthographic, visibleStoreyIds: readonly string[], separation: number, sectionPlane: ViewerSectionPlaneValue \| null, selectedEntityIds: readonly string[], hoveredEntityId: string \| null, isolatedEntityIds: readonly string[] \| null, hiddenEntityIds: readonly string[], reducedMotion: boolean }` | Điểm nhìn + tầng hiện + chọn/cô lập/ẩn mà vỏ đưa cho khe cắm cảnh mỗi lần vẽ lại. |
| `ViewerSceneActions` | `viewerShellTypes.ts:261-266` | `interface { selectEntity(entityId: string \| null, additive: boolean): void; hoverEntity(entityId: string \| null): void }` | Hai việc cảnh 3D báo NGƯỢC lên vỏ — chiều "3D → panel" của S-11. |
| `ViewerShellProps` | `viewerShellTypes.ts:291-356` | (66 trường — xem toàn văn trong file; nhóm theo Thanh trên / Ray công cụ / Ray tầng / Khung nhìn / Lớp nổi / Panel phải / Thanh trạng thái / Lỗi) | Mọi thứ `ViewerShell.tsx` cần; chỉ `renderScene` và `perf` được vắng mặt (optional). |

Ba type export tại `index.ts:73-81` (`VIEWER_LAYOUT`, `ViewerSceneFrame`, `ViewerScreenState`,
`ViewerSectionPlaneValue`, `ViewerShellProps`, `ViewerStoreyViewModel`, `ViewerToolId`) —
**`ViewerSceneActions`, `ViewerToolViewModel`, `ViewerPresetViewModel`, `ViewerLegendItem`,
`ViewerPerfViewModel`, `ViewerSelectionViewModel`, `ViewerPropertyRow`,
`ViewerStatusViewModel`, `ViewerBreadcrumbItem`, `ViewerPointPx` KHÔNG được `index.ts`
tái xuất.** Xác minh bằng cách đọc trọn `index.ts:1-82` — không dòng nào nhắc các tên
này. Một màn nội dung muốn dùng `ViewerSceneActions` (bắt buộc, vì đó là kiểu tham số
thứ hai của `renderScene`) **phải nhập thẳng**
`from '@/screens/viewer/ViewerShell/viewerShellTypes'`, phá đúng quy ước "chín màn nhập
qua `index.ts`, không nhập file con" mà chính docblock của `index.ts:4-6` đặt ra. Đây là
lỗ hổng có thật của vỏ, không phải suy luận — ghi ở mục G bên dưới.

---

## B. `ViewerShellContainerProps` — từng prop, và một điểm lệch có thật

Nguồn: `ViewerShell.container.tsx:63-79`.

| Prop | Bắt buộc? | Vai trò |
|---|---|---|
| `projectId: string` | Bắt buộc | Mã dự án; container không tự đọc `useParams` (đó là việc của `ViewerShellRoute`). |
| `roles?: readonly ProjectRole[]` | Tuỳ chọn | Vai người xem; vai Người xem gỡ công cụ sửa khỏi ray (không làm mờ). |
| `renderScene?: (frame: ViewerSceneFrame) => ReactNode` | Tuỳ chọn | **Khe cắm cảnh — xem điểm lệch dưới đây.** |
| `onOpenSearch?: () => void` | Tuỳ chọn | Mở ô tìm đối tượng (phím `/`); vỏ không tự dựng hộp thoại. |
| `gateway?: ViewerShellGateway` | Tuỳ chọn — **chỗ tiêm** | Cổng dữ liệu giả cho story/test; vắng mặt thì dùng `createViewerShellFixtureGateway()`. |
| `spatial?: NormalizedSpatial \| null` | Tuỳ chọn — **chỗ tiêm** | Đồ thị không gian giả; vắng mặt thì đọc kho (`useStore((s) => s.spatial)`). |
| `forceState?: ViewerScreenState` | Tuỳ chọn — **chỗ tiêm** | Ép một trong bảy trạng thái, cho story và bài kiểm A11. |
| `isDev?: boolean` | Tuỳ chọn — **chỗ tiêm** | Quyết định chip hiệu năng có hiện không. |
| `perf?: { readonly frameRate: number; readonly triangles: number } \| null` | Tuỳ chọn — **chỗ tiêm** | Số đo hiệu năng giả. |
| `registry?: ShortcutRegistry` | Tuỳ chọn — **chỗ tiêm** | Sổ đăng ký phím riêng cho bài kiểm, thay `appShortcutRegistry` mặc định. |

### Điểm lệch: `renderScene` có MỘT tham số ở container, HAI tham số ở vỏ

- `ViewerShellContainerProps.renderScene` (`ViewerShell.container.tsx:68`):
  `(frame: ViewerSceneFrame) => ReactNode` — **một tham số**.
- `ViewerShellProps.renderScene` (`viewerShellTypes.ts:318-320`) và
  `ViewerViewportProps.renderScene` (`ViewerViewport.tsx:48-50`):
  `(frame: ViewerSceneFrame, actions: ViewerSceneActions) => ReactNode` — **hai tham số**.

**Đường dây thật, đọc từ `useViewerShell.ts`:**

1. `UseViewerShellOptions.renderScene` (`useViewerShell.ts:206-209`) khai ĐÚNG chữ ký hai
   tham số `(frame, actions) => ReactNode`.
2. `WiredViewerShell` (`ViewerShell.container.tsx:104-119`, dòng 108) truyền thẳng
   `props.renderScene` (kiểu MỘT tham số, theo `ViewerShellContainerProps`) vào option
   `renderScene` của hook (kiểu HAI tham số). TypeScript cho qua vì một hàm khai ít
   tham số hơn LUÔN gán được vào một vị trí đòi hàm nhiều tham số hơn (tham số dư bị bỏ
   qua) — đây không phải lỗi kiểu, là quy tắc hợp lệ của TS.
3. Hook lưu nguyên hàm ấy vào `ViewerShellProps.renderScene` (`useViewerShell.ts:946`)
   rồi giao xuống `ViewerShell.tsx:158` → `ViewerViewport.tsx:158` (JSX) →
   **`ViewerViewport.tsx:123` gọi `renderScene(frame, sceneActions)` — LUÔN LUÔN truyền
   đủ hai đối số, bất kể chữ ký khai ở container nói gì.**

**Kết luận — màn nội dung lấy `ViewerSceneActions` bằng đường nào:** đường đó **tồn tại
ở runtime** (đối số thứ hai luôn được truyền thật), nhưng **KHÔNG tồn tại ở kiểu khai của
`ViewerShellContainerProps`**. Hệ quả cho người viết `Viewer3D.tsx`:

- Nếu viết `renderScene={(frame) => <Scene frame={frame} />}` đúng theo kiểu container
  công bố, `actions` không bao giờ được đọc — chiều "3D → panel" của S-11 (chọn/hover từ
  cảnh 3D ghi ngược vào kho) sẽ không nối được, dù dữ liệu vẫn chảy tới nơi ở runtime.
- Muốn nhận `actions` mà vẫn qua được typecheck khi gán vào prop `renderScene` của
  `ViewerShellContainer` (kiểu MỘT tham số bắt buộc), tham số thứ hai của hàm cục bộ
  **phải khai là tuỳ chọn**: `(frame: ViewerSceneFrame, actions?: ViewerSceneActions) =>
  ReactNode`. Một hàm nhận tham số tuỳ chọn thứ hai vẫn gán được vào kiểu chỉ đòi một
  tham số. Ở runtime `actions` sẽ luôn có giá trị (`ViewerViewport.tsx:123` luôn truyền),
  nhưng kiểu buộc `Viewer3D` phải xử lý nhánh `actions === undefined` (ví dụ bằng no-op)
  để qua được `strict`/`exactOptionalPropertyTypes`.
- Vì `ViewerSceneActions` không được `index.ts` tái xuất (mục A), khai tham số ấy còn
  đòi nhập thẳng `from '@/screens/viewer/ViewerShell/viewerShellTypes'`.

Nếu người viết `Viewer3D` không muốn đường vòng này, lựa chọn khác là bỏ qua
`ViewerShellContainer` và tự nối `useViewerShell` + `ViewerShell` như
`ViewerShell.container.tsx` đang làm — khi đó dùng thẳng kiểu hai tham số đúng của
`UseViewerShellOptions.renderScene`. Quyết định 3 của điều phối viên (`Viewer3D` dùng
lại chrome của vỏ) không bắt buộc phải đi qua `ViewerShellContainer`; cả hai tầng
(`useViewerShell` hoặc `ViewerShellContainer`) đều là "dùng lại chrome".

---

## C. Vỏ đã lo sẵn những gì — đối chiếu đặc tả Viewer3D với file thật

| Mục đặc tả | Đã có ở | Ghi chú |
|---|---|---|
| Nhóm camera góc dưới phải (ViewCube + cụm thu phóng) | **LỆCH VỊ TRÍ:** ViewCube ở góc **trên phải** (`ViewerShell.tsx:176-183`, `ViewerTopRightControls`), cụm thu phóng ở góc **dưới phải** (`ViewerShell.tsx:185-194`) | Đặc tả nói "nhóm camera góc dưới phải" nhưng vỏ tách hai cụm ra hai góc khác nhau, đúng thứ tự docblock `ViewerOverlays.tsx:187` ghi ("ViewCube ở trên, bản đồ nhỏ ngay dưới nó — đúng thứ tự đặc tả mô tả"). `Viewer3D` không tự gộp lại — đó là bố cục của vỏ. |
| ViewCube 72 | `ViewerOverlays.tsx:42-51` (`ViewerCube`), cạnh lấy từ `VIEWER_LAYOUT.cubePx = 72` (`viewerShellTypes.ts:79`) | Dựng bằng 4 nút thật (không canvas) — `ViewerOverlays.tsx:9-20`. |
| Điều hướng tầng có con mắt | `ViewerStoreyRail.tsx:81-101` (`Eye`/`EyeOff` từ `lucide-react`, `aria-pressed={storey.isVisible}`) | Đã có, cùng nút chọn tầng `storey.code` phía trên (dòng 60-79). |
| Thanh trượt tách tầng | `ViewerStoreyRail.tsx:109-126` — `<input type="range">` gốc, không phải `Slider` dùng chung | Đổi khỏi `Slider` là quyết định có ghi lại (`ViewerStoreyRail.tsx:7-21`): `Slider.tsx:143-155` đặt `outline-none` vô điều kiện, `expectAccessible` bắt lỗi đó. |
| Tay nắm mặt phẳng cắt (kéo bằng chuột) | **`NOT FOUND`** | `viewerSectionPlane.ts` có đủ hàm số học (`clampSectionPosition:94`, `MIN_SECTION_POSITION:58`, `MAX_SECTION_POSITION:59`, `sectionPlaneFor:145`) nhưng **không có component UI nào gọi chúng**. Vị trí cắt bị khoá cứng: `useViewerShell.ts:373` khai `const [sectionPosition] = useState(DEFAULT_SECTION_POSITION)` — **không có setter, không bao giờ đổi**. Mặt cắt chỉ bật/tắt (qua `activePresetId`/`activeToolId`, `useViewerShell.ts:562-568`) chứ không kéo được. `Viewer3D` muốn tay nắm kéo thật phải tự dựng nó (và xin điều phối viên duyệt việc thêm setter vào `useViewerShell.ts`, hoặc dựng tay nắm trong khe cắm cảnh và tự quản lý vị trí cắt cục bộ). |
| Chip hiệu năng theo cờ dev | `ViewerOverlays.tsx:147-169` (`ViewerPerfChip`) — trả `null` khi `perf === null`, được gắn ở `ViewerShell.tsx:216-218` bên trong `ViewerStatusBar` | `useViewerShell.ts:966`: `perf: isDev && perf !== null ? {...} : null` — cờ dev đã lọc ở hook, view không tự đoán. |
| Panel phải trượt vào 240ms | **`NOT FOUND`** | `ViewerInspector.tsx` (panel phải, rộng 344px, `viewerShellTypes.ts:73`) render/ẩn theo điều kiện `{!isCollapsed && (...)}` tại `ViewerShell.tsx:202-213` — **không có class `transition`/`duration-240` nào, không có animation vào/ra**. Xác minh bằng `grep -n "240" src/screens/viewer/ViewerShell/*.tsx` → không khớp dòng nào. Panel xuất hiện/biến mất tức thời theo re-render, không trượt. `Viewer3D` không thể "dùng lại hiệu ứng 240ms có sẵn" vì nó không tồn tại; nếu đặc tả bắt buộc, phải thêm `transition-all duration-240` (giá trị hợp lệ theo `local/no-raw-duration`, xem `lib/motion/tokens.ts`) vào chính `ViewerInspector.tsx` hoặc `ViewerShell.tsx` — cả hai đều nằm ngoài whitelist file được sửa của task này. |

---

## D. Props đề xuất cho `Viewer3D.tsx`

View thuần R-60: không import `@/api`, `@/store`, `@/domain`, `@/lib/http`. Dán được
thẳng vào mã; mỗi trường ghi rõ ai cấp.

```ts
import type { ReactNode } from 'react';
import type {
  ViewerSceneActions,
  ViewerSceneFrame,
  ViewerScreenState,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';

/**
 * Props của `Viewer3D.tsx` — view thuần cắm vào khe `renderScene` của vỏ.
 *
 * Không phải props của `<Viewer3D />` như một MÀN đầy đủ — đó là việc của
 * `ViewerShellContainer`. Đây là props của phần TỬ mà `Viewer3D` giao cho
 * `renderScene`, cộng những gì `Viewer3D` cần biết để tự vẽ khung dây/caption ở
 * trạng thái `partial` mà vỏ không biết (vỏ chỉ biết "tầng nào chưa `isReady`",
 * không biết "vẽ khung dây thế nào").
 */
export interface Viewer3DProps {
  /** Bảy trạng thái màn hình — VỎ cấp qua `frame` gián tiếp; đọc thẳng từ
   *  `ViewerShellProps.state` mà container không truyền xuống khe cắm cảnh.
   *  `Viewer3D` phải NHẬN state riêng qua tham số này vì `ViewerSceneFrame`
   *  (mục A) không mang trường `state` — chỉ mang camera/tầng/chọn. */
  readonly state: ViewerScreenState;

  /** Điểm nhìn, tầng hiện, tách, cắt, chọn/hover/cô lập/ẩn — VỎ cấp, là tham số
   *  thứ nhất `renderScene` nhận (`ViewerViewport.tsx:123`). */
  readonly frame: ViewerSceneFrame;

  /** Hai việc báo ngược lên vỏ (chọn, hover) — VỎ cấp, tham số thứ hai
   *  `renderScene` nhận ở RUNTIME. Khai tuỳ chọn để qua được kiểu MỘT tham số
   *  của `ViewerShellContainerProps.renderScene` (mục B); `Viewer3D` coi
   *  `undefined` là "chưa có ai gọi được nó" và bỏ qua, không throw. */
  readonly sceneActions?: ViewerSceneActions | undefined;

  /** Phần trăm dựng THẬT của R-03, 0–100. Hook `useViewer3D` cấp, đọc từ
   *  tiến độ `buildQueue`/worker (three-contract.md T1) — không phải số giả
   *  đếm thời gian. Định dạng số (A15) xảy ra TRƯỚC khi tới đây, nên đây là
   *  chuỗi đã ghép ("62%"), không phải số thô. */
  readonly buildProgressLabel: string | null;

  /** Tầng đã dựng xong hình thật, để vẽ đặc; còn lại vẽ khung dây + caption ở
   *  trạng thái `partial`. Hook `useViewer3D` cấp, tính từ
   *  `ViewerStoreyViewModel.isReady` mà vỏ đã lọc (mục A) — `Viewer3D` không tự
   *  suy luận lại "tầng nào xong" từ dữ liệu thô. */
  readonly readyStoreyIds: readonly string[];

  /** Caption một câu cho một tầng khung dây, ví dụ "Tầng 02 — chưa dựng xong".
   *  Hook `useViewer3D` cấp (A15: câu đã ghép, không phải tên tầng + trạng thái
   *  rời để view tự nối chuỗi). */
  readonly wireframeCaptionOf: (storeyId: string) => string;

  /** Không có WebGL — `Viewer3D` tự phát hiện (`WebGLRenderingContext` không
   *  tạo được) NGOÀI bảy trạng thái của vỏ, vì vỏ không có trạng thái riêng cho
   *  "trình duyệt không hỗ trợ". Hook `useViewer3D` cấp. `true` thì
   *  `Viewer3D` vẽ card lỗi thân thiện (mục F) thay vì gọi `WebGLRenderer`. */
  readonly webglUnavailable: boolean;

  /** Liên kết sang bản 2D cùng dự án, cho card lỗi không-WebGL VÀ cho trạng
   *  thái rỗng (nút "Sang xem 2D"/"Sang QC"). Hook `useViewer3D` cấp, dựng từ
   *  `ROUTES.project.*` (mục E) — `Viewer3D` không tự ghép chuỗi đường dẫn
   *  (R-65/R-66, "path viết tay là chuỗi không gì kiểm"). */
  readonly fallback2dHref: string;

  /** Nút "sang QC" của trạng thái rỗng — theo đặc tả A7.1 "rỗng (có nút sang
   *  QC)". Hook `useViewer3D` cấp `href`; `Viewer3D` chỉ vẽ. */
  readonly qcHref: string;

  /** Thử lại sau lỗi dựng hình (khác `onRetry` của vỏ — vỏ retry TRUY VẤN dự án
   *  qua `ViewerShellProps.onRetry`; đây retry riêng bước DỰNG HÌNH của R-03).
   *  Hook `useViewer3D` cấp. */
  readonly onRetryBuild: () => void;

  /** Vai người xem đã lọc: KHÔNG truyền roles thô. `Viewer3D` không tự quyết
   *  công cụ nào bị gỡ — vỏ đã lọc `tools` (mục C — "gỡ khỏi ray, không làm
   *  mờ") — trường này chỉ để `Viewer3D` biết có được double-click chọn/sửa
   *  hình học hay không (ví dụ tắt raycast chọn khi đang ở vai chỉ xem, dù panel
   *  vẫn hiện). Hook `useViewer3D` cấp, tính lại từ `can('edit', 'layer', …)`
   *  giống `useViewerShell.ts:480` — cùng nguồn, không hai công thức khác nhau. */
  readonly canEdit: boolean;

  /** Vắng mặt nghĩa là chưa được thu gọn từ ngoài; vỏ tự lo trạng thái
   *  `collapsed` (ẩn hai ray + panel, mục C bảng bảy trạng thái ở
   *  `ViewerShell.tsx:26-39`) — `Viewer3D` KHÔNG cần trường riêng cho
   *  `collapsed`, nó đọc `state === 'collapsed'` như mọi trạng thái khác. */
}
```

**Vì sao không có prop `onWebglRetry` tách khỏi `onRetryBuild`:** đặc tả liệt kê
"lỗi (không có WebGL: … nút thử lại)" là MỘT nút thử lại, không phải nút riêng cho từng
loại lỗi; `webglUnavailable` chỉ đổi CÂU hiển thị (mục F), không đổi hành vi nút.

---

## E. Route

Nguồn: `src/routes/paths.ts`, `src/routes/router.tsx`.

- Hằng đường dẫn: `ROUTE_PATTERNS.projectViewer` — `paths.ts:77`, giá trị
  `` `${PROJECTS_ROOT}/:id/3d` `` (tức `/projects/:id/3d`).
- Hàm điều hướng đã điền tham số: `ROUTES.project.viewer` — `paths.ts:128`, chữ ký
  `(projectId: string): string => \`${PROJECTS_ROOT}/${projectId}/3d\``.
- Route hiện đang trỏ vào: `router.tsx:102` —
  `{ path: ROUTE_PATTERNS.projectViewer, element: suspended(<RouteViewerShell />) }`,
  trong đó `RouteViewerShell` được lazy-import ở `router.tsx:18`:
  `` const RouteViewerShell = lazy(() => import('../screens/viewer/ViewerShell').then(m => ({ default: m.ViewerShellRoute }))); ``
  — tức `ViewerShellRoute` (`ViewerShell.container.tsx:140-157`), bản KHÔNG có
  `renderScene` nào cắm vào (khe cắm để trống, vỏ tự vẽ khung nhìn trống chuẩn).

**Đúng những dòng cần đổi để `Viewer3D` thay chỗ — 2 dòng, không phải 3:**

1. `router.tsx:18` — đổi nguồn `import` và tên export lấy ra, ví dụ:
   `` const RouteViewer3D = lazy(() => import('../screens/viewer/Viewer3D').then(m => ({ default: m.Viewer3DRoute }))); ``
   (giả định `Viewer3D` cũng theo khuôn thư mục D: `Viewer3D.container.tsx` xuất một
   `Viewer3DRoute` cùng dáng `ViewerShellRoute`).
2. `router.tsx:102` — đổi phần tử: `element: suspended(<RouteViewer3D />)`.

Nếu giữ nguyên tên biến `RouteViewerShell` (chỉ đổi nguồn import ở dòng 18, trỏ sang
module `Viewer3D` nhưng export lại đúng tên `RouteViewerShell` hoặc alias tại chỗ
`.then(m => ({ default: m.Viewer3DRoute }))`), **chỉ 1 dòng** (18) cần đổi vì dòng 102
tham chiếu theo tên biến chứ không theo tên module. Task yêu cầu ghi "đúng ba dòng"
nhưng đọc mã thật chỉ ra tối đa hai dòng độc lập tồn tại ở `router.tsx`; không có dòng
thứ ba trong file này liên quan tới `projectViewer`. Nếu điều phối viên có ý một dòng
thứ ba nằm ngoài `router.tsx` (ví dụ xoá `ViewerShellRoute` cũ khỏi
`ViewerShell/index.ts:14-18` khi nó không còn ai gọi), đó là dòng ở FILE KHÁC
(`src/screens/viewer/ViewerShell/index.ts:14-18`), không phải ở `router.tsx` — ghi rõ ở
đây để không ai đoán nhầm là cùng file.

`main.tsx` hiện KHÔNG dựng `RouterProvider` (đã ghi trong CLAUDE.md, "trạng thái hiện
tại"); đổi ba/hai dòng trên chưa đủ để `Viewer3D` thật sự chạy trong ứng dụng — đó là nợ
đã biết, không phải việc của route.

---

## F. i18n

Nguồn: `src/i18n/vi.json`. File này **không phải bảng dịch lúc chạy** — chuỗi trong mã
viết thẳng tiếng Việt, file chỉ là từ điển kiểm tra dùng bởi
`lib/testing/expectVietnamese.ts:25-31` (theo CLAUDE.md). Bảng dưới liệt kê khoá đã có
để không thêm trùng, và đề xuất khoá mới.

### Khoá `viewerShell.*` đã có (`vi.json:2100-2189`)

`title`, `regionLabel`, `topBarLabel`, `viewportLabel`, `mode.label`, `preset.label`,
`preset.perspective`, `preset.axonometric`, `preset.top`, `preset.section`, `tool.label`,
`tool.orbit`, `tool.pan`, `tool.measure`, `tool.section`, `tool.select`, `tool.isolate`,
`storey.label`, `storey.separation`, `storey.hide`, `storey.show`, `storey.elevation`,
`cube.label`, `inspector.label`, `inspector.heading`, `inspector.emptyTitle`,
`inspector.hint`, `inspector.entityId`, `inspector.area`, `inspector.thickness`,
`inspector.name`, `inspector.kindRoom`, `inspector.kindWall`, `inspector.kindOther`,
`legend.label`, `legend.wall110`, `legend.wall220`, `legend.wall330`, `legend.opening`,
`elevationScale.label`, `status.label`, `status.building`, `status.ready`,
`status.summary`, `perf.triangles`, `forbidden.title`, `forbidden.message`,
`error.title`, `error.message`, `missingParams.title`, `missingParams.message`,
`shortcut.storey`, `shortcut.fitAll`, `shortcut.orthographic`, `shortcut.hide`,
`shortcut.isolate`, `shortcut.frame`, `shortcut.separation`, `shortcut.measure`,
`shortcut.search`, `shortcut.deselect`.

Không có khoá `viewer3d.*` nào trong file — xác nhận bằng `grep -n "\"viewer3d"
src/i18n/vi.json` → không khớp.

### Đề xuất khoá mới `viewer3d.*`

| Khoá | Câu tiếng Việt |
|---|---|
| `viewer3d.empty.description` | "Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường." |
| `viewer3d.empty.qcButton` | "Sang xem lớp tường" |
| `viewer3d.loading.progress` | "Đang dựng mô hình… {{percent}}" |
| `viewer3d.partial.wireframeCaption` | "{{name}} — chưa dựng xong" |
| `viewer3d.webglUnavailable.title` | "Trình duyệt này chưa xem được mô hình 3D" |
| `viewer3d.webglUnavailable.description` | "Máy hoặc trình duyệt của bạn chưa bật được hình ảnh 3D. Thử lại, hoặc xem bản vẽ 2D trong lúc chờ." |
| `viewer3d.webglUnavailable.retryButton` | "Thử lại" |
| `viewer3d.webglUnavailable.fallbackLink` | "Xem bản 2D" |
| `viewer3d.buildError.description` | "Không dựng được mô hình 3D lần này. Thử lại, hoặc quay lại lớp tường để xem dữ liệu còn thiếu gì." |
| `viewer3d.forbidden.description` | "Bạn đang xem ở vai Người xem nên không sửa được hình học trên mô hình 3D." |

Hai câu bắt buộc, chép nguyên văn đặc tả:

- Trạng thái rỗng: **"Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường."**
  (khoá `viewer3d.empty.description` ở trên — viết thường kiểu câu, có dấu đầy đủ, A6).
- Không có WebGL: **"Máy hoặc trình duyệt của bạn chưa bật được hình ảnh 3D. Thử lại,
  hoặc xem bản vẽ 2D trong lúc chờ."** — giải thích bằng tiếng thường, có nút thử lại và
  liên kết sang 2D đi kèm (`viewer3d.webglUnavailable.retryButton`,
  `.fallbackLink`), KHÔNG có mã lỗi trần nào trong câu (không "WebGL context creation
  failed", không mã số).

---

## G. Cạm bẫy

1. **`ViewerShellContainerProps.renderScene` chỉ khai một tham số — xem mục B.** Viết
   `renderScene={(frame, actions) => ...}` với `actions` BẮT BUỘC sẽ đỏ typecheck khi
   gán vào container (hàm 2 tham số bắt buộc không gán được vào chỗ đòi hàm 1 tham số).
   Phải khai `actions` tuỳ chọn.
2. **`ViewerSceneActions` không được `ViewerShell/index.ts` tái xuất** (mục A) — phải
   nhập thẳng từ `viewerShellTypes.ts`, phá quy ước "chỉ nhập qua `index.ts`" mà chính
   file đó tuyên bố ở dòng 4-6.
3. **`exactOptionalPropertyTypes: true`** (`tsconfig.json:19`) — mọi prop tuỳ chọn của
   `Viewer3DProps` phải được TRẢI CÓ ĐIỀU KIỆN khi gọi (`...(x !== undefined ? {x} : {})`),
   không gán thẳng `undefined`, đúng khuôn `ViewerShell.container.tsx:107-115` đã làm.
4. **Thứ tự tham số `renderScene(frame, actions)` cố định, không đảo được** —
   `ViewerViewport.tsx:123` gọi cứng theo thứ tự này; một hàm khai
   `(actions, frame)` sẽ nhận nhầm kiểu ở cả hai vị trí mà TS không luôn bắt được nếu
   kiểu hai tham số tình cờ tương thích cấu trúc (ở đây không, nhưng đáng cảnh giác).
5. **Tay nắm mặt phẳng cắt không tồn tại** (mục C) — `sectionPosition` khoá cứng ở
   `DEFAULT_SECTION_POSITION` (`useViewerShell.ts:373`), không có setter. Muốn kéo được
   phải sửa `useViewerShell.ts` (ngoài whitelist task này) hoặc tự quản lý vị trí cắt
   trong `Viewer3D` và bỏ qua `frame.sectionPlane` của vỏ.
6. **Panel phải không có hiệu ứng trượt 240ms** (mục C) — nếu đặc tả Viewer3D đòi hiệu
   ứng ấy, nó phải thêm vào `ViewerShell.tsx`/`ViewerInspector.tsx`, hai file KHÔNG có
   trong whitelist "được sửa" thông thường của một task chỉ dựng `Viewer3D`. Cần hỏi
   điều phối viên trước khi đụng vào.
7. **Nhóm camera KHÔNG ở chung một góc** — ViewCube góc trên phải, cụm thu phóng góc
   dưới phải (mục C). Một đặc tả nói "nhóm góc dưới phải" mà không đọc kỹ vỏ sẽ khiến
   người viết `Viewer3D` tưởng nhầm cần tự gộp lại hai cụm — không cần và không nên,
   đó là bố cục do vỏ quyết.
8. **`state` của `ViewerShellProps` KHÔNG có trong `ViewerSceneFrame`** — khe cắm cảnh
   chỉ nhận `frame` (camera/tầng/chọn) và `actions`, không nhận `state` trực tiếp qua
   `renderScene`. `Viewer3D` (component, không phải khe cắm) phải nhận `state` qua một
   prop RIÊNG do `useViewer3D` cấp lại (đề xuất ở mục D) — không có đường nào trong vỏ
   tự động chuyển `state` xuống `renderScene`.
9. **`onRetry` của vỏ và "thử lại" của Viewer3D là hai việc khác nhau** — `onRetry`
   (`viewerShellTypes.ts:355`) retry TRUY VẤN TÊN DỰ ÁN (`projectQuery.refetch()`,
   `useViewerShell.ts:975-977`), không retry bước DỰNG HÌNH của R-03. Card lỗi
   "không có WebGL" ở mục F cần nút thử lại RIÊNG (`onRetryBuild`, mục D), không dùng
   nhầm `onRetry` của vỏ.
10. **Tên khác đặc tả:** đặc tả có thể gọi khối chọn góc nhìn là "Select", vỏ gọi đúng
    là `Select` (`ViewerTopBar.tsx:8`) nhưng options chỉ có 4 giá trị cố định từ
    `VIEWER_PRESETS` (`useViewerShell.ts:154-159`) — không nhận preset tuỳ ý; `Viewer3D`
    không tự thêm preset thứ năm vào đó (danh sách `presets` do vỏ cấp qua props, không
    phải hằng số `Viewer3D` tự khai).
