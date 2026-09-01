# T3 — Khuôn mẫu vỏ QC (qcshell), rút ra từ `WallLayerReview`

Nguồn: `src/screens/qc/WallLayerReview/`. Đặc tả gốc của màn này ghi "21 file"; đếm
thực tế bằng `git ls-files src/screens/qc/WallLayerReview | wc -l` ra **20 file**
(**~8.695 dòng cộng dồn theo `wc -l`, xem bảng A**). Ghi rõ ở đây vì đây là con số mà
ba worker khác (ObjectLayerReview) sẽ dựa vào — họ sẽ KHÔNG mở lại thư mục này, chỉ đọc
note này.

Đây là **KHUÔN MẪU DUY NHẤT** cho màn QC thứ hai. Mọi đoạn đánh dấu "CHÉP NGUYÊN VĂN"
là copy-paste thật từ mã nguồn, không diễn giải.

---

## A. Bản đồ file

Lệnh dùng để lấy danh sách và số dòng:
`git ls-files src/screens/qc/WallLayerReview | sort` rồi `wc -l` từng file.

| File | Dòng | Trách nhiệm (một câu) | Import chính |
|---|---:|---|---|
| `index.ts` | 86 | Đường nhập ổn định — export 5 nhóm (Container/Route, view thuần, hook, cổng+mẫu, kiểu) | tái xuất từ mọi file khác trong thư mục |
| `types.ts` | 413 | Hợp đồng props ĐÓNG BĂNG (L1) — chỉ kiểu và hằng, không React | `@/domain/spatial/types`, `@/domain/units/types`, `@/lib/viewmodel/types` (đều `import type`) |
| `WallLayerReview.tsx` | 141 | View thuần — ghép ray công cụ + panel trái + canvas (slot) + thanh tra + thanh trạng thái | `@/components/feedback/Skeleton`; các sub-view cùng thư mục; `./types` |
| `WallLayerReview.container.tsx` | 279 | Container đã nối dây + `WallLayerReviewRoute` (vỏ route dùng `react-router-dom`) | `@/components/feedback/{EmptyState,InlineAlert,ScreenErrorBoundary}`, `@/hooks/useSession`, `@/routes/paths`, `@/domain/spatial/types` (type), `@/lib/input/shortcutRegistry` (type), `./WallLayerCanvas`, `./WallLayerReview`, `./useWallLayerReview`, `./wallLayerReviewGateway` (type) |
| `useWallLayerReview.ts` | 1780 | Hook — toàn bộ "suy nghĩ": query, store, dispatch/undo, tool machine, phím tắt, ghép ba nhóm props ra | `@tanstack/react-query`, `@/domain/**`, `@/hooks/{useCountUp,useNotifications,useReducedMotion,useSaveIndicator,useShortcut}`, `@/lib/{autosave,auth,errors,input,mutations,selection,query,motion,tools}`, `@/store`, `./wallLayerReviewGateway`, `./WallLayerLeftPanel` (type), `./WallLayerStatusBar` (type), `./wallLayerHatch` (type), `./WallLayerToolRail` (type), `./types` |
| `wallLayerReviewGateway.ts` | 1272 | Cổng dữ liệu + tầng lệnh + toàn bộ hàm hình học "gọi lại" (không tính mới) | `@/api/client` (type), `@/api/__mocks__/client`, `@/domain/**`, `@/lib/commands/**`, `@/lib/format/**`, `@/lib/mutations/undoTicket`, `@/lib/viewmodel/**`, `@/store`, `@/store/commit`, `./types`, `./wallLayerReviewFixture`, `./wallLayerHatch` (type) |
| `WallLayerCanvas.tsx` | 440 | View thuần — canvas SVG giữa: đa giác tường, ảnh nền, ZoomCluster, MiniMap, ContextMenu | `@/components/canvas/{ContextMenu,GridLayer,MeasurementLabel,MiniMap,SelectionHalo,ZoomCluster}`, `@/components/feedback/Skeleton`, `@/hooks/{useContextMenu,useSelectionHalo}`, `@/lib/motion`, `./WallLayerLegend`, `./WallLayerShapeFigure`, `./wallLayerHatch` |
| `wallLayerHatch.ts` | 451 | Phần phi-JSX của canvas: mở rộng `WallLayerCanvasProps`, token màu theo độ dày, mẫu gạch chéo, `toSvgPoints` | `@/components/canvas/materialMap`, `@/domain/spatial/types` (type), `@/hooks/useMeasurementLabel` (type), `./types` |
| `WallLayerInspector.tsx` | 217 | View thuần — panel phải (344px): thanh tra một tường, điều khiển độ dày ba lựa chọn | `@/components/canvas/materialMap`, `@/components/motion`, `@/components/ui/{Button,ConfidenceMeter,FieldRow,SegmentedControl}`, `@/lib/motion`, `./types` |
| `WallLayerLeftPanel.tsx` | 364 | View thuần — panel trái (280px): bộ đếm, điều hướng tầng, cây lớp, bộ lọc, danh sách | `@/components/feedback/InlineAlert`, `@/components/ui/{Button,Checkbox}`, `@/hooks/useCountUp`, `./WallLayerList`, `./types` |
| `WallLayerLegend.tsx` | 91 | View thuần — chú giải độ dày, ánh xạ bảy trạng thái màn → bốn trạng thái của component dùng chung | `@/components/canvas/WallThicknessLegend`, `./types` |
| `WallLayerList.tsx` | 300 | View thuần — danh sách 48 tường ảo hoá (`@tanstack/react-virtual`), dòng cao 40 | `@tanstack/react-virtual`, `@/components/canvas/materialMap`, `@/components/feedback/{EmptyState,Skeleton}`, `@/components/ui/{Badge,ConfidenceMeter}`, `@/lib/viewmodel/types` (type), `./types` |
| `WallLayerShapeFigure.tsx` | 142 | View thuần — một đa giác tường (4 lớp: tô, gạch chéo+chấm, tim tường, viền chọn) | `@/components/canvas/materialMap`, `./wallLayerHatch` |
| `WallLayerStatusBar.tsx` | 45 | View thuần — thanh trạng thái 32px, ĐÚNG BA MỤC, tự dựng (KHÔNG dùng `src/components/shell/StatusBar`) | không import gì ngoài React |
| `WallLayerToolRail.tsx` | 181 | View thuần — ray công cụ trái 56px: 4 công cụ + nút nối đoạn + nút thu gọn | `@/components/ui/{IconButton,Tooltip}`, lucide-react |
| `wallLayerHatch.ts` | (đã đếm ở trên) | — | — |
| `wallLayerReviewFixture.ts` | 218 | Dữ liệu mẫu tất định — 1 tầng, 48 tường, 12 đã duyệt | `@/domain/spatial/normalize`, `@/domain/spatial/types` (type), `@/domain/units/scale` |
| `wallLayerReviewScenarios.ts` | 175 | 7 kịch bản NGUYÊN LIỆU (đồ thị `Wall[]` thô, không phải viewmodel) cho `expectSevenStates` | `@/domain/spatial/types` (type), `@/lib/testing/sevenStateScenarios`, `./wallLayerReviewFixture`, `./types` (type) |
| `WallLayerReview.stories.tsx` | 202 | 7 story qua `WallLayerReviewContainer` thật + cổng giả — KHÔNG viết tay viewmodel | `@storybook/react` (type), `react-router-dom`, `@/domain/spatial/normalize`, `@/lib/testing/sevenStateScenarios`, `./WallLayerReview.container`, `./wallLayerReviewFixture`, `./wallLayerReviewGateway` |
| `WallLayerReview.test.tsx` | 644 | Test màn đầy đủ — 1 lớp render (container thật + cổng giả), 7 nghiệm thu đánh số | `@testing-library/react`, `@/lib/testing/{expectAccessible,expectNoRawColor,expectSevenStates,expectVietnamese,render,sevenStateScenarios}`, `@/routes/paths`, `@/store/selectors`, `@/store`, `./WallLayerReview.container`, `./WallLayerReview.stories`, `./wallLayerReviewFixture`, `./wallLayerReviewGateway` |
| `useWallLayerReview.test.ts` | 1254 | Test hook — không DOM của màn, `renderHook`, sổ phím thật | `@tanstack/react-query`, `@testing-library/react`, `@/lib/input/shortcutRegistry`, `@/lib/mutations/notificationBus`, `@/lib/testing/{render,sevenStateScenarios}`, `@/lib/tools/shortcuts`, `@/store/selectors`, `@/store`, `./useWallLayerReview`, `./wallLayerReviewGateway`, `./wallLayerReviewFixture`, `./wallLayerReviewScenarios`, `./types` |

**Tổng cộng: 20 file** (khớp `git ls-files`, không phải 21 như đặc tả gốc).

### Sáu file chuẩn R-59 và các file anh em

R-59 (đọc verbatim ở mục I) quy định một màn gồm ĐÚNG sáu file:
`index.ts` · `<Name>.tsx` · `use<Name>.ts` · `<Name>.container.tsx` ·
`<Name>.stories.tsx` · `<Name>.test.tsx`.

Áp vào tên thật của màn này — sáu file chuẩn là:

