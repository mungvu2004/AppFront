/**
 * Lượt kiểm của panel lịch sử S-34, dựng SONG SONG với `HistoryPanel.tsx`.
 *
 * Bốn bộ khẳng định dùng chung của repo cộng năm phép nghiệm thu riêng của S-34
 * — trong đó `[N6]` là khẳng định CẤM: cây DOM không được rò rỉ mã máy (mã
 * lệnh, tên hàm, `JSON.stringify`, `typeof`) ra chữ người dùng đọc được.
 *
 * Dữ liệu bảy trạng thái đến từ `historyPanelScenarios.ts` — một nguồn duy
 * nhất dùng chung với `HistoryPanel.stories.tsx` (R-70): bài kiểm không tự bịa
 * kịch bản tại chỗ.
 */

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import {
  createSevenStateScenarios,
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
} from '@/lib/testing/sevenStateScenarios';

import { HistoryPanel } from './HistoryPanel';
import {
  createHistoryPanelScenarios,
  createPartialArchivedProps,
  createPartialAtStepLimitProps,
  SUCCESS_SCENARIO_ITEM_IDS,
  type HistoryPanelScenario,
} from './historyPanelScenarios';
import { HISTORY_PANEL_TEST_IDS, HISTORY_UNDONE_ITEM_CLASS } from './historyPanelTypes';
import type { HistoryPanelProps } from './historyPanelTypes';

const SCREEN_DIR = 'src/screens/viewer/HistoryPanel';
const REPORT = '[HISTORY-PANEL]';

const SCENARIOS: readonly HistoryPanelScenario[] = createHistoryPanelScenarios();

/** Props đã dựng sẵn của một trạng thái, hoặc một lời từ chối rõ ràng. */
function propsOf(state: SevenState): HistoryPanelProps {
  const found = SCENARIOS.find((scenario) => scenario.state === state);

  if (found === undefined) {
    throw new Error(`Chưa có kịch bản cho trạng thái "${SEVEN_STATE_LABELS[state]}".`);
  }

  return found.props;
}

/* -------------------------------------------------------------------------- */
/* [G1..G4] Bốn bộ khẳng định dùng chung.                                      */
/* -------------------------------------------------------------------------- */

describe('[G] bốn bộ khẳng định dùng chung', () => {
  it('[G1] expectSevenStates — bảy trên bảy, không trạng thái nào ra màn trắng (A11)', () => {
    const rendered: SevenState[] = [];

    expectSevenStates((scenario) => {
      const state = scenario.state;
      const { container, unmount } = render(<HistoryPanel {...propsOf(state)} />);

      rendered.push(state);

      return { container, unmount };
    }, createSevenStateScenarios());

    console.log(
      `${REPORT}[G1] expectSevenStates = ${String(rendered.length)}/${String(SEVEN_STATES.length)} — ` +
        rendered.map((state) => SEVEN_STATE_LABELS[state]).join(', '),
    );

    expect(rendered).toStrictEqual([...SEVEN_STATES]);
  });

  it('[G2] expectAccessible — bàn phím là đường đi hạng nhất (R-72/A12)', () => {
    let checked = 0;

    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<HistoryPanel {...propsOf(state)} />);

      expect(() => {
        expectAccessible(container);
      }, `trạng thái "${SEVEN_STATE_LABELS[state]}" hỏng khả năng tiếp cận`).not.toThrow();

      checked += 1;
      unmount();
    }

    console.log(`${REPORT}[G2] expectAccessible = ${String(checked)}/${String(SEVEN_STATES.length)}`);
  });

  it('[G3] expectVietnamese — không sót tiếng Anh, không mất dấu (R-72)', () => {
    let checked = 0;

    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<HistoryPanel {...propsOf(state)} />);

      expect(() => {
        expectVietnamese(container);
      }, `trạng thái "${SEVEN_STATE_LABELS[state]}" còn chuỗi chưa phải tiếng Việt có dấu`).not.toThrow();

      checked += 1;
      unmount();
    }

    console.log(`${REPORT}[G3] expectVietnamese = ${String(checked)}/${String(SEVEN_STATES.length)}`);
  });

  it('[G4] expectNoRawColor — cả thư mục màn, màu chỉ đến từ token (A1)', () => {
    expect(() => {
      expectNoRawColor(SCREEN_DIR);
    }).not.toThrow();

    console.log(`${REPORT}[G4] expectNoRawColor = 0 mã màu thô trong ${SCREEN_DIR}`);
  });
});

