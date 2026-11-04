/**
 * W3: chuẩn bị sẵn pipeline viền hover ở khung đầu sau khi nạp xong, lần rê chuột đầu không còn khựng.
 * Logic ở `src/pascal-page/realism/warm.ts` (`outlineWarmFrame`). Tên `w3` để chạy sau `w1-warm-pipelines`.
 */
export const RULES = {
  'viewer/src/components/viewer/post-processing.tsx': [
    [
      "import { installAsyncNodeBuilds, installAsyncPipelines, installLazyDispose, liveFrame } from '@pascal-realism/warm'\n",
      "import { installAsyncNodeBuilds, installAsyncPipelines, installLazyDispose, liveFrame, outlineWarmFrame } from '@pascal-realism/warm'\n",
    ],
    [
      'liveFrame(scene, () => pipeline.render())',
      'liveFrame(scene, () => outlineWarmFrame(renderer, useViewer.getState().outliner, hoverStrength, () => pipeline.render()))',
    ],
  ],
};
