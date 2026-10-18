import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProjectStepsCard } from '../BackToProjectCard';

describe('ProjectStepsCard', () => {
  it('sáu bước, bước 4 "Mô hình 3D" đang mở, lối tiếp sang Quy chuẩn', () => {
    render(<ProjectStepsCard projectId="p1" />);
    const nav = screen.getByRole('navigation', { name: 'Các bước của dự án' });
    expect(nav.querySelectorAll('li')).toHaveLength(6);
    expect(nav.querySelector('[aria-current="step"]')?.textContent).toContain('Mô hình 3D');
    expect(screen.getByRole('link', { name: 'Bước 3: Kiểm tra tầng' }).getAttribute('href')).toBe('/projects/p1/floors');
    expect(screen.getByRole('link', { name: 'Bước tiếp theo: Quy chuẩn' }).getAttribute('href')).toBe('/projects/p1/rules');
  });
});
