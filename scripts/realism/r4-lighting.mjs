/**
 * R4 (GĐ4) ánh sáng. Logic ở `src/pascal-page/realism/lighting*.ts`.
 * - `scene-environment.tsx` (neo là chuỗi SAU `pascal-render.mjs`): chủ đề sáng nhận HDRI tự host.
 * - `scene-themes.ts` chủ đề `sunset` → preset "Nắng chiều": mặt trời ~15° (22, 6.3, 8), ấm hơn.
 */
export const RULES = {
  'viewer/src/components/viewer/scene-environment.tsx': [
    [
      "import { useSceneAtmosphere } from './scene-atmosphere'",
      "import { useSceneAtmosphere } from './scene-atmosphere'\nimport { installHdri } from '@pascal-realism/lighting-hdri'",
    ],
    [
      '  useEffect(() => {\n    // An atmosphere owns environmentIntensity',
      '  // R4: HDRI tự host (chỉ chủ đề sáng + WebGPU + cờ hdri), đặt đè sau khi tải xong; gói 2B: HDRI theo chủ đề.\n  const realismThemeId = useViewer((state) => state.sceneTheme)\n  useEffect(() => installHdri(scene, appearance, realismThemeId), [scene, texture, appearance, realismThemeId])\n\n  useEffect(() => {\n    // An atmosphere owns environmentIntensity',
    ],
  ],
  'viewer/src/lib/scene-themes.ts': [
    [
      "{ position: [22, 8, 8], color: '#ffb070', intensity: 3.4, castShadow: true }",
      "{ position: [22, 6.3, 8], color: '#ff9a52', intensity: 3.6, castShadow: true }",
    ],
  ],
};
