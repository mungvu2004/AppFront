/**
 * Bộ kiểm của khối mật khẩu — view thuần, luật của mật khẩu mới, và trạng thái 4/6.
 *
 * Hai nửa, đúng theo mục D. Nửa trên dựng `PasswordSection` **chỉ từ props**:
 * không store, không mạng, không đồng hồ. Nửa dưới dựng `useAccountAuth` với một
 * cổng giả và đọc phần `password` của mô hình nó trả về — đó là nơi mọi quyết
 * định sống, nên đó là nơi phải soát chúng.
 *
 * Bộ kiểm bảy trạng thái cấp màn là lượt cuối, không phải lượt này.
 */

import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MIN_PASSWORD_LENGTH } from '@/api/schemas';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';

import type { AccountAuthGateway } from './accountAuthGateway';
import {
  MANAGED_EXTERNALLY_REASON,
  PasswordSection,
  type PasswordSectionProps,
} from './PasswordSection';
import {
  newPasswordProblemOf,
  passwordStrengthOf,
  useAccountAuth,
  type AccountAuthModel,
  type UseAccountAuthOptions,
} from './useAccountAuth';

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

function baseProps(overrides: Partial<PasswordSectionProps> = {}): PasswordSectionProps {
  return {
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
    ...overrides,
  };
}

/** Cổng giả: mỗi phép trả về thứ test cần, không có bộ nhớ nào ở giữa. */
function fakeGateway(overrides: Partial<AccountAuthGateway> = {}): AccountAuthGateway {
  return {
    readIdentity: () =>
      Promise.resolve({ ok: true, data: { email: 'an@congty.vn', isManagedExternally: false } }),
    listSessions: () => Promise.resolve({ ok: true, data: [] }),
    changePassword: () => Promise.resolve({ ok: true, data: undefined }),
    revokeSession: () => Promise.resolve({ ok: true, data: undefined }),
    deleteAccount: () => Promise.resolve({ ok: true, data: undefined }),
    ...overrides,
  };
}

/**
 * Đọc mô hình mà hook trả về, không vẽ gì cả.
 *
 * Gán trong lúc render là việc chỉ bộ kiểm mới làm; đổi lại, mọi phép khẳng định
 * dưới đây nói về **mô hình**, tức về quyết định, chứ không nói về markup mà nửa
 * trên đã soát rồi.
 */
