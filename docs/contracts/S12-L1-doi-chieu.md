# S12-L1 — Đối chiếu đặc tả ↔ mã, màn S-12 "Duyệt lớp tường"

Nhiệm vụ **A2**, lớp 1. Nhánh `mungvu2004/s12-a2-doi-chieu`, gốc `master @ ae7db03`.
Ngày đo: 31-08-2026.

**Sản phẩm này là ĐỌC-VÀ-ĐỐI-CHIẾU.** Không một dòng nào trong `src/` bị sửa trong lượt này —
xem `git diff --name-only master...HEAD` ở cuối file.

---

## 0. Ba cổng — kết quả nguyên văn tại đúng HEAD này

```
$ pnpm typecheck
> tsc --noEmit
(exit 0)                                   → 0 lỗi typecheck

$ pnpm lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
(exit 0)                                   → 0 lỗi + 0 cảnh báo lint

$ pnpm test
 Test Files  206 passed (206)
      Tests  4266 passed (4266)
   Duration  119.30s
```

Ba con số: **0 lỗi typecheck · 0 lỗi + 0 cảnh báo lint · 206/206 file, 4266/4266 test.**
Khớp đúng số điều phối viên đã đo ở Phần 1 của nhiệm vụ. Không có escalation.

> Toàn bộ những gì ghi dưới đây là chỗ **mã lệch khỏi đặc tả DÙ CỔNG VẪN XANH** — đúng thứ
> không cổng nào bắt được.

---

## 1. Bảng đối chiếu

Ký hiệu cột 4: **KHỚP** · **LỆCH** · **KHÔNG TÌM THẤY**.
Cột 5: **TRONG** (sửa được ở `src/screens/**`, `src/routes/**`, `src/i18n/**`) ·
**NGOÀI** (phải chạm tầng R-68 cấm) · **—** (không phải việc phải sửa).

### 1.1 [BỐ CỤC]

| Mục | Câu đặc tả (rút gọn) | Thực tế trong mã (`file:dòng`) | Kết luận | Phạm vi | Ghi chú |
|---|---|---|---|---|---|
| BC-01 | Bố cục "theo QC-SHELL" | `rg "QC-SHELL\|QC_SHELL\|qcShell" src/ docs/ *.md` → chỉ 1 kết quả, là **tiêu đề tài liệu** `docs/contracts/ui.md:456` ("## B. src/components/shell/ — Vỏ màn (QC-SHELL)"). Không component/hằng/khuôn nào tên như vậy trong `src/`. `rg -l "AppShell" src/screens/` → chỉ `src/screens/ShellDemo.tsx` | **KHÔNG TÌM THẤY** | — | Không có "QC-SHELL" để tuân theo. Màn tự dựng ba vùng: ray 56 + panel trái 280 + canvas + panel phải 344 + thanh trạng thái 32 (`WallLayerReview.tsx:99-122`). Đây là cách **mọi** màn khác trong repo đang làm; không coi là lỗi của mã |
| BC-02 | Ray công cụ: chọn (V) · vẽ tường (W) · tách đoạn · nối đoạn · đo (M) | `WallLayerToolRail.tsx:170-175` — `select`(V) · `drawWall`(W) · `splitWall`(không phím) · `measure`(M); "nối đoạn" là **nút hành động** dựng **sau** vòng lặp, `:226-239` | **LỆCH** (thứ tự) | TRONG | Năm mục đủ, nhưng "nối đoạn" đứng **thứ năm** thay vì thứ tư. Việc "nối đoạn" không phải `ToolId` là **đúng luật**, xem mục C-05 |
| BC-03 | Đầu panel trái: bộ đếm "12/48 tường đã duyệt" | `WallLayerLeftPanel.tsx:146-157`, chuỗi ghép ở hook `wallLayerReviewGateway.ts:1056-1057` (`reviewProgressLabel`), gắn `aria-label` ở `:146` | **KHỚP** | — | Bộ mẫu đúng 12/48 (`wallLayerReviewFixture.ts:168,171`) |
| BC-04 | …kèm thanh 4px | `WallLayerLeftPanel.tsx:158` — `className="h-1 …"` = 4px | **KHỚP** | — | |
| BC-05 | Dưới bộ đếm là **điều hướng tầng** | `rg "FloorNav\|floorNav\|điều hướng tầng\|levels\[" src/screens/qc/WallLayerReview/` → không có phần tử giao diện nào; `WallLayerLeftPanel.tsx:143-205` đi thẳng từ bộ đếm sang cây lớp. `ls src/components/shell src/components/canvas` → không có component điều hướng tầng nào | **KHÔNG TÌM THẤY** | TRONG | Xem **A-01**. Đường ra đã có sẵn: `ROUTES.project.walls(projectId, floorId)` (`src/routes/paths.ts:112-113`) |
| BC-06 | Cây lớp với "Tường" đang bật | `WallLayerLeftPanel.tsx:172-182`; `WALL_LAYER_LABEL` `:119`, `isCurrent` `:173`; bốn lớp còn lại `:122-135` | **KHỚP** | — | Dựng hàng cây tại chỗ thay vì `TreeItem` dùng chung — lý do ghi ở `:61-81`, hợp lý theo R-68 |
| BC-07 | Ba hộp kiểm lọc: "Chỉ hiện chưa duyệt" · "Chỉ hiện độ tin cậy thấp" · "Chỉ hiện độ dày không chuẩn" | `WallLayerLeftPanel.tsx:44-54` (nhãn + thứ tự), dựng `:184-193`; `vi.json:1363-1367` | **KHỚP** | — | Ba nhãn trùng **nguyên văn** đặc tả |
| BC-08 | Dưới cùng: danh sách tường **ảo hoá** | `WallLayerList.tsx:226,360-365` — `useVirtualizer` của `@tanstack/react-virtual`, `estimateSize` = `ROW_HEIGHT_PX` | **KHỚP** | — | |
| BC-09 | Dòng cao 40 | `WallLayerList.tsx:244` `ROW_HEIGHT_PX = 40`; hàng `h-10` `:298` | **KHỚP** | — | |
| BC-10 | Dòng: mã **chữ đều** | `WallLayerList.tsx:329` — `font-mono`, `{row.codeLabel}`; `codeLabel` = `"#W-014"` (`wallLayerReviewGateway.ts:1108`, `wallDisplayCode` `:272`) | **KHỚP** | — | |
| BC-11 | Dòng: **chip** độ dày | `WallLayerList.tsx:331-338` — một `<span>` ô màu 12px + `<span>` chữ mono. **Không** dùng `Badge` (`src/components/ui/Badge.tsx` có sẵn, không được gọi) | **LỆCH** (nhẹ) | TRONG | Xem **A-08**. Về mặt thông tin thì đủ; về hình dạng thì không phải "chip" |
| BC-12 | Dòng: `ConfidenceMeter` | `WallLayerList.tsx:341` — `<ConfidenceMeter noTooltip value={row.confidence} />` | **KHỚP** | — | |
| BC-13 | Dòng: chấm trạng thái | `WallLayerList.tsx:344-346`, token ở `:250-255` (ba token A4 + `text-muted`) | **KHỚP** | — | Không bao giờ dùng `violation` (`types.ts:230`), đúng "không đỏ đặc" |
| BC-14 | Canvas: tường vẽ thành **đa giác tô đầy theo màu độ dày** | `WallLayerShapeFigure.tsx:77-81` — `<polygon fill={wallThicknessFillToken(shape.thicknessMm)}>`; token `wallLayerHatch.ts:107-113` | **KHỚP** | — | Đa giác tính sẵn ở hook qua `resolveWallShapes` (`wallLayerReviewGateway.ts:690-721`) |
| BC-15 | Tim tường **1px** | `WallLayerShapeFigure.tsx:95-105` — `strokeWidth={1}` + `vectorEffect="non-scaling-stroke"` | **KHỚP** | — | |
| BC-16 | Tim tường màu **`--wall-centerline`** | `wallLayerHatch.ts:92` — `WALL_CENTRELINE_TOKEN = 'var(--wall-idle)'`. `rg "wall-centerline" src/` → **chỉ chú thích** ở `wallLayerHatch.ts:70,73,79,81,84` + `docs/contracts/ui.md:993`. `rg -- "--wall-" src/styles/globals.css` → `:180-183` chỉ có `--wall-110/220/330/idle` | **LỆCH** | **NGOÀI** | Xem **B-01**. Token không tồn tại; thêm nó phải sửa `src/styles/globals.css` |
| BC-17 | Tim tường **bật tắt được** | `useWallLayerReview.ts:1348` — `showCentrelines: toolState.tool === 'drawWall' \|\| toolState.tool === 'splitWall'`. `rg "showCentrelines" src/screens/qc/WallLayerReview/*.tsx` → chỉ đọc, **không một điều khiển nào đặt nó** | **LỆCH** | TRONG | Xem **A-02**. Không có nút/hộp kiểm; người dùng không bật tắt được, chỉ đổi công cụ |
| BC-18 | Chú giải độ dày **luôn hiện khi lớp Tường bật** | `WallLayerCanvas.tsx:358-362` (dựng NGOÀI mọi nhánh trạng thái); ánh xạ `WallLayerLegend.tsx:347-355`; điều kiện ẩn duy nhất là `isVisible=false` (`src/components/canvas/WallThicknessLegend.tsx:40`) | **KHỚP** (có ngoại lệ, xem ghi chú) | — | Ở `empty`/`loading`/`error` khối chú giải **vẫn hiện** nhưng nội dung là "Chưa có dữ liệu tường"/"Đang tải chú giải"/"Không tải được chú giải" (`WallLayerReview.test.tsx:211-213`), tức **thang độ dày không hiện**. Hành vi của component dùng chung, không phải của màn |
| BC-19 | …và cờ "lớp Tường" phải bật tắt được ở cây lớp | `useWallLayerReview.ts:1120-1122` đọc `hiddenLayers` của kho; `rg "toggleLayerVisibility\|setHiddenLayers" src/screens/qc/WallLayerReview/` → **chỉ trong `WallLayerReview.test.tsx:248,257`**, không có ở view | **LỆCH** (nhẹ) | TRONG | Xem **A-09**. Chỉ bài kiểm đổi được cờ; người dùng không có điều khiển nào |
| BC-20 | Panel phải, tiêu đề "Đoạn tường" | `WallLayerInspector.tsx:39,102`; `vi.json:1346` | **KHỚP** | — | |
| BC-21 | Mã "#W-014" **mono-lg** | `WallLayerInspector.tsx:109` — `font-mono text-[16px]`. `rg "mono-lg" src/` → chỉ một chú thích ở `src/screens/pipeline/ScaleCalibration/types.ts:446`, **không phải một lớp/token** | **KHỚP** | — | "mono-lg" không phải tên trong hệ thiết kế; `font-mono` + 16px là cách cả repo viết nó |
| BC-22 | `SegmentedControl` độ dày **ba mục** | `WallLayerInspector.tsx:115-125`, `options` sinh từ `thicknessChoices` = `WALL_THICKNESS_CHOICES` (`types.ts:168`) = `[110, 220, 330]` | **KHỚP** | — | |
| BC-23 | …mỗi mục có **ô màu 12** đứng trước | `WallLayerInspector.tsx:120` truyền `swatch`; `src/components/ui/SegmentedControl.tsx:85-91` vẽ `h-3 w-3` = 12px, đứng trước nhãn | **KHỚP** | — | |
| BC-24 | …ba giá trị **110 / 220 / 330 mm** | `types.ts:168`; nhãn `` `${choice} mm` `` `WallLayerInspector.tsx:119` | **KHỚP** | — | |
| BC-25 | FieldRow: **chiều dài 4.250,00 mm** | `WallLayerInspector.tsx:129-133`; `lengthLabel` = `formatCentrelineLength` (`wallLayerReviewGateway.ts:1045-1049`, `unit:'mm'`, 2 chữ số). **Định dạng đúng**, nhưng W-014 của bộ mẫu dài **2.500 mm** (`wallLayerReviewFixture.ts:130`: `{7500,4400}→{10000,4400}`) → nhãn thật là `"2.500,00 mm"` | **LỆCH** (dữ liệu mẫu) | TRONG | Xem **A-07** |
| BC-26 | FieldRow: **chiều cao 3.000,00 mm** | `WallLayerInspector.tsx:134-138`; `heightLabel = formatLength(wall.heightMm)` **không truyền `unit`** (`wallLayerReviewGateway.ts:1126`). `formatLength` tự chọn đơn vị từ 1 m trở lên (`src/lib/format/measure.ts:113,119-120`) → `heightMm = 3000` (`wallLayerReviewFixture.ts:63`) cho ra **`"3,00 m"`**, không phải `"3.000,00 mm"` | **LỆCH** | TRONG | Xem **A-05**. Sửa đúng một dòng |
| BC-27 | FieldRow: **độ tin cậy kèm ConfidenceMeter ở 0,71** | `WallLayerInspector.tsx:139-143`; W-014 có `confidence: 0.71` (`wallLayerReviewFixture.ts:130`) | **KHỚP** | — | |
| BC-28 | FieldRow: **vật liệu** | `WallLayerInspector.tsx:144-146`, nhãn `'vật liệu'` `:44`, giá trị là `kindLabel` = `WALL_KIND_LABELS[wall.kind]` (`wallLayerReviewGateway.ts:1128`) → "vách ngăn"/"tường chịu lực"/"tường bao" | **LỆCH** (khái niệm) | **NGOÀI** | Xem **B-02**. `Wall` của `src/domain/spatial/types.ts:123-132` **không có trường vật liệu** — chỉ có `kind` |
| BC-29 | Khối gấp "Thông số nâng cao" | `WallLayerInspector.tsx:149-192`, tiêu đề `:40`, `aria-expanded` `:152` | **KHỚP** | — | |
| BC-30 | Nâng cao: **lệch Z** | `WallLayerInspector.tsx:174-178`; giá trị = `formatElevationM(level.elevationMm)` (`wallLayerReviewGateway.ts:1130`) — là **cao độ của TẦNG**, giống hệt nhau cho cả 48 tường. `Wall` (`src/domain/spatial/types.ts:123-132`) không có trường lệch Z nào | **LỆCH** | **NGOÀI** | Xem **B-03** |
| BC-31 | Nâng cao: toạ độ đầu · toạ độ cuối | `WallLayerInspector.tsx:179-188`; `formatPoint(wall.centreline.start/end)` (`wallLayerReviewGateway.ts:1131-1132`) | **KHỚP** | — | |
| BC-32 | Chân panel: nút chính "Duyệt đoạn này" | `WallLayerInspector.tsx:199-206`, `variant="primary"`, nhãn `:49`; `vi.json:1350` | **KHỚP** | — | |
| BC-33 | Chân panel: nút **chìm** "Bỏ qua" | `WallLayerInspector.tsx:207-209`, `variant="ghost"`, nhãn `:50` | **KHỚP** | — | |
| BC-34 | Menu chuột phải: Duyệt · Đổi độ dày · Tách đoạn · Xoá | `WallLayerCanvas.tsx:65-70` (bốn nhãn), dựng `:198-217`, mở bằng `onContextMenu` `WallLayerShapeFigure.tsx:72`; `vi.json:1368-1373` | **KHỚP** (nhãn) | — | Nhưng "Tách đoạn" **không tách được gì** — xem TT-05 và **A-03** |

