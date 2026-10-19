import type { ShortcutDefinition } from '@/lib/input/shortcutRegistry';

/**
 * Phím tắt riêng của trang Dự án — nguồn chung cho `useProjectDashboard` (đăng ký), nút
 * "Dự án mới" (nhãn phím) và bảng phím tắt ở Tài khoản (RV5#12). Không viết tay "N" ở nơi khác.
 */
export const CREATE_PROJECT_SHORTCUT = {
  id: 'dashboard.createProject',
  combo: 'N',
  scope: 'global',
  description: 'Tạo dự án mới (ở trang Dự án)',
} as const satisfies Omit<ShortcutDefinition, 'onTrigger'>;

/** Mọi phím chỉ có ở trang Dự án (registry toàn cục không có chúng). */
export const DASHBOARD_PAGE_SHORTCUTS: readonly Omit<ShortcutDefinition, 'onTrigger'>[] = [CREATE_PROJECT_SHORTCUT];
