# UI Component Contract — BillingScreen (T3)

T6 will build the view ONLY from these notes. Props must be copied verbatim from source code, so every interface signature is exact.

---

## 1. Table Component Family

**Path:** `src/components/ui/Table.tsx`

Table is assembled via `Object.assign`:
```ts
export const Table = Object.assign(
  function TableLegacy(props) { ... },
  { Root, Header, Body, Row, Head, Cell, Skeleton, Empty, Error, CheckboxHead, CheckboxCell, Virtual }
);
```

### Table.Root (lines 28–44)
```ts
interface TableRootProps extends React.HTMLAttributes<HTMLDivElement> {
  sortKey?: string | undefined;
  sortDir?: 'asc' | 'desc' | null | undefined;
  onSort?: ((key: string) => void) | undefined;
}
```
**Example:**
```tsx
<Table.Root sortKey="area" sortDir="asc" onSort={(key) => handleSort(key)}>
  <Table.Header>...</Table.Header>
  <Table.Body>...</Table.Body>
</Table.Root>
```

### Table.Header (lines 49–56)
```ts
function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>)
```
Renders sticky header with `bg-bg-sunken`. Wraps `Table.Head` cells.

### Table.Body (lines 60–67)
```ts
function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>)
```

### Table.Row (lines 71–127)
```ts
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;
  isAttention?: boolean;
  isFlash?: boolean;
  layoutId?: string;
}
```

### Table.Head (lines 139–183)
```ts
interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
  sticky?: boolean;
}
```
Sticky header cell (h-10, px-3), displays sort chevron when active.

### Table.Cell (lines 192–206)
```ts
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean;
}
```
Body cell (h-10, px-3). For right-aligned numbers: add `className="text-right"`.

### Table.Skeleton (lines 210–227)
```ts
interface TableSkeletonProps {
  columns: number;
  rows?: number;  // default 8
}
```
Renders 8 skeleton rows by default. Use for loading state. **This is what T6 uses for state 2 (loading).**

**Example:**
```tsx
<Table.Body>
  <Table.Skeleton columns={5} rows={8} />
</Table.Body>
```

### Table.Empty (lines 232–250)
```ts
interface TableEmptyProps {
  colSpan: number;
  message?: string;  // default 'Không có dữ liệu'
}
```

### Table.Error (lines 254–274)
```ts
interface TableErrorProps {
  colSpan: number;
  message?: string;
  onRetry?: () => void;
}
```

---

## 2. Badge Component

**Path:** `src/components/ui/Badge.tsx` (lines 5–51)

```ts
type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
  noDot?: boolean;  // suppress leading dot indicator
}
```

**Variant backgrounds (lines 18–23):**
- `verified`: `bg-state-verified-tint text-state-verified-text`
- `attention`: `bg-state-attention-tint text-state-attention-text`
- `violation`: `bg-state-violation-tint text-state-violation-text`
- `neutral`: `bg-bg-sunken text-text-secondary`

**Example:**
```tsx
<Badge variant="attention" noDot>Đề xuất</Badge>
```

---

## 3. Button + buttonVariants

**Path:** `src/components/ui/Button.tsx` (lines 6–19), `src/components/ui/buttonVariants.ts`

```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
  icon?: React.ReactNode;  // @deprecated use iconBefore
  iconOnly?: boolean;
  loading?: boolean;
  shortcut?: string;
  fullWidth?: boolean;
}
```

**Variants (buttonVariants.ts lines 6–11):**
- `primary`: `bg-accent text-bg-surface` — full fill
- `secondary`: `bg-bg-surface text-text-primary border border-border-default` — subtle
- `ghost`: `bg-transparent text-text-secondary` — **"Đổi gói" button is this** (lines 9)
- `danger`: `bg-danger-tint text-state-violation-text`

**Sizes (buttonVariants.ts lines 13–17):**
- `sm`: h-8, text-sm, px-3
- `md`: h-9, text-sm, px-4 (default)
- `lg`: h-10, text-base, px-5

**Example:**
```tsx
<Button variant="ghost" size="md" onClick={handleChange}>Đổi gói</Button>
```

---

## 4. SegmentedControl

