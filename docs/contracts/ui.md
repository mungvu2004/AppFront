# UI Contract — Danh sách Props toàn bộ component dùng lại

**Mục đích:** File hợp đồng tập trung tất cả Props interfaces của component có sẵn. Worker lớp 2 dựng view sẽ dùng file này thay vì mở lại từng component.

**Nguyên tắc:** CHÉP NGUYÊN VĂN interface Props, KHÔNG tóm tắt hoặc diễn giải lại.

---

## A. src/components/ui/ — Điều khiển

### SegmentedControl.tsx (dòng 8-24)

Export named `SegmentedControl` (compound component: `SegmentedControl.Root`, `SegmentedControl.Item`)

```tsx
export interface SegmentedControlOption<T extends string = string> {
  label: string;
  value: T;
  swatch?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value?: T | undefined;
  defaultValue?: T | undefined;
  onChange?: ((value: T) => void) | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  disabled?: boolean | undefined;
  isLoading?: boolean | undefined;
}

export interface SegmentedItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  swatch?: string | undefined;
  isActive?: boolean;
  layoutId?: string;
}

export interface SegmentedRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}
```

**Hook logic tách biệt (R-22 mục D):**
```tsx
export function useSegmentedControl<T extends string>({
  value,
  defaultValue,
  onChange,
  options,
}: SegmentedControlProps<T>) { ... }
```

---

### ConfidenceMeter.tsx (dòng 16-21)

Export named `ConfidenceMeter` (wrapper component, không export interface riêng)

```tsx
interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0 to 1 */
  value: number;
  /** Suppress tooltip (e.g. in dense table cells) */
  noTooltip?: boolean;
}
```

**Phụ thuộc:** `lib/format/semantic.confidenceLevel(value) === 'needsReview'` — ngưỡng < 0,70.

---

### Badge.tsx (dòng 9-15)

Export named `Badge`

```tsx
type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
  /** Suppress the leading dot indicator */
  noDot?: boolean;
}
```

---

### NumericField.tsx (dòng 9-13)

Export named `NumericField`

```tsx
export interface NumericFieldProps
  extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'>,
    UseNumericFieldProps {
  unit?: string;
}
```

---

### Select.tsx (dòng 20-62, 116-120, 232-236, 377-388)

Export named `Select` (compound: `Select.Root`, `Select.Label`, `Select.Trigger`, `Select.Content`, `Select.Item`, `Select.Empty`, `Select.Skeleton`)

```tsx
export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectRootProps {
  value?: string | undefined;
  onChange?: ((val: string) => void) | undefined;
  options?: SelectOption[] | undefined;
  isOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
}

export interface SelectTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  placeholder?: string;
  options?: SelectOption[];
}

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
  index?: number;
}

export interface LegacySelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  label?: string;
}
```

---

### IconButton.tsx (dòng 6-16)

Export named `IconButton`

```tsx
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  /** aria-label is REQUIRED per spec */
  'aria-label': string;
  isActive?: boolean;
  loading?: boolean;
  /** Size: 32 | 36 | 40 px. Default 36 */
  size?: 'sm' | 'md' | 'lg';
  /** Show tooltip on hover after 400ms delay */
  tooltip?: boolean;
}
```

---

### Kbd.tsx (dòng 6-8)

Export named `Kbd`

```tsx
export interface KbdProps {
  children: React.ReactNode;
  className?: string;
}
```

---

### Tooltip.tsx (dòng 19-25)

Export named `Tooltip`

```tsx
export interface TooltipProps {
  label: string;
  kbd?: string;
  children: React.ReactElement;
  disabled?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const TOOLTIP_DWELL_MS = 400;  // Không phải hằng số magic; lấy từ đây khi cần
```

---

### FieldRow.tsx (dòng 5-19)

Export named `FieldRow`

```tsx
export interface FieldRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
  /** Show "—" dash for mixed/undefined value */
  isMixed?: boolean;
  /** Read-only: disable interaction, show tooltip explaining why */
  isReadOnly?: boolean;
  readOnlyReason?: string;
  isLoading?: boolean;
  /** Flash accent-wash background after a write (340ms) */
  flash?: boolean;
  /** Collapsed state — renders nothing */
  collapsed?: boolean;
}
```

---

### TreeItem.tsx (dòng 11-30)

