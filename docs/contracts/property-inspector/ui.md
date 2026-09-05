# PropertyInspector Component Contract

**Scope:** UI components used in PropertyInspector panel (344px width, 36px row height, 40% label / 60% control)  
**Panel layout:** No save button, no border, auto-save after 800ms  
**States:** Must handle all 7 states per A11 (empty, loading, partial, error, success, forbidden, collapsed)

---

## U1. Component Props Interface

### 1. FieldRow
```typescript
interface FieldRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;                    // Required. Left column text
  children: React.ReactNode;        // Required. Control in right column
  isLast?: boolean;                 // Optional. No border if true (default false)
  isMixed?: boolean;                // Optional. Shows "—" dash instead of children (default false)
  isReadOnly?: boolean;             // Optional. Reduces opacity, disables interaction (default false)
  readOnlyReason?: string;          // Optional. Tooltip text explaining read-only state
  isLoading?: boolean;              // Optional. Shows skeleton (default false)
  flash?: boolean;                  // Optional. Accent wash background for 340ms after write (default false)
  collapsed?: boolean;              // Optional. Renders nothing if true (default false)
}
```
**States supported:**
- ✅ `disabled` / `isReadOnly`: Yes
- ✅ State 6 "không có quyền" (forbidden): Rows must be read-only, borders removed, but still copyable (no specific UI change beyond opacity)

---

### 2. NumericField
```typescript
interface NumericFieldProps extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'> {
  value: number | undefined;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;                    // Optional. Suffix after value (e.g. "mm", "m²")
  disabled?: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  error?: React.ReactNode;
  hint?: React.ReactNode;
}
```
**Features:**
- Stepper buttons (± chevron) appear on hover when not disabled/read-only
- Keyboard: Arrow keys, Home, End adjust value
- **States supported:** ✅ disabled, ✅ read-only, ✅ loading

---

### 3. Select (Legacy API)
```typescript
interface LegacySelectProps {
  options: SelectOption[];          // Required
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;             // Default: "Chọn..."
  className?: string;
  disabled?: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  label?: string;                   // Optional standalone label
}

interface SelectOption {
  label: string;
  value: string;
}
```
**Icon support in options:**
- ❌ NOT FOUND: Select does not render color/icon swatches in option items. To show icons, use a custom render or use SegmentedControl instead.

**States supported:** ✅ disabled, ✅ read-only, ✅ loading

---

### 4. Toggle
```typescript
interface ToggleProps {
  checked?: boolean;                // Controlled or uncontrolled
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => Promise<void> | void;
  onError?: (error: unknown) => void;
  disabled?: boolean;
  isLoading?: boolean;
  isReadOnly?: boolean;
  label?: React.ReactNode;          // Optional label beside toggle
  description?: React.ReactNode;    // Optional description below
  'aria-label'?: string;            // Required if no label
  id?: string;
  className?: string;
}
```
**States supported:** ✅ disabled, ✅ read-only, ✅ loading

---

### 5. Slider ⚠️ **ACCESSIBILITY ISSUE**
```typescript
interface SliderProps {
  min?: number;                     // Default 0
  max?: number;                     // Default 100
  step?: number;                    // Default 1
  value: number;                    // Required, controlled
  onChange: (value: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  snapPoints?: number[];            // Optional snap positions
  endLabels?: [string, string];     // Optional min/max labels
  'aria-label'?: string;
  isLoading?: boolean;
}
```
**⚠️ CRITICAL A11Y ISSUE — SEE SECTION U2 BELOW**

---

### 6. SegmentedControl
```typescript
interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];  // Required
  value?: T;
  defaultValue?: T;
  onChange?: ((value: T) => void);
  'aria-label'?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

interface SegmentedControlOption<T extends string = string> {
  label: string;
  value: T;
  swatch?: string;                  // Optional color hex (e.g. "#FF0000")
  disabled?: boolean;               // Per-option disabled
}
```
**Icon/color support:**
- ✅ YES: `swatch` field binds a color dot (3x3px) before the label. Use for state colors or material indicators.

