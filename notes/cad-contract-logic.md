# Bản giao kèo tầng logic — CadBranchConfirm (L1-A)

Khảo sát tại HEAD `bac231b` (nhánh `mungvu2004/cad-l1a-contract-logic`). Mọi khẳng
định dưới đây kèm lệnh đã chạy để tự kiểm lại. Kết luận ngắn: **coordinator đúng
trên cả sáu mục T-03/T-04/T-08/O-02/L-03/P-01** — không mục nào "đã có, màn chỉ gọi
lại". Ba trong sáu mục (T-03, T-08, O-02) hoàn toàn không tồn tại ở tầng dữ liệu;
hai mục (T-04, L-03) tồn tại dưới dạng schema/hệ lỗi **chung chung**, không phải
schema/câu lỗi **riêng cho CAD**; một mục (P-01) tồn tại đầy đủ và dùng lại được
ngay. Hai gateway anh em (`pipelineGraphGateway.ts`, `processingGateway.ts`) đã tự
soát y hệt việc này trước tôi và ghi lại kết luận giống hệt, kèm chữ ký "đã soát
toàn bộ `src/api/endpoints.ts`, `src/api/schemas/**`, `src/lib/realtime/**`" —
xem mục KHUÔN GATEWAY.

---

## T-03 — kiểm tệp CAD: lớp tường, khai báo đơn vị, danh sách lớp, số thực thể/lớp

**NOT FOUND.**

Lệnh đã chạy:
```
Read src/lib/upload/validate.ts   (469 dòng, toàn văn)
Read src/lib/upload/index.ts      (79 dòng, toàn văn — bảng export)
Read src/lib/upload/uploadTask.ts (674 dòng, toàn văn)
Grep "layer|Layer|lớp" trên src/**  → 161 file, không file nào trong src/lib/upload
```

`src/lib/upload/validate.ts` chỉ làm ba việc:
1. `validateUploadFile(file: UploadCandidate): Promise<UploadValidation>` (dòng 233) —
   kiểm kích thước, đuôi tệp, số trang PDF. Với `.dwg` nó CHỈ gán
   `branch = 'cad'` (bảng `BRANCH_BY_EXTENSION`, dòng 141-146) rồi trả ngay
   `{ branch, extension, ok: true, sizeBytes }` (dòng 261) — **không mở tệp DWG,
   không đọc byte nào của nó**. So sánh với nhánh PDF cùng hàm: PDF thì có
   `readPdfPageCount` đọc byte thật; DWG thì không có hàm tương đương.
2. `readPdfPageCount` (dòng 296) — chỉ cho PDF, đếm trang bằng cách quét token
   `/Count` và `/Type /Page` trong byte thô. Không áp dụng cho DWG.
3. `guessFloorFromFileName` (dòng 340) — đoán số tầng từ TÊN TỆP, không đọc nội
   dung.

`UploadBranch = 'cad' | 'pdf' | 'raster'` (dòng 64) là nhãn hiển thị chip "Nhánh
CAD" dựa trên **đuôi tệp**, không phải kết quả đọc nội dung file CAD — xác nhận
bằng chú thích dòng 61: *"The screen reads this to show the 'Nhánh CAD' pill
instead of sniffing the extension a second time."* Đây CHÍNH LÀ trường
`isCadBranch` mà `FloorUploadScreen/types.ts:75-76` dùng cho chip, và
`FloorUploadScreen/types.ts:15-16` nói thẳng nó chỉ là một cờ boolean có sẵn, không
liên quan gì tới "có lớp tường hay không / có khai báo đơn vị hay không".

Không tìm thấy: hàm đọc lớp DWG, danh sách tên lớp, số thực thể mỗi lớp, cờ "có
lớp tường", cờ "có khai báo đơn vị". Đã grep `layer|Layer|lớp` trên toàn `src/`
(161 file) — không file nào thuộc `src/lib/upload/**` hay bất cứ đâu mang ý nghĩa
"lớp CAD"; các kết quả khớp đều là `layerDimensions/layerGrids/layerObjects/
layerRooms` (route `/layers/...`, một khái niệm khác — lớp hiển thị của mô hình
3D, không phải lớp AutoCAD).

Gần nhất tồn tại: không gì. Không có `readCadLayers`, không có `inspectDwgFile`,
không có hàm nào đọc nội dung một tệp `.dwg`.

