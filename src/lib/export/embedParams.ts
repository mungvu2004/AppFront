/**
 * The four things a link says about the screen it opens.
 *
 * A share link has two halves. The first is the server's business: an opaque
 * address that either resolves to a project or does not, guarded by an expiry
 * and possibly a password the server checks. The second half is this module —
 * the part of a link that describes *the screen*, and is therefore worth
 * nothing to an attacker and everything to a reader: which storey to open on,
 * how to colour it, whether the host page wants our toolbar, and the camera the
 * sender was looking through.
 *
 * ```text
 * https://app.example.com/s/8f2c…?level=L-02&color=area&toolbar=0&v=1BAAAMI4…
 *                        └ server's half ┘ └──────── this module's half ────────┘
 * ```
 *
 * ## Nothing here is a secret, and that is a design rule rather than a habit
 *
 * A URL is the least private string a product has. It goes into browser
 * history, server access logs, `Referer` headers on every outbound click, chat
 * previews, and the clipboard of whoever was sent it. So the four parameters
 * below are a **closed set of four fixed keys**, all of them descriptions of a
 * viewport: a storey code, a colouring name, a boolean, and the camera code
 * from `viewpointCodec`. There is no key through which a password, a session or
 * a project's internals could reach a URL, because {@link formatEmbedParams} —
 * the only writer — emits those four names and nothing else.
 *
 * {@link findSecretParams} exists to check that from the outside, and the note
 * on {@link SECRET_PARAM_KEYS} explains why a share *token* is deliberately not
 * on that list while a *password* is.
 *
 * ## A bad parameter loses that parameter, never the screen
 *
 * Links are typed by hand into embed snippets, truncated by chat clients, and
 * kept in wikis long after a build renamed a colouring mode. So every read here
 * is per-field and total: an unreadable value falls back to that field's
 * default and lands in {@link EmbedParamsResult.ignored} with a Vietnamese
 * sentence, and the other three fields are unaffected. {@link parseEmbedParams}
 * accepts a whole URL, a query string, a `URLSearchParams`, a plain record,
 * `null`, or something that is none of those, and **never throws** — which is
 * the whole of the promise that a mangled link cannot blank the application.
 *
 * Two deliberate generosities, because the person writing an embed snippet by
 * hand is not reading this file: `level=02` is understood as `L-02`, and
 * `color=ROOMUSAGE` as `roomUsage`. Both normalise on the way out, so a link
 * this module produced is always in the canonical spelling.
 *
 * ## Precedence, when the code and the query disagree
 *
 * The camera code carries a storey and a colouring of its own. When a host page
 * also pins `level` or `color` on the iframe, the **query wins**, because the
 * markup on the page is the more recent statement of intent — somebody edited
 * it after the link was made. {@link resolveEmbedView} applies that rule once
 * and hands back a {@link SharedViewpoint} already reconciled with it, so no
 * caller can apply a camera that disagrees with the storey beside it.
 *
 * ## Field names
 *
 * The brief names these `tang`, `cheDoToMau` and `thanhCongCu`. Invariants B
 * and E.11 of `CLAUDE.md` forbid Vietnamese identifiers, so they are
 * {@link EmbedParams.levelId}, {@link EmbedParams.coloring} and
 * {@link EmbedParams.toolbar}. Every string a person reads stays Vietnamese,
 * lower case and sentence style, as invariant A6 requires.
 */

import type { LevelId } from '@/domain/spatial/types';
import { COLORING_MODE_IDS, type ColoringModeId } from '@/lib/coloring/modes';
import {
  MAX_VIEWPOINT_CODE_LENGTH,
  decodeViewpoint,
  isEncodableLevelId,
  type SharedViewpoint,
} from '@/lib/three/camera/viewpointCodec';

/* -------------------------------------------------------------------------- */
/* The four keys.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Every query key this module writes, and the only ones it reads.
 *
 * Short on purpose — an embed snippet is pasted into a page's source by hand,
 * and `v` for the camera code keeps the longest field's name out of the way of
 * the field itself.
 */
