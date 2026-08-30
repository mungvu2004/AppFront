# Hợp đồng: L-03 · O-01 · P-04 · P-02

Ghi chép dành cho S-11 PipelineFailure screen. Mọi chữ ký dán nguyên văn từ mã với dòng.

---

## Mục A — L-03 câu lỗi, mã lỗi, mã yêu cầu

### ErrorDescription (đầu ra của describeError)

Định nghĩa: `src/lib/errors/describeError.ts:5-10`

```typescript
export interface ErrorDescription {
  title: string;                 // Câu tiêu đề người đọc được
  description: string;           // Câu mô tả người đọc được
  primaryButtonLabel: string;    // Nhãn nút chính tiếng Việt
  secondaryButtonLabel: string;  // Nhãn nút phụ tiếng Việt
}
```

### Hàm describeError

Chữ ký: `src/lib/errors/describeError.ts:48`

```typescript
export function describeError(error: AppError): ErrorDescription
```

Nhận một `AppError`, trả về `ErrorDescription` với tất cả các chuỗi người đọc được đã định dạng. Các tham số từ `error.params` được ghép vào template của `error.messageKey`.

### AppError (cấu trúc lỗi đầy đủ)

Định nghĩa: `src/lib/errors/kinds.ts:27-36`

```typescript
export interface AppError {
  kind: AppErrorKind;                    // Phân loại lỗi
  code: string;                          // Mã lỗi (ví dụ "PROCESSING", "SEG-2041")
  messageKey: string;                    // Khoá dịch tiếng Việt
  params: AppErrorParams;                // Các tham số ghép vào template
  requestId: string;                     // **MÃ YÊU CẦU** — ở đây!
  retryable: boolean;                    // Có thể thử lại không
  severity: AppErrorSeverity;            // Mức độ: 'cảnh báo' | 'lỗi' | 'nghiêm trọng'
  recovery: AppErrorRecovery;            // Hành động khuyến nghị
}
```

### Các loại lỗi — APP_ERROR_KIND_CONFIG

Danh sách: `src/lib/errors/kinds.ts:1-15`

```typescript
export const APP_ERROR_KINDS = [
  'network', 'timeout', 'unauthenticated', 'forbidden', 'notFound', 'conflict',
  'validation', 'rateLimited', 'upload', 'processing', 'geometry', 'export', 'unknown'
] as const;
```

Cấu hình chi tiết: `src/lib/errors/kinds.ts:49-180`

Mỗi loại trong `APP_ERROR_KIND_CONFIG` mang:
- `code`: mã máy (ví dụ `'PROCESSING'` → dòng 141)
- `messageKey`: khoá dịch (`'errors.processing.description'`)
- `titleKey`: khoá tiêu đề (`'errors.processing.title'`)
- `severity`: `'cảnh báo' | 'lỗi' | 'nghiêm trọng'`
- `recovery`: `'thử lại' | 'tải lại' | 'liên hệ quản trị' | 'không'`
- `primaryButtonKey`: nút chính tiếng Việt
- `retryable`: có thử lại được không

### Hàm toAppError

Chữ ký: `src/lib/errors/toAppError.ts:302`

```typescript
export function toAppError(error: unknown): AppError
```

Nhận bất kỳ giá trị nào (lỗi HTTP, lỗi Zod, lỗi worker, lỗi thô), trả về `AppError` được phân loại. Trích xuất `requestId` từ nhiều nơi có thể (xem dòng 71-82 của `toAppError.ts`).

### Câu hỏi: Mã yêu cầu có sẵn không?

**CÓ.** `AppError` có trường `requestId` — nó được trích từ đầu vào lỗi ở dòng 71-82 của `toAppError.ts`:

```typescript
const readRequestId = (value: unknown): string => {
  if (!isRecord(value)) return '';
  return (
    readString(value.requestId) ??
    readString(value.request_id) ??
    (isRecord(value.raw) ? readRequestId(value.raw) : undefined) ??
    (isRecord(value.error) ? readRequestId(value.error) : undefined) ??
    ''
  );
};
```

Nó cũng được trích từ `HttpError.requestId` (dòng 271 của `toAppError.ts`).

**Trường HTTP**: `src/lib/http/types.ts:79-82` cung cấp `RequestLogEntry`:

```typescript
export interface RequestLogEntry {
  requestId: string;
  url: string;
}
```

Vậy, màn có thể hiển thị: **"SEG-2041 · yêu cầu 8f2a-41"** từ `error.code` và `error.requestId`.

---

