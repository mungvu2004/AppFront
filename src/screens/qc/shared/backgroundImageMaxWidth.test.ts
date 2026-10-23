import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// J-10: ảnh nền đặt bằng left/top/width theo pixel khung vẽ; preflight `img { max-width: 100% }`
// bóp bề rộng về khung khi phóng to → nền lệch tường. Mỗi ảnh nền kiểu này phải tắt max-width.
describe('ảnh nền khung vẽ không bị preflight bóp bề rộng (J-10)', () => {
  it.each([
    'src/screens/qc/WallLayerReview/WallLayerCanvas.tsx',
    'src/screens/qc/ObjectLayerReview/ObjectLayerCanvas.tsx',
  ])('%s', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/className="pointer-events-none absolute block max-w-none/);
  });
});