**Path:** `src/components/ui/SegmentedControl.tsx` (lines 6–24, 31–50, 101–117, 121–178)

```ts
interface SegmentedControlOption<T extends string = string> {
  label: string;
  value: T;
  swatch?: string;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value?: T | undefined;
  defaultValue?: T | undefined;
  onChange?: ((value: T) => void) | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  disabled?: boolean | undefined;
  isLoading?: boolean | undefined;
}

export function useSegmentedControl<T extends string>({
  value,
  defaultValue,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  const initial = value ?? defaultValue ?? options[0]?.value;
  const [internalValue, setInternalValue] = useState<T>(initial as T);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const handleChange = (newValue: T, disabled?: boolean) => {
    if (disabled || currentValue === newValue) return;
    if (!isControlled) setInternalValue(newValue);
    onChange?.(newValue);
  };
  return { currentValue, handleChange };
}

interface SegmentedRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export interface SegmentedItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  swatch?: string | undefined;
  isActive?: boolean;
  layoutId?: string;
}

export const SegmentedControl = Object.assign(
  function SegmentedControlLegacy<T extends string = string>(props: SegmentedControlProps<T>) { ... },
  { Root: SegmentedRoot, Item: SegmentedItem }
);
```

**Controlled usage (for period selection):**
```tsx
<SegmentedControl
  options={[
    { label: 'Theo tháng', value: 'monthly' },
    { label: 'Theo năm', value: 'yearly' },
  ]}
  value={period}
  onChange={onPeriodChange}
  aria-label="Kỳ thanh toán"
/>
```

---

## 5. IconButton

**Path:** `src/components/ui/IconButton.tsx` (lines 6–16, 24–63)

```ts
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;  // REQUIRED per spec (A12)
  isActive?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';  // Default 'md'
  tooltip?: boolean;  // Show tooltip on hover after 400ms delay
}
```

**Icons from:** `lucide-react` — a real import example from the repo:
```tsx
import { Download, ChevronUp, ChevronDown, AlertCircle, Inbox } from 'lucide-react';

<IconButton icon={<Download size={18} />} aria-label="Tải hoá đơn PDF" />
```

---

## 6. FieldRow

**Path:** `src/components/ui/FieldRow.tsx` (lines 5–80)

```ts
interface FieldRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
  isMixed?: boolean;  // Show "—" dash for undefined value
  isReadOnly?: boolean;
  readOnlyReason?: string;
  isLoading?: boolean;
  flash?: boolean;  // Flash accent-wash background after write (340ms)
  collapsed?: boolean;  // Renders nothing
}
```

**Usage for estimate rows:**
```tsx
<FieldRow label="Diện tích tháng này" isLast={false}>2.480,00 m²</FieldRow>
<FieldRow label="Đơn giá" isLast={false}>300.000 ₫</FieldRow>
<FieldRow label="Tạm tính" isLast>1.742.000 ₫</FieldRow>
```

**Suitability for billing estimate:** Three rows matching invoice line items style (40%/60% label/value split) ✓

---

## 7. InlineAlert

**Path:** `src/components/feedback/InlineAlert.tsx` (lines 7–82)

```ts
type InlineAlertLevel = 'verified' | 'attention' | 'violation';

interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
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

**For quota warnings and degraded notices:**
```tsx
<InlineAlert
  level="attention"
  title="Sắp hết hạn mức"
  message="Còn 500 m². Nâng gói để tăng giới hạn."
  action={{
    label: 'Nâng gói',
    onClick: handleUpgrade,
    variant: 'secondary',
  }}
/>
```

---

## 8. Skeleton

**Path:** `src/components/feedback/Skeleton.tsx` (lines 4–60)

```ts
type SkeletonPreset = 'table-row' | 'project-card' | 'property-panel' | 'canvas';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  preset: SkeletonPreset;
}
```

**For billing screen:**
- **Loading table rows:** Use `preset="table-row"` wrapped in 8 `<tr>` loops (see Table.Skeleton above)
- **Plan cards:** Likely use `preset="project-card"` (lines 27–34) — shows header + 3 skeleton lines

---

## 9. EmptyState

**Path:** `src/components/feedback/EmptyState.tsx` (lines 6–54)

```ts
interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
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