1. `index.ts`
2. `WallLayerReview.tsx`
3. `useWallLayerReview.ts`
4. `WallLayerReview.container.tsx`
5. `WallLayerReview.stories.tsx`
6. `WallLayerReview.test.tsx`

Mười bốn file còn lại là **file anh em được tách thêm**, hợp lệ theo mục D của
CLAUDE.md ("khi view vượt trần 400 dòng của R-22 thì phần con tách ra file anh em, và
`index.ts` giữ nguyên đường nhập") — chính `index.ts` của màn này nói thẳng điều đó ở
dòng 4-7 và dẫn tiền lệ `PipelineFailure/` (16 file):

- `types.ts` — hợp đồng props chung (không phải sub-view, nhưng cũng ngoài 6 tên chuẩn)
- `useWallLayerReview.test.ts` — bài kiểm hook riêng (test của R-59 chỉ định `<Name>.test.tsx`, tức test màn; test hook là file thêm)
- `wallLayerReviewGateway.ts` — tầng gateway/lệnh
- `wallLayerReviewFixture.ts`, `wallLayerReviewScenarios.ts` — dữ liệu mẫu và 7 kịch bản
- `WallLayerCanvas.tsx`, `wallLayerHatch.ts`, `WallLayerShapeFigure.tsx`, `WallLayerLegend.tsx` — cụm canvas
- `WallLayerInspector.tsx`, `WallLayerLeftPanel.tsx`, `WallLayerList.tsx` — cụm panel
- `WallLayerStatusBar.tsx`, `WallLayerToolRail.tsx` — hai mảnh vỏ, props khai TẠI CHỖ (không sửa `types.ts` đã đóng băng)

`index.ts` (dòng 18-23) nói rõ: KHÔNG tái xuất `WallLayerCanvas`, `WallLayerInspector`,
`WallLayerLeftPanel`, `WallLayerLegend`, `WallLayerList`, `WallLayerStatusBar`,
`WallLayerToolRail` như API màn — chúng là mảnh của MỘT view, không phải API riêng.
Nhưng hai kiểu props của chúng (`WallLayerToolRailProps`, `WallLayerStatusBarProps`) THÌ
được tái xuất, vì nơi gọi cần biết hình dạng đó khi tự dựng view từ `useWallLayerReview`.

---

## B. Luồng dữ liệu

```
WallLayerReviewRoute (đọc useParams/useSession, chỉ 1 người gọi thật của Container)
  → WallLayerReviewContainer (bọc ScreenErrorBoundary, key={projectId:floorId})
      → WiredWallLayerReview (gọi hook, tính onNavigateLayer/onNavigateFloor)
          → useWallLayerReview(options) : UseWallLayerReviewResult
              → { panel, canvas, toolRail, statusBar, leftPanel }
          → <WallLayerReview panel canvas={canvas} canvasSlot={<WallLayerCanvas {...canvas}/>}
                              toolRail statusBar leftPanel onNavigateLayer onNavigateFloor />
              (view thuần, không đụng store/domain/api/lib-http)
              → WallLayerToolRail(toolRail)
              → WallLayerLeftPanel(panel, extras=leftPanel) → WallLayerList(panel, flashingWallId, onToggleSelect)
              → canvasSlot ?? CanvasFallback(canvas)   [canvasSlot = WallLayerCanvas(canvas: WallLayerCanvasViewProps)]
                  → WallLayerLegend, WallLayerShapeFigure[] (trong SVG)
              → WallLayerInspector(panel)
              → WallLayerStatusBar(statusBar)
```

Ghi chú quan trọng: `WallLayerReview.tsx` KHÔNG import `WallLayerCanvas` trực tiếp —
`canvasSlot?: ReactNode` là một **khe ghép** vì hai view (panel/tool-rail và canvas)
được viết song song bởi hai worker khác nhau trên hai nhánh chưa gộp; import thẳng sẽ
làm `pnpm typecheck` đỏ ngay lúc viết. Container (T8, lớp gộp) là nơi DUY NHẤT ghép
`<WallLayerCanvas {...canvas} />` vào slot đó. **Đây là khuôn mà ObjectLayerReview nên
copy nếu ba worker viết panel/hook/canvas song song.**

### Chữ ký `UseWallLayerReviewOptions` (CHÉP NGUYÊN VĂN, từ `useWallLayerReview.ts:277-297`)

```typescript
export interface UseWallLayerReviewOptions {
  readonly projectId: string;
  readonly floorId: string;
  /** Tầng đang duyệt. Vắng mặt thì hook lấy tầng đầu tiên của đồ thị. */
  readonly levelId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng cổng thật, đúng một lần. */
  readonly gateway?: WallLayerReviewGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Ép thu gọn hai panel — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /**
   * Bus thông báo — chỗ toast hoàn tác của A8 đi ra.
   *
   * Bỏ trống là bus của cả phiên (`appNotificationBus`), thứ `NotificationHost`
   * ở `src/main.tsx` đang vẽ. Test và story tiêm bus riêng để hai lượt kiểm
   * không thấy thông báo của nhau — cùng khuôn `useProcessingScreen`.
   */
  readonly notifications?: NotificationBus;
}
```

### Chữ ký `UseWallLayerReviewResult` (CHÉP NGUYÊN VĂN, từ `useWallLayerReview.ts:310-317`)

```typescript
/** Đúng hợp đồng đã đóng băng, cộng bốn nhóm thoả thuận thêm với hai worker view. */
export interface UseWallLayerReviewResult extends WallLayerReviewProps {
  readonly canvas: WallLayerCanvasViewProps;
  readonly toolRail: WallLayerToolRailProps;
  readonly statusBar: WallLayerStatusBarProps;
  /** Những gì panel trái cần mà `WallLayerViewProps` (đã đóng băng) không mang. */
  readonly leftPanel: WallLayerLeftPanelExtras;
}
```

trong đó `WallLayerReviewProps` (`types.ts:397-400`, ĐÓNG BĂNG) là:

```typescript
export interface WallLayerReviewProps {
  readonly panel: WallLayerViewProps;
  readonly canvas: WallLayerCanvasProps;
}
```

Lưu ý: `UseWallLayerReviewResult.canvas` có kiểu `WallLayerCanvasViewProps` (mở rộng
của `WallLayerCanvasProps` — xem `wallLayerHatch.ts`), NÊN nó "che" trường `canvas`
gốc của `WallLayerReviewProps` bằng một kiểu rộng hơn nhưng tương thích. Đây là mẫu
"mở rộng cộng thêm" dùng xuyên suốt màn: `types.ts` đóng băng chỉ khai phần lõi, các
file khác (`wallLayerHatch.ts`, `WallLayerToolRail.tsx`, `WallLayerStatusBar.tsx`,
`WallLayerLeftPanel.tsx`) tự khai thêm phần mình cần bằng `extends`.

### Chữ ký `WallLayerReviewProps` — xem trên. `WallLayerReviewViewProps` (props thật `WallLayerReview.tsx` nhận, `WallLayerReview.tsx:64-74`, CHÉP NGUYÊN VĂN)

```typescript
export interface WallLayerReviewViewProps extends WallLayerReviewProps {
  readonly toolRail: WallLayerToolRailProps;
  readonly statusBar: WallLayerStatusBarProps;
  /** Nhóm mở rộng thứ tư: điều hướng tầng, tim tường, cờ lớp Tường, hàng đang nháy. */
  readonly leftPanel: WallLayerLeftPanelExtras;
  /** Vùng canvas thật. Vắng thì dùng dự phòng dựng từ `canvas` (xem đầu file). */
  readonly canvasSlot?: ReactNode | undefined;
  readonly onNavigateLayer?: ((layer: WallLayerOtherKind) => void) | undefined;
  /** Mở lớp tường của một tầng khác — container tra `ROUTES.project.walls`. */
  readonly onNavigateFloor?: ((floorId: string) => void) | undefined;
}
```

Vậy `WallLayerReview.tsx` nhận **bảy** trường qua props: `panel`, `canvas`, `toolRail`,
`statusBar`, `leftPanel`, `canvasSlot?`, `onNavigateLayer?`, `onNavigateFloor?` (đếm lại
là 8 kể cả hai callback tuỳ chọn). Nó không import `@/api`, `@/store`, `@/domain`,
`@/lib/http` — chỉ `@/components/feedback/Skeleton` và các sub-view/kiểu cùng thư mục
(đã xác minh bằng đọc toàn bộ import ở đầu file, xem đoạn code đã trích ở mục H).

### `WallLayerReviewContainerProps` (`WallLayerReview.container.tsx:124-138`, CHÉP NGUYÊN VĂN)

```typescript
export interface WallLayerReviewContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  /** Tầng đang duyệt. Vắng mặt thì hook lấy tầng đầu tiên của đồ thị. */
  readonly levelId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  /** Lối ra duy nhất của màn. BẮT BUỘC — xem "R-73" ở đầu file. */
  readonly onNavigate: (path: string) => void;
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng bản thật, đúng một lần. */
  readonly gateway?: WallLayerReviewGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Ép thu gọn hai panel — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}
```

`onNavigate` là **bắt buộc** (không có `?`) — đây là điểm R-73 nhấn mạnh: một callback
tối ưu không ai truyền là nút chết (A2). `WallLayerReviewRoute` cấp bản thật bằng
`useNavigate()` của `react-router-dom`.

---

## C. Tầng gateway

### Là gì, vì sao tồn tại (chép lý do từ đầu file `wallLayerReviewGateway.ts:1-48`)

`wallLayerReviewGateway.ts` là **cổng dữ liệu và tầng lệnh** của màn — "mọi lời gọi ra
khỏi màn đi qua đây". Nó theo đúng khuôn `pipelineFailureGateway.ts` và
`billingGateway.ts`: một danh sách khả năng (`WALL_LAYER_CAPABILITIES`), một bản kê nợ
endpoint (`WALL_LAYER_MISSING_ENDPOINTS`), một `interface` hình dạng cổng
(`WallLayerReviewGateway`), một factory dựng cổng thật (`createWallLayerReviewGateway`)
và một factory dựng cổng có dữ liệu cho test/story (`createMockWallLayerReviewGateway`,
R-73).

Ba lý do tồn tại, nguyên văn từ docblock đầu file:

1. **Đường ghi qua `dispatch` → `commit`** — lệnh S-07 chạy qua `dispatch` (5 bước
   `validate → apply → history → rules → sync`), và `SpatialPort.applyPatches` được
   cài bằng `commit(patches, label)` của `src/store/commit.ts`. Nhờ vậy có: rule chạy
   lại sau mỗi lệnh, ngăn xếp hoàn tác 100 bước của S-06 (không phải zundo), đồng bộ
   S-11, và không phạm A10 (không `set()`/`_applyPatches()` trực tiếp).
2. **Lệnh duyệt `wall.approve` KHÔNG có trong `WALL_COMMAND_TYPES`** — bảy lệnh S-07
   (`wallCommands.ts:98-106`) không có lệnh duyệt. Được điều phối viên duyệt cách dựng
   bằng nguyên thuỷ công khai `createCommand` + `changeForUpdate`, hợp lệ vì
   `CommandType` là `string` mở. A5 ép ngay ở kiểu dựng lệnh (xem mục dưới).
3. **Hai việc CHƯA CÓ ĐƯỜNG**: `persistWallLayer` (NOT FOUND — `FloorWriteBody` không
   có trường mảng tường) và `readWallGraph` (đồ thị sống trong `src/store`, không có
   endpoint trả nó — cổng đọc qua cửa tiêm được, mặc định chính store).

### Danh sách export đầy đủ (Grep `^export`, đối chiếu `index.ts`)

Lệnh đã chạy: `rg "^export" src/screens/qc/WallLayerReview/wallLayerReviewGateway.ts`.
Toàn bộ 60 export tìm được (tên, không kèm chữ ký đầy đủ — xem file gốc nếu cần):

`WALL_LAYER_CAPABILITIES`, `WallLayerCapability` (type), `WALL_LAYER_MISSING_CAPABILITIES`,
`WallLayerMissingCapability` (type), `WALL_LAYER_MISSING_ENDPOINTS`, `WallLayerUnsupported`
(interface), `WallLayerSupported` (interface), `WallLayerCapabilityResult` (type),
`unsupported()`, `WallLayerBackground` (interface), `WallLayerGraphPort` (interface),
`ReadBackgroundInput` (interface), `PersistWallLayerInput` (interface),
`WallLayerReviewGateway` (interface), `backgroundImageAlt()`, `wallDisplayCode()`,
`CreateWallLayerReviewGatewayOptions` (interface), `WALL_LAYER_DEFAULT_ACTOR_ID`,
`createWallLayerReviewGateway()`, `WALL_LAYER_SAMPLE_IMAGE`,
`WALL_LAYER_SAMPLE_DRAWING_WIDTH_MM`, `WALL_LAYER_SAMPLE_DRAWING_HEIGHT_MM`,
`WallLayerGatewaySeed` (interface), `createMockWallLayerReviewGateway()`,
`WALL_LAYER_SAMPLE_WALLS`, `WALL_APPROVE_COMMAND_TYPE`, `approveDescription()`,
`buildApproveWallCommand()`, `commandContextOf`, `buildChangeThicknessCommand`,
`buildSplitWallCommand`, `buildMergeWallsCommand`, `buildDeleteWallCommand`,
`buildDrawWallCommand`, `toolOutcomeToCommand()`, `createCommitSpatialPort()`,
`WallLayerDispatchDeps` (interface), `CreateWallLayerDispatchOptions` (interface),
`createWallLayerDispatchDeps()`, `runWallCommand()`, `NO_WALL_SELECTION`,
`deleteToastDescription`, `CreateWallUndoTicketOptions` (interface),
`createWallUndoTicket()`, `UNDO_WINDOW_MS` (re-export), `toGeometryWall`,
`toWallShapes()`, `canSplitWallAt`, `canMergeWalls`, (một khối `export type { ... }`
tái xuất kiểu canvas — dòng 787), `scaleOfLevel`, `toPixelPoint()`, `toMillimetrePoint()`,
`CURSOR_IDLE_LABEL`, `cursorLabelOf()`, `MIN_WALL_LAYER_ZOOM`, `MAX_WALL_LAYER_ZOOM`,
`ZOOM_STEP`, `DEFAULT_ZOOM`, `clampZoom()`, `zoomPercentOf`, `fitZoomFor()`,
`centreOfBounds`, `miniMapCentreMm()`, `boundsOfPoints()`, `unionOfBounds()`,
`toCanvasShapes()`, `drawingSizeOf()`, `legendLevelsOf`, `canvasLabelOf`,
`formatThickness`, `formatCentrelineLength`, `formatScaleLabel`, `reviewProgressLabel`,
`toMeasurementPx()`, `measurementOutcomeToPx()`, `isStandardThickness`,
`isLowConfidence`, `wallStatusCode()`, `toWallRow()`, `toWallInspector()`,
`WALL_LAYER_THICKNESS_CHOICES`.

Đối chiếu với `index.ts`: `index.ts:47-62` chỉ tái xuất một **tập con nhỏ** làm API
công khai của màn (`createMockWallLayerReviewGateway`, `createWallLayerReviewGateway`,
`backgroundImageAlt`, `CURSOR_IDLE_LABEL`, `wallDisplayCode`, `WALL_LAYER_CAPABILITIES`,
`WALL_LAYER_MISSING_CAPABILITIES`, `WALL_LAYER_MISSING_ENDPOINTS`,
`WALL_LAYER_SAMPLE_IMAGE`, `WALL_LAYER_SAMPLE_WALLS`, `WALL_LAYER_THICKNESS_CHOICES`, và
ba kiểu `WallLayerCapability`/`WallLayerGatewaySeed`/`WallLayerReviewGateway`). Phần lớn
export còn lại (các hàm hình học/định dạng/lệnh) là **API nội bộ giữa gateway và hook**,
không đi ra `index.ts` — `useWallLayerReview.ts` import chúng trực tiếp từ
`./wallLayerReviewGateway` (xem khối import dòng 131-179 của hook).

### Ranh giới gateway ↔ hook

Gateway giữ: (1) tra cứu khả năng/nợ, (2) đọc dữ liệu thô (ảnh nền qua `useQuery`, đồ
thị qua `WallLayerGraphPort`), (3) mọi hàm "gọi lại" lệnh S-07 có sẵn (`build*Command`),
(4) một lệnh duy nhất tự dựng bằng nguyên thuỷ (`buildApproveWallCommand`), (5) đường
ghi `dispatch`/`commit`/lịch sử, (6) MỌI phép hình học/định dạng dùng lại
(`toCanvasShapes`, `formatScaleLabel`, `toWallRow`, `toWallInspector`, `cursorLabelOf`,
zoom/minimap...). Hook giữ: state của riêng giao diện (`useState` bộ lọc, thu gọn, tool
machine, con trỏ), nối `useQuery`/`useStore`, gọi các hàm gateway rồi **ghép** kết quả
thành `panel`/`canvas`/`toolRail`/`statusBar`/`leftPanel`, đăng ký phím tắt. Hook KHÔNG
tự tính hình học hay định dạng số nào — mọi số đã định dạng đến từ gateway
(`reviewProgressLabel`, `formatScaleLabel`, v.v.) hoặc từ `src/lib/format` trực tiếp.

### `buildApproveWallCommand` — CHÉP NGUYÊN VĂN (gồm comment giải thích phía trên)

Vị trí xác nhận bằng `rg "buildApproveWallCommand" wallLayerReviewGateway.ts` →
dòng 32 (nhắc trong docblock đầu file) và dòng 498 (định nghĩa). Đoạn dưới đây là
`wallLayerReviewGateway.ts:475-507` nguyên văn:

```typescript
/**
 * Loại của lệnh duyệt.
 *
 * Không nằm trong `WALL_COMMAND_TYPES` vì lệnh này không tồn tại ở S-07; hằng
 * đặt tên ở đây là chỗ DUY NHẤT chuỗi đó được viết, nên nhật ký hoạt động, đo
 * đạc và bài kiểm cùng đọc một nguồn (R-71).
 */
export const WALL_APPROVE_COMMAND_TYPE = 'wall.approve';

/** Câu mô tả trên nút hoàn tác và nhật ký hoạt động — `validateCommands` đòi nó khác rỗng. */
export const approveDescription = (wallId: WallId): string => `Duyệt tường ${wallId}.`;

/**
 * Lệnh duyệt một tường.
 *
 * A5: đây là đường DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm
 * `source: 'human'` — không có tham số nào cho phép nơi gọi truyền `source`,
 * nên đầu ra AI không có đường nào bật được cờ xanh "đã xác minh".
 *
 * Ảnh chụp `before`/`after` là ĐẦY ĐỦ (`changeForUpdate` giữ nguyên hai bản
 * ghi, không phải diff từng trường), nên `invertCommand` hoàn tác được lệnh này
 * mà không cần biết nó nghĩa là gì.
 */
export function buildApproveWallCommand(before: Wall, actorId: string): Command {
  const after: Wall = { ...before, reviewed: true, source: 'human' };

  return createCommand({
    type: WALL_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveDescription(before.id),
    changes: [changeForUpdate('wall', before, after)],
  });
}
```

**Vì sao được phép** (tóm tắt lý lẽ trong docblock đầu file, dòng 22-35): `WALL_COMMAND_TYPES`
chỉ có 7 lệnh và không có lệnh duyệt. Điều phối viên đã duyệt cách dựng bằng
`createCommand` + `changeForUpdate` vì `CommandType` là kiểu `string` mở và
`validateCommands` chỉ kiểm `command.type` khác rỗng chứ không so với một bảng cho
phép cố định — nên một lệnh "ngoài danh sách bảy lệnh gốc" vẫn hợp lệ với tầng
`dispatch`. Lệnh tự hoàn tác được vì `changeForUpdate` giữ ĐỦ ảnh chụp before/after.
**Đây là khuôn cho ObjectLayerReview** nếu nó cũng cần một hành động "duyệt/khác" mà
S-07 chưa có lệnh — nhưng R-69 vẫn áp: nếu tình huống không khớp (ví dụ cần SỬA nhiều
trường cùng lúc mà `changeForUpdate` không phủ được), phải dừng và hỏi, không tự chế
thêm.

---

## D. Bẫy trạng thái

### `WallLayerReviewScenario` — chữ ký (CHÉP NGUYÊN VĂN, `wallLayerReviewScenarios.ts:54-68`)

```typescript
export interface WallLayerReviewScenario {
  readonly state: WallLayerScreenState;
  /** Nhãn tiếng Việt của trạng thái, nguyên từ `SEVEN_STATE_LABELS`. */
  readonly label: string;
  readonly walls: readonly Wall[];
  readonly reviewCounter: WallReviewCounter;
  /** Nguồn ảnh nền — xem {@link SAMPLE_BACKGROUND_IMAGE}. `null` khi chưa có ảnh nào để xem. */
  readonly backgroundImageUrl: string | null;
  /** `true` ở kịch bản `forbidden` — vai Người xem. */
  readonly isViewerRole: boolean;
  /** `true` ở kịch bản `collapsed`. */
  readonly isCollapsed: boolean;
  /** Non-null CHỈ ở kịch bản `error`, cùng quy ước với `SevenStateScenario.error`. */
  readonly error: unknown;
}
```

Điểm quan trọng nhất của thiết kế này (đọc từ docblock đầu file): mỗi kịch bản mang
**NGUYÊN LIỆU đồ thị thô** (`Wall[]` của `@/domain/spatial/types`), KHÔNG mang viewmodel
đã tính sẵn (`WallRowViewModel`...). Lý do: viewmodel là *kết quả* của
`useWallLayerReview.ts`, một file lớp L2 chưa tồn tại lúc `types.ts`/kịch bản này được
viết (dựng song song). Viết sẵn viewmodel ở đây nghĩa là đoán trước logic hook — đúng
thứ R-61 cấm ("không công thức tự chế"). **ObjectLayerReview nên copy đúng mẫu này**:
kịch bản 7 trạng thái luôn là dữ liệu NGUỒN (đồ thị/domain), không phải props đã tính.

`WALL_LAYER_REVIEW_SCENARIOS` (hằng, `wallLayerReviewScenarios.ts:167-175`) — mảng 7
phần tử theo đúng thứ tự `SEVEN_STATES`:

```typescript
export const WALL_LAYER_REVIEW_SCENARIOS: readonly WallLayerReviewScenario[] = [
  WALL_LAYER_REVIEW_SCENARIO_EMPTY,
  WALL_LAYER_REVIEW_SCENARIO_LOADING,
  WALL_LAYER_REVIEW_SCENARIO_PARTIAL,
  WALL_LAYER_REVIEW_SCENARIO_ERROR,
  WALL_LAYER_REVIEW_SCENARIO_SUCCESS,
  WALL_LAYER_REVIEW_SCENARIO_FORBIDDEN,
  WALL_LAYER_REVIEW_SCENARIO_COLLAPSED,
];
```

Tóm tắt bảy kịch bản (giá trị `reviewCounter` / `backgroundImageUrl` / cờ khác):

| # | state | reviewCounter | backgroundImageUrl | isViewerRole | isCollapsed | error |
|---|---|---|---|---|---|---|
| 1 | `empty` | `{0, 0}` | mẫu (có ảnh) | false | false | null |
| 2 | `loading` | `{0, 0}` | `null` (chưa có gì, kể cả ảnh) | false | false | null |
| 3 | `partial` (CHÍNH) | `{12, 48}` | mẫu | false | false | null |
| 4 | `error` | `{0, 48}` (walls RỖNG nhưng total giữ 48) | mẫu (VẪN xem được) | false | false | `Error(...)` |
| 5 | `success` | `{48, 48}` | mẫu | false | false | null |
| 6 | `forbidden` | `{12, 48}` | mẫu | **true** | false | null |
| 7 | `collapsed` | `{12, 48}` | mẫu | false | **true** | null |

Lưu ý bẫy quan trọng nhất ở kịch bản `error`: **canvas không được trắng dù danh sách
trắng** — ảnh nền tách khỏi lớp hình học (hai `useQuery` khác khoá, xem mục C). Đây là
lỗi thật đã xảy ra một lần trong lịch sử màn này (đọc `wallLayerReviewGateway.ts:209-226`)
và là điều mà `WallLayerReview.test.tsx` khẳng định tường minh
("lỗi lớp tường vẫn để ảnh gốc xem được", `useWallLayerReview.test.ts:614`).

### `expectSevenStates` — chữ ký lời gọi (từ `src/lib/testing/expectSevenStates.ts`)

```typescript
export type ScreenRenderer = (scenario: SevenStateScenario) => ScreenRenderResult;
export function expectSevenStates(
  renderScreen: ScreenRenderer,
  scenarios: readonly SevenStateScenario[],
): void
```

Kỳ vọng: đúng 7 kịch bản (không thiếu, không trùng trạng thái nào — cả hai lỗi đều
ném `Error` tiếng Việt), render không ném lỗi, và `container` render ra không được
TRẮNG (`childElementCount === 0 && textContent.trim() === ''`). Cách `WallLayerReview.test.tsx`
gọi nó (verbatim, dòng 169-182):

```typescript
describe('[NGHIEM-1] bảy trạng thái của A11', () => {
  it('dựng đủ 7/7 trạng thái, không trạng thái nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderState(scenario.state);
      rendered += 1;

      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });
```

Lưu ý: tham số thứ hai (`scenarioIndex()`) chỉ dùng để thoả kiểu `SevenStateScenario[]`
generic của bộ khẳng định dùng chung — nó KHÔNG phải nguồn dữ liệu thật. `renderState`
bên trong closure mới là nơi dựng màn thật, dùng `scenarioArgsFor(scenario.state)` từ
file stories (R-70: một bộ dữ liệu cho story lẫn test).

### `SEVEN_STATES`/`SevenStateScenario` của `sevenStateScenarios.ts` — chữ ký

```typescript
export const SEVEN_STATES = [
  'empty', 'loading', 'partial', 'error', 'success', 'forbidden', 'collapsed',
] as const;
export type SevenState = (typeof SEVEN_STATES)[number];
export const SEVEN_STATE_LABELS: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng', loading: 'đang tải', partial: 'một phần', error: 'lỗi',
  success: 'thành công', forbidden: 'không có quyền', collapsed: 'thu gọn',
};
export interface SevenStateScenario {
  readonly state: SevenState;
  readonly label: string;
  readonly rows: readonly SevenStateRow[];
  readonly totalCount: number;
  readonly isLoading: boolean;
  readonly isCollapsed: boolean;
  readonly canView: boolean;   // false CHỈ ở forbidden
  readonly error: unknown;     // non-null CHỈ ở error
}
```

### Bảy trạng thái → phần tử giao diện (bảng chép nguyên văn từ `types.ts:127-135`)

| Trạng thái  | Nghĩa ở màn Duyệt lớp tường                                        |
|-------------|---------------------------------------------------------------------|
| `empty`     | AI không dò ra tường nào ở tầng này (`reviewCounter.total === 0`)   |
| `loading`   | đang tải lớp tường; canvas có thể đã hiện ảnh nền, panel thì chưa   |
| `partial`   | đã có tường, nhưng `0 < reviewed < total` — trạng thái CHÍNH của màn |
| `error`     | lớp dữ liệu tường hỏng; ẢNH NỀN vẫn xem được (không phải màn trắng) |
| `success`   | `reviewed === total` — mọi tường đã duyệt, nút "Sang lớp Cửa..." mở |
| `forbidden` | vai Người xem: canvas chỉ xem, panel ẩn nút duyệt/xoá/tách/gộp      |
| `collapsed` | ẩn cả hai panel (danh sách + thanh tra), chỉ còn canvas toàn khung  |

Và bảng "nơi từng trạng thái được vẽ" (chép nguyên văn từ `WallLayerReview.tsx:35-43`):

| `state`     | vẽ ở đâu                                                        |
|-------------|------------------------------------------------------------------|
| `empty`     | `WallLayerList` (panel trái) — `EmptyState` với `emptyNotice`     |
| `loading`   | canvas: dự phòng khung xương; panel trái: 12 dòng `Skeleton`      |
| `partial`   | mặc định — danh sách + thanh tra bình thường                      |
| `error`     | `InlineAlert` trong panel trái; canvas VẪN xem được ảnh nền        |
| `success`   | panel trái hiện nút "Sang lớp Cửa và nội thất"                    |
| `forbidden` | ray ẩn công cụ sửa; thanh tra bỏ viền + một câu giải thích         |
| `collapsed` | hai panel ẩn; ray công cụ nổi trên canvas                          |

`deriveScreenState` (hàm THUẦN, `useWallLayerReview.ts:519-547`) là nơi 7 trạng thái
được **dẫn xuất** từ dữ liệu (không phải 7 cờ rời rạc lưu tay). Thứ tự quyết định:
quyền trước (`isViewerRole` → `forbidden`) → vỏ màn (`isCollapsed` → `collapsed`) →
lỗi (`hasError` → `error`) → đang tải (`isLoading` → `loading`) → rồi mới tới đếm
(`total === 0` → `empty`; `reviewed === total` → `success`; còn lại → `partial`).
Hàm này export riêng để test không cần DOM (`describe('phép ghép thuần...')`,
`useWallLayerReview.test.ts:268`).

---

## E. Test

### Cách dùng `render` / `fixtures` / `fakeClock`

- **`render`**: `WallLayerReview.test.tsx` dùng `renderWithProviders` từ
  `@/lib/testing/render` (bọc `QueryClientProvider` với client mới mỗi lần, reset
  store). `useWallLayerReview.test.ts` **không** dùng `renderWithProviders` — nó tự bọc
  `QueryClientProvider` bằng `createTestQueryClient()` (cũng từ `@/lib/testing/render`)
  vì nó gọi `renderHook` chứ không `render` một cây UI.
- **`fixtures.ts`** và **`fakeClock.ts`**: đã Grep toàn thư mục màn
  (`rg "fixtures|fakeClock" src/screens/qc/WallLayerReview` → rỗng). Màn này **KHÔNG
  dùng hai module đó** — nó tự có bộ mẫu riêng (`wallLayerReviewFixture.ts`) và tự
  điều khiển thời gian bằng tham số `now: () => number` tiêm vào gateway/undo ticket
  (ví dụ test dòng `useWallLayerReview.test.ts:526-547`: `let clock = 0; ... now: () => clock`).
  Ghi rõ trong note vì đây là một lựa chọn có thể KHÔNG áp dụng cho ObjectLayerReview
  nếu nó cần đồng hồ giả phức tạp hơn — kiểm tra `fakeClock.ts` riêng nếu cần.

### Cách gọi `expectAccessible` + `expectVietnamese` + `expectNoRawColor` (verbatim từ `WallLayerReview.test.tsx:361-392`)

```typescript
describe('ba bộ soát dùng chung', () => {
  it.each(SEVEN_STATES)('R-72 expectAccessible — trạng thái %s', (state) => {
    const { container } = renderState(state);

    expectAccessible(container);
  });

  const ALLOWED_WORDS = ['zoom'];

  it.each(SEVEN_STATES)('R-72 expectVietnamese — trạng thái %s', (state) => {
    const { container } = renderState(state);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS });
  });

  it('expectNoRawColor — không một mã màu thô nào trong cả thư mục màn', () => {
    /* Nhận thẳng một thư mục và tự đi hết `.ts`/`.tsx` bên trong. */
    expectNoRawColor(SCREEN_DIRECTORY);
  });
});
```

trong đó `SCREEN_DIRECTORY = 'src/screens/qc/WallLayerReview'` (dòng 78) và
`renderState` là hàm dựng cục bộ:

```typescript
function renderState(state: SevenStateScenario['state']) {
  return renderWithProviders(
    <MemoryRouter>
      <WallLayerReviewContainer {...scenarioArgsFor(state)} />
    </MemoryRouter>,
  );
}
```

`allowWords: ['zoom']` là chữ DUY NHẤT được nới, và lý do ghi rõ trong comment: `ZoomCluster`
(component dùng chung, ngoài phạm vi sửa R-68) tự đặt nhãn có chữ "Zoom" — sáu chuỗi
tiếng Anh khác tìm thấy trong lượt gộp đã được SỬA THẬT, không nới thêm.
`expectNoRawColor` nhận một **đường dẫn thư mục** (string), không phải một `container`
DOM — nó tự quét file `.ts`/`.tsx`.

### (1) Ví dụ test bảy trạng thái — CHÉP NGUYÊN VĂN (`WallLayerReview.test.tsx:184-198`)

```typescript
  it('trạng thái thu gọn: hai panel ẩn, nhưng canvas và thanh trạng thái vẫn còn', () => {
    renderState('collapsed');

    expect(screen.getByRole('toolbar', { name: 'Công cụ lớp tường' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Thanh trạng thái' })).toBeInTheDocument();
  });

  it('trạng thái không có quyền: ray ẩn công cụ sửa, KHÔNG khoá mờ cả màn', () => {
    renderState('forbidden');

    expect(screen.queryByRole('button', { name: /vẽ tường/u })).not.toBeInTheDocument();
    /* Vẫn xem được: khung canvas và thanh trạng thái không biến mất. */
    expect(screen.getByRole('status', { name: 'Thanh trạng thái' })).toBeInTheDocument();
  });
```

### (2) Ví dụ test tương tác bàn phím — CHÉP NGUYÊN VĂN (`useWallLayerReview.test.ts:421-437`)

```typescript
  it('J và K đi xuống rồi đi lên đúng một hàng', async () => {
    const mounted = await mountSettled();

    await pressKey(mounted.registry, 'J');
    const first = mounted.result.current.panel.selectedWallId;

    await pressKey(mounted.registry, 'J');
    const second = mounted.result.current.panel.selectedWallId;

    await pressKey(mounted.registry, 'K');

    expect(first).toBe(wallAt(0).id);
    expect(second).toBe(wallAt(1).id);
    expect(mounted.result.current.panel.selectedWallId).toBe(first);

    mounted.unmount();
  });
```

trong đó `pressKey` (helper cục bộ, `useWallLayerReview.test.ts:212-221`) gõ phím qua
**SỔ PHÍM THẬT** (`registry.handleKeyDown`), không qua một lời gọi tắt:

```typescript
async function pressKey(
  registry: ShortcutRegistry,
  key: string,
  modifiers: { readonly ctrlKey?: boolean } = {},
): Promise<void> {
  await act(async () => {
    registry.handleKeyDown({ key, ctrlKey: modifiers.ctrlKey ?? false }, null);
    await Promise.resolve();
  });
}
```

### (3) Ví dụ test một lệnh hoàn tác được — CHÉP NGUYÊN VĂN (`useWallLayerReview.test.ts:456-489`)

```typescript
  it('đi qua tầng lệnh nên hoàn tác được, và không đụng cờ duyệt', async () => {
    const mounted = await mountSettled();
    const wall = wallAt(0);
    const target = thicknessChoice(0);

    await act(async () => {
      mounted.result.current.panel.onChangeThickness(wall.id, target);
      await Promise.resolve();
    });

    const changed = (): Wall =>
      wallsOfLevel(useStore.getState().spatial, FIXTURE_LEVEL.id).find(
        (item) => item.id === wall.id,
      ) as Wall;

    await waitFor(() => {
      expect(changed().thicknessMm).toBe(target);
    });
    /* Đổi độ dày KHÔNG phải duyệt: cờ review giữ nguyên (A5). */
    expect(changed().reviewed).toBe(wall.reviewed);
    expect(changed().source).toBe(wall.source);

    /* Hoàn tác được nghĩa là lệnh đã đi qua `dispatch` chứ không phải một lượt ghi tắt. */
    await act(async () => {
      mounted.result.current.panel.onUndo();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(changed().thicknessMm).toBe(wall.thicknessMm);
    });

    mounted.unmount();
  });
```

### Cách ĐẾM bước lịch sử — bài kiểm quan trọng nhất của cả file

Bài kiểm tại `useWallLayerReview.test.ts:346-398`, tên
`'duyệt 5 tường rồi hoàn tác 5 lần: 12 → 17 → 12'`, chính là ví dụ mẫu cho việc "N thao
tác = N bước lịch sử" (khác với việc mà T5/ObjectLayerReview cần chứng minh ngược lại:
"20 lần kéo = 1 bước"). Cách nó đếm — CHÉP NGUYÊN VĂN:

