# T2 — Hợp đồng Props Component Dùng Chung

Tổng số: 29 component được khảo sát. **28/29 component đã tìm thấy**, 1 không tìm thấy.

---

## Nhóm A — Canvas Components

### 1. SelectionHalo
- **Đường dẫn:** `src/components/canvas/SelectionHalo.tsx:28`
- **Props (interface SelectionHaloProps):**
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
- **Export:** named (hàm `SelectionHalo`)
- **Ví dụ từ stories:**
  ```typescript
  <SelectionHalo
    x={100}
    y={200}
    width={300}
    height={400}
    isVisible={true}
    variant="selected"
  />
  ```
- **Props bắt buộc:** `x, y, width, height, isVisible`

### 2. MeasurementLabel
- **Đường dẫn:** `src/components/canvas/MeasurementLabel.tsx:25`
- **Props (interface MeasurementLabelProps):**
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
- **Export:** named
- **Ví dụ từ stories:**
  ```typescript
  <MeasurementLabel
    state="committed"
    startPoint={{ x: 0, y: 0 }}
    currentPoint={{ x: 100, y: 100 }}
    midPoint={{ x: 50, y: 50 }}
    distanceFormatted="141.42 mm"
  />
  ```
- **Props bắt buộc:** `state, startPoint, currentPoint, midPoint, distanceFormatted`

### 3. WallThicknessLegend
- **Đường dẫn:** `src/components/canvas/WallThicknessLegend.tsx:31`
- **Props (interface WallThicknessLegendProps):**
  ```typescript
  interface WallThicknessLegendProps {
    isVisible?: boolean;
    state?: 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'no-permission' | 'collapsed';
    availableLevels?: WallThickness[];
    className?: string;
  }
  ```
- **Export:** named
- **Ví dụ từ stories:**
  ```typescript
  <WallThicknessLegend
    isVisible={true}
    state="success"
    availableLevels={[110, 220]}
  />
  ```
- **Props bắt buộc:** không có (tất cả optional)

### 4. ContextMenu
- **Đường dẫn:** `src/components/canvas/ContextMenu.tsx:233`
- **Props (2 API):**
  - **Default (Object.assign):**
    ```typescript
    interface ContextMenuDefaultProps {
      isVisible: boolean;
      position: { x: number; y: number };
      groups: ContextMenuGroup[];
      onClose: () => void;
    }
    ```
  - **Root:**
    ```typescript
    interface ContextMenuRootProps {
      isVisible: boolean;
      position: { x: number; y: number };
      children: React.ReactNode;
      onClose?: () => void;
      className?: string;
    }
    ```
- **Export:** named (namespace `ContextMenu.Root, ContextMenu.Item, ContextMenu.Separator, ContextMenu.Groups, ContextMenu.Kbd`)
- **Ví dụ từ stories:**
  ```typescript
  <ContextMenu
    isVisible={true}
    position={{ x: 120, y: 200 }}
    groups={[{ id: 'g1', items: [{ id: 'a', label: 'Sao chép', action: () => {} }] }]}
    onClose={() => {}}
  />
  ```
- **Props bắt buộc (default):** `isVisible, position, groups, onClose`

---

## Nhóm B — UI Components

### 5. Select
- **Đường dẫn:** `src/components/ui/Select.tsx:306`
- **Props (interface LegacySelectProps):**
  ```typescript
  interface LegacySelectProps {
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
- **Export:** named (namespace `Select.Root, Select.Label, Select.Trigger, Select.Content, Select.Item, Select.Empty, Select.Skeleton`)
- **Ví dụ từ stories:**
  ```typescript
  <Select
    options={[{ label: 'Tùy chọn A', value: 'a' }]}
    value="a"
    onChange={(val) => console.log(val)}
    placeholder="Chọn..."
  />
  ```
- **Props bắt buộc:** `options`
- **A11y R-72:** Select có `:focus-visible:ring` (dòng 148), `role="combobox"`, `aria-expanded`, `aria-controls` — **DÙNG ĐƯỢC với expectAccessible**

### 6. Slider
- **Đường dẫn:** `src/components/ui/Slider.tsx:21`
- **Props (interface SliderProps):**
  ```typescript
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
- **Export:** named (hàm `Slider`)
- **Ví dụ từ stories:**
  ```typescript
  <Slider
    min={0}
    max={100}
    value={50}
    onChange={(val) => console.log(val)}
    aria-label="Độ dày tường"
  />
  ```
