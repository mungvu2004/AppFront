/**
 * S4 lights (render look B). Logic ở `src/pascal-page/realism/roomLights.ts`.
 * - `lights.tsx`: mỗi khung đặt `shadow.radius` của đèn chính theo bề rộng khung bóng (PCF; three 0.186 đã
 *   bỏ PCFSoftShadowMap, VSM lọt sáng qua tường) → nửa tối ~10 cm ngoài đời.
 * - `lights.tsx`: Buổi tối + Rendered + mức Vừa/Cao: một PointLight ấm mỗi phòng (pool 12, không bóng).
 * Tên `r10-…` xếp TRƯỚC `r3t`/`r9*` (so chuỗi): neo dưới là văn bản gốc, giữ nguyên để luật sau còn khớp.
 */
export const RULES = {
  'viewer/src/components/viewer/lights.tsx': [
    [
      "import { sceneRegistry } from '@pascal-app/core'\n",
      "import { sceneRegistry, useScene } from '@pascal-app/core'\nimport { keyShadowRadius, syncRoomLights } from '@pascal-realism/roomLights'\n",
      1,
    ],
    [
      '          cam.updateProjectionMatrix()\n',
      '          cam.updateProjectionMatrix()\n          light.shadow.radius = keyShadowRadius(size, light.shadow.mapSize.x)\n',
      1,
    ],
    [
      '    if (ambientRef.current) {\n',
      '    syncRoomLights(sceneRegistry as any, useScene.getState().nodes as any, state.scene, sceneTheme, useViewer.getState().shading)\n    if (ambientRef.current) {\n',
      1,
    ],
  ],
};
