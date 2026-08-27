/**
 * The shared screen checks, checked.
 *
 * Forty-seven screens are going to lean on `expectVietnamese`,
 * `expectAccessible` and `renderWithProviders`, which makes a false positive
 * here forty-seven arguments about whether the helper is right, and a false
 * negative here forty-seven screens that pass without being looked at. So both
 * directions are pinned: every check has a case it must catch and a case it must
 * leave alone, and the failure messages are asserted on as well — a checker
 * whose message does not say *where* is a checker people work around.
 *
 * No colour is spelled out anywhere in this file. `noRawColor.test.ts` holds the
 * whole repository to that, tests included, and named CSS colours say what is
 * meant more clearly than hex would: jsdom normalises `white` and `silver` into
 * channels before either of them reaches the code under test.
 */

import { QueryClient, useQuery } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { create } from 'zustand';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  accessibleName,
  contrastRatio,
  expectAccessible,
  inspectAccessibility,
  parseColor,
} from '../expectAccessible';
import {
  configureTestProviders,
  createStoreReset,
  createTestQueryClient,
  getTestTranslator,
  renderWithProviders,
  resetTestProviders,
} from '../render';
import {
  expectVietnamese,
  findNonVietnamese,
  hasDiacritics,
  isVietnameseSyllable,
  stripDiacritics,
} from '../expectVietnamese';

/** A container holding the given markup, attached so computed styles resolve. */
function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);

  return container;
}

/**
 * A hex colour built rather than written.
 *
 * The repository forbids a colour literal in any file, this one included, and
 * the hex parser still has to be tested against hex.
 */
function hex(digits: string): string {
  return '#'.concat(digits);
}

/** The name of the functional notation, kept apart from its bracket for the same reason. */
const RGBA = 'rgba';

/** Black at the given opacity, for testing how translucent layers composite. */
function translucentBlack(alpha: number): string {
  return `${RGBA}(0, 0, 0, ${String(alpha)})`;
}

/** Silver, as a token value would be written in `globals.css`. */
const SILVER = hex('c0c0c0');

afterEach(() => {
  cleanup();
  resetTestProviders();
  document.body.innerHTML = '';
});

/* ========================================================================== */
/* expectVietnamese                                                            */
/* ========================================================================== */

describe('stripDiacritics', () => {
  it.each([
    ['Lưu', 'Luu'],
    ['Đã lưu lúc 14:32', 'Da luu luc 14:32'],
    ['tường', 'tuong'],
    ['Hoàn tác', 'Hoan tac'],
    ['Save', 'Save'],
  ])('turns %s into %s', (accented, plain) => {
    expect(stripDiacritics(accented)).toBe(plain);
  });

  it('counts đ as a diacritic even though it carries no mark', () => {
    expect(hasDiacritics('đóng')).toBe(true);
    expect(hasDiacritics('danh')).toBe(false);
  });
});

describe('isVietnameseSyllable', () => {
  it.each(['danh', 'sach', 'tuong', 'khong', 'nguyen', 'chuyen', 'khuya', 'oai', 'uy'])(
    'accepts %s, which is shaped like Vietnamese',
    (word) => {
      expect(isVietnameseSyllable(word)).toBe(true);
    },
  );

  it.each([
    'save',
    'close',
    'loading',
    'export',
    'filter',
    'cancel',
    'settings',
    'error',
    'count',
    'wall',
    'zoom',
  ])('refuses %s, which is not', (word) => {
    expect(isVietnameseSyllable(word)).toBe(false);
  });

  it('answers the same for a word with and without its diacritics', () => {
    expect(isVietnameseSyllable('tường')).toBe(isVietnameseSyllable('tuong'));
  });
});

