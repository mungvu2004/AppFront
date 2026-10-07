/**
 * Lượt kiểm của hook `useInputQualityGate` cho F-05a: mồi tầng, 404 thành rỗng,
 * khoá idempotency, hỏi trước (A9), và lỗi ghi hiện ra.
 *
 * Cổng dựng bằng `createInputQualityGateway(client bọc createMockApiClient(),
 * { createKey })` — đúng phép ánh xạ bản sản phẩm dùng, chỉ khác nguồn dữ liệu.
 * Thân lỗi là dữ liệu dây (literal); `ApiErrorBodySchema` chỉ để khẳng định thân
 * hợp lệ.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient, ApiResult, ImageQualityAssessment } from '@/api/client';
import { ApiErrorBodySchema } from '@/api/schemas/errors';
import type { HttpError } from '@/lib/http';
import { createQueryClient } from '@/lib/query/queryClient';
import type { ProjectRole } from '@/types/project';

import { createInputQualityGateway } from './inputQualityGateway';
import { useInputQualityGate, type InputQualityToast } from './useInputQualityGate';

const PROJECT_ID = 'project-1';
const MEASURED_FLOOR_IDS: readonly string[] = ['L1', 'L2'];

function wireError(status: number, code: string, extra: Record<string, string> = {}): HttpError {
  const body = { code, requestId: 'req-hook-1', ...extra };

  expect(ApiErrorBodySchema.safeParse(body).success).toBe(true);

  return { code, kind: 'http', raw: body, requestId: 'req-hook-1', retryable: false, status };
}

const timeoutError = (): HttpError => ({
  kind: 'timeout',
  raw: null,
  requestId: 'req-hook-timeout',
  retryable: true,
});

const failure = (error: HttpError): ApiResult<ImageQualityAssessment> => ({ error, ok: false });

interface Harness {
  readonly client: ApiClient;
  readonly assess: ReturnType<typeof vi.fn>;
  readonly straighten: ReturnType<typeof vi.fn>;
  readonly setCorners: ReturnType<typeof vi.fn>;
  readonly keys: () => readonly (string | undefined)[];
  readonly createKey: () => string;
}

interface HarnessOptions {
  /** Phản hồi dựng sẵn của #30, theo thứ tự gọi; hết thì dùng mặc định. */
  readonly assessResults?: ApiResult<ImageQualityAssessment>[];
  readonly straightenResults?: ApiResult<ImageQualityAssessment>[];
  readonly setCornersResults?: ApiResult<ImageQualityAssessment>[];
  /** Chặn mọi lượt #30 từ lượt thứ hai trở đi cho tới khi gọi hàm trả về. */
  readonly gateRereads?: { release: () => void };
}

/**
 * Máy chủ giả: tầng mồi chưa có bản vẽ nên #30 trả tầng 1 (`L1`) — tầng đầu có
 * bản vẽ — cùng danh sách các tầng đã đo.
 */
function createHarness(options: HarnessOptions = {}): Harness {
  const base = createMockApiClient();
  const assessQueue = [...(options.assessResults ?? [])];
  const straightenQueue = [...(options.straightenResults ?? [])];
  const cornersQueue = [...(options.setCornersResults ?? [])];
  let gate: Promise<void> | null = null;
  let counter = 0;

  if (options.gateRereads !== undefined) {
    const holder = options.gateRereads;

    gate = new Promise<void>((resolve) => {
      holder.release = resolve;
    });
  }

  const narrow = (data: ImageQualityAssessment, requested: string): ImageQualityAssessment => ({
    ...data,
    floorId: MEASURED_FLOOR_IDS.includes(requested) ? requested : 'L1',
    floors: data.floors.filter((floor) => MEASURED_FLOOR_IDS.includes(floor.floorId)),
  });

  let assessCalls = 0;
  const assess = vi.fn(async (input: Parameters<ApiClient['quality']['assess']>[0]) => {
    assessCalls += 1;

    if (assessCalls > 1 && gate !== null) {
      await gate;
    }

    const queued = assessQueue.shift();

    if (queued !== undefined) {
      return queued;
    }

    const result = await base.quality.assess(input);

    return result.ok ? { ok: true as const, data: narrow(result.data, input.floorId) } : result;
  });

  const straighten = vi.fn(async (input: Parameters<ApiClient['quality']['straighten']>[0]) => {
    const queued = straightenQueue.shift();

    if (queued !== undefined) {
      return queued;
    }

    const result = await base.quality.straighten(input);

    return result.ok ? { ok: true as const, data: narrow(result.data, input.floorId) } : result;
  });

  const setCorners = vi.fn(async (input: Parameters<ApiClient['quality']['setCorners']>[0]) => {
    const queued = cornersQueue.shift();

    if (queued !== undefined) {
      return queued;
    }

    const result = await base.quality.setCorners(input);

    return result.ok ? { ok: true as const, data: narrow(result.data, input.floorId) } : result;
  });

  return {
    assess,
    client: { ...base, quality: { assess, setCorners, straighten } },
    createKey: () => {
      counter += 1;

      return `key-${String(counter)}`;
    },
    keys: () => [
      ...straighten.mock.calls.map((call) => call[0].idempotencyKey),
      ...setCorners.mock.calls.map((call) => call[0].idempotencyKey),
    ],
    setCorners,
    straighten,
  };
}

