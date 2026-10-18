# CadBranchConfirm — Bản giao kèo props (L1-B)

Màn này dựng hoàn toàn từ component hiện có, không tạo component mới. Bản giao kèo dưới là những constraint prop mà view phải tuân theo để loại trừ những lựa chọn thiết kế bất khả thi.

## Thành phần giao diện (UI Components)

### Modal.tsx
**Đường dẫn:** `src/components/overlay/Modal.tsx`  
**Các export:** `Modal.Root`, `Modal.Header`, `Modal.Body`, `Modal.Footer`, `Modal.CloseButton`, `Modal` (legacy API)

**Interface Modal.Root props:**
```tsx
export interface ModalRootProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Chiều rộng: 480 (nhỏ) | 560 (vừa) | 720 (lớn) */
  width?: 480 | 560 | 720;
  titleId?: string;
}
```

**Cách đặt bề rộng 560:** Truyền `width={560}` vào `Modal.Root`. Chiều rộng áp dụng inline style: `style={{ width: '560px' }}` (line 132)

**Focus trap:** Modal dùng `createFocusTrap()` từ `src/lib/input/focusTrap.ts` (line 9, 64). Tab vòng trong modal, Esc gọi `onClose` và dừng lan sự kiện, tiêu điểm trả về nút mở.

**Auto-focus:** Kích hoạt tiêu điểm tự động với RAF delay (line 66), mục tránh bẫy tiêu điểm kích hoạt lại khi animation bắt đầu.

**Esc đóng:** Sẵn có — cấp dialog scope (line 78), phím tắt nhập (Escape) gọi `onClose`.

**Tiêu điểm trả về:** `focusTrap.release()` (line 70) khi đóng modal, tự động tìm nơi cũ hoặc fallback.

**Ví dụ dùng:** `src/screens/project/ShareScreen/ShareScreen.tsx:40` — `<Modal.Root isOpen={isOpen} onClose={onClose} width={560}>`

---

### Button.tsx
**Đường dẫn:** `src/components/ui/Button.tsx`  
**Export:** `Button` (component)

**Interface ButtonProps:**
```tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;  // 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: ButtonSize;        // 'sm' | 'md' | 'lg'
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
  icon?: React.ReactNode;   // @deprecated — dùng iconBefore
  iconOnly?: boolean;
  loading?: boolean;
  shortcut?: string;
  fullWidth?: boolean;
}
```

**Biến thể (variant):**
- `primary` (mặc định) — nền accent xanh/tím, chữ trắng (chính)
- `secondary` — nền xám nhạt, viền, chữ đen (phụ)
- `ghost` — nền trong suốt, chữ xám (mờ)
- `danger` — nền đỏ nhạt, viền đỏ, chữ đỏ (lỗi)

**autoFocus:** Không có props riêng. Dùng HTML `autoFocus` attribute trên Button element. Không khuyến khích vì focus trong Modal được ưu tiên.

**Ví dụ:**
```tsx
<Button variant="primary" onClick={handleConfirm}>Xác nhận</Button>
<Button variant="secondary" onClick={handleCancel}>Huỷ</Button>
<Button variant="ghost" onClick={handleReset}>Đặt lại</Button>
```

---

### Badge.tsx
**Đường dẫn:** `src/components/ui/Badge.tsx`  
**Export:** `Badge`

**Interface BadgeProps:**
```tsx
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;  // 'verified' | 'attention' | 'violation' | 'neutral'
  children: React.ReactNode;
  noDot?: boolean;  // Tắt chấm màu nhỏ
}
```

**Biến thể:**
- `verified` — nền xanh lá nhạt, chữ xanh lá (được kiểm tra)
- `attention` — nền vàng nhạt, chữ vàng (cần chú ý)
- `violation` — nền đỏ nhạt, chữ đỏ (lỗi)
- `neutral` — nền xám, chữ xám (trung lập)

**Cấu hình:** Cao 22px, bo góc 6px, font 13px, chấm 1.5×1.5px

**Ví dụ:** `<Badge variant="verified">Đã kiểm tra</Badge>`

---

### Table.tsx
**Đường dẫn:** `src/components/ui/Table.tsx`  
**Các export:** `Table.Root`, `Table.Header`, `Table.Body`, `Table.Row`, `Table.Head`, `Table.Cell`, `Table.CheckboxHead`, `Table.CheckboxCell`, `Table.Virtual`, `Table.Skeleton`, `Table.Empty`, `Table.Error`

**Interface Table.Root props:**
```tsx
export interface TableRootProps extends React.HTMLAttributes<HTMLDivElement> {
  sortKey?: string | undefined;
  sortDir?: 'asc' | 'desc' | null | undefined;
  onSort?: ((key: string) => void) | undefined;
}
```

