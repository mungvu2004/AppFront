import { type SceneGraph, useScene } from '@pascal-app/core';
import { useCallback } from 'react';

import type { PascalBridge, PascalSceneGraph } from './bridge';

type LoadScene = PascalBridge['onLoad'];
type RebaseLoaded = (scene: PascalSceneGraph) => void;

/**
 * Nạp cảnh, rồi lấy cảnh Pascal giữ SAU `setScene` (đã điền mặc định lược đồ) làm mốc "trước" của lượt
 * sửa đầu (`PascalBridge.rebaseLoaded`). Lượt đổi kho đầu tiên sau khi nạp chính là `setScene` của
 * Editor với đúng các gốc của cảnh vừa trao.
 */
export const loadAndRebase = async (load: LoadScene, rebaseLoaded: RebaseLoaded): Promise<SceneGraph> => {
  const scene = (await load()) as unknown as SceneGraph;
  const roots = new Set<string>(scene.rootNodeIds);
  const unsubscribe = useScene.subscribe((state) => {
    if (!state.rootNodeIds.some((id) => roots.has(id))) return;
    unsubscribe();
    rebaseLoaded({ nodes: state.nodes, rootNodeIds: state.rootNodeIds });
  });
  return scene;
};

/**
 * `onLoad` cho Editor, giữ nguyên danh tính qua các lần vẽ: hiệu ứng nạp của Pascal phụ thuộc `[onLoad]`
 * nên mỗi danh tính mới là một lần dỡ + nạp lại cả cảnh. Hàm viết thẳng trong render (0beacb6f) biến chính
 * lần nạp — `setLoadedScene` làm trang vẽ lại — thành vòng lặp treo trang (02/11).
 */
export const useSceneLoader = (load: LoadScene, rebaseLoaded: RebaseLoaded): (() => Promise<SceneGraph>) =>
  useCallback(() => loadAndRebase(load, rebaseLoaded), [load, rebaseLoaded]);