---

## T-04 — schema kết quả đọc CAD

**NOT FOUND** (schema riêng cho CAD). Có schema chung cho `Drawing`/`Progress`,
nhưng không trường nào mang thông tin CAD.

Lệnh đã chạy:
```
Read src/types/pipeline.ts   (10 dòng, toàn văn)
Read src/types/project.ts    (18 dòng, toàn văn)
Read src/api/contracts.ts    (223 dòng, toàn văn)
ls src/api/schemas/           → __tests__, decode.ts, index.ts, quality.ts
```

`src/types/pipeline.ts` và `src/types/project.ts` là hai kiểu **rất mỏng, quy ước
snake_case** (`eta_seconds`, `created_at`, `avatar_url`) — trái ngược hoàn toàn với
quy ước camelCase mọi nơi khác trong repo (`progressPercent`, `heightMm`...). Đây
là dấu hiệu chúng thuộc bộ khung demo cũ (`src/App.tsx` — bảng chọn 9 màn demo,
đã ghi trong CLAUDE.md), không phải schema đang dùng thật. Không trường CAD nào ở
cả hai file.

Schema thật nằm ở `src/api/contracts.ts`, tái xuất từ `src/api/schemas/`.
`DrawingSchema` — theo đúng lời `pipelineGraphGateway.ts:26-27` (đã tự soát và ghi
lại, xem mục KHUÔN GATEWAY) — chỉ mang `heightMm, id, name, scale?, uploadedAt,
uploaderId, url, widthMm`. Không trường nào nói "tệp này là CAD", không trường lớp,
không trường thực thể. `ProgressSchema` chỉ mang `progressPercent, status, step,
startedAt?, endedAt?, error?, id` — một luồng tiến độ duy nhất, không có cấu trúc
theo bước.

`src/api/schemas/index.ts` chỉ export sáu schema tài nguyên (`Drawing`, `Floor`,
`Progress`, `Project`, `User`, `Version`) cộng tám schema chất lượng ảnh đầu vào
(`DrawingCornersInputSchema`, `FloorImageQualitySchema`,
`ImageQualityAssessmentSchema`...) — không schema nào tên có "cad", "layer",
"entity", "dwg".

Gần nhất tồn tại: `FloorImageQuality` (từ `src/api/schemas/quality.ts`, dùng bởi
`scaleCalibrationGateway.ts`) — mang `floorId, floorName, sourceUrl, measurement?,
frame?, findings[]`. Đây là schema CHẤT LƯỢNG ẢNH QUÉT (T-05, invariant khác hẳn),
không phải kết quả đọc CAD.

---

## T-08 — đặt nhánh (cad | ai) cho pipeline

**NOT FOUND.** Xác nhận độc lập từ chính mã nguồn: `pipelineGraphGateway.ts:22-43`
đã tự soát y hệt việc này trước tôi, kết luận giống hệt, xem mục KHUÔN GATEWAY.

Lệnh đã chạy:
```
Read src/lib/realtime/pipeline.ts   (168 dòng, toàn văn)
Grep "CAD|cad" trên src/**          → 32 file, không hàm đặt nhánh nào trong đó
```

`src/lib/realtime/pipeline.ts` export đúng bốn thứ:
- `PIPELINE_STAGES` — mảng tĩnh sáu bước cố định (`preprocess`,
  `wallSegmentation`, `openingAndFurnitureDetection`, `dimensionReading`,
  `spatialDataBuild`, `qualityCheck`), mỗi bước có trọng số cộng lại 100.
- `getPipelineStages()` (dòng 106) — trả sáu bước kèm nhãn tiếng Việt.
- `calculateTotalProgress()` (dòng 113) — gộp phần trăm sáu bước, kẹp ở 99 cho
  tới khi mọi bước xong.
- `estimateRemainingSeconds()` (dòng 125) — ước lượng thời gian còn lại từ tốc độ
  ba bước gần nhất.

Không hàm nào tên `setBranch`, `chooseBranch`, `resolvePipelineBranch`, không kiểu
`PipelineBranch = 'cad' | 'ai'` trong file này. Sáu bước là CỐ ĐỊNH — không rẽ
nhánh theo cad/ai ở tầng này; `wallSegmentation`, `openingAndFurnitureDetection`,
`dimensionReading` đều là các bước NHẬN DẠNG (chỉ có nghĩa cho nhánh AI). Không có
khái niệm "bỏ qua các bước này vì đã có CAD" ở đây.