**For empty invoice state:**
```tsx
<EmptyState
  icon={<Inbox className="text-text-tertiary" />}
  title="Chưa có hoá đơn nào"
  description="Bạn sẽ nhận hoá đơn khi sử dụng dịch vụ."
/>
```

---

## 10. ScreenErrorBoundary

**Path:** `src/components/feedback/ScreenErrorBoundary.tsx` (lines 42–106)

```ts
interface ScreenErrorFallback {
  readonly report: ScreenErrorReport;
  readonly retry: () => void;
}

interface ScreenErrorBoundaryProps {
  readonly screenId: string;
  readonly children: ReactNode;
  readonly renderFallback: (fallback: ScreenErrorFallback) => ReactNode;
  readonly onError?: (report: ScreenErrorReport) => void;
}

export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, ScreenErrorBoundaryState> {
  public override state: ScreenErrorBoundaryState = { report: null };
  // ...
}
```

**Where report comes from:** `src/lib/screen-state/screenErrorBoundary.ts`
```ts
interface ScreenErrorReport {
  readonly description: string;  // Vietnamese error message
  readonly code: string;         // Error code (e.g., "ERR_403")
  readonly retryable: boolean;   // Whether retry is worth offering
}
```

**How src/App.tsx wires it (reference khuôn mẫu):**
```tsx
<ScreenErrorBoundary
  screenId="billing"
  key={activeScreen}  // Remount on screen change
  renderFallback={({ report, retry }) => (
    <EmptyState
      icon={<AlertCircle />}
      title="Đã xảy ra lỗi"
      description={report.description}
      action={report.retryable ? { label: 'Thử lại', onClick: retry } : undefined}
    />
  )}
>
  <BillingScreen />
</ScreenErrorBoundary>
```

---

## 11. Toast

**Path:** `src/components/feedback/Toast.tsx` (lines 15–256)

```ts
interface ToastMessage {
  id: string;
  message: string;
  onUndo?: () => void;
  state?: 'verified' | 'attention' | 'violation';
}

interface ToastItemProps {
  toast: ToastMessage;
  index: number;
  onRemove: (id: string) => void;
  resetKey?: number;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within Toast.Provider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // ...
  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-2">
        {displaySlots.map((toast, index) => (
          <ToastItem key={toast.id} toast={toast} index={index} onRemove={handleRemoveSlot} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const Toast = { Provider: ToastProvider, Item: ToastItem };
```

**Screen usage (hook only, T5 component lifecycle):**
```tsx
const { addToast } = useToast();

const handleAction = async () => {
  try {
    await api.changePlan();
    addToast({
      message: 'Nâng gói thành công',
      state: 'verified',
      onUndo: () => api.revertChangePlan(),
    });
  } catch (err) {
    addToast({
      message: 'Không thể nâng gói. Thử lại?',
      state: 'violation',
    });
  }
};
```

---

## 12. Testing Utilities

### expectSevenStates

**Path:** `src/lib/testing/expectSevenStates.ts` (lines 38–100)

```ts
export interface ScreenRenderResult {
  readonly container: HTMLElement;
  readonly unmount?: () => void;
}

export type ScreenRenderer = (scenario: SevenStateScenario) => ScreenRenderResult;

/**
 * Validates that a screen renders successfully for all seven states.
 * Throws Error with Vietnamese message if state is missing/duplicated/fails to render.
 */
export function expectSevenStates(
  scenarios: readonly SevenStateScenario[],
  renderer: ScreenRenderer
): void
```

### sevenStateScenarios

**Path:** `src/lib/testing/sevenStateScenarios.ts` (lines 25–76)

```ts
export const SEVEN_STATES = [
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
] as const;

export type SevenState = (typeof SEVEN_STATES)[number];

export const SEVEN_STATE_LABELS: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  forbidden: 'không có quyền',
  collapsed: 'thu gọn',
};

export interface SevenStateRow {
  readonly id: string;
  readonly label: string;
}

export interface SevenStateScenario {
  readonly state: SevenState;
  readonly label: string;
  readonly rows: readonly SevenStateRow[];
  readonly totalCount: number;
  readonly isLoading: boolean;
  readonly isCollapsed: boolean;
  readonly canView: boolean;
  readonly error: unknown;
}

export type SevenStateScenarioOptions = { ... }; // for overrides
export function createSevenStateScenarios(options?: Partial<SevenStateScenarioOptions>): readonly SevenStateScenario[]
```