export const EMBED_PARAM_KEYS = {
  level: 'level',
  coloring: 'color',
  toolbar: 'toolbar',
  viewpoint: 'v',
} as const;

/** One of the four keys above. */
export type EmbedParamKey = (typeof EMBED_PARAM_KEYS)[keyof typeof EMBED_PARAM_KEYS];

/**
 * The keys this module owns, and therefore the keys {@link buildEmbedUrl}
 * removes from a base URL before writing its own. That is what makes building a
 * URL idempotent: applying parameters to a link that already carries some
 * replaces them rather than appending a second, contradictory set.
 */
const OWNED_KEYS: readonly string[] = [
  EMBED_PARAM_KEYS.level,
  EMBED_PARAM_KEYS.coloring,
  EMBED_PARAM_KEYS.toolbar,
  EMBED_PARAM_KEYS.viewpoint,
];

/* -------------------------------------------------------------------------- */
/* What a link asks for.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The screen state a link carries, already checked.
 *
 * A plain, serialisable record — no `Vector3`, no class — so it compares by
 * value, survives `structuredClone`, and can be asserted equal after a round
 * trip through a URL.
 */
export interface EmbedParams {
  /** The storey to open on; `null` leaves the choice to the application. */
  readonly levelId: LevelId | null;
  /** How to colour the model; `null` leaves the choice to the application. */
  readonly coloring: ColoringModeId | null;
  /** Whether the host page wants our own toolbar drawn. */
  readonly toolbar: boolean;
  /**
   * The camera, as {@link import('@/lib/three/camera/viewpointCodec')} writes
   * it. Kept as the string rather than the decoded view so that this record
   * stays comparable by value; {@link resolveEmbedView} decodes it.
   *
   * Never `null`-checked into existence by this module: a code that reaches
   * here has already been through {@link decodeViewpoint} once.
   */
  readonly viewpointCode: string | null;
}

/** What a page shows when the link says nothing about the toolbar. */
export const DEFAULT_TOOLBAR_VISIBLE = true;

/** What a page colours by when neither the link nor the camera code says. */
export const DEFAULT_COLORING_MODE: ColoringModeId = 'default';

/** The screen a link with no parameters at all opens. */
export const DEFAULT_EMBED_PARAMS: EmbedParams = {
  levelId: null,
  coloring: null,
  toolbar: DEFAULT_TOOLBAR_VISIBLE,
  viewpointCode: null,
};

/* -------------------------------------------------------------------------- */
/* What a bad parameter comes back as.                                         */
/* -------------------------------------------------------------------------- */

/** Why one parameter was dropped. */
export type EmbedParamProblem =
  /** A colouring name no build of this application has. */
  | 'unknownColoring'
  /** A storey code with characters a link cannot carry. */
  | 'malformedLevel'
  /** Something that is neither true nor false. */
  | 'malformedToolbar'
  /** A camera code that failed its own checks; see the codec for which. */
  | 'unreadableViewpoint'
  /** The key appeared more than once; the first value was used. */
  | 'repeated';

/**
 * What to tell the person holding the link.
 *
 * A complete `Record`, so a new problem cannot reach a screen without a
 * sentence. `unreadableViewpoint` is usually replaced by the codec's own,
 * sharper sentence — this one is the fallback.
 */
export const EMBED_PARAM_PROBLEM_LABELS: Readonly<Record<EmbedParamProblem, string>> = {
  unknownColoring: 'chế độ tô màu không có trong bản dựng này',
  malformedLevel: 'mã tầng không đúng định dạng',
  malformedToolbar: 'giá trị hiện hoặc ẩn thanh công cụ không phải đúng hay sai',
  unreadableViewpoint: 'mã góc nhìn không đọc được',
  repeated: 'tham số lặp lại; chỉ giá trị đầu tiên được dùng',
};