```typescript
  it('duyệt 5 tường rồi hoàn tác 5 lần: 12 → 17 → 12', async () => {
    const mounted = await mountSettled();
    const counterNow = (): number => mounted.result.current.panel.reviewCounter.reviewed;

    expect(mounted.result.current.panel.reviewCounter.total).toBe(WALL_LAYER_FIXTURE_TOTAL);

    const climbing: number[] = [counterNow()];

    for (let index = 0; index < APPROVALS; index += 1) {
      /* `J` — xuống cho tới hàng CHƯA DUYỆT kế tiếp, qua sổ phím thật. */
      const target = await pressUntilUnreviewed(mounted);

      expect(target).not.toBeNull();

      /* Hành động mặc định của hàng đang có tiêu điểm — đúng việc `Enter` làm. */
      await act(async () => {
        mounted.result.current.panel.onApprove(target as WallId);
        await Promise.resolve();
      });

      const reached = lastOf(climbing) + 1;

      await waitFor(() => {
        expect(counterNow()).toBe(reached);
      });

      climbing.push(counterNow());
    }

    const falling: number[] = [];

    for (let index = 0; index < APPROVALS; index += 1) {
      const before = counterNow();

      await pressKey(mounted.registry, 'z', { ctrlKey: true });

      await waitFor(() => {
        expect(counterNow()).not.toBe(before);
      });

      falling.push(counterNow());
    }

    /* In ra dãy đếm — một bước nhảy sai ở giữa cũng lộ, không chỉ hai đầu. */
    console.log(`dãy đếm lên:    ${climbing.join(', ')}`);
    console.log(`dãy đếm xuống:  ${falling.join(', ')}`);

    expect(climbing).toEqual([12, 13, 14, 15, 16, 17]);
    expect(falling).toEqual([16, 15, 14, 13, 12]);
    expect(counterNow()).toBe(WALL_LAYER_FIXTURE_REVIEWED);

    mounted.unmount();
  });
```

