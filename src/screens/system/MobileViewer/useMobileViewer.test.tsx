/**
 * `useMobileViewer` — bảy trạng thái, R-04, và ba lời hứa dễ trôi nhất.
 *
 * Bài kiểm này KHÔNG dựng three.js: cảnh vào bằng chỗ tiêm `mountScene`, nên
 * mọi nhánh của R-04 (mức chi tiết, fps) đo được bằng cách gọi thẳng ba lời gọi
 * ngược mà hook trao cho cảnh. Đó cũng là điều bài kiểm muốn chứng minh: hook
 * không tự với tay vào WebGL, và bảy trạng thái của A11 quyết định được chỉ từ
 * dữ liệu cộng ba tín hiệu ấy.
 *
 * Ba lời hứa được canh riêng:
 *
 * 1. **R-64** — `loading` và `error` đến từ `useQuery`/cảnh, không từ một biến
 *    hook tự giữ. Bài kiểm chặn cửa API và đòi hook về `loading` mà không cần ai
 *    bật một cờ nào.
 * 2. **R-04** — fps thấp KHÔNG lập tức thành `error`: mức chi tiết phải xuống
 *    tới `block` trước, và phải thấp suốt cả `DEGRADE_WINDOW_MS`.
 * 3. **A8** — tạo liên kết chia sẻ có toast kèm vé hoàn tác, và hoàn tác là
 *    THU HỒI thật, không phải một nút chết.
 */

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProjectsApi } from '@/api/client';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { NotificationInput } from '@/lib/mutations/notificationBus';
import type { NetworkMonitor, NetworkMonitorStatus } from '@/lib/offline/networkMonitor';
import { renderWithProviders } from '@/lib/testing/render';
import type { DetailLevel } from '@/lib/three/build/lod';
import type { EntityHit } from '@/lib/three/interaction/hitTest';
import { SCENE_BUDGET } from '@/lib/three/perf/budget';
import { DEGRADE_WINDOW_MS } from '@/lib/three/perf/monitor';
import { ROUTES } from '@/routes/paths';

import type { MobileViewerModel, MobileViewerSceneOptions } from './mobileViewerTypes';
import { useMobileViewer, type UseMobileViewerOptions } from './useMobileViewer';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

const SPATIAL = normalizeSpatial(createSampleBuilding());
const PROJECT_ID = 'P-000000001';
const PROJECT_NAME = 'Nhà phố Bình Thạnh';

/** Cổng dự án giả: một tên, trả về ngay. */
function projectsApiOf(name = PROJECT_NAME): Pick<ProjectsApi, 'read'> {
  return {
    read: async ({ projectId }) =>
      ({ ok: true, data: { id: projectId, name } }) as Awaited<ReturnType<ProjectsApi['read']>>,
  };
}

/** Cổng dự án không bao giờ trả lời — nhánh `loading` của R-64. */
function stalledProjectsApi(): Pick<ProjectsApi, 'read'> {
  return { read: () => new Promise(() => undefined) };
}

/** Bộ theo dõi mạng giả, với trạng thái cố định. */
function monitorOf(status: Partial<NetworkMonitorStatus> = {}): () => NetworkMonitor {
  const full: NetworkMonitorStatus = {
    browserOnline: true,
    pingOnline: true,
    online: true,
    checkedAt: 0,
    ...status,
  };

  return () => ({
    checkNow: async () => full,
    getStatus: () => full,
    start: () => undefined,
    stop: () => undefined,
    subscribe: () => () => undefined,
  });
}

interface SceneSpy {
  readonly mount: UseMobileViewerOptions['mountScene'];
  readonly options: () => MobileViewerSceneOptions | null;
  readonly floors: () => readonly (string | null)[];
  readonly disposals: () => number;
}

/**
 * Khoảng cách mà mỗi pixel của cú chạm giả quy ra, milimét.
 *
 * Chạm ở pixel 0 rồi pixel 1 cho hai điểm cách nhau đúng 3450 mm — ví dụ chốt
 * của `formatLength` (`measure.ts:112-119`), nên trị số hiện ra phải là "3,45 m".
 */
const MM_PER_TAP_PIXEL = 3450;

