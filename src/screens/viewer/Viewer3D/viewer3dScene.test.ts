/**
 * Bài kiểm của module cảnh — không dựng màn nào, không cần React.
 *
 * Đó là cả lý do `viewer3dScene.ts` là một module `.ts` sở hữu renderer thay vì
 * một `useEffect` trong `.tsx`: bốn điều dưới đây kiểm được bằng một canvas
 * rỗng, một worker giả và một renderer giả.
 *
 * 1. Dựng được — mọi job của mọi tầng đi qua `BuildQueue` và về đủ.
 * 2. Phần trăm là phép đếm THẬT: `totalCount` bằng tổng `planFullBuild` của
 *    từng tầng, và `settledCount` tăng đúng một đơn vị mỗi job.
 * 3. `dispose()` trả tài nguyên về đúng số ban đầu, đọc bằng `ResourceLedger.counts`.
 * 4. Không có WebGL trả `ok: false` — không ném lỗi, không mã lỗi.
 *
 * Dữ liệu lấy từ `src/lib/testing/fixtures` (R-70): bộ mẫu chuẩn 4 tầng · 48
 * tường · 14 phòng · 248,60 m² của A14, không phải một mô hình bịa tại chỗ.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { LevelId } from '@/domain/spatial/types';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import {
  respondTo,
  type BuildRequestMessage,
  type BuildResponseMessage,
} from '@/lib/three/build/build.worker';
import { planFullBuild, type BuildWorkerLike } from '@/lib/three/build/buildQueue';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { ResourceLedger, TRACKED_RESOURCES } from '@/lib/three/perf/dispose';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { mountViewerScene } from './viewer3dScene';
import type { ViewerRendererLike, ViewerSceneStatus } from './viewer3dTypes';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu.                                                                     */
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

