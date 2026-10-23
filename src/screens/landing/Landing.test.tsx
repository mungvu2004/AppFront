/**
 * /welcome: hàm thuần của chữ, bản cuộn và bản tĩnh. Stage, nhà và timeline được
 * giả — bài này kiểm cấu trúc trang, không kiểm WebGL.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PUBLIC_ROUTE_PATTERNS, ROUTES } from '@/routes/paths';

import { EXPORT_FORMAT_IDS } from '@/screens/export/ExportPanel/types';

import { copyPhase, eyebrow, EXPORTS, labelsFor, STEPS } from './landing.copy';
import { scrimAt, stepAt, stepStartP } from './overlay';

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => reduced.value }));
vi.mock('@/lib/landing/timeline', () => ({
  TRACK_SCREENS: 30,
  SCENES: Array.from({ length: 9 }, (_, i) => ({ id: `s0${i + 1}`, start: i / 9, end: (i + 1) / 9, title: '' })),
  stateAt: () => ({ p: 0, exports: 0, labels: {}, scene: 0, camera: { position: [0, 20, 0] } }),
}));
vi.mock('@/lib/landing/stage', () => ({
  createStage: () => Promise.reject(new Error('NoWebGL2Error')),
}));
vi.mock('@/lib/landing/house', () => ({ LANDING_HOUSE: { checks: [], plan: { levels: [], walls: [], rooms: [] } }, planSvg: () => '<svg></svg>' }));
vi.mock('lenis', () => ({
  default: class {
    scroll = 0;
    isScrolling = false;
    on() {}
    off() {}
    raf() {}
    destroy() {}
    scrollTo() {}
  },
}));

const { LandingRoute } = await import('./Landing.container');

const renderRoute = () =>
  render(
    <MemoryRouter>
      <LandingRoute />
    </MemoryRouter>,
  );

afterEach(() => {
  reduced.value = false;
});

describe('copyPhase', () => {
  it('là 0 ngoài cảnh và 1 giữa cảnh', () => {
    expect(copyPhase(0.05, 0.1, 0.2).opacity).toBe(0);
    expect(copyPhase(0.25, 0.1, 0.2).opacity).toBe(0);
    expect(copyPhase(0.15, 0.1, 0.2)).toEqual({ opacity: 1, y: 0 });
  });

  it('dòng phụ vào sau dòng chính, và vào bằng cách trượt lên', () => {
    const head = copyPhase(0.11, 0.1, 0.2, 0);
    const sub = copyPhase(0.11, 0.1, 0.2, 0.12);
    expect(sub.opacity).toBeLessThan(head.opacity);
    expect(head.y).toBeGreaterThan(0);
  });

  it('cảnh cuối giữ nguyên thay vì rời đi', () => {
    expect(copyPhase(0.99, 0.9, 1, 0, true).opacity).toBe(1);
  });
});

describe('/welcome', () => {
  it('là đường công khai', () => {
    expect(PUBLIC_ROUTE_PATTERNS).toContain(ROUTES.welcome);
  });

  it('bản cuộn có tiêu đề, lối tắt tới phần bắt đầu và nút bắt đầu tới /login', () => {
    const { container } = renderRoute();

    expect(container.querySelector('h1')?.textContent).toBe('Bản vẽ biết trở thành ngôi nhà.');
    expect(container.querySelectorAll('h2').length).toBeGreaterThan(5);
    expect(screen.getAllByRole('link', { name: /Tới phần bắt đầu/ })).toHaveLength(1);
    // Nút bắt đầu ở cảnh đầu (h1) và ở cảnh cuối, cả hai tới /login; cái ở cảnh đầu đứng trước thanh bước theo Tab.
    const ctas = Array.from(container.querySelectorAll('a.landing-cta'));
    expect(ctas.map((a) => a.textContent)).toEqual(['Bắt đầu dự án →', 'Bắt đầu dự án →']);
    expect(ctas.map((a) => a.getAttribute('href'))).toEqual([ROUTES.login, ROUTES.login]);
    const rail = screen.getByRole('navigation', { name: 'Sáu bước' });
    expect(ctas[0]!.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe(ROUTES.login);
    expect(screen.getByRole('navigation', { name: 'Sáu bước' }).querySelectorAll('a')).toHaveLength(6);
    expect(container.querySelector('#bat-dau')?.getAttribute('href')).toBe(ROUTES.login);
    expect(container.querySelector('[data-mode="pinned"]')).not.toBeNull();
  });

  it('giảm chuyển động: bản tĩnh với đủ sáu bước và nút bắt đầu', () => {
    reduced.value = true;
    const { container } = renderRoute();

    expect(container.querySelector('[data-mode="static"]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bản vẽ biết trở thành ngôi nhà.');
    expect(container.querySelectorAll('.landing-steps li')).toHaveLength(6);
    expect(screen.getAllByRole('link', { name: /Bắt đầu dự án/ })).toHaveLength(2);
    expect(container.querySelector('#bat-dau')?.getAttribute('href')).toBe(ROUTES.login);
  });

  it('chuyển sang bản tĩnh khi không dựng được stage', async () => {
    const { container } = renderRoute();

    await vi.waitFor(() => expect(container.querySelector('[data-mode="static"]')).not.toBeNull());
  });
});

describe('định dạng xuất', () => {
  // Phần mở rộng thật của từng định dạng ở màn Xuất (useExportPanel.ts EXTENSION_LABEL).
  const EXT: Record<(typeof EXPORT_FORMAT_IDS)[number], string> = { glb: '.glb', pdf: '.pdf', image: '.png', 'spatial-json': '.json' };

  it('trang giới thiệu nêu đúng bốn định dạng màn Xuất có, không IFC', () => {
    expect(EXPORTS.map((e) => e.id).sort()).toEqual([...EXPORT_FORMAT_IDS].sort());
    EXPORTS.forEach((e) => expect(e.format).toBe(EXT[e.id]));
    const text = JSON.stringify([STEPS, EXPORTS]);
    expect(text).not.toMatch(/IFC|BIM/);
    // Mọi ".xxx" trong chữ của các bước và danh sách xuất là đúng bốn phần mở rộng thật.
    expect(new Set(text.match(/\.[a-z]{3,4}\b/g))).toEqual(new Set(Object.values(EXT)));
  });
});

describe('scrimAt', () => {
  const at = (h: number, scene: number, copy = 1) => scrimAt({ scene, camera: { position: [0, h, 0] } } as never, copy);
  it('đậm trong nhà, mất khi máy quay cao', () => {
    expect(at(1.4, 5)).toBeCloseTo(0.6);
    expect(at(1.4, 5, 0)).toBe(0);
    expect(at(12, 2)).toBeCloseTo(0.85);
    expect(at(2, 7)).toBeCloseTo(0.92);
    expect(at(12, 7)).toBe(0);
  });
});

describe('bước và nhãn', () => {
  const scenes = ['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09'].map((id, i) => ({ id, start: i / 9, end: (i + 1) / 9 }));

  it('dòng mắt đánh số theo sáu bước', () => {
    expect(eyebrow('s03')).toBe('Bước 02 / 06 — Nhận diện');
    expect(eyebrow('s07')).toBe('Bước 04 / 06 — Dựng 3D · Ba tầng');
  });

  it('bước 04 phủ ba cảnh và tiến độ chạy trong cả ba', () => {
    const mid = stepAt(4.5 / 9, scenes);
    expect(mid.step).toBe(3);
    expect(mid.t).toBeCloseTo(0.5 / 3);
    expect(stepAt(1, scenes).step).toBe(5);
    expect(stepStartP(1, scenes, 0.2)).toBeCloseTo(2.2 / 9);
    expect(stepStartP(0, scenes, 0.2)).toBe(0);
  });

  it('nhãn đọc từ dữ liệu: tên phòng, diện tích dấu phẩy, mục chưa đạt', () => {
    const house = {
      rooms: [{ roomId: 'A', name: 'Sảnh', statedAreaM2: 12.5 }],
      detections: [{ furnitureId: 'F9', label: 'Sofa', confidence: 0.9, labelled: true }],
      stair: { risers: 18 },
      checks: [
        { id: 'X1', label: 'Cửa WC ≥ 0,75 m', value: '0,70 m', pass: false, targetId: 'D', suggestion: 'Mở rộng' },
        { id: 'X2', label: 'Hành lang ≥ 1,2 m', value: '1,5 m', pass: true, targetId: 'R' },
      ],
    } as never;
    const labels = labelsFor(house);
    expect(labels.find((l) => l.id === 'room:A')?.meta).toBe('12,5 m²');
    expect(labels.find((l) => l.id === 'det:F9')?.meta).toBe('0,90');
    expect(labels.find((l) => l.id === 'stair')?.meta).toBe('18 bậc');
    expect(labels.find((l) => l.id === 'check:X1')).toMatchObject({ name: 'Cửa WC 0,70 m', rule: 'cần ≥ 0,75 m' });
    expect(labels.some((l) => l.id === 'check:X2')).toBe(false);
  });
});
