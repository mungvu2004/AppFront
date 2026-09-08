/**
 * Bộ kiểm của W6 cho màn `RuleSettings` — cài đặt bộ luật QC.
 *
 * ## Vì sao nhiều import ở đây đi qua `import()` thay vì `import … from …`
 *
 * `./RuleSettings` là việc của W5 (view) và `./useRuleSettings` là việc của W4
 * (hook) — tại thời điểm file này được viết, một hoặc cả hai CHƯA tồn tại trong
 * worktree này; ba worker lớp 2 dựng trên nhánh riêng rồi lớp gộp (W7) mới ghép
 * lại. Đã đo thật ở `RuleReport.test.tsx`: một `import` TĨNH của một chuỗi không
 * tồn tại làm Vite sập lúc transform và không một test nào trong cả file chạy
 * được. Giấu đường dẫn sau một biến, kèm `/* @vite-ignore *\/`, hoãn việc phân
 * giải sang đúng lúc CHẠY, nên một import hỏng chỉ làm hỏng ĐÚNG một `it`.
 *
 * Test không đụng `./RuleSettings` (số liệu thật từ sổ đăng ký, quét mã nguồn
 * tìm câu luật viết cứng) chạy và XANH ngay hôm nay; test cần view thật thì HỎNG
 * RIÊNG LẺ với "Failed to resolve" cho tới khi W7 gộp đủ ba file — ĐIỀU ĐÓ LÀ
 * BÌNH THƯỜNG ở lớp này, không phải lỗi của W6.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ALL_RULES } from '@/domain/rules/defaults';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import {
  SEVEN_STATES,
  createSevenStateScenarios,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import {
  ALL_DISABLED_WARNING,
  EDITABLE_CAPABILITIES,
  INDUSTRIAL_PRESET,
  READ_ONLY_CAPABILITIES,
  RULE_SETTINGS_ENABLED_RULE_COUNT,
  RULE_SETTINGS_TOTAL_RULE_COUNT,
  WALL_THICKNESS_THRESHOLD_OUT_OF_RANGE,
  buildRuleSettingsGroups,
  buildRuleSettingsProps,
} from './ruleSettingsFixtures';
import type { RuleSettingsProps, RuleSettingsStatus } from './types';

afterEach(() => {
  cleanup();
});

/* ==========================================================================
 * 0. Hạ tầng: nhập file cùng thư mục qua biến, không qua chuỗi tĩnh.
 * ========================================================================== */

/** Xem lời giải thích ở đầu file. */
async function importFromScreen<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

async function loadRuleSettingsView(): Promise<ComponentType<RuleSettingsProps>> {
  const mod = await importFromScreen<{ RuleSettings: ComponentType<RuleSettingsProps> }>(
    './RuleSettings',
  );

  return mod.RuleSettings;
}

/** Ánh xạ bảy trạng thái chung sang bảy giá trị `RuleSettingsStatus` (types.ts). */
const STATUS_OF_SEVEN_STATE: Readonly<Record<SevenStateScenario['state'], RuleSettingsStatus>> = {
  empty: 'empty',
  loading: 'loading',
  partial: 'partial',
  error: 'error',
  success: 'ready',
  forbidden: 'forbidden',
  collapsed: 'collapsed',
};

/** Một `RuleSettingsProps` hợp lệ cho mỗi kịch bản trong bảy trạng thái chung. */
function propsFor(scenario: SevenStateScenario): RuleSettingsProps {
  const status = STATUS_OF_SEVEN_STATE[scenario.state];
  const capabilities = status === 'forbidden' ? READ_ONLY_CAPABILITIES : EDITABLE_CAPABILITIES;

  return buildRuleSettingsProps({ status }, { capabilities });
}

/* ==========================================================================
 * A. Số luật THẬT từ sổ đăng ký — không đụng tới file của worker khác, nên đây
 *    là phần PHẢI XANH ngay bây giờ.
 * ========================================================================== */

