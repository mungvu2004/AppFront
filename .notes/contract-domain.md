# Contract khảo sát — tầng domain / format / errors cho màn upload bản vẽ

Khảo sát READ-ONLY. Không sửa file nguồn nào. Mục tiêu: liệt kê CHÍNH XÁC những gì
`useUploadDrawings`-kiểu hook (Layer 2) được phép gọi, để thoả R-61 (không công thức tự chế)
và R-71 (không hằng số viết tay trong màn).

Mọi trích dẫn dòng dưới đây đã đọc trực tiếp từ file tại thời điểm khảo sát
(nhánh `t4-survey-domain`, HEAD `14b60ec`). Nếu một symbol không tồn tại, mục đó ghi rõ
**NOT FOUND** — không có mục nào như vậy trong khảo sát này; mọi symbol trong đặc tả đều
tìm thấy, trừ hai điểm sai lệch đường dẫn được ghi ở mục (f) và (g).

---

## (a) Cao độ cộng dồn — M-11

### `src/domain/axes/alignFloors.ts:451`

```ts
export function ceilingElevationMm(floor: FloorPlan): Millimetres {
  return millimetres(floor.floorElevationMm + floor.clearHeightMm);
}
```

Trần của một tầng = cao độ sàn của chính nó + chiều cao thông thuỷ của chính nó. Đây là
HÀM DUY NHẤT được phép dùng để suy ra cao độ sàn của tầng kế tiếp — không tự cộng
`floorElevationMm + clearHeightMm` trong hook.

### `src/domain/axes/alignFloors.ts:82-88` — `FloorPlan` (mọi trường, đúng kiểu)

```ts
export interface FloorPlan {
  readonly levelId: LevelId;              // `L-${string}` — src/domain/spatial/types.ts:66
  readonly name: string;
  readonly floorElevationMm: Millimetres; // Quantity<'mm'> — src/domain/units/types.ts:34
  readonly clearHeightMm: Millimetres;
  readonly axes: readonly DetectedAxis[]; // src/domain/axes/detect.ts:59; CreateProjectModal truyền `[]`
}
```

`DetectedAxis` (`detect.ts:59-71`, tham khảo — không cần dựng cho màn upload):
`direction: AxisDirection`, `coordinateMm/startMm/endMm/spreadMm: Millimetres`,
`wallIds: readonly WallId[]`. Màn upload không có trục dò được nên luôn truyền `axes: []`,
đúng khuôn `computeFloorStack` dưới đây.

### Khuôn chồng tầng đang chạy thật — `useCreateProjectModal.ts:11-21` (doc) + `:222-328` (mã)

Doc comment (`:11-21`) nói rõ luật: tầng trệt là gốc ở `0`; mỗi tầng phía trên đứng trên
trần của tầng liền dưới qua `ceilingElevationMm(previousFloor)`; tầng hầm là ca DUY NHẤT
tính bằng phép trừ (`-clearHeightMm`) vì trần của nó phải khớp đúng `0` của tầng trệt.

Mã thật (`computeFloorStack`, rút gọn, giữ nguyên logic):

```ts
// Ca tầng trên mặt đất — `:246-260`
let floorElevationMm: Millimetres;
if (index === 0) {
  floorElevationMm = millimetres(0);                    // tầng trệt = gốc
} else if (previousCeilingMm === null) {
  /* phòng thủ: không rơi vào đây vì chainBroken đã chặn trước */
} else {
  floorElevationMm = previousCeilingMm;                 // = trần tầng liền dưới
}
// ...
previousCeilingMm = ceilingElevationMm(plan);            // duy nhất một hàm suy ra trần

// Ca tầng hầm — `:285-289`, PHÉP TRỪ DUY NHẤT trong cả module
const floorElevationMm = millimetres(-clearHeightMm);
```

