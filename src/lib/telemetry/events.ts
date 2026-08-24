/**
 * The catalogue: the nine things this application is allowed to say about
 * itself, and nothing else.
 *
 * Measuring a QC tool is unusually risky, because the thing being measured *is*
 * somebody's building. A drawing file name is a client's name; a room label is
 * an address; a wall coordinate is a floor plan. So this module is built on one
 * decision, applied twice — once in the type system and once at runtime:
 *
 * **A telemetry field is either a code from a closed set or a number. There is
 * no third kind.**
 *
 * ## Why a closed catalogue
 *
 * A free-form `track(name, props)` looks flexible for a week and then becomes a
 * warehouse of misspelt names holding data nobody meant to collect. Here
 * {@link TELEMETRY_EVENT_SCHEMA} is a discriminated union of exactly nine
 * shapes: an event that is not one of them does not typecheck, and — because a
 * value that reached `unknown` can still be anything — does not parse either.
 * {@link parseTelemetryEvent} is the runtime half of that sentence, and the
 * sender calls it on every event before it can reach a queue.
 *
 * ## Why the charset is the privacy guarantee
 *
 * {@link TELEMETRY_CODE_PATTERN} admits lowercase ASCII, digits, dot, underscore
 * and hyphen, up to 48 characters. That is not tidiness. "Bản vẽ nhà anh Ba.pdf"
 * fails it on the space, on the capital and on every diacritic; so does an
 * email, a room label and a pasted note. A reviewer checking that no personal
 * data leaves the browser does not have to audit call sites — a value either
 * survives that regular expression or it never reaches the wire. Free text
 * cannot be smuggled through a numeric field either, and `z.object` drops keys
 * it does not name, so a well-meant `fileName` added at a call site is stripped
 * here rather than delivered.
 *
 * Note what is therefore *absent* from every shape below: no file name, no
 * project or room label, no coordinate, no user id, no error message. An error
 * is reported as its {@link AppErrorKind} — a member of the taxonomy
 * `src/lib/errors` already owns — because a kind is a code and a message is
 * whatever a server happened to write.
 *
 * ## The four experience indicators
 *
 * Three are durations carried on events — `app.first-frame`, `scene.build` and
 * `wall.edit.latencyMs` — and the fourth, the error rate, is derived rather than
 * reported, because a client that computed its own rate would be reporting a
 * ratio whose denominator nobody else could check.
 * {@link summariseExperience} computes all four from a list of events, with no
 * clock and no network, so the same function serves a dashboard, a test and a
 * console.
 */

import { z } from 'zod';

import { APP_ERROR_KINDS, type AppErrorKind, type AppErrorSeverity, type ErrorTelemetryDetail } from '@/lib/errors';

/* -------------------------------------------------------------------------- */
/* Field kinds: a code, or a number.                                           */
/* -------------------------------------------------------------------------- */

/** The wire format this catalogue speaks. Bump it when a shape changes. */
export const TELEMETRY_SCHEMA_VERSION = 1;

/** Longest a code may be. Long enough for a slug, too short for a sentence. */
export const MAX_TELEMETRY_CODE_LENGTH = 48;

/**
 * What a code may contain.
 *
 * Lowercase ASCII, digits, and the three separators — nothing that can carry a
 * name, an address or a note. See the header: this pattern is the boundary, not
 * a convention.
 */
export const TELEMETRY_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

/** A day. Anything longer is a broken clock, not a measurement. */
export const MAX_TELEMETRY_DURATION_MS = 86_400_000;

/** A million. Beyond this a count is a bug in the counter. */
export const MAX_TELEMETRY_COUNT = 1_000_000;

const roundToInteger = (value: number): number => Math.round(value);

/** An opaque identifier: a screen slug, a rule set slug, a session id. */
const codeSchema = z
  .string()
  .min(1)
  .max(MAX_TELEMETRY_CODE_LENGTH)
  .regex(TELEMETRY_CODE_PATTERN);

/**
 * A span of time, in whole milliseconds.
 *
 * Rounded rather than rejected: `performance.now()` returns fractions, and a
 * sub-millisecond tail is precision no dashboard uses and one more thing that
 * makes a session identifiable.
 */
const durationMsSchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_TELEMETRY_DURATION_MS)
  .transform(roundToInteger);

