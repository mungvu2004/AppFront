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
import type { ApiResult, Progress } from '@/api/client';
import { ApiErrorBodySchema } from '@/api/schemas/errors';
import { ProgressSchema } from '@/api/schemas';
import type {
  NetworkMonitor,
  NetworkMonitorStatus,
  NetworkStatusListener,
} from '@/lib/offline/networkMonitor';
import { staggerDelayMs } from '@/lib/motion/stagger';
import { durationMs } from '@/lib/motion/tokens';
import { addPendingCommand, deletePendingCommand, listPendingCommands } from '@/lib/offline/queueStore';
import { getAppAnnouncer } from '@/lib/input/announcer';
import { createTestQueryClient } from '@/lib/testing/render';
import type { HttpError } from '@/lib/http';
import type { UploadTask, UploadTaskState } from '@/lib/upload';
import { createUploadTask } from '@/lib/upload/uploadTask';
import type { UploadCandidate } from '@/lib/upload/validate';
import { ROUTES } from '@/routes/paths';

import {
  createFloorUploadGateway,
  type CreateFloorUploadGatewayOptions,
  type FloorUploadGateway,
} from './floorUploadGateway';
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
  gatewayOptions: Omit<CreateFloorUploadGatewayOptions, 'networkMonitor'> = {},
): Harness & { readonly options: UseFloorUploadScreenOptions } {
  const network = createFakeNetworkMonitor(online);
  const { createUpload, uploads } = createFakeUploads();
  const real = createFloorUploadGateway(createMockApiClient(), {
    ...gatewayOptions,
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

interface QueuedUpload {
  readonly kind?: string;
  readonly label?: string;
  readonly fileName?: string;
  readonly floorId?: string;
  readonly pageIndex?: number;
}

/** Lệnh của dự án trong hàng đợi ngoại tuyến — đúng nguồn ConnectionStates đếm "chờ đồng bộ". */
async function queuedCommands(projectId = PROJECT_ID): Promise<QueuedUpload[]> {
  const listed = await listPendingCommands(projectId);

  return listed.ok ? listed.data.map((pending) => pending.command as QueuedUpload) : [];
}

/**
 * Chờ hàng đợi IndexedDB tới trạng thái mong đợi. Vẫn là chờ ĐIỀU KIỆN (về ngay khi đúng), nhưng
 * IndexedDB giả chạy trên hẹn giờ THẬT nên đồng hồ giả không đẩy được nó; trần 1 s mặc định của
 * `waitFor` hụt khi máy tải nặng (verify QA-01c, NO-392 (b)) — nới trần, dưới 5 000 ms của bài.
 */
const QUEUE_WAIT = { timeout: 4000 };
// Một bài có thể chờ hàng đợi 2 lần + một waitFor mặc định (≤ 9 s) — trần bài phải trên tổng đó.
vi.setConfig({ testTimeout: 15_000 });
const waitForQueue = (check: () => Promise<void>): Promise<void> => waitFor(check, QUEUE_WAIT);

/** Chỉ lệnh `uploadDrawing` của dự án. */
async function queuedUploads(projectId = PROJECT_ID): Promise<QueuedUpload[]> {
  return (await queuedCommands(projectId)).filter((command) => command.kind === 'uploadDrawing');
}

/** Chờ hàng đợi có đúng những tệp này (theo tên), thứ tự không quan trọng. */
async function expectQueuedFiles(names: readonly string[]): Promise<void> {
  await waitForQueue(async () => {
    expect((await queuedUploads()).map((command) => command.fileName).sort()).toEqual([...names].sort());
  });
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

  it('khổ hẹp: lỗi đọc danh sách tầng vẫn thắng thu gọn (BUG-072)', async () => {
    const harness = createHarness({
      readFloors: async () => ({
        ok: false,
        error: { kind: 'http', status: 404, code: 'PROJECT_NOT_FOUND', requestId: 'r-404', retryable: false, raw: {} },
      }),
    });
    const { result } = renderScreen({ ...harness.options, forceCollapsed: true });

    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });

    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.isCollapsed).toBe(true);
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

  it('mất mạng thì không gọi mạng; tệp chờ mạng có đúng một lệnh trong hàng đợi (NO-392)', async () => {
    const harness = createHarness({}, false);
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
      expect(result.current.floors[3]?.status).toBe('waiting');
    });

    expect(harness.uploads.size).toBe(0);
    await expectQueuedFiles(['mat-bang-tang-3.png']);
    // Dòng "chờ đồng bộ" của ConnectionStates đọc `label` của lệnh.
    expect((await queuedUploads())[0]).toMatchObject({ label: 'Tải bản vẽ mat-bang-tang-3.png khi có mạng' });
  });

  it('tệp chọn lúc ngoại tuyến tự tải khi mạng về, trong phiên đang mở (NO-389)', async () => {
    const harness = createHarness({}, false);
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png')]);
    });

    await waitFor(() => {
      expect(result.current.floors[3]?.status).toBe('waiting');
    });
    expect(harness.uploads.size).toBe(0);
    await waitFor(() => {
      expect(result.current.offlineNotice).toContain('tự tải lên khi có mạng trở lại');
    });
    expect(result.current.offlineNotice).toContain('cần chọn lại tệp');

    act(() => {
      harness.setOnline(true);
    });

    await waitFor(() => {
      expect(harness.uploads.size).toBe(1);
    });

    act(() => {
      [...harness.uploads.values()][0]?.finish({ percent: 100, status: 'done' });
    });

    await waitFor(() => {
      expect(result.current.floors[3]?.status).toBe('attached');
    });
  });

  it('"Thử lại" lúc ngoại tuyến không bỏ rơi tệp: mạng về thì tự tải lại (NO-389)', async () => {
    const created = vi.fn();
    const fake = createHarness();
    const harness = createHarness({
      createUpload: (input) => {
        created(input.file.name);
        return fake.gateway.createUpload(input);
      },
    });
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png')]);
    });

    await waitFor(() => {
      expect(fake.uploads.size).toBe(1);
    });

    act(() => {
      [...fake.uploads.values()][0]?.finish({
        status: 'failed',
        failure: {
          stage: 'chunk',
          chunkIndex: 0,
          attempts: 3,
          terminal: false,
          error: {
            kind: 'network',
            code: 'NETWORK',
            messageKey: 'errors.network.description',
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
      expect(result.current.floors[3]?.canRetryUpload).toBe(true);
    });

    act(() => {
      harness.setOnline(false);
    });

    const fileId = result.current.floors[3]?.file?.id ?? '';

    act(() => {
      result.current.onRetryUpload(fileId);
    });

    await waitFor(() => {
      expect(result.current.floors[3]?.status).toBe('waiting');
    });
    expect(created).toHaveBeenCalledTimes(1);

    act(() => {
      harness.setOnline(true);
    });

    await waitFor(() => {
      expect(created).toHaveBeenCalledTimes(2);
    });
    expect(result.current.floors[3]?.status).toBe('uploading');
  });
});

