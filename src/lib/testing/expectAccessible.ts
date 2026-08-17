/**
 * One assertion that a screen can be used without a mouse and without perfect eyes.
 *
 * Invariants A12 and A13 are the two nobody argues with and everybody forgets:
 * the keyboard has to reach everything, the focus ring has to be visible, and
 * text has to stand off its background. Forty-seven screens are coming, so the
 * three checks live here once.
 *
 * ## What it refuses
 *
 * - **A control nobody can hear.** Every interactive element gets an accessible
 *   name computed roughly the way a screen reader computes one —
 *   `aria-labelledby`, then `aria-label`, then a bound `<label>`, then its own
 *   text, then `title`, then a placeholder. An icon-only button with none of
 *   those is a button a blind user cannot identify, and it is the single most
 *   common accessibility bug in a toolbar. `<img>` with no `alt` attribute at
 *   all is refused separately: decorative images are written `alt=""`, and the
 *   difference between "decorative" and "somebody forgot" is exactly that
 *   attribute.
 * - **A tab order somebody arranged by hand.** `tabindex` above zero moves an
 *   element to the front of the whole document's tab order, which reorders every
 *   other screen it appears on. `tabindex="-1"` on a real control takes it out
 *   of the keyboard's reach entirely — legitimate for a roving-focus list item,
 *   which is why `data-roving-focus` opts out, and a bug everywhere else.
 * - **A focus ring that was switched off.** `outline-none` with no ring class
 *   next to it is the classic: the designer disliked the browser's outline, the
 *   replacement never arrived, and keyboard users lost the cursor. A ring
 *   without `ring-offset-2` is refused too, because A12 says 2px offset 2px and
 *   a ring flush against a dark control is not visible.
 * - **Text that does not stand off its background.** 4,5:1 for body text and
 *   3:1 for a caption, per A13, using the WCAG relative-luminance formula, with
 *   translucent layers composited the way a browser composites them.
 *
 * ## An honest word about contrast under jsdom
 *
 * jsdom loads no stylesheet, so a Tailwind class resolves to nothing there and
 * most colours on a real screen are simply **unknowable** to this function. It
 * does not guess and it does not quietly pass: every text run whose colours
 * cannot be resolved is counted as *skipped*, the count comes back in
 * {@link AccessibilityReport}, and `requireResolvedContrast` turns a run of zero
 * resolved pairs into a failure — so a test that thinks it is checking contrast
 * cannot be checking nothing. Where colours *are* resolvable — inline styles,
 * a `var(--token)` this module can trace, values handed in through
 * {@link AccessibilityOptions.variables} — the ratio is real and the failure is
 * exact. Full-page contrast belongs to the Playwright visual pass, and always
 * did.
 *
 * Nothing here imports React or a test framework: the input is an element and
 * the failure is a thrown `Error` naming each element and what is wrong with it.
 */

import { containerOf, describeElement, isHiddenWithin, type TestSubject } from './subject';

/** Which rule an element broke. */
export type AccessibilityIssueKind =
  /** An interactive element with no accessible name. */
  | 'missing-name'
  /** An image with no `alt` attribute at all. */
  | 'missing-alt'
  /** A hand-arranged tab order. */
  | 'tab-order'
  /** A control the keyboard cannot reach. */
  | 'unreachable'
  /** A focus ring switched off, or missing its offset. */
  | 'focus-ring'
  /** Text that does not stand off its background. */
  | 'contrast';

/** One element, and what is wrong with it. */
export interface AccessibilityIssue {
  readonly kind: AccessibilityIssueKind;
  /** Where it sits, as a short path: `div#root > button`. */
  readonly element: string;
  /** Vietnamese explanation, ready to print. */
  readonly reason: string;
  /** Measurements or a snippet, when there are any. */
  readonly detail: string | null;
}

/** What one pass over a screen found, including what it could not look at. */
export interface AccessibilityReport {
  readonly issues: readonly AccessibilityIssue[];
  /** Text runs whose foreground and background both resolved to a colour. */
  readonly contrastChecked: number;
  /** Text runs whose colours jsdom could not resolve, and which were skipped. */
  readonly contrastSkipped: number;
}

