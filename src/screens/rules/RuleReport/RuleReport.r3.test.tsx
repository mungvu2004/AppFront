/**
 * R3 nhóm A: R-2 (ô "Cảnh báo" không được ngầm gộp gợi ý). Bản Impeccable tách gợi ý ra ô và
 * tab riêng, nên nhãn "Cảnh báo" giờ nói đúng cái nó đếm. S-3 phủ bởi domain/spatial/__tests__/elementCount.test.ts.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LEVEL_FILTER_OPTIONS } from './RuleReportLabels';
import { RuleReportSummaryStrip } from './RuleReportSummary';

describe('R-2 — cảnh báo và gợi ý là hai ô, hai tab riêng', () => {
  it('ô tóm tắt có "Cảnh báo" và "Gợi ý" tách nhau', () => {
    render(
      <RuleReportSummaryStrip summary={{ evaluated: 4, passed: 1, warnings: 2, violations: 0, suggestions: 1 }} />,
    );

    expect(screen.getByText('Cảnh báo')).toBeTruthy();
    expect(screen.getByText('Gợi ý')).toBeTruthy();
    expect(screen.queryByText('Cảnh báo, gợi ý')).toBeNull();
  });

  it('tab lọc có mức "warning" và "suggestion" riêng', () => {
    expect(LEVEL_FILTER_OPTIONS.find((option) => option.value === 'warning')?.label).toBe('Cảnh báo');
    expect(LEVEL_FILTER_OPTIONS.find((option) => option.value === 'suggestion')?.label).toBe('Gợi ý');
  });
});
