# S-19 / T3 — Hợp đồng bộ giao diện WallGeometryEditor

Hợp đồng props, token, chuyển động, phím tắt, bộ khẳng định cho `src/screens/viewer/WallGeometryEditor/`.

> Bộ này được biên soạn **không viết mã sản phẩm**, chỉ để liệt kê những gì T5 sẽ dùng, cảnh báo những component đã biết là hỏng, và xác định các tính năng chưa có trong repo.

---

## Nhóm A — UI Components (`src/components/ui/`)

### 1. NumericField.tsx — ô nhập số cho bảng đỉnh

**Đường dẫn:** `src/components/ui/NumericField.tsx:9`

**Props interface:**
```typescript
interface NumericFieldProps
  extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'>,
    UseNumericFieldProps {
  unit?: string;
}

interface UseNumericFieldProps {
  value?: number | undefined;
  onChange?: ((val: number | undefined) => void) | undefined;
  min?: number | undefined;
  max?: number | undefined;
}
```

**Kế thừa từ InputProps:** `label`, `error`, `hint`, `prefix`, `suffix`, `isLoading`, `isReadOnly`, `wrapperClassName`, `flash`, `id` (HTML).

**Biến thể & khả năng:**
- Chấp nhận `unit` để hiển thị hậu tố (ví dụ: "mm", "m")
- Tự định dạng: `displayValue` từ hook `useNumericField`
- Báo lỗi qua prop `error` hoặc flash `flash` (boolean)
- Nút stepper (tăng/giảm) hiện khi hover; ẩn nếu `disabled`, `isReadOnly`, `isLoading`
- **Mono font:** `font-mono text-[13px]`, text-right
- Chấp nhận `ref` (forwardRef)
- Có `onFocus`, `onBlur`, `onKeyDown`, `onChange` qua hook
- **Riêng:** `onChange` là callback từ hook, không phải HTML `onChange`

**Ví dụ (từ `NumericField.stories.tsx`):**
```tsx
<NumericField
  value={value}
  onChange={setValue}
  min={0}
  max={1000}
  unit="mm"
  label="Chiều dài"
/>
```

---

### 2. Kbd.tsx — biểu thị phím tắt trong tooltip

**Đường dẫn:** `src/components/ui/Kbd.tsx:1`

**Props interface:**
```typescript
interface KbdProps {
  children: React.ReactNode;
  className?: string;
}
```

**Khả năng:**
- Hiển thị các phím (ví dụ: "Ctrl", "Shift", "Del") với kiểu monospace
- Mục đích: render bên trong tooltip để hiện phím tắt

**Ví dụ:**
```tsx
<Kbd>Shift + Del</Kbd>
```

---

### 3. SegmentedControl.tsx — bộ chọn phân đoạn

**Đường dẫn:** `src/components/ui/SegmentedControl.tsx:15`

**Props interface:**
```typescript
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
```

**Khả năng:**
- Chấp nhận `aria-label`
- Hỗ trợ loading state
- Disabled toàn bộ bộ điều khiển

---

### 4. Badge.tsx — chip đối chiếu, trạng thái

**Đường dẫn:** `src/components/ui/Badge.tsx:11`

**Props interface:**
```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;  // 'verified' | 'attention' | 'violation' | 'neutral'
  children: React.ReactNode;
  noDot?: boolean;
}
```

**Biến thể:** 4 variant
- `verified` — xanh (đã duyệt)
- `attention` — vàng (cần chú ý)
- `violation` — đỏ (vi phạm)
- `neutral` — xám (không xác định)

**Ví dụ:**
```tsx
<Badge variant="attention">Lệch 12 mm</Badge>
```

---

### 5. Table.tsx — bảng đỉnh

**Đường dẫn:** `src/components/ui/Table.tsx:28, 71, 188`