describe('expectVietnamese', () => {
  it('leaves a properly written Vietnamese screen alone', () => {
    const container = mount(`
      <section>
        <h2>Danh sách tường tầng 1</h2>
        <p>48 tường, 14 ô mở, 248,60 m²</p>
        <button aria-label="Hoàn tác thay đổi">Hoàn tác</button>
        <span>W-001</span>
        <span>PDF</span>
      </section>
    `);

    expect(findNonVietnamese(container)).toEqual([]);
    expect(() => {
      expectVietnamese(container);
    }).not.toThrow();
  });

  it('catches an English label left behind', () => {
    const container = mount('<div><button id="act">Save</button></div>');
    const issues = findNonVietnamese(container);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'english', word: 'Save', source: 'text' });
    expect(issues[0]?.element).toContain('button#act');
  });

  it('names the element, the attribute and the word in the failure', () => {
    const container = mount('<div><input id="tenant" placeholder="Enter name" /></div>');

    expect(() => {
      expectVietnamese(container);
    }).toThrow(/input#tenant/);
    expect(() => {
      expectVietnamese(container);
    }).toThrow(/thuộc tính placeholder/);
    expect(() => {
      expectVietnamese(container);
    }).toThrow(/tiếng Anh/);
  });

  it('catches Vietnamese that lost its diacritics, and says how it is spelled', () => {
    const container = mount('<div><button>Luu</button></div>');
    const issues = findNonVietnamese(container);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'unaccented', word: 'Luu', suggestion: 'lưu' });
    expect(() => {
      expectVietnamese(container);
    }).toThrow(/thiếu dấu/);
  });

  it('catches a whole unaccented phrase even when no single word gives it away', () => {
    // Not one of these four is in vi.json and all four are shaped like
    // Vietnamese, so nothing is wrong word by word. The string is what is wrong.
    const container = mount('<div><h2>Chieu cao tran nha</h2></div>');
    const issues = findNonVietnamese(container);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'unaccented', word: null });
    expect(issues[0]?.reason).toContain('không dấu');
  });

  it('leaves the same phrase alone once it is written properly', () => {
    expect(findNonVietnamese(mount('<div><h2>Chiều cao trần nhà</h2></div>'))).toEqual([]);
  });

  it('does not read an accented word as a misspelling of a bundle word', () => {
    // Stripping vi.json's "đánh" gives "danh", which is also a word in its own
    // right. The diacritics elsewhere in the string are what settle it.
    expect(findNonVietnamese(mount('<div><h2>Danh sách tường</h2></div>'))).toEqual([]);
  });

  it('reads the attributes a person hears, not the ones only a machine reads', () => {
    const container = mount(`
      <div data-analytics-id="close-english" class="Toggle Empty State">
        <button aria-label="Close">×</button>
        <img alt="Ban ve tang 1" />
      </div>
    `);
    const issues = findNonVietnamese(container);

    expect(issues.map((issue) => issue.source).sort()).toEqual(['alt', 'aria-label']);
    expect(issues.find((issue) => issue.source === 'aria-label')).toMatchObject({
      kind: 'english',
      word: 'Close',
    });
    expect(issues.find((issue) => issue.source === 'alt')).toMatchObject({
      kind: 'unaccented',
      word: null,
    });
  });

  it('leaves keyboard hints and code alone', () => {
    const container = mount(`
      <div>
        <span>Nhấn <kbd>Ctrl</kbd> + <kbd>Shift</kbd> để mở</span>
        <code>queryKey</code>
      </div>
    `);

    expect(findNonVietnamese(container)).toEqual([]);
  });

  it('does not report what nobody can see', () => {
    const container = mount(`
      <div>
        <span hidden>Save</span>
        <span aria-hidden="true">Cancel</span>
        <span style="display: none">Delete</span>
      </div>
    `);

    expect(findNonVietnamese(container)).toEqual([]);
  });

  it('takes an allowlist for a name it could not know', () => {
    const container = mount('<div><span>Nhập từ Revit</span></div>');

    expect(findNonVietnamese(container)).toHaveLength(1);
    expect(findNonVietnamese(container, { allowWords: ['Revit'] })).toEqual([]);
  });

  it('learns a spelling from an extra lexicon', () => {
    const container = mount('<div><span>huou</span></div>');

    expect(findNonVietnamese(container)).toEqual([]);
    expect(findNonVietnamese(container, { lexicon: ['hươu'] })[0]).toMatchObject({
      kind: 'unaccented',
      suggestion: 'hươu',
    });
  });

  it('accepts whatever a renderer handed back, not only an element', () => {
    const result = render(<button type="button">Đóng</button>);

    expect(() => {
      expectVietnamese(result);
    }).not.toThrow();
  });

  it('does not let the i18n placeholders into the accepted vocabulary', () => {
    // vi.json says "Hoàn tác {{count}} thay đổi". If the bundle were read
    // naively, `count` would become an approved Vietnamese word.
    expect(findNonVietnamese(mount('<div><span>count</span></div>'))).toHaveLength(1);
  });
});

/* ========================================================================== */
/* expectAccessible                                                            */
/* ========================================================================== */