describe('useFloorUploadScreen — lệnh "chờ đồng bộ" của tệp chờ mạng: một lệnh mỗi tệp, gỡ ở mọi lối ra (NO-392)', () => {
  // Hàng đợi là IndexedDB dùng chung cả tệp test: mỗi bài bắt đầu từ hàng đợi rỗng.
  beforeEach(async () => {
    for (const projectId of [PROJECT_ID, 'project-khac']) {
      const listed = await listPendingCommands(projectId);

      for (const pending of listed.ok ? listed.data : []) {
        await deletePendingCommand(pending.id);
      }
    }
  });

  const terminalFailure = {
    status: 'failed' as const,
    failure: {
      stage: 'chunk' as const,
      chunkIndex: 0,
      attempts: 3,
      terminal: true,
      error: {
        kind: 'upload' as const,
        code: 'UPLOAD',
        messageKey: 'errors.upload.description',
        params: {},
        requestId: 'r-459',
        retryable: false,
        severity: 'lỗi' as const,
        recovery: 'thử lại' as const,
      },
    },
  };

  async function offlineWithFiles(names: readonly string[]) {
    const harness = createHarness({}, false);
    const view = renderScreen(harness.options);

    await waitFor(() => {
      expect(view.result.current.floors).toHaveLength(4);
    });

    act(() => {
      view.result.current.onFilesDropped(names.map((name) => makeFile(name)));
    });

    await expectQueuedFiles(names);
    // Hàng đợi (IndexedDB) và lượt vẽ của hook là hai đường riêng: hàng đợi đủ chưa có nghĩa lượt
    // vẽ gắn tệp vào tầng đã tới. Máy tải nặng, `fileIdOn` đọc phải lượt vẽ cũ, ra '' và các thao
    // tác sau thành không làm gì (verify QA-01c, NO-392 (b)) — chờ cả điều kiện này.
    await waitFor(() => {
      const shown = view.result.current.floors.flatMap((floor) => (floor.file === null ? [] : [floor.file.name]));

      expect(shown).toEqual(expect.arrayContaining([...names]));
    });

    return { harness, ...view };
  }

  const fileIdOn = (
    result: { readonly current: { readonly floors: readonly { readonly file: { readonly id: string } | null }[] } },
    index: number,
  ): string => result.current.floors[index]?.file?.id ?? '';

  it('(a) mỗi tệp chờ mạng đúng một lệnh; "Thử lại" lúc ngoại tuyến không ghi thêm', async () => {
    const { harness, result } = await offlineWithFiles(['mat-bang-tang-3.png', 'mat-bang-tang-2.png']);

    act(() => {
      result.current.onRetryUpload(fileIdOn(result, 3));
    });
    act(() => {
      result.current.onRetryUpload(fileIdOn(result, 3));
    });

    await expectQueuedFiles(['mat-bang-tang-3.png', 'mat-bang-tang-2.png']);
    expect(harness.uploads.size).toBe(0);

    // Mạng về: cả hai tệp rời hàng chờ, nên hàng đợi về rỗng — và không còn lượt
    // ghi nào đang bay sang bài sau.
    act(() => {
      harness.setOnline(true);
    });
    await expectQueuedFiles([]);
  });

  it('(b) mạng về, tự tải xong → lệnh gỡ', async () => {
    const { harness } = await offlineWithFiles(['mat-bang-tang-3.png']);

    act(() => {
      harness.setOnline(true);
    });
    await waitFor(() => {
      expect(harness.uploads.size).toBe(1);
    });
    act(() => {
      [...harness.uploads.values()][0]?.finish({ percent: 100, status: 'done' });
    });

    await expectQueuedFiles([]);
  });

  it('(b) mạng về, tự tải hỏng không còn thử lại → lệnh gỡ', async () => {
    const { harness, result } = await offlineWithFiles(['mat-bang-tang-3.png']);

    act(() => {
      harness.setOnline(true);
    });
    await waitFor(() => {
      expect(harness.uploads.size).toBe(1);
    });
    act(() => {
      [...harness.uploads.values()][0]?.finish(terminalFailure);
    });

    await waitFor(() => {
      expect(result.current.floors[3]?.status).toBe('error');
    });
    await expectQueuedFiles([]);
  });

  it('(b) xoá tệp → lệnh gỡ; hoàn tác → lệnh trở lại đúng một', async () => {
    const { harness, result } = await offlineWithFiles(['mat-bang-tang-3.png']);

    act(() => {
      result.current.onRemoveFile(fileIdOn(result, 3));
    });
    await expectQueuedFiles([]);

    act(() => {
      harness.toasts[0]?.onUndo?.();
    });
    await expectQueuedFiles(['mat-bang-tang-3.png']);
  });

  it('(b) gán lại về khay → lệnh gỡ; gán sang tầng khác → một lệnh, đúng tầng mới', async () => {
    const { result } = await offlineWithFiles(['mat-bang-tang-3.png']);
    const fileId = fileIdOn(result, 3);

    act(() => {
      result.current.onReassign(fileId, null);
    });
    await expectQueuedFiles([]);

    act(() => {
      result.current.onReassign(fileId, 'L2');
    });
    await waitForQueue(async () => {
      expect((await queuedUploads()).map((command) => command.floorId)).toEqual(['L2']);
    });
  });

  it('(b) tệp bị đẩy về khay (một tầng một tệp) → lệnh của nó gỡ, chỉ còn lệnh của tệp mới', async () => {
    const { result } = await offlineWithFiles(['mat-bang-tang-3.png', 'mat-bang-tang-2.png']);

    act(() => {
      result.current.onReassign(fileIdOn(result, 2), 'L3');
    });

    await waitForQueue(async () => {
      expect(await queuedUploads()).toEqual([
        expect.objectContaining({ fileName: 'mat-bang-tang-2.png', floorId: 'L3' }),
      ]);
    });
  });

  it('(b) hoàn tác vào tầng đã có tệp khác → tệp về khay, không thêm lệnh', async () => {
    const { harness, result } = await offlineWithFiles(['mat-bang-tang-3.png', 'mat-bang-tang-2.png']);

    act(() => {
      result.current.onRemoveFile(fileIdOn(result, 3));
    });
    act(() => {
      result.current.onReassign(fileIdOn(result, 2), 'L3');
    });
    await waitForQueue(async () => {
      expect(await queuedUploads()).toEqual([
        expect.objectContaining({ fileName: 'mat-bang-tang-2.png', floorId: 'L3' }),
      ]);
    });

    act(() => {
      harness.toasts[0]?.onUndo?.();
    });

    await waitFor(() => {
      expect(result.current.tray.items.map((item) => item.name)).toEqual(['mat-bang-tang-3.png']);
    });
    await expectQueuedFiles(['mat-bang-tang-2.png']);
  });

  it('(b) rời màn khi tệp đang chờ mạng → lệnh gỡ (tệp mất theo màn)', async () => {
    const { unmount } = await offlineWithFiles(['mat-bang-tang-3.png']);

    unmount();

    await expectQueuedFiles([]);
  });

  it('(c) mở màn gỡ lệnh tải bản vẽ mồ côi của dự án; lệnh loại khác và dự án khác còn nguyên', async () => {
    await addPendingCommand({
      projectId: PROJECT_ID,
      command: { kind: 'uploadDrawing', fileName: 'phien-truoc.png', floorId: 'L2', projectId: PROJECT_ID, sizeBytes: 4 },
    });
    await addPendingCommand({ projectId: PROJECT_ID, command: { kind: 'renameRoom', roomId: 'R-1' } });
    await addPendingCommand({
      projectId: 'project-khac',
      command: { kind: 'uploadDrawing', fileName: 'du-an-khac.png', floorId: 'L2', projectId: 'project-khac', sizeBytes: 4 },
    });

    await expectQueuedFiles(['phien-truoc.png']);

    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    await expectQueuedFiles([]);
    expect((await queuedCommands()).map((command) => command.kind)).toContain('renameRoom');
    expect((await queuedUploads('project-khac')).map((command) => command.fileName)).toEqual(['du-an-khac.png']);
  });
});

