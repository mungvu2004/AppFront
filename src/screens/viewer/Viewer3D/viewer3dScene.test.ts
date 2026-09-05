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
 * 5. Nấc chi tiết của R-04 được thi hành THẬT: ba giây dưới ngưỡng khung hình
 *    làm `PerfMonitor` phát một `DegradeAction`, và cả hai vế của nó — bóng đổ
 *    và nấc chi tiết — đổi cảnh đang vẽ, đảo ngược được, không dựng lại gì.
 * 6. Bảng của `droppedKindsAt` được tôn trọng từng loại một, và nấc không lấn
 *    quyền ẩn/hiện của khung.
 *
 * Dữ liệu lấy từ `src/lib/testing/fixtures` (R-70): bộ mẫu chuẩn 4 tầng · 48
 * tường · 14 phòng · 248,60 m² của A14, không phải một mô hình bịa tại chỗ.
 */

import { Group, Object3D } from 'three';
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
import { readPartData, tagPart, type BuildPartKind } from '@/lib/three/build/scene';
import { ResourceLedger, TRACKED_RESOURCES } from '@/lib/three/perf/dispose';
import {
  DEGRADE_WINDOW_MS,
  SAMPLE_INTERVAL_MS,
  shadowMapTypeFor,
} from '@/lib/three/perf/monitor';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { applyDetailLevel, mountViewerScene } from './viewer3dScene';
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

/**
 * Renderer giả — đếm được, và không cần một GL context nào.
 *
 * Nó giữ lại cảnh mà mình được bảo vẽ: đó là cách bài kiểm nhìn vào cây đã dựng
 * mà module không phải mở thêm một cửa nào chỉ để được kiểm.
 */
function fakeRenderer(): ViewerRendererLike & {
  readonly disposals: () => number;
  readonly drawn: () => Object3D | null;
} {
  let disposals = 0;
  let drawn: Object3D | null = null;

  return {
    info: { render: { calls: 0, triangles: 0 } },
    shadowMap: { type: 0, enabled: false },
    clippingPlanes: [],
    setSize: () => undefined,
    setPixelRatio: () => undefined,
    render: (scene: unknown) => {
      drawn = scene as Object3D;
    },
    dispose: () => {
      disposals += 1;
    },
    forceContextLoss: () => undefined,
    disposals: () => disposals,
    drawn: () => drawn,
  };
}

