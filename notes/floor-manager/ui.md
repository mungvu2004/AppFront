# S-16 / T3 — Khảo sát component, token, chuyển động, bộ khẳng định cho FloorManager

**Việc này CHỈ ĐỌC.** Không sửa file nguồn nào. File này là sản phẩm duy nhất được phép tạo.
Ghi cho worker Lớp 2 (T6, dựng view + story) — họ sẽ viết code CHỈ dựa vào file này.

Đã có `docs/contracts/ui.md` (viết cho màn AxisGridManager trước đó, S-15). File đó **không
được sửa** trong lượt này (ngoài whitelist) và một số phần của nó (mục H1) trùng với việc
phải xác minh ở đây; nơi trùng, tôi xác minh LẠI từ mã nguồn hiện tại (không chép nguyên).

---

## A. `src/components/ui/` — component bảng và điều khiển

### A.1 `Table.tsx` — TOÀN BỘ API (`src/components/ui/Table.tsx`)

Đây là **compound component** (`Table.Root` / `Table.Header` / `Table.Body` / `Table.Row` /
`Table.Head` / `Table.Cell` / …), KHÔNG phải component đơn. Cũng có một export mặc định
`Table` legacy (bảng đơn giản, dòng 389-398) và các named export cũ (dòng 417) để tương thích
ngược — bảng mới nên dùng compound, không dùng legacy.

Toàn bộ props, chép nguyên văn:

```ts
// dòng 14-32
interface TableContextValue {
  sortKey: string | undefined;
  sortDir: 'asc' | 'desc' | null | undefined;
  onSort: ((key: string) => void) | undefined;
}

export interface TableRootProps extends React.HTMLAttributes<HTMLDivElement> {
  sortKey?: string | undefined;
  sortDir?: 'asc' | 'desc' | null | undefined;
  onSort?: ((key: string) => void) | undefined;
}

// dòng 71-77 — TableRow (nội bộ, không export tên type nhưng props áp dụng cho Table.Row)
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;
  isAttention?: boolean;
  isFlash?: boolean;
  layoutId?: string;
}

// dòng 131-137 — Table.Head
interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
  sticky?: boolean;
}

// dòng 188-190 — Table.Cell
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean;
}

// dòng 210-213 — Table.Skeleton
interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

// dòng 232-235 — Table.Empty
interface TableEmptyProps {
  colSpan: number;
  message?: string;
}

// dòng 254-258 — Table.Error
interface TableErrorProps {
  colSpan: number;
  message?: string;
  onRetry?: () => void;
}

// dòng 279-283 — Table.CheckboxHead
interface TableCheckboxHeadProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}

// dòng 301-305 — Table.CheckboxCell
interface TableCheckboxCellProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  rowId: string;
}

// dòng 324-329 — Table.Virtual (ảo hoá thân bảng, dùng @tanstack/react-virtual)
interface TableVirtualProps<TRow extends { id: string }> {
  rows: TRow[];
  estimateSize?: number;
  renderRow: (row: TRow, virtualIndex: number) => React.ReactNode;
  colSpan: number;
}
```

Namespace object (dòng 389-413):
```ts
export const Table = Object.assign(TableLegacy, {
  Root, Header, Body, Row, Head, Cell, Skeleton, Empty, Error,
  CheckboxHead, CheckboxCell, Virtual,
});
```

**⚠️ BẪY ĐÃ BIẾT — XÁC NHẬN CÒN ĐÚNG: `Table.Row` có vòng tiêu điểm điều khiển bằng STATE, không phải
CSS.** `Table.tsx:89`:
```ts
focused && 'ring-2 ring-inset ring-accent',
```
`focused` là một **prop** (`TableRowProps.focused`), không phải `:focus-visible`. Một dòng
`Table.Row` không tự vẽ vòng tiêu điểm khi bàn phím thật sự focus vào nó (`tabIndex={-1}`,
dòng 107/120 — dòng KHÔNG nhận focus trực tiếp) — cha phải tự set `focused` bằng tay, và nếu
quên thì `expectAccessible` (R-72) không thấy gì sai (không `outline-none` bị tắt trần trụi) mà
người dùng bàn phím thật thì mất hẳn vòng tiêu điểm. **Kết luận: `docs/contracts/ui.md` mục H1
vẫn đúng đối với `Table.Row`.**

Cách khắc phục ĐANG CHẠY THẬT trong repo — `src/screens/qc/WallLayerReview/WallLayerList.tsx`
(dòng 9-12, 129-160): **KHÔNG dùng `Table.Row`/`Table.Cell`** cho danh sách ảo hoá dòng cao 40.
Dòng dựng tay bằng `<div>` với:
- `role="option"`, `tabIndex={0}` (dòng nhận focus THẬT, không phải roving giả)
- `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent` — **class thuần**,
  trình duyệt tự vẽ khi Tab tới, không cần state `focused` nào cả (dòng 136)
- `aria-selected` cho trạng thái chọn (dòng 132)
- ảo hoá bằng `useVirtualizer` trực tiếp (dòng 26, 210-215), style tuyệt đối `translateY` (dòng
  145, 294)

FloorManager có bảng tầng dòng 40 sửa được tại chỗ (không phải danh sách chỉ đọc như
WallLayerList) — khuyến nghị: dùng `Table.Root` + `Table.Header` + `Table.Head` (cho tiêu đề cột,
không có bẫy) nhưng **KHÔNG dùng `Table.Row`** cho thân bảng; thân bảng dựng dòng bằng `<tr>` +
`<td>` (dùng `Table.Cell` được, `Table.Cell` KHÔNG có bẫy — nó không có prop `focused`/state gì
cả, chỉ là `<td>` thuần) hoặc theo đúng khuôn `role="option"` + `focus-visible:` như
WallLayerList nếu không cần ngữ nghĩa bảng HTML thật (sort theo cột…). **T6 tự quyết theo nhu
cầu sort cột**, nhưng nếu chọn `<tr>` thô thay `Table.Row` thì phải tự thêm
`focus-visible:ring-2 ring-inset ring-accent` bằng tay lên `<tr tabIndex={0}>` — không nhận
`focused` prop qua Table.Row.