`PipelineBranchId` (kiểu dùng bởi `pipelineGraphGateway.ts`) được khai ở
`src/screens/pipeline/PipelineGraph/types.ts`, KHÔNG ở `src/lib`. Nó là kiểu của
tầng MÀN, không phải tầng logic — và gateway đọc nó chỉ để gõ kiểu cho dữ liệu
MẪU (`PIPELINE_GRAPH_SAMPLE_BRANCH_REPORT`), không có nguồn thật nào gán giá trị
đó.

Gần nhất tồn tại: hoàn toàn không có gì đặt/đọc nhánh cad|ai ở `src/lib/**` hay
`src/api/**`.

---

## O-02 — flags ghi nhớ lựa chọn THEO DỰ ÁN

**NOT FOUND.** `src/lib/telemetry/flags.ts` là hệ cờ tính năng khác hẳn về bản
chất với "ghi nhớ lựa chọn theo dự án".

Lệnh đã chạy:
```
Read src/lib/telemetry/flags.ts   (1126 dòng, toàn văn)
Grep "unwiredByProject" trên src/** → 2 file (projectSettingsGateway.ts, scaleCalibrationGateway.ts)
```

`FEATURE_FLAG_KEYS` (dòng 86-92) là danh sách **cố định, đóng cứng lúc biên dịch**:
`scene.instanced-walls`, `scene.soft-shadows`, `rules.parallel-run`,
`export.pdf-vector`, `qc.live-collaboration`. Đây là năm cờ bật/tắt TÍNH NĂNG
CHO TOÀN CỤC BUILD (rollout theo nhóm người dùng), không tham số hoá theo
`projectId`. Thứ tự đọc là `override → server → default` (dòng 265-269), lưu ở
`localStorage` khoá `appfront-feature-flags` (dòng 477) — một khoá DUY NHẤT cho
CẢ TRÌNH DUYỆT, không phải một khoá cho mỗi dự án. Không hàm nào trong file nhận
tham số `projectId`.

Đây không phải nơi lưu "dự án X đã chọn nhánh CAD, dự án Y chưa hỏi". Thêm một
giá trị `'flows.cad-branch-remembered'` vào `FEATURE_FLAG_KEYS` SẼ SAI ngữ nghĩa:
nó biến một lựa chọn của một dự án thành một cờ bật/tắt cho cả trình duyệt.

Gần nhất tồn tại: khuôn "bộ nhớ trong theo dự án, sống trong phiên trình duyệt,
mất khi tải lại trang" — dùng `Map<string, T>` ở mức module, khoá bằng
`projectId` (hoặc `projectId::floorId`). Có ĐÚNG HAI tiền lệ, cả hai đã tự ghi
chú rõ đây là quyết định "chưa có endpoint, giữ trong phiên":
- `projectSettingsGateway.ts:181` — `const unwiredByProject = new Map<string,
  ProjectUnwiredSettings>()`, đọc/ghi qua `readUnwired`/`writeUnwired`
  (dòng 183-202), xoá khi `deleteProject` (dòng 326).
- `scaleCalibrationGateway.ts:250` — `const persistedScales = new
  Map<string, MillimetresPerPixel>()`, khoá `` `${projectId}::${floorId}` ``
  (dòng 252), đọc bằng `readPersistedScale` (dòng 255), xoá bằng
  `clearPersistedScales` (dòng 263) — dùng bởi test.

Đây LÀ khuôn gateway mới nên chép cho O-02: một `Map` module-scope, không phải
`localStorage`, không phải `FEATURE_FLAG_KEYS`. Phải nói thật với người dùng rằng
lựa chọn này **không sống qua một lần tải lại trang** — đúng cách hai tiền lệ trên
đã tự thú nhận trong chú thích của chúng.

---

## L-03 — câu lỗi khi tệp CAD hỏng hoặc phiên bản mới hơn mức hỗ trợ

**NOT FOUND** (câu lỗi riêng cho CAD). Có hệ lỗi CHUNG, không có kịch bản riêng.

