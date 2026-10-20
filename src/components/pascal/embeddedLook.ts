/**
 * Dáng xem ghim cho khung Pascal nhúng ở app chính (thân của `stackExplodedLevels`,
 * `./pascalScene`). Tách riêng, không nhập `@pascal-app/*`, để vitest chạy được khi gói
 * Pascal chưa dựng `dist/*.js`.
 */

/** Chủ đề của khung nhúng: mặc định của Pascal, như trước khi trang editor3d có chủ đề tối. */
export const EMBEDDED_SCENE_THEME = 'studio';

/** Chế độ tường của khung nhúng: `up`, mặc định của Pascal trước khi trang editor3d gieo `cutaway`. */
export const EMBEDDED_WALL_MODE = 'up';

interface EmbeddedViewer {
  levelMode: string;
  sceneTheme: string;
  wallMode: string;
  setLevelMode: (mode: 'stacked') => void;
  setSceneTheme: (id: typeof EMBEDDED_SCENE_THEME) => void;
  setWallMode: (mode: typeof EMBEDDED_WALL_MODE) => void;
}

/** `exploded` → `stacked`; chủ đề và chế độ tường về mặc định của khung nhúng. Chỉ ghi khi khác. */
export const pinEmbeddedLook = (viewer: EmbeddedViewer): void => {
  if (viewer.levelMode === 'exploded') viewer.setLevelMode('stacked');
  if (viewer.sceneTheme !== EMBEDDED_SCENE_THEME) viewer.setSceneTheme(EMBEDDED_SCENE_THEME);
  if (viewer.wallMode !== EMBEDDED_WALL_MODE) viewer.setWallMode(EMBEDDED_WALL_MODE);
};
