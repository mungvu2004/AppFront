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

import { act, createEvent, fireEvent, screen, waitFor } from '@testing-library/react';
import { Group, Object3D, PerspectiveCamera, Vector3 } from 'three';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppError } from '@/lib/errors/toAppError';
import type { HttpError } from '@/lib/http';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { createShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { renderWithProviders } from '@/lib/testing/render';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import {
  createViewerShellFixtureGateway,
  ViewerShell,
  VIEWER_FIXTURE_SPATIAL,
} from '@/screens/viewer/ViewerShell';

import { createMeasurementToolFixtureGateway } from './measurementToolGateway';
import type { MeasurementToolGateway, PinnedMeasurement } from './measurementToolTypes';
import type {
  MeasurementSceneHandle,
  MeasurementSceneMount,
  MeasurementSceneMountOptions,
  MountMeasurementScene,
} from './measurementToolScene';
import { viewerStateOf } from './measurementToolViewModel';
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

/** Như `renderHook` nhưng KHÔNG tiêm cổng: hook tự dựng cổng thật trên `fetch`. */
function renderRealGateway(
  overrides: Partial<UseMeasurementToolOptions> = {},
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Harness
      projectId="P-1"
      mountScene={sceneSpy().mount}
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

/* -------------------------------------------------------------------------- */
/* [3] Ghim và xoá hỏng phải hiện ra; hoàn tác 409/500 không được nuốt.        */
/* -------------------------------------------------------------------------- */

afterEach(() => {
  vi.unstubAllGlobals();
});

const LEVEL = 'L-1';

/** Mỗi điểm chấm rơi đúng chỗ con trỏ đứng: x theo mét = clientX / 1000. */
const pickAtPointer: NonNullable<UseMeasurementToolOptions['pick']> = (pointer) => ({
  distance: 1,
  entityId: 'L-1',
  kind: 'wall',
  levelId: LEVEL,
  normal: null,
  object: new Object3D(),
  point: new Vector3(pointer.x / 1000, 0, pointer.y / 1000),
});

/** Bật công cụ đo rồi chấm hai điểm — đủ để có bản nháp mang nút "ghim". */
function measureTwoPoints(): void {
  fireEvent.click(screen.getByRole('button', { name: /\(M\)/u }));

  const viewport = screen.getByLabelText('Khung nhìn mô hình');

  // jsdom không có PointerEvent nên `clientX` không tự lên sự kiện: gắn tay.
  const press = (type: 'pointerDown' | 'pointerUp', x: number): void => {
    const event = createEvent[type](viewport);
    Object.defineProperty(event, 'clientX', { value: x });
    Object.defineProperty(event, 'clientY', { value: 0 });
    fireEvent(viewport, event);
  };

  [1000, 3000].forEach((x) => {
    press('pointerDown', x);
    press('pointerUp', x);
  });
}

function wireError(status: number, code: string, resource?: string): HttpError {
  return {
    code,
    kind: 'http',
    raw: { code, requestId: 'req-1', ...(resource !== undefined ? { resource } : {}) },
    requestId: 'req-1',
    retryable: false,
    status,
  };
}

/** Cổng mà lượt ghim luôn hỏng bằng `error`, đúng thứ `mutateAsync` ném. */
function failingPinGateway(error: unknown): MeasurementToolGateway {
  return {
    ...createMeasurementToolFixtureGateway(),
    saveMeasurement: () => Promise.reject(error),
  };
}

function titlesOf(bus: NotificationBus): readonly string[] {
  return bus.list().map((notification) => notification.title);
}

describe('useMeasurementTool — ghim hỏng thì hiện câu tiếng Việt và giữ bản nháp', () => {
  it('422 hết hạn mức hiện đúng MỘT thông báo có câu giới hạn', async () => {
    const notifications = createNotificationBus();

    renderHook({
      notifications,
      mountScene: sceneSpy().mount,
      pick: pickAtPointer,
      gateway: failingPinGateway(toAppError(wireError(422, 'MEASUREMENT_LIMIT_REACHED'))),
    });
    measureTwoPoints();
    fireEvent.click(screen.getByRole('button', { name: /ghim/iu }));

    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });
    expect(titlesOf(notifications)[0]).toContain('giới hạn số phép đo');
  });

  it('mã lạ hiện câu dự phòng và KHÔNG chứa mã lỗi', async () => {
    const notifications = createNotificationBus();

    renderHook({
      notifications,
      mountScene: sceneSpy().mount,
      pick: pickAtPointer,
      gateway: failingPinGateway(toAppError(wireError(500, 'SOMETHING_ODD'))),
    });
    measureTwoPoints();
    fireEvent.click(screen.getByRole('button', { name: /ghim/iu }));

    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });

    const [notification] = notifications.list();

    expect(notification?.title).toBe('Chưa ghim được phép đo, hãy thử lại');
    expect(`${notification?.title} ${notification?.description}`).not.toContain('SOMETHING_ODD');
  });

  it('bản nháp còn đủ điểm sau khi ghim hỏng, nên ghim lại được', async () => {
    const notifications = createNotificationBus();
    const saved: PinnedMeasurement[] = [];
    const base = failingPinGateway(toAppError(wireError(422, 'MEASUREMENT_LIMIT_REACHED')));

    renderHook({
      notifications,
      mountScene: sceneSpy().mount,
      pick: pickAtPointer,
      gateway: {
        ...base,
        saveMeasurement: (projectId, row) => {
          saved.push(row);

          return base.saveMeasurement(projectId, row);
        },
      },
    });
    measureTwoPoints();
    fireEvent.click(screen.getByRole('button', { name: /ghim/iu }));

    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /ghim/iu }));

    await waitFor(() => {
      expect(saved).toHaveLength(2);
    });

    expect(saved[0]?.points).toHaveLength(2);
    expect(saved[1]?.points).toEqual(saved[0]?.points);
  });
});

