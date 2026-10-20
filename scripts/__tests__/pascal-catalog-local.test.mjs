/**
 * Plugin thư viện đồ tự host: viết lại tệp vendor thật thì không còn supabase, còn đúng
 * 101 mẫu và mọi đường dẫn mẫu/ảnh có thật trong `vendor/pascal/assets/items`.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';
import { describe, expect, it } from 'vitest';

import { pascalCatalogLocal } from '../pascal-catalog-local.mjs';

const CATALOG = path.resolve('vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-items.tsx');
const ITEMS = path.resolve('vendor/pascal/assets/items');

/** Chạy module đã viết lại (bỏ kiểu bằng esbuild) để lấy `CATALOG_ITEMS` thật. */
async function catalogItemsOf(code) {
  const { code: js } = await transformWithEsbuild(code, 'catalog-items.tsx');
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'pascal-catalog-local-')), 'catalog-items.mjs');
  writeFileSync(file, js);
  return (await import(pathToFileURL(file).href)).CATALOG_ITEMS;
}

describe('pascal-catalog-local', () => {
  it('viết lại tệp vendor thật: 0 supabase, 101 mẫu, mọi tệp có trong máy', async () => {
    const plugin = pascalCatalogLocal();
    const out = plugin.transform(readFileSync(CATALOG, 'utf8'), CATALOG).code;
    expect(out).not.toContain('supabase.co');
    expect(out).not.toContain('floorPlanUrl');
    const items = await catalogItemsOf(out);
    expect(items).toHaveLength(101);
    for (const item of items) {
      for (const url of [item.src, item.thumbnail]) {
        expect(url).toMatch(/^\/items\//);
        expect(existsSync(path.join(ITEMS, url.slice('/items/'.length))), url).toBe(true);
      }
    }
    expect(() => plugin.buildEnd()).not.toThrow();
  });

  it('bỏ qua module khác', () => {
    expect(pascalCatalogLocal().transform("const a = 'https://x.supabase.co/'", 'x.tsx')).toBeNull();
  });

  it('ném lỗi khi upstream đổi khai báo hoặc lượt dựng không gặp module', () => {
    const plugin = pascalCatalogLocal();
    expect(() => plugin.transform('export const OTHER = []', CATALOG)).toThrow(/CATALOG_ITEMS/);
    expect(() => plugin.buildEnd()).toThrow(/catalog-items\.tsx/);
    expect(() => plugin.buildEnd(new Error('khác'))).not.toThrow();
  });

  it('ném lỗi khi còn sót supabase.co sau khi viết lại', () => {
    const code = "export const CATALOG_ITEMS: CatalogItem[] = [\n  { src: 'https://x.supabase.co/other/a.glb' },\n]\n";
    expect(() => pascalCatalogLocal().transform(code, CATALOG)).toThrow(/supabase\.co/);
  });
});
