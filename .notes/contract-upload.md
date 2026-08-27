# Contract — tầng logic tải lên (`src/lib/upload/**` + `src/lib/format/bytes.ts`)

Tài liệu này là **giao kèo đầy đủ** cho tầng logic tải lên. Người viết hook của màn
hình chỉ cần đọc file này, không cần mở mã nguồn. Mọi ký hiệu được xuất đều có ở đây
kèm chữ ký chính xác, kiểu tham số / kiểu trả về, và ví dụ dùng hai dòng.

- Nhập gọn: `import { … } from '@/lib/upload';` (barrel `src/lib/upload/index.ts`).
- Kích thước tệp: `import { formatFileSize } from '@/lib/format/bytes';` — **không**
  nằm trong barrel trên, nó là anh em của `@/lib/format/number` và `@/lib/format/measure`.
- Tầng này **không** viết câu tiếng Việt cho người đọc. Mọi từ chối, mọi thất bại trả
  về **dữ liệu có nhãn** kèm các con số cần thiết; màn hình dựng câu từ đó.
- Tầng này **không** import React / store / hooks / components / screens (mục 0.4), và
  **không** gọi mạng trực tiếp: client API được **tiêm vào**.

---

## 0. Bảng các hằng số — mỗi con số chỉ có MỘT nhà

| Hằng | Giá trị | Ở đâu | Nghĩa |
|---|---|---|---|
| `UPLOAD_CHUNK_SIZE_BYTES` | `5 * 1024 * 1024` = 5 242 880 | `chunk.ts` | Một khúc gửi đi trong `sendChunk` |
| `MAX_UPLOAD_FILE_SIZE_BYTES` | `100 * 1024 * 1024` = 104 857 600 | `validate.ts` | Trần dung lượng một tệp |
| `MAX_PDF_PAGE_COUNT` | `20` | `validate.ts` | Trần số trang PDF |
| `ACCEPTED_UPLOAD_EXTENSIONS` | `['.png', '.jpg', '.pdf', '.dwg']` | `validate.ts` | Danh sách trắng định dạng |
| `MAX_PARALLEL_UPLOADS` | `3` | `uploadTask.ts` | Số TỆP chạy song song tối đa |
| `MAX_CHUNK_ATTEMPTS` | `3` | `uploadTask.ts` | Số lần thử một khúc, tính cả lần đầu (⇒ 2 lần thử lại) |
| `PROGRESS_EMITS_PER_SECOND` | `4` | `uploadTask.ts` | Trần số lần báo tiến độ mỗi giây, mỗi task |
| `PROGRESS_MIN_GAP_MS` | `250` | `uploadTask.ts` | Khoảng cách tối thiểu giữa hai lần báo |
| `BYTES_PER_UNIT` | `1024` | `format/bytes.ts` | Đơn vị nhị phân, khớp hai trần ở trên |
| `BYTE_UNITS` | `['B','KB','MB','GB','TB']` | `format/bytes.ts` | Thang đơn vị |

**Đừng chép lại con số nào trong bảng này vào màn hình.** Nhập hằng.

---

## 1. `src/lib/upload/chunk.ts` — cắt khúc, base64, băm (mã T-01)

### `UPLOAD_CHUNK_SIZE_BYTES: number`

```ts
import { UPLOAD_CHUNK_SIZE_BYTES } from '@/lib/upload';
const soKhuc = Math.ceil(file.size / UPLOAD_CHUNK_SIZE_BYTES);   // 5 242 880
```

### `interface UploadChunk`

```ts
interface UploadChunk {
  readonly index: number;      // 0, 1, 2… — chính là body.chunkIndex
  readonly byteStart: number;  // bao gồm
  readonly byteEnd: number;    // KHÔNG bao gồm
  readonly blob: Blob;         // lát cắt, chưa đọc byte nào
}
```

### `sliceIntoChunks(source: Blob, chunkSizeBytes?: number): UploadChunk[]`

- `chunkSizeBytes` mặc định `UPLOAD_CHUNK_SIZE_BYTES`. Ném `RangeError` nếu không phải
  số nguyên dương.
- Tệp rỗng → `[]`. Khúc cuối ngắn hơn khi kích thước không chia hết.

```ts
const chunks = sliceIntoChunks(file);            // File là Blob
const cuoi = chunks[chunks.length - 1];          // byteEnd === file.size
```

