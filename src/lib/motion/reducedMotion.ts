/**
 * Reading the operating system's "reduce motion" setting, without React.
 *
 * The preference is not a nicety. For a reader with a vestibular disorder a
 * panel that slides is not decoration, it is nausea; the setting is how they say
 * so, and every animated thing in the product is expected to ask. This module is
 * the only place the media query string is written, and `useReducedMotion` in
 * `src/hooks` is a five-line subscription on top of it.
 *
 * Everything here is defensive about its environment on purpose. It is imported
 * by a token module that a Storybook build, a Node test and a worker all pull
 * in, and none of those necessarily has `matchMedia`. **When the setting cannot
 * be read the answer is `false` — motion allowed.** The alternative, defaulting
 * to "reduced", would silently strip animation from every user whose browser
 * merely failed to answer, which is a worse failure than the one it prevents and
 * a much harder one to notice.
 */

/** The query. Written once, here. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Just enough of `window` to answer the question — the seam tests inject at. */
export interface MediaMatcher {
  matchMedia(query: string): MediaQueryList;
}

/** The caller's matcher, or the real one, or nothing at all. */
function resolveMatcher(matcher: MediaMatcher | undefined): MediaMatcher | null {
  if (matcher !== undefined) {
    return matcher;
  }

  return typeof globalThis !== 'undefined' && typeof globalThis.matchMedia === 'function'
    ? globalThis
    : null;
}

/** Has the reader asked their system for less motion? `false` when unknowable. */
export function prefersReducedMotion(matcher?: MediaMatcher): boolean {
  const resolved = resolveMatcher(matcher);

  if (resolved === null) {
    return false;
  }

  try {
    return resolved.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Call `listener` whenever the setting changes; returns the unsubscribe.
 *
 * The preference can be toggled while the application is open, and a reader who
 * turns it on mid-session should not have to reload to be believed.
 *
 * Two listener APIs are handled: `addEventListener`, and the deprecated
 * `addListener` that Safari before 14 is the last to require. The old pair is
 * still worth the four lines — on the browsers that need it, the alternative is
 * not a degraded experience but an ignored accessibility setting.
 */
export function subscribeReducedMotion(
  listener: (reduced: boolean) => void,
  matcher?: MediaMatcher,
): () => void {
  const resolved = resolveMatcher(matcher);

  if (resolved === null) {
    return () => undefined;
  }

  let query: MediaQueryList;
  try {
    query = resolved.matchMedia(REDUCED_MOTION_QUERY);
  } catch {
    return () => undefined;
  }

  const handleChange = (): void => listener(query.matches);

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handleChange);

    return () => query.removeEventListener('change', handleChange);
  }

  query.addListener(handleChange);

  return () => query.removeListener(handleChange);
}
