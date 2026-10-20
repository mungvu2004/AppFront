import { describe, expect, it } from 'vitest';

import { CATALOG_MODELS } from '../furnitureCatalog';
import { SCENE_MATERIALS } from '../sceneDressing';
import { DEFAULT_SCENE_STYLE, SCENE_STYLE_IDS, SCENE_STYLE_MATERIALS, SCENE_STYLES, sceneStyleOf } from '../sceneStyles';

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
});