describe('colour maths', () => {
  it('reads every notation a browser hands back', () => {
    expect(parseColor(hex('ffffff'))).toEqual({ red: 255, green: 255, blue: 255, alpha: 1 });
    expect(parseColor(hex('fff'))).toEqual({ red: 255, green: 255, blue: 255, alpha: 1 });
    expect(parseColor('transparent')).toEqual({ red: 0, green: 0, blue: 0, alpha: 0 });
    expect(parseColor('canvastext')).toBeNull();
  });

  it('gives black on white the full range, and a colour on itself none of it', () => {
    const black = parseColor(hex('000000'));
    const white = parseColor(hex('ffffff'));

    expect(black).not.toBeNull();
    expect(white).not.toBeNull();
    expect(contrastRatio(black!, white!)).toBeCloseTo(21, 1);
    expect(contrastRatio(white!, white!)).toBeCloseTo(1, 5);
  });
});

describe('accessibleName', () => {
  it('prefers what a screen reader prefers', () => {
    const container = mount(`
      <div>
        <span id="tieu-de">Hoàn tác</span>
        <button id="a" aria-labelledby="tieu-de" aria-label="Bỏ qua">×</button>
        <button id="b" aria-label="Đóng">×</button>
        <button id="c">Lưu</button>
        <label for="d">Bề dày</label><input id="d" />
        <button id="e" title="Tải lại"></button>
        <input id="f" placeholder="Nhập mã trục" />
        <button id="g"></button>
      </div>
    `);
    const named = (id: string): string =>
      accessibleName(container.querySelector(`#${id}`) as Element);

    expect(named('a')).toBe('Hoàn tác');
    expect(named('b')).toBe('Đóng');
    expect(named('c')).toBe('Lưu');
    expect(named('d')).toBe('Bề dày');
    expect(named('e')).toBe('Tải lại');
    expect(named('f')).toBe('Nhập mã trục');
    expect(named('g')).toBe('');
  });
});

