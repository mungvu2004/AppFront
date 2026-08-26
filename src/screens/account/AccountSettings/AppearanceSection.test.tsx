/**
 * Bộ kiểm khối "giao diện" — của T4, và chỉ của T4.
 *
 * Hai nửa, đúng như mục D chia: phần trên dựng `AppearanceSection` thẳng từ
 * props và hỏi về thứ nhìn thấy; phần dưới dựng `useAccountPreferences` qua một
 * component dò và hỏi về thứ nó ghi ra — cổng lưu, store chủ đề, và thuộc tính
 * giảm chuyển động trên `<html>`.
 *
 * Ba con số nghiệm thu được soát ở đây: **40 và 36** (chiều cao dòng theo mật
 * độ) và **năm khoá O-02** (để chứng minh không cài đặt nào của màn này trùng
 * một khoá có sẵn — đó là toàn bộ lập luận của R2).
 */

import { readFileSync } from 'node:fs';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONTRAST_MINIMUM_BODY,
  checkContrast,
  parsePalette,
} from '@/lib/coloring/legend';
import type { ColorTokenName } from '@/lib/coloring/scales';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { renderWithProviders } from '@/lib/testing/render';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { FEATURE_FLAG_KEYS } from '@/lib/telemetry/flags';
import { useStore } from '@/store';

import { AppearanceSection, type AppearanceSectionProps } from './AppearanceSection';
import {
  EMPTY_ACCOUNT_DRAFT,
  type AccountDraft,
  type AccountDraftFields,
  type AccountDraftPort,
  type AccountDraftSection,
} from './accountDraft';
import {
  DENSITY_ROW_CLASS,
  DENSITY_ROW_HEIGHT_PX,
  REDUCED_MOTION_ATTRIBUTE,
  resolveTheme,
  useAccountPreferences,
  type AccountPreferencesModel,
} from './useAccountPreferences';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
  document.documentElement.classList.remove('dark');
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function props(overrides: Partial<AppearanceSectionProps> = {}): AppearanceSectionProps {
  return {
    theme: 'light',
    onThemeChange: vi.fn(),
    viewportDark: false,
    onViewportDarkChange: vi.fn(),
    reducedMotion: false,
    onReducedMotionChange: vi.fn(),
    showGrid: true,
    onShowGridChange: vi.fn(),
    density: 'comfortable',
    onDensityChange: vi.fn(),
    flashedField: null,
    rowClassName: DENSITY_ROW_CLASS.comfortable,
    motionOff: false,
    ...overrides,
  };
}

function rowOf(label: string): HTMLElement {
  const cell = screen.getByText(label);
  const row = cell.closest('div.flex.items-start');

  if (row === null) {
    throw new Error(`không tìm thấy hàng của nhãn "${label}"`);
  }

  return row as HTMLElement;
}

/* -------------------------------------------------------------------------- */
/* View.                                                                       */
/* -------------------------------------------------------------------------- */