### `countUploadChunks(sizeBytes: number, chunkSizeBytes?: number): number`

Đếm mà không cắt. `0` khi `sizeBytes <= 0`. Cùng `RangeError` như trên.

```ts
countUploadChunks(12_582_912, 5_242_880);   // 3
countUploadChunks(0);                        // 0
```

### `readBlobBytes(blob: Blob): Promise<Uint8Array>`

Dùng `Blob.arrayBuffer` nếu runtime có, `FileReader` nếu không (jsdom và Safari cũ
không có). Reject bằng `Error` khi trình đọc hỏng.

```ts
const bytes = await readBlobBytes(chunks[0].blob);
console.log(bytes.length);
```

### `bytesToBinaryString(bytes: Uint8Array): string`

Mỗi byte thành một ký tự (đọc latin-1). Dựng theo khối nên không tràn ngăn xếp.

```ts
bytesToBinaryString(new Uint8Array([37, 80, 68, 70]));   // "%PDF"
```

### `encodeBytesBase64(bytes: Uint8Array): string`

```ts
encodeBytesBase64(new TextEncoder().encode('hi'));   // "aGk="
```

### `encodeChunkBase64(blob: Blob): Promise<string>`

Đây là thứ đưa vào `SendDrawingChunkInput.body.chunk`.

```ts
const chunk = await encodeChunkBase64(chunks[2].blob);
await api.sendChunk({ body: { chunk, chunkIndex: 2 }, projectId, uploadId });
```

### `sha256Hex(bytes: Uint8Array): Promise<string>`

SHA-256 của byte đã có sẵn, trả hex **chữ thường**. Dùng `crypto.subtle` khi runtime
có; khi không có (trang chạy trên `http://` thuần) tự động rơi về bộ băm nội bộ — kết
quả giống hệt.

```ts
await sha256Hex(new TextEncoder().encode('abc'));
// "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
```

### `hashBlobSha256Hex(source: Blob, options?: HashBlobOptions): Promise<string>`

```ts
interface HashBlobOptions {
  readonly chunkSizeBytes?: number;   // mặc định UPLOAD_CHUNK_SIZE_BYTES
  readonly signal?: AbortSignal;      // huỷ ở ranh giới khúc kế tiếp
}
```

- Vân tay SHA-256 của **cả tệp**, hex chữ thường.
- Đọc từng khúc một: tệp 100 MB được băm với 5 MB bộ nhớ, **không** nạp cả tệp.
- Tệp vừa một khúc → đi thẳng `crypto.subtle.digest`. Nhiều khúc → bộ băm tăng dần.
- Huỷ giữa chừng ném `Error` có `name === 'AbortError'`.

```ts
const sha256 = await hashBlobSha256Hex(file);
const sha256 = await hashBlobSha256Hex(file, { signal: controller.signal });
```

### `createSha256Hasher(): Sha256Hasher`

```ts
interface Sha256Hasher {
  readonly update: (bytes: Uint8Array) => void;
  readonly digestHex: () => string;   // gọi một lần
}
```

```ts
const hasher = createSha256Hasher();
hasher.update(a); hasher.update(b); const hex = hasher.digestHex();
```

> **Ghi chú thiết kế (đọc trước khi thắc mắc).** WebCrypto **không có** digest theo
> dòng: `crypto.subtle.digest` nhận cả thông điệp một lần và không có `update()`. Yêu
> cầu "dùng crypto.subtle" và "không nạp cả tệp vào bộ nhớ" vì thế không thể cùng đúng
> trên một đường đi. Module giữ cả hai: một khúc → `crypto.subtle`; nhiều khúc → bộ băm
> tăng dần viết tại chỗ, và test khẳng định hai đường cho cùng một digest trên mọi véc-tơ
> (kể cả ba véc-tơ công bố của FIPS 180-4).

---

## 2. `src/lib/upload/validate.ts` — nhận / từ chối, và đoán tầng (mã T-03)

### Kiểu

