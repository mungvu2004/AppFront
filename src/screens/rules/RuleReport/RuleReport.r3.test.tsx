/** R3 nhóm A: R-2 (ô "Cảnh báo" gộp gợi ý phải nói rõ). S-3 phủ bởi domain/spatial/__tests__/elementCount.test.ts. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LEVEL_FILTER_OPTIONS } from './RuleReportLabels';
import { RuleReportSummaryStrip } from './RuleReportSummary';

describe('R-2 — nhãn ô và tab cảnh báo nói cả gợi ý', () => {
  it('ô tóm tắt ghi "Cảnh báo, gợi ý"', () => {
    render(<RuleReportSummaryStrip summary={{ evaluated: 3, passed: 1, warnings: 2, violations: 0 }} />);

    expect(screen.getByText('Cảnh báo, gợi ý')).toBeTruthy();
    expect(screen.queryByText('Cảnh báo')).toBeNull();
  });

  it('tab lọc mức "warning" ghi "Cảnh báo, gợi ý"', () => {
    expect(LEVEL_FILTER_OPTIONS.find((option) => option.value === 'warning')?.label).toBe('Cảnh báo, gợi ý');
  });
});
