# Thư viện component UI — Bảng props

> **Tất cả component** đều: nhận props thuần, không gọi store/API, không tính toán nghiệp vụ.
> **Focus ring**: `2px offset 2px accent` trên mọi phần tử tương tác.
> **Token**: tất cả màu, khoảng cách, thời lượng đều lấy từ `src/styles/globals.css` + `tailwind.config.ts`.

---

## 1. Button

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Biến thể nút |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 32 / 36 / 40 px |
| `iconBefore` | `ReactNode` | — | Icon trước nhãn |
| `iconAfter` | `ReactNode` | — | Icon sau nhãn |
| `loading` | `boolean` | `false` | Spinner, giữ chiều rộng |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |
| `fullWidth` | `boolean` | `false` | Chiều rộng 100% |
| `shortcut` | `string` | — | Phím tắt |
| `iconOnly` | `boolean` | `false` | Chỉ icon |

---

## 2. IconButton

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `icon` | `ReactNode` | **bắt buộc** | Icon 18px stroke 1.5 |
| `aria-label` | `string` | **bắt buộc** | Nhãn accessibility |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 32 / 36 / 40 px |
| `isActive` | `boolean` | `false` | bg-selected + text-accent-active |
| `loading` | `boolean` | `false` | Spinner |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |
| `tooltip` | `boolean` | `true` | Tooltip hover delay 400ms |

---

## 3. SegmentedControl

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `options` | `SegmentedControlOption[]` | **bắt buộc** | 2–5 mục |
| `value` | `string` | — | Controlled |
| `defaultValue` | `string` | — | Uncontrolled ban đầu |
| `onChange` | `(value: string) => void` | — | Callback |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |
| `isLoading` | `boolean` | `false` | Skeleton |
| `aria-label` | `string` | — | Nhãn radiogroup |

Phím: ArrowLeft/Right. Con trượt trượt 180ms.

---

## 4. Toggle

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `checked` | `boolean` | — | Controlled |
| `defaultChecked` | `boolean` | `false` | Uncontrolled |
| `onChange` | `(checked: boolean) => Promise<void> \| void` | — | Hỗ trợ async + rollback |
| `onError` | `(err: unknown) => void` | — | Khi async thất bại |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |
| `isReadOnly` | `boolean` | `false` | Chỉ đọc |
| `isLoading` | `boolean` | `false` | Skeleton |
| `label` | `ReactNode` | — | Nhãn bên phải |
| `description` | `ReactNode` | — | Mô tả phụ |
| `aria-label` | `string` | — | Nhãn khi không có label |

36×20 px track, núm 16 px, trượt 180ms, bật = nền accent.

---

## 5. Input

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `label` | `ReactNode` | — | Nhãn trên ô |
| `error` | `ReactNode` | — | Lỗi (viền violation, caption) |
| `hint` | `ReactNode` | — | Gợi ý bên dưới |
| `prefix` | `ReactNode` | — | Bên trái |
| `suffix` | `ReactNode` | — | Bên phải |
| `isLoading` | `boolean` | `false` | Skeleton |
| `isReadOnly` | `boolean` | `false` | Chỉ hiển thị |
| `flash` | `boolean` | `false` | bg-flash sau ghi |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |

Cao 38px, bo 8px, focus-within ring-2 accent offset-2.

---

## 6. NumericField

Kế thừa Input props, thêm:

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `value` | `number` | **bắt buộc** | Giá trị số |
| `onChange` | `(val: number \| null) => void` | — | Chỉ gọi khi blur/Enter |
| `unit` | `string` | — | Đơn vị (mm, m, m², độ) |
| `min` | `number` | — | Tối thiểu |
| `max` | `number` | — | Tối đa |

Stepper hover, ArrowUp/Down ±1, Shift×10, chấp nhận dấu phẩy.

---

## 7. ThicknessField

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `value` | `110 \| 220 \| 330 \| 'column'` | — | Giá trị |
| `onChange` | `(val: 110 \| 220 \| 330 \| 'column') => void` | — | Callback |
| `aiValue` | `number \| undefined` | — | Giá trị AI để đối chiếu |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |

Không nhập tự do. Dùng SegmentedControl 4 mục cố định.

---

## 8. Select

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `options` | `SelectOption[]` | **bắt buộc** | ≤ 8 mục |
| `value` | `string` | — | Giá trị được chọn |
| `onChange` | `(val: string) => void` | — | Callback |
| `placeholder` | `string` | `'Chọn...'` | Placeholder |
| `label` | `string` | — | Nhãn |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |
| `isReadOnly` | `boolean` | `false` | Chỉ đọc |
| `isLoading` | `boolean` | `false` | Skeleton |

Compound API: Select.Root, .Trigger, .Content, .Item, .Label, .Empty, .Skeleton.
Phím: ArrowUp/Down, Enter, Esc, Tab. Mở 180ms ease-out.

