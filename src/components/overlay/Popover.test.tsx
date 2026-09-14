import { useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Popover } from './Popover';
import { expectAccessible } from '../../lib/testing/expectAccessible';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** One real animation frame — the focus trap's `activate()` runs on the next one. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** A `DOMRect`-shaped object; jsdom returns all-zero rects otherwise. */
function mockRect(overrides: Partial<DOMRect>): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

/** Wired the way a real caller wires `Popover`: a trigger button owns `anchorRef`. */
function Harness() {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <button ref={anchorRef} type="button" onClick={() => setIsOpen((current) => !current)}>
        nút kích hoạt
      </button>
      <Popover isOpen={isOpen} onClose={() => setIsOpen(false)} anchorRef={anchorRef} aria-label="Bóng kiểm thử">
        <button type="button">nút bên trong</button>
      </Popover>
    </div>
  );
}

/**
 * Focuses the trigger, then clicks it — the real sequence a mouse click
 * produces, and the one `createFocusTrap.activate()` needs to capture the
 * trigger (rather than `document.body`) as the opener to return focus to.
 */
async function openViaTrigger(): Promise<void> {
  const trigger = screen.getByText('nút kích hoạt');

  act(() => {
    trigger.focus();
  });
  fireEvent.click(trigger);

  await act(async () => {
    await nextFrame();
  });
}

describe('Popover', () => {
  it('không dựng gì khi đóng, có role="dialog" cộng aria-label khi mở', async () => {
    render(<Harness />);

    expect(screen.queryByRole('dialog')).toBeNull();

    await openViaTrigger();

    expect(screen.getByRole('dialog', { name: 'Bóng kiểm thử' })).toBeInTheDocument();
  });

  it('Esc đóng bóng (A12)', async () => {
    render(<Harness />);
    await openViaTrigger();

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('bấm ra ngoài đóng bóng', async () => {
    render(<Harness />);
    await openViaTrigger();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('bấm lại chính phần tử kích hoạt không tự đóng — để nơi gọi tự quyết', async () => {
    render(<Harness />);
    await openViaTrigger();

    fireEvent.mouseDown(screen.getByText('nút kích hoạt'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('trả tiêu điểm về phần tử kích hoạt khi đóng', async () => {
    render(<Harness />);
    await openViaTrigger();

    expect(document.activeElement).toBe(screen.getByText('nút bên trong'));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(document.activeElement).toBe(screen.getByText('nút kích hoạt'));
  });

  it('đi qua expectAccessible (tự lo phần focus-ring của lớp role="dialog")', async () => {
    render(<Harness />);
    await openViaTrigger();

    // `Popover`'s panel carries `tabIndex={-1}` + `outline-none` như
    // `Modal.Root`/`Drawer.Root` — vòng lặp tiêu điểm dành cho các phần tử
    // BÊN TRONG, không phải cho chính lớp container. Cùng khuôn miễn trừ
    // `DangerZone.test.tsx` đã dùng cho `Modal.Root`.
    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
  });

  it('lật lên trên khi không đủ chỗ bên dưới', async () => {
    window.innerWidth = 1024;
    window.innerHeight = 600;

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ): DOMRect {
      if (this.getAttribute('role') === 'dialog') {
        return mockRect({ width: 320, height: 120 });
      }

      return mockRect({ top: 560, bottom: 590, left: 100, right: 200, width: 100, height: 30 });
    });

    render(<Harness />);
    await openViaTrigger();

    const panel = screen.getByRole('dialog');
    const top = Number.parseFloat(panel.style.top);

    expect(top).toBeLessThan(560);
  });

  it('lật căn phải khi không đủ chỗ bên phải', async () => {
    window.innerWidth = 800;
    window.innerHeight = 1000;

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ): DOMRect {
      if (this.getAttribute('role') === 'dialog') {
        return mockRect({ width: 320, height: 120 });
      }

      return mockRect({ top: 100, bottom: 130, left: 750, right: 790, width: 40, height: 30 });
    });

    render(<Harness />);
    await openViaTrigger();

    const panel = screen.getByRole('dialog');
    const left = Number.parseFloat(panel.style.left);

    expect(left + 320).toBeLessThanOrEqual(800);
  });
});
