/**
 * Nửa "suy nghĩ" của màn Xử lý, kiểm không cần DOM của màn.
 *
 * Hook được lái qua `renderHook`, và tầng dữ liệu là `createMockApiClient()` của
 * `src/api/__mocks__/client.ts` — cùng phép ánh xạ bản sản phẩm dùng, nên test
 * không dựng một ý niệm thứ hai về hình dạng câu trả lời (R-70). Danh sách tầng
 * và mã bản vẽ đọc từ chính `client.projects.read`, không gõ tay.
 *
 * Chỗ DUY NHẤT được thay là `drawings.progress`: nó bị đổi bằng một hàng đợi có
 * kịch bản, để test bấm được từng nhịp tiến độ thay vì chờ mạng — cùng cách
 * `useFloorUploadScreen.test.ts` thay `createUpload`. Giá trị `step` của mỗi nhịp
 * lấy từ `getPipelineStages()`, tức từ chính bảng bước thật, không phải một danh
 * sách tên bịa ra ở đây.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient } from '@/api/client';
import type { Progress } from '@/api/schemas';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import {
  createBackgroundWatchRegistry,
  type BackgroundWatchRegistry,
} from '@/lib/realtime/backgroundWatch';
import { POLL_INTERVAL_MS } from '@/lib/realtime/pollingChannel';
import { SSE_FAILURE_LIMIT } from '@/lib/realtime/progressStream';
import { getPipelineStages } from '@/lib/realtime/pipeline';
import { createTestQueryClient } from '@/lib/testing/render';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';

import { createProcessingGateway } from './processingGateway';
import { useProcessingScreen, type ProcessingFloorUpload } from './useProcessingScreen';
import type { ProcessingScreenProps } from './types';

const PROJECT_ID = 'project-1';
const STAGES = getPipelineStages();

/* -------------------------------------------------------------------------- */
/* Bộ giả của môi trường: EventSource, tab ẩn/hiện, matchMedia.                 */
/* -------------------------------------------------------------------------- */

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  triggerOpen(): void {
    this.onopen?.(new Event('open'));
  }

  triggerError(): void {
    this.onerror?.(new Event('error'));
  }

  triggerMessage(data: Progress): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

class MockVisibilityTarget {
  hidden: boolean;

  private readonly listeners = new Set<() => void>();

  constructor(hidden = false) {
    this.hidden = hidden;
  }