/** Khung nhìn tối thiểu: mọi tầng hiện, không chọn gì, không cắt gì. */
function frameOf(levels: readonly BuildFloorInput[]): ViewerSceneFrame {
  return {
    azimuthRad: 0.8,
    polarRad: 1,
    distanceM: 40,
    isOrthographic: false,
    visibleStoreyIds: levels.map((level) => level.level.id),
    separation: 0,
    sectionPlane: null,
    selectedEntityIds: [],
    hoveredEntityId: null,
    isolatedEntityIds: null,
    hiddenEntityIds: [],
    reducedMotion: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Chỗ tiêm.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Worker trả lời bằng chính phép tính của R-03, một microtask sau khi nhận.
 *
 * Trả lời thẳng trong `postMessage` sẽ khiến hàng đợi đẩy job kế tiếp ngay
 * trong ngăn xếp của job trước — hai trăm rưỡi job lồng nhau. Microtask cắt
 * chuỗi ấy mà vẫn không cần đồng hồ giả.
 */
class MicrotaskWorker implements BuildWorkerLike {
  onmessage: ((event: MessageEvent<BuildResponseMessage>) => void) | null = null;

  readonly terminate = vi.fn();

  postMessage(message: BuildRequestMessage): void {
    const response = respondTo(message);

    queueMicrotask(() => {
      this.onmessage?.(new MessageEvent('message', { data: response }));
    });
  }
}

/** Renderer giả — đếm được, và không cần một GL context nào. */
function fakeRenderer(): ViewerRendererLike & { readonly disposals: () => number } {
  let disposals = 0;

  return {
    info: { render: { calls: 0, triangles: 0 } },
    shadowMap: { type: 0, enabled: false },
    clippingPlanes: [],
    setSize: () => undefined,
    setPixelRatio: () => undefined,
    render: () => undefined,
    dispose: () => {
      disposals += 1;
    },
    forceContextLoss: () => undefined,
    disposals: () => disposals,
  };
}

/** Lịch vẽ không bao giờ chạy: bài kiểm này đo phép dựng, không đo phép vẽ. */
const NEVER_SCHEDULE = (): number => 0;

interface Harness {
  readonly canvas: HTMLCanvasElement;
  readonly levels: readonly BuildFloorInput[];
  readonly ledger: ResourceLedger;
  readonly seen: ViewerSceneStatus[];
  readonly renderer: ReturnType<typeof fakeRenderer>;
}

function harness(): Harness {
  return {
    canvas: document.createElement('canvas'),
    levels: sampleLevels(),
    ledger: new ResourceLedger(),
    seen: [],
    renderer: fakeRenderer(),
  };
}

function mount(host: Harness): ReturnType<typeof mountViewerScene> {
  return mountViewerScene(host.canvas, {
    levels: host.levels,
    frame: frameOf(host.levels),
    tokenOfPartKind: () => '--wall-idle',
    canSelect: true,
    ledger: host.ledger,
    createRenderer: () => host.renderer,
    createWorker: () => new MicrotaskWorker(),
    schedule: NEVER_SCHEDULE,
    cancel: () => undefined,
    // Không đọc `getComputedStyle`: token rỗng rơi về màu dự phòng, và bài kiểm
    // này không nói gì về màu.
    readToken: () => '',
    onStatusChange: (status) => host.seen.push(status),
  });
}

/* -------------------------------------------------------------------------- */
/* Bài kiểm.                                                                   */
/* -------------------------------------------------------------------------- */

describe('mountViewerScene', () => {
  let host: Harness;

  beforeEach(() => {
    host = harness();
  });

  it('dựng đủ mọi job của mọi tầng qua BuildQueue', async () => {
    const expected = host.levels.reduce((total, level) => total + planFullBuild(level).length, 0);
    const mounted = mount(host);

    expect(mounted.ok).toBe(true);
    if (!mounted.ok) {
      return;
    }

    expect(host.levels.length).toBeGreaterThan(1);
    expect(mounted.handle.status().progress.totalCount).toBe(expected);

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    const finished = mounted.handle.status();
    expect(finished.progress.settledCount).toBe(expected);
    expect(finished.progress.failedCount).toBe(0);
    expect([...finished.progress.readyLevelIds].sort()).toEqual(
      host.levels.map((level) => String(level.level.id)).sort(),
    );

    mounted.handle.dispose();
  });

  it('đếm phần trăm bằng job đã settle, từng job một', async () => {
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    const total = mounted.handle.status().progress.totalCount;
    const counted = host.seen.map((status) => status.progress.settledCount);

    // Mỗi job settle phát ra đúng một mốc, và mốc tăng đúng một đơn vị: đó là
    // định nghĩa của "phần trăm thật" mà `enqueueAll` không cho được.
    expect(counted.at(0)).toBe(0);
    expect(counted.at(-1)).toBe(total);
    expect(counted).toEqual([0, ...Array.from({ length: total }, (_unused, at) => at + 1)]);

    mounted.handle.dispose();
  });

  it('dispose() trả tài nguyên về đúng số ban đầu', async () => {
    const before = host.ledger.counts;
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    const live = host.ledger.counts;
    expect(live.geometries).toBeGreaterThan(0);
    expect(live.materials).toBeGreaterThan(0);

    mounted.handle.dispose();

    const after = host.ledger.counts;
    for (const resource of TRACKED_RESOURCES) {
      expect(after[resource]).toBe(before[resource]);
    }

    expect(host.renderer.disposals()).toBe(1);

    // Gọi hai lần không hỏng gì và không trả thêm lần nữa.
    mounted.handle.dispose();
    expect(host.renderer.disposals()).toBe(1);
  });

  it('không có WebGL thì trả một kết quả, không ném lỗi', () => {
    const canvas = document.createElement('canvas');

    // Không truyền `createRenderer`: bản thật gọi `new WebGLRenderer`, và jsdom
    // không cấp được GL context nào.
    const mounted = mountViewerScene(canvas, {
      levels: [],
      frame: frameOf([]),
      tokenOfPartKind: () => '--wall-idle',
      canSelect: false,
      schedule: NEVER_SCHEDULE,
      cancel: () => undefined,
      readToken: () => '',
    });

    expect(mounted.ok).toBe(false);
    if (!mounted.ok) {
      expect(mounted.reason).toBe('webglUnavailable');
    }
  });
});
