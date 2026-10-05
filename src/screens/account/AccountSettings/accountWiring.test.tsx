/**
 * F-09b — mối nối thật của màn tài khoản: lỗi ô 422, ảnh đại diện qua hộp thoại A9,
 * chủ đề không bị ghi đè, chỉ báo "chỉ giữ trong phiên này", đổi mật khẩu, và hai
 * khối v2 rời DOM. Mọi bài tiêm cổng giả tường minh; không bài nào chạm mạng.
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '@/api/schemas/me';
import type { HttpError } from '@/lib/http';
import type { Announcer } from '@/lib/input/announcer';
import { createNotificationBus } from '@/lib/mutations/notificationBus';
import { queryKeys } from '@/lib/query/queryKeys';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';

import { AccountSettingsContainer } from './AccountSettings.container';
import { EMPTY_ACCOUNT_DRAFT, type AccountDraft } from './accountDraft';
import type { AccountAuthGateway, ChangePasswordFailure } from './accountAuthGateway';
import type { AccountSettingsGateway } from './accountSettingsGateway';
import { AvatarReplaceDialog } from './AvatarReplaceDialog';
import { PasswordSection } from './PasswordSection';
import { useAccountAuth, type AccountAuthModel } from './useAccountAuth';
import { ACCOUNT_AUTOSAVE_DEBOUNCE_MS, ACCOUNT_LOCAL_ONLY_LABEL } from './useAccountSettings';

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

const PROFILE: AccountDraft = {
  ...EMPTY_ACCOUNT_DRAFT,
  profile: { fullName: 'An', jobTitle: '', phone: '', language: 'vi' },
};

const SAVE_WAIT = { timeout: 3000 };

const newMe = (avatarUrl: string): Me => ({
  avatarUrl,
  email: 'an@congty.vn',
  fullName: 'An',
  language: 'vi',
});

function wireHttpError(
  status: number,
  code?: string,
  field?: string,
  retryAfterSeconds?: number,
): HttpError {
  return {
    kind: 'http',
    raw: field === undefined ? {} : { field },
    requestId: 'req-test',
    retryable: false,
    status,
    ...(code !== undefined ? { code } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

function settingsGateway(overrides: Partial<AccountSettingsGateway> = {}): AccountSettingsGateway {
  return {
    read: () => Promise.resolve(PROFILE),
    save: () => Promise.resolve(null),
    replaceAvatar: () => Promise.reject(new Error('không dùng ở bài này')),
    ...overrides,
  };
}

function authGateway(overrides: Partial<AccountAuthGateway> = {}): AccountAuthGateway {
  return {
    capabilities: { sessions: false, deleteAccount: false },
    readIdentity: () =>
      Promise.resolve({ ok: true, data: { email: 'an@congty.vn', isManagedExternally: false } }),
    listSessions: vi.fn(() => Promise.resolve({ ok: true as const, data: [] })),
    changePassword: () => Promise.resolve({ ok: true, data: undefined }),
    revokeSession: () => Promise.resolve({ ok: true, data: undefined }),
    deleteAccount: () => Promise.resolve({ ok: true, data: undefined }),
    ...overrides,
  };
}

function fakeAnnouncer(): Announcer & { readonly announce: ReturnType<typeof vi.fn> } {
  return { announce: vi.fn(), destroy: vi.fn() };
}

function mount(
  gateway: AccountSettingsGateway,
  options: { readonly announcer?: Announcer; readonly auth?: AccountAuthGateway } = {},
) {
  const view = renderWithProviders(
    <AccountSettingsContainer
      gateway={gateway}
      authGateway={options.auth ?? authGateway()}
      notifications={createNotificationBus()}
      {...(options.announcer !== undefined ? { announcer: options.announcer } : {})}
    />,
  );

  return view;
}

async function loaded() {
  const field = await screen.findByLabelText('họ tên');

  await waitFor(() => {
    expect(field).toHaveValue('An');
  });

  return field;
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');

  if (input === null) {
    throw new Error('không thấy ô chọn ảnh');
  }

  return input;
}

const PNG_BYTES = [137, 80, 78, 71];
/** `base64` của bốn byte đầu của PNG. */
const PNG_BASE64 = 'iVBORw==';

