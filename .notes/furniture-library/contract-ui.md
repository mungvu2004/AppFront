# T4 — Hợp đồng props của `FurnitureLibraryPanel` + khảo sát component dùng chung

Task nền móng Lớp 1. Không đọc mã của bất cứ task Lớp 2 nào; hợp đồng dưới đây suy
thẳng từ đặc tả bố cục trong TASK. Hai task Lớp 2 (hook `useFurnitureLibraryPanel`,
view `FurnitureLibraryPanel`) PHẢI chép nguyên văn các interface ở mục 3 — không đổi
tên trường.

Đã xác minh trước khi viết:
- `--bg-sunken` / `--bg-selected` có thật — `src/styles/globals.css:92,117,152,177`,
  lộ ra Tailwind ở `tailwind.config.ts:36,39`.
- `MOTION_DURATIONS_MS` (`src/lib/motion/tokens.ts:62-67`) chỉ cho 120/180/260/340,
  cộng `AMBIENT_LOOP_MS = 700` cho vòng lặp (không phải chuyển cảnh).
- `UNDO_WINDOW_MS = 8000` — `src/lib/mutations/undoTicket.ts:18` (chưa dùng trong hợp
  đồng này — panel không có hành động hoàn tác qua toast, chỉ có hộp xem trước trước
  khi áp, xem mục 4).

---

## 1. Khảo sát component dùng chung (mục 2A)

### `Input` — `src/components/ui/Input.tsx:5-15`
```ts
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: React.ReactNode | undefined;
  error?: React.ReactNode | undefined;
  hint?: React.ReactNode | undefined;
  prefix?: React.ReactNode | undefined;
  suffix?: React.ReactNode | undefined;
  isLoading?: boolean | undefined;
  isReadOnly?: boolean | undefined;
  wrapperClassName?: string | undefined;
  flash?: boolean | undefined;
}
```
- Bắt buộc: không có trường nào bắt buộc riêng — nó là `input` HTML mở rộng, nên
  `value`/`onChange` đến từ `InputHTMLAttributes`.
- Dùng được cho **ô tìm trên cùng**: `prefix={<Search />}`, `placeholder="Tìm nội
  thất…"`, `value`/`onChange` nối tới `searchQuery`/`onSearchQueryChange`.
- Nhận `aria-label` qua spread `InputHTMLAttributes` — CÓ, nhưng ô tìm có `label` thị
  giác thì không bắt buộc `aria-label` (label ẩn `sr-only` cũng được — xem
  `expectAccessible`).
