import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_REPORTED_EVENT, type ErrorTelemetryDetail } from '@/lib/errors';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { createSevenStateScenarios, type SevenStateScenario } from '@/lib/testing/sevenStateScenarios';

import { ScreenErrorBoundary, type ScreenErrorFallback } from './ScreenErrorBoundary';

/**
 * The React half: does the boundary actually stop a crash, record it once, and
 * hand the screen back its own fallback?
 *
 * The logic is tested without React in `src/lib/screen-state/__tests__`. What is
 * left here is the part only a mounted component can show: that a child throwing
 * during render does not take the tree with it.
 */

let recorded: ErrorTelemetryDetail[] = [];
let consoleError: ReturnType<typeof vi.spyOn>;

const collect = (event: Event): void => {
  recorded.push((event as CustomEvent<ErrorTelemetryDetail>).detail);
};

beforeEach(() => {
  recorded = [];
  window.addEventListener(ERROR_REPORTED_EVENT, collect);
  // React writes the caught error to the console itself; that noise is not the
  // subject of these tests and would drown the run.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  window.removeEventListener(ERROR_REPORTED_EVENT, collect);
  consoleError.mockRestore();
});

function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error('network: fetch failed');
  }

  return <p>Màn hình chạy bình thường</p>;
}

/** The screen's own fallback. The boundary never draws one of these itself. */
function fallback({ report, retry }: ScreenErrorFallback): React.ReactNode {
  return (
    <div>
      <h2>{report.description.title}</h2>
      <p>{report.description.description}</p>
      {report.retryable ? (
        <button type="button" onClick={retry}>
          {report.description.primaryButtonLabel}
        </button>
      ) : null}
    </div>
  );
}

describe('ScreenErrorBoundary', () => {
  it('keeps a crashed screen from blanking the page, showing the caller fallback', () => {
    render(
      <ScreenErrorBoundary screenId="qc" renderFallback={fallback}>
        <Boom shouldThrow />
      </ScreenErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Mất kết nối' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('renders the screen untouched when nothing is wrong', () => {
    render(
      <ScreenErrorBoundary screenId="qc" renderFallback={fallback}>
        <Boom shouldThrow={false} />
      </ScreenErrorBoundary>,
    );

    expect(screen.getByText('Màn hình chạy bình thường')).toBeInTheDocument();
    expect(recorded).toHaveLength(0);
  });

  it('records the crash exactly once', () => {
    render(
      <ScreenErrorBoundary screenId="qc" renderFallback={fallback}>
        <Boom shouldThrow />
      </ScreenErrorBoundary>,
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.appError.kind).toBe('network');
    expect(recorded[0]?.context.screenId).toBe('qc');
  });

  it('tells the screen what happened, once', () => {
    const onError = vi.fn();

    render(
      <ScreenErrorBoundary screenId="qc" renderFallback={fallback} onError={onError}>
        <Boom shouldThrow />
      </ScreenErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ retryable: true });
  });

  it('mounts the screen again when the person retries', () => {
    function Recoverable(): React.ReactElement {
      const [broken, setBroken] = useState(true);

      return (
        <div>
          <button type="button" onClick={() => { setBroken(false); }}>
            Sửa nguồn dữ liệu
          </button>
          <ScreenErrorBoundary screenId="qc" renderFallback={fallback}>
            <Boom shouldThrow={broken} />
          </ScreenErrorBoundary>
        </div>
      );
    }

    render(<Recoverable />);
    expect(screen.getByRole('heading', { name: 'Mất kết nối' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sửa nguồn dữ liệu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByText('Màn hình chạy bình thường')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mất kết nối' })).not.toBeInTheDocument();
  });

  it('draws nothing of its own — the fallback is entirely the caller’s', () => {
    const { container } = render(
      <ScreenErrorBoundary screenId="qc" renderFallback={() => <span>chỉ có thế này</span>}>
        <Boom shouldThrow />
      </ScreenErrorBoundary>,
    );

    expect(container.innerHTML).toBe('<span>chỉ có thế này</span>');
  });
});

/* -------------------------------------------------------------------------- */
/* The helper, against a real React screen.                                     */
/* -------------------------------------------------------------------------- */

/** A screen written the way a later prompt would write one: seven states, all handled. */
function SampleScreen(scenario: SevenStateScenario): React.ReactElement {
  if (!scenario.canView) {
    return <p>Bạn không có quyền xem danh sách này.</p>;
  }

  if (scenario.error !== null) {
    return <p>Không tải được danh sách. Thử lại sau.</p>;
  }

  if (scenario.isLoading) {
    return <div aria-busy="true" />;
  }

  if (scenario.isCollapsed) {
    return <p>Đã thu gọn — {scenario.totalCount} dòng</p>;
  }

  if (scenario.rows.length === 0) {
    return <p>Chưa có dòng nào.</p>;
  }

  return (
    <ul>
      {scenario.rows.map((row) => (
        <li key={row.id}>{row.label}</li>
      ))}
      {scenario.rows.length < scenario.totalCount ? <li>Đang tải phần còn lại…</li> : null}
    </ul>
  );
}

describe('expectSevenStates, against a React screen', () => {
  it('passes a screen that handles all seven', () => {
    expect(() => {
      expectSevenStates((scenario) => render(<SampleScreen {...scenario} />), createSevenStateScenarios());
    }).not.toThrow();
  });

  it('fails the same screen with one branch removed', () => {
    function MissingEmptyState(scenario: SevenStateScenario): React.ReactElement | null {
      return scenario.state === 'empty' ? null : SampleScreen(scenario);
    }

    expect(() => {
      expectSevenStates(
        (scenario) => render(<MissingEmptyState {...scenario} />),
        createSevenStateScenarios(),
      );
    }).toThrow(/trạng thái "rỗng" dựng ra màn hình trắng/u);
  });
});