/* -------------------------------------------------------------------------- */
/* [4] Hoàn tác xoá qua mạng thật (fetch giả trước khi render).                */
/* -------------------------------------------------------------------------- */

const WIRE_RECORD = {
  id: 'MS-0001',
  mode: 'pointToPoint',
  name: 'Phép đo 1',
  points: [
    { x: 0, y: 0 },
    { x: 3450, y: 0 },
  ],
  rawValueMm: 3450,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

/** GET trả một phép đo; DELETE 204; POST lần lượt theo `postStatuses`. */
function stubServer(
  postStatuses: readonly number[],
  deleteFailure?: { readonly status: number; readonly code: string },
): { readonly posts: Record<string, unknown>[]; readonly lists: () => number } {
  const posts: Record<string, unknown>[] = [];
  let listCalls = 0;

  vi.stubGlobal(
    'fetch',
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (method === 'POST') {
        const body: unknown = JSON.parse(String(init?.body));
        posts.push(typeof body === 'object' && body !== null ? { ...body } : {});
        const status = postStatuses[posts.length - 1] ?? 201;

        if (status === 201) {
          return Promise.resolve(jsonResponse(body, 201));
        }

        const code = status === 409 ? 'MEASUREMENT_ID_TAKEN' : 'INTERNAL_ERROR';

        return Promise.resolve(jsonResponse({ code, requestId: 'req-9' }, status));
      }

      if (method === 'DELETE' && deleteFailure !== undefined) {
        return Promise.resolve(
          jsonResponse(
            { code: deleteFailure.code, requestId: 'req-9', resource: 'measurement' },
            deleteFailure.status,
          ),
        );
      }

      if (method !== 'DELETE') {
        listCalls += 1;
      }

      return Promise.resolve(method === 'DELETE' ? jsonResponse(null, 204) : jsonResponse([WIRE_RECORD], 200));
    }),
  );

  return { posts, lists: () => listCalls };
}

