# Khảo sát Component S-18 "Chuẩn hoá độ dày tường"

## 1. Table — Danh sách tường

### Xuất khẩu và cách nhập

```ts
import { Table } from '@/components/ui/Table';
// Hoặc nhập riêng:
import { TableRoot, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
```

### Sub-component

- `Table.Root` — bao ngành bảng, cung cấp context sắp xếp
- `Table.Header` — phần đầu bảng (`<thead>`)
- `Table.Body` — thân bảng (`<tbody>`)
- `Table.Row` — một hàng (`<tr>`)
- `Table.Head` — tiêu đề cột (`<th>`)
- `Table.Cell` — ô dữ liệu (`<td>`)
- `Table.CheckboxHead` — ô tiêu đề có checkbox chọn tất cả
- `Table.CheckboxCell` — ô có checkbox chọn hàng
- `Table.Skeleton` — khung xương loading
- `Table.Empty` — trạng thái không có dữ liệu
- `Table.Error` — trạng thái lỗi
- `Table.Virtual` — ảo hoá hàng cho danh sách lớn (>100 hàng)

### Props

**`Table.Root`:**
```ts
interface TableRootProps extends React.HTMLAttributes<HTMLDivElement> {
  sortKey?: string | undefined;
  sortDir?: 'asc' | 'desc' | null | undefined;
  onSort?: ((key: string) => void) | undefined;
}
```

**`Table.Row`:**
```ts
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;
  isAttention?: boolean;
  isFlash?: boolean;
  layoutId?: string; // Dùng cho framer-motion layout animation
}
```

**`Table.Head`:**
```ts
interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
  sticky?: boolean;
}
```

**`Table.Cell`:**
```ts
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean;
}
```

### Ví dụ từ stories

```tsx
<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>Tên tường</Table.Head>
      <Table.Head>Độ dày</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    <Table.Row selected>
      <Table.Cell>Tường 1</Table.Cell>
      <Table.Cell>220 mm</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table.Root>
```

### Aria và Role

- `aria-selected` — trên `Table.Row`, cho biết hàng đã chọn
- `aria-sort` — trên `Table.Head`, giá trị `'ascending'`, `'descending'`, `'none'`
- `tabIndex="-1"` — trên `Table.Row` để không nằm trong tab order tự động

### Cảnh báo R-72 — TRÁNH

⚠️ **KHÔNG dùng `Table.Row` để hiển thị một danh sách từ prop.**

`Table.Row` vẽ vòng focus bằng prop `focused` (state), không bằng class `focus-visible:`. Khi `focused={false}` (trạng thái mặc định), hàng chỉ có `outline-none` mà không có vòng thay thế, khiến `expectAccessible` báo lỗi `focus-ring`.

**Cách an toàn:** Thay vì `Table.Row` cho danh sách thực, dùng `role="option"` thuần với `focus-visible:` dạng class (như `WallLayerList.tsx` và `RoomLabelList.tsx` làm).

---

## 2. SegmentedControl — Điều khiển phân đoạn

### Xuất khẩu và cách nhập

```ts
import { SegmentedControl } from '@/components/ui/SegmentedControl';
```

### Sub-component

- `SegmentedControl.Root` — vỏ ngoài
- `SegmentedControl.Item` — từng nút

### Props

```ts
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

interface SegmentedControlOption<T extends string = string> {
  label: string;
  value: T;
  swatch?: string; // Màu mẫu (hex) hiển thị bên cạnh nhãn
  disabled?: boolean;
}
```

### Ví dụ

```tsx
<SegmentedControl
  options={[
    { label: '110', value: '110' },
    { label: '220', value: '220' },
    { label: '330', value: '330' },
    { label: 'Cột BTCT', value: 'btct' },
  ]}
  value={thickness}
  onChange={setThickness}
  aria-label="Độ dày tường"
/>
```

### Aria và Role

- `role="radiogroup"` — trên `SegmentedRoot`
- `role="radio"` — trên mỗi nút `Item`
- `aria-checked` — trên nút active
- `aria-label` — trên Root để mô tả mục đích

### Chuyển động

Khi active, hiển thị một `motion.div` với `layoutId` để tạo hiệu ứng dịch từ nút cũ sang nút mới. Đã bằng `durationSeconds('fast')` từ `src/lib/motion`.

---

## 3. NumericField — Ô nhập số

### Xuất khẩu và cách nhập