/** Cảnh giả: không three, không WebGL — chỉ giữ lại ai gọi nó với cái gì. */
function sceneSpy(): SceneSpy {
  let options: MobileViewerSceneOptions | null = null;
  let disposals = 0;
  const floors: (string | null)[] = [];

  return {
    mount: (_canvas, given) => {
      options = given;

      return {
        ok: true,
        handle: {
          setActiveFloor: (floorId) => floors.push(floorId),
          currentDetail: () => 'block',
          pickMeasurePoint: (xPx: number) => ({ x: xPx * MM_PER_TAP_PIXEL, y: 0 }) as never,
          dispose: () => {
            disposals += 1;
          },
        },
      };
    },
    options: () => options,
    floors: () => floors,
    disposals: () => disposals,
  };
}

/** Một component không vẽ gì; nó chỉ để hook chạy trong một cây React thật. */
function Probe({
  options,
  onModel,
}: {
  readonly options: UseMobileViewerOptions;
  readonly onModel: (model: MobileViewerModel) => void;
}): null {
  onModel(useMobileViewer(options));

  return null;
}

interface Harness {
  readonly model: () => MobileViewerModel;
  readonly canvas: HTMLCanvasElement;
  readonly notices: readonly NotificationInput[];
  readonly unmount: () => void;
}

function render(overrides: Partial<UseMobileViewerOptions> = {}): Harness {
  const notices: NotificationInput[] = [];
  let latest: MobileViewerModel | null = null;
  const canvas = document.createElement('canvas');

  const options: UseMobileViewerOptions = {
    projectId: PROJECT_ID,
    canvas,
    mountScene: sceneSpy().mount,
    notifications: { publish: (input) => notices.push(input) },
    gateway: {
      projectsApi: projectsApiOf(),
      createMonitor: monitorOf(),
      openMail: () => undefined,
      copyText: async () => true,
    },
    shareLinks: null,
    spatial: SPATIAL,
    roles: ['engineer'],
    ...overrides,
  };

  const { unmount } = renderWithProviders(
    <Probe
      options={options}
      onModel={(model) => {
        latest = model;
      }}
    />,
    { keepStore: true },
  );

  return {
    model: () => {
      if (latest === null) {
        throw new Error('hook chưa chạy lần nào');
      }

      return latest;
    },
    canvas,
    notices,
    unmount,
  };
}