```ts
type AcceptedUploadExtension = '.png' | '.jpg' | '.pdf' | '.dwg';
type UploadBranch = 'cad' | 'pdf' | 'raster';

type UploadRejection =
  | { readonly kind: 'tooLarge';          readonly sizeBytes: number;  readonly maxSizeBytes: number }
  | { readonly kind: 'unsupportedFormat'; readonly extension: string;  readonly acceptedExtensions: readonly AcceptedUploadExtension[] }
  | { readonly kind: 'tooManyPages';      readonly pageCount: number;  readonly maxPageCount: number }
  | { readonly kind: 'unreadable';        readonly extension: string };

interface UploadAccepted {
  readonly ok: true;
  readonly branch: UploadBranch;
  readonly extension: AcceptedUploadExtension;
  readonly sizeBytes: number;
  readonly pageCount?: number;   // chỉ có với PDF đọc được số trang
}

interface UploadRejected { readonly ok: false; readonly reason: UploadRejection }

type UploadValidation = UploadAccepted | UploadRejected;

interface UploadCandidate {           // `File` thoả kiểu này
  readonly name: string;
  readonly size: number;
  slice: (start?: number, end?: number) => Blob;
}
```

### `validateUploadFile(file: UploadCandidate): Promise<UploadValidation>`

Thứ tự kiểm: **dung lượng → định dạng → (chỉ PDF) số trang**.

```ts
const check = await validateUploadFile(file);
if (!check.ok && check.reason.kind === 'tooLarge') showTooLarge(check.reason);
```

Bảng dịch từ dữ liệu sang câu — **màn hình viết câu, không phải tầng này**:

| `reason.kind` | Trường mang theo | Ý cho câu |
|---|---|---|
| `tooLarge` | `sizeBytes`, `maxSizeBytes` | `formatFileSize(sizeBytes)` vượt `formatFileSize(maxSizeBytes)` |
| `unsupportedFormat` | `extension` (`''` khi không có đuôi), `acceptedExtensions` | định dạng không nhận, kèm danh sách |
| `tooManyPages` | `pageCount`, `maxPageCount` | PDF quá nhiều trang |
| `unreadable` | `extension` | byte không phải PDF hợp lệ |

Khi `ok === true`:

- `branch === 'cad'` ⇔ `.dwg` → đây là tín hiệu để hiện chip "Nhánh CAD". Màn hình
  **không** cần tự đọc đuôi tệp.
- `branch === 'raster'` ⇔ `.png` / `.jpg`; `branch === 'pdf'` ⇔ `.pdf`.
- `pageCount` chỉ xuất hiện khi đọc được (xem điểm mù dưới đây).

### `readPdfPageCount(file: UploadCandidate): Promise<number | null>`

Đọc số trang từ chính byte của tệp, không thư viện, không gọi mạng: lấy `/Count` của
cây trang, nếu không có thì đếm đối tượng `/Type /Page`. Quét theo cửa sổ 256 KiB và giữ
64 byte gối đầu, nên token nằm vắt qua ranh giới vẫn được đếm — đúng một lần.

- Trả `number` — số trang.
- Trả `0` — là PDF, nhưng bộ đọc **không thấy** cây trang.
- Trả `null` — byte **không phải** PDF (không có `%PDF-` trong 1 KiB đầu).

```ts
const pages = await readPdfPageCount(file);
if (pages === null) refuse('unreadable');
```

> **Điểm mù đã biết, cố ý.** Từ PDF 1.5 nhà sản xuất có thể nén đối tượng trang vào
> object stream; khi đó cả `/Count` lẫn `/Type /Page` đều không xuất hiện dưới dạng
> văn bản. Tệp như vậy trả **số trang không rõ** (`0`) và `validateUploadFile` **nhận**
> nó, `pageCount` bị bỏ trống — chứ không từ chối. Hai chiều sai không cân nhau: thả một
> PDF 40 trang qua chỉ tốn một lượt 422 mà `toAppError` đã ánh xạ sẵn, còn từ chối nhầm
> một bản vẽ 3 trang là mất luôn lượt tải. `unreadable` vì thế **chỉ** dành cho byte
> không phải PDF.

### `readExtension(name: string): string`

Đuôi tệp viết thường, còn dấu chấm. `''` khi tên không có dấu chấm.

```ts
readExtension('Mặt bằng TẦNG 2.PDF');   // ".pdf"
readExtension('ban-ve');                 // ""
```

### `guessFloorFromFileName(name: string): FloorGuess`

```ts
type FloorGuessConfidence = 'high' | 'medium' | 'low';
interface FloorGuessHit  { readonly ok: true;  readonly level: number; readonly confidence: FloorGuessConfidence; readonly matchedText: string }
interface FloorGuessMiss { readonly ok: false }
type FloorGuess = FloorGuessHit | FloorGuessMiss;
```

