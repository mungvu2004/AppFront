import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFocusTrap, getFocusableElements } from '../focusTrap';
import {
  findPositiveTabIndexes,
  FOCUS_ORDER,
  FOCUS_REGIONS,
  focusRegion,
  nextRegion,
  previousRegion,
  regionOf,
  SKIP_LINK,
} from '../focusOrder';
import { ANNOUNCE_GAP_MS, createAnnouncer } from '../announcer';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

interface DialogFixture {
  readonly opener: HTMLButtonElement;
  readonly dialog: HTMLDivElement;
  readonly first: HTMLButtonElement;
  readonly middle: HTMLInputElement;
  readonly last: HTMLButtonElement;
}

const buildDialog = (): DialogFixture => {
  const opener = document.createElement('button');
  opener.id = 'opener';
  document.body.appendChild(opener);

  const dialog = document.createElement('div');
  const first = document.createElement('button');
  first.id = 'first';
  const middle = document.createElement('input');
  middle.id = 'middle';
  const last = document.createElement('button');
  last.id = 'last';

  dialog.append(first, middle, last);
  document.body.appendChild(dialog);

  return { opener, dialog, first, middle, last };
};

const pressKey = (
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

  (document.activeElement ?? document.body).dispatchEvent(event);

  return event;
};

/* -------------------------------------------------------------------------- */
/* The trap.                                                                   */
/* -------------------------------------------------------------------------- */

