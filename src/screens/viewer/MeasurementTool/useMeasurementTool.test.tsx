/**
 * Bài kiểm của HOOK màn đo, phần vòng đời cảnh và phần phím tắt.
 *
 * Đây KHÔNG phải bài kiểm của view — `MeasurementTool.test.tsx` giữ phần ấy, và
 * nó dựng `MeasurementTool.container`. File này dựng thẳng hook trong một vỏ
 * bọc tối thiểu, vì ba khẳng định dưới đây chỉ nói được từ phía hook:
 *
 * 1. Hook TỰ LẮP cảnh — nó gọi `mountScene` với `levels` dựng từ đồ thị và với
 *    `frame` của vỏ, rồi `dispose()` đúng một lần khi rời cây.
 * 2. `mount.ok === false` (máy không có WebGL) là một NHÁNH: màn vẫn dựng, và
 *    không có lỗi nào ném ra (A11).
 * 3. `M` chỉ còn MỘT người đăng ký ở phạm vi `canvas` — của vỏ. Màn đã bỏ bản
 *    thứ hai, nên `findOverlaps()` không còn kể tên nó nữa.
 */

import { Group, PerspectiveCamera } from 'three';

import { describe, expect, it, vi } from 'vitest';

import { createShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { renderWithProviders } from '@/lib/testing/render';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import {
  createViewerShellFixtureGateway,
  ViewerShell,
  VIEWER_FIXTURE_SPATIAL,
} from '@/screens/viewer/ViewerShell';

import { createMeasurementToolFixtureGateway } from './measurementToolGateway';
import type {
  MeasurementSceneHandle,
  MeasurementSceneMount,
  MeasurementSceneMountOptions,
  MountMeasurementScene,
} from './measurementToolScene';
import { useMeasurementTool, type UseMeasurementToolOptions } from './useMeasurementTool';

import type { ReactElement } from 'react';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Cỡ khung nhìn giả — jsdom không bố trí gì, nên mọi phần tử là 0×0. */
const VIEWPORT = { width: 800, height: 600 };

interface SceneSpy {
  readonly mount: MountMeasurementScene;
  readonly calls: MeasurementSceneMountOptions[];
  readonly dispose: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
}

/** Module cảnh giả: ghi lại mọi lượt lắp, không đụng tới một GL context nào. */
function sceneSpy(ok = true): SceneSpy {
  const calls: MeasurementSceneMountOptions[] = [];
  const dispose = vi.fn();
  const update = vi.fn();

  const handle: MeasurementSceneHandle = {
    camera: new PerspectiveCamera(),
    root: new Group(),
    viewport: () => VIEWPORT,
    update,
    status: () => ({
      phase: 'ready',
      settledCount: 0,
      totalCount: 0,
      failedCount: 0,
      readyLevelIds: [],
    }),
    isResting: () => true,
    dispose,
  };

  const mount: MountMeasurementScene = (_canvas, options): MeasurementSceneMount => {
    calls.push(options);

    return ok ? { ok: true, handle } : { ok: false, reason: 'webglUnavailable' };
  };

  return { mount, calls, dispose, update };
}

function Harness(props: UseMeasurementToolOptions): ReactElement {
  const shellProps = useMeasurementTool(props);

  return <ViewerShell {...shellProps} />;
}

function renderHook(
  overrides: Partial<UseMeasurementToolOptions> & { readonly registry?: ShortcutRegistry } = {},
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Harness
      projectId="P-1"
      gateway={createMeasurementToolFixtureGateway()}
      shellGateway={createViewerShellFixtureGateway()}
      spatial={VIEWER_FIXTURE_SPATIAL}
      {...overrides}
    />,
  );
}

/* -------------------------------------------------------------------------- */
/* [1] Hook tự lắp cảnh.                                                       */
/* -------------------------------------------------------------------------- */

describe('useMeasurementTool — hook tự lắp cảnh, container không phải dựng lại nửa cái hook', () => {
  it('gọi mountScene đúng một lần, với những tầng dựng từ đồ thị và với frame của vỏ', () => {
    const spy = sceneSpy();

    renderHook({ mountScene: spy.mount });

    expect(spy.calls).toHaveLength(1);

    const [options] = spy.calls;

    expect(options?.levels.length).toBeGreaterThan(0);
    expect(options?.frame).toBeDefined();
  });

  it('canvas của cảnh nằm dưới lớp phủ, aria-hidden, và KHÔNG nhận con trỏ', () => {
    const spy = sceneSpy();

    const { container } = renderHook({ mountScene: spy.mount });

    const canvas = container.querySelector('canvas');

    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    expect(canvas?.className).toContain('pointer-events-none');
  });

  it('trả cảnh khi rời cây (R-05)', () => {
    const spy = sceneSpy();

    const { unmount } = renderHook({ mountScene: spy.mount });

    expect(spy.dispose).not.toHaveBeenCalled();

    unmount();

    expect(spy.dispose).toHaveBeenCalledTimes(1);
  });

  it('scene truyền vào vẫn dựng canvas: nó chỉ thay NGUỒN BẮN TIA, không thay lượt vẽ', () => {
    const spy = sceneSpy();

    const { container } = renderHook({ mountScene: spy.mount, scene: null });

    // `scene: null` nói "đừng bắn tia vào đâu cả" — nó KHÔNG nói "đừng vẽ".
    // Canvas vẫn ở đó và cảnh vẫn lắp, vì cảnh là thứ người dùng nhìn thấy.
    expect(spy.calls).toHaveLength(1);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('máy không có WebGL vẫn dựng ra màn, không ném lỗi và không màn trắng (A11)', () => {
    const spy = sceneSpy(false);

    const { container } = renderHook({ mountScene: spy.mount });

    expect(spy.calls).toHaveLength(1);
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* [2] `M` chỉ còn một người đăng ký.                                          */
/* -------------------------------------------------------------------------- */

describe('useMeasurementTool — M thuộc về vỏ, và chỉ vỏ', () => {
  it('đúng MỘT binding M ở phạm vi canvas, và nó là của vỏ', () => {
    const registry = createShortcutRegistry({ isDev: false });
    const spy = sceneSpy();

    renderHook({ mountScene: spy.mount, registry });

    const measureBindings = registry
      .listShortcuts()
      .filter((shortcut) => shortcut.scope === 'canvas' && shortcut.combo === 'M');

    expect(measureBindings).toHaveLength(1);
    expect(measureBindings[0]?.id).toBe('viewer.tool.measure');
  });

  it('không còn chồng phím nào mang tên màn đo', () => {
    const registry = createShortcutRegistry({ isDev: false });
    const spy = sceneSpy();

    renderHook({ mountScene: spy.mount, registry });

    const overlapping = registry
      .findOverlaps()
      .flatMap((overlap) => overlap.registrantIds)
      .filter((id) => id.startsWith('measurementTool.'));

    expect(overlapping).toEqual([]);
  });

  it('ba phím còn lại của màn vẫn ở phạm vi canvas, dạng chuẩn hoá viết hoa', () => {
    const registry = createShortcutRegistry({ isDev: false });
    const spy = sceneSpy();

    renderHook({ mountScene: spy.mount, registry });

    const screenCombos = registry
      .listShortcuts()
      .filter((shortcut) => shortcut.id.startsWith('measurementTool.'))
      .map((shortcut) => `${shortcut.scope}:${shortcut.combo}`);

    expect(screenCombos).toEqual(['canvas:ESCAPE', 'canvas:ENTER', 'canvas:DELETE']);
  });
});
