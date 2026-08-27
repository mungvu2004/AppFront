/**
 * Nửa "suy nghĩ" của màn tải bản vẽ, kiểm không cần DOM của màn.
 *
 * Hook được lái qua `renderHook`, và tầng dữ liệu là `createMockApiClient()` của
 * `src/api/__mocks__/client.ts` — cùng phép ánh xạ bản sản phẩm dùng, nên test
 * không dựng một ý niệm thứ hai về hình dạng câu trả lời (R-70). Chỗ duy nhất
 * được thay là lượt tải thật: `createUpload` bị đổi bằng một task giả để test
 * bấm được từng nhịp tiến độ, thay vì chờ mạng.
 *
 * Bốn tệp mẫu bám vào bốn tầng thật của `MOCK_SPATIAL_PROJECT`: `Tầng hầm`
 * (`L-1`), `Tầng 1` (`L1`), `Tầng 2` (`L2`), `Tầng 3` (`L3`).
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type {
  NetworkMonitor,
  NetworkMonitorStatus,
  NetworkStatusListener,
} from '@/lib/offline/networkMonitor';
import { staggerDelayMs } from '@/lib/motion/stagger';
import { durationMs } from '@/lib/motion/tokens';
import { createTestQueryClient } from '@/lib/testing/render';
import type { UploadTask, UploadTaskState } from '@/lib/upload';
import { ROUTES } from '@/routes/paths';

import { createFloorUploadGateway, type FloorUploadGateway } from './floorUploadGateway';
import {
  useFloorUploadScreen,
  type FloorUploadToast,
  type UseFloorUploadScreenOptions,
} from './useFloorUploadScreen';

const PROJECT_ID = 'project-1';

/* -------------------------------------------------------------------------- */
/* jsdom không có `matchMedia`; `matches: false` là cách xếp rộng. Đặt lại      */
/* trước MỖI test vì `vi.restoreAllMocks()` ở dưới gỡ cả bản cài này.           */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Bộ theo dõi mạng giả: không ping thật, và test bật/tắt được từng nhịp. */
function createFakeNetworkMonitor(online = true): {
  readonly monitor: NetworkMonitor;
  readonly setOnline: (next: boolean) => void;
} {
  let isOnline = online;
  const listeners = new Set<NetworkStatusListener>();
  const statusOf = (): NetworkMonitorStatus => ({
    browserOnline: isOnline,
    checkedAt: 0,
    online: isOnline,
    pingOnline: isOnline,
  });

  return {
    monitor: {
      checkNow: async () => statusOf(),
      getStatus: statusOf,
      start: () => undefined,
      stop: () => undefined,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    setOnline: (next: boolean) => {
      isOnline = next;
      for (const listener of listeners) {
        listener(statusOf());
      }
    },
  };
}

/** Một lượt tải giả: test giữ `emit` và bấm từng nhịp tiến độ bằng tay. */
interface FakeUpload {
  readonly task: UploadTask;
  readonly emit: (state: Partial<UploadTaskState>) => void;
  readonly finish: (state: Partial<UploadTaskState>) => void;
  readonly cancelled: () => boolean;
}

function createFakeUploads() {
  const uploads = new Map<string, FakeUpload>();

  const createUpload: FloorUploadGateway['createUpload'] = ({ file, id, onProgress }) => {
    const uploadId = id ?? file.name;
    let resolveStart: ((state: UploadTaskState) => void) | null = null;
    let isCancelled = false;

    const baseState = (patch: Partial<UploadTaskState>): UploadTaskState => ({
      id: uploadId,
      fileName: file.name,
      sizeBytes: file.size,
      status: 'uploading',
      percent: 0,
      chunkCount: 1,
      chunksSent: 0,
      uploadId: 'upload-1',
      progress: null,
      failure: null,
      ...patch,
    });

    const task: UploadTask = {
      id: uploadId,
      getState: () => baseState({}),
      start: () =>
        new Promise<UploadTaskState>((resolve) => {
          resolveStart = resolve;
        }),
      cancel: () => {
        isCancelled = true;
      },
    };

    uploads.set(uploadId, {
      task,
      emit: (patch) => onProgress(baseState(patch)),
      finish: (patch) => {
        const state = baseState(patch);
        onProgress(state);
        resolveStart?.(state);
      },
      cancelled: () => isCancelled,
    });

    return task;
  };

  return { uploads, createUpload };
}

interface Harness {
  readonly gateway: FloorUploadGateway;
  readonly uploads: Map<string, FakeUpload>;
  readonly toasts: FloorUploadToast[];
  readonly navigations: string[];
  readonly setOnline: (next: boolean) => void;
}

function createHarness(
  overrides: Partial<FloorUploadGateway> = {},
  online = true,
): Harness & { readonly options: UseFloorUploadScreenOptions } {
  const network = createFakeNetworkMonitor(online);
  const { createUpload, uploads } = createFakeUploads();
  const real = createFloorUploadGateway(createMockApiClient(), {
    networkMonitor: network.monitor,
  });
  const gateway: FloorUploadGateway = { ...real, createUpload, ...overrides };
  const toasts: FloorUploadToast[] = [];
  const navigations: string[] = [];

  return {
    gateway,
    uploads,
    toasts,
    navigations,
    setOnline: network.setOnline,
    options: {
      gateway,
      projectId: PROJECT_ID,
      onToast: (toast) => toasts.push(toast),
      onNavigate: (path) => navigations.push(path),
    },
  };
}

function renderScreen(options: UseFloorUploadScreenOptions) {
  const client = createTestQueryClient();

  return renderHook(() => useFloorUploadScreen(options), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  });
}

