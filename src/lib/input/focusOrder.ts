/**
 * The one route the keyboard takes through the product.
 *
 * Five regions, in reading order: top bar, toolbar, canvas, right panel,
 * status bar. The order is declared here once and read back by the shell
 * (landmark roles, `data-region` attributes) and by tests, so the route
 * cannot drift between screens. Because positive tab indexes are forbidden
 * — `findPositiveTabIndexes` is the audit for that — document order *is*
 * tab order, and this module never has to renumber anything.
 *
 * The skip link is part of the route: the first Tab on the page reaches
 * "bỏ qua tới nội dung chính", and Enter lands the focus on the canvas
 * without walking the two bars before it.
 *
 * Pure data plus small DOM helpers, no React (rule 0.4). The focus ring
 * itself is the components' business, drawn from the design tokens
 * (`focus-visible:ring-2` with offset 2) — never disabled, never restated
 * here.
 */

import { getFocusableElements } from './focusTrap';

/* -------------------------------------------------------------------------- */
/* The route.                                                                  */
/* -------------------------------------------------------------------------- */

export type FocusRegionId = 'topBar' | 'toolbar' | 'canvas' | 'rightPanel' | 'statusBar';

/** The traversal order, first region first. */
export const FOCUS_ORDER: readonly FocusRegionId[] = [
  'topBar',
  'toolbar',
  'canvas',
  'rightPanel',
  'statusBar',
];

/** The ARIA landmark each region announces itself as. */
export type LandmarkRole = 'banner' | 'toolbar' | 'main' | 'complementary' | 'contentinfo';

export interface FocusRegion {
  readonly id: FocusRegionId;
  /** The DOM id and `data-region` value the shell renders for this region. */
  readonly domId: string;
  /** Vietnamese name, lower case sentence style (invariant A6). */
  readonly label: string;
  readonly landmarkRole: LandmarkRole;
}

/** A complete record, so a sixth region fails the build here. */
export const FOCUS_REGIONS: Readonly<Record<FocusRegionId, FocusRegion>> = {
  topBar: {
    id: 'topBar',
    domId: 'top-bar',
    label: 'thanh trên cùng',
    landmarkRole: 'banner',
  },
  toolbar: {
    id: 'toolbar',
    domId: 'toolbar',
    label: 'thanh công cụ',
    landmarkRole: 'toolbar',
  },
  canvas: {
    id: 'canvas',
    domId: 'main-content',
    label: 'vùng bản vẽ',
    landmarkRole: 'main',
  },
  rightPanel: {
    id: 'rightPanel',
    domId: 'right-panel',
    label: 'bảng bên phải',
    landmarkRole: 'complementary',
  },
  statusBar: {
    id: 'statusBar',
    domId: 'status-bar',
    label: 'thanh trạng thái',
    landmarkRole: 'contentinfo',
  },
};

/** The skip link the first Tab press reaches. */
export const SKIP_LINK = {
  /** Vietnamese label, lower case sentence style. */
  label: 'bỏ qua tới nội dung chính',
  targetRegion: 'canvas' as FocusRegionId,
  targetDomId: FOCUS_REGIONS.canvas.domId,
} as const;

/* -------------------------------------------------------------------------- */
/* Walking the route.                                                          */
/* -------------------------------------------------------------------------- */

const indexOf = (region: FocusRegionId): number => FOCUS_ORDER.indexOf(region);

/** The region after this one, wrapping from the status bar to the top bar. */
export const nextRegion = (region: FocusRegionId): FocusRegionId =>
  FOCUS_ORDER[(indexOf(region) + 1) % FOCUS_ORDER.length] ?? region;

/** The region before this one, wrapping from the top bar to the status bar. */
export const previousRegion = (region: FocusRegionId): FocusRegionId =>
  FOCUS_ORDER[(indexOf(region) - 1 + FOCUS_ORDER.length) % FOCUS_ORDER.length] ?? region;

/** The region an element sits in, or null when it sits in none. */
export function regionOf(element: Element): FocusRegionId | null {
  const host = element.closest('[data-region]');

  if (host === null) {
    return null;
  }

  const value = host.getAttribute('data-region');

  return FOCUS_ORDER.find((region) => region === value) ?? null;
}

/**
 * Sends the focus into a region: its first focusable element, or the region
 * container itself when it has none (a collapsed panel still receives the
 * focus rather than losing it). Returns false when the region is not on the
 * page.
 */
export function focusRegion(region: FocusRegionId, root: ParentNode = document): boolean {
  const host = root.querySelector<HTMLElement>(`[data-region="${region}"]`);

  if (host === null) {
    return false;
  }

  const target = getFocusableElements(host)[0];

  if (target !== undefined) {
    target.focus();

    return true;
  }

  if (!host.hasAttribute('tabindex')) {
    host.tabIndex = -1;
  }

  host.focus();

  return true;
}

/* -------------------------------------------------------------------------- */
/* The audit.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every element with a positive tab index — the thing this codebase forbids,
 * because one `tabindex="3"` silently reroutes the whole route declared
 * above. Wire it into a dev-mode check or a test; an empty array is the
 * only passing answer.
 */
export function findPositiveTabIndexes(root: ParentNode = document): readonly Element[] {
  return Array.from(root.querySelectorAll('[tabindex]')).filter((element) => {
    const value = Number.parseInt(element.getAttribute('tabindex') ?? '', 10);

    return Number.isFinite(value) && value > 0;
  });
}