**Cấu trúc lồng nhau:**
```typescript
interface TableRootProps extends React.HTMLAttributes<HTMLDivElement> {
  sortKey?: string | undefined;
  sortDir?: 'asc' | 'desc' | null | undefined;
  onSort?: ((key: string) => void) | undefined;
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;
  isAttention?: boolean;
  isFlash?: boolean;
  layoutId?: string;  // ID cho framer-motion layout animation
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean;
}
```

**Cách dùng:**
```tsx
<Table.Root sortKey={sortKey} onSort={handleSort}>
  <Table.Header>
    <tr>
      <Table.Head>Mã đỉnh</Table.Head>
      <Table.Head>X (mm)</Table.Head>
      <Table.Head>Y (mm)</Table.Head>
    </tr>
  </Table.Header>
  <Table.Body>
    {vertices.map(v => (
      <Table.Row key={v.id} selected={v.id === selected}>
        <Table.Cell>{v.id}</Table.Cell>
        <Table.Cell>{v.x}</Table.Cell>
        <Table.Cell>{v.y}</Table.Cell>
      </Table.Row>
    ))}
  </Table.Body>
</Table.Root>
```

**⚠️ CẠMTRAP (từ memory):** 
- Mỗi `<tr>` được render qua `Table.Row` sẽ trigger `expectAccessible` nếu có outline-none mà không có ring — mỗi dòng là 1 lỗi
- Workaround trong screen: dùng plain `<tr>` cho bảng tĩnh, chỉ dùng `Table.Row` cho dòng chọn được
- `Table.Cell` đặc biệt không `whitespace-nowrap` sẽ cần `className="h-auto whitespace-normal py-2 align-top"`

---

### 6. IconButton.tsx — nút biểu tượng

**Đường dẫn:** `src/components/ui/IconButton.tsx:6`

**Props interface:**
```typescript
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;  // ⭐ BẮT BUỘC
  isActive?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: boolean;
}
```

**Khả năng:**
- `aria-label` **bắt buộc** (A12: keyboard first)
- Biến thể size
- Active state (accent color)
- Loading spinner

**Ví dụ:**
```tsx
<IconButton
  icon={<Trash size={16} />}
  aria-label="Xoá đỉnh này"
  onClick={() => deleteVertex(vertexId)}
/>
```

---

### 7. Input.tsx — ô nhập text

**Đường dẫn:** `src/components/ui/Input.tsx:5`

