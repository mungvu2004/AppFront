/**
 * Mở lớp đối tượng từ nút "Sửa" của Quy chuẩn (P03): `?rule=ROOM-NO-WINDOW&issue=<phòng>&tool=window`.
 *
 * Bộ mẫu của màn không có phòng nào, nên lỗi "phòng thiếu cửa sổ" giả ở `useLayerRuleIssues`
 * (hook ấy có bài kiểm riêng); ở đây chỉ kiểm màn NỐI nó: dải "Đang sửa" hiện và công cụ
 * "Vẽ cửa sổ" bật sẵn.
 */

import { cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';
import { useStore } from '@/store';
import { resetSelectorCaches } from '@/store/selectors';

import type { LayerRuleIssues } from '../shared/useLayerRuleIssues';

import { ObjectLayerReviewContainer } from './ObjectLayerReview.container';
import { scenarioArgsFor } from './ObjectLayerReview.stories';

const ruleIssues = vi.hoisted((): LayerRuleIssues => {
  const issue = {
    key: 'ROOM-NO-WINDOW|R-1',
    ruleCode: 'ROOM-NO-WINDOW',
    ruleName: 'Phòng phải có cửa sổ',
    severity: 'warning' as const,
    entityId: 'R-1',
    message: 'Phòng ngủ chưa có cửa sổ.',
    suggestion: 'Vẽ một cửa sổ trên tường ngoài của phòng.',
    at: { x: 2000, y: 2000 },
    tool: 'window' as const,
  };

  return {
    issues: [issue],
    focused: issue,
    focusResolved: false,
    initialTool: 'window',
    onFocus: () => undefined,
    onClearFocus: () => undefined,
  };
});

vi.mock('../shared/useLayerRuleIssues', () => ({ useLayerRuleIssues: () => ruleIssues }));

beforeEach(() => {
  resetSelectorCaches();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  useStore.getState().setSpatial(null, null);
  resetSelectorCaches();
});

describe('mở từ nút "Sửa" của Quy chuẩn', () => {
  it('nói lỗi đang sửa và bật sẵn "Vẽ cửa sổ"', async () => {
    renderWithProviders(
      <MemoryRouter>
        <ObjectLayerReviewContainer {...scenarioArgsFor('success')} />
      </MemoryRouter>,
    );

    const banner = await screen.findByTestId('qc-rule-issue-focus');
    expect(banner.textContent).toContain('Đang sửa: Phòng phải có cửa sổ');
    expect(banner.textContent).toContain('Vẽ một cửa sổ trên tường ngoài của phòng.');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vẽ cửa sổ' }).getAttribute('aria-pressed')).toBe('true');
    });
    expect(screen.getByTestId('qc-rule-issue-marker')).toBeTruthy();
  });
});