/** One parameter that was thrown away, and why. */
export interface IgnoredEmbedParam {
  readonly key: EmbedParamKey;
  /** What the link actually said, for a diagnostics panel. */
  readonly value: string;
  readonly problem: EmbedParamProblem;
  /** Vietnamese sentence for the person who followed the link. */
  readonly message: string;
}

/**
 * A link that was read.
 *
 * There is no failed shape: {@link EmbedParamsResult.params} is always a whole,
 * usable set. `ignored` is for a quiet notice, never for a branch that decides
 * whether to render.
 */
export interface EmbedParamsResult {
  readonly params: EmbedParams;
  readonly ignored: readonly IgnoredEmbedParam[];
}

/** Anything a caller might plausibly have in hand when a link opens. */
export type EmbedParamsSource =
  | URLSearchParams
  | URL
  | string
  | Readonly<Record<string, unknown>>
  | null
  | undefined;

function ignore(
  key: EmbedParamKey,
  value: string,
  problem: EmbedParamProblem,
  message: string = EMBED_PARAM_PROBLEM_LABELS[problem],
): IgnoredEmbedParam {
  return { key, value, problem, message };
}

/* -------------------------------------------------------------------------- */
/* Getting to a URLSearchParams from whatever we were handed.                  */
/* -------------------------------------------------------------------------- */

/**
 * The base a relative link is resolved against so `URL` will parse it.
 *
 * `.invalid` is reserved by RFC 2606 and resolves nowhere, which is the point:
 * this host is never dereferenced, never emitted, and never appears in output.
 * Only `url.search` and `url.hash` are read back off it.
 */
const RELATIVE_BASE = 'https://embed.invalid';

/** A `URL`, or `null` when the text is not one. Never throws. */
function parseUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    // Not absolute. A leading '/', '?' or '#' still makes it a URL relative to
    // some page, which is exactly the shape `location.search` and a router's
    // `to` arrive in.
    if (text.startsWith('/') || text.startsWith('?') || text.startsWith('#')) {
      try {
        return new URL(text, RELATIVE_BASE);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * The query hidden in a fragment.
 *
 * Hash routers put the whole route after `#`, so a shared link may well read
 * `…/#/projects/7/3d?level=L-02`. Reading the fragment as well as the query
 * costs a dozen lines and saves every such link from opening on the wrong
 * storey.
 */
function fragmentParams(hash: string): URLSearchParams {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (body.length === 0) {
    return new URLSearchParams();
  }
  const markerIndex = body.indexOf('?');

  return new URLSearchParams(markerIndex === -1 ? body : body.slice(markerIndex + 1));
}

/** A URL's query, with anything the fragment adds that the query lacked. */
function paramsFromUrl(url: URL): URLSearchParams {
  const merged = new URLSearchParams(url.search);

  for (const [key, value] of fragmentParams(url.hash)) {
    if (!merged.has(key)) {
      merged.append(key, value);
    }
  }

  return merged;
}

function paramsFromRecord(record: Readonly<Record<string, unknown>>): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      params.append(key, value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      params.append(key, String(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
          params.append(key, String(item));
        }
      }
    }
    // Anything else — an object, a function, null — carries no parameter, and
    // stringifying it would only invent one.
  }

  return params;
}

/** Whatever we were given, as parameters. Never throws, for any input. */
function toSearchParams(source: EmbedParamsSource): URLSearchParams {
  if (source === null || source === undefined) {
    return new URLSearchParams();
  }
  if (source instanceof URLSearchParams) {
    return source;
  }
  if (source instanceof URL) {
    return paramsFromUrl(source);
  }
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (trimmed.length === 0) {
      return new URLSearchParams();
    }
    const url = parseUrl(trimmed);
    if (url !== null) {
      return paramsFromUrl(url);
    }

    // Not a URL: a bare `a=b&c=d`, which is what a router hands over.
    return new URLSearchParams(trimmed);
  }
  if (typeof source === 'object') {
    return paramsFromRecord(source);
  }

  return new URLSearchParams();
}

/* -------------------------------------------------------------------------- */
/* Reading one field at a time.                                                */
/* -------------------------------------------------------------------------- */

