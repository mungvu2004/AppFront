/**
 * Bài kiểm của module cảnh màn đo — không dựng màn nào, không cần React.
 *
 * Đó là cả lý do `measurementToolScene.ts` là một module `.ts` sở hữu renderer
 * thay vì một `useEffect` trong `.tsx`: mọi điều dưới đây kiểm được bằng một
 * canvas rỗng, một worker giả và một renderer giả.
 *
 * 1. Không có WebGL trả `ok: false` — không ném lỗi, không mã lỗi, không màn trắng.
 * 2. Tay cầm phơi ra đúng ba thứ `createScenePick` đòi, và `camera` là MỘT tham
 *    chiếu đứng yên qua mọi lượt `update`.
 * 3. Hình học có thuộc tính `normal` THẬT — điều kiện để `EntityHit.normal` khác
 *    `null` — và bắn một tia thật qua `createScenePick` trả về một `EntityHit`
 *    có cả `normal` lẫn `point`.
 * 4. `userData` của mesh theo đúng quy ước `readPartData` đọc, và mã thực thể
 *    qua được `selectableKindOf` — hai điều kiện `resolveHit` đòi.
 * 5. Vòng vẽ theo nhu cầu: cổng `motion` đóng, nên không khung hình nào được vẽ
 *    chỉ vì đồng hồ chạy; mỗi khung hình là hệ quả của một thứ đã đổi.
 * 6. Khung hình được tôn trọng: ẩn một thực thể là ẩn nó khỏi cả tia bắn.
 * 7. `dispose()` trả tài nguyên về đúng số ban đầu, đọc bằng `ResourceLedger.counts`,
 *    và an toàn khi gọi hai lần.
 *
 * Dữ liệu lấy từ `src/lib/testing/fixtures` (R-70): bộ mẫu chuẩn của A14, không
 * phải một mô hình bịa tại chỗ.
 */

import { BufferGeometry, Mesh, Object3D, Raycaster, Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { LevelId } from '@/domain/spatial/types';
import { selectableKindOf } from '@/lib/selection/selectionOps';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import {
  respondTo,
  type BuildRequestMessage,
  type BuildResponseMessage,
} from '@/lib/three/build/build.worker';
import type { BuildWorkerLike } from '@/lib/three/build/buildQueue';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { readPartData } from '@/lib/three/build/scene';
import { createScenePick } from '@/lib/three/interaction/raycast';
import { ResourceLedger } from '@/lib/three/perf/dispose';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { mountMeasurementScene } from './measurementToolScene';
import type {
  MeasurementRendererLike,
  MeasurementSceneStatus,
} from './measurementToolSceneTypes';

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
 * Trả lời thẳng trong `postMessage` sẽ khiến hàng đợi đẩy job kế tiếp ngay trong
 * ngăn xếp của job trước. Microtask cắt chuỗi ấy mà vẫn không cần đồng hồ giả.
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
function fakeRenderer(): MeasurementRendererLike & {
  readonly disposals: () => number;
  readonly drawn: () => Object3D | null;
  readonly renders: () => number;
} {
  let disposals = 0;
  let drawn: Object3D | null = null;
  let renders = 0;

  return {
    shadowMap: { type: 0, enabled: false, autoUpdate: true, needsUpdate: false },
    clippingPlanes: [] as unknown[],
    render: (scene: Object3D) => {
      drawn = scene;
      renders += 1;
    },
    setSize: () => undefined,
    dispose: () => {
      disposals += 1;
    },
    forceContextLoss: () => undefined,
    disposals: () => disposals,
    drawn: () => drawn,
    renders: () => renders,
  };
}

/**
 * Lịch vẽ tự lái: cất callback lại, và chỉ chạy khi bài kiểm bảo chạy.
 *
 * KHÔNG chạy đồng bộ ngay trong `schedule`. `createFrameLoop` viết
 * `parkedHandle = schedule(...)` và chính callback ấy đặt `parkedHandle = null`
 * (`present/frameLoop.ts:225-236`), nên một lịch chạy ngay đặt `null` TRƯỚC khi
 * phép gán trả về — và cái chốt ấy kẹt vĩnh viễn ở trạng thái "đang có khung
 * hình chờ", tức lượt vẽ thứ hai không bao giờ tới. Đó là một tật của lịch giả,
 * không phải của cảnh, và cách chữa là hoãn đúng như `requestAnimationFrame`.
 */
function manualClock(): {
  readonly schedule: (run: (nowMs: number) => void) => number;
  readonly cancel: (handle: number) => void;
  /** Chạy hết những gì đang chờ. Trả về số callback đã chạy. */
  readonly flush: () => number;
} {
  const pending = new Map<number, (nowMs: number) => void>();
  let handle = 0;

  return {
    schedule: (run) => {
      handle += 1;
      pending.set(handle, run);
      return handle;
    },
    cancel: (id) => {
      pending.delete(id);
    },
    flush: () => {
      const due = [...pending.entries()];
      pending.clear();

      for (const [id, run] of due) {
        run(id);
      }

      return due.length;
    },
  };
}

interface Harness {
  readonly canvas: HTMLCanvasElement;
  readonly levels: readonly BuildFloorInput[];
  readonly ledger: ResourceLedger;
  readonly seen: MeasurementSceneStatus[];
  readonly renderer: ReturnType<typeof fakeRenderer>;
  readonly clock: ReturnType<typeof manualClock>;
}

function harness(): Harness {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;

  return {
    canvas,
    levels: sampleLevels(),
    ledger: new ResourceLedger(),
    seen: [],
    renderer: fakeRenderer(),
    clock: manualClock(),
  };
}

function mount(
  host: Harness,
  frame: ViewerSceneFrame = frameOf(host.levels),
): ReturnType<typeof mountMeasurementScene> {
  return mountMeasurementScene(host.canvas, {
    levels: host.levels,
    frame,
    ledger: host.ledger,
    createRenderer: () => host.renderer,
    createWorker: () => new MicrotaskWorker(),
    schedule: host.clock.schedule,
    cancel: host.clock.cancel,
    // Không đọc `getComputedStyle`: token rỗng rơi về màu dự phòng, và bài kiểm
    // này không nói gì về màu.
    readToken: () => '',
    onStatusChange: (status) => host.seen.push(status),
  });
}

/** Mọi mesh đã dựng trong một cây. */
function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];

  root.traverse((object) => {
    if (object instanceof Mesh) {
      found.push(object);
    }
  });

  return found;
}

