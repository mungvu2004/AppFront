/**
 * Bộ kiểm của L2-W4 cho màn `ShareDialog` — bảy trạng thái, cộng năm điều cấm của đặc tả.
 *
 * ## Vì sao view và hook ở đây đi qua `import()` thay vì `import … from …`
 *
 * `./ShareDialog` (view) và `./useShareDialog` (hook) là việc của hai worker khác, viết
 * SONG SONG với worker này trên nhánh riêng — tại thời điểm file này được viết, CẢ HAI
 * CHƯA TỒN TẠI trong worktree này. Đã đo thật ở `RuleSettings.test.tsx`/`ExportPanel.test.tsx`:
 * một `import` TĨNH của một đường dẫn không tồn tại làm Vite sập lúc transform và không một
 * test nào trong cả file chạy được. Giấu đường dẫn sau một biến, kèm `/* @vite-ignore *\/`,
 * hoãn việc phân giải sang đúng lúc CHẠY, nên một import hỏng chỉ làm hỏng ĐÚNG một `it`.
 *
 * Vì thế, ở nhánh này: các bài cần view/hook thật HỎNG RIÊNG LẺ với "Failed to resolve",
 * còn các bài thuần dữ liệu (khoá nhúng, quét mã nguồn, mã màu) CHẠY VÀ XANH ngay hôm nay.
 * **Bộ này chưa được chạy trọn vẹn ở lớp W4 — nó sẽ chạy thật ở lớp gộp** (E.10: không báo
 * "đạt" cho bước chưa chạy).
 *
 * ## Ba cách né đã đo, không phải phỏng đoán
 *
 *  1. `expectAccessible` gọi trên `document.body` với `ignoreSelector: '[role="dialog"]'` —
 *     `Modal.tsx:131` tự đặt `outline-none` lên cái vỏ `tabIndex={-1}` của nó, và đó là
 *     component dùng chung, không phải lỗi của màn. Tiền lệ: `DangerZone.test.tsx:189`.
 *     `ignoreSelector` chỉ bỏ phần tử KHỚP chứ không bỏ cây con, nên mọi nút và ô BÊN
 *     TRONG hộp thoại vẫn bị soát đủ.
 *  2. `expectVietnamese` gọi kèm `ignore: [/^https?:\/\//]` — ô hiển thị địa chỉ chia sẻ
 *     mang một URL, mà domain/path thì không phải âm tiết tiếng Việt.
 *  3. `Select` thiếu `label` sẽ RỚT `expectAccessible`. Nếu bài (B) dưới đây bắt được điều
 *     đó thì **đó là lỗi thật của view**, phải sửa view — không nới điều kiện ở đây.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { parseEmbedParams } from '@/lib/export/embedParams';
import type { EmbedParams } from '@/lib/export/embedParams';
import type { ShareLinkGateway } from '@/lib/export/shareLink';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';

import {
  buildEmbedSection,
  buildShareDialogProps,
  SAMPLE_ACTIVE_LINK,
  SAMPLE_DRAFT_PASSWORD,
  SAMPLE_EMBED_PARAMS,
  SAMPLE_MEMBERS,
  SAMPLE_PROJECT_ID,
  SAMPLE_PROTECTED_LINK,
  TOO_SHORT_PASSWORD,
} from './shareDialogFixtures';
import type { EmbedEditableKey, ShareDialogProps, ShareDialogResult, UseShareDialogOptions } from './types';

afterEach(() => {
  cleanup();
});

/** Thư mục màn, dùng cho cả `expectNoRawColor` lẫn bài quét mã nguồn. */
const SCREEN_DIRECTORY = 'src/screens/export/ShareDialog';

/* ==========================================================================
 * 0. Hạ tầng: nhập file cùng thư mục qua biến, không qua chuỗi tĩnh.
 * ========================================================================== */

/** Xem lời giải thích ở đầu file. */
async function importFromScreen<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

async function loadShareDialogView(): Promise<ComponentType<ShareDialogProps>> {
  const mod = await importFromScreen<{ ShareDialog: ComponentType<ShareDialogProps> }>(
    './ShareDialog',
  );

  return mod.ShareDialog;
}

