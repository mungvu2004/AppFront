import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('renders with role=switch', () => {
    render(<Toggle aria-label="Bật/tắt" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('is a 36×24 box itself, not a 20 px box with a pseudo-element hit area, and gives the 4 px back to the row (BUG-158)', () => {
    render(<Toggle aria-label="Bật/tắt" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('h-6', 'w-9', '-my-0.5');
    expect(toggle).not.toHaveClass('hit-y-24');
    // The visible track is still 36×20.
    expect(toggle.firstElementChild).toHaveClass('h-5', 'w-full', 'rounded-full');
  });

  it('starts unchecked by default', () => {
    render(<Toggle aria-label="Bật/tắt" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('starts checked when defaultChecked=true', () => {
    render(<Toggle aria-label="Bật/tắt" defaultChecked />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('puts the knob on the right when on, on the left when off', () => {
    const { rerender } = render(<Toggle aria-label="Bật/tắt" checked={false} />);
    expect(screen.getByRole('switch').firstElementChild).not.toHaveClass('justify-end');
    rerender(<Toggle aria-label="Bật/tắt" checked />);
    expect(screen.getByRole('switch').firstElementChild).toHaveClass('justify-end');
  });

  it('calls onChange on click', () => {
    const onChange = vi.fn();
    render(<Toggle aria-label="Bật/tắt" onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Toggle aria-label="Bật/tắt" disabled onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders label', () => {
    render(<Toggle label="Hiển thị lưới" aria-label="Toggle" />);
    expect(screen.getByText('Hiển thị lưới')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<Toggle label="Tối" description="Giảm độ chói" aria-label="Toggle" />);
    expect(screen.getByText('Giảm độ chói')).toBeInTheDocument();
  });

  it('keeps its own description first when a caller adds another id (BUG-196)', () => {
    render(
      <>
        <Toggle label="Có tầng hầm" description="Mô tả riêng." aria-describedby="note" disabled />
        <p id="note">Ghi chú trần.</p>
      </>,
    );
    expect(screen.getByRole('switch')).toHaveAccessibleDescription('Mô tả riêng. Ghi chú trần.');
  });

  it('shows loading skeleton', () => {
    const { container } = render(<Toggle isLoading aria-label="Đang tải" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  // review-1 #27: the ring goes round the 36×20 track, not the taller 36×24 hit box.
  it('draws its focus ring on the track, not on the hit box', () => {
    render(<Toggle aria-label="Focus" />);
    const box = screen.getByRole('switch');
    expect(box).toHaveClass('group');
    expect(box.className).not.toMatch(/(^| )focus-visible:ring-2/);
    expect(box.firstElementChild).toHaveClass('group-focus-visible:ring-2', 'group-focus-visible:ring-offset-2');
  });

  // QA-01b nợ #3: the off track must stand 3:1 off the page, not melt into it.
  it('draws the off track with the control border token', () => {
    render(<Toggle aria-label="Bật/tắt" />);
    const track = screen.getByRole('switch').firstElementChild;
    expect(track).toHaveClass('bg-border-control');
    expect(track).not.toHaveClass('bg-bg-sunken');
  });

  it('luôn có tên truy cập khi có label (kể cả không có aria-label)', () => {
    render(<Toggle label="Tự động tính cao độ" />);
    expect(screen.getByRole('switch', { name: 'Tự động tính cao độ' })).toBeInTheDocument();
  });
});