- **Không bao giờ ném.** Trượt (`{ ok: false }`) là câu trả lời bình thường.
- `level`: trệt = `0`, tầng trên = dương, hầm = âm.
- Kết quả **luôn** cho người dùng sửa đè trong giao diện.

```ts
guessFloorFromFileName('mat-bang-tang-2.pdf');  // { ok: true, level: 2, confidence: 'high', matchedText: 'tang-2' }
guessFloorFromFileName('A-101-trang-3.pdf');    // { ok: false }
```

Bảng dạng nhận được (đã bỏ dấu, không phân biệt hoa thường, `_ . -` và khoảng trắng
đều là dấu ngăn):

| Viết trong tên tệp | `level` | `confidence` |
|---|---|---|
| `tang-2`, `tang2`, `TẦNG 12` | 2, 2, 12 | `high` |
| `floor 2`, `level 4` | 2, 4 | `high` |
| `tret`, `tầng trệt`, `ground`, `ground floor` | 0 | `high` |
| `ham`, `hầm 2`, `tang ham 1`, `basement`, `BASEMENT 3` | −1, −2, −1, −1, −3 | `high` |
| `lau 2`, `lầu 5` | 2, 5 | `medium` |
| `FL3` | 3 | `medium` |
| `B1` | −1 | `medium` |
| `T2`, `L2` | 2, 2 | `medium` |

Bẫy số trang / số tờ được **gỡ trước** khi tìm tầng, nên các tên này đều trượt:
`trang-3`, `sheet3`, `p3`, `page 7`, `PG2`.

Thứ tự ưu tiên có chủ đích: dạng nói rõ (`tang`, `floor`, `level`, `tret`, `ham`,
`basement`) được đọc trước dạng mập mờ một chữ cái (`B1`, `T2`, `L2`), nên
`ban-ve-B2-tang-3.pdf` cho `level: 3, confidence: 'high'` chứ không phải `−2`.

---

## 3. `src/lib/upload/uploadTask.ts` — chạy một tệp, và hồ song song (mã T-02)

### Kiểu trạng thái

```ts
type UploadTaskStatus = 'queued' | 'uploading' | 'done' | 'failed' | 'cancelled';
type UploadStage = 'init' | 'chunk' | 'complete';

interface UploadFailure {
  readonly stage: UploadStage;
  readonly error: AppError;        // @/lib/errors — kind, severity, recovery, messageKey
  readonly attempts: number;
  readonly terminal: boolean;      // true ⇔ 413 / 422, thử lại vô ích
  readonly chunkIndex: number | null;
}

interface UploadTaskState {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly status: UploadTaskStatus;
  readonly percent: number;        // số nguyên 0..100
  readonly chunkCount: number;
  readonly chunksSent: number;
  readonly uploadId: string | null;
  readonly progress: Progress | null;   // Progress cuối server trả (có step, progressPercent)
  readonly failure: UploadFailure | null;
}
```

**Mọi trường luôn có mặt** (dùng `null` chứ không bỏ trống), nên view không phải kiểm
tra sự tồn tại trước khi vẽ.

### `createUploadTask(options: CreateUploadTaskOptions): UploadTask`

```ts
interface CreateUploadTaskOptions {
  readonly api: DrawingsApi;                 // TIÊM VÀO — không phải singleton
  readonly file: UploadFile;                 // File thoả kiểu này
  readonly floorId: string;
  readonly projectId: string;
  readonly onProgress?: (state: UploadTaskState) => void;
  readonly signal?: AbortSignal;
  readonly clock?: UploadClock;              // mặc định systemUploadClock
  readonly id?: string;                      // mặc định UUID mới
  readonly chunkSizeBytes?: number;          // mặc định UPLOAD_CHUNK_SIZE_BYTES
  readonly maxAttempts?: number;             // mặc định MAX_CHUNK_ATTEMPTS
  readonly progressMinGapMs?: number;        // mặc định PROGRESS_MIN_GAP_MS
}

interface UploadFile {                       // File thoả kiểu này
  readonly name: string;
  readonly size: number;
  readonly type: string;                     // đi vào body.mimeType
  slice: (start?: number, end?: number) => Blob;
}

interface UploadTask {
  readonly id: string;
  readonly getState: () => UploadTaskState;  // đọc ngay, KHÔNG bị bóp tần suất
  readonly start: () => Promise<UploadTaskState>;
  readonly cancel: () => void;
}
```

