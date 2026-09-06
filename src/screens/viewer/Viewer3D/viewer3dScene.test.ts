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
 * 7. [U7] Kênh xem trước: hình học đổi TRONG LÚC KÉO mà không một job dựng nào
 *    chạy lại, một lượt gọi tốn đúng một khung hình, và bản đồ bóng không bị vẽ
 *    lại lần nào trong suốt lượt kéo.
 *
 * Dữ liệu lấy từ `src/lib/testing/fixtures` (R-70): bộ mẫu chuẩn 4 tầng · 48
 * tường · 14 phòng · 248,60 m² của A14, không phải một mô hình bịa tại chỗ.
 */

import { Box3, Group, Object3D, Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { LevelId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import {
  respondTo,
  type BuildRequestMessage,
  type BuildResponseMessage,
} from '@/lib/three/build/build.worker';
import { planFullBuild, type BuildWorkerLike } from '@/lib/three/build/buildQueue';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { readPartData, tagPart, type BuildPartKind } from '@/lib/three/build/scene';
import { narrowFloorInput } from '@/lib/three/preview/previewModel';
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
  readonly renders: () => number;
  readonly shadowRenders: () => number;
} {
  let disposals = 0;
  let drawn: Object3D | null = null;
  let renders = 0;
  let shadowRenders = 0;

  const renderer = {
    info: { render: { calls: 0, triangles: 0 } },
    shadowMap: { type: 0, enabled: false, autoUpdate: true, needsUpdate: false },
    clippingPlanes: [] as unknown[],
    setSize: () => undefined,
    setPixelRatio: () => undefined,
    render: (scene: unknown) => {
      drawn = scene as Object3D;
      renders += 1;

      // Cùng phép đếm mà `present/__tests__/mount.test.ts` dùng: một lượt vẽ
      // bản đồ bóng xảy ra khi `autoUpdate` bật, hoặc khi ai đó vừa bật
      // `needsUpdate` — và cờ ấy tự tắt sau lượt vẽ, đúng như three làm.
      if (renderer.shadowMap.autoUpdate || renderer.shadowMap.needsUpdate) {
        shadowRenders += 1;
        renderer.shadowMap.needsUpdate = false;
      }
    },
    dispose: () => {
      disposals += 1;
    },
    forceContextLoss: () => undefined,
    disposals: () => disposals,
    drawn: () => drawn,
    renders: () => renders,
    shadowRenders: () => shadowRenders,
  };

  return renderer;
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

/* -------------------------------------------------------------------------- */
/* [U7] Kênh xem trước 3D thời gian thực.                                      */
/* -------------------------------------------------------------------------- */

/** Một lượt kéo dài bằng chừng này bước — đủ dài để một lỗi vòng vẽ lộ ra. */
const DRAG_STEP_COUNT = 30;

/** Độ dày đầu và bước tăng của lượt kéo, tính bằng milimét. */
const DRAG_FROM_MM = 220;
const DRAG_STEP_MM = 10;

/** Diện tích hình chiếu bằng của một cây — lớn lên khi tường dày lên. */
function footprintOf(root: Object3D): number {
  const box = new Box3().setFromObject(root);

  if (box.isEmpty()) {
    return 0;
  }

  const size = box.getSize(new Vector3());

  return size.x * size.z;
}

/** Mọi mesh mang mã này, kèm việc nó có đang được vẽ hay không. */
function meshesOf(root: Object3D, entityId: string): readonly Object3D[] {
  const found: Object3D[] = [];

  root.traverse((object) => {
    if (readPartData(object)?.entityId === entityId) {
      found.push(object);
    }
  });

  return found;
}

describe('[U7] mountViewerScene.preview', () => {
  let host: Harness;

  beforeEach(() => {
    host = harness();
  });

  /**
   * Lắp cảnh với một lịch vẽ mà bài kiểm cầm, và ở chế độ GIẢM CHUYỂN ĐỘNG.
   *
   * Giảm chuyển động đóng cổng `motion`, và đó là chế độ duy nhất mà "một lượt
   * gọi = một khung hình" đo được thành một con số: vòng vẽ lúc ấy không tự
   * tick, nó chỉ vẽ đúng những khung mà ai đó xin qua `invalidate`. Với chuyển
   * động bật, vòng vẽ của khung nhìn 3D vốn đã chạy liên tục dưới trần 60 fps —
   * người dùng đang xoay một toà nhà bằng chuột — nên đếm khung ở đó chỉ đo cái
   * trần ấy, không đo ảnh hưởng của xem trước.
   */
  function mountParked(): {
    readonly mounted: ReturnType<typeof mountViewerScene>;
    readonly pump: () => number;
  } {
    let pending: ((nowMs: number) => void) | null = null;
    let clockMs = 0;

    const mounted = mountViewerScene(host.canvas, {
      levels: host.levels,
      frame: { ...frameOf(host.levels), reducedMotion: true },
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
      onStatusChange: (status) => host.seen.push(status),
    });

    /** Chạy hết những khung đang chờ; trả về số khung đã chạy. */
    const pump = (): number => {
      let ran = 0;

      while (pending !== null && ran < DRAG_STEP_COUNT * 2) {
        const callback = pending;
        pending = null;
        clockMs += 1;
        callback(clockMs);
        ran += 1;
      }

      return ran;
    };

    return { mounted, pump };
  }

  it('mô hình đổi TRONG LÚC KÉO: không job nào dựng lại, một khung cho một bước, bóng vẽ 0 lần', async () => {
    const { mounted, pump } = mountParked();

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    const { handle } = mounted;

    await vi.waitFor(() => {
      expect(handle.status().phase).toBe('ready');
    });

    pump();

    const level = host.levels[0];
    const wall = level?.walls[0];

    if (level === undefined || wall === undefined) {
      throw new Error('bộ mẫu phải có ít nhất một tường trên tầng đầu');
    }

    const wallId = String(wall.id);
    const builtJobs = handle.status().progress;
    const rendersBefore = host.renderer.renders();
    const shadowBefore = host.renderer.shadowRenders();

    /* ---- Lượt kéo: ba mươi bước, mỗi bước dày thêm 10 mm ------------------ */

    const footprints: number[] = [];
    let framesDuringDrag = 0;

    for (let step = 0; step < DRAG_STEP_COUNT; step += 1) {
      const thicknessMm = millimetres(DRAG_FROM_MM + step * DRAG_STEP_MM);
      const previewed = { ...level, walls: [{ ...wall, thicknessMm }] };

      const meshCount = handle.preview({
        levelId: String(level.level.id),
        entityIds: [wallId],
        model: narrowFloorInput(previewed, [wall.id]),
      });

      expect(meshCount).toBeGreaterThan(0);

      framesDuringDrag += pump();

      const scene = host.renderer.drawn();

      if (scene === null) {
        throw new Error('phải có một cảnh được vẽ');
      }

      const shown = meshesOf(scene, wallId).filter((object) => object.visible);

      // Đúng MỘT bức tường mang mã ấy đang được vẽ: bản xem trước. Mesh thật
      // vẫn nằm nguyên trên cây, chỉ bị ẩn — bỏ xem trước là hiện lại nó.
      expect(shown).toHaveLength(1);

      const drawnWall = shown[0];

      if (drawnWall === undefined) {
        throw new Error('bức tường xem trước phải đang được vẽ');
      }

      footprints.push(footprintOf(drawnWall));
    }

    /* ---- Ba con số ------------------------------------------------------- */

    const rebuilt = handle.status().progress;

    // (1) Không một job dựng nào chạy lại: `BuildQueue` không hề biết chuyện
    //     này xảy ra, và cảnh không rơi về `building` một lần nào.
    expect(rebuilt.totalCount).toBe(builtJobs.totalCount);
    expect(rebuilt.settledCount).toBe(builtJobs.settledCount);
    expect(handle.status().phase).toBe('ready');

    // (2) Một lượt gọi = ĐÚNG một khung hình. Vòng vẽ không biến thành vòng
    //     chạy liên tục: ba mươi bước kéo tốn ba mươi khung, không hơn.
    expect(framesDuringDrag).toBe(DRAG_STEP_COUNT);
    expect(host.renderer.renders() - rendersBefore).toBe(DRAG_STEP_COUNT);

    // (3) Bản đồ bóng KHÔNG vẽ lại lần nào trong suốt lượt kéo.
    expect(host.renderer.shadowRenders() - shadowBefore).toBe(0);

    // (4) Và hình học thật sự đổi ở từng bước: hình chiếu bằng của bức tường
    //     lớn dần đúng theo con số đang kéo.
    expect(footprints).toHaveLength(DRAG_STEP_COUNT);
    for (let step = 1; step < footprints.length; step += 1) {
      expect(footprints[step]).toBeGreaterThan(Number(footprints[step - 1]));
    }

    console.log(
      `[VIEWER3D][U7] ${String(DRAG_STEP_COUNT)} bước kéo ` +
        `(${String(DRAG_FROM_MM)} → ${String(DRAG_FROM_MM + (DRAG_STEP_COUNT - 1) * DRAG_STEP_MM)} mm): ` +
        `khung hình vẽ = ${String(framesDuringDrag)}, ` +
        `lượt vẽ bản đồ bóng = ${String(host.renderer.shadowRenders() - shadowBefore)}, ` +
        `job dựng chạy lại = ${String(rebuilt.totalCount - builtJobs.totalCount)}, ` +
        `hình chiếu bằng ${String(footprints[0])} → ${String(footprints.at(-1))} m²`,
    );

    handle.dispose();
  });

  it('bỏ xem trước là gỡ MỘT nhóm: mesh thật hiện lại, không dựng lại gì', async () => {
    const { mounted, pump } = mountParked();

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    const { handle } = mounted;

    await vi.waitFor(() => {
      expect(handle.status().phase).toBe('ready');
    });

    pump();

    const level = host.levels[0];
    const wall = level?.walls[0];

    if (level === undefined || wall === undefined) {
      throw new Error('bộ mẫu phải có ít nhất một tường trên tầng đầu');
    }

    const wallId = String(wall.id);
    const before = handle.status().progress.totalCount;

    handle.preview({
      levelId: String(level.level.id),
      entityIds: [wallId],
      model: narrowFloorInput(
        { ...level, walls: [{ ...wall, thicknessMm: millimetres(400) }] },
        [wall.id],
      ),
    });
    pump();

    const scene = host.renderer.drawn();

    if (scene === null) {
      throw new Error('phải có một cảnh được vẽ');
    }

    expect(meshesOf(scene, wallId).filter((object) => object.visible)).toHaveLength(1);
    expect(meshesOf(scene, wallId).length).toBeGreaterThan(1);

    // Bỏ xem trước.
    expect(handle.preview(null)).toBe(0);
    expect(pump()).toBe(1);

    const after = meshesOf(scene, wallId);

    // Chỉ còn mesh THẬT, và nó được vẽ trở lại.
    expect(after).toHaveLength(1);
    expect(after[0]?.visible).toBe(true);
    expect(handle.status().progress.totalCount).toBe(before);
    expect(handle.status().phase).toBe('ready');

    handle.dispose();
  });

  it('một khung mới của vỏ giữa lúc kéo không làm bức tường thật hiện lại', async () => {
    const { mounted, pump } = mountParked();

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    const { handle } = mounted;

    await vi.waitFor(() => {
      expect(handle.status().phase).toBe('ready');
    });

    pump();

    const level = host.levels[0];
    const wall = level?.walls[0];

    if (level === undefined || wall === undefined) {
      throw new Error('bộ mẫu phải có ít nhất một tường trên tầng đầu');
    }

    const wallId = String(wall.id);

    handle.preview({
      levelId: String(level.level.id),
      entityIds: [wallId],
      model: narrowFloorInput(
        { ...level, walls: [{ ...wall, thicknessMm: millimetres(400) }] },
        [wall.id],
      ),
    });
    pump();

    // Vỏ đổi khung giữa lúc kéo — chọn một vật, tách tầng — và `applyFrame`
    // tính lại `visible` từ đầu.
    handle.update({
      ...frameOf(host.levels),
      reducedMotion: true,
      selectedEntityIds: [wallId],
      separation: 2,
    });
    pump();

    const scene = host.renderer.drawn();

    if (scene === null) {
      throw new Error('phải có một cảnh được vẽ');
    }

    expect(meshesOf(scene, wallId).filter((object) => object.visible)).toHaveLength(1);

    handle.dispose();
  });

  it('dispose() sau một lượt xem trước vẫn trả hết tài nguyên', async () => {
    const before = host.ledger.counts;
    const { mounted, pump } = mountParked();

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    const { handle } = mounted;

    await vi.waitFor(() => {
      expect(handle.status().phase).toBe('ready');
    });

    const level = host.levels[0];
    const wall = level?.walls[0];

    if (level === undefined || wall === undefined) {
      throw new Error('bộ mẫu phải có ít nhất một tường trên tầng đầu');
    }

    handle.preview({
      levelId: String(level.level.id),
      entityIds: [String(wall.id)],
      model: narrowFloorInput(
        { ...level, walls: [{ ...wall, thicknessMm: millimetres(400) }] },
        [wall.id],
      ),
    });
    pump();

    handle.dispose();

    for (const resource of TRACKED_RESOURCES) {
      expect(host.ledger.counts[resource]).toBe(before[resource]);
    }

    // Gọi khi đã dọn: không ném, không vẽ thêm.
    expect(handle.preview(null)).toBe(0);
  });
});
