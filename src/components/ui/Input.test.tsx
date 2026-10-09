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
    render(<Input prefix={<span>@</span>} />);
    expect(screen.getByText('@')).toBeInTheDocument();
  });

  it('renders suffix content', () => {
    render(<Input suffix={<span>mm</span>} />);
    expect(screen.getByText('mm')).toBeInTheDocument();
  });

  it('has focus ring class', () => {
    const { container } = render(<Input />);
    const wrapper = container.querySelector('.focus-within\\:ring-2');
    expect(wrapper).toBeInTheDocument();
  });

  // BUG-048: the field inside the 1px border is 44px under `sm`, 36px from `sm` up.
  it('is a 44px touch target on phones and keeps 38px from sm up', () => {
    const { container } = render(<Input />);
    const wrapper = container.querySelector('.focus-within\\:ring-2');
    expect(wrapper).toHaveClass('h-[46px]', 'sm:h-[38px]');
  });

  // BUG-045: the edge has to reach 3:1 against the field and the page.
  it('draws its edge with the control border, not the divider token', () => {
    const { container } = render(<Input />);
    const wrapper = container.querySelector('.focus-within\\:ring-2');
    expect(wrapper).toHaveClass('border-border-control');
    expect(wrapper).not.toHaveClass('border-border-default');
  });

  // QA-01b nợ #7: the hint is read with the field, not only seen.
  it('ties the hint to the field', () => {
    render(<Input label="Tên" hint="Tối đa 80 ký tự" />);
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('Tối đa 80 ký tự');
  });

  it('describes the field by the error instead of the hint once there is one', () => {
    render(<Input label="Tên" hint="Tối đa 80 ký tự" error="Trường bắt buộc" />);
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('Trường bắt buộc');
  });

  // QA-01b nợ #15: a caller's own description joins the field's, it does not replace it.
  it('merges a caller aria-describedby with its own error', () => {
    render(
      <>
        <p id="note">Ghi chú</p>
        <Input id="f" label="Tên" error="Trường bắt buộc" aria-describedby="note" />
      </>
    );
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('Ghi chú Trường bắt buộc');
  });

  it('does not repeat an id the caller already joined (as PasswordField does)', () => {
    render(<Input id="f" label="Tên" error="Trường bắt buộc" aria-describedby="f-error" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'f-error');
  });
});