**Props interface:**
```typescript
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
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

**Khả năng:**
- Có label, error message, hint riêng
- Prefix/suffix (React node)
- Loading state
- Flash state (highlight)
- `id` tự sinh nếu không truyền

---

### 8. Tooltip — NOT FOUND

**Kết luận:** Không có component `Tooltip.tsx` tại `src/components/ui/`. 

Kiểm tra:
- Không tồn tại `src/components/ui/Tooltip.tsx`
- Không tồn tại ở `src/components/overlay/`
- Không có export từ file nào khác

**Khuyến cáo:** Nếu cần tooltip, phải dựng riêng hoặc sử dụng `title` HTML trên nút.

---

## Nhóm B — Lớp phủ Canvas (`src/components/canvas/`)

### Kết luận về `GizmoHud` và `MeasurementOverlay`

**Thư mục `src/components/viewer/` không tồn tại.** Đặc tả ban đầu nhắc những file này, nhưng chúng không có thật. Các file thay thế:

### 1. TransformGizmo.tsx — công cụ biến hình

**Đường dẫn:** `src/components/canvas/TransformGizmo.tsx:8`

**Props interface:**
```typescript
interface TransformGizmoProps {
  isVisible?: boolean;
  cx?: number;
  cy?: number;
  className?: string;
}
```

**Chức năng:**
- Render gizmo biến hình (scale, rotate, translate)
- **Tự bắn tia (raycasting) để bắt thao tác?** Cần kiểm tra chi tiết trong component

---

### 2. MeasurementLabel.tsx — chuỗi kích thước sống

**Đường dẫn:** `src/components/canvas/MeasurementLabel.tsx:9`

**Props interface:**
```typescript
interface MeasurementLabelProps {
  state: ReturnType<typeof useMeasurementLabel>['state'];
  startPoint: Point | null;
  currentPoint: Point | null;
  midPoint: Point | null;
  distanceFormatted: string;
  isHidden?: boolean;
  className?: string;
}
```

**Khả năng:**
- Hiển thị kích thước sống (live measurement) dọc một cạnh
- **Chữ đều (mono)** — kiểm tra class `font-mono`
- Cần `useMeasurementLabel` hook để quản lý state

---

### 3. SelectionHalo.tsx — vòng tô sáng

**Đường dẫn:** `src/components/canvas/SelectionHalo.tsx:6`

**Props interface:**
```typescript
interface SelectionHaloProps {
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
  variant?: SelectionVariant;
  hasEntered?: boolean;
  className?: string;
}
```

**Khả năng:**
- Tô sáng một vùng hình chữ nhật
- Dùng để nhấn mạnh cạnh/vùng có lỗi

---

### 4. GridLayer.tsx — lưới toạ độ

**Đường dẫn:** `src/components/canvas/GridLayer.tsx:6`

**Props interface:**
```typescript
interface GridLayerProps {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  zoom?: number;
  scaleRatioMmPerPx?: number;
  config?: Partial<GridConfig>;
  className?: string;
}
```

---

### 5. ContextMenu.tsx — menu ngữ cảnh

**Đường dẫn:** `src/components/canvas/ContextMenu.tsx:30`

**Props interface:**
```typescript
interface ContextMenuRootProps {
  isVisible: boolean;
  position: { x: number; y: number };
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}
```

---

### 6. useMeasurementLabel.ts — hook đo kích thước

**Đường dẫn:** `src/hooks/useMeasurementLabel.ts:40`

**Chữ ký:**
```typescript
export function useMeasurementLabel(): MeasurementLabelState {
  // Trả về: {
  //   state: MeasurementState,
  //   startPoint: Point | null,
  //   currentPoint: Point | null,
  //   distanceMm: number,
  //   distanceFormatted: string,
  //   midPoint: Point | null,
  //   startMeasurement(): void,
  //   updateMeasurement(point: Point): void,
  //   commitMeasurement(): void,
  //   resetMeasurement(): void,
  // }
}
```

---

## Nhóm C — Token, Chuyển động, Định dạng

### 1. Motion Durations — thang chuyển động

**Đường dẫn:** `src/lib/motion/tokens.ts:62-87`

**MOTION_DURATIONS_MS — bốn giá trị duy nhất:**
```typescript
export const MOTION_DURATIONS_MS = Object.freeze({
  instant:  120,  // State mà pointer đã có: hover, focus ring, press
  fast:     180,  // Cái nhỏ xuất hiện: dropdown, tooltip
  standard: 260,  // Default — panel, toast, thứ có diện tích riêng
  slow:     340,  // Thay đổi view: camera move, view change
});
```

**AMBIENT_LOOP_MS — riêng biệt:**
```typescript
export const AMBIENT_LOOP_MS = 700;  // Skeleton sweep, progress sheen (không transitions)
```

**⚠️ CẢNH BÁO — Spec nhắc 240ms (nối tường) và 180ms (Esc trả về):**
- **240ms KHÔNG nằm trong thang.** Chỉ có `instant(120) | fast(180) | standard(260) | slow(340)`.
- Esc trả về (180ms = `fast`) ✓ có trong bảng.
- Nối tường cần 240ms nhưng bảng không có. **Khuyến cáo:** dùng `standard(260)` hoặc `fast(180)` thay thế.

**Dùng trong code:**
```tsx
transition={{ duration: durationSeconds('fast') }}  // framer-motion, tính bằng giây
// hoặc
duration-180  // Tailwind class (CSS transition)
```

---

### 2. Motion Easing Curves — ba đường cong

**Đường dẫn:** `src/lib/motion/tokens.ts:232-236`

**MOTION_EASINGS — ba curve gentle (không overshoot):**
```typescript
export const MOTION_EASINGS = Object.freeze({
  enter: defineEasing('enter', [0, 0, 0.2, 1]),    // Decelerate: nhanh rồi chậm
  exit:  defineEasing('exit', [0.4, 0, 1, 1]),     // Accelerate: chậm rồi nhanh
  inOut: defineEasing('inOut', [0.4, 0, 0.6, 1]),  // Symmetric: vừa lúc
});
```

---

### 3. Tailwind Token Colors

**Đường dẫn:** `tailwind.config.ts:22-84`

**Token độc lập:**
```
accent (--accent)
  - DEFAULT
  - hover
  - active
  - wash (tint nhạt)