Export named `TreeItem` (forwardRef)

```tsx
interface TreeItemProps {
  level?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  visible?: boolean;
  onToggleVisible?: () => void;
  /** Icon element for the item type (e.g. wall, room, floor) */
  typeIcon?: React.ReactNode;
  /** Legacy color chip (kept for backward compat) */
  colorChip?: string;
  count?: number;
  label: string;
  hasChildren?: boolean;
  selected?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  tabIndex?: number;
  className?: string;
  id?: string;
}
```

---

### Checkbox.tsx (dòng 6-12)

Export named `Checkbox` (forwardRef)

```tsx
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  error?: boolean;
}
```

---

### Button.tsx + buttonVariants.ts (dòng 6-19 Button, dòng 28-34 buttonVariants)

Export named `Button` (forwardRef) + exported type helpers

```tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon placed before label */
  iconBefore?: React.ReactNode;
  /** Icon placed after label */
  iconAfter?: React.ReactNode;
  /** @deprecated use iconBefore */
  icon?: React.ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  shortcut?: string;
  fullWidth?: boolean;
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface GetButtonStylesProps {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  iconOnly?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}
```

**Phụ thuộc:** `buttonVariants` dict có `primary`, `secondary`, `ghost`, `danger`.

---

### ThicknessField.tsx (dòng 7-20) ⚠️ CẢNH BÁO

Export named `ThicknessField` — **KHÔNG cho phép ô nhập số tự do**.

```tsx
export type WallThickness = '110' | '220' | '330' | 'btct';

export interface ThicknessFieldProps {
  value?: WallThickness;
  onChange?: (value: WallThickness) => void;
  /** Original AI-detected value for reference (in mm), shown as caption */
  aiOriginalMm?: number;
  disabled?: boolean;
  isLoading?: boolean;
  isReadOnly?: boolean;
  /** Error message */
  error?: string;
  className?: string;
}
```

**Bẫy:** Màn này **BỊ CẤM** dùng `ThicknessField` vì đặc tả chỉ cho độ dày ba lựa chọn (110/220/330/BTCT), không cho ô nhập tự do. Component này là `SegmentedControl` ba lựa chọn (+ BTCT).

---

### Table.tsx (dòng 28-32, 71-77, 131-137)

Export named `Table` (compound: `Table.Root`, `Table.Header`, `Table.Body`, `Table.Row`, `Table.Head`, `Table.Cell`, `Table.CheckBox`)

```tsx
export interface TableRootProps extends React.HTMLAttributes<HTMLDivElement> {
  sortKey?: string | undefined;
  sortDir?: 'asc' | 'desc' | null | undefined;
  onSort?: ((key: string) => void) | undefined;
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;
  isAttention?: boolean;
  isFlash?: boolean;
  layoutId?: string;
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
  sticky?: boolean;
}
```

**Ghi chú:** Table là danh sách ảo hoá (virtualized), dùng `@tanstack/react-virtual`. Render Row/Cell là element con của Table.

---

### Toggle.tsx (dòng 6-21)

Export named `Toggle` + `useToggle` hook

```tsx
export interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => Promise<void> | void;
  onError?: (error: unknown) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Optional label displayed beside the toggle */
  label?: React.ReactNode;
  /** Optional description below the label */
  description?: React.ReactNode;
  isLoading?: boolean;
  isReadOnly?: boolean;
}

export function useToggle({
  checked,
  defaultChecked,
  onChange,
  onError,
}: ToggleProps) { ... }
```

---

### Input.tsx (dòng 5-15)

Export named `Input` (forwardRef)