function renderModel(options: UseAccountAuthOptions): { readonly read: () => AccountAuthModel } {
  let latest: AccountAuthModel | null = null;

  function Probe() {
    latest = useAccountAuth(options);

    return null;
  }

  renderWithProviders(<Probe />);

  return {
    read: () => {
      if (latest === null) {
        throw new Error('hook chưa chạy lần nào');
      }

      return latest;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* View thuần.                                                                 */
/* -------------------------------------------------------------------------- */

describe('khối mật khẩu — view dựng chỉ từ props', () => {
  it('vẽ ba ô và đúng một cái nút', () => {
    renderWithProviders(<PasswordSection {...baseProps()} />);

    expect(screen.getByLabelText('mật khẩu hiện tại')).toBeTruthy();
    expect(screen.getByLabelText('mật khẩu mới')).toBeTruthy();
    expect(screen.getByLabelText('nhắc lại mật khẩu mới')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Đổi mật khẩu' })).toBeTruthy();
  });

  it('gõ vào một ô thì gọi đúng một hàm của ô đó', () => {
    const onNewPasswordChange = vi.fn();

    renderWithProviders(<PasswordSection {...baseProps({ onNewPasswordChange })} />);

    fireEvent.change(screen.getByLabelText('mật khẩu mới'), { target: { value: 'matkhau1' } });

    expect(onNewPasswordChange).toHaveBeenCalledWith('matkhau1');
  });

  it('bấm nút và gõ Enter đều gửi đi — bàn phím là đường hạng nhất (A12)', () => {
    const onSubmit = vi.fn();

    const { container } = renderWithProviders(
      <PasswordSection {...baseProps({ canSubmit: true, onSubmit })} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    const form = container.querySelector('form');

    if (form === null) {
      throw new Error('khối mật khẩu phải là một <form> để Enter gửi được');
    }

    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('chưa gõ đủ ba ô thì nút khoá', () => {
    renderWithProviders(<PasswordSection {...baseProps({ canSubmit: false })} />);

    expect(screen.getByRole('button', { name: 'Đổi mật khẩu' })).toBeDisabled();
  });

  it('thanh sức mạnh đọc được thành chữ, và ba mức là ba câu khác nhau', () => {
    const { rerender } = renderWithProviders(
      <PasswordSection {...baseProps({ newPassword: 'matkhau', strength: 'weak' })} />,
    );
    expect(screen.getByText('Độ mạnh: yếu')).toBeTruthy();

    rerender(<PasswordSection {...baseProps({ newPassword: 'matkhau1', strength: 'fair' })} />);
    expect(screen.getByText('Độ mạnh: khá')).toBeTruthy();

    rerender(
      <PasswordSection {...baseProps({ newPassword: 'matkhaudai12', strength: 'strong' })} />,
    );
    expect(screen.getByText('Độ mạnh: mạnh')).toBeTruthy();
  });

  it('ô mật khẩu mới còn trống thì không có thanh nào', () => {
    renderWithProviders(<PasswordSection {...baseProps({ strength: null })} />);

    expect(screen.queryByText(/Độ mạnh/)).toBeNull();
  });

  it('trạng thái 4 — lỗi buộc vào đúng ô mật khẩu hiện tại', () => {
    renderWithProviders(
      <PasswordSection
        {...baseProps({ currentPasswordProblem: 'Mật khẩu hiện tại không đúng.' })}
      />,
    );

    const field = screen.getByLabelText('mật khẩu hiện tại');
    const problem = screen.getByRole('alert');

    expect(problem.textContent).toBe('Mật khẩu hiện tại không đúng.');
    // Buộc vào ô, không phải một dải cảnh báo lơ lửng: trình đọc màn hình đọc
    // câu này ngay khi tiêu điểm rơi vào ô.
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(problem.getAttribute('id'));
    // Và ô kia thì không việc gì.
    expect(screen.getByLabelText('mật khẩu mới').getAttribute('aria-invalid')).toBeNull();
  });

  it('trạng thái 6 — tài khoản của công ty: khối chỉ đọc, không ô nào, không nút nào', () => {
    const { container } = renderWithProviders(
      <PasswordSection {...baseProps({ isManagedExternally: true })} />,
    );

    expect(screen.getByText(MANAGED_EXTERNALLY_REASON)).toBeTruthy();
    expect(MANAGED_EXTERNALLY_REASON).toBe('Do quản trị viên công ty quản lý.');
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('chuỗi là tiếng Việt có dấu, và cây render tiếp cận được', () => {
    const { container } = renderWithProviders(
      <PasswordSection
        {...baseProps({
          newPassword: 'matkhau1',
          strength: 'fair',
          currentPasswordProblem: 'Mật khẩu hiện tại không đúng.',
          successMessage: 'Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.',
          canSubmit: true,
        })}
      />,
    );

    expectVietnamese(container);
    expectAccessible(container);
  });
});

/* -------------------------------------------------------------------------- */
/* Luật của mật khẩu mới — nửa còn thiếu của T-04.                             */
/* -------------------------------------------------------------------------- */

describe('luật mật khẩu mới ghép tại chỗ trên PasswordSchema', () => {
  it('ô trống là "chưa nhập", không phải "quá ngắn"', () => {
    expect(newPasswordProblemOf('')).toBe('Chưa nhập mật khẩu mới.');
  });

  it('ngắn hơn ngưỡng của src/api thì nói đúng ngưỡng đó', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(newPasswordProblemOf('abc1')).toBe('Mật khẩu cần ít nhất 8 ký tự.');
  });

  it('đủ dài nhưng thiếu số, hoặc thiếu chữ, đều bị từ chối', () => {
    expect(newPasswordProblemOf('matkhaudai')).toBe('Mật khẩu cần có cả chữ và số.');
    expect(newPasswordProblemOf('12345678')).toBe('Mật khẩu cần có cả chữ và số.');
  });

  it('đủ dài, có chữ và số thì không còn gì để phàn nàn', () => {
    expect(newPasswordProblemOf('matkhau1')).toBeNull();
  });

  it('thanh sức mạnh và phép kiểm không nói khác nhau', () => {
    // Không có thanh khi chưa gõ gì.
    expect(passwordStrengthOf('')).toBeNull();
    // Mọi chuỗi phép kiểm từ chối đều là mức thấp nhất — đó là bất biến của khối.
    for (const rejected of ['abc1', 'matkhaudai', '12345678']) {
      expect(newPasswordProblemOf(rejected)).not.toBeNull();
      expect(passwordStrengthOf(rejected)).toBe('weak');
    }

    expect(passwordStrengthOf('matkhau1')).toBe('fair');
    expect(passwordStrengthOf('matkhaurat1dai')).toBe('strong');
  });
});

/* -------------------------------------------------------------------------- */
/* Hook — quyết định của khối.                                                 */
/* -------------------------------------------------------------------------- */

describe('useAccountAuth — phần mật khẩu', () => {
  it('không gửi gì khi ba ô chưa đủ, và nút khoá cho tới lúc đủ', async () => {
    const changePassword = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const model = renderModel({ gateway: fakeGateway({ changePassword }) });

    expect(model.read().password.canSubmit).toBe(false);

    await act(async () => {
      model.read().password.onCurrentPasswordChange('matkhau123');
      await Promise.resolve();
    });
    expect(model.read().password.canSubmit).toBe(false);

    await act(async () => {
      model.read().password.onNewPasswordChange('matkhaumoi1');
      model.read().password.onConfirmPasswordChange('matkhaumoi1');
      await Promise.resolve();
    });

    expect(model.read().password.canSubmit).toBe(true);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('hai ô nhắc lại lệch nhau thì dừng trước khi chạm cổng', async () => {
    const changePassword = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const model = renderModel({ gateway: fakeGateway({ changePassword }) });

    await act(async () => {
      model.read().password.onCurrentPasswordChange('matkhau123');
      model.read().password.onNewPasswordChange('matkhaumoi1');
      model.read().password.onConfirmPasswordChange('matkhaumoi2');
      await Promise.resolve();
    });

    await act(async () => {
      model.read().password.onSubmit();
      await Promise.resolve();
    });

    expect(changePassword).not.toHaveBeenCalled();
    expect(model.read().password.confirmPasswordProblem).toBe('Hai ô mật khẩu chưa khớp nhau.');
  });

  it('trạng thái 4 — cổng nói mật khẩu hiện tại sai, câu lỗi về đúng ô đó', async () => {
    const model = renderModel({
      gateway: fakeGateway({
        changePassword: () => Promise.resolve({ ok: false, error: 'wrong-current-password' }),
      }),
    });

    await act(async () => {
      model.read().password.onCurrentPasswordChange('saibet');
      model.read().password.onNewPasswordChange('matkhaumoi1');
      model.read().password.onConfirmPasswordChange('matkhaumoi1');
      await Promise.resolve();
    });

    await act(async () => {
      model.read().password.onSubmit();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(model.read().password.currentPasswordProblem).toBe('Mật khẩu hiện tại không đúng.');
    });

    // Lỗi nằm ở ô mật khẩu hiện tại và KHÔNG lan sang hai ô kia.
    expect(model.read().password.newPasswordProblem).toBeNull();
    expect(model.read().password.confirmPasswordProblem).toBeNull();
    // Gõ lại ô đó thì câu lỗi biến — nó nói về chuỗi vừa bị thay.
    await act(async () => {
      model.read().password.onCurrentPasswordChange('matkhau123');
      await Promise.resolve();
    });
    expect(model.read().password.currentPasswordProblem).toBeNull();
  });

  it('đổi được thì ba ô trống lại và có một câu báo xong', async () => {
    const changePassword = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const model = renderModel({ gateway: fakeGateway({ changePassword }) });

    await act(async () => {
      model.read().password.onCurrentPasswordChange('matkhau123');
      model.read().password.onNewPasswordChange('matkhaumoi1');
      model.read().password.onConfirmPasswordChange('matkhaumoi1');
      await Promise.resolve();
    });

    await act(async () => {
      model.read().password.onSubmit();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(model.read().password.successMessage).toBe(
        'Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.',
      );
    });

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'matkhau123',
      newPassword: 'matkhaumoi1',
    });
    expect(model.read().password.currentPassword).toBe('');
    expect(model.read().password.newPassword).toBe('');
    expect(model.read().password.confirmPassword).toBe('');
  });

  it('trạng thái 6 — cổng nói tài khoản do công ty giữ thì không có đường gửi', async () => {
    const changePassword = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const model = renderModel({
      gateway: fakeGateway({
        changePassword,
        readIdentity: () =>
          Promise.resolve({ ok: true, data: { email: 'an@congty.vn', isManagedExternally: true } }),
      }),
    });

    await waitFor(() => {
      expect(model.read().password.isManagedExternally).toBe(true);
    });

    await act(async () => {
      model.read().password.onCurrentPasswordChange('matkhau123');
      model.read().password.onNewPasswordChange('matkhaumoi1');
      model.read().password.onConfirmPasswordChange('matkhaumoi1');
      await Promise.resolve();
    });

    await act(async () => {
      model.read().password.onSubmit();
      await Promise.resolve();
    });

    expect(changePassword).not.toHaveBeenCalled();
  });
});
