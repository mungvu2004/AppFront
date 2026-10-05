/**
 * Nửa logic của màn registry model: `useModelRegistry` chạy thật trong container, client
 * tiêm tường minh (R5 — trong vitest `resolveUseMockApi()` là `false`), phiên đăng nhập là
 * thứ duy nhất bị thay.
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminMlClient } from '@/api/adminMlClient';
import { createMockAdminMlClient, MOCK_MODEL_VERSION_IDS } from '@/api/__mocks__/adminMlClient';
import type { ModelFamily, ModelVersion } from '@/api/schemas/adminMl';
import type { SessionSnapshot } from '@/lib/auth/types';
import type { HttpError, Result } from '@/lib/http';
import { createNotificationBus, type NotificationInput } from '@/lib/mutations/notificationBus';
import { queryKeys } from '@/lib/query/queryKeys';
import { renderWithProviders } from '@/lib/testing/render';
import { resolveConflict } from '@/lib/versioning/conflict';

import { ModelRegistryContainer } from './ModelRegistry.container';
import {
  MODEL_REGISTRY_ERROR_TEXT,
  describeReadError,
  describeWriteError,
  isConflictError,
  isCursorInvalidError,
  isForbiddenError,
} from './modelRegistryErrors';
import { canManageModels } from './modelRegistryGateway';

vi.mock('@/lib/versioning/conflict', () => ({ resolveConflict: vi.fn() }));

const auth = vi.hoisted(() => ({
  session: { roles: ['admin'], status: 'authenticated', user: { id: 'u-quan-tri', name: 'Quân' } } as SessionSnapshot,
}));

vi.mock('@/hooks/useSession', () => ({
  useSession: (): SessionSnapshot => auth.session,
}));

function signInAs(roles: SessionSnapshot['roles'], status: SessionSnapshot['status'] = 'authenticated'): void {
  auth.session = { roles, status, user: status === 'unknown' ? null : { id: 'u-quan-tri', name: 'Quân' } };
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }),
    writable: true,
  });
});

beforeEach(() => {
  signInAs(['admin']);
  vi.mocked(resolveConflict).mockClear();
});

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

const NOW = Date.parse('2026-10-05T03:00:00.000Z');
const WALL_VERSION_ID = 'mdl_01JA6M0RG00000000000000W01';

const WALL_VERSION: ModelVersion = {
  checksumSha256: '9'.repeat(64),
  createdAt: '2026-09-01T08:00:00.000Z',
  creatorId: 'usr_01JA6M0RG00000000000000A01',
  datasetVersionId: 'dsv_01JA6M0RG00000000000000S01',
  evaluationStatus: 'completed',
  family: 'wallSegmentation',
  id: WALL_VERSION_ID,
  label: 'Huấn luyện tường lượt 1',
  metrics: { iou: 0.812 },
  trainingJobId: 'job_01JA6M0RG00000000000000J01',
  weightsFormat: 'onnx',
};

const wireError = (status: number, code?: string, resource?: string): Result<never, HttpError> => ({
  error: {
    ...(code !== undefined ? { code } : {}),
    kind: 'http',
    raw: { ...(code !== undefined ? { code } : {}), ...(resource !== undefined ? { resource } : {}) },
    requestId: 'req-test',
    retryable: false,
    status,
  },
  ok: false,
});

type SpiedClient = { [K in keyof AdminMlClient]: ReturnType<typeof vi.fn<AdminMlClient[K]>> };

/** Bộ mẫu thật của mock, mỗi phương thức bọc `vi.fn` để đếm và thay từng lượt. */
function makeClient(overrides: Partial<AdminMlClient> = {}): SpiedClient {
  const base = createMockAdminMlClient();

  return {
    activateVersion: vi.fn(overrides.activateVersion ?? base.activateVersion),
    listFamilies: vi.fn(overrides.listFamilies ?? base.listFamilies),
    listVersions: vi.fn(overrides.listVersions ?? base.listVersions),
    readVersion: vi.fn(overrides.readVersion ?? base.readVersion),
  };
}