### 1.2 [NỐI LOGIC]

| Mục | Câu đặc tả (rút gọn) | Thực tế trong mã (`file:dòng`) | Kết luận | Phạm vi | Ghi chú |
|---|---|---|---|---|---|
| NL-01 | Mọi thao tác sửa phải gọi **đúng lệnh của S-07** | Năm hàm gọi lại thật: `wallLayerReviewGateway.ts:480-507` (`createChangeWallThicknessCommand`, `createSplitWallCommand`, `createMergeWallsCommand`, `createDeleteWallCommand`, `createDrawWallCommand`) | **KHỚP** | — | |
| NL-02 | …kể cả thao tác **duyệt** | `wallLayerReviewGateway.ts:446,462-471` — `WALL_APPROVE_COMMAND_TYPE = 'wall.approve'` **dựng tại màn** bằng `createCommand`/`changeForUpdate`. `types.ts:80-88` đã ghi rõ: `WALL_COMMAND_TYPES` không có lệnh duyệt và đây là ca R-69 (phải DỪNG và hỏi) | **LỆCH** | **NGOÀI** | Xem **B-04**. Lệnh nghiệp vụ mới phải nằm ở `src/lib/commands/business/wallCommands.ts` |
| NL-03 | …rồi **điều phối qua S-05** | `wallLayerReviewGateway.ts:591-637` (`createWallLayerDispatchDeps` + `runWallCommand`), hook `useWallLayerReview.ts:670-691` | **KHỚP** | — | |
| NL-04 | Tuyệt đối không đặt state trực tiếp, không sửa store | `rg -E "\.setState\(\|_applyPatches\|useStore\.setState" src/screens/qc/WallLayerReview/` → **rỗng trong mã** (hai kết quả duy nhất là chú thích: `useWallLayerReview.ts:13`, `wallLayerReviewGateway.ts:20`); ghi đi qua `applyPatches` = `commit` (`useWallLayerReview.ts:774`) | **KHỚP** | — | `local/no-direct-set` cũng xanh (0 lỗi lint) |
| NL-05 | Công cụ đang dùng lấy từ **S-08** | `useWallLayerReview.ts:115-116,501,840-874` — `createToolState`/`reduceTool`/`TOOLS` thật, không bản sao | **KHỚP** | — | |
| NL-06 | …và máy công cụ phải **chạy được** | `useWallLayerReview.ts:840-874` chỉ nhận `{type:'activate'}` (`:871`). `rg "type: 'input'\|'commit'\|'hover'" src/screens/qc/WallLayerReview/useWallLayerReview.ts` → **rỗng**. `ToolEvent` (`src/lib/tools/toolMachine.ts:389-394`) cần `input`/`hover`/`commit` để một cử chỉ kết thúc | **LỆCH** | TRONG | Xem **A-03**. Hệ quả: **vẽ tường, tách đoạn, đo đều không làm gì** ngoài đổi công cụ đang chọn |
| NL-07 | **Chọn nhiều** dùng S-10 | `useWallLayerReview.ts:612-632` chỉ gọi `selectSingle`, mà `selectSingle` (`src/lib/selection/selectionOps.ts:155-159`) **luôn thay bằng đúng một id**. `rg "toggleSelection\|selectAllOfKind\|combineSelection" src/screens/qc/WallLayerReview/` → rỗng | **LỆCH** | TRONG | Xem **A-04**. Hệ quả đo được: `selectedWallIds.length` không bao giờ bằng 2 → `canMerge` (`:1076,1102`) **vĩnh viễn `false`** → nút "nối đoạn" là nút chết (A2) |
| NL-08 | **Khoanh vùng** dùng S-10 | `src/lib/selection/marquee.ts` **có tồn tại**; `rg "marquee\|Marquee" src/screens/qc/WallLayerReview/` → chỉ một câu **chú thích** ở `wallLayerReviewGateway.ts:911`. Không nơi gọi nào | **LỆCH** | TRONG | Xem **A-04** |
| NL-09 | Đồng bộ hai chiều qua **S-11** | `useWallLayerReview.ts:597,617,629` (`createSelectionChannel` + `channel.push`), `:642-655` (`revealAnchor`/`planReveals`/`describeSelection`) | **KHỚP** | — | |
| NL-10 | Mọi phép **nối, tách, đo** gọi `src/domain` | Nối/tách: `wallLayerReviewGateway.ts:723-727` (`splitWall`/`mergeWalls` của `src/domain/walls/edit.ts`). **Đo: không có** — `measurement: null` (`useWallLayerReview.ts:1370`) | **LỆCH** (phần "đo") | TRONG | Xem **A-03**. `ToolOutcome` `kind:'measurement'` (`toolMachine.ts:240`) bị `runToolEvent` **bỏ rơi im lặng**: `:856-864` chỉ xử lý `selection` và `command` |
| NL-11 | **Không có phép hình học nào trong màn** | `rg "Math\." src/screens/qc/WallLayerReview/` → **rỗng**. Đa giác/hộp bao/tim tường đều từ `resolveWallShapes` (`wallLayerReviewGateway.ts:690-721,960-1000`) | **KHỚP** (có một ngoại lệ, xem ghi chú) | TRONG | `WallLayerShapeFigure.tsx:87-88` tự tính tâm hộp bao (`boundsPx.x + boundsPx.width / 2`) ngay trong view. Là số học đơn giản, `local/no-raw-number` cố ý bỏ qua (`eslint-rules/no-raw-number.js:20-23`), nhưng vẫn là phép tính toạ độ trong view — xem **A-10** |
| NL-12 | Màu độ tin cậy từ **P-06** | `wallLayerReviewGateway.ts:1083-1084` — `confidenceLevel` của `@/lib/format/semantic`; `wallStatusCode` `:1094-1102` nền là `toWallViewModel(wall).statusCode` | **KHỚP** | — | Không viết ngưỡng nào ở màn, đúng R-71 |
| NL-13 | Nội dung chú giải từ **P-07** | `wallLayerReviewGateway.ts:1021-1027` — **cố ý KHÔNG dùng** `generateLegend` (`src/lib/coloring/legend.ts:441`); màn tự lọc `WALL_THICKNESS_CHOICES` theo tường có thật | **LỆCH** | TRONG | Xem **A-11**. Lý do ghi tại chỗ (`:1021-1024`) và có sức thuyết phục: `Legend` của P-07 đếm theo token màu của một `ColoringMode`, không phải ba băng độ dày |
| NL-14 | Tự lưu qua **D-07** | `useWallLayerReview.ts:554-574` — `createAutosave` + `useSaveIndicator`; 800 ms của A7 đến từ `DEFAULT_DEBOUNCE_MS`, không viết lại | **KHỚP** | — | Nợ đã biết: `persistWallLayer` trả `unsupported` (`wallLayerReviewGateway.ts:142,340`) — xem **B-05** |
| NL-15 | Xoá dùng **vé hoàn tác D-05** | `useWallLayerReview.ts:791-810`, `createWallUndoTicket` (`wallLayerReviewGateway.ts:662-668`) dùng `UNDO_WINDOW_MS` của `src/lib/mutations/undoTicket.ts` | **KHỚP** (vé được dựng) | — | |
| NL-16 | …**kèm toast hoàn tác** (A8) | Vé chỉ nằm trong `undoTicketRef` (`useWallLayerReview.ts:789,798`); `deleteToastDescription` (`wallLayerReviewGateway.ts:646`) **không nơi nào hiển thị**. `rg "Toast\|useToast" src/screens/qc/WallLayerReview/*.tsx` → rỗng, dù `src/components/feedback/Toast.tsx:31,147` đã có `useToast`/`ToastProvider` | **LỆCH** | TRONG | Xem **A-06**. Người dùng xoá một tường thì **không thấy gì** và không bấm hoàn tác được (chỉ còn `Ctrl+Z`) |

