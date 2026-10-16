/**
 * QA-09 P1 helpers (phase09_shell_edge.spec.ts, FL-9P-01..04). Copy checked in src/ at 5fcaf502:
 *   PD ProjectDashboard.tsx:166,198  PCT ProjectCardTile.tsx:108,166  PMG projectMenuGroups.ts:24-25
 *   WS useWelcomeScreen.ts:135-142  AD useAccessDenied.ts:97-117  NF useNotFound.ts:~98  PS useProjectSettings.ts:533-536
 *   MLC useModelLibrary.ts:~103 (read-only banner)  NG notificationCenterGateway.ts:182
 */
import type { Page } from '@playwright/test';

import { captureEvidence } from '../evidence';

export const COPY = {
  dashH1: 'Dự án của tôi', // PD:166
  newProject: 'Dự án mới', // PD:154
  viewerLine: 'Vai người xem: chỉ có thể mở dự án, không tạo hoặc xoá được.', // PD:198-201
  emptyViewer: 'Bạn chưa được thêm vào dự án nào. Khi được mời, dự án sẽ hiện ở đây.', // PD:245-249
  createEmpty: 'Tạo dự án mới',
  settingsH1: 'Cài đặt dự án', // ProjectSettings.tsx:74
  settingsReadOnly: 'Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.', // PS:84
  tabGeneral: 'Chung',
  tabUnits: 'Đơn vị đo',
  tabMembers: 'Thành viên',
  tabDanger: 'Vùng nguy hiểm',
  addMember: 'Thêm thành viên', // AddMemberForm.tsx:45
  backToProjects: 'Về danh sách dự án', // AD:109
  notFoundTitle: 'Không tìm thấy trang này', // NF
  deniedTitle: 'Bạn chưa có quyền truy cập', // AD:98
  deniedIdentity: 'Bạn đang đăng nhập bằng', // AD:105
  switchAccount: 'Đăng nhập bằng tài khoản khác', // AD:108
  deniedRestriction: 'Nội dung ở đường dẫn này đang giới hạn người xem, nên nó chưa mở ra cho tài khoản của bạn.', // AD:101
  deniedWhoGrants: 'Người quản trị dự án là người cấp được quyền này; hãy nhắn cho họ để được thêm vào danh sách xem.', // AD:103
  onbViewerNote: 'Vai người xem chỉ duyệt được kết quả, không tạo dự án và không tải bản vẽ.', // WelcomeScreen.tsx FORBIDDEN_NOTE
  onbStep3: 'Duyệt kết quả và dựng 3D', // useWelcomeScreen.ts:135
  onbSample: 'Xem dự án mẫu', // :139
  onbTutorial: 'Xem hướng dẫn 2 phút', // vi.json:642 (the button's name)
  onbTutorialOff:'Hướng dẫn hai phút chưa sẵn sàng.', // :141
  onbSkip: 'Bỏ qua', // :142
  accept: 'Chấp nhận', // NG:182
  librarySearch: 'Tìm model', // ModelLibraryToolbar
  libraryReadOnly: 'Vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện', // useModelLibrary.ts:~103
  libraryForbidden: 'Không có quyền',
} as const;

/** Evidence `E09_<id>_<slug>.png` (one per step). */
export const shot = (page: Page, id: string, slug: string): Promise<string> =>
  captureEvidence(page, `E09_${id}_${slug}.png`);

/** Client-side navigation (history push + popstate), no document load: same trick as phase03_settings_edge.spec.ts:1533. */
export async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}
