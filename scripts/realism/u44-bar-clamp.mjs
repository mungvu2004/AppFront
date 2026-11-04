/**
 * U44: thanh nổi của vật đang chọn hết nhảy khi xoay/zoom. Giữ thanh trong cửa sổ ngay trong khung camera đổi,
 * thay vì chờ nhịp 200 ms của `useClampActionBars`. Logic và số đo: `src/pascal-page/upstream/lib/clamp-bar.ts`.
 * Ưu tiên 0.5: sau mọi useFrame ưu tiên 0 (drei <Html> đặt vị trí, camera), trước lượt vẽ ưu tiên 1.
 */
export const RULES = {
  'editor/src/components/editor/floating-action-menu.tsx': [
    [
      "// Pooled scratch for the per-frame anchor recompute (see useFrame below) so a\n",
      "const _barAnchor = new THREE.Vector3()\n// Pooled scratch for the per-frame anchor recompute (see useFrame below) so a\n",
    ],
    [
      "import { NodeActionMenu } from './node-action-menu'\n",
      "import { NodeActionMenu } from './node-action-menu'\nimport { clampBarsInFrame, newBarCache } from '@/pascal-page/upstream/lib/clamp-bar'\n",
    ],
    [
      '  const handleCurve = useCallback(\n',
      "  const barCacheRef = useRef(newBarCache())\n" +
        "  useFrame((state) => {\n" +
        "    const root = menuScaleRef.current\n" +
        "    const group = groupRef.current\n" +
        "    if (!(root && group && hasAnchorRef.current)) return\n" +
        "    const scale = getFloatingMenuScale(state.camera, group.position)\n" +
        "    _barAnchor.copy(group.position).project(state.camera)\n" +
        "    if (_barAnchor.z > 1) return\n" +
        "    const cx = ((_barAnchor.x + 1) / 2) * state.size.width + state.size.left\n" +
        "    const cy = ((1 - _barAnchor.y) / 2) * state.size.height + state.size.top\n" +
        "    clampBarsInFrame(root, cx, cy, scale, barCacheRef.current)\n" +
        "  }, 0.5)\n" +
        '  const handleCurve = useCallback(\n',
    ],
  ],
};
