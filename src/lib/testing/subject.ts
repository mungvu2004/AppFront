/**
 * What "the thing under test" means, and how to read it.
 *
 * {@link expectVietnamese} and {@link expectAccessible} are two different
 * questions asked of the same object: a rendered subtree. They both have to
 * accept it in either shape a caller has it in, both have to skip the parts of
 * it nobody can see, and both have to name an element in a way somebody can find
 * again. Written twice, those three would drift — and a failure message that
 * points at `div > button` in one checker and `DIV.px-2` in the other is a
 * failure message people stop trusting.
 *
 * So they live here once. Nothing in this module imports React or a test
 * framework; it is DOM reading, and it works on any element from any renderer.
 */

import type { ScreenRenderResult } from './expectSevenStates';

/**
 * What a checker can be pointed at.
 *
 * Either a container, or whatever a renderer handed back — which is the shape
 * `@testing-library/react`'s `render()` already returns, so a caller passes its
 * result straight through.
 */
export type TestSubject = HTMLElement | ScreenRenderResult;

/** How many ancestors a reported path shows before it gives up. */
const MAX_PATH_DEPTH = 4;

/** The element a checker was pointed at, whichever way it was handed over. */
export function containerOf(subject: TestSubject): HTMLElement {
  return subject instanceof HTMLElement ? subject : subject.container;
}

/**
 * Is this element hidden from the person using the screen?
 *
 * Covers hidden from everybody (`hidden`, `display: none`, `visibility:
 * hidden`) and hidden from assistive technology only (`aria-hidden`). Both
 * matter here: a string nobody reads is not a translation failure, and a control
 * marked `aria-hidden` is deliberately outside the accessibility tree rather
 * than missing from it.
 *
 * Only inline style is consulted, because jsdom resolves no stylesheet the
 * application actually ships — a Tailwind `hidden` class computes to nothing
 * there. Erring towards *visible* is the safe direction: it can only make a
 * check stricter.
 */
export function isHidden(element: Element): boolean {
  if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
    return true;
  }

  if (element instanceof HTMLElement) {
    return element.style.display === 'none' || element.style.visibility === 'hidden';
  }

  return false;
}

/** Is this element, or anything it sits inside, hidden? */
export function isHiddenWithin(element: Element, root: Element): boolean {
  let current: Element | null = element;

  while (current !== null) {
    if (isHidden(current)) {
      return true;
    }

    if (current === root) {
      return false;
    }

    current = current.parentElement;
  }

  return false;
}

/** One step of a path: the tag, plus whatever identifies it. */
function describeStep(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.getAttribute('id');

  if (id !== null && id !== '') {
    return `${tag}#${id}`;
  }

  const label = element.getAttribute('aria-label');

  return label !== null && label !== '' ? `${tag}[aria-label=${label}]` : tag;
}

/**
 * Where an element sits, as a path a person can follow: `div#root > ul > button`.
 *
 * Shortened from the top rather than the bottom — the last few steps are the
 * ones that identify the element, and the first few are the container everybody
 * already knows about.
 */
export function describeElement(element: Element, root: Element): string {
  const steps: string[] = [];
  let current: Element | null = element;

  while (current !== null) {
    steps.unshift(describeStep(current));

    if (current === root || steps.length >= MAX_PATH_DEPTH) {
      break;
    }

    current = current.parentElement;
  }

  return steps.join(' > ');
}