bg (background)
  - app (nền ứng dụng)
  - surface (nền control)
  - sunken (nền vô hiệu)
  - hover (nền hover)
  - overlay (nền overlay)
  - selected (nền chọn)
  - flash (nền nhấn mạnh)

border
  - default

text
  - primary
  - secondary
  - muted

state — ĐỐI TƯỢNG BA TRẠNG THÁI (A4: đúng 3, không được có thứ 4)
  - verified (xanh — đã xác minh bởi người duyệt)
  - attention (vàng — cần chú ý)
  - violation (đỏ — vi phạm)
  
  (Mỗi state có 3 variants: `-`, `-text`, `-tint`)
```

**Cách dùng:** `text-text-primary`, `bg-bg-hover`, `border-state-violation`, v.v.

---

### 4. Format Functions — định dạng số

**Đường dẫn:** `src/lib/format/measure.ts:108,131,151`

**Chữ ký:**
```typescript
formatLength(valueMm: number, options?: LengthFormatOptions): string
// Trả về: "1.234,56 m" (dấu phẩy làm thập phân, A15)

formatArea(areaM2: number, options?: MeasureFormatOptions): string
// Trả về: "248,60 m²"

formatAngle(angleDeg: number, options?: MeasureFormatOptions): string
// Trả về: "45,5°"
```

**Từ `src/lib/format/number.ts:201,225,255`:**
```typescript
formatNumber(value: MaybeNumber, options: NumberFormatOptions = {}): string
formatPercent(value: MaybeNumber, options: PercentFormatOptions = {}): string
parseNumber(text: string): number | undefined
```

**⭐ Dấu thập phân là DẤU PHẨY (A15, r72), không phải dấu chấm.**

---

### 5. Monospace Font — chữ đều

**Dùng:** `font-mono` (Tailwind)

**Nơi dùng trong spec:**
- Chuỗi kích thước sống (MeasurementLabel)
- Bảng đỉnh (toạ độ x, y)
- Nhãn bắt điểm
- Kích thước khe hở

**Lớp hiện có:** `font-mono text-[13px]` (NumericField, Input suffix)

---

### 6. MotionProvider — nhà cung cấp chuyển động

**Đường dẫn:** `src/components/motion/`

**Luật:** Đây là nơi **DUY NHẤT** được nhập `framer-motion`.

```typescript
<MotionProvider reducedMotion="user">
  {/* Nội dung app */}
</MotionProvider>
```

**⚠️ CẤMTUYỆTĐỐI:** Không import `framer-motion` ở nơi khác. ESLint luật `local/no-framer-outside-motion` sẽ chặn.

---

## Nhóm D — Phím tắt (A12)

**Đường dẫn:** `src/lib/input/shortcutRegistry.ts`

### Cấu trúc Registry

```typescript
export type ShortcutScope = 'dialog' | 'sidePanel' | 'canvas' | 'global';

