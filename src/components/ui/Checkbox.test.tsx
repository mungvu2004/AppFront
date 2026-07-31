import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders checkbox input', () => {
    render(<Checkbox label="Chọn" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('is unchecked by default', () => {
    render(<Checkbox />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('renders label', () => {
    render(<Checkbox label="Tường chịu lực" />);
    expect(screen.getByText('Tường chịu lực')).toBeInTheDocument();
  });

  it('calls onChange when clicked', () => {
    const onChange = vi.fn();
    render(<Checkbox label="Test" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is disabled when prop set', () => {
    render(<Checkbox label="Vô hiệu" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('renders indeterminate state', () => {
    const { container } = render(<Checkbox indeterminate />);
    // The indeterminate bar div is rendered
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
  });

  it('marks as aria-invalid on error', () => {
    render(<Checkbox error />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('has visible focus ring via peer classes', () => {
    const { container } = render(<Checkbox />);
    expect(container.querySelector('.peer-focus-visible\\:ring-2')).toBeInTheDocument();
  });
});