/** Họ tường đang dùng một bản đã đánh giá — để có nút "Quay về đường cổ điển". */
function makeWallActiveClient(overrides: Partial<AdminMlClient> = {}): SpiedClient {
  const base = createMockAdminMlClient();
  const families: ModelFamily[] = [
    { activeVersionId: WALL_VERSION_ID, family: 'wallSegmentation', revision: 7 },
    { family: 'openingAndFurnitureDetection', revision: 0 },
    { family: 'dimensionReading', revision: 0 },
  ];

  return makeClient({
    activateVersion: async ({ family, versionId }) => ({
      data: { ...(versionId === null ? {} : { activeVersionId: versionId }), family: family === 'wallSegmentation' ? family : 'wallSegmentation', revision: 8 },
      ok: true,
    }),
    listFamilies: async () => ({ data: families, ok: true }),
    listVersions: async (input) =>
      input.family === 'wallSegmentation' ? { data: { items: [WALL_VERSION] }, ok: true } : base.listVersions(input),
    readVersion: async (id) => (id === WALL_VERSION_ID ? { data: WALL_VERSION, ok: true } : base.readVersion(id)),
    ...overrides,
  });
}

function renderScreen(client: SpiedClient) {
  const bus = createNotificationBus();
  const published: NotificationInput[] = [];
  const publish = bus.publish;
  bus.publish = (input) => {
    published.push(input);
    publish(input);
  };

  const result = renderWithProviders(<ModelRegistryContainer client={client} notifications={bus} now={() => NOW} />);

  return { ...result, published };
}

async function chooseFamily(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('radio', { name }));
}

async function openActivateDialog(label: string): Promise<HTMLElement> {
  const labelButton = await screen.findByRole('button', { name: label });
  const row = labelButton.closest('tr');

  if (row === null) throw new Error(`không thấy hàng của ${label}`);

  fireEvent.click(within(row).getByRole('button', { name: 'Kích hoạt' }));

  return screen.findByRole('dialog');
}

function confirmButton(dialog: HTMLElement, name = 'Kích hoạt'): HTMLElement {
  return within(dialog).getByRole('button', { name });
}

/* -------------------------------------------------------------------------- */
/* Quyền và trạng thái tải.                                                    */
/* -------------------------------------------------------------------------- */

describe('Quyền — không lùi về vai dự án, không gọi mạng khi không có quyền', () => {
  it('phiên unknown → loading, không nháy forbidden, client chưa bị gọi', () => {
    signInAs([], 'unknown');
    const client = makeClient();
    const { container } = renderScreen(client);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('Chỉ quản trị viên hệ thống xem được model AI.')).toBeNull();
    expect(client.listFamilies).not.toHaveBeenCalled();
  });

  it('engineer → forbidden, client không bị gọi', () => {
    signInAs(['engineer']);
    const client = makeClient();
    renderScreen(client);

    expect(screen.getByText('Chỉ quản trị viên hệ thống xem được model AI.')).toBeInTheDocument();
    expect(client.listFamilies).not.toHaveBeenCalled();
    expect(client.listVersions).not.toHaveBeenCalled();
  });

  it('403 từ máy chủ → forbidden', async () => {
    renderScreen(makeClient({ listFamilies: async () => wireError(403, 'FORBIDDEN') }));

    expect(await screen.findByText('Chỉ quản trị viên hệ thống xem được model AI.')).toBeInTheDocument();
  });

  it('canManageModels chỉ nhận vai admin', () => {
    expect(canManageModels(['admin'])).toBe(true);
    expect(canManageModels(['engineer', 'viewer'])).toBe(false);
  });
});

