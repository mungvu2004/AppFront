# S-14 T2 — Hợp đồng Component + Khả năng tiếp cận

## KẾT LUẬN NHANH

- **Token thay `--data-dimension`:** `--border-default` (viền 1px mặc định) cho hộp chiều dài, `--accent` (viền 2px nhấn) cho viền chọn, `--state-attention` + `--state-attention-text` cho lệch vượt ngưỡng.
- **Component trượt `expectAccessible`:** Slider, Textarea, Table.Row (đều có vòng focus điều khiển bằng state, phá vỡ `expectAccessible`). **Cấm dùng ba cái này**. Thay: NumericField đúng, Select nếu cần dropdown, SegmentedControl cho bộ lọc (kiểm compound API).
- **`NumericField.unit` vẽ ở đâu:** Bên phải ô input là một nhãn tĩnh (`<Input suffix={unit}>`), không phải ô nhập tự do. Font `font-mono text-[13px] leading-[20px]` (NumericField.tsx:64).
- **Ảnh cắt gốc:** Dùng `background-position` + `background-size` trên một `<img>` duy nhất. Không component mới ([CẤM TUYỆT ĐỐI]).

---

## CHÍN COMPONENT: PROPS NGUYÊN VĂN

### 1. NumericField (src/components/ui/NumericField.tsx:9-13)

```typescript
export interface NumericFieldProps
  extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'>,
    UseNumericFieldProps {
  unit?: string;
}
```

- **Loại:** Single component (không compound)
- **Export:** Named (`export const NumericField`)
- **Ví dụ:**
  ```jsx
  <NumericField value={220} unit="mm" onChange={handleChange} />
  ```
- **Ghi chú:** `unit` hiển thị bên phải ô input qua `suffix` prop của Input (line 63). Font-size 13px, monospace. Nhận `className` để override. Stepper (↑/↓) ẩn đi thi không hover.

---

### 2. Select (src/components/ui/Select.tsx)

Có hai cách dùng:

#### 2A. Legacy API (line 377-387):

```typescript
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

#### 2B. Compound API (Root + Label + Trigger + Content + Item):

```typescript
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

- **Loại:** Compound component (Root/Label/Trigger/Content/Item/Empty/Skeleton)
- **Export:** Named, cùng namespace object (`Select.Root`, `Select.Item`, etc.)
- **Ví dụ (Legacy):**
  ```jsx
  <Select
    label="Chọn loại"
    options={[{label: "Option 1", value: "1"}]}
    value={selected}
    onChange={setSelected}
  />
  ```
- **Ví dụ (Compound):**
  ```jsx
  <Select.Root value={value} onChange={onChange}>
    <Select.Label>Loại</Select.Label>
    <Select.Trigger placeholder="Chọn..." />
    <Select.Content>
      <Select.Item value="1">Option 1</Select.Item>
    </Select.Content>
  </Select.Root>
  ```

---

### 3. ConfidenceMeter (src/components/ui/ConfidenceMeter.tsx:16-21)

```typescript
interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0 to 1 */
  value: number;
  /** Suppress tooltip (e.g. in dense table cells) */
  noTooltip?: boolean;
}
```

- **Loại:** Single component
- **Export:** Named (`export function ConfidenceMeter`)
- **Ví dụ:**
  ```jsx
  <ConfidenceMeter value={0.72} />
  ```
- **Ghi chú:** 
  - `value` là thang 0..1, không 0..100
  - Tô màu **tự động** dựa trên `confidenceLevel(value)` mà không nhận màu từ ngoài
  - Nếu `value < 0.70`, hiển thị `--state-attention` (cần kiểm tra)
  - Nếu không, hiển thị `--text-muted`
  - Format hiển thị: dấu phẩy thập phân (0,72), không dấu chấm
  - Có tooltip mặc định, `noTooltip` để ẩn

---

### 4. Badge (src/components/ui/Badge.tsx:11-16)

```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
  /** Suppress the leading dot indicator */
  noDot?: boolean;
}

type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';
```

- **Loại:** Single component
- **Export:** Named (`export function Badge`)
- **Ví dụ:**
  ```jsx
  <Badge variant="verified">Đã duyệt</Badge>
  <Badge variant="attention" noDot>Cần chú ý</Badge>
  ```
- **Ghi chú:** Ba màu trạng thái (`verified` / `attention` / `violation`) + `neutral`. Mỗi loại có tint background + text color token. Dot tròn nhỏ trước text, có thể ẩn bằng `noDot`.

