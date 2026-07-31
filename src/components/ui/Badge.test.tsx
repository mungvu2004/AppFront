import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge variant="verified">Đã duyệt</Badge>);
    expect(screen.getByText('Đã duyệt')).toBeInTheDocument();
  });

  it('applies verified tint classes', () => {
    const { container } = render(<Badge variant="verified">V</Badge>);
    expect(container.firstChild).toHaveClass('bg-state-verified-tint');
    expect(container.firstChild).toHaveClass('text-state-verified-text');
  });

  it('applies attention tint classes', () => {
    const { container } = render(<Badge variant="attention">A</Badge>);
    expect(container.firstChild).toHaveClass('bg-state-attention-tint');
  });

  it('applies violation tint classes', () => {
    const { container } = render(<Badge variant="violation">V</Badge>);
    expect(container.firstChild).toHaveClass('bg-state-violation-tint');
  });

  it('applies neutral bg-sunken class', () => {
    const { container } = render(<Badge variant="neutral">N</Badge>);
    expect(container.firstChild).toHaveClass('bg-bg-sunken');
  });

  it('renders dot indicator by default', () => {
    const { container } = render(<Badge variant="verified">V</Badge>);
    // dot is a span[aria-hidden]
    const dot = container.querySelector('span[aria-hidden]');
    expect(dot).toBeInTheDocument();
  });

  it('suppresses dot when noDot=true', () => {
    const { container } = render(<Badge variant="verified" noDot>V</Badge>);
    const dot = container.querySelector('span[aria-hidden]');
    expect(dot).not.toBeInTheDocument();
  });

  it('has correct height and font-size classes', () => {
    const { container } = render(<Badge variant="verified">V</Badge>);
    expect(container.firstChild).toHaveClass('h-[22px]');
    expect(container.firstChild).toHaveClass('text-[13px]');
    expect(container.firstChild).toHaveClass('rounded-[6px]');
  });
});