`Table.Virtual` (dòng 331-385) là lựa chọn khác: nhận `renderRow` tự do, không ép dùng
`Table.Row` — `renderRow` có thể trả về `<tr>` tự viết class `focus-visible:`.

### A.2 `NumericField.tsx` (`src/components/ui/NumericField.tsx`)

```ts
// dòng 9-13
export interface NumericFieldProps
  extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'>,
    UseNumericFieldProps {
  unit?: string;
}

// UseNumericFieldProps — src/hooks/useNumericField.ts dòng 16-21
export interface UseNumericFieldProps {
  value?: number | undefined;
  onChange?: ((val: number | undefined) => void) | undefined;
  min?: number | undefined;
  max?: number | undefined;
}
```

**⚠️ CÂU HỎI TRỌNG TÂM ĐÃ TRẢ LỜI: `onChange` KHÔNG bắn liên tục lúc gõ.** Bằng chứng —
`src/hooks/useNumericField.ts`:
- `handleChange` (dòng 86-93) chỉ `setLocalValue` + `setIsTyping(true)`, KHÔNG gọi `onChange`.
- `onChange` (prop) chỉ được gọi từ `commit()` (dòng 53-72), và `commit` chỉ chạy ở hai chỗ:
  - debounce 800 ms sau khi ngừng gõ (`COMMIT_DEBOUNCE_MS`, dòng 14, dùng ở `useEffect` dòng
    74-84 — **CHÚ Ý: 800 là hằng số thô có ghi chú giải thích tại sao (giống A7 autosave),
    KHÔNG lấy từ `MOTION_DURATIONS_MS` vì nó không phải một hoạt ảnh**);
  - `handleBlur` (dòng 105-111, blur ra khỏi ô ngay lập tức commit).
- Escape (dòng 114-118) HUỶ giá trị đang gõ, không commit.

Vậy: `NumericField` **không có** đường prop nào để nhận giá trị đang gõ dở (raw keystroke) —
`displayValue` nội bộ (biến cục bộ trong hook, KHÔNG lộ ra ngoài qua props) là thứ duy nhất theo
kịp từng phím, nhưng nó ở bên trong `useNumericField`, không có prop `onInput`/`onTyping` nào để
cha nghe. Đặc tả FloorManager cần "dải lát cắt cao/thấp NGAY TRONG LÚC GÕ" — **`NumericField`
hiện tại KHÔNG hỗ trợ việc đó qua props công khai.** Đây là khoảng trống thật, không phải thứ
T6 tự chế được: T6 phải hỏi lại bằng `orca orchestration ask` khi tới lượt dựng, hoặc nếu chấp
nhận vẽ tay, phải tự bọc một `<input>` DOM riêng có `onChange` native rồi tự parse bằng
`parseNumber` (`@/lib/format/number`) thay vì dùng `NumericField` cho ô cao độ cần phản hồi tức
thời — nhưng đặc tả CẤM tạo component mới, nên khả năng khả thi nhất là: `NumericField` vẫn
dùng cho việc NHẬP/SỬA số (giữ hành vi debounce 800ms/blur đúng chuẩn — không có gì sai khi
COMMIT trễ), còn **dải preview cao/thấp** lấy giá trị hiện có trong STORE (giá trị đã commit
lần gần nhất hoặc optimistic state phía trên NumericField, nếu FloorManager tự quản lý state
cục bộ của ô đang sửa) — không tự chế công thức, phải hỏi khi tới lượt T6.

Không có forwardRef gì đặc biệt ngoài `ref` chuẩn tới `<input>` (dòng 15, 56).

### A.3 `Toggle.tsx` (`src/components/ui/Toggle.tsx`, dòng 6-21)

```ts
export interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => Promise<void> | void;
  onError?: (error: unknown) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  isLoading?: boolean;
  isReadOnly?: boolean;
}
```
Focus ring: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring` (dòng 93) — **CSS
thuần** (`:focus-visible` pseudo-class), KHÔNG state. An toàn, không nằm trong danh sách bẫy.

### A.4 `Badge.tsx` (`src/components/ui/Badge.tsx`, dòng 9-16)

```ts
type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
  noDot?: boolean;
}
```
Không phải input, không có focus ring — không nằm trong danh sách bẫy.

### A.5 `IconButton.tsx` (`src/components/ui/IconButton.tsx`, dòng 6-16)

```ts
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string; // BẮT BUỘC theo đặc tả gốc component
  isActive?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg'; // 32 | 36 | 40 px, mặc định 'md' (36px)
  tooltip?: boolean; // tooltip hiện sau 400ms hover, mặc định true
}
```
Focus ring dòng 38: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring` — CSS thuần, an toàn.

### A.6 `Button.tsx` (`src/components/ui/Button.tsx`, dòng 6-19) + `buttonVariants.ts`

```ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
  /** @deprecated use iconBefore */
  icon?: React.ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  shortcut?: string;
  fullWidth?: boolean;
}
```

**Tên `variant` THẬT** (`src/components/ui/buttonVariants.ts` dòng 6-11, 25):
```ts
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
```
Không có biến thể tên "nút phụ" hay "nút chìm" trong mã — đó là mô tả tiếng Việt, ánh xạ:
- "nút phụ" (secondary action) → `variant="secondary"` (viền, nền `bg-surface`)
- "nút chìm" (ghost, không viền không nền) → `variant="ghost"`
- `danger` dùng cho hành động phá huỷ có xác nhận trực tiếp trên nút (không phải dialog).

Focus ring ở `buttonBaseStyles` (dòng 4): CSS thuần `focus-visible:ring-2 …` — an toàn.

### A.7 `ContextMenu.tsx` — **KHÔNG ở `src/components/ui/`, mà ở `src/components/canvas/ContextMenu.tsx`**