/** Xoá phép đo đầu tiên rồi bấm hoàn tác trên toast của lượt xoá. */
async function deleteThenUndo(notifications: NotificationBus): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Xoá Phép đo 1/iu }));

  await waitFor(() => {
    expect(notifications.list().some((entry) => entry.undoTicket !== undefined)).toBe(true);
  });

  notifications.list().find((entry) => entry.undoTicket !== undefined)?.undoTicket?.undo();
}

describe('useMeasurementTool — xoá hỏng qua cổng thật', () => {
  it('404 mang resource "measurement" hiện câu "đã bị xoá ở nơi khác" và làm mới danh sách', async () => {
    const notifications = createNotificationBus();
    const { lists } = stubServer([], { code: 'NOT_FOUND', status: 404 });

    renderRealGateway({ notifications });
    fireEvent.click(await screen.findByRole('button', { name: /Xoá Phép đo 1/iu }));

    await waitFor(() => {
      expect(titlesOf(notifications)).toContain('Phép đo này đã bị xoá ở nơi khác');
    });
    await waitFor(() => {
      expect(lists()).toBeGreaterThan(1);
    });
  });

  it('403 mang resource "measurement" KHÔNG hiện câu "đã bị xoá", không làm mới danh sách', async () => {
    const notifications = createNotificationBus();
    const { lists } = stubServer([], { code: 'FORBIDDEN', status: 403 });

    renderRealGateway({ notifications });
    fireEvent.click(await screen.findByRole('button', { name: /Xoá Phép đo 1/iu }));

    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });

    const listsBefore = lists();

    expect(titlesOf(notifications)).toEqual(['Bạn không có quyền xoá phép đo trong dự án này']);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lists()).toBe(listsBefore);
  });
});

describe('useMeasurementTool — vai chỉ xem không xoá được phép đo (B-V9-41)', () => {
  it('không có nút "Xoá", chỉ còn phím Esc, và không một DELETE nào được gửi', async () => {
    const registry = createShortcutRegistry({ isDev: false });
    stubServer([]);

    renderRealGateway({ roles: ['viewer'], registry });

    const row = (await screen.findByRole('button', { name: /Ẩn Phép đo 1/iu })).closest('li');

    expect(screen.queryByRole('button', { name: /Xoá Phép đo 1/iu })).not.toBeInTheDocument();
    expect(
      registry
        .listShortcuts()
        .filter((shortcut) => shortcut.id.startsWith('measurementTool.'))
        .map((shortcut) => shortcut.combo),
    ).toEqual(['ESCAPE']);

    // Trỏ vào hàng (đường đặt `highlightedId`) rồi nhấn Delete: vẫn không xoá.
    if (row !== null) fireEvent.mouseEnter(row);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    const methods = vi.mocked(fetch).mock.calls.map(([, init]) => init?.method ?? 'GET');

    expect(methods).not.toContain('DELETE');
  });
});

describe('useMeasurementTool — hoàn tác xoá qua cổng thật', () => {
  it('POST hoàn tác 500 hiện đúng MỘT thông báo lỗi hoàn tác', async () => {
    const notifications = createNotificationBus();
    stubServer([500]);

    renderRealGateway({ notifications });
    await deleteThenUndo(notifications);

    await waitFor(() => {
      expect(
        titlesOf(notifications).filter((title) => title === 'Chưa hoàn tác được việc xoá phép đo'),
      ).toHaveLength(1);
    });
  });

  it('POST hoàn tác 409 rồi 201: lần hai mang mã khác mã đã xoá và không báo lỗi', async () => {
    const notifications = createNotificationBus();
    const { posts } = stubServer([409, 201]);

    renderRealGateway({ notifications });
    await deleteThenUndo(notifications);

    await waitFor(() => {
      expect(posts).toHaveLength(2);
    });

    expect(posts[0]?.id).toBe('MS-0001');
    expect(posts[1]?.id).not.toBe('MS-0001');
    expect(titlesOf(notifications)).not.toContain('Chưa hoàn tác được việc xoá phép đo');
  });
});

