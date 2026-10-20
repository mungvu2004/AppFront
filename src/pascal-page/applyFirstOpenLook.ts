/**
 * Thân của `./firstOpen`, tách ra để vitest chạy được (như `./createProbe`): nhận kho
 * `useViewer` qua tham số, không nhập `@pascal-app/*` (vitest không nạp được gói khi chưa
 * dựng `dist/*.js`).
 *
 * Lần mở đầu tiên trên máy này: cảnh Pascal hiện như nhà 3D ở trang đăng nhập — tô
 * `rendered` (vật liệu thật, không phải đất sét) trên nền tối `night` (gần nền #2b2a28 của
 * trang đăng nhập nhất trong các chủ đề Pascal: ΔE76 nền 12,5, `twilight` 20,5 ngả tím, các
 * chủ đề sáng ≥ 72 — `studio` 81,5). Pascal tự lưu lựa chọn
 * (`viewer-preferences`), nên chỉ gieo một lần theo cờ; lần sau người dùng đổi gì thì giữ nấy.
 */

export const FIRST_OPEN_FLAG = 'appfront.pascal.firstOpen.v1';
export const FIRST_OPEN_THEME = 'night';

interface ViewerLook {
  setRenderContext: (context: 'editor') => void;
  setShading: (shading: 'rendered') => void;
  setSceneTheme: (id: string) => void;
}

export interface FirstOpenStore {
  getState: () => ViewerLook;
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => unknown };
}

/** Gieo dáng mở đầu nếu chưa có cờ. Mọi lần chạm bộ nhớ đều bọc try/catch (chế độ riêng tư). */
export function applyFirstOpenLook(store: FirstOpenStore, storage: () => Storage): void {
  const seed = () => {
    try {
      const local = storage();
      if (local.getItem(FIRST_OPEN_FLAG) !== null) return;
      const viewer = store.getState();
      viewer.setRenderContext('editor');
      viewer.setShading('rendered');
      viewer.setSceneTheme(FIRST_OPEN_THEME);
      local.setItem(FIRST_OPEN_FLAG, '1');
    } catch {
      // Không đọc/ghi được bộ nhớ: để mặc định của Pascal.
    }
  };
  // Gieo trước khi kho nạp xong thì lượt nạp sẽ đè mất.
  if (store.persist.hasHydrated()) seed();
  else store.persist.onFinishHydration(seed);
}
