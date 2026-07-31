import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FieldRow } from './FieldRow';

describe('FieldRow', () => {
  it('renders label and children', () => {
    render(<FieldRow label="Độ dày tường"><span>220 mm</span></FieldRow>);
    expect(screen.getByText('Độ dày tường')).toBeInTheDocument();
    expect(screen.getByText('220 mm')).toBeInTheDocument();
  });

  it('renders dash for mixed value', () => {
    render(<FieldRow label="Độ dày" isMixed><span>ignored</span></FieldRow>);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<FieldRow label="Test" isLoading><span /></FieldRow>);
    expect(container.querySelectorAll('.animate-skeleton-scan').length).toBeGreaterThan(0);
  });

  it('returns null when collapsed', () => {
    const { container } = render(<FieldRow label="Hidden" collapsed><span /></FieldRow>);
    expect(container.firstChild).toBeNull();
  });

  it('applies flash class for accent-wash', () => {
    const { container } = render(<FieldRow label="Flash" flash><span /></FieldRow>);
    expect(container.firstChild?.toString()).toBeDefined();
    expect(container.querySelector('.bg-accent-wash')).toBeInTheDocument();
  });

  it('applies bottom border by default', () => {
    const { container } = render(<FieldRow label="Row"><span /></FieldRow>);
    expect((container.firstChild as HTMLElement | null)?.className ?? '').toMatch(/border-b/);
  });

  it('removes border when isLast', () => {
    const { container } = render(<FieldRow label="Last Row" isLast><span /></FieldRow>);
    expect((container.firstChild as HTMLElement | null)?.className ?? '').not.toMatch(/border-b/);
  });
});
