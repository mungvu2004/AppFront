import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('vẽ đúng một h1 nhìn thấy được, không giấu bằng sr-only', () => {
    render(<PageHeader title="Quản lý người dùng" />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe('Quản lý người dùng');
    expect(headings[0]?.className).not.toContain('sr-only');
  });

  it('cỡ chữ h1 cùng bậc với các màn admin khác (20px, đậm vừa)', () => {
    render(<PageHeader title="Tiêu đề" />);

    const className = screen.getByRole('heading', { level: 1 }).className;
    expect(className).toContain('text-[20px]');
    expect(className).toContain('font-semibold');
  });

  it('mô tả ngắn và hành động chính nằm cạnh tiêu đề khi có', () => {
    render(<PageHeader actions={<button type="button">Mời người dùng</button>} description="Mời, đổi vai, xoá." title="Tiêu đề" />);

    expect(screen.getByText('Mời, đổi vai, xoá.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mời người dùng' })).toBeInTheDocument();
  });

  it('không có mô tả hay hành động thì không vẽ khối thừa', () => {
    const { container } = render(<PageHeader title="Tiêu đề" />);

    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
