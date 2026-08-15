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

  it('applies attention color class at the "cần kiểm tra" level (< 0,70)', () => {
    const { container } = render(<ConfidenceMeter value={0.62} noTooltip />);
    const fill = container.querySelector('.bg-state-attention');
    expect(fill).toBeInTheDocument();
  });

  it('applies muted color class at the "AI chắc chắn" level (>= 0,90)', () => {
    const { container } = render(<ConfidenceMeter value={0.9} noTooltip />);
    const fill = container.querySelector('.bg-text-muted');
    expect(fill).toBeInTheDocument();
  });

  // The meter used to switch at 0.75, which cut the "AI đề xuất" band in half:
  // 0,72 drew attention and 0,78 did not, though both carry the same label.
  it('treats the whole "AI đề xuất" band (0,70–0,90) alike', () => {
    for (const value of [0.71, 0.72, 0.78, 0.85]) {
      const { container } = render(<ConfidenceMeter value={value} noTooltip />);
      expect(container.querySelector('.bg-text-muted')).toBeInTheDocument();
      expect(container.querySelector('.bg-state-attention')).not.toBeInTheDocument();
    }
  });

  it('switches exactly at the level boundary, not inside a band', () => {
    const { container: below } = render(<ConfidenceMeter value={0.69} noTooltip />);
    const { container: atBoundary } = render(<ConfidenceMeter value={0.7} noTooltip />);

    expect(below.querySelector('.bg-state-attention')).toBeInTheDocument();
    expect(atBoundary.querySelector('.bg-state-attention')).not.toBeInTheDocument();
  });

  it('applies attention text color to value label at the "cần kiểm tra" level', () => {
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
