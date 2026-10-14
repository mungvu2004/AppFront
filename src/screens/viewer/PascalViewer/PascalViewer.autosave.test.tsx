/**
 * Lượt sửa trong Pascal phải tới AppBack (F-15 R2).
 *
 * Lỗi gốc: editor báo "Đã lưu" bằng bộ tự lưu nội bộ của vendor, `usePascalEdits`
 * làm kho bẩn, nhưng màn không gắn bộ tự lưu tầng nào — không PUT
 * `…/spatial/layer`, tải lại là mất. Bài này dựng container thật, sửa độ dày
 * một tường qua đúng cửa `onSceneCommit` mà editor gọi, và đòi một lời gọi ghi.
 */

import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient, simulateRemoteLayerEdit } from '@/api/__mocks__/client';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { __resetFloorLayerSavers } from '@/hooks/useAutosave';
import { appNotificationBus } from '@/hooks/useNotifications';
import { toPascalScene } from '@/lib/pascal/toPascal';
import type { PascalScene } from '@/lib/pascal/types';
import { renderWithProviders } from '@/lib/testing/render';
import { useStore } from '@/store';

import { PascalViewerContainer, PASCAL_SAVE_FAILED_TITLE } from './PascalViewer.container';
import { PASCAL_MASS_DELETE_TITLE } from './PascalViewerOverlays';

const PROJECT = 'P-1';
const GRAPH = createSampleBuilding();
const SPATIAL = normalizeSpatial(GRAPH);
const SCENE = toPascalScene(GRAPH).scene;

/** Cảnh nền, tường đầu tiên dày 330 mm — đúng thao tác của bước 8c chuỗi e2e. */
const thickened = (): PascalScene => {
  const wall = Object.values(SCENE.nodes).find((node) => node.type === 'wall');

  if (wall === undefined || wall.type !== 'wall') throw new Error('bộ mẫu phải có tường');

  return { nodes: { ...SCENE.nodes, [wall.id]: { ...wall, thickness: 0.33 } }, rootNodeIds: SCENE.rootNodeIds };
};

/** Câu lưu của màn — thẻ `<p>`, không phải vùng đọc của trình đọc màn hình (`<div>`). */
const saveCaption = (): string | null =>
  screen.getAllByRole('status').find((node) => node.tagName === 'P' && /lưu/i.test(node.textContent ?? ''))
    ?.textContent ?? null;

const tick = async (ms = 0): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** Gói vách ngăn giả; giữ lại `onSceneCommit` để bài kiểm đóng vai editor. */
const stubMount = () => {
  const handle: {
    commit: ((scene: PascalScene) => Promise<void>) | null;
    validate: ((scene: PascalScene) => { ok: boolean }) | null;
    deleteNodes: ReturnType<typeof vi.fn>;
  } = { commit: null, validate: null, deleteNodes: vi.fn() };
  const loadMount = () =>
    Promise.resolve({
      mount: (_element: HTMLElement, options: Record<string, unknown>) => {
        handle.commit = options['onSceneCommit'] as (scene: PascalScene) => Promise<void>;
        handle.validate = options['validateCommit'] as (scene: PascalScene) => { ok: boolean };
        (options['onReadyChange'] as (ready: boolean) => void)(true);

        return { dispose: () => undefined, deleteNodes: handle.deleteNodes };
      },
    });

  return { handle, loadMount: loadMount as never };
};

const renderScreen = (apiClient: ReturnType<typeof createMockApiClient>) => {
  const bench = stubMount();

  renderWithProviders(
    <MemoryRouter>
      <PascalViewerContainer
        graph={GRAPH}
        projectId={PROJECT}
        apiClient={apiClient}
        readOnly={false}
        loadMount={bench.loadMount}
      />
    </MemoryRouter>,
    { keepStore: true },
  );

  return bench;
};

/** Editor gửi cảnh đã sửa — chạy đủ đường `usePascalEdits` → dispatch → commit. */
const editWall = async (bench: ReturnType<typeof stubMount>): Promise<void> => {
  await tick();
  await tick();
  if (bench.handle.commit === null) throw new Error('editor chưa được dựng');
  const commitScene = bench.handle.commit;
  await act(async () => {
    await commitScene(thickened());
  });
};

describe('PascalViewer — lượt sửa đi qua bộ tự lưu tầng', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetFloorLayerSavers();
    __resetMockLayerState();
    useStore.getState().setSpatial(SPATIAL, 'v-test', {
      floorRevisions: Object.fromEntries(SPATIAL.byKind.level.map((id) => [id, 0])),
      projectId: PROJECT,
    });
  });

  afterEach(() => {
    __resetFloorLayerSavers();
    act(() => {
      useStore.getState().setSpatial(null, null);
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sửa độ dày tường → PUT lớp tầng sau 800 ms, và câu lưu là giờ lưu thật', async () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const bench = renderScreen(apiClient);

    await editWall(bench);
    expect(writeLayer).not.toHaveBeenCalled();

    await tick(800);
    await tick();

    expect(writeLayer).toHaveBeenCalledTimes(1);
    expect(saveCaption()).toMatch(/^Đã lưu lúc \d{2}:\d{2}$/);
  });

  it('máy chủ không nhận → toast lỗi và câu lưu nói lưu hỏng, không "Đã lưu"', async () => {
    const apiClient = createMockApiClient();
    vi.spyOn(apiClient.spatial, 'writeLayer').mockRejectedValue(new Error('máy chủ sập'));
    const publish = vi.spyOn(appNotificationBus, 'publish');
    const bench = renderScreen(apiClient);

    await editWall(bench);
    // Lỗi tạm thì engine thử lại 5/15/45 s trước khi chịu "failed".
    await tick(800);
    await tick(70_000);

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ title: PASCAL_SAVE_FAILED_TITLE }));
    expect(saveCaption()).toMatch(/^Lưu thất bại/);
  });

  it('23-B-029 — 409 → nút "Tải lại"; còn sửa chưa lưu thì bấm mở hộp thoại A9', async () => {
    const apiClient = createMockApiClient();
    const bench = renderScreen(apiClient);

    for (const levelId of SPATIAL.byKind.level) simulateRemoteLayerEdit(levelId);
    await editWall(bench);
    await tick(800);
    await tick();

    expect(screen.getByText(/vừa được sửa ở nơi khác/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    await tick();
    await tick();

    expect(screen.getByText('Bỏ thay đổi chưa lưu của tầng này?')).toBeInTheDocument();
  });

  it('23-A-026 — cổng chặn xoá hàng loạt → hộp xác nhận; "Xoá" cho editor xoá lại đúng các node ấy', async () => {
    const bench = renderScreen(createMockApiClient());
    await tick();
    await tick();
    const walls = Object.values(SCENE.nodes).filter((node) => node.type === 'wall').map((node) => node.id);
    const gutted: PascalScene = {
      nodes: Object.fromEntries(Object.entries(SCENE.nodes).filter(([, node]) => node.type !== 'wall')),
      rootNodeIds: SCENE.rootNodeIds,
    };

    act(() => {
      expect(bench.handle.validate?.(gutted).ok).toBe(false);
    });
    await tick();
    await tick();

    expect(screen.getByRole('dialog')).toHaveTextContent(PASCAL_MASS_DELETE_TITLE);
    fireEvent.click(screen.getByRole('button', { name: 'Xoá' }));

    expect(bench.handle.deleteNodes).toHaveBeenCalledWith(expect.arrayContaining(walls));
  });
});
