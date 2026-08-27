# Contract: Upload Screen UI Kit & Design Tokens

**Last surveyed:** 2026-08-27

---

## ⚠️ OPEN CONFLICT: Motion duration 240ms is not legal

**Rule B violation:** The screen spec requires 240ms for "card reveal" animation, but `src/lib/motion/tokens.ts:62-67` defines exactly **five legal durations**:

```
instant:  120 ms
fast:     180 ms
standard: 260 ms  ← nearest to 240ms
slow:     340 ms
```

Plus one non-interactive loop duration:
```
AMBIENT_LOOP_MS: 700 ms (for skeleton sweeps, progress bars)
```

**Rule:** `local/no-raw-duration` (ESLint, error level) forbids any other value. **Action required:** Reassign 240ms animations to `standard` (260ms) or `fast` (180ms) before implementing.

---

## COMPONENTS

### 1. `src/components/ui/Select.tsx`

**APIs:** Two distinct patterns exist:

#### Compound API (recommended for new work)
Use this. Provides full control.

- **`Select.Root`** (wrapper)
  ```typescript
  interface SelectRootProps {
    value?: string | undefined;
    onChange?: ((val: string) => void) | undefined;
    options?: SelectOption[] | undefined;
    isOpen?: boolean | undefined;
    onOpenChange?: ((open: boolean) => void) | undefined;
    children: React.ReactNode;
    className?: string | undefined;
    disabled?: boolean | undefined;
  }
  ```

- **`Select.Label`** (optional label)
  ```typescript
  extends React.LabelHTMLAttributes<HTMLLabelElement>
  ```

- **`Select.Trigger`** (button that opens dropdown)
  ```typescript
  interface SelectTriggerProps
    extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    placeholder?: string;  // default: 'Chọn...'
    options?: SelectOption[];
  }
  ```

- **`Select.Content`** (dropdown portal)
  ```typescript
  extends React.HTMLAttributes<HTMLDivElement>
  ```

- **`Select.Item`** (list item)
  ```typescript
  interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;  // REQUIRED
    children: React.ReactNode;
    index?: number;
  }
  ```

- **`Select.Empty`** (empty state fallback)
  ```typescript
  extends React.HTMLAttributes<HTMLDivElement>
  // default: 'Không có lựa chọn'
  ```

- **`Select.Skeleton`** (loading state)
  ```typescript
  interface { label?: React.ReactNode; className?: string; }
  ```

#### Legacy API (backward compatible; avoid in new work)
```typescript
interface LegacySelectProps {
  options: SelectOption[];  // REQUIRED
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;  // default: 'Chọn...'
  className?: string;
  disabled?: boolean;  // default: false
  isReadOnly?: boolean;  // default: false
  isLoading?: boolean;  // default: false
  label?: string;
}
```

**SelectOption type:**
```typescript
interface SelectOption {
  label: string;
  value: string;
}
```

**Evidence:** Legacy and compound APIs coexist; compound is newer (from `:20-370`, compound; from `:377`, legacy).

**Usage example (Compound):**
```tsx
<Select.Root value={floor} onChange={setFloor} options={options}>
  <Select.Label>Chọn tầng</Select.Label>
  <Select.Trigger placeholder="Tầng..." options={options} />
  <Select.Content>
    {options.length === 0 ? (
      <Select.Empty />
    ) : (
      options.map((opt, idx) => (
        <Select.Item key={opt.value} value={opt.value} index={idx}>
          {opt.label}
        </Select.Item>
      ))
    )}
  </Select.Content>
</Select.Root>
```

**Usage example (Legacy):**
```tsx
<Select
  options={options}
  value={floor}
  onChange={setFloor}
  label="Tầng"
  placeholder="Chọn tầng..."
/>
```

---

### 2. `src/components/ui/Badge.tsx`

**Exported:** `Badge`

**Props:**
```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;  // REQUIRED
  children: React.ReactNode;
  noDot?: boolean;  // default: false
}

type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';
```

**noDot:** Suppresses the leading dot indicator.