export interface AccessibilityOptions {
  /** Elements to skip entirely, as a CSS selector. */
  readonly ignoreSelector?: string;
  /** Smallest acceptable ratio for body text. Defaults to 4,5 (A13). */
  readonly minTextContrast?: number;
  /** Smallest acceptable ratio for a caption. Defaults to 3 (A13). */
  readonly minCaptionContrast?: number;
  /** What counts as a caption. Defaults to {@link CAPTION_SELECTOR}. */
  readonly captionSelector?: string;
  /**
   * Design-token values, by custom-property name — `{ '--text-primary': … }`.
   *
   * The way to make contrast checkable under jsdom: hand in the tokens a screen
   * uses and every `var(--text-primary)` becomes a real colour.
   */
  readonly variables?: Readonly<Record<string, string>>;
  /**
   * Fail when not one text run had resolvable colours.
   *
   * For a test that means to check contrast rather than to hope. Off by default,
   * because a loading skeleton legitimately has no text at all.
   */
  readonly requireResolvedContrast?: boolean;
}

/** Prefix on every failure, so a report says which check refused. */
const FAILURE_PREFIX = 'expectAccessible';

/** Elements a person can operate, natively or by role. */
const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role=button]',
  '[role=link]',
  '[role=checkbox]',
  '[role=radio]',
  '[role=switch]',
  '[role=tab]',
  '[role=menuitem]',
  '[role=menuitemcheckbox]',
  '[role=menuitemradio]',
  '[role=option]',
  '[role=slider]',
  '[role=spinbutton]',
  '[role=combobox]',
  '[role=searchbox]',
  '[role=textbox]',
].join(', ');

/** Elements the tab key visits, which is the interactive ones plus anything asking to be. */
const FOCUSABLE_SELECTOR = `${INTERACTIVE_SELECTOR}, [tabindex]`;

/** Roles that take their name from the text inside them. */
const NAME_FROM_CONTENT = new Set([
  'button',
  'link',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'checkbox',
  'radio',
  'switch',
]);

/** Tags that take their name from the text inside them. */
const NAME_FROM_CONTENT_TAGS = new Set(['a', 'button', 'summary']);

/** Inputs whose `value` is the label printed on them. */
const VALUE_INPUT_TYPES = new Set(['submit', 'reset', 'button']);

/** What a caption is, when the caller has not said otherwise. */
export const CAPTION_SELECTOR = 'figcaption, caption, small, [data-caption]';

/** A control that opts out of the tab order on purpose — a roving-focus list item. */
const ROVING_FOCUS_ATTRIBUTE = 'data-roving-focus';

/** Text contrast floor, invariant A13. */
const MIN_TEXT_CONTRAST = 4.5;

/** Caption contrast floor, invariant A13. */
const MIN_CAPTION_CONTRAST = 3;

/* -------------------------------------------------------------------------- */
/* Colour.                                                                     */
/* -------------------------------------------------------------------------- */

/** A colour, with its alpha kept so translucent layers can be composited. */
export interface Rgba {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  /** 0 fully transparent, 1 fully opaque. */
  readonly alpha: number;
}

/** A colour written as a function, whatever the function is called. */
const COLOR_FUNCTION = /^([a-z]+)\(([^()]*)\)$/i;

/** A colour written as hex digits. */
const HEX_COLOR = /^#([0-9a-f]+)$/i;

/** A reference to a custom property, with its fallback. */
const VARIABLE_REFERENCE = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/;

/** How many `var()` hops are followed before the chain is called circular. */
const MAX_VARIABLE_DEPTH = 8;

/** Largest value a colour channel takes. */
const CHANNEL_MAX = 255;

/** How many hex digits each notation uses. */
const HEX_LENGTHS = new Set([3, 4, 6, 8]);

/** A number, or `null` if the text was not one. */
function toNumber(text: string): number | null {
  const value = Number.parseFloat(text);

  return Number.isFinite(value) ? value : null;
}

/** One channel of a functional colour, percentages resolved against a full scale. */
function channelOf(text: string, scale: number): number | null {
  const trimmed = text.trim();

  if (trimmed === '') {
    return null;
  }

  const value = toNumber(trimmed);

  if (value === null) {
    return null;
  }

  return trimmed.endsWith('%') ? (value / 100) * scale : value;
}

/** Hue, saturation and lightness turned into channels the same way a browser does. */
function fromHsl(hue: number, saturation: number, lightness: number): Omit<Rgba, 'alpha'> {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = lightness - chroma / 2;

  const points: readonly (readonly [number, number, number])[] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ];

  const point = points[Math.min(Math.floor(sector), points.length - 1)] ?? [0, 0, 0];

  return {
    red: (point[0] + base) * CHANNEL_MAX,
    green: (point[1] + base) * CHANNEL_MAX,
    blue: (point[2] + base) * CHANNEL_MAX,
  };
}

