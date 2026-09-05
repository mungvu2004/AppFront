/**
 * [U7] `useViewer3D` là NGƯỜI TIÊU THỤ bản nháp — và phép hợp nhất xảy ra ở đây.
 *
 * `src/lib` không được import store (mục 0.4), nên tầng dựng cảnh không thể tự
 * đọc `draftOperations`. Bài kiểm này đo đúng cái ranh giới ấy: bản nháp vào kho
 * ở một đầu, và ra ở đầu kia dưới dạng DỮ LIỆU THUẦN — một `BuildFloorInput` đã
 * cắt nhỏ — đi qua `ViewerSceneHandle.preview`.
 *
 * Con số quan trọng nhất ở đây là **số lần cảnh được lắp lại**: nếu bản nháp đi
 * qua `levels` thì ba mươi bước kéo sẽ là ba mươi lượt `dispose` + ba mươi lượt
 * dựng lại qua worker. Bài kiểm đòi con số ấy đúng bằng 1.
 */

import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Wall } from '@/domain/spatial/types';
import { renderWithProviders } from '@/lib/testing/render';
import { discardPreview, previewEdit } from '@/store/commit';
import { useStore } from '@/store';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { useViewer3D } from './useViewer3D';
import type {
  MountViewerScene,
  UseViewer3DOptions,
  ViewerScenePreview,
  ViewerSceneStatus,
} from './viewer3dTypes';

/** Số bước của lượt kéo — cùng con số mà bài kiểm cảnh 3D và của kho dùng. */
const DRAG_STEP_COUNT = 30;

const READY_STATUS: ViewerSceneStatus = {
  phase: 'ready',
  progress: { settledCount: 0, totalCount: 0, failedCount: 0, readyLevelIds: [] },
};

const FRAME: ViewerSceneFrame = {
  azimuthRad: 0.8,
  polarRad: 1,
  distanceM: 40,
  isOrthographic: false,
  visibleStoreyIds: [],
  separation: 0,
  sectionPlane: null,
  selectedEntityIds: [],
  hoveredEntityId: null,
  isolatedEntityIds: null,
  hiddenEntityIds: [],
  reducedMotion: true,
};

interface SceneSpy {
  readonly mount: MountViewerScene;
  readonly mounts: () => number;
  readonly previews: () => readonly (ViewerScenePreview | null)[];
}

/** Cảnh giả: không three, không WebGL — chỉ đếm ai gọi nó và gọi với cái gì. */
function sceneSpy(): SceneSpy {
  let mounts = 0;
  const previews: (ViewerScenePreview | null)[] = [];

  return {
    mount: () => {
      mounts += 1;

      return {
        ok: true,
        handle: {
          update: () => undefined,
          status: () => READY_STATUS,
          frameEntities: () => false,
          preview: (next) => {
            previews.push(next);

            return next === null ? 0 : next.model.walls.length;
          },
          frameRate: () => ({ averageFps: 0, durationMs: 0, triangleCount: 0 }),
          dispose: () => undefined,
        },
      };
    },
    mounts: () => mounts,
    previews: () => previews,
  };
}

/** Một component không vẽ gì: nó chỉ để hook chạy trong một cây React thật. */
function Probe({ options }: { readonly options: UseViewer3DOptions }): null {
  useViewer3D(options);

  return null;
}

const firstSampleWall = (): Wall => {
  const wall = createSampleBuilding().walls.at(0);

  if (wall === undefined) {
    throw new Error('sample building has no walls');
  }

  return wall;
};

