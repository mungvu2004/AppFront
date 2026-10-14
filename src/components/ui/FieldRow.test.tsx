import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FieldRow } from './FieldRow';

describe('FieldRow', () => {
  it('renders label and children', () => {
    render(<FieldRow label="Độ dày tường"><span>220 mm</span></FieldRow>);
    expect(screen.getByText('Độ dày tường')).toBeInTheDocument();
    expect(screen.getByText('220 mm')).toBeInTheDocument();
  });

  it('drops the 36 px-control label box for a text value (isText)', () => {
    const { rerender } = render(<FieldRow label="Mã dự án"><span>DA-01</span></FieldRow>);
    expect(screen.getByText('Mã dự án').parentElement).toHaveClass('min-h-[36px]', 'items-center');

    rerender(<FieldRow label="Mã dự án" isText><span>DA-01</span></FieldRow>);
    expect(screen.getByText('Mã dự án').parentElement).not.toHaveClass('min-h-[36px]');
    expect(screen.getByText('DA-01').parentElement).toHaveClass('leading-[20px]');
  });

  it('[BUG-613] label sits centred in the same 36 px box as a 36 px value, at 13 px secondary', () => {
    render(<FieldRow label="Chiều dài"><span className="flex h-9 items-center">4.000,00 mm</span></FieldRow>);

    const label = screen.getByText('Chiều dài');

    /* Centred in 36 px like the value's h-9: no fixed top offset to drift by ~5 px. */
    expect(label.parentElement).toHaveClass('flex', 'min-h-[36px]', 'items-center');
    expect(label.parentElement).not.toHaveClass('pt-[9px]');
    expect(label).toHaveClass('text-[13px]', 'text-text-secondary');
    expect(label).not.toHaveClass('font-medium');
  });

  it('stacks the label above a full-width value (isStacked, BUG-502)', () => {
    const { rerender } = render(<FieldRow label="Họ tên"><span>An</span></FieldRow>);
    expect(screen.getByText('Họ tên').parentElement).toHaveClass('w-[40%]');

    rerender(<FieldRow label="Họ tên" isStacked><span>An</span></FieldRow>);
    const label = screen.getByText('Họ tên').parentElement;
    expect(label?.parentElement).toHaveClass('flex-col');
    expect(label).toHaveClass('w-full');
    expect(label).not.toHaveClass('w-[40%]', 'pt-[9px]');
    expect(screen.getByText('An').parentElement).toHaveClass('w-full');
    expect(screen.getByText('An').parentElement).not.toHaveClass('w-[60%]');
  });

  it('renders dash for mixed value', () => {
    render(<FieldRow label="Độ dày" isMixed><span>ignored</span></FieldRow>);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<FieldRow label="Test" isLoading><span /></FieldRow>);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
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
