import { afterEach, describe, expect, it } from 'vitest';

import { DAY_THEME_ID, NIGHT_THEME_ID } from '../renderLook';
import { ITEM_LIGHT_DISTANCE, itemLightDistance, itemLightIntensity } from './itemLights';
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
});
