/**
 * W1 (warm-pipelines): lượt vẽ khung sống tạo pipeline bất đồng bộ (`createRenderPipelineAsync`) thay vì
 * đồng bộ — biên dịch shader không còn treo luồng chính GPU. Logic ở `src/pascal-page/realism/warm.ts`.
 * Đặt tên `w1` để chạy SAU `r2-idle` (luật áp theo thứ tự tên file): neo vào dòng R2 đã chèn, gắn TRƯỚC cổng
 * R2 để có hiệu lực từ khung đầu kể cả khi R2 bỏ vẽ.
 */
export const RULES = {
  'viewer/src/components/viewer/post-processing.tsx': [
    [
      "import { installIdleSources, markDirty, pollDirty, shouldDraw, storeDirty, THEME_HOLD_MS } from '@pascal-realism/idle'\n",
      "import { installIdleSources, markDirty, pollDirty, shouldDraw, storeDirty, THEME_HOLD_MS } from '@pascal-realism/idle'\n" +
        "import { installAsyncNodeBuilds, installAsyncPipelines, installLazyDispose, liveFrame } from '@pascal-realism/warm'\n" +
        "import { installShadowAlphaSkip } from '@pascal-realism/shadow-alpha'\n",
    ],
    ['    if (!shouldDraw()) return\n', '    installAsyncPipelines(renderer)\n    installAsyncNodeBuilds(renderer)\n    installLazyDispose(renderer)\n    installShadowAlphaSkip(renderer)\n    if (!shouldDraw()) return\n'],
    // Chỉ hai lệnh vẽ khung sống đi đường bất đồng bộ (xem warm.ts — lượt chụp một lần phải đủ vật).
    [
      "      timeSpan('render-encode', () => {\n        pipeline.render()\n      })\n",
      "      timeSpan('render-encode', () => {\n        liveFrame(scene, () => pipeline.render())\n      })\n",
    ],
    [
      "        timeSpan('render-encode', () => {\n          ;(renderer as any).render(scene, camera)\n        })\n",
      "        timeSpan('render-encode', () => {\n          liveFrame(scene, () => (renderer as any).render(scene, camera))\n        })\n",
    ],
  ],
};
