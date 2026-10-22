/**
 * R3T: mức chất lượng (low/medium/high) + mất thiết bị. Logic ở `src/pascal-page/realism/tiers.ts`.
 * - post-processing: low = tắt SSGI lúc dựng (như ?disable=ao); postFx:false thì không dựng hậu kỳ (đổi tên prop disablePostFx), SSGI đọc `tierSsgi(tier, SSGI_PARAMS)`,
 *   effect dựng pipeline phụ thuộc `realismTier` để dựng lại khi đổi mức.
 * - index: chọn mức khởi đầu khi renderer có, DPR tối đa theo mức, mất thiết bị → low + dựng lại canvas (key).
 * - lights: cỡ bóng theo mức (neo trên chuỗi đã qua pascal-render: 2048).
 */
const IMPORT = "import { currentTier, initTier, onDeviceLost, tierConfig, tierSsgi, useDeviceEpoch, useTier } from '@pascal-realism/tiers'";

const GI_KEYS = [
  'sliceCount',
  'stepCount',
  'radius',
  'expFactor',
  'thickness',
  'backfaceLighting',
  'aoIntensity',
  'giIntensity',
  'useLinearThickness',
  'useScreenSpaceSampling',
];

export const RULES = {
  'viewer/src/components/viewer/post-processing.tsx': [
    ["import { getSceneTheme } from '../../lib/scene-themes'", `import { getSceneTheme } from '../../lib/scene-themes'\n${IMPORT}`],
    // low: SSGI (+ denoise) off at pipeline build, like `?disable=ao` (outline/hover stay).
    ["    ao: set.has('ao'),\n", "    ao: set.has('ao') || !tierConfig(currentTier()).ssgiOn,\n"],
    ['  disablePostFx = false,\n', '  disablePostFx: disablePostFxProp = false,\n'],
    [
      '  const lastProjectIdRef = useRef(projectId)\n',
      "  const realismTier = useTier()\n  const disablePostFx = disablePostFxProp || !tierConfig(realismTier).postFx\n  const lastProjectIdRef = useRef(projectId)\n",
    ],
    ...GI_KEYS.map((k) => [`giPass.${k}.value = SSGI_PARAMS.${k}\n`, `giPass.${k}.value = tierSsgi(realismTier, SSGI_PARAMS).${k}\n`]),
    ['    overlayLayers,\n  ])\n', '    overlayLayers,\n    realismTier,\n  ])\n'],
  ],
  'viewer/src/components/viewer/index.tsx': [
    ["import { UnsupportedGpuViewerFallback } from './unsupported-gpu-fallback'", `import { UnsupportedGpuViewerFallback } from './unsupported-gpu-fallback'\n${IMPORT}`],
    ['    const backend = (gl as any).backend\n', '    initTier(gl)\n    const backend = (gl as any).backend\n'],
    [
      "          'The page must be reloaded to recover the GPU context.',\n      )\n",
      "          'The page must be reloaded to recover the GPU context.',\n      )\n      onDeviceLost(info)\n",
    ],
    [
      '  const shadowsEnabled = useViewer((state) => state.shadows)\n',
      '  const shadowsEnabled = useViewer((state) => state.shadows)\n  const realismTier = useTier()\n  const realismEpoch = useDeviceEpoch((s) => s.epoch)\n',
    ],
    [
      "window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5",
      "window.matchMedia('(pointer: coarse)').matches ? Math.min(1.25, tierConfig(realismTier).dprMax) : tierConfig(realismTier).dprMax",
    ],
    ["key={immersiveActive ? 'webgl-xr' : 'webgpu'}", "key={immersiveActive ? 'webgl-xr' : `webgpu-${realismEpoch}`}"],
  ],
  'viewer/src/components/viewer/lights.tsx': [
    ["import { SHADOW_ONLY_LAYER } from '../../lib/layers'", `import { SHADOW_ONLY_LAYER } from '../../lib/layers'\n${IMPORT}`],
    [
      '  const shadows = useViewer((state) => state.shadows)\n',
      '  const shadows = useViewer((state) => state.shadows)\n  const realismShadow = tierConfig(useTier()).shadow\n',
    ],
    ['shadow-mapSize={[2048, 2048]}', 'shadow-mapSize={[realismShadow, realismShadow]}'],
  ],
};