function mountHook(
  harness: Harness,
  extra: { onToast?: (toast: InputQualityToast) => void; roles?: readonly ProjectRole[] } = {},
) {
  const queryClient = createQueryClient({ queries: { retry: false } });
  const gateway = createInputQualityGateway(harness.client, { createKey: harness.createKey });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return renderHook(
    (props: { projectId: string }) =>
      useInputQualityGate({
        forceCollapsed: false,
        gateway,
        projectId: props.projectId,
        ...(extra.onToast !== undefined ? { onToast: extra.onToast } : {}),
        ...(extra.roles !== undefined ? { roles: extra.roles } : {}),
      }),
    { initialProps: { projectId: PROJECT_ID }, wrapper },
  );
}

type Mounted = ReturnType<typeof mountHook>;

const ready = (mounted: Mounted) =>
  waitFor(() => {
    expect(mounted.result.current.model.status).not.toBe('loading');
  });

/** Bấm nắn thẳng, chờ hộp thoại, xác nhận, chờ lượt gửi xong (hộp thoại đóng). */
async function straightenOnce(mounted: Mounted) {
  act(() => mounted.result.current.actions.onStraighten());
  await waitFor(() => {
    expect(mounted.result.current.model.confirm).not.toBeNull();
  });
  act(() => mounted.result.current.actions.onConfirmWrite());
  await waitFor(() => {
    expect(mounted.result.current.model.confirm).toBeNull();
  });
}

/** Chờ tới khi hai nút ghi mở lại (không còn bay, không còn đọc lại). */
const unlocked = (mounted: Mounted) =>
  waitFor(() => {
    expect(
      mounted.result.current.model.findings.some((finding) => finding.action !== null),
    ).toBe(true);
  });

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useInputQualityGate — mồi tầng', () => {
  it('tầng đầu chưa có bản vẽ: #30 đúng một lần, tầng xem là tầng máy chủ trả, ảnh có nguồn, không partial', async () => {
    const harness = createHarness();
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);

    const { model } = mounted.result.current;

    expect(harness.assess).toHaveBeenCalledTimes(1);
    expect(model.status).toBe('ready');
    expect(model.floors.filter((row) => row.isActive).map((row) => row.label)).toEqual(['Tầng 1']);
    expect(model.image.src).toContain('L1.png');
    expect(model.partialNotice).toBeNull();

    await straightenOnce(mounted);

    expect(harness.straighten).toHaveBeenCalledTimes(1);
    expect(harness.straighten.mock.calls[0]?.[0]).toMatchObject({ floorId: 'L1', projectId: PROJECT_ID });
  });
});

describe('useInputQualityGate — lỗi đọc', () => {
  it('404 resource upload: trạng thái rỗng kèm noDrawingNotice, không phải lỗi', async () => {
    const harness = createHarness({
      assessResults: [failure(wireError(404, 'NOT_FOUND', { resource: 'upload' }))],
    });
    const mounted = mountHook(harness);

    await ready(mounted);

    expect(mounted.result.current.model.status).toBe('empty');
    expect(mounted.result.current.model.noDrawingNotice).toMatch(/chưa có bản vẽ/iu);
    expect(mounted.result.current.model.errorMessage).toBeNull();
    expect(mounted.result.current.model.passNotice).toBeNull();
  });

  it('404 resource floor: vẫn là lỗi, câu không chứa mã', async () => {
    const harness = createHarness({
      assessResults: [failure(wireError(404, 'NOT_FOUND', { resource: 'floor' }))],
    });
    const mounted = mountHook(harness);

    await ready(mounted);

    const { model } = mounted.result.current;

    expect(model.status).toBe('error');
    expect(model.noDrawingNotice).toBeNull();
    expect(model.errorMessage).toBeTruthy();
    expect(model.errorMessage).not.toMatch(/NOT_FOUND/u);
  });
});

