import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHead } from './PageHead';
import { Section } from './Section';

describe('PageHead', () => {
  it('trả lời ba câu: tiêu đề là h1, có dòng trạng thái và vùng bước tiếp', () => {
    render(
      <PageHead
        eyebrow="Tài khoản"
        title="Đổi thông tin tài khoản"
        status={<span>Đã lưu 14:02</span>}
        next={<button type="button">Về danh sách dự án</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Đổi thông tin tài khoản' })).toBeInTheDocument();
    expect(screen.getByText('Đã lưu 14:02')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Về danh sách dự án' })).toBeInTheDocument();
  });
});

describe('Section', () => {
  it('đầu khung có tiêu đề h2 và hành động', () => {
    render(<Section title="Thông báo" actions={<button type="button">Lọc</button>}>nội dung</Section>);
    expect(screen.getByRole('heading', { level: 2, name: 'Thông báo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lọc' })).toBeInTheDocument();
  });
});