**Interface Table.Row props:**
```tsx
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;       // ⚠️ ĐÂY LÀ BẪY: phủ lên state, không phải CSS focus-visible
  isAttention?: boolean;
  isFlash?: boolean;
  layoutId?: string;       // Dùng với framer-motion để animate layout
}
```

**⚠️ CẢNH BÁO FOCUS RING (R-72):**  
Table.Row sử dụng state-driven focus ring — nó chỉ vẽ ring khi `focused={true}`, không phải khi row nhận tiêu điểm thật. Điều này **PHÁ HỦY** `expectAccessible` test:
```
focused && 'ring-2 ring-inset ring-accent'  // ❌ State-driven, không phải focus-visible:
```

**Giải pháp:** 
- Nếu màn chỉ dùng Table để hiển thị dữ liệu tĩnh (không chọn hàng), **dùng `<tr>` thô thay vì `Table.Row`** và kết hợp `Table.Cell` (line 25 trong memory).
- Nếu cần hàng chọn được, phải fix component trước (R-68 cấm sửa component, vậy phải hỏi chủ dự án).

**Cách compose đúng cho static table:**
```tsx
<Table.Root className="max-h-96">
  <Table.Header>
    <tr>
      <Table.Head>Cột 1</Table.Head>
      <Table.Head>Cột 2</Table.Head>
    </tr>
  </Table.Header>
  <Table.Body>
    <tr>
      <Table.Cell>Giá trị 1</Table.Cell>
      <Table.Cell>Giá trị 2</Table.Cell>
    </tr>
  </Table.Body>
</Table.Root>
```

**Ví dụ thật:** `src/components/ui/Table.stories.tsx:20-80` — table so sánh 3 tường

---

### Select.tsx
**Đường dẫn:** `src/components/ui/Select.tsx`  
**Các export:** `Select.Root`, `Select.Trigger`, `Select.Content`, `Select.Item`, `Select.Label`, `Select.Empty`, `Select.Skeleton`, `Select` (legacy API)

**Interface SelectOption:**
```tsx
export interface SelectOption {
  label: string;
  value: string;
}
```

**Interface Select.Root props:**
```tsx
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
```

**Interface Select.Item props:**
```tsx
export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
  index?: number;
}
```

**Option type:** Đối tượng `{ label: string; value: string }`

**a11y:** 
- Trigger là `<button role="combobox">` với `aria-haspopup="listbox"` (line 136)
- Content là `<div role="listbox" aria-labelledby={triggerId}>` (line 201)
- Item là `<div role="option" aria-selected={isSelected}>` (line 253)
- Label tự động liên kết với trigger qua `htmlFor={triggerId}` (line 103)

**Focus ring:** Dùng CSS `focus-visible:ring-2` — an toàn với expectAccessible ✓

**Ví dụ:**
```tsx
<Select
  options={[{ label: 'Tường', value: 'wall' }, { label: 'Sàn', value: 'floor' }]}
  value={selectedRole}
  onChange={setSelectedRole}
  label="Gán vai trò"
/>
```

---

### SegmentedControl.tsx
**Đường dẫn:** `src/components/ui/SegmentedControl.tsx`  
**Các export:** `SegmentedControl.Root`, `SegmentedControl.Item`, `SegmentedControl`, `useSegmentedControl`

**Interface SegmentedControlProps:**
```tsx
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

export interface SegmentedControlOption<T extends string = string> {
  label: string;
  value: T;
  swatch?: string;  // Hex màu (nếu có)
  disabled?: boolean;
}
```

**Focus ring:** CSS `focus-visible:ring-2` — an toàn ✓

**Bàn phím:** ArrowLeft/ArrowRight để duyệt giữa segment

**Ví dụ:** `src/components/ui/SegmentedControl.stories.tsx:10-20`

---

### WallThicknessLegend.tsx
**Đường dẫn:** `src/components/canvas/WallThicknessLegend.tsx`  
**Export:** `WallThicknessLegend` (functional component)

**Interface WallThicknessLegendProps:**
```tsx
interface WallThicknessLegendProps {
  isVisible?: boolean;
  /** Trạng thái 7 chiều: 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'no-permission' | 'collapsed' */
  state?: 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'no-permission' | 'collapsed';
  /** Cấp nào đang có dữ liệu (để hiển thị partial) */
  availableLevels?: WallThickness[];
  className?: string;
}
```

**Nhận gì:** Props trên + internal hook `useWallThicknessLegend()` để quản lý trạng thái lọc

**Vẽ gì:** 
- 4 nút có ô màu 16×16, lấy từ `wallStrokeToken(thickness)` — token màu từ `materialMap`
- Mỗi nút tương ứng cấp độ dày: 110mm, 220mm, 330mm, Concrete Column
- Bấm toggle filter, nút "xoá" lọc
- Trạng thái loading/error/empty/collapsed tự render lấy