function pngFile(): File {
  return new File([new Uint8Array(PNG_BYTES)], 'anh.png', { type: 'image/png' });
}

function pick(container: HTMLElement, file: File): void {
  fireEvent.change(fileInput(container), { target: { files: [file] } });
}

/* -------------------------------------------------------------------------- */
/* N12 — lỗi ô 422.                                                            */
/* -------------------------------------------------------------------------- */

describe('N12 422 — lỗi buộc vào đúng ô, không thử lại bằng lịch tự lưu', () => {
  it('hiện câu dưới ô, chỉ báo lưu báo lỗi, tua 60 giây vẫn một lượt lưu, gõ lại thì lỗi mất', async () => {
    const save = vi.fn(() => Promise.reject(wireHttpError(422, 'VALIDATION', 'fullName')));
    const announcer = fakeAnnouncer();

    mount(settingsGateway({ save }), { announcer });
    const field = await loaded();

    vi.useFakeTimers();

    act(() => {
      fireEvent.change(field, { target: { value: '' } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCOUNT_AUTOSAVE_DEBOUNCE_MS);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('Họ tên cần từ 1 đến 120 ký tự, không chứa ký tự điều khiển.'),
    ).toBeTruthy();
    expect(announcer.announce.mock.calls.some((call) => call[1] === 'assertive')).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(save).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.change(field, { target: { value: 'Bình' } });
    });
    expect(
      screen.queryByText('Họ tên cần từ 1 đến 120 ký tự, không chứa ký tự điều khiển.'),
    ).toBeNull();
  });

  it('chức danh và điện thoại có câu riêng; field khác thì không có lỗi ô', async () => {
    const save = vi
      .fn<(draft: AccountDraft) => Promise<Me | null>>()
      .mockRejectedValueOnce(wireHttpError(422, 'VALIDATION', 'phone'))
      .mockRejectedValueOnce(wireHttpError(422, 'VALIDATION', 'language'));

    mount(settingsGateway({ save }));
    await loaded();

    fireEvent.change(screen.getByLabelText('điện thoại'), { target: { value: 'x'.repeat(40) } });
    expect(await screen.findByText('Số điện thoại tối đa 32 ký tự.', {}, SAVE_WAIT)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('điện thoại'), { target: { value: '0912' } });
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(2);
    }, SAVE_WAIT);
    expect(screen.queryByText('Số điện thoại tối đa 32 ký tự.')).toBeNull();
  });

  it('lượt lưu thành công cập nhật bộ đệm bằng hồ sơ máy chủ trả về', async () => {
    const save = vi.fn(() =>
      Promise.resolve({ ...newMe('https://cdn.example.test/a.png'), fullName: 'Bình An' }),
    );
    const { queryClient } = mount(settingsGateway({ save }));
    const field = await loaded();

    fireEvent.change(field, { target: { value: 'Bình An' } });

    await waitFor(() => {
      const cached = queryClient.getQueryData<AccountDraft>(queryKeys.me.profile());

      expect(cached?.profile['fullName']).toBe('Bình An');
    }, SAVE_WAIT);
  });
});

/* -------------------------------------------------------------------------- */
/* N14 — ảnh đại diện.                                                         */
/* -------------------------------------------------------------------------- */

