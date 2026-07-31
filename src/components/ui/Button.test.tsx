import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';
import { Plus } from 'lucide-react';

describe('Button', () => {
  it('renders button element', () => {
    render(<Button>Xác nhận</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Test</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-accent/);
  });

  it('applies danger variant', () => {
    render(<Button variant="danger">Xoá</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/text-state-violation-text/);
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Vô hiệu</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when loading', () => {
    render(<Button loading>Đang tải...</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Vô hiệu</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders iconBefore', () => {
    render(<Button iconBefore={<Plus data-testid="icon" />}>Thêm</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders fullWidth button', () => {
    render(<Button fullWidth>Đầy đủ chiều rộng</Button>);
    expect(screen.getByRole('button').className).toMatch(/w-full/);
  });

  it('has focus ring on focus-visible', () => {
    render(<Button>Focus</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/focus-visible:ring-2/);
  });
});