/* -------------------------------------------------------------------------- */
/* [5] Đang đo không phải đang nạp: khung nhìn không chặn chuột (NO-382).      */
/* -------------------------------------------------------------------------- */

/** Skeleton của khung nhìn — lớp `absolute inset-0` duy nhất nằm trên canvas. */
function viewportSkeleton(): Element | null {
  return screen.getByLabelText('Khung nhìn mô hình').querySelector('.animate-pulse');
}

describe('useMeasurementTool — giữa hai lần chấm, khung nhìn không có lớp chặn chuột (NO-382)', () => {
  it('chấm một điểm: khung nhìn không skeleton, nút ghim còn bấm được', async () => {
    renderHook({ mountScene: sceneSpy().mount, pick: pickAtPointer });

    await waitFor(() => {
      expect(viewportSkeleton()).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /\(M\)/u }));
    const viewport = screen.getByLabelText('Khung nhìn mô hình');
    const down = createEvent.pointerDown(viewport);
    Object.defineProperty(down, 'clientX', { value: 1000 });
    Object.defineProperty(down, 'clientY', { value: 0 });
    fireEvent(viewport, down);
    fireEvent.pointerUp(viewport);

    expect(screen.getByRole('button', { name: /ghim/iu })).toBeEnabled();
    expect(viewportSkeleton()).toBeNull();
  });

  it('cảnh đang nạp thật (dự án chưa về) thì khung nhìn VẪN vẽ skeleton', () => {
    renderHook({
      mountScene: sceneSpy().mount,
      shellGateway: {
        ...createViewerShellFixtureGateway(),
        readProjectName: () => new Promise<string | null>(() => undefined),
      },
    });

    expect(viewportSkeleton()).not.toBeNull();
  });

  it('hình học còn đang dựng thì khung nhìn nói "đang dựng"; dựng xong thì skeleton đi', async () => {
    const spy = sceneSpy();
    renderHook({ mountScene: spy.mount, pick: pickAtPointer });
    const status = (phase: 'building' | 'ready'): void => {
      act(() => {
        spy.calls[0]?.onStatusChange?.({
          phase,
          settledCount: phase === 'ready' ? 1 : 0,
          totalCount: 1,
          failedCount: 0,
          readyLevelIds: [],
        });
      });
    };

    await waitFor(() => {
      expect(spy.calls).toHaveLength(1);
    });
    status('building');
    expect(viewportSkeleton()).not.toBeNull();

    status('ready');
    await waitFor(() => {
      expect(viewportSkeleton()).toBeNull();
    });
  });
});

describe('viewerStateOf — bảy trạng thái của vỏ, chỉ nạp thật mới ra skeleton (NO-382)', () => {
  it.each([
    ['empty', 'success', 'empty'],
    ['measuring', 'success', 'success'],
    ['partial', 'success', 'partial'],
    ['error', 'success', 'error'],
    ['ready', 'success', 'success'],
    ['forbidden', 'forbidden', 'forbidden'],
    ['collapsed', 'success', 'collapsed'],
    ['measuring', 'loading', 'loading'],
    ['ready', 'loading', 'loading'],
    ['empty', 'partial', 'partial'],
    ['error', 'loading', 'error'],
    ['collapsed', 'loading', 'collapsed'],
  ] as const)('màn %s trên vỏ %s → %s', (measurement, shell, expected) => {
    expect(viewerStateOf(measurement, shell)).toBe(expected);
  });

  it.each([
    ['forbidden', 'forbidden', 'loading'],
    ['ready', 'success', 'loading'],
    ['measuring', 'success', 'loading'],
    ['error', 'success', 'error'],
    ['collapsed', 'success', 'collapsed'],
  ] as const)('đang dựng hình: màn %s trên vỏ %s → %s', (measurement, shell, expected) => {
    expect(viewerStateOf(measurement, shell, true)).toBe(expected);
  });
});
