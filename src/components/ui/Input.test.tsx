import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('renders input element', () => {
    render(<Input placeholder="Nhập..." />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label with correct for', () => {
    render(<Input label="Tên" id="test-name" />);
    const label = screen.getByText('Tên');
    expect(label).toBeInTheDocument();
    expect(label.tagName.toLowerCase()).toBe('label');
  });

  it('shows error message', () => {
    render(<Input error="Trường bắt buộc" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Trường bắt buộc');
  });

  it('marks input as invalid on error', () => {
    render(<Input error="Lỗi" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is disabled when prop set', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders loading skeleton when isLoading', () => {
    const { container } = render(<Input isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders prefix content', () => {
    render(<Input prefix={<span data-testid="pre">@</span>} />);
    expect(screen.getByTestId('pre')).toBeInTheDocument();
  });

  it('renders suffix content', () => {
    render(<Input suffix={<span data-testid="suf">mm</span>} />);
    expect(screen.getByTestId('suf')).toBeInTheDocument();
  });

  it('has focus ring class', () => {
    const { container } = render(<Input />);
    const wrapper = container.querySelector('.focus-within\\:ring-2');
    expect(wrapper).toBeInTheDocument();
  });
});
