/**
 * Gói 2B — trần đổ bóng nắng. node-batch gộp trần vào `BatchedMesh`: cờ `castShadow` của lô chụp
 * lúc gộp (false) và mesh nguồn sang `BATCHED_LAYER` mà camera bóng không thấy → `syncCeilingShadows`
 * bật trên nguồn vô tác dụng. Mức Vừa/Cao không gộp trần (`ceilingSkipsBatch`); đổi Thấp ↔ Vừa/Cao
 * thì thả/gom lại trần (`subscribeCeilingBatch`). Logic ở `src/pascal-page/realism/daylight.ts`.
 */
export const RULES = {
  'nodes/src/shared/node-batch/candidates.ts': [
    [
      "import { isSlotPaintPreviewActive } from '../slot-paint'",
      "import { ceilingSkipsBatch } from '@pascal-realism/daylight'\nimport { isSlotPaintPreviewActive } from '../slot-paint'",
      1,
    ],
    [
      '  if (isExcluded(node) || isSlotPaintPreviewActive(nodeId)) return null',
      '  if (isExcluded(node) || ceilingSkipsBatch(node.type) || isSlotPaintPreviewActive(nodeId)) return null',
      1,
    ],
  ],
  'nodes/src/shared/node-batch/system.tsx': [
    [
      "import { isSlotPaintPreviewActive, subscribeSlotPaintPreviews } from '../slot-paint'",
      "import { subscribeCeilingBatch } from '@pascal-realism/daylight'\nimport { isSlotPaintPreviewActive, subscribeSlotPaintPreviews } from '../slot-paint'",
      1,
    ],
    [
      '  const unsubscribePreviews = subscribeSlotPaintPreviews(changed)\n',
      '  const unsubscribePreviews = subscribeSlotPaintPreviews(changed)\n  const unsubscribeCeiling = subscribeCeilingBatch(() => {\n    for (const id of [...(sceneRegistry.byType.ceiling ?? [])]) changed(id)\n  })\n',
      1,
    ],
    ['    unsubscribeMaterials()\n', '    unsubscribeMaterials()\n    unsubscribeCeiling()\n', 1],
  ],
};