**Nguyên tắc đếm** (áp dụng cho ObjectLayerReview khi cần chứng minh "20 lần kéo = 1
bước"): không đọc trực tiếp độ dài mảng lịch sử nội bộ (`dispatchBundle.history` không
được test này đọc thẳng — nó là con số PRIVATE trong `createHistoryStack()`). Thay vào
đó, test ĐO một **tác dụng phụ quan sát được từ bên ngoài** (ở đây: `reviewCounter.reviewed`,
qua `panel.reviewCounter.reviewed`) SAU MỖI THAO TÁC, và khẳng định:

1. mỗi thao tác duyệt (5 lần) làm bộ đếm tăng đúng 1 (`climbing` là dãy `[12,13,14,15,16,17]`,
   không nhảy cóc — nếu một lệnh vô tình sinh RA HAI bước lịch sử thì `Ctrl+Z` một lần
   sau đó sẽ không đưa bộ đếm về đúng số cũ, và test này sẽ bắt được ngay ở nhánh
   `falling`);
2. mỗi lần `Ctrl+Z` (5 lần, qua **sổ phím thật**) lùi bộ đếm đúng 1, và **thứ tự đảo
   ngược đúng** (`falling` = `[16,15,14,13,12]` — hoàn tác đúng thứ tự LIFO của 5 lệnh
   vừa phát).