**Variants & styling:**
- `'verified'`: tint=`bg-state-verified-tint`, text=`text-state-verified-text`, dot=`bg-state-verified`
- `'attention'`: tint=`bg-state-attention-tint`, text=`text-state-attention-text`, dot=`bg-state-attention`
- `'violation'`: tint=`bg-state-violation-tint`, text=`text-state-violation-text`, dot=`bg-state-violation`
- `'neutral'`: tint=`bg-bg-sunken`, text=`text-text-secondary`, dot=`bg-text-muted`

**Dimensions:** h-[22px], rounded-[6px], text-[13px], font-medium, inline-flex

**Usage example:**
```tsx
<Badge variant="verified">Đã duyệt</Badge>
<Badge variant="attention" noDot>Cần kiểm tra</Badge>
<Badge variant="violation">Vi phạm</Badge>
```

---

### 3. `src/components/ui/Button.tsx`

**Exported:** `Button`

**Props:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;  // default: 'primary'
  size?: ButtonSize;  // default: 'md'
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
  icon?: React.ReactNode;  // @deprecated use iconBefore
  iconOnly?: boolean;  // default: false
  loading?: boolean;  // default: false
  disabled?: boolean;
  shortcut?: string;  // shows in tooltip
  fullWidth?: boolean;  // default: false
  children: React.ReactNode;
}
```

**Variants (from `buttonVariants.ts`):**
- `'primary'`: accent bg, white text, hover/active variant colors
- `'secondary'`: surface bg, border, primary text
- `'ghost'`: transparent, secondary text, hover state
- `'danger'`: danger-tint bg, violation text

**Sizes (from `buttonVariants.ts`):**
- `'sm'`: h-8, text-sm, px-3
- `'md'`: h-9, text-sm, px-4 (default)
- `'lg'`: h-10, text-base, px-5

**Accessibility:** `aria-label` required for `iconOnly` buttons.

**Usage example:**
```tsx
<Button variant="primary" onClick={handleSave}>Lưu</Button>
<Button variant="secondary" size="sm">Huỷ</Button>
<Button iconBefore={<Plus size={18} />} variant="primary">Thêm mới</Button>
<Button variant="primary" loading>Đang lưu...</Button>
```

---

### 4. `src/components/ui/IconButton.tsx`

**Exported:** `IconButton`

**Props:**
```typescript
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;  // REQUIRED
  'aria-label': string;  // REQUIRED — accessible name
  isActive?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';  // default: 'md'
  tooltip?: boolean;  // default: true
}
```

**Accessible name:** Must supply **`aria-label`** prop. The label is used as the tooltip text if `tooltip=true` (default delay 400ms).

**Sizes:**
- `'sm'`: h-8 w-8
- `'md'`: h-9 w-9 (default)
- `'lg'`: h-10 w-10

**Usage example:**
```tsx
<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" />
<IconButton
  icon={<Bell size={18} />}
  aria-label="Thông báo"
  isActive={isNotified}
  size="lg"
/>
<IconButton
  icon={<Trash2 size={18} />}
  aria-label="Xoá"
  disabled
/>
```

---

### 5. `src/components/ui/NumericField.tsx`

**Exported:** `NumericField`

**Props:**
```typescript
interface NumericFieldProps
  extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'>,
    UseNumericFieldProps {
  unit?: string;  // suffix label
}

// Extends from UseNumericFieldProps:
// value: number
// onChange: (val: number) => void
// min?: number
// max?: number

// Plus InputProps (from Input component):
// disabled?: boolean
// isReadOnly?: boolean
// isLoading?: boolean
```

**Behavior:** Renders stepper buttons (up/down) on hover. Monospace font. Right-aligned text.

**Usage example:**
```tsx
<NumericField
  value={width}
  onChange={setWidth}
  min={0}
  max={5000}
  unit="mm"