### 1.3 [TƯƠNG TÁC & CHUYỂN ĐỘNG]

| Mục | Câu đặc tả (rút gọn) | Thực tế trong mã (`file:dòng`) | Kết luận | Phạm vi | Ghi chú |
|---|---|---|---|---|---|
| TT-01 | Đổi độ dày: đa giác **chạy màu 240 ms** | `WallLayerShapeFigure.tsx:78` — `transition-colors duration-260` | **LỆCH có chủ ý** | — | **Đặc tả sai, luật thắng** — xem **C-01** (mục B của CLAUDE.md, R-71, `local/no-raw-duration`) |
| TT-02 | Đổi độ dày: **nền hàng nháy #EEF4EF trong 400 ms** | `rg "EEF4EF" src/` → không có trong mã (chỉ `src/screens/account/AccountSettings/AppearanceSection.tsx:21` **chú thích** và `docs/contracts/ui.md:1048`). Trong màn S-12: `rg "flash" src/screens/qc/WallLayerReview/` → chỉ `flashingWallId` (`useWallLayerReview.ts:788,804,1323`), và nó **chỉ được đặt khi HOÀN TÁC một lượt xoá**, không phải khi đổi độ dày | **LỆCH** | TRONG | Xem **A-12**. Ba lỗi trong một: (a) sai sự kiện kích hoạt, (b) hiệu ứng là "giả vờ đang rê chuột" (`bg-bg-hover`) chứ không phải nháy, (c) `flashingWallId` **không bao giờ được xoá về `null`** nên hàng đó sáng vĩnh viễn. Màu/thời lượng đúng đã có tiền lệ: `bg-accent-wash` + 340 ms (`AppearanceSection.tsx:21-23`) |
| TT-03 | Duyệt một tường: badge chuyển sang **đã duyệt** | `wallLayerReviewGateway.ts:462-471` đặt `reviewed:true` + `source:'human'`; `wallStatusCode` `:1094-1095` → `'verified'`; chấm đổi token (`WallLayerList.tsx:251,345`) | **KHỚP** | — | A5 được giữ: chỉ `reviewed` mới ra xanh |
| TT-04 | Bộ đếm **chạy số 12 → 13 trong 240 ms** | `useWallLayerReview.ts:914` + `WallLayerLeftPanel.tsx:141` — `useCountUp`, nấc `'standard'` = 260 ms | **LỆCH có chủ ý** | — | **Đặc tả sai, luật thắng** — xem **C-01** |
| TT-05 | …rồi **tự chọn tường chưa duyệt kế tiếp** | `useWallLayerReview.ts:702-708` — `nextUnreviewedWallId` gọi **trước** khi cờ đổi, rồi `onSelect(nextId)` | **KHỚP** | — | Dãy nghiệm thu 12→17→12 của T8 chạy trên đúng đường này |
| TT-06 | Tường **dưới 0,75** mang gạch chéo + chấm cần chú ý | Cổng bật là `isLowConfidence` = `confidenceLevel(wall.confidence) !== 'certain'` (`wallLayerReviewGateway.ts:1083-1084`), mà `CONFIDENCE_CERTAIN_THRESHOLD = 0.9` (`src/lib/format/semantic.ts:40`) → thực tế là **dưới 0,90** | **LỆCH** | TRONG | Xem **A-13**. Ngưỡng gần nhất còn lại là `CONFIDENCE_SUGGESTED_THRESHOLD = 0.7` (`semantic.ts:41`). Con số 0,75 **không tồn tại** trong repo và R-71 cấm viết nó ở màn — xem thêm **C-02** |
| TT-07 | Gạch chéo **45 độ, 2px, 6%** | `wallLayerHatch.ts:122` (`2`), `:125` (`0.06`), `:128` (`rotate(45)`); dùng ở `WallLayerCanvas.tsx:298-314`. Hàng danh sách: `WallLayerList.tsx:317-327` (`repeating-linear-gradient(45deg, …, 2px, …)`, `opacity: 0.06`) | **KHỚP** | — | |
| TT-08 | …**cộng chấm cần chú ý** | `WallLayerShapeFigure.tsx:83-93` — `<circle fill={ATTENTION_TOKEN} r={ATTENTION_DOT_RADIUS_PX}>`; token `wallLayerHatch.ts:131` | **KHỚP** | — | Đúng thang P-06, không đỏ đặc |
| TT-09 | Phím riêng: **1 / 2 / 3** đặt độ dày | `useWallLayerReview.ts:1006-1035` — ba `useShortcut`, `scope:'canvas'`, `enabled: canEdit` | **KHỚP** | — | |
| TT-10 | Phím riêng: **W** vẽ tường | `useWallLayerReview.ts:1047-1056` — `combo: shortcutForTool('drawWall')` | **KHỚP** (đăng ký) | — | Phím tới nơi, nhưng công cụ tới đó **không vẽ được** — xem NL-06 / **A-03** |
| TT-11 | Các phím chung theo QC-SHELL | Đăng ký thêm: `V`/`M` (`:1037-1066`), `J`/`K` (`:952-971`), `Backspace` (`:972-985`), `Mod+Z` (`:986-995`), `F` (`:1254-1263`). **`Space` không đăng ký** (lý do ghi tại `:1250-1252`) | **KHỚP** | — | Không có "QC-SHELL" để đối chiếu (xem BC-01); mọi phím đi qua `useShortcut` → `appShortcutRegistry`, đúng R-54/R-72 |
| TT-12 | (kiểm chéo) một chuỗi phím đã khai nhưng không có phím | `WALL_LAYER_TEXT.shortcutApprove` (`useWallLayerReview.ts:201`) và `vi.json:1418` tồn tại, nhưng `rg "shortcutApprove" src/screens/` → **không một `useShortcut` nào dùng nó** | **LỆCH** (nhẹ) | TRONG | Xem **A-14**. Đặc tả không đòi phím duyệt, nên đây là **chuỗi thừa**, không phải phím thiếu |