Nếu T5 (ObjectLayerReview) cần chứng minh "20 lần kéo chuột = 1 bước lịch sử", khuôn
tương ứng là: (a) tạo một chuỗi 20 sự kiện kéo (ví dụ 20 lần gọi handler `onDrag`/
tương đương mà KHÔNG có `onDragEnd` ở giữa), (b) sau khi kết thúc cử chỉ (một lần
`onDragEnd` hoặc lệnh chốt), gọi `Ctrl+Z` **đúng một lần** qua `registry.handleKeyDown`,
rồi (c) khẳng định trạng thái quan sát được (vị trí/kích thước phần tử) quay về ĐÚNG
giá trị trước khi cử chỉ bắt đầu — chứ không phải quay về giá trị sau 19/20 bước kéo.
Đây là cách gián tiếp nhưng đủ mạnh để chứng minh "N thao tác gộp thành 1 bước", không
cần đọc field private của `HistoryStack`.

Bài test vé hoàn tác 8000ms cũng minh hoạ mẫu tương tự cho A8/A9
(`useWallLayerReview.test.ts:526-547`, dùng `createWallUndoTicket` trực tiếp với đồng
hồ giả `let clock = 0`).

---

## F. Stories

### `meta` object — CHÉP NGUYÊN VĂN (`WallLayerReview.stories.tsx:161-177`)

