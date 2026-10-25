/**
 * R1 (GĐ1): backend thật thay `'gpu' in navigator`, ghi vào store realism, gửi telemetry
 * `viewer.backend` + `viewer.device_lost`. Logic ở `src/pascal-page/realism/backend.ts`.
 * Cùng chỗ: `keyShadowGroups` (shadowGroups.ts) tách RenderObject lượt bóng theo group (lỗi buffer destroyed).
 */
const IMPORT = "import { isWebGpuBackend, reportBackend, reportDeviceLost } from '@pascal-realism/backend'";
const IMPORT_SG = "import { keyShadowGroups } from '@pascal-realism/shadowGroups'";

export const RULES = {
  'viewer/src/components/viewer/index.tsx': [
    ["import { ViewerCamera } from './viewer-camera'", `import { ViewerCamera } from './viewer-camera'\n${IMPORT}\n${IMPORT_SG}`],
    // GPUDeviceWatcher: renderer đã init → backend thật vào store.
    ['    ensureKtx2Support(gl)\n', '    ensureKtx2Support(gl)\n    reportBackend(gl)\n    keyShadowGroups(gl)\n'],
    ['    device.lost.then((info: WebGPUDeviceLossInfo) => {\n', '    device.lost.then((info: WebGPUDeviceLossInfo) => {\n      reportDeviceLost(info)\n'],
  ],
  'viewer/src/components/viewer/post-processing.tsx': [
    ["import { useSceneAtmosphere } from './scene-atmosphere'", `import { useSceneAtmosphere } from './scene-atmosphere'\n${IMPORT}`],
    // Có `navigator.gpu` vẫn có thể rơi về WebGL2: hỏi renderer thật.
    ["const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator", 'const hasWebGPU = isWebGpuBackend(renderer)'],
  ],
};
