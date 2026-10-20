// @vitest-environment node
// (đo màu bằng sharp — mô-đun native, không cần DOM)
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type Sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { CATALOG_MODELS } from '../furnitureCatalog';
import { SCENE_MATERIALS } from '../sceneDressing';
import {
  DEFAULT_SCENE_STYLE,
  readSceneStyle,
  sceneStylePreviewKey,
  SCENE_STYLE_IDS,
  SCENE_STYLE_MATERIALS,
  SCENE_STYLE_STORAGE_KEY,
  SCENE_STYLES,
  sceneStyleOf,
} from '../sceneStyles';

/** 14 vân gỗ/gạch của J2 + vật liệu thư viện đã có tệp. */
const WEBP_IDS = [
  'wood-woodplank48', 'wood-floorplank1', 'wood-hungarianparquet10', 'wood-woodplank19', 'wood-finewood27',
  'wood-hungarianparquet2', 'wood-woodenparquet11', 'flooring-woodparquet76', 'flooring-tile79', 'flooring-tiles4',
  'flooring-lightceramic24', 'flooring-statuarettowhite', 'flooring-tile20', 'flooring-ceramic53',
];
const LIBRARY_OK = /^(concrete-(plaster|stucco|polished|raw|drywall)|preset-.+|fabric-(linen|cotton|velvet|wool|suede|boucle)|leather-(black|calf)|metal-(brass|chrome|polished|steel|copper))$/;
const SCENE_IDS = new Set([...SCENE_STYLE_MATERIALS, ...SCENE_MATERIALS].map((m) => m.id));

const resolves = (ref: string): boolean => {
  const [kind, id = ''] = ref.split(/:(.*)/);
  if (kind === 'library') return WEBP_IDS.includes(id) || LIBRARY_OK.test(id);
  if (kind === 'scene') return SCENE_IDS.has(id as `mat_${string}`);
  return false;
};

describe('sceneStyles (J6)', () => {
  it('5 phong cách, am-ap đứng đầu và là mặc định', () => {
    expect(SCENE_STYLE_IDS).toEqual(['am-ap', 'hien-dai-sang', 'go-am', 'toi-gian', 'sang-trong-toi']);
    expect(DEFAULT_SCENE_STYLE).toBe('am-ap');
    for (const id of SCENE_STYLE_IDS) expect(SCENE_STYLES[id].id).toBe(id);
  });

  it('mọi tham chiếu vật liệu đều trỏ tới vật liệu có thật', () => {
    for (const style of Object.values(SCENE_STYLES)) {
      const refs = [...Object.values(style.floor), style.wall.interior, style.wall.exterior, ...Object.values(style.families)];
      for (const ref of refs) expect(resolves(ref), `${style.id}: ${ref}`).toBe(true);
    }
  });

  it('mọi thư mục ưu tiên có trong catalog', () => {
    for (const style of Object.values(SCENE_STYLES)) {
      for (const folders of Object.values(style.prefer)) {
        for (const folder of folders ?? []) expect(CATALOG_MODELS[folder], `${style.id}: ${folder}`).toBeDefined();
      }
    }
  });

  it('các phong cách khác nhau thấy được: sàn gỗ + sơn tường không trùng nhau', () => {
    const looks = Object.values(SCENE_STYLES).map((s) => `${s.floor.wood}|${s.wall.interior}`);
    expect(new Set(looks).size).toBe(SCENE_STYLE_IDS.length);
  });

  it('id vật liệu riêng không trùng và đúng tiền tố mat_style_', () => {
    const ids = SCENE_STYLE_MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^mat_style_[a-z_]+$/);
  });

  it('id lạ → mặc định', () => {
    expect(sceneStyleOf('x')).toBe(SCENE_STYLES['am-ap']);
    expect(sceneStyleOf(undefined)).toBe(SCENE_STYLES['am-ap']);
    expect(sceneStyleOf('go-am')).toBe(SCENE_STYLES['go-am']);
  });

  it('readSceneStyle: đọc khoá J9, hỏng/thiếu → mặc định', () => {
    expect(SCENE_STYLE_STORAGE_KEY).toBe('appfront.pascal.sceneStyle.v1');
    const store = (value: string | null) => () => ({ getItem: (k: string) => (k === SCENE_STYLE_STORAGE_KEY ? value : null) }) as Storage;
    expect(readSceneStyle(store('go-am'))).toBe(SCENE_STYLES['go-am']);
    expect(readSceneStyle(store(null))).toBe(SCENE_STYLES['am-ap']);
    expect(readSceneStyle(store('lạ'))).toBe(SCENE_STYLES['am-ap']);
    expect(
      readSceneStyle(() => {
        throw new Error('SecurityError');
      }),
    ).toBe(SCENE_STYLES['am-ap']);
  });
});