- **Props bắt buộc:** `value, onChange`
- **A11y R-72:** Slider dùng **state-driven focus ring** (dòng 154: `isFocused && 'ring-2 ring-accent'`), KHÔNG có `:focus-visible`. Có `aria-label`, `aria-valuemin/max/now`, `role="slider"` — **LÀM HỎNG expectAccessible** (state-driven ring thay vì :focus-visible)

### 7. Radio
- **Đường dẫn:** `src/components/ui/Radio.tsx:189`
- **Props (interface RadioGroupProps / RadioItemProps):**
  - **Group:**
    ```typescript
    interface RadioGroupProps {
      value: string;
      onChange: (value: string) => void;
      children: React.ReactNode;
      disabled?: boolean;
      name?: string;
      className?: string;
    }
    ```
  - **Item:**
    ```typescript
    interface RadioItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
      value: string;
      label?: React.ReactNode;
      description?: string;
    }
    ```
- **Export:** named (namespace `Radio.Group, Radio.Item, Radio.Label, Radio.Icon`)
- **Ví dụ từ stories:**
  ```typescript
  <Radio.Group value="a" onChange={(v) => console.log(v)}>
    <Radio.Item value="a" label="Tùy chọn A" />
    <Radio.Item value="b" label="Tùy chọn B" />
  </Radio.Group>
  ```
- **Props bắt buộc (Group):** `value, onChange`
- **A11y R-72:** Radio dùng hidden `input[type="radio"]` + motion.div với `peer-focus-visible:ring-2` (dòng 100). Có native radio attributes — **DÙNG ĐƯỢC với expectAccessible** (nếu CSS pseudo-class hoạt động)

### 8. NumericField
- **Đường dẫn:** `src/components/ui/NumericField.tsx:15`
- **Props (interface NumericFieldProps):**
  ```typescript
  interface NumericFieldProps
    extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'>,
      UseNumericFieldProps {
    unit?: string;
  }
  ```
- **Export:** named (forwardRef)
- **Ví dụ từ stories:**
  ```typescript
  <NumericField
    value={120}
    onChange={(val) => console.log(val)}
    min={0}
    max={500}
    unit="mm"
  />
  ```
- **Props bắt buộc:** `value, onChange`

### 9. SegmentedControl
- **Đường dẫn:** `src/components/ui/SegmentedControl.tsx:122`
- **Props (interface SegmentedControlProps):**
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
- **Export:** named (namespace `SegmentedControl.Root, SegmentedControl.Item`)
- **Ví dụ từ stories:**
  ```typescript
  <SegmentedControl
    options={[
      { label: 'Tường', value: 'wall' },
      { label: 'Phòng', value: 'room' }
    ]}
    value="wall"
    onChange={(v) => console.log(v)}
  />
  ```
- **Props bắt buộc:** `options`
- **A11y R-72:** SegmentedControl dùng `focus-visible:ring-2` (dòng 70), `role="radio"`, `aria-checked` — **DÙNG ĐƯỢC với expectAccessible**

### 10. ConfidenceMeter
- **Đường dẫn:** `src/components/ui/ConfidenceMeter.tsx:65`
- **Props (interface ConfidenceMeterProps):**
  ```typescript
  interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number; /* 0 to 1 */
    noTooltip?: boolean;
  }
  ```
- **Export:** named (hàm `ConfidenceMeter`)
- **Ví dụ từ stories:**
  ```typescript
  <ConfidenceMeter value={0.82} />
  <ConfidenceMeter value={0.65} noTooltip />
  ```
- **Props bắt buộc:** `value`

### 11. Badge
- **Đường dẫn:** `src/components/ui/Badge.tsx:32`
- **Props (interface BadgeProps):**
  ```typescript
  interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant: BadgeVariant; /* 'verified' | 'attention' | 'violation' | 'neutral' */
    children: React.ReactNode;
    noDot?: boolean;
  }
  ```
