/**
 * Studio (dáng ảnh sản phẩm, docs/blender-vs-editor/BAO-CAO.md §5): khi mặt đất = nền trơn,
 * `site/renderer.tsx` vẽ đĩa chân trời KHÔNG chiếu sáng (xám trung tính, hết ngả nâu dưới đèn ấm)
 * + một tấm hứng bóng trong suốt, ẩn tấm site, hạ đất xuống chân một đế vát cạnh dựng dưới sàn
 * tầng thấp nhất. Logic ở `src/pascal-page/realism/studio.ts` + `horizon.ts`.
 * Sỏi/cỏ/địa hình: giữ nguyên đĩa cũ. Chạy TRƯỚC r9-daylight/r9h-horizon (thứ tự tên tệp):
 * mọi chuỗi gốc ở đây là mã gốc vendor mà không luật nào khác viết lại, và không chạm chuỗi gốc của chúng.
 */
const SITE = 'nodes/src/site/renderer.tsx';

const STUDIO_HOOKS = `
  const studio = useStudioGround() && terrainGrid === null
`;

const STUDIO_MEMOS = `
  const studioFootprintCache = useRef<[number, number][][]>([])
  const studioFootprint = useScene((state: S) => {
    const next = lowestLevelSlabs(state.nodes as any)
    if (polygonsMatch(next, studioFootprintCache.current)) return studioFootprintCache.current
    studioFootprintCache.current = next
    return next
  })
  const studioPlinth = useMemo(
    () => (studio && studioFootprint.length > 0 ? studioPlinthGeometry(unionPolygons(studioFootprint)) : null),
    [studio, studioFootprint],
  )
  useEffect(() => () => studioPlinth?.dispose(), [studioPlinth])
  const studioShadow = useMemo(() => (studio ? studioShadowCatcher() : null), [studio])
  useEffect(() => () => studioShadow?.dispose(), [studioShadow])
  const studioPlinthMat = useMemo(() => (studio ? studioPlinthMaterial() : null), [studio])
  useEffect(() => () => studioPlinthMat?.dispose(), [studioPlinthMat])
`;

const STUDIO_MESHES = `
      {/* Studio: tấm hứng bóng trên đĩa đất không chiếu sáng */}
      {studio && !immersiveXR && horizonGeometry && studioShadow && fadeBounds && (
        <mesh
          geometry={horizonGeometry}
          material={studioShadow}
          position={[fadeBounds.cx, STUDIO_GROUND_Y + STUDIO_SHADOW_LIFT_M, fadeBounds.cz]}
          raycast={noopRaycast}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ pascalExport: 'strip' }}
        />
      )}

      {/* Studio: đế vát cạnh dưới sàn tầng thấp nhất */}
      {studioPlinth && studioPlinthMat && (
        <mesh
          castShadow
          geometry={studioPlinth}
          material={studioPlinthMat}
          raycast={noopRaycast}
          receiveShadow
          userData={{ pascalExport: 'strip' }}
        />
      )}
`;

export const RULES = {
  [SITE]: [
    [
      "import { HORIZON_PLANE_Y, terrainFootprint } from './terrain-geometry'",
      "import { HORIZON_PLANE_Y, terrainFootprint } from './terrain-geometry'\n" +
        "import { studioDisc, studioPlinthGeometry, studioPlinthMaterial, studioShadowCatcher, useStudioGround } from '@pascal-realism/horizon'\n" +
        "import { lowestLevelSlabs, STUDIO_GROUND_Y, STUDIO_SHADOW_LIFT_M } from '@pascal-realism/studio'",
      1,
    ],
    ['  const terrainKey = terrainGridKey(terrainGrid)\n', `  const terrainKey = terrainGridKey(terrainGrid)\n${STUDIO_HOOKS}`, 1],
    // Đĩa studio thay vật liệu Lambert (cùng `fade` + `backdrop` của vendor → mép xa vẫn liền phông).
    [
      '    material.polygonOffsetFactor = 2\n    material.polygonOffsetUnits = 2\n    return material\n',
      '    material.polygonOffsetFactor = 2\n    material.polygonOffsetUnits = 2\n    if (studio) return studioDisc(fade as any, backdrop as any)\n    return material\n',
      1,
    ],
    ['    fadeBounds,\n    groundReplaced,\n  ])', '    fadeBounds,\n    groundReplaced,\n    studio,\n  ])', 1],
    [
      '  useEffect(() => () => horizonMaterial?.dispose(), [horizonMaterial])\n',
      `  useEffect(() => () => horizonMaterial?.dispose(), [horizonMaterial])\n${STUDIO_MEMOS}`,
      1,
    ],
    // Studio: đĩa đất hạ xuống chân đế; tấm site (Lambert, nhận màu đèn) ẩn — đĩa có cùng lỗ sàn lõm.
    [
      'position={[fadeBounds.cx, HORIZON_PLANE_Y, fadeBounds.cz]}',
      'position={[fadeBounds.cx, studio ? STUDIO_GROUND_Y : HORIZON_PLANE_Y, fadeBounds.cz]}',
      1,
    ],
    ['{showSiteSurfaces && groundGeometry && !showTerrain && (', '{showSiteSurfaces && groundGeometry && !showTerrain && !studio && ('],
    [
      "          userData={{ pascalExport: 'strip' }}\n        />\n      )}\n",
      `          userData={{ pascalExport: 'strip' }}\n        />\n      )}\n${STUDIO_MESHES}`,
      1,
    ],
  ],
};
