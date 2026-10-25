/**
 * Ánh sáng cửa sổ Ban ngày (mức Vừa/Cao). Logic ở `src/pascal-page/realism/windowLight.ts`.
 * - `lights.tsx`: mỗi khung đặt pool PointLight ở các cửa sổ gần camera; ambient/hemi đích nhân
 *   `windowAmbientScale` (1 khi tắt) cho độ tương phản gần–xa cửa.
 */
export const RULES = {
  'viewer/src/components/viewer/lights.tsx': [
    [
      "import { useSceneAtmosphere } from './scene-atmosphere'",
      "import { useSceneAtmosphere } from './scene-atmosphere'\nimport { syncWindowLights, windowAmbientScale } from '@pascal-realism/windowLight'",
      1,
    ],
    [
      '    const hemiIntensity = atmosphere ? atmosphere.hemisphereIntensity : theme.hemi?.intensity\n',
      '    const fillScale = windowAmbientScale(sceneTheme, theme.appearance)\n    const hemiIntensity = (atmosphere ? atmosphere.hemisphereIntensity : theme.hemi?.intensity) === undefined ? undefined : (atmosphere ? atmosphere.hemisphereIntensity : theme.hemi!.intensity) * fillScale\n',
      1,
    ],
    [
      '      const ambientIntensity = atmosphere ? atmosphere.ambientIntensity : theme.ambient.intensity\n',
      '      const ambientIntensity = (atmosphere ? atmosphere.ambientIntensity : theme.ambient.intensity) * fillScale\n',
      1,
    ],
    [
      '    initialized.current = true\n  }, -1)',
      '    syncWindowLights(sceneRegistry as any, state.scene, state.camera, sceneTheme, theme.appearance, hemiRef.current)\n    initialized.current = true\n  }, -1)',
      1,
    ],
  ],
};