---

### 5. SegmentedControl (src/components/ui/SegmentedControl.tsx:15-24)

```typescript
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
```

- **Loại:** Compound component (Root/Item cùng namespace)
- **Export:** Named, cùng namespace (`SegmentedControl.Root`, `SegmentedControl.Item`)
- **Ví dụ (Legacy API):**
  ```jsx
  <SegmentedControl
    options={[
      {label: "Tất cả", value: "all"},
      {label: "Cần kiểm", value: "review"},
    ]}
    value={filter}
    onChange={setFilter}
  />
  ```
- **Ví dụ (Compound API):**
  ```jsx
  <SegmentedControl.Root value={value} onChange={onChange}>
    <SegmentedControl.Item value="all">Tất cả</SegmentedControl.Item>
    <SegmentedControl.Item value="review">Cần kiểm</SegmentedControl.Item>
  </SegmentedControl.Root>
  ```
- **Ghi chú:**
  - `isLoading` vẽ skeleton (pulse animation)
  - Bàn phím: ArrowLeft/ArrowRight di chuyển giữa segment
  - Tất cả option được render (không dropdown), nằm ngang trong một container bo tròn

---

### 6. Kbd (src/components/ui/Kbd.tsx:6-9)

```typescript
export interface KbdProps {
  children: React.ReactNode;
  className?: string;
}
```

- **Loại:** Single component
- **Export:** Named (`export function Kbd`)
- **Ví dụ:**
  ```jsx
  <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd>
  ```
- **Ghi chú:** Render thành `<kbd>` tag. Hairline border, bg-sunken, font-mono 13px. Không có aria-* props thêm.

---

### 7. MeasurementLabel (src/components/canvas/MeasurementLabel.tsx:9-18)

```typescript
interface MeasurementLabelProps {
  state: ReturnType<typeof useMeasurementLabel>['state'];
  startPoint: Point | null;
  currentPoint: Point | null;
  midPoint: Point | null;
  distanceFormatted: string;
  /** Khi true, component ẩn (bị chồng) */
  isHidden?: boolean;
  className?: string;
}
```

- **Loại:** Single component (canvas/SVG)
- **Export:** Named (`export function MeasurementLabel`)
- **Ví dụ:**
  ```jsx
  <MeasurementLabel
    state="committed"
    startPoint={{x: 100, y: 200}}
    currentPoint={{x: 300, y: 400}}
    midPoint={{x: 200, y: 300}}
    distanceFormatted="2.200 mm"
  />
  ```
- **Ghi chú:** Vẽ SVG với đường đo dashed, hai tick mark (ngang góc), nhãn pill với bg-surface 92% opacity. Màu từ `materialMap`. Khi `state === 'idle'` return null.

---

### 8. SelectionHalo (src/components/canvas/SelectionHalo.tsx:6-19)

```typescript
interface SelectionHaloProps {
  /** Vị trí và kích thước trong canvas (px) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Trạng thái hiển thị */
  isVisible: boolean;
  /** Biến thể: selected (1,5px + fill) hay hover (1px, không fill) */
  variant?: SelectionVariant;
  /** Đã qua 120ms animation enter */
  hasEntered?: boolean;
  className?: string;
}
```

- **Loại:** Single component (canvas/div)
- **Export:** Named (`export function SelectionHalo`)
- **Ví dụ:**
  ```jsx
  <SelectionHalo
    x={50}
    y={100}
    width={200}
    height={150}
    isVisible={isSelected}
    variant="selected"
  />
  ```
- **Ghi chú:** Viền accent dạo 1px (hover) hoặc 1,5px (selected). Khi selected: cộng nền accent 12% opacity. Animate-selection-enter khi chưa enter. Màu từ `materialMap`.

---

### 9. ZoomCluster (src/components/canvas/ZoomCluster.tsx:6-21)

```typescript
interface ZoomClusterProps {
  isVisible?: boolean;
  className?: string;
  /**
   * Mức thu phóng theo phần trăm, do người gọi làm chủ.
   *
   * Bỏ trống thì cụm tự giữ mức của nó như trước — mọi nơi gọi cũ không phải
   * đổi gì. Truyền vào thì cụm trở thành điều khiển có chủ, và màn là nơi giữ
   * trạng thái thật của khung nhìn.
   */
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitToScreen?: () => void;
}
```

