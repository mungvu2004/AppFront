# Hợp đồng giao diện — S-11 PipelineFailure

Ghi chú của T4 (chủ sở hữu duy nhất `src/i18n/vi.json` trong DAG này). Đây là bản
đọc **nguyên văn** hình dạng props từ mã hiện có, để worker dựng view S-11 không
phải mở lại từng file. Mọi trích dẫn kèm `file:dòng`.

## 0. Phán quyết đã chốt (nhắc lại)

1. **Không dùng 240ms.** Dùng `260` (slot `standard`) từ `MOTION_DURATIONS_MS`,
   nhập từ `src/lib/motion/tokens.ts` — xem mục 5 dưới đây.
2. **Không dùng 1200ms cho nhãn "Đã sao chép".** Không có hằng số 1200 nào hợp lệ
   trong repo. Hằng số đúng để dùng là **`AMBIENT_LOOP_MS` = 700**
   (`src/lib/motion/tokens.ts:87`) — đây là giá trị thứ năm rule B cho phép,
   dùng cho pha lặp/flash chứ không phải chuyển động. **Tiền lệ đã có trong repo
   cho đúng việc này:** `src/hooks/useShareLinks.ts:251` khai
   `const COPY_FLASH_MS = 700;` với chú thích *"How long the 'đã chép' flash
   stays on a row. One of the five durations."* — đúng cùng một nhu cầu (nhãn
   nút đổi thành "đã chép" trong một khoảng rồi quay lại). Hằng số đó là `const`
   riêng của module, **không export**, nên đừng import thẳng nó — import
   `AMBIENT_LOOP_MS` từ `src/lib/motion/tokens.ts` và dùng y hệt cách
   `useShareLinks.ts` dùng `COPY_FLASH_MS`. Ví dụ dùng đúng luật (xem mục 5):
   `setTimeout(() => setCopied(false), AMBIENT_LOOP_MS)` — hợp lệ với
   `local/no-raw-duration` vì đối số là một identifier, không phải literal số.
   **Không tự viết `setTimeout(fn, 1200)` hay bất kỳ literal số nào** —
   `eslint-rules/no-raw-duration.js:209-217` chặn đích danh literal số ở đối số
   thứ hai của `setTimeout`/`setInterval`.
3. Không tạo route mới, không sửa `src/routes/**`.

## 1. `InlineAlert` — `src/components/feedback/InlineAlert.tsx`

```ts
// dòng 7
export type InlineAlertLevel = 'verified' | 'attention' | 'violation';

// dòng 9-18
export interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  level: InlineAlertLevel;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}
```

- Mức dùng cho S-11 là **`violation`** → icon `AlertCircle` (dòng 37), nền
  `bg-state-violation-tint`, viền `border-state-violation`, chữ
  `text-state-violation-text` (dòng 32-35). Không mã màu thô — toàn bộ đã là
  token Tailwind, không cần đổi gì.
- `action` là **một object, không phải mảng — chỉ nhận ĐÚNG MỘT nút** (dòng
  13-17, dòng 63-79 dựng đúng một `<Button>`). S-11 cần **ba** hướng đi tiếp
  ("Thử lại với ngưỡng thấp hơn", "Tải lên bản vẽ rõ hơn", "Bỏ qua tầng đó").
  **Không tạo component mới** (mục CẤM), nên chỗ đặt hai hướng còn lại là:
  đặt chúng làm `<Button>` thường (từ `src/components/ui/Button.tsx`, xem mục
  2) trong một hàng `flex` **ngay bên dưới** `InlineAlert`, đúng khuôn mà
  `ProcessingScreen.tsx` đã dùng cho `errorAlert` — xem mục 4 dưới, khối
  `errorAlert !== undefined` (`ProcessingScreen.tsx:229-244`) đặt
  `InlineAlert` (một action: Thử lại) rồi một `<div className="flex ... gap-3">`
  chứa mã kỹ thuật + nút "Liên hệ hỗ trợ" ngay dưới nó. S-11 chép đúng hình
  dạng đó: `InlineAlert action={{label: 'Thử lại với ngưỡng thấp hơn', ...}}`
  rồi một hàng flex bên dưới chứa hai `<Button variant="secondary" size="sm">`
  cho "Tải lên bản vẽ rõ hơn" và "Bỏ qua tầng đó", cộng mã kỹ thuật
  (`font-mono text-[12px] text-text-muted`, xem `ProcessingScreen.tsx:238`).
- `title` là optional (dòng 11) — dùng cho câu tiêu đề ngắn; `message` bắt
  buộc — dùng cho câu nguyên nhân dài hơn.