```tsx
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

---

### Slider.tsx (dòng 6-19)

Export named `Slider`

```tsx
export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  endLabels?: [string, string];
  'aria-label'?: string;
  /** Snap to array of specific values */
  snapPoints?: number[];
  isLoading?: boolean;
}
```

---

### Textarea.tsx, Tabs.tsx, Radio.tsx, Avatar.tsx, TableActionBar.tsx

Chỉ cần tên + một dòng props tóm tắt (không cần chép đủ).

| Component | Props tóm tắt |
|-----------|---------------|
| Textarea | `value`, `onChange`, `disabled`, `isReadOnly`, `isLoading`, `error`, `placeholder` |
| Tabs | `value`, `onChange`, `options`, `disabled` |
| Radio | `name`, `value`, `onChange`, `options`, `disabled` |
| Avatar | `src`, `alt`, `size`, `fallback` |
| TableActionBar | `actions`, `selectedCount`, `onSelectAll`, `isAllSelected` |

---

## B. src/components/shell/ — Vỏ màn (QC-SHELL)

### AppShell.tsx (dòng 29-46)

Export named `AppShell`

```tsx
export interface AppShellProps {
  /** Nội dung panel trái */
  leftPanelContent?: React.ReactNode;
  /** Nội dung panel phải */
  rightPanelContent?: React.ReactNode;
  /** Nội dung canvas chính */
  canvasContent?: React.ReactNode;
  /** Breadcrumb items */
  breadcrumbs?: BreadcrumbItem[];
  /** Toạ độ con trỏ từ canvas */
  cursorX?: number;
  cursorY?: number;
  /** Tỷ lệ bản vẽ */
  scaleRatio?: string;
  scaleDensity?: string;
  /** Trạng thái lưu */
  saveText?: string;
}
```

**Ghi chú:**
- Panel trái/phải được render qua `PanelWrapper` — animate mở/đóng width, có state `collapsed`.
- Canvas là nơi `mountPresentation` của three.js.
- Breadcrumb lấy từ hook `useBreadcrumb`.
- Tỷ lệ bản vẽ lấy từ `useViewport()`.
- Phím tắt đăng ký qua `useKeyboardMap`.

---

### Panel.tsx (dòng 9-18, 106-109, 141-143, 196-202)

Export named `Panel` (compound: `Panel.Root`, `Panel.Header`, `Panel.Body`, `Panel.Group`, `Panel.Divider`)

```tsx
export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nhãn section — viết thường kiểu câu (sentence case) */
  title?: string | undefined;
  /** Slot hành động bổ sung ở phải */
  action?: React.ReactNode;
  /** Callback thu gọn panel */
  onCollapse?: (() => void) | undefined;
  /** Hướng nút thu gọn */
  collapseDirection?: 'left' | 'right' | undefined;
}

export interface PanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nhãn nhóm — sentence case */
  label?: string;
}

export interface PanelRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface LegacyPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  onCollapse?: () => void;
  collapseDirection?: 'left' | 'right';
  children: React.ReactNode;
}
```

---

### StatusBar.tsx (dòng 6-17)

Export named `StatusBar`

```tsx
export interface StatusBarProps {
  /** Toạ độ X (pixel không gian thiết kế) */
  x: number;
  /** Toạ độ Y (pixel không gian thiết kế) */
  y: number;
  /** Tỷ lệ nguyên đồ, ví dụ "1:100" */
  scaleRatio: string;
  /** Mật độ px, ví dụ "12 mm/px" */
  scaleDensity: string;
  /** Văn bản trạng thái lưu, ví dụ "Đã lưu lúc 14:32" hoặc "Đang lưu..." */
  saveText: string;
}
```

**Ghi chú:** Thanh trạng thái 32px (h-8), ba mục: toạ độ | tỷ lệ + mật độ | trạng thái lưu. Có `role="status"` + `aria-live="polite"`.

---

### Breadcrumb.tsx

Tên + một dòng props.

---

### ShortcutHelp.tsx

Tên + một dòng props, ghi rõ cách nó lấy danh sách phím.

---

### DevStateSwitcher.tsx ⚠️ CẢNH BÁO

**Đây là điều khiển dành cho lập trình viên.** Mục B của CLAUDE.md cấm nó xuất hiện trên màn sản phẩm. Chỉ dùng trong Storybook hoặc dev mode.

---

## C. src/components/feedback/ — Bảy trạng thái

### EmptyState.tsx (dòng 6-14)

Export named `EmptyState`

```tsx
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

---

### Skeleton.tsx (dòng 4-8)

Export named `Skeleton`

```tsx
export type SkeletonPreset = 'table-row' | 'project-card' | 'property-panel' | 'canvas';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  preset: SkeletonPreset;
}
```

**Ghi chú:** Skeleton dùng `animate-pulse` (700ms ambient loop, A liệt kê). Canvas skeleton chứa 12 dòng khung xương.

---

### InlineAlert.tsx (dòng 7-18)

Export named `InlineAlert`