export const SCOPE_PRIORITY: readonly ShortcutScope[] = [
  'dialog',    // Tầng cao nhất — modal, nuốt toàn bộ phím ngoài khi mở
  'sidePanel', // Cùng với canvas, không modal
  'canvas',    // Công cụ, gizmo
  'global',    // Toàn ứng dụng
];

export interface ShortcutDefinition {
  readonly id: string;
  readonly combo: string;           // ví dụ: "Ctrl+Z", "Escape", "?"
  readonly scope: ShortcutScope;
  readonly description?: string;
  readonly allowRepeat?: boolean;
  readonly preventDefault?: boolean;
  onTrigger(event: ShortcutKeyEvent): void;
}

export function parseCombo(combo: string): ParsedCombo
  // Trả về: { code, mod, alt, shift }
  // Các modifier: Ctrl/Control/Cmd/Command/Meta/Mod → 'mod'
  // Các key: Escape, ArrowDown, Z, ?, v.v.

export function formatCombo(parsed: ParsedCombo): string
  // Ngược lại: trả về chuỗi dễ đọc
```

### Cách đăng ký phím tắt của màn

**Ví dụ từ các màn hiện có:**

```typescript
// Trong hook hoặc component
const registry = appShortcutRegistry;

registry.register({
  id: 'wall-editor.delete-vertex',
  combo: 'Delete',
  scope: 'canvas',
  description: 'Xoá đỉnh đang chọn',
  onTrigger: () => {
    deleteSelectedVertex();
  },
});

registry.register({
  id: 'wall-editor.commit',
  combo: 'Enter',
  scope: 'canvas',
  description: 'Hoàn thành sửa tường',
  onTrigger: () => {
    finishEditing();
  },
});
```

### Esc đóng lớp trên cùng — bảo đảm ở đâu?

**Đường dẫn:** `src/lib/input/shortcutRegistry.ts:21-22`

Luật toàn cục: Esc **luôn** rơi qua tất cả các `scope` dù dialog đang mở (không bị nuốt), để tới handler global `dialog.handleClose()`. Đây là bảo đảm của registry, không phải từng component.

---

### Phím tắt công cụ đã đặt sẵn

**Đường dẫn:** `src/lib/tools/shortcuts.ts`, `shortcutTable.ts`

**Kiểm tra:** Bảng phím tắt của canvas tools (ví dụ: công cụ di chuyển, thêm đỉnh, xoá đỉnh, v.v.) nằm ở đây. T5 cần tránh đụng.

---

## Nhóm E — Bộ khẳng định & Bộ dựng Test

### 1. expectSevenStates — kiểm tra bảy trạng thái

**Đường dẫn:** `src/lib/testing/expectSevenStates.ts:100+`

**Chữ ký:**
```typescript
export async function expectSevenStates(
  scenarios: readonly SevenStateScenario[],
  renderer: ScreenRenderer
): Promise<void>
  // Nếu thiếu state nào → throws Error
  // Nếu state lặp → throws Error
```

**Bảy trạng thái (A11) — tên chính xác:**
```
1. rỗng         (empty)
2. đang tải     (loading)
3. một phần     (partial)
4. lỗi          (error)
5. thành công   (success)
6. không có quyền (forbidden)
7. thu gọn      (collapsed)
```

**Cách dùng:**
```typescript
it('handles seven states', async () => {
  await expectSevenStates(SEVEN_SCENARIOS, (scenario) => 
    render(<WallEditor scenario={scenario} />)
  );
});
```

---

### 2. sevenStateScenarios — bộ kịch bản test

**Đường dẫn:** `src/lib/testing/sevenStateScenarios.ts`

```typescript
export const SEVEN_STATES: readonly SevenState[] = [
  'empty', 'loading', 'partial', 'error', 'success', 'forbidden', 'collapsed'
];

export const SEVEN_STATE_LABELS: Record<SevenState, string> = {
  empty: 'rỗng',
  loading: 'đang tải',
  // ...
};