/* -------------------------------------------------------------------------- */
/* Bài kiểm.                                                                   */
/* -------------------------------------------------------------------------- */

describe('mountMeasurementScene', () => {
  let host: Harness;

  beforeEach(() => {
    host = harness();
  });

  it('không có WebGL thì trả ok:false chứ không ném lỗi', () => {
    const mounted = mountMeasurementScene(host.canvas, {
      levels: host.levels,
      frame: frameOf(host.levels),
      createRenderer: () => {
        throw new Error('no context');
      },
    });

    expect(mounted.ok).toBe(false);
    if (!mounted.ok) {
      expect(mounted.reason).toBe('webglUnavailable');
    }
  });

  it('phơi ra đúng ba thứ createScenePick đòi, và camera đứng yên', async () => {
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    const { handle } = mounted;
    const before = handle.camera;

    expect(handle.root).toBeInstanceOf(Object3D);
    expect(handle.viewport()).toEqual({ width: 800, height: 600 });

    await vi.waitFor(() => {
      expect(handle.status().phase).toBe('ready');
    });

    handle.update({ ...frameOf(host.levels), azimuthRad: 2, isOrthographic: true, polarRad: 0.2 });

    expect(handle.camera).toBe(before);

    handle.dispose();
  });

  it('dựng hình học MANG thuộc tính normal, không phải đường kẻ', async () => {
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    const meshes = meshesOf(mounted.handle.root);

    expect(meshes.length).toBeGreaterThan(0);

    for (const mesh of meshes) {
      expect(mesh.geometry).toBeInstanceOf(BufferGeometry);
      expect(mesh.geometry.getAttribute('normal')).toBeDefined();
      expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }

    mounted.handle.dispose();
  });

  it('gắn userData đúng quy ước readPartData đọc, với mã thực thể chọn được', async () => {
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    const meshes = meshesOf(mounted.handle.root);

    expect(meshes.length).toBeGreaterThan(0);

    for (const mesh of meshes) {
      const data = readPartData(mesh);

      expect(data).not.toBeNull();

      if (data === null) {
        continue;
      }

      expect(typeof data.levelId).toBe('string');
      // `resolveHit` bỏ qua mọi thực thể mà `selectableKindOf` trả `null`, nên
      // một mã sai tiền tố là một mesh không chấm điểm lên được.
      expect(selectableKindOf(data.entityId)).not.toBeNull();
    }

    mounted.handle.dispose();
  });

  it('một tia thật qua createScenePick trả về EntityHit có normal và point', async () => {
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    const { handle } = mounted;

    await vi.waitFor(() => {
      expect(handle.status().phase).toBe('ready');
    });

    // KHÔNG chạy lịch vẽ, và không tự cập nhật ma trận nào: bắn tia phải trúng
    // mà không cần một khung hình nào được vẽ trước. Hook bắn tia lúc con trỏ
    // nhúc nhích, tức giữa hai khung hình.
    expect(host.renderer.renders()).toBe(0);
    expect(meshesOf(handle.root).some((mesh) => mesh.visible)).toBe(true);

    // Bắn qua tâm khung nhìn, bằng chính camera của cảnh chứ không dựng một
    // camera thứ hai: camera ngắm vào tâm hộp bao, nên tia này xuyên qua mô
    // hình. Đó là đúng đường mà hook sẽ đi.
    const { width, height } = handle.viewport();
    const pick = createScenePick({
      camera: handle.camera,
      root: handle.root,
      viewport: handle.viewport,
    });

    const hit = pick({ x: width / 2, y: height / 2 });

    expect(hit).not.toBeNull();
    expect(hit?.point).toBeInstanceOf(Vector3);
    // Cả lý do cảnh phải dựng mặt: pháp tuyến chỉ tồn tại khi hình học có nó.
    expect(hit?.normal).not.toBeNull();
    expect(hit?.normal?.length()).toBeCloseTo(1);

    handle.dispose();
  });

  it('ẩn một thực thể là ẩn nó khỏi cả tia bắn', async () => {
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    const { handle } = mounted;

    await vi.waitFor(() => {
      expect(handle.status().phase).toBe('ready');
    });

    const first = meshesOf(handle.root)[0];
    const entityId = first === undefined ? null : readPartData(first)?.entityId;

    expect(entityId).toBeDefined();
    expect(first?.visible).toBe(true);

    handle.update({ ...frameOf(host.levels), hiddenEntityIds: [String(entityId)] });

    expect(first?.visible).toBe(false);

    handle.dispose();
  });

  it('không vẽ khung hình nào chỉ vì đồng hồ chạy — cổng motion đóng', async () => {
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    expect(mounted.handle.isResting()).toBe(true);

    host.clock.flush();

    const drawnSoFar = host.renderer.renders();

    expect(drawnSoFar).toBeGreaterThan(0);
    expect(host.renderer.drawn()).not.toBeNull();

    // Không một khung hình nào được hẹn thêm khi không có gì đổi: một vòng vẽ
    // còn tick sẽ luôn có một callback chờ sẵn ở đây.
    expect(host.clock.flush()).toBe(0);
    expect(host.renderer.renders()).toBe(drawnSoFar);

    mounted.handle.update(frameOf(host.levels));

    // Và đúng một khung hình cho một lượt đổi khung — không nhiều hơn.
    expect(host.clock.flush()).toBe(1);
    expect(host.renderer.renders()).toBe(drawnSoFar + 1);

    mounted.handle.dispose();
  });

  it('dispose() trả tài nguyên về mức ban đầu, và an toàn khi gọi hai lần', async () => {
    const before = host.ledger.counts;
    const mounted = mount(host);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    await vi.waitFor(() => {
      expect(mounted.handle.status().phase).toBe('ready');
    });

    expect(host.ledger.counts.geometries).toBeGreaterThan(before.geometries);

    mounted.handle.dispose();
    mounted.handle.dispose();

    expect(host.ledger.counts).toEqual(before);
    expect(host.renderer.disposals()).toBe(1);
  });

  it('không bắn tia được khi khung nhìn chưa có kích thước', () => {
    const blind = harness();
    blind.canvas.width = 0;
    blind.canvas.height = 0;

    const mounted = mount(blind);

    if (!mounted.ok) {
      throw new Error('cảnh phải lắp được với renderer giả');
    }

    const pick = createScenePick({
      camera: mounted.handle.camera,
      root: mounted.handle.root,
      viewport: mounted.handle.viewport,
      raycaster: new Raycaster(),
    });

    expect(mounted.handle.viewport()).toEqual({ width: 0, height: 0 });
    // Một canvas không có bề rộng không có clip space nào: `createScenePick` trả
    // `null` thay vì bắn một tia vào vô cực (`raycast.ts:222-227`).
    expect(pick({ x: 0, y: 0 })).toBeNull();

    mounted.handle.dispose();
  });
});
