// @vitest-environment node
/** Khung nhúng không mang theo dáng xem trang editor3d để lại (night, cutaway, exploded). */
import { describe, expect, it, vi } from 'vitest';

import { EMBEDDED_SCENE_THEME, EMBEDDED_WALL_MODE, pinEmbeddedLook } from '../embeddedLook';

const viewerOf = (levelMode: string, sceneTheme: string, wallMode: string) => ({
  levelMode,
  sceneTheme,
  wallMode,
  setLevelMode: vi.fn(),
  setSceneTheme: vi.fn(),
  setWallMode: vi.fn(),
});

describe('pinEmbeddedLook', () => {
  it('editor3d để lại night + cutaway + exploded: trả về studio + up + stacked', () => {
    const viewer = viewerOf('exploded', 'night', 'cutaway');
    pinEmbeddedLook(viewer);
    expect(viewer.setLevelMode).toHaveBeenCalledWith('stacked');
    expect(viewer.setSceneTheme).toHaveBeenCalledWith(EMBEDDED_SCENE_THEME);
    expect(viewer.setWallMode).toHaveBeenCalledWith('up');
    expect(EMBEDDED_WALL_MODE).toBe('up');
  });

  it('đã đúng thì không ghi gì; solo của người dùng giữ nguyên', () => {
    const viewer = viewerOf('solo', EMBEDDED_SCENE_THEME, EMBEDDED_WALL_MODE);
    pinEmbeddedLook(viewer);
    expect(viewer.setLevelMode).not.toHaveBeenCalled();
    expect(viewer.setSceneTheme).not.toHaveBeenCalled();
    expect(viewer.setWallMode).not.toHaveBeenCalled();
  });
});
