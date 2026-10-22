/**
 * R2 (GĐ2): đứng yên thì ngừng vẽ. Logic ở `src/pascal-page/realism/idle.ts`.
 * useFrame priority 1 của post-processing là chỗ vẽ DUY NHẤT (R3F tự tắt render khi có
 * subscriber priority>0) — cả nhánh pipeline lẫn nhánh fallback `renderer.render` nằm sau neo.
 */
export const RULES = {
  'viewer/src/components/viewer/post-processing.tsx': [
    [
      "import { isLiveFrameHeld } from '../../lib/live-frame-hold'\n",
      "import { isLiveFrameHeld } from '../../lib/live-frame-hold'\n" +
        "import { useInteractive as useInteractiveR2, useScene as useSceneR2 } from '@pascal-app/core'\n" +
        "import { DefaultLoadingManager as LoadingManagerR2 } from 'three'\n" +
        "import { installIdleSources, markDirty, pollDirty, shouldDraw, storeDirty, THEME_HOLD_MS } from '@pascal-realism/idle'\n" +
        "installIdleSources(LoadingManagerR2)\n" +
        "useSceneR2.subscribe(storeDirty('scene'))\n" +
        "useViewer.subscribe(storeDirty('viewer', THEME_HOLD_MS))\n" +
        "useInteractiveR2.subscribe(storeDirty('interactive'))\n",
    ],
    // Chụp ảnh giữ khung (có thể vẽ đè lên canvas) → giữ bẩn để khi thả ra vẽ lại khung sống.
    [
      '    if (isLiveFrameHeld()) return\n',
      "    if (isLiveFrameHeld()) {\n      markDirty('capture-hold')\n      return\n    }\n",
    ],
    [
      "        // A failed empty draw changes nothing — systems keep ticking.\n      }\n      return\n    }\n",
      "        // A failed empty draw changes nothing — systems keep ticking.\n      }\n      return\n    }\n\n" +
        "    // R2 editor-realism: đứng yên (sau khung tích luỹ) → giữ khung cuối, không vẽ.\n" +
        // Không vẽ thì renderer không cập nhật matrixWorld → tự cập nhật để thấy camera đổi.
        "    camera.updateMatrixWorld()\n" +
        // Cửa/cửa sổ/giếng trời đang mở-đóng (systems đổi mesh qua nhiều khung). ponytail: `dirtyNodes.size>0`
        // bị bỏ vì F1 có nút bẩn mãi (vẽ hoài) — nút bẩn đi kèm đổi store nên `storeDirty('scene')` đã phủ phần lớn.
        '    const iaR2 = useInteractiveR2.getState()\n' +
        "    if (Object.keys(iaR2.doorAnimations).length + Object.keys(iaR2.windowAnimations).length + Object.keys(iaR2.skylightAnimations).length > 0) markDirty('animation')\n" +
        "    pollDirty(camera, useViewer.getState().outliner, size.width, size.height)\n" +
        "    if (!shouldDraw()) return\n",
    ],
  ],
  // `?perf`: lộ mẫu GPU timestamp (`gpu-render`, ms) ra `window.__pascalPerf` cho bộ đo (≤600 mẫu gần nhất).
  'viewer/src/lib/perf-tracks.ts': [
    [
      'export function recordPerfSample(track: string, ms: number): void {\n  if (!PERF_OVERLAY_ENABLED) return\n',
      'export function recordPerfSample(track: string, ms: number): void {\n  if (!PERF_OVERLAY_ENABLED) return\n' +
        "  if (track === 'gpu-render' && typeof window !== 'undefined') {\n" +
        '    const buf = ((window as any).__pascalPerf ??= []) as number[]\n' +
        '    buf.push(ms)\n' +
        '    if (buf.length > 600) buf.splice(0, buf.length - 600)\n' +
        '  }\n',
    ],
  ],
};