async function loadUseShareDialog(): Promise<(options: UseShareDialogOptions) => ShareDialogResult> {
  const mod = await importFromScreen<{
    useShareDialog: (options: UseShareDialogOptions) => ShareDialogResult;
  }>('./useShareDialog');

  return mod.useShareDialog;
}

/** Một cổng không chạm mạng: `list` rỗng, `create` trả đúng bản ghi mẫu, `revoke` xong. */
function buildFakeGateway(overrides: Partial<ShareLinkGateway> = {}): ShareLinkGateway {
  return {
    list: () => Promise.resolve({ ok: true, data: [] }),
    create: () => Promise.resolve({ ok: true, data: SAMPLE_ACTIVE_LINK }),
    revoke: () => Promise.resolve({ ok: true, data: undefined }),
    ...overrides,
  };
}

/* ==========================================================================
 * A. Bảy trạng thái (A11 / R-63).
 * ========================================================================== */

describe('A11 — bảy trạng thái của ShareDialog', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', async () => {
    const ShareDialogView = await loadShareDialogView();
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return renderWithProviders(<ShareDialogView {...buildShareDialogProps(scenario.state)} />);
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* ==========================================================================
 * B. Tiếp cận được, toàn chữ tiếng Việt có dấu, không mã màu thô (R-72, R-67, A1).
 * ========================================================================== */

describe('R-72 — expectAccessible và expectVietnamese trên cây render thật', () => {
  it('trạng thái "thành công" tiếp cận được và toàn chữ tiếng Việt có dấu', async () => {
    const ShareDialogView = await loadShareDialogView();
    const { container } = renderWithProviders(
      <ShareDialogView {...buildShareDialogProps('success')} />,
    );

    // Hai ngoại lệ, không cái nào là chữ của màn:
    //
    // - `^https?://` — ô địa chỉ chia sẻ mang một URL do máy chủ cấp. Cách né số 2.
    // - `^Level \d+$` — TÊN TẦNG đọc nguyên văn từ `SAMPLE_BUILDING` (`sampleBuilding.ts:85`).
    //   Màn không được tự đặt lại tên tầng, y như nó không được viết lại tên phòng. Neo y
    //   hệt `ExportPanel.test.tsx:110`.
    expectVietnamese(container, { ignore: [/^https?:\/\//u, /^Level \d+$/u] });

    // Hộp thoại dựng NGOÀI `container` của lượt render (`Modal.Root` vẽ ở lớp cố định),
    // nên soát cả `body`; bỏ đúng một phần tử là cái vỏ `role="dialog"`. Cách né số 1.
    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
  });

  it('cả bảy trạng thái đều tiếp cận được', async () => {
    const ShareDialogView = await loadShareDialogView();

    for (const state of SEVEN_STATES) {
      const { unmount } = renderWithProviders(<ShareDialogView {...buildShareDialogProps(state)} />);

      expect(() => {
        expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
      }, `trạng thái: ${state}`).not.toThrow();
      unmount();
    }
  });
});

describe('A1 — không một mã màu thô nào trong cả thư mục màn', () => {
  it('expectNoRawColor("src/screens/export/ShareDialog") không ném lỗi', () => {
    expect(() => {
      expectNoRawColor(SCREEN_DIRECTORY);
    }).not.toThrow();
  });
});

/* ==========================================================================
 * C. Chống ghép chuỗi — tiêu chí nghiệm thu của đặc tả.
 *
 * "Không tự ghép URL chia sẻ, không tự sinh mã nhúng bằng chuỗi." Bài này đọc
 * MÃ NGUỒN của thư mục màn thay vì đọc DOM, vì lệnh cấm là lệnh cấm về cách viết:
 * một view ghép đúng chuỗi hôm nay vẫn ghép sai vào ngày `EMBED_PARAM_KEYS` đổi.
 * Có tiền lệ đọc file trong test màn: `RuleSettings.test.tsx:124`.
 * ========================================================================== */

/**
 * File CHẠY ĐƯỢC của màn: bỏ test, bỏ story, và bỏ `shareDialogFixtures.ts`.
 *
 * Fixture đóng vai câu trả lời của máy chủ — một `ShareLink` đến kèm địa chỉ đã thành
 * hình — nên nó được phép mang một URL viết sẵn. Lệnh cấm nhắm vào view và hook: hai
 * thứ đó phải nhận URL và mã nhúng từ `model`, không được tự dựng.
 */
function listRunnableScreenFiles(): readonly string[] {
  return readdirSync(SCREEN_DIRECTORY).filter(
    (name) =>
      (name.endsWith('.ts') || name.endsWith('.tsx')) &&
      !name.endsWith('.test.tsx') &&
      !name.endsWith('.stories.tsx') &&
      name !== 'shareDialogFixtures.ts',
  );
}

/**
 * Bỏ chú thích trước khi quét, vì lệnh cấm nói về mã CHẠY ĐƯỢC.
 *
 * Chỉ bỏ khối `/* … *\/` và những dòng MỞ ĐẦU bằng `//`. Cố tình không bỏ `//` giữa
 * dòng: `const url = 'https://' + host` là đúng thứ bài này đi tìm, và một phép bỏ chú
 * thích ngây thơ sẽ xoá mất nó.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//u.test(line))
    .join('\n');
}

describe('CẤM — màn không tự ghép URL chia sẻ và không tự sinh mã nhúng', () => {
  it('không file chạy được nào của màn chứa một địa chỉ http, hay một thẻ <iframe>', () => {
    const files = listRunnableScreenFiles();
    const offenders: string[] = [];

    for (const file of files) {
      const source = stripComments(readFileSync(join(SCREEN_DIRECTORY, file), 'utf8'));

      if (/https?:\/\//u.test(source)) {
        offenders.push(`${file}: một địa chỉ http trong mã chạy được`);
      }
      if (/<iframe/iu.test(source)) {
        offenders.push(`${file}: một thẻ <iframe> trong mã chạy được`);
      }
    }

    // In ra để lớp gộp thấy rõ bài này đã soi những file nào — ở nhánh W4 danh sách
    // mới chỉ có `types.ts`, vì view và hook chưa được ghép vào.
    console.log(`[W4] file chạy được đã quét (${String(files.length)}): ${files.join(', ')}`);
    console.log(`[W4] vi phạm ghép chuỗi: ${offenders.length === 0 ? 'không có' : offenders.join(' · ')}`);

    expect(files).toContain('types.ts');
    expect(offenders).toEqual([]);
  });
});

/* ==========================================================================
 * D. Khoá nhúng và khung xem trước phải KHỚP NHAU.
 * ========================================================================== */

/** Đọc ngược `EmbedParams` ra khỏi mã nhúng, qua đúng bộ đọc của lib. */
function paramsFromEmbedCode(code: string): EmbedParams {
  const match = /src="([^"]+)"/u.exec(code);
  const src = (match?.[1] ?? '').replace(/&amp;/gu, '&');

  return parseEmbedParams(src).params;
}

/** Ba khoá đổi được mà không cần dựng camera — khoá thứ tư (`viewpointCode`) cần mã hoá riêng. */
const EMBED_CASES: readonly { readonly key: EmbedEditableKey; readonly params: EmbedParams }[] = [
  { key: 'levelId', params: { ...SAMPLE_EMBED_PARAMS, levelId: sampleLevelId(2) } },
  { key: 'coloring', params: { ...SAMPLE_EMBED_PARAMS, coloring: 'area' } },
  { key: 'toolbar', params: { ...SAMPLE_EMBED_PARAMS, toolbar: false } },
];

describe('mã nhúng và khung xem trước cùng phản ánh MỘT EmbedParams', () => {
  it.each(EMBED_CASES)('đổi khoá "$key": code và view không kể hai chuyện khác nhau', ({ params }) => {
    const section = buildEmbedSection({ params });

    // Khung xem trước tĩnh đi ra từ `resolveEmbedView`, nên nó nói đúng ba trường này.
    expect(section.view.levelId).toBe(params.levelId);
    expect(section.view.coloring).toBe(params.coloring);
    expect(section.view.toolbar).toBe(params.toolbar);

    // Và mã nhúng, đọc ngược qua `parseEmbedParams`, ra đúng bộ tham số ấy.
    expect(paramsFromEmbedCode(section.code)).toEqual(params);
  });

  it('ba khoá cho ba mã nhúng khác nhau — không cái nào đứng yên khi tham số đổi', () => {
    const codes = new Set(EMBED_CASES.map(({ params }) => buildEmbedSection({ params }).code));

    expect(codes.size).toBe(EMBED_CASES.length);
  });

  it('view thật hiện đúng `model.embed.code`, không hiện một chuỗi tự dựng', async () => {
    const ShareDialogView = await loadShareDialogView();

    for (const { key, params } of EMBED_CASES) {
      const embed = buildEmbedSection({ params });
      const props = buildShareDialogProps('success', { embed });
      const { container, unmount } = renderWithProviders(<ShareDialogView {...props} />);

      expect(document.body.textContent, `khoá: ${key}`).toContain(embed.code);
      expect(container).toBeTruthy();
      unmount();
    }
  });
});

/* ==========================================================================
 * E. Mật khẩu không rò.
 *
 * Bước nghiệm thu gốc là "mở liên kết bằng cửa sổ ẩn danh và xem có bị hỏi mật khẩu
 * không". Bước ĐÓ KHÔNG CHẠY ĐƯỢC ở đây: repo không có máy chủ thật, `ShareLinkGateway`
 * là một cổng và test dùng bản giả. Bài dưới đây là bản thay thế đo được — nó khẳng định
 * điều mà màn CHỊU TRÁCH NHIỆM: sau khi liên kết đã tạo, chuỗi mật khẩu không còn ở bất
 * kỳ đâu trong DOM, chỉ còn dấu hiệu `passwordProtected`.
 * ========================================================================== */

describe('CẤM — không hiện mật khẩu dạng rõ sau khi đã lưu', () => {
  it('bản ghi trả về không mang nổi một mật khẩu: `ShareLink` chỉ có cờ boolean', () => {
    expect(SAMPLE_PROTECTED_LINK.passwordProtected).toBe(true);
    expect(JSON.stringify(SAMPLE_PROTECTED_LINK)).not.toContain(SAMPLE_DRAFT_PASSWORD);
  });

  it('trạng thái "thành công": không nơi nào trong DOM hiện chuỗi mật khẩu', async () => {
    const ShareDialogView = await loadShareDialogView();
    const props = buildShareDialogProps('success');

    // Sau khi tạo xong, biểu mẫu phải đã bỏ mật khẩu nháp đi.
    expect(props.model.form.password).toBe('');
    expect(props.model.rows.some((row) => row.passwordProtected)).toBe(true);

    renderWithProviders(<ShareDialogView {...props} />);

    expect(document.body.innerHTML).not.toContain(SAMPLE_DRAFT_PASSWORD);
    expect(document.body.innerHTML).not.toContain(TOO_SHORT_PASSWORD);

    // Và nếu còn một ô mật khẩu nào trên màn thì nó rỗng.
    for (const input of Array.from(
      document.body.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    )) {
      expect(input.value).toBe('');
    }

    // Dấu hiệu thì vẫn phải nói ra, nếu không người dùng không biết liên kết có khoá.
    expect(document.body.textContent).toMatch(/mật khẩu/iu);
  });
});

/* ==========================================================================
 * F. Hoàn tác (A8) — đổi quyền truy cập thì có toast kèm `onUndo`.
 * ========================================================================== */

describe('A8 — mọi thay đổi hoàn tác được, kèm toast hoàn tác', () => {
  it('đổi quyền truy cập gọi onToast với một onUndo', async () => {
    const useShareDialog = await loadUseShareDialog();
    const onToast = vi.fn();
    const { result } = renderHook(() =>
      useShareDialog({
        gateway: buildFakeGateway(),
        projectId: SAMPLE_PROJECT_ID,
        roles: ['admin'],
        members: SAMPLE_MEMBERS,
        onToast,
      }),
    );

    const [, actions] = result.current;

    actions.setPermission('comment');

    await waitFor(() => {
      expect(onToast).toHaveBeenCalled();
    });

    const toast = onToast.mock.calls.at(-1)?.[0] as { message: string; onUndo?: () => void };

    expect(typeof toast.message).toBe('string');
    expect(toast.message.length).toBeGreaterThan(0);
    expect(typeof toast.onUndo).toBe('function');
  });
});

/* ==========================================================================
 * G. Không nút Lưu, không nút Huỷ (A7 và lệnh cấm của đặc tả).
 * ========================================================================== */

/** Hỏi cả hai ngôn ngữ cùng lúc — một nút "Save" lọt vào cũng vi phạm đúng bất biến ấy. */
const SAVE_BUTTON_NAMES = /^\s*(l[uư]u|save)\s*$/iu;
const CANCEL_BUTTON_NAMES = /^\s*(hu[ỷy]|cancel)\s*$/iu;

describe('A7 — không nút lưu, và không nút huỷ, ở bất kỳ trạng thái nào', () => {
  it('bảy trạng thái, không trạng thái nào mọc ra nút lưu hay nút huỷ', async () => {
    const ShareDialogView = await loadShareDialogView();

    for (const state of SEVEN_STATES) {
      const { unmount } = renderWithProviders(<ShareDialogView {...buildShareDialogProps(state)} />);

      expect(
        screen.queryAllByRole('button', { name: SAVE_BUTTON_NAMES }),
        `nút lưu ở trạng thái: ${state}`,
      ).toHaveLength(0);
      expect(
        screen.queryAllByRole('button', { name: CANCEL_BUTTON_NAMES }),
        `nút huỷ ở trạng thái: ${state}`,
      ).toHaveLength(0);
      unmount();
    }
  });

  it('trạng thái "thành công" vẫn nói ra mốc tự lưu, vì không có nút lưu để bấm', async () => {
    const ShareDialogView = await loadShareDialogView();
    const props = buildShareDialogProps('success');

    expect(props.model.savedAtLabel).not.toBeNull();
    renderWithProviders(<ShareDialogView {...props} />);

    expect(document.body.textContent).toContain(props.model.savedAtLabel ?? '');
  });
});

/* ==========================================================================
 * H. Esc đóng lớp trên cùng (A12).
 *
 * `Modal.Root` TỰ xử Esc (`Modal.tsx:59-72,77-80`), nên bài này đo HÀNH VI — bấm Esc thì
 * `actions.dismiss` được gọi — chứ không đo cài đặt. Màn không được gọi `createFocusTrap`
 * lần nữa; nếu nó gọi, hai lớp bẫy chồng nhau và bài này vẫn xanh, nên chuyện đó thuộc
 * phần soát mã của lớp gộp, không phải phần đo được ở đây.
 * ========================================================================== */

describe('A12 — Esc đóng hộp thoại', () => {
  it('bấm Esc trong hộp thoại gọi actions.dismiss', async () => {
    const ShareDialogView = await loadShareDialogView();
    const dismiss = vi.fn();

    renderWithProviders(<ShareDialogView {...buildShareDialogProps('success', {}, { dismiss })} />);

    const dialog = await screen.findByRole('dialog');

    // Bẫy tiêu điểm gắn listener bên trong một `requestAnimationFrame`, nên phép bấm
    // được thử lại cho tới khi listener có mặt — `waitFor` chạy lại CẢ callback.
    await waitFor(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(dismiss).toHaveBeenCalled();
    });
  });

  it('isOpen=false thì không dựng hộp thoại nào', async () => {
    const ShareDialogView = await loadShareDialogView();
    const props: ShareDialogProps = { ...buildShareDialogProps('success'), isOpen: false };

    renderWithProviders(<ShareDialogView {...props} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
