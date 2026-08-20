import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Toast, useToast } from './Toast';
import { Button } from '../ui/Button';

// Mock requestAnimationFrame for predictable timers
const originalRaf = global.requestAnimationFrame;
const originalCaf = global.cancelAnimationFrame;

describe('Toast.Provider and Toast.Item', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    let time = 0;
    global.requestAnimationFrame = vi.fn((cb) => {
      return setTimeout(() => {
        time += 16;
        cb(time);
      }, 16) as unknown as number;
    });
    global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id as unknown as number));
  });

  afterEach(() => {
    vi.useRealTimers();
    global.requestAnimationFrame = originalRaf;
    global.cancelAnimationFrame = originalCaf;
  });

  const TestComponent = () => {
    const { addToast } = useToast();
    return (
      <Button
        onClick={() => addToast({ message: 'Test message', onUndo: () => {} })}
      >
        Add Toast
      </Button>
    );
  };

  const TestGroupComponent = () => {
    const { addToast } = useToast();
    return (
      <Button
        onClick={() => {
          addToast({ message: 'Item 1 tường', onUndo: vi.fn() });
          addToast({ message: 'Item 2 tường', onUndo: vi.fn() });
          addToast({ message: 'Item 3 tường', onUndo: vi.fn() });
          addToast({ message: 'Item 4 tường', onUndo: vi.fn() });
        }}
      >
        Add 4 Toasts
      </Button>
    );
  };

  it('renders a toast and removes it after 8 seconds', async () => {
    render(
      <Toast.Provider>
        <TestComponent />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));

    expect(screen.getByText('Test message')).toBeInTheDocument();

    // Advance by 8 seconds (8000ms)
    act(() => {
      vi.runAllTimers();
    });

    act(() => {
      vi.runAllTimers();
    });
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  });

  it('groups 4 toasts correctly and uses safe domain label', async () => {
    render(
      <Toast.Provider>
        <TestGroupComponent />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add 4 Toasts' }));

    // We should see Item 4 and Item 3 (since index 0 and 1 are the newest).
    // Item 1 and 2 are grouped into the 3rd slot.
    expect(screen.getByText('Item 4 tường')).toBeInTheDocument();
    expect(screen.getByText('Item 3 tường')).toBeInTheDocument();
    
    // Group label because they all end with "tường" -> "Đã sửa 2 tường"
    expect(screen.getByText('Đã sửa 2 tường')).toBeInTheDocument();
    
    // Click undo on the group
    const undoButtons = screen.getAllByText('Hoàn tác');
    // undoButtons[2] is the group undo (since flex col-reverse renders them)
    fireEvent.click(undoButtons[2]!);

    // Now group should have 1 item, so it drops back to displaying it
    // Wait, the test adds them in order: 1, then 2, then 3, then 4.
    // Queue: [4, 3, 2, 1]
    // Slot 1: 4
    // Slot 2: 3
    // Group: [2, 1]
    // LIFO undo on group will pop 2.
    // Now queue is: [4, 3, 1]. Length is 3. Group should unwrap!
    // So we should see 4, 3, 1.
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByText('Item 1 tường')).toBeInTheDocument();
    expect(screen.queryByText('Đã sửa 2 tường')).not.toBeInTheDocument();
  });
});