```typescript
const meta = {
  title: 'Screens/QC/WallLayerReview',
  component: WallLayerReviewContainer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    /* Vỏ route: `WallLayerReviewRoute` không dựng ở đây, nhưng container vẫn
     * nằm trong cây có router để mọi liên kết con tìm được provider. */
    (Story) => (
      <MemoryRouter>
        <div className="h-screen w-screen">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  excludeStories: ['scenarioArgsFor', 'SEVEN_STORY_STATES'],
} satisfies Meta<typeof WallLayerReviewContainer>;
```

### Bẫy CSF — có dùng `meta.excludeStories` hay không: **CÓ**

Xác nhận bằng đọc file: dòng 176 ở trên, `excludeStories: ['scenarioArgsFor', 'SEVEN_STORY_STATES']`.
Lý do (nguyên văn docblock đầu file, dòng 32-38): "Một export KHÔNG PHẢI story trong
file stories làm TRẮNG toàn bộ file" — `scenarioArgsFor` (hàm) và `SEVEN_STORY_STATES`
(hằng dữ liệu) là hai export **không phải story** mà `WallLayerReview.test.tsx` cần
import lại (dòng `import { scenarioArgsFor } from './WallLayerReview.stories';`, R-70:
một bộ dữ liệu cho cả story lẫn test) — nên cả hai PHẢI khai trong `excludeStories`,
nếu không Storybook sẽ cố đọc chúng như story và làm trắng cả file.

### Bảy story tương ứng bảy trạng thái

Story dựng bằng cách cắm `createMockWallLayerReviewGateway()` vào **container thật**
(`WallLayerReviewContainer`) — KHÔNG viết tay props view, vì đó là đoán trước kết quả
`useWallLayerReview` (R-61). Mỗi story ép đúng ĐẦU VÀO sinh ra trạng thái đó (vì
`deriveScreenState` dẫn xuất trạng thái từ dữ liệu, không nhận cờ trực tiếp):

| story (export) | trạng thái | ép bằng |
|---|---|---|
| `Rong` | `empty` | đồ thị không có tường nào (`graph: EMPTY_GRAPH`) |
| `DangTai` | `loading` | cổng có `readBackground` không bao giờ trả lời (`pendingGateway()`) |
| `MotPhan` | `partial` | bộ mẫu nguyên bản — 12/48 (`graph: FULL_GRAPH`) |
| `Loi` | `error` | `failReadWallLayer: true` (KHÔNG phải `failReadBackground`) |
| `ThanhCong` | `success` | bộ mẫu với cả 48 tường `reviewed: true, source: 'human'` |
| `KhongCoQuyen` | `forbidden` | `roles: ['viewer']` |
| `ThuGon` | `collapsed` | `forceCollapsed: true` |

`scenarioArgsFor(state: SevenState): WallLayerReviewContainerProps` là hàm dùng chung
giữa 7 story và test — export và excludeStories như trên.

---

## G. Phím tắt

### Đăng ký qua `useShortcut` — chữ ký, cách huỷ

Hook gọi `useShortcut(definition, options)` nhiều lần (một lần mỗi phím). `useShortcut`
(`src/hooks/useShortcut.ts`) tự dọn đăng ký khi component unmount qua `useEffect` cleanup
nội bộ — **không có `unregister` thủ công nào trong `useWallLayerReview.ts`**: mỗi lời
gọi `useShortcut({...}, shortcutOptions)` tự lo vòng đời của chính nó.

`shortcutOptions` (một object nhớ qua `useMemo`, `useWallLayerReview.ts:1226-1229`) cấp
`registry` tiêm được (test dùng sổ riêng, không đụng sổ toàn cục). Một số phím còn thêm
`enabled: canEdit` để tắt hẳn khi vai Người xem — ví dụ Backspace, Ctrl+Z, 1/2/3, W/measure.

### Esc đóng lớp trên cùng (A12) — cách hoạt động trong repo

Từ `src/lib/input/shortcutRegistry.ts` (đọc toàn bộ docblock đầu file + đoạn
`handleKeyDown`):

- Bốn "tầng" (`ShortcutScope`): `'dialog' | 'sidePanel' | 'canvas' | 'global'`.
- `SCOPE_PRIORITY = ['dialog', 'sidePanel', 'canvas', 'global']` — một phím được hỏi
  từng tầng theo thứ tự này, tầng nào bắt được (có binding khớp combo) thì dừng ở đó.
