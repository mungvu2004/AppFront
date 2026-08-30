# T2 — Khảo sát hợp đồng logic: T-08 / T-07 / T-10 (màn S-11 PipelineFailure)

Phạm vi đã đọc (chỉ đọc, không sửa): `src/lib/realtime/**` (7 file nguồn + 4 test),
`src/lib/offline/replayer.ts` + `queueStore.ts` + `db.ts` + test, `src/api/endpoints.ts`,
`src/api/schemas/index.ts`, `src/api/client.ts`, `src/api/__mocks__/client.ts` (spec gọi
`src/api/mocks/**` — thư mục đó không tồn tại, chỉ có `src/api/__mocks__/client.ts`),
`src/lib/mutations/**` (7 file), `src/lib/query/**` (7 file), toàn bộ
`src/screens/pipeline/ProcessingScreen/**`, và (phát sinh trong lúc soát, không nằm
trong danh sách gốc nhưng trực tiếp liên quan tới T-08 vì đúng mã lỗi SEG-2041 của đặc
tả) `src/components/feedback/PipelineStepper.tsx` + `src/screens/FeedbackDemo.tsx`.

---

## Mục A — T-08 thử lại đúng một bước

**NOT FOUND.** `rg -i "retryStep|retryStage|retryFrom|resumeFrom|retryPipeline|retryOneStep" src`
rỗng. Không hàm nào trong repo gửi yêu cầu "chạy lại đúng một bước, giữ các bước khác"
lên máy chủ. Ba thứ gần nhất tìm được, không thứ nào làm đúng việc đó:

### A1. `onRetry` của `ProcessingScreen` — đọc lại toàn bộ, không phải thử lại một bước
`src/screens/pipeline/ProcessingScreen/useProcessingScreen.ts:735-737`
```ts
const onRetry = useCallback(() => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.progress.byFloor.root() });
}, [queryClient]);
```
Chữ ký: `() => void`. Nó gọi `queryKeys.progress.byFloor.root()` — khoá GỐC
(`['progress', 'byFloor']`, `src/lib/query/queryKeys.ts:55,82-86`), tức là mời
react-query đọc lại `readProgressOnce` cho **MỌI tầng**, không riêng tầng lỗi. Đây chỉ
là một lượt GET lại tiến độ hiện tại — không có lời gọi nào yêu cầu máy chủ CHẠY LẠI
bước đã lỗi. Quan trọng hơn: nó **không bao giờ được hiển thị** cho đúng kịch bản của
S-11. `errorAlert` (nơi giữ `onRetry`, `types.ts:180-187`) chỉ xuất hiện khi
`state === 'error'`, và `state` chỉ thành `'error'` khi
`hasEveryReadFailed = floorQueries.length > 0 && floorQueries.every(q => q.isError)`
(`useProcessingScreen.ts:673-674,688`) — nghĩa là MỌI lượt đọc của MỌI tầng đều lỗi
mạng/hợp đồng. Một bước AI lỗi (SEG-2041 ở Tầng 03) không rơi vào nhánh này: nó làm
`floorStatusOf` trả `'failed'` cho tầng đó (`useProcessingScreen.ts:390-393`, dựa trên
`record.stages.some(status === 'failed')`), kéo `state` thành `'partial'`
(`useProcessingScreen.ts:692`) và chỉ hiện `partialNoticeLine`
(`useProcessingScreen.ts:1014-1022`) — **không có nút thử lại nào cho trường hợp một
bước lỗi trong màn Xử lý hôm nay.** `ProcessingStepViewModel` (`types.ts:101-130`)
không có trường `onRetry` — khác hẳn điều nói ở A2 dưới đây.
Không test nào kiểm `onRetry` (`rg "onRetry|invalidateQueries" useProcessingScreen.test.ts`
rỗng).

