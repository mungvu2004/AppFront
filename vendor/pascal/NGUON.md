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
| `assets/items` | 2 010 KiB (200 tệp) | `model.glb` + `thumbnail.webp` của 100 thư mục (101 mẫu; `cabinet` và `kitchen-cabinet` dùng chung) thư viện đồ đạc, từ `apps/editor/public/items` — catalog gốc trỏ supabase.co, CSP chặn (QA-05c B4) |

Phần `dist/`, `node_modules/`, `.turbo/` và `tsconfig.tsbuildinfo` **không** chép — chúng là kết
quả dựng, dựng lại được.

## Cái CỐ Ý không chép

| Bỏ | Cỡ | Vì sao |
|---|---|---|
| `apps/editor/public/items` (phần thừa) | 2,5 MB | 44 thư mục không mẫu catalog nào dùng. 100 thư mục (101 mẫu) catalog dùng ĐÃ chép về `assets/items` (QA-05c B4, xem dưới) |
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
| `vendor/pascal/packages/core/src/schema/review.ts` | thêm lược đồ `Review` (reviewed/confidence/source) cho trạng thái duyệt A5 (#5 #26 #27 #81) | W2A |
| `vendor/pascal/packages/core/src/schema/review.test.ts` | bài bun cho `Review` (biên 0–1, nguồn ai/human, không va `source` của plugin) | W2A |
| `vendor/pascal/packages/core/src/schema/base.ts` | `BaseNode.review` tuỳ chọn — mọi node mang được trạng thái duyệt | W2A |
| `vendor/pascal/packages/core/src/schema/index.ts` | export `Review`, `ReviewSource` | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/review-section.tsx` | panel "Kiểm duyệt" — độ tin cậy %, nút Duyệt/Bỏ qua, chấm 3 màu (A4/A5) | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/parametric-inspector.tsx` | gắn `ReviewSection` vào inspector | W2A |
| `vendor/pascal/packages/editor/src/i18n/regions/controlsAndPanels.ts` | chữ tiếng Việt của panel kiểm duyệt | W2A |
| `vendor/pascal/packages/core/dist/**/*.d.ts` (58 tệp + schema/review.d.ts) | sinh lại bằng `tsc --build` trong gói core vì `BaseNode.review` mở rộng mọi node; chỉ giữ tệp có thay đổi nội dung | W2A |
| `vendor/pascal/packages/editor/src/lib/floorplan/room-area.ts` (+test) | `readStatus` đọc trường A5 `zone.review` qua `reviewStateOf` của core thay cho `metadata.reviewed/confidence` tạm của W2-D | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/inspector-state.ts` (+test) | bộ phân giải bảy trạng thái của inspector (#1/#14) | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/inspector-notice.tsx` | thông báo cho hai trạng thái từng hiện trắng (vai người xem, đối tượng đã mất) | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/panel-manager.tsx` | gọi `inspectorStateOf`, hiện `InspectorNotice` cho forbidden/error | W2A |
| `vendor/pascal/packages/editor/src/lib/floorplan/furniture-clash.ts` (+test) | dò đồ đạc sàn chồng lên nhau bằng `itemOverlapsPolygon` của core, mang tên + mã `FURNITURE-CLASH` (#22) | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/furniture-clash-panel.tsx` | bảng phụ "Va chạm đồ đạc"; bấm dòng chọn đồ đạc | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/appfront-panels.tsx` | thêm bảng "Va chạm đồ đạc" vào `appFrontEditorPanels` | W2A |
| `vendor/pascal/packages/editor/src/i18n/regions/furnitureClash.ts`, packages/editor/src/i18n/vi.ts | chữ tiếng Việt của bảng va chạm | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/save-as-template.tsx` | nút "Lưu làm khuôn mẫu" + context nhận callback của host (#25) | W2A |
| `vendor/pascal/packages/editor/src/components/editor/index.tsx` | prop `onSaveAsTemplate` của `EditorProps`, cấp qua context | W2A |
| `vendor/pascal/packages/editor/dist/components/editor/index.d.ts` | thêm `onSaveAsTemplate` vào `EditorProps` (sửa tay) | W2A |
| `vendor/pascal/packages/core/src/store/actions/node-actions.ts` | `updateNodesAction` gọi `withReviewCleared` để dấu duyệt mất ngay khi sửa hình học | W2A |
| `vendor/pascal/packages/core/src/registry/types.ts` | `ParamField` thêm kiểu `link` (href theo node), `ParamGroup.role?: 'inspection'` (#28) | W2A |
| `vendor/pascal/packages/editor/src/components/ui/panels/parametric-field-control.tsx` | vẽ kiểu `link` thành liên kết mở tab mới | W2A |
| `vendor/pascal/packages/nodes/src/wall/opening-rescale.ts` (mới) + opening-rescale.test.ts | cửa/cửa sổ giữ tỉ lệ vị trí dọc tường khi tường đổi dài (#6) | W2B |
| `vendor/pascal/packages/nodes/src/wall/move-endpoint-tool.tsx` | lúc commit kéo đỉnh, dịch cửa/cửa sổ của tường bị kéo và tường nối theo tỉ lệ, cùng một bước hoàn tác (#6) | W2B |
| `vendor/pascal/packages/editor/src/components/tools/wall/wall-snap-geometry.ts` | thêm WALL_DRAFT_SNAP_LABELS — tên tiếng Việt của bốn loại bắt điểm (#7) | W2B |
| `vendor/pascal/packages/editor/src/components/editor/wall-snap-beacon-layer.tsx` | hiện nhãn bắt điểm ("Đầu mút", "Giữa", "Giao điểm", "Vuông góc") cạnh cột mốc 3D (#7) | W2B |
| `vendor/pascal/packages/editor/src/components/editor-2d/floorplan-snap-beacon-layer.tsx` | hiện cùng nhãn bắt điểm trên mặt bằng 2D (#7) | W2B |
| `vendor/pascal/packages/editor/src/i18n/regions/wallMeasure.ts` (mới) + i18n/vi.ts | bảng chuỗi nhãn bắt điểm + tên "Phép đo N" (A6) | W2B |
| `vendor/pascal/packages/editor/src/lib/measurements.ts` + measurements.test.ts | formatLinearMeasurement dùng dấu phẩy thập phân (A15) và có nấc 'centimeters' (#57/#60/#64) | W2B |
| `vendor/pascal/packages/editor/src/store/use-measurement-draft.ts` | phép đo vừa ghim tên "Phép đo N" thay "Measurement N" (#62) | W2B |
| `vendor/pascal/packages/editor/dist/lib/measurements.d.ts` | MetricNotation thêm 'centimeters' (sửa tay theo nguồn, lệnh sinh .d.ts chưa có trong NGUON.md) | W2B |
| `vendor/pascal/packages/nodes/src/measurement/renderer.tsx` | khi đang rê lên một phép đo, các phép đo khác mờ đi (opacity 0,3) (#68); nhãn "Unlinked · " → "Mất liên kết · " (A6) | W2B |
| `vendor/pascal/packages/nodes/src/measurement/floorplan.ts` + floorplan.test.ts | nhãn "Unlinked · " → "Mất liên kết · " trên mặt bằng (A6) | W2B |
| `vendor/pascal/packages/nodes/src/i18n/vi.ts` | thêm measurement.unlinkedPrefix | W2B |
| `vendor/pascal/packages/editor/src/components/ui/panels/wall-vertex-table.ts` (mới) + wall-vertex-table.test.ts | dời một đỉnh tường kéo theo tường nối cùng tầng, đọc số có dấu phẩy (#11) | W2B |
| `vendor/pascal/packages/editor/src/components/ui/panels/wall-vertex-panel.tsx` (mới) | bảng phụ "Bảng đỉnh" — sửa x/y hai đầu tường, phím mũi tên/nút dịch 10 mm, một bước hoàn tác, khoá ở vai chỉ xem (#11) | W2B |
| `vendor/pascal/packages/editor/src/components/ui/panels/appfront-panels.tsx` | gắn bảng "Bảng đỉnh" vào danh sách bảng phụ AppFront | W2B |
| `vendor/pascal/packages/editor/src/components/ui/primitives/sidebar.tsx` | thêm `motion-reduce:transition-none` cho hai lớp trượt của sidebar — AppFront bất biến #33 (panel trượt phải tôn trọng `prefers-reduced-motion`) | W2C1 |
| `vendor/pascal/packages/editor/src/lib/history.ts` | thêm `subscribeHistoryJumps`/`HistoryJumpKind` và phát sự kiện trong `runUndo`/`runRedo` — host hiện toast hoàn tác (A8, #55) | W2C1 |
| `vendor/pascal/packages/editor/src/index.tsx` | xuất `subscribeHistoryJumps`, `HistoryJumpKind`, `HistoryJumpListener` | W2C1 |
| `vendor/pascal/packages/viewer/src/systems/level/level-camera-focus.tsx` | tệp mới — `levelBounds`, `fitToBounds(levelId)`, `<LevelCameraFocus/>` khuôn camera vào tầng khi đổi tầng (#35) | W2C1 |
| `vendor/pascal/packages/viewer/src/components/viewer/index.tsx` | gắn `<LevelCameraFocus/>` trong `ViewerScene` (#35) | W2C1 |
| `vendor/pascal/packages/viewer/src/index.ts` | xuất `fitToBounds`, `levelBounds`, `LevelCameraFocus`, `LevelFraming` | W2C1 |
| `vendor/pascal/packages/editor/src/lib/fold-search.ts` | tệp mới — `foldForSearch` + `foldedCommandFilter`, bỏ dấu tiếng Việt khi tìm (#42) | W2C1 |
| `vendor/pascal/packages/editor/src/lib/fold-search.test.ts` | tệp mới — 9 bài bun test cho bộ bỏ dấu (#42) | W2C1 |
| `vendor/pascal/packages/editor/src/components/ui/command-palette/index.tsx` | truyền `filter={foldedCommandFilter}` cho `<Command>` của cmdk (#42, Ctrl+F tìm không dấu) | W2C1 |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/panels/plugins-panel.tsx` | vai chỉ xem GỠ nút cài/gỡ khỏi DOM thay vì `disabled` (#30/#41) | W2C1 |
| `vendor/pascal/packages/editor/dist/lib/history.d.ts` | sinh lại theo bề mặt mới — `HistoryJumpKind`, `HistoryJumpListener`, `subscribeHistoryJumps` | W2C1 |
| `vendor/pascal/packages/editor/dist/index.d.ts` | sinh lại theo bề mặt mới — ba tên trên | W2C1 |
| `vendor/pascal/packages/editor/src/components/editor/index.tsx` | `noEditing` của cảnh gồm cả `scene.readOnly` — vai chỉ xem không gắn tay nắm/menu nổi vào DOM (#30/#41) | W2C1 |
| `vendor/pascal/packages/viewer/src/systems/section-plane/section-plane.tsx` | tệp mới — `useSectionPlane`, `SectionPlaneGroup` (ClippingGroup WebGPU bọc cảnh, luôn gắn, chỉ lật `enabled`), `sectionPlaneAt` — mặt cắt ngang kéo được (#32) | W2C1 |
| `vendor/pascal/packages/viewer/src/systems/section-plane/section-plane.test.ts` | tệp mới — 5 bài bun test (mặt cắt, kẹp độ cao, dấu phẩy, tư thế ViewCube) | W2C1 |
| `vendor/pascal/packages/viewer/src/components/viewer/section-plane-control.tsx` | tệp mới — thanh trượt độ cao mặt cắt (input range, A12), số dấu phẩy (#32) | W2C1 |
| `vendor/pascal/packages/viewer/src/components/viewer/view-cube.tsx` | tệp mới — `ViewCube` (6 nút hướng nhìn) + `ViewCubeBridge` trong canvas phát `camera-controls:apply-pose` (#34) | W2C1 |
| `vendor/pascal/packages/viewer/src/i18n/vi.ts` | chuỗi `sectionPlane`, `viewCube` | W2C1 |
| `vendor/pascal/packages/viewer/dist/index.d.ts`, dist/systems/section-plane/section-plane.d.ts, dist/components/viewer/{view-cube,section-plane-control}.d.ts, dist/systems/level/level-camera-focus.d.ts | sinh bằng `tsc --emitDeclarationOnly` (level-camera-focus.d.ts bị sót ở lượt #35) | W2C1 |
| `vendor/pascal/packages/editor/src/components/ui/command-palette/editor-commands.tsx` | lệnh "Bật/Tắt mặt cắt" (#32) | W2C1 |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/panels/settings-panel/keyboard-shortcuts-dialog.tsx` | một hộp phím tắt duy nhất (`useShortcutsDialog` + `KeyboardShortcutsDialogHost`), nút ở bảng cài đặt chỉ mở nó; thêm nhóm "Tìm và trợ giúp" (`?`, Ctrl+F); xuất `SHORTCUT_CATEGORIES` (#23/#37) | W2C1 |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/panels/settings-panel/keyboard-shortcuts-dialog.test.ts` | tệp mới — 3 bài bun test, gồm bài báo trùng tổ hợp phím (A12) | W2C1 |
| `vendor/pascal/packages/editor/src/hooks/use-keyboard.ts` | `?` mở bảng phím tắt (#23) | W2C1 |
| `vendor/pascal/packages/viewer/src/systems/level/level-utils.ts` | thêm `useLevelExplode` (độ tách liên tục 0→1, #31/#98), `isLevelLabelVisible` (#100), `prefersReducedMotion` (#102), `findLevelMisalignments` (#101); `getLevelPresentationY` nhân độ tách | W2C2 |
| `vendor/pascal/packages/viewer/src/systems/level/level-system.tsx` | khoảng tách nhân `useLevelExplode.amount`; giảm chuyển động thì nhảy thẳng (#102) | W2C2 |
| `vendor/pascal/packages/viewer/src/systems/level/level-utils.test.ts` | bài cho kẹp độ tách, ngưỡng nhãn, lệch trục | W2C2 |
| `vendor/pascal/packages/viewer/src/index.ts` + dist/index.d.ts + dist/systems/level/level-utils.d.ts | xuất API tách tầng mới (sửa tay .d.ts, chưa chạy `pnpm pascal`) | W2C2 |
| `vendor/pascal/packages/editor/src/components/ui/floating-level-selector.tsx` | thanh trượt "Tách tầng" liên tục (#31/#98), dòng cao độ + diện tích (`metadata.appfront.areaM2`) dưới mỗi thẻ tầng, chỉ hiện khi tách đủ xa (#99/#100), cảnh báo lệch trục giữa tầng liên tiếp (#101) | W2C2 |
| `vendor/pascal/packages/editor/src/i18n/regions/overlayLevels.ts` | chữ tiếng Việt cho thanh tách tầng, cao độ, diện tích, lệch trục | W2C2 |
| `vendor/pascal/packages/editor/src/lib/floorplan/room-area.ts` | thêm mô hình dữ liệu bảng "Diện tích phòng" (nhóm tầng/công năng + tổng phụ, sắp xếp, lọc tầng, thu gọn 5 phòng lớn nhất, thanh xếp chồng ≤ 3 dải A4, đếm cửa/cửa sổ theo tường bao, chu vi/cao, chấm trạng thái A5, sao chép bảng) — F-15 W2-D #71–86 | W2D |
| `vendor/pascal/packages/editor/src/lib/floorplan/room-area.test.ts` | 12 bài bun:test cho mô hình trên (tổng phụ cộng đúng tổng, cap 3 dải, A5 chỉ `reviewed` mới xanh) | W2D |
| `vendor/pascal/packages/editor/src/components/ui/panels/room-area-panel.tsx` | bảng phụ "Diện tích phòng" trong editor — bấm dòng chọn + khuôn camera (`camera-controls:focus`), hover đồng bộ panel ↔ 3D qua `useViewer.hoveredId`, sửa tên tại chỗ tự lưu 800 ms + hoàn tác 8 s, trạng thái rỗng "Kiểm tra khe hở tường", chú giải | W2D |
| `vendor/pascal/packages/editor/src/components/ui/panels/appfront-panels.tsx` | danh sách `ExtraPanel` của AppFront, khai trong vendor vì `component` là component React mà Pascal chạy ở gốc React thứ hai | W2D |
| `vendor/pascal/packages/editor/src/i18n/regions/roomArea.ts` | bảng chuỗi tiếng Việt cho hai tệp trên (A6 hoa chữ đầu, A15 dấu phẩy qua i18n/format) | W2D |
| `vendor/pascal/packages/editor/src/i18n/vi.ts` | thêm 2 dòng ghép vùng `roomArea` (chỉ thêm, không sửa dòng người khác) | W2D |
| `vendor/pascal/packages/editor/src/index.tsx` | thêm 2 dòng xuất `appFrontEditorPanels`, `RoomAreaPanel` | W2D |
| `vendor/pascal/packages/editor/dist/index.d.ts` | thêm 2 dòng khai báo cho hai xuất mới (viết tay — NGUON.md chưa có lệnh sinh .d.ts, cùng nợ T6) | W2D |
| `vendor/pascal/packages/editor/dist/components/ui/panels/appfront-panels.d.ts` | khai báo mới (viết tay) | W2D |
| `vendor/pascal/packages/editor/dist/components/ui/panels/room-area-panel.d.ts` | khai báo mới (viết tay) | W2D |
| `vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-filter.ts` | thêm 9 nhóm lọc cố định + tìm bỏ dấu (fold NFD, `đ`→`d`) cho lưới thẻ đồ đạc — F-15 W2-D #104 | W2D |
| `vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-filter.test.ts` | 9 bài bun:test cho bộ lọc trên | W2D |
| `vendor/pascal/packages/editor/src/components/ui/item-catalog/item-catalog.tsx` | thêm hai prop `monochrome` (#103, A1) và `readOnly` (#108) — chỉ thêm dòng, mặc định của Pascal không đổi | W2D |
| `vendor/pascal/packages/editor/src/components/ui/panels/furniture-library-panel.tsx` | bảng phụ "Thư viện đồ đạc" — 9 chip + ô tìm bỏ dấu + lưới đơn sắc + vai chỉ xem | W2D |
| `vendor/pascal/packages/editor/src/i18n/regions/furnitureLibrary.ts` | bảng chuỗi tiếng Việt cho bảng phụ trên | W2D |
| `vendor/pascal/packages/editor/dist/components/ui/panels/furniture-library-panel.d.ts` | khai báo mới (viết tay) | W2D |
| `vendor/pascal/packages/editor/src/components/ui/floating-level-selector.tsx` | thêm `LevelSourceBadges` — dấu "tầng đã có ảnh nguồn / hình học" cạnh tên tầng (#96); chỉ thêm dòng (W2-C2 cũng sửa tệp này) | W2D |
| `vendor/pascal/packages/editor/src/i18n/regions/overlayLevels.ts` | ba chuỗi tiếng Việt cho dấu trên | W2D |
| `vendor/pascal/packages/editor/src/components/ui/item-catalog/batch-replace.ts` (mới) | nhóm đồ đạc "Đã phát hiện" (asset `appfront-*`), xem trước khô và áp cả lô một bước hoàn tác (#105, #106) | W2D2 |
| `vendor/pascal/packages/editor/src/components/ui/item-catalog/batch-replace.test.ts` (mới) | bun test cho nhóm, xem trước, một bước hoàn tác | W2D2 |
| `vendor/pascal/packages/editor/src/components/ui/item-catalog/item-catalog.tsx` | thẻ kéo được (`draggable`, dataTransfer mang id mẫu) — #107 | W2D2 |
| `vendor/pascal/packages/editor/src/components/ui/panels/detected-furniture-strip.tsx` (mới) | dải "Đã phát hiện" ghim đầu, "Thay thế tất cả", nhận thả thẻ, hộp xem trước (#105–#107) | W2D2 |
| `vendor/pascal/packages/editor/src/components/ui/panels/furniture-library-panel.tsx` | gắn dải "Đã phát hiện" lên đầu bảng | W2D2 |
| `vendor/pascal/packages/editor/src/i18n/regions/furnitureLibrary.ts` | chuỗi tiếng Việt của dải và hộp xem trước | W2D2 |
| `vendor/pascal/packages/editor/src/lib/floorplan/guide-scale.ts` (mới) | tìm ảnh nguồn tầng khác đã hiệu chỉnh mà tỉ lệ lệch quá 2% (#95) | W2D2 |
| `vendor/pascal/packages/editor/src/lib/floorplan/guide-scale.test.ts` (mới) | bun test cho phép so tỉ lệ giữa hai tầng | W2D2 |
| `vendor/pascal/packages/editor/src/components/ui/panels/reference-panel.tsx` | cảnh báo lệch tỉ lệ giữa hai tầng (#95), lời nhắc khi ảnh đang khoá (#97) | W2D2 |
| `vendor/pascal/packages/editor/src/i18n/regions/controlsAndPanels.ts` | nhãn "Khoá ảnh"/"Mở khoá ảnh", lời nhắc khoá, câu cảnh báo lệch tỉ lệ (dấu phẩy A15) | W2D2 |
| `vendor/pascal/packages/editor/src/lib/offline-icons.ts` | file mới — nạp 5 bộ biểu tượng offline (`addCollection` từ `@iconify/react/offline`) thay vì để `@iconify/react` gọi `api.iconify.design`/`api.simplesvg.com`/`api.unisvg.com` lúc chạy (CSP `connect-src` chặn, biểu tượng vỡ). | W2F |
| `vendor/pascal/packages/editor/src/lib/icon-data/{lucide,ph,mdi,carbon,qlementine-icons}.json` + README.md | file mới — tập con Iconify (18 icon) lấy một lần từ `api.iconify.design/<prefix>.json?icons=...` (dạng `addCollection` cần), commit thẳng, không cài `@iconify-json/*`. | W2F |
| 14 tệp vendor/pascal/packages/editor/src/components/**/*.tsx | đổi `import { Icon[ as X] } from '@iconify/react'` → `from '../../../lib/offline-icons'` (đường tương đối theo độ sâu) — nơi duy nhất còn `@iconify/react` (có API) là `package.json`, không còn trong `src`. | W2F |
| `vendor/pascal/packages/editor/src/components/tools/site/site-flag-model.ts` | thêm `decodeBase64ToArrayBuffer` + `useSiteFlagScene()` (gọi `GLTFLoader.parse()` thẳng trên `ArrayBuffer`, Suspense thủ công), bỏ `export const SITE_FLAG_MODEL_URL` (chuỗi `data:model/gltf-binary;base64,...`). Lý do: `three` 0.186 `FileLoader.load()` nay luôn `fetch()` cả `data:` URI (bản cũ có nhánh giải trực tiếp, bản này không), nên CSP `connect-src 'self'` chặn — không phải lỗi logic. | W2F |
| `vendor/pascal/packages/editor/src/components/tools/site/site-boundary-editor.tsx` | bỏ `useGLTF`/`SITE_FLAG_MODEL_URL`, dùng `useSiteFlagScene('/draco/')`. | W2F |
| `vendor/pascal/packages/nodes/src/i18n/vi.ts` | thêm khối wall.panel, wall.curtain, cabinet.panel, dormer.panel, gutter.panel, unit.panel, zone.panel (nhãn inspector tiếng Việt) | S13 |
| `vendor/pascal/packages/nodes/src/wall/panel.tsx` | nhãn inspector tường lấy từ vi.wall.panel | S13 |
| `vendor/pascal/packages/nodes/src/wall/panel-model.ts` | hàng bảng thuộc tính tường (mục, nhãn, giá trị cycle) lấy từ vi.wall.panel | S13 |
| `vendor/pascal/packages/nodes/src/wall/curtain-wall-panel.tsx` | nhãn inspector vách kính lấy từ vi.wall.curtain | S13 |
| `vendor/pascal/packages/nodes/src/cabinet/{compartment-card,run-panel}.tsx` | nhãn inspector tủ bếp lấy từ vi.cabinet.panel | S13 |
| `vendor/pascal/packages/nodes/src/dormer/panel-{actions,position,windows}-section.tsx`, downspout/inspector-editors.tsx, fence/inspector-editors.tsx, gutter/downspouts-panel.tsx, unit/unit-panel.tsx, zone/quantities-panel.tsx | nhãn inspector tiếng Việt | S13 |
| `vendor/pascal/packages/editor/src/components/ui/command-palette/editor-commands.tsx` | chữ cứng "Bật/Tắt mặt cắt" chuyển sang khoá `vi.commandPalette` (H4) | H4 |
| `vendor/pascal/packages/editor/src/i18n/regions/editorAndViewer.ts` | thêm khối `commandPalette` (sectionPlaneOn/Off) (H4) | H4 |
| `vendor/pascal/packages/editor/src/i18n/regions/primitivesAndSidebar.ts` | thêm khối `treeNodeDefaults` (Tường/Cửa/Cửa sổ) (H4) | H4 |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/panels/site-panel/door-tree-node.tsx` | defaultName "Door" → vi.treeNodeDefaults.door (H4) | H4 |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/panels/site-panel/wall-tree-node.tsx` | defaultName "Wall" → vi.treeNodeDefaults.wall (H4) | H4 |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/panels/site-panel/window-tree-node.tsx` | defaultName "Window" → vi.treeNodeDefaults.window (H4) | H4 |
| `vendor/pascal/packages/nodes/src/dormer/panel-actions-section.tsx` | nhãn "Delete" → vi.common.delete (H4) | H4 |
| `vendor/pascal/packages/nodes/src/unit/unit-panel.tsx` | nhãn "Delete" → vi.common.delete (H4) | H4 |
| `vendor/pascal/packages/viewer/src/components/viewer/index.tsx` | prop `cameraControls` — bật điều khiển camera chạm/chuột cho `<Viewer>` chế độ xem (F-15 S1) | S1 |
| `vendor/pascal/packages/viewer/src/components/viewer/touch-camera-controls.tsx` | mới — xoay/chụm/dời, không quán tính | S1 |
| `vendor/pascal/packages/viewer/src/lib/camera-gesture.ts` (+ .test.ts) | mới — hàm thuần tính pose từ cử chỉ | S1 |
| `vendor/pascal/packages/viewer/dist/components/viewer/index.d.ts` | sinh tay thêm `cameraControls?: boolean` | S1 |
| `vendor/pascal/packages/editor` | guide-compare (overlay/swipe/sideBySide) in floorplan-panel, use-editor, reference-panel, overlayLevels i18n | S7 |
| `vendor/pascal/packages/editor/src/i18n/regions/wallMeasure.ts` | thêm nhãn bắt điểm "Giao trục" (gridIntersection) | S9 |
| `vendor/pascal/packages/editor/src/components/tools/wall/wall-snap-geometry.ts` | thêm 'gridIntersection' vào WallDraftSnapKind | S9 |
| `vendor/pascal/packages/viewer/src/store/use-viewer.ts` | MetricNotation thêm 'centimeters' (nấc mm/cm/m, #64) | S10 |
| `vendor/pascal/packages/editor/src/components/ui/action-menu/measurement-control.tsx` | hàng nút đổi đơn vị m/cm/mm trong menu đo (#64) | S10 |
| `vendor/pascal/packages/editor/src/i18n/regions/controlsAndPanels.ts` | chữ cho nút đơn vị (#64) | S10 |
| `vendor/pascal/packages/editor/src/lib/history.ts` + index.tsx | subscribeMeasurementDeletes — sự kiện xoá phép đo cho toast hoàn tác (#63) | S10 |
| `vendor/pascal/packages/editor/src/{components/**,...}` | kiểu cục bộ 'meters'\|'millimeters' mở rộng thêm 'centimeters' (#64) | S10 |
| `vendor/pascal/packages/{editor,viewer}/dist/*.d.ts` | sửa tay đúng ba chỗ (subscribeMeasurementDeletes, MetricNotation); chưa sinh lại toàn bộ | S10 |
| `vendor/pascal/packages/{core,nodes,editor}` | measurement kinds perpendicular + height (F-15 S11) | S11 |
| `vendor/pascal/packages/editor/src/components/ui/panels/wall-vertex-{table.ts,table.test.ts,panel.tsx}`, editor/src/i18n/regions/wallMeasure.ts | S12 thêm/xoá đỉnh = tách/gộp tường | S12 |
| `vendor/pascal/packages/editor/src/components/ui/helpers/contextual-helper-panel.tsx` | ô gợi ý phím đặt giữa-đáy (bottom-24 left-1/2) thay vì giữa-phải, để không chồng lên inspector | S14 |
| `vendor/pascal/packages/editor/src/lib/contextual-help.ts`, helper-manager.tsx, i18n/regions/contextualHelp.ts (mới), i18n/vi.ts, lib/contextual-help.test.ts | dịch nhãn gợi ý chọn đối tượng sang tiếng Việt qua bảng vi | S14 |
| `vendor/pascal/packages/core/src/contracts/reference-inventory.ts` | phân loại khoá metadata `appfront.areaM2` (diện tích tầng do toPascalScene ghi, là số không phải id) vào METADATA_NON_REFERENCES | M2 |
| `vendor/pascal/packages/core/src/procedural-items/library-colors.test.ts` | đổi nhãn mong đợi sang nhãn tiếng Việt của thư viện màu (catalog đã Việt hoá có chủ đích) | M2 |
| `vendor/pascal/packages/editor/src/lib/measurement-kind.test.ts` | thêm hai kiểu đo `perpendicular` và `height` do S11 bổ sung có chủ đích | M2 |
| `vendor/pascal/packages/editor/src/i18n/vi.test.ts` | miễn năm kết quả của khuôn chỉ ghép dữ liệu với tham số thử (chữ đầu/dấu thuộc dữ liệu thật) | M2 |
| `vendor/pascal/packages/nodes/src/i18n/vi.test.ts` | thêm vào danh sách cho phép các từ tiếng Việt vốn không dấu (Khung, Ga-ra, Lan can, Xong…) và viết tắt APN | M2 |
| `packages/core/src/architecture.test.ts` | Hạn 30 s cho bài quét toàn bộ nguồn `core` — hết 5 s mặc định khi `test:pascal` chạy 4 gói cùng lúc (qua khi chạy riêng 158 ms) | M2 |
| `packages/editor/src/i18n/vi.test.ts` | Thêm "Xoay" (chữ đầu hoa) vào danh sách từ hợp lệ không dấu — nhãn `contextualHelp.cameraAction.Rotate` | M2 |
| `vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-items.tsx` | QA-05c B4: `src`/`thumbnail` trỏ `/items/<mẫu>/…` tự host (`assets/items`) thay cho supabase.co; bỏ `floorPlanUrl` (ảnh mặt bằng chỉ có trên supabase); bỏ 10 mẫu không có tệp local (dining-table-mo9ms5yh, my-leather-couch-modp80ha, ikea-kallax-1x4-moa2y49n, herman-miller-aeron-mo8x36k9, standing-desk-mo8wgz95, power-outlet-moa09g0o, wooden-kitchen-bar-moa2hhh4, 1967-chevrolet-camaro-moa24wsf, dishwasher-movn72ls, fireplace-movn1fnn) — 111 → 101 mẫu | QA-05c |
| `vendor/pascal/packages/editor/src/components/editor/index.tsx`, `…/ui/panels/panel-wrapper.tsx` | bố cục V1: khung `.pascal-root` hẹp hơn 50rem thì xếp dọc (sidebar rộng hết khung, cao 45 %; viewer và lớp phủ nằm dưới) bằng container query, thay vì slot 432 px cố định bị khung cắt; trần cao panel nổi tính theo hộp lớp phủ (`100%`) thay vì `100cqh` (23R-F-001, B1) | QA-05c |
| `vendor/pascal/packages/editor/src/components/ui/panels/room-area-full-page.{tsx,test.tsx}` | portal bảng toàn trang vào `getPascalRoot()` thay vì `document.body` (CSS Pascal chỉ áp trong `.pascal-root`); đầu bảng `flex-wrap` cho khung hẹp (23R-B-016, B3) | QA-05c |
| `vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-items.tsx` · `catalog-filter.ts` | QA-05c E1-B26: `name` tiếng Việt cho 101 mẫu (A6; tag tiếng Anh giữ để tìm "chair"…); thêm tag `sofa`/`stool` cho hai mẫu chỉ có `floor, seating` (chip "Ghế sofa" rỗng); bỏ tag `desk` của office-chair và `table` của ironing-board (lọt chip "Bàn"); tìm theo đầu từ ("bàn" không khớp tag "urban"), gõ có dấu thì khớp đúng dấu, không dấu thì gập dấu | QA-05c |
| `vendor/pascal/packages/editor/src/components/ui/panels/detected-furniture-strip.tsx` | QA-05c 23F-A-029: `dragleave` khi con trỏ đi vào nhãn/nút con không xoá viền thả của hàng | QA-05c |
| `vendor/pascal/packages/editor/src/components/ui/action-menu/{camera-actions.tsx,level-mode-action.tsx,level-mode-action.test.tsx}`, `…/i18n/regions/editorAndViewer.ts` | nút "Chế độ tầng" (xếp ↔ tách) trong menu hành động bố cục V1 — V1 không có điều khiển chế độ tầng nào nên vào `?view=exploded` rồi không có đường về trên màn (24-A-013) | QA-05c |
| `vendor/pascal/packages/editor/src/lib/floorplan/room-area.{ts,test.ts}` | nhóm theo tầng xếp theo `level` (thứ tự tầng) thay vì chuỗi nhãn — "Tầng 2" trước "Tầng 10" (23R-C-004); `roomAreaRows(scene, levelIds)` lọc cả `issues` theo tầng nên lọc một tầng sạch không còn báo phòng hỏng của tầng khác (23R-B-007) | QA-05c |
| `vendor/pascal/packages/editor/src/lib/floorplan/room-area.{ts,test.ts}`, `…/ui/panels/room-area-panel.tsx` | `closedRoomCount` mới: "Kiểm tra khe hở tường" đếm `detectSpacesForLevel(...).rooms.length` — bảng từng đọc `.length` của một object (NaN) nên khung kín nào cũng báo "chưa có vùng kín" (23R-B-002) | QA-05c |
| `vendor/pascal/packages/editor/src/components/ui/sidebar/icon-rail.{tsx,test.tsx}`, `…/ui/panels/room-area-panel.tsx`, `…/ui/panels/room-area-full-page.{tsx,test.tsx}` | a11y: `aria-label` cho nút thanh icon; `role="img"` cho chấm trạng thái; `role="status"` báo "đã sao chép"; bẫy Tab trong bảng toàn trang (`trapTab`) (23R-E-001/004/005/008, 23F-E-001) | QA-05c |
