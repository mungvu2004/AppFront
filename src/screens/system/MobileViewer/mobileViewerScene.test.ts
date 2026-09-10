/**
 * Bài kiểm của module cảnh di động — không dựng màn nào, không cần React.
 *
 * Đó là cả lý do `mobileViewerScene.ts` là một module `.ts` sở hữu renderer thay
 * vì một `useEffect` trong `.tsx`: mọi điều dưới đây kiểm được bằng một canvas
 * rỗng, một renderer giả và một đồng hồ giả.
 *
 * 1. Không có WebGL trả `ok: false` — không ném lỗi, không mã lỗi.
 * 2. **Mức gọn dựng trước.** Ngay sau khi lắp, mức đang dựng là `initialDetail`,
 *    KHÔNG phải `'full'`; rồi nó tự nâng dần lên, mỗi bậc một lượt `schedule`.
 * 3. Ngân sách R-04 không đạt ngay cả ở mức thô nhất thì trả `deviceTooWeak`, và
 *    trả lại mọi tài nguyên trước khi trả lời.
 * 4. Fps tụt dưới `SCENE_BUDGET.minFrameRate.mobile` đủ `DEGRADE_WINDOW_MS` thì
 *    mức chi tiết tụt một bậc THẬT và bóng đổ chuyển sang bộ lọc rẻ — cả hai vế.
 * 5. Fps được báo đều qua `onFrameRate`.
 * 6. Một cú chạm đi vào `onPick`; một cú kéo thì không.
 * 7. `dispose()` gỡ hết listener và gọi hai lần không nổ.
 *
 * Dữ liệu lấy từ `src/lib/testing/fixtures`: bộ mẫu chuẩn của A14, không phải
 * một mô hình bịa tại chỗ.
 */

import type { Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { LevelId } from '@/domain/spatial/types';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { CAMERA_SETTINGS } from '@/lib/three/camera/settings';
import { measureScene } from '@/lib/three/perf/budget';
import { DEGRADE_WINDOW_MS, shadowMapTypeFor } from '@/lib/three/perf/monitor';
import type { DetailLevel } from '@/lib/three/build/lod';

import {
  finerDetail,
  mountMobileViewerScene,
  notchesForScale,
  type MobileViewerRendererLike,
  type MobileViewerSceneMountOptions,
} from './mobileViewerScene';
import type { MobileViewerSceneHandle } from './mobileViewerTypes';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu và bộ giả.                                                           */
/* -------------------------------------------------------------------------- */

/** Bộ mẫu chuẩn của A14, đã chuẩn hoá và đã chuyển sang đầu vào của R-01. */
function sampleLevels(): readonly BuildFloorInput[] {
  const spatial = normalizeSpatial(createCleanBuildingScenario().graph);
  const levels: BuildFloorInput[] = [];

  for (const id of spatial.byKind.level) {
    const input = toBuildFloorInput(spatial, id as LevelId);

    if (input !== null) {
      levels.push(input);
    }
  }

  return levels;
}

/** Cùng bộ mẫu, nhân lên nhiều bản mang mã tầng khác nhau — một toà nhà quá nặng. */
function tooManyLevels(copies: number): readonly BuildFloorInput[] {
  const base = sampleLevels();
  const levels: BuildFloorInput[] = [];

  for (let copy = 0; copy < copies; copy += 1) {
    for (const input of base) {
      levels.push({
        ...input,
        level: { ...input.level, id: `${input.level.id}#${String(copy)}` as LevelId },
      });
    }
  }

  return levels;
}

/** Mặt bằng và chiều cao của bộ mẫu, tính bằng MI-LI-MÉT — mốc để soát đơn vị. */
function fixtureBoundsMm(levels: readonly BuildFloorInput[]): {
  x: number;
  y: number;
  topMm: number;
} {
  let x = 0;
  let y = 0;
  let topMm = 0;

  for (const level of levels) {
    topMm = Math.max(topMm, level.level.elevationMm + level.level.heightMm);

    for (const room of level.rooms) {
      for (const point of room.outline) {
        x = Math.max(x, Math.abs(point.x));
        y = Math.max(y, Math.abs(point.y));
      }
    }
  }

  // Tường dày ra ngoài mép phòng, và mái dày lên trên trần: một biên rộng rãi để
  // bài kiểm soát ĐƠN VỊ chứ không soát hình học.
  const marginMm = 2000;

  return { x: x + marginMm, y: y + marginMm, topMm: topMm + marginMm };
}

interface FakeRenderer extends MobileViewerRendererLike {
  readonly render: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
  readonly forceContextLoss: ReturnType<typeof vi.fn>;
}

function fakeRenderer(): FakeRenderer {
  return {
    info: { render: { calls: 0, triangles: 0 } },
    shadowMap: { type: 0, enabled: false, autoUpdate: true, needsUpdate: false },
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
  };
}

/** Đồng hồ và bộ lên lịch giả: không một `requestAnimationFrame` thật nào chạy. */
function fakeClock(): {
  now: () => number;
  schedule: (callback: (nowMs: number) => void) => number;
  cancel: (handle: number) => void;
  flush: (advanceMs: number) => void;
} {
  let nowMs = 0;
  let nextHandle = 1;
  const pending = new Map<number, (nowMs: number) => void>();

  return {
    now: () => nowMs,
    schedule: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      pending.set(handle, callback);

      return handle;
    },
    cancel: (handle) => {
      pending.delete(handle);
    },
    flush: (advanceMs) => {
      nowMs += advanceMs;
      // Ảnh chụp: một lượt gọi lại chỉ chạy những gì ĐÃ chờ lúc bắt đầu, và một
      // lượt huỷ giữa chừng thật sự huỷ được — đúng như trình duyệt.
      for (const handle of [...pending.keys()]) {
        const callback = pending.get(handle);
        if (callback === undefined) {
          continue;
        }
        pending.delete(handle);
        callback(nowMs);
      }
    },
  };
}