describe('số luật thật từ sổ đăng ký, không viết tay 25 hay 23 ở đâu khác', () => {
  it('sổ đăng ký giữ đủ 25 luật, trong đó 23 luật đang bật theo mặc định', () => {
    console.log(
      `[W6] tổng số luật = ${String(RULE_SETTINGS_TOTAL_RULE_COUNT)} · số luật BẬT = ${String(RULE_SETTINGS_ENABLED_RULE_COUNT)}`,
    );

    expect(RULE_SETTINGS_TOTAL_RULE_COUNT).toBe(25);
    expect(RULE_SETTINGS_ENABLED_RULE_COUNT).toBe(23);
  });

  it('ROOM-HAS-DOOR và ROOM-MIN-AREA là hai luật duy nhất có supersededBy, và cả hai đang tắt', () => {
    const rows = buildRuleSettingsGroups().flatMap((group) => group.rows);
    const superseded = rows.filter((row) => row.supersededBy !== null);

    expect(superseded.map((row) => row.code).sort()).toEqual(['ROOM-HAS-DOOR', 'ROOM-MIN-AREA']);

    const byCode = new Map(rows.map((row) => [row.code, row]));

    expect(byCode.get('ROOM-HAS-DOOR')?.supersededBy).toBe('ROOM-NO-DOOR');
    expect(byCode.get('ROOM-MIN-AREA')?.supersededBy).toBe('ROOM-AREA-BELOW-MINIMUM');
    expect(byCode.get('ROOM-HAS-DOOR')?.enabled).toBe(false);
    expect(byCode.get('ROOM-MIN-AREA')?.enabled).toBe(false);
  });
});

describe('grep — CẤM "không khai báo lại danh sách luật trong màn"', () => {
  it('không file sản phẩm nào trong thư mục màn viết cứng câu luật (rule.name)', () => {
    const dir = 'src/screens/rules/RuleSettings';
    const productionFiles = readdirSync(dir).filter(
      (name) =>
        (name.endsWith('.ts') || name.endsWith('.tsx')) &&
        !name.endsWith('.test.tsx') &&
        !name.endsWith('.stories.tsx'),
    );

    const ruleSentences = ALL_RULES.map((rule) => rule.name);
    const offenders: string[] = [];

    for (const file of productionFiles) {
      const content = readFileSync(join(dir, file), 'utf8');

      for (const sentence of ruleSentences) {
        if (
          content.includes(`'${sentence}'`) ||
          content.includes(`"${sentence}"`) ||
          content.includes(`\`${sentence}\``)
        ) {
          offenders.push(`${file}: "${sentence}"`);
        }
      }
    }

    console.log(
      `[W6] file sản phẩm quét được trong thư mục (${String(productionFiles.length)}): ` +
        `${productionFiles.length > 0 ? productionFiles.join(', ') : '(chưa có — worker khác chưa commit vào worktree này)'}`,
    );
    console.log(
      `[W6] câu luật viết cứng: ${offenders.length === 0 ? 'không có' : offenders.join(' · ')}`,
    );

    expect(offenders).toEqual([]);
  });

  it('không một mã màu thô nào trong cả thư mục màn (bao gồm chính test này)', () => {
    expect(() => {
      expectNoRawColor('src/screens/rules/RuleSettings');
    }).not.toThrow();
  });
});

/* ==========================================================================
 * B. Bảy trạng thái (A11) — cần `RuleSettings` thật, nên là nhóm RED-cho-tới-W7.
 * ========================================================================== */

describe('A11 — bảy trạng thái của RuleSettings', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<RuleSettingsView {...propsFor(scenario)} />);
    }, createSevenStateScenarios());

    console.log(
      `[W6] expectSevenStates = ${String(covered.length)}/${String(SEVEN_STATES.length)} — ${covered.join(', ')}`,
    );

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* ==========================================================================
 * C. Tiếp cận được và toàn chữ tiếng Việt có dấu, trên cây render thật.
 * ========================================================================== */

describe('R-72 — expectAccessible và expectVietnamese trên cây render thật', () => {
  it('trạng thái "ready" tiếp cận được và toàn chữ tiếng Việt có dấu', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const props = buildRuleSettingsProps({ status: 'ready' });
    const { container } = render(<RuleSettingsView {...props} />);

    expectVietnamese(container);
    expectAccessible(container);
  });
});

