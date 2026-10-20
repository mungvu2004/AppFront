/**
 * Thân của `./firstOpen`, tách ra để vitest chạy được (như `./createProbe`): nhận kho
 * `useViewer` qua tham số, không nhập `@pascal-app/*` (vitest không nạp được gói khi chưa
 * dựng `dist/*.js`).
 *
 * Cảnh Pascal hiện như nhà 3D ở trang đăng nhập — tô `rendered` (vật liệu thật, không phải
 * đất sét) trên nền tối `night` (gần nền #2b2a28 của trang đăng nhập nhất trong các chủ đề
 * Pascal: ΔE76 nền 12,5, `twilight` 20,5 ngả tím, các chủ đề sáng ≥ 72 — `studio` 81,5; nay
 * `./renderLook` còn đè `night` cho ấm hẳn). `rendered` đặt lại MỖI lần mở: đây là trang xem
 * trước hết, Pascal tự lưu `solid` từ lần trước thì lần mở sau vẫn phải ra ảnh thật; trong
 * phiên người dùng đổi thoải mái. Nét viền (`edges`) tắt chỉ ở lần mở đầu (theo cờ), sau đó
 * người dùng bật lại thì giữ nấy.
 *
 * Chủ đề thì khác: `viewer-preferences` dùng chung với khung Pascal nhúng trong app chính, mà
 * khung ấy ghim `studio` (`stackExplodedLevels`, pascalScene.ts). Nên trang này giữ chủ đề của
 * riêng nó ở `EDITOR_THEME_KEY` và đặt lại mỗi lần mở.
 */

export const FIRST_OPEN_FLAG = 'appfront.pascal.firstOpen.v1';
export const FIRST_OPEN_THEME = 'night';
export const EDITOR_THEME_KEY = 'appfront.pascal.editorTheme.v1';

interface ViewerLook {
  sceneTheme: string;
  setRenderContext: (context: 'editor') => void;
  setShading: (shading: 'rendered') => void;
  setEdges: (edges: 'off') => void;
  setSceneTheme: (id: string) => void;
}

export interface FirstOpenStore {
  getState: () => ViewerLook;
  subscribe: (listener: (state: ViewerLook, previous: ViewerLook) => void) => unknown;
  /** Không có khi `localStorage` ném lỗi lúc tạo kho (zustand bỏ hẳn `persist`). */
  persist?: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => unknown };
}

/** Đặt `rendered`, và gieo dáng mở đầu nếu chưa có cờ. Mọi lần chạm bộ nhớ đều bọc try/catch (chế độ riêng tư). */
export function applyFirstOpenLook(store: FirstOpenStore, storage: () => Storage): void {
  const seed = () => {
    try {
      const local = storage();
      const viewer = store.getState();
      viewer.setRenderContext('editor');
      viewer.setShading('rendered');
      if (local.getItem(FIRST_OPEN_FLAG) === null) {
        viewer.setEdges('off');
        local.setItem(EDITOR_THEME_KEY, FIRST_OPEN_THEME);
        local.setItem(FIRST_OPEN_FLAG, '1');
      }
      // Máy đã mở trước khi có khoá này thì chưa có gì để đặt lại: để nguyên.
      const theme = local.getItem(EDITOR_THEME_KEY);
      if (theme !== null) viewer.setSceneTheme(theme);
      store.subscribe((state, previous) => {
        if (state.sceneTheme === previous.sceneTheme) return;
        try {
          local.setItem(EDITOR_THEME_KEY, state.sceneTheme);
        } catch {
          // Bộ nhớ đầy/bị chặn: lần sau mở lại chủ đề cũ, không sao.
        }
      });
    } catch {
      // Không đọc/ghi được bộ nhớ: để mặc định của Pascal.
    }
  };
  // Không có `persist` nghĩa là `localStorage` đã ném lỗi: không có gì để gieo hay giữ.
  if (store.persist === undefined) return;
  // Gieo trước khi kho nạp xong thì lượt nạp sẽ đè mất.
  if (store.persist.hasHydrated()) seed();
  else store.persist.onFinishHydration(seed);
}
