/**
 * Nửa view của màn huấn luyện: bốn bộ khẳng định dùng chung, cộng những gì view thuần phải
 * tự bảo đảm. Dữ liệu từ `trainingJobsScenarios.ts` — cùng nguồn với story.
 */

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

import { TrainingJobs } from './TrainingJobs';
import {
  TRAINING_JOBS_ACTIONS,
  TRAINING_JOBS_SCENARIOS,
  TRAINING_JOBS_SCENARIO_COLLAPSED,
  TRAINING_JOBS_SCENARIO_EMPTY,
  TRAINING_JOBS_SCENARIO_ERROR,
  TRAINING_JOBS_SCENARIO_FORBIDDEN,
  TRAINING_JOBS_SCENARIO_PARTIAL,
  TRAINING_JOBS_SCENARIO_SUCCESS,
} from './trainingJobsScenarios';
import type { TrainingJobsActions, TrainingJobsViewModel } from './types';

/** Từ không dấu được phép trên màn (F-12 khối [9]). */
const ALLOW_WORDS = ['model', 'AI', 'loss', 'IoU', 'mAP', 'mitB', 'yolov'] as const;

const DIALOG_IGNORE = { ignoreSelector: '[role="dialog"]' } as const;

function buildActions(): TrainingJobsActions {
  return {
    onCloseCancel: vi.fn(),
    onCloseForm: vi.fn(),
    onConfirmCancel: vi.fn(),
    onFilterFamily: vi.fn(),
    onFilterStatus: vi.fn(),
    onFormBaseModel: vi.fn(),
    onFormDataset: vi.fn(),
    onFormEpochs: vi.fn(),
    onFormFamily: vi.fn(),
    onFormVersion: vi.fn(),
    onLoadMore: vi.fn(),
    onOpenForm: vi.fn(),
    onRequestCancel: vi.fn(),
    onRetry: vi.fn(),
    onSelectDataset: vi.fn(),
    onSelectDatasetFamily: vi.fn(),
    onSelectJob: vi.fn(),
    onSelectTab: vi.fn(),
    onSubmitForm: vi.fn(),
  };
}

