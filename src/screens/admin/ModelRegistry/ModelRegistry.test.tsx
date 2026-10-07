/**
 * Nửa view của màn registry model: bốn bộ khẳng định dùng chung, cộng những gì một view
 * thuần phải tự đảm bảo. Dữ liệu từ `modelRegistryScenarios.ts` — cùng nguồn với story.
 */

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/routes/paths';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';

import { ModelRegistry } from './ModelRegistry';
import {
  MODEL_REGISTRY_ACTIONS,
  MODEL_REGISTRY_SCENARIOS,
  MODEL_REGISTRY_SCENARIO_COLLAPSED,
  MODEL_REGISTRY_SCENARIO_EMPTY,
  MODEL_REGISTRY_SCENARIO_ERROR,
  MODEL_REGISTRY_SCENARIO_FORBIDDEN,
  MODEL_REGISTRY_SCENARIO_PARTIAL,
  MODEL_REGISTRY_SCENARIO_SUCCESS,
} from './modelRegistryScenarios';
import type { ModelRegistryActions, ModelRegistryViewModel } from './types';

/** Từ không dấu được phép trên màn (F-11 khối [9]). */
const ALLOW_WORDS = ['model', 'AI', 'onnx', 'safetensors', 'IoU', 'mAP', 'CER'] as const;

const DIALOG_IGNORE = { ignoreSelector: '[role="dialog"]' } as const;

function buildActions(): ModelRegistryActions {
  return {
    onCloseDialog: vi.fn(),
    onConfirmDialog: vi.fn(),
    onLoadMore: vi.fn(),
    onReloadAfterConflict: vi.fn(),
    onRequestActivate: vi.fn(),
    onRequestRevert: vi.fn(),
    onRetry: vi.fn(),
    onSelectFamily: vi.fn(),
    onSelectVersion: vi.fn(),
  };
}

function renderView(model: ModelRegistryViewModel, actions: ModelRegistryActions = MODEL_REGISTRY_ACTIONS) {
  return renderWithProviders(<ModelRegistry actions={actions} model={model} />);
}

/** jsdom không có `matchMedia`; `Drawer` hỏi nó. `false` = bản để bàn. */
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

afterEach(() => {
  cleanup();
});

describe('A11 — bảy trạng thái', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng (7/7)', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.state);
      expect(MODEL_REGISTRY_SCENARIOS[scenario.state].state).toBe(scenario.state);

      return renderView(MODEL_REGISTRY_SCENARIOS[scenario.state]);
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(7);
  });

  it('rỗng: câu dạy việc cho họ tường, kèm "Đang dùng đường cổ điển."', () => {
    renderView(MODEL_REGISTRY_SCENARIO_EMPTY);

    expect(
      screen.getByText(
        'Họ này chưa có phiên bản nào. Tải trọng số bằng công cụ dòng lệnh, hoặc chờ một lượt huấn luyện xong. Đang dùng đường cổ điển.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Họ model' })).toBeInTheDocument();
  });

  it('một phần: dải chú ý đếm bản đang chờ', () => {
    renderView(MODEL_REGISTRY_SCENARIO_PARTIAL);

    expect(
      screen.getByText('1 phiên bản đang chờ hoặc đang đánh giá; chỉ kích hoạt được bản đã đánh giá.'),
    ).toBeInTheDocument();
  });

  it('lỗi: câu lỗi và nút "Thử lại", vẫn giữ ô chọn họ', () => {
    const actions = buildActions();
    renderView(MODEL_REGISTRY_SCENARIO_ERROR, actions);

    expect(screen.getByText('Máy chủ đang bận. Thử lại sau ít phút.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(actions.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radiogroup', { name: 'Họ model' })).toBeInTheDocument();
  });

  it('không có quyền: câu cố định, không bảng, không ô chọn họ', () => {
    renderView(MODEL_REGISTRY_SCENARIO_FORBIDDEN);

    expect(screen.getByText('Chỉ quản trị viên hệ thống xem được model AI.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('thu gọn: thẻ thay bảng, chi tiết trong Drawer', () => {
    renderView(MODEL_REGISTRY_SCENARIO_COLLAPSED);

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Chi tiết phiên bản' })).toBeInTheDocument();
  });
});