describe('createFocusTrap', () => {
  it('moves the focus into the layer on activate', () => {
    const { opener, dialog, first } = buildDialog();

    opener.focus();
    createFocusTrap(dialog).activate();

    expect(document.activeElement).toBe(first);
  });

  it('prefers an explicit initial focus', () => {
    const { opener, dialog, middle } = buildDialog();

    opener.focus();
    createFocusTrap(dialog, { initialFocus: middle }).activate();

    expect(document.activeElement).toBe(middle);
  });

  it('wraps Tab from the last element back to the first', () => {
    const { dialog, first, last } = buildDialog();

    createFocusTrap(dialog).activate();
    last.focus();

    const event = pressKey('Tab');

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first element back to the last', () => {
    const { dialog, first, last } = buildDialog();

    createFocusTrap(dialog).activate();
    first.focus();

    const event = pressKey('Tab', { shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('never lets Tab leave the layer', () => {
    const { dialog } = buildDialog();

    createFocusTrap(dialog).activate();

    for (let press = 0; press < 10; press += 1) {
      pressKey('Tab', { shiftKey: press % 3 === 0 });

      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('keeps the focus on the container when the layer has nothing focusable', () => {
    const dialog = document.createElement('div');
    document.body.appendChild(dialog);

    createFocusTrap(dialog).activate();

    expect(document.activeElement).toBe(dialog);

    const event = pressKey('Tab');

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });

  it('drags an escaped focus back inside on the next Tab', () => {
    const { opener, dialog, first } = buildDialog();

    createFocusTrap(dialog).activate();
    opener.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialog.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('calls onEscape and stops the event before the window arbiter', () => {
    const { dialog, first } = buildDialog();
    const onEscape = vi.fn();
    const reachedBody = vi.fn();

    document.body.addEventListener('keydown', reachedBody);
    createFocusTrap(dialog, { onEscape }).activate();
    first.focus();

    pressKey('Escape');

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(reachedBody).not.toHaveBeenCalled();

    document.body.removeEventListener('keydown', reachedBody);
  });

  it('returns the focus to the opener on release', () => {
    const { opener, dialog } = buildDialog();

    opener.focus();

    const trap = createFocusTrap(dialog);

    trap.activate();
    trap.release();

    expect(document.activeElement).toBe(opener);
  });

  it('falls back to the given element when the opener has left the page', () => {
    const { opener, dialog } = buildDialog();
    const fallback = document.createElement('button');
    fallback.id = 'fallback';
    document.body.appendChild(fallback);

    opener.focus();

    const trap = createFocusTrap(dialog, { fallbackFocus: fallback });

    trap.activate();
    opener.remove();
    trap.release();

    expect(document.activeElement).toBe(fallback);
  });

  it('leaves the focus somewhere on the page even with no opener and no fallback', () => {
    const { opener, dialog } = buildDialog();

    opener.focus();

    const trap = createFocusTrap(dialog);

    trap.activate();
    opener.remove();
    trap.release();

    expect(document.activeElement).not.toBeNull();
    expect(document.activeElement).not.toBe(null);
    expect(document.activeElement === document.body || document.body.contains(document.activeElement)).toBe(
      true,
    );
  });

  it('activates and releases idempotently', () => {
    const { opener, dialog } = buildDialog();

    opener.focus();

    const trap = createFocusTrap(dialog);

    trap.activate();
    trap.activate();
    trap.release();
    trap.release();

    expect(document.activeElement).toBe(opener);
  });
});

describe('getFocusableElements', () => {
  it('skips disabled controls, negative tab indexes and hidden subtrees', () => {
    const host = document.createElement('div');
    host.innerHTML = [
      '<button id="visible">a</button>',
      '<button disabled>b</button>',
      '<div tabindex="-1">c</div>',
      '<div hidden><button>d</button></div>',
      '<div aria-hidden="true"><button>e</button></div>',
      '<input type="hidden" />',
    ].join('');
    document.body.appendChild(host);

    const ids = getFocusableElements(host).map((element) => element.id);

    expect(ids).toEqual(['visible']);
  });
});

/* -------------------------------------------------------------------------- */
/* The route.                                                                  */
/* -------------------------------------------------------------------------- */

describe('focusOrder', () => {
  const buildShell = (): void => {
    document.body.innerHTML = [
      '<header data-region="topBar"><button id="menu">m</button></header>',
      '<div data-region="toolbar"><button id="tool">t</button></div>',
      '<main data-region="canvas" id="main-content"></main>',
      '<aside data-region="rightPanel"><input id="field" /></aside>',
      '<footer data-region="statusBar"></footer>',
    ].join('');
  };

  it('declares the route in reading order', () => {
    expect(FOCUS_ORDER).toEqual(['topBar', 'toolbar', 'canvas', 'rightPanel', 'statusBar']);
  });

  it('wraps the region cycle in both directions', () => {
    expect(nextRegion('statusBar')).toBe('topBar');
    expect(nextRegion('topBar')).toBe('toolbar');
    expect(previousRegion('topBar')).toBe('statusBar');
    expect(previousRegion('canvas')).toBe('toolbar');
  });

  it('points the skip link at the main content region', () => {
    expect(SKIP_LINK.targetRegion).toBe('canvas');
    expect(SKIP_LINK.targetDomId).toBe(FOCUS_REGIONS.canvas.domId);
    expect(FOCUS_REGIONS.canvas.landmarkRole).toBe('main');
  });

  it('writes every label in lower case sentence style', () => {
    const labels = [...Object.values(FOCUS_REGIONS).map((region) => region.label), SKIP_LINK.label];

    for (const label of labels) {
      expect(label.charAt(0)).toBe(label.charAt(0).toLowerCase());
    }
  });

  it('finds the region an element sits in', () => {
    buildShell();

    expect(regionOf(document.getElementById('tool')!)).toBe('toolbar');
    expect(regionOf(document.body)).toBeNull();
  });

  it('focuses the first focusable element of a region', () => {
    buildShell();

    expect(focusRegion('rightPanel')).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('field'));
  });

  it('focuses the region container itself when it has no focusable children', () => {
    buildShell();

    expect(focusRegion('canvas')).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('main-content'));
  });

  it('reports a region missing from the page', () => {
    document.body.innerHTML = '';

    expect(focusRegion('toolbar')).toBe(false);
  });

  it('flags positive tab indexes and accepts zero and negative ones', () => {
    document.body.innerHTML = [
      '<button tabindex="1" id="bad">a</button>',
      '<button tabindex="0">b</button>',
      '<div tabindex="-1">c</div>',
    ].join('');

    const offenders = findPositiveTabIndexes();

    expect(offenders).toHaveLength(1);
    expect(offenders[0]!.id).toBe('bad');
  });
});

/* -------------------------------------------------------------------------- */
/* The announcer.                                                              */
/* -------------------------------------------------------------------------- */

describe('createAnnouncer', () => {
  const politeRegion = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-announcer="polite"]');
  const assertiveRegion = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-announcer="assertive"]');

  it('speaks a polite message through the status region', () => {
    const announcer = createAnnouncer();

    announcer.announce('Đã lưu lúc 14:32');

    expect(politeRegion()?.textContent).toBe('Đã lưu lúc 14:32');
    expect(politeRegion()?.getAttribute('role')).toBe('status');
    expect(politeRegion()?.getAttribute('aria-live')).toBe('polite');

    announcer.destroy();
  });

  it('queues polite messages one gap apart', () => {
    vi.useFakeTimers();

    const announcer = createAnnouncer();

    announcer.announce('Đã lưu lúc 14:32');
    announcer.announce('Đã duyệt 3 tường');

    expect(politeRegion()?.textContent).toBe('Đã lưu lúc 14:32');

    vi.advanceTimersByTime(ANNOUNCE_GAP_MS);

    expect(politeRegion()?.textContent).toBe('Đã duyệt 3 tường');

    announcer.destroy();
  });

  it('lets an assertive message jump the queue', () => {
    vi.useFakeTimers();

    const announcer = createAnnouncer();

    announcer.announce('Đã lưu lúc 14:32');
    announcer.announce('Mất kết nối máy chủ', 'assertive');

    expect(assertiveRegion()?.textContent).toBe('Mất kết nối máy chủ');
    expect(assertiveRegion()?.getAttribute('role')).toBe('alert');
    expect(politeRegion()?.textContent).toBe('Đã lưu lúc 14:32');

    announcer.destroy();
  });

  it('alters a repeated message so the reader speaks it again', () => {
    vi.useFakeTimers();

    const announcer = createAnnouncer();

    announcer.announce('Đã lưu');
    vi.advanceTimersByTime(ANNOUNCE_GAP_MS);
    announcer.announce('Đã lưu');

    expect(politeRegion()?.textContent).not.toBe('Đã lưu');
    expect(politeRegion()?.textContent?.startsWith('Đã lưu')).toBe(true);

    announcer.destroy();
  });

  it('keeps the regions audible but visually hidden', () => {
    const announcer = createAnnouncer();
    const region = politeRegion();

    expect(region?.style.display).not.toBe('none');
    expect(region?.style.width).toBe('1px');

    announcer.destroy();
  });

  it('removes both regions and stops speaking after destroy', () => {
    vi.useFakeTimers();

    const announcer = createAnnouncer();

    announcer.announce('Đã lưu lúc 14:32');
    announcer.destroy();

    expect(politeRegion()).toBeNull();
    expect(assertiveRegion()).toBeNull();

    announcer.announce('Đã duyệt 3 tường');

    expect(politeRegion()).toBeNull();
  });
});
