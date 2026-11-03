import { afterEach, describe, expect, it } from 'vitest';

import { DAY_THEME_ID, NIGHT_THEME_ID } from '../renderLook';
import { ITEM_LIGHT_DISTANCE, ITEM_LIGHT_POOL, itemLightDistance, itemLightIntensity, itemLightPoolSize } from './itemLights';
import { DEFAULT_REALISM_FLAGS, useRealism } from './store';

const setMaterials = (materials: boolean) =>
  useRealism.setState({ flags: { ...DEFAULT_REALISM_FLAGS, materials } });

describe('itemLights', () => {
  afterEach(() => setMaterials(DEFAULT_REALISM_FLAGS.materials));
  it('cờ bật: tối x0,4, Ban ngày tắt, tầm ≤ 4 m', () => {
    setMaterials(true);
    expect(itemLightIntensity(5, NIGHT_THEME_ID)).toBeCloseTo(2);
    expect(itemLightIntensity(5, DAY_THEME_ID)).toBe(0);
    expect(itemLightDistance(0)).toBe(ITEM_LIGHT_DISTANCE);
    expect(itemLightDistance(2)).toBe(2);
  });
  it('cờ tắt: y cũ', () => {
    setMaterials(false);
    expect(itemLightIntensity(5, DAY_THEME_ID)).toBe(5);
    expect(itemLightDistance(0)).toBe(0);
  });
  it('pool: Ban ngày + cờ bật = 0 đèn (shader không mang đèn thừa), còn lại = pool gốc', () => {
    expect(itemLightPoolSize(DAY_THEME_ID, true)).toBe(0);
    expect(itemLightPoolSize(NIGHT_THEME_ID, true)).toBe(ITEM_LIGHT_POOL);
    expect(itemLightPoolSize(DAY_THEME_ID, false)).toBe(ITEM_LIGHT_POOL);
  });
});
