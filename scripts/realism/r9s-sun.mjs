/**
 * Hướng nắng — xoay đèn chính quanh trục đứng theo thanh trượt của thẻ Ánh sáng.
 * Logic ở `src/pascal-page/realism/sun.ts`. Chạy sau `r9-daylight` (thứ tự tên file).
 * - Có bóng: xoay hướng dùng để đặt đèn quanh tâm nhà (khối khớp khung bóng).
 * - Không bóng: khối trên không đặt vị trí → mỗi khung đặt lại từ `position` của chủ đề rồi xoay.
 */
export const RULES = {
  'viewer/src/components/viewer/lights.tsx': [
    [
      "import { syncCeilingShadows } from '@pascal-realism/daylight'",
      "import { syncCeilingShadows } from '@pascal-realism/daylight'\nimport { rotateSun } from '@pascal-realism/sun'",
      1,
    ],
    ['          shadowDir.current.set(...themeKey.position)\n', '          rotateSun(shadowDir.current.set(...themeKey.position))\n', 1],
    [
      '      const config = theme.lights[index]\n',
      '      const config = theme.lights[index]\n      if (index === 0 && !atmosphere && config && !(shadows && config.castShadow)) {\n        rotateSun(light.position.set(...config.position))\n      }\n',
      1,
    ],
  ],
};