- **Chỉ tầng `dialog` là MODAL** (`MODAL_SCOPES`) — khi nó đang active, mọi phím nó
  KHÔNG bind bị NUỐT (không rơi xuống tầng dưới), **trừ đúng phím Escape**:
  ```typescript
  // A modal floor swallows what it does not bind — except Escape, which
  // must always reach the global close-top-layer handler (invariant A12).
  if (MODAL_SCOPES.has(scope) && code !== 'ESCAPE') {
    return false;
  }
  ```
  (`shortcutRegistry.ts:475-479`). Nghĩa là: một dialog quên đăng ký Escape của riêng
  nó thì phím Escape vẫn "lọt" xuống tầng `global`, nơi có handler đóng lớp trên cùng
  mặc định — lời hứa "Esc đóng lớp trên cùng" không bao giờ bị một dialog cụ thể làm
  mất, kể cả khi người viết dialog đó quên.
- WallLayerReview KHÔNG tự đăng ký một Escape riêng nào (đã đọc toàn bộ khối
  `useShortcut` trong hook — không có combo `'Escape'`) — nó dựa hoàn toàn vào handler
  `global` sẵn có của `shortcutRegistry.ts` (dòng 637-638, `combo: 'Escape', scope: 'global'`).
  Điều này ĐÚNG vì WallLayerReview không tự mở dialog/side-panel modal nào của riêng
  nó (ContextMenu không phải modal theo nghĩa `MODAL_SCOPES`).

### Toàn bộ khối đăng ký phím trong `useWallLayerReview.ts` — CHÉP NGUYÊN VĂN

Chín lời gọi `useShortcut`, đúng thứ tự trong file (`useWallLayerReview.ts:1247-1361`):

```typescript
  useShortcut(
    {
      id: 'wallLayerReview.next',
      combo: 'J',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutNext,
      onTrigger: () => step(1),
    },
    shortcutOptions,
  );
  useShortcut(
    {
      id: 'wallLayerReview.previous',
      combo: 'K',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutPrevious,
      onTrigger: () => step(-1),
    },
    shortcutOptions,
  );
  useShortcut(
    {
      id: 'wallLayerReview.delete',
      combo: 'Backspace',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutDelete,
      onTrigger: () => {
        if (selectedRef.current !== null) {
          onDelete(selectedRef.current);
        }
      },
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'wallLayerReview.undo',
      combo: 'Mod+Z',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutUndo,
      onTrigger: onUndo,
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  const thicknessRef = useRef(onChangeThickness);
  thicknessRef.current = onChangeThickness;

  const setThickness = useCallback((choice: WallThicknessChoice) => {
    if (selectedRef.current !== null) {
      thicknessRef.current(selectedRef.current, choice);
    }
  }, []);

  useShortcut(
    {
      id: 'wallLayerReview.thickness.1',
      combo: '1',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutThickness,
      onTrigger: () => setThickness(WALL_LAYER_THICKNESS_CHOICES[0] as WallThicknessChoice),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'wallLayerReview.thickness.2',
      combo: '2',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutThickness,
      onTrigger: () => setThickness(WALL_LAYER_THICKNESS_CHOICES[1] as WallThicknessChoice),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'wallLayerReview.thickness.3',
      combo: '3',
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutThickness,
      onTrigger: () => setThickness(WALL_LAYER_THICKNESS_CHOICES[2] as WallThicknessChoice),
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  useShortcut(
    {
      id: 'wallLayerReview.tool.select',
      combo: shortcutForTool('select'),
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutTool,
      onTrigger: () => activateTool('select'),
    },
    shortcutOptions,
  );
  useShortcut(
    {
      id: 'wallLayerReview.tool.drawWall',
      combo: shortcutForTool('drawWall'),
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutTool,
      onTrigger: () => activateTool('drawWall'),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'wallLayerReview.tool.measure',
      combo: shortcutForTool('measure'),
      scope: 'canvas',
      description: WALL_LAYER_TEXT.shortcutTool,
      onTrigger: () => activateTool('measure'),
    },
    shortcutOptions,
  );
```

Cộng thêm một lời gọi thứ mười, tách riêng phía sau trong file (`useWallLayerReview.ts:1599-1608`)
cho phím `F` ("vừa khung"):

```typescript
  useShortcut(
    {
      id: 'wallLayerReview.fitToScreen',
      combo: 'F',
      description: WALL_LAYER_TEXT.shortcutFit,
      scope: 'canvas',
      onTrigger: onFitToScreen,
    },
    shortcutOptions,
  );
```

Tổng cộng **mười phím** đăng ký: `J`, `K`, `Backspace`, `Mod+Z` (Ctrl/Cmd+Z), `1`, `2`,
`3`, phím công cụ `V`/`W`/`M` (lấy từ `shortcutForTool('select'|'drawWall'|'measure')`,
KHÔNG gõ tay chuỗi phím), và `F`. Toàn bộ ở `scope: 'canvas'` — không phím nào ở
`'dialog'`/`'sidePanel'`/`'global'`, vì màn này không tự mở dialog modal. `Enter` KHÔNG
đăng ký (nó nằm trong `RESERVED_KEYS` của tầng dưới) — hành động duyệt dùng hành vi mặc
định của phần tử đang có tiêu điểm (nút "Duyệt đoạn này" hoặc hàng danh sách).

---

## H. Vỏ QC-shell

### PHÁT HIỆN QUAN TRỌNG: màn KHÔNG dùng `AppShell`/`Panel`/`StatusBar` chung

Đã Grep toàn bộ import trong thư mục màn tìm `@/(components/shell|lib/query|lib/mutations)`:

```
rg "import.*(from '@/(components/shell|lib/query|lib/mutations)')" src/screens/qc/WallLayerReview
→ No matches found
```

(Lệnh Grep dùng pattern rộng hơn để bắt cả `lib/query`/`lib/mutations` — cũng không có
match cho `components/shell` cụ thể; các import `@/lib/query/*` và `@/lib/mutations/*`
CÓ tồn tại trong `useWallLayerReview.ts` — ví dụ `@/lib/query/invalidation`,
`@/lib/query/queryKeys`, `@/hooks/useNotifications` (bọc `@/lib/mutations/notificationBus`)
— nhưng KHÔNG có import nào trỏ `@/components/shell/**`.)

Đọc lại toàn bộ đầu file `WallLayerReview.tsx` (dòng 50-62) xác nhận: nó chỉ import
`Skeleton` từ `@/components/feedback` và các sub-view/kiểu **trong chính thư mục màn**
(`WallLayerInspector`, `WallLayerLeftPanel`, `WallLayerStatusBar`, `WallLayerToolRail`,
`./types`). Không một dòng nào import `AppShell`, `Panel`, hay `StatusBar` từ
`src/components/shell/`.

**Kết luận: màn KHÔNG dùng `AppShell`/`Panel`/`StatusBar` chung, nó tự dựng layout ba
cột bằng div trần.** Đây là phát hiện thật, không phải suy đoán — đã xác minh bằng
Grep và đọc mã nguồn.

### Cách WallLayerReview tự dựng layout (đọc từ `WallLayerReview.tsx:108-140`)

```
<div role="region" aria-label="Duyệt lớp tường" className="flex h-full min-h-0 w-full flex-col bg-bg-app">
  <div className="relative flex min-h-0 flex-1 gap-2 p-2">
    {isCollapsed
      ? <div className="absolute left-4 top-4 z-10 ..."><WallLayerToolRail .../></div>
      : <WallLayerToolRail .../>}
    {!isCollapsed && <WallLayerLeftPanel .../>}
    <section className="min-h-0 min-w-[640px] flex-1 ... rounded-[16px] bg-bg-sunken">
      {canvasSlot ?? <CanvasFallback canvas={canvas} />}
    </section>
    {!isCollapsed && <WallLayerInspector panel={panel} />}
  </div>
  <WallLayerStatusBar {...statusBar} />
</div>
```

So sánh với `AppShell.tsx` (`src/components/shell/AppShell.tsx`, một component ĐẦY ĐỦ
tính năng hơn nhiều: top bar 56px + breadcrumb, rail công cụ có `ShellToolId` riêng,
`PanelWrapper` với animation mở/đóng bằng `framer-motion`, `Drawer` responsive dưới
1024/1280px, `CommandPalette`, `ShortcutHelp`) — WallLayerReview **KHÔNG dùng** cấu
trúc đó. Nó tự dựng một layout đơn giản hơn nhiều: không top bar, không breadcrumb,
không responsive drawer, thu gọn hai panel chỉ bằng cờ `isCollapsed` đổi `className`
tại chỗ (không animation width như `PanelWrapper`).

`Panel.tsx` (`src/components/shell/Panel.tsx`, namespace `Panel.Root/.Header/.Body/.Group/.Divider`)
cũng KHÔNG được dùng — `WallLayerLeftPanel.tsx` và `WallLayerInspector.tsx` tự viết
`<div className="... rounded-[12px] bg-bg-surface shadow-panel">` trực tiếp thay vì
`<Panel.Root>`.

`StatusBar.tsx` (`src/components/shell/StatusBar.tsx`, nhận `x: number, y: number` THÔ
rồi tự `toFixed(2)` bên trong component) cũng KHÔNG được dùng — lý do ghi trong
docblock `WallLayerStatusBar.tsx:11-15`: component đó tự làm tròn/định dạng số ở tầng
view, đúng việc `local/no-raw-number` cấm, và nó **nằm trong sổ nợ đã ghi ở CLAUDE.md
(bốn file được miễn `no-raw-number`), không phải khuôn để chép**. `WallLayerStatusBar.tsx`
màn này tự viết lại, nhận ba chuỗi **ĐÃ ĐỊNH DẠNG SẴN** (`cursorLabel`, `scaleLabel`,
`saveLabel` — đều `string`) từ hook, không nhận số thô.