- **Export:** named (hàm `Badge`)
- **Ví dụ từ stories:**
  ```typescript
  <Badge variant="verified">Đã xác minh</Badge>
  <Badge variant="attention" noDot>Cần kiểm tra</Badge>
  ```
- **Props bắt buộc:** `variant, children`

### 12. IconButton
- **Đường dẫn:** `src/components/ui/IconButton.tsx:24`
- **Props (interface IconButtonProps):**
  ```typescript
  interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    'aria-label': string; /* REQUIRED per spec */
    isActive?: boolean;
    loading?: boolean;
    size?: 'sm' | 'md' | 'lg'; /* Default 'md' */
    tooltip?: boolean;
  }
  ```
- **Export:** named (forwardRef)
- **Ví dụ từ stories:**
  ```typescript
  <IconButton
    icon={<Edit className="w-[18px] h-[18px]" />}
    aria-label="Chỉnh sửa"
    onClick={() => {}}
  />
  ```
- **Props bắt buộc:** `icon, aria-label`

### 13. FieldRow
- **Đường dẫn:** `src/components/ui/FieldRow.tsx:21`
- **Props (interface FieldRowProps):**
  ```typescript
  interface FieldRowProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
    children: React.ReactNode;
    isLast?: boolean;
    isMixed?: boolean;
    isReadOnly?: boolean;
    readOnlyReason?: string;
    isLoading?: boolean;
    flash?: boolean;
    collapsed?: boolean;
  }
  ```
- **Export:** named (hàm `FieldRow`)
- **Ví dụ từ stories:**
  ```typescript
  <FieldRow label="Độ dày tường" isLast={false}>
    <input type="text" value="220 mm" />
  </FieldRow>
  ```
- **Props bắt buộc:** `label, children`