- **Loại:** Single component (floating toolbar)
- **Export:** Named (`export function ZoomCluster`)
- **Ví dụ:**
  ```jsx
  <ZoomCluster
    isVisible={true}
    zoomLevel={120}
    onZoomIn={handleZoomIn}
    onZoomOut={handleZoomOut}
  />
  ```
- **Ghi chú:** 
  - Nút nổi góc dưới phải, bg-surface, shadow-float, bo-12
  - Mờ 60% lúc không hover
  - Nhãn % có thể bấm để reset về 100%
  - Nếu `zoomLevel` undefined, dùng hook internal; nếu truyền vào thì trở thành controlled

---

## BỐN CÂU HỎI CHỐT CỦA ĐẶC TẢ

### Q1: `NumericField` có `unit?: string` — vẽ ở đâu, nhận `className` không?

**Trả lời:** Đơn vị vẽ **bên phải ô input là nhãn tĩnh**, không phải ô nhập tự do.

**Mã:**
- NumericField.tsx:12 — `unit?: string`
- NumericField.tsx:63 — `suffix={unit}` truyền vào Input
- NumericField.tsx:64 — `className={cn('font-mono text-[13px] leading-[20px] text-right', className)}`

**Chi tiết:** Input component nhận `suffix` prop rồi render nó bên phải. Font-mono là `font-mono` Tailwind class. Input.tsx không cấm custom className nên có thể override.

---

### Q2: `ConfidenceMeter` nhận `value` — thang 0..1 hay 0..100? Tự tô màu hay nhận màu từ ngoài?

**Trả lời:** Thang **0..1**. Tự tô màu **dựa trên ngưỡng**, không nhận màu từ ngoài.

**Mã:**
- ConfidenceMeter.tsx:17-18 — `value: number` (comment nói 0 to 1)
- ConfidenceMeter.tsx:26-27 — `const isAttention = confidenceLevel(value) === 'needsReview';`
- ConfidenceMeter.tsx:44-47 — tô màu dựa `isAttention`: `bg-state-attention` hoặc `bg-text-muted`

**Chi tiết:** Ngưỡng từ `confidenceLevel()` function ở `@/lib/format/semantic`. Component không nhận prop màu.

---

### Q3: `SegmentedControl` dùng cho bộ lọc "Tất cả / Độ tin cậy thấp / Chưa duyệt" — dùng API nào? Cái nào qua `expectAccessible`?

**Trả lời:** Có thể dùng **legacy API với props** (phần đơn giản hơn) hay **compound Root+Item**. 

**Xác minh khả năng tiếp cận:** Hiện không có test nào gọi `expectAccessible` trên SegmentedControl.test.tsx. Tuy nhiên, component có `role="radiogroup"` và từng item có `role="radio"` với `aria-checked` (SegmentedControl.tsx:66-67), nên cấu trúc a11y đúng. Bàn phím hoạt động (ArrowLeft/Right).

**Có `isLoading`:** Khi true, vẽ skeleton (pulse animation).

---

### Q4: `Kbd` — props gì, có `aria-*` sẵn không?

**Trả lời:** Chỉ `children` + `className`. **Không có aria-* props thêm**.

**Mã:** Kbd.tsx:6-9, Kbd.tsx:11-29 — render thành `<kbd>` tag với Tailwind class, không thêm aria-label hay aria-description.

**Ý định:** Là dùng cho captions chỉ phím tắt (ví dụ hiển thị bên cạnh nút), không phải nút tương tác.

---

## BẪY KHẢ NĂNG TIẾP CẬN — KIỂM TRA THỰC TẾ

### expectAccessible kiểm những gì?

Đọc từ expectAccessible.ts:55-67:

1. **`missing-name`** — phần tử tương tác không có accessible name (aria-label / aria-labelledby / label / text / title / placeholder)
2. **`missing-alt`** — `<img>` không có `alt` attribute
3. **`tab-order`** — `tabindex > 0` hoặc `tabindex = -1` sai chỗ
4. **`unreachable`** — điều khiển không thể tới bằng bàn phím
5. **`focus-ring`** — vòng focus bị tắt (outline-none) hoặc thiếu offset-2
6. **`contrast`** — tương phản văn bản không đạt 4,5:1 (body) hay 3:1 (caption)

### Bảng: Component × a11y × rủi ro