### render

**Path:** `src/lib/testing/render.tsx` (lines 31–50 + setup)

```ts
export function renderWithProviders(
  component: React.ReactNode,
  options?: { ... }
): ScreenRenderResult

export function configureTestProviders(config: {
  resetStore?: () => void;
  // ... other injections
}): void
```

**Setup in vitest.setup.ts:**
```ts
import { configureTestProviders, createStoreReset } from '@/lib/testing/render';
import { useStore } from '@/store';

configureTestProviders({ resetStore: createStoreReset(useStore) });
```

**Usage in test:**
```ts
const { container } = renderWithProviders(<BillingScreen {...props} />);
expect(container.textContent).toContain('Thanh toán');
```

### expectVietnamese

**Path:** `src/lib/testing/expectVietnamese.ts` (lines 1–50)

```ts
export interface ExpectVietnameseOptions {
  ignore?: string[];      // words to skip
  allowWords?: string[];  // additional approved words
}

/**
 * Asserts all text content is Vietnamese (with diacritics or in vocab)
 * or is an English word on the approved list.
 * Throws Error listing words that appear to be English or missing diacritics.
 */
export function expectVietnamese(
  container: HTMLElement,
  options?: ExpectVietnameseOptions
): void
```

**Usage in test:**
```ts
const { container } = renderWithProviders(<BillingScreen {...props} />);
expectVietnamese(container, { ignore: ['PDF'] });
```

### expectAccessible

**Path:** `src/lib/testing/expectAccessible.ts` (lines 1–50)

```ts
export interface AccessibilityOptions {
  variables?: Record<string, string>;  // CSS custom property values
  requireResolvedContrast?: boolean;   // fail if contrast unknown
}

/**
 * Asserts keyboard navigation, focus visibility (2px ring-offset-2),
 * aria-labels on icon buttons, and contrast ratios (4.5:1).
 * Throws Error naming each failing element.
 */
export function expectAccessible(
  container: HTMLElement,
  options?: AccessibilityOptions
): void
```

**Usage in test:**
```ts
expectAccessible(container);
```

### expectNoRawColor

**Path:** `src/lib/testing/expectNoRawColor.ts`

```ts
/**
 * Asserts no raw hex, rgb(), hsl() colors appear in computed styles.
 * All colors must be CSS custom properties from COLOR_TOKEN_NAMES.
 */
export function expectNoRawColor(container: HTMLElement): void
```

---

## 13. COLOR_TOKEN_NAMES and Token Verification

**Path:** `src/lib/coloring/scales.ts` (lines 62–129)

**All declared tokens (verified from globals.css):**

### Interface & background tokens ✓
- `--accent`, `--accent-hover`, `--accent-active`, `--accent-wash`
- `--bg-app`, `--bg-surface`, `--bg-sunken`, `--bg-hover`, `--bg-overlay`, `--bg-selected`, `--bg-flash`
- `--border-default`
- `--text-primary`, `--text-secondary`, `--text-muted`

### State tokens ✓
- `--state-verified`, `--state-verified-text`, `--state-verified-tint`
- `--state-attention`, `--state-attention-text`, `--state-attention-tint`
- `--state-violation`, `--state-violation-text`, `--state-violation-tint`

### Danger (not used in billing) ✓
- `--danger-tint`, `--danger-border`

### Material wall colors (3D only) ✓
- `--wall-110`, `--wall-220`, `--wall-330`, `--wall-idle`

### Canvas (3D scene) ✓
- `--canvas-2d`, `--canvas-2d-grid`, `--canvas-3d`, `--canvas-3d-ground`, `--canvas-3d-horizon`

### Absolute colors ✓
- `--white`, `--black`

### Shadow colors ✓
- `--shadow-color-rest`, `--shadow-color-float`, `--shadow-color-overlay`, `--shadow-color-panel`, `--shadow-color-modal`

**NOT FOUND (Q3 decision):**
- `--accent-border` — does not exist. Use `--accent` 1px instead.

