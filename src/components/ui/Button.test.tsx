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
    render(<Button iconBefore={<Plus />}>Thêm</Button>);
    const button = screen.getByRole('button', { name: 'Thêm' });
    expect(button.querySelector('svg')).toBeInTheDocument();
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

  // The label is drawn twice — once in a hidden copy that reserves the width so
  // a spinner cannot resize the button, once visibly. Without aria-hidden on the
  // copy, anything reading the DOM before the stylesheet applies computes the
  // name as the label twice over, which quietly breaks every
  // `getByRole('button', { name })` in the repo.
  it('is named once, not twice, despite drawing its label twice', () => {
    render(<Button>Thu hồi</Button>);

    expect(screen.getByRole('button', { name: 'Thu hồi' })).toBeInTheDocument();
  });

  it('keeps a single name when it also carries an icon and a shortcut', () => {
    render(
      <Button iconBefore={<Plus />} shortcut="⌘K">
        Thêm tường
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Thêm tường ⌘K' })).toBeInTheDocument();
  });
});
