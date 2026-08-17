/**
 * The voice of the interface for a screen reader.
 *
 * A visual product announces itself with motion and colour; a screen reader
 * hears none of it, so state changes are spoken through two ARIA live
 * regions this module owns:
 *
 * - **polite** (`role="status"`): the queue. Autosave confirmations, counts,
 *   progress. Messages are spoken one at a time with a gap between them, so
 *   three quick saves read as three sentences instead of one garble.
 * - **assertive** (`role="alert"`): the interrupt. Errors and anything the
 *   user must hear now. Bypasses the queue and is written immediately.
 *
 * A message repeated back-to-back alternates an invisible trailing space,
 * because a live region only speaks when its text *changes* — without the
 * trick, the second "Đã lưu" would be silent.
 *
 * Messages are Vietnamese sentences, written by the caller; this module
 * carries them, it does not compose them. Pure DOM, no React (rule 0.4);
 * the regions are visually hidden but never `display: none`, which would
 * silence them.
 */

export type AnnouncementUrgency = 'polite' | 'assertive';

/**
 * The pause between two polite messages. Matches the shortest token on the
 * motion scale — long enough for a reader to treat the texts as separate
 * utterances, short enough that a queue of three does not lag the interface.
 */
export const ANNOUNCE_GAP_MS = 120;

export interface Announcer {
  /** Speaks a Vietnamese sentence. Default urgency is polite. */
  announce(message: string, urgency?: AnnouncementUrgency): void;
  /** Removes the live regions and drops anything still queued. */
  destroy(): void;
}

/** Visually hidden, still audible: everything except `display: none`. */
const hideVisually = (node: HTMLElement): void => {
  node.style.position = 'fixed';
  node.style.width = '1px';
  node.style.height = '1px';
  node.style.margin = '-1px';
  node.style.overflow = 'hidden';
  node.style.clipPath = 'inset(50%)';
  node.style.whiteSpace = 'nowrap';
};

const createRegion = (doc: Document, urgency: AnnouncementUrgency): HTMLElement => {
  const node = doc.createElement('div');

  node.setAttribute('aria-live', urgency);
  node.setAttribute('role', urgency === 'assertive' ? 'alert' : 'status');
  node.setAttribute('aria-atomic', 'true');
  node.dataset['announcer'] = urgency;
  hideVisually(node);
  doc.body.appendChild(node);

  return node;
};

export function createAnnouncer(doc: Document = document): Announcer {
  const politeRegion = createRegion(doc, 'polite');
  const assertiveRegion = createRegion(doc, 'assertive');

  const queue: string[] = [];
  let pumping = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const write = (region: HTMLElement, message: string): void => {
    // A live region speaks on *change*; a repeated message gets an
    // invisible trailing space so it changes and is spoken again.
    region.textContent =
      region.textContent === message ? message + String.fromCharCode(160) : message;
  };

  const pump = (): void => {
    const next = queue.shift();

    if (next === undefined) {
      pumping = false;
      timer = null;

      return;
    }

    pumping = true;
    write(politeRegion, next);
    timer = setTimeout(pump, ANNOUNCE_GAP_MS);
  };

  const announce = (message: string, urgency: AnnouncementUrgency = 'polite'): void => {
    if (destroyed) {
      return;
    }

    if (urgency === 'assertive') {
      write(assertiveRegion, message);

      return;
    }

    queue.push(message);

    if (!pumping) {
      pump();
    }
  };

  const destroy = (): void => {
    if (destroyed) {
      return;
    }

    destroyed = true;

    if (timer !== null) {
      clearTimeout(timer);
    }

    queue.length = 0;
    politeRegion.remove();
    assertiveRegion.remove();
  };

  return { announce, destroy };
}

/* -------------------------------------------------------------------------- */
/* The application instance.                                                   */
/* -------------------------------------------------------------------------- */

let appAnnouncer: Announcer | null = null;

/**
 * The one announcer the application shares, created on first use rather
 * than at import so loading this module stays free of DOM side effects —
 * a test that injects its own announcer never touches this one.
 */
export function getAppAnnouncer(): Announcer {
  if (appAnnouncer === null) {
    appAnnouncer = createAnnouncer();
  }

  return appAnnouncer;
}