---

## 9. Combobox

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `options` | `SelectOption[]` | **bắt buộc** | Danh sách tìm kiếm |
| `value` | `string` | — | Giá trị được chọn |
| `onChange` | `(val: string) => void` | — | Callback |
| `placeholder` | `string` | `'Chọn...'` | Placeholder |
| `label` | `string` | — | Nhãn |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |
| `isReadOnly` | `boolean` | `false` | Chỉ đọc |
| `isLoading` | `boolean` | `false` | Skeleton |

Tìm kiếm realtime. Empty: "Không tìm thấy. Thử từ khóa khác."
Compound API: Combobox.Root, .Trigger, .Content, .Search, .List, .Item, .Label, .Empty, .Skeleton.

---

## 10. FieldRow

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `label` | `string` | **bắt buộc** | Nhãn (40% chiều rộng) |
| `children` | `ReactNode` | **bắt buộc** | Giá trị (60%) |
| `isLast` | `boolean` | `false` | Bỏ viền dưới |
| `isMixed` | `boolean` | `false` | Hiện "—" cho giá trị hỗn hợp |
| `isReadOnly` | `boolean` | `false` | Opacity 60% |
| `readOnlyReason` | `string` | — | Lý do chỉ đọc |
| `isLoading` | `boolean` | `false` | Skeleton |
| `flash` | `boolean` | `false` | bg-accent-wash 400ms |
| `collapsed` | `boolean` | `false` | Render null |

---

## 11. Slider

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `value` | `number` | **bắt buộc** | Giá trị |
| `onChange` | `(value: number) => void` | **bắt buộc** | Callback |
| `min` | `number` | `0` | Tối thiểu |
| `max` | `number` | `100` | Tối đa |
| `step` | `number` | `1` | Bước nhảy |
| `snapPoints` | `number[]` | — | Snap tuỳ chọn |
| `endLabels` | `[string, string]` | — | Nhãn hai đầu |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |
| `readOnly` | `boolean` | `false` | Chỉ đọc |
| `isLoading` | `boolean` | `false` | Skeleton |

Rail 4px bg-sunken, núm 14px, giá trị mono khi kéo. Phím: Arrow, Home, End.

---

## 12. Checkbox

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `checked` | `boolean` | `false` | Trạng thái tích |
| `indeterminate` | `boolean` | `false` | Một phần |
| `onChange` | `(checked: boolean) => void` | — | Callback |
| `label` | `string` | — | Nhãn |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |
| `readOnly` | `boolean` | `false` | Chỉ đọc |
| `error` | `boolean` | `false` | Viền violation |

16×16 px, bo 6px, check stroke 1.5 animation 180ms.

---

## 13. Radio

RadioGroup + RadioItem.

RadioGroup props: `value`, `onChange`, `aria-label`

| Prop (RadioItem) | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `value` | `string` | **bắt buộc** | Giá trị |
| `label` | `string` | — | Nhãn |
| `description` | `string` | — | Mô tả phụ |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |

16×16 px, bo 999 (tròn).

---

## 14. Textarea

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `label` | `string` | — | Nhãn trên ô |
| `error` | `string` | — | Lỗi, role="alert" |
| `hint` | `string` | — | Gợi ý |
| `maxLength` | `number` | — | Giới hạn; đếm n/max |
| `isLoading` | `boolean` | `false` | Skeleton |
| `isReadOnly` | `boolean` | `false` | readOnly + bg-sunken |
| `disabled` | `boolean` | `false` | Vô hiệu hoá |

Tự cao 3–10 dòng (72–240px).

---

## 15. Tabs

| Prop | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `tabs` | `TabItem[]` | **bắt buộc** | Danh sách tab |
| `value` | `string` | — | Controlled |
| `defaultValue` | `string` | — | Uncontrolled |
| `onChange` | `(value: string) => void` | — | Callback |

TabItem: `{ label: string; value: string; badge?: number; disabled?: boolean }`

Gạch dưới 2px accent trượt 180ms. Huy hiệu số đếm bên phải nhãn. Phím: Arrow, Enter, Space.

---

## Token animation (5 mốc)

| ms | Dùng cho |
|---|---|
| 120 | Nút nhấn, hover, check |
| 180 | Toggle, tab, segment slider, dropdown |
| 260 | Toast |
| 340 | Transition vừa |
| 700 | Skeleton scan |

`prefers-reduced-motion`: tắt scale, giữ color transition.

---

## Quy ước

- 7 trạng thái: rỗng, đang tải, một phần, lỗi, thành công, không quyền, thu gọn
- Không gọi store/API trong component
- Không màu thô (hex/rgb/hsl) trong src/components
- Focus ring: ring-2 ring-accent ring-offset-2 trên mọi phần tử tương tác