## Mục B — O-01 ghi sự kiện lỗi

### Hàm reportError

Chữ ký: `src/lib/errors/report.ts:61`

```typescript
export function reportError(error: unknown, context: ErrorTelemetryContext = {}): void
```

Nhận lỗi bất kỳ và một ngữ cảnh tùy chọn (bị làm sạch trước khi gửi). Gửi sự kiện `ERROR_REPORTED_EVENT` với `ErrorTelemetryDetail`.

### Sự kiện telemetry

Định nghĩa: `src/lib/errors/report.ts:4,10-14`

```typescript
export const ERROR_REPORTED_EVENT = 'telemetry:error';

export interface ErrorTelemetryDetail {
  appError: AppError;                              // Lỗi đã phân loại
  context: Record<string, string | number | boolean>;  // Ngữ cảnh (không PII)
  timestamp: string;                               // ISO timestamp
}
```

### Các sự kiện telemetry sẵn có

Danh sách tất cả sự kiện: `src/lib/telemetry/events.ts:369-380`

```typescript
export const TELEMETRY_EVENT_NAMES = [
  'drawing.upload', 'ai.started', 'ai.finished', 'wall.edit', 'rules.run',
  'export.file', 'screen.error', 'app.first-frame', 'scene.build', 'project.open'
] as const;
```

Sự kiện phù hợp cho "một bước AI hỏng": **`'screen.error'**

### ScreenErrorEvent schema

Định nghĩa schema: `src/lib/telemetry/events.ts:270-276`

```typescript
const screenErrorSchema = z.object({
  name: z.literal('screen.error'),
  screenCode: codeSchema,                  // Dự kiến: 'processing' hoặc tương tự
  errorKind: errorKindSchema,              // Một trong APP_ERROR_KINDS
  severity: severitySchema,                // 'warning' | 'error' | 'critical'
  retryable: z.boolean(),
});
```

Ràng buộc:
- `TELEMETRY_CODE_PATTERN` (dòng 73): `/^[a-z0-9][a-z0-9._-]*$/` — chỉ chữ cái thường, chữ số, dấu chấm, gạch dưới, gạch ngang. Tối đa 48 ký tự.
- `errorKind` phải là một giá trị từ `APP_ERROR_KINDS`
- `severity` được ánh xạ từ `AppErrorSeverity` tiếng Việt sang code (dòng 141-145): `'cảnh báo'` → `'warning'`, `'lỗi'` → `'error'`, `'nghiêm trọng'` → `'critical'`

### Cách kết nối: toScreenErrorEvent

Hàm đi từ `ErrorTelemetryDetail` sang `ScreenErrorEvent`: `src/lib/telemetry/events.ts:429`

```typescript
export function toScreenErrorEvent(
  detail: ErrorTelemetryDetail,
  screenCode: string,
): ScreenErrorEvent | null
```

Chỉ bốn trường được sao chép: `kind`, `severity`, `retryable`, và `screenCode`. Nó từ chối nếu `screenCode` không hợp lệ (không match pattern).

---

## Mục C — P-04 bảy trạng thái màn

### Danh sách bảy trạng thái

Từ: `src/lib/testing/sevenStateScenarios.ts:26-48`

```typescript
export const SEVEN_STATES = [
  'empty',      // Rỗng — không có dữ liệu
  'loading',    // Đang tải — chưa có kết quả
  'partial',    // Một phần — một số tầng xong, số khác vẫn chạy
  'error',      // Lỗi — không đọc được dữ liệu
  'success',    // Thành công — tất cả xong
  'forbidden',  // Không có quyền — người dùng không thể xem
  'collapsed',  // Thu gọn — giao diện hẹp, chế độ mobile
] as const;

export const SEVEN_STATE_LABELS: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  forbidden: 'không có quyền',
  collapsed: 'thu gọn',
};
```

### Cấu trúc dữ liệu một kịch bản

Từ: `src/lib/testing/sevenStateScenarios.ts:62-76`

```typescript
export interface SevenStateScenario {
  readonly state: SevenState;
  readonly label: string;                    // Tên tiếng Việt (từ SEVEN_STATE_LABELS)
  readonly rows: readonly SevenStateRow[];   // Dữ liệu hiển thị
  readonly totalCount: number;               // Tổng cộng (cho partial)
  readonly isLoading: boolean;
  readonly isCollapsed: boolean;
  readonly canView: boolean;                 // false chỉ ở trạng thái 'forbidden'
  readonly error: unknown;                   // Non-null chỉ ở trạng thái 'error'
}
```

### expectSevenStates — chứng chỉ

Chữ ký: `src/lib/testing/expectSevenStates.ts:122`

```typescript
export function expectSevenStates(
  renderScreen: ScreenRenderer,
  scenarios: readonly SevenStateScenario[],
): void
```

Loại `ScreenRenderer`: `src/lib/testing/expectSevenStates.ts:46`

```typescript
export type ScreenRenderer = (scenario: SevenStateScenario) => ScreenRenderResult;

