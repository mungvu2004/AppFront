/**
 * Gói 1 (review2, `qa-results/editor-realism/review2/`): kính, đèn đồ, lọc dị hướng.
 * - Kính `preset-glass` (lan can ban công = tường thấp, vách kính tắm, cửa sổ mặc định): xanh trời
 *   #87ceeb + metalness 0.1 ra "bể cá" → gần trắng, metalness 0, trong hơn. Vẫn FrontSide, vẫn dưới
 *   ngưỡng fresnel 0.6 của `materials.ts`.
 * - Đèn đồ: cường độ/tầm qua `@pascal-realism/itemLights` (cờ materials).
 * - Ảnh vật liệu thư viện: anisotropy 8 → sàn nhìn xiên hết nhoè (gần như không tốn).
 */
const GLASS = "'#eef4f4'";
const ITEM_LIGHT_IMPORT = "import { itemLightDistance, itemLightIntensity } from '@pascal-realism/itemLights'\n";

export const RULES = {
  'core/src/material-library.ts': [
    [
      "        color: '#87ceeb',\n        roughness: 0.1,\n        metalness: 0.1,",
      `        color: ${GLASS},\n        roughness: 0.05,\n        metalness: 0,`,
    ],
    ["    previewColor: '#87ceeb',", `    previewColor: ${GLASS},`],
    ['        side: 0,\n        opacity: 0.3,', '        side: 0,\n        opacity: 0.15,'],
  ],
  'core/src/procedural-items/library-colors.ts': [
    ["glass: [{ ref: 'library:preset-glass', color: '#87ceeb' }],", `glass: [{ ref: 'library:preset-glass', color: ${GLASS} }],`],
  ],
  'viewer/src/lib/materials.ts': [
    ["    color: '#87ceeb',\n    opacity: 0.3,", `    color: ${GLASS},\n    opacity: 0.15,`],
    ['          roughness: 0.1,\n          metalness: 0.1,', '          roughness: 0.05,\n          metalness: 0,'],
    ['  texture.flipY = props.flipY\n', '  texture.flipY = props.flipY\n  texture.anisotropy = 8\n'],
  ],
  'viewer/src/systems/item-light/item-light-system.tsx': [
    ["\nimport useViewer from '../../store/use-viewer'\n", "\nimport useViewer from '../../store/use-viewer'\n" + ITEM_LIGHT_IMPORT],
    ['light.distance = reg.distance\n', 'light.distance = itemLightDistance(reg.distance)\n', 2],
    ['? reg.getIntensity() : 0', '? itemLightIntensity(reg.getIntensity()) : 0'],
  ],
  'viewer/src/components/viewer/glb-interactive.tsx': [
    ["\nimport useViewer from '../../store/use-viewer'\n", "\nimport useViewer from '../../store/use-viewer'\n" + ITEM_LIGHT_IMPORT],
    ['light.distance = reg.distance\n', 'light.distance = itemLightDistance(reg.distance)\n', 2],
    ['? reg.getIntensity() : 0', '? itemLightIntensity(reg.getIntensity()) : 0'],
  ],
};