### A2. `PipelineStepData.onRetry` — có đúng nút "Thử lại" và đúng mã SEG-2041, nhưng KHÔNG có logic đứng sau
`src/components/feedback/PipelineStepper.tsx:15-24`
```ts
export interface PipelineStepData {
  id: string;
  name: string;
  status: PipelineStepStatus;
  progress: number;
  eta_seconds?: number;
  errorCode?: string; // e.g. "SEG-2041"
  errorMessage?: string; // e.g. "Không thể đọc dữ liệu do ảnh quá mờ"
  onRetry?: () => void;
}
```
Component vẽ nút "Thử lại" khi `step.onRetry` có mặt: `PipelineStepper.tsx:129-133`
(`<Button ... onClick={step.onRetry}>Thử lại</Button>`, chỉ hiện trong nhánh `isFailed`).
Đây là component TRÌNH BÀY THUẦN — `onRetry` là một prop callback rỗng nghĩa: bản thân
`PipelineStepper` không gọi mạng, không biết bước là gì. `FeedbackDemo.tsx:34-38`
(`src/screens/FeedbackDemo.tsx`) là nơi DUY NHẤT dựng `stepsError` với đúng mã
`errorCode: 'SEG-2041'` mà đặc tả S-11 nhắc tới — và ở đó **không có field `onRetry`
nào được truyền** (so với `steps` không lỗi cũng không có). `FeedbackDemo` là một trong
chín màn demo của `src/App.tsx` (theo CLAUDE.md, mục "Trạng thái hiện tại"), không phải
màn sản phẩm. Kết luận: mẫu UI "nút Thử lại trên một bước lỗi" đã tồn tại trong hệ
thống thiết kế (`src/components/feedback`), nhưng chưa từng có ai nối `onRetry` với bất
cứ logic thật nào — không phải chuyện quên nối, mà chưa có gì để nối (xem Mục D).
**LƯU Ý PHẠM VI:** `src/components/**` nằm trong danh sách cấm sửa của nhiệm vụ này —
chỉ đọc, không đổi gì ở đây; nêu ra để worker T5 biết KHÔNG kỳ vọng thấy retry logic ở
component này.