/** Hex digits, in any of the four lengths CSS allows. */
function fromHex(digits: string): Rgba | null {
  if (!HEX_LENGTHS.has(digits.length)) {
    return null;
  }

  const short = digits.length < 6;
  const size = short ? 1 : 2;
  const at = (index: number): number => {
    const slice = digits.slice(index * size, index * size + size);
    const value = Number.parseInt(short ? slice + slice : slice, 16);

    return Number.isNaN(value) ? 0 : value;
  };

  const hasAlpha = digits.length === 4 || digits.length === 8;

  return {
    red: at(0),
    green: at(1),
    blue: at(2),
    alpha: hasAlpha ? at(3) / CHANNEL_MAX : 1,
  };
}

/**
 * A CSS colour, or `null` when this module cannot say what colour it is.
 *
 * Handles hex, the two functional notations and `transparent`. A bare keyword —
 * `canvastext`, which is what jsdom reports for an unstyled body — is honestly
 * unknown and comes back `null` rather than as a guess; jsdom normalises every
 * named colour it *does* resolve into functional notation before this sees it.
 */
export function parseColor(value: string): Rgba | null {
  const text = value.trim();

  if (text === 'transparent') {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }

  if (text === '') {
    return null;
  }

  const hex = HEX_COLOR.exec(text);

  if (hex !== null) {
    return fromHex(hex[1] ?? '');
  }

  const call = COLOR_FUNCTION.exec(text);

  if (call === null) {
    return null;
  }

  const name = (call[1] ?? '').toLowerCase();
  const parts = (call[2] ?? '').split(/[\s,/]+/).filter((part) => part !== '');
  const alphaText = parts[3];
  const alpha = alphaText === undefined ? 1 : channelOf(alphaText, 1);

  if (alpha === null) {
    return null;
  }

  if (name === 'rgb' || name === 'rgba') {
    const red = channelOf(parts[0] ?? '', CHANNEL_MAX);
    const green = channelOf(parts[1] ?? '', CHANNEL_MAX);
    const blue = channelOf(parts[2] ?? '', CHANNEL_MAX);

    if (red === null || green === null || blue === null) {
      return null;
    }

    return { red, green, blue, alpha };
  }

  if (name === 'hsl' || name === 'hsla') {
    const hue = channelOf(parts[0] ?? '', 1);
    const saturation = channelOf(parts[1] ?? '', 1);
    const lightness = channelOf(parts[2] ?? '', 1);

    if (hue === null || saturation === null || lightness === null) {
      return null;
    }

    return { ...fromHsl(hue, saturation / 100, lightness / 100), alpha };
  }

  return null;
}

/** The value of a custom property, looked for where jsdom actually keeps it. */
function lookupVariable(element: Element, name: string, root: Element): string | null {
  let current: Element | null = element;

  while (current !== null) {
    const inline = current instanceof HTMLElement ? current.style.getPropertyValue(name) : '';
    const computed = window.getComputedStyle(current).getPropertyValue(name);
    const value = inline.trim() !== '' ? inline : computed;

    if (value.trim() !== '') {
      return value.trim();
    }

    if (current === root) {
      return null;
    }

    current = current.parentElement;
  }

  return null;
}

/**
 * A declared value turned into a colour, following `var()` where it leads.
 *
 * jsdom does not resolve custom properties — `color: var(--text-primary)` comes
 * straight back out of `getComputedStyle` untouched — so the chain is walked
 * here: the caller's token table first, then the element and its ancestors, then
 * the fallback written into the `var()` itself.
 */
function resolveColor(
  value: string,
  element: Element,
  root: Element,
  options: AccessibilityOptions,
  depth = 0,
): Rgba | null {
  const text = value.trim();

  if (text === '' || depth > MAX_VARIABLE_DEPTH) {
    return null;
  }

  const reference = VARIABLE_REFERENCE.exec(text);

  if (reference === null) {
    return parseColor(text);
  }

  const name = reference[1] ?? '';
  const fallback = reference[2];
  const declared = options.variables?.[name] ?? lookupVariable(element, name, root);
  const next = declared ?? fallback ?? null;

  return next === null ? null : resolveColor(next, element, root, options, depth + 1);
}

