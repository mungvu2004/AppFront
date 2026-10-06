/**
 * Bài kiểm của HOOK màn tách tầng: thanh trạng thái nói đúng điều khung nhìn
 * đang làm (NO-391). Màn ra `loading` khi cảnh của nó còn dựng, nên câu "đã dựng
 * xong" của vỏ — thứ chỉ biết lượt nạp của vỏ — phải nhường.
 */

import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';
import {
  createViewerShellFixtureGateway,
  ViewerShell,
  VIEWER_FIXTURE_SPATIAL,
} from '@/screens/viewer/ViewerShell';
import type { ViewerSceneStatus } from '@/screens/viewer/Viewer3D/viewer3dTypes';

import { createExplodedViewFixtureGateway } from './explodedViewGateway';
import type { ExplodedSceneMountOptions, MountExplodedScene } from './explodedViewScene';
import { useExplodedView, type UseExplodedViewScreenOptions } from './useExplodedView';

import type { ReactElement } from 'react';

function Harness(props: UseExplodedViewScreenOptions): ReactElement {
  return <ViewerShell {...useExplodedView(props)} />;
}

function statusOf(phase: ViewerSceneStatus['phase'], settled: number): ViewerSceneStatus {
  return {
    phase,
    progress: { settledCount: settled, totalCount: 1, failedCount: 0, readyLevelIds: settled === 1 ? ['L-1'] : [] },
  };
}

/** Cảnh giả: lắp được, ghi lại lượt lắp để bài kiểm tự đẩy pha dựng. */
function sceneSpy(): { readonly mount: MountExplodedScene; readonly calls: ExplodedSceneMountOptions[] } {
  const calls: ExplodedSceneMountOptions[] = [];
  const mount: MountExplodedScene = (_canvas, options) => {
    calls.push(options);

    return {
      ok: true,
      handle: {
        update: () => undefined,
        status: () => statusOf('ready', 1),
        motion: () => ({ shownSeparation: 0, targetSeparation: 0, phase: 'idle', isRunning: false, supersededCount: 0 }),
        frameRate: () => ({ averageFps: 0, minFps: 0, durationMs: 0, triangleCount: 0 }),
        detailByStorey: () => new Map(),
        capture: () => null,
        dispose: () => undefined,
      },
    };
  };

  return { mount, calls };
}

describe('useExplodedView — thanh trạng thái không nói "đã dựng xong" khi cảnh còn dựng (NO-391)', () => {
  it('pha building: "Đang dựng mô hình…"; pha ready: câu của vỏ trở lại', async () => {
    const spy = sceneSpy();
    renderWithProviders(
      <Harness
        gateway={createExplodedViewFixtureGateway()}
        mountScene={spy.mount}
        projectId="P-1"
        shellGateway={createViewerShellFixtureGateway()}
        spatial={VIEWER_FIXTURE_SPATIAL}
      />,
    );

    await waitFor(() => {
      expect(spy.calls.length).toBeGreaterThan(0);
    });
    await screen.findAllByText('Mô hình đã dựng xong.');

    act(() => {
      spy.calls.at(-1)?.onStatusChange?.(statusOf('building', 0));
    });

    expect(screen.getAllByText('Đang dựng mô hình…').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Mô hình đã dựng xong.')).toHaveLength(0);

    act(() => {
      spy.calls.at(-1)?.onStatusChange?.(statusOf('ready', 1));
    });

    expect(screen.queryAllByText('Đang dựng mô hình…')).toHaveLength(0);
  });
});