function makeFile(name: string, sizeBytes = 16, type = 'image/png'): File {
  return new File(['x'.repeat(sizeBytes)], name, { type });
}

/* -------------------------------------------------------------------------- */
/* Đọc danh sách tầng.                                                         */
/* -------------------------------------------------------------------------- */

describe('useFloorUploadScreen — danh sách tầng', () => {
  it('đi từ "đang tải" sang danh sách bốn tầng, không tự viết cờ đang tải (R-64)', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    expect(result.current.state).toBe('loading');

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    expect(result.current.floors.map((row) => row.name)).toEqual([
      'Tầng hầm',
      'Tầng 1',
      'Tầng 2',
      'Tầng 3',
    ]);
    expect(result.current.footer.totalCount).toBe(4);
  });

  it('định dạng cao độ và chiều cao bằng dấu phẩy, và lấy trần qua ceilingElevationMm (M-11)', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    const ground = result.current.floors[1];
    const second = result.current.floors[2];

    // Tầng 1: cao độ 0 mm, chiều cao 3 900 mm ⇒ trần 3,90 m — chính là cao độ
    // sàn của Tầng 2. Đây là phép kiểm rằng trần đến từ `ceilingElevationMm`
    // chứ không từ một phép cộng viết trong màn.
    expect(ground?.elevationLabel).toBe('0 mm');
    expect(ground?.storeyHeightLabel).toBe('3,90 m');
    expect(ground?.ceilingElevationLabel).toBe('3,90 m');
    expect(second?.elevationLabel).toBe('3,90 m');
  });

  it('lỗi đọc danh sách tầng thành trạng thái "lỗi" của cả màn, có câu tiếng Việt', async () => {
    const harness = createHarness({
      readFloors: async () => ({
        ok: false,
        error: { kind: 'network', requestId: 'r-1', retryable: true, raw: null },
      }),
    });
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });

    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.errorMessage).toContain('kết nối');
  });
});

/* -------------------------------------------------------------------------- */
/* Nhận tệp và ghép tầng.                                                      */
/* -------------------------------------------------------------------------- */

describe('useFloorUploadScreen — nhận tệp', () => {
  it('ghép tệp vào đúng tầng theo tên tệp và đánh dấu là ghép tự động', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-2.png')]);
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });

    const row = result.current.floors[2];

    expect(row?.name).toBe('Tầng 2');
    expect(row?.isAutoMatched).toBe(true);
    expect(row?.autoMatchHint).toContain('kiểm tra lại');
    expect(row?.status).toBe('uploading');
    expect(result.current.tray.items).toHaveLength(0);
  });

  it('tệp không đoán được tầng rơi vào khay chưa gán, không phải một lỗi', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('A-101-trang-3.png')]);
    });

    await waitFor(() => {
      expect(result.current.tray.items).toHaveLength(1);
    });

    expect(result.current.tray.items[0]?.error).toBeNull();
    expect(result.current.tray.items[0]?.assignOptions).toHaveLength(4);
    expect(result.current.state).not.toBe('error');
  });

  it('tệp bị từ chối giữ lỗi trong đúng thẻ của nó, không chặn cả trang', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([
        makeFile('mat-bang-tang-2.png'),
        makeFile('ban-ve.xyz', 16, 'application/octet-stream'),
      ]);
    });

    await waitFor(() => {
      expect(result.current.tray.items).toHaveLength(1);
    });

    const rejected = result.current.tray.items[0];

    expect(rejected?.error?.kind).toBe('unsupportedFormat');
    expect(rejected?.error?.isRetryable).toBe(false);
    expect(rejected?.error?.sentence).toContain('Định dạng');
    // Lỗi của một tệp không leo lên trạng thái màn, và không chạm hàng khác.
    expect(result.current.state).not.toBe('error');
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.floors[2]?.error).toBeNull();
  });

  it('đóng lỗi của một tệp không chạm tệp khác', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('a.xyz'), makeFile('b.xyz')]);
    });

    await waitFor(() => {
      expect(result.current.tray.items).toHaveLength(2);
    });

    const firstId = result.current.tray.items[0]?.id ?? '';

    act(() => {
      result.current.onDismissError(firstId);
    });

    expect(result.current.tray.items[0]?.error).toBeNull();
    expect(result.current.tray.items[1]?.error).not.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Tiến độ, huỷ, thử lại.                                                      */