// ---- Luật sàn: trong một phong cách, sàn khác finish phải khác màu thấy được ----

const ROOT = resolve(__dirname, '../../../..');
const PUBLIC = resolve(ROOT, 'public/pascal');
const MIN_DELTA_E = 10;
const LIBRARY_SRC = readFileSync(resolve(ROOT, 'vendor/pascal/packages/core/src/material-library.ts'), 'utf8');
// Đường dẫn không phải chuỗi cố định: tsc không đòi tệp khai kiểu cho `.mjs`.
const { webpPathOf } = (await import(/* @vite-ignore */ resolve(ROOT, 'scripts/pascal-material-webp.mjs'))) as {
  webpPathOf: (ktx2: string) => string;
};

type Lab = readonly [number, number, number];

/** sRGB 0-255 → CIELAB (D65). */
const labOf = (rgb: readonly number[]): Lab => {
  const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb.map(lin) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};

const hexRgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * Màu trung bình của một vật liệu sàn: `library:` → ảnh albedo webp tự dựng; id chưa có
 * webp (concrete-* chỉ có ktx2) → giữa ảnh thumb của thư viện (quả cầu đã chiếu sáng, xấp
 * xỉ); `scene:` phẳng → màu hex của nó.
 */
const meanLabOf = async (ref: string): Promise<Lab> => {
  const [kind, id = ''] = ref.split(/:(.*)/);
  if (kind === 'scene') {
    const mat = [...SCENE_STYLE_MATERIALS, ...SCENE_MATERIALS].find((m) => m.id === id);
    const color = (mat?.material as { properties?: { color?: string } } | undefined)?.properties?.color;
    if (color === undefined) throw new Error(`không có màu phẳng cho ${ref}`);
    return labOf(hexRgb(color));
  }
  const at = LIBRARY_SRC.indexOf(`id: '${id}'`);
  const albedo = /albedoMap:\s*'([^']+)'/.exec(LIBRARY_SRC.slice(at, at + 1500))?.[1];
  if (at < 0 || albedo === undefined) throw new Error(`không thấy albedoMap của ${id}`);
  const sharp = createRequire(resolve(ROOT, 'package.json'))('sharp') as typeof Sharp;
  const webp = resolve(PUBLIC, `.${webpPathOf(albedo)}`);
  if (existsSync(webp)) {
    const { channels } = await sharp(webp).stats();
    return labOf(channels.slice(0, 3).map((c) => c.mean));
  }
  const thumb = resolve(ROOT, 'vendor/pascal/assets', `.${albedo.replace(/_basecolor_512\.ktx2$/, '_thumb.webp')}`);
  const { width = 0, height = 0 } = await sharp(thumb).metadata();
  const { channels } = await sharp(thumb)
    .extract({ left: Math.round(width / 4), top: Math.round(height / 4), width: Math.round(width / 2), height: Math.round(height / 2) })
    .stats();
  return labOf(channels.slice(0, 3).map((c) => c.mean));
};

describe.skipIf(!existsSync(resolve(PUBLIC, 'material')))('sceneStyles: sàn khác finish khác màu (ΔE76 ≥ 10)', () => {
  it('mọi phong cách, mọi cặp finish', async () => {
    const failures: string[] = [];
    for (const style of Object.values(SCENE_STYLES)) {
      const entries = Object.entries(style.floor);
      const labs = await Promise.all(entries.map(([, ref]) => meanLabOf(ref)));
      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const [a, b] = [labs[i] as Lab, labs[j] as Lab];
          const dE = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
          if (dE < MIN_DELTA_E) failures.push(`${style.id} ${entries[i]?.[0]}/${entries[j]?.[0]}: ΔE ${dE.toFixed(1)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('W4a — readSceneStyle: xem thử của dự án → phong cách dự án → khoá J9 → mặc định', () => {
    const store = (items: Record<string, string>) => () => ({ getItem: (k: string) => items[k] ?? null }) as Storage;
    const project = { id: 'p1', style: 'toi-gian' };
    expect(readSceneStyle(store({ [SCENE_STYLE_STORAGE_KEY]: 'go-am' }), project)).toBe(SCENE_STYLES['toi-gian']);
    expect(readSceneStyle(store({ [sceneStylePreviewKey('p1')]: 'go-am' }), project)).toBe(SCENE_STYLES['go-am']);
    expect(readSceneStyle(store({ [sceneStylePreviewKey('p2')]: 'go-am' }), project)).toBe(SCENE_STYLES['toi-gian']);
    expect(readSceneStyle(store({ [SCENE_STYLE_STORAGE_KEY]: 'go-am' }), { id: 'p1', style: 'lạ' })).toBe(SCENE_STYLES['go-am']);
    expect(readSceneStyle(store({}), { id: 'p1' })).toBe(SCENE_STYLES['am-ap']);
  });
});
