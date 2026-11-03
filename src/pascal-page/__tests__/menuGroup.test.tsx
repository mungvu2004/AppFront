/**
 * Menu thanh trên (`../menuGroup`): mở một menu đóng các menu khác, bấm ra ngoài đóng hết,
 * Esc đóng menu trong cùng và trả tiêu điểm về nút của nó.
 */
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { installMenuGroup } from '../menuGroup';

const menus = () => (
  <>
    <details data-appfront-menu="" data-testid="a">
      <summary>A</summary>
      <details data-appfront-menu="" data-testid="a-inner">
        <summary>A trong</summary>
      </details>
    </details>
    <details data-appfront-menu="" data-testid="b">
      <summary>B</summary>
    </details>
    <button type="button">ngoài</button>
  </>
);

describe('installMenuGroup', () => {
  let uninstall: () => void = () => {};
  afterEach(() => uninstall());

  const setup = () => {
    uninstall = installMenuGroup(document);
    const view = render(menus());
    const get = (id: string) => view.getByTestId(id) as HTMLDetailsElement;
    const open = (el: HTMLDetailsElement) => {
      el.open = true;
      // jsdom bắn `toggle` không đồng bộ; bắn tay cho chắc.
      el.dispatchEvent(new Event('toggle'));
    };
    return { get, open, view };
  };

  it('mở B đóng A; mở menu con giữ menu cha', () => {
    const { get, open } = setup();
    open(get('a'));
    open(get('a-inner'));
    expect(get('a').open).toBe(true);
    open(get('b'));
    expect(get('a').open).toBe(false);
    expect(get('a-inner').open).toBe(false);
    expect(get('b').open).toBe(true);
  });

  it('bấm ra ngoài đóng hết; bấm trong menu thì giữ', () => {
    const { get, open, view } = setup();
    open(get('b'));
    fireEvent.pointerDown(get('b').querySelector('summary')!);
    expect(get('b').open).toBe(true);
    fireEvent.pointerDown(view.getByRole('button', { name: 'ngoài' }));
    expect(get('b').open).toBe(false);
  });

  it('bấm trong menu Radix cổng ra body (mục Hiển thị của Xem) không đóng menu', () => {
    const { get, open } = setup();
    open(get('b'));
    const popper = document.createElement('div');
    popper.setAttribute('data-radix-popper-content-wrapper', '');
    const item = popper.appendChild(document.createElement('button'));
    document.body.append(popper);
    fireEvent.pointerDown(item);
    expect(get('b').open).toBe(true);
    popper.remove();
  });

  it('Esc đóng menu trong cùng trước, tiêu điểm về nút', () => {
    const { get, open } = setup();
    open(get('a'));
    open(get('a-inner'));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(get('a-inner').open).toBe(false);
    expect(get('a').open).toBe(true);
    expect(document.activeElement?.textContent).toBe('A trong');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(get('a').open).toBe(false);
  });
});