/**
 * Web Locks giả, dùng chung giữa các "tab" như `navigator.locks` thật dùng chung
 * cả origin: giữ khoá là ghi tên vào `held`, khoá không bao giờ nhả.
 */
function createFakeLocks() {
  const held = new Set<string>();

  return {
    request: async (name: string, _options: unknown, callback: () => Promise<unknown>) => {
      held.add(name);
      return callback();
    },
    query: async () => ({ held: [...held].map((name) => ({ name })) }),
  };
}

describe('useFloorUploadScreen — hai tab cùng dự án: mở màn chỉ gỡ lệnh của phiên đã chết (NO-400)', () => {
  // Lệnh của "tab khác" sống qua lượt mở màn của bài sau (đúng điều nhóm này
  // kiểm), nên dọn cả trước lẫn sau mỗi bài.
  async function clearQueue(): Promise<void> {
    cleanup();

    const listed = await listPendingCommands(PROJECT_ID);

    for (const pending of listed.ok ? listed.data : []) {
      await deletePendingCommand(pending.id);
    }
  }

  beforeEach(clearQueue);
  afterEach(clearQueue);

  /**
   * Tab B mở màn, rồi thả một tệp lúc mất mạng. Lệnh của tab B chỉ được ghi sau
   * lượt dọn mồ côi lúc mở màn (`orphansClearedRef`), nên khi nó có mặt trong
   * hàng đợi thì lượt dọn đã xong — không cần đoán giờ.
   */
  async function openSecondTab(gatewayOptions: Omit<CreateFloorUploadGatewayOptions, 'networkMonitor'>) {
    const tab = renderScreen(createHarness({}, false, gatewayOptions).options);

    await waitFor(() => {
      expect(tab.result.current.floors).toHaveLength(4);
    });
    await act(async () => {
      tab.result.current.onFilesDropped([makeFile('mat-bang-tang-2.png')]);
    });

    return tab;
  }

  it('tab mở sau không gỡ lệnh của tab đang sống chờ mạng', async () => {
    const locks = createFakeLocks();
    const first = renderScreen(createHarness({}, false, { locks, sessionId: 'tab-a' }).options);

    await waitFor(() => {
      expect(first.result.current.floors).toHaveLength(4);
    });
    act(() => {
      first.result.current.onFilesDropped([makeFile('mat-bang-tang-3.png')]);
    });
    await expectQueuedFiles(['mat-bang-tang-3.png']);

    await openSecondTab({ locks, sessionId: 'tab-b' });

    await expectQueuedFiles(['mat-bang-tang-3.png', 'mat-bang-tang-2.png']);
  });

  it('lệnh của phiên đã đóng (không còn giữ khoá) là mồ côi và bị gỡ', async () => {
    await addPendingCommand({
      projectId: PROJECT_ID,
      command: { kind: 'uploadDrawing', fileName: 'tab-da-dong.png', floorId: 'L3', projectId: PROJECT_ID, sizeBytes: 4, sessionId: 'tab-da-dong' },
    });

    await openSecondTab({ locks: createFakeLocks(), sessionId: 'tab-b' });

    await expectQueuedFiles(['mat-bang-tang-2.png']);
  });

  it('trình duyệt không có Web Locks: không gỡ lệnh của phiên khác (có thể còn sống)', async () => {
    await addPendingCommand({
      projectId: PROJECT_ID,
      command: { kind: 'uploadDrawing', fileName: 'tab-khac.png', floorId: 'L3', projectId: PROJECT_ID, sizeBytes: 4, sessionId: 'tab-a' },
    });

    await openSecondTab({ locks: null, sessionId: 'tab-b' });

    await expectQueuedFiles(['tab-khac.png', 'mat-bang-tang-2.png']);
  });

  /*
   * Hai bất biến thứ tự của NO-400, ghim ở cổng (review DEBT-04 #2). Khoá giả
   * ở hai bài trên cấp ngay lúc xin, nên chúng không phân biệt được thứ tự.
   */
  const uploadInput = { projectId: PROJECT_ID, floorId: 'L3', fileName: 'tab-a.png', sizeBytes: 4 };

  it('ghi lệnh chỉ sau khi khoá phiên đã được cấp', async () => {
    let grant: () => void = () => undefined;
    const locks = {
      request: (_name: string, _options: unknown, callback: () => Promise<unknown>) =>
        new Promise<unknown>((resolve) => {
          grant = () => resolve(callback());
        }),
      query: async () => ({ held: [] }),
    };
    const gateway = createFloorUploadGateway(createMockApiClient(), { locks, sessionId: 'tab-cho-khoa' });

    const enqueued = gateway.enqueueOffline(uploadInput);

    // Khoá chưa cấp: chưa lệnh nào được hiện ra cho tab khác thấy.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await queuedUploads()).toEqual([]);

    grant();
    expect(await enqueued).not.toBeNull();
    expect((await queuedUploads()).map((command) => command.fileName)).toEqual(['tab-a.png']);
  });

  it('đọc khoá SAU khi đọc lệnh: lệnh ghi xen giữa hai lượt đọc không bị coi là mồ côi', async () => {
    const held = new Set<string>();
    const locks = {
      request: async (name: string, _options: unknown, callback: () => Promise<unknown>) => {
        held.add(name);
        return callback();
      },
      query: async () => {
        const snapshot = { held: [...held].map((name) => ({ name })) };

        // Tab A xin khoá rồi ghi lệnh ngay sau lúc chụp danh sách khoá.
        await tabA.enqueueOffline(uploadInput);

        return snapshot;
      },
    };
    const tabA = createFloorUploadGateway(createMockApiClient(), { locks, sessionId: 'tab-a' });
    const tabB = createFloorUploadGateway(createMockApiClient(), { locks, sessionId: 'tab-b' });

    await tabB.clearOrphanUploads(PROJECT_ID);

    expect((await queuedUploads()).map((command) => command.fileName)).toEqual(['tab-a.png']);
  });
});