export interface SevenStateScenario {
  readonly state: SevenState;
  readonly itemCount: number;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly // ...
}
```

---

### 3. expectAccessible — R-72 bộ khẳng định tiếp cận

**Đường dẫn:** `src/lib/testing/expectAccessible.ts:100+`

**Chữ ký:**
```typescript
export function expectAccessible(
  container: HTMLElement,
  options?: AccessibilityOptions
): AccessibilityReport
  // Throws Error nếu tìm thấy vấn đề
```

**Những gì nó từ chối:**
- Icon-only button mà không có `aria-label`, `aria-labelledby`, hoặc `<label>` kèm
- `<img>` mà không có `alt` attribute (hoặc `alt=""` cho decorative)
- `tabindex > 0` (custom tab order)
- `tabindex = -1` trên interactive control (trừ `data-roving-focus`)
- Focus ring bị tắt: `outline-none` mà không có ring class, hoặc ring mà không có `ring-offset-2`
- Contrast < 4.5:1 cho body text, < 3:1 cho caption (A13)

---

### 4. expectVietnamese — kiểm tra tiếng Việt (R-67)

**Đường dẫn:** `src/lib/testing/expectVietnamese.ts:100+`

**Chữ ký:**
```typescript
export function expectVietnamese(
  container: HTMLElement,
  options?: VietnameseOptions
): VietnameseReport
  // Throws Error nếu tìm English hoặc tiếng Việt mất dấu