  addEventListener(type: 'visibilitychange', listener: () => void): void {
    if (type === 'visibilitychange') {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: 'visibilitychange', listener: () => void): void {
    if (type === 'visibilitychange') {
      this.listeners.delete(listener);
    }
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.listeners.forEach((listener) => {
      listener();
    });
  }
}

/* jsdom không có `matchMedia`; `matches: false` là cách xếp rộng, không giảm chuyển động. */
beforeEach(() => {
  MockEventSource.instances = [];
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

/**
 * Một nhịp tiến độ, dựng từ bảng bước THẬT.
 *
 * `stageIndex` là chỉ số trong `getPipelineStages()`; `step` lấy đúng `id` của
 * bước đó, nên nếu bảng bước đổi thì test này đổi theo chứ không lệch âm thầm.
 */
function progressAt(
  uploadId: string,
  stageIndex: number,
  overrides: Partial<Progress> = {},
): Progress {
  const stage = STAGES[stageIndex];

  if (stage === undefined) {
    throw new Error(`Không có bước nào ở chỉ số ${stageIndex}.`);
  }

  return {
    id: uploadId,
    progressPercent: 0,
    startedAt: '2026-08-17T07:32:00.000Z',
    status: 'running',
    step: stage.id,
    ...overrides,
  };
}

/** Nhịp cuối: cả lượt đã xong. `step` giữ nguyên bước cuối, `status` mới là thứ quyết định. */
function finishedProgress(uploadId: string): Progress {
  return progressAt(uploadId, STAGES.length - 1, {
    progressPercent: 100,
    status: 'completed',
    endedAt: '2026-08-17T07:40:00.000Z',
  });
}

interface Harness {
  readonly client: ApiClient;
  readonly progressCalls: () => number;
  readonly queue: (uploadId: string, progress: Progress) => void;
}

/**
 * `createMockApiClient()` với đúng một phương thức bị thay: `drawings.progress`
 * đọc từ hàng đợi kịch bản của test, và giữ nhịp cuối khi hàng đợi cạn.
 */
function makeScriptedClient(): Harness {
  const base = createMockApiClient();
  const queues = new Map<string, Progress[]>();
  const latest = new Map<string, Progress>();
  let calls = 0;

  const client: ApiClient = {
    ...base,
    drawings: {
      ...base.drawings,
      progress: async ({ uploadId }) => {
        calls += 1;
        const queued = queues.get(uploadId)?.shift();

        if (queued !== undefined) {
          latest.set(uploadId, queued);
        }

        const current = latest.get(uploadId) ?? progressAt(uploadId, 0);
        return { ok: true, data: current };
      },
    },
  };

  return {
    client,
    progressCalls: () => calls,
    queue: (uploadId, progress) => {
      const existing = queues.get(uploadId) ?? [];
      existing.push(progress);
      queues.set(uploadId, existing);
    },
  };
}

/** Danh sách tầng thật của dự án mẫu, kèm mã bản vẽ thật làm `uploadId`. */
async function readFloorUploads(
  client: ApiClient,
  limit: number,
): Promise<readonly ProcessingFloorUpload[]> {
  const result = await client.projects.read({ projectId: PROJECT_ID });

  if (!result.ok) {
    throw new Error('Không đọc được dự án mẫu.');
  }

  // Chỉ `L1` của dự án mẫu có sẵn bản vẽ; các tầng khác chưa tải gì. Mã lượt
  // tải của những tầng đó lấy theo mã tầng — `uploadId` là mã máy chủ sinh ra,
  // không có trong bộ mẫu, và ở test này chính kịch bản dưới đây là "máy chủ".
  return result.data.floors.slice(0, limit).map((floor) => {
    const drawing = floor.drawings[0];

    return {
      floorId: floor.id,
      floorName: floor.name,
      uploadId: drawing?.id ?? floor.id,
      ...(drawing !== undefined ? { sourceImageUrl: drawing.url } : {}),
    };
  });
}

interface Mounted {
  readonly result: { current: ProcessingScreenProps };
  readonly unmount: () => void;
  readonly rerender: () => void;
}

/**
 * Hai thứ của phần chạy nền phải tiêm được, vì bản mặc định của cả hai là một
 * đối tượng dùng chung cho cả phiên: sổ theo dõi nền và bus thông báo. Không
 * tiêm thì hai lượt kiểm thấy thông báo của nhau.
 */
interface BackgroundOptions {
  readonly notifications?: NotificationBus;
  readonly backgroundWatches?: BackgroundWatchRegistry;
}

function mountHook(
  client: ApiClient,
  uploads: readonly ProcessingFloorUpload[],
  queryClient: ReturnType<typeof createTestQueryClient>,
  visibilityTarget: MockVisibilityTarget,
  background: BackgroundOptions = {},
): Mounted {
  const gateway = createProcessingGateway(client, {
    EventSourceImpl: MockEventSource as unknown as typeof EventSource,
    visibilityTarget,
    ...(background.backgroundWatches !== undefined
      ? { backgroundWatches: background.backgroundWatches }
      : {}),
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useProcessingScreen({
        projectId: PROJECT_ID,
        floorUploads: uploads,
        gateway,
        ...(background.notifications !== undefined
          ? { notifications: background.notifications }
          : {}),
      }),
    { wrapper },
  );

  return {
    result: rendered.result as { current: ProcessingScreenProps },
    unmount: rendered.unmount,
    rerender: () => rendered.rerender(),
  };
}

const latestSource = (): MockEventSource => {
  const source = MockEventSource.instances.at(-1);

  if (source === undefined) {
    throw new Error('Chưa có kênh SSE nào được mở.');
  }

  return source;
};

/**
 * Để mọi lời hứa đang bay đáp xuống.
 *
 * `waitFor` của testing-library không dùng được ở đây: nó tự đặt hẹn giờ, mà
 * đồng hồ trong bộ test này là đồng hồ giả — nó sẽ chờ mãi. Đẩy hàng đợi vi tác
 * vụ vài vòng là đủ cho `useQueries` và dòng sự kiện.
 */
const settle = async (clock: FakeClock): Promise<void> => {
  await act(async () => {
    await clock.advance(0);
    await clock.flushMicrotasks();
    await clock.advance(0);
    await clock.flushMicrotasks();
  });
};

/** Ảnh chụp phần trăm của sáu bước — thứ người dùng thật sự nhìn thấy. */
const percentSnapshot = (props: ProcessingScreenProps): readonly number[] =>
  props.steps.map((step) => step.percent);

const doneStepCount = (props: ProcessingScreenProps): number =>
  props.steps.filter((step) => step.status === 'done').length;

/* -------------------------------------------------------------------------- */
/* Test.                                                                       */
/* -------------------------------------------------------------------------- */

describe('useProcessingScreen', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  it('SSE chết giữa bước 3: chuyển sang quay vòng và tiến độ KHÔNG nhảy lùi', async () => {
    const harness = makeScriptedClient();
    const uploads = await readFloorUploads(harness.client, 1);
    const upload = uploads[0]!;
    const visibility = new MockVisibilityTarget();
    const mounted = mountHook(harness.client, uploads, createTestQueryClient(), visibility);

    await settle(clock);
    expect(mounted.result.current.steps).toHaveLength(STAGES.length);

    const timeline: { readonly label: string; readonly percents: readonly number[] }[] = [];
    const record = (label: string): void => {
      timeline.push({ label, percents: percentSnapshot(mounted.result.current) });
    };

    // Đi tới bước 3 qua SSE, mỗi bước cách nhau thật sự về thời gian.
    await act(async () => {
      latestSource().triggerOpen();
    });

    for (let stageIndex = 0; stageIndex < 3; stageIndex += 1) {
      await act(async () => {
        latestSource().triggerMessage(
          progressAt(upload.uploadId, stageIndex, { progressPercent: stageIndex * 10 }),
        );
        await clock.advance(POLL_INTERVAL_MS);
      });
      record(`SSE — đang ở bước ${stageIndex + 1} (${STAGES[stageIndex]!.label})`);
    }

    const beforeFailure = percentSnapshot(mounted.result.current);
    const doneBeforeFailure = doneStepCount(mounted.result.current);
    expect(doneBeforeFailure).toBe(2);

    // SSE chết đúng giữa bước 3: đủ SSE_FAILURE_LIMIT lần mất kết nối liên tiếp.
    const callsBeforePolling = harness.progressCalls();

    for (let failure = 0; failure < SSE_FAILURE_LIMIT; failure += 1) {
      await act(async () => {
        latestSource().triggerError();
        await clock.advance(POLL_INTERVAL_MS);
      });
    }

    record('SSE chết ba lần liên tiếp → chuyển quay vòng');
    expect(harness.progressCalls()).toBeGreaterThan(callsBeforePolling);

    // Lượt quay vòng đầu tiên đọc lại một nhịp CŨ HƠN (máy chủ trả bước 1).
    // Đây chính là chỗ tiến độ có thể nhảy lùi nếu hook không giữ
    // `highestProgressReached` và không chặn hạ bước đã xong.
    harness.queue(upload.uploadId, progressAt(upload.uploadId, 0, { progressPercent: 0 }));

    await act(async () => {
      await clock.advance(POLL_INTERVAL_MS);
    });

    record('quay vòng — máy chủ trả lại nhịp CŨ (bước 1, 0%)');

    const afterRewind = percentSnapshot(mounted.result.current);

    console.log(
      [
        '',
        '--- tiến độ sáu bước qua từng nhịp (%) ---',
        ...timeline.map(
          (entry) => `${entry.percents.map((percent) => String(percent).padStart(3)).join(' ')}  ${entry.label}`,
        ),
        '-----------------------------------------',
        '',
      ].join('\n'),
    );

    beforeFailure.forEach((percent, index) => {
      expect(afterRewind[index]).toBeGreaterThanOrEqual(percent);
    });
    expect(doneStepCount(mounted.result.current)).toBeGreaterThanOrEqual(doneBeforeFailure);

    mounted.unmount();
  });

  it('tab ẩn thì ngừng nghe, hiện lại thì nghe tiếp', async () => {
    const harness = makeScriptedClient();
    const uploads = await readFloorUploads(harness.client, 1);
    const visibility = new MockVisibilityTarget();
    const mounted = mountHook(harness.client, uploads, createTestQueryClient(), visibility);

    await settle(clock);

    // Chỉ kênh quay vòng mới đọc `visibilityTarget`, nên đẩy dòng sự kiện sang
    // quay vòng trước đã. Sau mỗi lần hỏng, kênh tự hẹn giờ nối lại và mở một
    // `EventSource` MỚI — phải nhích đồng hồ qua nhịp đó thì lần hỏng kế tiếp
    // mới rơi vào kênh đang sống.
    for (let failure = 0; failure < SSE_FAILURE_LIMIT; failure += 1) {
      await act(async () => {
        latestSource().triggerError();
        await clock.advance(POLL_INTERVAL_MS);
      });
    }

    await act(async () => {
      await clock.advance(POLL_INTERVAL_MS);
    });

    const whileVisible = harness.progressCalls();

    await act(async () => {
      visibility.setHidden(true);
      await clock.advance(POLL_INTERVAL_MS * 4);
    });

    expect(harness.progressCalls()).toBe(whileVisible);

    await act(async () => {
      visibility.setHidden(false);
      await clock.flushMicrotasks();
    });

    expect(harness.progressCalls()).toBeGreaterThan(whileVisible);

    mounted.unmount();
  });

  it('một tầng lỗi không dừng các tầng khác', async () => {
    const harness = makeScriptedClient();
    const uploads = await readFloorUploads(harness.client, 3);
    const [failing, healthy] = [uploads[0]!, uploads[1]!];
    const visibility = new MockVisibilityTarget();
    const mounted = mountHook(harness.client, uploads, createTestQueryClient(), visibility);

    await settle(clock);
    expect(mounted.result.current.floors).toHaveLength(uploads.length);

    const sources = MockEventSource.instances.slice(0, uploads.length);

    await act(async () => {
      sources.forEach((source) => {
        source.triggerOpen();
      });
    });

    // Tầng đầu hỏng ngay ở bước 2; tầng thứ hai vẫn đi tiếp tới bước 4.
    await act(async () => {
      sources[0]!.triggerMessage(
        progressAt(failing.uploadId, 1, { status: 'failed', error: 'Bản vẽ không đọc được.' }),
      );
      await clock.advance(POLL_INTERVAL_MS);
    });

    for (let stageIndex = 0; stageIndex < 4; stageIndex += 1) {
      await act(async () => {
        sources[1]!.triggerMessage(progressAt(healthy.uploadId, stageIndex));
        await clock.advance(POLL_INTERVAL_MS);
      });
    }

    const props = mounted.result.current;
    const failedChip = props.floors.find((floor) => floor.id === failing.floorId);
    const healthyChip = props.floors.find((floor) => floor.id === healthy.floorId);

    expect(failedChip?.status).toBe('failed');
    expect(healthyChip?.status).toBe('running');
    expect(props.state).toBe('partial');
    expect(props.partialNoticeLine).toContain('vẫn đang được xử lý');
    expect(props.partialNoticeLine).toContain(failing.floorName);

    mounted.unmount();
  });

  it('rời màn giữa chừng rồi quay lại: tiến độ giữ nguyên', async () => {
    const harness = makeScriptedClient();
    const uploads = await readFloorUploads(harness.client, 1);
    const upload = uploads[0]!;
    const queryClient = createTestQueryClient();
    const visibility = new MockVisibilityTarget();
    const first = mountHook(harness.client, uploads, queryClient, visibility);

    await settle(clock);

    await act(async () => {
      latestSource().triggerOpen();
    });

    for (let stageIndex = 0; stageIndex < 4; stageIndex += 1) {
      await act(async () => {
        latestSource().triggerMessage(progressAt(upload.uploadId, stageIndex));
        await clock.advance(POLL_INTERVAL_MS);
      });
    }

    const doneBeforeLeaving = doneStepCount(first.result.current);
    expect(doneBeforeLeaving).toBe(3);

    first.unmount();

    // Máy chủ vẫn trả nhịp cuối cùng nó biết; lượt đọc mồi của lần quay lại
    // không được xoá tiến độ đã tích được trong bộ nhớ đệm.
    const second = mountHook(harness.client, uploads, queryClient, visibility);

    await settle(clock);

    expect(doneStepCount(second.result.current)).toBeGreaterThanOrEqual(doneBeforeLeaving);

    second.unmount();
  });

  it('lượt đọc báo cả lượt đã xong: đủ sáu bước xong và màn tới trạng thái success', async () => {
    const harness = makeScriptedClient();
    const uploads = await readFloorUploads(harness.client, 1);
    const upload = uploads[0]!;
    const visibility = new MockVisibilityTarget();
    const mounted = mountHook(harness.client, uploads, createTestQueryClient(), visibility);

    await settle(clock);

    await act(async () => {
      latestSource().triggerOpen();
      latestSource().triggerMessage(finishedProgress(upload.uploadId));
      await clock.advance(POLL_INTERVAL_MS);
    });

    const props = mounted.result.current;

    expect(doneStepCount(props)).toBe(STAGES.length);
    expect(props.steps.every((step) => step.percent === 100)).toBe(true);
    expect(props.state).toBe('success');
    expect(props.overallSummaryLine).toContain('Đã xong 1/1 tầng');

    mounted.unmount();
  });

  it('bấm chạy nền rồi RỜI MÀN: dòng sự kiện vẫn sống và lượt xong vẫn báo được', async () => {
    const harness = makeScriptedClient();
    const uploads = await readFloorUploads(harness.client, 1);
    const upload = uploads[0]!;
    const visibility = new MockVisibilityTarget();
    const notifications = createNotificationBus();
    const backgroundWatches = createBackgroundWatchRegistry();
    const mounted = mountHook(
      harness.client,
      uploads,
      createTestQueryClient(),
      visibility,
      { backgroundWatches, notifications },
    );

    await settle(clock);

    await act(async () => {
      latestSource().triggerOpen();
      latestSource().triggerMessage(progressAt(upload.uploadId, 0));
      await clock.advance(POLL_INTERVAL_MS);
    });

    // 1. Bấm nút. Lượt vào sổ theo dõi nền, và người dùng được hứa một câu.
    await act(async () => {
      mounted.result.current.onRunInBackground();
      await clock.flushMicrotasks();
    });

    expect(backgroundWatches.has(`${PROJECT_ID}:${upload.uploadId}`)).toBe(true);
    expect(notifications.list().map((item) => item.title)).toContain(
      'Sẽ báo cho bạn khi xử lý xong',
    );

    // 2. Rời màn. Dòng sự kiện KHÔNG bị đóng — đó là toàn bộ lời hứa.
    const source = latestSource();

    mounted.unmount();

    expect(source.closed).toBe(false);
    expect(backgroundWatches.has(`${PROJECT_ID}:${upload.uploadId}`)).toBe(true);

    // 3. Máy chủ báo xong khi màn đã tháo từ lâu.
    await act(async () => {
      source.triggerMessage(finishedProgress(upload.uploadId));
      await clock.advance(POLL_INTERVAL_MS);
    });

    expect(notifications.list().map((item) => item.title)).toContain(
      `${upload.floorName} đã xử lý xong`,
    );
    // Lượt đã kết thúc: sổ nhả nó, và dòng sự kiện được đóng đúng lúc này.
    expect(backgroundWatches.has(`${PROJECT_ID}:${upload.uploadId}`)).toBe(false);
    expect(source.closed).toBe(true);
  });

  it('rời màn mà KHÔNG bấm chạy nền: dòng sự kiện đóng lại như cũ', async () => {
    const harness = makeScriptedClient();
    const uploads = await readFloorUploads(harness.client, 1);
    const visibility = new MockVisibilityTarget();
    const notifications = createNotificationBus();
    const mounted = mountHook(
      harness.client,
      uploads,
      createTestQueryClient(),
      visibility,
      { backgroundWatches: createBackgroundWatchRegistry(), notifications },
    );

    await settle(clock);

    const source = latestSource();

    mounted.unmount();

    expect(source.closed).toBe(true);
    expect(notifications.list()).toEqual([]);
  });

  it('lượt hỏng khi đang chạy nền: câu báo nói lỗi, không nói xong', async () => {
    const harness = makeScriptedClient();
    const uploads = await readFloorUploads(harness.client, 1);
    const upload = uploads[0]!;
    const visibility = new MockVisibilityTarget();
    const notifications = createNotificationBus();
    const backgroundWatches = createBackgroundWatchRegistry();
    const mounted = mountHook(
      harness.client,
      uploads,
      createTestQueryClient(),
      visibility,
      { backgroundWatches, notifications },
    );

    await settle(clock);

    await act(async () => {
      latestSource().triggerOpen();
      mounted.result.current.onRunInBackground();
      await clock.flushMicrotasks();
    });

    const source = latestSource();

    mounted.unmount();

    await act(async () => {
      source.triggerMessage(
        progressAt(upload.uploadId, 1, { status: 'failed', error: 'Không đọc được bản vẽ.' }),
      );
      await clock.advance(POLL_INTERVAL_MS);
    });

    expect(notifications.list().map((item) => item.title)).toContain(
      `${upload.floorName} gặp lỗi khi xử lý`,
    );
    expect(notifications.list().map((item) => item.title)).not.toContain(
      `${upload.floorName} đã xử lý xong`,
    );
  });

  it('không có lượt xử lý nào thì bấm chạy nền KHÔNG hứa gì', async () => {
    const visibility = new MockVisibilityTarget();
    const notifications = createNotificationBus();
    const harness = makeScriptedClient();
    const mounted = mountHook(harness.client, [], createTestQueryClient(), visibility, {
      backgroundWatches: createBackgroundWatchRegistry(),
      notifications,
    });

    await settle(clock);

    await act(async () => {
      mounted.result.current.onRunInBackground();
      await clock.flushMicrotasks();
    });

    // Hứa "sẽ báo cho bạn khi xử lý xong" lúc không có gì đang chạy là hứa một
    // thông báo không bao giờ tới.
    expect(notifications.list()).toEqual([]);

    mounted.unmount();
  });

  it('không có lượt xử lý nào thì màn ở trạng thái empty, không phải tiến độ bịa', async () => {
    const harness = makeScriptedClient();
    const visibility = new MockVisibilityTarget();
    const mounted = mountHook(harness.client, [], createTestQueryClient(), visibility);

    await settle(clock);

    const props = mounted.result.current;

    expect(props.state).toBe('empty');
    // Các việc chưa có endpoint, phản ánh trung thực ra props — không giá trị bịa.
    expect(props.canCancel).toBe(false);
    expect(props.queueLine).toBeUndefined();
    expect(props.summary).toBeUndefined();
    expect(props.previewPanel.detectedGeometryPaths).toHaveLength(0);
    expect(props.steps).toHaveLength(0);

    mounted.unmount();
  });
});