Lệnh đã chạy:
```
Read src/lib/errors/kinds.ts         (181 dòng, toàn văn)
Read src/lib/errors/describeError.ts (58 dòng, toàn văn)
Read src/lib/errors/toAppError.ts    (334 dòng, toàn văn)
node -e "console.log(Object.keys(require('./src/i18n/vi.json').errors))"
Grep "phiên bản|hỏng|corrupt|version" trên src/i18n/vi.json
```

`APP_ERROR_KINDS` (kinds.ts dòng 1-15) có 13 giá trị:
`network, timeout, unauthenticated, forbidden, notFound, conflict, validation,
rateLimited, upload, processing, geometry, export, unknown`. Không giá trị nào
tên `cad`, `corruptedFile`, `unsupportedVersion`. `src/i18n/vi.json`, khoá
`errors`, có đúng 13 khoá con — khớp 1-1 với 13 kind trên, không khoá thứ 14 nào
cho CAD.

Grep "phiên bản|hỏng|corrupt|version" trên `vi.json` cho ba khớp: hai câu nói về
"nội dung đã được người khác cập nhật, tải lại để xem phiên bản mới nhất" (dòng
31, 35 — đây là ngữ nghĩa CONFLICT/xung đột chỉnh sửa, không phải "tệp CAD phiên
bản mới hơn mức hỗ trợ"), và một nhãn trạng thái đơn `"failed": "hỏng"` (dòng
1085, nhãn trạng thái pipeline, không phải câu lỗi đầy đủ).

`toAppError.ts` map lỗi vào 13 kind trên bằng mã HTTP hoặc từ khoá trong văn bản
lỗi (`KEYWORD_KIND_PATTERNS`, dòng 20-33) — không có nhánh nào bắt "tệp CAD hỏng"
hay "phiên bản DWG không hỗ trợ" thành một kind hay message riêng. Một lỗi 422
khi đọc DWG hỏng SẼ rơi vào kind `validation` chung — cùng câu với MỌI lỗi
validation khác trong hệ thống, không phải câu "tệp CAD của bạn hỏng, hãy xuất
lại từ AutoCAD" như spec ngụ ý.

Điểm hạ tầng có sẵn đáng chú ý: `PRIMITIVE_KEYS` (`toAppError.ts:35`) đã liệt kê
`'layer'` như một tham số lỗi được đọc từ payload — `['step', 'floor', 'count',
'field', 'resource', 'fileName', 'layer']`. Nghĩa là CẤU TRÚC `AppError.params`
đã sẵn sàng mang tên lớp CAD nếu server trả về trường `layer` trong lỗi, nhưng
**không kind nào, không message template nào trong `vi.json` dùng tham số này**
cho một câu về CAD. Đây là hạ tầng gần nhất tồn tại — không phải logic đã xong.

Gần nhất tồn tại: kind `validation` (422) và `upload` (413) — chung chung, không
đặc thù CAD. Câu lỗi thật của mục L-03 (nếu cần một kind mới, ví dụ
`cadUnsupportedVersion`, hoặc dùng `params.layer` với kind `validation` có sẵn
kèm template `vi.json` mới) là quyết định thiết kế CHƯA CÓ TRONG MÃ — không phải
việc "gọi lại" được.

---

## P-01 — định dạng số lượng

**FOUND.** Đây là mục DUY NHẤT đúng như spec: logic đã có đầy đủ, đã test, màn chỉ
cần gọi.

Lệnh đã chạy:
```
Read src/lib/format/number.ts    (267 dòng, toàn văn)
Read src/lib/format/measure.ts   (227 dòng, toàn văn)
```

`formatNumber(value: MaybeNumber, options?: NumberFormatOptions): string`
(`number.ts:201`) — chữ ký:
```ts
formatNumber(1234567.891)                     // "1.234.567,891"
formatNumber(3.5, { fractionDigits: 2 })      // "3,50"
formatNumber(null)                            // "—"
```
Dùng cho "số thực thể mỗi lớp", "số lớp": không đơn vị, không thập phân
(`{ grouping: true }` mặc định là đủ cho một số nguyên đếm được — ví dụ
`formatNumber(48)` → `"48"`).

`formatArea`, `formatLength`, `formatPercent` (cùng file `measure.ts`/`number.ts`)
sẵn sàng cho các trường đo khác nếu màn cần (không thấy nhu cầu trực tiếp cho
màn ánh xạ lớp, nhưng liệt kê để đủ bức tranh P-01).

