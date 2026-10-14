/**
 * Ba lỗi nhìn của SCR-14: khối "Kiểm chứng" ba gạch không lý do (BUG-631), hàng phím trần lặp danh
 * sách "Phím tắt" (BUG-632), và danh sách phím hiện cả trên màn chạm (BUG-633).
 */

import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MISSING_VALUE } from '@/lib/format/number';
import { renderWithProviders } from '@/lib/testing/render';

import { ScaleCalibration } from './ScaleCalibration';
import { scenarioFor } from './ScaleCalibration.stories';

afterEach(cleanup);

/** Kịch bản thành công, phương pháp đường tham chiếu, ba dòng kiểm chứng tuỳ chọn. */
function referenceScenario(missingChecks: boolean) {
  const base = scenarioFor('success');
  const panel = base.model.panel;

  return {
    ...base,
    model: {
      ...base.model,
      panel: {
        ...panel,
        method: 'referenceLine' as const,
        crossChecks: missingChecks ? panel.crossChecks.map((row) => ({ ...row, valueLabel: MISSING_VALUE })) : panel.crossChecks,
      },
    },
  };
}

describe('ScaleCalibration — trạng thái nhìn', () => {
  it('[BUG-631] ba dòng kiểm chứng đều trống: một câu nói chưa đủ dữ liệu', () => {
    renderWithProviders(<ScaleCalibration {...referenceScenario(true)} />);

    expect(screen.getByText(/Chưa đủ dữ liệu để kiểm chứng tỷ lệ/u)).toBeInTheDocument();
  });

  it('[BUG-632][BUG-633] phím tắt chỉ một chỗ, có mô tả, ẩn dưới 640 px', () => {
    renderWithProviders(<ScaleCalibration {...referenceScenario(false)} />);

    expect(screen.getAllByText('Shift')).toHaveLength(1);
    expect(screen.getByRole('list', { name: 'Phím tắt' })).toHaveClass('max-sm:hidden');
  });
});