Đặc tả liệt nó chung với `src/components/ui/`; thực tế nó nằm ở `src/components/canvas/`. Vẫn
import được bình thường, chỉ khác đường dẫn: `@/components/canvas/ContextMenu`.

Compound: `ContextMenu` (default gộp), `.Root`, `.Item`, `.Separator`, `.Groups`, `.Kbd`.

```ts
// dòng 30-36
interface ContextMenuRootProps {
  isVisible: boolean;
  position: { x: number; y: number };
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

// dòng 128-134
interface ContextMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDestructive?: boolean | undefined;
  icon?: React.ReactNode | undefined;
  kbd?: string | undefined;
  onSelect?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
}

// dòng 226-231 — cách dùng gộp sẵn (khai theo groups)
interface ContextMenuDefaultProps {
  isVisible: boolean;
  position: { x: number; y: number };
  groups: ContextMenuGroup[]; // từ src/hooks/useContextMenu.ts
  onClose: () => void;
}
```

Cách khai mục: truyền `groups: ContextMenuGroup[]` (mỗi group có `items: ContextMenuItem[]`,
kiểu từ `@/hooks/useContextMenu`), dùng `<ContextMenu isVisible position groups onClose />`
(namespace mặc định, dòng 234-239) — KHÔNG cần tự lắp `.Root`/`.Groups` bằng tay trừ khi cần bố
cục khác thường.

**Mở bằng bàn phím:** `ContextMenuRoot` tự focus mục đầu tiên khi mở (dòng 87-94,
`requestAnimationFrame`), và `handleKeyDown` (dòng 47-84) xử lý `ArrowUp`/`ArrowDown`/`Home`/`End`
di chuyển giữa các `[role="menuitem"]`, `Escape` gọi `onClose`. Đây là điều hướng bàn phím trong
menu đã mở; component **không tự bắt phím "mở bằng bàn phím"** (ví dụ phím Menu/Shift+F10) — nơi
gọi (FloorManager) phải tự quyết định khi nào set `isVisible=true` (ví dụ từ `onContextMenu` của
dòng, hoặc từ một nút "..." — `IconButton`).

**Hỗ trợ mục nguy hiểm (destructive):** CÓ — `isDestructive` (dòng 129) tô `text-state-violation-text`
(dòng 159). Đây là màu **token trạng thái**, không phải hex — đúng A1.

Focus ring của `ContextMenu.Item` (dòng 157): `focus-visible:outline focus-visible:outline-2
focus-visible:outline-offset-[-2px] focus-visible:outline-accent` — CSS thuần (`outline`, không
phải `ring`), an toàn, không nằm trong bẫy state-driven.

### A.8 Bẫy focus ring — kết luận đủ cho cả bốn cái được yêu cầu kiểm

| Component | Vòng tiêu điểm | Kết luận |
|---|---|---|
| `Slider.tsx` (núm kéo, dòng 149-155) | `isFocused && 'ring-2 ring-accent ring-offset-2'` — **STATE** (`useState` dòng 36, set ở `onFocus`/`onBlur` dòng 149-150) | ⚠️ **BẪY CÒN ĐÚNG.** Núm kéo có `role="slider"` `tabIndex={0}` (dòng 143) nhận focus bàn phím thật, nhưng vòng chỉ vẽ khi state `isFocused` bật — về mặt hành vi trình duyệt thì đúng lúc focus cũng đúng lúc `isFocused=true` nên KHÔNG hỏng chức năng, nhưng `expectAccessible` xét `hasClassToken(element, 'ring-2')` bằng cách đọc `element.classList` — nếu test render tĩnh (không thật sự focus núm) thì class `ring-2` **không có trong DOM lúc đó** vì nó chỉ được `cn()` thêm khi `isFocused === true`, nên `focusRingOwner()` trả `null` và nếu `outline-none` cũng không có ở núm (núm KHÔNG có `outline-none` tường minh — chỉ có `outline-none` ở div bọc dòng 138, không phải chính núm dòng 152) thì `suppressesOutline` trả `false` → không bị báo lỗi 'focus-ring' NHƯNG cũng không được xác nhận có vòng — đây là điểm khác với Table.Row (nơi div cha CÓ ghi outline-none tường minh qua Tailwind class ở chính node focus). Nói ngắn: Slider ẩn hoạ tiết ring sau state thay vì để trình duyệt tự vẽ `:focus-visible`, nên MỘT SNAPSHOT TĨNH của test sẽ không thấy `ring-2`. **T6 nên tránh dùng `Slider` cho bất cứ input tương tác bàn phím nào trong FloorManager nếu expectAccessible chạy trên trạng thái KHÔNG focus; nếu buộc phải dùng Slider, phải có test riêng mô phỏng focus thật (`fireEvent.focus`) trước khi gọi expectAccessible.** |
| `Textarea.tsx` (dòng 94-99) | `focus-visible:ring-2 focus-visible:ring-accent ...` hoặc bản lỗi `focus-visible:ring-state-violation` — **CSS thuần**, không state | An toàn, KHÔNG nằm trong bẫy (đã sửa từ trước hoặc chưa từng bị). |
| `Table.Row` (dòng 89) | `focused && 'ring-2 ring-inset ring-accent'` — **STATE** (prop `focused`, cha phải tự set) | ⚠️ **BẪY CÒN ĐÚNG**, xem mục A.1. Tránh dùng cho thân bảng có thể focus bằng bàn phím; theo khuôn `WallLayerList.tsx` (div + `focus-visible:` class thuần). |
| `NumericField` (qua `Input.tsx`, chưa đọc riêng — `Input` là ô văn bản HTML chuẩn) | không kiểm trong phạm vi bốn cái đặc tả liệt kê, nhưng ghi nhận: `NumericField` dùng `<input>` thật nên focus ring theo `Input.tsx`, không thuộc danh sách phải kiểm | Không đánh giá — ngoài phạm vi liệt kê của đặc tả (Slider/Textarea/Table.Row). |

