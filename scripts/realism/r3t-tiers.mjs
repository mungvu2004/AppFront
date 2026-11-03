/**
 * R3T: mức chất lượng (low/medium/high) + mất thiết bị. Logic ở `src/pascal-page/realism/tiers.ts`.
 * - post-processing: low = tắt SSGI lúc dựng (như ?disable=ao); postFx:false thì không dựng hậu kỳ (đổi tên prop disablePostFx), SSGI đọc `tierSsgi(tier, SSGI_PARAMS)`,
 *   effect dựng pipeline phụ thuộc `realismTier` để dựng lại khi đổi mức.
 * - index: chọn mức khởi đầu khi renderer có, DPR tối đa theo mức, mất thiết bị → low + dựng lại canvas (key).
 * - lights: cỡ bóng theo mức (neo trên chuỗi đã qua pascal-render: 2048).
 * Đổi mức chỉ dựng lại ~13 quad hậu kỳ, KHÔNG dựng lại ~40 vật liệu cảnh (đo 2026-11-04: low↔medium 43 lần dựng nút,
 * ~16-20 s khựng). three 0.186: khoá vật liệu (`RenderObject.getMaterialCacheKey`) gồm `context.id`, `RenderContexts.get`
 * khoá context theo `mrt.id`; khoá động gồm `shadowMap.enabled` và `light.castShadow`. Nên:
 * - post-processing: MỘT nút MRT dùng chung cho mọi lần dựng pipeline (`sceneMrt`), không `mrt({...})` mới mỗi lần.
 * - Mọi thứ vào khoá vật liệu/context chọn MỘT lần theo `sceneTier()` (mức lúc tải trang, `tiers.ts`): khử răng cưa
 *   (TRAA + velocity hay MSAA, `traaEnabled`), tập MRT, `shadowMap.enabled`, bộ đèn. Đổi mức giữa phiên chỉ đổi DPR,
 *   quad hậu kỳ, SSGI/GTAO (chỉ khi scene pass đã có MRT cho chúng). Tải ở low = MSAA, không MRT, không bóng (low
 *   nhanh như cũ); tải ở medium rồi hạ low = giữ TRAA/MRT, tắt SSGI/GTAO, đèn chính `shadow.intensity = 0` +
 *   `shadow.autoUpdate = false` (bỏ pass bóng, nhìn như không bóng). Low đầy đủ áp ở lần mở sau (autoTier đã lưu).
 */
const IMPORT = "import { currentTier, initTier, onDeviceLost, sceneTier, tierConfig, tierSsgi, useDeviceEpoch, useTier } from '@pascal-realism/tiers'";

// Một nút MRT cho mọi pipeline: nút mới = `mrt.id` mới = context mới = dựng lại mọi vật liệu cảnh.
const SCENE_MRT = `const SCENE_MRTS: Record<string, any> = {}
const sceneMrt = (traaOn: boolean) =>
  (SCENE_MRTS[String(traaOn)] ??= mrt({
    output,
    diffuseColor,
    normal: packNormalToRGB(normalView),
    ...(traaOn ? { velocity } : {}),
  }))
`;

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
    // low: SSGI (+ denoise) off at pipeline build, like `?disable=ao` (outline/hover stay). Tải ở low thì SSGI tắt tới khi
    // mở lại trang (scene pass không có MRT pháp tuyến; bật = đổi MRT = dựng lại mọi vật liệu).
    ["    ao: set.has('ao'),\n", "    ao: set.has('ao') || !tierConfig(currentTier()).ssgiOn || !tierConfig(sceneTier()).ssgiOn,\n"],
    ['  disablePostFx = false,\n', '  disablePostFx: disablePostFxProp = false,\n'],
    [
      '  const lastProjectIdRef = useRef(projectId)\n',
      "  const realismTier = useTier()\n  const disablePostFx = disablePostFxProp || !tierConfig(realismTier).postFx\n  const lastProjectIdRef = useRef(projectId)\n",
    ],
    ...GI_KEYS.map((k) => [`giPass.${k}.value = SSGI_PARAMS.${k}\n`, `giPass.${k}.value = tierSsgi(realismTier, SSGI_PARAMS).${k}\n`]),
    ['    overlayLayers,\n  ])\n', '    overlayLayers,\n    realismTier,\n  ])\n'],
    // MRT bật ở mọi mức khi có AO (SSGI hoặc GTAO); GTAO vẫn tắt ở low (low không AO, như trước).
    [
      '    const gtaoEnabled = gtaoOn(shading, ssgiEnabled, transparentBackground)\n    const needsNormalMRT = ssgiEnabled || inkEnabled || gtaoEnabled\n',
      "    const aoMrt = gtaoOn(shading, ssgiEnabled, transparentBackground)\n    const gtaoEnabled = aoMrt && realismTier !== 'low'\n    const needsNormalMRT = ssgiEnabled || inkEnabled || aoMrt\n",
    ],
    ['const emptyScene = new Scene()\n', `${SCENE_MRT}const emptyScene = new Scene()\n`],
    [
      '        scenePass.setMRT(\n          mrt({\n            output,\n            diffuseColor,\n            normal: packNormalToRGB(normalView),\n            ...(traaOn ? { velocity } : {}),\n          }),\n        )\n',
      '        scenePass.setMRT(sceneMrt(traaOn))\n',
    ],
    // PassNode chỉ tạo đích khi có người xin; low (không SSGI/GTAO) không xin albedo → 3 đích thay vì 4 → khoá
    // context (`count:format:type:samples…`) khác → dựng lại mọi vật liệu. Xin luôn, đúng thứ tự như medium.
    [
      "        normalTexture.type = UnsignedByteType\n      }\n",
      "        normalTexture.type = UnsignedByteType\n        scenePass.getTexture('diffuseColor').type = UnsignedByteType\n      }\n",
    ],
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
    // Bóng ở mức renderer theo mức lúc tải (khoá động của mọi vật liệu có ánh sáng); hạ low giữa phiên: lights.tsx.
    ['          enabled: shadowsEnabled,\n', "          enabled: shadowsEnabled && sceneTier() !== 'low',\n"],
  ],
  'viewer/src/components/viewer/lights.tsx': [
    ["import { SHADOW_ONLY_LAYER } from '../../lib/layers'", `import { SHADOW_ONLY_LAYER } from '../../lib/layers'\n${IMPORT}`],
    [
      '  const shadows = useViewer((state) => state.shadows)\n',
      '  const shadows = useViewer((state) => state.shadows)\n  const realismShadow = tierConfig(useTier()).shadow\n',
    ],
    ['shadow-mapSize={[2048, 2048]}', 'shadow-mapSize={[realismShadow, realismShadow]}'],
    // low: không bóng mà không đổi khoá vật liệu (xem đầu tệp); sau dòng lerp shadow.intensity của đèn chính.
    [
      '            : THREE.MathUtils.lerp(light.shadow.intensity, shadowIntensity, dt)\n      }\n',
      "            : THREE.MathUtils.lerp(light.shadow.intensity, shadowIntensity, dt)\n      }\n      if (index === 0 && light.shadow) {\n        const lowShadow = currentTier() === 'low'\n        if (lowShadow) light.shadow.intensity = 0\n        light.shadow.autoUpdate = !lowShadow\n      }\n",
    ],
  ],
};