### Khuyến nghị cho ObjectLayerReview

Vì WallLayerReview không dùng vỏ chung, ObjectLayerReview (nếu phải "dùng đúng vỏ và
khuôn của WallLayerReview" như bối cảnh nhiệm vụ nói) nên **COPY cấu trúc layout ba
cột bằng div trần của `WallLayerReview.tsx`** (rail trái 56px, panel trái ~280px,
canvas giữa `flex-1 min-w-[640px]`, panel phải ~344px, status bar 32px dính đáy) —
KHÔNG import `AppShell`/`Panel`/`StatusBar` từ `src/components/shell/`, và KHÔNG import
chéo các component riêng của `WallLayerReview/` (`WallLayerToolRail`, `WallLayerStatusBar`,
`WallLayerLeftPanel`, v.v.) — mỗi màn tự có bộ component con của riêng nó, đặt tên theo
đúng tiền tố của màn đó (ví dụ `ObjectLayerToolRail`, `ObjectLayerStatusBar`...), y hệt
cách `WallLayerReview/` không import bất kỳ thứ gì từ `ScaleCalibration/` hay
`PipelineFailure/`.

---

## I. Danh sách luật phải tuân (R-59 → R-73, từ `LUAT_MAN_HINH.md`)

| Mã | Một câu | Cách kiểm |
|---|---|---|
| R-59 | Một màn = đúng 6 file chuẩn (`index.ts`, `<Name>.tsx`, `use<Name>.ts`, `<Name>.container.tsx`, `<Name>.stories.tsx`, `<Name>.test.tsx`); file thêm phải qua `index.ts` mà không đổi API | `ls` thư mục màn phải có đủ 6 tên |
| R-60 | `<Name>.tsx` là view thuần: không import `@/api`, `@/store`, `@/domain`, `@/lib/http` | ESLint `local/no-data-layer-in-view` (chỉ áp `*.tsx`, trừ `.container.tsx`/`.test.tsx`/`.stories.tsx`) |
| R-61 | `use<Name>.ts` chỉ nối lại logic có sẵn, không công thức tự chế (hình học, làm tròn, quy đổi đơn vị) | `local/no-raw-number` + soi tay |
| R-62 | Container bọc `ScreenErrorBoundary` từ `src/components/feedback` (KHÔNG phải bản `src/lib/screen-state`) | `rg "<ScreenErrorBoundary" src/screens` |
| R-63 | Mỗi màn đi qua `expectSevenStates`, đủ 7 story tương ứng | `rg "expectSevenStates" src/screens` + `pnpm test` |
| R-64 | Trạng thái máy chủ cắm vào `src/lib/query`/`src/lib/mutations` có sẵn, không tự viết `useState` loading/error | `rg "useState.*[Ll]oading|useState.*error" src/screens` phải rỗng |
| R-65 | Không chuỗi bắt đầu bằng `/` hay `http` trong `src/screens/**`; đường dẫn từ `@/routes/paths` (màn) hoặc `@/routes` (vỏ) | `rg "['\"\`](/|https?://)" src/screens` phải rỗng (bỏ qua comment) |
| R-66 | Màn mới phải đăng ký route thật, thay đúng `<Placeholder>` | `rg "Placeholder" src/routes.tsx` giảm đúng 1 |
| R-67 | Chuỗi hiển thị mới phải thêm khoá vào `src/i18n/vi.json` (từ điển kiểm tra, không phải bảng dịch runtime) | `expectVietnamese` trong test màn |
| R-68 | Khi dựng màn chỉ được sửa `src/screens/<area>/<Name>/**`, `src/routes/*`, `src/i18n/vi.json` — cấm chạm `lib/domain/store/api/components/eslint-rules/CLAUDE.md/RULE.md` | `git diff --name-only` |
| R-69 | Thiếu logic thì DỪNG và hỏi (`orca orchestration ask`); không tự chế, không stub, không TODO | `rg "TODO|FIXME|stub" src/screens` phải rỗng |
| R-70 | Không làm vừa lòng bài kiểm thử — test đỏ là code sai hoặc đặc tả sai, không nới điều kiện/hạ ngưỡng/`.skip`/`.only` | `rg "\.(skip|only)\(" src` phải rỗng |
| R-71 | Không hằng số viết tay (mã lỗi, thời gian chờ, ngưỡng, thời lượng chuyển động) — lấy từ nguồn có sẵn (`MOTION_DURATIONS_MS`, `src/domain/units`...) | `local/no-raw-duration`, `local/no-raw-number` |
| R-72 | Màn phải qua `expectAccessible` + `expectVietnamese` trong `<Name>.test.tsx`; phím tắt qua `shortcutRegistry`, không `addEventListener('keydown')` tay | `pnpm test` |
| R-73 | Một màn xong phải nối được ngay: container tồn tại (dù chưa ai gọi), mọi hành động cần thiết là prop bắt buộc có thật, không phải optional không ai truyền | `ls` đủ 6 tên R-59 kể cả khi chưa ai gọi; `rg` tên prop/callback trong `.container.tsx` của màn CUNG CẤP hành động đó |

### Khối lệnh kiểm Phần 4 (CHÉP NGUYÊN VĂN từ `LUAT_MAN_HINH.md`)

```bash
SCREEN=src/screens/<area>/<Name>

echo "R-59 sáu file:";        ls $SCREEN
echo "R-60 view chạm dữ liệu:"; rg "from '@/(api|store|domain|lib/http)" $SCREEN --glob '*.tsx' --glob '!*.container.tsx' --glob '!*.test.tsx' --glob '!*.stories.tsx'
echo "R-62 ranh giới lỗi:";   rg "<ScreenErrorBoundary" $SCREEN
echo "R-63 bảy trạng thái:";  rg "expectSevenStates" $SCREEN
echo "R-64 tự viết loading:"; rg "useState.*([Ll]oading|error)" $SCREEN
echo "R-65 đường dẫn thô:";   rg "['\"\`](/|https?://)" $SCREEN
echo "R-69 stub/nợ:";         rg "TODO|FIXME|stub|any\b" $SCREEN
echo "R-70 test bị tắt:";     rg "\.(skip|only)\(" $SCREEN
echo "R-71 hằng số thô:";     rg "setTimeout\([^,]*, *[0-9]|duration: *[0-9]" $SCREEN
echo "R-73 container tồn tại:"; ls $SCREEN/*.container.tsx
echo "R-68 phạm vi sửa:";     git diff --name-only

pnpm verify
```

Sáu lệnh đầu phải **rỗng** (trừ `ls`, `<ScreenErrorBoundary`, `expectSevenStates` và
`R-73 container tồn tại` — bốn lệnh đó phải **có** kết quả).

### Ghi chú riêng, nhấn mạnh theo yêu cầu nhiệm vụ

- **R-65**: đã xác nhận `wallLayerReviewScenarios.ts:34-39` tự ghi rõ lý do
  `SAMPLE_BACKGROUND_IMAGE = 'sample-floor-plan.png'` KHÔNG phạm R-65 (không bắt đầu
  bằng `/` hay `http`) — vì nó là placeholder tên file, không phải đường dẫn thật; nạp
  ảnh thật là việc của hook lớp L2. Container mọi nơi tra `ROUTES.*` từ `@/routes/paths`
  (ví dụ `WallLayerReview.container.tsx:87,111-115`), không ghép chuỗi đường dẫn tay.
- **R-68**: `WallLayerReview.container.tsx` import `@/routes/paths` (không phải
  `@/routes` — đó là phần của route wrapper `WallLayerReviewRoute`, không phải của
  container/hook), khớp đúng phân biệt "màn nhập `@/routes/paths`, phần vỏ nhập
  `@/routes`" ghi ở R-65. Phạm vi sửa cho phép khi dựng màn: chỉ
  `src/screens/<area>/<Name>/**`, `src/routes/*`, `src/i18n/vi.json`.

---

## Tự kiểm (checklist cuối)

- [x] Đủ 9 mục A–I
- [x] Đã đọc 20/20 file của `WallLayerReview/` (đối chiếu `git ls-files`)
- [x] `buildApproveWallCommand` chép nguyên văn (mục C), kèm comment giải thích phía trên
- [x] Chữ ký `useWallLayerReview` đầy đủ: `UseWallLayerReviewOptions` (mục B) và
      `UseWallLayerReviewResult` (mục B) chép nguyên văn
- [x] `WallLayerReviewProps`, `WallLayerReviewViewProps`, `WallLayerReviewContainerProps`
      chép nguyên văn (mục B)
- [x] Phát hiện quan trọng ở mục H: màn KHÔNG dùng `AppShell`/`Panel`/`StatusBar` chung,
      xác nhận bằng Grep thật, không suy đoán
- [x] Đếm file thực tế: 20 (không phải 21 như đặc tả gốc) — ghi ở đầu file
