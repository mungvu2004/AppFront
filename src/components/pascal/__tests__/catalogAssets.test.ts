/**
 * Thư viện đồ đạc của editor Pascal chỉ trỏ tới tài sản tự host (QA-05c B4, 23F-B-001 / 23F-G-002).
 *
 * Bản chép gốc ghi 333 URL `supabase.co` của Pascal; CSP nginx chỉ cho `'self'` + MinIO nên ảnh thẻ
 * vỡ và GLB không tải. Luật dự án là tự host, không nới CSP: mỗi `src`/`thumbnail` phải là đường
 * `/items/…` (viewer ghép thành `/pascal/items/…`) và tệp phải có trong `vendor/pascal/assets/items`,
 * nơi `scripts/copy-pascal-assets.mjs` chép sang `public/pascal/items`. Đọc mã như văn bản: tệp
 * vendor viết theo luật Biome, không nạp qua cấu hình tsc của AppFront.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const CATALOG = join('vendor', 'pascal', 'packages', 'editor', 'src', 'components', 'ui', 'item-catalog', 'catalog-items.tsx');
const ITEMS_DIR = join('vendor', 'pascal', 'assets', 'items');

const source = readFileSync(CATALOG, 'utf8');
const urls = [...source.matchAll(/\b(?:src|thumbnail|floorPlanUrl):\s*'([^']*)'/gu)].map((match) => match[1] ?? '');

describe('thư viện đồ đạc Pascal — tài sản tự host', () => {
  it('mỗi mẫu có đúng một ảnh thẻ và một mô hình', () => {
    const items = source.match(/^ {4}id: '/gmu)?.length ?? 0;

    expect(items).toBeGreaterThan(0);
    expect(urls).toHaveLength(items * 2);
  });

  it('không URL nào ra máy ngoài, không còn ảnh mặt bằng supabase', () => {
    expect(source).not.toMatch(/https?:\/\//u);
    expect(urls.every((url) => /^\/items\/[\w-]+\/(?:model\.glb|thumbnail\.webp)$/u.test(url))).toBe(true);
  });

  it('mọi tệp được trỏ tới đều có trong vendor/pascal/assets/items', () => {
    const missing = urls.filter((url) => !existsSync(join(ITEMS_DIR, url.replace('/items/', ''))));

    expect(missing).toEqual([]);
  });
});
