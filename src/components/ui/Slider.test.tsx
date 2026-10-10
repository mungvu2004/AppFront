import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Slider } from './Slider';

/** Tiêu điểm lên phần tử rồi gõ phím thật qua user-event (keydown → keyup, đúng thứ tự trình duyệt). */
async function press(element: HTMLElement, keys: string) {
  act(() => element.focus());
  await userEvent.setup({ delay: null }).keyboard(keys);
}

describe('Slider', () => {
  it('renders slider role', () => {
    render(<Slider value={50} onChange={() => {}} aria-label="Giá trị" />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('shows correct aria-valuenow', () => {
    render(<Slider value={48} onChange={() => {}} aria-label="Số tường" />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '48');
  });

  it('increments on ArrowRight', async () => {
    const onChange = vi.fn();
    render(<Slider value={50} onChange={onChange} aria-label="Giá trị" step={1} />);
    await press(screen.getByRole('slider'), '{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(51);
  });

  it('decrements on ArrowLeft', async () => {
    const onChange = vi.fn();
    render(<Slider value={50} onChange={onChange} aria-label="Giá trị" step={1} />);
    await press(screen.getByRole('slider'), '{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith(49);
  });

  it('goes to max on End key', async () => {
    const onChange = vi.fn();
    render(<Slider value={50} min={0} max={100} onChange={onChange} aria-label="End" />);
    await press(screen.getByRole('slider'), '{End}');
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('goes to min on Home key', async () => {
    const onChange = vi.fn();
    render(<Slider value={50} min={0} max={100} onChange={onChange} aria-label="Home" />);
    await press(screen.getByRole('slider'), '{Home}');
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<Slider value={50} onChange={onChange} disabled aria-label="Vô hiệu" />);
    await press(screen.getByRole('slider'), '{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders loading state', () => {
    const { container } = render(<Slider value={0} onChange={() => {}} isLoading aria-label="Đang tải" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders end labels', () => {
    render(<Slider value={50} onChange={() => {}} endLabels={['0', '100']} aria-label="Với nhãn" />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
