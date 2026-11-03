/**
 * Menu thả xuống của thanh trên trang 3D là `<details data-appfront-menu>` gốc. Trình duyệt cho mở
 * nhiều cái một lúc và không tự đóng — các menu đè lên nhau, lên thông báo và bảng bên phải. Tệp này
 * gắn MỘT bộ nghe chung lên `document`:
 *  - mở một menu thì đóng mọi menu khác (trừ menu cha chứa nó);
 *  - bấm ra ngoài mọi menu đang mở thì đóng hết;
 *  - Esc đóng menu trong cùng đang mở (lớp trên cùng) và trả tiêu điểm về nút của nó.
 * Gọi `useMenuGroup()` trong mọi thẻ có `data-appfront-menu`; gắn nhiều lần vẫn chỉ một bộ nghe.
 */
import { useEffect } from 'react';

const MENU = 'details[data-appfront-menu]';

function openMenus(doc: Document): HTMLDetailsElement[] {
  return Array.from(doc.querySelectorAll<HTMLDetailsElement>(`${MENU}[open]`));
}

/** Gắn bộ nghe lên `doc`; trả về hàm gỡ. Thuần DOM để test gọi thẳng. */
export function installMenuGroup(doc: Document): () => void {
  const onToggle = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLDetailsElement) || !target.open || !target.matches(MENU)) return;
    for (const menu of openMenus(doc)) {
      if (menu !== target && !menu.contains(target)) menu.open = false;
    }
  };
  const onPointerDown = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    // Menu Radix mở từ trong một menu (mục "Hiển thị" của "Xem") cổng ra `body`: bấm trong đó không phải bấm ra ngoài.
    if (target instanceof Element && target.closest('[data-radix-popper-content-wrapper]') !== null) return;
    for (const menu of openMenus(doc)) {
      if (!menu.contains(target)) menu.open = false;
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    const open = openMenus(doc);
    // Menu trong cùng đứng sau cùng theo thứ tự tài liệu.
    const top = open[open.length - 1];
    if (top === undefined) return;
    top.open = false;
    top.querySelector<HTMLElement>(':scope > summary')?.focus();
    // Esc đã dùng để đóng menu: đừng để trình dựng bỏ chọn đồ vật cùng lúc.
    event.stopPropagation();
  };
  // `toggle` không nổi bọt — nghe ở pha bắt.
  doc.addEventListener('toggle', onToggle, true);
  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('keydown', onKeyDown, true);
  return () => {
    doc.removeEventListener('toggle', onToggle, true);
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('keydown', onKeyDown, true);
  };
}

let users = 0;
let uninstall: (() => void) | null = null;

/** Đăng ký thẻ dùng menu; bộ nghe sống khi còn ít nhất một thẻ. */
export function useMenuGroup(): void {
  useEffect(() => {
    users += 1;
    if (uninstall === null) uninstall = installMenuGroup(document);
    return () => {
      users -= 1;
      if (users === 0 && uninstall !== null) {
        uninstall();
        uninstall = null;
      }
    };
  }, []);
}

/** Lớp chung cho nút mở menu (`summary`) và khung thả xuống của các thẻ thanh trên. */
export const MENU_SUMMARY_CLASS =
  'flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)] [&::-webkit-details-marker]:hidden';

/** Khung thả xuống, hoặc khung phẳng khi thẻ là một mục trong menu "Xem". */
export function menuPanelClass(section: boolean, width = 'min-w-36'): string {
  return section
    ? 'p-1 text-[13px] text-[var(--pa-text)]'
    : `absolute top-full left-0 z-50 mt-1 ${width} rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-overlay)]`;
}

/** Tiêu đề mục trong menu "Xem". */
export const SECTION_TITLE_CLASS = 'px-2 pt-2 pb-0.5 font-medium text-[12px] text-[var(--pa-text-3)]';
