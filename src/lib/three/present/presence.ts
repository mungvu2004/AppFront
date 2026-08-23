/**
 * Whether anyone can see the canvas — the three gates the page decides.
 *
 * `frameLoop.ts` draws only while every gate is open, and it does not know
 * what a document or a viewport is. This is the piece that does: it watches
 * the page for the three ways a canvas stops being looked at and reports each
 * as a gate.
 *
 * - **visible** — the document is not hidden. A background tab draws nothing
 *   (the browser would throttle it anyway; stopping outright is cleaner).
 * - **onScreen** — the canvas intersects the viewport. A canvas scrolled away,
 *   or in a panel the layout has hidden, draws nothing.
 * - **focused** — the window has focus. A visitor who has gone to another
 *   window gets a still picture until they come back. The gate starts open and
 *   closes only on a `blur`, so a page that loads without focus still sways.
 *
 * Where the page has no `IntersectionObserver` the `onScreen` gate simply stays
 * open; the other two are plain events every browser has.
 */

import type { LoopGate } from './frameLoop';

/** Told each time a gate opens or closes; called once with the initial state of `visible`. */
export type PresenceReporter = (gate: Extract<LoopGate, 'visible' | 'onScreen' | 'focused'>, open: boolean) => void;

export interface PresenceHandle {
  readonly dispose: () => void;
}

/**
 * Watch `canvas` and the page around it, reporting through `report`.
 *
 * The initial visibility is reported at once; the intersection observer
 * reports on its first callback, which the browser makes soon after.
 */
export function watchPresence(canvas: HTMLCanvasElement, report: PresenceReporter): PresenceHandle {
  const documentOf = canvas.ownerDocument;
  const windowOf = documentOf.defaultView ?? globalThis;

  const onVisibility = (): void => {
    report('visible', documentOf.visibilityState !== 'hidden');
  };
  const onBlur = (): void => {
    report('focused', false);
  };
  const onFocus = (): void => {
    report('focused', true);
  };

  documentOf.addEventListener('visibilitychange', onVisibility);
  windowOf.addEventListener('blur', onBlur);
  windowOf.addEventListener('focus', onFocus);
  onVisibility();

  const Observer = (windowOf as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
  const observer =
    Observer === undefined
      ? null
      : new Observer((entries) => {
          const last = entries[entries.length - 1];
          if (last !== undefined) {
            report('onScreen', last.isIntersecting);
          }
        });
  observer?.observe(canvas);

  return {
    dispose: () => {
      documentOf.removeEventListener('visibilitychange', onVisibility);
      windowOf.removeEventListener('blur', onBlur);
      windowOf.removeEventListener('focus', onFocus);
      observer?.disconnect();
    },
  };
}