**Tailwind token syntax (from tailwind.config.ts lines 22–77):**

Tokens are written as CSS custom properties inside Tailwind color aliases:

```ts
// In tailwind.config.ts
colors: {
  accent: {
    DEFAULT: 'var(--accent)',
    hover: 'var(--accent-hover)',
    active: 'var(--accent-active)',
    wash: 'var(--accent-wash)',
  },
  bg: {
    app: 'var(--bg-app)',
    surface: 'var(--bg-surface)',
    sunken: 'var(--bg-sunken)',
    // ...
  },
  state: {
    'verified': 'var(--state-verified)',
    'verified-text': 'var(--state-verified-text)',
    'verified-tint': 'var(--state-verified-tint)',
    'attention': 'var(--state-attention)',
    // ...
  },
  // ...
}
```

**In JSX, write:**
```tsx
className="bg-bg-sunken text-text-secondary"  // ✓ Tailwind class
className="bg-accent text-state-violation"     // ✓ Tailwind class
```

**NOT:**
```tsx
className="bg-[--bg-sunken]"  // ✗ CSS variable syntax (not aliased)
className="bg-[#f1eee8]"      // ✗ Raw hex (violates A1)
```

---

## 14. Responsive Breakpoints

**From existing screens (ProjectDashboard.tsx, AccountSettings.tsx):**

**Tailwind breakpoints used in repo:**
- `md:` (768px) — medium screens, tablets
- `lg:` (1024px) — large screens, desktops
- Below 1024px: adapt layout for smaller viewports

**Example from project (responsive adjustment):**
```tsx
// Sidebar + content layout
<div className="flex md:flex-col lg:flex-row gap-4">
  <aside className="w-full lg:w-64 md:w-full">
    {/* Settings sidebar */}
  </aside>
  <main className="flex-1">
    {/* Main content */}
  </main>
</div>
```

**For billing screen (8-column invoice table):**
```tsx
// On mobile/tablet: stack or reduce columns
<div className="overflow-x-auto lg:overflow-x-visible">
  <Table.Root>
    {/* Columns visible only on lg: */}
    <Table.Head className="hidden lg:table-cell">Mã</Table.Head>
  </Table.Root>
</div>
```

---

## NOT FOUND

Nothing is missing from the component library except:

- **`--accent-border` token** — does not exist in COLOR_TOKEN_NAMES or globals.css (Q3)
- **`formatMoney` function** — nope, khai trong useBillingScreen.ts (Q2 nợ P-01b)

Everything else checks out. All 14 items in the spec are implementable with components and utilities in the repo.

---

## Summary

**14/14 items documented:**
1. ✓ Table + family (10 components)
2. ✓ Badge (4 variants)
3. ✓ Button + buttonVariants (4 variants × 3 sizes)
4. ✓ SegmentedControl (hook + root/item)
5. ✓ IconButton
6. ✓ FieldRow
7. ✓ InlineAlert
8. ✓ Skeleton (4 presets, 'table-row' and 'project-card' for billing)
9. ✓ EmptyState
10. ✓ ScreenErrorBoundary (wraps view, renderFallback pattern)
11. ✓ Toast (provider + hook)
12. ✓ Testing: expectSevenStates, sevenStateScenarios, render, expectVietnamese, expectAccessible, expectNoRawColor
13. ✓ COLOR_TOKEN_NAMES (43 tokens), --accent-border NOT FOUND, Tailwind syntax
14. ✓ Responsive breakpoints (md:/lg: from existing screens)

---

**Notes for T6:**
- Table.Skeleton renders 8 rows of skeleton loading state (state 2)
- SegmentedControl for period toggle (monthly/yearly)
- Badge with variant mapping: paid→neutral, pending→attention, overdue→violation
- Button variant "ghost" for "Đổi gói"
- FieldRow layout (40/60 split) suits estimate table rows (3 rows)
- InlineAlert for quota warnings (level attention)
- EmptyState for no invoices (state 1)
- ScreenErrorBoundary catches rendering crashes (state 4)
- Toast for undo notifications
- All strings are Vietnamese in JSX; no hard-code color hex values
- Tailwind classes use `bg-bg-surface`, not `bg-[--bg-surface]` or `bg-[#ffffff]`
