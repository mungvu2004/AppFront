/**
 * Chân trời: đĩa chân trời của `site/renderer.tsx` tan vào phông theo cả khoảng cách camera
 * (sương mù chỉ cho đất, ngoài khu đất) + sỏi/cỏ xa giảm tương phản. Logic ở
 * `src/pascal-page/realism/horizon.ts`. Chạy sau `r9-daylight.mjs` (vá trên dòng nó đã sửa).
 */
export const RULES = {
  'nodes/src/site/renderer.tsx': [
    [
      "import { groundAlbedo, useGroundMode } from '@pascal-realism/daylight'",
      "import { groundAlbedo, useGroundMode } from '@pascal-realism/daylight'\nimport { farGround, horizonFade, useHorizonTier } from '@pascal-realism/horizon'",
      1,
    ],
    [
      '  const groundMode = useGroundMode()\n',
      '  const groundMode = useGroundMode()\n  const lowTier = useHorizonTier()\n',
      1,
    ],
    [
      '    material.colorNode = groundAlbedo(bgColor, appearance, groundMode) as any\n    return material\n  }, [bgColor, appearance, groundMode])',
      '    material.colorNode = farGround(groundAlbedo(bgColor, appearance, groundMode) as any, appearance, groundMode) as any\n    return material\n  }, [bgColor, appearance, groundMode, lowTier])',
      1,
    ],
    [
      '    const fade = smoothstep(\n      tslFloat(fadeBounds.radius * 1.05),\n      tslFloat(fadeBounds.radius * 5),\n      dist,\n    )',
      '    const fade = horizonFade(\n      smoothstep(tslFloat(fadeBounds.radius * 1.05), tslFloat(fadeBounds.radius * 5), dist) as any,\n      dist as any,\n      fadeBounds.radius,\n    ) as any',
      1,
    ],
    [
      "material.colorNode = mix(groundAlbedo(bgColor, appearance, groundMode) as any, color('#000000'), fade)",
      "material.colorNode = mix(farGround(groundAlbedo(bgColor, appearance, groundMode) as any, appearance, groundMode) as any, color('#000000'), fade)",
      1,
    ],
    // Vệt tối quanh khu đất làm đĩa ở mép tấm site tối hơn tấm tới 45 % → mép tấm cắt cứng
    // (khu đất AppFront sát nhà). Bỏ vệt: đĩa nối liền tấm; bóng + AO đã cho nhà "đứng".
    ['    const vignetteStrength = Math.min(0.45, 0.13 * maxLightIntensity)\n', '    const vignetteStrength = 0 * maxLightIntensity\n', 1],
    ['    groundMode,\n    maxLightIntensity,\n','    groundMode,\n    lowTier,\n    maxLightIntensity,\n', 1],
  ],
};