describe('năm hàng của khối', () => {
  it('vẽ đủ năm nhãn, viết thường theo A6', () => {
    render(<AppearanceSection {...props()} />);

    for (const label of [
      'chủ đề',
      'dùng nền tối cho khung nhìn 3D',
      'giảm chuyển động',
      'hiện lưới 100 mm',
      'mật độ hiển thị',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('chú thích của nền tối 3D nói đúng câu đặc tả yêu cầu', () => {
    render(<AppearanceSection {...props()} />);

    expect(screen.getByText('Chỉ đổi màu vùng mô hình, giao diện vẫn sáng.')).toBeTruthy();
  });
});

describe('chủ đề — ba nhánh trên một điều khiển', () => {
  it('vẽ đúng ba lựa chọn, và nhánh đang chọn được đánh dấu', () => {
    render(<AppearanceSection {...props({ theme: 'system' })} />);

    const group = screen.getByRole('radiogroup', { name: 'chủ đề' });
    const items = group.querySelectorAll('button');

    expect(items).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'theo hệ thống' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('bấm một nhánh thì báo lên hook bằng định danh tiếng Anh', () => {
    const onThemeChange = vi.fn();
    render(<AppearanceSection {...props({ onThemeChange })} />);

    fireEvent.click(screen.getByRole('radio', { name: 'tối' }));

    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('phím mũi tên đi được giữa ba nhánh — A12', () => {
    const onThemeChange = vi.fn();
    render(<AppearanceSection {...props({ onThemeChange })} />);

    const group = screen.getByRole('radiogroup', { name: 'chủ đề' });

    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onThemeChange).toHaveBeenLastCalledWith('dark');

    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onThemeChange).toHaveBeenLastCalledWith('system');
  });
});

describe('ba công tắc', () => {
  it('mỗi công tắc báo lên hook giá trị đảo lại của nó', async () => {
    const onViewportDarkChange = vi.fn();
    const onReducedMotionChange = vi.fn();
    const onShowGridChange = vi.fn();

    render(
      <AppearanceSection
        {...props({ onViewportDarkChange, onReducedMotionChange, onShowGridChange })}
      />,
    );

    // `Toggle.toggle` là `async`, nên lượt cập nhật lạc quan của nó rơi vào một
    // microtask sau `fireEvent`. Không bọc thì React kêu "không nằm trong act".
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'dùng nền tối cho khung nhìn 3D' }));
      fireEvent.click(screen.getByRole('switch', { name: 'giảm chuyển động' }));
      fireEvent.click(screen.getByRole('switch', { name: 'hiện lưới 100 mm' }));
    });

    expect(onViewportDarkChange).toHaveBeenCalledWith(true);
    expect(onReducedMotionChange).toHaveBeenCalledWith(true);
    // `showGrid` vào màn ở trạng thái bật, nên lượt bấm đầu tắt nó.
    expect(onShowGridChange).toHaveBeenCalledWith(false);
  });
});

describe('mật độ hiển thị đổi chiều cao dòng giữa 40 và 36', () => {
  it('hai bảng khớp nhau, nên con số nghiệm thu và lớp Tailwind không lệch được', () => {
    expect(DENSITY_ROW_HEIGHT_PX.comfortable).toBe(40);
    expect(DENSITY_ROW_HEIGHT_PX.compact).toBe(36);
    expect(DENSITY_ROW_CLASS.comfortable).toBe(
      `min-h-[${String(DENSITY_ROW_HEIGHT_PX.comfortable)}px]`,
    );
    expect(DENSITY_ROW_CLASS.compact).toBe(`min-h-[${String(DENSITY_ROW_HEIGHT_PX.compact)}px]`);
  });

  it('lớp ấy tới được từng hàng', () => {
    render(<AppearanceSection {...props({ rowClassName: DENSITY_ROW_CLASS.compact })} />);

    expect(rowOf('chủ đề').className).toContain('min-h-[36px]');
    expect(rowOf('mật độ hiển thị').className).toContain('min-h-[36px]');
  });

  it('bấm một mức thì báo lên hook', () => {
    const onDensityChange = vi.fn();
    render(<AppearanceSection {...props({ onDensityChange })} />);

    fireEvent.click(screen.getByRole('radio', { name: 'gọn' }));

    expect(onDensityChange).toHaveBeenCalledWith('compact');
  });
});

describe('giảm chuyển động tắt mọi hoạt cảnh trong khối', () => {
  it('bật thì con trượt của SegmentedControl không còn được dựng', () => {
    const { container: withMotion, unmount } = render(<AppearanceSection {...props()} />);

    // Con trượt là phần tử framer duy nhất trong khối: `motion.div` tuyệt đối
    // phủ kín ô đang chọn. Nó chỉ tồn tại khi `layoutId` được truyền.
    expect(withMotion.querySelectorAll('.absolute.inset-0').length).toBeGreaterThan(0);
    unmount();

    const { container: withoutMotion } = render(
      <AppearanceSection {...props({ motionOff: true })} />,
    );

    expect(withoutMotion.querySelectorAll('.absolute.inset-0')).toHaveLength(0);
    // …và ô đang chọn vẫn nhìn thấy được, bằng nền tĩnh thay cho con trượt.
    expect(screen.getByRole('radio', { name: 'sáng' }).className).toContain('bg-bg-surface');
  });

  it('bật thì mọi hàng và mọi ô về duration-0, không còn nháy nền', () => {
    render(<AppearanceSection {...props({ motionOff: true, flashedField: 'theme' })} />);

    const row = rowOf('chủ đề');

    expect(row.className).toContain('duration-0');
    expect(row.className).not.toContain('bg-accent-wash');
    expect(screen.getByRole('radio', { name: 'sáng' }).className).toContain('duration-0');
    expect(screen.getByRole('radio', { name: 'sáng' }).className).not.toContain('duration-120');
    expect(row.className).not.toContain('duration-260');
    expect(row.className).not.toContain('duration-340');
  });

  it('tắt thì hàng vừa ghi nháy bg-accent-wash — một token, không phải mã màu thô (R6)', () => {
    render(<AppearanceSection {...props({ flashedField: 'showGrid' })} />);

    expect(rowOf('hiện lưới 100 mm').className).toContain('bg-accent-wash');
    expect(rowOf('chủ đề').className).not.toContain('bg-accent-wash');
    // Đúng MỘT lớp thời lượng: 260 ms — chỗ của 240 ms mà đặc tả ghi (R1).
    expect(rowOf('chủ đề').className).toContain('duration-260');
    expect(rowOf('chủ đề').className).not.toContain('duration-340');
  });
});

describe('màu, chữ và khả năng tiếp cận', () => {
  it('không có mã màu thô trong file khối', () => {
    expect(() => {
      expectNoRawColor('src/screens/account/AccountSettings/AppearanceSection.tsx');
    }).not.toThrow();
  });

  it('mọi chuỗi là tiếng Việt có dấu, và cây render tiếp cận được', () => {
    const { container } = render(<AppearanceSection {...props()} />);

    expectVietnamese(container);
    expectAccessible(container);
  });

  it('tiếp cận được cả khi đã tắt chuyển động', () => {
    const { container } = render(<AppearanceSection {...props({ motionOff: true })} />);

    expectAccessible(container);
  });
});

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Cổng giả: nhớ lại mọi lượt `stage`, không hẹn giờ gì cả. */
function createPort(saved: AccountDraft = EMPTY_ACCOUNT_DRAFT): {
  port: AccountDraftPort;
  staged: { section: AccountDraftSection; fields: AccountDraftFields }[];
} {
  const staged: { section: AccountDraftSection; fields: AccountDraftFields }[] = [];

  return {
    staged,
    port: {
      saved,
      stage: (section, fields) => {
        staged.push({ section, fields });
      },
    },
  };
}

let captured: AccountPreferencesModel | null = null;

function Probe({ port }: { readonly port: AccountDraftPort }) {
  captured = useAccountPreferences(port);

  return null;
}

beforeEach(() => {
  captured = null;
});

function model(): AccountPreferencesModel {
  if (captured === null) {
    throw new Error('hook chưa chạy');
  }

  return captured;
}

/** `matchMedia` của jsdom trả `matches: false` cho mọi thứ; đây là bản trả lời theo truy vấn. */
function stubMatchMedia(answers: Readonly<Record<string, boolean>>): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: answers[query] ?? false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

describe('bộ token tối trong globals.css', () => {
  const css = readFileSync('src/styles/globals.css', 'utf8');
  /** Cùng văn bản, bỏ chú thích: chú thích của chính khối tối có nhắc tên `filter`. */
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('là một khối token, không phải một bộ lọc — [CẤM TUYỆT ĐỐI]', () => {
    expect(css).toContain('html.dark {');
    // Không có đường tắt nào: không lọc, không đảo màu, không lớp phủ mờ.
    expect(declarations).not.toMatch(/filter\s*:/i);
    expect(declarations).not.toMatch(/invert\(/i);
    expect(declarations).not.toMatch(/opacity\s*:/i);
  });

  it('giữ đúng BA màu trạng thái — màu thứ tư là thứ A4 tồn tại để chặn', () => {
    const dark = css.slice(css.indexOf('html.dark {'), css.indexOf('  :root {'));
    const states = new Set(
      [...dark.matchAll(/--state-([a-z]+)(?:-text|-tint)?\s*:/g)].map((match) => match[1]),
    );

    expect([...states].sort()).toEqual(['attention', 'verified', 'violation']);
  });

  it('đứng TRƯỚC :root, vì parsePalette đọc cả file và khai báo sau đè khai báo trước', () => {
    // Đảo thứ tự thì `resolveLabelTreatment` tính bằng bảng màu tối ở MỌI chủ đề
    // — ba bài trong `src/lib/coloring` đỏ, và nhãn trên mảng tường sai màu lúc
    // chạy thật. Bài này khoá trật tự lại mà không phải chép một mã màu nào:
    // đọc cả file phải ra đúng thứ đọc riêng khối `:root` ra.
    expect(css.indexOf('html.dark {')).toBeLessThan(css.indexOf('  :root {'));

    expect(parsePalette(css)).toEqual(parsePalette(css.slice(css.indexOf('  :root {'))));
  });

  it('không đụng vào chủ đề sáng: bộ token sáng vẫn đạt ngưỡng của chính nó', () => {
    const light = parsePalette(css.slice(css.indexOf('  :root {')));
    const ratio = (fg: ColorTokenName, bg: ColorTokenName): number =>
      checkContrast(bg, fg, light).ratio;

    expect(ratio('--text-primary', '--bg-app')).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    expect(ratio('--text-primary', '--bg-surface')).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    expect(ratio('--text-secondary', '--bg-app')).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    expect(ratio('--text-secondary', '--bg-surface')).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
  });

  it('chữ chính và chữ phụ đều đạt 4,5:1 trên cả nền trang lẫn nền thẻ', () => {
    const palette = parsePalette(css.slice(0, css.indexOf('  :root {')));
    const ratio = (fg: ColorTokenName, bg: ColorTokenName): number =>
      checkContrast(bg, fg, palette).ratio;

    // Bốn con số nghiệm thu của R9, đo từ chính bộ token vừa khai.
    expect(ratio('--text-primary', '--bg-app')).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    expect(ratio('--text-primary', '--bg-surface')).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    expect(ratio('--text-secondary', '--bg-app')).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    expect(ratio('--text-secondary', '--bg-surface')).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
  });
});

describe('R2 — không cài đặt nào của màn này có khoá O-02', () => {
  it('năm khoá cờ tính năng không chứa một cài đặt nào ở đây', () => {
    expect([...FEATURE_FLAG_KEYS]).toEqual([
      'scene.instanced-walls',
      'scene.soft-shadows',
      'rules.parallel-run',
      'export.pdf-vector',
      'qc.live-collaboration',
    ]);

    for (const setting of ['theme', 'viewportDark', 'reducedMotion', 'showGrid', 'density']) {
      expect(FEATURE_FLAG_KEYS.some((key) => key.includes(setting))).toBe(false);
    }
  });
});

describe('D-07 — mỗi lượt sửa đi qua port.stage, và chỉ qua đó', () => {
  it('năm cài đặt của khối giao diện vào đúng khối appearance', () => {
    const { port, staged } = createPort();

    renderWithProviders(<Probe port={port} />);

    act(() => model().appearance.onThemeChange('dark'));
    act(() => model().appearance.onViewportDarkChange(true));
    act(() => model().appearance.onReducedMotionChange(true));
    act(() => model().appearance.onShowGridChange(false));
    act(() => model().appearance.onDensityChange('compact'));

    expect(staged.map((entry) => entry.section)).toEqual([
      'appearance',
      'appearance',
      'appearance',
      'appearance',
      'appearance',
    ]);
    expect(staged.map((entry) => entry.fields)).toEqual([
      { theme: 'dark' },
      { viewportDark: true },
      { reducedMotion: true },
      { showGrid: false },
      { density: 'compact' },
    ]);
  });

  it('bốn ô của khối hồ sơ vào đúng khối profile', () => {
    const { port, staged } = createPort();

    renderWithProviders(<Probe port={port} />);

    act(() => model().profile.onFullNameChange('Trần Minh'));
    act(() => model().profile.onJobTitleChange('Kỹ sư kết cấu'));
    act(() => model().profile.onPhoneChange('0900'));
    act(() => model().profile.onLanguageChange('en'));

    expect(staged.every((entry) => entry.section === 'profile')).toBe(true);
    expect(staged.map((entry) => entry.fields)).toEqual([
      { fullName: 'Trần Minh' },
      { jobTitle: 'Kỹ sư kết cấu' },
      { phone: '0900' },
      { language: 'en' },
    ]);
  });

  it('không ghi thẳng localStorage — hai khoá có mặt đều không phải của màn này', () => {
    const { port } = createPort();

    renderWithProviders(<Probe port={port} />);

    act(() => model().appearance.onDensityChange('compact'));
    act(() => model().appearance.onShowGridChange(false));
    act(() => model().profile.onPhoneChange('0900'));

    // `app-theme-mode` là của `useTheme`, `appfront-view-ui` là của lớp persist
    // quanh `uiSlice`. Cả hai có mặt trước khi màn này tồn tại. Cái màn này KHÔNG
    // được làm là mở một khoá thứ ba mà `SaveIndicator` không nhìn thấy.
    expect(Object.keys(window.localStorage).sort()).toEqual([
      'app-theme-mode',
      'appfront-view-ui',
    ]);

    const stored = JSON.stringify(window.localStorage);

    for (const setting of ['density', 'showGrid', 'phone', 'viewportDark', 'reducedMotion']) {
      expect(stored).not.toContain(setting);
    }
  });

  it('đọc lại bản đã lưu thay vì mặc định', () => {
    const { port } = createPort({
      appearance: { theme: 'dark', density: 'compact', showGrid: false },
      notifications: {},
      profile: { fullName: 'Lê Vân', jobTitle: 'Kiến trúc sư' },
    });

    renderWithProviders(<Probe port={port} />);

    expect(model().appearance.theme).toBe('dark');
    expect(model().appearance.density).toBe('compact');
    expect(model().appearance.showGrid).toBe(false);
    expect(model().profile.fullName).toBe('Lê Vân');
    expect(model().profile.rowClassName).toBe(DENSITY_ROW_CLASS.compact);
  });
});

describe('R5 — chủ đề ba nhánh trên một store hai nhánh', () => {
  it('"theo hệ thống" giải ra ở màn, không ở store', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('chọn "tối" thì store đổi và <html> mang lớp dark — không tải lại trang', () => {
    const { port } = createPort();

    renderWithProviders(<Probe port={port} />);
    expect(useStore.getState().theme).toBe('light');

    act(() => model().appearance.onThemeChange('dark'));

    expect(useStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('đổi năm lần liên tiếp: không tải lại trang, không dựng lại cây, không nháy màu thô', () => {
    const { port } = createPort();

    const { container } = renderWithProviders(<Probe port={port} />);
    const root = document.documentElement;
    const anchor = container;

    for (const choice of ['dark', 'light', 'dark', 'light', 'dark'] as const) {
      act(() => model().appearance.onThemeChange(choice));

      expect(root.classList.contains('dark')).toBe(choice === 'dark');
      // Đổi chủ đề là một lượt đổi lớp trên `<html>`, không phải một lượt dựng
      // lại: cùng một phần tử sống suốt năm lượt, nên không có khung hình nào
      // mà cây bị gỡ ra rồi vẽ lại — chính là khung hình "nháy màu thô".
      expect(container).toBe(anchor);
      // Và không có đường tắt nào lẻn vào qua style nội tuyến.
      expect(root.getAttribute('style')).toBeNull();
      expect(root.style.filter).toBe('');
    }

    // Năm lượt đổi, đúng hai khoá lưu trữ — không lượt nào mở thêm khoá nào.
    expect(Object.keys(window.localStorage).sort()).toEqual([
      'app-theme-mode',
      'appfront-view-ui',
    ]);
  });

  it('"theo hệ thống" đọc prefers-color-scheme ngay lượt render đầu', () => {
    stubMatchMedia({ '(prefers-color-scheme: dark)': true });

    const { port } = createPort({
      appearance: { theme: 'system' },
      notifications: {},
      profile: {},
    });

    renderWithProviders(<Probe port={port} />);

    expect(model().appearance.theme).toBe('system');
    expect(useStore.getState().theme).toBe('dark');
  });
});

describe('giảm chuyển động, và nó với tới đâu', () => {
  it('bật thì đặt thuộc tính lên <html> để phần còn lại của ứng dụng đọc được', () => {
    const { port } = createPort();

    renderWithProviders(<Probe port={port} />);
    expect(document.documentElement.hasAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe(false);

    act(() => model().appearance.onReducedMotionChange(true));

    expect(document.documentElement.getAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe('true');
    expect(model().appearance.motionOff).toBe(true);
    expect(model().profile.motionOff).toBe(true);
  });

  it('hệ điều hành yêu cầu thì cũng tắt, dù công tắc còn ở vị trí tắt', () => {
    stubMatchMedia({ '(prefers-reduced-motion: reduce)': true });

    const { port } = createPort();

    renderWithProviders(<Probe port={port} />);

    expect(model().appearance.reducedMotion).toBe(false);
    expect(model().appearance.motionOff).toBe(true);
  });
});