### A3. `retry` tự động của react-query — hạ tầng, không phải hành động người dùng
`src/lib/query/queryClient.ts:13-14`
```ts
const shouldRetry = (limit: number) => (failureCount: number, error: unknown): boolean =>
  failureCount < limit && normalizeQueryError(error).retryable;
```
dùng tại `queryClient.ts:41` (`retry: shouldRetry(CACHE_POLICY.retry.query)`), với
`CACHE_POLICY.retry.query = 1` (`src/lib/query/cachePolicy.ts:67-70`, "Read queries: 1,
enough to survive a momentary network blip"). Đây là cơ chế **tự động, âm thầm, cấp
HTTP** — thử lại đúng MỘT lần một request GET bị lỗi mạng thoáng qua, không phải hành
động người dùng bấm, không biết khái niệm "bước", và không giữ lịch sử bước nào cả (nó
chạy lại trước khi có bất cứ state nào để giữ).

**Kết luận Mục A:** không có T-08. Cả ba ứng viên trên đều KHÔNG "chạy lại đúng một
bước và giữ lịch sử các bước đã xong" theo đúng nghĩa đặc tả đòi. Xem Mục D cho đường
đi hợp lệ.

---

## Mục B — T-07 gộp sự kiện

**CÓ THẬT.** `src/lib/realtime/mergeEvents.ts:27-67`

```ts
export interface ProgressPatchEvent<TPatch extends object = Progress> {
  eventId: string;
  patch: Partial<TPatch>;
  sequence: number;
}

export interface AppliedProgressPatchEvent<TPatch extends object = Progress> extends ProgressPatchEvent<TPatch> {
  snapshot: Partial<TPatch>;
}

export interface MergeEventsInput<TPatch extends object = Progress> {
  appliedEventIds?: Iterable<string>;
  current?: Partial<TPatch>;
  incoming: readonly ProgressPatchEvent<TPatch>[];
  lastAppliedSequence?: number;
}

export interface MergeEventsResult<TPatch extends object = Progress> {
  appliedEventIds: Set<string>;
  current: Partial<TPatch>;
  events: AppliedProgressPatchEvent<TPatch>[];
  lastAppliedSequence: number;
}

export function mergeEvents<TPatch extends object = Progress>({
  appliedEventIds = [],
  current = {},
  incoming,
  lastAppliedSequence = -1,
}: MergeEventsInput<TPatch>): MergeEventsResult<TPatch>
```
(chữ ký đầy đủ tại `mergeEvents.ts:27-32`).

**Ngữ nghĩa khử trùng lặp / thứ tự** (`mergeEvents.ts:36-59`):
- Một sự kiện bị bỏ qua nếu `eventId` đã có trong `appliedEventIds` HOẶC
  `sequence <= lastAppliedSequence` (dòng 37) — khử trùng lặp theo `eventId`, khử sự
  kiện cũ theo `sequence`.
- Các sự kiện còn lại (`eligibleEvents`) được SẮP LẠI theo `sequence` tăng dần
  (dòng 45) trước khi áp — nên thứ tự ĐẾN không quyết định thứ tự ÁP, thứ tự
  `sequence` mới quyết định.
- Mỗi sự kiện áp bằng cách trộn nông (`{ ...nextCurrent, ...event.patch }`, dòng 51) —
  `patch` sau ghi đè trường trùng tên của `patch` trước, trường không nhắc tới giữ
  nguyên (đây là ý nghĩa "gộp", không phải thay thế toàn bộ).
- `nextLastAppliedSequence` lấy `Math.max` (dòng 52) — không bao giờ lùi, kể cả khi một
  batch tới không theo thứ tự.
- Không có trường nào bị xoá bởi việc gộp: `MergeEventsResult.current` là snapshot
  TÍCH LUỸ, không phải chỉ của sự kiện cuối — đây chính là cơ chế "không mất tiến độ
  cũ" mà T-07 được đặc tả gốc yêu cầu.

**Ví dụ gọi thật, lấy nguyên từ test** (`src/lib/realtime/__tests__/progressStream.test.ts:220-240`,
mô tả `describe('mergeEvents', ...)` — đây là bộ test DUY NHẤT của hàm này; không có
file `mergeEvents.test.ts` riêng):
```ts
const result = mergeEvents<Progress>({
  current: { id: 'progress-1', progressPercent: 20 },
  incoming: [
    makePatchEvent('event-3', 3, { status: 'running' }),
    makePatchEvent('event-1', 1, { progressPercent: 10 }),
    makePatchEvent('event-2', 2, { step: 'wall detection' }),
  ],
  lastAppliedSequence: 1,
});

expect(result.events.map((event) => event.eventId)).toEqual(['event-2', 'event-3']);
expect(result.current).toEqual({
  id: 'progress-1',
  progressPercent: 20,
  status: 'running',
  step: 'wall detection',
});
expect(result.lastAppliedSequence).toBe(3);
```
(`event-1` có `sequence: 1 <= lastAppliedSequence: 1` nên bị loại; `event-2` và
`event-3` được áp theo thứ tự sequence, và `current.progressPercent` giữ nguyên `20` từ
trước vì không `patch` nào trong lô này nhắc tới trường đó — đúng khớp mô tả "gộp",
không "ghi đè toàn bộ".)

Người gọi thật duy nhất trong repo: `src/lib/realtime/progressStream.ts:102-123`
(hàm `emitMerged`, gọi `mergeEvents<TPatch>({...})` ở dòng 103), và qua đó
`processingGateway.ts` dùng `createProgressStream` (không gọi `mergeEvents` trực tiếp).

**Kết luận Mục B:** T-07 có thật, đã được ghép nối đúng đặc tả ("gộp sự kiện để không
mất tiến độ cũ"), và đang chạy thật trong `ProcessingScreen` qua `progressStream.ts`.
Có thể gọi lại nguyên vẹn.

---

## Mục C — T-10 phát lại nhật ký để sao chép

**NOT FOUND** cho đúng nghĩa "phát lại nhật ký" (replay một nhật ký đã có từ trước).
Có thật một hàm GHÉP nhật ký hiện có thành chuỗi để sao chép, nhưng nó không "phát lại"
gì — nó chỉ nối các dòng ĐANG có trong bộ nhớ.

### Nguồn nhật ký thật sự là gì
Theo dấu `ProcessingRawLogLine` ngược về nguồn:

1. **Định nghĩa kiểu**: `src/screens/pipeline/ProcessingScreen/processingGateway.ts:214-219`
   ```ts
   export interface ProcessingRawLogLine {
     readonly id: string;
     readonly atIso: string;
     readonly text: string;
   }
   ```
   Chỉ ba trường: id, mốc giờ ISO, và MỘT chuỗi văn bản. Không có `technicalCode`,
   không có stack, không có payload lỗi gốc.

2. **Nơi sinh ra một dòng nhật ký**: hàm `logTextOf`
   (`src/screens/pipeline/ProcessingScreen/useProcessingScreen.ts:321-334`):
   ```ts
   function logTextOf(progress: Partial<Progress>): string {
     const label = progress.step === undefined ? undefined : stageLabelOfStep(progress.step);
     const name = label ?? progress.step;
     if (name === undefined) return COPY.noFloorRunning;
     if (progress.progressPercent === undefined) return name;
     return `${name} — ${formatPercent(progress.progressPercent, { source: 'percent', fractionDigits: 0 })}`;
   }
   ```
   Một dòng nhật ký là CÂU DỊCH của `Progress.step` + `Progress.progressPercent` tại
   thời điểm nhận nhịp — ví dụ "tách lớp tường — 45%". Đây KHÔNG phải nhật ký kỹ thuật
   (không mã lỗi, không stack trace, không chi tiết máy đọc được).

3. **Nơi dòng được ghi vào bản ghi của một tầng**: `applySnapshot`
   (`useProcessingScreen.ts:357-387`, dòng `logLines: [...record.logLines, logLine]` ở
   371-384) — mỗi nhịp SSE/quay vòng CỘNG THÊM một dòng vào một mảng giữ trong bộ nhớ
   đệm react-query (`FloorProgressRecord.logLines`, `useProcessingScreen.ts:294`). Đây
   là tích luỹ TRONG PHIÊN, không phải đọc lại từ một kho lưu trữ nhật ký nào — không
   có endpoint đọc nhật ký, không có bảng nhật ký trong IndexedDB (`src/lib/offline/db.ts`
   chỉ có hai object store cho hàng đợi lệnh offline — xem dưới).

4. **Nơi nối các dòng thành MỘT chuỗi để sao chép — HÀM DUY NHẤT làm việc này**:
   `onCopyLog` (`useProcessingScreen.ts:731-733`):
   ```ts
   const onCopyLog = useCallback(() => {
     void gateway.copyText(logLines.map((line) => `${line.timeLabel} ${line.text}`).join('\n'));
   }, [gateway, logLines]);
   ```
   `logLines` ở đây là viewmodel đã định dạng (`ProcessingLogLineViewModel[]`,
   `useProcessingScreen.ts:719-729`), và `gateway.copyText` là cổng ghi vào khay nhớ
   tạm (`processingGateway.ts:421,751-766`, bọc `navigator.clipboard.writeText`, trả
   `false` khi trình duyệt từ chối — không phải lỗi màn hình). Hàm này CÓ đúng việc
   "ghép nhật ký thành chuỗi để sao chép", nhưng nó ghép DỮ LIỆU ĐANG CÓ SẴN trong state
   của hook, không đọc lại/PHÁT LẠI từ đâu cả — nếu người dùng vào màn sau khi đã bỏ lỡ
   nhịp lỗi (ví dụ tải lại trang giữa chừng), `logLines` rỗng và không có cách nào lấy
   lại nhật ký đã mất, vì không nơi nào PERSIST nó ngoài bộ nhớ đệm react-query của
   phiên hiện tại (`gcTime` mười phút, theo ghi chú ở đầu `useProcessingScreen.ts:25-29`).

### `replayer.ts` có phát lại được nhật ký bước không?
**KHÔNG.** `src/lib/offline/replayer.ts` là bộ PHÁT LẠI LỆNH GHI khi mất mạng, không
liên quan gì tới nhật ký xử lý AI:
- `createReplayer` (`replayer.ts:98`) nhận `sendCommand: ReplayCommandSender` — một hàm
  GỬI LỆNH (POST/mutation) lên máy chủ, không phải hàm ĐỌC nhật ký.
- Nó đọc từ `queueStore.listPendingCommands(projectId)` (`replayer.ts:216`,
  `queueStore.ts:56`) — hàng đợi các `PendingCommand` (một lệnh ghi bị kẹt lúc offline,
  `queueStore.ts:13-20`), lưu trong IndexedDB qua hai object store
  (`PENDING_COMMANDS_STORE`, `DEAD_LETTER_STORE` — `db.ts`, xem `queueStore.ts:1`).
  Không có object store nào tên "log" hay "progress".
  "Phát lại" ở đây nghĩa là gửi lại các lệnh ghi (ví dụ sửa tường, xoá phòng) đã xếp
  hàng lúc mất mạng — hoàn toàn khác nghĩa "phát lại nhật ký kỹ thuật của một bước AI"
  mà đặc tả S-11 đòi.
- Không route/`ENDPOINTS` nào của `drawings`/`quality`/`spatial` đụng tới
  `replayer`/`queueStore`/`db` (đã soát `endpoints.ts` toàn văn — không import chéo).

**Kết luận Mục C:** không có hàm "phát lại nhật ký". Có một hàm ghép-để-sao-chép
(`onCopyLog`), nhưng nó ghép dữ liệu đang có trong state của hook — nguồn nhật ký chỉ
sống trong phiên hiện tại, câu chữ là bản dịch tiến độ ("tên bước — %"), KHÔNG phải
nhật ký kỹ thuật (không mã lỗi, không stack). Ghi rõ NOT FOUND cho phần "nhật ký kỹ
thuật để xem/sao chép" mà đặc tả S-11 mô tả — cái có sẵn gần nhất chỉ đáp ứng một phần.

---

## Mục D — Đường đi hợp lệ khi thiếu

Vì Mục A (T-08 thử lại một bước) và một phần Mục C (nhật ký KỸ THUẬT, không phải nhật
ký tiến độ dịch sẵn) là NOT FOUND, màn S-11 dùng lại đúng mẫu capability gateway đã
chạy ở bốn màn khác trong `src/screens/pipeline/**`
(`ProcessingScreen/processingGateway.ts`, `ScaleCalibration/scaleCalibrationGateway.ts`,
`PipelineGraph/pipelineGraphGateway.ts`, `CadBranchConfirm/cadBranchConfirmGateway.ts` —
cùng bốn mảnh: `<PREFIX>_MISSING_ENDPOINTS`, `<Prefix>Unsupported`/`<Prefix>Supported`,
`<Prefix>CapabilityResult<T>`, hàm `unsupported(capability)`).

### Mẫu khai báo — dán nguyên văn từ `processingGateway.ts` (bản CANH BẢN, dùng làm khuôn)

```ts
// processingGateway.ts:104-116 — danh sách khả năng màn hỏi cổng
export const PROCESSING_CAPABILITIES = [
  'cancelProcessing', 'queuePosition', 'parallelFloorPipeline', 'runInBackground',
  'completionNotice', 'extractionSummary', 'stepDetails', 'detectedGeometry', 'stageBreakdown',
] as const;
export type ProcessingCapability = (typeof PROCESSING_CAPABILITIES)[number];

// processingGateway.ts:129-140 — bản kê nợ thật (chỉ được ngắn đi)
export const PROCESSING_MISSING_CAPABILITIES = [
  'cancelProcessing', 'queuePosition', 'parallelFloorPipeline', 'completionNotice',
  'extractionSummary', 'stepDetails', 'detectedGeometry', 'stageBreakdown',
] as const;
export type ProcessingMissingCapability = (typeof PROCESSING_MISSING_CAPABILITIES)[number];

// processingGateway.ts:147-164
export const PROCESSING_MISSING_ENDPOINTS: Readonly<Record<ProcessingMissingCapability, string>> = {
  cancelProcessing: 'ENDPOINTS.drawings.cancel + DrawingsApi.cancel — chưa có',
  queuePosition: 'ENDPOINTS.drawings.queue + trường vị trí hàng đợi trong ProgressSchema (.strict(), 7 trường) — chưa có',
  parallelFloorPipeline: 'endpoint trả trạng thái xử lý của MỌI tầng trong một lượt đọc — chưa có; màn tự ghép N lượt đọc drawings.progress độc lập',
  completionNotice: 'kênh ĐẨY từ máy chủ khi xử lý xong, sống qua cả lúc đóng thẻ (chuông thông báo) — chưa có',
  extractionSummary: 'endpoint tổng kết trích xuất: wallCount, openingCount, dimensionCount, roomCount, confidencePercent — chưa có (areaM2 đã có qua spatial.readFloor)',
  stepDetails: 'endpoint chi tiết từng bước (số đối tượng tìm được, mã lỗi của riêng bước) — chưa có',
  detectedGeometry: 'endpoint trả hình học dò được GIỮA CHỪNG lúc đang xử lý — chưa có',
  stageBreakdown: 'ánh xạ Progress.step (chuỗi tự do) sang PipelineStageId — chưa có; toStageBreakdown tra cứu theo id/nhãn và chịu giả định C3',
};

// processingGateway.ts:167-186
export interface ProcessingUnsupported {
  readonly supported: false;
  readonly capability: ProcessingMissingCapability;
  readonly missing: string;
}
export interface ProcessingSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}
export type ProcessingCapabilityResult<TValue> = ProcessingSupported<TValue> | ProcessingUnsupported;

export function unsupported(capability: ProcessingMissingCapability): ProcessingUnsupported {
  return { supported: false, capability, missing: PROCESSING_MISSING_ENDPOINTS[capability] };
}
```

Cách dùng phía cổng (ví dụ thật, `processingGateway.ts:724,738-743`):
```ts
requestCancel: () => Promise.resolve(unsupported('cancelProcessing')),
readQueuePosition: () => Promise.resolve(unsupported('queuePosition')),
```
Cách dùng phía hook (`useProcessingScreen.ts:750`): `canCancel = gateway.supports.cancelProcessing && canEdit`
— hook đọc `supports.<capability>` (đồng bộ, `boolean`) để quyết định VẼ hay KHÔNG VẼ
nút, và đọc nhánh `.supported` của `ProcessingCapabilityResult` khi kết quả đến từ một
lời gọi bất đồng bộ.

### Danh sách tên khả năng T5 sẽ phải khai cho `pipelineFailureGateway.ts`

Đặt tên theo đúng khuôn `<domain><Action>` của bốn cổng hiện có (`cancelProcessing`,
`queuePosition`, `parallelFloorPipeline`, `stepDetails`...). Đề xuất (không phải khai
bởi worker này — người viết cổng thật của S-11 tự đặt tên và tự viết dòng nợ, nhưng
đây là những chỗ hổng THẬT mà tên khả năng phải phủ hết, theo đúng Mục A/Mục C ở trên):

- **`retryStep`** — chạy lại đúng một bước đã lỗi, giữ nguyên các bước đã xong.
  KHÔNG có endpoint (`cancelProcessing` còn chưa có, retry-một-bước lại càng chưa).
- **`technicalLog`** hoặc **`stepErrorDetail`** — nhật ký kỹ thuật đầy đủ của một bước
  lỗi (khác với `stepDetails` đã có tên trong `ProcessingMissingCapability` — cân nhắc
  tái dùng chính tên `stepDetails` nếu S-11 chỉ cần đúng nội dung
  `ProcessingRawStepProgress.detailLines`/`errorCode` đã khai sẵn ở
  `processingGateway.ts:203-212`, thay vì bịa một khả năng thứ hai làm cùng việc).

`stageBreakdown` **KHÔNG** phải khả năng mới — nó đã CÓ THẬT
(`supports.stageBreakdown = true`, `processingGateway.ts:653`) và đã tự sinh đúng "lịch
sử các bước đã xong" mà T-08 lẽ ra phải giữ khi thử lại: hàm `toStageBreakdown`
(`processingGateway.ts:515-571`) và `keepObservedDone`
(`processingGateway.ts:464-473`, "Một bước ĐÃ quan sát thấy xong thì không bị hạ xuống
lại, trừ khi lượt đọc mới báo chính nó hỏng") đã tự động giữ nguyên trạng thái "done"
của các bước trước bước đang lỗi qua các lượt đọc kế tiếp — CHỈ CẦN máy chủ thật sự gửi
lại một `Progress` mới báo bước đó đang chạy lại. Đây là mảnh DUY NHẤT của T-08 đã có
sẵn ở tầng client: giữ lịch sử. Mảnh thiếu là YÊU CẦU máy chủ chạy lại — không phải giữ
lịch sử sau khi nó chạy lại.

### Những gì CÓ THẬT và phải gọi lại, không dựng lại

| Việc | Hàm/hook có thật | Vị trí |
|---|---|---|
| Gộp sự kiện tiến độ, khử trùng lặp, giữ tiến độ cũ | `mergeEvents` | `src/lib/realtime/mergeEvents.ts:27` |
| Dòng sự kiện tự chuyển SSE↔quay vòng | `createProgressStream` | `src/lib/realtime/progressStream.ts:62` |
| Giữ trạng thái "đã xong" của bước qua các lượt đọc sau (kể cả lượt lỗi) | `keepObservedDone` + `toStageBreakdown` | `processingGateway.ts:464,515` |
| Tính % tổng không nhảy lùi | `calculateTotalProgress` | `src/lib/realtime/pipeline.ts:113` |
| Ghép nhật ký hiện có thành chuỗi + ghi khay nhớ tạm | `onCopyLog` + `gateway.copyText` | `useProcessingScreen.ts:731`, `processingGateway.ts:421,751` |
| Sáu bước + trọng số + nhãn tiếng Việt | `getPipelineStages`, `PIPELINE_STAGES` | `src/lib/realtime/pipeline.ts:48,106` |
| Mẫu cổng khả năng (`unsupported`, `CapabilityResult`) | 4 cổng đã có | xem bảng ở trên |

**KHÔNG gọi lại** `replayer.ts`/`queueStore.ts`/`db.ts` cho bất cứ phần nào của S-11 —
chúng thuộc một hệ thống khác (hàng đợi lệnh ghi ngoại tuyến), không có quan hệ nào với
nhật ký hay tiến độ pipeline. Dùng chúng cho S-11 là lắp sai lớp.

---

## CẢNH BÁO / LEO THANG

Không phát sinh — cả nguồn danh sách bước (`PIPELINE_STAGES` + `toStageBreakdown`) lẫn
MỘT nguồn nhật ký (dù chỉ là nhật ký tiến độ, không phải kỹ thuật) đều tồn tại và đủ để
dựng màn qua mẫu capability gateway ở Mục D. Không cần escalation.

---

## Số liệu cho worker_done

- File đọc trực tiếp: 21 file nguồn (`src/lib/realtime` ×7, `src/lib/offline` ×3,
  `src/api` ×4, `src/lib/mutations`/`src/lib/query` ×2 đại diện + glob toàn bộ 14 file
  còn lại, `src/screens/pipeline/ProcessingScreen` ×3, `src/components/feedback/PipelineStepper.tsx`,
  `src/screens/FeedbackDemo.tsx`) + 2 file test đọc kỹ (`progressStream.test.ts`,
  `pipeline.test.ts`) + rà glob/grep toàn bộ `src/screens/pipeline/**` và ba gateway anh
  em để xác nhận mẫu.
- Ứng viên T-08 tìm được: **3** (`onRetry` re-fetch toàn màn, `PipelineStepData.onRetry`
  không logic, react-query auto-retry) — **cả 3 đều không đạt** định nghĩa T-08.
- Mục ghi NOT FOUND: **2** (Mục A trọn vẹn; Mục C phần "nhật ký kỹ thuật" — có tìm được
  một hàm ghép-để-sao-chép nhưng không phải "phát lại", và nội dung không phải kỹ
  thuật).
- Mục xác nhận CÓ THẬT: **1** (Mục B, `mergeEvents`, khớp hoàn toàn đặc tả).
