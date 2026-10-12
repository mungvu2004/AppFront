# Mã Pascal trong repo này — lấy từ đâu, và vì sao nó ở đây

Thư mục này là **mã của AppFront**, không phải một phụ thuộc. Nó được chép vào ngày
**2026-09-28** để đội AppFront tự sửa phần soạn thảo và phần dựng mô hình 3D mà không phải xây lại
từ đầu.

## Nguồn

| | |
|---|---|
| Kho gốc | `https://github.com/pascalorg/editor` |
| Nhánh | `main` |
| Commit | `cd14090ef4d147a5de59aa4a100eab208f26e1da` |
| Ngày commit | 2026-09-27T23:25:31-04:00 |
| Phiên bản gói lúc chép | `1.0.3` |
| Giấy phép | **MIT** — Copyright (c) 2026 Pascal Group Inc. Xem `LICENSE` cạnh tệp này |

**Không có remote nào trỏ về kho gốc.** Lịch sử git của họ không theo vào: chỉ tệp được chép, nên
mọi thay đổi từ đây là lịch sử của AppFront. Bản clone đầy đủ còn ở `F:/pascal-editor` nếu cần tra
lại hoặc lấy thêm thứ gì.

`LICENSE` và dòng bản quyền **phải giữ nguyên** — đó là điều kiện duy nhất MIT đặt ra, và nó không
cản việc sửa, đổi tên hay bán lại.

## Cái đã chép

| Đường | Cỡ | Vì sao |
|---|---|---|
| `packages/core` | 4,5 MB | Lược đồ node, store cảnh, registry |
| `packages/viewer` | 2,1 MB | Các hệ dựng hình 3D và component `<Viewer>` |
| `packages/editor` | 8,0 MB | Giao diện soạn thảo và component `<Editor>` |
| `packages/nodes` | 13 MB | **Bắt buộc để vẽ được bất cứ thứ gì** — nó nạp registry qua `loadPlugin(builtinPlugin)`; không có nó thì không loại node nào được dựng |
| `packages/typescript-config` | 4 KB | Bốn gói trên kế thừa cấu hình này |
| `assets/material` | 18 MB | Texture `.ktx2`. **Đã đo:** một cảnh AppFront vẽ ra thì viewer đi xin 4 tệp trong số này từ CDN của Pascal — tự host ở đây là để cắt đường gọi ra ngoài đó |
| `assets/hdri` · `assets/fonts` · `assets/icons` | 1,4 MB · 208 KB · 2,4 MB | Môi trường chiếu sáng, phông chữ, icon giao diện soạn thảo |

Phần `dist/`, `node_modules/`, `.turbo/` và `tsconfig.tsbuildinfo` **không** chép — chúng là kết
quả dựng, dựng lại được.

## Cái CỐ Ý không chép

| Bỏ | Cỡ | Vì sao |
|---|---|---|
| `apps/editor/public/items` | 4,5 MB | Thư viện đồ đạc `.glb` của Pascal. Đo được: cảnh AppFront **không gọi tệp nào** trong đó — đồ đạc của AppFront hiện là chỗ giữ chỗ `asset://appfront/<loại>`. Cần thì lấy lại từ `F:/pascal-editor` |
| `apps/editor/public/audios` | 824 KB | Âm thanh giao diện soạn thảo |
| `apps/editor/public/demos` | 44 KB | Cảnh mẫu của Pascal |
| `apps/*`, `packages/{cli,mcp,ifc-converter,ui,eslint-config}` | — | App Next.js, CLI, máy chủ MCP, bộ đổi IFC — không nằm trong phạm vi nhúng |

## Ba điều phải biết trước khi sửa mã trong đây

1. **`packages/editor` không có bước dựng.** Nó xuất thẳng `./src/index.tsx`, và nhập `next/image`
   (26 tệp) cùng `next/link` (1 tệp). AppFront chạy Vite chứ không chạy Next, nên hai đường nhập ấy
   phải được thay bằng shim — tổng cộng 17 dòng, đã có bản chạy được ở `F:/pascal-spike/src/shims/`.
   Không có module `next/*` nào khác: đã đếm, bề mặt đóng ở đúng hai.
2. **`setScene` không chạy zod.** Mọi trường mà lược đồ khai `.default()` sẽ **thiếu hẳn** lúc chạy,
   và bộ vẽ đọc thẳng chúng — thiếu `site.polygon` thì cả cây con biến mất trong im lặng.
   `src/lib/pascal/__tests__/renderContract.test.ts` giữ hàng rào ấy.
