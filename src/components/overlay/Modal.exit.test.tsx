import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';

// jsdom drops an exiting node at once, so the exit animation cannot be watched.
// Replace the motion door with plain divs that expose the variant they exit to.
vi.mock('../motion', async () => {
  const React = await import('react');
  const make = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(function Fake(props, ref) {
      const { variants, exit, initial, animate, transition, ...rest } = props as {
        variants?: Record<string, { pointerEvents?: string }>;
        exit?: string;
        [k: string]: unknown;
      };
      void initial; void animate; void transition;
      return React.createElement(tag, {
        ...rest,
        ref,
        'data-exit-pointer-events': variants?.[exit ?? '']?.pointerEvents ?? 'unset',
      });
    });
  return { motion: { div: make('div') }, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

afterEach(cleanup);

describe('Modal.Root exit state', () => {
  // BUG-P06 (32-C-040): the fading-out veil/panel kept pointer-events:auto, so a toast button behind it
  // (restore -> "Hoàn tác") was not clickable until the exit animation ended.
  it('exits to pointer-events:none for both the veil and the panel', () => {
    render(
      <Modal.Root isOpen onClose={() => undefined} titleId="t">
        <Modal.Header>
          <span id="t">tiêu đề</span>
        </Modal.Header>
      </Modal.Root>,
    );
    const veil = document.querySelector('[aria-hidden="true"].bg-bg-overlay') as HTMLElement;
    expect(veil.dataset.exitPointerEvents).toBe('none');
    expect(screen.getByRole('dialog').dataset.exitPointerEvents).toBe('none');
  });
});