### 1.4 [BẢY TRẠNG THÁI]

| Mục | Câu đặc tả (rút gọn) | Thực tế trong mã (`file:dòng`) | Kết luận | Phạm vi | Ghi chú |
|---|---|---|---|---|---|
| BT-00 | Bảy trạng thái tồn tại và dẫn xuất được | `useWallLayerReview.ts:433-461` (`deriveScreenState`), `types.ts:137-144`; bảy kịch bản `wallLayerReviewScenarios.ts:166-174`; bài kiểm `WallLayerReview.test.tsx:165-178` | **KHỚP** | — | 7/7 qua `expectSevenStates` |
| BT-01 | Rỗng — câu **"…Bạn có thể vẽ tường thủ công bằng phím W, hoặc chạy lại với ngưỡng thấp hơn."** | `useWallLayerReview.ts:193-194` — `emptyNotice: 'Chưa phát hiện được đoạn tường nào ở tầng này. **Kiểm tra lại bản vẽ gốc hoặc chạy lại bước tách lớp tường.**'`. Trong khi `src/i18n/vi.json:1383` mang **đúng câu của đặc tả** | **LỆCH** | TRONG | Xem **A-15**. Từ điển kiểm tra và chuỗi lúc chạy đã **trôi khỏi nhau** — đúng loại lỗi R-67 sinh ra để chặn, nhưng `expectVietnamese` không bắt được vì nó chỉ soát chữ tiếng Anh/mất dấu |
| BT-02 | Đang tải — canvas khung xương | `WallLayerCanvas.tsx:248-249` — `<Skeleton preset="canvas">` | **KHỚP** | — | |
| BT-03 | Đang tải — **12 dòng** danh sách khung xương | `WallLayerList.tsx:245` `LOADING_SKELETON_ROWS = 12`, dựng `:387-395` | **KHỚP** | — | |
| BT-04 | Một phần — 12/48 | `wallLayerReviewScenarios.ts:102-111`; `deriveScreenState` `:460` | **KHỚP** | — | |
| BT-05 | Một phần — hoặc đã có tường nhưng **chưa chuẩn hoá xong**, gắn **chip cần chú ý** lên đúng hàng | `wallStatusCode` `wallLayerReviewGateway.ts:1097-1099` cho `'attention'` khi chưa duyệt + độ dày ngoài ba băng. Hiển thị là **chấm 6px** (`WallLayerList.tsx:344-346`), không phải chip | **LỆCH** (nhẹ) | TRONG | Xem **A-08** — cùng một việc với BC-11 |
| BT-06 | Lỗi — **không tải được lớp** | `useWallLayerReview.ts:880` — `hasError = backgroundQuery.isError`, tức trạng thái `error` được kích hoạt bởi **ảnh nền hỏng**, không phải lớp tường hỏng. Bộ mẫu ép cảnh này bằng `failReadBackground: true` (`WallLayerReview.stories.tsx:120-126`, cổng `wallLayerReviewGateway.ts:455-457`) | **LỆCH** | TRONG | Xem **A-16** |
| BT-07 | Lỗi — **canvas vẫn xem được ảnh gốc** | `useWallLayerReview.ts:1350` — `backgroundImageUrl: backgroundQuery.data?.imageUrl ?? null`. Ở `error` thì `data` là `undefined` → **`null`** → `WallLayerCanvas.tsx:278-279` vẽ một ô xám `bg-bg-sunken`. Chính `wallLayerReviewScenarios.ts:118-127` khai kịch bản này là `backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE` và gọi đó là "điều khoản bắt buộc", còn `wallLayerReviewGateway.ts:226` hứa "canvas VẪN xem được" | **LỆCH** | TRONG | Xem **A-16**. Đây là chỗ mã **tự mâu thuẫn với chú thích của chính nó** |
| BT-08 | Xong — 48/48, **bộ đếm chuyển sang đã duyệt** | `useWallLayerReview.ts:460` cho `'success'`; nhưng bộ đếm ở `WallLayerLeftPanel.tsx:146-163` **không đổi hình thức nào** theo `state` — thanh vẫn `bg-accent`, chữ vẫn `text-text-primary` | **LỆCH** (nhẹ) | TRONG | Xem **A-17** |
| BT-09 | Xong — hiện nút chính "Sang lớp Cửa và nội thất" | `WallLayerLeftPanel.tsx:166-170` (`state === 'success'`, `variant="primary"`), nhãn `:59`; nối vào `ROUTES.layerObjects` (`WallLayerReview.container.tsx:93`) | **KHỚP** | — | Lối ra chạy thật, đúng R-73 |
| BT-10 | Không có quyền — **chỉ xem** | `useWallLayerReview.ts:492-493,674` (mọi lệnh chặn ở hook), `canvas.isInteractive = canEdit` (`:1352`), `WallLayerShapeFigure.tsx:70-75` | **KHỚP** | — | |
| BT-11 | Không có quyền — **ô thanh tra bỏ viền** | `WallLayerInspector.tsx:58-80,112-113` — `ReadOnlyThickness`: chỉ ô màu + chữ, không nền, không pill | **KHỚP** | — | Đúng "bỏ viền", không phải làm xám |
| BT-12 | Không có quyền — **ẩn mọi nút sửa** | Ray: `WallLayerToolRail.tsx:196-198,226`; thanh tra: `WallLayerInspector.tsx:195-196` thay hai nút bằng một câu | **KHỚP** | — | |
| BT-13 | Thu gọn — **ẩn hai panel** | `WallLayerReview.tsx:96,109,118` | **KHỚP** | — | |
| BT-14 | Thu gọn — còn **cụm công cụ trôi** | `WallLayerReview.tsx:101-104` — `absolute left-4 top-4 z-10 … shadow-panel` | **KHỚP** | — | |
| BT-15 | Thu gọn — còn **chú giải** | `WallLayerCanvas.tsx:358-362` + ánh xạ chệch `WallLayerLegend.tsx:354` (`collapsed → 'success'`), có phép kiểm giữ (`WallLayerReview.test.tsx:218`) | **KHỚP** | — | |
| BT-16 | (kiểm chéo) Người dùng vào được trạng thái Thu gọn bằng cách nào | `onToggleCollapsed` có ở hợp đồng (`types.ts:384`) và ở hook (`useWallLayerReview.ts:1311-1313`), nhưng `rg "onToggleCollapsed" src/screens/qc/WallLayerReview/*.tsx` → **không một view nào gọi**. Đường duy nhất vào là prop `forceCollapsed` (`:248,502`), thứ chỉ story và bài kiểm truyền | **LỆCH** | TRONG | Xem **A-18**. Trạng thái 7 **không tới được** trong ứng dụng thật — đúng thứ R-73 gọi là "một prop optional không ai truyền" |

### 1.5 [CẤM TUYỆT ĐỐI]

| Mục | Câu đặc tả (rút gọn) | Thực tế trong mã (`file:dòng`) | Kết luận | Phạm vi | Ghi chú |
|---|---|---|---|---|---|
| CT-01 | Không tính hình học trong màn | `rg "Math\." src/screens/qc/WallLayerReview/` → rỗng | **KHỚP** | — | Một ngoại lệ nhỏ, xem NL-11 / **A-10** |
| CT-02 | Không hộp thoại; xoá dùng vé hoàn tác | `rg -E "role=.dialog.\|<Modal\|confirm\(" src/screens/qc/WallLayerReview/` → **rỗng trong mã màn** (hai kết quả là bài kiểm `WallLayerReview.test.tsx:13,315`, tức phép kiểm `[NGHIEM-5]` đang giữ điều này) | **KHỚP** | — | Nhưng vé không hiện ra — xem NL-16 / **A-06** |
| CT-03 | Không đỏ đặc cho độ tin cậy thấp; dùng thang cần chú ý của P-06 | `wallLayerHatch.ts:131` (`--state-attention`); `types.ts:230` ("không bao giờ `'violation'` ở màn này"); `wallStatusCode` `wallLayerReviewGateway.ts:1094-1102` không trả `violation` | **KHỚP** | — | |
| CT-04 | Độ dày là điều khiển ba lựa chọn, **không bao giờ** ô nhập số tự do | `WallLayerInspector.tsx:115-125` (`SegmentedControl`); kiểu ép ở `types.ts:368` (`WallThicknessChoice`); `rg -E "NumericField\|ThicknessField\|type=.number." src/screens/qc/WallLayerReview/` → **rỗng trong mã** (hai kết quả là chú thích `WallLayerInspector.tsx:7` và phép kiểm `[NGHIEM-6]` ở `WallLayerReview.test.tsx:322`) | **KHỚP** | — | |
| CT-05 | Che hết chữ vẫn phân biệt được ba độ dày | Hai lớp độc lập: MÀU (`wallLayerHatch.ts:107-113`, ba token `globals.css:180-182`) và BỀ RỘNG (tỉ lệ 110:220:330 = 1:2:3, bài kiểm `[NGHIEM-4]`) | **KHỚP** | — | |
| CT-06 | Không tạo component mới | `rg "^export function \w+\(" src/screens/qc/WallLayerReview/*.tsx` → mọi component xuất ra đều là **phần của màn này** (`WallLayerReview`, `WallLayerCanvas`, `WallLayerLeftPanel`, `WallLayerList`, `WallLayerInspector`, `WallLayerToolRail`, `WallLayerStatusBar`, `WallLayerLegend`, `WallShapeFigure`), không nằm trong `src/components/**` | **KHỚP** | — | Ba chỗ dựng riêng thay vì gọi component chung (`WallLayerTreeRow`, `ReadOnlyThickness`, hàng danh sách) đều có lý do ghi tại chỗ và đều **không rời khỏi thư mục màn** — cùng khuôn `SegmentedField` của `AppearanceSection.tsx:29-31` |
| CT-07 | Không màu ngoài token | `rg "#[0-9A-Fa-f]{3,8}\b\|rgb\(\|hsl\(" src/screens/qc/WallLayerReview/` → **rỗng, 0 kết quả**; `expectNoRawColor` quét cả thư mục (`WallLayerReview.test.tsx:74`); `local/no-raw-color` mức `error`, lint xanh | **KHỚP** | — | |
| CT-08 | Không sửa `src/lib`, `src/api`, `src/domain`, `src/store`, `src/components`, các màn đã xong | `git diff --name-only master...HEAD` của lượt A2 → **đúng một** file `docs/contracts/S12-L1-doi-chieu.md` | **KHỚP** | — | Nợ R-68 của lượt trước (`MiniMap.tsx`/`ZoomCluster.tsx`) đã được người duyệt chấp thuận và ghi ở `T8-bao-cao-tich-hop.md:179-184`; lượt này không chạm |

