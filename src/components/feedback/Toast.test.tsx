import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Toast, useToast } from './Toast';
import { Button } from '../ui/Button';
import { createUndoTicket } from '../../lib/mutations/undoTicket';

// Mock requestAnimationFrame for predictable timers
const originalRaf = global.requestAnimationFrame;
const originalCaf = global.cancelAnimationFrame;

describe('Toast.Provider and Toast.Item', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The frame time is the (faked) clock, as in a browser: a shared counter bumped once per callback ran
    // three animating toasts three times too fast.
    global.requestAnimationFrame = vi.fn((cb) => {
      return setTimeout(() => {
        cb(Date.now());
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

  // BUG-207: a toast without a state fell back to the verified green, so error toasts wore A5's colour.
  it.each([
    [undefined, 'bg-text-muted'],
    ['verified', 'bg-state-verified'],
    ['attention', 'bg-state-attention'],
    ['violation', 'bg-state-violation'],
  ] as const)('dot for state %s is %s — green only when asked for', (state, dotClass) => {
    const { container } = render(
      <Toast.Item toast={{ id: 't', message: 'Thông báo', ...(state ? { state } : {}) }} index={0} onRemove={vi.fn()} />,
    );

    const dot = container.querySelector('[aria-hidden="true"].rounded-full');
    expect(dot?.className).toContain(dotClass);
    if (state !== 'verified') expect(dot?.className).not.toContain('bg-state-verified');
  });

  // BUG-229: an 80-char name ran to 5 lines with the dot in the middle of the block.
  it('caps a long message at three lines and hangs the dot beside its first line', () => {
    const message = `Đã đổi tên thành "${'KhuPhucHopBinhMinh'.repeat(4)}"`;
    render(<Toast.Item toast={{ id: 't', message, onUndo: vi.fn() }} index={0} onRemove={vi.fn()} />);

    const text = screen.getByText(message);
    expect(text.className).toContain('line-clamp-3');
    expect(text.querySelector('[aria-hidden="true"].rounded-full')?.className).toContain('top-2');
  });

  it('bấm "Hoàn tác" thì toast rời đi, kể cả khi chuột còn nằm trên nó (B-V4-11)', () => {
    const onUndo = vi.fn();
    const UndoComponent = () => {
      const { addToast } = useToast();
      return <Button onClick={() => addToast({ message: 'Đã xoá', onUndo })}>Add</Button>;
    };

    render(
      <Toast.Provider>
        <UndoComponent />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const undo = screen.getByRole('button', { name: 'Hoàn tác' });
    // Chuột đi vào toast để bấm — đồng hồ 8 giây dừng vì đang di chuột lên.
    fireEvent.mouseEnter(undo);
    fireEvent.click(undo);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Đã xoá')).not.toBeInTheDocument();
  });

  // BUG-571 (WCAG 2.2.1): a person reading or reaching for "Hoàn tác" keeps it. BUG-524 stands: the toast
  // never offers an undo its ticket would refuse — the hold stops the ticket's clock too (`holdUndoWindows`).
  describe('an undo toast that is hovered or focused', () => {
    const TicketToast = ({ undo }: { undo: () => void }) => {
      const { addToast } = useToast();
      return (
        <Button
          onClick={() => {
            const ticket = createUndoTicket({ description: 'Hoàn tác xoá tệp', undo });
            addToast({ message: 'Đã xoá tệp', onUndo: () => void ticket.undo() });
          }}
        >
          Undo toast
        </Button>
      );
    };

    const toastOf = (text: string) => screen.getByText(text).closest('[role="status"]')!;

    it('hovered: stays past 8 s and its "Hoàn tác" still undoes', () => {
      const undo = vi.fn();
      render(
        <Toast.Provider>
          <TicketToast undo={undo} />
        </Toast.Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Undo toast' }));
      fireEvent.mouseEnter(toastOf('Đã xoá tệp'));
      act(() => {
        vi.advanceTimersByTime(9000);
      });

      expect(screen.getByText('Đã xoá tệp')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
      expect(undo).toHaveBeenCalledTimes(1);
    });

    it('focused from the keyboard: stays past 8 s and its "Hoàn tác" still undoes', () => {
      const undo = vi.fn();
      render(
        <Toast.Provider>
          <TicketToast undo={undo} />
        </Toast.Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Undo toast' }));
      fireEvent.focus(screen.getByRole('button', { name: 'Hoàn tác' }));
      act(() => {
        vi.advanceTimersByTime(9000);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
      expect(undo).toHaveBeenCalledTimes(1);
    });

    it('let go: the rest of the window runs out and the toast leaves with its "Hoàn tác"', () => {
      render(
        <Toast.Provider>
          <TicketToast undo={vi.fn()} />
        </Toast.Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Undo toast' }));
      fireEvent.mouseEnter(toastOf('Đã xoá tệp'));
      act(() => {
        vi.advanceTimersByTime(9000);
      });
      fireEvent.mouseLeave(toastOf('Đã xoá tệp'));
      act(() => {
        vi.advanceTimersByTime(9000);
      });

      expect(screen.queryByText('Đã xoá tệp')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Hoàn tác' })).not.toBeInTheDocument();
    });
  });

  it('a plain notice is held by hover too', () => {
    const Plain = () => {
      const { addToast } = useToast();
      return <Button onClick={() => addToast({ message: 'Thông báo thường' })}>Plain toast</Button>;
    };

    render(
      <Toast.Provider>
        <Plain />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Plain toast' }));
    fireEvent.mouseEnter(screen.getByText('Thông báo thường').closest('[role="status"]')!);
    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByText('Thông báo thường')).toBeInTheDocument();
  });

  // next-batch QA-03e: the summary slot opened a fresh 8 s on every new toast while the change it undoes was
  // older, so "Hoàn tác" there could press an expired ticket and do nothing. A slot's window is its change's.
  it('the summary slot and a slot that comes back from it never outlive the change they undo', () => {
    const tickets: Array<ReturnType<typeof createUndoTicket>> = [];
    const Many = () => {
      const { addToast } = useToast();
      const add = (n: number) => {
        const ticket = createUndoTicket({ description: `Hoàn tác ${String(n)}`, undo: vi.fn() });
        tickets[n] = ticket;
        addToast({ message: `Item ${String(n)} tường`, onUndo: () => void ticket.undo() });
      };
      return (
        <>
          <Button onClick={() => [1, 2, 3, 4].forEach(add)}>Four</Button>
          <Button onClick={() => add(5)}>Fifth</Button>
        </>
      );
    };

    render(
      <Toast.Provider>
        <Many />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fifth' }));
    expect(screen.getByText('Đã sửa 3 tường')).toBeInTheDocument();

    // In steps, so each removal renders before the next frame — as it does in a browser.
    for (let step = 0; step < 40; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    // t = 9 s: tickets 1–4 (t = 0) are spent; only change 5 can still be taken back.
    expect(tickets[3]?.getStatus()).toBe('expired');
    expect(screen.getByText('Item 5 tường')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Hoàn tác' })).toHaveLength(1);
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
    // A5: the grouped toast is a plain notice, not the reviewer's verified green (review-1 #15).
    expect(document.querySelector('.bg-state-verified')).toBeNull();
    
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

  it('bấm "Hoàn tác" chạy lượt hoàn tác đúng một lần rồi toast rời đi (B-V12b-06)', () => {
    const onUndo = vi.fn();
    const Single = () => {
      const { addToast } = useToast();
      return <Button onClick={() => addToast({ message: 'Đã vô hiệu hoá tài khoản', onUndo })}>Add</Button>;
    };

    render(
      <Toast.Provider>
        <Single />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Đã vô hiệu hoá tài khoản')).not.toBeInTheDocument();
  });

  it('bấm đúp "Hoàn tác" chỉ chạy lượt hoàn tác một lần (TOAST-DOUBLE-UNDO)', () => {
    const onUndo = vi.fn();
    const Single = () => {
      const { addToast } = useToast();
      return <Button onClick={() => addToast({ message: 'Đã xoá tường', onUndo })}>Add</Button>;
    };

    render(
      <Toast.Provider>
        <Single />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const undo = screen.getByRole('button', { name: 'Hoàn tác' });
    fireEvent.click(undo);
    fireEvent.click(undo);

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('toast xếp sau mở rộng khi chuột vào hoặc tiêu điểm tới, để bấm được "Hoàn tác" (TOAST-PEEK)', () => {
    const Two = () => {
      const { addToast } = useToast();
      return (
        <Button
          onClick={() => {
            addToast({ message: 'Đã xoá tường A', onUndo: vi.fn() });
            addToast({ message: 'Đã xoá tường B', onUndo: vi.fn() });
          }}
        >
          Add
        </Button>
      );
    };

    render(
      <Toast.Provider>
        <Two />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const peek = screen.getByText('Đã xoá tường A').closest('[role="status"]') as HTMLElement;
    expect(peek.style.height).toBe('4px');
    fireEvent.mouseEnter(peek);
    expect(peek.style.height).toBe('auto');
    fireEvent.mouseLeave(peek);
    expect(peek.style.height).toBe('4px');
    fireEvent.focus(within(peek).getByRole('button', { name: 'Hoàn tác' }));
    expect(peek.style.height).toBe('auto');
  });
});

// BUG-227 follow-up: a screen's own Toast.Provider (AccountSettings, ModelLibrary, VersionHistory…) sat in the
// bottom-right corner over an open drawer's footer. The viewport now steps aside like NotificationHost's.
describe('Toast.Provider viewport', () => {
  it('steps aside from an open drawer: left of a side panel, to the top over a sheet', () => {
    render(<Toast.Provider><span /></Toast.Provider>);

    const region = screen.getByRole('region', { name: 'Thông báo' });
    expect(region).toHaveClass(
      'bottom-4',
      'right-4',
      '[html[data-drawer=side]_&]:right-[calc(1rem+var(--drawer-inset))]',
      '[html[data-drawer=sheet]_&]:bottom-auto',
      '[html[data-drawer=sheet]_&]:top-4',
    );
  });

  // 29-F-010: a viewport-pinned sticky footer (RuleSettings, ExportPanel) sat under the toast.
  it('stands above a sticky footer from 640 px up, except over a sheet', () => {
    render(<Toast.Provider><span /></Toast.Provider>);

    expect(screen.getByRole('region', { name: 'Thông báo' })).toHaveClass(
      'sm:[html:has([data-sticky-footer]):not([data-drawer=sheet])_&]:bottom-24',
    );
  });

  // BUG-512: at 375 px the bottom-right toast covered the "Ghi chú" field being typed in.
  it('moves to the top edge below 640 px', () => {
    render(<Toast.Provider><span /></Toast.Provider>);

    expect(screen.getByRole('region', { name: 'Thông báo' })).toHaveClass('max-sm:bottom-auto', 'max-sm:top-4');
  });

  // BUG-605: a refusal toast carries a way out.
  it('renders an action button and calls its handler', () => {
    const onClick = vi.fn();
    render(
      <Toast.Provider>
        <Button onClick={() => undefined}>x</Button>
        <Toast.Item index={0} onRemove={() => undefined} toast={{ id: 't', message: 'Chưa gộp được', action: { label: 'Sang lớp tường', onClick } }} />
      </Toast.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sang lớp tường' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