5 dòng giải thích:
1. Tầng trệt (`index === 0` trong mảng các tầng trên mặt đất) luôn có `floorElevationMm = millimetres(0)` — đây là gốc (datum), không tính từ đâu cả.
2. Mỗi tầng phía trên tiếp theo lấy `floorElevationMm` chính là `previousCeilingMm`, biến được gán bằng `ceilingElevationMm(plan)` của tầng vừa xử lý trước đó trong vòng lặp `forEach`.
3. `previousCeilingMm` được cập nhật lại ngay sau khi một `FloorPlan` hợp lệ được đẩy vào `plans`, nên tầng kế tiếp luôn đọc trần "mới nhất" chứ không phải trần gốc.
4. Nếu một tầng có lỗi (thiếu chiều cao, vượt giới hạn cao độ) thì `chainBroken = true` được set và mọi tầng phía trên đó nhận thẳng thông báo "chưa tính được cao độ" — không tầng nào phía trên được tính cao độ dựa trên một tầng dưới hỏng.
5. Tầng hầm (nếu có) được xử lý riêng, NGOÀI vòng lặp trên: `floorElevationMm = millimetres(-clearHeightMm)` — phép trừ DUY NHẤT của cả module, vì trần tầng hầm phải khớp đúng `0` của tầng trệt.

### `alignFloors()` chính nó — có liên quan hay không?

`alignFloors(floors, options?)` trả về `FloorAlignmentReport`:
```ts
interface FloorAlignmentReport {
  readonly baseLevelId: LevelId | null;
  readonly floors: readonly FloorAlignment[];   // transform, residual, axes đã align — KHÔNG liên quan (không có axes thật)
  readonly issues: readonly FloorIssue[];       // { kind: FloorIssueKind; levelId; relatedLevelId; severity; amountMm; message }
}
```
`FloorIssueKind = 'alignment' | 'unalignable' | 'clearHeight' | 'overlap'`.