---

## A. Danh sách LỆCH **TRONG PHẠM VI**

> Đây là **đầu vào bắt buộc và là thẩm quyền duy nhất** của nhiệm vụ **B1**.
> B1 chỉ được sửa đúng những mục dưới đây. Mục nào B1 thấy không sửa được thì **dừng và hỏi**,
> không tự mở rộng phạm vi.
>
> **19 mục, A-01 → A-19.** Thứ tự dưới đây là thứ tự **đề nghị làm**: A-01…A-06 là nút chết hoặc
> câu sai người dùng nhìn thấy ngay; A-07…A-19 nhẹ dần.

### A-01 — Panel trái thiếu hẳn phần **điều hướng tầng** (BC-05)
- **Sửa ở:** `src/screens/qc/WallLayerReview/WallLayerLeftPanel.tsx` (dựng),
  `useWallLayerReview.ts` (cấp dữ liệu), `WallLayerReview.container.tsx` (nối lối ra).
- **Sửa gì:** chèn một khối điều hướng tầng **giữa** bộ đếm (`WallLayerLeftPanel.tsx:146-164`) và
  cây lớp (`:172`). Danh sách tầng đọc từ `graph.byKind.level` — hook đã có `levelOf`
  (`useWallLayerReview.ts:351-365`), viết thêm một hàm cùng khuôn trả `readonly Level[]`; tầng đang
  mở là `level.id`. Lối ra dùng `ROUTES.project.walls(projectId, floorId)`
  (`src/routes/paths.ts:112-113`) qua đúng `props.onNavigate` mà container đã có
  (`WallLayerReview.container.tsx:113,157-162`) — **không** ghép chuỗi đường dẫn (R-65).
- **Không được:** thêm hằng đường dẫn mới; đọc danh sách tầng bằng một `useQuery` thứ hai.

### A-02 — Tim tường **không bật tắt được** (BC-17)
- **Sửa ở:** `WallLayerLeftPanel.tsx` (hoặc `WallLayerCanvas.tsx`), `useWallLayerReview.ts`,
  `wallLayerHatch.ts` (thêm trường vào `WallLayerCanvasViewProps`).
- **Sửa gì:** thêm một `Checkbox` (`src/components/ui/Checkbox.tsx`, đã dùng ở
  `WallLayerLeftPanel.tsx:186`) nhãn tiếng Việt viết thường kiểu câu, ví dụ `"Hiện tim tường"`,
  cộng một cờ `useState` trong hook và một `onToggleCentrelines`. Giữ nguyên hành vi hiện có làm
  **giá trị khởi tạo** (`useWallLayerReview.ts:1348`): bật công cụ vẽ/tách thì tim tường bật sẵn,
  nhưng người dùng đè lên được.
- **Nhớ:** thêm khoá vào `src/i18n/vi.json` dưới `wallLayerReview` (R-67).

### A-03 — Ba trong bốn công cụ **không làm gì**: vẽ tường, tách đoạn, đo (NL-06, NL-10, TT-10, BC-34)
- **Sửa ở:** `WallLayerCanvas.tsx`, `wallLayerHatch.ts`, `useWallLayerReview.ts`.
- **Sửa gì:** máy công cụ chỉ nhận `{type:'activate'}` (`useWallLayerReview.ts:871`). Cần nối
  ba sự kiện còn lại của `ToolEvent` (`src/lib/tools/toolMachine.ts:389-394`):
  1. canvas thêm `onPointerDown`/`onClick` trên `<svg>` (`WallLayerCanvas.tsx:290-296`) đọc toạ độ
     **đúng cách đang dùng cho `onPointerMove`** — `getScreenCTM().inverse()` (`:174-187`), tuyệt
     đối không tự quy đổi (`local/no-raw-number`);
  2. thêm `onCanvasPoint`/`onCanvasCommit`/`onCanvasCancel` vào `WallLayerCanvasViewProps`
     (`wallLayerHatch.ts`, phần MỞ RỘNG HỢP ĐỒNG — đúng cách file đó đã mở rộng sáu lần);
  3. hook chuyển tiếp thành `runToolEvent({type:'input', value})` / `{type:'commit'}` /
     `{type:'cancel'}`;
  4. `runToolEvent` (`:840-867`) xử lý thêm nhánh `outcome.kind === 'measurement'` → đặt vào một
     `useState` rồi trả ra `canvas.measurement` thay cho `null` cứng (`:1370`).
- **Kết quả phải đo được:** bấm W rồi vẽ được một tường mới; menu chuột phải "Tách đoạn"
  (`WallLayerCanvas.tsx:208`) thật sự tách; bấm M rồi đo được một khoảng và `MeasurementLabel`
  (`:344-352`) hiện ra.
- **Không được:** tự tính khoảng cách hay điểm cắt trong màn (R-61/CT-01) — `reduceTool` và
  `src/domain` làm việc đó.

### A-04 — Không chọn được **hai** tường, nên nút "nối đoạn" là nút chết (NL-07, NL-08)
- **Sửa ở:** `useWallLayerReview.ts:612-632`, `WallLayerShapeFigure.tsx:70-75`,
  `WallLayerList.tsx:290-316`.
- **Sửa gì:** `onSelect` phải nhận thêm **cách chọn**: Ctrl/Cmd-bấm gọi `toggleSelection`
  (`src/lib/selection/selectionOps.ts:167-177`) thay vì `selectSingle` (`:155-159`). Chữ ký
  `onSelect` của hợp đồng đóng băng (`types.ts:377`) không có chỗ nhận cờ đó, nên thêm một hàm
  **thứ hai** (ví dụ `onToggleSelect`) ở phần mở rộng của `wallLayerHatch.ts` /
  `WallLayerLeftPanel.tsx`, không sửa `types.ts`.
- **Rồi mới đến khoanh vùng:** `src/lib/selection/marquee.ts` đã có — nối vào cử chỉ kéo của
  canvas ở cùng lượt với A-03 (hai việc dùng chung một lớp theo dõi cử chỉ).
- **Kiểm bằng:** chọn hai đoạn → `toolRail.canMerge` (`:1102`) thành `true` → bấm nút gọi tới
  `createMergeWallsCommand`. Nếu B1 chỉ làm được vế Ctrl-bấm mà chưa làm khoanh vùng thì **ghi rõ**,
  đừng báo xong cả hai.

### A-05 — `heightLabel` ra `"3,00 m"` chứ không phải `"3.000,00 mm"` (BC-26)
- **Sửa ở:** `wallLayerReviewGateway.ts:1126`.
- **Sửa gì:** `formatLength(wall.heightMm)` → `formatLength(wall.heightMm, { unit: 'mm', fractionDigits: LENGTH_FRACTION_DIGITS })`,
  dùng lại đúng hằng đã có ở `:1038` (R-71: không viết `2` lần thứ hai).
- **Vì sao:** `formatLength` tự đổi sang mét từ 1 m trở lên (`src/lib/format/measure.ts:113`), và
  đặc tả đòi chiều dài lẫn chiều cao **cùng một cột milimét**.
- **Nhớ:** sửa luôn chú thích `types.ts:268` đang ghi ví dụ `"3,00 m"` — hoặc nếu B1 cho rằng
  `types.ts` đã đóng băng thì để nguyên và ghi vào báo cáo.

### A-06 — Xoá một tường **không hiện toast hoàn tác** (NL-16, CT-02)
- **Sửa ở:** `useWallLayerReview.ts:791-810`, `WallLayerReview.container.tsx`.
- **Sửa gì:** vé đã dựng đúng (`createWallUndoTicket`), chỉ thiếu chỗ hiện. Dùng
  `useToast` / `Toast.Provider` có sẵn (`src/components/feedback/Toast.tsx:31,147`) — **nhập**,
  không sửa. Toast mang `description` của vé (`wallLayerReviewGateway.ts:646`) và một nút "Hoàn tác"
  gọi `undoTicketRef.current.undo()`.
