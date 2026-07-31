import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConfidenceMeter } from './ConfidenceMeter';

describe('ConfidenceMeter', () => {
  it('renders the value in Vietnamese format (comma)', () => {
    render(<ConfidenceMeter value={0.71} noTooltip />);
    expect(screen.getByText('0,71')).toBeInTheDocument();
  });

  it('renders role="meter" with correct aria-valuenow', () => {
    render(<ConfidenceMeter value={0.9} noTooltip />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '90');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
  });

  it('applies attention color class when value < 0.75', () => {
    const { container } = render(<ConfidenceMeter value={0.71} noTooltip />);
    const fill = container.querySelector('.bg-state-attention');
    expect(fill).toBeInTheDocument();
  });

  it('applies muted color class when value >= 0.75', () => {
    const { container } = render(<ConfidenceMeter value={0.9} noTooltip />);
    const fill = container.querySelector('.bg-text-muted');
    expect(fill).toBeInTheDocument();
  });

  it('applies attention text color to value label when < 0.75', () => {
    const { container } = render(<ConfidenceMeter value={0.6} noTooltip />);
    const valueSpan = container.querySelector('.text-state-attention-text');
    expect(valueSpan).toBeInTheDocument();
  });

  it('clamps value to [0, 1]', () => {
    render(<ConfidenceMeter value={1.5} noTooltip />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders track 48px wide (w-12)', () => {
    render(<ConfidenceMeter value={0.5} noTooltip />);
    const meter = screen.getByRole('meter');
    expect(meter.className).toMatch(/w-12/);
  });

  it('renders track 4px tall (h-1)', () => {
    render(<ConfidenceMeter value={0.5} noTooltip />);
    const meter = screen.getByRole('meter');
    expect(meter.className).toMatch(/h-1/);
  });
});