/* ==========================================================================
 * D. Bảy điều cấm của đặc tả — mỗi cái một test (mục 2.(b) của nhiệm vụ).
 * ========================================================================== */

describe('2.(b).1 — đếm đúng số luật hiện ra và số luật đang bật', () => {
  it('hiện đủ 25 luật, trong đó 23 luật đang bật', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const props = buildRuleSettingsProps({ status: 'ready' });
    const rows = props.model.groups.flatMap((group) => group.rows);

    expect(rows).toHaveLength(25);
    expect(rows.filter((row) => row.enabled)).toHaveLength(23);

    const { container } = render(<RuleSettingsView {...props} />);

    for (const row of rows) {
      expect(screen.getByText(row.sentence)).toBeTruthy();
    }

    // Hai con số ở đầu màn chạy lên qua `useCountUp`, nên ở KHUNG HÌNH ĐẦU
    // header còn đọc là "0/0 luật đang bật" rồi mới chạy tới "23/25". Đọc
    // `textContent` ngay sau `render` là đọc đúng cái khung hình đó — màn in đủ
    // cả hai số, chỉ là chưa xong lượt chạy số. Khuôn này là khuôn đang chạy sẵn
    // của repo (`RuleReportSummary.tsx` dùng y hệt cho bốn số của màn S-31), nên
    // chỗ phải sửa là lúc đọc chứ không phải thứ được đòi: `waitFor` vẫn đòi
    // đúng cả "25" lẫn "23" xuất hiện thật trong DOM.
    await waitFor(() => {
      expect(container.textContent).toContain('25');
    });

    expect(container.textContent).toContain('23');
  });
});

describe('2.(b).2 — luật đã tắt vẫn còn trong DOM, ở độ mờ thấp', () => {
  it('ROOM-HAS-DOOR (đã tắt) vẫn hiện trong DOM và mang lớp giảm độ mờ', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const props = buildRuleSettingsProps({ status: 'ready' });
    const rows = props.model.groups.flatMap((group) => group.rows);
    const disabledRow = rows.find((row) => row.code === 'ROOM-HAS-DOOR');

    if (disabledRow === undefined) {
      throw new Error('không có dòng ROOM-HAS-DOOR trong bộ mẫu — buildRuleSettingsGroups lỗi');
    }

    expect(disabledRow.enabled).toBe(false);

    render(<RuleSettingsView {...props} />);

    const sentenceNode = screen.getByText(disabledRow.sentence);
    let dimmed = false;
    let current: HTMLElement | null = sentenceNode;

    while (current !== null) {
      if (/\bopacity-(?:[1-9][0-9]?|100)\b/.test(current.className)) {
        dimmed = true;
        break;
      }

      current = current.parentElement;
    }

    expect(
      dimmed,
      `luật đã tắt "${disabledRow.code}" phải mang một lớp opacity-* để nhìn thấy được ở độ mờ thấp`,
    ).toBe(true);
  });
});

describe('2.(b).3 — A7: không có nút Lưu nào trong màn', () => {
  /**
   * Bản đầu của phép đo này soát MỌI nút mang chữ "lưu", và nó bắt trúng một
   * thứ không phải nút Lưu: nhãn nhóm `circulation` của sổ đăng ký là
   * **"lưu thông"** (`RULE_GROUP_LABELS`), và màn không được đặt lại tên nhóm
   * của domain. Phép đo vì thế báo đỏ trên một màn KHÔNG hề có nút Lưu nào.
   *
   * Bản này soát đúng thứ A7 nói: không phần tử tương tác nào mở một lượt lưu
   * bằng tay. Thanh điều hướng bị loại khỏi phạm vi soát vì chữ trên đó là chữ
   * của domain, không phải chữ màn này chọn — và loại nó ra không nới lỏng gì:
   * một nút Lưu thật sẽ không bao giờ nằm trong `<nav>` mục lục.
   */
  it('màn "ready" không dựng nút nào mở một lượt lưu bằng tay', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const props = buildRuleSettingsProps({ status: 'ready' });
    const { container } = render(<RuleSettingsView {...props} />);

    const nav = container.querySelector('nav');
    const saveish = screen
      .queryAllByRole('button', { name: /\b(lưu|luu|save)\b/i })
      .filter((node) => nav === null || !nav.contains(node));

    expect(
      saveish.map((node) => node.textContent),
      'A7: màn tự lưu 800 ms sau thao tác cuối, không có nút Lưu nào',
    ).toEqual([]);

    // Và cũng không có nút nào ở bất cứ đâu mang đúng chữ "lưu" đứng một mình —
    // "lưu thông" là hai từ, nên phép soát này vẫn bắt được một nút Lưu thật.
    expect(screen.queryByRole('button', { name: /^\s*lưu\s*$/i })).toBeNull();
  });
});

