/**
 * Mặt trên tường đen (bench-3d, thấy cả trên GPU thật): `wall-system.tsx` đẩy mọi mặt nằm ngang
 * (|normal.y| ≥ eps: nắp trên, đáy) và mặt không gán được mép nào vào nhóm vật liệu 0. Vendor để
 * nhóm 0 là vật liệu vai trò `MeshLambertNodeMaterial`, trong khi các mặt đứng là vật liệu Standard
 * của khe sơn. Lambert chỉ nhận đèn trực tiếp + ambient: `scene.environment` (HDRI — nguồn sáng
 * khuếch tán chính của chế độ realism) qua `BasicEnvironmentNode` chỉ thành phản chiếu, không thành
 * ánh sáng tán xạ, và không đi qua `tuneWallPaint` — nắp tường tối hẳn so với thân tường.
 * Ở đây nhóm 0 dùng chính vật liệu mặt trong của tường (cùng màu sơn, cùng mô hình chiếu sáng).
 * Chế độ tắt texture (`textures=false`) giữ nguyên vai trò như vendor.
 */
export const RULES = {
  'viewer/src/systems/wall/wall-materials.ts': [
    [
      '      ? [\n          wallRoleMaterial,\n',
      "      ? [\n          resolveWallFaceMaterial(wallNode, 'interior', shading, sceneMaterials),\n",
    ],
  ],
};