**Tóm cho T6:** `Table.Row` và `Slider` là hai nơi rủi ro thật (state-driven ring), `Textarea` an
toàn. Với dải cao độ có tay kéo đổi thứ tự — nếu định dùng `Slider` cho việc kéo-thả đổi thứ tự
tầng thì SAI mục đích của nó (Slider chỉnh MỘT giá trị số trong khoảng min–max, không phải kéo
thả sắp xếp danh sách) — xem mục C bên dưới, tay nắm kéo đổi thứ tự KHÔNG có component sẵn.

---

## B. `src/components/feedback/`

### B.1 `EmptyState.tsx` (dòng 6-15)
```ts
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}
```

### B.2 `InlineAlert.tsx` (dòng 7-18)
```ts
export type InlineAlertLevel = 'verified' | 'attention' | 'violation';

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
Dùng cho câu chặn "không cho trùng cao độ" (nêu rõ hai tầng nào) — `role="alert"` sẵn (dòng 41).

### B.3 `Toast.tsx` — **CÂU HỎI TRỌNG TÂM: CÓ hỗ trợ nút hoàn tác + đếm ngược**

```ts
// dòng 15-20
export interface ToastMessage {
  id: string;
  message: string;
  onUndo?: () => void;
  state?: 'verified' | 'attention' | 'violation';
}
```

API nhận hành động hoàn tác: gọi `useToast().addToast({ message, onUndo, state })` (hook,
dòng 31-35, export named). `addToast` nhận `Omit<ToastMessage, 'id'>` — `id` tự sinh
(`createUuid()`, dòng 157). **Không có prop `durationMs`/`ttlMs` truyền vào `addToast`** — thời
lượng đếm ngược là hằng số cố định `UNDO_WINDOW_MS` từ `src/lib/mutations/undoTicket.ts:18`:

```ts
export const UNDO_WINDOW_MS = 8000; // = 8 giây — ĐÚNG với đặc tả "toast hoàn tác 8 giây"
```

Toast tự vẽ **thanh đếm ngược 2px** ở đáy (`Toast.tsx` dòng 136-138, dùng `progress` state chạy
bằng `requestAnimationFrame`, không phải hoạt ảnh CSS — không cần thang thời lượng vì nó theo
dõi thời gian thật còn lại, không phải một transition). Nút "Hoàn tác" chỉ hiện khi
`toast.onUndo` có giá trị (dòng 123-132), dùng `Button variant="ghost" size="sm"`.

**Xoá tầng phải ra toast hoàn tác 8 giây, KHÔNG hộp thoại** — đúng khớp: gọi
`addToast({ message: '...', onUndo: () => phụcHồiTầngVừaXoá(), state: 'verified' })`.
`UNDO_WINDOW_MS` khớp đúng 8000ms đặc tả yêu cầu, không cần chỉnh gì.

Toast cần `Toast.Provider` bọc quanh cây (`src/App.tsx` dòng 102-104 làm mẫu, bọc NGAY TRONG
`ScreenErrorBoundary`, quanh `<ActiveComponent />`) — FloorManager (được dựng ở
`src/screens/qc/FloorManager` theo THÔNG BÁO ngữ cảnh) phải nằm trong một `Toast.Provider` để
`useToast()` không ném lỗi (dòng 33: `throw new Error('useToast must be used within Toast.Provider')`).
Việc bọc Provider ở tầng route/App hay tự bọc trong màn là quyết định của T6/T7, không phải của
lượt khảo sát này — chỉ ghi nhận yêu cầu bắt buộc phải có Provider bao quanh trước khi gọi
`useToast()`.

### B.4 `ScreenErrorBoundary.tsx` — props + cách `src/App.tsx` gắn (nguyên văn)

```ts
// dòng 43-58
export interface ScreenErrorFallback {
  readonly report: ScreenErrorReport;
  readonly retry: () => void;
}

export interface ScreenErrorBoundaryProps {
  readonly screenId: string;
  readonly children: ReactNode;
  readonly renderFallback: (fallback: ScreenErrorFallback) => ReactNode;
  readonly onError?: (report: ScreenErrorReport) => void;
}
```

Cách `src/App.tsx` gắn (dòng 29-40, 95-105), CHÉP NGUYÊN VĂN — đây là khuôn T7 phải chép đúng:

```tsx
// src/App.tsx:29-40
function ScreenCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="w-8 h-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

// src/App.tsx:95-105
<ScreenErrorBoundary
  key={activeScreen}
  screenId={activeScreen}
  renderFallback={({ report, retry }) => (
    <ScreenCrashFallback report={report} retry={retry} />
  )}
>
  <Toast.Provider>
    <ActiveComponent />
  </Toast.Provider>
</ScreenErrorBoundary>
```

Ba điểm phải giữ đúng khuôn: (1) `key={tênMàn}` để ranh giới gắn lại mỗi lần đổi màn (bình luận
dòng 88-90 giải thích lý do); (2) `renderFallback` dựng từ `EmptyState` với `report.description`
(KHÔNG tự viết chữ lỗi); (3) `Toast.Provider` nằm **TRONG** `ScreenErrorBoundary` (không phải
ngoài) — lý do ghi ở bình luận dòng 92-94: màn hỏng kéo theo cả provider của nó, phần dự phòng
không được phụ thuộc vào thứ vừa sập.

---

## C. Token và chuyển động

### C.1 `MOTION_DURATIONS_MS` — `src/lib/motion/tokens.ts:62-67`

```ts
export type MotionDurationName = 'instant' | 'fast' | 'standard' | 'slow';