/* -------------------------------------------------------------------------- */

describe('useFloorUploadScreen — một lượt tải', () => {
  it('truyền thẳng phần trăm của uploadTask, không bóp tần suất lần thứ hai', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png')]);
    });

    await waitFor(() => {
      expect(harness.uploads.size).toBe(1);
    });

    const upload = [...harness.uploads.values()][0];

    act(() => {
      upload?.emit({ percent: 45, status: 'uploading' });
    });

    expect(result.current.floors[3]?.percent).toBe(45);
    expect(result.current.floors[3]?.percentLabel).toBe('45%');

    act(() => {
      upload?.finish({ percent: 100, status: 'done' });
    });

    await waitFor(() => {
      expect(result.current.floors[3]?.status).toBe('attached');
    });

    expect(result.current.floors[3]?.percent).toBe(100);
  });

  it('lượt tải hỏng cho câu tiếng Việt trong thẻ và mở nút thử lại', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png')]);
    });

    await waitFor(() => {
      expect(harness.uploads.size).toBe(1);
    });

    const upload = [...harness.uploads.values()][0];

    act(() => {
      upload?.finish({
        percent: 30,
        status: 'failed',
        failure: {
          stage: 'chunk',
          chunkIndex: 1,
          attempts: 3,
          terminal: false,
          error: {
            kind: 'upload',
            code: 'UPLOAD',
            messageKey: 'errors.upload.description',
            params: {},
            requestId: 'r-1',
            retryable: true,
            severity: 'lỗi',
            recovery: 'thử lại',
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.floors[3]?.status).toBe('error');
    });

    const row = result.current.floors[3];

    expect(row?.error?.kind).toBe('transfer');
    expect(row?.error?.sentence).toContain('Tệp tải lên chưa xong');
    expect(row?.canRetryUpload).toBe(true);
    // Vẫn không phải trạng thái lỗi của cả màn.
    expect(result.current.state).not.toBe('error');
  });

  it('huỷ gọi đúng task của tệp đó', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png')]);
    });

    await waitFor(() => {
      expect(harness.uploads.size).toBe(1);
    });

    const fileId = result.current.floors[3]?.file?.id ?? '';

    act(() => {
      result.current.onCancelUpload(fileId);
    });

    expect([...harness.uploads.values()][0]?.cancelled()).toBe(true);
  });

  it('mất mạng thì xếp vào hàng đợi ngoại tuyến thay vì gọi mạng', async () => {
    const enqueue = vi.fn(async () => true);
    const harness = createHarness({ enqueueOffline: enqueue }, false);
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.offlineNotice).toContain('ngoại tuyến');

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png')]);
    });

    await waitFor(() => {
      expect(enqueue).toHaveBeenCalledTimes(1);
    });

    expect(harness.uploads.size).toBe(0);
    expect(result.current.floors[3]?.status).toBe('waiting');
  });
});

/* -------------------------------------------------------------------------- */
/* Gán lại và xoá.                                                             */
/* -------------------------------------------------------------------------- */

