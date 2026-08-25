import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Modal } from './Modal';

afterEach(() => {
  cleanup();
});

/** One real animation frame — the focus trap's `activate()` runs on the next one. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * A screen wired the way every real caller wires `Modal.Root`: `onClose`
 * reads current state (here, `tick`) and is therefore a fresh closure on
 * every render — never `useCallback`-wrapped. That shape is what the bug
 * this file guards against depended on.
 */
function Harness({ tick }: { readonly tick: number }) {
  const onClose = (): void => {
    // Reads `tick` — the point being that this closure is not memoized.
    void tick;
  };

  return (
    <Modal.Root isOpen onClose={onClose} titleId="modal-test-title">
      <Modal.Header>
        <span id="modal-test-title">tiêu đề</span>
      </Modal.Header>
      <Modal.Body>
        <input aria-label="trường nhập" />
      </Modal.Body>
    </Modal.Root>
  );
}

describe('Modal.Root', () => {
  /**
   * The regression this guards: the focus-trap effect used to depend on
   * `onClose`. Every real caller passes a handler that reads current
   * component state — `CreateProjectModal`'s `requestClose` reads `isDirty`,
   * `isSelectOpen` — so it is a new closure every render, never memoized.
   * With `onClose` in the dependency array, each keystroke re-ran the
   * effect, which re-activated the focus trap, and `activate()`
   * (`src/lib/input/focusTrap.ts`) always moves focus to the first focusable
   * element in the dialog — the header's close button, here — stealing it
   * away from whatever field the person was typing into.
   */
  it('keeps focus on a field inside it across renders that give onClose a new reference', async () => {
    const { rerender } = render(<Harness tick={0} />);

    // Let the trap's initial `activate()` run and settle before this test's
    // own assertions start, so the baseline is deterministic rather than
    // racing the first frame.
    await act(async () => {
      await nextFrame();
    });

    const field = screen.getByLabelText('trường nhập');
    field.focus();
    expect(document.activeElement).toBe(field);

    // Five re-renders, each with a brand-new `onClose` closure (`Harness`
    // never memoizes it) — the exact shape a person typing five characters
    // into a real form produces.
    for (let tick = 1; tick <= 5; tick += 1) {
      // Each tick fully settles (render, then the trap's
      // `requestAnimationFrame`) before the next one starts, the same as five
      // separate keystrokes arriving one at a time. Two separate flushes,
      // deliberately not one: the first lets React
      // commit the render and run the effect's cleanup + re-subscribe
      // synchronously; only once that has genuinely happened does awaiting a
      // frame let the newly (re)scheduled `requestAnimationFrame` actually
      // fire. Collapsing them into one `act()` risks the awaited frame
      // resolving before the effect re-run it is meant to observe.
      act(() => {
        rerender(<Harness tick={tick} />);
      });
      await act(async () => {
        await nextFrame();
      });

      expect(document.activeElement).toBe(field);
    }
  });
});