/>
```

---

### 6. `src/components/feedback/InlineAlert.tsx`

**Exported:** `InlineAlert`

**Props:**
```typescript
interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  level: InlineAlertLevel;  // REQUIRED — 'verified' | 'attention' | 'violation'
  title?: string;
  message: string;  // REQUIRED
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}
```

**Role:** `role="alert"` — announces on appearance.

**Variants:**
- `'verified'`: green tint & text
- `'attention'`: yellow tint & text
- `'violation'`: red tint & text

**Usage example:**
```tsx
<InlineAlert
  level="violation"
  title="Giao cắt không hợp lệ"
  message="Cửa sổ đang đè lên vị trí của cột."
  action={{
    label: 'Sửa lỗi',
    onClick: () => handleFix(),
    variant: 'secondary',
  }}
/>

<InlineAlert
  level="attention"
  message="Đang chỉnh sửa ở chế độ offline."
/>
```

---

### 7. `src/components/feedback/EmptyState.tsx`

**Exported:** `EmptyState`

**Props:**
```typescript
interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;  // REQUIRED
  title: string;  // REQUIRED
  description: string;  // REQUIRED
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}
```

**Layout:** Flexbox column, centered, full height. Icon (32px) + title (16px) + description (14px) + optional button.

**Icon cloning:** Component clones icon to force `size={32}` and `strokeWidth={1.5}` if not set.

**Usage example:**
```tsx
<EmptyState
  icon={<UploadCloud size={32} />}
  title="Chưa có tệp nào"
  description="Kéo thả hoặc nhấp để tải lên mặt bằng"
  action={{
    label: 'Chọn tệp',
    onClick: () => fileInput.current?.click(),
    variant: 'primary',
  }}
/>
```

---

### 8. `src/components/feedback/Skeleton.tsx`

**Exported:** `Skeleton`

**Props:**
```typescript
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  preset: SkeletonPreset;  // REQUIRED
}

type SkeletonPreset = 'table-row' | 'project-card' | 'property-panel' | 'canvas';
```

**Animation:** `animate-pulse` (paced at `AMBIENT_LOOP_MS * 3 = 2100ms`), respects `motion-reduce` preference.

**Presets:**
- `'table-row'`: Flex row, checkbox + 3 field placeholders
- `'project-card'`: Card layout with image + title + description
- `'property-panel'`: Panel with title + 4 key-value rows
- `'canvas'`: Full-height canvas with grid overlay and toolbar placeholders

**Usage example:**
```tsx
{isLoading ? (
  <Skeleton preset="table-row" />
) : (
  <FloorRow floor={floor} />
)}
```

---

### 9. `src/components/feedback/Toast.tsx`

**Exported:** `Toast.Provider`, `Toast.Item`, `useToast` hook

**Toast.Provider (wrapper):**
```typescript
function ToastProvider({ children }: { children: React.ReactNode })
```

**useToast hook:**
```typescript
function useToast() {
  return { addToast, removeToast }
}

// addToast signature:
addToast({
  message: string;     // REQUIRED
  onUndo?: () => void;
  state?: 'verified' | 'attention' | 'violation';
})
```

**Toast.Item (internal, used by Provider):**
```typescript
interface ToastItemProps {
  toast: ToastMessage;
  index: number;
  onRemove: (id: string) => void;
  resetKey?: number;
}

interface ToastMessage {
  id: string;
  message: string;
  onUndo?: () => void;
  state?: 'verified' | 'attention' | 'violation';
}
```

**Behavior:**
- Fixed bottom-right corner (z-50)
- Auto-dismiss after `UNDO_WINDOW_MS` (8 seconds by default)
- Progress bar (2px, bottom) animates dismissal countdown
- Grouped display: first toast full size, second toast peek (4px), third+ grouped as summary
- "Hoàn tác" button rendered if `onUndo` provided
- Grouped toasts can detect topic ("tường", "cửa") and summarize

**Usage example:**
```tsx
const { addToast } = useToast();