/** One colour laid over another, as a browser would paint it. */
function composite(over: Rgba, under: Rgba): Rgba {
  const alpha = over.alpha + under.alpha * (1 - over.alpha);

  if (alpha === 0) {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }

  const mix = (top: number, bottom: number): number =>
    (top * over.alpha + bottom * under.alpha * (1 - over.alpha)) / alpha;

  return {
    red: mix(over.red, under.red),
    green: mix(over.green, under.green),
    blue: mix(over.blue, under.blue),
    alpha,
  };
}

/** Relative luminance, straight out of the WCAG definition. */
export function relativeLuminance(color: Rgba): number {
  const channel = (value: number): number => {
    const scaled = value / CHANNEL_MAX;

    return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(color.red) + 0.7152 * channel(color.green) + 0.0722 * channel(color.blue);
}

/** The WCAG contrast ratio between two opaque colours: 1 for identical, 21 at most. */
export function contrastRatio(foreground: Rgba, background: Rgba): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * What is actually behind this element, one painted layer at a time.
 *
 * Stops at the first opaque layer and composites everything translucent above
 * it. Reaching the container without finding one means the backdrop is whatever
 * the page happens to be, which is not knowable from here — so it returns
 * `null`, and the text run is skipped rather than measured against a guess.
 */
function backgroundBehind(
  element: Element,
  root: Element,
  options: AccessibilityOptions,
): Rgba | null {
  const layers: Rgba[] = [];
  let current: Element | null = element;

  while (current !== null) {
    const declared = window.getComputedStyle(current).backgroundColor;
    const color = resolveColor(declared, current, root, options);

    if (color !== null && color.alpha > 0) {
      layers.push(color);

      if (color.alpha >= 1) {
        return layers.reduceRight((under, over) => composite(over, under));
      }
    }

    if (current === root) {
      return null;
    }

    current = current.parentElement;
  }

  return null;
}

/** The colour this element's text is painted in, inherited from an ancestor if need be. */
function foregroundOf(
  element: Element,
  root: Element,
  options: AccessibilityOptions,
): Rgba | null {
  let current: Element | null = element;

  while (current !== null) {
    const color = resolveColor(window.getComputedStyle(current).color, current, root, options);

    if (color !== null && color.alpha > 0) {
      return color;
    }

    if (current === root) {
      return null;
    }

    current = current.parentElement;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Accessible names.                                                           */
/* -------------------------------------------------------------------------- */

/** The `<label>` bound to a control, by `for` or by wrapping it. */
function boundLabelText(element: Element): string {
  const id = element.getAttribute('id');

  if (id !== null && id !== '') {
    for (const label of element.ownerDocument.querySelectorAll('label')) {
      if (label.htmlFor === id) {
        return (label.textContent ?? '').trim();
      }
    }
  }

  return (element.closest('label')?.textContent ?? '').trim();
}

/** Does this element take its name from the text inside it? */
function namesFromContent(element: Element): boolean {
  const role = element.getAttribute('role');

  if (role !== null) {
    return NAME_FROM_CONTENT.has(role);
  }

  return NAME_FROM_CONTENT_TAGS.has(element.tagName.toLowerCase());
}

/**
 * What a screen reader would announce this element as.
 *
 * A working simplification of the accessible-name computation: the two ARIA
 * attributes first, then the host language's own labelling — a bound `<label>`,
 * an `alt`, the `value` printed on a submit button — then the element's own
 * text where its role allows it, then `title`, then a placeholder. Enough to
 * separate "named" from "not named", which is the question being asked.
 */
export function accessibleName(element: Element): string {
  const labelledBy = element.getAttribute('aria-labelledby');

  if (labelledBy !== null && labelledBy.trim() !== '') {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => (element.ownerDocument.getElementById(id)?.textContent ?? '').trim())
      .filter((part) => part !== '')
      .join(' ');

    if (text !== '') {
      return text;
    }
  }

  const label = (element.getAttribute('aria-label') ?? '').trim();

  if (label !== '') {
    return label;
  }

  if (element instanceof HTMLInputElement) {
    if (VALUE_INPUT_TYPES.has(element.type)) {
      const value = (element.getAttribute('value') ?? '').trim();

      if (value !== '') {
        return value;
      }
    }

    if (element.type === 'image') {
      const alt = (element.getAttribute('alt') ?? '').trim();

      if (alt !== '') {
        return alt;
      }
    }
  }

  if (element instanceof HTMLImageElement) {
    const alt = (element.getAttribute('alt') ?? '').trim();

    if (alt !== '') {
      return alt;
    }
  }

  const bound = boundLabelText(element);

  if (bound !== '') {
    return bound;
  }

  if (namesFromContent(element)) {
    const text = (element.textContent ?? '').trim();

    if (text !== '') {
      return text;
    }
  }

  const title = (element.getAttribute('title') ?? '').trim();

  if (title !== '') {
    return title;
  }

  return (element.getAttribute('placeholder') ?? '').trim();
}

/* -------------------------------------------------------------------------- */
/* Keyboard and focus ring.                                                    */
/* -------------------------------------------------------------------------- */

/** A Tailwind class token, with or without a variant prefix: `focus-visible:ring-2`. */
function hasClassToken(element: Element, token: string): boolean {
  for (const className of element.classList) {
    const bare = className.slice(className.lastIndexOf(':') + 1);

    if (bare === token) {
      return true;
    }
  }

  return false;
}

/** Has the browser's own focus outline been switched off? */
function suppressesOutline(element: Element): boolean {
  if (hasClassToken(element, 'outline-none')) {
    return true;
  }

  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = element.style;

  return (
    style.outlineStyle === 'none' || style.outline === 'none' || style.outlineWidth === '0px'
  );
}

/** Is this element disabled, natively or by ARIA? */
function isDisabled(element: Element): boolean {
  return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
}

/* -------------------------------------------------------------------------- */
/* The pass.                                                                   */
/* -------------------------------------------------------------------------- */

/** Does this element own visible text of its own, rather than only through children? */
function ownsText(element: Element): boolean {
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '') {
      return true;
    }
  }

  return false;
}

