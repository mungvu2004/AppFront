/**
 * Lớp gộp: cảnh 3D có thật sự nhận được HÌNH không.
 *
 * ## Vì sao file này tồn tại
 *
 * Hợp đồng bản đầu chỉ cấp `floorIds: readonly string[]` cho cảnh — MÃ tầng,
 * không phải hình. Với riêng mã tầng thì `mobileViewerScene.ts` không dựng được
 * một tam giác nào: cảnh lắp xong, `mount.ok` là `true`, cả bảy trạng thái xanh,
 * mọi cổng xanh — và người dùng nhìn vào một mô hình RỖNG. Một màn 3D rỗng mà
 * mọi cổng đều xanh là đúng thất bại mà bài kiểm này tồn tại để chặn, nên nó
 * không dừng ở "typecheck xanh":
 *
 * 1. đi qua ĐÚNG đường sản phẩm — `MobileViewerContainer` → `lazy()` →
 *    `ConnectedMobileViewer` → `useMobileViewer` — chứ không gọi hook trần;
 * 2. bắt lấy `MobileViewerSceneOptions` mà container/hook thật sự đưa xuống;
 * 3. rồi **dựng hình thật** từ mảng `levels` ấy bằng `buildFloorAtDetail` và đòi
 *    số tam giác khác 0. Đây là bước không giả được: một `levels` rỗng, một
 *    `levels` toàn tầng không tường, hay một phép chuyển hỏng đều rơi ở đây.
 *
 * ## Ba thứ khác cũng chỉ chỗ này kiểm được
 *
 * - **R-62** — ranh giới lỗi là bản `components/feedback`, và nó có mặt thật.
 * - **R-73** — mọi chỗ tiêm đi xuyên container, nên một màn khác mở được màn này
 *   mà không viết thêm dòng logic nào.
 * - Hai tham số BẮT BUỘC của hook (`mountScene`, `NotificationBus`) có người
 *   cấp — thiếu một trong hai là lỗi biên dịch, nhưng "có mặc định THẬT" thì chỉ
 *   chạy mới biết.
 *
 * Cảnh vào bằng chỗ tiêm nên không lượt nào chạm WebGL; `three` vẫn được nhập
 * (module cảnh nằm sau `lazy()`), và đó là ý muốn — nhánh nhập ấy cũng phải chạy
 * được trong `jsdom`.
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProjectsApi } from '@/api/client';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { NotificationInput } from '@/lib/mutations/notificationBus';
import type { NetworkMonitor, NetworkMonitorStatus } from '@/lib/offline/networkMonitor';
import { renderWithProviders } from '@/lib/testing/render';
import { buildFloorAtDetail } from '@/lib/three/build/lod';

import { MobileViewerContainer } from './MobileViewer.container';
import type { MobileViewerGateway } from './mobileViewerGateway';
import {
  MOBILE_VIEWER_MODEL_TOKEN,
  type MobileViewerSceneOptions,
} from './mobileViewerTypes';

const SPATIAL = normalizeSpatial(createSampleBuilding());
const PROJECT_ID = 'P-000000001';

/** Bộ mẫu A14 có bốn tầng; con số này là thứ phép chuyển phải giữ nguyên. */
const FIXTURE_STOREY_COUNT = 4;

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
  // Nạp trước nhánh sau `lazy()`, để đồng hồ của `waitFor` bên dưới chỉ đo việc
  // của màn chứ không đo lượt biên dịch `three`. Không có dòng này thì bài kiểm
  // xanh khi chạy một mình và đỏ khi chạy cùng cả bộ — cùng module, cùng khẳng
  // định, chỉ khác chỗ tốn thời gian.
  await import('./MobileViewer.connected');

  let captured: MobileViewerSceneOptions | null = null;
  const notices: NotificationInput[] = [];

  const { unmount } = renderWithProviders(
    <MobileViewerContainer
      gateway={gatewayOf()}
      mountScene={(_canvas, options) => {
        captured = options;

        return {
          ok: true,
          handle: {
            setActiveFloor: () => undefined,
            currentDetail: () => 'block',
            pickMeasurePoint: () => null,
            dispose: () => undefined,
          },
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

/* -------------------------------------------------------------------------- */
/* Lỗ hổng đã biết: `levels` có xuống tới cảnh không.                          */
/* -------------------------------------------------------------------------- */

describe('MobileViewerContainer — cảnh nhận được HÌNH, không chỉ mã tầng', () => {
  it('truyền xuống một `levels` khác rỗng, đúng một mục cho mỗi tầng của đồ thị', async () => {
    const mounted = await mountContainer();
    const options = mounted.options();

    expect(options.levels).toHaveLength(FIXTURE_STOREY_COUNT);
    expect(options.floorIds).toHaveLength(FIXTURE_STOREY_COUNT);
    expect(options.levels.map((level) => level.level.id)).toEqual([...options.floorIds]);

    mounted.unmount();
  });

  it('mỗi tầng mang tường và phòng thật — một mảng đúng độ dài mà rỗng ruột vẫn là mô hình rỗng', async () => {
    const mounted = await mountContainer();
    const { levels } = mounted.options();

    // Một vòng lặp trên mảng rỗng khẳng định được đúng không gì cả; chốt độ dài
    // trước rồi mới đi vào từng mục.
    expect(levels.length).toBeGreaterThan(0);

    for (const input of levels) {
      expect(input.walls.length).toBeGreaterThan(0);
      expect(input.rooms.length).toBeGreaterThan(0);
    }

    mounted.unmount();
  });

  it('dựng được hình THẬT từ `levels` ấy: số tam giác của mức `block` khác 0', async () => {
    const mounted = await mountContainer();

    let triangles = 0;

    for (const input of mounted.options().levels) {
      const group = buildFloorAtDetail(input, 'block');

      group.traverse((object) => {
        const geometry = (object as { geometry?: { getAttribute?: (name: string) => unknown } })
          .geometry;
        const position = geometry?.getAttribute?.('position') as { count?: number } | undefined;

        if (position?.count !== undefined) {
          triangles += position.count;
        }
      });
    }

    expect(triangles).toBeGreaterThan(0);

    mounted.unmount();
  });

  it('cấp `tokenOfPartKind`, và nó trả về đúng token DUY NHẤT của hợp đồng', async () => {
    const mounted = await mountContainer();
    const { tokenOfPartKind } = mounted.options();

    expect(tokenOfPartKind).toBeTypeOf('function');
    expect(tokenOfPartKind?.('wall')).toBe(MOBILE_VIEWER_MODEL_TOKEN);
    expect(tokenOfPartKind?.('floorSlab')).toBe(MOBILE_VIEWER_MODEL_TOKEN);

    mounted.unmount();
  });

  it('mở màn ở mức gọn — R-04 đòi thấy khối nhà trước, chi tiết sau', async () => {
    const mounted = await mountContainer();

    expect(mounted.options().initialDetail).toBe('block');

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
