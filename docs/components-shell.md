# Components Shell — Tài liệu kỹ thuật

## Tổng quan

Toàn bộ 47 màn hình đều dùng chung khung `AppShell`. Mỗi màn hình chỉ lắp nội dung vào 3 slot: `leftPanelContent`, `rightPanelContent`, `canvasContent`. Không màn hình nào được tự định nghĩa layout.

---

## 1. AppShell

**Vị trí:** `src/components/shell/AppShell.tsx`  
**Hook:** `src/hooks/useAppShell.ts`

### Grid layout

```
┌──────────────────────────────────────── 56px ─────────────────────────────────────────┐
│  Logo  │  Breadcrumb           │       [spacer]        │  Toggles  │  Help             │
├───┬────┬──────┬────────────────────────────────────────────────┬──────┤
│   │    │      │                                                │      │
│   │    │ 280  │              canvas (flex-1, min 640)          │ 344  │
│56 │    │      │                                                │      │
│   │    │      │                                                │      │
├───┴────┴──────┴────────────────────────────────────────────────┴──────┤
│ X: 124,50  │  Y: 89,12  │   1:100 · 12 mm/px   │   Đã lưu lúc 14:32 │  32px
└───────────────────────────────────────────────────────────────────────┘
```

- Padding ngoài: `px-2 pb-2 gap-2` → panel cách viền cửa sổ 8px
- Panel nổi: `bg-bg-surface rounded-[12px] shadow-panel`

### Breakpoints

| Chiều rộng | Panel trái | Panel phải |
|---|---|---|
| ≥ 1280px | Cố định 280px, animate mở/đóng | Cố định 344px, animate mở/đóng |
| 1024–1279px | Cố định 280px | **Drawer overlay** từ phải |
| < 1024px | **Drawer** từ trái | Drawer overlay từ phải |

### Props

```tsx
interface AppShellProps {
  leftPanelContent?: React.ReactNode;
  rightPanelContent?: React.ReactNode;
  canvasContent?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  cursorX?: number;       // mặc định 124.5
  cursorY?: number;       // mặc định 89.12
  scaleRatio?: string;    // mặc định "1:100"
  scaleDensity?: string;  // mặc định "12 mm/px"
  saveText?: string;      // mặc định "Đã lưu lúc 14:32"
}
```

### Phím tắt tích hợp

| Phím | Hành động |
|---|---|
| `V` | Công cụ Chọn |
| `W` | Công cụ Tường |
| `M` | Công cụ Kích thước |
| `L` | Công cụ Cửa/lỗ mở |
| `[` | Toggle panel trái (hoặc mở Drawer < 1024px) |
| `]` | Toggle panel phải (hoặc mở Drawer < 1280px) |
| `?` | Mở ShortcutHelp |
| `Cmd+K` | Mở CommandPalette |
| `Esc` | Đóng lớp overlay trên cùng |

---

## 2. Panel

**Vị trí:** `src/components/shell/Panel.tsx`

### API (Compound component)

```tsx
<Panel.Root>
  <Panel.Header
    title="Thuộc tính tường"
    onCollapse={fn}
    collapseDirection="left"
    action={<SomeButton />}
  />
  <Panel.Body>
    <Panel.Group label="Kích thước">
      {/* fields */}
    </Panel.Group>
    <Panel.Divider />
    <Panel.Group label="Vật liệu">
      {/* fields */}
    </Panel.Group>
  </Panel.Body>
</Panel.Root>
```

### Legacy API (backward compat)

```tsx
<Panel
  header="Thuộc tính tường"
  headerAction={<Button />}
  onCollapse={fn}
>
  {children}
</Panel>
```

### Specs

- Padding body: `px-5 pb-5` (20px)
- Khoảng giữa group: `gap-6` trong PanelBody (24px)
- Sticky hairline: border-top xuất hiện khi scroll > 0 (IntersectionObserver)
- Nhãn header: `text-[11px] font-semibold text-text-secondary`

---

## 3. Breadcrumb

**Vị trí:** `src/components/shell/Breadcrumb.tsx`  
**Hook:** `src/hooks/useBreadcrumb.ts`

### API

```tsx
<Breadcrumb
  items={[
    { id: 'project', label: 'Dự án' },
    {
      id: 'floor',
      label: 'Tầng 01',
      options: [
        { id: 'f0', label: 'Tầng hầm', onClick: () => {} },
        { id: 'f1', label: 'Tầng 01',  onClick: () => {} },
      ],
    },
    { id: 'layer', label: 'Lớp tường' }, // phần cuối — không click
  ]}
/>
```

### Quy tắc

- Separator: `›` (ký tự văn bản, không phải icon)
- Phần cuối: `text-text-primary font-semibold`, không click
- Phần trước: `text-text-secondary`, click được
- Cấp giữa (có `options`): click mở dropdown `listbox`, `z-index: Z_INDEX.dropdown`

---

## 4. StatusBar

**Vị trí:** `src/components/shell/StatusBar.tsx`

### CHỈ 3 mục (không thêm mục thứ tư)

