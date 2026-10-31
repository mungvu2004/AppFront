/**
 * S5 (render-look B): AO rẻ khi SSGI tắt + AO chỉ làm tối phần gián tiếp (`@pascal-realism/ao`).
 * - Mức `low` (iGPU) tắt SSGI → trước đây không có AO nào. Nay: GTAO của three (nửa độ phân giải, 6 mẫu),
 *   ghép như nhánh SSGI (mờ dần ở xa như `aoFarFade`). Cần MRT pháp tuyến + albedo → `needsNormalMRT` gồm GTAO.
 *   WebGL2 không dựng chuỗi hậu kỳ (`isWebGpuBackend`) → không AO, như cũ. Dựng GTAO lỗi → bỏ AO, giữ chuỗi.
 * - Cả hai nhánh: `scene * ao` → `scene * aoIndirect(ao, scene, albedo)` — chỗ nắng/đèn trực tiếp không bị AO làm tối.
 * Tên tệp `r10-` xếp ngay sau `r1-backend` (sắp theo chuỗi): neo lấy từ mã sau `pascal-render` + r1, các luật sau
 * (r3-traa…) không neo vào dòng nào bị đổi ở đây (chỉ chèn thêm, giữ nguyên chuỗi neo).
 */
const PP = 'viewer/src/components/viewer/post-processing.tsx';
const ATMO = "import { useSceneAtmosphere } from './scene-atmosphere'";
const INK = '\n      // Screen-space ink outline (SketchUp look)';

const IMPORTS = [
  "import { ao as gtao } from 'three/addons/tsl/display/GTAONode.js'",
  "import { GTAO_POW, GTAO_RADIUS_M, GTAO_RESOLUTION_SCALE, GTAO_SAMPLES, GTAO_THICKNESS_M, aoIndirect, gtaoOn } from '@pascal-realism/ao'",
].join('\n');

const GTAO_BRANCH = `
      if (gtaoEnabled && scenePassDepth && sceneNormal) {
        // S5: SSGI tắt (mức low) → GTAO nửa độ phân giải, chỉ làm tối phần gián tiếp (\`@pascal-realism/ao\`).
        try {
          const aoAlbedoTexture = scenePass.getTexture('diffuseColor')
          aoAlbedoTexture.type = UnsignedByteType
          const aoAlbedo = scenePass.getTextureNode('diffuseColor')
          const gtaoPass = gtao(scenePassDepth, sceneNormal, camera as any) as any
          resources.passes.push(gtaoPass)
          gtaoPass.resolutionScale = GTAO_RESOLUTION_SCALE
          gtaoPass.samples.value = GTAO_SAMPLES
          gtaoPass.radius.value = GTAO_RADIUS_M
          gtaoPass.thickness.value = GTAO_THICKNESS_M
          // Cùng cửa sổ mờ xa như aoFarFade của nhánh SSGI (không viền AO ở chân trời).
          const lowAo = mix(
            gtaoPass.getTextureNode().r.pow(tslFloat(GTAO_POW)),
            tslFloat(1),
            smoothstep(tslFloat(0.9994), tslFloat(0.9998), scenePassDepth.sample(screenUV).r),
          )
          sceneColor = vec4(
            add(scenePassColor.rgb.mul(aoIndirect(lowAo, scenePassColor.rgb, aoAlbedo.rgb)), zonePass.rgb),
            contentAlpha,
          ) as unknown as ReturnType<typeof vec4>
        } catch (error) {
          console.warn('[viewer/post-processing] GTAO unavailable, rendering without AO', error)
        }
      }
`;

export const RULES = {
  [PP]: [
    [ATMO, `${ATMO}\n${IMPORTS}`],
    [
      '    const needsNormalMRT = ssgiEnabled || inkEnabled\n',
      '    const gtaoEnabled = gtaoOn(shading, ssgiEnabled)\n    const needsNormalMRT = ssgiEnabled || inkEnabled || gtaoEnabled\n',
    ],
    [
      'add(scenePassColor.rgb.mul(ao), add(zonePass.rgb, scenePassDiffuse.rgb.mul(gi)))',
      'add(scenePassColor.rgb.mul(aoIndirect(ao, scenePassColor.rgb, scenePassDiffuse.rgb)), add(zonePass.rgb, scenePassDiffuse.rgb.mul(gi)))',
    ],
    [INK, `${GTAO_BRANCH}${INK}`],
  ],
};