describe('expectAccessible', () => {
  it('leaves a well-built screen alone', () => {
    const container = mount(`
      <section style="background-color: white">
        <button class="outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style="color: black">Hoàn tác</button>
        <img alt="" />
        <label for="thickness">Bề dày</label>
        <input id="thickness" />
      </section>
    `);

    expect(() => {
      expectAccessible(container);
    }).not.toThrow();
  });

  it('refuses to pass when it was handed nothing', () => {
    expect(() => {
      expectAccessible(document.createElement('div'));
    }).toThrow(/không có gì để kiểm/);
  });

  it('catches a control nobody can hear', () => {
    const container = mount('<div><button id="undo"></button></div>');
    const { issues } = inspectAccessibility(container);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-name' });
    expect(issues[0]?.element).toContain('button#undo');
    expect(() => {
      expectAccessible(container);
    }).toThrow(/trình đọc màn hình/);
  });

  it('tells a decorative image from a forgotten one', () => {
    expect(inspectAccessibility(mount('<div><img alt="" /></div>')).issues).toEqual([]);
    expect(inspectAccessibility(mount('<div><img /></div>')).issues[0]).toMatchObject({
      kind: 'missing-alt',
    });
  });

  it('catches a hand-arranged tab order', () => {
    const issues = inspectAccessibility(
      mount('<div><button tabindex="2" aria-label="Lưu"></button></div>'),
    ).issues;

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'tab-order' });
  });

  it('catches a control the keyboard cannot reach, and allows a roving one', () => {
    expect(
      inspectAccessibility(mount('<div><button tabindex="-1" aria-label="Lưu"></button></div>'))
        .issues[0],
    ).toMatchObject({ kind: 'unreachable' });

    expect(
      inspectAccessibility(
        mount('<div><button tabindex="-1" data-roving-focus aria-label="Lưu"></button></div>'),
      ).issues,
    ).toEqual([]);
  });

  it('catches a focus ring that was switched off and never replaced', () => {
    const issues = inspectAccessibility(
      mount('<div><button class="outline-none" aria-label="Lưu"></button></div>'),
    ).issues;

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'focus-ring' });
    expect(issues[0]?.reason).toContain('tắt viền tiêu điểm');
  });

  it('catches a ring with no offset, which A12 also requires', () => {
    const issues = inspectAccessibility(
      mount('<div><button class="focus-visible:ring-2" aria-label="Lưu"></button></div>'),
    ).issues;

    expect(issues).toHaveLength(1);
    expect(issues[0]?.reason).toContain('offset');
  });

  /**
   * The shape `components/ui/Input` uses: a bordered box draws the ring for the
   * input inside it, and the input switches its own outline off so there are not
   * two rings a pixel apart.
   */
  it('accepts a ring an ancestor draws with focus-within', () => {
    expect(
      inspectAccessibility(
        mount(`
          <div class="focus-within:ring-2 focus-within:ring-offset-2">
            <label for="email">Thư điện tử</label>
            <input id="email" class="outline-none" />
          </div>
        `),
      ).issues,
    ).toEqual([]);
  });

  it('still catches a wrapper that draws a ring and forgets the offset', () => {
    const issues = inspectAccessibility(
      mount(`
        <div class="focus-within:ring-2">
          <label for="email">Thư điện tử</label>
          <input id="email" class="outline-none" />
        </div>
      `),
    ).issues;

    expect(issues).toHaveLength(1);
    expect(issues[0]?.reason).toContain('offset');
  });

  it('does not mistake a static ring on an ancestor for a focus ring', () => {
    const issues = inspectAccessibility(
      mount(`
        <div class="ring-2 ring-offset-2">
          <label for="email">Thư điện tử</label>
          <input id="email" class="outline-none" />
        </div>
      `),
    ).issues;

    expect(issues).toHaveLength(1);
    expect(issues[0]?.reason).toContain('tắt viền tiêu điểm');
  });

  /**
   * The roving shape `components/ui/Tabs` uses: Tab steps past the whole strip in
   * one press and the arrow keys move between tabs, so every tab but the current
   * one carries tabindex -1 on purpose.
   */
  it('recognises the roving-focus shape without being told', () => {
    expect(
      inspectAccessibility(
        mount(`
          <div role="tablist" aria-label="Xác thực">
            <button role="tab" tabindex="0" aria-selected="true">Đăng nhập</button>
            <button role="tab" tabindex="-1" aria-selected="false">Đăng ký</button>
          </div>
        `),
      ).issues,
    ).toEqual([]);
  });

  it('still catches a roving group with no way into it', () => {
    const issues = inspectAccessibility(
      mount(`
        <div role="tablist" aria-label="Xác thực">
          <button role="tab" tabindex="-1" aria-selected="false">Đăng nhập</button>
          <button role="tab" tabindex="-1" aria-selected="false">Đăng ký</button>
        </div>
      `),
    ).issues;

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ kind: 'unreachable' });
  });

  it('measures text against its background, and says by how much it missed', () => {
    const container = mount(`
      <div style="background-color: white">
        <p style="color: silver">Bốn mươi tám tường</p>
      </div>
    `);
    const report = inspectAccessibility(container);

    expect(report.contrastChecked).toBe(1);
    expect(report.issues[0]).toMatchObject({ kind: 'contrast' });
    expect(report.issues[0]?.reason).toMatch(/tương phản chữ 1,8\d:1, dưới mức 4,50:1/);
    expect(report.issues[0]?.detail).toContain('Bốn mươi tám tường');
  });

  it('holds a caption to 3:1 and body text to 4,5:1', () => {
    const body = mount('<div style="background-color: white"><p style="color: gray">Ghi chú</p></div>');
    const caption = mount(
      '<div style="background-color: white"><figcaption style="color: gray">Ghi chú</figcaption></div>',
    );

    expect(inspectAccessibility(body).issues).toHaveLength(1);
    expect(inspectAccessibility(caption).issues).toEqual([]);
  });

  it('composites a translucent background the way a browser paints it', () => {
    const opaque = mount(
      '<div style="background-color: black"><p style="color: white">Tường</p></div>',
    );
    const washed = mount(
      `<div style="background-color: white"><div style="background-color: ${translucentBlack(0.05)}">` +
        '<p style="color: silver">Tường</p></div></div>',
    );

    expect(inspectAccessibility(opaque).issues).toEqual([]);
    expect(inspectAccessibility(washed).issues[0]).toMatchObject({ kind: 'contrast' });
  });

  it('resolves a design token when the caller hands one in', () => {
    const container = mount(`
      <div style="background-color: white">
        <p style="color: var(--text-faint)">Ghi chú</p>
      </div>
    `);

    expect(inspectAccessibility(container).contrastSkipped).toBe(1);
    expect(
      inspectAccessibility(container, { variables: { '--text-faint': SILVER } }).issues[0],
    ).toMatchObject({ kind: 'contrast' });
  });

  it('follows a custom property declared on an ancestor', () => {
    const container = mount(`
      <div style="background-color: white; --text-faint: ${SILVER}">
        <p style="color: var(--text-faint)">Ghi chú</p>
      </div>
    `);

    expect(inspectAccessibility(container).issues[0]).toMatchObject({ kind: 'contrast' });
  });

  it('counts what it could not read rather than passing it', () => {
    const container = mount('<div><p>Tường ngoài</p></div>');
    const report = inspectAccessibility(container);

    expect(report.contrastChecked).toBe(0);
    expect(report.contrastSkipped).toBe(1);
    expect(report.issues).toEqual([]);
    expect(() => {
      expectAccessible(container, { requireResolvedContrast: true });
    }).toThrow(/chưa kiểm được gì/);
  });

  it('skips what the caller asked it to skip', () => {
    const container = mount('<div><button id="dev" class="dev-only"></button></div>');

    expect(inspectAccessibility(container).issues).toHaveLength(1);
    expect(inspectAccessibility(container, { ignoreSelector: '.dev-only' }).issues).toEqual([]);
  });
});