```tsx
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

**Ghi chú:** Ba mức — verified (xanh), attention (vàng), violation (đỏ). Phần lỗi của A11.

---

### ScreenErrorBoundary.tsx (dòng 42-57)

Export class `ScreenErrorBoundary` + interfaces

```tsx
export interface ScreenErrorFallback {
  /** The classified error, its Vietnamese wording, and whether a retry is worth offering. */
  readonly report: ScreenErrorReport;
  /** Clears the error and mounts the children again. */
  readonly retry: () => void;
}

export interface ScreenErrorBoundaryProps {
  /** Names this screen in telemetry, e.g. `'qc'`, `'upload'`. */
  readonly screenId: string;
  readonly children: ReactNode;
  /** Builds what a person sees instead of the screen. The boundary draws nothing itself. */
  readonly renderFallback: (fallback: ScreenErrorFallback) => ReactNode;
  /** Told after the error has been recorded, for a screen that wants to react to it. */
  readonly onError?: (report: ScreenErrorReport) => void;
}
```

**Ghi chú:** Đây là bản `src/components/feedback` (R-62 bắt buộc dùng bản này). KHÔNG dùng bản ở `src/lib/screen-state`. Nó là class component vì chỉ class component mới có `getDerivedStateFromError`. Không render bất cứ JSX nào — toàn bộ giao diện quyết bởi `renderFallback` function.

---

### SaveIndicator.tsx (dòng 11-17, 72-74)

Export named `SaveIndicator` + `ConnectedSaveIndicator`

```tsx
export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface SaveIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  saveState: SaveState;
  label?: string | null;
  flash?: boolean;
}

export interface ConnectedSaveIndicatorProps extends Omit<SaveIndicatorProps, 'saveState' | 'label' | 'flash'> {
  onSave: (data: RootState['spatial']) => Promise<void>;
}
```

**Ghi chú:** A7 — không có nút lưu. Hệ thống tự lưu 800ms sau thao tác cuối (từ hook `useAutosave`). SaveIndicator chỉ hiển thị trạng thái. ConnectedSaveIndicator gọi `onSave` qua hook `useAutosave`.

---

### Toast.tsx (dòng 15-44)

Export named `useToast`, `Toast` (compound: `Toast.Provider`, `Toast.Item`)

```tsx
export interface ToastMessage {
  id: string;
  message: string;
  onUndo?: () => void;
  state?: 'verified' | 'attention' | 'violation';
}

export interface ToastItemProps {
  toast: ToastMessage;
  index: number;
  onRemove: (id: string) => void;
  resetKey?: number; // Used to trigger timer reset for grouped toast
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within Toast.Provider');
  return ctx;
}
```

**Ghi chú:** D-05 — bắn toast hoàn tác (undo window 2000ms cố định, từ `UNDO_WINDOW_MS`). Toast nhóm theo message. Mọi toast có phím để đóng và nút hoàn tác nếu `onUndo` tồn tại.

---

### NotificationHost.tsx, ProgressOverlay.tsx, PipelineStepper.tsx

Tên + một dòng props.

---

## D. src/components/motion/ — Chuyển động

Liệt kê mọi export từ `src/components/motion/`. Đây là **NƠI DUY NHẤT được import framer-motion** (luật `local/no-framer-outside-motion`).

```tsx
import { motion, AnimatePresence } from '../motion';

// Motion components available:
- motion.div, motion.button, motion.span, motion.tr
- AnimatePresence

// Usage constraint:
- View của màn PHẢI dùng component từ src/components/motion/, không import framer-motion trực tiếp
- MotionProvider ở src/components/motion/ đặt reducedMotion="user"
```

### src/lib/motion/tokens.ts (dòng 62-67, 87)

**Hằng số thời gian duy nhất được phép:**

```tsx
export const MOTION_DURATIONS_MS: Readonly<Record<MotionDurationName, number>> = Object.freeze({
  instant: 120,
  fast: 180,
  standard: 260,
  slow: 340,
});

export const AMBIENT_LOOP_MS = 700;  // Dùng cho skeleton sweep, progress sheen
```

**Quy tắc (mục B):** Chỉ có đúng **năm giá trị**: 120, 180, 260, 340, 700 ms. Không con số nào khác.

**Cách dùng:**
```tsx
import { durationSeconds, MOTION_DURATIONS_MS } from '@/lib/motion/tokens';

