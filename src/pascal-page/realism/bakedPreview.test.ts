import { Color, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';

import { SCENE_PALETTE } from '@/lib/pascal/scenePalette';

import { bakedDirFrom, bakedMaterial } from './bakedPreview';

describe('xem thử ánh sáng nướng', () => {
  it('chỉ nhận thư mục cùng origin; bỏ gạch chéo cuối', () => {
    expect(bakedDirFrom('?baked=/__baked/f1/')).toBe('/__baked/f1');
    expect(bakedDirFrom('?project=P-1')).toBeNull();
    expect(bakedDirFrom('?baked=https://x.test/a')).toBeNull();
    expect(bakedDirFrom('?baked=//x.test/a')).toBeNull();
    expect(bakedDirFrom('?baked=/a/../b')).toBeNull();
  });

  it('vật liệu nướng giữ màu, ảnh, mặt; gắn lightmap với cường độ của manifest', () => {
    const map = new Texture();
    const lightMap = new Texture();
    const source = new MeshStandardMaterial({ color: new Color(SCENE_PALETTE.floorOak), map });
    const out = bakedMaterial(source, lightMap, { lightmap: 'lightmap.png', intensity: 6, channel: 1 });
    expect(out.color.getHexString()).toBe(source.color.getHexString());
    expect(out.map).toBe(map);
    expect(out.lightMap).toBe(lightMap);
    expect(out.lightMapIntensity).toBe(6);
    expect(out.side).toBe(source.side);
  });
});