```ts
import { NumericField } from '@/components/ui/NumericField';
```

### Props

```ts
interface NumericFieldProps
  extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'>,
    UseNumericFieldProps {
  unit?: string;
}
```

Thừa kế từ `Input` (có `label`, `error`, `hint`, `prefix`, `suffix`, `isLoading`, `isReadOnly`).

```ts
interface UseNumericFieldProps {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
}
```

### Ví dụ

```tsx
<NumericField
  value={thickness}
  onChange={setThickness}
  min={0}
  max={500}
  unit="mm"
  label="Độ dày"
/>
```

### Aria và Role

- `role="spinbutton"` — thông qua hook nội bộ
- Stepper (nút +/-) có `aria-label` ("tăng giá trị", "giảm giá trị")
- Nhận `aria-invalid` khi có lỗi

### Chi tiết

- Hiển thị hai nút stepper (+/-) khi hover, mất khi disabled/readOnly/loading
- Xử lý phím mũi tên lên/xuống và Ctrl+lên/xuống
- Format font `mono`, text-right

---

## 4. Badge — Thẻ nhỏ

### Xuất khẩu và cách nhập

```ts
import { Badge } from '@/components/ui/Badge';
```

### Props

```ts
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: 'verified' | 'attention' | 'violation' | 'neutral';
  children: React.ReactNode;
  noDot?: boolean;
}
```

### Ví dụ

```tsx
<Badge variant="verified">Đã duyệt</Badge>
<Badge variant="attention" noDot>Cần chú ý</Badge>
```

### Aria và Role

- Không có role riêng, chỉ là `<span>` với inline-flex
- Chấm tính năng có `aria-hidden="true"`

---

## 5. Button — Nút bấm

### Xuất khẩu và cách nhập

```ts
import { Button } from '@/components/ui/Button';
```

### Props

```ts
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; // 'primary', 'secondary', 'danger', 'ghost', etc.
  size?: ButtonSize; // 'xs', 'sm', 'md', 'lg'
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
  icon?: React.ReactNode; // @deprecated, use iconBefore
  iconOnly?: boolean;
  loading?: boolean;
  shortcut?: string;
  fullWidth?: boolean;
}
```

### Ví dụ

```tsx
<Button variant="primary" size="md" onClick={handleApprove}>
  Duyệt
</Button>

<Button variant="danger" iconBefore={<X size={15} />} loading={isLoading}>
  Từ chối
</Button>
```

### Aria và Role

- `disabled` tự động khi `loading={true}`
- `title` mở rộng với shortcut nếu có
- Icon-only button phải có `aria-label`

---

## 6. Checkbox — Hộp chọn

### Xuất khẩu và cách nhập

```ts
import { Checkbox } from '@/components/ui/Checkbox';
```

### Props

```ts
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  error?: boolean;
}
```

### Ví dụ

```tsx
<Checkbox
  checked={isSelected}
  onChange={setIsSelected}
  label="Chọn tất cả"
/>

<Checkbox
  checked={isSelected}
  indeterminate={isIndeterminate}
  onChange={handleChange}
/>
```

### Aria và Role

- `aria-invalid` khi `error={true}`
- Vòng focus qua `peer-focus-visible:ring-2`
- Nội bộ có `<input type="checkbox">` ẩn (`sr-only`)

---

## 7. Slider — Thanh trượt

### Xuất khẩu và cách nhập

```ts
import { Slider } from '@/components/ui/Slider';
```

### Props

```ts
interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  endLabels?: [string, string];
  'aria-label'?: string;
  snapPoints?: number[];
  isLoading?: boolean;
}
```

### Ví dụ

```tsx
<Slider
  min={0}
  max={100}
  step={5}
  value={thickness}
  onChange={setThickness}
  aria-label="Độ dày tường"
  snapPoints={[0, 25, 50, 75, 100]}
/>
```

### Aria và Role

- `role="slider"` trên knob
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- `aria-readonly` khi readOnly

### Cảnh báo R-72 — TRÁNH

⚠️ **Slider có vòng focus theo state `isFocused`.** Khi blur, vòng biến mất dù keyboard vẫn có thể tiếp cận được.

Tương tự như `Table.Row`, đây là focus-ring-by-state chứ không class-based. Để dùng an toàn, kiểm tra xem màn có phải hiển thị Slider trên danh sách thường xuyên thay đổi focus hay không — nếu không, cánh báo này có thể bỏ qua vì người bằng phím tuần tự sẽ nhìn thấy vòng lúc tiếp cận.