// Framer Motion:
transition={{ duration: durationSeconds('fast') }}  // = 0.18 giây

// Tailwind (duration-120, duration-180, duration-260, duration-340, duration-700):
className="transition-colors duration-260"
```

---

### src/lib/motion/useCountUp.ts + src/hooks/useCountUp.ts

**Hai cái KHÔNG phải trùng lặp (CLAUDE.md bẫy 4):**

```tsx
// src/lib/motion/useCountUp.ts — engine thuần (không React, test được không cần DOM)
export function useCountUp(options: UseCountUpOptions): { value: number; start: () => void; }

// src/hooks/useCountUp.ts — lớp bọc React
export function useCountUp(options: UseCountUpOptions): number
```

**Ghi chú:** Bộ đếm chạy số (ví dụ 12 → 13) dùng lớp bọc React từ `src/hooks/useCountUp.ts`.

---

## E. src/components/overlay/

### Modal.tsx, Drawer.tsx, CommandPalette.tsx

Tên + một dòng props.

⚠️ **CẢNH BÁO:** Đặc tả nói "Không màn QC nào được mở hộp thoại". Nên **Modal BỊ CẤM** ở màn này. Dùng xoá bằng vé hoàn tác (A8 + D-05).

---

## F. Bàn phím và khả năng tiếp cận

### src/hooks/useShortcut.ts (dòng 76-129, 131-164, 172-217, 230-242)

```tsx
export interface UseShortcutOptions {
  /** The registry to bind on. Defaults to the application's shared one. */
  readonly registry?: ShortcutRegistry;
  /** False suspends the binding without unmounting the component. */
  readonly enabled?: boolean;
}

export function useShortcut(
  definition: ShortcutDefinition,
  options: UseShortcutOptions = {},
): void { ... }

export interface UseShortcutScopeOptions {
  readonly registry?: ShortcutRegistry;
  /** False releases the claim without unmounting — a closed dialog. */
  readonly active?: boolean;
}

export function useShortcutScope(
  scope: ShortcutScope,
  options: UseShortcutScopeOptions = {},
): void { ... }

export function useGlobalShortcuts(
  handlers: GlobalShortcutHandlers,
  options: Pick<UseShortcutOptions, 'registry'> = {},
): void { ... }

export function useShortcutListener(
  options: Pick<UseShortcutOptions, 'registry'> = {},
): void { ... }
```

---

### src/lib/input/shortcutRegistry.ts (dòng 52-64, 82-100)

```tsx
/** The four floors a binding can live on. */
export type ShortcutScope = 'dialog' | 'sidePanel' | 'canvas' | 'global';

/**
 * Resolution order, highest first. A key press is offered to each scope in
 * this order and the first scope that answers keeps it.
 */
export const SCOPE_PRIORITY: readonly ShortcutScope[] = [
  'dialog',
  'sidePanel',
  'canvas',
  'global',
];

/**
 * A combo taken apart. `mod` is the platform primary modifier: it matches
 * the Control key *or* the Command key, which is what lets one table serve
 * both keyboards.
 */
