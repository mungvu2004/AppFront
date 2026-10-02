/**
 * B-V6-09 — mã tường của bộ mẫu A14 (`W-WALL0000004`) và mã ULID của BE không có số
 * đếm ở sáu ký tự đầu, nên nhãn cũ cho mọi tường cùng một chữ. Dải "Đang sửa" phải
 * gọi mỗi tường bằng nhãn riêng của nó trên tầng.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { sampleWallId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { createHistoryStack } from '@/lib/commands/history';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { createTestQueryClient } from '@/lib/testing/render';
import { useStore } from '@/store';
import { resetCommitRun } from '@/store/commit';

import { useWallGeometryEditor } from './useWallGeometryEditor';
import { createWallGeometryEditorGateway } from './wallGeometryEditorGateway';
import { WALL_GEOMETRY_EDITOR_TEXT } from './wallGeometryEditorTypes';

afterEach(() => {
  cleanup();
  useStore.getState().setSpatial(null, null);
  resetCommitRun();
});

/** Nhãn dải "Đang sửa" của hook khi đang sửa đúng một tường. */
async function bandLabelOf(wallId: string): Promise<string> {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const gateway = createWallGeometryEditorGateway({ history: createHistoryStack() });
  const { result } = renderHook(
    () =>
      useWallGeometryEditor({
        canEdit: true,
        gateway,
        isCollapsed: false,
        isSectionOrthographic: false,
        onExitEditMode: () => undefined,
        onGeometryChanged: () => undefined,
        overlayElement: null,
        selectedWallIds: [wallId],
        wallId,
      }),
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.state.kind).toBe('success');
  });

  const state = result.current.state;

  if (state.kind !== 'success') {
    throw new Error('Trạng thái phải là success.');
  }

  return state.band.label;
}

describe('màn sửa hình học tường với mã bộ mẫu A14', () => {
  it('hai tường cùng tầng được gọi bằng hai nhãn khác nhau', async () => {
    useStore.getState().setSpatial(normalizeSpatial(createCleanBuildingScenario().graph), 'v-1');

    /* Tường 0 và 4 cùng tầng 0 (tầng của tường `n` là `n % 4`). */
    const first = await bandLabelOf(sampleWallId(0));
    cleanup();
    const second = await bandLabelOf(sampleWallId(4));

    expect(first).toBe(WALL_GEOMETRY_EDITOR_TEXT.band.editing('W-001'));
    expect(second).toBe(WALL_GEOMETRY_EDITOR_TEXT.band.editing('W-002'));
  });
});