**States supported:** ✅ disabled, ✅ loading (entire control)

---

### 7. Badge
```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: 'verified' | 'attention' | 'violation' | 'neutral';  // Required
  children: React.ReactNode;
  noDot?: boolean;                  // Optional, suppress leading indicator
  className?: string;
}
```
**States:**
- `verified` → blue background + text
- `attention` → yellow/orange background + text
- `violation` → red background + text
- `neutral` → gray background + text

**Height:** 22px, border-radius 6px, no solid color blocks (tinted background only)

---

### 8. IconButton
```typescript
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;            // Required. Lucide icon or SVG
  'aria-label': string;             // Required. Human-readable action
  isActive?: boolean;               // Optional. Highlight state
  loading?: boolean;                // Optional. Shows spinner, disables
  size?: 'sm' | 'md' | 'lg';        // Default 'md' (36px)
  tooltip?: boolean;                // Default true. Shows aria-label on hover
  disabled?: boolean;
  className?: string;
}
```
**Sizes:** 32px (sm) / 36px (md) / 40px (lg)  
**States supported:** ✅ disabled, ✅ loading (shows spinner)

---

### 9. ThicknessField
```typescript
interface ThicknessFieldProps {
  value?: WallThickness;            // '110' | '220' | '330' | 'btct'
  onChange?: (value: WallThickness) => void;
  aiOriginalMm?: number;            // Optional. Shows caption with AI detected value
  disabled?: boolean;
  isLoading?: boolean;
  isReadOnly?: boolean;
  error?: string;                   // Optional error caption
  className?: string;
}
```
**Implementation:** SegmentedControl wrapper with 4 fixed options. No free-form input.

---

### 10. Input
```typescript
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: React.ReactNode;
  error?: React.ReactNode;          // Shows red dot + message below
  hint?: React.ReactNode;           // Shows gray text below (when no error)
  prefix?: React.ReactNode;         // Left content (UI only, not input)
  suffix?: React.ReactNode;         // Right content, typically unit text
  isLoading?: boolean;              // Shows skeleton
  isReadOnly?: boolean;             // Read-only display (no editing)
  flash?: boolean;                  // Background flash 340ms after write
  wrapperClassName?: string;
}
```
**States supported:** ✅ disabled, ✅ read-only, ✅ loading

---

### 11. ConfidenceMeter
```typescript
interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;                    // 0 to 1 (e.g. 0.72)
  noTooltip?: boolean;              // Optional, suppress tooltip
  className?: string;
}
```
**Display:**
- 12px tall meter bar, 48px wide, 4px track
- Color: gray for ≥0.70, yellow/attention for <0.70
- Text: value formatted with comma (e.g. "0,72")
- Tooltip: "Độ tin cậy AI 0,72" or "Độ tin cậy AI 0,62 — cần kiểm tra"

**No "need review" stripes** — stripes mentioned in code are TODO/not implemented.

---

## U2. *** CRITICAL A11Y DECISION: Slider Status ***

### Test Result: **Slider FAILS expectAccessible** ❌

**The Issue:**
- Slider has `outline-none` always applied (line 153: `className={... 'outline-none' ...}`)
- Focus ring replacement is **state-driven** (line 154): `isFocused && 'ring-2 ring-accent ring-offset-2'`
- During accessibility testing (jsdom), the `isFocused` state is never true because there are no DOM events
- Result: outline suppressed but no ring present → A12 violation

**Evidence from test run:**
```
Error: expectAccessible: 1 lỗi tiếp cận.
  [aria-label=Test slider]  tắt viền tiêu điểm mặc định mà không thay bằng cái khác
      → A12 yêu cầu focus ring 2px, offset 2px
```

### Root Cause
The ring is controlled by component state (`useState(isFocused)`) instead of CSS `:focus-visible` pseudo-class. State-driven focus rings are invisible to static accessibility testing and fail because:
1. The outline is always gone (suppressed)
2. The ring class is only applied when focused (state-dependent)
3. In jsdom, events don't fire, so the state never changes