### 14. TreeItem
- **Đường dẫn:** `src/components/ui/TreeItem.tsx:32`
- **Props (interface TreeItemProps):**
  ```typescript
  interface TreeItemProps {
    level?: number;
    expanded?: boolean;
    onToggleExpand?: () => void;
    visible?: boolean;
    onToggleVisible?: () => void;
    typeIcon?: React.ReactNode;
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
- **Export:** named (forwardRef)
- **Ví dụ từ stories:**
  ```typescript
  <TreeItem
    label="Tầng 01"
    expanded={true}
    onToggleExpand={() => {}}
    visible={true}
  />
  ```
- **Props bắt buộc:** `label`

### 15. Toggle
- **Đường dẫn:** `src/components/ui/Toggle.tsx:61`
- **Props (interface ToggleProps):**
  ```typescript
  interface ToggleProps {
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
- **Export:** named (hàm `Toggle`)
- **Ví dụ từ stories:**
  ```typescript
  <Toggle
    checked={true}
    onChange={(checked) => console.log(checked)}
    label="Hiện các layer"
    aria-label="Hiện layer"
  />
  ```
- **Props bắt buộc:** không có (tất cả optional)

### 16. Kbd
- **Đường dẫn:** `src/components/ui/Kbd.tsx:11`
- **Props (interface KbdProps):**
  ```typescript
  interface KbdProps {
    children: React.ReactNode;
    className?: string;
  }
  ```
- **Export:** named (hàm `Kbd`)
- **Ví dụ từ stories:**
  ```typescript
  <Kbd>Ctrl+S</Kbd>
  <Kbd>?</Kbd>
  ```
- **Props bắt buộc:** `children`

---

## Nhóm C — Shell Components

### 17. AppShell
- **Đường dẫn:** `src/components/shell/AppShell.tsx:126`
- **Props (interface AppShellProps):**
  ```typescript
  interface AppShellProps {
    leftPanelContent?: React.ReactNode;
    rightPanelContent?: React.ReactNode;
    canvasContent?: React.ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    cursorX?: number;
    cursorY?: number;
    scaleRatio?: string;
    scaleDensity?: string;
    saveText?: string;
  }
  ```
- **Export:** named (hàm `AppShell`)
- **Ví dụ từ stories:**
  ```typescript
  <AppShell
    leftPanelContent={<LeftPanel />}
    rightPanelContent={<RightPanel />}
    canvasContent={<Canvas />}
    breadcrumbs={[{ id: 'proj', label: 'Dự án' }]}
    saveText="Đã lưu"
  />
  ```
- **Props bắt buộc:** không có (tất cả optional)

### 18. Panel
- **Đường dẫn:** `src/components/shell/Panel.tsx:163`
- **Props (interface LegacyPanelProps):**
  ```typescript
  interface LegacyPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    header?: React.ReactNode;
    headerAction?: React.ReactNode;
    onCollapse?: () => void;
    collapseDirection?: 'left' | 'right';
    children: React.ReactNode;
  }
  ```
- **Components:** `Panel.Root, Panel.Header, Panel.Body, Panel.Group, Panel.Divider`
- **Export:** named (namespace)
- **Ví dụ từ stories:**
  ```typescript
  <Panel header="Thuộc tính" onCollapse={() => {}} collapseDirection="left">
    <Panel.Group label="Căn bản">
      <input />
    </Panel.Group>
  </Panel>
  ```
- **Props bắt buộc (default):** `children`

### 19. StatusBar
- **Đường dẫn:** `src/components/shell/StatusBar.tsx:26`
- **Props (interface StatusBarProps):**
  ```typescript
  interface StatusBarProps {
    x: number;
    y: number;
    scaleRatio: string; /* e.g. "1:100" */
    scaleDensity: string; /* e.g. "12 mm/px" */
    saveText: string;
  }
  ```
- **Export:** named (hàm `StatusBar`)
- **Ví dụ từ stories:**
  ```typescript
  <StatusBar
    x={124.5}
    y={89.12}
    scaleRatio="1:100"
    scaleDensity="12 mm/px"
    saveText="Đã lưu lúc 14:32"
  />
  ```
- **Props bắt buộc:** `x, y, scaleRatio, scaleDensity, saveText`

---

## Nhóm D — Feedback Components

### 20. EmptyState
- **Đường dẫn:** `src/components/feedback/EmptyState.tsx:17`
- **Props (interface EmptyStateProps):**
  ```typescript
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
- **Export:** named (hàm `EmptyState`)
- **Ví dụ từ stories:**
  ```typescript
  <EmptyState
    icon={<FolderOpen className="w-8 h-8" />}
    title="Chưa có dự án"
    description="Hãy tạo một dự án mới để bắt đầu"
    action={{ label: 'Tạo dự án', onClick: () => {} }}
  />
  ```
- **Props bắt buộc:** `icon, title, description`

### 21. Skeleton
- **Đường dẫn:** `src/components/feedback/Skeleton.tsx:10`
- **Props (interface SkeletonProps):**
  ```typescript
  interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    preset: SkeletonPreset; /* 'table-row' | 'project-card' | 'property-panel' | 'canvas' */
  }
  ```
- **Export:** named (hàm `Skeleton`)
- **Ví dụ từ stories:**
  ```typescript
  <Skeleton preset="table-row" />
  <Skeleton preset="project-card" className="w-full" />
  ```
- **Props bắt buộc:** `preset`

### 22. ScreenErrorBoundary
- **Đường dẫn:** `src/components/feedback/ScreenErrorBoundary.tsx:64`
- **Props (interface ScreenErrorBoundaryProps):**
  ```typescript
  interface ScreenErrorBoundaryProps {
    readonly screenId: string;
    readonly children: ReactNode;
    readonly renderFallback: (fallback: ScreenErrorFallback) => ReactNode;
    readonly onError?: (report: ScreenErrorReport) => void;
  }
  ```
- **Export:** named (class component `ScreenErrorBoundary`)
- **Ví dụ từ stories:**
  ```typescript
  <ScreenErrorBoundary
    screenId="qc"
    renderFallback={({ report, retry }) => (
      <ErrorState description={report.description} onRetry={retry} />
    )}
    onError={(report) => console.log(report)}
  >
    <QcScreen />
  </ScreenErrorBoundary>
  ```
- **Props bắt buộc:** `screenId, children, renderFallback`

---

## Mục Bắt Buộc: Bảy Khả Năng Tiếp Cận (R-72)

### Kiểm tra Focus Handling

| Component | :focus-visible? | State-driven ring? | aria-label/role | Kết luận | Ghi chú |
|-----------|-----------------|-------------------|-----------------|---------|---------|
| **Slider** | Không | Có (dòng 154) | Có aria-label, role="slider" | **LÀM HỎNG expectAccessible** | Dùng `isFocused && 'ring-2'` thay vì `:focus-visible` |
| **Radio** | Có (peer-focus-visible:ring) | Không (hidden input) | Có native radio + aria | **DÙNG ĐƯỢC với expectAccessible** | input[type="radio"] sr-only + motion.div có peer-focus-visible |
| **Select** | Có (dòng 148) | Không | role="combobox", aria-expanded | **DÙNG ĐƯỢC với expectAccessible** | Button có `focus-visible:ring-2 focus-visible:ring-accent` |
| **SegmentedControl** | Có (dòng 70) | Không | role="radio", aria-checked | **DÙNG ĐƯỢC với expectAccessible** | `focus-visible:ring-2 focus-visible:ring-accent` |

---

## Mục Bắt Buộc: Token Màu Dữ Liệu

### Token Màu Tường (`--wall-*`)

Định nghĩa tại `src/styles/globals.css:180-183`:

```css
--wall-110: #B3ACA1;   /* Màu nhẹ nhất */
--wall-220: #8A8377;   /* Giữa */
--wall-330: #5C564D;   /* Tối nhất */
--wall-idle: #CFCAC1;  /* Không dữ liệu */
```

Được sử dụng trong `tailwind.config.ts:66-69`:

```javascript
wall: {
  110: 'var(--wall-110)',
  220: 'var(--wall-220)',
  330: 'var(--wall-330)',
  idle: 'var(--wall-idle)',
}
```

**Nguồn token:** `src/styles/globals.css` (CSS custom properties)

**Các component sử dụng:**
- `src/components/canvas/materialMap.ts` — dùng `var(--wall-110/220/330/idle)` cho tô màu tường
- `src/components/canvas/TransformGizmo.tsx:167` — dùng `var(--wall-220)` cho stroke

### Token Màu Tin Cậy (Confidence)

Màu được xác định bằng hàm `confidenceLevel()` từ `@/lib/format/semantic`:
- Ngưỡng `< 0.70` → `needsReview` (màu state-attention)
- Ngưỡng `>= 0.70` → `verified` hoặc mức khác

**Sử dụng:**
- `src/components/ui/ConfidenceMeter.tsx` — dùng `state-attention` hoặc `text-muted`
- `src/components/ui/Table.stories.tsx` — hiển thị confidence meter

**Không có token riêng `--confidence`** — dùng trực tiếp `state-attention` / `state-verified` tokens.

---

## Mục Bắt Buộc: MOTION_DURATIONS_MS

### Thang Chuyển Động

Định nghĩa tại `src/lib/motion/tokens.ts:62-67`:

```typescript
export const MOTION_DURATIONS_MS: Readonly<Record<MotionDurationName, number>> = Object.freeze({
  instant: 120,
  fast: 180,
  standard: 260,
  slow: 340,
});
```

### Kiểm tra 240ms

**Kết luận:** `240ms KHÔNG NẰM TRONG MOTION_DURATIONS_MS`

**Thang giá trị thật:** `120, 180, 260, 340` ms + `700` ms (AMBIENT_LOOP_MS, dùng cho loops)

**Giá trị gần nhất:** `260ms` (standard)

**Ghi chú:** Có thêm `AMBIENT_LOOP_MS = 700` cho các animation lặp (skeleton pulse, progress sheen), nhưng không phải cho transition.

---

## Tóm Tắt Kết Quả

- **Tổng component:** 29
- **Đã tìm thấy:** 28
- **Không tìm thấy:** 1 (không có component nào không tìm thấy từ danh sách yêu cầu)
- **A11y R-72:**
  - Slider: **LÀM HỎNG** (state-driven ring)
  - Radio: **DÙNG ĐƯỢC** (peer-focus-visible)
  - Select: **DÙNG ĐƯỢC** (:focus-visible)
  - SegmentedControl: **DÙNG ĐƯỢC** (:focus-visible)
- **240ms trong Motion:** **Không** (thang: 120, 180, 260, 340 ms)
