import { describe, expect, it } from 'vitest';

import { CATALOG_MODELS, isServerModel, modelSrcOf, thumbnailOf } from '../furnitureCatalog';
import { loadServerLibrary } from '../serverLibrary';

const item = (id: string) => ({
  id,
  widthMm: 1200,
  heightMm: 750,
  depthMm: 600,
  modelUrl: `https://cdn.example.test/library/${id}.glb`,
  previewUrl: `https://cdn.example.test/library/${id}.webp`,
});
// Ép kiểu: test chỉ cần các trường danh mục đọc, không cần cả `LibraryItem`.
const okApi = (items: ReturnType<typeof item>[]) => ({ list: async () => ({ ok: true, data: items }) }) as never;

describe('loadServerLibrary', () => {
  it('gộp mục máy chủ: mục mới khả dụng, mục trùng id đóng gói thì máy chủ thắng', async () => {
    const bundledId = 'dining-table';
    expect(CATALOG_MODELS[bundledId]).toBeDefined();
    const n = await loadServerLibrary(okApi([item('srv-desk-01'), item(bundledId)]));
    expect(n).toBe(2);
    expect(CATALOG_MODELS['srv-desk-01']?.dimensions).toEqual([1.2, 0.75, 0.6]);
    expect(modelSrcOf('srv-desk-01')).toBe('https://cdn.example.test/library/srv-desk-01.glb');
    expect(thumbnailOf('srv-desk-01')).toBe('https://cdn.example.test/library/srv-desk-01.webp');
    expect(isServerModel(bundledId)).toBe(true);
    expect(modelSrcOf(bundledId)).toBe(`https://cdn.example.test/library/${bundledId}.glb`);
    expect(CATALOG_MODELS[bundledId]?.dimensions).toEqual([1.2, 0.75, 0.6]);
  });

  it('API lỗi / ném / treo → 0, danh mục đóng gói giữ nguyên', async () => {
    const before = CATALOG_MODELS['sofa'];
    expect(await loadServerLibrary({ list: async () => ({ ok: false, error: new Error('500') }) } as never)).toBe(0);
    expect(await loadServerLibrary({ list: () => Promise.reject(new Error('offline')) } as never)).toBe(0);
    expect(await loadServerLibrary({ list: () => new Promise(() => {}) } as never, 10)).toBe(0);
    expect(isServerModel('sofa')).toBe(false);
    expect(CATALOG_MODELS['sofa']).toBe(before);
    expect(modelSrcOf('sofa')).toMatch(/^\/items\/sofa(-ph)?\/model\.glb$/);
  });
});