- **Kiểm trước khi làm:** `Toast.Provider` đã được dựng ở đâu chưa. Nếu chưa, container tự bọc
  (trong phạm vi `src/screens/**`). Đừng đặt thời lượng bằng tay — vé đã mang `UNDO_WINDOW_MS`
  (`wallLayerReviewGateway.ts:671`).

### A-07 — Tường ví dụ #W-014 dài 2.500 mm, đặc tả đòi 4.250 mm (BC-25)
- **Sửa ở:** `wallLayerReviewFixture.ts:130`.
- **Sửa gì:** hoặc đổi bộ mẫu để W-014 dài đúng 4.250 mm, **hoặc** để nguyên và ghi vào báo cáo
  rằng con số đặc tả là ví dụ minh hoạ.
- **Cảnh báo nặng:** lưới toạ độ của bộ mẫu là một mặt bằng khép kín, mọi đầu tường dùng chung
  toạ độ nguyên (`wallLayerReviewFixture.ts:1-16`). Đổi một đoạn sẽ **phá `resolveWallShapes`** ở
  bốn nút giao và làm đỏ `[NGHIEM-4]`. **Khuyến nghị: KHÔNG đổi bộ mẫu**, chỉ ghi lại. Nếu B1 vẫn
  đổi thì phải chạy `pnpm test` và dán số.

### A-08 — Độ dày và "cần chú ý" hiện bằng chấm/ô màu, đặc tả gọi là **chip** (BC-11, BT-05)
- **Sửa ở:** `WallLayerList.tsx:331-346`.
- **Sửa gì:** bọc ô màu + chữ độ dày trong `Badge` (`src/components/ui/Badge.tsx`) thay vì hai
  `<span>` trần, và cân nhắc một `Badge` "cần chú ý" cho hàng `statusCode === 'attention'`.
- **Ràng buộc:** hàng cao **đúng 40px** (`ROW_HEIGHT_PX`, `:244`) — `Badge` không được làm hàng
  cao lên, nếu không ảo hoá sẽ lệch. Kiểm `docs/contracts/ui.md` mục H trước khi dùng, và giữ
  `focus-visible:` dạng class (đừng để lọt một vòng tiêu điểm điều khiển bằng state — cảnh báo H1).

### A-09 — Không có điều khiển bật tắt **lớp Tường** (BC-19)
- **Sửa ở:** `WallLayerLeftPanel.tsx:172-182` (hàng cây lớp "Tường"), `useWallLayerReview.ts`.
- **Sửa gì:** thêm một nút con mắt **bàn phím tới được** (`tabIndex` mặc định, `aria-label` tiếng
  Việt có dấu — đúng hai lỗi mà `TreeItem` dùng chung đang mắc, xem `WallLayerLeftPanel.tsx:61-81`)
  gọi `toggleLayerVisibility('wall')` của kho qua một hàm hook, **không** gọi thẳng từ view (R-60).
- **Kết quả:** chú giải độ dày (`WallLayerCanvas.tsx:358-362`) sẽ ẩn/hiện theo — đúng câu
  "luôn hiện **khi lớp Tường bật**".

### A-10 — Một phép tính toạ độ còn nằm trong view (NL-11, CT-01)
- **Sửa ở:** `WallLayerShapeFigure.tsx:87-88`, `wallLayerReviewGateway.ts:873-877`.
- **Sửa gì:** `cx={shape.boundsPx.x + shape.boundsPx.width / 2}` là tâm hộp bao tính tại view.
  `centreOfBounds` **đã tồn tại** (`wallLayerReviewGateway.ts:873-877`) và hook đã dùng nó ở
  `useWallLayerReview.ts:1219`. Đưa tâm chấm vào `WallLayerCanvasShape` (thêm `attentionDotPx`) rồi
  view chỉ đọc.
- **Mức độ:** thấp — lint không bắt và cũng không sai kết quả. Nhưng đây là câu "không một phép
  hình học nào ở đây" của chính `WallLayerCanvas.tsx:10` chưa đúng hoàn toàn.

### A-11 — Chú giải không lấy nội dung từ P-07 (NL-13)
- **Sửa ở:** `wallLayerReviewGateway.ts:1021-1027`, hoặc **không sửa gì**.
- **Sửa gì:** B1 **không tự quyết**. Lý do bỏ `generateLegend` đã ghi tại chỗ và đứng vững:
  `Legend` của `src/lib/coloring/legend.ts:441` đếm theo token màu của một `ColoringMode`, còn màn
  cần ba băng độ dày. Nếu điều phối viên muốn bám chữ đặc tả thì phải dựng một `ColoringMode` cho
  độ dày ở `src/lib/coloring/**` — **và việc đó NGOÀI phạm vi** (chuyển sang B-06).
- **Việc của B1:** giữ nguyên mã, và **giữ nguyên chú thích lý do** — đừng "dọn dẹp" nó.

### A-12 — Nháy nền hàng: sai sự kiện, sai hiệu ứng, và không bao giờ tắt (TT-02)
- **Sửa ở:** `useWallLayerReview.ts:788,791-810,1323`, `WallLayerList.tsx:290-303`.
- **Sửa gì:** ba việc, làm cả ba hoặc ghi rõ việc nào bỏ:
  1. **Đặt đúng sự kiện:** đổi độ dày (`onChangeThickness`, `:724-733`) phải bật cờ nháy — hiện chỉ
     có hoàn tác-sau-khi-xoá bật nó (`:804`).
  2. **Đúng hiệu ứng:** hiện tại cờ đi ké `hoveredWallId` (`:1323`), tức hàng chỉ **giả vờ đang
     được rê chuột**. Tách thành một trường riêng (`flashingWallId`) trong phần mở rộng props, và
     view tô `bg-accent-wash` (token, không phải `#EEF4EF` — A1) với `duration-340` (không phải
     400 ms — R-71). Tiền lệ nguyên văn: `src/screens/account/AccountSettings/AppearanceSection.tsx:21-23`.
  3. **Tắt được:** hiện `setFlashingWallId` không có lượt gọi nào đưa về `null`
     (`rg "setFlashingWallId" …` → đúng một lượt gọi, `:804`), nên hàng đó sáng vĩnh viễn. Hẹn giờ
     tắt bằng nấc chuyển động đã có, không viết số mili-giây.

### A-13 — Ngưỡng gạch chéo là **dưới 0,90**, không phải dưới 0,75 (TT-06)
- **Sửa ở:** `wallLayerReviewGateway.ts:1083-1084`.
- **Sửa gì:** `confidenceLevel(wall.confidence) !== 'certain'` gom cả băng `'suggested'`
  (0,7 ≤ x < 0,9). Đổi sang `confidenceLevel(wall.confidence) === 'needsReview'` là **băng có sẵn
  gần đặc tả nhất** (dưới `CONFIDENCE_SUGGESTED_THRESHOLD` = 0,7, `src/lib/format/semantic.ts:41`).
- **Không được:** viết `0.75` vào màn (R-71). Con số đó không tồn tại ở đâu trong repo — xem **C-02**.
- **Hệ quả phải kiểm:** `wallLayerReviewScenarios.ts:96-101` và `wallLayerReviewFixture.ts:112-114`
  đang nói "chín tường có confidence < 0,75". Với `'needsReview'` thì số tường gạch chéo là những
  tường dưới 0,7 — **đếm lại và sửa hai chú thích đó cho khớp**, đừng để chúng nói một đằng.
  Bộ lọc "Chỉ hiện độ tin cậy thấp" (`useWallLayerReview.ts:377`) dùng chung hàm này nên sẽ đổi theo
  — đó là **đúng ý** (`wallLayerReviewGateway.ts:1078-1081`: một nguồn phân loại duy nhất).

### A-14 — Chuỗi `shortcutApprove` khai ra nhưng không có phím nào dùng (TT-12)
- **Sửa ở:** `useWallLayerReview.ts:201` và `src/i18n/vi.json:1418`.
- **Sửa gì:** chọn một trong hai, **không làm cả hai**:
  - (a) **Xoá** hai chuỗi đó — đặc tả không đòi phím duyệt, và `Enter` trên nút đang có tiêu điểm đã
    là đường bàn phím đúng (lý do ghi ở `useWallLayerReview.ts:74-78`); hoặc
  - (b) đăng ký thật một phím duyệt. **Nếu chọn (b) thì phải khảo sát trùng phím trước** —
    `RESERVED_KEYS` và `findOverlaps` của `src/lib/input/shortcutRegistry.ts`.
- **Khuyến nghị: (a).** Một chuỗi mô tả cho một phím không tồn tại là đúng thứ A2 chặn.

### A-15 — Câu trạng thái **Rỗng** trong mã khác câu trong `vi.json` và khác đặc tả (BT-01)
- **Sửa ở:** `useWallLayerReview.ts:193-194`.
- **Sửa gì:** đổi `WALL_LAYER_TEXT.emptyNotice` thành **đúng nguyên văn** câu đã nằm sẵn ở
  `src/i18n/vi.json:1383`:
  `"Chưa phát hiện được đoạn tường nào ở tầng này. Bạn có thể vẽ tường thủ công bằng phím W, hoặc chạy lại với ngưỡng thấp hơn."`
- **Đồng thời soát ba câu cùng loại đã trôi khỏi từ điển** (cùng một lỗi, cùng một lượt sửa):
  | mã | mã nguồn | `vi.json` |
  |---|---|---|
  | `viewerRoleNotice` | `useWallLayerReview.ts:195-196` | `:1385` |
  | `NO_MATCH_MESSAGE` | `WallLayerList.tsx:248` | `:1386` (`filterNoMatch`) |
  | `LIST_ARIA_LABEL` | `WallLayerList.tsx:246` ("Danh sách tường") | `:1400` ("Danh sách đoạn tường") |
