/**
 * AppFront: the element the editor is mounted into. Pascal's stylesheet is scoped
 * to it (`.pascal-root`), so anything portalled must land inside it, not in
 * `document.body`, or it renders unstyled. `undefined` keeps Radix's body default.
 */
export function getPascalRoot(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined
  return document.querySelector<HTMLElement>('.pascal-root') ?? undefined
}