/** Đặt `matchMedia` cho một truy vấn trả về đúng một câu trả lời. */
function fakeMatchMedia(matches: boolean): () => void {
  const previous = window.matchMedia;

  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  return () => {
    window.matchMedia = previous;
  };
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái — A11.                                                       */
/* -------------------------------------------------------------------------- */

describe('bảy trạng thái', () => {
  it('success: đồ thị đủ tầng, mạng tốt, cảnh đã lắp', async () => {
    const harness = render();

    await waitFor(() => {
      expect(harness.model().state).toBe('success');
    });

    expect(harness.model().projectName).toBe(PROJECT_NAME);
  });

  it('loading: máy chủ chưa trả lời — cờ đến từ useQuery, không từ useState (R-64)', async () => {
    const harness = render({
      gateway: {
        projectsApi: stalledProjectsApi(),
        createMonitor: monitorOf(),
        openMail: () => undefined,
        copyText: async () => true,
      },
    });

    await waitFor(() => {
      expect(harness.model().state).toBe('loading');
    });

    // Đúng lời hứa của mục (B): lúc đang tải, nhãn nói rõ đang ở mức GỌN.
    expect(harness.model().detailLabel).toBe('đang tải mức gọn');
  });

  it('empty: dự án không có tầng nào', async () => {
    const harness = render({ spatial: null });

    await waitFor(() => {
      expect(harness.model().state).toBe('empty');
    });
  });

  it('forbidden: biết chắc người này không mang vai nào trên dự án', async () => {
    const harness = render({ roles: [] });

    await waitFor(() => {
      expect(harness.model().state).toBe('forbidden');
    });
  });

  it('chưa biết vai KHÁC với không có vai — vắng roles không phải forbidden', async () => {
    const harness = render({ roles: undefined });

    await waitFor(() => {
      expect(harness.model().state).not.toBe('forbidden');
    });
  });

  it('partial: mạng yếu, dù đồ thị đủ tầng (T-09)', async () => {
    const harness = render({
      gateway: {
        projectsApi: projectsApiOf(),
        createMonitor: monitorOf({ pingOnline: false, online: false }),
        openMail: () => undefined,
        copyText: async () => true,
      },
    });

    await waitFor(() => {
      expect(harness.model().state).toBe('partial');
    });
  });

  it('error: máy không có WebGL — và lối thoát trỏ sang bản 2D', async () => {
    const harness = render({
      mountScene: () => ({ ok: false, reason: 'webglUnavailable' }),
    });

    await waitFor(() => {
      expect(harness.model().state).toBe('error');
    });

    expect(harness.model().fallback2dHref).toBe(ROUTES.project.floors(PROJECT_ID));
  });

  it('collapsed: bề ngang gọn thay chỗ của success', async () => {
    const restore = fakeMatchMedia(true);

    try {
      const harness = render();

      await waitFor(() => {
        expect(harness.model().state).toBe('collapsed');
      });

      expect(harness.model().isCompact).toBe(true);
    } finally {
      restore();
    }
  });

  it('collapsed KHÔNG thay chỗ của error — hỏng vẫn phải nói là hỏng', async () => {
    const restore = fakeMatchMedia(true);

    try {
      const harness = render({
        mountScene: () => ({ ok: false, reason: 'deviceTooWeak' }),
      });

      await waitFor(() => {
        expect(harness.model().state).toBe('error');
      });
    } finally {
      restore();
    }
  });

  it('ở bề ngang gọn, `view` GỘP vào tấm tầng chứ không rơi vào khoảng không', async () => {
    const restore = fakeMatchMedia(true);

    try {
      const harness = render();

      await waitFor(() => {
        expect(harness.model().isCompact).toBe(true);
      });

      act(() => {
        harness.model().onSelectTool('view');
      });

      expect(harness.model().activeTool).toBe('floors');
    } finally {
      restore();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* R-04 — mức chi tiết và ngưỡng fps.                                          */
/* -------------------------------------------------------------------------- */

describe('mức chi tiết — R-04', () => {
  it('cảnh được lắp ở mức GỌN trước, không phải mức đầy đủ', async () => {
    const spy = sceneSpy();

    render({ mountScene: spy.mount });

    await waitFor(() => {
      expect(spy.options()).not.toBeNull();
    });

    expect(spy.options()?.initialDetail).toBe<DetailLevel>('block');
    expect(spy.options()?.floorIds).toHaveLength(SPATIAL.byKind.level.length);
  });

  it('nâng lên mức đầy đủ thì hết chuyện để nói — nhãn về null', async () => {
    const spy = sceneSpy();
    const harness = render({ mountScene: spy.mount });

    await waitFor(() => {
      expect(spy.options()).not.toBeNull();
    });

    act(() => {
      spy.options()?.onDetailChange('full');
    });

    expect(harness.model().detailLabel).toBeNull();
  });

  it('HẠ xuống thì nói ra là đã hạ, không im lặng', async () => {
    const spy = sceneSpy();
    const harness = render({ mountScene: spy.mount });

    await waitFor(() => {
      expect(spy.options()).not.toBeNull();
    });

    act(() => {
      spy.options()?.onDetailChange('full');
    });
    act(() => {
      spy.options()?.onDetailChange('block');
    });

    expect(harness.model().detailLabel).toBe('đã hạ xuống mức gọn để hình chạy mượt');
  });

  it('fps thấp một nhịp KHÔNG thành error — R-04 hạ mức chi tiết trước đã', async () => {
    const spy = sceneSpy();
    const harness = render({ mountScene: spy.mount, now: () => 0 });

    await waitFor(() => {
      expect(harness.model().state).toBe('success');
    });

    act(() => {
      spy.options()?.onFrameRate(SCENE_BUDGET.minFrameRate.mobile - 1);
    });

    expect(harness.model().state).toBe('success');
  });

  it('chưa xuống tới mức gọn thì fps thấp kéo dài vẫn chưa phải error', async () => {
    const spy = sceneSpy();
    let clock = 0;
    const harness = render({ mountScene: spy.mount, now: () => clock });

    await waitFor(() => {
      expect(harness.model().state).toBe('success');
    });

    act(() => {
      spy.options()?.onDetailChange('full');
      spy.options()?.onFrameRate(SCENE_BUDGET.minFrameRate.mobile - 1);
    });

    clock = DEGRADE_WINDOW_MS + 1;

    act(() => {
      spy.options()?.onFrameRate(SCENE_BUDGET.minFrameRate.mobile - 1);
    });

    expect(harness.model().state).not.toBe('error');
  });

  it('đã ở mức gọn mà vẫn thấp suốt cả cửa sổ thì mời sang bản 2D', async () => {
    const spy = sceneSpy();
    let clock = 0;
    const harness = render({ mountScene: spy.mount, now: () => clock });

    await waitFor(() => {
      expect(harness.model().state).toBe('success');
    });

    act(() => {
      spy.options()?.onFrameRate(SCENE_BUDGET.minFrameRate.mobile - 1);
    });

    clock = DEGRADE_WINDOW_MS + 1;

    act(() => {
      spy.options()?.onFrameRate(SCENE_BUDGET.minFrameRate.mobile - 1);
    });

    await waitFor(() => {
      expect(harness.model().state).toBe('error');
    });

    expect(harness.model().fallback2dHref).toBe(ROUTES.project.floors(PROJECT_ID));
  });

  it('fps hồi lại thì đồng hồ đếm chạy lại từ đầu', async () => {
    const spy = sceneSpy();
    let clock = 0;
    const harness = render({ mountScene: spy.mount, now: () => clock });

    await waitFor(() => {
      expect(harness.model().state).toBe('success');
    });

    act(() => {
      spy.options()?.onFrameRate(SCENE_BUDGET.minFrameRate.mobile - 1);
    });

    clock = DEGRADE_WINDOW_MS + 1;

    act(() => {
      spy.options()?.onFrameRate(SCENE_BUDGET.minFrameRate.mobile);
      spy.options()?.onFrameRate(SCENE_BUDGET.minFrameRate.mobile - 1);
    });

    expect(harness.model().state).toBe('success');
  });
});

/* -------------------------------------------------------------------------- */
/* Tầng, công cụ, và tấm thông tin.                                            */
/* -------------------------------------------------------------------------- */

describe('tầng và công cụ', () => {
  it('mở màn đã có sẵn một tầng đang xem, và cảnh được báo tầng ấy', async () => {
    const spy = sceneSpy();
    const harness = render({ mountScene: spy.mount });

    await waitFor(() => {
      expect(harness.model().activeFloorId).not.toBeNull();
    });

    await waitFor(() => {
      expect(spy.floors().at(-1)).toBe(harness.model().activeFloorId);
    });
  });

  it('chọn tầng khác thì cảnh đổi theo', async () => {
    const spy = sceneSpy();
    const harness = render({ mountScene: spy.mount });

    await waitFor(() => {
      expect(harness.model().floors.length).toBeGreaterThan(1);
    });

    const second = harness.model().floors[1];

    act(() => {
      harness.model().onSelectFloor(second?.id ?? '');
    });

    await waitFor(() => {
      expect(spy.floors().at(-1)).toBe(second?.id);
    });
  });

  it('rời màn thì cảnh được trả lại đúng một lần — R-05', async () => {
    const spy = sceneSpy();
    const harness = render({ mountScene: spy.mount });

    await waitFor(() => {
      expect(spy.options()).not.toBeNull();
    });

    harness.unmount();

    expect(spy.disposals()).toBe(1);
  });

  it('chạm vào một bức tường mở tấm thông tin chỉ đọc', async () => {
    const spy = sceneSpy();
    const harness = render({ mountScene: spy.mount });

    await waitFor(() => {
      expect(spy.options()).not.toBeNull();
    });

    const wallId = SPATIAL.byKind.wall.at(0) ?? '';

    act(() => {
      spy.options()?.onPick({ entityId: wallId, kind: 'wall' } as unknown as EntityHit);
    });

    expect(harness.model().selection?.entityId).toBe(wallId);
    expect(harness.model().selection?.rows.length).toBeGreaterThan(0);

    act(() => {
      harness.model().onDismissSelection();
    });

    expect(harness.model().selection).toBeNull();
  });

  it('công cụ đo đang mở thì HAI cú chạm thành một phép đo, không phải một lượt chọn', async () => {
    const spy = sceneSpy();
    const harness = render({ mountScene: spy.mount });

    await waitFor(() => {
      expect(spy.options()).not.toBeNull();
    });

    act(() => {
      harness.model().onSelectTool('measure');
    });

    const tap = (xPx: number): void => {
      harness.canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: xPx, clientY: 0 }));
      spy.options()?.onPick(null);
    };

    act(() => {
      tap(0);
      tap(1);
    });

    expect(harness.model().measurements).toHaveLength(1);
    expect(harness.model().measurements[0]?.valueLabel).toBe('3,45 m');
    // Đo KHÔNG mở tấm thông tin: hai việc dùng chung một cú chạm nhưng không
    // dùng chung một kết quả.
    expect(harness.model().selection).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Chia sẻ — X-04 và A8.                                                       */
/* -------------------------------------------------------------------------- */

describe('chia sẻ', () => {
  it('không có phiên chia sẻ thì nói ra, không im lặng nuốt cú bấm', async () => {
    const harness = render({ shareLinks: null });

    await waitFor(() => {
      expect(harness.model().state).toBe('success');
    });

    act(() => {
      harness.model().onShare();
    });

    await waitFor(() => {
      expect(harness.notices).toHaveLength(1);
    });

    expect(harness.notices[0]?.title).toBe('chưa tạo được liên kết chia sẻ');
    expect(harness.notices[0]?.undoTicket).toBeUndefined();
  });

  it('tạo được liên kết thì có toast KÈM vé hoàn tác, và hoàn tác là thu hồi thật — A8', async () => {
    const revoked: string[] = [];
    const copied: string[] = [];

    const harness = render({
      gateway: {
        projectsApi: projectsApiOf(),
        createMonitor: monitorOf(),
        openMail: () => undefined,
        copyText: async (text) => {
          copied.push(text);

          return true;
        },
      },
      shareLinks: {
        create: async () => ({ ok: true, data: shareLinkPayload() }),
        list: async () => ({ ok: true, data: { links: [] } }),
        revoke: async ({ linkId }) => {
          revoked.push(linkId);

          return { ok: true, data: shareLinkPayload() };
        },
      },
    });

    await waitFor(() => {
      expect(harness.model().state).toBe('success');
    });

    act(() => {
      harness.model().onShare();
    });

    await waitFor(() => {
      expect(harness.notices).toHaveLength(1);
    });

    expect(copied).toHaveLength(1);

    const ticket = harness.notices[0]?.undoTicket;

    expect(ticket).toBeDefined();

    ticket?.undo();

    await waitFor(() => {
      expect(revoked).toEqual(['SL-1']);
    });
  });

  it('gửi sang máy tính mở ứng dụng thư bằng một địa chỉ mailto:', async () => {
    const opened: string[] = [];

    const harness = render({
      gateway: {
        projectsApi: projectsApiOf(),
        createMonitor: monitorOf(),
        openMail: (href) => opened.push(href),
        copyText: async () => true,
      },
      shareLinks: {
        create: async () => ({ ok: true, data: shareLinkPayload() }),
        list: async () => ({ ok: true, data: { links: [] } }),
        revoke: async () => ({ ok: true, data: shareLinkPayload() }),
      },
    });

    await waitFor(() => {
      expect(harness.model().state).toBe('success');
    });

    act(() => {
      harness.model().onSendDesktopLink();
    });

    await waitFor(() => {
      expect(opened).toHaveLength(1);
    });

    expect(opened[0]?.startsWith('mailto:?')).toBe(true);
    expect(decodeURIComponent(opened[0] ?? '')).toContain('chỉ sửa được trên máy tính');
  });
});

/** Thân trả về của một lượt tạo liên kết, đúng hình dạng `shareLink.ts` giải mã. */
function shareLinkPayload(): unknown {
  return {
    id: 'SL-1',
    projectId: PROJECT_ID,
    url: 'https://app.example.com/s/8f2c1d',
    permission: 'view',
    status: 'active',
    createdAt: '2026-09-10T02:00:00.000Z',
    expiresAt: null,
    revokedAt: null,
    passwordProtected: false,
    viewpointCode: null,
    label: null,
  };
}
