import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_REPORTED_EVENT, type ErrorTelemetryDetail } from '@/lib/errors';
import { expectSevenStates, type ScreenRenderResult } from '@/lib/testing/expectSevenStates';
import {
  createSevenStateScenarios,
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import { createScreenErrorRecorder, describeScreenError } from '../screenErrorBoundary';

/**
 * The boundary's core and the seven-state helper, tested without React.
 *
 * Neither depends on a component, and `src/lib/**` may not import React anyway,
 * so the fake screen below is four lines of DOM. That is not a workaround — a
 * helper that needs a real component to be tested would be a helper screens
 * cannot trust.
 */

/* -------------------------------------------------------------------------- */
/* Telemetry, watched.                                                          */
/* -------------------------------------------------------------------------- */

let recorded: ErrorTelemetryDetail[] = [];

const collect = (event: Event): void => {
  recorded.push((event as CustomEvent<ErrorTelemetryDetail>).detail);
};

beforeEach(() => {
  recorded = [];
  window.addEventListener(ERROR_REPORTED_EVENT, collect);
});

afterEach(() => {
  window.removeEventListener(ERROR_REPORTED_EVENT, collect);
});

/* -------------------------------------------------------------------------- */
/* Describing a failure.                                                        */
/* -------------------------------------------------------------------------- */

describe('describeScreenError', () => {
  it('turns an unknown throw into Vietnamese a person can act on', () => {
    const report = describeScreenError(new Error('network: fetch failed'));

    expect(report.appError.kind).toBe('network');
    expect(report.description.title).toBe('Mất kết nối');
    expect(report.description.description).not.toBe('');
    expect(report.description.primaryButtonLabel).toBe('Thử lại');
    expect(report.retryable).toBe(true);
  });

  it('describes a failure that is not worth retrying as such', () => {
    const report = describeScreenError(new Error('403 forbidden'));

    expect(report.appError.kind).toBe('forbidden');
    expect(report.retryable).toBe(false);
    expect(report.description.title).not.toBe('');
  });

  it('never throws, whatever was thrown at it', () => {
    for (const thrown of [null, undefined, 'vỡ', 0, { weird: true }, new Error('')]) {
      const report = describeScreenError(thrown);

      expect(typeof report.description.title).toBe('string');
      expect(typeof report.appError.kind).toBe('string');
    }
  });

  it('records nothing on its own, so React may call it more than once', () => {
    describeScreenError(new Error('network: fetch failed'));
    describeScreenError(new Error('network: fetch failed'));

    expect(recorded).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Recording it — always, and exactly once.                                     */
/* -------------------------------------------------------------------------- */

describe('createScreenErrorRecorder', () => {
  it('records a caught error exactly once, however often it is received', () => {
    const recorder = createScreenErrorRecorder('qc');
    const error = new Error('network: fetch failed');

    recorder.receive(error);
    recorder.receive(error);
    recorder.receive(error);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.appError.kind).toBe('network');
    expect(recorded[0]?.context.screenId).toBe('qc');
  });

  it('describes the error every time, even when it records only once', () => {
    const recorder = createScreenErrorRecorder('qc');
    const error = new Error('network: fetch failed');

    expect(recorder.receive(error).description.title).toBe('Mất kết nối');
    expect(recorder.receive(error).description.title).toBe('Mất kết nối');
    expect(recorded).toHaveLength(1);
  });

  it('records the next failure again once the screen has been retried', () => {
    const recorder = createScreenErrorRecorder('qc');
    const error = new Error('network: fetch failed');

    recorder.receive(error);
    recorder.reset();
    recorder.receive(error);

    expect(recorded).toHaveLength(2);
  });

  it('records a different error even without a reset', () => {
    const recorder = createScreenErrorRecorder('qc');

    recorder.receive(new Error('network: fetch failed'));
    recorder.receive(new Error('403 forbidden'));

    expect(recorded.map((entry) => entry.appError.kind)).toEqual(['network', 'forbidden']);
  });

  it('keeps two broken screens apart', () => {
    const error = new Error('network: fetch failed');

    createScreenErrorRecorder('qc').receive(error);
    createScreenErrorRecorder('upload').receive(error);

    expect(recorded.map((entry) => entry.context.screenId)).toEqual(['qc', 'upload']);
  });

  it('never swallows an error silently, even when telemetry itself fails', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => {
      throw new Error('telemetry down');
    });
    const shout = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const report = createScreenErrorRecorder('qc').receive(new Error('network: fetch failed'));

      expect(shout).toHaveBeenCalledTimes(1);
      expect(report.description.title).toBe('Mất kết nối');
    } finally {
      dispatch.mockRestore();
      shout.mockRestore();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* A fake screen, built from DOM rather than from a component.                  */
/* -------------------------------------------------------------------------- */

/** How a fake screen behaves in one state. */
type FakeScreenBehaviour = 'render' | 'blank' | 'throw';

/**
 * A screen made of `document.createElement`.
 *
 * `states` says what it does in each of the seven; anything not listed renders
 * normally. This is what lets the helper be tested against a screen that is
 * deliberately broken, which no real component would agree to be.
 */
function createFakeScreen(states: Partial<Record<SevenState, FakeScreenBehaviour>> = {}) {
  const rendered: SevenState[] = [];

  const render = (scenario: SevenStateScenario): ScreenRenderResult => {
    rendered.push(scenario.state);
    const behaviour = states[scenario.state] ?? 'render';

    if (behaviour === 'throw') {
      throw new Error(`màn hình vỡ ở trạng thái ${scenario.state}`);
    }

    const container = document.createElement('div');

    if (behaviour === 'render') {
      const body = document.createElement('p');
      body.textContent = `${scenario.label} — ${String(scenario.rows.length)}/${String(scenario.totalCount)}`;
      container.appendChild(body);
    }

    return { container, unmount: () => container.remove() };
  };

  return { render, rendered };
}

/* -------------------------------------------------------------------------- */
/* The seven scenarios.                                                         */
/* -------------------------------------------------------------------------- */

describe('createSevenStateScenarios', () => {
  it('always produces all seven, in the order of invariant A11', () => {
    expect(createSevenStateScenarios().map((scenario) => scenario.state)).toEqual([...SEVEN_STATES]);
  });

  it('names each state in Vietnamese', () => {
    for (const scenario of createSevenStateScenarios()) {
      expect(scenario.label).toBe(SEVEN_STATE_LABELS[scenario.state]);
    }
  });

  it('uses the standard sample set, and makes each state actually different', () => {
    const byState = new Map(createSevenStateScenarios().map((scenario) => [scenario.state, scenario]));

    expect(byState.get('success')?.rows).toHaveLength(48);
    expect(byState.get('partial')?.rows).toHaveLength(14);
    expect(byState.get('partial')?.totalCount).toBe(48);
    expect(byState.get('empty')?.rows).toHaveLength(0);
    expect(byState.get('loading')?.isLoading).toBe(true);
    expect(byState.get('collapsed')?.isCollapsed).toBe(true);
    expect(byState.get('forbidden')?.canView).toBe(false);
    expect(byState.get('error')?.error).toBeInstanceOf(Error);
  });

  it('carries an error the boundary can classify and offer a retry for', () => {
    const scenario = createSevenStateScenarios().find((candidate) => candidate.state === 'error');
    const report = describeScreenError(scenario?.error);

    expect(report.retryable).toBe(true);
  });

  it('takes per-state patches without letting one state impersonate another', () => {
    const scenarios = createSevenStateScenarios({
      totalCount: 4,
      partialCount: 2,
      createRow: (index) => ({ id: `L-${String(index)}`, label: `Tầng ${String(index)}` }),
      overrides: { empty: { state: 'success', totalCount: 999 } as Partial<SevenStateScenario> },
    });

    expect(scenarios.map((scenario) => scenario.state)).toEqual([...SEVEN_STATES]);
    expect(scenarios.find((scenario) => scenario.state === 'success')?.rows).toHaveLength(4);
    expect(scenarios.find((scenario) => scenario.state === 'partial')?.rows).toHaveLength(2);
    expect(scenarios.find((scenario) => scenario.state === 'empty')?.totalCount).toBe(999);
  });
});

/* -------------------------------------------------------------------------- */
/* The assertion itself.                                                        */
/* -------------------------------------------------------------------------- */

describe('expectSevenStates', () => {
  it('passes a screen that renders something in every state', () => {
    const screen = createFakeScreen();

    expect(() => {
      expectSevenStates(screen.render, createSevenStateScenarios());
    }).not.toThrow();

    expect(screen.rendered).toEqual([...SEVEN_STATES]);
  });

  it('fails when the empty state is missing, and says which one', () => {
    const withoutEmpty = createSevenStateScenarios().filter((scenario) => scenario.state !== 'empty');

    expect(() => {
      expectSevenStates(createFakeScreen().render, withoutEmpty);
    }).toThrow(/thiếu 1 trong bảy trạng thái — "rỗng"/u);
  });

  it('fails for any one of the seven going missing, not just the easy ones', () => {
    for (const missing of SEVEN_STATES) {
      const scenarios = createSevenStateScenarios().filter((scenario) => scenario.state !== missing);

      expect(() => {
        expectSevenStates(createFakeScreen().render, scenarios);
      }).toThrow(new RegExp(`"${SEVEN_STATE_LABELS[missing]}"`, 'u'));
    }
  });

  it('refuses seven scenarios that cover only six states', () => {
    const scenarios = createSevenStateScenarios();
    const duplicated = [...scenarios.filter((scenario) => scenario.state !== 'collapsed'), scenarios[0]].filter(
      (scenario): scenario is SevenStateScenario => scenario !== undefined,
    );

    expect(duplicated).toHaveLength(7);
    expect(() => {
      expectSevenStates(createFakeScreen().render, duplicated);
    }).toThrow(/trạng thái bị lặp/u);
  });

  it('rejects an empty list rather than passing a screen with no states at all', () => {
    expect(() => {
      expectSevenStates(createFakeScreen().render, []);
    }).toThrow(/thiếu 7 trong bảy trạng thái/u);
  });

  it('fails when a state renders a white screen, and names it', () => {
    const screen = createFakeScreen({ forbidden: 'blank' });

    expect(() => {
      expectSevenStates(screen.render, createSevenStateScenarios());
    }).toThrow(/trạng thái "không có quyền" dựng ra màn hình trắng/u);
  });

  it('fails when a state throws instead of rendering, and keeps the reason', () => {
    const screen = createFakeScreen({ partial: 'throw' });

    expect(() => {
      expectSevenStates(screen.render, createSevenStateScenarios());
    }).toThrow(/trạng thái "một phần" làm màn hình ném lỗi — Error: màn hình vỡ ở trạng thái partial/u);
  });

  it('takes the screen down again between states, including after a failure', () => {
    const unmounted: SevenState[] = [];
    const render = (scenario: SevenStateScenario): ScreenRenderResult => {
      const container = document.createElement('div');

      if (scenario.state !== 'error') {
        container.appendChild(document.createElement('p')).textContent = scenario.label;
      }

      return { container, unmount: () => unmounted.push(scenario.state) };
    };

    expect(() => {
      expectSevenStates(render, createSevenStateScenarios());
    }).toThrow(/màn hình trắng/u);

    // Everything up to and including the failing state is cleaned up.
    expect(unmounted).toEqual(['empty', 'loading', 'partial', 'error']);
  });

  it('accepts a state with no text, because a loading skeleton has none', () => {
    const render = (): ScreenRenderResult => {
      const container = document.createElement('div');
      container.appendChild(document.createElement('div'));

      return { container };
    };

    expect(() => {
      expectSevenStates(render, createSevenStateScenarios());
    }).not.toThrow();
  });

  it('works with a renderer that offers no unmount at all', () => {
    const render = (scenario: SevenStateScenario): ScreenRenderResult => {
      const container = document.createElement('div');
      container.textContent = scenario.label;

      return { container };
    };

    expect(() => {
      expectSevenStates(render, createSevenStateScenarios());
    }).not.toThrow();
  });
});
