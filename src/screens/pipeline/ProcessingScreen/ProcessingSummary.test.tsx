import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProcessingSummary, splitMetricLabel } from './ProcessingSummary';

describe('splitMetricLabel (aesthetic 2.5 #3)', () => {
  it('splits a formatted label at the first space, keeping the number as written', () => {
    expect(splitMetricLabel('48 tường')).toEqual({ value: '48', unit: 'tường' });
    expect(splitMetricLabel('0 chuỗi kích thước')).toEqual({ value: '0', unit: 'chuỗi kích thước' });
    expect(splitMetricLabel('248,60 m²')).toEqual({ value: '248,60', unit: 'm²' });
    expect(splitMetricLabel('12')).toEqual({ value: '12', unit: '' });
  });
});

describe('ProcessingSummary', () => {
  it('keeps each metric readable as one name and marks a zero count for attention', () => {
    render(
      <ProcessingSummary
        summary={{
          metricLabels: ['81 tường', '0 chuỗi kích thước'],
          onCalibrateScale: vi.fn(),
          onReviewWalls: vi.fn(),
        }}
      />,
    );
    expect(screen.getByRole('listitem', { name: '81 tường' })).toBeInTheDocument();
    expect(screen.getByText('81')).toHaveClass('text-text-primary');
    expect(screen.getByText('0')).toHaveClass('text-state-attention-text');
  });
});
