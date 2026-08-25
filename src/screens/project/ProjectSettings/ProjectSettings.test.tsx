import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient } from '@/api/client';
import viMessages from '@/i18n/vi.json';
import type { AutosaveState } from '@/lib/autosave/createAutosave';
import { RETRY_SCHEDULE_MS } from '@/lib/autosave/retrySchedule';
import type { SaveState } from '@/components/feedback/SaveIndicator';
import type { HttpError } from '@/lib/http';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { renderWithProviders } from '@/lib/testing/render';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { ProjectSettings, ProjectSettingsView } from './ProjectSettings';
import { createProjectSettingsGateway, type ProjectSettingsGateway } from './projectSettingsGateway';
import {
  toSaveState,
  useProjectSettings,
  type ProjectSettingsViewProps,
  type UseProjectSettingsOptions,
} from './useProjectSettings';

/* -------------------------------------------------------------------------- */
/* jsdom không có `matchMedia`; `matches: false` cho cách xếp rộng, tức cách    */
/* xếp mà mọi test dưới đây giả định trừ khi tự đặt `forceCollapsed`.           */
/* -------------------------------------------------------------------------- */

beforeAll(() => {
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
});

/* -------------------------------------------------------------------------- */
/* Bộ props cho view thuần (mục D: props vào, không store, không mạng).        */
/* -------------------------------------------------------------------------- */

const noop = (): void => undefined;

/** Thư mục màn, cho lượt soát mã màu thô từng file một. */
const SCREEN_DIRECTORY = 'src/screens/project/ProjectSettings';

/**
 * Tên của một nút lưu, nếu màn này lỡ mọc ra một cái.
 *
 * A7 nói không có nút lưu; đây là cách hỏi cả hai ngôn ngữ cùng lúc, vì một
 * nút "Save" lọt vào cũng vi phạm đúng bất biến ấy.
 */
const SAVE_BUTTON_NAMES = /l[uư]u|save/i;

const NO_PROBLEMS = {
  name: null,
  code: null,
  address: null,
  notes: null,
  snapToleranceMm: null,
  confidenceThreshold: null,
  scaleMmPerPx: null,
};

function baseProps(): ProjectSettingsViewProps {
  return {
    state: 'success',
    canEdit: true,
    canDelete: true,
    isReadOnly: false,
    errorMessage: null,
    saveState: 'saved',
    saveLabel: 'Đã lưu lúc 14:32',
    conflictMessage: null,
    activeTab: 'general',
    tabs: [
      { id: 'general', label: 'chung', problemCount: 0 },
      { id: 'units', label: 'đơn vị đo', problemCount: 0 },
      { id: 'members', label: 'thành viên', problemCount: 0 },
      { id: 'danger', label: 'vùng nguy hiểm', problemCount: 0 },
    ],
    name: 'Chung cư Bình Minh',
    code: 'DA-BINHMINH',
    address: '12 Nguyễn Trãi, Hà Nội',
    buildingType: 'residential',
    buildingTypeOptions: [
      { value: 'residential', label: 'nhà ở' },
      { value: 'commercial', label: 'thương mại' },
    ],
    notes: 'Bản vẽ do nhà thầu gửi.',
    notesCountLabel: '22 / 500 ký tự',
    problems: NO_PROBLEMS,
    lengthUnit: 'mm',
    lengthUnitOptions: [
      { value: 'mm', label: 'milimét (mm)' },
      { value: 'm', label: 'mét (m)' },
    ],
    areaUnitLabel: 'mét vuông — ví dụ 248,60 m²',
    snapToleranceMm: 50,
    snapToleranceLabel: '50 mm',
    snapToleranceMinMm: 1,
    snapToleranceMaxMm: 120,
    confidenceThreshold: 0.75,
    confidenceThresholdLabel: '75%',
    scaleMmPerPx: 2.5,
    scaleLabel: '2,5 milimét trên mỗi điểm ảnh',
    scalePreviewLabel: '100 điểm ảnh ứng với 250 mm ngoài thực tế.',
    members: [{ id: 'm-an', name: 'Phạm An', roleLabel: 'quản trị', initials: 'PA' }],
    memberCountLabel: '1 thành viên',
    floorCount: 4,
    deleteAllFloorsLabel:
      'Xoá toàn bộ 4 tầng cùng bản vẽ và mô hình của chúng. Không hoàn tác được.',
    deleteProjectLabel:
      'Xoá dự án cùng mọi tầng, bản vẽ và mô hình bên trong. Không hoàn tác được.',
    pendingDanger: null,
    dangerDialogTitle: null,
    dangerDialogMessage: null,
    dangerConfirmLabel: null,
    dangerConfirmationExpected: null,
    dangerConfirmationText: '',
    canConfirmDanger: false,
    isDangerRunning: false,
    setActiveTab: noop,
    setName: noop,
    setCode: noop,
    setAddress: noop,
    setBuildingType: noop,
    setNotes: noop,
    setLengthUnit: noop,
    setSnapToleranceMm: noop,
    setConfidenceThreshold: noop,
    setScaleMmPerPx: noop,
    saveNow: noop,
    retryLoad: noop,
    reloadSettings: noop,
    requestDeleteAllFloors: noop,
    requestDeleteProject: noop,
    setDangerConfirmationText: noop,
    confirmDanger: noop,
    cancelDanger: noop,
  };
}