Mọi giá trị `null`/`undefined`/`NaN`/`Infinity` đều render `MISSING_VALUE = '—'`
(dòng 33) — gateway mới KHÔNG được tự bịa `"0"` hay chuỗi rỗng cho "chưa đếm được",
phải trả `null`/`undefined` và để `formatNumber` tự xử lý.

---

## KHUÔN GATEWAY

Ba gateway đọc toàn văn: `pipelineGraphGateway.ts` (588 dòng),
`processingGateway.ts` (781 dòng), `scaleCalibrationGateway.ts` (377 dòng). Cả ba
cùng một khuôn, tự ghi chú tường minh trong chính file (không phải suy luận của
tôi):

### Khuôn chung (cả ba)
1. Một `interface XxxGateway` — hình dạng cổng, hook chỉ nói chuyện qua đây,
   không `import '@/api'` trực tiếp.
2. `supports: Readonly<Record<Capability, boolean>>` — cờ ĐỒNG BỘ nói khả năng
   nào có đường nối thật hôm nay. Đọc được TRƯỚC khi gọi bất cứ hàm nào của cổng.
3. `XxxCapabilityResult<T> = { supported: true; value: T } | { supported: false;
   capability; missing: string }` — không bao giờ trả giá trị bịa (`0`, `[]`, `''`)
   giả làm dữ liệu thật khi chưa có endpoint. Hàm `unsupported(capability)` dựng
   nhánh false, tra `missing` từ một bảng hằng `XXX_MISSING_ENDPOINTS` viết tên
   endpoint còn thiếu NGUYÊN VĂN.
4. `createXxxGateway(client: ApiClient, options?)` — factory bản thật, nhận
   `ApiClient` đã tiêm.
5. `createAppXxxGateway()` — bọc factory trên với `createAppApiClient()`, đây là
   thứ `.container.tsx` gọi.
6. `describeApiFailure(error: unknown): XxxFailure` — gọi `toAppError` +
   `describeError` của `src/lib/errors`, KHÔNG viết lại câu lỗi ở gateway (L-03
   luôn đi qua đúng một cửa).
7. `now: () => number` — đồng hồ tiêm được, không đọc `Date.now()` trực tiếp
   trong logic.
8. Một cổng giả `createMockXxxGateway`/`createMock...` cho story/test, dữ liệu
   mẫu đặt tên `XXX_SAMPLE_...`, viết nguyên trong cùng file, KHÔNG bịa tại chỗ
   gọi (R-70/R-73).

### Từng cái nhận gì / trả gì / gọi `src/lib` thật nào / tự dựng gì

