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

  it('applies sm size', () => {
    render(<IconButton icon={<Settings size={16} />} aria-label="Cài đặt" size="sm" />);
    expect(screen.getByRole('button').className).toMatch(/h-8/);
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