**Ví dụ:** `src/components/canvas/WallThicknessLegend.tsx:31`

---

### InlineAlert.tsx
**Đường dẫn:** `src/components/feedback/InlineAlert.tsx`  
**Export:** `InlineAlert`

**Interface InlineAlertProps:**
```tsx
export interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  level: InlineAlertLevel;  // 'verified' | 'attention' | 'violation'
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}
```

**Các mức:**
- `verified` — xanh lá (được kiểm tra), icon checkmark
- `attention` — vàng (cần chú ý), icon tam giác
- `violation` — đỏ (lỗi), icon tròn cảnh báo

**Cấu hình:** Cao 3px trên/dưới, viền tương ứng mức, nền nhạt, text mạnh

**Ví dụ:** `src/components/feedback/InlineAlert.tsx:20`

---

### Checkbox.tsx
**Đường dẫn:** `src/components/ui/Checkbox.tsx`  
**Export:** `Checkbox`

**Interface CheckboxProps:**
```tsx
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  error?: boolean;
}
```

**Có sẵn:** ✓ Checkbox dùng được, focus ring là CSS `peer-focus-visible:` an toàn

**Ví dụ:** `<Checkbox checked={remember} onChange={setRemember} label="Ghi nhớ lựa chọn này" />`

---

### Collapsible / Accordion
**Tình trạng:** ❌ **KHÔNG CÓ** — không tìm thấy component Collapsible hay Accordion trong `src/components/`

**Phải làm gì:** Khối gấp "Tuỳ chọn nhập" cần làm bằng:
1. Tự viết hooks + `<details>/<summary>` HTML (nhẹ, sẵn trong DOM)
2. Hoặc hỏi chủ dự án tạo component (R-68 cấm tạo mới)
3. Hoặc dùng Tabs từ `src/components/ui/Tabs.tsx` làm collapse

**Suggestion:** Dùng `<details>` thô + CSS là an toàn nhất, không cần component mới.

---

## Các module lib (tầng logic)

### focusTrap.ts
**Đường dẫn:** `src/lib/input/focusTrap.ts`

**Chữ ký:**
```tsx
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {},
): FocusTrapHandle;

export interface FocusTrapOptions {
  onEscape?: () => void;
  initialFocus?: HTMLElement;
  fallbackFocus?: HTMLElement;
}

export interface FocusTrapHandle {
  activate(): void;  // Bẫy tiêu điểm vào container
  release(): void;   // Mở bẫy, trả tiêu điểm về nơi cũ
}

export function getFocusableElements(container: HTMLElement): readonly HTMLElement[];
```

**Modal đã dùng:** ✓ Có — `Modal.tsx` line 9 import, line 64 `createFocusTrap(container, { onEscape: () => onCloseRef.current() })`

---

### Coloring modules (P-06: LẤY MÀU THEO VAI TRÒ)
**Đường dẫn:** `src/lib/coloring/modes.ts`, `legend.ts`, `scales.ts`

**Hàm chính:**
```tsx
export function createColoringMode(
  id: ColoringModeId,
  context: ColoringContext
): ColoringMode;

export interface ColoringMode {
  readonly id: ColoringModeId;
  readonly label: string;
  readonly bands: readonly ColoringBand[];
  readonly breaks: readonly number[];
  readonly paint: (subject: PaintSubject) => ColorTokenName;
}

export interface PaintSubject {
  readonly id: string;
  readonly levelId: LevelId | null;
  readonly review: ReviewMetadata;
  readonly usage: RoomUsage | null;
  readonly areaM2: SquareMetres | null;
  readonly worstSeverity: RuleSeverity | null;
}

export type ColorTokenName = string;  // CSS token name like '--wall-330'
```

**Trả kiểu:** `ColoringMode` — đối tượng chứa hàm `paint(subject)` trả `ColorTokenName` (tên token CSS như `'--wall-330'`, `'--state-verified'`)

**DUY NHẤT:** Đây là nguồn màu cho canvas xem trước. **Không phép mã màu thô hex/rgb** — phải từ token lấy từ mode này.

**Ví dụ:**
```tsx
const mode = createColoringMode('roomUsage', { subjects: rooms, levelIds });
const layerColor = mode.paint({ id: 'room-1', usage: 'bedroom', ... });  // → '--wall-220'
```

---

### format/number.ts
**Đường dẫn:** `src/lib/format/number.ts`