**`pipelineGraphGateway.ts`** (màn Sơ đồ xử lý):
- Nhận: một `ProcessingGateway` đã dựng sẵn (KHÔNG nhận `ApiClient` trực tiếp —
  dòng 285-289, lý do ghi ở dòng 10-16: "hai màn cùng đọc một nguồn thì phải cùng
  đọc qua một đường").
- Trả: `readRunOnce`/`subscribeRun` gọi lại đúng `processing.readProgressOnce` /
  `processing.subscribeProgress` + `toStageBreakdown` của
  `processingGateway.ts`. `readBranchReport`, `readBranchComparison`,
  `readNodeDetail`, `switchBranch`, `rerunFromNode` — cả năm hàm CHỈ trả
  `unsupported(...)` (dòng 343-347), không có đường nối thật.
- `src/lib` thật đã gọi: `describeError`/`toAppError` (`@/lib/errors`),
  `PipelineStageId`/`PipelineStageState` (`@/lib/realtime/pipeline`).
- Tự dựng dữ liệu mẫu: `PIPELINE_GRAPH_SAMPLE_BRANCH_REPORT`,
  `PIPELINE_GRAPH_SAMPLE_COMPARISON`, `PIPELINE_GRAPH_SAMPLE_NODE_DETAILS` (dòng
  372-518) — TOÀN BỘ nội dung nhánh cad/ai trong file này là dữ liệu mẫu cho
  test/story, KHÔNG có nguồn thật.
- Trích nguyên văn xác nhận độc lập (dòng 22-43): *"Đã soát toàn bộ
  `src/api/endpoints.ts`, `src/api/schemas/**` và `src/lib/realtime/**`: **không
  có khái niệm nhánh CAD / nhánh AI ở tầng dữ liệu**."*

**`processingGateway.ts`** (màn Xử lý):
- Nhận: `ApiClient` thật (dòng 633).
- Trả: `readProgressOnce`/`subscribeProgress` nối thật qua
  `ENDPOINTS.drawings.progress` + `createProgressStream`. `runInBackground` nối
  thật qua `backgroundWatchRegistry` (không cần endpoint mới). Sáu khả năng còn
  lại (`cancelProcessing`, `queuePosition`, `parallelFloorPipeline`,
  `completionNotice`, `extractionSummary`, `stepDetails`, `detectedGeometry`) —
  toàn bộ `unsupported(...)`.
- `src/lib` thật đã gọi: `createAppApiClient` (`@/api/appClient`),
  `ENDPOINTS` (`@/api/endpoints`), `describeError`/`toAppError`
  (`@/lib/errors`), `createUuid` (`@/lib/http/ids`), `getPipelineStages`
  (`@/lib/realtime/pipeline`), `backgroundWatchRegistry`
  (`@/lib/realtime/backgroundWatch`), `createProgressStream`
  (`@/lib/realtime/progressStream`), `createBeaconTransport`/
  `createTelemetrySender` (`@/lib/telemetry/sender`).
- Tự dựng: hàm `toStageBreakdown` (dòng 515-571) — ÁNH XẠ `Progress.step` (chuỗi
  tự do) sang sáu bước `PIPELINE_STAGES` bằng TRA CỨU, không công thức, dưới một
  giả định ghi rõ tên ("giả định C3": mọi bước đứng trước bước đang chạy coi như
  xong). Đây là ví dụ mẫu cho việc "phải tự dựng phép ánh xạ khi dữ liệu server
  không đủ chi tiết, nhưng phải VIẾT RA giả định thay vì giấu nó".

**`scaleCalibrationGateway.ts`** (màn Hiệu chỉnh tỷ lệ):
- Nhận: `ApiClient` thật (dòng 276).
- Trả: `readFloorDrawing` nối thật qua `client.quality.assess` (một endpoint duy
  nhất trả đủ ba thứ màn cần: `sourceUrl`, `widthPx/heightPx`, `frame.isFound`).
  Năm khả năng còn lại (`dimensionStrings`, `referenceWallWidth`,
  `typicalDoorWidth`, `largestRoomBox`, `snapTargets`) —
  `unsupported(...)`. `persistScale` — KHÔNG có endpoint ghi tỷ lệ, tự dựng bằng
  `Map` module-scope `persistedScales` (dòng 250), trả `ok: true` THẬT vì nó
  thật sự giữ giá trị trong phiên (dòng 41-43: *"Không có gì được hứa hơn
  thế"*).
- `src/lib` thật đã gọi: `toAppError` (`@/lib/errors`), `createAppApiClient`
  (`@/api/appClient`), `createMockApiClient` (`@/api/__mocks__/client`),
  `ENDPOINTS` (`@/api/endpoints`), `pixels` (`@/domain/units/scale`),
  `millimetres` (`@/domain/units/types`).
- Tự dựng: `Map<string, MillimetresPerPixel>` khoá `projectId::floorId` — ĐÚNG
  KHUÔN mà O-02 cần chép cho gateway mới (xem mục O-02 ở trên).

---

## Mục R-64 — tầng `src/lib/query` / `src/lib/mutations`, cắm vào thế nào

Không có domain `cad` trong `queryKeys.ts` (`QueryDomain` chỉ có: `drawing, floor,
library, progress, project, quality, room, space, user, version, violation` —
`queryKeys.ts:3-14`). Gateway mới KHÔNG được tự thêm domain `cad` vào đây trong
phạm vi task này (whitelist chỉ cho phép sửa `notes/`) — đây là việc của người
dựng màn thật, ghi lại để họ biết cần thêm.

Chữ ký thật:

```ts
// src/lib/query/queryKeys.ts
export const queryKeys = {
  quality: {
    assessment: (floorId: string) => readonly [...]  // ví dụ khoá theo floorId
  },
  // ...
} as const;
```
Khoá được đóng băng (`Object.freeze`), có `.root()` để invalidate theo tiền tố.
Domain mới (ví dụ `cadLayerMapping`) cần một khoá factory cùng khuôn, ví dụ
`queryKeys.cadLayerMapping.byFloor(floorId)`.

```ts
// src/lib/query/cachePolicy.ts
export function resolveCachePolicy(queryKey: QueryKey): ResolvedCachePolicy
```
`TIER_BY_DOMAIN` (dòng 77-84) map domain → tier (`default | static | aiProgress |
spatialDraft`). Domain không liệt kê rơi vào `default` (staleTime 30s, gcTime
10m). Đọc lớp CAD của MỘT tầng đang mở giống hệt lý do `spatialDraft` tồn tại
("dữ liệu không gian đang chỉnh sửa" — staleTime 10s) hơn là `default`; đây là
quyết định thiết kế cho người dựng màn, không phải kết luận có sẵn.

```ts
// src/lib/query/invalidation.ts
export const invalidationMap: InvalidationMap = { /* mỗi WriteOperation → mảng QueryKey */ };
export function applyInvalidation<TOperation extends WriteOperation>(
  queryClient: QueryClient, operation: TOperation, params: WriteOperationParamsMap[TOperation],
): void
```
`WRITE_OPERATIONS` (dòng 5-16) hiện có 10 giá trị, KHÔNG có `mapCadLayers` hay
`confirmCadBranch`. Thao tác ánh xạ lớp CAD → vai trò là một ghi (write) mới,
chưa có mục trong bảng này.

```ts
// src/lib/mutations/createOptimisticMutation.ts
export interface OptimisticMutationConfig<TVariables, TResult> {
  affectedKeys: (variables: TVariables) => readonly QueryKey[];
  afterSuccess: (result: TResult, variables: TVariables) => void;
  applyOptimistic: (variables: TVariables) => void;
  callServer: (variables: TVariables) => Promise<TResult>;
  entityId: (variables: TVariables) => string;
  rollback: (variables: TVariables) => void;
}
export function createOptimisticMutation<TVariables, TResult>(
  queryClient: QueryClient, config: OptimisticMutationConfig<TVariables, TResult>,
): UseMutationOptions<TResult, AppError, TVariables>
```
Cách gọi: `useMutation(createOptimisticMutation(queryClient, { affectedKeys: (v) =>
[queryKeys.xxx.byFloor(v.floorId)], entityId: (v) => v.floorId, applyOptimistic,
callServer, afterSuccess, rollback }))`. Xem trực tiếp thứ này với "xem trước cập
nhật ngay" ([CẤM TUYỆT ĐỐI] mục 3 của spec): `applyOptimistic` chính là cơ chế cho
canvas cập nhật ngay khi người dùng đổi ánh xạ lớp → vai trò, trước khi server xác
nhận.

---

## KẾT LUẬN: gateway mới phải tự dựng những gì

Đây là danh sách những gì KHÔNG có nguồn thật để "gọi lại" — gateway mới của màn
`CadBranchConfirm` phải tự khai `unsupported(...)` có tên, đúng khuôn ba gateway
trên, cho TỪNG mục sau (không được bịa giá trị thay thế — R-69):

1. **Đọc nội dung tệp CAD (T-03).** Không có hàm đọc byte một tệp `.dwg`. Cần
   endpoint kiểu `GET .../floors/:floorId/drawings/:uploadId/cad-inspection` trả
   về: có lớp tường hay không (boolean), có khai báo đơn vị hay không (boolean),
   danh sách tên lớp (`readonly string[]`), số thực thể mỗi lớp
   (`Record<string, number>`). **Cấm tuyệt đối "không tự đọc tệp CAD trong màn"**
   (mục 3 của spec) nghĩa là hàm đọc này PHẢI ở server — gateway chỉ gọi endpoint,
   không tự parse DWG bằng JS ở client.
2. **Schema kết quả đọc CAD (T-04).** Không schema nào trong `src/api/schemas/`
   mang hình dạng "kết quả đọc CAD". Cần một schema mới (ví dụ
   `CadInspectionSchema`), .strict(), theo đúng khuôn `FloorImageQualitySchema`
   hiện có (schema Zod + kiểu suy ra + wire type).
3. **Đặt/đọc nhánh xử lý cad|ai cho một tầng (T-08).** Không hàm nào trong
   `src/lib/realtime/pipeline.ts` hay bất cứ đâu đặt nhánh này. Cần một trường
   hoặc endpoint (ví dụ `Floor.processingBranch: 'cad' | 'ai'`, hoặc một lệnh
   ghi `POST .../floors/:floorId/branch`). Cho tới khi có, gateway trả
   `unsupported('setBranch')` và **hộp thoại chốt nhánh KHÔNG được coi việc bấm
   nút là đã lưu lên server** — chỉ optimistic trong phiên, đúng khuôn
   `scaleCalibrationGateway.persistScale`.
4. **Ghi nhớ lựa chọn theo dự án (O-02).** Không `localStorage` theo dự án,
   không API. Chép ĐÚNG khuôn `Map<string, T>` module-scope khoá `projectId` của
   `projectSettingsGateway.ts:181` / `scaleCalibrationGateway.ts:250`. PHẢI ghi
   rõ trong hook/props rằng lựa chọn này **mất khi tải lại trang** — đây là sự
   thật phải truyền lên giao diện (không phải lời hứa "nhớ mãi mãi" mà spec gốc
   ngụ ý bằng chữ O-02 "ghi nhớ").
5. **Câu lỗi tệp CAD hỏng / phiên bản không hỗ trợ (L-03).** Không kind lỗi
   riêng, không message `vi.json` riêng. Hai lựa chọn cho người dựng màn (quyết
   định KHÔNG thuộc phạm vi khảo sát này, phải hỏi coordinator trước khi chọn):
   (a) thêm kind mới `cadUnsupportedVersion`/`cadCorrupted` vào
   `APP_ERROR_KINDS` + `APP_ERROR_KIND_CONFIG` + `vi.json` (đổi
   `src/lib/errors/**`, NẰM NGOÀI whitelist R-68 của người dựng màn — phải xin
   duyệt riêng vì đây là sửa `src/lib/**`), hoặc (b) dùng kind `validation` có
   sẵn với `params.layer`/`params.fileName` (hạ tầng đã có ở
   `toAppError.ts:35`) và chỉ thêm template câu trong `vi.json` (không đổi
   `src/lib/errors/kinds.ts`). **[CẤM TUYỆT ĐỐI] "Thực thể không hỗ trợ phải gọi
   tên, không được gộp thành 'một số lỗi'"** nghĩa là template câu PHẢI nội suy
   tên lớp/thực thể cụ thể — không câu chung chung "có lỗi khi đọc tệp".
6. **Endpoint ánh xạ lớp → vai trò và lưu kết quả.** Không có trong
   `src/api/endpoints.ts` (đã đọc toàn văn — chỉ có `auth, drawings, featureFlags,
   floors, projects, quality, spatial`). Cần endpoint ghi (ví dụ
   `POST .../floors/:floorId/cad-layer-mapping`) — không có, gateway trả
   `unsupported('saveLayerMapping')`.
7. **`queryKeys` domain mới + tier cache + `WriteOperation` mới (R-64).** Không
   trong phạm vi sửa của task khảo sát này (`src/lib/query/**` nằm ngoài
   whitelist người dựng màn ở R-68), nhưng người dựng màn cần thêm domain
   `cadLayerMapping` vào `queryKeys.ts`, một tier vào `cachePolicy.ts`
   (`spatialDraft` có vẻ hợp — xem lý lẽ ở mục R-64), và một `WriteOperation`
   mới (`mapCadLayers`) vào `invalidation.ts`. Đây là việc phải HỎI coordinator
   trước khi làm vì đổi file ngoài `src/screens/**`.

Số lượng thứ phải tự khai `unsupported`: **6/7 khả năng cốt lõi** màn cần (chỉ
P-01 định dạng số là gọi lại được ngay lập tức, không cần khai gì). Đây không
phải "màn chỉ gọi lại" như spec gốc mô tả — đây là một màn mà gần như toàn bộ
logic nghiệp vụ nói riêng cho CAD phải được dựng mới ở tầng `src/api` +
`src/lib`, rồi gateway của màn mới bọc lấy, đúng khuôn ba gateway anh em.

---

## Chạy đủ ba lệnh

Task này CHỈ viết `notes/cad-contract-logic.md` — không sửa mã TypeScript nào.
Vẫn chạy đủ ba lệnh để chứng minh không làm hỏng cây (kết quả dán tại thời điểm
khảo sát, HEAD `bac231b`):

- `pnpm typecheck` — xem log đầy đủ trong báo cáo gửi coordinator.
- `pnpm lint` — xem log đầy đủ trong báo cáo gửi coordinator.
- `pnpm test` — xem log đầy đủ trong báo cáo gửi coordinator.