describe('useFloorUploadScreen — hàng đợi ngoại tuyến và hàng chờ mạng (NO-392, NO-393)', () => {
  it('hoàn tác xoá không đưa tệp về tầng đã nhận tệp khác: tệp về khay và chỉ tệp đang ở tầng được tải (NO-393)', async () => {
    const harness = createHarness({}, false);
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png'), makeFile('ban-ve-khac.png')]);
    });

    await waitFor(() => {
      expect(result.current.tray.items).toHaveLength(1);
    });
    await waitFor(() => {
      expect(result.current.floors[3]?.file?.name).toBe('mat-bang-tang-3.png');
    });

    const first = result.current.floors[3]?.file?.id ?? '';
    const other = result.current.tray.items[0]?.id ?? '';

    act(() => {
      result.current.onRemoveFile(first);
    });
    act(() => {
      result.current.onReassign(other, 'L3');
    });
    await waitFor(() => {
      expect(result.current.floors[3]?.file?.name).toBe('ban-ve-khac.png');
    });

    const announce = vi.spyOn(getAppAnnouncer(), 'announce');

    act(() => {
      harness.toasts[0]?.onUndo?.();
    });

    await waitFor(() => {
      expect(result.current.tray.items.map((item) => item.name)).toEqual(['mat-bang-tang-3.png']);
    });
    expect(result.current.floors[3]?.file?.name).toBe('ban-ve-khac.png');
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('mat-bang-tang-3.png đã về khay'));

    act(() => {
      harness.setOnline(true);
    });

    await waitFor(() => {
      expect(harness.uploads.size).toBe(1);
    });
    expect([...harness.uploads.values()][0]?.task.id).toBe(other);
  });

  it('tệp bị thay ở một tầng về khay có câu báo cho trình đọc màn hình (NO-393)', async () => {
    const harness = createHarness();
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png'), makeFile('mat-bang-tang-2.png')]);
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.file?.name).toBe('mat-bang-tang-2.png');
    });

    const announce = vi.spyOn(getAppAnnouncer(), 'announce');

    act(() => {
      result.current.onReassign(result.current.floors[2]?.file?.id ?? '', 'L3');
    });

    await waitFor(() => {
      expect(result.current.tray.items.map((item) => item.name)).toEqual(['mat-bang-tang-3.png']);
    });
    expect(announce).toHaveBeenCalledWith(
      'mat-bang-tang-3.png đã về khay tệp chưa gán tầng vì tầng ấy đã có tệp khác',
    );
  });

  it('câu "chờ mạng" đọc một lần cho cả lượt mất mạng, không một lần mỗi tệp', async () => {
    const harness = createHarness({}, false);
    const announce = vi.spyOn(getAppAnnouncer(), 'announce');
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([
        makeFile('mat-bang-tang-3.png'),
        makeFile('mat-bang-tang-2.png'),
        makeFile('mat-bang-tang-ham.png'),
      ]);
    });

    await waitFor(() => {
      expect(result.current.floors.filter((row) => row.file?.name.startsWith('mat-bang') ?? false)).toHaveLength(3);
    });

    const awaitCalls = (): number =>
      announce.mock.calls.filter(([sentence]) => String(sentence).includes('khi có mạng trở lại')).length;

    expect(awaitCalls()).toBe(1);
  });

  it('gán tệp thứ hai vào tầng đang có tệp chờ mạng: tệp cũ về khay, chỉ tệp mới được tải (NO-393)', async () => {
    const harness = createHarness({}, false);
    const { result } = renderScreen(harness.options);

    await waitFor(() => {
      expect(result.current.floors).toHaveLength(4);
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png'), makeFile('mat-bang-tang-2.png')]);
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.file?.name).toBe('mat-bang-tang-2.png');
    });

    const secondId = result.current.floors[2]?.file?.id ?? '';

    act(() => {
      result.current.onReassign(secondId, 'L3');
    });

    await waitFor(() => {
      expect(result.current.floors[3]?.file?.name).toBe('mat-bang-tang-2.png');
    });
    expect(result.current.tray.items.map((item) => item.name)).toEqual(['mat-bang-tang-3.png']);

    act(() => {
      harness.setOnline(true);
    });

    await waitFor(() => {
      expect(harness.uploads.size).toBe(1);
    });
    expect([...harness.uploads.values()][0]?.task.id).toBe(secondId);
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

    act(() => {
      for (const upload of harness.uploads.values()) {
        upload.finish({ percent: 100, status: 'done' });
      }
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.status).toBe('attached');
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
    // B-V4-03: trả về ĐÚNG trạng thái lúc xoá — "chờ xử lý" thì treo mãi.
    expect(result.current.floors[2]?.status).toBe('attached');
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
    // Nhãn tầng xuất hiện ĐÚNG MỘT LẦN: `floor.name` của API đã là `Tầng hầm`,
    // nên câu không được ghép thêm chữ `Tầng` ở đầu. Khẳng định nguyên câu chứ
    // không `toContain`, vì `toContain('Tầng hầm')` xanh cả với `Tầng Tầng hầm`.
    expect(notice?.reasons[0]?.sentence).toBe('Tầng hầm chưa có bản vẽ.');
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

    expect(result.current.dropZone.formatsLine).not.toContain('.dwg');
    expect(result.current.dropZone.formatsLine).toContain('MB');
    expect(result.current.dropZone.acceptAttribute).toBe('.png,.jpg,.pdf');
  });
});