/* -------------------------------------------------------------------------- */
/* [N1] Luật cốt lõi — hoàn tác không bao giờ phá huỷ.                        */
/* -------------------------------------------------------------------------- */

describe('[N1] luật cốt lõi — mục đã hoàn tác vẫn còn nhìn thấy', () => {
  it('tổng số mục còn nhìn thấy không đổi, ba mục cuối mang HISTORY_UNDONE_ITEM_CLASS', () => {
    const props = propsOf('success');
    const { getAllByTestId } = render(<HistoryPanel {...props} />);
    const items = getAllByTestId(HISTORY_PANEL_TEST_IDS.item);

    console.log(
      `${REPORT}[N1] mục còn nhìn thấy = ${String(items.length)} (mô hình nói ${String(props.visibleCount)})`,
    );

    expect(items).toHaveLength(props.visibleCount);

    const lastThree = items.slice(-3);
    const rest = items.slice(0, items.length - 3);

    for (const item of lastThree) {
      expect(item.className).toEqual(expect.stringContaining(HISTORY_UNDONE_ITEM_CLASS));
    }

    for (const item of rest) {
      expect(item.className).not.toEqual(expect.stringContaining(HISTORY_UNDONE_ITEM_CLASS));
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [N2] Mục có diff hiện cả hai vế.                                            */
/* -------------------------------------------------------------------------- */

describe('[N2] mục có diff', () => {
  it('hiện cả beforeText lẫn afterText', () => {
    const props = propsOf('success');
    const { getAllByTestId } = render(<HistoryPanel {...props} />);
    const diffs = getAllByTestId(HISTORY_PANEL_TEST_IDS.itemDiff);
    const diffText = diffs.map((el) => el.textContent ?? '').join(' | ');

    console.log(`${REPORT}[N2] diff hiện = "${diffText}"`);

    expect(diffs.length).toBeGreaterThan(0);
    expect(diffText).toContain('110 mm');
    expect(diffText).toContain('220 mm');
  });
});

/* -------------------------------------------------------------------------- */
/* [N3] Mục theo lô mở ra thành các mục con.                                   */
/* -------------------------------------------------------------------------- */

describe('[N3] mục theo lô', () => {
  it('bấm mở lô gọi onToggleBatch, và khi isExpanded=true thì các mục con hiện ra', () => {
    const props = propsOf('success');
    const toggled: string[] = [];

    const { getAllByTestId, rerender } = render(
      <HistoryPanel
        {...props}
        onToggleBatch={(itemId: string) => {
          toggled.push(itemId);
        }}
      />,
    );

    const toggles = getAllByTestId(HISTORY_PANEL_TEST_IDS.batchToggle);

    expect(toggles.length).toBeGreaterThan(0);

    fireEvent.click(toggles[0] as HTMLElement);

    console.log(`${REPORT}[N3] onToggleBatch = [${toggled.join(', ')}]`);

    expect(toggled).toStrictEqual([SUCCESS_SCENARIO_ITEM_IDS.batchItemId]);

    /*
     * Panel là view thuần (mục D): nó không tự giữ trạng thái "đang mở". Mở
     * lô thật là hook đổi `isExpanded` rồi truyền lại props mới — bài kiểm mô
     * phỏng đúng bước đó bằng cách vẽ lại với `isExpanded: true`.
     */
    const expandedGroups = props.groups.map((day) => ({
      ...day,
      sessions: day.sessions.map((session) => ({
        ...session,
        items: session.items.map((item) =>
          item.kind === 'batch' && item.id === SUCCESS_SCENARIO_ITEM_IDS.batchItemId
            ? { ...item, isExpanded: true }
            : item,
        ),
      })),
    }));

    rerender(<HistoryPanel {...props} groups={expandedGroups} />);

    const children = getAllByTestId(HISTORY_PANEL_TEST_IDS.batchChild);

    console.log(`${REPORT}[N3] mục con hiện ra sau khi mở = ${String(children.length)}`);

    expect(children).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* [N4] Không có quyền nhảy thì không nút nhảy nào.                            */
/* -------------------------------------------------------------------------- */

describe('[N4] canJump = false', () => {
  it('không có nút nhảy nào trên màn', () => {
    const props = propsOf('forbidden');

    expect(props.canJump).toBe(false);

    const { queryAllByTestId } = render(<HistoryPanel {...props} />);
    const jumpButtons = queryAllByTestId(HISTORY_PANEL_TEST_IDS.jumpButton);

    console.log(`${REPORT}[N4] nút nhảy khi không có quyền = ${String(jumpButtons.length)}`);

    expect(jumpButtons).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* [N5] Mọi mục dẫn tới được đối tượng của nó.                                 */
/* -------------------------------------------------------------------------- */

describe('[N5] mỗi mục dẫn tới được đối tượng của nó', () => {
  it('mỗi mục có ít nhất một entityLink, bấm vào gọi onSelectEntity', () => {
    const props = propsOf('success');
    const selected: string[] = [];

    const { getAllByTestId } = render(
      <HistoryPanel
        {...props}
        onSelectEntity={(entityId: string) => {
          selected.push(entityId);
        }}
      />,
    );

    const items = getAllByTestId(HISTORY_PANEL_TEST_IDS.item);
    const links = getAllByTestId(HISTORY_PANEL_TEST_IDS.entityLink);

    console.log(`${REPORT}[N5] mục = ${String(items.length)} · entityLink = ${String(links.length)}`);

    expect(links.length).toBeGreaterThanOrEqual(items.length);

    fireEvent.click(links[0] as HTMLElement);

    expect(selected).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* [N6] Khẳng định CẤM — không rò rỉ mã máy ra chữ người dùng đọc.             */
/* -------------------------------------------------------------------------- */

describe('[N6] cấm rò rỉ mã máy', () => {
  it('cây DOM không chứa commandId, JSON.stringify, typeof, mã lệnh "C-", hay tên hàm', () => {
    const props = propsOf('success');
    const { container } = render(<HistoryPanel {...props} />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/commandId/u);
    expect(html).not.toMatch(/JSON\.stringify/u);
    expect(html).not.toMatch(/typeof/u);
    expect(html).not.toMatch(/\bC-\d/u);

    const forbiddenFunctionNames = [
      'onCategoryChange',
      'onActorChange',
      'onJumpTo',
      'onHoverItem',
      'onSelectEntity',
      'onToggleBatch',
      'onToggleCollapse',
      'onLoadMore',
      'onRetry',
      'useHistoryPanel',
    ];

    for (const fnName of forbiddenFunctionNames) {
      expect(html).not.toContain(fnName);
    }

    console.log(`${REPORT}[N6] không tìm thấy commandId / JSON.stringify / typeof / "C-" / tên hàm`);
  });
});

/* -------------------------------------------------------------------------- */
/* [N7] Trạng thái "một phần" — cả hai HistoryPartialReason.                   */
/* -------------------------------------------------------------------------- */

describe('[N7] một phần — cả hai lý do đều dựng được', () => {
  it.each([
    ['at-step-limit', createPartialAtStepLimitProps()],
    ['archived', createPartialArchivedProps()],
  ] as const)('lý do "%s" render không lỗi, không màn trắng', (_reason, props) => {
    const { container } = render(<HistoryPanel {...props} />);

    expect(container.childElementCount).toBeGreaterThan(0);
  });
});