export const MOTION_DURATIONS_MS: Readonly<Record<MotionDurationName, number>> = Object.freeze({
  instant: 120,
  fast: 180,
  standard: 260,
  slow: 340,
});
```
Cộng một hằng số thứ năm KHÔNG nằm trong thang tên (dòng 87): `AMBIENT_LOOP_MS = 700` — dùng cho
vòng lặp không dứt (skeleton sweep), không phải một transition có điểm bắt đầu/kết thúc.

**"240ms" trong đặc tả gốc KHÔNG có trên thang — đã chốt dùng `'standard'` (260ms) thay thế**
(xác nhận đúng lời điều phối viên: `src/lib/motion/useCountUp.ts` dòng 30-34 ghi thẳng lý do
này bằng lời — "The brief asked for 240 ms… `standard` is the nearest slot"). Gọi tên khoá, không
gõ số:
```ts
import { durationSeconds, durationMs } from '@/lib/motion'; // hoặc từ '@/lib/motion/tokens'
transition={{ duration: durationSeconds('standard') }}   // framer-motion, giây
className="transition-colors duration-260"                 // Tailwind, đã đúng thang (260 có class sẵn)
setTimeout(fn, durationMs('slow'))                          // 340ms, dùng ở NumericField flash (useNumericField.ts:64)
```
Tên khoá cho 260 là `'standard'`, cho 340 là `'slow'`.

### C.2 `useCountUp` — hai bản khác nhau

**`src/lib/motion/useCountUp.ts`** — ENGINE THUẦN, không import React (chạy được ngoài component,
test được không cần DOM). Export chính không phải hook React mà là hàm dựng đối tượng chạy:
```ts
// dòng 42, 45 — hằng số bắt buộc
export const COUNT_UP_DURATION: MotionDurationName = 'standard'; // 260ms
export const COUNT_UP_EASING: MotionEasingName = 'enter';

// dòng 125 — hàm dựng (KHÔNG phải hook, không gọi trong component)
export function createCountUp(spec: CountUpSpec): CountUp { ... }
// CountUp có .advance(deltaMs), .sample(), .finish(), .value, .text, .done
```

**`src/hooks/useCountUp.ts`** — LỚP BỌC REACT (đây mới là hook thật, gọi `useEffect`/`useState`):
```ts
// dòng 88
export function useCountUp(to: number, options: UseCountUpOptions = {}): CountUpSample
// CountUpSample = { value: number; text: string; done: boolean }
```

**Màn phải gọi `src/hooks/useCountUp.ts` (bản React)** cho bất cứ số nào chạy lên trên màn (A-03
chạy số — cao độ, diện tích). Luôn render `.text` (đã format sẵn qua `formatNumber`), KHÔNG BAO
GIỜ render `.value` trực tiếp (comment engine dòng 9-17 nhấn mạnh: mọi frame trung gian phải là
chuỗi đã định dạng đúng, không phải số thô).

`COUNT_UP_DURATION` = `'standard'`, `COUNT_UP_EASING` = `'enter'` — đã dán ở trên, hai hằng số
này nằm trong module engine (`src/lib/motion/useCountUp.ts`), không phải trong bản hook React.

### C.3 Token màu — `tailwind.config.ts`

Ba token đặc tả hỏi, XÁC NHẬN CÓ THẬT và ĐÚNG TÊN:
```
tailwind.config.ts:36   sunken: 'var(--bg-sunken)'     → class Tailwind: bg-sunken (dưới nhóm bg)
tailwind.config.ts:39   selected: 'var(--bg-selected)' → class Tailwind: bg-selected
tailwind.config.ts:28   DEFAULT: 'var(--accent)'       → class Tailwind: bg-accent / text-accent / ring-accent…
```
Tên đúng để viết trong class: `bg-bg-sunken`, `bg-bg-selected`, `bg-accent` / `text-accent` /
`ring-accent` (accent là nhóm màu riêng `accent.DEFAULT`, không lồng dưới `bg`, nên KHÔNG viết
`bg-bg-accent`).

**Ba màu trạng thái của A4** (`tailwind.config.ts:55-63`):
```
state.verified   → var(--state-verified)      class: bg-state-verified / text-state-verified
state.verified-text → var(--state-verified-text)
state.verified-tint → var(--state-verified-tint)
state.attention  → var(--state-attention)      (+ -text, -tint)
state.violation  → var(--state-violation)      (+ -text, -tint)
```
Đúng ba tên: `verified`, `attention`, `violation` — không có màu trạng thái thứ tư trong token
(A4 đúng như CLAUDE.md mô tả).

**`mono` / `mono-lg`:** Grep toàn `tailwind.config.ts` cho `mono` và `fontFamily` — **KHÔNG có
kết quả nào**. Không có cấu hình `fontFamily` tuỳ biến trong file cấu hình Tailwind (dùng mặc
định của Tailwind, gồm class `font-mono` chuẩn có sẵn từ framework — không phải token riêng của
dự án). **`mono-lg` — NOT FOUND**, không tồn tại ở bất cứ đâu trong `src/` (grep toàn repo cho
chuỗi `mono-lg` chỉ trúng ba file `*Types.ts` chứa chuỗi con trùng tình cờ, không phải class
CSS). Nếu FloorManager cần chữ số cỡ lớn kiểu mono (cho cao độ tầng?), ghép bằng `font-mono` +
một class cỡ chữ Tailwind chuẩn (`text-lg`, `text-xl`…), KHÔNG có sẵn lớp gộp `mono-lg`.

### C.4 `src/components/motion/` — `MotionProvider` và những gì được phép nhập

```ts
// src/components/motion/index.ts — TOÀN BỘ export của file
export { motion, AnimatePresence, useAnimation } from 'framer-motion';
export function MotionProvider({ children }: MotionProviderProps): ReactNode;
```
Đây là **nơi DUY NHẤT được nhập `framer-motion`** (R-39, ép bằng luật ESLint
`local/no-framer-outside-motion`). Mọi view của FloorManager cần `motion.div`/`AnimatePresence`
phải `import { motion, AnimatePresence } from '@/components/motion'`, KHÔNG BAO GIỜ
`from 'framer-motion'` trực tiếp. `MotionProvider` chỉ cần bọc ứng dụng MỘT LẦN (đã bọc sẵn ở
`src/App.tsx:12,68-108` cho toàn bộ 9 màn demo) — FloorManager không tự bọc lại provider này nếu
nó được gắn dưới `App.tsx` hiện có; nếu FloorManager tự đứng độc lập (route riêng, T7 lo), phải
tự bọc `MotionProvider` một lần ở gốc.

---

## D. `src/lib/format/` (P-01)

### D.1 `number.ts`

```ts
// Hàm cốt lõi
export function formatNumber(value: MaybeNumber, options: NumberFormatOptions = {}): string;
export function formatPercent(value: MaybeNumber, options: PercentFormatOptions = {}): string;
export function parseNumber(text: string): number | undefined;
export function isFormattable(value: MaybeNumber): value is number;