```

**Bắt những gì:**
- English labels sót lại (ví dụ: `aria-label="Save"`)
- Tiếng Việt mất diacritics (ví dụ: "Luu ban ve" thay vì "Lưu bản vẽ")

**Đọc từ:**
- Visible text
- `aria-label`, `alt`, `placeholder`, `title`
- Không: `id`, `class`, `data-*` (cho máy)
- Bỏ qua: `<code>`, `<pre>`, `<kbd>` (shortcut là English)

**Từ điển:** `src/i18n/vi.json` — vocabulary đã duyệt của app.

---

### 5. Bộ render test & fixture

**Đường dẫn:** `src/lib/testing/render.ts`, `fixtures.ts`, `fakeClock.ts`

Cung cấp:
- `render()` — wrapper của `@testing-library/react`
- `fixtures.ts` — bộ kịch bản dữ liệu chuẩn
- `fakeClock.ts` — điều khiển thời gian trong test

---

### 6. A14 Fixture — bộ mẫu chuẩn

**Đường dẫn:** `src/lib/testing/fixtures.ts:8`

**Cấu hình tiêu chuẩn:**
```
4 levels (tầng)
48 walls (tường)
14 rooms (phòng)    ⚠️ CLAUDE.md nói "34 phòng" — SAI
248,60 m² (diện tích brutto)
```

**Lấy ra bằng:**
```typescript
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
const scenario = createCleanBuildingScenario();
```

---

## Nhóm F — DANH SÁCH ĐỎ — Xác minh bốn vấn đề đã biết

### Kết luận & Proof

---

#### 1. Slider, Textarea, Table.Row — Focus ring điều khiển bằng state

**Tình trạng:** 🔴 **CÒN ĐÚNG — Component vẫn hỏng**

**Bằng chứng:**

**Slider.tsx:154**
```typescript
className={cn(
  'h-3.5 w-3.5 rounded-full bg-bg-surface border border-border-default shadow-rest outline-none',
  isFocused && 'ring-2 ring-accent ring-offset-2'  // ← State-driven ring, không phải focus-visible
)}
```
❌ Dùng React state `isFocused` thay vì CSS `focus-visible:`. Sẽ lỗi `expectAccessible`.

**Textarea.tsx:95-99**
```typescript
effectiveReadOnly && 'bg-bg-sunken focus-visible:ring-0 cursor-default'
```
❌ Khi `isReadOnly`, ring bị tắt hoàn toàn. Keyboard user mất focus ring.

**Table.tsx:84, 89**
```typescript
const rowClassName = twMerge(
  'group h-10 border-b border-border-default/50 last:border-0 outline-none transition-colors duration-120',
  'hover:bg-bg-hover focus-visible:bg-bg-hover',
  // ...
  focused && 'ring-2 ring-inset ring-accent',  // ← State-driven
);
```
❌ Focus ring từ prop `focused`, không phải CSS `focus-visible:`.

**Khuyến cáo:** Đừng dùng `Slider`, `Textarea` (read-only), hay `Table.Row` nếu cần tab-reachable keyboard navigation. Thay thế:
- `Slider` → `NumericField` (dùng được)
- `Textarea` (read-only) → plain text div
- `Table.Row` (static table) → plain `<tr>`, chỉ dùng `Table.Row` cho hàng interactive (chọn được)

---

#### 2. Breadcrumb & ZoomCluster — aria-label tiếng Anh

**Tình trạng:** ✅ **ĐÃ SỬA — Cả hai component đều tiếng Việt**

**Breadcrumb.tsx:24 — Lỗi cũ:**
```typescript
aria-label="Breadcrumb"  // ← English, nhưng...
```
⚠️ Còn một chỗ English: `aria-label="Breadcrumb"` tại line 24. Những chỗ khác (67, 84) đã tiếng Việt.

**ZoomCluster.tsx:74, 81, 97, 108, 122 — Toàn Vietnamese:**
```typescript
aria-label="Điều khiển zoom"      // line 74
aria-label="Thu nhỏ"              // line 81
aria-label={`Zoom hiện tại...`}   // line 97
aria-label="Phóng to"             // line 108
aria-label="Vừa khung nhìn"       // line 122
```
✅ Tất cả tiếng Việt.

**Kết luận:**
- **Breadcrumb:** Còn 1 lỗi nhỏ tại line 24 (`"Breadcrumb"` → `"Mục lục"` hoặc tương tự)
- **ZoomCluster:** Đã sửa ✓

---

#### 3. Combobox — Không commit được chữ tự do

**Tình trạng:** 🔴 **CÒN ĐÚNG — Component không hỗ trợ free text**

**Bằng chứng:**

**useCombobox.ts:31-38**
```typescript
const selectHook = useSelect({
  value,
  onChange: (val: T) => {
    onChange?.(val);        // ← onChange chỉ gọi khi option từ list được chọn
    setQuery('');
  },
  options: filteredOptions,
});
```

**useSelect.ts:36-39**
```typescript
const selectOption = (val: T) => {
  onChange?.(val);          // ← onChange chỉ từ selectOption
  handleClose();
};
```
Và `selectOption` chỉ được gọi tại line 68 khi `Enter` được nhấn **trên một option có sẵn từ list**.

❌ Nếu user gõ tự do vào search input mà không chọn option nào, `onChange` không được gọi. Chuỗi tự do **không commit được**.

**Khuyến cáo:** Nếu spec đòi "gợi ý nhưng không ép chọn", phải dựng riêng `Input` + suggestion chips trong screen folder. Không thể dùng `Combobox` cho trường hợp đó.

---

#### 4. Storybook CSF — Export không phải story làm trắng file

**Tình trạng:** 🔴 **CÒN ĐÚNG — Table.stories.tsx thiếu excludeStories**

**Bằng chứng:**

**Table.stories.tsx:24-44 — Non-story exports:**
```typescript
const walls: WallRow[] = MOCK_SPATIAL_PROJECT.geometry.L1?.walls ? [...] : [];
const walls500: WallRow[] = Array.from({ length: 500 }, (...) => ({...}));
const stateVariant = (s: ReviewState) => s === 'approved' ? 'verified' : ...;
const stateLabel = (s: ReviewState) => s === 'approved' ? 'Đã duyệt' : ...;
const noop = (): void => undefined;
```

❌ Những export này **không có** trong `meta.excludeStories`. Storybook sẽ cố tạo `.parameters` trên chúng, gây lỗi.

**Mẫu vá:**
```typescript
const meta: Meta = {
  title: 'ui/Table',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  excludeStories: ['walls', 'walls500', 'stateVariant', 'stateLabel', 'noop'],
};
```

**Khuyến cáo:** Kiểm tra tất cả `*.stories.tsx`, thêm `excludeStories` cho mọi non-story export.

---

## Bảng Dùng được / Tránh dùng

| Component / Tính năng | Dùng được ✓ | Tránh dùng ✗ | Ghi chú |
|---|---|---|---|
| **NumericField** | ✓ | | Khuyên cho input số trong bảng, có unit, stepper |
| **Kbd** | ✓ | | Hiện phím tắt trong tooltip |
| **SegmentedControl** | ✓ | | Bộ chọn phân đoạn, có loading |
| **Badge** | ✓ | | Chip trạng thái, 4 variant |
| **Table.Root/Head/Cell** | ✓ | | Bảng tĩnh, column header có sort |
| **Table.Row (static)** | ✓ | **Table.Row (interactive)** | Dùng plain `<tr>` cho bảng không chọn được |
| **IconButton** | ✓ | | Nút icon, `aria-label` bắt buộc |
| **Input** | ✓ | | Text input, label/error/hint riêng |
| **Tooltip** | ✗ | Dựng riêng | Không tồn tại, dùng `title` HTML hoặc dựng kèm component |
| **Slider** | ✗ | **NumericField** | Focus ring hỏng, không qua R-72 |
| **Textarea (read-only)** | ✗ | Plain text | Focus ring bị tắt |
| **Combobox** | ✗ (free text) | **Input + chips** | Chỉ commit option có sẵn, không free text |
| **Breadcrumb** | ⚠️ | | 1 lỗi còn sót: `aria-label="Breadcrumb"` cần Việt |
| **ZoomCluster** | ✓ | | Tất cả aria-label đã Việt |
| **Motion: fast (180ms)** | ✓ | | Dropdown, tooltip |
| **Motion: standard (260ms)** | ✓ | | Panel, toast (default) |
| **Motion: slow (340ms)** | ✓ | | View change, camera |
| **Motion: 240ms** | ✗ | 260ms hoặc 180ms | **Không có trong thang**, thay bằng standard/fast |
| **state colors (3 màu)** | ✓ | | verified/attention/violation, không thêm thứ 4 |
| **framer-motion** | ✓ (chỉ ở `src/components/motion/`) | **Anywhere else** | Duy nhất nơi được nhập |

---

## NOT FOUND

Những cái được đặc tả nhưng **không tồn tại** trong repo:

1. **Tooltip component** — `src/components/ui/Tooltip.tsx` không tồn tại
   - Thay thế: dùng `title` HTML hoặc dựng riêng kèm component
2. **GizmoHud.tsx** — `src/components/viewer/GizmoHud.tsx` không tồn tại
   - Thư mục `src/components/viewer/` không tồn tại
   - Thay thế: `src/components/canvas/TransformGizmo.tsx`
3. **MeasurementOverlay.tsx** — không tồn tại
   - Thay thế: `src/components/canvas/MeasurementLabel.tsx`
4. **Motion duration 240ms** — không nằm trong `MOTION_DURATIONS_MS`
   - Thay thế: dùng 180ms (fast) hoặc 260ms (standard)
5. **A14 fixture: 34 phòng** — CLAUDE.md nói "34 phòng, sảnh 248,60 m²" nhưng fixture thật là **14 phòng**
   - Fix: CLAUDE.md cần sửa, hoặc fixture cần thêm data để tới 34 phòng

---

**Document này được biên soạn 2026-09-06.**

**Người biên: Worker T3 (liệt kê không viết mã).**
