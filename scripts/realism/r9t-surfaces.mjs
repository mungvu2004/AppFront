/**
 * Bề mặt dùng chung (nhánh durable-walls) — áp cho mọi công trình, không chạm mẫu đồ:
 * - Tường sơn trơn: normal thạch cao rất nhẹ (`@pascal-realism/wallFinish`).
 * - Đèn âm trần: quầng hắt sáng trên trần, tắt theo đèn/Ban ngày (`@pascal-realism/halo`).
 * Cờ `flags.materials` tắt → cả hai y cũ. Tên `r9t` để chạy sau `r8-pack1` (cùng tệp item-light).
 */
export const RULES = {
  'viewer/src/systems/wall/wall-materials.ts': [
    [
      "\nimport { Color, type Material } from 'three'\n",
      "\nimport { Color, type Material } from 'three'\nimport { tuneWallPaint } from '@pascal-realism/wallFinish'\n",
      1,
    ],
    ['resolveMaterialRef(ref, sceneMaterials, shading) ??', 'tuneWallPaint(resolveMaterialRef(ref, sceneMaterials, shading)) ??', 2],
  ],
  'viewer/src/systems/item-light/item-light-system.tsx': [
    [
      "\nimport useViewer from '../../store/use-viewer'\n",
      "\nimport useViewer from '../../store/use-viewer'\nimport { syncRecessedHalos } from '@pascal-realism/halo'\n",
      1,
    ],
    [
      '\n  }, 6)\n',
      '\n    syncRecessedHalos(scene, registrations, sceneRegistry.nodes, useScene.getState().nodes, useViewer.getState().sceneTheme, dt)\n  }, 6)\n',
      1,
    ],
  ],
};
