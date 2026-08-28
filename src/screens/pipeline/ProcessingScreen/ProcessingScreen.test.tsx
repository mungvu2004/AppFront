/**
 * Lượt kiểm khung tối thiểu của màn Xử lý (S4).
 *
 * MỘT bài kiểm chứng khung dựng được từ `ProcessingScreenProps` mà không ném
 * lỗi. Bộ khẳng định đầy đủ — bảy trạng thái (A11), khả năng tiếp cận, tiếng
 * Việt, không mã màu thô, cùng khuôn `InputQualityGate.test.tsx` — thuộc nhiệm
 * vụ kế tiếp (V6), khi `ProcessingPreviewPanel`/`ProcessingLogPanel` đã có ruột
 * thật để mô phỏng cho từng trạng thái.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import { ProcessingScreen } from './ProcessingScreen';
import { minimalProcessingScreenProps } from './ProcessingScreen.stories';

describe('ProcessingScreen — khung tối thiểu (S4)', () => {
  it('dựng được từ ProcessingScreenProps mà không ném lỗi', () => {
    renderWithProviders(<ProcessingScreen {...minimalProcessingScreenProps()} />);

    expect(screen.getByText('Xử lý')).toBeInTheDocument();
  });
});
