import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { IconButton } from './IconButton';
import { Settings } from 'lucide-react';

describe('IconButton', () => {
  it('renders with required aria-label', () => {
    render(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" />);
    expect(screen.getByRole('button', { name: 'Cài đặt' })).toBeInTheDocument();
  });

  it('is disabled when disabled prop set', () => {
    render(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies active state classes', () => {
    render(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" isActive />);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-bg-selected/);
    // Must NOT use solid black background
    expect(btn.className).not.toMatch(/bg-black/);
  });

  it('announces its on/off state via aria-pressed when isActive is given (B-V6-12)', () => {
    const { rerender } = render(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" isActive />);
    expect(screen.getByRole('button', { name: 'Cài đặt', pressed: true })).toBeInTheDocument();

    rerender(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" isActive={false} />);
    expect(screen.getByRole('button', { name: 'Cài đặt', pressed: false })).toBeInTheDocument();
  });

  it('is not a toggle when isActive is absent or the button is a disclosure', () => {
    const { rerender } = render(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');

    rerender(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" isActive aria-expanded />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });

  it('applies sm size: 44px with its ring on phones, 36px from sm up (BUG-077, BUG-086)', () => {
    render(<IconButton icon={<Settings size={16} />} aria-label="Cài đặt" size="sm" />);
    expect(screen.getByRole('button')).toHaveClass('h-10', 'w-10', 'sm:h-8', 'sm:w-8', 'p-0.5');
  });

  it('applies lg size', () => {
    render(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" size="lg" />);
    expect(screen.getByRole('button').className).toMatch(/h-10/);
  });

  it('has focus ring classes', () => {
    render(<IconButton icon={<Settings size={18} />} aria-label="Cài đặt" />);
    expect(screen.getByRole('button').className).toMatch(/focus-visible:ring-2/);
  });
});