describe('useInputQualityGate — hỏi trước (A9), không vé', () => {
  it('onStraighten chỉ mở hộp thoại; huỷ không gửi; xác nhận gửi một lượt và không gọi onToast', async () => {
    const harness = createHarness();
    const onToast = vi.fn();
    const mounted = mountHook(harness, { onToast });

    await ready(mounted);
    await unlocked(mounted);

    act(() => mounted.result.current.actions.onStraighten());

    expect(mounted.result.current.model.confirm?.title).toBe('Nắn thẳng bản vẽ tầng Tầng 1?');
    expect(mounted.result.current.model.confirm?.confirmLabel).toBe('Nắn thẳng');
    expect(mounted.result.current.model.confirm?.cancelLabel).toBe('Huỷ');
    expect(harness.straighten).not.toHaveBeenCalled();

    act(() => mounted.result.current.actions.onCancelWrite());

    expect(mounted.result.current.model.confirm).toBeNull();
    expect(harness.straighten).not.toHaveBeenCalled();

    await straightenOnce(mounted);

    expect(harness.straighten).toHaveBeenCalledTimes(1);
    expect(onToast).not.toHaveBeenCalled();
    expect(mounted.result.current.model.image.comparison).not.toBeNull();
  });

  it.each([
    ['không có khung cũ', 'L1'],
    ['có khung cũ', 'L2'],
  ] as const)('bốn góc (%s): hộp thoại, một lượt #31, không toast', async (_label, floorId) => {
    const harness = createHarness();
    const onToast = vi.fn();
    const mounted = mountHook(harness, { onToast });

    await ready(mounted);
    await unlocked(mounted);
    act(() => mounted.result.current.actions.onSelectFloor(floorId));
    await waitFor(() => {
      expect(mounted.result.current.model.floors.find((row) => row.id === floorId)?.isActive).toBe(true);
    });
    await ready(mounted);

    act(() => mounted.result.current.actions.onPickCorners());
    expect(mounted.result.current.model.confirm).toBeNull();
    expect(mounted.result.current.model.image.corners).not.toBeNull();

    act(() => mounted.result.current.actions.onPickCorners());

    const tier = floorId === 'L1' ? 'Tầng 1' : 'Tầng 2';

    expect(mounted.result.current.model.confirm?.title).toBe(
      `Cắt và nắn bản vẽ tầng ${tier} theo bốn góc?`,
    );
    expect(mounted.result.current.model.confirm?.confirmLabel).toBe('Cắt và nắn');
    expect(harness.setCorners).not.toHaveBeenCalled();

    act(() => mounted.result.current.actions.onConfirmWrite());
    await waitFor(() => {
      expect(mounted.result.current.model.confirm).toBeNull();
    });

    expect(harness.setCorners).toHaveBeenCalledTimes(1);
    expect(harness.setCorners.mock.calls[0]?.[0]).toMatchObject({ floorId });
    expect(onToast).not.toHaveBeenCalled();
  });
});