describe('[U7] useViewer3D — người tiêu thụ bản nháp', () => {
  beforeEach(() => {
    // Cùng đường gieo dữ liệu mà mọi bài kiểm màn khác dùng: `setSpatial` của
    // kho, không phải `setState` thô (A10, `local/no-direct-set`).
    useStore.getState().setSpatial(normalizeSpatial(createSampleBuilding()), 'v-test');
    discardPreview();
  });

  afterEach(() => {
    discardPreview();
  });

  it('ba mươi bước kéo: ba mươi lượt xem trước, MỘT lượt lắp cảnh', async () => {
    const spy = sceneSpy();
    const canvas = document.createElement('canvas');

    const { unmount } = renderWithProviders(
      <Probe
        options={{
          projectId: 'P-000000001',
          canvas,
          frame: FRAME,
          mountScene: spy.mount,
        }}
      />,
      { keepStore: true },
    );

    await waitFor(() => {
      expect(spy.mounts()).toBe(1);
    });

    const wall = firstSampleWall();
    const mountsBefore = spy.mounts();
    // Lúc cảnh vừa gắn, hook đẩy xuống trạng thái xem trước hiện thời (rỗng);
    // lượt kéo được đếm từ đó, không từ số không.
    const previewsBefore = spy.previews().length;

    for (let step = 0; step < DRAG_STEP_COUNT; step += 1) {
      const thicknessMm = wall.thicknessMm + (step + 1) * 10;

      act(() => {
        previewEdit(wall.id, { ...wall, thicknessMm });
      });

      await waitFor(() => {
        expect(spy.previews().length - previewsBefore).toBe(step + 1);
      });

      const latest = spy.previews().at(-1);

      // Hình học ĐI XUỐNG cảnh mang đúng con số đang kéo, ở mỗi bước.
      expect(latest?.entityIds).toStrictEqual([wall.id]);
      expect(latest?.model.walls).toHaveLength(1);
      expect(latest?.model.walls[0]?.thicknessMm).toBe(thicknessMm);
      expect(latest?.model.walls[0]?.id).toBe(wall.id);
    }

    // Con số của cả bài: cảnh KHÔNG bị lắp lại một lần nào. Bản nháp không đi
    // qua `levels`, nên `BuildQueue` không dừng lại và dựng lại từ đầu.
    expect(spy.mounts()).toBe(mountsBefore);
    expect(spy.previews().length - previewsBefore).toBe(DRAG_STEP_COUNT);

    // Thả tay / huỷ: cảnh được bảo bỏ hình tạm đi.
    act(() => {
      discardPreview();
    });

    await waitFor(() => {
      expect(spy.previews().at(-1)).toBeNull();
    });

    expect(spy.mounts()).toBe(mountsBefore);

    console.log(
      `[VIEWER3D][U7] ${String(DRAG_STEP_COUNT)} bước kéo → ` +
        `${String(spy.previews().length - previewsBefore - 1)} lượt xem trước + 1 lượt bỏ, ` +
        `số lần lắp cảnh = ${String(spy.mounts())}`,
    );

    unmount();
  });

  it('bản nháp trên tầng khác không kéo theo vật của tầng đang xem trước', async () => {
    const spy = sceneSpy();
    const canvas = document.createElement('canvas');
    const graph = createSampleBuilding();
    const [first, second] = graph.walls;

    if (first === undefined || second === undefined) {
      throw new Error('sample building needs two walls');
    }

    const { unmount } = renderWithProviders(
      <Probe
        options={{ projectId: 'P-000000001', canvas, frame: FRAME, mountScene: spy.mount }}
      />,
      { keepStore: true },
    );

    await waitFor(() => {
      expect(spy.mounts()).toBe(1);
    });

    act(() => {
      previewEdit(first.id, { ...first, thicknessMm: first.thicknessMm + 40 });
      previewEdit(second.id, { ...second, thicknessMm: second.thicknessMm + 40 });
    });

    await waitFor(() => {
      expect(spy.previews().length).toBeGreaterThan(0);
    });

    const latest = spy.previews().at(-1);

    // Một bản xem trước nói về ĐÚNG MỘT tầng — tầng của vật đầu tiên trong bản
    // nháp — và chỉ mang những vật nằm trên tầng ấy.
    expect(latest?.levelId).toBe(String(latest?.model.level.id));
    expect(latest?.entityIds.length).toBeGreaterThan(0);
    expect(latest?.model.walls.length).toBe(latest?.entityIds.length);

    unmount();
  });

  it('đồ thị tiêm vào (story, bài kiểm) không bị trộn với bản nháp của kho', async () => {
    const spy = sceneSpy();
    const canvas = document.createElement('canvas');
    const wall = firstSampleWall();

    const { unmount } = renderWithProviders(
      <Probe
        options={{
          projectId: 'P-000000001',
          canvas,
          frame: FRAME,
          mountScene: spy.mount,
          spatial: normalizeSpatial(createSampleBuilding()),
        }}
      />,
      { keepStore: true },
    );

    await waitFor(() => {
      expect(spy.mounts()).toBe(1);
    });

    act(() => {
      previewEdit(wall.id, { ...wall, thicknessMm: wall.thicknessMm + 100 });
    });

    // Người gọi truyền đồ thị vào thì thứ hiện lên là đồ thị ấy, nguyên vẹn.
    await waitFor(() => {
      expect(spy.previews().every((preview) => preview === null)).toBe(true);
    });

    unmount();
  });
});
