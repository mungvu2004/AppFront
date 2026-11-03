import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SceneMenu } from '../SceneMenu';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const renderMenu = () =>
  render(
    <>
      <SceneMenu>
        <details>
          <summary>Phong cách</summary>
          <ul aria-label="Danh sách phong cách" />
        </details>
        <details>
          <summary>Ánh sáng</summary>
        </details>
      </SceneMenu>
      <button type="button">Ngoài</button>
    </>,
  );

const menu = () => screen.getByText('Cảnh').closest('details') as HTMLDetailsElement;

describe('SceneMenu', () => {
  it('một nút "Cảnh" (icon + chữ) chứa các thẻ cảnh trong popover', () => {
    renderMenu();
    const summary = screen.getByText('Cảnh').closest('summary') as HTMLElement;
    expect(summary.getAttribute('aria-label')).toMatch(/^Cảnh/u);
    expect(summary.querySelector('svg')).not.toBeNull();
    const panel = screen.getByRole('group', { name: 'Tuỳ chỉnh cảnh', hidden: true });
    expect(panel.textContent).toContain('Phong cách');
    expect(panel.textContent).toContain('Ánh sáng');
    expect(menu().open).toBe(false);
  });

  it('bấm ra ngoài thì đóng, bấm bên trong thì giữ', () => {
    renderMenu();
    menu().open = true;
    fireEvent.pointerDown(screen.getByText('Phong cách'));
    expect(menu().open).toBe(true);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ngoài' }));
    expect(menu().open).toBe(false);
  });

  it('Esc đóng và trả focus về nút "Cảnh"', () => {
    renderMenu();
    menu().open = true;
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu().open).toBe(false);
    expect(document.activeElement).toBe(menu().querySelector('summary'));
  });

  it('main.tsx: bốn mục cảnh nằm trong SceneMenu, thẻ theo vật chọn đứng ngoài', () => {
    const src = read('../main.tsx');
    const inside = src.slice(src.indexOf('<SceneMenu>'), src.indexOf('</SceneMenu>'));
    expect(inside).toContain('<SceneStyleCard');
    expect(inside).toContain('<LightingCard'); // kèm QualityCard bên trong
    expect(inside).toContain('<BakeLightingCard');
    for (const card of ['<SwapModelCard', '<ModelCreditCard', '<ItemTrustCard']) {
      expect(inside).not.toContain(card);
      expect(src).toContain(card);
    }
  });
});