**Liên quan một phần, đúng như `computeFloorStack` đã làm** (`useCreateProjectModal.ts:306`):
gọi `alignFloors(plans).issues.filter((issue) => issue.kind === 'overlap')` để lấy câu
Việt hoá sẵn cho hai tầng chồng lấn nhau ("Tầng X bắt đầu ở cao độ... thấp hơn trần
tầng Y..."). `issue.message` dùng NGUYÊN VĂN — không viết lại.

`baseLevelId` và `floors` (kết quả align trục) KHÔNG liên quan tới màn upload: không có
trục thật (`axes: []`), nên `matchedAxisCount`/`transform`/`maxResidualMm` đều vô nghĩa.

`kind === 'unalignable'` và `kind === 'clearHeight'` CŨNG nổ ra trên dữ liệu này (mọi hàng
có `axes: []` nên luôn dưới `MIN_MATCHED_AXES`; và khoảng 2–10 m của form rộng hơn khoảng
2,4–6 m của domain) nhưng **không phải là lời phàn nàn màn này sở hữu** — nguyên văn lý do
tại `useCreateProjectModal.ts:23-26`. Hook màn upload phải lọc giống hệt: chỉ lấy
`kind === 'overlap'`, bỏ qua hai loại kia.

### Ngưỡng liên quan

| Hằng số | File | Giá trị |
|---|---|---|
| `MIN_CLEAR_HEIGHT_MM` | `alignFloors.ts:70` | `millimetres(2400)` |
| `MAX_CLEAR_HEIGHT_MM` | `alignFloors.ts:73` | `millimetres(6000)` |
| `ALIGNMENT_WARNING_THRESHOLD_MM` | `alignFloors.ts:61` | `millimetres(150)` |

Ba hằng số này là ngưỡng CẤU TRÚC của chính `alignFloors` (dùng khi có trục thật) — **không
phải** ngưỡng "chiều cao thông thuỷ" mà form cho người dùng gõ (đó là `PROJECT_LIMITS`,
mục (b)). Đừng nhầm hai khoảng: `2,4–6 m` (domain, dùng khi ĐÃ có bản vẽ dò trục) khác
`2–10 m` (`PROJECT_LIMITS.storeyHeightMin/MaxM`, dùng khi NGƯỜI dùng đang gõ).

---

## (b) Giới hạn — `src/domain/project/limits.ts`

```ts
export const PROJECT_NAME_MIN_LENGTH = 3;
export const PROJECT_NAME_MAX_LENGTH = 80;
export const PROJECT_FLOOR_COUNT_MIN = 1;
export const PROJECT_FLOOR_COUNT_MAX = 50;
export const PROJECT_ELEVATION_MIN_M = -30;
export const PROJECT_ELEVATION_MAX_M = 300;
export const PROJECT_STOREY_HEIGHT_MIN_M = 2;
export const PROJECT_STOREY_HEIGHT_MAX_M = 10;

export const PROJECT_LIMITS = Object.freeze({
  nameMinLength: 3,
  nameMaxLength: 80,
  floorCountMin: 1,
  floorCountMax: 50,
  elevationMinM: -30,     // cao độ, mét, so với gốc tầng trệt = 0
  elevationMaxM: 300,
  storeyHeightMinM: 2,    // chiều cao thông thuỷ một tầng, mét — KHOẢNG UX rộng hơn domain
  storeyHeightMaxM: 10,
});
```

Màn upload cần chính xác `PROJECT_LIMITS.elevationMinM/elevationMaxM` (cao độ) và
`PROJECT_LIMITS.storeyHeightMinM/storeyHeightMaxM` (chiều cao tầng) — KHÔNG viết lại
`-30`, `300`, `2`, `10` bằng tay (R-71).

### Cách `useCreateProjectModal.ts:127-136` biến vi phạm giới hạn thành câu tiếng Việt

```ts
function elevationProblemFor(elevationMm: Millimetres): string | null {
  const elevationM = millimetresToMetres(elevationMm);
  if (elevationM < PROJECT_LIMITS.elevationMinM || elevationM > PROJECT_LIMITS.elevationMaxM) {
    return (
      `Cao độ vượt giới hạn cho phép (${formatNumber(PROJECT_LIMITS.elevationMinM)} ` +
      `đến ${formatNumber(PROJECT_LIMITS.elevationMaxM)} mét).`
    );
  }
  return null;
}
```

Khuôn giống hệt cho chiều cao tầng, tại `:111-125`:

```ts
function heightProblemFor(clearHeightM: number | null): string | null {
  if (clearHeightM === null) {
    return 'Chưa nhập chiều cao thông thuỷ.';
  }
  if (
    clearHeightM < PROJECT_LIMITS.storeyHeightMinM ||
    clearHeightM > PROJECT_LIMITS.storeyHeightMaxM
  ) {
    return (
      `Chiều cao thông thuỷ áp dụng từ ${formatNumber(PROJECT_LIMITS.storeyHeightMinM)} ` +
      `đến ${formatNumber(PROJECT_LIMITS.storeyHeightMaxM)} mét.`
    );
  }
  return null;
}
```

Đây chính là khuôn cho "thiếu cao độ" (nhánh `=== null`, câu cố định) và "trùng cao độ"
(dùng nhánh `overlap` của `alignFloors().issues` ở mục (a), câu đã Việt hoá sẵn trong
`issue.message` — không tự viết câu mới).

---

## (c) Đơn vị — `src/domain/units/types.ts`

```ts
export type Quantity<TUnit extends string> = number & UnitBrand<TUnit>;
export type Millimetres = Quantity<'mm'>;
export type Metres = Quantity<'m'>;

export const MILLIMETRES_PER_METRE = 1000;

export function millimetres(value: number): Millimetres;   // gate duy nhất nhận number thô
export function metres(value: number): Metres;
export function metresToMillimetres(value: Metres): Millimetres;
export function millimetresToMetres(value: Millimetres): Metres;
export function roundMeasurement(value: Millimetres, step?: Millimetres): Millimetres; // step mặc định = millimetres(1)
```

Đổi mm ↔ m CHỈ qua `metresToMillimetres` / `millimetresToMetres` — không nhân/chia
`1000` tay (đó chính là điều A15 + R-71 cấm). Việc đổi đơn vị diễn ra trong hook, không
trong view. `useCreateProjectModal.ts` dùng đúng khuôn này ở dòng 259
(`roundMeasurement(metresToMillimetres(metres(row.clearHeightM)))`) và dòng 128
(`millimetresToMetres(elevationMm)`).

---

## (d) Định dạng số — `src/lib/format/number.ts` + `src/lib/format/measure.ts`

### `MISSING_VALUE`
```ts
export const MISSING_VALUE = '—';   // em dash — dùng cho null/undefined/NaN/±Infinity, MỌI formatter dưới đây
```

### `formatNumber(value: MaybeNumber, options?: NumberFormatOptions): string`
```ts
interface NumberFormatOptions {
  fractionDigits?: number;      // số lẻ CỐ ĐỊNH, đệm 0
  maxFractionDigits?: number;   // số lẻ TỐI ĐA, bỏ 0 thừa — bị bỏ qua nếu có fractionDigits
  grouping?: boolean;           // mặc định true — chấm phân nhóm nghìn
}
```
Ví dụ đã kiểm chứng từ chính JSDoc nguồn:
- `formatNumber(1234567.891)` → `"1.234.567,891"`
- `formatNumber(3.5, { fractionDigits: 2 })` → `"3,50"`
- `formatNumber(null)` → `"—"`

### `formatPercent(value: MaybeNumber, options?: PercentFormatOptions): string`
```ts
type PercentSource = 'ratio' | 'percent';
interface PercentFormatOptions {
  fractionDigits?: number;
  maxFractionDigits?: number;
  source?: PercentSource;   // MẶC ĐỊNH 'ratio'
}
```
**Bẫy chính xác như đặc tả cảnh báo:** `source` mặc định là `'ratio'`, đọc `0.5` là
`"50%"`. Nếu tiến độ tải lên đã ở dạng phần trăm sẵn (ví dụ API trả `progressPercent = 50`
nghĩa là 50%), PHẢI truyền `{ source: 'percent' }`, nếu không `formatPercent(50)` sẽ ra
`"5000%"` (vì `Intl` nhân thêm 100 lần nữa).
- `formatPercent(0.125)` → `"12,5%"` (ratio mặc định)
- `formatPercent(50, { source: 'percent' })` → `"50%"` (đã ở dạng percent)
- `formatPercent(0.8, { fractionDigits: 0 })` → `"80%"`

### `formatLength(valueMm: MaybeNumber, options?: LengthFormatOptions): string`
```ts
type LengthDisplayUnit = 'mm' | 'm';
interface LengthFormatOptions {
  unit?: LengthDisplayUnit;     // ép đơn vị thay vì tự chọn theo độ lớn
  fractionDigits?: number;
}
```
Tự chọn đơn vị: dưới `1000 mm` (= `METRE_THRESHOLD_MM`) giữ mm nguyên, từ `1000 mm` trở
lên đổi sang m với 2 số lẻ.
- `formatLength(850)` → `"850 mm"`
- `formatLength(3450)` → `"3,45 m"`
- `formatLength(null)` → `"—"`

### `formatArea(areaM2: MaybeNumber, options?: MeasureFormatOptions): string`
2 số lẻ mặc định.
- `formatArea(248.6)` → `"248,60 m²"` (khớp bộ mẫu chuẩn A14: 248,60 m²)
- `formatArea(undefined)` → `"—"`

### Ghi chú bắt buộc
- Dấu thập phân là DẤU PHẨY (A15) — mọi ví dụ trên đã thể hiện đúng, nhờ locale `vi-VN`.
- `local/no-raw-number` biến `toFixed`/`toLocaleString` (và các phép quy đổi đơn vị thủ
  công) thành lỗi ESLint ở tầng view — mọi định dạng số PHẢI đi qua các hàm trên, gọi từ
  hook, không từ component.

### Byte / kích thước tệp — CHƯA TỒN TẠI trong repo hôm nay

`formatFileSize` (hoặc tương đương) **không có** trong `src/lib/format/**` tại thời điểm
khảo sát này. Một worker Layer-1 song song (T1) đang tạo `src/lib/format/bytes.ts` với
`formatFileSize`. Khảo sát này KHÔNG tạo, KHÔNG thiết kế hàm đó — chữ ký chính xác của nó
sẽ nằm trong `.notes/contract-upload.md` do T1 viết. Hook màn upload chỉ được gọi từ đó
sau khi contract của T1 xác nhận.

---

## (e) Lỗi — L-03

### Chuỗi ánh xạ đầy đủ

1. **`toAppError(error: unknown): AppError`** — `src/lib/errors/toAppError.ts:302`.
   Bảng ánh xạ HTTP status (`toAppError.ts:10-18`), trong đó dòng chính xác được đặc tả
   yêu cầu:
   ```ts
   // toAppError.ts:15-16
   413: 'upload',
   422: 'validation',
   ```
   Bảng đầy đủ: `401→unauthenticated`, `403→forbidden`, `404→notFound`, `409→conflict`,
   `413→upload`, `422→validation`, `429→rateLimited`. `toAppError` cũng đọc `HttpError.kind`
   (`'network'|'timeout'|'auth'|'parse'`) trước bảng status, và có suy luận theo từ khoá
   khi không khớp gì (regex trên message/code).

2. **`AppError`** (`src/lib/errors/kinds.ts:27-36`):
   ```ts
   interface AppError {
     kind: AppErrorKind;
     code: string;
     messageKey: string;
     params: AppErrorParams;   // { [key]: string|number|boolean|null|undefined }
     requestId: string;
     retryable: boolean;
     severity: AppErrorSeverity;   // 'cảnh báo' | 'lỗi' | 'nghiêm trọng'
     recovery: AppErrorRecovery;   // 'thử lại' | 'tải lại' | 'liên hệ quản trị' | 'không'
   }
   ```

3. **`AppErrorKind`** (`kinds.ts:1-17`) — 13 thành viên:
   `network, timeout, unauthenticated, forbidden, notFound, conflict, validation,
   rateLimited, upload, processing, geometry, export, unknown`.

4. **`APP_ERROR_KIND_CONFIG`** (`kinds.ts:49-180`) — bảng cấu hình theo từng kind: `code`,
   `titleKey`, `messageKey`, `severity`, `recovery`, `retryable`, `primaryButtonKey`,
   `secondaryButtonKey`. Hai hàng liên quan trực tiếp:
   ```ts
   upload: {
     code: 'UPLOAD', messageKey: 'errors.upload.description',
     primaryButtonKey: 'common.retry', recovery: 'thử lại',
     secondaryButtonKey: 'common.close', severity: 'lỗi',
     titleKey: 'errors.upload.title', retryable: true,
   },
   validation: {
     code: 'VALIDATION', messageKey: 'errors.validation.description',
     primaryButtonKey: 'common.close', recovery: 'không',
     secondaryButtonKey: 'common.close', severity: 'cảnh báo',
     titleKey: 'errors.validation.title', retryable: false,
   },
   ```

5. **`describeError(error: AppError): ErrorDescription`** — `src/lib/errors/describeError.ts:48`.
   ```ts
   interface ErrorDescription {
     title: string;
     description: string;
     primaryButtonLabel: string;
     secondaryButtonLabel: string;
   }
   ```
   Đọc chuỗi từ `vi.json` qua `messageKey`/`titleKey`/`primaryButtonKey`/`secondaryButtonKey`,
   thay biến `{{name}}`/`{name}` bằng `error.params`. Nếu `error.recovery === 'không'`,
   nhãn nút chính đổi thành `common.close` bất kể `primaryButtonKey` cấu hình gì
   (`describeError.ts:40-46`) — trường hợp `validation` chính là ca này.

### Khoá `vi.json` và câu tiếng Việt hiện có (`src/i18n/vi.json:45-48` và `:37-40`)

```json
"upload": {
  "title": "Tải tệp chưa xong",
  "description": "Tệp tải lên chưa xong. Kiểm tra kết nối rồi thử lại với tệp khác nếu cần."
},
"validation": {
  "title": "Dữ liệu chưa phù hợp",
  "description": "Kiểm tra lại các trường được đánh dấu rồi thử lại."
}
```
Không có biến `{{...}}` trong hai câu này nên `error.params` không ảnh hưởng tới chuỗi
hiển thị của hai kind này.

### Nhãn nút — có bắt buộc dùng không?

`describeError(...).primaryButtonLabel` / `.secondaryButtonLabel` tồn tại nhưng **tuỳ chọn
dùng cho màn này**: đặc tả gốc cấm hộp thoại lỗi tệp ("Không hộp thoại cho bất kỳ lỗi tại
tệp nào") và yêu cầu lỗi hiện NGAY TRONG thẻ của tệp đang lỗi, không chặn cả trang. Vì
`describeError`'s hai nhãn nút (`"Thử lại"` cho upload, `"Đóng"` cho validation) được thiết
kế cho khối alert/dialog (tiêu đề + mô tả + hai nút), màn inline-per-file thường chỉ cần
`description` (câu lỗi) cộng nút "thử lại tệp này" của chính nó (không phải nút chung của
`describeError`) — hook có thể bỏ qua `title`/`primaryButtonLabel`/`secondaryButtonLabel`
mà không vi phạm gì, miễn là `description` (câu Việt) được lấy nguyên từ `describeError`,
không viết tay lại.

---

## (f) Hoàn tác — D-05

### Sửa sai đường dẫn

Đặc tả màn gốc gọi file này là `src/lib/mutations/undo.ts` — **đường dẫn đó KHÔNG TỒN
TẠI**. Đường dẫn thật là `src/lib/mutations/undoTicket.ts`. Hook phải import từ đúng chỗ
này.

### `undoTicket.ts` — mọi thứ

```ts
export const UNDO_WINDOW_MS = 8000;   // 8 giây — invariant A8, dùng chung cho toast + thanh đếm ngược + hạn vé

export type UndoTicketStatus = 'active' | 'expired' | 'used';
export type UndoTicketError = 'expired';

export interface CreateUndoTicketOptions {
  description: string;
  now?: () => number;     // đồng hồ tiêm được, R-29 — mặc định Date.now
  ttlMs?: number;         // mặc định UNDO_WINDOW_MS
  undo: () => void;       // hành động hoàn tác thật
}

export interface UndoTicket {
  description: string;
  expiresAt: number;
  getStatus: () => UndoTicketStatus;
  id: string;
  undo: () => Result<void, UndoTicketError>;   // Result từ src/lib/http/types.ts
}

export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket;
```
Gọi `ticket.undo()` sau khi hết hạn không chạy `options.undo()`, trả `{ ok: false, error:
'expired' }` thay vì chạy hành động.

### `useUndoableToast.ts` — KHÔNG phải cách vé hoàn tác được hiện ra, cần sửa giả định

`src/hooks/useUndoableToast.ts` nghe `state.lastCommitLabel`/`lastCommitTimestamp` của
zustand store và gọi `useStore.temporal.getState().undo()` (undo/redo toàn cục qua zundo)
— đây là cơ chế hoàn tác Ở TẦNG STORE (mọi commit `commit(patch, label)`), KHÔNG PHẢI cơ
chế hoàn tác THEO TỪNG VÉ (`UndoTicket`) mà D-05 mô tả. Hai cơ chế độc lập nhau. Việc xoá
một tệp khỏi danh sách upload (state cục bộ của hook màn hình, chưa chắc đã qua
`commit()`) không đi qua `useUndoableToast`.

**Khuôn thật đang chạy cho D-05** (đã xác nhận bằng mã, không phải suy đoán) — nằm ở
`useProjectSettings.ts:664-681`:
```ts
const ticket = createUndoTicket({
  description: UNDO_DESCRIPTION,
  undo: () => {
    setDraft(previous);          // hành động hoàn tác thật của hook này
    autosave.notifyChange();
  },
  ...(options.now !== undefined ? { now: options.now } : {}),
});

options.onToast?.({
  message: SAVED_TOAST_MESSAGE,
  onUndo: () => {
    ticket.undo();
  },
});
```
Tức là: hook tự tạo `UndoTicket` với `undo` là hành động khôi phục cục bộ của chính nó, rồi
gọi `options.onToast?.({ message, onUndo: () => ticket.undo() })` — `onToast` là một hàm
được TIÊM VÀO qua option của hook (`UseXOptions.onToast`), do màn cha (nơi có
`Toast.Provider`) truyền xuống; bản thân file trong `src/hooks`/`src/screens` không tự vẽ
toast. Hook màn upload nên theo đúng khuôn này cho "đã xoá tệp — hoàn tác": tạo
`UndoTicket` với `undo` là hàm khôi phục tệp vào danh sách, rồi gọi `onToast` với
`onUndo: () => ticket.undo()`.

(Ghi chú phụ: `useCreateProjectModal.ts:668-673` cũng gọi `onToast` cho việc tạo dự án,
nhưng ở đó `onUndo` là một closure gọi thẳng `gateway.remove(created.id)` — KHÔNG bọc qua
`createUndoTicket`. Đây là một ví dụ hợp lệ về giao diện `onToast`, nhưng không phải ví dụ
đúng chuẩn D-05 vì thiếu vé/hạn 8 giây tự quản. Ví dụ đúng chuẩn để chép là
`useProjectSettings.ts` ở trên.)

---

## (g) Trạng thái máy chủ — tóm tắt một trang (R-64)

Phần sâu do T5 làm; đây chỉ là danh sách tên + chữ ký để hook không tự chế `isLoading`/`error`.

### `src/lib/query/queryKeys.ts`
```ts
export const queryKeys: {
  drawing: { byFloor: QueryKeyFactory<[floorId: string], ...> },
  floor: { detail: QueryKeyFactory<[floorId], ...>, list: QueryKeyFactory<[projectId], ...> },
  project: { detail, list, members },
  // + library, progress, room, space, user, version, violation
}
```
Không có nhánh `queryKeys.drawing.byFloor` nào khác cho "upload" riêng — dùng
`queryKeys.drawing.byFloor(floorId)` cho khoá đọc/ghi bản vẽ theo tầng.

### `src/lib/query/cachePolicy.ts`
`CACHE_POLICY_TIERS = ['default', 'static', 'aiProgress', 'spatialDraft']`;
`CACHE_POLICY` (nguồn DUY NHẤT mọi số thời gian: `default.staleTime=30_000`,
`default.gcTime=600_000`, `branches.static=300_000`, `branches.aiProgress=0`,
`branches.spatialDraft=10_000`, `retry.query=1`, `retry.mutation=0`);
`resolveCachePolicy(queryKey)`, `resolveCachePolicyTier(queryKey)`,
`listCachePolicyDefaults()`. Domain `'drawing'` đã map sẵn vào tier `'spatialDraft'`
(`cachePolicy.ts:78`).

### `src/lib/query/invalidation.ts`
`WRITE_OPERATIONS` hiện KHÔNG có mục nào cho "uploadDrawing" (8 giá trị: `createProject,
editFloor, editWall, moveFurniture, editDimension, changeAxis, rerunRules,
restoreVersion`). `invalidationMap[op](params): readonly QueryKey[]`,
`applyInvalidation<TOperation>(...)`. Nếu màn upload cần một entry mới, đó là quyết định
của T5/người duyệt, không phải việc khảo sát này tự thêm.

### `src/lib/query/queryClient.ts`
`createQueryClient(overrides?): QueryClient`, `queryClient` (instance dùng chung, dòng 68),
`normalizeQueryError(error): AppError` (= `toAppError`).

### `src/lib/query/prefetch.ts`
`prefetchOnHover<TData>(queryClient, queryKey, fetcher, delayMs = 200):
PrefetchOnHoverHandlers`.

### `src/lib/mutations/createOptimisticMutation.ts`
```ts
interface OptimisticMutationConfig<TVariables, TResult> {
  affectedKeys: (variables: TVariables) => readonly QueryKey[];
  afterSuccess: (result: TResult, variables: TVariables) => void;
  applyOptimistic: (variables: TVariables) => void;
  callServer: (variables: TVariables) => Promise<TResult>;
  entityId: (variables: TVariables) => string;
  rollback: (variables: TVariables) => void;
}
export function createOptimisticMutation<TVariables, TResult>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TVariables, TResult>,
): UseMutationOptions<TResult, AppError, TVariables>;
```
Lỗi từ `callServer` luôn được chuẩn hoá qua `toAppError` trước khi ném lại (khớp mục (e)).

---

## Tổng hợp import mà hook Layer-2 được phép viết

```ts
import { alignFloors, ceilingElevationMm, type FloorPlan } from '@/domain/axes/alignFloors';
import { PROJECT_LIMITS } from '@/domain/project/limits';
import type { LevelId } from '@/domain/spatial/types';
import {
  metres, metresToMillimetres, millimetres, millimetresToMetres, roundMeasurement,
  type Millimetres,
} from '@/domain/units/types';
import { describeError, toAppError } from '@/lib/errors';
import { formatNumber, formatPercent, isFormattable, MISSING_VALUE } from '@/lib/format/number';
import { formatLength } from '@/lib/format/measure';
// formatFileSize: đến từ T1's src/lib/format/bytes.ts — xem .notes/contract-upload.md
import { createUndoTicket, UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';
import { queryKeys } from '@/lib/query/queryKeys';
// createOptimisticMutation nếu ghi lạc quan; xem T5's contract cho chi tiết
```

## Đối chiếu với [CẤM TUYỆT ĐỐI] của đặc tả màn gốc

- "Không tự chia khúc, không tự đếm song song, không tự viết giới hạn dung lượng." — khảo
  sát này xác nhận `formatFileSize`/giới hạn dung lượng tệp CHƯA tồn tại và KHÔNG được tự
  viết ở đây; chờ T1.
- "Lỗi của một tệp không được chặn cả trang." — khớp mục (e): `describeError(...).
  description` render trong thẻ của tệp, không phải hộp thoại toàn màn.
- "Không hộp thoại cho bất kỳ lỗi tại tệp nào." — mục (e) đã ghi rõ nhãn nút của
  `describeError` là TUỲ CHỌN, không bắt buộc dựng thành alert/dialog.