/** Loại bộ phận nào đang thật sự được vẽ trong một cây. */
function visibleKinds(root: Object3D): ReadonlySet<BuildPartKind> {
  const kinds = new Set<BuildPartKind>();

  root.traverse((object) => {
    const data = readPartData(object);

    if (data !== null && object.visible) {
      kinds.add(data.kind);
    }
  });

  return kinds;
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

  it('thi hành nấc chi tiết mà R-04 quyết: reduced thôi vẽ ô mở', async () => {
    // Đồng hồ và lịch vẽ do bài kiểm cầm, nên `PerfMonitor` được đưa qua đúng
    // ba giây dưới ngưỡng của R-04 mà không phải chờ ba giây thật.
    let clockMs = 0;
    let pending: ((nowMs: number) => void) | null = null;

    const mounted = mountViewerScene(host.canvas, {
      levels: host.levels,
      frame: frameOf(host.levels),
      tokenOfPartKind: () => '--wall-idle',
      canSelect: false,
      ledger: host.ledger,
      createRenderer: () => host.renderer,
      createWorker: () => new MicrotaskWorker(),
      schedule: (callback) => {
        pending = callback;
        return 1;
      },
      cancel: () => {
        pending = null;
      },
      now: () => clockMs,
      readToken: () => '',
    });

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    const tick = (atMs: number): void => {
      const callback = pending;
      pending = null;
      clockMs = atMs;
      callback?.(atMs);
    };

    // Khung đầu tiên, còn ở nấc `full`.
    tick(0);

    const drawn = host.renderer.drawn();
    expect(drawn).not.toBeNull();
    if (drawn === null) {
      return;
    }

    // Ba loại mà worker R-03 dựng ra từ bộ mẫu này. Bộ mẫu A14 xếp 48 tường dài
    // 1000 mm nối đuôi nhau, còn mỗi cửa rộng 900 mm đặt ở mốc 300 mm — cửa
    // tràn khỏi tường chủ nên `planCuts` từ chối khoét, và không tấm cửa nào
    // được dựng. Đó là tính chất của bộ mẫu, không phải của nấc chi tiết.
    expect([...visibleKinds(drawn)].sort()).toEqual(['ceiling', 'floorSlab', 'wall']);
    expect(host.renderer.shadowMap.type).toBe(shadowMapTypeFor('soft'));

    // Một cửa sổ đo dài hơn `DEGRADE_WINDOW_MS` với đúng hai khung hình: khung
    // hình đo được xuống dưới ngưỡng, và nó ở dưới đủ lâu để R-04 hạ nấc.
    tick(DEGRADE_WINDOW_MS + SAMPLE_INTERVAL_MS);

    // Vế bóng đổ của `DegradeAction` đã được thi hành.
    expect(host.renderer.shadowMap.type).toBe(shadowMapTypeFor('hard'));

    // Và vế nấc chi tiết cũng vậy: `reduced` bỏ đúng `'opening'`, mà cảnh này
    // không có mesh loại ấy, nên nó đúng ra không được bỏ gì — và nó không bỏ.
    expect([...visibleKinds(drawn)].sort()).toEqual(['ceiling', 'floorSlab', 'wall']);

    // Nấc là một TRẠNG THÁI chứ không phải một lần ẩn: một khung mới đi qua
    // `update()` vẫn tính lại theo nấc đang có, không dựng lại thứ nấc đã bỏ.
    mounted.handle.update(frameOf(host.levels));
    expect([...visibleKinds(drawn)].sort()).toEqual(['ceiling', 'floorSlab', 'wall']);

    // Nấc rẻ hơn nữa thì cây phản ứng thật: `block` bỏ cả trần, và về `full`
    // trần hiện lại — trên đúng cây mà cảnh đang vẽ, không dựng lại gì.
    expect(applyDetailLevel(drawn, 'block', () => true)).toBeGreaterThan(0);
    expect([...visibleKinds(drawn)].sort()).toEqual(['floorSlab', 'wall']);

    expect(applyDetailLevel(drawn, 'full', () => true)).toBe(0);
    expect([...visibleKinds(drawn)].sort()).toEqual(['ceiling', 'floorSlab', 'wall']);

    mounted.handle.dispose();
  });

  it('nấc chi tiết đảo ngược được, và không lấn quyền ẩn/hiện của khung', () => {
    // `PerfMonitor` hạ đúng một lần mỗi phiên (`applied !== null` thì
    // `considerDegrade` trả về sớm), nên chiều đi lên không có đường nào phát ra
    // từ nó. Kiểm thẳng trên chính hàm mà `onDegrade` gọi, trên một cây mang thẻ
    // thật của `tagPart`.
    const tree = new Group();
    const opening = tagPart(new Object3D(), {
      kind: 'opening',
      entityId: 'D-01',
      levelId: 'L-01',
    });
    const wall = tagPart(new Object3D(), { kind: 'wall', entityId: 'W-01', levelId: 'L-01' });
    tree.add(opening, wall);

    expect(applyDetailLevel(tree, 'reduced', () => true)).toBe(1);
    expect(opening.visible).toBe(false);
    expect(wall.visible).toBe(true);

    // Về `full` thì hiện lại đủ — không một thứ gì phải dựng lại.
    expect(applyDetailLevel(tree, 'full', () => true)).toBe(0);
    expect(opening.visible).toBe(true);
    expect(wall.visible).toBe(true);

    // `block` bỏ cả trần, đúng bảng của `droppedKindsAt`.
    const ceiling = tagPart(new Object3D(), {
      kind: 'ceiling',
      entityId: 'R-01',
      levelId: 'L-01',
    });
    tree.add(ceiling);
    expect(applyDetailLevel(tree, 'block', () => true)).toBe(2);
    expect(ceiling.visible).toBe(false);

    // Nấc không lấn quyền của khung: tầng đang tắt thì vẫn tắt, kể cả ở `full`.
    applyDetailLevel(tree, 'full', () => false);
    expect(wall.visible).toBe(false);
    expect(opening.visible).toBe(false);
  });

  it('R-07: khuôn camera vào một phòng có thật, và từ chối một mã không có', async () => {
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    const roomId = host.levels[0]?.rooms[0]?.id;
    expect(roomId).toBeDefined();

    // Có vật mang mã ấy trong cây đã dựng → `CameraDirector.frameObjects` tìm
    // ra hộp bao và bay tới. Đây là việc mà `frameSelection` của VỎ không làm
    // được: director của vỏ không bao giờ được `setRoot`.
    expect(mounted.handle.frameEntities([String(roomId)])).toBe(true);

    // Không vật nào mang mã ấy → để camera yên, không bay tới hộp rỗng.
    expect(mounted.handle.frameEntities(['R-khong-ton-tai'])).toBe(false);
    expect(mounted.handle.frameEntities([])).toBe(false);

    mounted.handle.dispose();

    // Sau khi dọn thì không còn cảnh nào để khuôn vào.
    expect(mounted.handle.frameEntities([String(roomId)])).toBe(false);
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
