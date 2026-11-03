import { BoxGeometry, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { isGlossy, pmremWithoutMrt, probeStep, reflectProbeWanted } from './reflectRules';

describe('reflectRules', () => {
  it('PMREM chạy trên renderer thật (bỏ lớp chụp nhanh W2) với MRT tắt, trả lại cả hai kể cả khi lỗi; cài một lần', () => {
    const real = Object.assign(
      Object.create({
        getMRT(this: { _mrt: unknown }) {
          return this._mrt;
        },
        setMRT(this: { _mrt: unknown }, m: unknown) {
          this._mrt = m;
        },
      }) as object,
      { _mrt: 'scene-mrt' },
    );
    const snapshot = Object.assign(Object.create(real) as object, { getMRT: () => 'frozen-mrt' });
    const seen: unknown[] = [];
    const proto: Record<string, unknown> = {
      fromScene(this: { _renderer: { getMRT(): unknown } }) {
        seen.push((this._renderer as object) === real, this._renderer.getMRT());
        return 'rt';
      },
      _fromTexture() {
        throw new Error('boom');
      },
    };
    pmremWithoutMrt(proto);
    pmremWithoutMrt(proto);
    const gen = Object.assign(Object.create(proto) as Record<string, () => unknown>, { _renderer: snapshot });
    expect(gen.fromScene!()).toBe('rt');
    expect(seen).toEqual([true, null]);
    expect(gen._renderer).toBe(snapshot);
    expect((real as { _mrt: unknown })._mrt).toBe('scene-mrt');
    expect(() => gen._fromTexture!()).toThrow('boom');
    expect((real as { _mrt: unknown })._mrt).toBe('scene-mrt');
    expect(gen._renderer).toBe(snapshot);
  });

  it('chỉ nhận vật liệu bóng có envMap', () => {
    expect(isGlossy({ roughness: 0.05, metalness: 0, envMap: null })).toBe(true);
    expect(isGlossy({ roughness: 0.45, metalness: 1, envMap: null })).toBe(true);
    expect(isGlossy({ roughness: 0.8, metalness: 0, envMap: null })).toBe(false);
    expect(isGlossy({ roughness: 0.1 })).toBe(false); // không có envMap (vd. Basic)
    expect(isGlossy({ envMap: null })).toBe(false); // Lambert
  });

  it('trong nhà = dưới hộp trần', () => {
    const ceiling = new Mesh(new BoxGeometry(4, 0.1, 4));
    ceiling.position.set(0, 2.7, 0);
    ceiling.updateMatrixWorld();
    expect(reflectProbeWanted(new Vector3(1, 1.6, 1), [ceiling])).toBe(true);
    expect(reflectProbeWanted(new Vector3(5, 1.6, 1), [ceiling])).toBe(false); // ngoài nhà ngang mắt
    expect(reflectProbeWanted(new Vector3(1, 8, 1), [ceiling])).toBe(false); // trên mái
    expect(reflectProbeWanted(new Vector3(1, 1.6, 1), [])).toBe(false);
  });

  it('lịch probe: biên dịch trước rồi mới chụp, camera đi giữa chừng thì bỏ', () => {
    const st = (busy: boolean, ready: boolean, moving: boolean, changed: boolean) => probeStep({ busy, ready, moving, changed });
    expect(st(false, false, false, true)).toBe('start'); // đứng yên + cảnh đổi → biên dịch trước, không chụp ngay
    expect(st(false, false, false, false)).toBe('idle');
    expect(st(false, false, true, true)).toBe('idle'); // đang đi
    expect(st(true, false, false, true)).toBe('idle'); // đang biên dịch → không chụp chồng
    expect(st(false, true, false, false)).toBe('finish'); // biên dịch xong, vẫn yên → chụp
    expect(st(false, true, true, false)).toBe('drop'); // xong nhưng camera đã đi
  });
});