addToast({
  message: 'Đã tạo tầng mới',
  state: 'verified',
  onUndo: () => handleUndoFloorCreate(),
});
```

---

## DESIGN TOKENS

**Source:** `src/styles/globals.css` (declared under `:root` for light, `html.dark` for dark theme)

### Page & Card Surfaces

| Purpose | Light | Dark | Tailwind class |
|---------|-------|------|-----------------|
| **App background** | `#f6f4f0` | `#1c1b19` | `bg-bg-app` |
| **Card/surface bg** | `#ffffff` | `#262421` | `bg-bg-surface` |
| **Sunken/tertiary bg** | `#f1eee8` | `#151413` | `bg-bg-sunken` |
| **Hover state bg** | `rgba(43,42,40,0.035)` | `rgba(236,233,227,0.06)` | `bg-bg-hover` |
| **Selected state bg** | `#edf2f6` | `#23303a` | `bg-bg-selected` |

### Borders

| Purpose | Light | Dark | Tailwind class |
|---------|-------|------|-----------------|
| **Default border** | `#e3ded6` | `#3a3733` | `border-border-default` |

### Text Colors

| Purpose | Light | Dark | Tailwind class |
|---------|-------|------|-----------------|
| **Primary text** | `#33322f` | `#ece9e3` | `text-text-primary` |
| **Secondary text** | `#6b6862` | `#b2ada4` | `text-text-secondary` |
| **Muted text** | `#999691` | `#969189` | `text-text-muted` |

### Three State Colors (A4: exactly three, never four)

| State | Light color | Dark color | Tailwind classes |
|-------|-------------|-----------|---|
| **Verified** | `#6b9a79` (solid) | `#7fb18d` (solid) | `bg-state-verified`, `text-state-verified-text`, `bg-state-verified-tint` |
| **Attention** | `#be9b4f` (solid) | `#d4b46a` (solid) | `bg-state-attention`, `text-state-attention-text`, `bg-state-attention-tint` |
| **Violation** | `#c0685a` (solid) | `#d68577` (solid) | `bg-state-violation`, `text-state-violation-text`, `bg-state-violation-tint` |

**Tint variants** (light background for state):
- verified-tint: `#eef4ef` (light) / `#1f2b23` (dark)
- attention-tint: `#fcf6e6` (light) / `#2c2617` (dark)
- violation-tint: `#f9efed` (light) / `#2e1f1c` (dark)

---

## MOTION TOKENS

**Source:** `src/lib/motion/tokens.ts:62-87`

### Five Legal Durations

```typescript
export const MOTION_DURATIONS_MS = {
  instant:  120,   // Hover, focus ring, press
  fast:     180,   // Dropdown, tooltip
  standard: 260,   // Panels, toasts (default)
  slow:     340,   // View change, camera move
  // Plus AMBIENT_LOOP_MS: 700 (skeleton sweeps, progress loops)
};
```

### Consumption

**In CSS/Tailwind:**
```tsx
className="transition-all duration-260"  // Use duration-120, 180, 260, 340, 700
```

**In JavaScript (framer-motion):**
```tsx
import { durationSeconds } from '@/lib/motion/tokens';

<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: durationSeconds('standard') }}
/>
```

**In hooks:**
```tsx
const { text } = useCountUp(area, {
  // No explicit duration — COUNT_UP_DURATION is fixed at 'standard' (260ms)
});
```

### Three Easing Curves

```typescript
export const MOTION_EASINGS = {
  enter: [0, 0, 0.2, 1],    // Decelerate: fast start, slow end
  exit:  [0.4, 0, 1, 1],    // Accelerate: slow start, fast end
  inOut: [0.4, 0, 0.6, 1],  // Symmetric easing both ends
};
```

---

## FRAMER-MOTION USAGE

**Source:** `src/components/motion/index.ts`

### What's Exported

```typescript
// From framer-motion:
export { motion, AnimatePresence, useAnimation }

// Custom provider:
export function MotionProvider({ children })
```

**Constraint:** This is the ONLY place in the product allowed to import `framer-motion` (R-39, enforced by ESLint `local/no-framer-outside-motion`).

### How a Screen Uses Animations

**Setup (once at app root):**
```tsx
import { MotionProvider } from '@/components/motion';

<MotionProvider>
  <App />
</MotionProvider>
```