/** A ratio as this product writes a number: one decimal comma, two places (A15). */
function formatRatio(ratio: number): string {
  return ratio.toFixed(2).replace('.', ',');
}

/** The first words of a text run, for a failure that says which text it means. */
function snippetOf(element: Element): string {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const limit = 40;

  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/**
 * Everything wrong with a rendered screen's accessibility, and what could not be looked at.
 *
 * Pure and non-throwing, so a test can assert on what was found rather than on a
 * message. {@link expectAccessible} is the assertion built on it.
 */
export function inspectAccessibility(
  subject: TestSubject,
  options: AccessibilityOptions = {},
): AccessibilityReport {
  const root = containerOf(subject);
  const issues: AccessibilityIssue[] = [];
  const ignored = new Set(
    options.ignoreSelector === undefined ? [] : root.querySelectorAll(options.ignoreSelector),
  );
  const captions = new Set(root.querySelectorAll(options.captionSelector ?? CAPTION_SELECTOR));
  const minText = options.minTextContrast ?? MIN_TEXT_CONTRAST;
  const minCaption = options.minCaptionContrast ?? MIN_CAPTION_CONTRAST;

  const skip = (element: Element): boolean =>
    ignored.has(element) || isHiddenWithin(element, root);

  const report = (
    kind: AccessibilityIssueKind,
    element: Element,
    reason: string,
    detail: string | null = null,
  ): void => {
    issues.push({ kind, element: describeElement(element, root), reason, detail });
  };

  // A name for everything a person can operate.
  for (const element of root.querySelectorAll(INTERACTIVE_SELECTOR)) {
    if (skip(element)) {
      continue;
    }

    // A hidden input has no control to label, and nothing announces it.
    if (element instanceof HTMLInputElement && element.type === 'hidden') {
      continue;
    }

    if (accessibleName(element) === '') {
      report(
        'missing-name',
        element,
        'không có nhãn cho trình đọc màn hình',
        'thêm aria-label, aria-labelledby, hoặc một <label> gắn với nó',
      );
    }
  }

  // An image says what it is, or says out loud that it is decoration.
  for (const image of root.querySelectorAll('img')) {
    if (!skip(image) && !image.hasAttribute('alt')) {
      report('missing-alt', image, 'thiếu thuộc tính alt', 'ảnh trang trí vẫn phải ghi alt=""');
    }
  }

  // The keyboard reaches everything, in the order the document is written.
  for (const element of root.querySelectorAll(FOCUSABLE_SELECTOR)) {
    if (skip(element)) {
      continue;
    }

    const declared = element.getAttribute('tabindex');
    const tabIndex = declared === null ? null : Number.parseInt(declared, 10);

    if (tabIndex !== null && tabIndex > 0) {
      report(
        'tab-order',
        element,
        'tabindex dương sắp lại thứ tự bàn phím của cả trang',
        `tabindex="${declared ?? ''}"; dùng thứ tự trong DOM thay vì đánh số`,
      );
    }

    if (
      tabIndex !== null &&
      tabIndex < 0 &&
      element.matches(INTERACTIVE_SELECTOR) &&
      !isDisabled(element) &&
      !element.hasAttribute(ROVING_FOCUS_ATTRIBUTE)
    ) {
      report(
        'unreachable',
        element,
        'điều khiển này bàn phím không tới được',
        `tabindex="${declared ?? ''}"; nếu là danh sách roving focus thì đánh dấu ${ROVING_FOCUS_ATTRIBUTE}`,
      );
    }

    if (suppressesOutline(element) && !hasClassToken(element, 'ring-2')) {
      report(
        'focus-ring',
        element,
        'tắt viền tiêu điểm mặc định mà không thay bằng cái khác',
        'A12 yêu cầu focus ring 2px, offset 2px',
      );
      continue;
    }

    if (hasClassToken(element, 'ring-2') && !hasClassToken(element, 'ring-offset-2')) {
      report(
        'focus-ring',
        element,
        'viền tiêu điểm thiếu offset 2px',
        'A12 yêu cầu focus ring 2px, offset 2px',
      );
    }
  }

  // Text stands off its background — where the background is knowable at all.
  let contrastChecked = 0;
  let contrastSkipped = 0;

  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (!ownsText(element) || skip(element)) {
      continue;
    }

    const foreground = foregroundOf(element, root, options);
    const background = backgroundBehind(element, root, options);

    if (foreground === null || background === null) {
      contrastSkipped += 1;
      continue;
    }

    contrastChecked += 1;

    const required = captions.has(element) ? minCaption : minText;
    const ratio = contrastRatio(composite(foreground, background), background);

    if (ratio < required) {
      report(
        'contrast',
        element,
        `tương phản chữ ${formatRatio(ratio)}:1, dưới mức ${formatRatio(required)}:1`,
        `"${snippetOf(element)}"`,
      );
    }
  }

  return { issues, contrastChecked, contrastSkipped };
}

