/** Unicode combining marks, left standing after NFD normalisation. */
const DIACRITICS = /\p{Diacritic}/gu

/**
 * Lower-cased, accent-stripped form used on BOTH sides of a search match.
 *
 * `"Hoàn tác"` → `"hoan tac"`. Vietnamese `đ`/`Đ` has no decomposition, so it
 * gets its own pass — after `toLowerCase`, which lets one rule cover both
 * cases. Without it, typing "hoan tac" finds nothing, and a search box that
 * cannot find what is on screen is a search box people stop using.
 *
 * AppFront has the same function at `src/lib/format/fold.ts`; this is a
 * deliberate second copy rather than an import. The editor package is loaded
 * into Pascal's own bundle with its own React, and the AppFront import gate
 * only opens for `src/components/pascal` — reaching across would breach both.
 */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase().replace(/đ/gu, 'd')
}

/**
 * cmdk's `filter` with accents folded away.
 *
 * Returns cmdk's own scale: 1 for a hit, 0 for a miss. The ranking stays
 * coarse on purpose — a prefix match sorts above a mid-string one, and that
 * is the whole ordering the palette needs.
 */
export function foldedCommandFilter(value: string, search: string, keywords?: string[]): number {
  const needle = foldForSearch(search.trim())
  if (needle === '') return 1

  const haystacks = [value, ...(keywords ?? [])].map(foldForSearch)
  let best = 0
  for (const haystack of haystacks) {
    if (haystack.startsWith(needle)) return 1
    if (haystack.includes(needle)) best = Math.max(best, 0.5)
  }
  return best
}