- **Chọn bên nào:** `vi.json` là bản khớp đặc tả ở cả bốn chỗ → **mã đi theo `vi.json`**.
- **Cẩn thận:** `WallLayerReview.test.tsx` có thể khẳng định chuỗi cũ. Sửa test cho khớp **chuỗi
  mới đúng** là hợp lệ (đây là đổi đặc tả hiển thị, không phải nới điều kiện) — nhưng phải nói rõ
  trong báo cáo, R-70 đang nhìn.

### A-16 — Trạng thái **Lỗi** kích hoạt sai nguồn, và làm mất luôn ảnh gốc (BT-06, BT-07)
- **Sửa ở:** `useWallLayerReview.ts:880,1350` và `wallLayerReviewGateway.ts` (cổng giả).
- **Sửa gì:** hai vế, vế (1) là bắt buộc:
  1. **Giữ ảnh gốc ở trạng thái lỗi.** `backgroundImageUrl` đang là
     `backgroundQuery.data?.imageUrl ?? null` — ở `error` thì `data` là `undefined`, nên canvas rơi
     về ô xám (`WallLayerCanvas.tsx:278-279`). Giữ lần đọc thành công gần nhất
     (`backgroundQuery.data` cũ, hoặc `useQuery` với `placeholderData` giữ dữ liệu cũ) để canvas
     vẫn xem được — **đúng điều khoản mà chính `wallLayerReviewScenarios.ts:113-127` gọi là bắt buộc
     và `wallLayerReviewGateway.ts:226` đã hứa**.
  2. **Đúng nguồn lỗi.** `hasError = backgroundQuery.isError` biến "ảnh nền hỏng" thành "lớp tường
     hỏng". Nguồn đúng là lớp tường. Nếu không có đường đọc lớp tường nào hỏng được thì **ghi lại**
     và chỉ làm vế (1) — đừng bịa một cờ lỗi.
- **Sau khi sửa (1):** kịch bản `error` (`WallLayerReview.stories.tsx:120-126`) phải cho ra một
  canvas **có ảnh**, và cần một phép kiểm khẳng định điều đó (hiện chưa có: `rg "backgroundImage"
  src/screens/qc/WallLayerReview/WallLayerReview.test.tsx` → rỗng).

### A-17 — Ở trạng thái **Xong**, bộ đếm không đổi hình thức (BT-08)
- **Sửa ở:** `WallLayerLeftPanel.tsx:146-163`.
- **Sửa gì:** khi `panel.state === 'success'`, thanh 4px và con số chuyển sang token "đã xác minh"
  (`bg-state-verified` / `text-state-verified`).
- **A5 phải giữ:** màu xanh đó chỉ được xuất hiện vì `reviewed === total` — tức việc **người
  duyệt**, không phải điểm số AI. Ở đây điều kiện đúng là như vậy (`useWallLayerReview.ts:460`), nên
  không phạm A5.

### A-18 — Trạng thái **Thu gọn** không tới được trong ứng dụng thật (BT-16)
- **Sửa ở:** `WallLayerReview.tsx` hoặc `WallLayerCanvas.tsx`, `WallLayerToolRail.tsx`.
- **Sửa gì:** `onToggleCollapsed` (`types.ts:384`, `useWallLayerReview.ts:1311-1313`) không view nào
  gọi. Thêm một `IconButton` "thu gọn hai panel" (nhãn tiếng Việt) — chỗ tự nhiên nhất là cuối ray
  công cụ hoặc góc canvas — gọi `panel.onToggleCollapsed`.
- **Vì sao bắt buộc:** R-73 gọi đích danh "một hành động chỉ tồn tại như một prop optional không ai
  truyền". `forceCollapsed` (`:248,502`) là cửa **của story và bài kiểm**, không phải của người dùng.

### A-19 — "nối đoạn" đứng sai vị trí trên ray công cụ (BC-02)
- **Sửa ở:** `WallLayerToolRail.tsx:170-175` và `:226-239`.
- **Sửa gì:** đặc tả đọc ray theo thứ tự **chọn · vẽ tường · tách đoạn · nối đoạn · đo**; mã đang
  dựng bốn công cụ trước (`TOOLS`, `:170-175`) rồi mới tới nút "nối đoạn" (`:226-239`), nên "đo"
  đứng thứ tư và "nối đoạn" thứ năm. Chuyển khối nút "nối đoạn" lên **trước** mục `measure`.
- **Giữ nguyên:** "nối đoạn" vẫn là **nút hành động**, không phải một `ToolId` thứ chín — xem
  **C-05**. Đây chỉ là đổi thứ tự dựng, không đổi kiểu.
- **Nhớ:** ở vai Người xem, `measure` vẫn hiện còn "nối đoạn" bị ẩn (`:196-198,226`) — thứ tự mới
  không được làm hỏng hai nhánh đó.
- **Mức độ:** thấp. Làm cùng lượt với A-03/A-04 vì cùng chạm ray công cụ.

---

## B. Danh sách LỆCH **NGOÀI PHẠM VI**

> Không mục nào dưới đây được B1 chạm tới. Mỗi mục cần một prompt lô-gic riêng.

### B-01 — Token `--wall-centerline` không tồn tại (BC-16)
- **Chạm tầng:** `src/styles/globals.css` (khai token) + `tailwind.config.ts` (khoá tailwind).
- **R-68 chặn vì:** ba nhóm được sửa là `src/screens/**`, `src/routes/**`, `src/i18n/**`.
  `src/styles/**` không nằm trong đó, và bảng màu là nền móng cả ứng dụng dùng chung.
- **Hiện trạng chấp nhận được:** `wallLayerHatch.ts:92` dùng `--wall-idle`, token **sáng nhất**
  trong bốn token tường (`globals.css:180-183`), nên tim tường đọc được trên cả ba nền. Vẫn là
  token, không phạm A1.
- **Cần:** một lượt hệ-thiết-kế thêm `--wall-centerline` rồi màn đổi một dòng.

### B-02 — "vật liệu" không có trong mô hình dữ liệu (BC-28)
- **Chạm tầng:** `src/domain/spatial/types.ts` (thêm trường vào `Wall`) + `src/lib/commands` (lệnh
  đổi vật liệu) + `src/api` (đường đọc/ghi).
- **R-68 chặn vì:** `src/domain/**` có ngưỡng độ phủ 90% và mọi màn khác đọc cùng kiểu `Wall`.
- **Hiện trạng:** `WALL_KIND_LABELS` được dùng thay ("tường chịu lực"/"vách ngăn"/"tường bao",
  `wallLayerReviewGateway.ts:1128`), lý do ghi ở `types.ts:56-65`. Là quyết định hợp lý — **không
  bịa một khái niệm vật liệu mới ở tầng màn**.

### B-03 — "lệch Z" của một đoạn tường không tồn tại (BC-30)
- **Chạm tầng:** `src/domain/spatial/types.ts:123-132` — `Wall` không có trường cao độ/lệch Z nào.
- **R-68 chặn vì:** như B-02.
- **Hiện trạng:** `wallLayerReviewGateway.ts:1130` hiện **cao độ của tầng** (`level.elevationMm`),
  giống hệt nhau cho cả 48 tường — đúng về mặt số, nhưng không phải "lệch Z của đoạn tường này".
- **Cần:** một lượt lô-gic thêm `elevationOffsetMm` vào `Wall` cùng lệnh sửa nó.

### B-04 — Lệnh **duyệt tường** đang dựng ở tầng màn (NL-02)
- **Chạm tầng:** `src/lib/commands/business/wallCommands.ts` — `WALL_COMMAND_TYPES` (`:98-106`) có
  bảy lệnh, **không có** `wall.approve`.
- **R-68 chặn vì:** `src/lib/**` cấm chạm khi dựng màn.
- **Hiện trạng:** `wallLayerReviewGateway.ts:446,462-471` dựng lệnh bằng nguyên thuỷ công khai
  (`createCommand` + `changeForUpdate`), đi qua đủ năm bước `dispatch` nên hoàn tác được. Chính
  `types.ts:80-88` đã cảnh báo đây là ca **R-69** (đáng lẽ phải DỪNG và hỏi), và lượt T5/T8 đã đi
  tiếp thay vì hỏi.
- **Cần:** một prompt nhóm lô-gic thêm `wall.approve` (và có lẽ `wall.skip`) vào S-07, rồi màn xoá
  bản tự dựng. **Xin đưa mục này ra cổng duyệt của con người** — nó là một quyết định kiến trúc,
  không phải một lỗi hiển thị.

### B-05 — Không có đường lưu tường lên máy chủ (NL-14)
- **Chạm tầng:** `src/api/client.ts` (`FloorWriteBody` không có mảng tường) + `src/api/endpoints.ts`
  (không có `ENDPOINTS.*.walls`).
- **R-68 chặn vì:** `src/api/**` cấm chạm.
- **Hiện trạng:** `persistWallLayer` trả `unsupported` (`wallLayerReviewGateway.ts:142,340`) và tự
  lưu **nói ra sự thật đó** thay vì hiện "Đã lưu lúc…" giả (`useWallLayerReview.ts:564-569`). Đây là
  cách xử lý **đúng** theo R-69.
- **Đã ghi ở:** `T8-bao-cao-tich-hop.md` mục (d) số 1. Nhắc lại ở đây vì nó vẫn còn nguyên.