/** One issue as a line a person can act on. */
function describeIssue(issue: AccessibilityIssue): string {
  const detail = issue.detail === null ? '' : `\n      → ${issue.detail}`;

  return `  ${issue.element}  ${issue.reason}${detail}`;
}

/**
 * Assert that a rendered screen can be used by keyboard and read at low vision.
 *
 * Throws an `Error` listing every element at fault with the rule it broke and,
 * for contrast, the ratio it managed against the ratio it needed.
 *
 * @param subject A container, or the result of rendering one.
 *
 * @throws Error when the subject is empty — a check that looked at nothing must
 * not pass — or when anything was found.
 *
 * @example
 * expectAccessible(renderWithProviders(<QcScreen />));
 * expectAccessible(container, { variables: { '--text-primary': tokens.textPrimary } });
 */
export function expectAccessible(
  subject: TestSubject,
  options: AccessibilityOptions = {},
): void {
  const root = containerOf(subject);

  if (root.childNodes.length === 0) {
    throw new Error(
      `${FAILURE_PREFIX}: không có gì để kiểm — phần tử được truyền vào rỗng. ` +
        'Một lượt kiểm không nhìn thấy gì thì không được tính là đạt.',
    );
  }

  const report = inspectAccessibility(subject, options);

  if (options.requireResolvedContrast === true && report.contrastChecked === 0) {
    throw new Error(
      `${FAILURE_PREFIX}: không đọc được màu của bất kỳ đoạn chữ nào ` +
        `(${String(report.contrastSkipped)} đoạn bị bỏ qua), nên phần tương phản chưa kiểm được gì. ` +
        'Truyền token màu qua tuỳ chọn variables, hoặc bỏ requireResolvedContrast.',
    );
  }

  if (report.issues.length === 0) {
    return;
  }

  const detail = report.issues.map(describeIssue).join('\n');

  throw new Error(
    `${FAILURE_PREFIX}: ${String(report.issues.length)} lỗi tiếp cận.\n${detail}`,
  );
}
