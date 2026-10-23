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

  it('QA-2 L1: chip thu gọn "bước hiện tại + menu" cho thanh hẹp, menu đủ sáu bước', () => {
    render(<ProjectStepsCard projectId="p1" />);
    const chip = screen.getByLabelText('Bước 4/6: Mô hình 3D — mở danh sách bước');
    expect(chip.tagName).toBe('SUMMARY');
    // K6: ở 768 chip chỉ còn số "4" — tooltip phải nói tên bước.
    expect(chip.getAttribute('title')).toBe('Bước 4: Mô hình 3D');
    const menu = screen.getByRole('list', { name: 'Danh sách bước' });
    expect(menu.querySelectorAll('a')).toHaveLength(6);
    expect(menu.querySelector('[aria-current="step"]')?.getAttribute('href')).toBe('/projects/p1/3d');
  });

  it('UI-1023 V-01: bước + "Tiếp" là một cụm; nút "Tiếp" không bao giờ ẩn theo bề rộng thanh', () => {
    render(<ProjectStepsCard projectId="p1" />);
    const nav = screen.getByRole('navigation', { name: 'Các bước của dự án' });
    const next = screen.getByRole('link', { name: 'Bước tiếp theo: Quy chuẩn' });
    expect(nav.contains(next)).toBe(true);
    expect(next.className.split(/\s+/)).not.toContain('hidden');
    expect(next.textContent).toContain('Tiếp');
  });
});