/** Một bộ props cho mỗi trạng thái, đánh khoá để không trạng thái nào trốn được (A11). */
const PROPS_BY_STATE: Readonly<Record<SevenState, () => ProjectSettingsViewProps>> = {
  empty: () => ({
    ...baseProps(),
    state: 'empty',
    activeTab: 'danger',
    floorCount: 0,
    deleteAllFloorsLabel: 'Dự án chưa có tầng nào để xoá.',
  }),
  loading: () => ({
    ...baseProps(),
    state: 'loading',
    name: '',
    code: '',
    address: '',
    notes: '',
    notesCountLabel: '0 / 500 ký tự',
    snapToleranceMm: null,
    scaleMmPerPx: null,
    members: [],
    memberCountLabel: '0 thành viên',
    floorCount: 0,
    saveState: 'idle',
    saveLabel: 'Chưa có thay đổi',
  }),
  partial: () => ({
    ...baseProps(),
    state: 'partial',
    saveState: 'saving',
    saveLabel: 'Đang lưu…',
    name: 'Ch',
    problems: { ...NO_PROBLEMS, name: 'Tên dự án cần ít nhất 3 ký tự.' },
  }),
  error: () => ({
    ...baseProps(),
    state: 'error',
    errorMessage: 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.',
  }),
  success: () => baseProps(),
  forbidden: () => ({
    ...baseProps(),
    state: 'forbidden',
    canEdit: false,
    canDelete: false,
    isReadOnly: true,
    // Vai không xoá được gì thì `useProjectSettings` bỏ hẳn thẻ nguy hiểm khỏi
    // dải thẻ; bộ props này phải nói đúng điều màn thật dựng ra.
    tabs: baseProps().tabs.filter((tab) => tab.id !== 'danger'),
  }),
  collapsed: () => ({ ...baseProps(), state: 'collapsed' }),
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11, R-63).                                                 */
/* -------------------------------------------------------------------------- */

