/**
 * Bộ kiểm của khối phím tắt — T5.
 *
 * Phép kiểm quan trọng nhất ở đây là {@link SHORTCUT_COUNT_TEST}: **số hàng vẽ
 * ra trên màn** phải bằng **số mục `buildGlobalShortcuts` khai**. Cả hai vế đều
 * đo lúc chạy — không vế nào là một con số gõ vào test. Một con số gõ tay ở đây
 * chính là cái nguồn sai lệch mà luật "không viết tay danh sách phím tắt" cấm,
 * chỉ dời sang thư mục khác; và nó sẽ vẫn xanh vào đúng ngày I-01 thêm phím tắt
 * thứ bảy mà màn này quên vẽ.
 *
 * `buildGlobalShortcuts` được gọi với sáu hàm rỗng: khối này **đếm**, nó không
 * đăng ký gì.
 */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildGlobalShortcuts,
  formatCombo,
  parseCombo,
  type GlobalShortcutHandlers,
} from '@/lib/input/shortcutRegistry';
import { durationSeconds } from '@/lib/motion';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';

import { ShortcutsSection, type ShortcutsSectionProps } from './ShortcutsSection';
import { EMPTY_ACCOUNT_DRAFT, type AccountDraftPort } from './accountDraft';
import { buildShortcutRows, useAccountTables } from './useAccountTables';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

const noop = (): void => undefined;

/** Sáu hàm rỗng — cùng thứ viewmodel dùng, và cùng lý do: chỉ để đếm. */
const COUNTING_HANDLERS: GlobalShortcutHandlers = {
  undo: noop,
  redo: noop,
  save: noop,
  openSearch: noop,
  openShortcutHelp: noop,
  closeTopLayer: noop,
};

/** Nguồn sự thật của I-01, đọc lúc chạy. Không có con số nào ở đây. */
const REGISTRY_COUNT = buildGlobalShortcuts(COUNTING_HANDLERS).length;

const SHORTCUT_COUNT_TEST = 'số hàng phím tắt vẽ ra bằng số mục buildGlobalShortcuts khai';

const port: AccountDraftPort = {
  saved: EMPTY_ACCOUNT_DRAFT,
  stage: noop,
};

/** Props của view, dựng thẳng tay — mục D: view không cần hook nào để test. */
function viewProps(overrides: Partial<ShortcutsSectionProps> = {}): ShortcutsSectionProps {
  return {
    query: '',
    onQueryChange: noop,
    rows: buildShortcutRows(),
    countLabel: 'Đang hiện đủ danh sách phím tắt.',
    emptyMessage: 'Không có phím tắt nào khớp với ô tìm.',
    rowMotion: { layout: 'position', transition: { duration: durationSeconds('standard') } },
    ...overrides,
  };
}

/** Hàng dữ liệu, tức mọi `<tr>` trừ hàng tiêu đề. */
function bodyRows(container: HTMLElement): HTMLTableRowElement[] {
  return Array.from(container.querySelectorAll('tbody tr'));
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'matchMedia');
});

/* -------------------------------------------------------------------------- */
/* Con số nghiệm thu.                                                          */
/* -------------------------------------------------------------------------- */

describe('đối chiếu số phím tắt', () => {
  it(SHORTCUT_COUNT_TEST, () => {
    const { container } = render(<ShortcutsSection {...viewProps()} />);

    const rendered = bodyRows(container).length;

    // In cả hai số để lượt nghiệm thu đọc được mà không phải mở test.
    console.log(
      `[T5] phím tắt hiển thị = ${String(rendered)} · mục trong registry = ${String(REGISTRY_COUNT)}`,
    );

    expect(rendered).toBe(REGISTRY_COUNT);
    expect(REGISTRY_COUNT).toBeGreaterThan(0);
  });

  it('viewmodel dựng danh sách từ I-01, không từ một mảng viết tay', () => {
    const rows = buildShortcutRows();
    const definitions = buildGlobalShortcuts(COUNTING_HANDLERS);

    expect(rows).toHaveLength(definitions.length);
    expect(rows.map((row) => row.id)).toEqual(definitions.map((definition) => definition.id));

    // Mỗi tổ hợp in ra đúng cách `formatCombo(parseCombo(...))` in.
    for (const [index, definition] of definitions.entries()) {
      expect(rows[index]?.combo).toBe(formatCombo(parseCombo(definition.combo)));
      expect(rows[index]?.keys.join('+')).toBe(rows[index]?.combo);
      expect(rows[index]?.description).toBe(definition.description);
    }
  });

  it('viewmodel giao đủ ngần ấy hàng cho view khi ô tìm còn trống', () => {
    const { result } = renderHook(() => useAccountTables(port));

    expect(result.current.shortcuts.rows).toHaveLength(REGISTRY_COUNT);
  });
});