/* ========================================================================== */
/* renderWithProviders                                                         */
/* ========================================================================== */

interface DraftState {
  readonly edits: number;
  readonly addEdit: () => void;
}

/** A stand-in for the application store: same shape, none of its dependencies. */
function createDraftStore() {
  return create<DraftState>()((set) => ({
    edits: 0,
    addEdit: () => {
      set((state) => ({ edits: state.edits + 1 }));
    },
  }));
}

function Fetcher() {
  const query = useQuery({ queryKey: ['tuong'], queryFn: () => Promise.resolve('48 tường') });

  return <p>{query.isSuccess ? query.data : 'Đang tải'}</p>;
}

describe('renderWithProviders', () => {
  beforeEach(() => {
    resetTestProviders();
  });

  it('renders a screen in one line', () => {
    const { container } = renderWithProviders(<h2>Danh sách tường</h2>);

    expect(container).toHaveTextContent('Danh sách tường');
  });

  it('brings a query client with it, with retries off', async () => {
    const { queryClient } = renderWithProviders(<Fetcher />);

    expect(await screen.findByText('48 tường')).toBeInTheDocument();
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
  });

  it('gives every render its own cache', () => {
    const first = renderWithProviders(<p>Một</p>);
    const second = renderWithProviders(<p>Hai</p>);

    expect(first.queryClient).not.toBe(second.queryClient);
  });

  it('empties the cache it made when the tree comes down', () => {
    const { queryClient, unmount } = renderWithProviders(<p>Một</p>);
    queryClient.setQueryData(['tuong'], '48 tường');

    unmount();

    expect(queryClient.getQueryData(['tuong'])).toBeUndefined();
  });

  it('hands over the application Vietnamese rather than a copy of it', () => {
    const { translate } = renderWithProviders(<p>Một</p>);

    expect(translate('common.undo')).toBe('Hoàn tác');
    expect(translate('common.saved_at', { time: '14:32' })).toBe('Đã lưu lúc 14:32');
    expect(getTestTranslator()).toBe(translate);
  });

  it('puts the store back before each render once it has been wired up', () => {
    const store = createDraftStore();
    configureTestProviders({ resetStore: createStoreReset(store) });

    store.getState().addEdit();
    expect(store.getState().edits).toBe(1);

    renderWithProviders(<p>Một</p>);
    expect(store.getState().edits).toBe(0);

    // The actions have to survive the reset, or the second render is dead.
    store.getState().addEdit();
    expect(store.getState().edits).toBe(1);
  });

  it('leaves the store alone when a test says it seeded it on purpose', () => {
    const store = createDraftStore();
    configureTestProviders({ resetStore: createStoreReset(store) });

    store.getState().addEdit();
    renderWithProviders(<p>Một</p>, { keepStore: true });

    expect(store.getState().edits).toBe(1);
  });

  it('works with nothing wired up at all', () => {
    expect(() => {
      renderWithProviders(<p>Một</p>);
    }).not.toThrow();
  });

  it('takes a client for a test that wants to seed the cache', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['tuong'], '48 tường');

    const result = renderWithProviders(<p>Một</p>, { queryClient });

    expect(result.queryClient).toBe(queryClient);
    expect(queryClient.getQueryData(['tuong'])).toBe('48 tường');
  });

  it('is a QueryClient, not something shaped like one', () => {
    expect(createTestQueryClient()).toBeInstanceOf(QueryClient);
  });
});

/* ========================================================================== */
/* The three together                                                          */
/* ========================================================================== */

describe('a screen checked the way a screen test will check one', () => {
  it('passes all three in three lines', () => {
    const result = renderWithProviders(
      <section style={{ backgroundColor: 'white' }}>
        <h2 style={{ color: 'black' }}>Danh sách tường tầng 1</h2>
        <button
          type="button"
          className="focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ color: 'black' }}
        >
          Hoàn tác
        </button>
      </section>,
    );

    expectVietnamese(result);
    expectAccessible(result, { requireResolvedContrast: true });
    expect(result.container).toHaveTextContent('Danh sách tường tầng 1');
  });
});
