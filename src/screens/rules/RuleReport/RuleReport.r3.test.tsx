/**
 * R3 nhóm A: R-2 (ô "Cảnh báo" không được ngầm gộp gợi ý). Bản Impeccable tách gợi ý ra ô và
 * tab riêng, nên nhãn "Cảnh báo" giờ nói đúng cái nó đếm. S-3 phủ bởi domain/spatial/__tests__/elementCount.test.ts.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RuleReportRows } from './RuleReportGroups';
import { LEVEL_FILTER_OPTIONS } from './RuleReportLabels';
import { RuleReportSummaryStrip } from './RuleReportSummary';

describe('R-2 — cảnh báo và gợi ý là hai ô, hai tab riêng', () => {
  it('ô tóm tắt có "Cảnh báo" và "Gợi ý" tách nhau', () => {
    render(
      <RuleReportSummaryStrip summary={{ evaluated: 4, passed: 1, warnings: 2, violations: 0, suggestions: 1 }} />,
    );

    expect(screen.getByText('Luật cảnh báo')).toBeTruthy();
    expect(screen.getByText('Luật có gợi ý')).toBeTruthy();
    expect(screen.queryByText('Cảnh báo, gợi ý')).toBeNull();
  });

  it('tab lọc có mức "warning" và "suggestion" riêng', () => {
    expect(LEVEL_FILTER_OPTIONS.find((option) => option.value === 'warning')?.label).toBe('Cảnh báo');
    expect(LEVEL_FILTER_OPTIONS.find((option) => option.value === 'suggestion')?.label).toBe('Gợi ý');
  });
});

describe('UX-03 — mỗi lỗi nói luôn cách sửa', () => {
  it('in câu "Cách sửa" dưới câu mô tả lỗi', () => {
    render(
      <RuleReportRows
        rows={[
          {
            key: 'ROOM-NO-DOOR:R-1',
            ruleCode: 'ROOM-NO-DOOR',
            severity: 'critical',
            message: 'Phòng ngủ 01 không có cửa đi nào, nên không vào được.',
            suggestion: 'Thêm một cửa đi vào một tường bao.',
            entityId: 'R-1',
            entityCode: '#R-001',
            levelId: null,
            levelLabel: null,
            resolved: false,
          },
        ]}
        selectedRowKey={null}
        isCompact={false}
        onSelectRow={() => undefined}
        onViewRow={() => undefined}
      />,
    );

    expect(screen.getByText('Cách sửa: Thêm một cửa đi vào một tường bao.')).toBeTruthy();
  });
});
