/**
 * R3 (GĐ3): TRAA cho viewport + SSGI lọc theo thời gian + khử nhiễu GI.
 * Cờ `traa` (store realism, `?disable=traa`) tắt → mọi nhánh dưới đây không chạy, đường cũ y nguyên.
 * TRAA nhận ảnh cảnh đã ghép nền (mịn cả mép trời/cảnh); outline + overlay ghép SAU TRAA (không nhoè).
 * ponytail: TRAA chỉ bật khi đã có MRT pháp tuyến (SSGI/ink) và nền không trong suốt (chụp ảnh giữ đường cũ).
 * Không đụng dòng `giPass.*.value = SSGI_PARAMS.*` (R3T) và useFrame (R2).
 */
const PP = 'viewer/src/components/viewer/post-processing.tsx';

export const RULES = {
  [PP]: [
    [
      "import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js'\n",
      "import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js'\nimport { traa } from 'three/examples/jsm/tsl/display/TRAANode.js'\nimport { step, velocity } from 'three/tsl'\nimport { TRAA_AO_DENOISE_RADIUS, TRAA_AO_POW, traaEnabled } from '@pascal-realism/traa'\n",
    ],
    // TRAA thay MSAA: chép depth vào lịch sử cần depth 1 mẫu (MSAA 4 → lỗi CopyTextureToTexture).
    [
      '      const scenePass = pass(scene, camera)\n',
      '      const traaOn = needsNormalMRT && !transparentBackground && traaEnabled()\n      const scenePass = traaOn ? pass(scene, camera, { samples: 0 }) : pass(scene, camera)\n',
    ],
    // velocity vào MRT khi có TRAA.
    [
      '      if (needsNormalMRT) {\n        scenePass.setMRT(\n          mrt({\n            output,\n            diffuseColor,\n            normal: packNormalToRGB(normalView),\n',
      '      if (needsNormalMRT) {\n        scenePass.setMRT(\n          mrt({\n            output,\n            diffuseColor,\n            normal: packNormalToRGB(normalView),\n            ...(traaOn ? { velocity } : {}),\n',
    ],
    // SSGI lọc theo thời gian khi TRAA tích luỹ giúp (đặt trước setup của node).
    [
      '        const aoTexture = (giPass as any).getAONode()\n',
      '        if (traaOn) giPass.useTemporalFiltering = true\n        const aoTexture = (giPass as any).getAONode()\n',
    ],
    // Khử nhiễu GI như AO.
    [
      '        const gi = (giPass as any).getGINode().rgb\n',
      '        const giRaw = (giPass as any).getGINode()\n        const gi = traaOn && denoiseEnabled\n          ? (denoise(vec4(giRaw.rgb, tslFloat(1)), scenePassDepth, sceneNormal, camera) as any).rgb\n          : giRaw.rgb\n',
    ],
    // TRAA trên cảnh + nền; outline cộng lại sau TRAA (cùng mặt nạ contentAlpha như cũ).
    [
      '      const composited = mix(bgGradient, sceneComposite, contentAlpha)\n',
      `      let composited: any = mix(bgGradient, sceneComposite, contentAlpha)
      if (traaOn) {
        const traaPass = traa(
          vec4(mix(bgGradient, sceneColor.rgb, contentAlpha), tslFloat(1)),
          scenePassDepth,
          scenePass.getTextureNode('velocity'),
          camera,
        )
        resources.passes.push(traaPass as any)
        // Q2-01: pixel không hình học (trời) ra đen sau TRAA — chọn nền thẳng, không qua lịch sử.
        composited = mix(
          composited,
          add(traaPass.rgb, sceneComposite.sub(sceneColor.rgb).mul(contentAlpha)),
          step(tslFloat(0.0001), contentAlpha),
        )
      }
`,
    ],
    // F3: AO khi TRAA: denoise AO ban kinh nho hon (giu bong tiep xuc), dam them ao^k.
    [
      '          denoisePass.radius.value = 4\n',
      '          denoisePass.radius.value = traaOn ? TRAA_AO_DENOISE_RADIUS : 4\n',
    ],
    [
      '        // AO is a near/mid-field cue like the ink:',
      '        if (traaOn) ao = ao.pow(tslFloat(TRAA_AO_POW))\n        // AO is a near/mid-field cue like the ink:',
    ],
  ],
};