| Vị trí | Nội dung | Font |
|---|---|---|
| Trái | `X: 124,50  │  Y: 89,12` | Mono, tabular-nums |
| Giữa | `1:100 · 12 mm/px` | Sans |
| Phải | `Đã lưu lúc 14:32` | Sans, aria-live=polite |

### Specs

- Cao: `h-8` (32px)
- Nền: `bg-bg-surface` (không phải bg-app)
- Viền trên: `border-t border-border-default`
- Z-index: `Z_INDEX.statusBar`
- Dấu thập phân: **dấu phẩy** (`,`)

---

## 5. Modal

**Vị trí:** `src/components/overlay/Modal.tsx`

> ⚠️ **Chỉ dùng cho:** tạo mới, xoá, xuất bản. KHÔNG dùng trong luồng QC.

### API

```tsx
<Modal.Root isOpen={isOpen} onClose={onClose} width={560}>
  <Modal.Header>Tạo tầng mới</Modal.Header>
  <Modal.Body>
    {/* form content */}
  </Modal.Body>
  <Modal.Footer>
    <Modal.CloseButton>Hủy</Modal.CloseButton>
    <Button variant="primary" onClick={handleSubmit}>Tạo</Button>
  </Modal.Footer>
</Modal.Root>
```

### Specs

- Width: `480` | `560` | `720`
- Z-index: `Z_INDEX.modal` (60)
- Animation: slide lên 8px + fade, 260ms mở / 180ms đóng
- Focus: tự động focus khi mở, trả về khi đóng
- Keyboard: Tab trap, Esc đóng

---

## 6. Drawer

**Vị trí:** `src/components/overlay/Drawer.tsx`

### API

```tsx
<Drawer.Root isOpen={isOpen} onClose={onClose} size={400}>
  <Drawer.Header>
    <h2>Chi tiết tường</h2>
  </Drawer.Header>
  <Drawer.Body>
    {/* nội dung */}
  </Drawer.Body>
</Drawer.Root>
```

### Specs

- Desktop: trượt từ phải, `size`: `320` | `400`, 260ms → 340ms
- Mobile (< 1024px): bottom-sheet 3 mức snap:
  - Mức 0: `88px` (peek)
  - Mức 1: `40%` chiều cao màn hình
  - Mức 2: `90vh` (full)
- Drag để chuyển mức, vuốt mạnh xuống → đóng
- Z-index: `Z_INDEX.drawer` (50)

---

## 7. CommandPalette

**Vị trí:** `src/components/overlay/CommandPalette.tsx`  
**Hook:** `src/hooks/useCommandPalette.ts`

### Mở bằng Cmd+K (tự động — không cần props)

```tsx
// Trong AppShell (đã tích hợp sẵn)
<CommandPalette />

// Hoặc với commands tùy chỉnh
<CommandPalette commands={myCommands} />
```

### CommandItem type

```ts
interface CommandItem {
  id: string;
  label: string;
  group: string;         // nhãn nhóm — viết thường
  shortcut?: string;     // hiển thị Kbd
  keywords?: string[];   // từ khóa tìm kiếm bổ sung
  onSelect: () => void;
}
```

### Specs

- Rộng: 560px
- Input: 44px cao
- Kết quả: nhóm bởi `group`, nhãn nhóm viết thường
- Navigation: `↑` `↓` di chuyển, `Enter` chọn, `Esc` đóng
- Z-index: `Z_INDEX.commandPalette` (70)

---

## 8. ShortcutHelp

**Vị trí:** `src/components/shell/ShortcutHelp.tsx`

### API

```tsx
const { isOpen, open, close } = useShortcutHelp();

// Trong JSX:
<ShortcutHelp isOpen={isOpen} onClose={close} />
```

### Mở bằng `?` (xử lý trong AppShell)

### Nhóm phím tắt

| Nhóm | Phím |
|---|---|
| Công cụ | V W M L |
| Chế độ xem | 2 3 [ ] |
| Hệ thống | Cmd+K · Cmd+Z · ? · Esc |

---

## Thứ tự lớp (Z-Index)

| Tên | Giá trị | Dùng cho |
|---|---|---|
| `panel` | 20 | Panel cố định |
| `statusBar` | 30 | StatusBar |
| `dropdown` | 40 | Breadcrumb dropdown, Select |
| `drawer` | 50 | Drawer, Overlay panel |
| `modal` | 60 | Modal, ShortcutHelp |
| `commandPalette` | 70 | CommandPalette |
| `toast` | 80 | Toast undo |
| `tooltip` | 90 | Tooltip |

---

## Quy tắc bất biến

1. **Không z-index hardcode** — chỉ dùng `Z_INDEX.*` từ `src/lib/zIndex.ts`
2. **Không nút "Lưu"** — tự lưu 800ms, hiển thị trạng thái ở StatusBar
3. **Không modal chặn trong QC** — chỉ dùng Modal cho tạo mới / xoá / xuất bản
4. **Animation chỉ 5 mốc**: 120 / 180 / 260 / 340 / 700ms từ `src/lib/motion.ts`
5. **Không hex/rgb/hsl** trong `src/components` và `src/screens`