### B-06 — Chú giải theo P-07 cần một `ColoringMode` cho độ dày (NL-13, A-11)
- **Chạm tầng:** `src/lib/coloring/**`.
- **R-68 chặn vì:** `src/lib/**` cấm chạm.
- **Chỉ làm nếu** điều phối viên quyết bám chữ đặc tả. Nếu không, giữ nguyên bản hiện tại và đóng
  A-11.

### B-07 — `MiniMap` chưa lái được bằng bàn phím (A12)
- **Chạm tầng:** `src/components/canvas/MiniMap.tsx` + `src/hooks/useMiniMap.ts` — `role="button"` +
  `tabIndex={0}` nhưng nhánh Enter/Space rỗng.
- **R-68 chặn vì:** `src/components/**` và `src/hooks/**` đều ngoài ba nhóm.
- **Đã ghi ở:** `T8-bao-cao-tich-hop.md` mục (d) số 3, kèm chỉ đạo "không tự sửa". Không đổi.

---

## C. Đặc tả sai / luật thắng

### C-01 — 240 ms và 400 ms không tồn tại trên thang chuyển động (TT-01, TT-02, TT-04)
- **Luật:** mục B của `CLAUDE.md` ("thang chuyển động có **đúng năm giá trị**: 120, 180, 260, 340,
  700 ms"), **R-71** (`LUAT_MAN_HINH.md:239-251`), và `local/no-raw-duration` ở mức `error`
  (`eslint-rules/configs/project.js`). Nguồn duy nhất: `MOTION_DURATIONS_MS` trong
  `src/lib/motion/tokens.ts`.
- **Mã đang dùng gì:**
  | đặc tả | mã | `file:dòng` |
  |---|---|---|
  | 240 ms — chạy màu đa giác | **260 ms** (`duration-260`) | `WallLayerShapeFigure.tsx:78` |
  | 240 ms — bộ đếm chạy số | **260 ms** (nấc `'standard'` của `useCountUp`) | `useWallLayerReview.ts:914`, `WallLayerLeftPanel.tsx:141` |
  | 400 ms — nháy nền hàng | **340 ms** (nấc `'slow'`) là giá trị ĐÚNG phải dùng | tiền lệ `src/screens/account/AccountSettings/AppearanceSection.tsx:21-23`; thanh tiến độ đã dùng `duration-340` ở `WallLayerLeftPanel.tsx:160` |
- **Kết luận: đặc tả sai, luật thắng.** Mã đang đúng ở TT-01 và TT-04. **Không đề xuất nhét 240 vào
  mã.** Ở TT-02 phần *thời lượng* đã có câu trả lời đúng (340 ms) nhưng *hiệu ứng* thì chưa được
  dựng — phần chưa dựng đó nằm ở **A-12**, và nó là lỗi của mã, không phải của đặc tả.
- **Tiền lệ cùng loại đã được duyệt:** `PipelineFailure` cũng đổi 240 → 260 (`types.ts:63`).

### C-02 — Ngưỡng 0,75 không tồn tại trong repo (TT-06)
- **Luật:** **R-71** — "không hằng số viết tay trong màn… ngưỡng số"; **R-61** — hook chỉ nối lại
  logic đã có.
- **Thực tế:** `rg "0\.75" src/lib/format/semantic.ts src/domain/` → ba kết quả, **không cái nào là
  ngưỡng độ tin cậy**: hai dòng dữ liệu test (`src/domain/openings/__tests__/reflow.test.ts:286,295`)
  và một ngưỡng **tương phản màu** (`src/domain/quality/thresholds.ts:103`, `CONTRAST_GOOD_SCORE`).
  Hai ngưỡng độ tin cậy thật sự tồn tại là `CONFIDENCE_CERTAIN_THRESHOLD = 0.9` và
  `CONFIDENCE_SUGGESTED_THRESHOLD = 0.7` (`src/lib/format/semantic.ts:40-41`).
- **Kết luận: đặc tả sai ở con số, luật thắng** — màn **không được** viết `0.75`. Nhưng **việc chọn
  băng nào là quyết định của màn và nó đang chọn sai**: `!== 'certain'` = dưới 0,90, xa đặc tả hơn
  hẳn so với `=== 'needsReview'` = dưới 0,70. Phần sửa được nằm ở **A-13**.

### C-03 — "Xong" tên là `success`, không phải `done`
- **Luật:** **R-63** — màn đi qua `expectSevenStates`; tên bảy trạng thái lấy nguyên từ
  `SEVEN_STATES` của `src/lib/testing/sevenStateScenarios.ts`.
- **Mã:** `types.ts:137-144` dùng `'success'`; lý do ghi ở `:21-28`.
- **Kết luận: đặc tả (bản gốc gợi ý `done`) sai, luật thắng.** Không đổi.

### C-04 — "vật liệu" đổi thành nhãn `WallKind`
- **Luật:** **R-61** (không dựng khái niệm mới ở màn) + **R-68** (không thêm trường vào
  `src/domain`) + **R-69** (thiếu logic thì dừng và hỏi, không tự chế).
- **Mã:** `wallLayerReviewGateway.ts:1128`, lý do ở `types.ts:56-65`.
- **Kết luận: đặc tả đòi một khái niệm chưa tồn tại; luật thắng ở tầng màn.** Việc thật nằm ở
  **B-02**. Nhãn hiển thị vẫn là "vật liệu" (`WallLayerInspector.tsx:44`, `vi.json:1358`) — nếu
  điều phối viên muốn nhãn nói đúng cái nó hiện thì đổi thành "loại tường", nhưng đó là đổi **đặc
  tả**, không phải sửa lỗi, nên **không** đưa vào mục A.

### C-05 — "nối đoạn" không phải một công cụ (BC-02)
- **Luật:** **R-61** — không tự chế; **R-69** — thiếu thì dừng và hỏi.
- **Thực tế:** `ToolId` của `src/lib/tools/toolMachine.ts:84-92` có **tám** mục và không có mục nào
  cho việc gộp; `types.ts:89-97` đã ghi rõ điều này.
- **Mã:** dựng "nối đoạn" thành **nút hành động theo vùng chọn** (`WallLayerToolRail.tsx:226-239`,
  `canMerge`/`onMerge`).
- **Kết luận: đặc tả gọi nó là công cụ, luật thắng — nó là hành động.** Đúng. Chỗ **sai** là vùng
  chọn không bao giờ có hai tường, tức nút vĩnh viễn tắt (**A-04**) — đó là lỗi của mã, không phải
  của đặc tả.

### C-06 — Không có "QC-SHELL" để tuân theo (BC-01)
- **Luật:** `LUAT_MAN_HINH.md:7-14` — thứ tự ưu tiên đặt **prompt màn hình cuối cùng**, "vì nó viết
  trước khi repo có hình dạng như hôm nay".
- **Thực tế:** `rg "QC-SHELL" src/ docs/ *.md` → đúng một kết quả, là tiêu đề mục
  `docs/contracts/ui.md:456`. Không component vỏ nào được màn nào dùng
  (`rg -l "AppShell" src/screens/` → chỉ `ShellDemo.tsx`).
- **Kết luận: đặc tả trỏ tới một thứ chưa tồn tại; mã tự dựng bố cục, đúng như mọi màn khác.**
  Không phải lỗi. Nếu sau này QC-SHELL được dựng thật thì đây là màn phải sửa theo — ghi lại để
  không ai tưởng đã làm.

---

## D. Xác nhận phạm vi của chính lượt này

```
$ git status --short
(rỗng)

$ git diff --name-only master...HEAD
docs/contracts/S12-L1-doi-chieu.md
```

Đúng một đường dẫn. Không một dòng nào trong `src/` bị sửa.

---

## E. Tóm tắt số

| | Số mục |
|---|---|
| Câu đặc tả đã đối chiếu | **87** (BC 34 · NL 16 · TT 12 · BT 17 · CT 8) |
| KHỚP | 58 |
| LỆCH | 25 |
| LỆCH **có chủ ý** (luật thắng — TT-01, TT-04) | 2 |
| KHÔNG TÌM THẤY | 2 (BC-01 "QC-SHELL", BC-05 "điều hướng tầng") |

25 mục LỆCH cộng 2 mục KHÔNG TÌM THẤY được phân về:

| | Số mục |
|---|---|
| LỆCH **TRONG** phạm vi (mục A) | **19** |
| LỆCH **NGOÀI** phạm vi (mục B) | **7** — trong đó B-05 và B-07 là nợ T8 đã ghi, nhắc lại vì còn nguyên |
| Đặc tả sai / luật thắng (mục C) | **6** |

Ba mục nặng nhất, theo thứ tự nên làm:

1. **A-03** — vẽ tường, tách đoạn và đo đều không làm gì; máy công cụ chỉ nhận sự kiện `activate`.
2. **A-16** — trạng thái Lỗi làm mất luôn ảnh gốc, trái điều khoản mà chính mã tự hứa
   (`wallLayerReviewScenarios.ts:113-127`, `wallLayerReviewGateway.ts:226`).
3. **A-04** — không chọn được hai tường, nên nút "nối đoạn" vĩnh viễn tắt (A2).

Hai mục phải đưa ra **cổng duyệt của con người** trước khi ai đó động vào:
**B-04** (lệnh `wall.approve` đang dựng ở tầng màn — đáng lẽ là ca R-69 phải dừng và hỏi) và
**A-11/B-06** (bỏ P-07 cho chú giải — lý do đứng vững, nhưng là quyết định, không phải lỗi).