/** How many of something. Never *which* ones. */
const countSchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_TELEMETRY_COUNT)
  .transform(roundToInteger);

/** A whole percentage, 0–100. */
const percentSchema = z.number().finite().min(0).max(100).transform(roundToInteger);

/**
 * How an attempt ended.
 *
 * `cancelled` is deliberately not a failure — somebody who stops an upload on
 * purpose has not met a defect, and counting them as one would make the error
 * rate in {@link summariseExperience} rise every time the product behaved.
 */
export const TELEMETRY_OUTCOMES = ['success', 'failure', 'cancelled'] as const;
export type TelemetryOutcome = (typeof TELEMETRY_OUTCOMES)[number];
const outcomeSchema = z.enum(TELEMETRY_OUTCOMES);

/**
 * Which error, as a member of the application's own taxonomy.
 *
 * Reusing `APP_ERROR_KINDS` rather than inventing telemetry-only codes means the
 * dashboard and the error dialogs can never drift into two vocabularies for the
 * same failure — and it means an error can be reported without a message.
 */
const errorKindSchema = z.enum(APP_ERROR_KINDS);

/** ASCII names for the three severities `src/lib/errors` writes in Vietnamese. */
export const TELEMETRY_SEVERITY_CODES = ['warning', 'error', 'critical'] as const;
export type TelemetrySeverityCode = (typeof TELEMETRY_SEVERITY_CODES)[number];
const severitySchema = z.enum(TELEMETRY_SEVERITY_CODES);

/** The one place the Vietnamese severity of an `AppError` becomes a code. */
export const SEVERITY_CODES: Readonly<Record<AppErrorSeverity, TelemetrySeverityCode>> = {
  'cảnh báo': 'warning',
  lỗi: 'error',
  'nghiêm trọng': 'critical',
};

/* -------------------------------------------------------------------------- */
/* The eight shapes.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A drawing arrived — or did not.
 *
 * `sizeKb` and `pageCount` describe the upload; the file name does not appear
 * and must not be added, since it is the single most identifying string this
 * product ever holds.
 */
const drawingUploadSchema = z.object({
  name: z.literal('drawing.upload'),
  outcome: outcomeSchema,
  durationMs: durationMsSchema,
  sizeKb: countSchema,
  pageCount: countSchema,
  errorKind: errorKindSchema.optional(),
});

/**
 * The machine finished reading the drawing.
 *
 * The counts are the standard sample's five readings — walls, openings,
 * dimension chains, rooms, levels — because those are what a reviewer compares
 * against the drawing in front of them when the extraction looks wrong.
 */
const aiFinishedSchema = z.object({
  name: z.literal('ai.finished'),
  outcome: outcomeSchema,
  durationMs: durationMsSchema,
  wallCount: countSchema,
  openingCount: countSchema,
  dimensionCount: countSchema,
  roomCount: countSchema,
  levelCount: countSchema,
  /** Mean confidence over the extracted objects, as a whole percentage. */
  confidencePercent: percentSchema,
  errorKind: errorKindSchema.optional(),
});

/** What somebody did to a wall. Not where, and not to which one. */
export const WALL_EDIT_OPERATIONS = [
  'create',
  'move',
  'resize',
  'split',
  'join',
  'delete',
  'property',
] as const;
export type WallEditOperation = (typeof WALL_EDIT_OPERATIONS)[number];

/**
 * One wall edit, and how long the interface took to answer it.
 *
 * `latencyMs` is the third experience indicator: gesture released to committed
 * state on screen. It belongs on this event rather than on a metric of its own
 * because a latency without the operation that caused it cannot be acted on —
 * `split` being slow and `move` being slow are two different bugs.
 */
const wallEditSchema = z.object({
  name: z.literal('wall.edit'),
  operation: z.enum(WALL_EDIT_OPERATIONS),
  latencyMs: durationMsSchema,
  /** How many walls the level held at the time, so latency can be read against size. */
  wallCount: countSchema,
  /** Whether this edit was the undo of a previous one (invariant A8's toast). */
  undo: z.boolean(),
});

/** A rule pass over a level. Counts of findings, never the findings. */
const rulesRunSchema = z.object({
  name: z.literal('rules.run'),
  ruleSetCode: codeSchema,
  outcome: outcomeSchema,
  durationMs: durationMsSchema,
  checkedCount: countSchema,
  verifiedCount: countSchema,
  attentionCount: countSchema,
  violationCount: countSchema,
  errorKind: errorKindSchema.optional(),
});