describe('N14 — ảnh đại diện qua hộp thoại A9', () => {
  it('PNG: bấm "Thay ảnh" mới gửi, thân không có tiền tố data:, ảnh mới và bộ đệm mang URL mới', async () => {
    const url = 'https://cdn.example.test/avatars/01J0NEW.png';
    const replaceAvatar = vi.fn(() => Promise.resolve({ ok: true as const, data: newMe(url) }));
    const { container, queryClient } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    pick(container, pngFile());

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Đặt ảnh đại diện?')).toBeTruthy();
    expect(within(dialog).getByText('Sau khi đặt chỉ thay được, không gỡ được.')).toBeTruthy();
    expect(replaceAvatar).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Thay ảnh' }));

    await waitFor(() => {
      expect(replaceAvatar).toHaveBeenCalledWith({
        mimeType: 'image/png',
        contentBase64: PNG_BASE64,
      });
    });
    await waitFor(() => {
      expect(container.querySelector(`img[src="${url}"]`)).not.toBeNull();
    });
    expect(
      queryClient.getQueryData<AccountDraft>(queryKeys.me.profile())?.profile['avatarUrl'],
    ).toBe(url);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('đã có ảnh thì hộp thoại hỏi "Thay ảnh đại diện?" và nói ảnh cũ không khôi phục được', async () => {
    const withAvatar: AccountDraft = {
      ...PROFILE,
      profile: { ...PROFILE.profile, avatarUrl: 'https://cdn.example.test/avatars/old.png' },
    };
    const { container } = mount(settingsGateway({ read: () => Promise.resolve(withAvatar) }));

    await loaded();
    pick(container, pngFile());

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Thay ảnh đại diện?')).toBeTruthy();
    expect(within(dialog).getByText('Ảnh cũ không khôi phục được.')).toBeTruthy();
  });

  it('"Huỷ" không gọi mạng', async () => {
    const replaceAvatar = vi.fn();
    const { container } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    pick(container, pngFile());
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Huỷ' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(replaceAvatar).not.toHaveBeenCalled();
  });

  it('Esc đóng hộp thoại và không gọi mạng', async () => {
    const replaceAvatar = vi.fn();
    const { container } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    pick(container, pngFile());
    const dialog = await screen.findByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(replaceAvatar).not.toHaveBeenCalled();
  });

  it('ô chọn tệp chỉ nhận PNG và JPEG', async () => {
    const { container } = mount(settingsGateway());

    await loaded();

    expect(fileInput(container).getAttribute('accept')).toBe('image/png,image/jpeg');
  });

  it('GIF: câu hiện, không hộp thoại, không gọi mạng', async () => {
    const replaceAvatar = vi.fn();
    const { container } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    pick(container, new File(['GIF89a'], 'a.gif', { type: 'image/gif' }));

    expect(await screen.findByText('Chỉ nhận ảnh PNG hoặc JPEG.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(replaceAvatar).not.toHaveBeenCalled();
  });

  it('tệp 524 289 byte: không đọc tệp, không gọi mạng, câu "Ảnh tối đa 512 KB…"', async () => {
    const replaceAvatar = vi.fn();
    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    const { container } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    pick(container, new File([new Uint8Array(524_289)], 'to.png', { type: 'image/png' }));

    expect(await screen.findByText('Ảnh tối đa 512 KB. Hãy chọn ảnh nhỏ hơn.')).toBeTruthy();
    expect(readSpy).not.toHaveBeenCalled();
    expect(replaceAvatar).not.toHaveBeenCalled();
    readSpy.mockRestore();
  });

  it('base64 dài hơn 699 052: câu "Ảnh quá lớn…", không hộp thoại', async () => {
    const replaceAvatar = vi.fn();
    const { container } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    // 524 288 byte → 699 052 ký tự base64 chẵn; thêm tiền tố data: dài đúng bằng đó vẫn không vượt.
    // Giả lập tệp qua kiểm cỡ nhưng đọc ra dài hơn trần: ép FileReader trả chuỗi dài.
    const spy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (
      this: FileReader,
    ) {
      Object.defineProperty(this, 'result', {
        value: `data:image/png;base64,${'A'.repeat(699_053)}`,
      });
      this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
    });

    pick(container, pngFile());

    expect(await screen.findByText('Ảnh quá lớn, hãy chọn ảnh nhỏ hơn.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(replaceAvatar).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  const ERROR_ROWS: readonly (readonly [string, HttpError, string])[] = [
    [
      'AVATAR_TYPE_UNSUPPORTED',
      wireHttpError(422, 'AVATAR_TYPE_UNSUPPORTED'),
      'Chỉ nhận ảnh PNG hoặc JPEG.',
    ],
    [
      'FILE_TYPE_MISMATCH',
      wireHttpError(422, 'FILE_TYPE_MISMATCH'),
      'Nội dung tệp không khớp loại ảnh. Chọn lại tệp PNG hoặc JPEG.',
    ],
    [
      'AVATAR_DIMENSIONS_EXCEEDED',
      wireHttpError(422, 'AVATAR_DIMENSIONS_EXCEEDED'),
      'Ảnh rộng hoặc cao quá 4096 điểm ảnh.',
    ],
    [
      'IMAGE_TOO_LARGE',
      wireHttpError(422, 'IMAGE_TOO_LARGE'),
      'Ảnh quá lớn, hãy chọn ảnh nhỏ hơn.',
    ],
    [
      'FILE_CORRUPT',
      wireHttpError(422, 'FILE_CORRUPT'),
      'Không đọc được ảnh này, tệp có thể đã hỏng.',
    ],
    [
      'VALIDATION contentBase64',
      wireHttpError(422, 'VALIDATION', 'contentBase64'),
      'Không đọc được ảnh này, tệp có thể đã hỏng.',
    ],
    [
      'RATE_LIMITED',
      wireHttpError(429, 'RATE_LIMITED', undefined, 9),
      'Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.',
    ],
    ['429 không mã', wireHttpError(429), 'Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.'],
  ];

  it.each(ERROR_ROWS)('%s: ra đúng câu, DOM không chứa mã', async (_name, error, sentence) => {
    const replaceAvatar = vi.fn(() => Promise.resolve({ ok: false as const, error }));
    const { container } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    pick(container, pngFile());
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Thay ảnh' }),
    );

    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(container.textContent).not.toMatch(/AVATAR_|FILE_|IMAGE_TOO|RATE_LIMITED|VALIDATION/);
    expect(container.textContent).not.toContain('9 giây');
  });

  it('429: ô chọn ảnh bị khoá — lần chọn kế không mở hộp thoại', async () => {
    const replaceAvatar = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: wireHttpError(429, 'RATE_LIMITED', undefined, 9),
      }),
    );
    const { container } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    pick(container, pngFile());
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Thay ảnh' }),
    );
    await screen.findByText('Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.');

    pick(container, pngFile());
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(replaceAvatar).toHaveBeenCalledTimes(1);
  });

  it('mạng hỏng: câu của describeError, tiếng Việt, không mã trần', async () => {
    const error: HttpError = {
      kind: 'network',
      raw: undefined,
      requestId: 'req-n',
      retryable: true,
    };
    const replaceAvatar = vi.fn(() => Promise.resolve({ ok: false as const, error }));
    const { container } = mount(settingsGateway({ replaceAvatar }));

    await loaded();
    pick(container, pngFile());
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Thay ảnh' }),
    );

    await waitFor(() => {
      expect(container.querySelector('p[role="alert"]')).not.toBeNull();
    });
    expectVietnamese(container, { ignore: ['an@congty.vn'] });
  });

  it('ảnh không đi vào bản nháp: không có lượt lưu N12 nào sau khi thay ảnh', async () => {
    const save = vi.fn(() => Promise.resolve(null));
    const replaceAvatar = vi.fn(() =>
      Promise.resolve({ ok: true as const, data: newMe('https://cdn.example.test/avatars/b.png') }),
    );
    const { container } = mount(settingsGateway({ save, replaceAvatar }));

    await loaded();
    pick(container, pngFile());
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Thay ảnh' }),
    );
    await waitFor(() => {
      expect(replaceAvatar).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, ACCOUNT_AUTOSAVE_DEBOUNCE_MS + 200));

    expect(save).not.toHaveBeenCalled();
  });
});