3. **Cổng tổng của AppFront không quét thư mục này.** `length`, `typecheck`, `import vòng` và
   `coverage` đều chỉ nhìn `src/**`. Hai cổng có quét là `lint` (`eslint .`) và `test` (vitest tự
   nhặt `*.test.*`), nên cả hai có một dòng loại trừ trỏ vào đây. **Đừng gỡ hai dòng ấy** — mã
   trong thư mục này viết theo luật Biome của Pascal, không theo bảy luật nội bộ của AppFront.

## Đã sửa so với gốc

Mọi chỗ mã trong `vendor/pascal/**` lệch khỏi bản chép gốc (`F:/pascal-editor`, 2026-09-28).
Sửa thêm thì thêm một dòng ở đây — đừng để người sau phải so hai cây mã.

| Tệp | Lý do | Việc F-15 |
|---|---|---|
| `vendor/pascal/packages/editor/src/hooks/use-auto-save.ts` | thêm `validateCommit` + `onCommitRejected` (quyết định 6A của AppFront) — phán quyết của host chạy trên đồ thị vừa sửa TRƯỚC khi lượt ghi được nhận; bị từ chối thì lùi bằng chính `useScene.temporal.undo()` và báo lý do ra host, nên không lượt sửa sai nào thành baseline của hàng rào chống xoá sạch. | T4 |
| `vendor/pascal/packages/editor/src/components/editor/index.tsx` | thêm prop `readOnly` (vai chỉ-xem của AppFront — giữ một `acquireSceneReadOnlyLease()` như nhánh xem phiên bản, nên store khoá, công cụ sửa không kích hoạt, panel tự ẩn nút sửa) và chuyển tiếp `validateCommit`/`onCommitRejected` xuống `useAutoSave`. | T4 |
| `vendor/pascal/packages/editor/dist/hooks/use-auto-save.d.ts` | sinh lại theo bề mặt mới — `CommitVerdict`, `validateCommit`, `onCommitRejected`. | T4 |
| `vendor/pascal/packages/editor/dist/components/editor/index.d.ts` | sinh lại theo bề mặt mới — `EditorProps` thêm `validateCommit`, `onCommitRejected`, `readOnly`. | T4 |
| `vendor/pascal/packages/viewer/src/components/viewer/unsupported-gpu-fallback.tsx` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/viewer/src/components/viewer/perf-panel.tsx` | Việt hoá aria-label (A6) | T5a |
| `vendor/pascal/packages/viewer/src/i18n/vi.ts` | bảng chuỗi tiếng Việt mới cho viewer | T5a |
| `vendor/pascal/packages/editor/src/i18n/*` | bảng chuỗi tiếng Việt mới cho editor (vi.ts + format.ts + regions/*) | T5a |
| `vendor/pascal/packages/editor/src/components/ui/action-menu/*` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/ui/controls/*` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/ui/panels/*` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/ui/primitives/*` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/panels/*` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/ui/floating-level-selector.tsx, slider-demo.tsx` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/editor/*` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/editor-2d/*` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/procedural-items/inspector.tsx` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/viewer/*` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/components/walkthrough-hud.tsx` | Việt hoá chuỗi UI (A6) | T5a |
| `vendor/pascal/packages/editor/src/lib/measurements.ts, lib/floorplan/schedules.ts` | định dạng số kiểu Việt (dấu phẩy, có đơn vị) + Việt hoá chuỗi UI | T5a |
| `vendor/pascal/packages/editor/src/lib/floorplan/floorplan-export.tsx, lib/glb-export.ts, lib/level-print-export.ts, lib/lot/parcel-provider.ts, lib/print-3mf.ts, lib/print-shell-compiler-manifold-core.ts, lib/print-shell-compiler-manifold-worker.ts` | Việt hoá chuỗi UI/chẩn đoán hiển thị cho người dùng (A6) | T5a |
| `vendor/pascal/packages/nodes/src/i18n/vi.ts` | bảng chuỗi tiếng Việt mới cho nodes (catalog label, gợi ý phím, nhãn khe vật liệu) | T5b |
| `vendor/pascal/packages/nodes/src/i18n/vi.test.ts` | bài kiểm duyệt đệ quy bảng vi (A6) | T5b |
| `vendor/pascal/packages/nodes/src/{block,box-vent,building,cabinet,ceiling,chimney,column,construction-dimension,cupola,door,dormer,downspout,duct-fitting,duct-segment,duct-terminal,elevator,eyebrow-vent,fence,guide,gutter,hvac-equipment,imported-mesh,item,lean-to-extension,level,lineset,liquid-line,measurement,pipe-fitting,pipe-segment,pipe-trap,procedural-item,ridge-vent,roof,roof-segment,scan,shelf,site,skylight,slab,solar-panel,spawn,stair,stair-segment,structural-grid,turbine-vent,unit,window,zone}/definition.ts` | Việt hoá nhãn catalog, gợi ý phím (toolHints), nhãn khe vật liệu (A6) — dùng bảng vi.ts | T5b |
| `vendor/pascal/packages/core/src/i18n/vi.ts` | bảng chuỗi tiếng Việt mới cho core (mẫu kết cấu tường) | T5b |
| `vendor/pascal/packages/core/src/i18n/vi.test.ts` | bài kiểm duyệt đệ quy bảng vi (A6) | T5b |
| `vendor/pascal/packages/core/src/systems/wall/wall-assembly.ts` | Việt hoá nhãn 8 mẫu kết cấu tường + 2 ghi chú "unverified" hiện trong inspector (A6) | T5b |
| `vendor/pascal/scripts/bun-preload-three.ts` | chép bổ sung — thiếu từ lần chép 2026-09-28, chặn mọi `bun test` (mọi `packages/*/bunfig.toml` đều preload nó). Thêm một `Bun.plugin` trỏ `next/image`/`next/link` sang `vendor/pascal/shims/*`, cùng hai shim mà `vitest.config.ts` dùng, để `bun test` của `nodes`/`editor` phân giải được mà không phải sửa mã test | M1 |
| `vendor/pascal/packages/editor/src/components/editor/index.tsx` | áp bảng `vi` của T5a cho 4 chuỗi UI còn lại (`vi-T5a.fragment`) — A6 | M1 |
| `vendor/pascal/packages/nodes/src/wall/definition.ts` | áp bảng `vi` của T5b cho nhãn catalog/gợi ý phím của tường, kèm nhãn chip, tooltip và mô tả cạnh chúng (`vi-T5b.fragment`) — A6 | M1 |
| `vendor/pascal/packages/nodes/src/i18n/vi.ts` | thêm khoá `wall.*` còn thiếu (nhãn chip hình dạng, tooltip, số vết cắt, mô tả) cho các chuỗi vừa áp | M1 |
| `vendor/pascal/packages/editor/src/store/use-floorplan-mode.ts` | Việt hoá hai câu thông báo ghép quanh nhãn công cụ đã dịch (nợ T5a) — A6 | M1 |
| `vendor/pascal/packages/editor/src/components/ui/action-menu/measurement-control.tsx` | nhãn công cụ truyền vào thông báo đổi sang `vi.measurementControl.constructionDimension` — A6 | M1 |
| `vendor/pascal/packages/editor/src/components/editor/snapshot-capture.ts` | Việt hoá 3 lý do lỗi `reportFailure` (hiện lên overlay chụp ảnh) — A6 | M1 |
| `vendor/pascal/packages/editor/src/lib/lot/{drop-in,terrain}.ts` | Việt hoá các lý do lỗi/ghi chú hiện trong panel Site (`setStatus(result.message)`) — A6 | M1 |
| `vendor/pascal/packages/editor/src/i18n/format.ts` | thêm `toFixedVi` (dấu phẩy thập phân, A15) và `normalizeDecimalVi` (phân tích nhận cả "," và ".") | M1 |
| `vendor/pascal/packages/editor/src/components/editor/floorplan-panel.tsx` | `formatNumber` xuất dấu phẩy và `parseReferenceScaleLength`/`referenceScaleLengthHint` nhận cả hai dấu — cặp định dạng/phân tích đổi cùng lúc (A15) | M1 |
| `vendor/pascal/packages/editor/src/components/ui/controls/slider-control.tsx` | ô nhập và số hiện ra dùng `toFixedVi`, phân tích qua `normalizeDecimalVi` — cặp định dạng/phân tích đổi cùng lúc (A15) | M1 |
| `vendor/pascal/packages/editor/src/i18n/regions/{libStrings,editorAndViewer,controlsAndPanels,editorRootDoNotEdit}.ts` | thêm khoá cho các chuỗi vừa Việt hoá ở trên; bỏ ghi chú "chưa áp dụng" của `editorRoot` | M1 |
| `vendor/pascal/packages/viewer/src/components/viewer/index.tsx` | bỏ `transition-colors duration-700` trên `<Canvas>` — bất biến B của AppFront chỉ cho 120/180/260/340 ms khi chuyển trạng thái, 700 ms dành riêng cho hiệu ứng lặp; nền viewer nay đổi màu tức thì. | T3 |
| `vendor/pascal/packages/viewer/src/components/viewer/frame-limiter.tsx` | vẽ theo nhu cầu. `FrameLimiter` lái R3F bằng tay (`frameloop: 'never'`) và trước đây đẩy một khung MỖI nhịp rAF, mãi mãi — cảnh đứng yên vẫn trả tiền cho ~50 khung/giây gồm mọi system cộng một lượt vẽ, đó là chỗ `docs/pascal/01-ho-so-cong-T4.1.md` §8d đo ra ~1,6 lần CPU luồng chính. Nay chỉ đẩy khung khi có nhu cầu: bộ đếm `internal.frames` của R3F (mọi lượt đổi prop và mọi `invalidate()` của Pascal đều tăng nó), việc còn nợ (`dirtyNodes`, animation cửa/cửa sổ — hai hệ ấy cố ý không đánh dấu bẩn mỗi nhịp), một lượt chụp đang giữ khung (`isLiveFrameHeld`), hoặc 500 ms sau thao tác chuột/bàn phím cuối (xoay camera, hover, công cụ mutate thẳng ba đối tượng nên không ai gọi `invalidate`). Thêm `?frameloop=always` làm công tắc ĐO: lái theo lối cũ trên cùng một bản dựng để so trước/sau. | T3 |
| `vendor/pascal/packages/viewer/src/components/viewer/post-processing.tsx` | `invalidate()` khi màu nền còn đang lerp về màu chủ đề. Đây là hiệu ứng duy nhất của viewer cần những khung không ai xin: đổi chủ đề chỉ `invalidate` một lần, mà vòng khung nay chỉ chạy theo nhu cầu. Ngưỡng 1/255 — dưới đó không thấy gì — nên nó tắt ngay khi màu đã tới. | T3 |
| `vendor/pascal/packages/viewer/src/components/viewer/frame-limiter.test.ts` | thêm 6 bài cho `frameDemanded` (cảnh đứng yên nợ 0 khung trong một giây 50 fps; bộ đếm R3F, việc còn nợ, lượt chụp và đuôi thao tác đều đánh thức vòng khung). | T3 |
| `vendor/pascal/packages/viewer/src/components/viewer/frame-limiter.tsx (lần 2, sau khi đo trên trình duyệt thật)` | cổng nhu cầu CHỈ có hiệu lực sau khi cảnh dựng xong lần đầu (`sceneSettled`). Chặn khung trong lượt dựng đầu làm màn kẹt ở "Đang nạp khung dựng hình…": chuỗi sẵn sàng (SceneReadyTracker, lượt nạp vật liệu/đồ đạc, ngân sách tường tăng dần) cần những khung không ai `invalidate()`, và mất một khung là mất luôn cả chuỗi. Cùng lần: đọc bộ đếm nhu cầu của R3F qua `useStore()` thay vì selector `state.internal` — chỗ nào định danh của object ấy không bền thì effect chạy lại mỗi lượt vẽ và vòng rAF khởi động lại với mốc đồng hồ mới, nên khung đầu sau đó không bao giờ đẩy. | T3 |
| `vendor/pascal/packages/viewer/src/components/viewer/index.tsx` | `SceneReadyTracker` gọi `setViewerSceneSettled(true/false)` — một chỗ duy nhất biết "cảnh đã dựng xong lần đầu", và nó cũng là chỗ đã có `sceneReadyKey` để mở lại cổng khi nạp cảnh mới. | T3 |
| `vendor/pascal/packages/viewer/src/components/viewer/post-processing.tsx (sửa lại)` | `THREE.Color` KHÔNG có `manhattanDistanceTo` (đó là của `Vector3`) — gọi nó ném lỗi ngay trong khung, và `FrameLimiter` báo đó là vòng vẽ đã chết; cảnh không bao giờ sẵn sàng. So từng kênh màu bằng `colorsDiffer`. | T3 |
| `vendor/pascal/packages/editor/src/lib/floorplan/floorplan-export.tsx` | xoá hàm `exportFloorplanPdf` (gọi `createFloorplanPdfDocument`/`renderFloorplanGeometryToPdfKit`) và hai import của nó — AppFront không gọi hàm này, không có đường vào UI nào khác dùng nó ngoài nút "Export floor plan" của settings-panel đã gỡ cùng lượt này. Các export khác của tệp (geometry/placement, `collectFloorplanSchedules`…) vẫn dùng bởi `schedules.ts`/2D nên giữ nguyên. | T6 |
| `vendor/pascal/packages/editor/src/lib/floorplan/floorplan-pdfkit-document.ts` | XOÁ tệp — chỉ còn người gọi là `exportFloorplanPdf` (đã xoá) và `sheet-export.ts` (đã xoá). | T6 |
| `vendor/pascal/packages/editor/src/lib/floorplan/floorplan-pdfkit-renderer.ts + floorplan-pdfkit-renderer.test.ts` | XOÁ — cùng lý do trên; không ai gọi `renderFloorplanGeometryToPdfKit` ngoài hai chỗ vừa xoá. | T6 |
| `vendor/pascal/packages/editor/src/lib/floorplan/sheet-export.ts + sheet-export.test.ts` | XOÁ — `exportSheetsToPdf`/`collectSheetGeometry` chỉ được tái xuất ra barrel (`index.tsx`), không nơi nào trong gói editor tự gọi, và AppFront không nhập tên nào từ barrel ngoài component `Editor`. | T6 |
| `vendor/pascal/packages/editor/src/lib/floorplan/floorplan-export.test.ts` | gỡ đoạn dựng `PDFDocument`/`FloorplanPdfDocument`/`renderFloorplanGeometryToPdfKit` bên trong bài `collectFloorplanGeometry` (kiểm tra hình học, không kiểm riêng việc xuất PDF) và ba import trỏ tới các tệp đã xoá — phần còn lại của bài giữ nguyên. | T6 |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/panels/settings-panel/index.tsx` | gỡ nút "Full floor plan"/"Structure only" (mục "Floor plan" trong panel Settings, gọi `exportFloorplanPdf`) cùng state/handler của nó (`activeFloorplanExport`, `floorplanExportError`, `handleFloorplanExport`) và import `MapIcon`/`useFloorplanMode` đã thành thừa. | T6 |
| `vendor/pascal/packages/editor/src/index.tsx` | barrel bớt `exportFloorplanPdf` (giữ type `FloorplanExportScope`) và cả khối "Sheets" (`exportSheetsToPdf`, `collectSheetGeometry`, `POINTS_PER_INCH`, `resolveSheetRotationDeg`, các type `SheetPdfPage`/`SheetPdfWindow`/`SheetGeometryEntry`/`SheetGeometryOptions`) vì nguồn của chúng (`sheet-export.ts`) đã xoá; `collectFloorplanSchedules` nay tái xuất từ `floorplan-export.tsx` (định nghĩa gốc của nó, không đổi hành vi). | T6 |
| `vendor/pascal/packages/editor/package.json` | gỡ `pdfkit`, `@types/pdfkit`, `blob-stream`, `@types/blob-stream` khỏi dependencies/devDependencies — không còn nơi nào trong gói nhập chúng. | T6 |
| `Bề mặt API `@pascal-app/editor` đổi (mất `exportFloorplanPdf`, `exportSheetsToPdf`, `collectSheetGeometry`, `POINTS_PER_INCH`, `resolveSheetRotationDeg`, type `SheetPdf*`/`SheetGeometry*`; `collectFloorplanSchedules` nay từ `floorplan-export`) — `dist/*.d.ts` của gói cần sinh lại (xem "Nợ" trong bao-cao-T6.md` | biome/bun chạy được trên máy này nhưng lệnh sinh `.d.ts` của Pascal không có trong `NGUON.md`, nên d.ts cũ CHƯA được sinh lại trong lượt này). | T6 |
| `vendor/pascal/packages/nodes/src/*/{panel.tsx,parametrics.ts}` | Việt hoá nhãn inspector/trường/nút (`vi.common.*`, ~290 khoá mới) — 699 chuỗi, trừ `wall/**` (A6) | T5c |
| `vendor/pascal/packages/core/src/material-library.ts` | Việt hoá 129 `label` + 129 `description` của thư viện vật liệu, giữ nguyên mọi `id` (A6) | T5c |
| `vendor/pascal/packages/editor/src/lib/floorplan/floorplan-export.tsx, components/ui/sidebar/panels/settings-panel/index.tsx` | giải xung đột T5a↔T6 theo ý T6: khối `exportFloorplanPdf` và mục "Mặt bằng" của panel Settings (có chuỗi Việt của T5a) bị xoá cùng lượt gỡ pdfkit. Sáu khoá `vi.settingsPanel.*` của mục ấy thành chuỗi chết, cố ý giữ | M1 |
| `vendor/pascal/packages/editor/src/lib/{measurements,floorplan/schedules,level-print-export,print-3mf,print-golden-house,floorplan/floorplan-export,lot/drop-in,lot/terrain}.test.ts, components/editor/snapshot-capture.test.ts, i18n/vi.test.ts` | kỳ vọng test đi theo chuỗi đã Việt hoá và dấu phẩy thập phân — trước M1 chưa tệp nào trong vendor chạy được nên không ai thấy chúng đỏ | M1 |