describe('useInputQualityGate — khoá idempotency', () => {
  it('hai lượt nắn thành công dùng hai khoá khác nhau', async () => {
    const harness = createHarness();
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);
    await straightenOnce(mounted);
    await unlocked(mounted);
    await straightenOnce(mounted);

    const [first, second] = harness.keys();

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('timeout rồi gửi lại giữ khoá; sau 409 hay sau thành công thì khoá mới', async () => {
    const harness = createHarness({
      straightenResults: [
        failure(timeoutError()),
        // gửi lại: không xếp hàng nữa, mock thật trả thành công — để nhánh sau đi tiếp
      ],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);

    await straightenOnce(mounted);
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).not.toBeNull();
    });
    await unlocked(mounted);
    await straightenOnce(mounted);
    await unlocked(mounted);

    const [first, retry] = harness.keys();

    expect(retry).toBe(first);

    // Lượt kế tiếp là thân mới sau thành công, và bị 409; lượt sau 409 lại là khoá mới.
    harness.straighten.mockImplementationOnce(async () => failure(wireError(409, 'QUALITY_DRAWING_CHANGED')));
    await straightenOnce(mounted);
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).not.toBeNull();
    });
    await unlocked(mounted);
    await straightenOnce(mounted);

    const keys = harness.keys();

    expect(keys[2]).not.toBe(keys[1]);
    expect(keys[3]).not.toBe(keys[2]);
  });

  it('bốn góc: gửi lại cùng góc sau timeout giữ khoá, đổi góc thì khoá mới', async () => {
    const harness = createHarness({
      setCornersResults: [failure(timeoutError()), failure(timeoutError())],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);

    const sendCorners = async () => {
      act(() => mounted.result.current.actions.onPickCorners());
      await waitFor(() => {
        expect(mounted.result.current.model.confirm).not.toBeNull();
      });
      act(() => mounted.result.current.actions.onConfirmWrite());
      await waitFor(() => {
        expect(mounted.result.current.model.confirm).toBeNull();
      });
      await waitFor(() => {
        expect(mounted.result.current.model.writeError).not.toBeNull();
      });
      await unlocked(mounted);
    };

    act(() => mounted.result.current.actions.onPickCorners());
    await sendCorners();
    await sendCorners();

    act(() => mounted.result.current.actions.onDragCorner('topLeft', 0.2, 0.2));
    act(() => mounted.result.current.actions.onPickCorners());
    await waitFor(() => {
      expect(mounted.result.current.model.confirm).not.toBeNull();
    });
    act(() => mounted.result.current.actions.onConfirmWrite());
    await waitFor(() => {
      expect(mounted.result.current.model.confirm).toBeNull();
    });

    const [first, same, changed] = harness.keys();

    expect(same).toBe(first);
    expect(changed).not.toBe(first);
  });
});