/** The prefix a storey id carries, so `level=02` can be understood as `L-02`. */
const LEVEL_PREFIX = 'L-';

/** Spellings of yes and no an embed author might reasonably write. */
const TRUE_WORDS: ReadonlySet<string> = new Set(['1', 'true', 'yes', 'on']);
const FALSE_WORDS: ReadonlySet<string> = new Set(['0', 'false', 'no', 'off']);

/**
 * The first value for a key, or `null`.
 *
 * A repeat is reported rather than merged: `?level=L-01&level=L-02` is a link
 * somebody edited badly, and picking the first is at least a rule that can be
 * explained. An empty value is treated as absence, with no complaint — `?level=`
 * is how a form with an unset field serialises, not a mistake.
 */
function readOne(
  search: URLSearchParams,
  key: EmbedParamKey,
  ignored: IgnoredEmbedParam[],
): string | null {
  const values = search.getAll(key);
  const first = values[0];
  if (first === undefined) {
    return null;
  }
  if (values.length > 1) {
    ignored.push(ignore(key, values.slice(1).join(', '), 'repeated'));
  }
  const trimmed = first.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function readLevel(search: URLSearchParams, ignored: IgnoredEmbedParam[]): LevelId | null {
  const raw = readOne(search, EMBED_PARAM_KEYS.level, ignored);
  if (raw === null) {
    return null;
  }
  if (isEncodableLevelId(raw)) {
    return raw as LevelId;
  }

  // A snippet written by hand says `level=02` far more often than `level=L-02`,
  // and the prefixed form is the only one this module ever emits, so accepting
  // the bare code costs nothing and normalises on the way out.
  const prefixed = `${LEVEL_PREFIX}${raw}`;
  if (isEncodableLevelId(prefixed)) {
    return prefixed as LevelId;
  }

  ignored.push(ignore(EMBED_PARAM_KEYS.level, raw, 'malformedLevel'));

  return null;
}

function readColoring(
  search: URLSearchParams,
  ignored: IgnoredEmbedParam[],
): ColoringModeId | null {
  const raw = readOne(search, EMBED_PARAM_KEYS.coloring, ignored);
  if (raw === null) {
    return null;
  }
  const wanted = raw.toLowerCase();
  const match = COLORING_MODE_IDS.find((id) => id.toLowerCase() === wanted);
  if (match === undefined) {
    ignored.push(ignore(EMBED_PARAM_KEYS.coloring, raw, 'unknownColoring'));

    return null;
  }

  return match;
}

function readToolbar(search: URLSearchParams, ignored: IgnoredEmbedParam[]): boolean {
  const raw = readOne(search, EMBED_PARAM_KEYS.toolbar, ignored);
  if (raw === null) {
    return DEFAULT_TOOLBAR_VISIBLE;
  }
  const word = raw.toLowerCase();
  if (TRUE_WORDS.has(word)) {
    return true;
  }
  if (FALSE_WORDS.has(word)) {
    return false;
  }
  ignored.push(ignore(EMBED_PARAM_KEYS.toolbar, raw, 'malformedToolbar'));

  return DEFAULT_TOOLBAR_VISIBLE;
}

function readViewpointCode(search: URLSearchParams, ignored: IgnoredEmbedParam[]): string | null {
  const raw = readOne(search, EMBED_PARAM_KEYS.viewpoint, ignored);
  if (raw === null) {
    return null;
  }
  const result = decodeViewpoint(raw);
  if (!result.ok) {
    // The codec's sentence names the actual fault — truncated, checksum,
    // unknown field — which is far more use to whoever has to fix the link than
    // a generic "không đọc được".
    ignored.push(ignore(EMBED_PARAM_KEYS.viewpoint, raw, 'unreadableViewpoint', result.message));

    return null;
  }

  return raw;
}

/* -------------------------------------------------------------------------- */
/* Reading.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Read the screen state out of a link.
 *
 * Never throws and always returns a whole {@link EmbedParams}, whatever it is
 * handed — a full URL, `location.search`, a `URLSearchParams`, a router's
 * record, `null`, or a number that got here by a route the types did not
 * cover. Anything unreadable is left in {@link EmbedParamsResult.ignored} and
 * that field alone falls back to its default.
 *
 * @example
 * const { params, ignored } = parseEmbedParams(window.location.href);
 * const view = resolveEmbedView(params);
 * if (ignored.length > 0) {
 *   notice(ignored.map((entry) => entry.message).join(' '));
 * }
 */
export function parseEmbedParams(source: EmbedParamsSource): EmbedParamsResult {
  const search = toSearchParams(source);
  const ignored: IgnoredEmbedParam[] = [];

  return {
    params: {
      levelId: readLevel(search, ignored),
      coloring: readColoring(search, ignored),
      toolbar: readToolbar(search, ignored),
      viewpointCode: readViewpointCode(search, ignored),
    },
    ignored,
  };
}

/** Fill in whatever a caller left out. */
export function toEmbedParams(partial: Partial<EmbedParams> = {}): EmbedParams {
  return {
    levelId: partial.levelId ?? DEFAULT_EMBED_PARAMS.levelId,
    coloring: partial.coloring ?? DEFAULT_EMBED_PARAMS.coloring,
    toolbar: partial.toolbar ?? DEFAULT_EMBED_PARAMS.toolbar,
    viewpointCode: partial.viewpointCode ?? DEFAULT_EMBED_PARAMS.viewpointCode,
  };
}

/* -------------------------------------------------------------------------- */
/* Applying.                                                                   */
/* -------------------------------------------------------------------------- */

/** The screen state to actually open in, with every disagreement settled. */
export interface EmbedView {
  /** `null` only when the link named no storey and carried no camera. */
  readonly levelId: LevelId | null;
  /** Always a real mode: {@link DEFAULT_COLORING_MODE} when nothing said. */
  readonly coloring: ColoringModeId;
  readonly toolbar: boolean;
  /**
   * The camera to fly to, already agreeing with the two fields above, or `null`
   * when the link carried none or carried one that could not be read.
   */
  readonly viewpoint: SharedViewpoint | null;
}

/**
 * Settle the link's parameters and its camera code into one state to apply.
 *
 * The query wins over the code — see the note at the top of this file — and the
 * returned {@link EmbedView.viewpoint} is rewritten to agree, so a caller can
 * hand it straight to `createCameraMode` without first checking whether its
 * storey matches the storey beside it. That check being easy to forget is
 * exactly why it is done here once.
 *
 * Pure, total, and cheap: safe to call on every render if that is convenient.
 */
export function resolveEmbedView(params: EmbedParams): EmbedView {
  const decoded = params.viewpointCode === null ? null : decodeViewpoint(params.viewpointCode);
  const base = decoded !== null && decoded.ok ? decoded.viewpoint : null;

  const coloring = params.coloring ?? base?.coloring ?? DEFAULT_COLORING_MODE;
  const levelId = params.levelId ?? base?.levelId ?? null;

  return {
    levelId,
    coloring,
    toolbar: params.toolbar,
    viewpoint: base === null ? null : { ...base, levelId: levelId ?? base.levelId, coloring },
  };
}

/* -------------------------------------------------------------------------- */
/* Writing.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The four parameters as a query string, without a leading `?`.
 *
 * Defaults are omitted, so the commonest link carries nothing at all and the
 * round trip still holds — an absent key reads back as that field's default.
 * Each value is checked before it is written: a hand-built {@link EmbedParams}
 * holding a colouring name this build does not have loses that key rather than
 * producing a link that reads back with a complaint attached.
 */
export function formatEmbedParams(params: EmbedParams): string {
  const search = new URLSearchParams();

  if (params.levelId !== null && isEncodableLevelId(params.levelId)) {
    search.set(EMBED_PARAM_KEYS.level, params.levelId);
  }
  if (params.coloring !== null && (COLORING_MODE_IDS as readonly string[]).includes(params.coloring)) {
    search.set(EMBED_PARAM_KEYS.coloring, params.coloring);
  }
  if (params.toolbar !== DEFAULT_TOOLBAR_VISIBLE) {
    search.set(EMBED_PARAM_KEYS.toolbar, params.toolbar ? '1' : '0');
  }
  if (
    params.viewpointCode !== null &&
    params.viewpointCode.length > 0 &&
    params.viewpointCode.length <= MAX_VIEWPOINT_CODE_LENGTH
  ) {
    search.set(EMBED_PARAM_KEYS.viewpoint, params.viewpointCode);
  }

  return search.toString();
}

function splitOn(text: string, marker: string): [string, string] {
  const index = text.indexOf(marker);

  return index === -1 ? [text, ''] : [text.slice(0, index), text.slice(index)];
}

/** A query with this module's own keys taken out, so writing them is a replace. */
function withoutOwnedKeys(query: string): string {
  if (query.length === 0) {
    return '';
  }
  const kept = new URLSearchParams();

  for (const [key, value] of new URLSearchParams(query)) {
    if (!OWNED_KEYS.includes(key)) {
      kept.append(key, value);
    }
  }

  return kept.toString();
}

/**
 * Put the four parameters onto a link, replacing any it already had.
 *
 * String work rather than `URL` work, on purpose: the base may be absolute or
 * relative, and everything the server put in it — its path, its token, its
 * fragment, any parameter of its own — is passed through untouched. This module
 * writes its four keys and reads nobody else's.
 *
 * Idempotent: `buildEmbedUrl(buildEmbedUrl(u, p), p) === buildEmbedUrl(u, p)`,
 * which is what lets a screen rebuild the link on every camera move without
 * growing a query string one copy at a time.
 */
export function buildEmbedUrl(baseUrl: string, params: EmbedParams): string {
  const [beforeFragment, fragment] = splitOn(baseUrl, '#');
  const [path, existingQuery] = splitOn(beforeFragment, '?');

  const kept = withoutOwnedKeys(existingQuery.startsWith('?') ? existingQuery.slice(1) : existingQuery);
  const written = formatEmbedParams(params);
  const query = [kept, written].filter((part) => part.length > 0).join('&');

  return `${path}${query.length > 0 ? `?${query}` : ''}${fragment}`;
}

/* -------------------------------------------------------------------------- */
/* Auditing a URL.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Parameter names that would mean a credential had reached a URL.
 *
 * **`token` is deliberately absent.** A share link *is* a capability: an
 * unguessable address that the server trades for read access, which is the
 * mechanism, not a leak. What must never appear is something that unlocks more
 * than the one view — the password guarding the link, the sender's session, an
 * API key. Those are what this list names.
 *
 * Nothing in this module can write any of them; the list exists so a test, an
 * audit or a share screen can prove that from the outside rather than trusting
 * the paragraph above.
 */
export const SECRET_PARAM_KEYS: readonly string[] = [
  'access_token',
  'api_key',
  'apikey',
  'auth',
  'authorization',
  'client_secret',
  'cookie',
  'credential',
  'credentials',
  'id_token',
  'pass',
  'passwd',
  'password',
  'pw',
  'pwd',
  'refresh_token',
  'secret',
  'session',
  'sessionid',
  'sig',
  'signature',
];

/**
 * Which credential-shaped parameters a URL carries, if any.
 *
 * Reads the query and the fragment, matches case-insensitively, and returns the
 * offending names sorted and deduplicated — never the values, which is the
 * point: a function that reported the secret it found would be one more place
 * the secret existed.
 *
 * Never throws; a string that is not a URL simply carries no parameters.
 */
export function findSecretParams(url: string): readonly string[] {
  const parsed = parseUrl(url.trim());
  const search =
    parsed === null ? new URLSearchParams(url.includes('=') ? url : '') : paramsFromUrl(parsed);

  const found = new Set<string>();
  for (const key of search.keys()) {
    const lowered = key.toLowerCase();
    if (SECRET_PARAM_KEYS.includes(lowered)) {
      found.add(lowered);
    }
  }

  return [...found].sort();
}

/* -------------------------------------------------------------------------- */
/* The snippet somebody pastes into another page.                              */
/* -------------------------------------------------------------------------- */

/** How wide an embed is when the person copying it says nothing. */
export const DEFAULT_EMBED_WIDTH_PX = 960;

/** How tall an embed is when the person copying it says nothing. */
export const DEFAULT_EMBED_HEIGHT_PX = 600;

/** What the frame is called to a screen reader when no title is given. */
export const DEFAULT_EMBED_TITLE = 'Bản vẽ mặt bằng';

const MIN_EMBED_SIDE_PX = 120;
const MAX_EMBED_SIDE_PX = 4096;

/** What an embed snippet is asked for. */
export interface EmbedCodeInput {
  /** The share link. Its own path, query and fragment are preserved. */
  readonly url: string;
  /**
   * The frame's accessible name, in Vietnamese.
   *
   * An `<iframe>` without one is announced as "frame" and nothing else, which
   * is a dead end for anyone reading the host page with a screen reader.
   */
  readonly title?: string;
  readonly params?: Partial<EmbedParams>;
  /** Out-of-range or non-finite sizes fall back to the defaults. */
  readonly widthPx?: number;
  readonly heightPx?: number;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Make a string safe to sit inside a double-quoted HTML attribute.
 *
 * This is the one place in the product that emits markup for a document we do
 * not control. A project name holding a quote would otherwise close the `title`
 * attribute and let the rest of the name become markup on somebody else's page,
 * which is a cross-site scripting hole handed over in a copy button.
 */
function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

function clampSide(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);

  return rounded < MIN_EMBED_SIDE_PX || rounded > MAX_EMBED_SIDE_PX ? fallback : rounded;
}

/**
 * The `<iframe>` snippet to paste into a page outside this product.
 *
 * ```html
 * <iframe src="https://app.example.com/s/8f2c?level=L-02&amp;color=area&amp;toolbar=0"
 *         title="Bản vẽ mặt bằng" width="960" height="600"
 *         loading="lazy" referrerpolicy="no-referrer"
 *         style="border:0" allowfullscreen></iframe>
 * ```
 *
 * Three attributes are not decoration:
 *
 * - `referrerpolicy="no-referrer"` stops the host page's own address being sent
 *   to us on every load. An embed on a private wiki should not put that wiki's
 *   URL into our access logs, and the host page's author cannot be expected to
 *   remember to ask for that.
 * - `loading="lazy"` keeps a page with several embeds from starting several
 *   WebGL contexts before anyone has scrolled to them.
 * - `title` is the frame's accessible name, and invariant A12's keyboard promise
 *   is worth nothing inside a frame nobody can identify.
 *
 * The inline `style="border:0"` is the one place a raw value is written instead
 * of a token, and it has to be: the snippet lands in a document that has never
 * loaded `globals.css`, so a CSS variable would resolve to nothing there. Every
 * other appearance decision stays inside the framed application, where the
 * tokens do exist.
 */
export function buildEmbedCode(input: EmbedCodeInput): string {
  const url = buildEmbedUrl(input.url, toEmbedParams(input.params));
  const rawTitle = input.title?.trim() ?? '';
  const title = rawTitle.length > 0 ? rawTitle : DEFAULT_EMBED_TITLE;
  const width = clampSide(input.widthPx, DEFAULT_EMBED_WIDTH_PX);
  const height = clampSide(input.heightPx, DEFAULT_EMBED_HEIGHT_PX);

  return (
    `<iframe src="${escapeAttribute(url)}"` +
    ` title="${escapeAttribute(title)}"` +
    ` width="${String(width)}" height="${String(height)}"` +
    ' loading="lazy" referrerpolicy="no-referrer"' +
    ' style="border:0" allowfullscreen></iframe>'
  );
}
