/**
 * Phản chiếu + trời qua kính (bền, mọi vật liệu). Logic ở `src/pascal-page/realism/reflect.ts`.
 * Chạy sau `r9s-sun` (thứ tự tên file).
 * - `post-processing.tsx`: phông trên chân trời lấy HDRI (trước đây chỉ gradient → kính chỉ thấy dải be).
 * - `lights.tsx`: mỗi khung `syncReflectionProbe` — camera đứng yên trong nhà thì chụp PMREM tại chỗ,
 *   gán `envMap` cho vật liệu bóng (gương, inox, kính, sàn bóng).
 */
const ATMO = "import { useSceneAtmosphere } from './scene-atmosphere'";

export const RULES = {
  'viewer/src/components/viewer/post-processing.tsx': [
    [ATMO, `${ATMO}\nimport { hdriBackdrop } from '@pascal-realism/reflect'`, 1],
    [
      "      if (shading === 'rendered') {\n        bgGradient = gradeRgb(bgGradient)",
      "      if (!atmosphere) bgGradient = hdriBackdrop(worldDir, bgGradient)\n      if (shading === 'rendered') {\n        bgGradient = gradeRgb(bgGradient)",
      1,
    ],
  ],
  'viewer/src/components/viewer/lights.tsx': [
    [ATMO, `${ATMO}\nimport { syncReflectionProbe } from '@pascal-realism/reflect'`, 1],
    [
      '    const dt = Math.min(delta, 0.1) * 4\n',
      '    const dt = Math.min(delta, 0.1) * 4\n    syncReflectionProbe(state.gl, state.scene, state.camera as any, sceneRegistry as any)\n',
      1,
    ],
  ],
};