---

## 8. TableActionBar — Dải hành động dính đáy

### Xuất khẩu và cách nhập

```ts
import { TableActionBar } from '@/components/ui/TableActionBar';
```

### Props

```ts
interface TableActionBarProps {
  selectedCount: number;
  entityName?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onChangeThickness?: () => void;
  onDeselect?: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}
```

### Ví dụ

```tsx
<TableActionBar
  selectedCount={5}
  entityName="tường"
  onApprove={handleApprove}
  onReject={handleReject}
  onChangeThickness={handleChangeThickness}
  onDeselect={handleDeselect}
  isApproving={isLoading}
/>
```

### Aria và Role

- `role="toolbar"` trên div chính
- `aria-label` mô tả số mục chọn
- Nút "Bỏ chọn" có `aria-label`

### Chuyển động

- `AnimatePresence` + `motion.div` với animate initial/exit
- `durationSeconds('fast')` từ `src/lib/motion`
- Chỉ hiển thị khi `selectedCount > 0`

---

## 9. SelectionHalo — Viền chọn trên canvas

### Xuất khẩu và cách nhập

```ts
import { SelectionHalo } from '@/components/canvas/SelectionHalo';
```

### Props

```ts
interface SelectionHaloProps {
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
  variant?: SelectionVariant; // 'selected' | 'hover'
  hasEntered?: boolean;
  className?: string;
}
```

### Ví dụ

```tsx
<SelectionHalo
  x={100}
  y={200}
  width={300}
  height={150}
  isVisible={isSelected}
  variant="selected"
  hasEntered={hasAnimated}
/>
```

### Aria và Role

- `role="presentation"`
- `aria-hidden="true"` — thuần trang trí

### Chi tiết

- **selected**: viền 1,5px + nền fill 12% opacity
- **hover**: viền 1px, không fill
- Animation: fade + scale 120ms ease-out

---

## 10. WallThicknessLegend — Chú giải độ dày

### Xuất khẩu và cách nhập

```ts
import { WallThicknessLegend } from '@/components/canvas/WallThicknessLegend';
```

### Props

```ts
interface WallThicknessLegendProps {
  isVisible?: boolean;
  state?: 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'no-permission' | 'collapsed';
  availableLevels?: WallThickness[];
  className?: string;
}
```

### Ví dụ

```tsx
<WallThicknessLegend
  isVisible={true}
  state="success"
  availableLevels={['110', '220', '330', 'CONCRETE_COLUMN']}
/>
```

### Aria và Role

- `role="group"` ở trạng thái success/partial
- `role="alert"` khi error
- `aria-busy="true"` khi loading
- Từng button có `aria-pressed` và `aria-label`

### Trạng thái

- **empty**: "Chưa có dữ liệu tường"
- **loading**: Khung xương 4 hàng
- **partial**: Hiển thị chỉ các cấp có dữ liệu
- **error**: "Không tải được chú giải"
- **success**: Đầy đủ 4 cấp
- **no-permission**: Trả về `null`
- **collapsed**: Chỉ một con chữ "T"

---

## 11. ThicknessField — Ô độ dày tường chuyên biệt

### Xuất khẩu và cách nhập

```ts
import { ThicknessField } from '@/components/ui/ThicknessField';
```

### Props

```ts
interface ThicknessFieldProps {
  value?: WallThickness; // '110' | '220' | '330' | 'btct'
  onChange?: (value: WallThickness) => void;
  aiOriginalMm?: number;
  disabled?: boolean;
  isLoading?: boolean;
  isReadOnly?: boolean;
  error?: string;
  className?: string;
}
```

### Ví dụ

```tsx
<ThicknessField
  value={thickness}
  onChange={setThickness}
  aiOriginalMm={215}
  aria-label="Độ dày tường"
/>
```

### Chi tiết

- Dùng `SegmentedControl` nội bộ với 4 option: 110, 220, 330, Cột BTCT
- Hiển thị caption "Giá trị AI gốc: XXX mm" để so sánh
- Hiển thị lỗi nếu có

---

## 12. ConfidenceMeter — Cột độ tin cậy

### Xuất khẩu và cách nhập

```ts
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
```

### Props

```ts
interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 1
  noTooltip?: boolean;
}
```

### Ví dụ