export interface ScreenRenderResult {
  readonly container: HTMLElement;
  readonly unmount?: () => void;
}
```

**Yêu cầu của hàm:**
1. Nhận bảy kịch bản, chính xác một cho mỗi trạng thái.
2. Gọi `renderScreen(scenario)` cho mỗi cái.
3. **Không dùng render nào được để cho ra màn hình trắng** (kiểm tra `container.childElementCount === 0 && container.textContent.trim() === ''`).
4. Ném `Error` tiếng Việt nếu:
   - Thiếu trạng thái (dòng 94-96)
   - Trạng thái bị lặp (dòng 87)
   - Render ném lỗi (dòng 142-145)
   - Container trắng (dòng 149-153)

---

## Mục D — P-02 thời gian

### formatClockTime

Chữ ký: `src/lib/format/datetime.ts:144`

```typescript
export function formatClockTime(value: TimeInput, options: TimestampFormatOptions = {}): string
```

Đầu vào: `Date | number | null | undefined` (mili giây kể từ epoch, hoặc `Date`)

Đầu ra: `"14:32"` (24-hour clock, hay `"—"` nếu không hợp lệ)

Dùng `Intl.DateTimeFormat` với locale `'vi-VN'`, định dạng `{ hour: '2-digit', minute: '2-digit', hour12: false }`.

### formatDuration

Chữ ký: `src/lib/format/datetime.ts:240`

```typescript
export function formatDuration(durationMs: number | null | undefined): string
```

Đầu vào: Milli giây (hoặc null/undefined)

Đầu ra: Chuỗi tiếng Việt với dấu phẩy là dấu thập phân (**A15**)

Ví dụ:
- `135_000` ms → `"2 phút 15 giây"`
- `120_000` ms → `"2 phút"`
- `45_000` ms → `"45 giây"`
- `400` ms → `"dưới 1 giây"`
- `null` → `"—"`

Quy luật:
- Chỉ hai đơn vị lớn nhất được viết
- Giây được bỏ sau khi đã có giờ
- Đơn vị zero bị loại bỏ

Hằng số ở dòng 46-48:
```typescript
const HOUR_WORD = 'giờ';
const MINUTE_WORD = 'phút';
const SECOND_WORD = 'giây';
```

### formatNumber và dấu phẩy

Chữ ký (từ `src/lib/format/number.ts`, được dùng trong formatDuration): Các số được định dạng qua `formatNumber` với dấu phẩy là dấu thập phân (A15). Ví dụ: `1.5` → `"1,5"`.

### formatTimestamp

Chữ ký: `src/lib/format/datetime.ts:184`

```typescript
export function formatTimestamp(
  value: TimeInput,
  now: TimeInput,
  options: TimestampFormatOptions = {},
): string
```

Định dạng nhân cách có độ chính xác tăng dần theo khoảng cách từ hiện tại:
- `< 1 phút`: `"vừa xong"`
- `< 1 giờ`: `"12 phút trước"` (dùng `Intl.RelativeTimeFormat`)
- Cùng ngày: `"14:32"`
- Ngày khác: `"03/08/2026 14:32"`

### Hằng số thời gian

Từ `src/lib/format/datetime.ts:39-48`:
```typescript
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const JUST_NOW_LABEL = 'vừa xong';
const SUB_SECOND_LABEL = 'dưới 1 giây';
```

---

## Tóm tắt để implementer

Dùng cho S-11 PipelineFailure:

1. **Nhận AppError** → gọi `describeError()` để lấy câu tiêu đề + mô tả
2. **Hiển thị mã lỗi + mã yêu cầu**: `error.code` và `error.requestId`
3. **Ghi sự kiện**: gọi `reportError()` để điều khiển telemetry
4. **Bảy trạng thái**: test phải gọi `expectSevenStates()` với `createSevenStateScenarios()`
5. **Định dạng thời gian**: dùng `formatClockTime()`, `formatDuration()` hoặc `formatTimestamp()` — **dấu phẩy là dấu thập phân**