interface Harness {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: FakeRenderer;
  readonly clock: ReturnType<typeof fakeClock>;
  readonly details: DetailLevel[];
  readonly frameRates: number[];
  readonly picks: (string | null)[];
  readonly options: MobileViewerSceneMountOptions;
}

function harness(overrides: Partial<MobileViewerSceneMountOptions> = {}): Harness {
  const canvas = document.createElement('canvas');
  const renderer = fakeRenderer();
  const clock = fakeClock();
  const details: DetailLevel[] = [];
  const frameRates: number[] = [];
  const picks: (string | null)[] = [];
  const levels = overrides.levels ?? sampleLevels();

  const options: MobileViewerSceneMountOptions = {
    floorIds: levels.map((level) => level.level.id),
    initialDetail: 'block',
    onPick: (hit) => picks.push(hit === null ? null : hit.entityId),
    onDetailChange: (detail) => details.push(detail),
    onFrameRate: (fps) => frameRates.push(fps),
    levels,
    createRenderer: () => renderer,
    schedule: clock.schedule,
    cancel: clock.cancel,
    now: clock.now,
    readToken: () => '',
    ...overrides,
  };

  return { canvas, renderer, clock, details, frameRates, picks, options };
}

/** Lắp cảnh và đòi một tay cầm; hỏng thì bài kiểm dừng ở đây chứ không đi tiếp. */
function mounted(test: Harness): MobileViewerSceneHandle {
  const mount = mountMobileViewerScene(test.canvas, test.options);
  if (!mount.ok) {
    throw new Error(`Lắp cảnh hỏng: ${mount.reason}`);
  }

  return mount.handle;
}

/** Cây cảnh mà lượt vẽ gần nhất đã gửi cho renderer — cửa duy nhất nhìn vào trong. */
function lastRenderedScene(test: Harness): Object3D {
  const call = test.renderer.render.mock.calls.at(-1);
  const scene: unknown = call?.[0];
  if (scene === undefined) {
    throw new Error('Chưa có lượt vẽ nào để đọc cây cảnh.');
  }

  return scene as Object3D;
}

/** Một cú chạm hoặc một cú kéo trên canvas, bằng Pointer Events thật. */
function touch(canvas: HTMLCanvasElement, path: readonly (readonly [number, number])[]): void {
  const fire = (type: string, xPx: number, yPx: number): void => {
    const event = new Event(type) as Event & {
      pointerId: number;
      clientX: number;
      clientY: number;
    };
    Object.assign(event, { pointerId: 1, clientX: xPx, clientY: yPx });
    canvas.dispatchEvent(event);
  };

  const first = path[0] ?? [0, 0];
  const last = path.at(-1) ?? first;

  fire('pointerdown', first[0], first[1]);
  for (const [xPx, yPx] of path.slice(1)) {
    fire('pointermove', xPx, yPx);
  }
  fire('pointerup', last[0], last[1]);
}

/* -------------------------------------------------------------------------- */
/* Hàm thuần.                                                                  */
/* -------------------------------------------------------------------------- */

