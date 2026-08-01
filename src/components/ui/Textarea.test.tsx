import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders textarea element', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(<Textarea label="Ghi chú" />);
    expect(screen.getByText('Ghi chú')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Textarea error="Ghi chú bắt buộc" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Ghi chú bắt buộc');
  });

  it('shows character count', () => {
    render(<Textarea value="Xin chào" maxLength={100} />);
    expect(screen.getByText('8 / 100')).toBeInTheDocument();
  });

  it('shows hint', () => {
    render(<Textarea hint="Nội dung tối đa 200 ký tự" />);
    expect(screen.getByText('Nội dung tối đa 200 ký tự')).toBeInTheDocument();
  });

  it('is disabled', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<Textarea isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('marks as read-only', () => {
    render(<Textarea isReadOnly value="Chỉ đọc" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
  });

  it('handles onChange events', () => {
    const onChange = vi.fn();
    render(<Textarea onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalled();
  });
});