describe('Bốn bộ khẳng định dùng chung', () => {
  it.each([
    ['Thành công', MODEL_REGISTRY_SCENARIO_SUCCESS],
    ['Một phần', MODEL_REGISTRY_SCENARIO_PARTIAL],
    ['Không có quyền', MODEL_REGISTRY_SCENARIO_FORBIDDEN],
    ['Thu gọn', MODEL_REGISTRY_SCENARIO_COLLAPSED],
  ])('expectAccessible: %s', (_label, model) => {
    renderView(model);

    expectAccessible(document.body, DIALOG_IGNORE);
  });

  it.each([
    ['Thành công', MODEL_REGISTRY_SCENARIO_SUCCESS],
    ['Một phần', MODEL_REGISTRY_SCENARIO_PARTIAL],
    ['Rỗng', MODEL_REGISTRY_SCENARIO_EMPTY],
    ['Lỗi', MODEL_REGISTRY_SCENARIO_ERROR],
  ])('expectVietnamese: %s — chỉ bảy từ kỹ thuật được để không dấu', (_label, model) => {
    const { container } = renderView(model);

    expectVietnamese(container, { allowWords: ALLOW_WORDS });
  });

  it('expectNoRawColor: cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/admin/ModelRegistry');
    }).not.toThrow();
  });
});

describe('A5 — đầu ra AI không bao giờ "Đã xác minh"', () => {
  it('màn thành công không có phần tử lớp state-verified', () => {
    const { container } = renderView(MODEL_REGISTRY_SCENARIO_SUCCESS);

    expect(container.querySelector('[class*="state-verified"]')).toBeNull();
    expect(document.body.querySelector('[class*="state-verified"]')).toBeNull();
  });
});

