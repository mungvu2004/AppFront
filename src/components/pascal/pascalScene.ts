/**
 * Cửa nạp cảnh AppFront vào Pascal.
 *
 * Đây là thư mục **duy nhất** được nhập `@pascal-app/*` (`eslint-rules/configs/project.js`,
 * cổng nhập gói Pascal). Bộ đổi dữ liệu ở `src/lib/pascal` là tầng thuần và chỉ được
 * `import type`; chỗ gọi mã Pascal thật là đây.
 *
 * ## Thứ tự nhúng — đã đo, không đoán
 *
 * Đo ngày 2026-09-28 trên Chromium với GPU thật, ghi trong
 * `docs/pascal/IMPLEMENTATION_STATUS.md` §4.9. Sai thứ tự thì **không có lỗi nào nổ** —
 * màn hình chỉ trống, nên nó đáng được viết ra thành mã chứ không để trong đầu ai:
 *
 * 1. `loadPlugin(builtinPlugin)` **trước khi** mount viewer. Không có nó thì registry rỗng
 *    và không loại node nào được vẽ — `@pascal-app/nodes` tự khai điều này ở đầu
 *    `dist/index.d.ts`.
 * 2. `setScene(...)` kèm `installedPlugins`, để không lượt ghi nào sau đó phải sửa danh sách
 *    ấy: mọi thay đổi chạm `installedPlugins` đều huỷ lượt hydration đang chờ
 *    (`core/src/store/use-scene.ts`, nhánh `documentChanged`).
 * 3. Node phải **đã đủ trường** trước khi tới đây. `setScene` không chạy zod, nên mặc định
 *    của lược đồ không được áp — `src/lib/pascal/__tests__/renderContract.test.ts` giữ hàng
 *    rào đó.
 */

import useScene from '@pascal-app/core/store';
import { loadPlugin } from '@pascal-app/core/registry';
import { builtinPlugin } from '@pascal-app/nodes';

import type { PascalScene } from '@/lib/pascal/types';

/** Registry là trạng thái toàn cục của Pascal; nạp hai lần là phí, không phải lỗi. */
let pluginsLoaded: Promise<void> | null = null;

/**
 * Nạp bộ loại node dựng sẵn vào registry của Pascal.
 *
 * Gọi được nhiều lần: lượt đầu làm thật, các lượt sau dùng lại chính lời hứa ấy.
 */
export const loadPascalPlugins = async (): Promise<void> => {
  pluginsLoaded ??= loadPlugin(builtinPlugin);
  await pluginsLoaded;
};

/** Cái `loadSceneIntoPascal` trả về, đủ để nơi gọi tự kiểm mà không cần chạm store Pascal. */
export interface PascalLoadResult {
  /** Số node thật sự nằm trong store sau lượt nạp. */
  readonly nodeCount: number;
  /** Node bị store dọn đi vì mồ côi hoặc không với tới được từ gốc. */
  readonly droppedIds: readonly string[];
}

/**
 * Đưa một cảnh do `toPascalScene()` sinh ra vào store của Pascal.
 *
 * Trả về số đo thay vì `void`: store **im lặng** bỏ node mồ côi và node không với tới được
 * từ `rootNodeIds`, nên nơi gọi cần thấy được điều đó.
 */
export const loadSceneIntoPascal = async (scene: PascalScene): Promise<PascalLoadResult> => {
  await loadPascalPlugins();

  const store = useScene.getState();
  store.setScene(scene.nodes as never, scene.rootNodeIds as never, {
    installedPlugins: [builtinPlugin.id],
    hasExplicitPluginInstallState: true,
  });

  const after = useScene.getState();
  const droppedIds = Object.keys(scene.nodes).filter((id) => !(id in after.nodes));

  return { nodeCount: Object.keys(after.nodes).length, droppedIds };
};

/** Trả store về rỗng. Dùng khi rời màn, để cảnh cũ không sống sót sang lượt sau. */
export const clearPascalScene = (): void => {
  useScene.getState().unloadScene();
};