## 2. `Pipeline` / `PipelineStepper` — `src/components/feedback/PipelineStepper.tsx`

Hai API cùng tồn tại: đối tượng gộp `Pipeline.Root` / `Pipeline.Step` (mới,
namespace, dòng 187-190) và `PipelineStepper` legacy (dòng 194-202, chỉ nhận
`{ steps }` rồi tự bọc bằng `Pipeline.Root`).

```ts
// dòng 13
export type PipelineStepStatus = 'queued' | 'running' | 'done' | 'failed';

// dòng 15-24
export interface PipelineStepData {
  id: string;
  name: string;
  status: PipelineStepStatus;
  progress: number;
  eta_seconds?: number;
  errorCode?: string; // ví dụ "SEG-2041"
  errorMessage?: string; // ví dụ "Không thể đọc dữ liệu do ảnh quá mờ"
  onRetry?: () => void;
}

// dòng 26-28
export interface PipelineStepperProps {
  steps: PipelineStepData[];
}

// dòng 55-57
export interface PipelineStepProps {
  step: PipelineStepData;
}

// dòng 160-162
export interface PipelineRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}
```

- Một bước `failed` đã tự vẽ sẵn `errorMessage` + `errorCode` (uppercase, đúng
  A6) + nút "Thử lại" khi có `onRetry` (dòng 119-134) — **đây chính là khuôn
  mẫu lỗi-trong-bước đã có sẵn**, nhưng nó là lỗi ở MỘT bước trong danh sách
  dọc, khác với S-11 (khối violation rộng hết cột thay hẳn phần đầu). Không
  dùng lại component này cho khối alert chính — chỉ tham khảo màu/token nó
  dùng (`text-state-violation-text`, `text-state-violation`, dòng 74-75).
- `Pipeline.Root` cố định `max-w-md` (dòng 169) — nếu S-11 cần Pipeline chạy
  full-width trong cột trái 60%, phải truyền `className` ghi đè qua `cn()`
  (dòng 42-47 của `InlineAlert.tsx` cho thấy cùng kiểu `cn(...)` hợp lệ), ví
  dụ `<Pipeline.Root className="max-w-none w-full">`.

## 3. `Button`, `Badge`, `IconButton` — `src/components/ui/`

**Button** (`Button.tsx:6-19`, biến thể tại `buttonVariants.ts:6-26`):

```ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;   // 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: ButtonSize;         // 'sm' | 'md' | 'lg'
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
  icon?: React.ReactNode;    // @deprecated, dùng iconBefore
  iconOnly?: boolean;
  loading?: boolean;
  shortcut?: string;
  fullWidth?: boolean;
}
```

`sm` = `h-8 px-3 text-sm` (`buttonVariants.ts:14`) — đúng cỡ `ProcessingScreen`
dùng cho mọi nút hành động phụ (`RETRY_LABEL`, `SUPPORT_LABEL`, xem
`ProcessingScreen.tsx:110-120,232,239`). Dùng `size="sm"` cho ba nút hướng đi
tiếp của S-11 để đồng bộ với khung S-10.

**Badge** (`Badge.tsx:9-16`):

```ts
type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
  noDot?: boolean; // ẩn chấm tròn đầu badge
}
```

Dùng `variant="violation"` cho badge "Lần thử 2" nếu cần huy hiệu nhỏ; nếu chỉ
là chữ thường thì dùng `<span className="text-[13px] text-text-secondary">`
như `ProcessingScreen.tsx:109` (`formatETA`) đang làm — không bắt buộc phải là
Badge.

**IconButton** (`IconButton.tsx:6-16`):

```ts
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;      // BẮT BUỘC
  isActive?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg'; // 32 | 36 | 40 px
  tooltip?: boolean;         // mặc định true, hiện tooltip khi hover
}
```

Nút sao chép của S-11 (nếu icon-only) chép đúng khuôn
`ProcessingLogPanel.tsx:79-84`: `IconButton` với `icon={<Copy .../>}`,
`aria-label` đổi động giữa nhãn "Sao chép chi tiết kỹ thuật" (label mặc định)
và "Đã sao chép" (700ms sau khi bấm, dùng `AMBIENT_LOOP_MS` — mục 0.2). Nếu
cần chữ hiện luôn (không icon-only) thì dùng `Button size="sm" variant="ghost"`
đổi `children` giữa hai nhãn đó, cùng cơ chế timeout.

## 4. `Table` — CẢNH BÁO: `Table.Row` KHÔNG an toàn với R-72