/* -------------------------------------------------------------------------- */
/* pageIndex và PDF nhiều trang chờ chọn trang.                                */
/* -------------------------------------------------------------------------- */

const PICK_PAGE_SENTENCE = 'Hãy chọn trang bản vẽ để bắt đầu tải';

const pdfValidation =
  (pageCount: number): FloorUploadGateway['validateFile'] =>
  async (file: UploadCandidate) => ({
    branch: 'pdf',
    extension: '.pdf',
    ok: true,
    pageCount,
    sizeBytes: file.size,
  });

const bodyOf = (call: unknown[] | undefined): { pageIndex?: number } =>
  (call?.[0] ?? {}) as { pageIndex?: number };

const pdfFile = (name: string): File => makeFile(name, 16, 'application/pdf');

describe('useFloorUploadScreen — trang PDF', () => {
  const setup = async (overrides: Partial<FloorUploadGateway> = {}, online = true) => {
    const harness = createHarness(overrides, online);
    const createUpload = vi.spyOn(harness.gateway, 'createUpload');
    const view = renderScreen(harness.options);

    await waitFor(() => {
      expect(view.result.current.floors).toHaveLength(4);
    });

    return { ...harness, createUpload, ...view };
  };

  it('PDF 3 trang ghép tầng nhưng chưa tải, và nhắc chọn trang', async () => {
    const { createUpload, result } = await setup({ validateFile: pdfValidation(3) });

    act(() => {
      result.current.onFilesDropped([pdfFile('mat-bang-tang-2.pdf')]);
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });

    expect(createUpload).not.toHaveBeenCalled();
    expect(result.current.floors[2]?.status).toBe('waiting');
    await waitFor(() => {
      expect(document.body.textContent).toContain(PICK_PAGE_SENTENCE);
    });
    // B-V4-04: tệp chưa tải chưa phải bản vẽ của tầng — nút chính phải chặn.
    expect(result.current.footer.blockReasons).toContainEqual(
      expect.objectContaining({
        floorId: 'L2',
        kind: 'missingFile',
        sentence: 'Tầng 2 chưa tải xong bản vẽ.',
      }),
    );
  });

  it('chọn trang 3 thì tải đúng một lần, mang pageIndex 2', async () => {
    const { createUpload, result } = await setup({ validateFile: pdfValidation(3) });

    act(() => {
      result.current.onFilesDropped([pdfFile('mat-bang-tang-2.pdf')]);
    });
    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });

    act(() => {
      result.current.onPickPdfPage(result.current.floors[2]?.file?.id ?? '', '3');
    });

    expect(createUpload).toHaveBeenCalledTimes(1);
    expect(bodyOf(createUpload.mock.calls[0]).pageIndex).toBe(2);
    expect(result.current.floors[2]?.status).toBe('uploading');
  });

  it('đổi trang sau đó thì huỷ lượt cũ rồi tải lại', async () => {
    const { createUpload, result, uploads } = await setup({ validateFile: pdfValidation(3) });

    act(() => {
      result.current.onFilesDropped([pdfFile('mat-bang-tang-2.pdf')]);
    });
    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });

    const fileId = result.current.floors[2]?.file?.id ?? '';

    act(() => {
      result.current.onPickPdfPage(fileId, '3');
    });

    const first = [...uploads.values()][0];

    act(() => {
      result.current.onPickPdfPage(fileId, '1');
    });

    expect(first?.cancelled()).toBe(true);
    expect(createUpload).toHaveBeenCalledTimes(2);
    expect(bodyOf(createUpload.mock.calls[1]).pageIndex).toBe(0);
  });

  it('PDF một trang và ảnh tải ngay, thân vắng pageIndex', async () => {
    const { createUpload, result } = await setup({ validateFile: pdfValidation(1) });

    act(() => {
      result.current.onFilesDropped([pdfFile('mat-bang-tang-2.pdf')]);
    });
    await waitFor(() => {
      expect(createUpload).toHaveBeenCalledTimes(1);
    });
    expect('pageIndex' in bodyOf(createUpload.mock.calls[0])).toBe(false);

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-3.png')]);
    });
    await waitFor(() => {
      expect(createUpload).toHaveBeenCalledTimes(2);
    });
    expect('pageIndex' in bodyOf(createUpload.mock.calls[1])).toBe(false);
  });

  it('chọn trang lúc ngoại tuyến: lệnh hàng đợi mang pageIndex, mạng về thì lượt tải mang đúng nó', async () => {
    const { createUpload, result, setOnline } = await setup({ validateFile: pdfValidation(3) }, false);

    act(() => {
      result.current.onFilesDropped([pdfFile('mat-bang-tang-2.pdf')]);
    });
    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });

    act(() => {
      result.current.onPickPdfPage(result.current.floors[2]?.file?.id ?? '', '2');
    });

    // F-03.md:110 — lệnh hàng đợi mang theo trang đã chọn.
    await waitForQueue(async () => {
      expect((await queuedUploads()).map((command) => command.pageIndex)).toEqual([1]);
    });

    act(() => {
      setOnline(true);
    });

    await waitFor(() => {
      expect(createUpload).toHaveBeenCalledTimes(1);
    });
    expect(bodyOf(createUpload.mock.calls[0]).pageIndex).toBe(1);
    await expectQueuedFiles([]);
  });

  it('PDF nhiều trang chưa chọn trang: mạng về cũng chưa tải; chọn trang rồi mới tải (R2-6)', async () => {
    const { createUpload, result, setOnline } = await setup({ validateFile: pdfValidation(3) }, false);

    act(() => {
      result.current.onFilesDropped([pdfFile('mat-bang-tang-2.pdf')]);
    });
    await waitFor(() => {
      expect(result.current.floors[2]?.file).not.toBeNull();
    });

    await act(async () => {
      setOnline(true);
      await Promise.resolve();
    });
    expect(createUpload).not.toHaveBeenCalled();

    act(() => {
      result.current.onPickPdfPage(result.current.floors[2]?.file?.id ?? '', '2');
    });
    await waitFor(() => {
      expect(createUpload).toHaveBeenCalledTimes(1);
    });
    expect(bodyOf(createUpload.mock.calls[0]).pageIndex).toBe(1);
  });

  it('#5 trả 422 CAD_NOT_SUPPORTED thì thẻ nói câu về CAD, không in mã', async () => {
    const body = ApiErrorBodySchema.parse({ code: 'CAD_NOT_SUPPORTED', requestId: 'req-cad' });
    const error: HttpError = {
      code: body.code,
      kind: 'http',
      raw: { code: body.code, requestId: body.requestId },
      requestId: body.requestId,
      retryable: false,
      status: 422,
    };

    expect(() =>
      ProgressSchema.parse({ id: 'upload-1', progressPercent: 0, status: 'running', step: 'x' }),
    ).not.toThrow();

    const fail = async (): Promise<ApiResult<Progress>> => ({ error, ok: false });
    const api = { complete: fail, initUpload: fail, progress: fail, sendChunk: fail };
    const { result } = await setup({
      createUpload: ({ file, floorId, id, onProgress, projectId }) =>
        createUploadTask({
          api,
          file,
          floorId,
          projectId,
          onProgress,
          ...(id !== undefined ? { id } : {}),
        }),
    });

    act(() => {
      result.current.onFilesDropped([makeFile('mat-bang-tang-2.png')]);
    });

    await waitFor(() => {
      expect(result.current.floors[2]?.status).toBe('error');
    });

    const sentence = result.current.floors[2]?.error?.sentence ?? '';

    expect(sentence).toBe('Bản vẽ CAD (.dwg) chưa được hỗ trợ; hãy xuất sang PDF rồi tải lại.');
    expect(sentence).not.toContain('CAD_NOT_SUPPORTED');
    expect(result.current.floors[2]?.canRetryUpload).toBe(false);
  });
});