describe('Bảng phiên bản', () => {
  it('bản đang dùng không có nút "Kích hoạt"; bản đã đánh giá thì có', () => {
    renderView(MODEL_REGISTRY_SCENARIO_SUCCESS);

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const activeRow = rows.find((row) => within(row).queryByText('Đang dùng') !== null);
    const otherRow = rows.find((row) => row !== activeRow);

    expect(activeRow).toBeDefined();
    expect(within(activeRow as HTMLElement).queryByRole('button', { name: 'Kích hoạt' })).toBeNull();
    expect(within(otherRow as HTMLElement).getByRole('button', { name: 'Kích hoạt' })).toBeEnabled();
  });

  it('bản chưa đánh giá: nút tắt kèm lý do hiện ra', () => {
    renderView(MODEL_REGISTRY_SCENARIO_PARTIAL);

    const reason = screen.getAllByText('Chỉ kích hoạt được bản đã đánh giá.')[0];
    const button = screen
      .getAllByRole('button', { name: 'Kích hoạt' })
      .find((candidate) => candidate.getAttribute('aria-describedby') === reason?.id);

    expect(button).toBeDisabled();
  });

  it('số đo định dạng ở hook: dấu phẩy, ba chữ số, kèm tên số đo của họ', () => {
    renderView(MODEL_REGISTRY_SCENARIO_SUCCESS);

    expect(screen.getAllByText('mAP50 0,612').length).toBeGreaterThan(0);
    expect(screen.getByText('mAP50 0,684')).toBeInTheDocument();
  });

  it('bấm nhãn mở chi tiết; bấm "Kích hoạt" xin mở hộp thoại', () => {
    const actions = buildActions();
    renderView(MODEL_REGISTRY_SCENARIO_SUCCESS, actions);

    const trained = MODEL_REGISTRY_SCENARIO_SUCCESS.rows.find((row) => !row.isActive);
    fireEvent.click(screen.getByRole('button', { name: trained?.label ?? '' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt' }));

    expect(actions.onSelectVersion).toHaveBeenCalledWith(trained?.id);
    expect(actions.onRequestActivate).toHaveBeenCalledWith(trained?.id);
  });

  it('"Xem thêm" chỉ hiện khi còn trang sau', () => {
    const actions = buildActions();
    const { unmount } = renderView(MODEL_REGISTRY_SCENARIO_SUCCESS, actions);

    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
    unmount();

    renderView({ ...MODEL_REGISTRY_SCENARIO_SUCCESS, hasMore: true }, actions);
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(actions.onLoadMore).toHaveBeenCalledTimes(1);
  });
});

describe('Đầu trang, chi tiết, dải 409', () => {
  it('breadcrumb "Quản trị › Model AI" là nhãn, không liên kết; h1 viết hoa chữ đầu', () => {
    renderView(MODEL_REGISTRY_SCENARIO_SUCCESS);

    const nav = screen.getByRole('navigation', { name: 'Đường dẫn trang' });
    expect(nav.textContent).toBe('Quản trị›Model AI');
    expect(within(nav).queryByRole('link')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Model AI của chuỗi xử lý' })).toBeInTheDocument();
  });

  it('relatedLink null thì không có liên kết; có thì hiện', () => {
    renderView({ ...MODEL_REGISTRY_SCENARIO_SUCCESS, relatedLink: { href: '/admin/training/jobs', label: 'Lượt huấn luyện' } });

    expect(screen.getByRole('link', { name: 'Lượt huấn luyện' })).toHaveAttribute('href', '/admin/training/jobs');
  });

  it('chi tiết bản gốc: người tạo "Hệ thống AI", mã băm chữ đều, câu về tập kiểm tổng hợp', () => {
    renderView(MODEL_REGISTRY_SCENARIO_SUCCESS);

    const panel = screen.getByRole('complementary', { name: 'Chi tiết phiên bản' });
    expect(within(panel).getByText('Hệ thống AI')).toBeInTheDocument();
    expect(within(panel).getByText('a'.repeat(64)).tagName).toBe('CODE');
    expect(
      within(panel).getByText('Số đo trên tập kiểm tổng hợp cố định, không so thẳng với bản huấn luyện.'),
    ).toBeInTheDocument();
  });

  it('chi tiết bản hỏng đánh giá: câu cố định, người tạo "Quản trị viên", không in mã người dùng', () => {
    renderView(MODEL_REGISTRY_SCENARIO_PARTIAL);

    const panel = screen.getByRole('complementary', { name: 'Chi tiết phiên bản' });
    expect(within(panel).getByText('Lượt đánh giá không thành công. Lý do chi tiết chỉ có trong nhật ký máy chủ.')).toBeInTheDocument();
    expect(within(panel).getByText('Quản trị viên')).toBeInTheDocument();
    expect(panel.textContent).not.toContain('usr_');
  });

  it('dải 409 phủ lên trạng thái đang có, nút "Tải lại"', () => {
    const actions = buildActions();
    renderView({ ...MODEL_REGISTRY_SCENARIO_SUCCESS, conflictNotice: 'Tách lớp tường vừa được đổi ở nơi khác. Tải lại để thấy bản đang dùng.' }, actions);

    expect(screen.getByRole('table')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(actions.onReloadAfterConflict).toHaveBeenCalledTimes(1);
  });

  it('route nằm dưới /admin/training/models, không trùng thư viện đồ đạc /admin/models', () => {
    expect(ROUTES.adminTrainingModels).toBe('/admin/training/models');
    expect(ROUTES.adminTrainingModels).not.toBe(ROUTES.adminModels);
  });
});

describe('Hộp thoại A9', () => {
  const dialogModel: ModelRegistryViewModel = {
    ...MODEL_REGISTRY_SCENARIO_SUCCESS,
    dialog: {
      body: 'Lượt xử lý mới dùng bản này ngay; lượt đang chạy giữ model đã ghim.',
      confirmLabel: 'Kích hoạt',
      errorMessage: null,
      isSubmitting: false,
      isWaiting: false,
      title: 'Kích hoạt Huấn luyện lượt 3 cho nhận diện cửa và đồ đạc?',
      warning: null,
    },
  };

  it('Esc đóng hộp thoại', () => {
    const actions = buildActions();
    renderView(dialogModel, actions);

    expect(screen.getByRole('dialog', { name: 'Kích hoạt Huấn luyện lượt 3 cho nhận diện cửa và đồ đạc?' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(actions.onCloseDialog).toHaveBeenCalled();
  });

  it('nút xác nhận tắt trong lúc gửi — không bấm lặp được', () => {
    const actions = buildActions();
    renderView({ ...dialogModel, dialog: dialogModel.dialog === null ? null : { ...dialogModel.dialog, isSubmitting: true } }, actions);

    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getAllByRole('button').find((button) => button.textContent?.includes('Kích hoạt'));

    expect(confirm).toBeDisabled();
  });
});