export const MISSING_VALUE = '—'; // em dash — mọi giá trị thiếu hiện chữ này, KHÔNG "-" hay "N/A"

export interface NumberFormatOptions {
  readonly fractionDigits?: number;     // đúng số lẻ, đệm 0
  readonly maxFractionDigits?: number;  // tối đa, bỏ số 0 thừa
  readonly grouping?: boolean;          // nhóm nghìn bằng dấu chấm, mặc định true
}
```
Ví dụ nguyên văn từ docblock: `formatNumber(3.5, { fractionDigits: 2 })` → `"3,50"` — **dấu
thập phân là dấu phẩy**, đúng A15. `parseNumber("4.250,50")` → `4250.5` (đọc ngược notation VN).

### D.2 `measure.ts`

```ts
export function formatLength(valueMm: MaybeNumber, options: LengthFormatOptions = {}): string;
// formatLength(850) → "850 mm" ; formatLength(3450) → "3,45 m" (tự chọn đơn vị theo ngưỡng 1000mm)

export function formatArea(areaM2: MaybeNumber, options: MeasureFormatOptions = {}): string;
// formatArea(248.6) → "248,60 m²" — khớp bộ mẫu chuẩn A14 "34 phòng và sảnh 248,60 m²"

export function formatAngle(angleDeg: MaybeNumber, options: MeasureFormatOptions = {}): string;
// formatAngle(90) → "90,0°"

export const METRE_THRESHOLD_MM = 1000; // ngưỡng chuyển mm → m (dùng MILLIMETRES_PER_METRE)
```

Cao độ tầng (elevation) của FloorManager nên dùng `formatLength` (đơn vị mm hoặc m tự chọn theo
độ lớn) hoặc ép `{ unit: 'm' }` nếu bảng tầng luôn hiện mét — T6 tự quyết theo cột bảng.
**A15: định dạng xảy ra ở viewmodel/hook, các hàm này KHÔNG được gọi trực tiếp trong JSX của
view** — gọi trong hook chuẩn bị viewmodel rồi truyền chuỗi đã format xuống view.

---

## E. `src/lib/testing/` — bộ khẳng định dùng chung

### E.1 `expectSevenStates.ts` (dòng 122-159) + `sevenStateScenarios.ts` (dòng 26-183)

```ts
// Chữ ký
export function expectSevenStates(
  renderScreen: ScreenRenderer, // (scenario) => { container: HTMLElement; unmount?: () => void }
  scenarios: readonly SevenStateScenario[],
): void; // throw Error nếu thiếu/trùng trạng thái, render ném lỗi, hoặc màn trắng

// Bảy trạng thái, ĐÚNG TÊN trong mã (sevenStateScenarios.ts:26-34)
export const SEVEN_STATES = [
  'empty', 'loading', 'partial', 'error', 'success', 'forbidden', 'collapsed',
] as const;
// Nhãn tiếng Việt tương ứng (dòng 40-48): 'rỗng', 'đang tải', 'một phần', 'lỗi',
// 'thành công', 'không có quyền', 'thu gọn'

export function createSevenStateScenarios(
  options: SevenStateScenarioOptions = {}, // totalCount, partialCount, createRow, overrides
): readonly SevenStateScenario[];
```

`SevenStateScenario` là hình dạng LIST (rows/totalCount/isLoading/isCollapsed/canView/error) —
"nothing here knows about walls, rooms or violations" (docblock dòng 12-15): một màn có hình
dạng khác (như FloorManager — hai cột, không phải một danh sách đơn) **override qua
`options.overrides`** hoặc tự viết `scenarioIndex()` map thủ công như
`AxisGridManager.test.tsx:81-95` làm (xem mẫu ở mục E.3).

### E.2 `expectAccessible.ts`, `expectVietnamese.ts`, `expectNoRawColor.ts`, `render.ts`, `fixtures.ts`, `fakeClock.ts`

```ts
// expectAccessible.ts:960
export function expectAccessible(subject: TestSubject, options: AccessibilityOptions = {}): void;
// subject: HTMLElement HOẶC { container: HTMLElement } (kết quả render() của RTL)
// Kiểm: tên cho trình đọc màn hình, alt ảnh, thứ tự tab, vòng tiêu điểm bị tắt không thay,
// tương phản màu (bỏ qua nơi màu không suy ra được dưới jsdom — dùng options.variables để
// truyền token nếu cần soát tương phản thật).

// expectVietnamese.ts:714
export function expectVietnamese(subject: TestSubject, options: VietnameseOptions = {}): void;
// Soát text + các thuộc tính aria-label/alt/placeholder/title… so với src/i18n/vi.json + hình
// dạng âm tiết tiếng Việt. allowWords để bỏ qua từ hợp lệ ngoài từ điển (tên riêng…).

// expectNoRawColor.ts:307 — dùng cho MODULE quyết định màu (như src/lib/coloring), không
// phải cho component view thông thường (view đã có luật ESLint local/no-raw-color chặn sẵn).
export function expectNoRawColor(target: string, options: NoRawColorOptions = {}): void;

// render.tsx:232
export function renderWithProviders(
  ui: RenderableUi,
  options: RenderWithProvidersOptions = {},
): ProvidedRenderResult; // { ...RTL render(), queryClient, translate }
// Bọc sẵn QueryClientProvider (retry tắt) + reset store (nếu đã configureTestProviders) — DÙNG
// CÁI NÀY thay vì render() trần của RTL cho mọi test màn.

