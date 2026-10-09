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
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl options={options} defaultValue="2d" onChange={onChange} aria-label="Nav" />);
    act(() => screen.getByRole('radio', { checked: true }).focus());
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('3d');
  });

  it('navigates with ArrowLeft key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl options={options} defaultValue="3d" onChange={onChange} aria-label="Nav" />);
    act(() => screen.getByRole('radio', { checked: true }).focus());
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('2d');
  });
});