describe('mobileViewerScene — hàm thuần', () => {
  it('finerDetail đi ngược thang chi tiết và dừng ở bậc mịn nhất', () => {
    expect(finerDetail('block')).toBe('reduced');
    expect(finerDetail('reduced')).toBe('full');
    expect(finerDetail('full')).toBe('full');
  });

  it('notchesForScale đảo đúng phép nhân mà dolly làm', () => {
    const factor = CAMERA_SETTINGS.orbit.zoomFactorPerNotch;

    // Bóp đúng một nấc ra xa là +1 nấc; tách ra đúng một nấc là −1.
    expect(notchesForScale(1 / factor)).toBeCloseTo(1, 10);
    expect(notchesForScale(factor)).toBeCloseTo(-1, 10);
    expect(notchesForScale(1)).toBeCloseTo(0, 10);
  });

  it('notchesForScale liên tục: hai nửa cộng lại bằng cả cú bóp', () => {
    expect(notchesForScale(1.5) + notchesForScale(4 / 3)).toBeCloseTo(notchesForScale(2), 10);
  });

  it('notchesForScale không ném camera đi đâu khi tỉ lệ đọc sai', () => {
    expect(notchesForScale(0)).toBe(0);
    expect(notchesForScale(-1)).toBe(0);
    expect(notchesForScale(Number.NaN)).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Lắp cảnh.                                                                   */
/* -------------------------------------------------------------------------- */

describe('mountMobileViewerScene — hai nhánh hỏng hợp lệ', () => {
  it('không có WebGL: trả ok false, không ném lỗi', () => {
    const test = harness();
    const mount = mountMobileViewerScene(test.canvas, {
      ...test.options,
      createRenderer: () => {
        throw new Error('không có ngữ cảnh WebGL');
      },
    });

    expect(mount).toEqual({ ok: false, reason: 'webglUnavailable' });
  });

  it('máy yếu: ngân sách không đạt ngay cả ở mức thô nhất, và renderer được trả lại', () => {
    const test = harness({ levels: tooManyLevels(4) });
    const mount = mountMobileViewerScene(test.canvas, test.options);

    expect(mount).toEqual({ ok: false, reason: 'deviceTooWeak' });
    expect(test.renderer.dispose).toHaveBeenCalledTimes(1);
    expect(test.renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  });
});

describe('mountMobileViewerScene — mức gọn trước rồi nâng dần', () => {
  it('dựng ở initialDetail, KHÔNG phải full, và chưa báo đổi mức lần nào', () => {
    const test = harness();
    const handle = mounted(test);

    expect(handle.currentDetail()).toBe('block');
    expect(test.details).toEqual([]);

    handle.dispose();
  });

  it('nâng dần block → reduced → full, mỗi bậc một lượt lên lịch riêng', () => {
    const test = harness();
    const handle = mounted(test);

    test.clock.flush(20);
    expect(handle.currentDetail()).toBe('reduced');

    test.clock.flush(20);
    expect(handle.currentDetail()).toBe('full');

    // Hết thang: không còn bậc nào để nâng, và không có lượt dựng lại vô ích nào.
    test.clock.flush(20);
    expect(handle.currentDetail()).toBe('full');
    expect(test.details).toEqual(['reduced', 'full']);

    handle.dispose();
  });

  it('tôn trọng initialDetail mà người gọi đưa xuống', () => {
    const test = harness({ initialDetail: 'reduced' });
    const handle = mounted(test);

    expect(handle.currentDetail()).toBe('reduced');

    handle.dispose();
  });
});

/* -------------------------------------------------------------------------- */
/* R-04.                                                                       */
/* -------------------------------------------------------------------------- */

describe('mountMobileViewerScene — ngân sách R-04', () => {
  it('báo fps đều qua onFrameRate', () => {
    const test = harness();
    const handle = mounted(test);

    for (let step = 0; step < 4; step += 1) {
      handle.setActiveFloor(null);
      test.clock.flush(600);
    }

    expect(test.frameRates.length).toBeGreaterThan(0);
    expect(test.frameRates.every((fps) => Number.isFinite(fps))).toBe(true);

    handle.dispose();
  });

  it('fps dưới ngưỡng đủ lâu thì HẠ mức chi tiết thật và đổi luôn bộ lọc bóng', () => {
    const test = harness({ initialDetail: 'full' });
    const handle = mounted(test);

    expect(handle.currentDetail()).toBe('full');
    const softShadow = test.renderer.shadowMap.type;

    // Mỗi vòng là một cửa sổ đo dài hơn 500 ms với đúng một khung hình — khoảng
    // 1,7 fps, sâu dưới `SCENE_BUDGET.minFrameRate.mobile`.
    const windows = Math.ceil(DEGRADE_WINDOW_MS / 600) + 4;
    for (let step = 0; step < windows; step += 1) {
      handle.setActiveFloor(null);
      test.clock.flush(600);
    }

    expect(handle.currentDetail()).toBe('reduced');
    expect(test.details).toEqual(['reduced']);
    expect(test.renderer.shadowMap.type).toBe(shadowMapTypeFor('hard'));
    expect(test.renderer.shadowMap.type).not.toBe(softShadow);

    handle.dispose();
  });

  it('đã hạ mức thì thôi nâng lại, dù thang còn bậc mịn hơn', () => {
    const test = harness({ initialDetail: 'full' });
    const handle = mounted(test);

    const windows = Math.ceil(DEGRADE_WINDOW_MS / 600) + 4;
    for (let step = 0; step < windows; step += 1) {
      handle.setActiveFloor(null);
      test.clock.flush(600);
    }

    expect(handle.currentDetail()).toBe('reduced');

    // Tiếp tục chạy: không có lượt nâng nào đưa nó về `'full'`, và không có lần
    // hạ nào thứ hai chỉ vì bộ đếm của monitor vừa được nạp lại.
    for (let step = 0; step < 4; step += 1) {
      handle.setActiveFloor(null);
      test.clock.flush(20);
    }

    expect(handle.currentDetail()).toBe('reduced');
    expect(test.details).toEqual(['reduced']);

    handle.dispose();
  });
});

/* -------------------------------------------------------------------------- */
/* Tầng, chạm, đo, dọn.                                                        */
/* -------------------------------------------------------------------------- */

describe('MobileViewerSceneHandle', () => {
  it('setActiveFloor hiện đúng một tầng, và null hiện lại tất cả', () => {
    const test = harness();
    const handle = mounted(test);
    test.clock.flush(20);

    const scene = lastRenderedScene(test);
    const everyFloor = measureScene(scene).drawCalls;

    handle.setActiveFloor(test.options.floorIds[1] ?? '');
    const oneFloor = measureScene(scene).drawCalls;

    handle.setActiveFloor(null);
    const everyFloorAgain = measureScene(scene).drawCalls;

    expect(everyFloor).toBeGreaterThan(0);
    expect(oneFloor).toBeLessThan(everyFloor);
    // Đảo ngược được: ẩn một tầng không vứt đi một buffer nào.
    expect(everyFloorAgain).toBe(everyFloor);
    // Tập vật đổ bóng vừa đổi, nên bản đồ bóng TĨNH phải được vẽ lại.
    expect(test.renderer.shadowMap.needsUpdate).toBe(true);

    handle.dispose();
  });

  it('một cú chạm đi vào onPick; một cú kéo thì không', () => {
    const test = harness();
    const handle = mounted(test);

    touch(test.canvas, [[40, 40]]);
    expect(test.picks).toHaveLength(1);

    touch(test.canvas, [
      [40, 40],
      [200, 120],
    ]);
    expect(test.picks).toHaveLength(1);

    handle.dispose();
  });

  it('pickMeasurePoint trả điểm trên bề mặt, tính bằng MI-LI-MÉT', () => {
    const test = harness();
    const handle = mounted(test);
    const bounds = fixtureBoundsMm(test.options.levels ?? []);

    // Ngoài hẳn khung nhìn: không có bề mặt nào ở đó, và không có lỗi nào bị ném.
    expect(handle.pickMeasurePoint(-1000, -1000)).toBeNull();

    // Giữa canvas: mô hình được khuôn vừa khung nhìn ngay lúc lắp, nên có bề mặt.
    const point = handle.pickMeasurePoint(150, 75);
    if (point === null) {
      throw new Error('Giữa khung nhìn phải có bề mặt để đo.');
    }

    // Mi-li-mét, KHÔNG phải mét: một toạ độ vài chục mét đọc ra vài chục NGHÌN.
    // Quên phép quy đổi thì con số tụt xuống hàng đơn vị và bài kiểm này đỏ.
    expect(Math.max(Math.abs(point.x), Math.abs(point.y))).toBeGreaterThan(1000);
    // Và nó nằm trong chính bộ mẫu: `x`/`y` là mặt bằng, `z` là cao độ.
    expect(Math.abs(point.x)).toBeLessThanOrEqual(bounds.x);
    expect(Math.abs(point.y)).toBeLessThanOrEqual(bounds.y);
    expect(point.z ?? 0).toBeGreaterThanOrEqual(0);
    expect(point.z ?? 0).toBeLessThanOrEqual(bounds.topMm);

    handle.dispose();

    // Cảnh đã dọn thì không còn gì để đo.
    expect(handle.pickMeasurePoint(150, 75)).toBeNull();
  });

  it('dispose gỡ hết listener, trả canvas về nguyên trạng, và gọi hai lần không nổ', () => {
    const test = harness();
    test.canvas.style.touchAction = 'pan-y';
    const handle = mounted(test);

    expect(test.canvas.style.touchAction).toBe('none');

    handle.dispose();

    expect(test.canvas.style.touchAction).toBe('pan-y');
    expect(test.renderer.dispose).toHaveBeenCalledTimes(1);

    // Sau khi dọn, canvas không còn nghe gì: một cú chạm nữa không gọi onPick.
    const before = test.picks.length;
    touch(test.canvas, [[40, 40]]);
    expect(test.picks).toHaveLength(before);

    handle.dispose();
    expect(test.renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