```ts
const task = createUploadTask({ api: client.drawings, file, floorId, projectId, onProgress: setRow });
const ketQua = await task.start();   // ketQua.status: 'done' | 'failed' | 'cancelled'
```

Task chạy: `initUpload` → `sendChunk` **theo thứ tự khúc** → `complete`.

- `uploadId` lấy từ `Progress.id` mà `initUpload` trả về. Đây là điểm duy nhất tầng này
  suy diễn từ hợp đồng API: `DrawingsApi.initUpload` trả `Progress`, không trả một
  đối tượng có trường `uploadId` riêng, mà `sendChunk`/`complete` lại cần `uploadId` —
  `Progress.id` là trường duy nhất mang định danh đó.
- `percent` tính từ số khúc server đã nhận (`Math.floor`), và bằng `100` khi `done`.
- `progress` giữ `Progress` mới nhất, dùng cho nhãn bước (`step`) của xử lý phía server.
- Gọi `start()` lần thứ hai không chạy lại: trả nguyên trạng thái hiện tại.

### Thử lại

- Một khúc được thử tối đa `MAX_CHUNK_ATTEMPTS` (3) lần, **tính cả lần đầu**.
- Chờ giữa các lần dùng thang lùi của chính tầng truyền tải: `RETRY_DELAYS_MS`
  (`[300, 900, 2700]` ms) — không có thang thứ hai.
- **413 và 422 là điểm dừng**: `failure.terminal === true`, `failure.attempts === 1`,
  không thử lại. Kiểm bằng `toAppError` (`kind` là `'upload'` hoặc `'validation'`), tức
  dùng lại đúng ánh xạ đã có ở `src/lib/errors/toAppError.ts`.
- `failure.stage` cho biết hỏng ở đâu; `failure.chunkIndex` chỉ khác `null` khi
  `stage === 'chunk'`.
- Lỗi của **một** tệp không chạm tới tệp khác: `runUploadQueue` trả mỗi task một trạng
  thái riêng.

### Huỷ

- `task.cancel()` hoặc abort `options.signal` đều dừng ở ranh giới kế tiếp và cắt cả
  yêu cầu đang bay (signal được truyền xuống `api`).
- Trạng thái cuối là `'cancelled'`, phát **đúng một lần**, và **không có** lần báo tiến
  độ nào sau đó.

### Tần suất báo tiến độ — tiêu chí nghiệm thu

- Tối đa `PROGRESS_EMITS_PER_SECOND` (4) lần / giây / task; khoảng cách tối thiểu giữa
  hai lần là `PROGRESS_MIN_GAP_MS` (250 ms). Bóp theo kiểu **leading + trailing**: lần
  đầu đi ngay, các lần dồn trong cửa sổ chỉ giữ giá trị mới nhất.
- **Lần cuối (100 %, hoặc `failed`, hoặc `cancelled`) luôn được giao.** Nếu nó rơi vào
  giữa một cửa sổ, nó được giao **ở cuối cửa sổ đó** chứ không xuyên qua — giao sớm là
  trường hợp duy nhất đẩy một giây lên 5 lần báo. `start()` chỉ `resolve` **sau khi**
  lần cuối đã tới tay người nghe.
- Cần trạng thái cuối sớm hơn vài mili-giây thì đọc `task.getState()` — hàm này không
  bị bóp.

### `UploadClock` — đồng hồ tiêm vào

```ts
type UploadTimerHandle = ReturnType<typeof setTimeout>;

interface UploadClock {
  readonly now: () => number;
  readonly setTimeout: (handler: () => void, delayMs: number) => UploadTimerHandle;
  readonly clearTimeout: (handle: UploadTimerHandle) => void;
}

const systemUploadClock: UploadClock;   // đọc Date.now / setTimeout toàn cục
```

Mặc định là `systemUploadClock`, tức đúng cặp toàn cục mà
`src/lib/testing/fakeClock` (`installFakeClock`, `withFakeClock`) thay thế — nên test
dùng `fakeClock` không cần tiêm gì. Muốn kiểm tần suất tuyệt đối xác định thì tiêm một
đồng hồ tự bước.

```ts
await withFakeClock(async (clock) => { const p = task.start(); await clock.runAllTimers(); await p; });
```