### **DECISION: Replace Slider with NumericField**

**Rationale:**
- Panel spec requires "bay camera 700ms" but Slider is unfixable without major refactor
- `NumericField` provides step buttons (± chevron) for precise adjustment
- `NumericField` passes `expectAccessible` ✅
- Spin buttons (stepper) are native web components that work in accessibility testing
- Control width fits 60% right column (38px height with buttons)

**Alternative (not recommended):** SegmentedControl with size presets (e.g. "Rộng", "Vừa", "Hẹp") — but this removes continuous adjustment.

### **Implementation Notes**
- **Do not fix Slider in src/components/** — out of scope for this task
- **Do not create custom Slider variant** — violates "không tạo component mới"
- **Use NumericField instead** — already tested, passes A11y

---

## U3. Motion Durations

**MOTION_DURATIONS_MS in src/lib/motion/tokens.ts:**
```typescript
export const MOTION_DURATIONS_MS = {
  instant: 120,   // Hover, focus ring, press
  fast:    180,   // Dropdown, tooltip appear
  standard: 260,  // Panel, toast
  slow:    340,   // View change, camera move
};
export const AMBIENT_LOOP_MS = 700;  // Loops: skeleton sweep
```

**PropertyInspector panel needs:**
1. **Fade out previous property group:** 180ms ← use `fast` (dropdown speed)
2. **Fly camera to selected object:** 700ms ← use `AMBIENT_LOOP_MS` (spec matches existing constant ✅)
3. **Accordion collapse/expand:** 400ms ⚠️ **NOT IN THE 5 VALUES**

### **Motion Conflict: 400ms accordion**
**Issue:** 400ms is not in {120, 180, 260, 340, 700}. Rule B forbids arbitrary durations.

**Decision:** Use 340ms (closest valid value, "slow" motion for accordion like camera move)
- Reason: Accordion is a view-change motion (like camera), not a quick interaction
- Alternative rejected: 260ms too snappy for content reveal on panel

### **Panel Height Smoothing**
**Question:** Is there a helper to animate panel height when properties expand/collapse?

**Search Result:** ✅ Found in src/lib/motion:
- `useCountUp` — animates from one number to another
- `orchestrate` — chains multiple animations together
- **No built-in panel-height animator** — use CSS `height` + Tailwind `transition-all duration-340`

**Recommended approach:**
```typescript
className={cn(
  'transition-all duration-340 overflow-hidden',
  isExpanded ? 'max-h-screen' : 'max-h-0'
)}
```

Or use Tailwind's `overflow-hidden` + dynamic max-height binding.

---

## U4. Keyboard Shortcuts

### How to Register a Shortcut
From `src/lib/input/shortcutRegistry.ts`:

```typescript
import { shortcutRegistry } from '@/lib/input/shortcutRegistry';

// Register
shortcutRegistry.register({
  combo: 'Ctrl+S',           // or 'Cmd+S', 'Alt+X', etc.
  scope: 'sidePanel',        // 'dialog' | 'sidePanel' | 'canvas' | 'global'
  action: () => { /* handle */ },
});

