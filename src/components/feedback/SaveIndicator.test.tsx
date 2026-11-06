import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SaveIndicator } from './SaveIndicator';

describe('SaveIndicator — một nguồn chữ (B-V1-47)', () => {
  it('nhãn của hook thắng ở trạng thái chờ và đang lưu, không bị chữ cố định đè', () => {
    const { rerender } = render(<SaveIndicator saveState="pending" label="Ngoại tuyến — sẽ lưu khi có mạng" />);

    expect(screen.getByRole('status')).toHaveTextContent('Ngoại tuyến — sẽ lưu khi có mạng');

    rerender(<SaveIndicator saveState="saving" label="Đang lưu…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Đang lưu…');
  });
});