describe('ProjectSettingsView, bảy trạng thái', () => {
  it('dựng được một thứ gì đó cho cả bảy', () => {
    expectSevenStates(
      (scenario) => render(<ProjectSettingsView {...PROPS_BY_STATE[scenario.state]()} />),
      SEVEN_STATES.map((state) => ({
        state,
        label: state,
        rows: [],
        totalCount: 0,
        isLoading: false,
        isCollapsed: false,
        canView: true,
        error: null,
      })),
    );
  });

  it('nói tiếng Việt có dấu ở mọi trạng thái (R-72)', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<ProjectSettingsView {...PROPS_BY_STATE[state]()} />);

      expect(() => {
        expectVietnamese(container);
      }, `trạng thái: ${state}`).not.toThrow();
      unmount();
    }
  });

  it('dùng được bằng bàn phím và ở thị lực kém ở mọi trạng thái (R-72)', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<ProjectSettingsView {...PROPS_BY_STATE[state]()} />);

      expect(() => {
        // Hai nhóm phần tử bị loại, không nhóm nào thuộc màn này —
        // `src/components/**` nằm ngoài phạm vi sửa (R-68), và cả hai đều là
        // `tabIndex={-1}` cố ý mà phím Tab vốn không định tới:
        //  - vỏ `role="dialog"` của `Modal.Root` — chỗ đáp của bẫy tiêu điểm;
        //  - hai nút tăng giảm hiện khi rê chuột của `NumericField` — đường bàn
        //    phím của ô đó là phím mũi tên, đúng như mọi ô số khác trong sản phẩm.
        expectAccessible(container, { ignoreSelector: '[role="dialog"], button[tabindex="-1"]' });
      }, `trạng thái: ${state}`).not.toThrow();
      unmount();
    }
  });

  it('vẽ khung xương thay cho biểu mẫu khi đang tải', () => {
    render(<ProjectSettingsView {...PROPS_BY_STATE.loading()} />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('trạng thái: đang tải')).toBeInTheDocument();
  });

  it('giữ nguyên dữ liệu nhưng bỏ quyền sửa với vai người xem', () => {
    render(<ProjectSettingsView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.getByText('Chung cư Bình Minh')).toBeInTheDocument();
    expect(screen.queryByLabelText('tên dự án')).not.toBeInTheDocument();
  });

  it('đổi dải thẻ thành một ô chọn khi thu gọn', () => {
    render(<ProjectSettingsView {...PROPS_BY_STATE.collapsed()} />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'nhóm cài đặt' })).toBeInTheDocument();
  });

  it('mời thử lại khi không đọc được cài đặt', () => {
    const retryLoad = vi.fn();
    render(<ProjectSettingsView {...PROPS_BY_STATE.error()} retryLoad={retryLoad} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(retryLoad).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Vùng nguy hiểm (A9).                                                        */
/* -------------------------------------------------------------------------- */

describe('ProjectSettingsView, vùng nguy hiểm', () => {
  it('khoá nút xoá dự án cho tới khi gõ đúng tên', () => {
    const confirmDanger = vi.fn();
    render(
      <ProjectSettingsView
        {...baseProps()}
        activeTab="danger"
        pendingDanger="deleteProject"
        dangerDialogTitle="Xoá dự án này?"
        dangerDialogMessage="Dự án cùng toàn bộ tầng, bản vẽ và mô hình bên trong sẽ bị xoá vĩnh viễn. Không hoàn tác được."
        dangerConfirmLabel="Xoá dự án"
        dangerConfirmationExpected="Chung cư Bình Minh"
        canConfirmDanger={false}
        confirmDanger={confirmDanger}
      />,
    );

    // Hộp thoại và thẻ nguy hiểm cùng có một nút mang tên "Xoá dự án"; nút được
    // hỏi ở đây là nút xác nhận, tức nút bên trong hộp thoại.
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByRole('button', { name: 'Xoá dự án' })).toBeDisabled();
    expect(screen.getByLabelText('gõ lại tên dự án để xác nhận')).toBeInTheDocument();
    expect(confirmDanger).not.toHaveBeenCalled();
  });

  it('chỉ có đúng hai việc nguy hiểm, mỗi việc một câu hậu quả', () => {
    render(<ProjectSettingsView {...baseProps()} activeTab="danger" />);

    expect(
      screen.getByText('Xoá toàn bộ 4 tầng cùng bản vẽ và mô hình của chúng. Không hoàn tác được.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Xoá dự án cùng mọi tầng, bản vẽ và mô hình bên trong. Không hoàn tác được.'),
    ).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Màu (A1) và màn đã nối dây.                                                 */
/* -------------------------------------------------------------------------- */

describe('ProjectSettings', () => {
  it('không có mã màu thô nào trong cả thư mục màn (A1)', () => {
    expectNoRawColor('src/screens/project/ProjectSettings');
  });

  /** Từng file một, để lời báo hỏng chỉ đúng một file chứ không cả thư mục (A1, R-72). */
  it.each([
    'ProjectSettings.tsx',
    'ProjectSettings.container.tsx',
    'ProjectSettings.stories.tsx',
    'ProjectSettings.test.tsx',
    'GeneralTab.tsx',
    'UnitsTab.tsx',
    'MembersTab.tsx',
    'DangerZoneTab.tsx',
  ])('không có mã màu thô trong %s', (file) => {
    expectNoRawColor(`${SCREEN_DIRECTORY}/${file}`);
  });

  it('đọc cài đặt qua cổng dữ liệu rồi đổ vào biểu mẫu', async () => {
    const gateway = createProjectSettingsGateway(createMockApiClient());

    renderWithProviders(<ProjectSettings gateway={gateway} projectId="project-1" roles={['admin']} />);

    expect(await screen.findByLabelText('tên dự án')).toHaveValue('Chung cư Hoàng Anh');
    expect(screen.getByLabelText('địa chỉ')).toHaveValue('12 Nguyễn Huệ, Quận 1');
  });
});

/* -------------------------------------------------------------------------- */
/* Không có nút lưu (A7), Esc đóng lớp trên cùng (A12).                        */
/* -------------------------------------------------------------------------- */

describe('ProjectSettingsView, bàn phím và lời hứa tự lưu', () => {
  it('không dựng nút lưu nào ở bất kỳ trạng thái nào (A7)', () => {
    for (const state of SEVEN_STATES) {
      const { unmount } = render(<ProjectSettingsView {...PROPS_BY_STATE[state]()} />);

      expect(
        screen.queryAllByRole('button', { name: SAVE_BUTTON_NAMES }),
        `trạng thái: ${state}`,
      ).toHaveLength(0);
      unmount();
    }
  });

  it('Esc đóng hộp thoại nguy hiểm, tức lớp trên cùng (A12)', () => {
    const cancelDanger = vi.fn();
    render(
      <ProjectSettingsView
        {...baseProps()}
        activeTab="danger"
        pendingDanger="deleteAllFloors"
        dangerDialogTitle={viMessages.project.settings.danger.confirmFloorsTitle}
        dangerDialogMessage={viMessages.project.settings.danger.confirmFloorsMessage}
        dangerConfirmLabel={viMessages.project.settings.danger.deleteAllFloors}
        cancelDanger={cancelDanger}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(cancelDanger).toHaveBeenCalledTimes(1);
  });

  it('liệt kê đủ mọi nhóm cài đặt trong ô chọn khi thu gọn', async () => {
    const props = PROPS_BY_STATE.collapsed();
    render(<ProjectSettingsView {...props} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'nhóm cài đặt' }));

    const listbox = within(await screen.findByRole('listbox'));

    for (const tab of props.tabs) {
      expect(listbox.getByRole('option', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('vai chỉ xem không có ô nhập nào, ở cả thẻ chung lẫn thẻ đơn vị đo', () => {
    for (const tab of ['general', 'units'] as const) {
      const { unmount } = render(
        <ProjectSettingsView {...PROPS_BY_STATE.forbidden()} activeTab={tab} />,
      );

      expect(screen.queryAllByRole('textbox'), `thẻ: ${tab}`).toHaveLength(0);
      expect(screen.queryAllByRole('combobox'), `thẻ: ${tab}`).toHaveLength(0);
      unmount();
    }
  });

  it('bỏ hẳn hai việc nguy hiểm khi vai không xoá được gì', () => {
    render(<ProjectSettingsView {...baseProps()} canDelete={false} activeTab="danger" />);

    expect(screen.getByText(viMessages.project.settings.danger.noPermission)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xoá dự án' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xoá mọi tầng' })).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* `toSaveState` — năm nhánh, không nhánh nào thiếu.                           */
/* -------------------------------------------------------------------------- */

describe('toSaveState', () => {
  /**
   * `Record<AutosaveState, SaveState>` chứ không phải một mảng: kiểu buộc bảng
   * này có đủ năm khoá, nên một nhánh mới thêm vào `AutosaveState` làm hỏng
   * bước biên dịch thay vì lặng lẽ không được test.
   */
  const EXPECTED: Readonly<Record<AutosaveState, SaveState>> = {
    dirty: 'pending',
    saving: 'saving',
    saved: 'saved',
    failed: 'error',
    offline: 'error',
  };

  it('dịch đủ năm trạng thái tự lưu, không thừa không thiếu', () => {
    expect(Object.keys(EXPECTED)).toHaveLength(5);
  });

  it.each(Object.entries(EXPECTED))('dịch "%s" thành "%s"', (autosaveState, expected) => {
    expect(toSaveState(autosaveState as AutosaveState)).toBe(expected);
  });
});

/* -------------------------------------------------------------------------- */
/* Màn đã nối dây: hook thật, view thật, cổng dữ liệu giả lập.                 */
/* -------------------------------------------------------------------------- */

/**
 * Hook thật cộng view thật, không provider nào ở giữa.
 *
 * `ProjectSettings` tự dựng `Toast.Provider` và vì thế **bỏ** `onToast` khỏi
 * props của nó, nên vé hoàn tác của D-05 không quan sát được từ đó. Đây là
 * cùng khuôn `ProjectSettings.container.tsx` dùng cho `WiredProjectSettings`.
 */
function WiredSettings(options: UseProjectSettingsOptions) {
  return <ProjectSettingsView {...useProjectSettings(options)} />;
}

/** Con số của A7: 800 ms im lặng rồi mới gửi đi. Test kiểm đúng hai bên mốc. */
const AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Đủ lâu để một lượt đổi thẻ chạy xong cả phần rời lẫn phần vào.
 *
 * `Tabs.Panel` bọc trong `AnimatePresence mode="wait"`, nên tấm cũ phải đi hết
 * rồi tấm mới mới dựng. Lấy giá trị chậm nhất của thang chuyển động thay vì
 * viết một con số mới (R-71).
 */
const MOTION_SETTLE_MS = MOTION_DURATIONS_MS.slow;

/** Một lượt 409 thật, dựng theo đúng hình dạng `HttpError` mà `toAppError` đọc. */
const CONFLICT_ERROR: HttpError = {
  kind: 'http',
  status: 409,
  requestId: 'req-conflict',
  retryable: true,
  raw: {},
};

/** Một lượt hỏng vì mạng — nhánh mà `createAutosave` ĐƯỢC phép thử lại. */
const NETWORK_ERROR: HttpError = {
  kind: 'network',
  requestId: 'req-network',
  retryable: true,
  raw: {},
};

interface ToastRecord {
  readonly message: string;
  readonly onUndo?: (() => void) | undefined;
}

/** Cổng thật trên `createMockApiClient()`, có đếm lượt gọi; R-47: không bịa dữ liệu. */
function spyGateway(overrides: Partial<ProjectSettingsGateway> = {}) {
  const real = createProjectSettingsGateway(createMockApiClient());

  return {
    read: vi.fn(overrides.read ?? real.read),
    update: vi.fn(overrides.update ?? real.update),
    deleteAllFloors: vi.fn(overrides.deleteAllFloors ?? real.deleteAllFloors),
    deleteProject: vi.fn(overrides.deleteProject ?? real.deleteProject),
  };
}

describe('ProjectSettings đã nối dây', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  /** Nhích đồng hồ tiêm rồi để React chạy hết những gì lượt nhích ấy gây ra. */
  async function tick(durationMs: number): Promise<void> {
    await act(async () => {
      await clock.advance(durationMs);
    });
  }

  /** Dựng màn với đồng hồ tiêm (R-29) và đợi lượt đọc đầu tiên về. */
  async function mountSettings(
    options: Omit<UseProjectSettingsOptions, 'now' | 'isOnline'>,
  ): Promise<void> {
    renderWithProviders(<WiredSettings {...options} now={clock.epochMs} isOnline={() => true} />);
    await tick(0);
  }

  const nameField = (): HTMLInputElement =>
    screen.getByRole('textbox', { name: 'tên dự án' }) as HTMLInputElement;

  it('gửi thay đổi đi 800 ms sau thao tác cuối, không cần ai bấm gì (D-07, A7)', async () => {
    const gateway = spyGateway();
    await mountSettings({ gateway, projectId: 'project-autosave', roles: ['admin'] });

    fireEvent.change(nameField(), { target: { value: 'Chung cư Bình Minh' } });

    await tick(AUTOSAVE_DEBOUNCE_MS - 1);
    expect(gateway.update).not.toHaveBeenCalled();

    await tick(1);
    expect(gateway.update).toHaveBeenCalledTimes(1);
    expect(gateway.update).toHaveBeenCalledWith({
      projectId: 'project-autosave',
      patch: { name: 'Chung cư Bình Minh' },
    });
    expect(screen.queryAllByRole('button', { name: SAVE_BUTTON_NAMES })).toHaveLength(0);
  });

  it('mỗi lượt lưu xong kèm một vé hoàn tác, và hoàn tác trả ô về giá trị cũ (A8, D-05)', async () => {
    const toasts: ToastRecord[] = [];
    const gateway = spyGateway();
    await mountSettings({
      gateway,
      projectId: 'project-undo',
      roles: ['admin'],
      onToast: (toast) => toasts.push(toast),
    });

    const before = nameField().value;
    fireEvent.change(nameField(), { target: { value: 'Chung cư Bình Minh' } });
    await tick(AUTOSAVE_DEBOUNCE_MS);

    expect(gateway.update).toHaveBeenCalledTimes(1);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.message).toBe(viMessages.project.settings.savedToast);
    expect(toasts[0]?.onUndo).toBeTypeOf('function');

    act(() => {
      toasts[0]?.onUndo?.();
    });

    expect(nameField()).toHaveValue(before);
  });

  it('một lượt lưu hỏng vì mạng thì thử lại theo lịch của tầng logic', async () => {
    const gateway = spyGateway({ update: async () => ({ ok: false, error: NETWORK_ERROR }) });
    await mountSettings({ gateway, projectId: 'project-retry', roles: ['admin'] });

    fireEvent.change(nameField(), { target: { value: 'Chung cư Bình Minh' } });
    await tick(AUTOSAVE_DEBOUNCE_MS);
    expect(gateway.update).toHaveBeenCalledTimes(1);

    await tick(RETRY_SCHEDULE_MS[0]);
    expect(gateway.update).toHaveBeenCalledTimes(2);
  });

  it('409 thì dừng lại, nói ra, không ghi đè và không bão thử lại (D-09)', async () => {
    const gateway = spyGateway({ update: async () => ({ ok: false, error: CONFLICT_ERROR }) });
    await mountSettings({ gateway, projectId: 'project-conflict', roles: ['admin'] });

    fireEvent.change(nameField(), { target: { value: 'Chung cư Bình Minh' } });
    await tick(AUTOSAVE_DEBOUNCE_MS);

    expect(gateway.update).toHaveBeenCalledTimes(1);
    expect(screen.getByText(viMessages.errors.conflict.description)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: viMessages.project.settings.load.reload }),
    ).toBeInTheDocument();

    // Cả lịch 5/15/45 giây trôi qua mà không một lượt ghi nào nữa: một lượt
    // thử lại ở đây chính là ghi đè im lặng lên bản của người khác.
    await tick(RETRY_SCHEDULE_MS.reduce((total, delay) => total + delay, 0) * 2);

    expect(gateway.update).toHaveBeenCalledTimes(1);
    expect(nameField()).toHaveValue('Chung cư Bình Minh');
  });

  it('vai người xem: không ô nào sửa được, và không có thẻ vùng nguy hiểm', async () => {
    const gateway = spyGateway();
    await mountSettings({ gateway, projectId: 'project-viewer', roles: ['viewer'] });

    expect(screen.getByText(viMessages.project.settings.readOnlyNotice)).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryByRole('tab', { name: 'vùng nguy hiểm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xoá dự án' })).not.toBeInTheDocument();
  });

  it('chỉ mở khoá nút xoá dự án khi gõ đúng tên dự án (A9)', async () => {
    const gateway = spyGateway();
    const onProjectDeleted = vi.fn();
    await mountSettings({
      gateway,
      projectId: 'project-delete',
      roles: ['admin'],
      onProjectDeleted,
    });

    const expectedName = nameField().value;

    fireEvent.click(screen.getByRole('tab', { name: 'vùng nguy hiểm' }));
    await tick(MOTION_SETTLE_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Xoá dự án' }));
    await tick(MOTION_SETTLE_MS);

    const dialog = within(screen.getByRole('dialog'));
    const confirmation = dialog.getByRole('textbox', { name: 'gõ lại tên dự án để xác nhận' });

    expect(dialog.getByRole('button', { name: 'Xoá dự án' })).toBeDisabled();

    // Sai một ký tự vẫn là sai.
    fireEvent.change(confirmation, { target: { value: expectedName.slice(0, -1) } });
    expect(dialog.getByRole('button', { name: 'Xoá dự án' })).toBeDisabled();
    expect(gateway.deleteProject).not.toHaveBeenCalled();

    fireEvent.change(confirmation, { target: { value: expectedName } });
    expect(dialog.getByRole('button', { name: 'Xoá dự án' })).toBeEnabled();

    fireEvent.click(dialog.getByRole('button', { name: 'Xoá dự án' }));
    await tick(MOTION_SETTLE_MS);

    expect(gateway.deleteProject).toHaveBeenCalledWith({ projectId: 'project-delete' });
    expect(onProjectDeleted).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Cổng dữ liệu: xoá dở vẫn là một lượt thành công.                            */
/* -------------------------------------------------------------------------- */

describe('createProjectSettingsGateway', () => {
  it('xoá dở mọi tầng vẫn trả ok, kèm danh sách tầng chưa xoá được', async () => {
    const client = createMockApiClient();
    const projectId = 'project-partial-delete';
    const project = await client.projects.read({ projectId });

    if (!project.ok) {
      throw new Error('cổng giả lập phải đọc được dự án mẫu');
    }

    const failingFloorId = project.data.floors[0]?.id;

    if (failingFloorId === undefined) {
      throw new Error('dự án mẫu phải có ít nhất một tầng');
    }

    const partiallyFailing: ApiClient = {
      ...client,
      floors: {
        ...client.floors,
        delete: async (input) =>
          input.floorId === failingFloorId
            ? { ok: false, error: NETWORK_ERROR }
            : client.floors.delete(input),
      },
    };

    const result = await createProjectSettingsGateway(partiallyFailing).deleteAllFloors({ projectId });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('xoá dở phải là một lượt thành công, không phải một lời báo hỏng');
    }

    expect(result.data.failedFloorIds).toEqual([failingFloorId]);
    expect(result.data.deletedCount).toBe(result.data.requestedCount - 1);
    expect(result.data.requestedCount).toBe(project.data.floors.length);
  });
});
