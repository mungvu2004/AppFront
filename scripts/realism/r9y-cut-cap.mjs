/**
 * Đổi chế độ tường không dựng lại vật liệu tường (bench Cắt ↔ Đầy đủ ~20 s):
 * - Vật liệu tường thấy được (`visible`, cả lưới gộp dùng chung) vá nắp cắt MỘT LẦN lúc tạo
 *   (`capCutMaterial` trong `@pascal-realism/cutSync`): hai mặt cố định, tô nắp theo uniform `cutOn`.
 *   Trước đây `cutSync` đổi colorNode/side + needsUpdate mỗi lần vào/ra Cắt.
 * - Lưới gộp tường khi chế độ `down`/`translucent`/cô lập: ẩn (visible=false) thay vì huỷ rồi gộp lại;
 *   quay về thì hiện lại tầng nào không cũ (tầng có tường đổi trong lúc đó vẫn gộp lại như vendor).
 */
export const RULES = {
  'viewer/src/systems/wall/wall-materials.ts': [
    [
      "import { MeshLambertNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'\n",
      "import { MeshLambertNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'\nimport { capCutMaterial } from '@pascal-realism/cutSync'\n",
    ],
    ['  const result: WallMaterials = {\n', '  visible.forEach((material) => capCutMaterial(material))\n  const result: WallMaterials = {\n'],
  ],
  'nodes/src/wall/wall-batch-system.tsx': [
    [
      'export function holdBatchedWallsAfterCapture(): void {\n',
      'export function holdBatchedWallsAfterCapture(): void {\n  // Lưới gộp đang ẩn (chế độ tạm dừng gộp): tường tự vẽ, đừng giấu lại.\n  if (batchingSuspended) return\n',
    ],
    [
      `    batchingSuspended = suspended
    for (const levelId of [...batchesByLevel.keys()]) disposeLevelBatches(levelId)
    staleLevels.clear()
    if (!suspended) {
      for (const levelId of sceneRegistry.byType.level ?? EMPTY_IDS) staleLevels.add(levelId)
    }
    changed = true
  }
  if (batchingSuspended) {
    staleLevels.clear()
    return
  }
`,
      `    batchingSuspended = suspended
    // Ẩn/hiện lưới gộp thay vì huỷ + gộp lại: đổi chế độ tường không đổi hình tường (chỉ đổi vật liệu).
    for (const [levelId, records] of [...batchesByLevel]) {
      if (!suspended && staleLevels.has(levelId)) {
        disposeLevelBatches(levelId)
        continue
      }
      for (const record of records) {
        record.mesh.visible = !suspended
        for (const nodeId of record.nodeIds) {
          const mesh = batchByNode.get(nodeId) === record ? sceneRegistry.nodes.get(nodeId) : undefined
          if (!mesh) continue
          if (suspended) revealBatchedWall(mesh)
          else hideBatchedWall(mesh)
        }
      }
    }
    if (!suspended) {
      for (const levelId of sceneRegistry.byType.level ?? EMPTY_IDS) {
        if (!batchesByLevel.has(levelId)) staleLevels.add(levelId)
      }
    }
    changed = true
  }
  // Giữ staleLevels khi tạm dừng: tầng có tường đổi trong lúc đó được gộp lại khi quay về.
  if (batchingSuspended) return
`,
    ],
  ],
};