describe('2.(b).4 — tắt toàn bộ luật thì câu cảnh báo hậu quả phải xuất hiện', () => {
  it('còn luật bật thì không có cảnh báo; tắt hết thì cảnh báo hậu quả hiện ra', async () => {
    const RuleSettingsView = await loadRuleSettingsView();

    const normalProps = buildRuleSettingsProps({ status: 'ready' });
    const { unmount } = render(<RuleSettingsView {...normalProps} />);

    expect(normalProps.model.disableAllWarning).toBeNull();
    expect(screen.queryByText(ALL_DISABLED_WARNING)).toBeNull();
    unmount();

    const disabledProps = buildRuleSettingsProps({ status: 'ready', allDisabled: true });

    expect(disabledProps.model.enabledRuleCount).toBe(0);
    expect(disabledProps.model.disableAllWarning).toBe(ALL_DISABLED_WARNING);

    render(<RuleSettingsView {...disabledProps} />);
    expect(screen.getByText(ALL_DISABLED_WARNING)).toBeTruthy();
  });
});

describe('2.(b).5 — mỗi dòng luật nói rõ số đối tượng đang bị ảnh hưởng', () => {
  it('impactCaption của cả 25 dòng khớp mẫu "Đang ảnh hưởng N đối tượng" và hiện trong DOM', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const props = buildRuleSettingsProps({ status: 'ready' });
    const rows = props.model.groups.flatMap((group) => group.rows);

    expect(rows).toHaveLength(25);

    for (const row of rows) {
      expect(row.impactCaption).toMatch(/^Đang ảnh hưởng [\d.]+ đối tượng$/);
    }

    render(<RuleSettingsView {...props} />);

    // `getByText` nổ với "Found multiple elements" ở đây, và đó là lỗi của phép
    // đo chứ không của màn: rất nhiều luật cùng mang đúng một câu
    // "Đang ảnh hưởng 0 đối tượng", nên câu ấy XUẤT HIỆN NHIỀU LẦN là điều đúng.
    // `getAllByText` đo được thứ cần đo, và đếm tổng số câu impact thành đúng 25
    // là một khẳng định CHẶT HƠN bản cũ: nó bắt cả trường hợp thiếu một dòng lẫn
    // trường hợp vẽ thừa một dòng.
    let captionNodeCount = 0;

    for (const row of rows) {
      const found = screen.getAllByText(row.impactCaption);

      expect(found.length).toBeGreaterThan(0);
    }

    for (const caption of new Set(rows.map((row) => row.impactCaption))) {
      captionNodeCount += screen.getAllByText(caption).length;
    }

    expect(captionNodeCount, 'đúng 25 câu "Đang ảnh hưởng N đối tượng" trong DOM').toBe(25);
  });
});

