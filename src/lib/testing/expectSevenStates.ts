/**
 * One assertion that a screen survives all seven of its states.
 *
 * Invariant A11 is easy to agree with and easy to half-do: a screen gets a test
 * for the state it was built for, a test for the empty state because somebody
 * remembered, and the other five are found by a user on a Friday. This function
 * exists so that "handles seven states" is one call rather than seven tests
 * somebody has to remember to write — and so that a screen missing one **fails**
 * rather than passing with six.
 *
 * What it checks, per state:
 *
 * - the scenario exists at all, exactly once;
 * - rendering it does not throw;
 * - what comes out is not blank.
 *
 * "Not blank" is the low bar on purpose, because the failure it is written
 * against is the whitescreen: a screen that renders nothing at all is the one
 * bug that makes an application look broken rather than imperfect. A loading
 * state is skeleton boxes with no text, and a legitimate one, so text alone
 * cannot be the test — one rendered element is enough.
 *
 * Nothing here imports React, or a test framework. Rendering is the caller's
 * job, handed in as a function, so this module works with any renderer and the
 * caller keeps control of how the screen is built. Failures are plain `Error`s
 * naming the state in Vietnamese, which reads the same in vitest, in a script,
 * or in a stack trace.
 */

import { SEVEN_STATES, SEVEN_STATE_LABELS, type SevenState, type SevenStateScenario } from './sevenStateScenarios';

/**
 * What a renderer hands back.
 *
 * Deliberately the shape `@testing-library/react`'s `render()` already returns,
 * so a caller passes its result straight through without adapting it.
 */
export interface ScreenRenderResult {
  /** The element the screen was rendered into. */
  readonly container: HTMLElement;
  /** Takes the screen down again before the next state is rendered. */
  readonly unmount?: () => void;
}

/** Builds the screen for one scenario. Supplied by the caller; never called twice for a state. */
export type ScreenRenderer = (scenario: SevenStateScenario) => ScreenRenderResult;

/** Prefix on every failure, so a report says which rule was broken. */
const FAILURE_PREFIX = 'expectSevenStates';

/** A thrown value, written out far enough to debug from. */
function describeThrown(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  return String(value);
}

/** Vietnamese names of a list of states, for a message a person can act on. */
function labelsOf(states: readonly SevenState[]): string {
  return states.map((state) => `"${SEVEN_STATE_LABELS[state]}"`).join(', ');
}

/**
 * One scenario per state, no more and no less.
 *
 * A missing state is the whole point. A duplicated one is checked too, because
 * seven scenarios covering six states passes a naive length check and leaves the
 * seventh untested — which is the bug this function exists to catch, wearing a
 * disguise.
 */
function indexByState(scenarios: readonly SevenStateScenario[]): ReadonlyMap<SevenState, SevenStateScenario> {
  const byState = new Map<SevenState, SevenStateScenario>();
  const duplicated: SevenState[] = [];

  for (const scenario of scenarios) {
    if (byState.has(scenario.state)) {
      duplicated.push(scenario.state);
      continue;
    }

    byState.set(scenario.state, scenario);
  }

  if (duplicated.length > 0) {
    throw new Error(`${FAILURE_PREFIX}: trạng thái bị lặp — ${labelsOf(duplicated)}.`);
  }

  const missing = SEVEN_STATES.filter((state) => !byState.has(state));

  if (missing.length > 0) {
    throw new Error(
      `${FAILURE_PREFIX}: thiếu ${String(missing.length)} trong bảy trạng thái — ${labelsOf(missing)}. ` +
        'Mọi màn hình phải xử lý đủ bảy trạng thái (bất biến A11).',
    );
  }

  return byState;
}

/** Did anything at all reach the screen? */
function isBlank(container: HTMLElement): boolean {
  return container.childElementCount === 0 && (container.textContent ?? '').trim() === '';
}

/**
 * Render a screen once per state and refuse to pass if any of them is blank.
 *
 * @param renderScreen Builds the screen for one scenario and returns its container.
 * @param scenarios The seven scenarios, usually from `createSevenStateScenarios()`.
 *
 * @throws Error naming the state, in Vietnamese, on the first failure — a
 * missing state, a render that threw, or a screen that came out empty.
 *
 * @example
 * expectSevenStates(
 *   (scenario) => render(<WallList {...scenario} />),
 *   createSevenStateScenarios(),
 * );
 */
export function expectSevenStates(
  renderScreen: ScreenRenderer,
  scenarios: readonly SevenStateScenario[],
): void {
  const byState = indexByState(scenarios);

  for (const state of SEVEN_STATES) {
    const scenario = byState.get(state);

    if (scenario === undefined) {
      // `indexByState` has already refused this, so reaching here means the map
      // and the state list disagree — worth saying out loud rather than casting.
      throw new Error(`${FAILURE_PREFIX}: không dựng được kịch bản "${SEVEN_STATE_LABELS[state]}".`);
    }

    let result: ScreenRenderResult;

    try {
      result = renderScreen(scenario);
    } catch (thrown) {
      throw new Error(
        `${FAILURE_PREFIX}: trạng thái "${scenario.label}" làm màn hình ném lỗi — ${describeThrown(thrown)}.`,
      );
    }

    try {
      if (isBlank(result.container)) {
        throw new Error(
          `${FAILURE_PREFIX}: trạng thái "${scenario.label}" dựng ra màn hình trắng. ` +
            'Mỗi trạng thái phải hiển thị được một thứ gì đó cho người dùng.',
        );
      }
    } finally {
      // Always taken down, including on failure, so the next test starts clean.
      result.unmount?.();
    }
  }
}
