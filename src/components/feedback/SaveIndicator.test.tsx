import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectedSaveIndicator } from './SaveIndicator';
import { useStore } from '../../store';
import { normalizeSpatial } from '../../domain/spatial/normalize';
import { CLEAN_BUILDING_SCENARIO } from '../../lib/testing/fixtures';

describe('SaveIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    /* eslint-disable-next-line local/no-direct-set -- đưa store về trạng thái đầu giữa
       hai test là thao tác ghi DUY NHẤT không được vào lịch sử hoàn tác, đúng thứ
       `commit()` sẽ làm nếu đi qua nó. A10 vẫn có hiệu lực trong mã sản phẩm. */
    useStore.setState({ spatial: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions from pending to saving to saved correctly', async () => {
    // Mock save function
    const mockSave = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => setTimeout(resolve, 500));
    });

    render(<ConnectedSaveIndicator onSave={mockSave} />);

    // Initially idle
    expect(screen.getByText('Chưa có thay đổi')).toBeInTheDocument();

    // Trigger spatial change
    act(() => {
      /* eslint-disable-next-line local/no-direct-set -- ghi thẳng như trên, để dựng
         cảnh giữa hai lần render chứ không phải một thay đổi của người dùng. */
      useStore.setState({ spatial: normalizeSpatial(CLEAN_BUILDING_SCENARIO.graph) });
    });

    // Should immediately become pending
    expect(screen.getByText('Có thay đổi chờ đồng bộ')).toBeInTheDocument();

    // Advance 800ms to trigger autosave debounce
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Now it should be saving
    expect(screen.getByText('Đang lưu...')).toBeInTheDocument();
    expect(mockSave).toHaveBeenCalled();

    // Advance 500ms for the save promise to resolve
    await act(async () => {
      vi.advanceTimersByTime(500);
      // Let promises resolve
      await Promise.resolve();
    });

    // Should now show saved
    expect(screen.getByText(/Đã lưu lúc/)).toBeInTheDocument();
  });
});
