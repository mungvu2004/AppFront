/**
 * U44: thanh nổi của vật đang chọn (một vật và nhiều vật) hết nhảy khi xoay/zoom. Giữ thanh trong cửa sổ ngay trong khung camera đổi,
 * thay vì chờ nhịp 200 ms của `useClampActionBars`. Logic và số đo: `src/pascal-page/upstream/lib/clamp-bar.ts`.
 * Ưu tiên 0.5: sau mọi useFrame ưu tiên 0 (drei <Html> đặt vị trí, camera), trước lượt vẽ ưu tiên 1.
 */
export const RULES = {
  'editor/src/components/editor/floating-action-menu.tsx': [
    [
      "import { NodeActionMenu } from './node-action-menu'\n",
      "import { NodeActionMenu } from './node-action-menu'\nimport { clampBarsAtAnchor, newBarCache } from '@/pascal-page/upstream/lib/clamp-bar'\n",
    ],
    [
      '  const handleCurve = useCallback(\n',
      "  const barCacheRef = useRef(newBarCache())\n" +
        "  useFrame((state) => {\n" +
        "    const root = menuScaleRef.current\n" +
        "    const group = groupRef.current\n" +
        "    if (!(root && group && hasAnchorRef.current)) return\n" +
        "    clampBarsAtAnchor(root, group.position, state, getFloatingMenuScale(state.camera, group.position), barCacheRef.current)\n" +
        "  }, 0.5)\n" +
        '  const handleCurve = useCallback(\n',
    ],
  ],
  // Thanh khi chọn nhiều vật: cùng cách, tỉ lệ riêng của thanh này (dải 0,6–1,4) nên giữ lại từ useFrame có sẵn.
  'editor/src/components/editor/group-floating-action-menu.tsx': [
    [
      "import { NodeActionMenu } from './node-action-menu'\n",
      "import { NodeActionMenu } from './node-action-menu'\nimport { clampBarsAtAnchor, newBarCache } from '@/pascal-page/upstream/lib/clamp-bar'\n",
    ],
    [
      "    menuScaleRef.current.style.transform = `scale(${scale})`\n  })\n",
      "    menuScaleRef.current.style.transform = `scale(${scale})`\n" +
        "    barScaleRef.current = scale\n" +
        "  })\n" +
        "  const barScaleRef = useRef(1)\n" +
        "  const barCacheRef = useRef(newBarCache())\n" +
        "  useFrame((state) => {\n" +
        "    const root = menuScaleRef.current\n" +
        "    const group = groupRef.current\n" +
        "    if (root && group) clampBarsAtAnchor(root, group.position, state, barScaleRef.current, barCacheRef.current)\n" +
        "  }, 0.5)\n",
    ],
  ],
};