```tsx
<ConfidenceMeter value={0.75} />
<ConfidenceMeter value={0.62} noTooltip={true} />
```

### Aria và Role

- `role="meter"` trên thanh
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Tooltip (nếu không `noTooltip`): "Độ tin cậy AI 0,75"

### Màu

- < 0,70: `state-attention` + gạch chéo 45° (6% opacity)
- ≥ 0,70: `text-muted`

### Format

- Dấu thập phân là dấu phẩy (0,75 chứ không 0.75)

---

## 13. Bộ khẳng định — Testing utilities

Nằm ở `src/lib/testing/`.

### `expectAccessible(element, options?)`

```ts
function expectAccessible(
  element: HTMLElement,
  options?: AccessibilityOptions
): AccessibilityReport;
```

Kiểm tra:
- Mọi điều khiển có tên tiếp cận (aria-label, aria-labelledby, hoặc text)
- `<img>` có `alt`
- Tabindex ≤ 0 (không tự sắp xếp tab order)
- Vòng focus hiện rõ (ring-offset-2)
- Contrast tối thiểu 4,5:1 cho body text, 3:1 cho caption

### `expectVietnamese(container)`

Kiểm tra chuỗi tiếng Anh sót lại và ký tự mất dấu (ví dụ "Trang" thay vì "Trang"). Dùng `src/i18n/vi.json` làm từ điển.

### `expectNoRawColor(container)`

Quét mã màu thô (hex, rgb, hsl) — cấm luật A1.

### `expectSevenStates(element, descriptions)`

Kiểm tra component hiển thị đúng bảy trạng thái của A11 (empty, loading, error, success, no-permission, forbidden, collapsed).

### `render(jsx, options?)`

Tương tự `@testing-library/react.render` nhưng bao gói `MotionProvider` và khả năng bố trí thẻ SVG, canvas.

### `fixtures` object

Chứa các fixture định sẵn (`cleanBuildingScenario`, `violatedBuildingScenario`, v.v.).

### `fakeClock` object

Hỗ trợ test thời gian với `vitest.useFakeTimers()`.

### `sevenStateScenarios` array

Năm kịch bản màn QC mẫu, dùng cho test trạng thái.

---

## 14. Chuyển động — Motion components

### Import

```ts
import { motion, AnimatePresence, MotionProvider } from '@/components/motion';
```

**Ghi nhớ:** Chỉ có `src/components/motion/index.ts` được phép nhập `framer-motion` — luật ESLint `local/no-framer-outside-motion` mức error.

### MotionProvider

Bao gói cây ứng dụng đúng một lần. Đặt `reducedMotion="user"` để tôn trọng cấu hình OS.

```tsx
export function App() {
  return (
    <MotionProvider>
      {/* ứng dụng */}
    </MotionProvider>
  );
}
```

### `motion.div`, `motion.tr`, etc.

Thành phần framer-motion tiêu chuẩn.

```tsx
<motion.div
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 4 }}
  transition={{ duration: 0.18 }} // durationSeconds('fast')
/>
```

### Layout animation

Dùng cho các hàng thay đổi thứ tự. `Table.Row` hỗ trợ bằng prop `layoutId`:

```tsx
<Table.Row layoutId={`row-${id}`} layout>
  {/* */}
</Table.Row>
```

### useCountUp

Chạy số từ giá trị cũ lên giá trị mới. Nằm ở `src/hooks/useCountUp.ts`.

```ts
const { text } = useCountUp(248.60, { format: { fractionDigits: 2 } });
```

**Ghi nhớ:** Không dùng `src/lib/motion/useCountUp.ts` (đó là engine thuần, không có React). Dùng hook ở `src/hooks/` thay.

---

## 15. Khuôn màn QC anh em — Ví dụ bố cục

### WallLayerReview — Bố cục tham khảo

**File:** `src/screens/qc/WallLayerReview/`

Cấu trúc:
- `WallLayerReview.tsx` — container tổng hợp, gọi hook
- `WallLayerReview.container.tsx` — bao gói store/query (nếu cần)
- `WallLayerLeftPanel.tsx` — panel trái (danh sách)
- `WallLayerCanvas.tsx` — canvas giữa (2D)
- `WallLayerLegend.tsx` — chú giải trên canvas
- `WallLayerInspector.tsx` — panel phải (chi tiết)
- `useWallLayerReview.ts` — logic màn

**Props container:**

