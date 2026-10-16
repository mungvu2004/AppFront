import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { label: '2D', value: '2d' },
  { label: '3D', value: '3d' },
  { label: 'QC', value: 'qc' },
];

describe('SegmentedControl', () => {
  it('renders all options', () => {
    render(<SegmentedControl options={options} aria-label="Chế độ" />);
    expect(screen.getByRole('radio', { name: '2D' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3D' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'QC' })).toBeInTheDocument();
  });

  it('uses first option as default value', () => {
    render(<SegmentedControl options={options} aria-label="Chế độ" />);
    expect(screen.getByRole('radio', { name: '2D' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when clicking an option', () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} defaultValue="2d" onChange={onChange} aria-label="Chế độ" />);
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    expect(onChange).toHaveBeenCalledWith('3d');
  });

  it('does not call onChange for disabled option', () => {
    const onChange = vi.fn();
    const opts = [...options, { label: 'Ẩn', value: 'hidden', disabled: true }];
    render(<SegmentedControl options={opts} defaultValue="2d" onChange={onChange} aria-label="Test" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Ẩn' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders loading state', () => {
    const { container } = render(<SegmentedControl options={options} isLoading aria-label="Test" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('has role=radiogroup on container', () => {
    render(<SegmentedControl options={options} aria-label="Test" />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('navigates with ArrowRight key', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<SegmentedControl options={options} defaultValue="2d" onChange={onChange} aria-label="Nav" />);
    act(() => screen.getByRole('radio', { checked: true }).focus());
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('3d');
  });

  it('navigates with ArrowLeft key', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<SegmentedControl options={options} defaultValue="3d" onChange={onChange} aria-label="Nav" />);
    act(() => screen.getByRole('radio', { checked: true }).focus());
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('2d');
  });
});

describe('SegmentedControl roving tabindex (36R-E-003, BUG-P08-011)', () => {
  it('one tab stop: the selected radio is 0, the others -1', () => {
    render(<SegmentedControl options={options} value="3d" aria-label="Roving" />);
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: '2D' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: 'QC' })).toHaveAttribute('tabindex', '-1');
  });

  it('arrow keys move relative to the FOCUSED radio, not the selected one', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="2d" onChange={onChange} aria-label="Roving" />);
    act(() => screen.getByRole('radio', { name: '3D' }).focus());
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('qc');
    expect(screen.getByRole('radio', { name: 'QC' })).toHaveFocus();
  });

  it('skips a disabled option and never focuses it', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    const opts = [options[0]!, { label: '3D', value: '3d', disabled: true }, options[2]!];
    render(<SegmentedControl options={opts} defaultValue="2d" onChange={onChange} aria-label="Roving" />);
    act(() => screen.getByRole('radio', { name: '2D' }).focus());
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('qc');
    expect(screen.getByRole('radio', { name: 'QC' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('tabindex', '-1');
  });

  it('[36R-E-002] ArrowRight wraps last -> first, ArrowLeft wraps first -> last, focus follows', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<SegmentedControl options={options} defaultValue="qc" onChange={onChange} aria-label="Roving" />);
    act(() => screen.getByRole('radio', { name: 'QC' }).focus());
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('2d');
    expect(screen.getByRole('radio', { name: '2D' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('qc');
    expect(screen.getByRole('radio', { name: 'QC' })).toHaveFocus();
  });

  it('selected option disabled: the first enabled radio stays the tab stop', () => {
    const opts = [{ label: '2D', value: '2d', disabled: true }, options[1]!, options[2]!];
    render(<SegmentedControl options={opts} value="2d" aria-label="Roving" />);
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: '2D' })).toHaveAttribute('tabindex', '-1');
  });
});

describe('SegmentedControl thumb (BUG-410)', () => {
  it('is drawn inside the active segment by CSS, never by a measured layout projection', () => {
    const { rerender } = render(<SegmentedControl options={options} value="2d" aria-label="Thumb" />);
    rerender(<SegmentedControl options={options} value="3d" aria-label="Thumb" />);

    const active = screen.getByRole('radio', { name: '3D' });
    const thumb = active.querySelector('[data-segment-thumb]');

    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute('style') ?? '').toBe('');
    expect(screen.getByRole('radio', { name: '2D' }).querySelector('[data-segment-thumb]')).toBeNull();
  });
});