describe('Họ và trạng thái', () => {
  it('họ tường rỗng trên seed (empty, đường cổ điển, không nút quay về) vẫn đổi được sang họ khác', async () => {
    const client = makeClient();
    renderScreen(client);

    expect(await screen.findByText('Họ này chưa có phiên bản nào. Tải trọng số bằng công cụ dòng lệnh, hoặc chờ một lượt huấn luyện xong. Đang dùng đường cổ điển.')).toBeInTheDocument();
    expect(screen.getByText('Đường cổ điển')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quay về đường cổ điển' })).toBeNull();

    await chooseFamily('Nhận diện cửa và đồ đạc');

    expect(await screen.findByRole('button', { name: 'Huấn luyện lượt 3' })).toBeInTheDocument();
    expect(client.listVersions).toHaveBeenLastCalledWith(
      expect.objectContaining({ family: 'openingAndFurnitureDetection' }),
    );
  });

  it('đổi họ bằng phím mũi tên', async () => {
    const client = makeClient();
    renderScreen(client);

    const wall = await screen.findByRole('radio', { name: 'Tách lớp tường' });
    fireEvent.keyDown(wall, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Nhận diện cửa và đồ đạc' })).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('họ có bản đang chờ → một phần; mở chi tiết qua N27', async () => {
    const client = makeClient();
    renderScreen(client);
    await chooseFamily('Đọc kích thước');

    expect(await screen.findByText('1 phiên bản đang chờ hoặc đang đánh giá; chỉ kích hoạt được bản đã đánh giá.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đọc số tải lên' }));
    const panel = await screen.findByRole('complementary', { name: 'Chi tiết phiên bản' });

    await waitFor(() => {
      expect(within(panel).getByText('CER 0,083', { selector: 'dd' })).toBeInTheDocument();
    });
    expect(client.readVersion).toHaveBeenCalledWith(MOCK_MODEL_VERSION_IDS.dimensionUploaded, expect.anything());
  });

  it('lượt đọc hỏng → lỗi kèm câu; "Thử lại" đọc lại', async () => {
    let fail = true;
    const base = createMockAdminMlClient();
    const client = makeClient({ listFamilies: async () => (fail ? wireError(503) : base.listFamilies()) });
    renderScreen(client);

    expect(await screen.findByText('Máy chủ đang bận. Thử lại sau ít phút.')).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Đường cổ điển')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Kích hoạt.                                                                  */
/* -------------------------------------------------------------------------- */

describe('Kích hoạt — hộp thoại A9, baseVersion, quay về', () => {
  it('chưa xác nhận thì không gọi N24; Esc đóng hộp thoại', async () => {
    const client = makeClient();
    renderScreen(client);
    await chooseFamily('Nhận diện cửa và đồ đạc');

    const dialog = await openActivateDialog('Huấn luyện lượt 3');
    expect(within(dialog).getByText('Kích hoạt Huấn luyện lượt 3 cho nhận diện cửa và đồ đạc?')).toBeInTheDocument();
    expect(client.activateVersion).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(client.activateVersion).not.toHaveBeenCalled();
  });

  it('bản đang dùng không có "Kích hoạt"; bản chưa đánh giá có nút tắt', async () => {
    renderScreen(makeClient());
    await chooseFamily('Nhận diện cửa và đồ đạc');

    const seedRow = (await screen.findAllByRole('button', { name: 'gốc' }))[0]?.closest('tr');
    const runningRow = screen.getByRole('button', { name: 'Huấn luyện lượt 4' }).closest('tr');

    expect(within(seedRow as HTMLElement).queryByRole('button', { name: 'Kích hoạt' })).toBeNull();
    expect(within(runningRow as HTMLElement).getByRole('button', { name: 'Kích hoạt' })).toBeDisabled();
  });

  it('baseVersion = revision mới nhất trong bộ đệm lúc bấm xác nhận', async () => {
    const client = makeClient();
    const { queryClient } = renderScreen(client);
    await chooseFamily('Nhận diện cửa và đồ đạc');
    const dialog = await openActivateDialog('Huấn luyện lượt 3');

    act(() => {
      queryClient.setQueryData<readonly ModelFamily[]>(queryKeys.adminMl.families(), (families) =>
        families?.map((family) =>
          family.family === 'openingAndFurnitureDetection' ? { ...family, revision: 9 } : family,
        ),
      );
    });
    fireEvent.click(confirmButton(dialog));

    await waitFor(() => {
      expect(client.activateVersion).toHaveBeenCalledWith({
        baseVersion: 9,
        family: 'openingAndFurnitureDetection',
        versionId: MOCK_MODEL_VERSION_IDS.doorTrained,
      });
    });
  });

  it('bản đang dùng đã đánh giá → toast kèm hoàn tác; hoàn tác gửi N24 bản trước với revision của phản hồi', async () => {
    const client = makeClient();
    const { published } = renderScreen(client);
    await chooseFamily('Nhận diện cửa và đồ đạc');
    const dialog = await openActivateDialog('Huấn luyện lượt 3');

    expect(within(dialog).queryByText('Bản đang dùng chưa đánh giá xong nên sau khi đổi sẽ chưa kích hoạt lại được.')).toBeNull();
    fireEvent.click(confirmButton(dialog));

    await waitFor(() => {
      expect(published).toHaveLength(1);
    });
    expect(published[0]?.title).toBe('Đã kích hoạt Huấn luyện lượt 3 cho nhận diện cửa và đồ đạc');
    expect(published[0]?.undoTicket).toBeDefined();
    // P2-2: nút "Kích hoạt" đã mở hộp thoại biến mất; tiêu điểm về thẻ "Đang dùng", không về body.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Đang dùng' }));
    });

    act(() => {
      published[0]?.undoTicket?.undo();
    });

    await waitFor(() => {
      expect(client.activateVersion).toHaveBeenLastCalledWith({
        baseVersion: 4,
        family: 'openingAndFurnitureDetection',
        versionId: MOCK_MODEL_VERSION_IDS.doorSeed,
      });
    });
    await waitFor(() => {
      expect(published.at(-1)?.title).toBe('Đã hoàn tác lượt đổi model');
    });
    // P2-1: câu nói đúng bản vừa được kích hoạt lại, không phải "quay về đường cổ điển".
    expect(published.at(-1)?.description).toBe('Đã kích hoạt gốc cho nhận diện cửa và đồ đạc');
  });

  it('bản đang dùng chưa đánh giá → hộp thoại cảnh báo, toast không có hoàn tác', async () => {
    const client = makeClient();
    const { published } = renderScreen(client);
    await chooseFamily('Đọc kích thước');
    const dialog = await openActivateDialog('Đọc số tải lên');

    expect(within(dialog).getByText('Bản đang dùng chưa đánh giá xong nên sau khi đổi sẽ chưa kích hoạt lại được.')).toBeInTheDocument();
    fireEvent.click(confirmButton(dialog));

    await waitFor(() => {
      expect(published).toHaveLength(1);
    });
    expect(published[0]?.undoTicket).toBeUndefined();
    expect(published[0]?.description).toBe('Bản trước chưa đánh giá xong nên lượt đổi này không hoàn tác được.');
  });

  it('quay về chỉ ở họ tường và gửi versionId null; hoàn tác kích hoạt lại bản cũ', async () => {
    const client = makeWallActiveClient();
    const { published } = renderScreen(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Quay về đường cổ điển' }));
    const dialog = await screen.findByRole('dialog', { name: 'Quay về đường cổ điển cho tách lớp tường?' });
    fireEvent.click(confirmButton(dialog, 'Quay về đường cổ điển'));

    await waitFor(() => {
      expect(client.activateVersion).toHaveBeenCalledWith({ baseVersion: 7, family: 'wallSegmentation', versionId: null });
    });
    await waitFor(() => {
      expect(published[0]?.undoTicket).toBeDefined();
    });
    act(() => {
      published[0]?.undoTicket?.undo();
    });
    await waitFor(() => {
      expect(client.activateVersion).toHaveBeenLastCalledWith({
        baseVersion: 8,
        family: 'wallSegmentation',
        versionId: WALL_VERSION_ID,
      });
    });
    await waitFor(() => {
      expect(published.at(-1)?.description).toBe('Đã kích hoạt Huấn luyện tường lượt 1 cho tách lớp tường');
    });

    await chooseFamily('Nhận diện cửa và đồ đạc');
    await screen.findByRole('button', { name: 'Huấn luyện lượt 3' });
    expect(screen.queryByRole('button', { name: 'Quay về đường cổ điển' })).toBeNull();
  });

  it('họ khác họ tường đang trống: không hoàn tác, không bao giờ gửi versionId null (P1-1)', async () => {
    const client = makeWallActiveClient({
      activateVersion: async ({ family, versionId }) => ({
        data: {
          ...(versionId === null ? {} : { activeVersionId: versionId }),
          family: family === 'dimensionReading' ? family : 'openingAndFurnitureDetection',
          revision: 1,
        },
        ok: true,
      }),
    });
    const { published } = renderScreen(client);
    await chooseFamily('Nhận diện cửa và đồ đạc');

    expect(await screen.findByText('Chưa kích hoạt bản nào')).toBeInTheDocument();
    const dialog = await openActivateDialog('Huấn luyện lượt 3');
    fireEvent.click(confirmButton(dialog));

    await waitFor(() => {
      expect(published).toHaveLength(1);
    });
    expect(published[0]?.undoTicket).toBeUndefined();
    expect(published[0]?.description).toBe('Họ này trước đó chưa có bản nào nên lượt đổi này không hoàn tác được.');
    for (const [input] of client.activateVersion.mock.calls) {
      expect(input.versionId).not.toBeNull();
    }
  });

  it('bản đang dùng chưa về (N27 còn chạy): không cảnh báo vội, nút xác nhận chờ (N-1)', async () => {
    const other: ModelVersion = { ...WALL_VERSION, id: 'mdl_01JA6M0RG00000000000000W02', label: 'Huấn luyện tường lượt 2' };
    const client = makeWallActiveClient({
      listVersions: async () => ({ data: { items: [other] }, ok: true }),
      readVersion: () => new Promise(() => undefined),
    });
    renderScreen(client);

    const dialog = await openActivateDialog('Huấn luyện tường lượt 2');

    expect(within(dialog).queryByText('Bản đang dùng chưa đánh giá xong nên sau khi đổi sẽ chưa kích hoạt lại được.')).toBeNull();
    expect(confirmButton(dialog)).toBeDisabled();
    fireEvent.click(confirmButton(dialog));
    expect(client.activateVersion).not.toHaveBeenCalled();
  });

  it('409 → đóng hộp thoại, dải tải lại; resolveConflict gọi 0 lần; "Tải lại" đọc lại N23', async () => {
    const client = makeClient({ activateVersion: async () => wireError(409, 'VERSION_CONFLICT') });
    renderScreen(client);
    await chooseFamily('Nhận diện cửa và đồ đạc');
    fireEvent.click(confirmButton(await openActivateDialog('Huấn luyện lượt 3')));

    expect(
      await screen.findByText('Nhận diện cửa và đồ đạc vừa được đổi ở nơi khác. Tải lại để thấy bản đang dùng.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(resolveConflict).toHaveBeenCalledTimes(0);

    const familyReads = client.listFamilies.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));

    await waitFor(() => {
      expect(client.listFamilies.mock.calls.length).toBeGreaterThan(familyReads);
    });
    expect(screen.queryByText(/vừa được đổi ở nơi khác/u)).toBeNull();
  });

  it('422 → câu trong hộp thoại và làm mới N25; mã lạ → câu dự phòng, DOM không chứa mã', async () => {
    let code = 'MODEL_VERSION_NOT_EVALUATED';
    const client = makeClient({ activateVersion: async () => wireError(422, code) });
    renderScreen(client);
    await chooseFamily('Nhận diện cửa và đồ đạc');
    const dialog = await openActivateDialog('Huấn luyện lượt 3');
    const versionReads = client.listVersions.mock.calls.length;

    fireEvent.click(confirmButton(dialog));
    expect(await within(dialog).findByText(MODEL_REGISTRY_ERROR_TEXT.notEvaluated)).toBeInTheDocument();
    await waitFor(() => {
      expect(client.listVersions.mock.calls.length).toBeGreaterThan(versionReads);
    });

    code = 'SOMETHING_NEW';
    fireEvent.click(confirmButton(dialog));
    expect(await within(dialog).findByText(MODEL_REGISTRY_ERROR_TEXT.writeFallback)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SOMETHING_NEW');
    expect(document.body.textContent).not.toContain('MODEL_VERSION_NOT_EVALUATED');
  });

  it('403 khi ghi → forbidden', async () => {
    renderScreen(makeClient({ activateVersion: async () => wireError(403, 'FORBIDDEN') }));
    await chooseFamily('Nhận diện cửa và đồ đạc');
    fireEvent.click(confirmButton(await openActivateDialog('Huấn luyện lượt 3')));

    expect(await screen.findByText('Chỉ quản trị viên hệ thống xem được model AI.')).toBeInTheDocument();
  });

  it('hoàn tác hỏng → toast báo, không mở lại hộp thoại', async () => {
    let calls = 0;
    const base = createMockAdminMlClient();
    const client = makeClient({
      activateVersion: async (input) => {
        calls += 1;
        return calls === 1 ? base.activateVersion(input) : wireError(503);
      },
    });
    const { published } = renderScreen(client);
    await chooseFamily('Nhận diện cửa và đồ đạc');
    fireEvent.click(confirmButton(await openActivateDialog('Huấn luyện lượt 3')));
    await waitFor(() => {
      expect(published[0]?.undoTicket).toBeDefined();
    });

    act(() => {
      published[0]?.undoTicket?.undo();
    });

    await waitFor(() => {
      expect(published.at(-1)).toMatchObject({
        description: MODEL_REGISTRY_ERROR_TEXT.busy,
        title: 'Chưa hoàn tác được lượt đổi model',
      });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Con trỏ, và bảng mã lỗi.                                                    */
/* -------------------------------------------------------------------------- */

describe('CURSOR_INVALID — đọc lại từ trang đầu đúng một lần', () => {
  it('lần đầu đọc lại trang đầu; lần hai thành lỗi đọc', async () => {
    const page = { items: [WALL_VERSION], nextCursor: 'con-tro-1' };
    const client = makeWallActiveClient({
      listVersions: async ({ cursor }) => (cursor === undefined ? { data: page, ok: true } : wireError(422, 'CURSOR_INVALID')),
    });
    renderScreen(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));
    await waitFor(() => {
      expect(client.listVersions.mock.calls.filter(([input]) => input.cursor === undefined)).toHaveLength(2);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText(MODEL_REGISTRY_ERROR_TEXT.readFallback)).toBeInTheDocument();
    expect(client.listVersions.mock.calls.filter(([input]) => input.cursor === undefined)).toHaveLength(2);
    expect(client.listVersions).toHaveBeenCalledTimes(4);
  });
});

describe('"Xem thêm" hỏng (N-3)', () => {
  it('503 ở trang sau: bảng đã nạp giữ nguyên, câu báo cạnh nút', async () => {
    const client = makeWallActiveClient({
      listVersions: async ({ cursor }) =>
        cursor === undefined ? { data: { items: [WALL_VERSION], nextCursor: 'con-tro-1' }, ok: true } : wireError(503),
    });
    renderScreen(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));

    expect(await screen.findByText(MODEL_REGISTRY_ERROR_TEXT.busy)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Huấn luyện tường lượt 1' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('Bảng mã lỗi [2]', () => {
  const http = (status: number, code?: string, resource?: string): HttpError => {
    const result = wireError(status, code, resource);

    if (result.ok) throw new Error('không thể');

    return result.error;
  };

  it.each([
    [http(422, 'MODEL_VERSION_NOT_EVALUATED'), MODEL_REGISTRY_ERROR_TEXT.notEvaluated],
    [http(422, 'MODEL_FORMAT_UNSUPPORTED'), MODEL_REGISTRY_ERROR_TEXT.formatUnsupported],
    [http(422, 'MODEL_VERSION_FAMILY_MISMATCH'), MODEL_REGISTRY_ERROR_TEXT.familyMismatch],
    [http(404, 'NOT_FOUND', 'modelVersion'), MODEL_REGISTRY_ERROR_TEXT.versionNotFound],
    [http(404, 'NOT_FOUND', 'modelFamily'), MODEL_REGISTRY_ERROR_TEXT.familyNotFound],
    [http(429, 'RATE_LIMITED'), MODEL_REGISTRY_ERROR_TEXT.busy],
    [http(503, 'DEPENDENCY_UNAVAILABLE'), MODEL_REGISTRY_ERROR_TEXT.busy],
    [{ kind: 'network', raw: null, requestId: 'r', retryable: true }, MODEL_REGISTRY_ERROR_TEXT.busy],
    [http(428, 'PRECONDITION_REQUIRED'), MODEL_REGISTRY_ERROR_TEXT.writeFallback],
    [http(422, 'VALIDATION'), MODEL_REGISTRY_ERROR_TEXT.writeFallback],
    [new Error('lạ'), MODEL_REGISTRY_ERROR_TEXT.writeFallback],
  ])('ghi: %o → đúng câu', (error, sentence) => {
    expect(describeWriteError(error)).toBe(sentence);
  });

  it('đọc: mã lạ → "Không đọc được danh sách model.", không in mã', () => {
    expect(describeReadError(http(500, 'INTERNAL'))).toBe(MODEL_REGISTRY_ERROR_TEXT.readFallback);
    expect(describeReadError(http(404, 'NOT_FOUND', 'modelVersion'))).toBe(MODEL_REGISTRY_ERROR_TEXT.versionNotFound);
  });

  it('phân loại 403, 409, CURSOR_INVALID', () => {
    expect(isForbiddenError(http(403, 'FORBIDDEN'))).toBe(true);
    expect(isConflictError(http(409, 'VERSION_CONFLICT'))).toBe(true);
    expect(isCursorInvalidError(http(422, 'CURSOR_INVALID'))).toBe(true);
    expect(isCursorInvalidError(null)).toBe(false);
  });
});
