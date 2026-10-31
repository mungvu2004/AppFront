/**
 * S2 — sàn đúng cỡ thật: mọi `library:<id>` đi qua `createMaterialFromPresetRef` được
 * `@pascal-realism/floorFinish` chỉnh (chỉ các id trong `FLOOR_FINISHES`, cờ `materials`):
 * repeat = 1 / cạnh thật, normal nhẹ (preset sao chép → khoá cache vendor riêng), rồi colorNode
 * đổi tông theo bảng màu giữ vân ảnh + ron mảnh cho đá lát.
 */
export const RULES = {
  'viewer/src/lib/materials.ts': [
    [
      "import { stampPascalTextureRef } from './texture-reference'\n",
      "import { stampPascalTextureRef } from './texture-reference'\nimport { floorFinishPreset, tuneFloorFinish } from '@pascal-realism/floorFinish'\n",
    ],
    [
      '  if (!preset) return null\n  return createMaterialFromPreset(preset, shading)\n',
      '  if (!preset) return null\n  return tuneFloorFinish(materialPreset, createMaterialFromPreset(floorFinishPreset(materialPreset, preset), shading))\n',
    ],
  ],
};