- Bẫy: vòng focus dùng `focus-within:ring-2 … focus-within:animate-focus-ring`
  (dòng 69) — đây là pseudo-class CSS thật (`:focus-within`), KHÔNG phải state React,
  nên không rơi vào bẫy đã ghi ở memory ("Slider/Textarea/Table.Row focus ring blocks
  R-72"). An toàn dùng.

### `Badge` — `src/components/ui/Badge.tsx:9-16`
```ts
type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
  noDot?: boolean;
}
```
- Bắt buộc: `variant`, `children`. Không nhận `aria-label` riêng nhưng kế thừa
  `HTMLAttributes<HTMLSpanElement>` nên `aria-label`/`aria-hidden` truyền qua spread
  vẫn được — dùng `noDot` + text ngắn cho "viên thuốc nhỏ" đánh dấu model đã dùng
  trong dự án (ví dụ `<Badge variant="neutral" noDot>Đã dùng</Badge>` định vị
  `absolute` trên góc thẻ 128×128 bởi view).
- Bốn variant CHỈ khớp bộ ba màu trạng thái A4 (`verified/attention/violation`) cộng
  `neutral` — không có variant thứ năm khả dụng cho "viên thuốc" nếu cần một tông
  riêng; dùng `neutral` là lựa chọn đúng (không phải trạng thái xác minh, không phải
  cảnh báo).
- Không phải component ô đếm dạng "sofa (4)" của mục "Đã phát hiện" — con số đếm nằm
  ngay trong chuỗi label do hook định dạng sẵn (A15), không tách riêng vào `Badge`.

### `Tooltip` — `src/components/ui/Tooltip.tsx:19-25`
```ts
export interface TooltipProps {
  label: string;
  kbd?: string;
  children: React.ReactElement;
  disabled?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
}
```
- Bắt buộc: `label` (string), `children` (một phần tử React DUY NHẤT — không mảng).
- Dùng cho caption dung lượng tệp/kích thước trên thẻ khi bị cắt (`truncate`), hoặc
  cho nút "Thay thế tất cả" chìm — bọc quanh phần tử kích hoạt.
- Không nhận `aria-label` — bản thân nó đã gắn `aria-describedby` cho `children` và
  `role="tooltip"` cho nội dung nổi (dòng 149, 109). An toàn `expectAccessible`.
- Độ trễ hiện `TOOLTIP_DWELL_MS = 400` (dòng 14) là hằng số ĐÃ ĐẶT TÊN, không phải số
  viết tay vi phạm R-71/B — đây là *dwell time* (thời gian chờ trước khi chuyển động
  bắt đầu), không phải một *thời lượng chuyển động*, nên nó KHÔNG nằm trên thang năm
  giá trị và không cần sửa.

### `IconButton` — `src/components/ui/IconButton.tsx:6-16`
```ts
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;   // BẮT BUỘC
  isActive?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: boolean;
}
```
- `aria-label` là trường BẮT BUỘC theo kiểu (dòng 9) — không thể quên, TypeScript
  chặn. Dùng cho nút đóng hộp xem trước "Thay thế tất cả", nút xoá ô tìm (nếu có).
- **Bẫy**: `aria-label` phải là câu tiếng Việt có dấu — một nhãn tiếng Anh (`"Close"`)
  đỏ ngay ở `expectVietnamese` (soát cả thuộc tính `aria-label`, xem
  `expectVietnamese.ts:71,139`).
- Vòng focus: `focus-visible:ring-2 … focus-visible:animate-focus-ring` (dòng 38) —
  đúng `:focus-visible`, an toàn.

### `Button` — `src/components/ui/Button.tsx:6-19`
```ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; size?: ButtonSize;
  iconBefore?: React.ReactNode; iconAfter?: React.ReactNode;
  icon?: React.ReactNode; // @deprecated dùng iconBefore
  iconOnly?: boolean; loading?: boolean; shortcut?: string; fullWidth?: boolean;
}
```
- Không trường nào bắt buộc ngoài `children` (khi không `iconOnly`) — kế thừa từ
  `ButtonHTMLAttributes`.
- Dùng cho nút phụ chân panel "Tải lên model" (`variant="ghost"` hoặc `"secondary"`,
  hook Lớp 2 chọn) và nút "Thay thế tất cả" trong hộp xem trước, nút "Xoá bộ lọc" ở
  trạng thái rỗng có thể là `Button variant="ghost" size="sm"` thay vì một `<a>` trần.
- Không có bẫy accessibility riêng — `aria-label` không bắt buộc vì luôn có
  `children` làm tên.

### `Skeleton` — `src/components/feedback/Skeleton.tsx:4-8`
```ts
export type SkeletonPreset = 'table-row' | 'project-card' | 'property-panel' | 'canvas';
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  preset: SkeletonPreset;
}
```
- **KHÔNG DÙNG ĐƯỢC**: bốn preset đã đóng cứng kích thước/khung riêng cho bảng, thẻ
  dự án, panel thuộc tính, canvas — không preset nào là ô vuông 128×128. Spec cấm tạo
  component mới, và `Skeleton` không có "preset mở" (không nhận `className` để đổi
  kích thước gốc theo cách an toàn — nó set `w-full h-32` v.v. cứng theo preset).
  → **Đề xuất**: view tự dựng 8 ô khung xương bằng phần tử HTML thuần:
  `<div className="h-32 w-32 rounded-xl bg-bg-sunken animate-pulse
  motion-reduce:animate-none" aria-hidden="true" />`, đúng token và đúng lớp
  `animate-pulse` (đã hiệu chỉnh về nhịp hợp lệ trong `tailwind.config.ts`, xem
  ghi chú trong chính `Skeleton.tsx:11-14`) — không mượn component, không thêm preset
  thứ năm vào file bị cấm sửa (`src/components/feedback/**`).

### `EmptyState` — `src/components/feedback/EmptyState.tsx:6-15`
```ts
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode; title: string; description: string;
  action?: { label: string; onClick: () => void; variant?: ButtonProps['variant']; };
}
```
- Bắt buộc: `icon`, `title`, `description`. Đúng khuôn `PropertyInspectorCrashFallback`
  đã dùng (T8/mục D) — dùng được nguyên vẹn cho trạng thái `empty` ("không model nào
  khớp bộ lọc") VÀ cho phần dự phòng khi `ScreenErrorBoundary` sập (R-62).
- Chỉ có MỘT `action` (một nút) — không có chỗ cho hai liên kết ("Xoá bộ lọc" +
  "sang thư viện rỗng S-38") cùng lúc trên một `EmptyState`. Hai biến thể của trạng
  thái rỗng (mục 3, `FurnitureLibraryPanelEmptyState`) vì vậy KHÔNG dùng chung một
  lần gọi `EmptyState` — view chọn `action` khác nhau theo `variant`, không gọi
  `EmptyState` hai lần chồng nhau.
- Không nhận `aria-label` riêng nhưng `title`/`description` là text nên
  `expectAccessible` không cần nó.

### `Toast` — `src/components/feedback/Toast.tsx`
- **KHÔNG dùng trong hợp đồng này.** Panel không có luồng "hoàn tác qua toast" —
  "Thay thế tất cả" là một thao tác XEM TRƯỚC RỒI ÁP, không phải áp ngay rồi cho
  hoàn tác trong `UNDO_WINDOW_MS`. `ToastMessage`/`useToast` vẫn có thể được MÀN CHA
  (ngoài phạm vi panel) dùng sau khi áp xong để báo "Đã thay thế N mục", nhưng đó là
  quyết định của hook/container Lớp 2, không phải của props view — không khai trong
  hợp đồng.

### `src/components/motion/**` — cửa DUY NHẤT nhập `framer-motion`
```ts
export { motion, AnimatePresence, useAnimation } from 'framer-motion';
export function MotionProvider({ children }: MotionProviderProps): ReactNode;
```
(`src/components/motion/index.ts:44,67`)
- View KHÔNG tự gọi `useReducedMotion()` — `MotionProvider` đã đặt
  `reducedMotion="user"` một lần cho toàn ứng dụng (dòng 50-61), nên MỌI
  `motion.div`/`AnimatePresence` trong `FurnitureLibraryPanel` tự tắt chuyển động khi
  hệ điều hành bật giảm chuyển động — không cần một prop `reducedMotion` riêng trong
  hợp đồng.
- Với thứ KHÔNG chạy qua framer (stagger delay của lưới thẻ, xem mục 2), hook PHẢI tự
  gộp điều kiện qua `useMotionConditions()` (`src/hooks/useMotionConditions.ts:23-30`)
  rồi truyền `MotionConditions` xuống `staggerDelaysMs`/`staggerSchedule` — đây là
  việc của Lớp 2 khi VIẾT HOOK, không phải của view; view chỉ nhận từng
  `delayMs`/`durationMs` đã tính sẵn qua props (mục 2D).
- View dùng chuyển động qua đúng hai cửa: `motion`/`AnimatePresence` từ
  `@/components/motion` (cho fade lưới khi lọc, xoay ảnh xem trước, nháy chọn) và
  `durationSeconds`/`cssDurationMs` từ `@/lib/motion` (cho số mili-giây/giây truyền
  vào `transition`).

---

## 2. Khuôn sáu file (mục 2B) — đọc từ `PropertyInspector/` + `CreateProjectModal/`

**`index.ts`** (`PropertyInspector/index.ts:20-26`) xuất đúng ba nhóm: view thuần
(`PropertyInspector`), container đã nối dây (`PropertyInspectorContainer` +
`PROPERTY_INSPECTOR_SCREEN_ID`), hook nửa-suy-nghĩ (`usePropertyInspector`), cộng mọi
hằng số/kiểu dùng chung của `*Types.ts`. `FurnitureLibraryPanel/index.ts` (Lớp 2) phải
theo đúng khuôn này: `export { FurnitureLibraryPanel } from './FurnitureLibraryPanel';
export { FurnitureLibraryPanelContainer, FURNITURE_LIBRARY_PANEL_SCREEN_ID } from
'./FurnitureLibraryPanel.container'; export { useFurnitureLibraryPanel } from
'./useFurnitureLibraryPanel'; export { ...types... } from
'./furnitureLibraryPanelTypes';` — lý do nêu ở docblock của file đó (mục D: khi view
vượt trần 400 dòng của R-22, phần con tách file anh em mà không nơi gọi nào phải sửa.

**View nhận props ra sao** (`PropertyInspector.tsx:184-187`): ĐÚNG MỘT trường bắt
buộc là `state` (discriminated union bảy nhánh theo `kind`) cộng một trường tuỳ chọn
phẳng (`recentlyCommittedRowId`) — không có prop `roles`/`canEdit` rời rạc, không có
`isLoading`/`data`/`error` ba trường tách biệt. `FurnitureLibraryPanelProps` ở mục 3
theo đúng hình dạng này.

**Container bọc `ScreenErrorBoundary` thế nào** (R-62,
`PropertyInspector.container.tsx:78-126`, `CreateProjectModal.container.tsx:132-180`):
- Một hàm `XxxCrashFallback({ report, retry })` dựng bằng `EmptyState` từ
  `report.description.{title,description,primaryButtonLabel}`, nút "thử lại" CHỈ hiện
  khi `report.retryable` (spread có điều kiện, không truyền `action: undefined`).
- Một hằng `XXX_SCREEN_ID` viết một lần (R-71), dùng làm `screenId` của
  `ScreenErrorBoundary` VÀ export ra `index.ts` cho ai cần nhật ký/kiểm thử.
- Container không tự quyết `canEdit`/vai — nó tự đọc `useSession().roles` rồi tính qua
  cổng phân quyền dùng chung `can(action, resource, { roles })`
  (`@/lib/auth/permissions.ts:127`), giống hệt cách `PropertyInspector.container.tsx:102`
  đã làm cho `can('edit', 'layer', …)`. Container KHÔNG nhận `canUploadModel` như một
  prop từ màn cha — nó tự tính rồi truyền xuống hook (xem mục 3, `canUploadModel` nằm
  trong `UseFurnitureLibraryPanelOptions`, KHÔNG nằm trong
  `FurnitureLibraryPanelContainerProps`).
- Panel không viền/không bóng khi sập (`PropertyInspectorCrashFallback` dòng 78-91) —
  chỉ nền `bg-bg-surface` lấp đúng khung được cấp.

**Stories khai bảy trạng thái ra sao** (`PropertyInspector.stories.tsx`):
- Một hàm `argsFor(state: SevenState): XxxProps` DÙNG CHUNG giữa story và test
  (R-70) — dữ liệu bảy kịch bản sống trong một file `*Scenarios.ts` riêng
  (`propertyInspectorScenarios.ts`), không viết tay trong `.stories.tsx`.
- **CẢNH BÁO CSF phải né**: `PANEL_FRAME_CLASS` (hằng số) và `argsFor` (hàm) là hai
  export KHÔNG PHẢI story — thiếu `meta.excludeStories: ['PANEL_FRAME_CLASS',
  'argsFor']` thì Storybook nhận nhầm chúng là story và TRẮNG CẢ FILE (dòng 43-45).
  `FurnitureLibraryPanel.stories.tsx` (Lớp 2) phải khai `excludeStories` tương tự cho
  mọi hằng/hàm non-story nó export.
- Bảy story đặt tên tiếng Việt không dấu kiểu biến (`Rong`, `DangTai`, `MotPhan`,
  `Loi`, `Xong`, `KhongCoQuyen`, `ThuGon`) — đúng bảy tên biến ứng với bảy `kind`.

**Test gọi bốn bộ khẳng định dùng chung ra sao**
(`PropertyInspector.test.tsx:58-68`): import cả bốn — `expectAccessible`,
`expectNoRawColor`, `expectSevenStates`, `expectVietnamese` — cộng
`createSevenStateScenarios`/`SEVEN_STATES`/`SEVEN_STATE_LABELS` từ
`@/lib/testing/sevenStateScenarios`. `expectSevenStates` đối chiếu
`FurnitureLibraryPanelStateKind` (suy ra từ chính union, không gõ lại bảy chuỗi) với
bảng `SEVEN_STATES` — bảy chuỗi PHẢI khớp y hệt: `'empty' | 'loading' | 'partial' |
'error' | 'success' | 'forbidden' | 'collapsed'`.

---

## 3. Hợp đồng props (mục 2C — SẢN PHẨM CHÍNH)

Nguyên văn TypeScript, biên dịch được (đặt trong
`furnitureLibraryPanelTypes.ts` khi Lớp 2 dựng màn — file `.ts` thuần, không JSX,
không import `@/api`/`@/store`/`@/domain`/`@/lib/http`, đúng khuôn
`propertyInspectorTypes.ts`):

```ts
import type { MotionConditions } from '@/lib/motion';

/* -------------------------------------------------------------------------- */
/* Layout cố định — một nguồn số duy nhất (R-71), local/no-raw-number không     */
/* canh hằng số đặt tên ở đây, chỉ canh số thô ở tầng view.                     */
/* -------------------------------------------------------------------------- */

export const FURNITURE_LIBRARY_PANEL_LAYOUT = Object.freeze({
  /** Bề rộng panel trái, cố định — khớp `SIDE_PANEL_WIDTHS_PX.compact` của
   * `@/lib/motion` (280px), không phải một số 280 viết tay thứ hai. */
  panelWidthPx: 280,
  /** Dưới ngưỡng khung nhìn này, panel đổi hẳn thành tấm trượt đáy. */
  collapsedBreakpointPx: 1024,
  /** Chiều cao tấm trượt đáy ở biến thể thu gọn. */
  collapsedSheetHeightPx: 240,
  /** Cạnh vuông của một thẻ model trong lưới hai cột. */
  cardSizePx: 128,
  /** Khe giữa các thẻ trong lưới. */
  gridGapPx: 12,
  /** Bo góc thẻ. */
  cardRadiusPx: 12,
  /** Số cột cố định của lưới — không co giãn theo bề rộng. */
  gridColumns: 2,
  /** Số thẻ khung xương ở trạng thái `loading` — đúng kích thước thẻ thật. */
  loadingSkeletonCount: 8,
} as const);

/* -------------------------------------------------------------------------- */
/* Chín nhóm chip cố định, đúng thứ tự hiển thị.                                */
/* -------------------------------------------------------------------------- */

export const FURNITURE_CATEGORY_IDS = [
  'all',
  'table',
  'chair',
  'bed',
  'sofa',
  'cabinet',
  'sanitary',
  'kitchen',
  'equipment',
  'mine',
] as const;

export type FurnitureCategoryId = (typeof FURNITURE_CATEGORY_IDS)[number];

/** Nhãn tiếng Việt của từng nhóm, viết thường kiểu câu trừ khi đầu chip (A6). */
export const FURNITURE_CATEGORY_LABELS: Readonly<Record<FurnitureCategoryId, string>> = {
  all: 'Tất cả',
  table: 'Bàn',
  chair: 'Ghế',
  bed: 'Giường',
  sofa: 'Sofa',
  cabinet: 'Tủ kệ',
  sanitary: 'Thiết bị vệ sinh',
  kitchen: 'Bếp',
  equipment: 'Thiết bị kỹ thuật',
  mine: 'Của tôi',
};

/* -------------------------------------------------------------------------- */
/* Một chip nhóm — hàng cuộn ngang, KHÔNG dùng SegmentedControl/Tabs (xem mục 4).*/
/* -------------------------------------------------------------------------- */

export interface FurnitureCategoryChip {
  readonly id: FurnitureCategoryId;
  /** Nhãn đã lấy từ `FURNITURE_CATEGORY_LABELS`, hook không để view tự tra bảng. */
  readonly label: string;
  readonly isActive: boolean;
  readonly onSelect: () => void;
}

/* -------------------------------------------------------------------------- */
/* Mục "Đã phát hiện" — ghim đầu lưới.                                          */
/* -------------------------------------------------------------------------- */

export interface DetectedFurnitureGroup {
  readonly id: string;
  /** Đã định dạng sẵn (A15), ví dụ "sofa (4)" — count đã ghép vào chuỗi ở hook. */
  readonly label: string;
  /** Hành động chìm "Thay thế tất cả" của đúng lớp YOLO này. */
  readonly onReplaceAll: () => void;
}

/* -------------------------------------------------------------------------- */
/* Một thẻ model trong lưới 2 cột.                                             */
/* -------------------------------------------------------------------------- */

export type ModelThumbnailStatus = 'ready' | 'unavailable';

export interface FurnitureModelCard {
  readonly id: string;
  readonly name: string;
  /** Đơn sắc, nền `--bg-sunken` — view không tự khử màu, ảnh ĐÃ được xử lý trước khi
   * tới props (CẤM TUYỆT ĐỐI: không ảnh thật nhiều màu, không nền ca rô). */
  readonly thumbnailUrl: string | null;
  /** `unavailable` khi ảnh xem trước không dựng được — view vẽ biểu tượng thay thế
   * trung tính, KHÔNG ảnh vỡ, và bỏ qua `thumbnailUrl`. */
  readonly thumbnailStatus: ModelThumbnailStatus;
  /** Tiếng Việt, cho `alt` — `expectVietnamese` soát cả `alt`. */
  readonly thumbnailAltText: string;
  /** Đã định dạng sẵn (A15), ví dụ "1.200 × 600 × 750 mm" — CHỮ ĐỀU (tabular). */
  readonly dimensionsLabel: string;
  /** Đã định dạng sẵn qua `formatFileSize` (A15), ví dụ "4,2 MB". */
  readonly fileSizeCaption: string;
  /** Model này đã được dùng ở đâu đó trong dự án hiện tại — viên thuốc nhỏ đánh dấu. */
  readonly isUsedInProject: boolean;
  /** Model nặng hơn ngưỡng hiệu năng cho phép — xem mục 4 (R-04 KHÔNG tìm thấy). */
  readonly isHeavy: boolean;
  /** Không có quyền / trạng thái `forbidden`: thẻ vẫn xem được nhưng không kéo được. */
  readonly isLocked: boolean;
  /** `undefined` khi `isLocked` — kéo-thả không phải một callback theo nghĩa click,
   * nhưng view cần biết CÓ ĐƯỢC bắt đầu kéo hay không trước khi gắn trình xử lý kéo
   * thật (thư viện/API kéo-thả là quyết định của Lớp 2 viết view, không khai kiểu ở
   * đây — hợp đồng chỉ nói ĐƯỢC PHÉP hay KHÔNG). */
  readonly onDragStart?: (() => void) | undefined;
  /** Bấm thẻ để xem chi tiết / chèn nhanh — luôn có, kể cả khi `isLocked`. */
  readonly onSelect: () => void;
}

/* -------------------------------------------------------------------------- */
/* Hộp xem trước "Thay thế tất cả" — luôn hiện TRƯỚC khi áp bất cứ thay đổi nào. */
/* -------------------------------------------------------------------------- */

export interface ReplaceAllPreviewItem {
  readonly id: string;
  /** Ví dụ "sofa hiện tại → Sofa góc chữ L (Của tôi)" — đã định dạng sẵn. */
  readonly description: string;
}

export interface ReplaceAllPreview {
  readonly detectedGroupId: string;
  /** Nhãn nhóm để tiêu đề hộp thoại, ví dụ "Thay thế tất cả — sofa (4)". */
  readonly groupLabel: string;
  readonly items: readonly ReplaceAllPreviewItem[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/* -------------------------------------------------------------------------- */
/* Stagger lưới — từng thẻ nhận độ trễ ĐÃ TÍNH SẴN (mục 2D).                    */
/* -------------------------------------------------------------------------- */

/** Một thẻ cộng lịch chuyển động của riêng nó — hook đã gọi `staggerSchedule`. */
export interface FurnitureModelCardMotion {
  readonly card: FurnitureModelCard;
  readonly delayMs: number;
  readonly durationMs: number;
}

/* -------------------------------------------------------------------------- */
/* Nội dung đầy đủ của panel — dùng chung cho partial/success/forbidden.        */
/* -------------------------------------------------------------------------- */

export interface FurnitureLibraryPanelContent {
  readonly searchQuery: string;
  readonly onSearchQueryChange: (nextValue: string) => void;
  readonly categoryChips: readonly FurnitureCategoryChip[];
  /** `null` khi tầng hiện tại YOLO không phát hiện lớp nào — dải "Đã phát hiện"
   * khi đó không vẽ gì thay vì vẽ ô trống. */
  readonly detectedGroups: readonly DetectedFurnitureGroup[] | null;
  readonly cards: readonly FurnitureModelCardMotion[];
  /** `null` khi không có hộp xem trước đang mở. */
  readonly replaceAllPreview: ReplaceAllPreview | null;
  /** Nút phụ chân panel "Tải lên model" — `null` khi không có quyền (kể cả ở
   * `success`/`partial`, không chỉ ở `forbidden`: quyền và trạng thái dữ liệu là
   * hai trục độc lập). */
  readonly onUploadModel: (() => void) | null;
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái — discriminated union đúng nghĩa (theo khuôn PropertyInspector).*/
/* -------------------------------------------------------------------------- */

export type FurnitureLibraryEmptyVariant = 'no-match' | 'library-empty';

/** 1. Rỗng. */
export interface FurnitureLibraryPanelEmptyState {
  readonly kind: 'empty';
  readonly variant: FurnitureLibraryEmptyVariant;
  /** Chuỗi vừa tìm, nhắc lại nguyên văn — ví dụ "sofa da". Rỗng khi không gõ gì. */
  readonly searchedFor: string;
  /** `variant: 'no-match'`: liên kết "Xoá bộ lọc". `variant: 'library-empty'`:
   * KHÔNG có trường này — điều hướng sang S-38 là việc của MÀN CHA (điều hướng route,
   * ngoài phạm vi panel), panel chỉ báo `variant` để màn cha tự quyết render gì bên
   * cạnh nó; panel không tự đổi route (R-60: view không biết route). */
  readonly onClearFilters?: (() => void) | undefined;
}

/** 2. Đang tải — N thẻ khung xương đúng `cardSizePx`. */
export interface FurnitureLibraryPanelLoadingState {
  readonly kind: 'loading';
}

/** 3. Một phần — vài ảnh xem trước không dựng được (xem `ModelThumbnailStatus`). */
export interface FurnitureLibraryPanelPartialState extends FurnitureLibraryPanelContent {
  readonly kind: 'partial';
}

/** 4. Lỗi — không tải được thư viện. */
export interface FurnitureLibraryPanelErrorState {
  readonly kind: 'error';
  readonly message: string;
  readonly onRetry: () => void;
}

/** 5. Xong. */
export interface FurnitureLibraryPanelSuccessState extends FurnitureLibraryPanelContent {
  readonly kind: 'success';
}

/** 6. Không có quyền — mọi thẻ `isLocked: true`, `onUploadModel: null`, vẫn xem được. */
export interface FurnitureLibraryPanelForbiddenState extends FurnitureLibraryPanelContent {
  readonly kind: 'forbidden';
}

/** 7. Thu gọn — tấm trượt đáy cuộn ngang, dưới `collapsedBreakpointPx`. */
export interface FurnitureLibraryPanelCollapsedState extends FurnitureLibraryPanelContent {
  readonly kind: 'collapsed';
}

export type FurnitureLibraryPanelState =
  | FurnitureLibraryPanelEmptyState
  | FurnitureLibraryPanelLoadingState
  | FurnitureLibraryPanelPartialState
  | FurnitureLibraryPanelErrorState
  | FurnitureLibraryPanelSuccessState
  | FurnitureLibraryPanelForbiddenState
  | FurnitureLibraryPanelCollapsedState;

/** PHẢI khớp đúng bảy chuỗi của `SEVEN_STATES`
 * (`src/lib/testing/sevenStateScenarios.ts:26-34`). */
export type FurnitureLibraryPanelStateKind = FurnitureLibraryPanelState['kind'];

/* -------------------------------------------------------------------------- */
/* Props chính: view, hook, container (P8, cùng khuôn PropertyInspector).       */
/* -------------------------------------------------------------------------- */

/** Toàn bộ props của `FurnitureLibraryPanel.tsx` (view thuần). */
export interface FurnitureLibraryPanelProps {
  readonly state: FurnitureLibraryPanelState;
}

/** Đúng những gì `useFurnitureLibraryPanel` trả về. */
export type UseFurnitureLibraryPanelResult = FurnitureLibraryPanelProps;

/** Tuỳ chọn container truyền vào `useFurnitureLibraryPanel`. */
export interface UseFurnitureLibraryPanelOptions {
  /** Tầng đang mở — để lọc "Đã phát hiện" theo đúng tầng (YOLO chạy theo tầng). */
  readonly floorId: string;
  /** Container tự tính qua `can('manage', 'library', { roles })` — xem mục 2. */
  readonly canUploadModel: boolean;
  readonly onModelDropped: (modelId: string, targetEntityId: string | null) => void;
  readonly onUploadModel: () => void;
}

/** Props của `FurnitureLibraryPanelContainer` — thứ MỘT MÀN KHÁC truyền vào (R-73). */
export interface FurnitureLibraryPanelContainerProps {
  readonly floorId: string;
  readonly onModelDropped: (modelId: string, targetEntityId: string | null) => void;
}
```

Ghi chú hình dạng, để hai task Lớp 2 không tự suy diễn khác nhau:

- **View không import `@/api`, `@/store`, `@/domain`, `@/lib/http` (R-60).** Mọi
  chuỗi hiển thị trong bảng trên đã định dạng sẵn ở hook (`formatLength`/`formatArea`
  của `@/lib/format/measure`, `formatFileSize` của `@/lib/format/bytes` — cả hai đều
  ở `src/lib`, hook được phép import, view thì không).
- **`dimensionsLabel` dùng CHỮ ĐỀU** — spec đòi `font-variant-numeric: tabular-nums`
  hoặc lớp Tailwind tương đương (`tabular-nums`) ở tầng VIEW (đây là CSS trình bày,
  không phải định dạng số, nên không vi phạm A15/`no-raw-number`); bản thân chuỗi
  `"1.200 × 600 × 750 mm"` đã được hook ghép sẵn bằng ba lượt gọi `formatLength` nối
  dấu `"×"`, không phải một hàm mới trong `@/lib/format`.
- **`onDragStart` không mang API kéo-thả thật.** Hợp đồng props tầng nền móng này chỉ
  khai được HÌNH DẠNG dữ liệu (`FurnitureModelCard`), không khai được cơ chế kéo-thả
  (chưa rõ thư viện/API nào phụ trách — không có trong bất kỳ file đã đọc). Theo R-69,
  đây là chỗ Lớp 2 (viết hook) phải tự tìm cơ chế kéo-thả CÓ SẴN trong repo (ví dụ
  `src/lib/input/dragDrop.ts` được nhắc ở CLAUDE.md mục A12) trước khi quyết định
  chữ ký thật của props kéo — task này KHÔNG tự chế một API kéo-thả.
- **`ReplaceAllPreview` không có `onConfirm`/`onCancel` nào tự áp thay đổi trong
  view.** Cả hai chỉ là callback thuần (P8 của PropertyInspector) — hook quyết logic
  áp, view chỉ vẽ danh sách `items` và gọi lại đúng hai hàm đó.

---

## 4. Xung đột chuyển động — đã giải quyết, KHÔNG cần hỏi điều phối viên (mục 2D)

| Yêu cầu spec màn | Slot hợp lệ dùng | Nguồn |
|---|---|---|
| Ảnh xem trước xoay chậm 30° "600ms" | `AMBIENT_LOOP_MS` (700ms) — đây là vòng lặp/chuyển động liên tục, đúng loại `AMBIENT_LOOP_MS` được đặt ra để phục vụ (skeleton sweep, progress sheen), không phải một lượt chuyển cảnh | `src/lib/motion/tokens.ts:77-87` |
| Lọc lưới bằng layout animation "240ms" | `standard` (260ms) | `MOTION_DURATIONS_MS.standard`, `tokens.ts:66` |
| Nháy `--bg-selected` "340ms" | `slow` (340ms) — đã hợp lệ, không cần đổi | `tokens.ts:66` |
| So le "60ms" mỗi mục "Thay thế tất cả" | **`staggerDelaysMs`/`staggerSchedule`** — bước thật của repo là `STAGGER_STEP_MS = 24ms`, trần `MAX_STAGGERED_ITEMS = 8` dòng, ngân sách `STAGGER_BUDGET_MS = 200ms`. KHÔNG dùng số 60 của spec — dùng đúng cơ chế đã có | `src/lib/motion/stagger.ts:49-96`, tái xuất ở `src/lib/motion/index.ts:75-86` |

**Trả lời DỨT KHOÁT cho câu hỏi bắt buộc của TASK**: repo CÓ SẴN hằng/hàm so le —
`staggerDelayMs`, `staggerDelaysMs`, `staggerSchedule`, `staggerScheduleEndMs` (đủ cả
bốn, `src/lib/motion/stagger.ts`), dùng `STAGGER_STEP_MS = 24` chứ không phải `60`
của spec màn. Vì LUAT_MAN_HINH.md xếp prompt màn DƯỚI luật (R-71: không hằng số viết
tay; chỉ nguồn duy nhất là các hằng trong `src/lib/motion`), hai task Lớp 2 dùng
`staggerSchedule(count, { duration: 'fast', ...motionConditions })` (hoặc
`staggerDelaysMs`) để tính `delayMs`/`durationMs` cho từng mục trong
`ReplaceAllPreview.items` HOẶC cho lưới thẻ chính — spec không nói rõ danh sách nào
cần so le, nên hợp đồng props để cả hai chỗ có thể nhận (`FurnitureModelCardMotion`
cho lưới; `ReplaceAllPreviewItem` KHÔNG có trường motion vì hộp xem trước là một danh
sách tĩnh trong hộp thoại, không phải một lưới đang lọc — nếu Lớp 2 xét thấy hộp xem
trước cũng cần so le, thêm `delayMs`/`durationMs` vào `ReplaceAllPreviewItem` theo
đúng cơ chế này, không viết số tay).

`no-raw-duration.js` (đã đọc toàn văn, `eslint-rules/no-raw-duration.js`) CHỈ bắt bốn
hình dạng: `duration` số trong object literal, thời lượng trong chuỗi CSS, Tailwind
arbitrary `animate-`/`duration-`/`delay-[…]`, và đối số thứ hai của
`setTimeout`/`setInterval`. Một trường object thường tên `delayMs`/`durationMs` nhận
giá trị từ `staggerDelayMs()`/`conditionedDurationMs()` KHÔNG bị luật này bắt — nó
không phải property tên `duration`, không phải chuỗi CSS, không phải arbitrary value,
không phải tham số `setTimeout`. An toàn.

**Tắt chuyển động khi giảm chuyển động**: mọi `motion.div`/`AnimatePresence` (fade
lưới, nháy chọn) tự tắt qua `MotionProvider` (`reducedMotion="user"`,
`src/components/motion/index.ts:67-69`) — view không cần API riêng. Với stagger/độ
xoay ảnh (không chạy qua framer), HOOK (không phải view) phải gọi
`useMotionConditions()` (`src/hooks/useMotionConditions.ts`) rồi truyền
`MotionConditions` vào `staggerSchedule`/`conditionedDurationMs` — kết quả
`delayMs`/`durationMs` đã LÀ 0 khi giảm chuyển động, nên view (nhận số đã tính) không
cần biết trạng thái giảm chuyển động đang bật hay tắt.

---

## 5. Điểm còn hở — KHÔNG tự chế, để lại cho Lớp 2 (R-69)

1. **"Ngưỡng R-04" cho model nặng KHÔNG tìm thấy trong repo.** Đã grep toàn bộ
   `RULE.md` (R-04 ở đó là "import dùng alias `@/`", không liên quan) và
   `LUAT_MAN_HINH.md` (chỉ có R-59→R-73, không có R-04). Ngân sách cảnh 3D gần nhất là
   `SCENE_BUDGET` (`src/lib/three/perf/budget.ts:92-99` — `maxTriangles: 900_000`,
   `maxGraphicsMemoryMb: 350`) nhưng đó là ngân sách CỦA CẢ CẢNH, không phải ngưỡng
   nặng CỦA MỘT MODEL đơn lẻ để cảnh báo trước khi kéo. Hợp đồng props ở mục 3 vì vậy
   chỉ khai `isHeavy: boolean` (đã tính sẵn) — Lớp 2 (viết hook) tự đi tìm ngưỡng thật
   sự tồn tại ở đâu đó khác (ví dụ trong `src/lib/three/present/assets.ts` hay tài
   liệu spec gốc của màn này ngoài repo); nếu không tìm thấy, đó là lúc Lớp 2 phải
   `orca orchestration ask`, không phải task này — vì hợp đồng props không phụ thuộc
   vào GIÁ TRỊ ngưỡng, chỉ phụ thuộc vào HÌNH DẠNG (`boolean`).
2. **Cơ chế kéo-thả thật** (thư viện, API bắt đầu kéo) — xem ghi chú dưới bảng ở
   mục 3. `onDragStart` trong `FurnitureModelCard` chỉ khai được rằng có/không được
   phép kéo, không khai được cách kéo.
3. **Có gộp so le vào `ReplaceAllPreviewItem` hay không** — để ngỏ, xem mục 4.