### `createUploadScheduler(options?: CreateUploadSchedulerOptions): UploadScheduler`

```ts
interface CreateUploadSchedulerOptions { readonly maxParallel?: number }   // mặc định MAX_PARALLEL_UPLOADS = 3

interface UploadScheduler {
  readonly run: <T>(job: () => Promise<T>) => Promise<T>;
  readonly activeCount: () => number;
  readonly queuedCount: () => number;
}
```

Hồ chạy tối đa `maxParallel` việc cùng lúc, theo thứ tự nộp; chỗ được trả lại cả khi
việc ném lỗi.

```ts
const pool = createUploadScheduler();
const states = await Promise.all(tasks.map((task) => pool.run(() => task.start())));
```

### `runUploadQueue(tasks: readonly UploadTask[], options?: CreateUploadSchedulerOptions): Promise<UploadTaskState[]>`

Chạy cả mẻ qua một hồ và chờ hết. Trả **một trạng thái cuối cho mỗi task**, kể cả task
hỏng — thứ tự đúng thứ tự `tasks`.

```ts
const states = await runUploadQueue(files.map((file) => createUploadTask({ api, file, floorId, projectId })));
const soHong = states.filter((state) => state.status === 'failed').length;
```

### `isTerminalUploadError(error: unknown): boolean`

`true` khi `toAppError(error).kind` là `'upload'` (413) hoặc `'validation'` (422).

```ts
isTerminalUploadError(httpError413);   // true
isTerminalUploadError(httpError500);   // false
```

---

## 4. `src/lib/format/bytes.ts` — kích thước tệp (mã P-01, nửa "dung lượng")

Nhập riêng: `import { formatFileSize } from '@/lib/format/bytes';`

### `formatFileSize(sizeBytes: MaybeNumber, options?: FileSizeFormatOptions): string`

```ts
type MaybeNumber = number | null | undefined;          // từ @/lib/format/number
type ByteUnit = 'B' | 'KB' | 'MB' | 'GB' | 'TB';

interface FileSizeFormatOptions {
  readonly unit?: ByteUnit;         // ép đơn vị, để một cột thẳng hàng
  readonly fractionDigits?: number; // mặc định 0 với 'B', 1 với các đơn vị trên
}
```

- Dấu thập phân là **dấu phẩy**, nhóm nghìn bằng **dấu chấm** (bất biến A15). Dựng trên
  `formatNumber` của `@/lib/format/number`; **không** gọi `toFixed`/`toLocaleString`.
- Đơn vị **nhị phân** (1 KB = 1024 B), để khớp `UPLOAD_CHUNK_SIZE_BYTES` và
  `MAX_UPLOAD_FILE_SIZE_BYTES`.
- `null`, `undefined`, `NaN`, `±Infinity` → `MISSING_VALUE` (`'—'`).

```ts
formatFileSize(0);              // "0 B"
formatFileSize(5_242_880);      // "5,0 MB"      ← đúng UPLOAD_CHUNK_SIZE_BYTES
formatFileSize(104_857_600);    // "100,0 MB"    ← đúng MAX_UPLOAD_FILE_SIZE_BYTES
formatFileSize(1_572_864, { fractionDigits: 2 });   // "1,50 MB"
formatFileSize(512, { unit: 'KB' });                // "0,5 KB"
formatFileSize(undefined);      // "—"
```

Còn `BYTES_PER_UNIT: number` và `BYTE_UNITS: readonly ByteUnit[]` cũng được xuất, cho
nơi nào cần dựng bộ chọn đơn vị.

---

## 5. Ba điều màn hình vẫn phải tự làm

1. **Viết câu tiếng Việt.** Tầng này trả nhãn + số. Ví dụ `tooLarge` → dựng câu từ
   `formatFileSize(reason.sizeBytes)` và `formatFileSize(reason.maxSizeBytes)`.
2. **Cho sửa đè tầng đã đoán.** `guessFloorFromFileName` là gợi ý; `{ ok: false }` là
   bình thường và phải hiện ô chọn tầng trống, không phải báo lỗi.
3. **Không tự chia khúc, không tự đếm song song, không tự viết trần dung lượng.** Bốn
   việc đó đã có nhà: `sliceIntoChunks`, `createUploadScheduler` / `runUploadQueue`,
   `MAX_UPLOAD_FILE_SIZE_BYTES`, `MAX_PDF_PAGE_COUNT`.