/* -------------------------------------------------------------------------- */
/* View.                                                                       */
/* -------------------------------------------------------------------------- */

describe('bảng phím tắt', () => {
  it('hai cột, chỉ đọc: không nút, không ô nhập nào trong bảng', () => {
    const { container } = render(<ShortcutsSection {...viewProps()} />);

    const headers = screen.getAllByRole('columnheader');

    expect(headers.map((cell) => cell.textContent)).toEqual(['tổ hợp phím', 'việc']);

    const table = container.querySelector('table');

    expect(table).not.toBeNull();
    expect(table?.querySelectorAll('button, input, a[href], select, textarea')).toHaveLength(0);
  });

  it('vẽ mỗi phím trong tổ hợp bằng một Kbd', () => {
    const { container } = render(<ShortcutsSection {...viewProps()} />);

    const rows = buildShortcutRows();
    const expectedKbdCount = rows.reduce((total, row) => total + row.keys.length, 0);

    expect(container.querySelectorAll('kbd')).toHaveLength(expectedKbdCount);

    // `Ctrl+Shift+Z` in ra thành ba phím rời, không thành một chuỗi.
    const redo = rows.find((row) => row.id === 'global.redo');

    expect(redo).toBeDefined();
    expect(redo?.keys.length).toBeGreaterThan(1);
  });

  it('gõ vào ô tìm báo lên ngay từng ký tự, không đợi Enter', () => {
    const onQueryChange = vi.fn();

    render(<ShortcutsSection {...viewProps({ onQueryChange })} />);

    fireEvent.change(screen.getByLabelText('tìm phím tắt'), { target: { value: 'hoàn' } });

    expect(onQueryChange).toHaveBeenCalledWith('hoàn');
  });

  it('không khớp gì thì nói ra, chứ không để lại một bảng trống', () => {
    const { container } = render(<ShortcutsSection {...viewProps({ rows: [], query: 'zzz' })} />);

    expect(bodyRows(container)).toHaveLength(1);
    expect(screen.getByText('Không có phím tắt nào khớp với ô tìm.')).toBeTruthy();
  });

  it('câu đếm nói ra được cho trình đọc màn hình', () => {
    render(<ShortcutsSection {...viewProps({ countLabel: 'Đang hiện 2 trong 6 phím tắt.' })} />);

    expect(screen.getByRole('status').textContent).toBe('Đang hiện 2 trong 6 phím tắt.');
  });

  it('chuỗi là tiếng Việt có dấu và cây render tiếp cận được', () => {
    const { container } = render(<ShortcutsSection {...viewProps()} />);

    expectVietnamese(container);
    expectAccessible(container);
  });

  it('file của khối không viết thẳng mã màu nào (A1)', () => {
    expectNoRawColor('src/screens/account/AccountSettings/ShortcutsSection.tsx');
  });
});

/* -------------------------------------------------------------------------- */
/* Lọc.                                                                        */
/* -------------------------------------------------------------------------- */