describe('useFloorUploadScreen — gán lại và xoá', () => {
  it('gán lại tầng xoá dấu "ghép tự động" và mở lượt tải mới', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-2.png')]);
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });

    const fileId = result.current.floors[2]?.file?.id ?? '';

    act(() => {
      result.current.onReassign(fileId, 'L3');
    });

    await waitFor(() => {
      expect(result.current.floors[3]?.file).not.toBeNull();
    });

    expect(result.current.floors[2]?.file).toBeNull();
    expect(result.current.floors[3]?.isAutoMatched).toBe(false);
  });

  it('xoá xảy ra ngay, không hộp thoại, và hoàn tác được bằng vé (A8, D-05)', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-2.png')]);
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });

    const fileId = result.current.floors[2]?.file?.id ?? '';

    act(() => {
      result.current.onRemoveFile(fileId);
    });

    expect(result.current.floors[2]?.file).toBeNull();
    expect(harness.toasts).toHaveLength(1);
    expect(harness.toasts[0]?.message).toContain('Đã xoá bản vẽ');

    act(() => {
      harness.toasts[0]?.onUndo?.();
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Nút chính.                                                                  */
/* -------------------------------------------------------------------------- */

describe('useFloorUploadScreen — nút chính', () => {
  it('nút chặn nêu tên tầng thiếu và mang mã tầng để view cuộn tới', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    expect(result.current.footer.canSubmit).toBe(false);
    expect(result.current.blockNotice).toBeNull();

    act(() => {
      result.current.onSubmit();
    });

    const notice = result.current.blockNotice;

    expect(notice).not.toBeNull();
    expect(notice?.reasons.length).toBeGreaterThan(0);
    expect(notice?.reasons[0]?.sentence).toContain('Tầng hầm');
    expect(notice?.scrollTo.floorId).toBe('L-1');
    expect(harness.navigations).toHaveLength(0);
  });

  it('mỗi lượt bấm bị chặn cho một requestId mới, nên view cuộn lại được', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onSubmit();
    });

    const first = result.current.blockNotice?.scrollTo.requestId ?? 0;

    act(() => {
      result.current.onSubmit();
    });

    expect(result.current.blockNotice?.scrollTo.requestId).toBe(first + 1);
  });

  it('tầng đang tải cũng là một lý do chặn', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-2.png')]);
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.status).toBe('uploading');
    });

    expect(
      result.current.footer.blockReasons.some(
        (reason) => reason.kind === 'uploading' && reason.floorId === 'L2',
      ),
    ).toBe(true);
  });

  it('đủ bốn tầng thì điều hướng qua hằng ROUTES, không chuỗi viết thẳng (R-65)', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    // `Tầng 1` đã có sẵn một bản vẽ trên máy chủ trong bộ mẫu, nên chỉ ba tầng
    // còn lại cần tệp mới — và ba lượt tải, không phải bốn.
    act(() => {
      result.current.onFilesDropped([
        makeFile('tang-ham.png'),
        makeFile('tang-2.png'),
        makeFile('tang-3.png'),
      ]);
    });

    await waitFor(() => {
      expect(harness.uploads.size).toBe(3);
    });

    act(() => {
      for (const upload of harness.uploads.values()) {
        upload.finish({ percent: 100, status: 'done' });
      }
    });

    await waitFor(() => {
      expect(result.current.footer.canSubmit).toBe(true);
    });

    expect(result.current.footer.counterLabel).toBe('4 / 4 tầng đã có bản vẽ');
    expect(result.current.state).toBe('success');

    act(() => {
      result.current.onSubmit();
    });

    expect(harness.navigations).toEqual([ROUTES.project.pipeline(PROJECT_ID)]);
    expect(result.current.blockNotice).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Quyền và chuyển động.                                                       */
/* -------------------------------------------------------------------------- */

describe('useFloorUploadScreen — quyền và chuyển động', () => {
  it('vai chỉ xem tắt kéo thả và mọi thao tác sửa', async () => {
    const harness = createHarness();
    const { result } = renderScreen({ ...harness.options, roles: ['viewer'] });

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    expect(result.current.state).toBe('forbidden');
    expect(result.current.isReadOnly).toBe(true);
    expect(result.current.dropZone.isEnabled).toBe(false);
    expect(result.current.readOnlyNotice).not.toBeNull();
    expect(result.current.floors[0]?.reassignOptions).toHaveLength(0);

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-2.png')]);
      result.current.onDragEnter();
    });

    expect(result.current.isDragActive).toBe(false);
    expect(result.current.tray.items).toHaveLength(0);
  });

  it('thẻ hiện ra ở 260 ms với nhịp so le 24 ms, cả hai lấy từ src/lib/motion', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    expect(result.current.floors[0]?.revealDurationMs).toBe(durationMs('standard'));
    expect(result.current.floors[2]?.revealDelayMs).toBe(staggerDelayMs(2));
    // Đặc tả xin 240 ms; thang chuyển động không có giá trị đó, nên thẻ dùng
    // `standard` = 260 ms. Nhịp so le 24 ms thì hợp lệ nguyên vẹn.
    expect(result.current.floors[0]?.revealDurationMs).toBe(260);
    expect(result.current.floors[2]?.revealDelayMs).toBe(48);
  });

  it('vùng kéo thả nói trần dung lượng bằng hằng của src/lib/upload', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    expect(result.current.dropZone.formatsLine).toContain('.dwg');
    expect(result.current.dropZone.formatsLine).toContain('MB');
    expect(result.current.dropZone.acceptAttribute).toBe('.png,.jpg,.pdf,.dwg');
  });
});
