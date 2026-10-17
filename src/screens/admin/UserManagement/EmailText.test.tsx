import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmailText } from './EmailText';

describe('EmailText', () => {
  it('giữ nguyên chữ email để sao chép và để trình đọc màn hình đọc', () => {
    const { container } = render(<EmailText email="admin@example.com" />);

    expect(container.textContent).toBe('admin@example.com');
  });

  it('đặt chỗ được phép ngắt dòng sau @ và sau mỗi dấu chấm, không ngắt giữa một đoạn', () => {
    const { container } = render(<EmailText email="hoang.bao@example.com" />);

    // hoang. | bao@ | example. | com  → 3 chỗ ngắt
    expect(container.querySelectorAll('wbr')).toHaveLength(3);
  });

  it('email không có @ hay dấu chấm thì không chèn chỗ ngắt', () => {
    const { container } = render(<EmailText email="abc" />);

    expect(container.querySelectorAll('wbr')).toHaveLength(0);
    expect(container.textContent).toBe('abc');
  });
});