describe('2.(b).6 — ô ngưỡng chặn giá trị ngoài khoảng hợp lệ, nêu đúng cả hai đầu', () => {
  it('ngưỡng "bề dày tường tối thiểu" ngoài khoảng 10–200 hiện đúng câu lỗi đã giải, nêu cả hai đầu số', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const props = buildRuleSettingsProps({ status: 'ready' });
    const groupsWithBadThreshold = props.model.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) =>
        row.code === 'WALL-THICKNESS'
          ? { ...row, thresholds: [WALL_THICKNESS_THRESHOLD_OUT_OF_RANGE] }
          : row,
      ),
    }));

    const propsWithBadThreshold: RuleSettingsProps = {
      ...props,
      model: { ...props.model, groups: groupsWithBadThreshold },
    };

    render(<RuleSettingsView {...propsWithBadThreshold} />);

    const errorText = WALL_THICKNESS_THRESHOLD_OUT_OF_RANGE.error;

    if (errorText === null) {
      throw new Error('WALL_THICKNESS_THRESHOLD_OUT_OF_RANGE.error phải khác null trong bộ mẫu');
    }

    const errorNode = screen.getByText(errorText);

    expect(errorNode).toBeTruthy();
    // Kiểm cả hai đầu số của khoảng hợp lệ (10 và 200), không chỉ một đầu.
    expect(errorText).toContain(String(WALL_THICKNESS_THRESHOLD_OUT_OF_RANGE.min));
    expect(errorText).toContain(String(WALL_THICKNESS_THRESHOLD_OUT_OF_RANGE.max));
  });

  it('gõ vào ô ngưỡng "bề dày tường tối thiểu" gọi lên onChangeThreshold với đúng mã luật và khoá', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const onChangeThreshold = vi.fn();
    const props = buildRuleSettingsProps({ status: 'ready' }, { actions: { onChangeThreshold } });

    render(<RuleSettingsView {...props} />);

    const input = screen.getByLabelText(/bề dày tường tối thiểu/i);
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.blur(input);

    expect(onChangeThreshold).toHaveBeenCalled();
    const [calledCode, calledKey] = onChangeThreshold.mock.calls[0] ?? [];

    expect(calledCode).toBe('WALL-THICKNESS');
    expect(calledKey).toBe('minThicknessMm');
  });
});

describe('2.(b).7 — áp bộ luật sẵn "nhà xưởng": số luật đổi hiện TRƯỚC, có đường hoàn tác', () => {
  it('caption bộ "nhà xưởng" hiện số luật sẽ đổi trước khi bấm, và bấm gọi đúng onApplyPreset', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const onApplyPreset = vi.fn();
    const props = buildRuleSettingsProps({ status: 'ready' }, { actions: { onApplyPreset } });

    render(<RuleSettingsView {...props} />);

    const captionNode = screen.getByText(INDUSTRIAL_PRESET.caption);

    expect(captionNode).toBeTruthy();
    expect(INDUSTRIAL_PRESET.caption).toContain(String(INDUSTRIAL_PRESET.changedRuleCount));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(INDUSTRIAL_PRESET.label, 'i') }));
    expect(onApplyPreset).toHaveBeenCalledWith('industrial');
  });

  it('trước khi áp thì không có nút khôi phục mặc định; sau khi áp (isDefault=false) thì có, và bấm được', async () => {
    const RuleSettingsView = await loadRuleSettingsView();
    const beforeProps = buildRuleSettingsProps({ status: 'ready' });

    expect(beforeProps.model.isDefault).toBe(true);

    const { unmount } = render(<RuleSettingsView {...beforeProps} />);
    expect(screen.queryByRole('button', { name: /khôi phục mặc định/i })).toBeNull();
    unmount();

    const onRestoreDefaults = vi.fn();
    const afterProps = buildRuleSettingsProps({ status: 'ready' }, { actions: { onRestoreDefaults } });
    const appliedProps: RuleSettingsProps = {
      ...afterProps,
      model: {
        ...afterProps.model,
        isDefault: false,
        enabledRuleCount: afterProps.model.enabledRuleCount - INDUSTRIAL_PRESET.changedRuleCount,
      },
    };

    render(<RuleSettingsView {...appliedProps} />);

    const restoreButton = screen.getByRole('button', { name: /khôi phục mặc định/i });
    fireEvent.click(restoreButton);
    expect(onRestoreDefaults).toHaveBeenCalled();
  });
});