// On unmount:
const binding = shortcutRegistry.register(/* ... */);
binding.unregister();
```

### Scope Priority
**Upper floor answers first.** Resolution order:
1. `dialog` (modal, blocks lower scopes)
2. `sidePanel` (PropertyInspector)
3. `canvas` (viewport)
4. `global` (app-wide)

PropertyInspector is `sidePanel` scope.

### Esc Always Closes Top Layer
**Invariant A12:** `Esc` always closes the topmost layer (dialog, panel, modal).  
- No panel may block Esc
- Esc falls through to global handler automatically
- Do not manually handle Esc in panel shortcuts

### Tab Traversal Through Properties
**Requirement:** Tab cycles through all properties in the panel.

**Implementation:**
- Each `NumericField` / `Select` / `Toggle` / `SegmentedControl` must be focusable
- Use native `tabindex` (no manual `tabindex` > 0)
- Focus ring visible via CSS (not state-driven) ← Required for A12

**CAM TUYET DOI:**
- ❌ Never use `addEventListener('keydown')` directly
- ✅ Use `shortcutRegistry.register()` for panel shortcuts
- ✅ Use native `<input>`, `<button>` tab behavior for form controls

---

## U5. Fly Camera to Object (R-07)

### Search Result: ✅ **FOUND** (but screen-layer API not exposed)

**Available in src/lib/three/camera:**
- `frameObjects(root, ids, options)` → Calculates `Viewpoint` (target, azimuth, polar, distance)
- Returns `null` if ids not in scene

**Available in src/lib/three/present:**
- `mountPresentation(canvas, plan, options)` → Returns `PresentationHandle` with `dispose()` and `settled`

**Missing/Not Exported:**
- ❌ No public `fly()` or `transitionCamera()` function
- ❌ `PresentationHandle` does not expose camera control API
- ❌ Interior module `director.ts` has `cameraPosition()`, `headingAt()` but no transition wrapper

### **Conclusion: NOT FOUND**
**There is no public API in src/lib/three/present/** to fly the camera to a selected object over 700ms.

**Options to unblock:**
1. **Export frameObjects + camera transition helper** from present/index.ts
2. **Add `flyToObjects(ids: string[], durationMs?: number)` to PresentationHandle**
3. **Defer R-07 to next sprint** — PropertyInspector can show camera prep (blue highlight) without animation

**Recommended for now:** Record this as blocking requirement. Skip R-07 camera fly in T3 UI contract.

---

## U6. Testing Helpers (Assertion Suite)

### 1. expectAccessible(container)
**What:** Checks a rendered screen for 5 A11y violations (screen reader access, focus ring, tab order, color contrast).

**Usage:**
```typescript
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { render } from '@testing-library/react';

it('screen is accessible', () => {
  const { container } = render(<MyScreen />);
  expectAccessible(container);  // Throws on first issue
});
```

**What it refuses:**
- Missing `aria-label` or `<label>` on interactive elements
- `outline-none` without replacement focus ring
- Focus ring without `ring-offset-2` (A12 requires 2px offset)
- Text contrast below 4.5:1 (body) / 3:1 (caption)
- `tabindex > 0` (reorders tab order globally)

**Returns:** Throws `Error` if issues found; silent success if all pass.

---

### 2. expectVietnamese(container)
**What:** Checks for English-only text that should be Vietnamese.

**Usage:**
```typescript
import { expectVietnamese } from '@/lib/testing/expectVietnamese';

