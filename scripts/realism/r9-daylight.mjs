/**
 * Gói 2B — nắng Ban ngày/Nắng chiều + mặt đất. Logic ở `src/pascal-page/realism/daylight.ts`.
 * - `lights.tsx`: mỗi khung bật/tắt `castShadow` của trần (chỉ khi camera dưới trần, chủ đề sáng,
 *   mức Vừa/Cao) → nắng chỉ lọt qua cửa sổ. PCF bán kính 2 → 3 cho mép bóng mềm hơn (cùng số mẫu).
 * - `site/renderer.tsx`: tấm site + đĩa chân trời chủ đề sáng theo mặt đất chọn ở thẻ Ánh sáng
 *   (trơn sáng mặc định / sỏi / cỏ) thay màu be phẳng.
 */
export const RULES = {
  'viewer/src/components/viewer/lights.tsx': [
    [
      "import { useSceneAtmosphere } from './scene-atmosphere'",
      "import { useSceneAtmosphere } from './scene-atmosphere'\nimport { syncCeilingShadows } from '@pascal-realism/daylight'",
    ],
    [
      '    if (shadows) {\n      const now = state.clock.elapsedTime',
      '    if (shadows) {\n      syncCeilingShadows(sceneRegistry as any, state.camera.position.y, theme.appearance)\n      const now = state.clock.elapsedTime',
    ],
    ['shadow-radius={2}', 'shadow-radius={3}'],
  ],
  'nodes/src/site/renderer.tsx': [
    [
      "import { useEffect, useMemo, useRef } from 'react'",
      "import { useEffect, useMemo, useRef } from 'react'\nimport { groundAlbedo, useGroundMode } from '@pascal-realism/daylight'",
    ],
    [
      '  const appearance = useViewer((state) => getSceneTheme(state.sceneTheme).appearance)\n',
      '  const appearance = useViewer((state) => getSceneTheme(state.sceneTheme).appearance)\n  const groundMode = useGroundMode()\n',
    ],
    [
      '    material.polygonOffsetUnits = 1\n    return material\n  }, [bgColor])',
      '    material.polygonOffsetUnits = 1\n    material.colorNode = groundAlbedo(bgColor, appearance, groundMode) as any\n    return material\n  }, [bgColor, appearance, groundMode])',
    ],
    [
      "material.colorNode = mix(color(bgColor), color('#000000'), fade).mul(haloFactor)",
      "material.colorNode = mix(groundAlbedo(bgColor, appearance, groundMode) as any, color('#000000'), fade).mul(haloFactor)",
    ],
    ['    appearance,\n    maxLightIntensity,\n    fadeBounds,\n', '    appearance,\n    groundMode,\n    maxLightIntensity,\n    fadeBounds,\n'],
  ],
};