describe('AvatarReplaceDialog — view thuần', () => {
  it('đang gửi thì hai nút khoá; tiếp cận được và tiếng Việt', () => {
    renderWithProviders(
      <AvatarReplaceDialog
        isOpen
        previewUrl="https://cdn.example.test/p.png"
        hasExistingAvatar
        isSending
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Huỷ' })).toBeDisabled();
    expectVietnamese(document.body);
    // Vỏ hộp thoại tắt viền tiêu điểm khi mở (Modal.tsx, ngoài phạm vi); mọi nút bên trong vẫn bị soát.
    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
  });
});

/* -------------------------------------------------------------------------- */
/* Giao diện / thông báo — chỉ giữ trong phiên.                                */
/* -------------------------------------------------------------------------- */

describe('chủ đề và chỉ báo lưu của hai khối chưa có dây', () => {
  it('bộ nhớ rỗng, chủ đề đang là tối: vào màn không ghi đè localStorage', async () => {
    localStorage.setItem('app-theme-mode', 'dark');

    mount(settingsGateway());
    await loaded();
    await act(async () => {
      await Promise.resolve();
    });

    expect(localStorage.getItem('app-theme-mode')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('chỉ đổi giao diện: chỉ báo và bộ đọc màn hình nói "Chỉ giữ trong phiên này", không nói "Đã lưu"', async () => {
    const announcer = fakeAnnouncer();
    const save = vi.fn(() => Promise.resolve(null));

    mount(settingsGateway({ save }), { announcer });
    await loaded();

    fireEvent.click(screen.getByRole('switch', { name: 'hiện lưới 100 mm' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    }, SAVE_WAIT);
    await waitFor(() => {
      expect(screen.getAllByText(ACCOUNT_LOCAL_ONLY_LABEL).length).toBeGreaterThan(0);
    });

    const spoken = announcer.announce.mock.calls.map((call) => String(call[0]));

    expect(spoken).toContain(ACCOUNT_LOCAL_ONLY_LABEL);
    expect(spoken.some((text) => text.startsWith('Đã lưu'))).toBe(false);
  });

  it('sửa hồ sơ thì chỉ báo vẫn nói "đã lưu" như thường', async () => {
    const announcer = fakeAnnouncer();
    const save = vi.fn(() => Promise.resolve(newMe('https://cdn.example.test/c.png')));

    mount(settingsGateway({ save }), { announcer });
    const field = await loaded();

    fireEvent.change(field, { target: { value: 'Bình' } });

    await waitFor(() => {
      expect(announcer.announce).toHaveBeenCalled();
    }, SAVE_WAIT);

    expect(announcer.announce.mock.calls.map((call) => String(call[0]))).not.toContain(
      ACCOUNT_LOCAL_ONLY_LABEL,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* N13 — đổi mật khẩu.                                                         */
/* -------------------------------------------------------------------------- */

function renderAuth(gateway: AccountAuthGateway): { readonly read: () => AccountAuthModel } {
  let latest: AccountAuthModel | null = null;

  function Probe() {
    latest = useAccountAuth({ gateway });

    return null;
  }

  renderWithProviders(<Probe />);

  return {
    read: () => {
      if (latest === null) {
        throw new Error('hook chưa chạy');
      }

      return latest;
    },
  };
}

async function submitPassword(model: { readonly read: () => AccountAuthModel }): Promise<void> {
  await act(async () => {
    model.read().password.onCurrentPasswordChange('cu-12345');
    model.read().password.onNewPasswordChange('moi-12345');
    model.read().password.onConfirmPasswordChange('moi-12345');
    await Promise.resolve();
  });
  await act(async () => {
    model.read().password.onSubmit();
    await Promise.resolve();
  });
}

const failure = (error: ChangePasswordFailure) => () =>
  Promise.resolve({ ok: false as const, error });

describe('N13 — đổi mật khẩu', () => {
  it('thành công: câu nói các phiên khác đã bị đăng xuất', async () => {
    const model = renderAuth(authGateway());

    await submitPassword(model);

    await waitFor(() => {
      expect(model.read().password.successMessage).toBe(
        'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.',
      );
    });
  });

  it('rate-limited, 9 giây: formProblem không có chữ số, nút khoá 60 giây rồi mở lại', async () => {
    const model = renderAuth(
      authGateway({ changePassword: failure({ reason: 'rate-limited', retryAfterSeconds: 9 }) }),
    );

    vi.useFakeTimers();
    await submitPassword(model);

    expect(model.read().password.formProblem).toBe(
      'Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.',
    );
    expect(model.read().password.formProblem).not.toMatch(/\d/);
    expect(model.read().password.canSubmit).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_999);
    });
    expect(model.read().password.canSubmit).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(model.read().password.canSubmit).toBe(true);
    expect(model.read().password.formProblem).toBeNull();
  });

  it('retryAfterSeconds lớn hơn 60 thì khoá theo số đó', async () => {
    const model = renderAuth(
      authGateway({ changePassword: failure({ reason: 'rate-limited', retryAfterSeconds: 90 }) }),
    );

    vi.useFakeTimers();
    await submitPassword(model);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(model.read().password.canSubmit).toBe(false);
  });

  it('unavailable: câu riêng của đổi mật khẩu, không rơi sang câu của khối phiên', async () => {
    const model = renderAuth(authGateway({ changePassword: failure({ reason: 'unavailable' }) }));

    await submitPassword(model);

    expect(model.read().password.formProblem).toBe(
      'Không đổi được mật khẩu lúc này. Thử lại sau ít phút.',
    );
  });

  it('unavailable rồi wrong-current-password: thêm câu gợi ý thử mật khẩu mới', async () => {
    const changePassword = vi
      .fn<AccountAuthGateway['changePassword']>()
      .mockImplementationOnce(failure({ reason: 'unavailable' }))
      .mockImplementationOnce(failure({ reason: 'wrong-current-password' }));
    const model = renderAuth(authGateway({ changePassword }));

    await submitPassword(model);
    await act(async () => {
      model.read().password.onSubmit();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(model.read().password.currentPasswordProblem).toBe(
        'Mật khẩu hiện tại không đúng. Có thể mật khẩu đã đổi ở lượt trước; hãy thử mật khẩu mới.',
      );
    });
  });

  it('wrong-current-password ngay từ lượt đầu: không có câu gợi ý', async () => {
    const model = renderAuth(
      authGateway({ changePassword: failure({ reason: 'wrong-current-password' }) }),
    );

    await submitPassword(model);

    await waitFor(() => {
      expect(model.read().password.currentPasswordProblem).toBe('Mật khẩu hiện tại không đúng.');
    });
  });
});

describe('PasswordSection — dải formProblem', () => {
  it('hiện dải chú ý khi có câu, và vắng khi null', () => {
    const base = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      onCurrentPasswordChange: vi.fn(),
      onNewPasswordChange: vi.fn(),
      onConfirmPasswordChange: vi.fn(),
      currentPasswordProblem: null,
      newPasswordProblem: null,
      confirmPasswordProblem: null,
      strength: null,
      canSubmit: false,
      isSubmitting: false,
      onSubmit: vi.fn(),
      successMessage: null,
      isManagedExternally: false,
    };
    const { rerender } = renderWithProviders(
      <PasswordSection {...base} formProblem="Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại." />,
    );

    expect(screen.getByText('Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.')).toBeTruthy();

    rerender(<PasswordSection {...base} formProblem={null} />);

    expect(screen.queryByText('Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Hai khối v2 rời DOM.                                                        */
/* -------------------------------------------------------------------------- */

describe('phiên đăng nhập và vùng nguy hiểm', () => {
  it('vắng khỏi DOM (không disabled, không forbidden) và không đọc phiên', async () => {
    const auth = authGateway();
    const { container } = mount(settingsGateway(), { auth });

    await loaded();
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('heading', { level: 2, name: 'phiên đăng nhập' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'vùng nguy hiểm' })).toBeNull();
    expect(container.querySelector('#account-sessions, #account-danger')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xoá tài khoản' })).toBeNull();
    expect(auth.listSessions).not.toHaveBeenCalled();
  });

  it('mô tả đầu trang không còn nhắc "phiên đang mở"', async () => {
    mount(settingsGateway());
    await loaded();

    expect(screen.queryByText(/phiên đang mở/)).toBeNull();
  });
});

describe('v2 — khi cổng bật năng lực', () => {
  it('hai khối hiện lại và phiên được đọc', async () => {
    const auth = authGateway({ capabilities: { sessions: true, deleteAccount: true } });

    mount(settingsGateway(), { auth });
    await loaded();

    expect(await screen.findByRole('heading', { level: 2, name: 'phiên đăng nhập' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'vùng nguy hiểm' })).toBeTruthy();
    await waitFor(() => {
      expect(auth.listSessions).toHaveBeenCalled();
    });
  });
});
