/**
 * Lớp gộp: cảnh Pascal có thật sự nhận được ĐỒ THỊ và đưa kết quả chạm/đo về không.
 *
 * Đi qua ĐÚNG đường sản phẩm — `MobileViewerContainer` → `lazy()` →
 * `ConnectedMobileViewer` → `useMobileViewer` — với một `mountScene` giả (không
 * chạm WebGL, không nạp gói Pascal), rồi:
 *
 * 1. đòi đồ thị đưa xuống khác rỗng và `toPascalScene` dựng được node từ nó;
 * 2. gọi `onPick` bằng mã node Pascal và đòi tấm thông tin mở đúng đối tượng;
 * 3. gọi `onMeasure` và đòi khoảng cách hiện theo A15 (dấu phẩy).
 *
 * Hai thứ khác cũng chỉ chỗ này kiểm được: ranh giới lỗi `components/feedback`
 * có mặt thật (R-62), và mọi chỗ tiêm đi xuyên container (R-73).
 */

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ProjectsApi } from '@/api/client';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { NotificationInput } from '@/lib/mutations/notificationBus';
import type { NetworkMonitor, NetworkMonitorStatus } from '@/lib/offline/networkMonitor';
import { renderWithProviders } from '@/lib/testing/render';
import { toPascalScene } from '@/lib/pascal/toPascal';

import { MobileViewerContainer } from './MobileViewer.container';
import type { MobileViewerGateway } from './mobileViewerGateway';
import type { MobileViewerSceneOptions } from './mobileViewerTypes';

/*
 * Nạp trước nhánh sau `lazy()` — ở PHẠM VI MODULE, không trong thân hàm mà bài kiểm gọi.
 *
 * Lượt nạp này từng nằm trong `mountContainer()`, kèm đúng lời giải thích rằng nó tồn tại để
 * `waitFor` bên dưới chỉ đo việc của màn chứ không đo lượt biên dịch `three`. Chẩn đoán đúng,
 * chỗ đặt sai: `mountContainer()` được gọi TỪ TRONG bài kiểm, nên lượt biên dịch `three` cùng
 * ~15 module của cảnh vẫn đếm vào 5 000 ms của bài. Nhập tĩnh ở đây đưa nó sang pha
 * `collect`, pha không bị `testTimeout` chặn.
 *
 * `lazy()` trong `MobileViewer.container.tsx` KHÔNG đổi — promise của nó chỉ phân giải từ cache
 * module, nên đường sản phẩm vẫn là đường sản phẩm.
 */
import './MobileViewer.connected';

const SPATIAL = normalizeSpatial(createSampleBuilding());
const PROJECT_ID = 'P-000000001';

function projectsApiOf(): Pick<ProjectsApi, 'read'> {
  return {
    read: async ({ projectId }) =>
      ({ ok: true, data: { id: projectId, name: 'Nhà phố Bình Thạnh' } }) as Awaited<
        ReturnType<ProjectsApi['read']>
      >,
  };
}

function monitorOf(): () => NetworkMonitor {
  const status: NetworkMonitorStatus = {
    browserOnline: true,
    pingOnline: true,
    online: true,
    checkedAt: 0,
  };

  return () => ({
    checkNow: async () => status,
    getStatus: () => status,
    start: () => undefined,
    stop: () => undefined,
    subscribe: () => () => undefined,
  });
}

function gatewayOf(): MobileViewerGateway {
  return {
    projectsApi: projectsApiOf(),
    createMonitor: monitorOf(),
    openMail: () => undefined,
    copyText: async () => true,
  };
}

interface Mounted {
  /** Tuỳ chọn mà cảnh thật sự nhận được. */
  readonly options: () => MobileViewerSceneOptions;
  readonly unmount: () => void;
}

/**
 * Dựng container thật với một cảnh giả, rồi đợi tới lúc cảnh được lắp.
 *
 * `waitFor` phải đợi hai việc nối tiếp: chunk sau `lazy()` về, rồi `useEffect`
 * lắp cảnh chạy khi canvas đã gắn. Không có `installFakeClock` nào ở đây — đặt
 * nó trước `waitFor` là cách chắc chắn nhất để `waitFor` treo tới hết giờ.
 */
async function mountContainer(): Promise<Mounted> {
  let captured: MobileViewerSceneOptions | null = null;
  const notices: NotificationInput[] = [];

  const { unmount } = renderWithProviders(
    <MobileViewerContainer
      gateway={gatewayOf()}
      mountScene={(_canvas, options) => {
        captured = options;

        return {
          ok: true,
          handle: { dispose: () => undefined },
        };
      }}
      notifications={{ publish: (input) => notices.push(input) }}
      projectId={PROJECT_ID}
      roles={['engineer']}
      shareLinks={null}
      spatial={SPATIAL}
    />,
    { keepStore: true },
  );

  await waitFor(() => {
    expect(captured).not.toBeNull();
  });

  return {
    options: () => {
      if (captured === null) {
        throw new Error('cảnh chưa được lắp — không thể tới đây');
      }

      return captured;
    },
    unmount,
  };
}

describe('MobileViewerContainer — cảnh Pascal nhận đồ thị và trả kết quả về', () => {
  it('truyền xuống đồ thị khác rỗng mà Pascal dựng được node từ nó', async () => {
    const mounted = await mountContainer();
    const { graph, measure } = mounted.options();

    expect(graph.walls.length).toBeGreaterThan(0);
    expect(graph.rooms.length).toBeGreaterThan(0);
    expect(measure).toBe(false);
    expect(Object.keys(toPascalScene(graph).scene.nodes).length).toBeGreaterThan(0);

    mounted.unmount();
  });

  it('chạm một tường (mã node Pascal) thì mở tấm thông tin đúng đối tượng', async () => {
    const mounted = await mountContainer();
    const wall = mounted.options().graph.walls[0];

    expect(wall).toBeDefined();
    act(() => mounted.options().onPick(`wall_${wall?.id ?? ''}`));

    await waitFor(() => {
      expect(screen.getByText(`Tường ${wall?.id ?? ''}`)).toBeTruthy();
    });

    mounted.unmount();
  });

  it('chạm khoảng trống hoặc node lạ thì không mở gì', async () => {
    const mounted = await mountContainer();

    act(() => mounted.options().onPick('wall_k3n9lạ'));
    act(() => mounted.options().onPick(null));

    expect(screen.queryByRole('dialog')).toBeNull();

    mounted.unmount();
  });

  it('một phép đo xong thì hiện khoảng cách dấu phẩy (A15)', async () => {
    const mounted = await mountContainer();

    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: /^Đo/ }));
    await waitFor(() => {
      expect(mounted.options().measure).toBe(true);
    });
    act(() => mounted.options().onMeasure(3.45));

    await waitFor(() => {
      expect(screen.getByText(/3,45/)).toBeTruthy();
    });

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* R-62: ranh giới lỗi có mặt thật.                                            */
/* -------------------------------------------------------------------------- */

describe('MobileViewerContainer — ranh giới lỗi và vùng màn (R-62)', () => {
  it('dựng ra vùng màn của view, nên không lượt nào ra ô trắng (A11)', async () => {
    const mounted = await mountContainer();

    await waitFor(() => {
      expect(document.querySelector('[role="region"]')).not.toBeNull();
    });

    mounted.unmount();
  });
});