**In screen code:**
```tsx
import { motion, AnimatePresence } from '@/components/motion';
import { durationSeconds } from '@/lib/motion/tokens';

// Shared-layout animation: NOT available directly to screens
// (would require importing from framer-motion, which is blocked)

// Height + opacity reveal: available via motion.div
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: durationSeconds('standard') }}
    >
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

### Shared-Layout Animation

**Status:** NOT reachable from a screen under the R-39 rule. Shared-layout animations require `layoutId` and coordinated `layout` props, both of which only exist in the `framer-motion` import that screens are forbidden to access. A screen cannot implement them without violating the ESLint rule.

**If needed:** Extract the animated portion into `src/components/motion/` and re-export it as a composed component (the pattern used for `MotionProvider`).

---

## EXISTING SCREEN-LEVEL PARTS

### Drop Zone / File Drag-and-Drop

**Hook:** `src/hooks/useDragDropSession.ts`

**Scope:** **IN-CANVAS DRAGGING ONLY**. This hook is for moving items within the floor plan canvas (furniture, room elements). It is **not** for OS-level file drag-and-drop from the file system.

**What it returns:**
```typescript
interface DragDropSessionApi {
  state: DragDropState;
  ghost: ToolPreview | null;    // Visual ghost for the draft layer
  statusText: string | null;     // Vietnamese verdict for status bar
  pickUp(item, at, mode?): void;
  moveTo(at): void;
  drop(): void;
  cancel(): void;
  handleKeyDown(event): boolean; // Consumes arrow/Esc keys
  cursorCss(tool): string;       // CSS cursor for the canvas
}
```

**File drag-and-drop:** Must implement custom logic using browser `onDrop`/`onDragOver` events.

---

### File Row / Thumbnail / Progress Bar / Count-up

**Existing patterns found:**

#### Count-up Number
- **Hook:** `src/hooks/useCountUp.ts` (React wrapper)
- **Engine:** `src/lib/motion/useCountUp.ts` (pure, no React)
- **Usage:**
  ```tsx
  const { text } = useCountUp(248.60, { format: { fractionDigits: 2 } });
  return <span>{text}</span>;  // Renders "248,60" with animation
  ```
- **Duration:** Fixed at `standard` (260ms), not configurable.
- **Reduced motion:** Cuts to final value instantly; respects OS preference.

#### Progress Bar (2px)
- **Example:** Toast component bottom bar (`Toast.tsx:136-138`)
  ```tsx
  <div className="absolute bottom-0 left-0 h-[2px] bg-bg-sunken w-full">
    <div className="h-full bg-accent transition-none" style={{ width: `${progress}%` }} />
  </div>
  ```

#### Thumbnail / Image Display
- **No dedicated component found.** Screens use raw `<img>` or `<picture>` tags with Tailwind sizing.

#### Sticky Footer
- **Pattern:** Use `sticky` bottom position on a container
  ```tsx
  <div className="sticky bottom-0 bg-bg-surface border-t border-border-default p-4">
    {/* Footer content */}
  </div>
  ```
- **Table cell example:** `src/components/ui/Table.tsx` uses `sticky left-0 z-10` for pinned columns.

#### File Row / Card
- **No dedicated component found.** Recommend following the pattern from `src/screens/billing/BillingScreen/QuotaCard.tsx` or similar.
- **Expected structure:**
  - Container: `flex gap-3 p-3 border border-border-default rounded-[8px] bg-bg-surface`
  - Thumbnail: `w-16 h-16 object-cover rounded`
  - Content: Flex column with file name, size, status
  - Actions: `IconButton` for menu, `Badge` for status
  - Error (inline): `InlineAlert level="violation"` with `className="mt-2"` or similar

---

## VERIFICATION

No test suite exists for this contract file — it is read-only documentation. The downstream worker will encounter compile errors if any:
- Component export name is misspelled
- Prop type is wrong
- Variant name is not spelled exactly as listed
- Required accessible attributes (e.g., `aria-label` on IconButton) are omitted

---