export interface ParsedCombo {
  readonly code: ShortcutCode;
  readonly mod: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

export interface ShortcutDefinition {
  readonly id: string;
  readonly combo: string;  // e.g. "Ctrl+Z", "W"
  readonly scope: ShortcutScope;
  readonly onTrigger: (event: ShortcutKeyEvent) => void;
  readonly description?: string;
  readonly allowRepeat?: boolean;
  readonly preventDefault?: boolean;
}

export interface ShortcutRegistry {
  attach(window: Window): () => void;
  register(definition: ShortcutDefinition): () => void;
  claimScope(scope: ShortcutScope): () => void;
  reportOverlaps(): void;
}

export const appShortcutRegistry: ShortcutRegistry;
```

**Quy tắc (A12 + R-72):**
1. Phím tắt đăng ký qua `useShortcut` hook, không gọi `addEventListener('keydown')` trực tiếp.
2. Esc phải đóng lớp trên cùng — binding toàn cục `closeTopLayer`.
3. Dialog là modal — phím trong canvas bị swallow khi dialog mở (trừ Esc).
4. Bàn phím là đường đi hạng nhất (R-72).

---

## G. Bộ khẳng định test — src/lib/testing/

### expectSevenStates.ts (dòng 30-46)

```tsx
export interface ScreenRenderResult {
  /** The element the screen was rendered into. */
  readonly container: HTMLElement;
  /** Takes the screen down again before the next state is rendered. */
  readonly unmount?: () => void;
}

export type ScreenRenderer = (scenario: SevenStateScenario) => ScreenRenderResult;
```

**Cách dùng (R-63):**
```tsx
import { expectSevenStates, sevenStateScenarios } from '@/lib/testing';

describe('QcScreen', () => {
  it('xử lý đủ bảy trạng thái', async () => {
    await expectSevenStates(
      sevenStateScenarios('qc', { /* mock data */ }),
      (scenario) => render(<QcScreen.Container {...scenario} />)
    );
  });
});
```

**Bảy trạng thái (A11):** `'Rỗng'`, `'Đang tải'`, `'Một phần'`, `'Lỗi'`, `'Xong'`, `'Không có quyền'`, `'Thu gọn'` — tên chính xác từ `sevenStateScenarios`.

### expectVietnamese.ts (dòng ~726)

```tsx
export function expectVietnamese(element: HTMLElement): void { ... }
```

**Cách dùng (R-67):**
```tsx
describe('QcScreen', () => {
  it('không có tiếng Anh sót lại', () => {
    const { container } = render(<QcScreen />);
    expectVietnamese(container);
  });
});
```

**Quy tắc:** 
- Đọc `src/i18n/vi.json` làm từ điển.
- Mọi chuỗi mới phải thêm khoá vào `vi.json`.
- Soát chữ mất dấu và tiếng Anh sót lại.

### expectAccessible.ts, expectNoRawColor.ts (dòng ~728, ~286)

```tsx
export function expectAccessible(element: HTMLElement): void { ... }
export function expectNoRawColor(element: HTMLElement): void { ... }
```

**Cách dùng (R-72):**
```tsx
it('khả năng tiếp cận OK', () => {
  const { container } = render(<QcScreen />);
  expectAccessible(container);
  expectVietnamese(container);
});
```

### render, fixtures, fakeClock, sevenStateScenarios, subject.ts

Các helper dùng chung cho test.

---

## H. Hai bẫy đã biết — PHẢI XÁC MINH

### H1. Bẫy vòng tiêu điểm (Focus Ring) — R-72

**Bẫy:** Slider, Textarea, Table.Row có vòng tiêu điểm điều khiển bằng state (state-driven), làm HỎNG expectAccessible.

**Trạng thái hiện tại:** Chưa xác minh lại trong branch này. Mở ba component đó, xác minh bẫy có còn đúng không, dán đoạn mã, rồi ghi:
- Nếu còn: worker dựng view nên **TRÁNH** ba cái đó; dùng cái nào thay thế.
- Nếu sửa rồi: ghi rõ đã sửa.

**Cách khắc phục:** Đổi focus ring sang class-based (không state).

---

### H2. Bẫy Storybook CSF — Không-story export

**Bẫy:** Một export không phải story (ví dụ const, hằng số) làm TRẮNG toàn bộ file `.stories.tsx`.

**Cách chữa:** Dùng `meta.excludeStories` trong CSF file.

**Tìm ví dụ:** Grep trong repo tìm `excludeStories`, dán nó, ghi rõ quy tắc cho worker viết stories.

**Bẫy Table.Root/Table.Cell render:** Nếu có, ghi rõ.

---

## I. Token màu (A1) và nhãn (A6)

### Token màu

**Nguồn:** `tailwind.config.ts` và/hoặc CSS variable file.

**Token liên quan tới màn này:**
- `--accent` (A2 — màu nhấn chỉ cho thứ tương tác được)
- `--accent-wash` (FieldRow flash 340ms)
- `--bg-selected` (dòng bảng được chọn)
- `--wall-centerline` (đường trục tường trên canvas)
- `--bg-surface`, `--bg-sunken`, `--bg-hover`, `--bg-flash`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled`
- `--border-default`
- **Trạng thái:** `--state-verified`, `--state-attention`, `--state-violation` (A4 — ĐÚNG BA không quá)

**Luật (A1 + A2 + A4):**
- Màu lấy từ token, cấm hex/rgb/hsl ở tầng giao diện.
- Màu nhấn chỉ dành cho thứ tương tác được.
- Ba màu trạng thái duy nhất; màu thứ tư là thứ A4 tồn tại để chặn.

---

### Nhãn (A6)

**Quy tắc:**
- Nhãn tiếng Việt, **viết thường, kiểu câu** (sentence case).
- Ngoại lệ chữ hoa: mã trục, mã lỗi, tên phím.

**Ví dụ đúng:**
- "chọn tầng" (không "Chọn tầng", không "Chọn Tầng")
- "tường bao" (không "Tường bao")
- "mã trục T-01" (lúc này "T-01" là mã, được chữ hoa)
- "phím Enter" (lúc này "Enter" là tên phím, được chữ hoa)

---

## NOT FOUND / XUNG ĐỘT — Đặc tả nói một đằng, mã nói một nẻo

### 1. Thời gian chuyển động không hợp lệ

**Đặc tả nói:**
- "chạy màu 240ms"
- "nháy nền 400ms"

**Mã nói:** Chỉ có năm giá trị `MOTION_DURATIONS_MS`:
- `instant: 120`
- `fast: 180`
- `standard: 260`
- `slow: 340`
- `AMBIENT_LOOP_MS: 700`

**240 và 400 KHÔNG có trong thang năm giá trị.**

**Giải pháp:** Dùng giá trị gần nhất:
- 240ms → dùng `fast` (180ms) hoặc `standard` (260ms)
- 400ms → dùng `slow` (340ms)

**Luật `local/no-raw-duration` sẽ CHẶN 240 và 400 ở mức error.**

---

### 2. Mã màu thô cho nháy nền

**Đặc tả nói:**
- "hiệu ứng nháy nền hàng: `#EEF4EF`"

**Mã nói:** A1 cấm mã màu thô ở tầng giao diện. Luật `local/no-raw-color` CHẶN hex/rgb/hsl.

**Giải pháp:** Dùng token màu có thật:
- `--bg-flash` (token được định nghĩa cho trạng thái lóe)
- Hoặc `--accent-wash` (nền nhạt của accent)

**Kiểm tra:** Mở `tailwind.config.ts`, tìm token này.

---

### 3. ThicknessField — ô nhập số tự do bị cấm

**Đặc tả nói:**
- "ô nhập độ dày tự do"

**Mã nói:** `ThicknessField` dùng `SegmentedControl` ba lựa chọn cố định (110/220/330/BTCT). Không cho nhập tự do.

**Luật:** R-68 — Màn này không được sửa component chung. Nếu cần ô nhập, đề xuất thêm component mới vào tầng logic.

---

### 4. Modal bị cấm

**Đặc tả nói:**
- "mở hộp thoại xác nhận xoá"

**Mã nói:** A9 + R-68 — Màn không được dùng Modal/Drawer mới. Xoá dùng vé hoàn tác (A8 + D-05).

**Luật:** E15 — không hộp thoại.

---

### 5. Lỗi hard-code

**Đặc tả nói:**
- "hiển thị mã lỗi E-401"

**Mã nói:** R-65 + R-71 — Mã lỗi lấy từ `src/lib/...` định sẵn, không viết thẳng trong màn.

**Kiểm tra:** `rg "E-[0-9]" src/` tìm xem mã lỗi đó có sẵn không.

---

## Tham chiếu thêm

Đọc trước khi dựng màn mới:
1. **CLAUDE.md** — bất biến sản phẩm, kiến trúc, bẫy đã biết.
2. **LUAT_MAN_HINH.md** — luật R-59 đến R-73, quy trình G1–G6.
3. **RULE.md** — luật R-01 đến R-58 (ngoài phạm vi file này).

Các file tài liệu cũ ở `docs/` là TÀI LIỆU CŨ ĐÃ LỖI THỜI — KHÔNG đọc:
- `docs/architecture.md`
- `docs/domain-contracts.md`
- `docs/components-ui.md`
- `docs/components-shell.md`

Chúng mô tả `src/lib/scale.ts` và `src/lib/geometry/area.ts` — những file ĐÃ BỊ XOÁ khỏi repo.

---

**Phiên bản:** 1.0
**Cập nhật:** 31-08-2026
**Status:** Hợp đồng UI hoàn thành — sẵn sàng cho worker lớp 2.