/** What a person can carry out of the product. */
export const EXPORT_FORMATS = ['pdf', 'glb', 'png', 'csv', 'ifc'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** A file left the browser. */
const exportFileSchema = z.object({
  name: z.literal('export.file'),
  format: z.enum(EXPORT_FORMATS),
  outcome: outcomeSchema,
  durationMs: durationMsSchema,
  sizeKb: countSchema,
  pageCount: countSchema,
  errorKind: errorKindSchema.optional(),
});

/**
 * A screen showed somebody an error.
 *
 * Deliberately not "an error was thrown": what matters for the fourth indicator
 * is what a person met, not what a `catch` swallowed. There is no message field
 * and no stack — {@link toScreenErrorEvent} is the only bridge from
 * `src/lib/errors`, and it copies four codes and nothing else.
 */
const screenErrorSchema = z.object({
  name: z.literal('screen.error'),
  screenCode: codeSchema,
  errorKind: errorKindSchema,
  severity: severitySchema,
  retryable: z.boolean(),
});

/**
 * The first indicator: navigation to first painted frame.
 *
 * `coldStart` separates the two populations that would otherwise average into a
 * meaningless middle — a first visit paying for the bundle, and a warm reload.
 */
const appFirstFrameSchema = z.object({
  name: z.literal('app.first-frame'),
  screenCode: codeSchema,
  durationMs: durationMsSchema,
  coldStart: z.boolean(),
});

/**
 * The second indicator: geometry in, three-dimensional scene on screen.
 *
 * Carries the scene's size, because a build time without a triangle count says
 * only that something was slow, not whether it was slow for its size.
 */
const sceneBuildSchema = z.object({
  name: z.literal('scene.build'),
  durationMs: durationMsSchema,
  levelCount: countSchema,
  wallCount: countSchema,
  roomCount: countSchema,
  triangleCount: countSchema,
});

/** How the dashboard was told to open a project. */
export const PROJECT_OPEN_SOURCES = ['card', 'row', 'command-palette'] as const;
export type ProjectOpenSource = (typeof PROJECT_OPEN_SOURCES)[number];

/** Where a project sat in the pipeline at the moment it was opened. */
export const PROJECT_PIPELINE_STATUSES = ['processing', 'qc', 'done'] as const;
export type ProjectPipelineStatus = (typeof PROJECT_PIPELINE_STATUSES)[number];

/**
 * A project was opened from the dashboard.
 *
 * No project id and no project name, for the same reason nothing above carries
 * one — see the header. `status` and `source` are both closed codes, so this
 * event can say *how many* opens came from the command palette versus a card,
 * and how many landed on a project still processing versus one already done,
 * without ever saying *which* project.
 */
const projectOpenSchema = z.object({
  name: z.literal('project.open'),
  source: z.enum(PROJECT_OPEN_SOURCES),
  status: z.enum(PROJECT_PIPELINE_STATUSES),
});

/* -------------------------------------------------------------------------- */
/* The union, and the door into it.                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every event this application may send.
 *
 * A discriminated union rather than a base type with a payload: the discriminant
 * makes each shape complete on its own, so `wall.edit` cannot acquire a
 * `sizeKb`, and a reader who knows the name knows every field.
 */
export const TELEMETRY_EVENT_SCHEMA = z.discriminatedUnion('name', [
  drawingUploadSchema,
  aiFinishedSchema,
  wallEditSchema,
  rulesRunSchema,
  exportFileSchema,
  screenErrorSchema,
  appFirstFrameSchema,
  sceneBuildSchema,
  projectOpenSchema,
]);

/** An event as it travels: durations and counts already whole numbers. */
export type TelemetryEvent = z.output<typeof TELEMETRY_EVENT_SCHEMA>;

/** An event as a caller writes it, before rounding. */
export type TelemetryEventInput = z.input<typeof TELEMETRY_EVENT_SCHEMA>;

export type TelemetryEventName = TelemetryEvent['name'];

/**
 * The catalogue as a list, for a dashboard's filter and for the test that proves
 * this list and the union above have not drifted apart.
 *
 * `satisfies` catches a name that is not in the union; the catalogue test
 * catches a union member missing from this list. Both directions are covered,
 * which is the point of writing it twice.
 */
export const TELEMETRY_EVENT_NAMES = [
  'drawing.upload',
  'ai.finished',
  'wall.edit',
  'rules.run',
  'export.file',
  'screen.error',
  'app.first-frame',
  'scene.build',
  'project.open',
] as const satisfies readonly TelemetryEventName[];

export type DrawingUploadEvent = Extract<TelemetryEvent, { name: 'drawing.upload' }>;
export type AiFinishedEvent = Extract<TelemetryEvent, { name: 'ai.finished' }>;
export type WallEditEvent = Extract<TelemetryEvent, { name: 'wall.edit' }>;
export type RulesRunEvent = Extract<TelemetryEvent, { name: 'rules.run' }>;
export type ExportFileEvent = Extract<TelemetryEvent, { name: 'export.file' }>;
export type ScreenErrorEvent = Extract<TelemetryEvent, { name: 'screen.error' }>;
export type AppFirstFrameEvent = Extract<TelemetryEvent, { name: 'app.first-frame' }>;
export type SceneBuildEvent = Extract<TelemetryEvent, { name: 'scene.build' }>;
export type ProjectOpenEvent = Extract<TelemetryEvent, { name: 'project.open' }>;

/** Is this one of the eight names? */
export function isTelemetryEventName(value: unknown): value is TelemetryEventName {
  return (
    typeof value === 'string' && (TELEMETRY_EVENT_NAMES as readonly string[]).includes(value)
  );
}

/**
 * The event, cleaned — or `null`, meaning it is not going anywhere.
 *
 * Returns rather than throws, because this sits on the path of a product action
 * that must not fail because a measurement was malformed. Three things happen
 * here: an unknown name is refused, an unknown field is dropped, and a value
 * outside its schema refuses the whole event rather than being coerced into
 * something plausible.
 */
export function parseTelemetryEvent(input: unknown): TelemetryEvent | null {
  const parsed = TELEMETRY_EVENT_SCHEMA.safeParse(input);

  return parsed.success ? parsed.data : null;
}

/* -------------------------------------------------------------------------- */
/* The bridge from src/lib/errors.                                             */
/* -------------------------------------------------------------------------- */

/**
 * An error report, reduced to four codes.
 *
 * `src/lib/errors` already sanitises the context it dispatches, but this does
 * not forward that context at all. Sanitising asks "is this key dangerous?",
 * which is a question that has to be right every time; copying four named codes
 * asks nothing. A `screenCode` that is not a code — a route path with slashes, a
 * Vietnamese screen title — makes this return `null`, so a wrong caller loses a
 * measurement rather than leaking a label.
 */
export function toScreenErrorEvent(
  detail: ErrorTelemetryDetail,
  screenCode: string,
): ScreenErrorEvent | null {
  const parsed = parseTelemetryEvent({
    name: 'screen.error',
    screenCode,
    errorKind: detail.appError.kind satisfies AppErrorKind,
    severity: SEVERITY_CODES[detail.appError.severity],
    retryable: detail.appError.retryable,
  });

  return parsed?.name === 'screen.error' ? parsed : null;
}

/* -------------------------------------------------------------------------- */
/* The four experience indicators.                                             */
/* -------------------------------------------------------------------------- */

export const EXPERIENCE_INDICATORS = [
  'timeToFirstFrame',
  'sceneBuild',
  'editLatency',
  'errorRate',
] as const;
export type ExperienceIndicator = (typeof EXPERIENCE_INDICATORS)[number];

/**
 * What each indicator has to beat.
 *
 * Durations are judged on the 95th percentile rather than the mean, because a
 * mean hides the slow tenth of sessions, and the slow tenth is the whole reason
 * to measure. The edit-latency figure is the one people feel: past about a tenth
 * of a second a drag stops feeling attached to the pointer.
 */
export const EXPERIENCE_TARGETS = {
  timeToFirstFrameMs: 2_500,
  sceneBuildMs: 3_000,
  editLatencyMs: 100,
  errorRate: 0.02,
} as const;

/**
 * One duration indicator.
 *
 * Every field is `null` when nothing has been measured, and `withinTarget` is
 * `null` with it: "nothing measured" is not a pass, and a dashboard that showed
 * it as one would go green the moment telemetry broke.
 */
export interface DurationIndicator {
  readonly sampleCount: number;
  readonly medianMs: number | null;
  readonly p95Ms: number | null;
  readonly worstMs: number | null;
  readonly targetMs: number;
  readonly withinTarget: boolean | null;
}

/**
 * The fourth indicator.
 *
 * The denominator is every attempt that could have succeeded — an event
 * carrying an `outcome`, plus every error a screen actually showed. Cancelled
 * attempts are in neither number; see {@link TELEMETRY_OUTCOMES}.
 */
export interface ErrorRateIndicator {
  readonly attemptCount: number;
  readonly errorCount: number;
  /** Errors over attempts, `0` when nothing was attempted. */
  readonly rate: number;
  readonly targetRate: number;
  readonly withinTarget: boolean | null;
}

export interface ExperienceSummary {
  readonly timeToFirstFrame: DurationIndicator;
  readonly sceneBuild: DurationIndicator;
  readonly editLatency: DurationIndicator;
  readonly errorRate: ErrorRateIndicator;
}

/**
 * Nearest-rank percentile over an already sorted list.
 *
 * Nearest rank rather than interpolation: every value it returns is a duration
 * something actually took, which is the number worth putting next to a target.
 */
function percentile(sortedMs: readonly number[], fraction: number): number | null {
  if (sortedMs.length === 0) {
    return null;
  }

  const rank = Math.min(sortedMs.length, Math.max(1, Math.ceil(fraction * sortedMs.length)));

  return sortedMs[rank - 1] ?? null;
}

const MEDIAN_FRACTION = 0.5;
const P95_FRACTION = 0.95;

function toDurationIndicator(samplesMs: readonly number[], targetMs: number): DurationIndicator {
  const sorted = [...samplesMs].sort((left, right) => left - right);
  const p95Ms = percentile(sorted, P95_FRACTION);

  return {
    sampleCount: sorted.length,
    medianMs: percentile(sorted, MEDIAN_FRACTION),
    p95Ms,
    worstMs: sorted.length === 0 ? null : (sorted[sorted.length - 1] ?? null),
    targetMs,
    withinTarget: p95Ms === null ? null : p95Ms <= targetMs,
  };
}

/** Does this event report how an attempt ended? */
function hasOutcome(event: TelemetryEvent): event is Extract<TelemetryEvent, { outcome: TelemetryOutcome }> {
  return 'outcome' in event;
}

/**
 * The four indicators, from whatever events are to hand.
 *
 * Pure and clock-free: the same call serves a live dashboard, a test and a
 * console paste. It reads only the events it recognises, so passing a session's
 * whole stream is the expected use.
 */
export function summariseExperience(events: readonly TelemetryEvent[]): ExperienceSummary {
  const firstFrameMs: number[] = [];
  const sceneBuildMs: number[] = [];
  const editLatencyMs: number[] = [];
  let attemptCount = 0;
  let errorCount = 0;

  for (const event of events) {
    switch (event.name) {
      case 'app.first-frame':
        firstFrameMs.push(event.durationMs);
        break;
      case 'scene.build':
        sceneBuildMs.push(event.durationMs);
        break;
      case 'wall.edit':
        editLatencyMs.push(event.latencyMs);
        break;
      case 'screen.error':
        attemptCount += 1;
        errorCount += 1;
        break;
      default:
        break;
    }

    if (hasOutcome(event) && event.outcome !== 'cancelled') {
      attemptCount += 1;
      if (event.outcome === 'failure') {
        errorCount += 1;
      }
    }
  }

  return {
    timeToFirstFrame: toDurationIndicator(firstFrameMs, EXPERIENCE_TARGETS.timeToFirstFrameMs),
    sceneBuild: toDurationIndicator(sceneBuildMs, EXPERIENCE_TARGETS.sceneBuildMs),
    editLatency: toDurationIndicator(editLatencyMs, EXPERIENCE_TARGETS.editLatencyMs),
    errorRate: {
      attemptCount,
      errorCount,
      rate: attemptCount === 0 ? 0 : errorCount / attemptCount,
      targetRate: EXPERIENCE_TARGETS.errorRate,
      withinTarget: attemptCount === 0 ? null : errorCount / attemptCount <= EXPERIENCE_TARGETS.errorRate,
    },
  };
}