describe('useInputQualityGate — lỗi ghi hiện ra', () => {
  it('409 QUALITY_DRAWING_CHANGED: câu riêng và #30 được đọc lại', async () => {
    const harness = createHarness({
      straightenResults: [failure(wireError(409, 'QUALITY_DRAWING_CHANGED'))],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);

    const before = harness.assess.mock.calls.length;

    await straightenOnce(mounted);
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).toBe(
        'Bản vẽ của tầng vừa đổi, kết quả đo đã được đọc lại; hãy xem rồi thử lại.',
      );
    });
    await waitFor(() => {
      expect(harness.assess.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('422 QUALITY_LAYER_REVIEWED: câu chặn, không đọc lại, phát hiện đã đánh dấu trả về như cũ', async () => {
    const harness = createHarness({
      straightenResults: [failure(wireError(422, 'QUALITY_LAYER_REVIEWED'))],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);

    const before = harness.assess.mock.calls.length;

    await straightenOnce(mounted);
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).toMatch(/do người chỉnh/iu);
    });

    expect(harness.assess.mock.calls.length).toBe(before);
    expect(mounted.result.current.model.findings.every((finding) => !finding.isResolved)).toBe(true);
    expect(mounted.result.current.model.writeError).not.toMatch(/QUALITY_/u);
  });

  it('lỗi ghi xoá khi bắt đầu lượt ghi mới', async () => {
    const harness = createHarness({
      straightenResults: [failure(wireError(422, 'QUALITY_LAYER_REVIEWED'))],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);
    await straightenOnce(mounted);
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).not.toBeNull();
    });

    act(() => mounted.result.current.actions.onStraighten());
    act(() => mounted.result.current.actions.onConfirmWrite());

    expect(mounted.result.current.model.writeError).toBeNull();
    await waitFor(() => {
      expect(mounted.result.current.model.confirm).toBeNull();
    });
  });

  it('lỗi ghi xoá khi đổi tầng', async () => {
    const harness = createHarness({
      straightenResults: [failure(wireError(422, 'QUALITY_LAYER_REVIEWED'))],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);
    await straightenOnce(mounted);
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).not.toBeNull();
    });

    act(() => mounted.result.current.actions.onSelectFloor('L2'));

    expect(mounted.result.current.model.writeError).toBeNull();
  });

  it('#31 timeout: #30 đọc lại và hai nút khoá tới khi đọc xong', async () => {
    const gateRereads = { release: () => undefined };
    const harness = createHarness({
      gateRereads,
      setCornersResults: [failure(timeoutError())],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);

    act(() => mounted.result.current.actions.onPickCorners());
    act(() => mounted.result.current.actions.onPickCorners());
    await waitFor(() => {
      expect(mounted.result.current.model.confirm).not.toBeNull();
    });
    act(() => mounted.result.current.actions.onConfirmWrite());
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).toMatch(/chưa chắc máy chủ đã nhận/iu);
    });

    // Lượt #30 đọc lại đang bị giữ: không phát hiện nào còn nút, và bấm cũng không mở gì.
    expect(mounted.result.current.model.findings.length).toBeGreaterThan(0);
    expect(mounted.result.current.model.findings.every((finding) => finding.action === null)).toBe(true);
    act(() => mounted.result.current.actions.onStraighten());
    expect(mounted.result.current.model.confirm).toBeNull();

    await act(async () => {
      gateRereads.release();
      await Promise.resolve();
    });
    await unlocked(mounted);

    expect(harness.assess.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('useInputQualityGate — vòng sửa review 1', () => {
  it('500 rồi gửi lại cùng thân giữ khoá', async () => {
    const harness = createHarness({
      straightenResults: [failure(wireError(500, 'INTERNAL_ERROR'))],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);
    await straightenOnce(mounted);
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).not.toBeNull();
    });
    await straightenOnce(mounted);

    const [first, retry] = harness.keys();

    expect(first).toBeDefined();
    expect(retry).toBe(first);
  });

  it('đang gửi: nút vẫn trong DOM, bấm thêm không gửi lại, đổi tầng bị chặn', async () => {
    let release: () => void = () => undefined;
    const harness = createHarness();
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);

    const original = harness.straighten.getMockImplementation();

    harness.straighten.mockImplementationOnce(async (input) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });

      return original === undefined ? failure(timeoutError()) : original(input);
    });

    act(() => mounted.result.current.actions.onStraighten());
    act(() => mounted.result.current.actions.onConfirmWrite());
    await waitFor(() => {
      expect(mounted.result.current.model.confirm?.isBusy).toBe(true);
    });

    expect(mounted.result.current.model.findings.some((finding) => finding.action !== null)).toBe(true);

    act(() => mounted.result.current.actions.onConfirmWrite());
    act(() => mounted.result.current.actions.onSelectFloor('L2'));

    expect(mounted.result.current.model.floors.find((row) => row.isActive)?.label).toBe('Tầng 1');

    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mounted.result.current.model.confirm).toBeNull();
    });

    expect(harness.straighten).toHaveBeenCalledTimes(1);
  });

  it('đổi projectId: bỏ tầng đã chọn và lỗi ghi của dự án cũ', async () => {
    const harness = createHarness({
      straightenResults: [failure(wireError(422, 'QUALITY_LAYER_REVIEWED'))],
    });
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);
    act(() => mounted.result.current.actions.onSelectFloor('L2'));
    await waitFor(() => {
      expect(mounted.result.current.model.floors.find((row) => row.isActive)?.label).toBe('Tầng 2');
    });
    await straightenOnce(mounted);
    await waitFor(() => {
      expect(mounted.result.current.model.writeError).not.toBeNull();
    });

    mounted.rerender({ projectId: 'project-2' });

    expect(mounted.result.current.model.writeError).toBeNull();
    await waitFor(() => {
      expect(mounted.result.current.model.floors.find((row) => row.isActive)?.label).toBe('Tầng 1');
    });
  });

  it('lượt ghi của dự án cũ hỏng sau khi đổi dự án: không đặt lỗi lên dự án mới', async () => {
    let release: () => void = () => undefined;
    const harness = createHarness();
    const mounted = mountHook(harness);

    await ready(mounted);
    await unlocked(mounted);

    harness.straighten.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });

      return failure(wireError(422, 'QUALITY_LAYER_REVIEWED'));
    });

    act(() => mounted.result.current.actions.onStraighten());
    act(() => mounted.result.current.actions.onConfirmWrite());
    await waitFor(() => {
      expect(mounted.result.current.model.confirm?.isBusy).toBe(true);
    });

    mounted.rerender({ projectId: 'project-2' });
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(harness.straighten).toHaveBeenCalledTimes(1);
    });
    await ready(mounted);

    expect(mounted.result.current.model.writeError).toBeNull();
  });

  it('người xem + 404 upload: rỗng, không nút nào', async () => {
    const harness = createHarness({
      assessResults: [failure(wireError(404, 'NOT_FOUND', { resource: 'upload' }))],
    });
    const mounted = mountHook(harness, { roles: ['viewer'] });

    await ready(mounted);

    const { model } = mounted.result.current;

    expect(model.status).toBe('empty');
    expect(model.noDrawingNotice).not.toBeNull();
    expect(model.footer.areActionsHidden).toBe(true);
    expect(model.findings).toEqual([]);
  });
});
