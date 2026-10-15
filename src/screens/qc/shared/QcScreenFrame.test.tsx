import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QC_BODY_CLASS, QcCanvasFrame, QcScreenFrame } from './QcScreenFrame';

describe('QcScreenFrame (BUG-324, BUG-329, BUG-413)', () => {
  it('[BUG-324] gốc màn cao bằng khung nhìn (h-screen), không phụ thuộc cha không có chiều cao', () => {
    render(<QcScreenFrame label="Màn thử">nội dung</QcScreenFrame>);
    const root = screen.getByRole('region', { name: 'Màn thử' });

    expect(root.className).toContain('h-screen');
    expect(root.className).not.toContain('h-full');
    expect(root.className).not.toContain('overflow-y-auto');
  });

  it('[BUG-329] màn dạng trang cuộn: gốc tự cuộn để thẻ cuối không bị cắt sát đáy', () => {
    render(
      <QcScreenFrame label="Màn cuộn" scroll>
        nội dung
      </QcScreenFrame>,
    );

    expect(screen.getByRole('region', { name: 'Màn cuộn' }).className).toContain('overflow-y-auto');
  });

  it('[BUG-413] một lề trang (p-2, gap-2) và một khung bản vẽ nền chìm bo 16 cho mọi màn', () => {
    expect(QC_BODY_CLASS).toBe('gap-2 p-2');

    render(<QcCanvasFrame label="Khung bản vẽ">x</QcCanvasFrame>);
    const canvas = screen.getByLabelText('Khung bản vẽ');

    expect(canvas.className).toContain('bg-bg-sunken');
    expect(canvas.className).toContain('rounded-2xl');
  });
});
