/**
 * P03 — mở lớp tường từ nút "Sửa" của màn Quy chuẩn: dải nói lỗi gì, "Vẽ tường" bật sẵn, và ô
 * "Chiều dài" của thanh tra sửa được. Lệnh đổi chiều dài (giữ đầu, dời đầu cuối) kiểm ở
 * `useWallLayerReview.test.ts`.
 *
 * `useLayerRuleIssues` được giả: sổ luật thật đã có bài kiểm riêng; ở đây chỉ kiểm màn nối kết
 * quả của nó vào đâu.
 */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';
import { resetSelectorCaches } from '@/store/selectors';

import type { LayerRuleIssues } from '../shared/useLayerRuleIssues';
import type { WallLayerViewProps } from './types';
import { WallLayerInspector } from './WallLayerInspector';
import { WallLayerReviewContainer } from './WallLayerReview.container';
import { scenarioArgsFor } from './WallLayerReview.stories';
import { WALL_LAYER_FIXTURE_WALLS } from './wallLayerReviewFixture';

const FOCUS_WALL = WALL_LAYER_FIXTURE_WALLS[1];

if (FOCUS_WALL === undefined) {
  throw new Error('Bộ mẫu cần ít nhất hai tường.');
}

const ruleIssues: LayerRuleIssues = {
  issues: [],
  focused: {
    key: `WALL-DANGLING-END|${FOCUS_WALL.id}`,
    ruleCode: 'WALL-DANGLING-END',
    ruleName: 'Đầu tường hở',
    severity: 'critical',
    entityId: FOCUS_WALL.id,
    message: 'Đầu tường không nối với tường nào.',
    suggestion: 'Kéo đầu tường tới tường bên cạnh.',
    at: FOCUS_WALL.centreline.end,
    tool: 'wall',
  },
  focusResolved: false,
  initialTool: 'wall',
  onFocus: vi.fn(),
  onClearFocus: vi.fn(),
};

vi.mock('../shared/useLayerRuleIssues', () => ({ useLayerRuleIssues: () => ruleIssues }));

class FakeResizeObserver {
  observe(): void {
    /* jsdom không đo khung */
  }

  unobserve(): void {
    /* như trên */
  }

  disconnect(): void {
    /* như trên */
  }
}

beforeEach(() => {
  localStorage.clear();
  resetSelectorCaches();
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, writable: true, value: FakeResizeObserver });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('P03 — lỗi quy chuẩn trong lớp tường', () => {
  it('lỗi đang chỉ: dải "Đang sửa", tường lỗi được chọn, "Vẽ tường" bật sẵn', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('partial')} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Đang sửa: Đầu tường hở')).toBeInTheDocument();
    expect(screen.getByText(/Cách sửa: Kéo đầu tường tới tường bên cạnh\./u)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vẽ tường (phím W)' })).toHaveAttribute('aria-pressed', 'true');
    });
    await waitFor(() => {
      expect(screen.queryByText(/Chọn một đoạn tường trên bản vẽ/u)).toBeNull();
    });
  });
});

describe('Ô "Chiều dài" của thanh tra', () => {
  const panelWith = (onChangeLength: (wallId: string, lengthMm: number) => void, unit: 'mm' | 'm' = 'mm') =>
    ({
      inspector: {
        id: FOCUS_WALL.id,
        codeLabel: '#W-002',
        thicknessMm: 220,
        lengthLabel: '4250 mm',
        lengthEdit: { valueText: unit === 'mm' ? '4250' : '4,25', unit },
        heightLabel: '3,00 m',
        confidence: 0.71,
        confidenceText: 'Máy khá chắc',
        kindLabel: 'Tường gạch',
        advanced: { confidenceLabel: '0,71', elevationOffsetLabel: '0', startPointLabel: '0', endPointLabel: '0' },
      },
      thicknessChoices: [220],
      thicknessFocusRequest: 0,
      isViewerRole: false,
      viewerRoleNotice: '',
      onApprove: vi.fn(),
      onSkip: vi.fn(),
      onChangeThickness: vi.fn(),
      onChangeLength,
      reviewCounter: { reviewed: 0, total: 1 },
      rows: [],
    }) as unknown as WallLayerViewProps;

  it('số không hợp lệ: báo lỗi tại chỗ, không gửi lệnh; Esc trả số cũ', () => {
    const onChangeLength = vi.fn();

    renderWithProviders(<WallLayerInspector panel={panelWith(onChangeLength)} />);
    fireEvent.click(screen.getByRole('button', { name: /Thông số nâng cao/u }));
    const input = screen.getByRole('textbox', { name: 'Chiều dài tường' });

    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Nhập một số lớn hơn 0.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChangeLength).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('4250');
    expect(screen.queryByText('Nhập một số lớn hơn 0.')).toBeNull();
  });

  it('đơn vị m: "5,5" gửi 5500 mm', () => {
    const onChangeLength = vi.fn();

    renderWithProviders(<WallLayerInspector panel={panelWith(onChangeLength, 'm')} />);
    fireEvent.click(screen.getByRole('button', { name: /Thông số nâng cao/u }));
    const input = screen.getByRole('textbox', { name: 'Chiều dài tường' });

    fireEvent.change(input, { target: { value: '5,5' } });
    fireEvent.blur(input);
    expect(onChangeLength).toHaveBeenCalledWith(FOCUS_WALL.id, 5500);
  });
});