**Hàm P-01:**
```tsx
export function formatNumber(
  value: MaybeNumber,
  options?: NumberFormatOptions
): string;

export interface NumberFormatOptions {
  fractionDigits?: number;     // Số lẻ cố định (vd 2 → '3,50')
  maxFractionDigits?: number;  // Số lẻ tối đa (vd 3 → '3,5' hay '1.234,567')
  grouping?: boolean;          // Nhóm hàng ngàn (mặc định true)
}

export function formatPercent(
  value: MaybeNumber,
  options?: PercentFormatOptions
): string;

export type PercentSource = 'ratio' | 'percent';
export interface PercentFormatOptions {
  fractionDigits?: number;
  maxFractionDigits?: number;
  source?: PercentSource;  // 'ratio' (0,125 → '12,5%') hoặc 'percent' (12,5 → '12,5%')
}
```

**Định dạng số:** Viết thường kiểu câu (A15). **Dấu thập phân là dấu phẩy** — `3,45` không phải `3.45`. Nhóm hàng ngàn bằng dấu chấm `1.234.567,89`.

**Ví dụ:**
```tsx
formatNumber(1234.567)                        // '1.234,567'
formatNumber(3.5, { fractionDigits: 2 })     // '3,50'
formatPercent(0.125)                          // '12,5%'
formatNumber(null)                            // '—' (giá trị mất)
```

---

### motion/tokens.ts
**Đường dẫn:** `src/lib/motion/tokens.ts`

**MOTION_DURATIONS_MS:**
```tsx
export const MOTION_DURATIONS_MS: Readonly<Record<MotionDurationName, number>> = {
  instant:  120,
  fast:     180,
  standard: 260,
  slow:     340,
};

export const AMBIENT_LOOP_MS = 700;  // Để dành cho vòng lặp (skeleton sweep, progress)

export type MotionDurationName = 'instant' | 'fast' | 'standard' | 'slow';
```

**Năm giá trị:** 120, 180, 260, 340, 700 (R-71 cấm con số khác)

**Hàm:**
```tsx
export function durationMs(name: MotionDurationName, options?: { reducedMotion?: boolean }): number;
export function durationSeconds(name: MotionDurationName, options?: { reducedMotion?: boolean }): number;
```

---

## ⚠️ Mâu thuẫn spec vs luật

**Spec yêu cầu:** Hoà tan animation 240ms  
**Luật repo (R-71):** Thời lượng chỉ được phép là 120/180/260/340/700ms

**Giải pháp:**
- 240 KHÔNG nằm trong năm giá trị trên
- Giá trị hợp lệ gần nhất: **260ms** (`standard`)
- Nên dùng: `durationSeconds('standard')` hoặc trực tiếp `260` từ `MOTION_DURATIONS_MS.standard`
- **KHÔNG tự sửa `tokens.ts`** — đây là decision của cấp cao

Ghi nhận mâu thuẫn này, sẽ được coordinator xử lý quyết định.

---

## Xác minh R-72 (focus ring)

### Hiện trạng focus ring các component

| Component | Loại ring | Dùng được? | Ghi chú |
|-----------|-----------|-----------|---------|
| Button | CSS `focus-visible:ring-2` | ✓ Có | An toàn |
| Checkbox | CSS `peer-focus-visible:ring-2` | ✓ Có | An toàn |
| Select.Trigger | CSS `focus-visible:ring-2` | ✓ Có | An toàn |
| SegmentedControl.Item | CSS `focus-visible:ring-2` | ✓ Có | An toàn |
| Table.Row | **State-driven** `focused && 'ring-2'` | ❌ Không | **Phá hủy expectAccessible** |
| Slider | **State-driven** `isFocused && 'ring-2'` | ❌ Không | Đã biết — memory line 15 |
| Textarea (readonly) | CSS `focus-visible:ring-0` | ❌ Không | Đã biết — memory line 19 |

### Kết luận R-72

**Table:** ❌ **KHÔNG dùng được với expectAccessible** nếu dùng `Table.Row`
- **Lý do:** `focused` prop là state-driven, không phải CSS `focus-visible:`
- **Giải pháp:** Dùng `<tr>` thô + `Table.Cell` cho static table (không chọn hàng)
- **Nếu cần hàng chọn:** Phải fix component trong MR riêng trước khi dựng màn

**Select:** ✓ **Dùng được với expectAccessible**
- Trigger dùng CSS `focus-visible:ring-2` đúng cách
- A11y đầy đủ: `role="combobox"`, `aria-labelledby`, `aria-expanded`

---

## Đóng ngoặc

Bản giao kèo này cung cấp tất cả props interface, biến thể, và constraint cần để dựng CadBranchConfirm. Các điểm chính:

1. **Không tạo component mới** (R-68) — tất cả có sẵn
2. **Table.Row phá hủy R-72** — phải dùng `<tr>` thô nếu static
3. **Collapsible không có** — dùng `<details>` thô hoặc hỏi coordinator
4. **Motion 240ms mâu thuẫn** — thay 260ms, ghi nhận để coordinator quyết
5. **Focus ring:** Select ✓, Table ❌

Worker tầng tiếp sẽ nhận bản này để viết JSX.