function renderView(model: TrainingJobsViewModel, actions: TrainingJobsActions = TRAINING_JOBS_ACTIONS) {
  return renderWithProviders(<TrainingJobs actions={actions} model={model} />);
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

afterEach(() => {
  cleanup();
});

describe('A11 — bảy trạng thái', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng (7/7)', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.state);
      expect(TRAINING_JOBS_SCENARIOS[scenario.state].state).toBe(scenario.state);

      return renderView(TRAINING_JOBS_SCENARIOS[scenario.state]);
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(7);
  });

  it('rỗng: câu dạy việc, vẫn có Tabs và nút "Tạo lượt huấn luyện"', () => {
    renderView(TRAINING_JOBS_SCENARIO_EMPTY);

    expect(
      screen.getByText('Chưa có lượt huấn luyện nào. Tạo lượt đầu tiên từ bộ dữ liệu sẵn sàng.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Phần của trang huấn luyện' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo lượt huấn luyện' })).toBeInTheDocument();
  });

  it('một phần: dải chú ý đếm lượt đang chờ hoặc chạy', () => {
    renderView(TRAINING_JOBS_SCENARIO_PARTIAL);

    expect(screen.getByText('1 lượt đang chờ hoặc chạy; số liệu tự cập nhật.')).toBeInTheDocument();
  });

  it('lỗi: câu lỗi và "Thử lại", vẫn giữ bộ lọc và nút tạo', () => {
    const actions = buildActions();
    renderView(TRAINING_JOBS_SCENARIO_ERROR, actions);

    expect(screen.getByText('Máy chủ đang bận. Thử lại sau ít phút.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(actions.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radiogroup', { name: 'Lọc theo họ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo lượt huấn luyện' })).toBeInTheDocument();
  });

  it('không có quyền: câu cố định, không bảng, không tab', () => {
    renderView(TRAINING_JOBS_SCENARIO_FORBIDDEN);

    expect(screen.getByText('Chỉ quản trị viên hệ thống xem được trang huấn luyện.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('thu gọn: thẻ thay bảng, chi tiết trong Drawer', () => {
    renderView(TRAINING_JOBS_SCENARIO_COLLAPSED);

    expect(screen.getByRole('dialog', { name: 'Chi tiết lượt huấn luyện' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem model AI đã tạo' })).toHaveAttribute('href', ROUTES.adminTrainingModels);
  });
});

describe('Bốn bộ khẳng định dùng chung', () => {
  it.each([
    ['thành công', TRAINING_JOBS_SCENARIO_SUCCESS],
    ['một phần', TRAINING_JOBS_SCENARIO_PARTIAL],
    ['không có quyền', TRAINING_JOBS_SCENARIO_FORBIDDEN],
    ['thu gọn', TRAINING_JOBS_SCENARIO_COLLAPSED],
  ])('expectAccessible: %s', (_label, model) => {
    renderView(model);

    expectAccessible(document.body, DIALOG_IGNORE);
  });

  it.each([
    ['thành công', TRAINING_JOBS_SCENARIO_SUCCESS],
    ['một phần', TRAINING_JOBS_SCENARIO_PARTIAL],
    ['rỗng', TRAINING_JOBS_SCENARIO_EMPTY],
    ['lỗi', TRAINING_JOBS_SCENARIO_ERROR],
  ])('expectVietnamese: %s — chỉ bảy từ kỹ thuật được để không dấu', (_label, model) => {
    const { container } = renderView(model);

    expectVietnamese(container, { allowWords: ALLOW_WORDS });
  });

  it('expectNoRawColor: cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/admin/TrainingJobs');
    }).not.toThrow();
  });

  it('A5: không phần tử lớp state-verified', () => {
    renderView(TRAINING_JOBS_SCENARIO_PARTIAL);

    expect(document.body.querySelector('[class*="state-verified"]')).toBeNull();
  });
});

describe('Bảng và chi tiết', () => {
  it('bảng lượt: vòng "12/50", trạng thái chữ, mã phiên bản rút gọn trong <code>', () => {
    renderView(TRAINING_JOBS_SCENARIO_PARTIAL);

    const table = screen.getAllByRole('table')[0] as HTMLElement;
    expect(within(table).getByText('12/50')).toBeInTheDocument();
    expect(within(table).getByText('Đang chạy')).toBeInTheDocument();
    expect(within(table).getAllByText('…000S03')[0]?.tagName).toBe('CODE');
  });

  it('lượt hỏng: câu failureCode, DOM không chứa mã', () => {
    const { container } = renderView(TRAINING_JOBS_SCENARIO_SUCCESS);

    expect(screen.getByText('Máy huấn luyện chưa cài bộ huấn luyện.')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('TRAINING_TRAINER_MISSING');
  });

  it('lượt đang chạy: dòng "Mới nhất · Tốt nhất" định dạng dấu phẩy, nút "Huỷ lượt"', () => {
    const actions = buildActions();
    renderView(TRAINING_JOBS_SCENARIO_PARTIAL, actions);

    expect(
      screen.getByText('Mới nhất: vòng 12, IoU 0,705 · Tốt nhất: vòng 11, IoU 0,712'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ lượt' }));
    expect(actions.onRequestCancel).toHaveBeenCalledTimes(1);
  });

  it('bấm họ mở chi tiết; "Xem thêm" chỉ khi còn trang', () => {
    const actions = buildActions();
    renderView({ ...TRAINING_JOBS_SCENARIO_SUCCESS, hasMore: true }, actions);

    const first = TRAINING_JOBS_SCENARIO_SUCCESS.rows[0];
    fireEvent.click(screen.getAllByRole('button', { name: first?.familyLabel ?? '' })[0] as HTMLElement);
    expect(actions.onSelectJob).toHaveBeenCalledWith(first?.id);
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(actions.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('đầu trang: breadcrumb nhãn, h1, liên kết sang model AI', () => {
    renderView(TRAINING_JOBS_SCENARIO_SUCCESS);

    expect(screen.getByRole('navigation', { name: 'Đường dẫn trang' }).textContent).toBe('Quản trị›huấn luyện model');
    expect(screen.getByRole('heading', { level: 1, name: 'Huấn luyện model AI' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Model AI của chuỗi xử lý' })).toHaveAttribute('href', ROUTES.adminTrainingModels);
    expect(ROUTES.adminTrainingJobs).toBe('/admin/training/jobs');
  });

  it('tab bộ dữ liệu: câu chỉ xem, bảng phiên bản kèm câu lỗi dựng', () => {
    renderView({ ...TRAINING_JOBS_SCENARIO_SUCCESS, activeTab: 'datasets' });

    expect(screen.getByText('Trang này chỉ xem; bộ dữ liệu dựng bằng công cụ dòng lệnh.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bộ dữ liệu' })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(1);
  });
});

describe('Hộp thoại A9 và biểu mẫu', () => {
  it('huỷ: câu hỏi, "Giữ lại" đóng, Esc đóng, nút xác nhận tắt khi đang gửi', () => {
    const actions = buildActions();
    renderView({ ...TRAINING_JOBS_SCENARIO_PARTIAL, cancelDialog: { errorMessage: null, isSubmitting: true } }, actions);

    const dialog = screen.getByRole('dialog', { name: 'Huỷ lượt huấn luyện này?' });
    expect(within(dialog).getByText('Lượt dừng ở vòng hiện tại, không chạy tiếp được.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Huỷ lượt/ })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Giữ lại' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(actions.onCloseCancel).toHaveBeenCalled();
  });

  it('biểu mẫu: lỗi ở đúng ô, nút gửi tắt khi không hợp lệ', () => {
    renderView({
      ...TRAINING_JOBS_SCENARIO_SUCCESS,
      form: {
        baseModel: 'mitB0',
        baseModelError: null,
        baseModels: [
          { label: 'mitB0', value: 'mitB0' },
          { label: 'mitB1', value: 'mitB1' },
        ],
        canSubmit: false,
        datasetId: null,
        datasets: [],
        epochs: 50,
        epochsError: null,
        epochsMax: 300,
        epochsMin: 1,
        families: [{ label: 'Tách lớp tường', value: 'wallSegmentation' }],
        family: 'wallSegmentation',
        formError: null,
        isLoadingOptions: false,
        isSubmitting: false,
        versionError: 'Bộ dữ liệu này chưa có phiên bản sẵn sàng.',
        versionId: null,
        versions: [],
      },
    });

    const dialog = screen.getByRole('dialog', { name: 'Tạo lượt huấn luyện' });
    expect(within(dialog).getByText('Bộ dữ liệu này chưa có phiên bản sẵn sàng.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Bắt đầu huấn luyện' })).toBeDisabled();
  });
});