it('labels are Vietnamese', () => {
  const { container } = render(<WallList />);
  expectVietnamese(container);
});
```

**What it refuses:**
- Untranslated English labels in the UI (not code)
- Diacritics missing from Vietnamese text (e.g. "tuong" instead of "tường")

---

### 3. expectSevenStates(renderFn, scenarios)
**What:** Renders a screen 7 times (one per state) and refuses to pass if any state is blank or renders nothing.

**Usage:**
```typescript
import { expectSevenStates, createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';

it('screen handles all 7 states (A11)', () => {
  expectSevenStates(
    (scenario) => render(<MyScreen {...scenario} />),
    createSevenStateScenarios()
  );
});
```

**The 7 states (A11):**
1. **empty** — `rỗng` — no rows, fully loaded
2. **loading** — `đang tải` — fetching, show skeleton
3. **partial** — `một phần` — 14/48 rows loaded (pagination)
4. **error** — `lỗi` — network error, retry button
5. **success** — `thành công` — fully loaded, all 48 rows
6. **forbidden** — `không có quyền` — user lacks permission, read-only
7. **collapsed** — `thu gọn` — panel closed/minimized, still shows data

**What it refuses:**
- State missing from scenarios
- Blank screen (empty container, no text)
- Render throws exception

**Customization:**
```typescript
createSevenStateScenarios({
  totalCount: 48,           // Default
  partialCount: 14,         // Default
  createRow: (i) => ({ id: `W-${i}`, label: `Wall ${i}` }),
  overrides: {
    success: { customField: true }  // Patch one state
  }
});
```

---

### 4. sevenStateScenarios (data)
**What:** Data generator for the 7 states.

```typescript
import { SEVEN_STATES, SEVEN_STATE_LABELS } from '@/lib/testing/sevenStateScenarios';

console.log(SEVEN_STATES);  // ['empty', 'loading', 'partial', 'error', 'success', 'forbidden', 'collapsed']
console.log(SEVEN_STATE_LABELS.success);  // "thành công"
```

---

### 5. render(ui, options?)
**What:** Custom render with auto-reset store, QueryClient, i18n.

**Usage:**
```typescript
import { render } from '@/lib/testing/render';

const { container, unmount, translate } = render(
  <MyScreen />,
  {
    // Optional: pass in custom store if needed
  }
);

// translate() returns Vietnamese string from code: translate('wall list')
```

**What it sets up:**
- Fresh `QueryClient` per render (retries off)
- Store reset to initial state
- i18next with `src/i18n/vi.json`
- Zundo undo history cleared

---

### 6. fixtures (test data)
**What:** Sample objects (rooms, walls, openings) per the standard 34-room 248.60 m² set (A14).

**Usage:**
```typescript
import { FIXTURE_ROOMS, FIXTURE_AREA_M2, FIXTURE_STOREY_COUNT } from '@/lib/testing/fixtures';

console.log(FIXTURE_AREA_M2);     // 248.60
console.log(FIXTURE_ROOM_COUNT);  // 14
```

Use these to verify screens show correct numbers, not made-up test data.

---

## Minimal Test Template (for T8)

```typescript
import { describe, it } from 'vitest';
import { render } from '@/lib/testing/render';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates, createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';
import { PropertyInspector } from './PropertyInspector';

describe('PropertyInspector', () => {
  it('is accessible (A12)', () => {
    const { container } = render(<PropertyInspector wall={mockWall} />);
    expectAccessible(container);
  });

  it('handles all 7 states (A11)', () => {
    expectSevenStates(
      (scenario) => render(<PropertyInspector {...scenario} />),
      createSevenStateScenarios()
    );
  });
});
```

---

## Summary

| Section | Status | Notes |
|---------|--------|-------|
| U1 Props | ✅ Done | 11 components documented, icon support noted |
| U2 Slider A11y | ⚠️ **RED** | State-driven focus ring fails A12. **Use NumericField instead.** |
| U3 Motion | ⚠️ **CONFLICT** | 400ms accordion not in {120,180,260,340,700}. Use 340ms. |
| U4 Shortcuts | ✅ Done | Register via shortcutRegistry, Tab works, Esc modal-aware. |
| U5 Camera Fly | ❌ **NOT FOUND** | No public API to fly camera to object ID in 700ms. Blocking R-07. |
| U6 Testing | ✅ Done | 6 helpers ready: expectAccessible, expectVietnamese, expectSevenStates, render, fixtures. |


---

## U7. Ghi chú ráp (T8) — bốn chỗ ba nhánh lệch nhau, và cách hàn

Bốn mối hàn dưới đây được thực hiện ở bước ráp. Nguyên tắc đã dùng:
`propertyInspectorTypes.ts` là SỰ THẬT, hai bên còn lại kéo về theo nó.

| # | Chỗ lệch | Hàn thế nào |
|---|---|---|
| 1 | Hook trả `recentlyCommittedRowId` + `commitFlashDurationMs`, còn `PropertyInspectorProps` chỉ có `state` — container trải cả ba vào view nên hai trường kia rơi mất, và `FieldRow.flash` (thứ U3 nói là nơi `--accent-wash` được áp) không bao giờ được bật. | Nâng `recentlyCommittedRowId` lên `PropertyInspectorProps` (đúng như docblock của `UsePropertyInspectorResult` đã lường trước), luồn qua `PropertyInspectorGroups` → `PropertyInspectorRow` → `FieldRow.flash`. Bỏ `commitFlashDurationMs`: `FieldRow` đã nháy đúng nhịp `slow` (340 ms), một con số thứ hai chạy dọc props chỉ là chỗ để hai bên trôi khỏi nhau. `UsePropertyInspectorResult` giờ ĐÚNG BẰNG props. |
| 2 | `selectedOptionValue` của view dò lựa chọn bằng `option.label === formatted`. Dòng độ dày có `formatted = "220"` (đơn vị `mm` nằm ở trường `unit`) còn nhãn lựa chọn là `"220 mm"` ⇒ không khớp ⇒ `SegmentedControl` rơi về lựa chọn đầu, và một bức tường 220 mm được vẽ thành 110 mm. | Dò theo CẢ HAI chuỗi mà dữ liệu mang: `option.value === formatted \|\| option.label === formatted`. Các dòng `select` khác (loại tường, chiều mở, công năng phòng) khớp ở vế thứ hai như cũ. |
| 3 | Trạng thái `empty` dựng biểu tượng cỡ mặc định 24px, trong khi hợp đồng chuỗi (§2) và `PROPERTY_INSPECTOR_LAYOUT.emptyIconPx` đều nói 32px. | `<MousePointerClick size={PROPERTY_INSPECTOR_LAYOUT.emptyIconPx} />`. |
| 4 | Panel chỉ khoá BỀ RỘNG (344px). Một bức tường có 7 dòng, một phòng có 6 ⇒ chân panel dịch một dòng mỗi lần đổi loại đối tượng, trái CẤM TUYỆT ĐỐI số 3. | Panel thành cột flex `h-full min-h-0`: đầu và chân `shrink-0`, vùng các nhóm là chỗ DUY NHẤT `flex-1 overflow-y-auto`. Khi không được cấp chiều cao, chính chiều cao panel trượt trên nhịp `standard` (260 ms) thay vì giật — `transition-[height] duration-standard motion-reduce:transition-none`. Không thêm hằng số chiều cao nào. |

### Chuỗi i18n

Hai file `*.i18n.fragment.json` của T5 và T6 đã được gộp vào `src/i18n/vi.json`
(21 khoá mới, 14 khoá đã trùng khớp sẵn, 0 xung đột) và bị xoá. `TEXT` của hook
được xuất khẩu thành `PROPERTY_INSPECTOR_TEXT` để bài kiểm và story đối chiếu
đúng chuỗi của mã nguồn thay vì gõ lại một bản thứ hai.

### Hai chỗ CHƯA CHỨNG MINH ĐƯỢC (E.10 — không báo "đạt")

- **Xem trước 3D trong lúc kéo.** Bốn chỗ chặn của mục C5 vẫn nguyên. Panel phát
  lệnh khi giá trị đứng yên hết `MERGE_WINDOW_MS`, không phát mỗi khung hình.
- **Vị trí pixel của chân panel.** jsdom không dựng bố cục nên mọi
  `getBoundingClientRect()` trả 0. Bằng chứng thay thế đã đo được: chân panel
  nằm trong khối `shrink-0` ở 10/10 lượt đổi, và có đúng MỘT vùng
  `flex-1 + overflow-y-auto` mỗi lượt.

### Một chỗ CHƯA ĐẠT, nằm ngoài phạm vi sửa của bước ráp

`Ctrl+Z` sau một mạch kéo không trả về hết mạch đó. Cửa sổ gộp D-06 nằm ở
`HistoryStack` của tầng lệnh (`propertyInspectorGateway.ts:492`,
`lib/commands/history.ts:269`), còn hành động hoàn tác của ứng dụng đọc ngăn xếp
zundo trên store (`store/index.ts:50`, `store/commit.ts:34`,
`hooks/useUndoableToast.ts:26`) — mỗi lượt `_applyPatches` là một bước zundo, bất
kể tầng lệnh có gộp hay không. Đo được: hai lượt ghi cách nhau 200 ms trong cửa
sổ 400 ms ⇒ **2** bước zundo. Ngoài ra `useGlobalShortcuts()`
(`hooks/useShortcut.ts:172`) không được gọi ở đâu trong `src`, nên chính PHÍM
`Ctrl+Z` cũng chưa được nối.