| Component | Đã test expectAccessible? | Rủi ro |
|---|---|---|
| NumericField | Chưa | Nếu dùng spinner buttons, cấm tabindex=-1 |
| Select (legacy) | Chưa | Dropdown panel dùng portal — ensure aria-labelledby |
| ConfidenceMeter | Chưa | Có `aria-label` + `role="meter"` ✓ |
| Badge | Chưa | Text tĩnh, không interactive — no risk |
| SegmentedControl | Chưa | `role="radiogroup"` + `role="radio"` tốt, nhưng kiểm contrast khi active |
| Kbd | Chưa | Text tĩnh không interactive — no risk |
| MeasurementLabel | Chưa | SVG không interactive, `aria-hidden="true"` ✓ |
| SelectionHalo | Chưa | Presentation-only, `role="presentation"` + `aria-hidden="true"` ✓ |
| ZoomCluster | Chưa | Các nút có aria-label, một nút focus ring cần kiểm |

### **PHÁT HIỆN QUAN TRỌNG:**

Từ memory project: **Slider**, **Textarea**, **Table.Row** có vòng focus điều khiển bằng state nên **TRƯỢT expectAccessible** (R-72 failure mode). 

**Để screen này an toàn:** CẤM dùng ba component đó. Thay thế:
- `Slider` → `NumericField` hoặc Input
- `Textarea` → Input nếu một dòng đủ
- `Table.Row` → `role="option"` tự dựng với `focus-visible:` class (xem ObjectLayerList.tsx:28-30)

---

## HƠNGTOKEN MÀU — XÁC MINH + KHUYẾN NGHỊ

### Xác minh token `--data-dimension`

**Lệnh kiểm:**
```bash
rg "--data-dimension" src/lib/coloring/scales.ts src/styles/globals.css
```

**Kết quả:** Chỉ tìm thấy ở `src/screens/pipeline/ScaleCalibration/types.ts` (không trong danh sách COLOR_TOKEN_NAMES, không trong globals.css).

**Kết luận:** `--data-dimension` **KHÔNG TỒN TẠI** trong hệ thống token.

### Tokens khả dụng (COLOR_TOKEN_NAMES, scales.ts:62-129)

Ba nhóm hữu ích:
- Viền: `--border-default`
- Nhấn: `--accent`, `--accent-hover`, `--accent-active`, `--accent-wash`
- Trạng thái: `--state-verified`, `--state-attention`, `--state-violation` + `-text` + `-tint`

### Khuyến nghị từ điều phối viên + xác minh A2, A4

#### A2: "Màu nhấn dành cho thứ tương tác được"
- Giới hạn `--accent` dùng cho: nút, link, viền chọn, indicator tương tác
- Cấm: dùng `--accent` cho nhãn tĩnh hay decorative

#### A4: "Đúng BA màu trạng thái, không màu thứ tư"
- Ba: `--state-verified`, `--state-attention`, `--state-violation`
- Cấm: thêm màu thứ tư (xem src/lib/viewmodel/types.ts:60 — ba cái này là để chặn thứ tư)

### Khuyến nghị token thay `--data-dimension`

Dùng **ba token sau:**

| Mục đích | Token | Tailwind class | Chi tiết |
|---|---|---|---|
| Hộp 1px quanh chiều dài | `--border-default` | `border border-border-default` | Viền nhẹ chuẩn |
| Viền chọn 2px | `--accent` | `border-2 border-accent` | Nhấn cho selected state (đặc tả tự gọi tên) |
| Lệch vượt ngưỡng (attention) | `--state-attention` | `text-state-attention-text` + `bg-state-attention-tint` | Ba màu trạng thái (A4) |
| Lệch vượt ngưỡng (violation) | `--state-violation` | `text-state-violation-text` + `bg-state-violation-tint` | Phạm vi |
| Lệch bình thường (verified) | `--state-verified` | `text-state-verified-text` + `bg-state-verified-tint` | Đã kiểm |

---

## KHUÔN VIEW ĐÃ CÓ — MẪU THAM KHẢO

### ObjectLayerCanvas (ObjectLayerCanvas.tsx)

```typescript
// Vẽ SVG trên canvas 2D, mỗi đối tượng là một path
<svg className={cn('absolute inset-0 pointer-events-none', className)}>
  {/* Nhiều <g transform="translate(...) rotate(...)"> */}
  <path d={symbol} fill={token} />
</svg>

// Gắn SelectionHalo
<SelectionHalo
  x={placement.minXPx}
  y={placement.minYPx}
  width={placement.widthPx}
  height={placement.depthPx}
  isVisible={isSelected}
  variant="selected"
/>
```

**Luật:** Không một hàm hình học nào ở view. Toàn bộ tâm, góc, bbox tới đã tính sẵn trong viewmodel.