`src/components/ui/Table.tsx:79-127`. `TableRow` vẽ vòng focus bằng **state
prop** `focused` chứ không phải `focus-visible:`:

```ts
// dòng 71-77
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;
  isAttention?: boolean;
  isFlash?: boolean;
  layoutId?: string;
}
```

```
// dòng 89 — vòng focus lái bằng prop, không phải :focus-visible
focused && 'ring-2 ring-inset ring-accent',
```

Đây là lỗi đã biết, xác minh lại **2026-08-25** (khi dựng `ProjectSettings`) và
**2026-08-30** (khi dựng `PipelineGraph`, bảng so sánh 4 dòng → 4 lỗi):
`expectAccessible` báo "tắt viền tiêu điểm mặc định mà không thay bằng cái
khác", một lỗi cho mỗi `<tr>` dựng qua `Table.Row`. `R-68` cấm sửa
`src/components/**` khi đang dựng màn, nên **không sửa `Table.tsx`**.

**Kết luận cho S-11:** đặc tả gọi khối "Kết quả đã có" và "dải tầng" — cả hai
đều là danh sách ĐỌC (không có hàng chọn được), không cần ngữ nghĩa bảng thật.
**Không dùng `Table` ở màn này.** Khuôn đã có sẵn ngay trong `ProcessingScreen`
chính là câu trả lời: `ProcessingFloorObjectRows`
(`ProcessingScreen.tsx:157-177`) vẽ một `<ul aria-label="…">` chứa `<li
className="flex items-baseline justify-between gap-3 border-b
border-border-default py-2 text-[13px] last:border-b-0">` cho mỗi dòng — dùng
đúng khuôn này cho "Kết quả đã có" (nhãn bước bên trái, số/badge bên phải).
Nếu vẫn cần khung bảng tĩnh (không hàng chọn được), `Table.Root` /
`Table.Header` / `Table.Body` / `Table.Head` / `Table.Cell` **an toàn** — chỉ
riêng `Table.Row` là vấn đề; có thể render `<tr>` thường bên trong
`Table.Body` thay vì gọi `Table.Row` (đúng gợi ý trong memory: *"render một
`<tr>` thường và giữ `Table.Root`/`Header`/`Body`/`Head`/`Cell`"*).

## 5. `EmptyState`, `Skeleton` — `src/components/feedback/`

```ts
// EmptyState.tsx:6-15
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void; variant?: ButtonProps['variant'] };
}
```

`action` ở đây CŨNG chỉ một nút — cùng giới hạn như `InlineAlert` (mục 1).

```ts
// Skeleton.tsx:4-8
export type SkeletonPreset = 'table-row' | 'project-card' | 'property-panel' | 'canvas';
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  preset: SkeletonPreset;
}
```

`ProcessingScreen.tsx:184-190` dùng `preset="table-row"` × 4 cho trạng thái
`loading` — chép đúng số lượng và preset đó cho `loading` của S-11 nếu màn này
tự có bảy trạng thái riêng (xem mục 7).

## 6. Thang chuyển động — `src/lib/motion/tokens.ts`

```ts
// dòng 59-67
export type MotionDurationName = 'instant' | 'fast' | 'standard' | 'slow';
export const MOTION_DURATIONS_MS: Readonly<Record<MotionDurationName, number>> = Object.freeze({
  instant: 120,
  fast: 180,
  standard: 260,
  slow: 340,
});

// dòng 87 — giá trị thứ năm, CHỈ cho pha lặp/flash, không phải chuyển động
export const AMBIENT_LOOP_MS = 700;

// dòng 102-109 — cách gọi đúng, không viết số thẳng
export function durationMs(name: MotionDurationName, options?: ReducedMotionOption): number;
export function cssDurationMs(name: MotionDurationName, options?: ReducedMotionOption): string;
export function durationSeconds(name: MotionDurationName, options?: ReducedMotionOption): number;
```

Nhập đúng: `import { AMBIENT_LOOP_MS, durationMs } from '@/lib/motion/tokens';`
(hoặc `'@/lib/motion'` nếu module có barrel — xem cách `PipelineStepper.tsx:8`
nhập `durationMs` từ `'../../lib/motion'`). Hai chuyển động 240ms trong đặc tả
gốc dùng `durationMs('standard')` / lớp Tailwind `duration-260` — **không viết
`260` hay `0.26` trực tiếp trong JSX/style**, `local/no-raw-duration` chặn cả
hai (`eslint-rules/no-raw-duration.js:26-40`).

## 7. Token màu, bo góc, đệm — `tailwind.config.ts`

Không có mã màu thô ở tầng giao diện (A1). Toàn bộ màu là custom property qua
lớp Tailwind, khai tại `tailwind.config.ts:22-84`. Lớp cần cho S-11:

| Ý nghĩa | Lớp Tailwind | Nguồn |
|---|---|---|
| Nền khối alert (violation, nhạt) | `bg-state-violation-tint` | `tailwind.config.ts:61` |
| Viền khối alert | `border-state-violation` | `tailwind.config.ts:61` |
| Chữ trong khối alert | `text-state-violation-text` | `tailwind.config.ts:61` |
| Icon trong khối alert | `text-state-violation` | `tailwind.config.ts:61` |
| Nền khung ngoài màn | `bg-bg-app` | `tailwind.config.ts:34`, dùng ở `ProcessingScreen.tsx:214` |
| Nền panel/card chìm (khối "Kết quả đã có" nếu cần nền riêng) | `bg-bg-sunken` | `tailwind.config.ts:36`, dùng ở `Skeleton.tsx:15`, `Table.tsx:51` |
| Viền mặc định | `border-border-default` | `tailwind.config.ts:43`, dùng khắp `ProcessingScreen.tsx` |
| Chữ chính / phụ / mờ | `text-text-primary` / `text-text-secondary` / `text-text-muted` | `tailwind.config.ts:45-49` |

**Không có token bo góc/đệm riêng đặt tên "12"/"20"** — `tailwind.config.ts`
không `extend.borderRadius` hay `extend.spacing`, nên dự án dùng thẳng thang
mặc định của Tailwind: `rounded-xl` = 12px (đúng giá trị `Pipeline.Root` đang
dùng, `PipelineStepper.tsx:169`, và `InlineAlert` dùng `rounded-[8px]` = 8px
cho khối nhỏ hơn — dòng 43), `p-5` = 20px. Dùng `rounded-xl` (không phải
`rounded-[12px]`) và `p-5` (không phải `p-[20px]`) — lớp có tên luôn được ưu
tiên hơn arbitrary value cùng giá trị, tránh việc mai sau đổi thang mặc định
mà chỗ này lệch đi.

## 8. Khung màn S-10 `ProcessingScreen` — chép để dựng S-11

Đọc từ `src/screens/pipeline/ProcessingScreen/ProcessingScreen.tsx`. **Đây là
view thuần (mục D)** — không api, không store, không domain, không http; mọi
câu tiếng Việt và số đã định dạng xong đều đến từ props (dòng 1-40 mô tả kỹ).

- **Khung ngoài** (dòng 213-215):
  ```
  <div className="min-h-screen bg-bg-app">
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-8">
  ```
  Bề rộng tối đa `1280px`, canh giữa (`mx-auto`), nền `bg-bg-app`, đệm ngoài
  `p-8`, các khối con cách nhau `gap-6`.

- **Breadcrumb + hàng hành động** (dòng 216-223):
  ```
  <div className="flex flex-wrap items-center justify-between gap-4">
    <nav aria-label={BREADCRUMB_PIPELINE} className="text-[13px] text-text-secondary">
      <span>{BREADCRUMB_PROJECTS}</span>
      <span aria-hidden="true"> › </span>
      <span className="text-text-primary">{BREADCRUMB_PIPELINE}</span>
    </nav>
    <ProcessingActions {...props} />
  </div>
  ```
  `BREADCRUMB_PROJECTS = 'Dự án'`, `BREADCRUMB_PIPELINE = 'Xử lý'` (dòng
  59-60). Dấu phân cách là `›` bọc `aria-hidden`.

- **Vị trí InlineAlert lỗi** — đúng khuôn cần chép cho S-11 (dòng 229-244):
  ```
  {errorAlert !== undefined ? (
    <div className="flex flex-col gap-2">
      <InlineAlert
        action={{ label: RETRY_LABEL, onClick: errorAlert.onRetry }}
        level="violation"
        message={errorAlert.message}
        title={errorAlert.title}
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[12px] font-medium text-text-muted">
          {errorAlert.technicalCode}
        </span>
        <Button onClick={errorAlert.onGoToSupport} size="sm" variant="ghost">
          {SUPPORT_LABEL}
        </Button>
      </div>
    </div>
  ) : null}
  ```
  Khối này nằm **ngay sau** hàng breadcrumb/hành động và **ngay trước**
  `ProcessingFloorChips` (dòng 246). Mã kỹ thuật nhỏ, `font-mono text-[12px]`,
  màu `text-text-muted` — đúng yêu cầu "mã lỗi có mặt nhưng phải nhỏ" (mục CẤM
  TUYỆT ĐỐI). S-11 chép chính xác vị trí và lớp này; chỗ khác là thêm hai nút
  hướng-đi-tiếp còn lại vào cùng hàng flex đó (mục 1).

- **Dải chip tầng** chạy ngang, nằm dưới khối alert, trên cả hai cột (dòng 246,
  component `ProcessingFloorChips`, file anh em `ProcessingFloorChips.tsx`) —
  không đổi khi dựng S-11, chỉ dùng lại.

- **Chia cột trái/phải** (dòng 198-211):
  ```
  <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
    <div className="lg:w-[60%]">
      {/* ProcessingStepBar hoặc ProcessingStepList, rồi ProcessingFloorObjectRows */}
    </div>
    <div className={clsx('lg:w-[344px]', BOTTOM_SHEET_CLASSES, !isSheet && BOTTOM_SHEET_RESET_AT_DESKTOP)}>
      {/* ProcessingPanels — hai tab Xem trước / Nhật ký */}
    </div>
  </div>
  ```
  Cột trái `60%`, cột phải cố định `344px` trên desktop; dưới `1024px` (`isSheet`
  = `isCompact || state === 'collapsed'`) cột phải biến thành tấm trượt đáy
  (`BOTTOM_SHEET_CLASSES`, dòng 85-88). **Worker view thay phần ĐẦU cột trái**
  (dòng 199-206, ngay trước `ProcessingStepList`/`ProcessingStepBar`) bằng
  `InlineAlert` mức `violation` rộng hết cột — tức là InlineAlert nằm TRONG
  `<div className="lg:w-[60%]">`, phía trên cây bước, chứ không phải thay thế
  khối alert đầu trang (dòng 229-244) vốn đã có sẵn cho lỗi cấp-toàn-màn. Đọc
  kỹ đặc tả gốc của S-11 để xác nhận InlineAlert đặt ở đầu cột trái (thay thế
  phần đầu, không phải toàn bộ cột) trước khi dựng — nếu mơ hồ, hỏi điều phối
  viên thay vì đoán.

- **Bảy trạng thái (A11)** — bảng đầy đủ ở đầu file (dòng 18-29): `loading`,
  `empty`, `partial`, `error`, `success`, `forbidden`, `collapsed`. Không
  nhánh nào trả `null` — breadcrumb, hàng hành động, dòng tóm tắt luôn vẽ.
  S-11 nên theo đúng khuôn này nếu tự có state machine riêng.

## 9. `src/i18n/vi.json` — khối `pipelineFailure` đã thêm

`expectVietnamese` (`src/lib/testing/expectVietnamese.ts:81,393-400`) đọc
**mọi chuỗi** trong `vi.json` đệ quy qua `collectBundleStrings`
(dòng 350-361) — không quan tâm hình dạng khoá, chỉ gom giá trị string để làm
từ điển "biết tốt". Đã thêm khoá gốc `pipelineFailure` (đặt cạnh
`processingScreen`, trước `scaleCalibration`) với các nhóm con:

- `alert` — tiêu đề/nội dung/mã lỗi của khối violation chính (Tầng 03,
  SEG-2041).
- `actions` — ba nhãn hướng đi tiếp + câu cảnh báo bỏ qua tầng.
- `keptResults` — câu "đã giữ lại" + ba dòng bước đã xong (tiền xử lý, nhận
  diện cửa/nội thất, đọc kích thước).
- `attempt` — "Lần thử 2" + câu gợi ý báo hỗ trợ sau 3 lần thất bại.
- `technicalDetail` — nhãn khối gấp, nút thử lại bước, nhãn nút sao chép +
  trạng thái đã sao chép, nút báo lỗi cho hỗ trợ.
- `floorErrors` — bốn ví dụ lỗi theo tầng (Tầng 01 đọc kích thước, Tầng 02
  nhận diện cửa/nội thất, Tầng 03 tách tường — ca chính, Tầng 04 tiền xử lý),
  đáp ứng yêu cầu "cả bốn tầng lỗi".
- `state` — bảy trạng thái A11 (empty/loading/partial/error/success/
  forbidden/collapsed) cho riêng khối lỗi này, cùng khuôn với
  `scaleCalibration.state` (`vi.json:1007-1025`).

Toàn bộ câu **viết thường kiểu câu, không chủ ngữ là người dùng** (A6 + mục
CẤM TUYỆT ĐỐI). Worker dựng hook/view đọc thẳng từ khoá này thay vì viết chuỗi
tiếng Việt mới; nếu cần thêm khoá, đó vẫn là việc của T4 — không worker nào
khác được sửa `vi.json`.