describe('ô tìm lọc ngay khi gõ', () => {
  it('lọc theo mô tả, và bỏ bớt hàng ngay lượt render kế', () => {
    const { result } = renderHook(() => useAccountTables(port));

    act(() => {
      result.current.shortcuts.onQueryChange('hoàn tác');
    });

    const rows = result.current.shortcuts.rows;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(REGISTRY_COUNT);

    for (const row of rows) {
      expect(row.description).toContain('hoàn tác');
    }
  });

  it('gõ không dấu vẫn tìm ra chữ có dấu', () => {
    const { result } = renderHook(() => useAccountTables(port));

    act(() => {
      result.current.shortcuts.onQueryChange('hoan tac');
    });

    expect(result.current.shortcuts.rows.length).toBeGreaterThan(0);
  });

  it('lọc được cả theo tổ hợp phím, không chỉ theo mô tả', () => {
    const { result } = renderHook(() => useAccountTables(port));
    // Tổ hợp đọc ra từ chính danh sách dẫn xuất — `parseCombo` chuẩn hoá
    // `Escape` thành `ESCAPE`, và một chuỗi gõ tay ở đây sẽ lệch theo.
    const closeTopLayer = buildShortcutRows().find((row) => row.id === 'global.closeTopLayer');
    const combo = closeTopLayer?.combo;

    expect(combo).toBeDefined();
    expect(combo).not.toContain('+');

    act(() => {
      result.current.shortcuts.onQueryChange(combo ?? '');
    });

    expect(result.current.shortcuts.rows.map((row) => row.id)).toEqual([closeTopLayer?.id]);
  });

  it('không khớp gì thì trả về danh sách rỗng và một câu đếm nói rõ điều đó', () => {
    const { result } = renderHook(() => useAccountTables(port));

    act(() => {
      result.current.shortcuts.onQueryChange('không có phím nào tên thế này');
    });

    expect(result.current.shortcuts.rows).toHaveLength(0);
    expect(result.current.shortcuts.countLabel).toContain('0');
  });

  it('xoá ô tìm thì đủ lại ngần ấy hàng — bộ lọc không phá danh sách gốc', () => {
    const { result } = renderHook(() => useAccountTables(port));

    act(() => {
      result.current.shortcuts.onQueryChange('đóng lớp');
    });
    act(() => {
      result.current.shortcuts.onQueryChange('');
    });

    expect(result.current.shortcuts.rows).toHaveLength(REGISTRY_COUNT);
  });

  it('câu đếm định dạng ở viewmodel, không ở view (A15)', () => {
    const { result } = renderHook(() => useAccountTables(port));

    expect(result.current.shortcuts.countLabel).toBe(
      `${String(REGISTRY_COUNT)} phím tắt đang có hiệu lực.`,
    );

    act(() => {
      result.current.shortcuts.onQueryChange('đóng lớp');
    });

    expect(result.current.shortcuts.countLabel).toBe(
      `Đang hiện 1 trong ${String(REGISTRY_COUNT)} phím tắt.`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Giảm chuyển động.                                                           */
/* -------------------------------------------------------------------------- */

/** `matchMedia` giả, trả lời đúng câu "giảm chuyển động". */
function stubReducedMotion(isReduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion') ? isReduced : false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

describe('bật giảm chuyển động', () => {
  it('tắt hẳn layout animation và đưa mọi thời lượng về 0', () => {
    stubReducedMotion(true);

    const { result } = renderHook(() => useAccountTables(port));

    expect(result.current.shortcuts.rowMotion).toEqual({
      layout: false,
      transition: { duration: 0 },
    });
  });

  it('không bật thì hàng xếp lại bằng đúng một nấc của thang chuyển động', () => {
    stubReducedMotion(false);

    const { result } = renderHook(() => useAccountTables(port));
    const rowMotion = result.current.shortcuts.rowMotion;

    expect(rowMotion.layout).toBe('position');
    // Không phải một con số viết tay: đúng `standard` của `src/lib/motion`.
    expect(rowMotion.transition.duration).toBe(durationSeconds('standard'));
    expect(rowMotion.transition.ease).toHaveLength(4);
  });

  it('view nhận sao thì vẽ vậy — bảng vẫn đủ hàng khi hoạt cảnh tắt', () => {
    const { container } = render(
      <ShortcutsSection
        {...viewProps({ rowMotion: { layout: false, transition: { duration: 0 } } })}
      />,
    );

    expect(bodyRows(container)).toHaveLength(REGISTRY_COUNT);
  });
});