```ts
interface WallLayerViewProps {
  walls: WallRowViewModel[];
  selectedWallId: WallId | null;
  hoveredWallId: WallId | null;
  canvasState: WallLayerScreenState;
  flashingWallId: WallId | null;
  // ... các prop khác
}
```

**Danh sách (`WallLayerList.tsx`):**
- Dùng `role="option"` + `focus-visible:` (KHÔNG `Table.Row`)
- Ảo hoá với `@tanstack/react-virtual`
- Các row cao 40px
- Chấm trạng thái + Badge độ dày

### RoomLabelReview — Bố cục tham khảo

**File:** `src/screens/qc/RoomLabelReview/`

Cấu trúc tương tự `WallLayerReview`:
- `RoomLabelReview.tsx` — container
- `RoomLabelLeftPanel.tsx` — panel trái
- `RoomLabelCanvas.tsx` — canvas giữa
- `RoomLabelInspector.tsx` — panel phải
- `useRoomLabelReview.ts` — logic

**Danh sách (`RoomLabelList.tsx`):**
- `role="option"` + `focus-visible:` (không `Table.Row`)
- Row cao 40px
- Bàn phím: Tab chuyển focus, Enter/Space chọn, ↑/↓ di chuyển

---

## 16. Chú ý kiến trúc

### Tách D — logic ra khỏi view

Khuôn mẫu của màn QC:
- **View thuần** (`*Screen.tsx`): nhận props, hiển thị, không chạm store/query
- **Hook logic** (`use*Screen.ts`): xử lý state, phép tính, gọi query/mutation
- **Container** (`*Screen.container.tsx`): kết nối hook vào store/query

### Ranh giới import

- `src/lib/**` — **TUYỆT ĐỐI cấm React** (ngoài `src/lib/testing/**`)
- `src/components/**` — cấm gọi store.set() trực tiếp (dùng commit)
- `src/screens/**` — nơi duy nhất gọi query/mutation

### Thang thời lượng

**Chỉ dùng những hằng này từ `src/lib/motion/tokens.ts`:**

```ts
MOTION_DURATIONS_MS = {
  instant: 0,
  fast: 120,
  standard: 180,
  slow: 260,
  slowest: 340,
  lazy: 700,
}
```

Dùng helper: `durationSeconds('fast')` → `{ duration: 0.12 }`

---

## 17. Bản kê NOT FOUND

### Component/Hook không tìm được

- **Layout animation wrapper** — Không có component riêng bọc `framer-motion` layout cho danh sách. Dùng `layoutId` trên từng `motion.*` element hoặc `Table.Row` có sẵn.
- **Number input format hook** — Không có hook chuyên biệt định dạng số trong ô nhập. `NumericField` dùng hook nội bộ `useNumericField` từ `src/hooks/`.
- **Combobox/Autocomplete** — Không tìm được component dùng chung. Nếu cần gợi ý, phải dựng riêng trong màn.
- **Dialog/Modal** — Không có component dialog tổng quát. Dùng `@radix-ui/react-dialog` trực tiếp nếu cần.

---

## 18. Ghi chú bổ sung

### Formát số — A15

Dấu thập phân **luôn là dấu phẩy**, định dạng ở tầng hook/viewmodel, không ở view:

```ts
// Hook: định dạng rồi truyền xuống
const displayArea = formatNumber(area, { fractionDigits: 2 });

// View: chỉ hiển thị
<span>{displayArea}</span>
```

### Màu — A1

**Cấm hex/rgb/hsl** ở tầng giao diện. Lấy từ token CSS:

```tsx
// ✗ Sai
style={{ color: '#FF0000' }}

// ✓ Đúng
className="text-state-attention"
```

### Bàn phím — A12

Escape **luôn đóng lớp trên cùng**. Dùng `useShortcut` từ `src/hooks/`:

```ts
useShortcut({
  id: 'uniqueId',
  combo: 'Escape',
  scope: 'sidePanel',
  onTrigger: () => handleDeselect(),
});
```

---

## Tham khảo thêm

- `CLAUDE.md` — Quy tắc toàn repo, bất biến A1–A15
- `docs/contracts/` — Hợp đồng component chi tiết
- `src/lib/testing/` — Suite assertion
- `src/components/motion/index.ts` — Cửa duy nhất cho framer-motion
- `src/screens/qc/WallLayerReview/` + `RoomLabelReview/` — Ví dụ bố cục QC