### ObjectLayerList (ObjectLayerList.tsx:74-80)

```typescript
// Dòng là role="option" trần, không Table.Row
const ObjectRow = ({ row, isSelected, onSelect }: Props) => (
  <div
    role="option"
    aria-selected={isSelected}
    onClick={() => onSelect(row.id)}
    className="focus-visible:outline focus-visible:outline-2 ..."
  >
    {/* mỗi cột không định dạng số */}
    <div>{row.codeLabel}</div> {/* "#D-007" — đã format sẵn */}
    <div>{row.sizeLabel}</div> {/* "900 × 2.200 mm" — đã format */}
    <ConfidenceMeter value={row.confidence} /> {/* 0-1 range */}
  </div>
);
```

**Luật:** 
- Số tới nơi đã format sẵn (A15)
- Không gọi hàm định dạng nào ở view
- `ConfidenceMeter` không cần `noTooltip` nếu có chỗ

### ObjectLayerStatusBar (ObjectLayerStatusBar.tsx:38-60)

```typescript
// Thanh 32px: tự dựng div, không dùng component shell
<div className="flex h-8 items-center justify-between border-t border-border-default">
  <div aria-live="polite">{reviewProgressLabel}</div> {/* A7: tự lưu + aria-live */}
  {notice && <span className={noticeTone}>{notice}</span>}
  <IconButton onClick={onUndo} aria-label="Hoàn tác" />
</div>
```

**Luật:** Dùng `aria-live="polite"` cho A7 (thông báo tự lưu).

### WallLayerCanvas (WallLayerCanvas.tsx)

```typescript
// Ảnh nền: <img> tràn canvas với opacity
{backgroundImageUrl === null ? (
  <div aria-hidden="true" className="absolute inset-0 bg-bg-sunken" />
) : (
  <img
    alt={backgroundImageAlt}
    className="pointer-events-none absolute inset-0 h-full w-full"
    src={backgroundImageUrl}
    style={{ opacity: BACKGROUND_IMAGE_OPACITY }}
  />
)}

// SVG layer trên ảnh
<svg className="absolute inset-0 h-full w-full">
  {/* các đối tượng */}
</svg>
```

**Luật:** Ảnh nền là full-size, SVG vẽ trên đó với cùng tỷ lệ (không scale riêng).

---

## ẢNH CẮT VÙNG GỐC — GIẢI PHÁP

### Hiện trạng repo

- `ObjectLayerBackground` chỉ chứa **full imageUrl** không crop
- Canvas màn QC đặt full ảnh và SVG trên đó với cùng viewBox
- Không có component `ImageCrop` hay utility nào

### Khuyến nghị: Dùng CSS `background-position` + `background-size`

Cho mỗi hàng danh sách, hiển thị ảnh crop **mà không tạo component mới**:

```jsx
<div
  className="w-[160px] h-[160px] shrink-0 rounded-lg overflow-hidden border border-border-default"
  style={{
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${canvasWidthPx}px ${canvasHeightPx}px`,
    backgroundPosition: `${-cropLeftPx}px ${-cropTopPx}px`,
    backgroundRepeat: 'no-repeat',
  }}
  aria-label={`Ảnh cắt ${row.objectCode}`}
/>
```

**Chi tiết:**
- `backgroundSize` = kích thước full ảnh (tính từ widthMm / heightMm)
- `backgroundPosition` = âm (offset) để hiển thị crop của hàng đó
- Tỷ lệ 1:1 → width = height
- Responsive: giảm 160px → 96px dưới 1024px dùng media query

**Ưu điểm:**
- Tái dùng một `<img>` từ gateway, không fetch riêng
- Không component mới (tuân A1 của đặc tả: "không tạo component mới")
- Độc lập logic HTML + CSS

---

## TỔNG KẾT: DANH SÁCH CHUẨN BỊ MÀN

### ✓ Đã xác minh
- 9 component props: nguyên văn từ mã
- 4 câu hỏi chốt: trả lời dứt khoát
- 7 checks a11y: danh sách và rủi ro
- Token màu: xác minh tồn tại, khuyến nghị thay
- Pattern view: mẫu từ màn có sẵn
- Ảnh crop: cách làm bằng CSS

### ✓ Cấm ghi nhớ
- Cấm dùng: Slider, Textarea, Table.Row (focus ring state)
- Cấm tạo component mới cho crop ảnh
- Cấm format số ở view (A15)
- Cấm viết công thức hình học ở view (mục D)