// fixtures.ts — dữ liệu QC dùng chung, theo bộ mẫu chuẩn A14
export function createCleanBuildingScenario(): QcScenario;
export function createViolatedBuildingScenario(): QcScenario; // 7 lỗi, health score 44
export function createEmptyProjectScenario(): QcScenario;
export function createLargeBuilding(): SpatialGraph; // 20 tầng, 1200 tường, cho test hiệu năng

// fakeClock.ts:82, 116
export function installFakeClock(options: FakeClockOptions = {}): FakeClock;
export async function withFakeClock<T>(body: (clock: FakeClock) => T | Promise<T>, options = {}): Promise<T>;
// clock.advance(ms) — chờ ĐỦ timer + microtask, dùng để test debounce 800ms của NumericField
// hoặc đếm ngược 8s của Toast mà không tốn 8 giây thật.
```

### E.3 Bẫy Storybook CSF — `meta.excludeStories` — VẪN ĐÚNG, có ví dụ thật đang chạy

Xác nhận: `src/screens/qc/AxisGridManager/AxisGridManager.stories.tsx:18-24, 87` — một export
KHÔNG phải story (hàm `scenarioArgsFor`, hằng số `SEVEN_STORY_STATES`) buộc phải khai trong
`meta.excludeStories`, nếu không **toàn bộ file story trắng trơn**:

```tsx
const meta = {
  title: 'Screens/QC/AxisGridManager',
  component: AxisGridManager,
  parameters: { layout: 'fullscreen' },
  decorators: [ (Story) => <div className="h-screen w-screen"><Story /></div> ],
  excludeStories: ['scenarioArgsFor', 'SEVEN_STORY_STATES'], // BẮT BUỘC — mọi export non-story
} satisfies Meta<typeof AxisGridManager>;
```
Cách dùng chuẩn cho T6: MỌI hàm/hằng số export ra khỏi file `*.stories.tsx` mà không phải một
`StoryObj` (ví dụ hàm dựng props theo trạng thái để test dùng lại, theo đúng khuôn R-70 "không
hai bảng dữ liệu lệch nhau") phải liệt tên trong `meta.excludeStories`.

**Bẫy `Table.Root`/`Table.Cell` render trong story:** Không tìm thấy bẫy nào ghi nhận cho việc
này trong mã hiện tại (không có test hay bình luận nào cảnh báo `Table.Root`/`Table.Cell` tự nó
làm hỏng story) — bẫy có thật và đang phòng tránh trong repo là bẫy **focus ring của
`Table.Row`** (mục A.1/A.8), không phải bẫy render CSF. Không có bằng chứng "Table.Root/Table.Cell
render trap" nào khác — **NOT FOUND** cho phần này của câu hỏi.

### E.4 Khung sườn thật: `AxisGridManager.test.tsx` + `AxisGridManager.stories.tsx`

**`AxisGridManager.stories.tsx`** (view thuần, không container):
- `meta` khai `title`, `component`, `parameters.layout: 'fullscreen'`, `decorators` (bọc
  `h-screen w-screen`), `excludeStories`.
- `scenarioArgsFor(state: SevenState): AxisGridManagerViewProps` — hàm export dùng chung cho cả
  story lẫn test (R-70, một bảng dữ liệu, không hai).
- 7 `export const <TênTiếngViệt>: Story = { args: scenarioArgsFor('<state>') }` — một story cho
  mỗi trong bảy trạng thái, TÊN STORY LÀ TIẾNG VIỆT không dấu kiểu PascalCase (`Rong`, `DangTai`,
  `MotPhan`, `Loi`, `ThanhCong`, `KhongCoQuyen`, `ThuGon` — ĐÂY LÀ TÊN BIẾN JS, không hiển thị cho
  người dùng cuối, nên không cần dấu; nhãn hiển thị trong Storybook UI tự suy ra từ tên biến).

**`AxisGridManager.test.tsx`** (khung `describe`/`it` theo mã số nghiệm thu, mẫu để T6/T7 chép
cấu trúc, không chép mã số — mã số của FloorManager sẽ khác):
- `renderState(state)` gọi `renderWithProviders(<Component {...scenarioArgsFor(state)} />)`.
- `afterEach` dọn store thật qua action công khai (`store.setSpatial(null,null)`,
  `store.clearSelection()`…) — KHÔNG set trực tiếp field, gọi action.
- Một `describe('[NGHIEM-N] …')` cho mỗi phép đo của bản nghiệm thu, `console.log` số liệu thật
  RỒI MỚI `expect(...)` — bản nghiệm thu đòi in con số thật, không chỉ khẳng định nó (đúng tinh
  thần E.10 của repo: không báo "đạt" mà không có số).
- Cuối file: `describe('khả năng tiếp cận và tiếng Việt')` chạy `expectAccessible` +
  `expectVietnamese` cho cả bảy trạng thái, lặp qua `SEVEN_STATES`.

---

## Ghép được từ component có sẵn hay phải vẽ tay? (yêu cầu bắt buộc của đặc tả)

| Thành phần đặc tả yêu cầu | Ghép từ component có sẵn? | Ghi chú |
|---|---|---|
| Lát cắt đứng SVG, mỗi tầng một dải ngang CAO THEO TỶ LỆ THẬT | **KHÔNG có component sẵn.** Phải vẽ tay bằng SVG thuần (`<svg>`/`<rect>`…) — đây KHÔNG phải "tạo component mới" theo nghĩa đặc tả cấm (không phải một React component tái dùng được mới thêm vào `src/components/**`), mà là JSX/SVG cục bộ bên trong file view của FloorManager. Không có `Table`/`Panel`/canvas component nào vẽ dải tỷ lệ theo chiều cao thật. | Chiều cao mỗi dải phải tính từ dữ liệu thật (cao độ tầng) — **cấm tự tính** theo mục 3 CẤM TUYỆT ĐỐI của đặc tả gốc: hook/viewmodel phải nhận sẵn kích thước pixel đã tính, KHÔNG để view tự nhân tỷ lệ. |
| Bảng tầng dòng 40 sửa được tại chỗ | **Ghép được** từ `Table.Root/Header/Body/Head/Cell` (mục A.1) + `NumericField`/`Toggle`/`Badge`/`IconButton` cho từng ô sửa được — nhưng **tránh `Table.Row`** cho thân bảng (bẫy focus ring, mục A.1/A.8), theo khuôn `WallLayerList.tsx`. | Chiều cao dòng 40px khớp `ROW_HEIGHT_PX` mẫu ở `WallLayerList.tsx:49`. |
| Tay nắm kéo đổi thứ tự (reorder handle) | **KHÔNG có component sẵn.** Không tìm thấy `DragHandle`/`GripVertical` hay pattern kéo-thả-sắp-xếp nào trong `src/components/**` (grep `GripVertical|drag-handle|DragHandle|reorder` không trúng). `Slider.tsx` KHÔNG phải giải pháp — nó chỉnh một giá trị số trong khoảng min/max bằng con trỏ kéo ngang, không phải kéo-thả đổi vị trí phần tử trong danh sách. | Phải vẽ tay (icon `GripVertical` từ `lucide-react`, đã là phụ thuộc có sẵn của repo — dùng ở nhiều nơi khác như `ChevronUp/Down` trong `NumericField`) + tự viết xử lý kéo-thả (pointer events hoặc thư viện có sẵn trong `package.json` nếu có — KHÔNG kiểm tra `package.json` trong lượt khảo sát này, T6 tự tra). Nếu cần logic sắp xếp lại mảng, đó là tính toán — theo mục B CLAUDE.md phải nằm trong hook, không trong view. |
| Đường chèn 2px (insertion indicator khi kéo-thả) | **KHÔNG có component sẵn.** Không có component "insertion line" trong `src/components/**`. | Vẽ tay bằng một `<div>` tuyệt đối 2px cao, màu token (`bg-accent`, đúng A2 — màu nhấn cho thứ tương tác), không phải component riêng. |
| Ảnh thu nhỏ mặt bằng (floor plan thumbnail) | **CÓ MỘT CÔNG DỤNG GẦN** — `src/components/canvas/MiniMap.tsx` (160×120, viền hairline, khung nhìn accent 1px, mờ 60% khi không hover, bấm để nhảy vùng) — nhưng **MiniMap có ngữ nghĩa điều hướng khung nhìn** (kéo/bấm đổi vùng đang xem trên canvas chính, cần `onViewportChange`), KHÔNG phải một ảnh tĩnh trang trí cho mỗi dòng bảng tầng. Dùng `MiniMap` cho một ảnh thu nhỏ TĨNH (không cần kéo-thả điều hướng) là dùng sai mục đích của nó — nó vẫn nhận `children` là SVG/canvas tự do nên VẪN kỹ thuật "ghép được", nhưng ngữ nghĩa tương tác (viewport rect, click-to-jump) sẽ đi kèm không cần thiết. | Nếu bảng tầng chỉ cần một ảnh mặt bằng tĩnh không tương tác mỗi dòng, khuyến nghị vẽ tay bằng `<svg>` nhỏ nhúng trực tiếp trong ô bảng thay vì kéo cả `MiniMap` (tránh `useMiniMap` hook và pointer handlers không dùng tới). Đây là quyết định của T6 — ghi lại hai lựa chọn, không tự chốt vì đặc tả không nói rõ ảnh thu nhỏ có cần bấm-để-nhảy hay không. |
| Thang cao độ (elevation scale/ruler dọc theo lát cắt) | **KHÔNG có component sẵn.** Không có "ruler"/"scale" component trong `src/components/**`. | Vẽ tay bằng SVG (các vạch chia + nhãn `formatLength`/`formatNumber`), cùng nhóm với dải lát cắt — nằm trong cùng file SVG view, không phải component riêng. |

---

## Tổng hợp NOT FOUND

1. `ContextMenu.tsx` không ở `src/components/ui/` như đặc tả nói — thực tế ở
   `src/components/canvas/ContextMenu.tsx` (đã dùng đường dẫn đúng ở mục A.7, không phải thiếu).
2. Class tiện ích `mono-lg` — **NOT FOUND** trong toàn `src/` và `tailwind.config.ts` (mục C.3).
3. Bẫy "Table.Root/Table.Cell render làm hỏng story" — **NOT FOUND**, không có bằng chứng nào
   trong mã hoặc bình luận (mục E.3). Bẫy thật được ghi nhận là focus ring của `Table.Row`.
4. Component tay nắm kéo-thả, đường chèn 2px, thang cao độ, ảnh thu nhỏ mặt bằng tĩnh —
   **NOT FOUND** như component sẵn có, phải vẽ tay (chi tiết ở bảng trên).
5. Đường công khai để FloorManager nhận giá trị NumericField NGAY TRONG LÚC GÕ (trước debounce
   800ms/blur) — **NOT FOUND** trong props hiện có của `NumericField`/`useNumericField` (mục A.2)
   — đây là khoảng trống thật cần hỏi lại khi T6 tới lượt dựng, không phải lỗi khảo sát.

---

## Kết quả `pnpm typecheck` / `pnpm lint`

Lượt việc này KHÔNG sửa file nguồn nào (chỉ tạo file ghi chú `.md`), nên hai lệnh dưới đây chạy
trên cây mã HIỆN TRẠNG (không đổi bởi lượt khảo sát), chỉ để xác nhận cây sạch trước khi bàn
giao cho T6:

- `pnpm typecheck` → **ĐÃ CHẠY, ĐẠT.** `tsc --noEmit` thoát mã 0, không có dòng lỗi nào in ra.
- `pnpm lint` → **ĐÃ CHẠY, ĐẠT.** `eslint . --ext ts,tsx --report-unused-disable-directives
  --max-warnings 0` thoát mã 0, không có lỗi hay cảnh báo nào (0 warning, vì `--max-warnings 0`
  mà lệnh vẫn thoát mã 0 nghĩa là đúng 0 cảnh báo).
