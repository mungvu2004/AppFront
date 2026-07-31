import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('renders with role=switch', () => {
    render(<Toggle aria-label="Bật/tắt" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('starts unchecked by default', () => {
    render(<Toggle aria-label="Bật/tắt" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('starts checked when defaultChecked=true', () => {
    render(<Toggle aria-label="Bật/tắt" defaultChecked />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
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

  it('shows loading skeleton', () => {
    const { container } = render(<Toggle isLoading aria-label="Đang tải" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('has focus ring class', () => {
    render(<Toggle aria-label="Focus" />);
    expect(screen.getByRole('switch').className).toMatch(/focus-visible:ring-2/);
  });
});
