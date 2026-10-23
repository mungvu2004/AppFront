/**
 * Mũi tên lên/xuống đổi dòng chọn ở danh sách của các màn duyệt lớp (Impeccable A3).
 *
 * Phím đăng ký ở tầng `canvas` với `preventDefault: false`: khi tiêu điểm đang
 * ở một điều khiển tự dùng mũi tên (ô nhập, radio, thanh trượt, select, cây
 * lớp), handler nhường phím cho điều khiển đó và không đổi dòng chọn.
 */

import type { ShortcutKeyEvent } from '@/lib/input/shortcutRegistry';

const ARROW_OWNING_TAGS: ReadonlySet<string> = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const ARROW_OWNING_ROLES: ReadonlySet<string> = new Set([
  'radio',
  'slider',
  'combobox',
  'menuitem',
  'menuitemradio',
  'menuitemcheckbox',
  'tab',
  'spinbutton',
  'treeitem',
  'gridcell',
]);

/** `true` khi phần tử đang có tiêu điểm tự xử lý mũi tên. */
export function focusOwnsArrowKeys(): boolean {
  const active = typeof document === 'undefined' ? null : document.activeElement;

  if (!(active instanceof HTMLElement)) {
    return false;
  }

  const role = active.getAttribute('role');

  return ARROW_OWNING_TAGS.has(active.tagName) || (role !== null && ARROW_OWNING_ROLES.has(role));
}

/** Handler cho binding mũi tên: nhường phím cho điều khiển đang giữ tiêu điểm, còn lại đổi dòng. */
export function arrowStepHandler(move: () => void): (event: ShortcutKeyEvent) => void {
  return (event) => {
    if (focusOwnsArrowKeys()) {
      return;
    }

    event.preventDefault?.();
    move();
  };
}
