/**
 * Bộ kiểm của vùng nguy hiểm — cửa của A9, và cái cửa đó phải thật sự đóng.
 *
 * Một hộp thoại xác nhận chỉ đáng tin khi *không* mở được bằng cách bấm bừa. Ba
 * phép khẳng định nặng nhất ở đây đều nói về việc **không xảy ra**: nút xoá khoá
 * chừng nào địa chỉ chưa khớp, cổng chưa hề bị gọi khi hộp thoại còn đóng, và
 * Esc đóng hộp thoại (A12) chứ không xoá gì.
 */

import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';

import type { AccountAuthGateway } from './accountAuthGateway';
import { DangerZone, type DangerZoneProps } from './DangerZone';
import { useAccountAuth, type AccountAuthModel, type UseAccountAuthOptions } from './useAccountAuth';

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

const EMAIL = 'an@congty.vn';

function baseProps(overrides: Partial<DangerZoneProps> = {}): DangerZoneProps {
  return {
    email: EMAIL,
    isDialogOpen: false,
    onRequestDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
    confirmValue: '',
    onConfirmValueChange: vi.fn(),
    canConfirm: false,
    isDeleting: false,
    errorMessage: null,
    ...overrides,
  };
}

function fakeGateway(overrides: Partial<AccountAuthGateway> = {}): AccountAuthGateway {
  return {
    readIdentity: () =>
      Promise.resolve({ ok: true, data: { email: EMAIL, isManagedExternally: false } }),
    listSessions: () => Promise.resolve({ ok: true, data: [] }),
    changePassword: () => Promise.resolve({ ok: true, data: undefined }),
    revokeSession: () => Promise.resolve({ ok: true, data: undefined }),
    deleteAccount: () => Promise.resolve({ ok: true, data: undefined }),
    ...overrides,
  };
}

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

describe('vùng nguy hiểm — view dựng chỉ từ props', () => {
  it('hộp thoại đóng thì chỉ có một nút, và nó chỉ mở hộp thoại', () => {
    const onRequestDelete = vi.fn();

    renderWithProviders(<DangerZone {...baseProps({ onRequestDelete })} />);

    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Xoá tài khoản' }));

    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });

  it('hộp thoại mở thì bắt gõ lại đúng địa chỉ của tài khoản', () => {
    const onConfirmValueChange = vi.fn();

    renderWithProviders(
      <DangerZone {...baseProps({ isDialogOpen: true, onConfirmValueChange })} />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();

    // Địa chỉ đứng riêng trong <code>, không nhét vào nhãn của ô — xem
    // `DangerZone.tsx`. Câu nhắc vẫn phải nói ra đúng địa chỉ ấy.
    expect(screen.getByText(EMAIL)).toBeTruthy();

    const field = screen.getByLabelText('địa chỉ thư');
    fireEvent.change(field, { target: { value: EMAIL } });

    expect(onConfirmValueChange).toHaveBeenCalledWith(EMAIL);
  });

  it('địa chỉ chưa khớp thì nút xoá vĩnh viễn khoá', () => {
    renderWithProviders(<DangerZone {...baseProps({ isDialogOpen: true, canConfirm: false })} />);

    expect(screen.getByRole('button', { name: 'Xoá vĩnh viễn' })).toBeDisabled();
  });

  it('địa chỉ khớp rồi thì nút mở, và bấm mới gọi onConfirmDelete', () => {
    const onConfirmDelete = vi.fn();

    renderWithProviders(
      <DangerZone
        {...baseProps({
          isDialogOpen: true,
          canConfirm: true,
          confirmValue: EMAIL,
          onConfirmDelete,
        })}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Xoá vĩnh viễn' });
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });

  it('Esc đóng hộp thoại — A12, và nó không xoá gì', () => {
    const onCancelDelete = vi.fn();
    const onConfirmDelete = vi.fn();

    renderWithProviders(
      <DangerZone
        {...baseProps({ isDialogOpen: true, canConfirm: true, onCancelDelete, onConfirmDelete })}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancelDelete).toHaveBeenCalled();
    expect(onConfirmDelete).not.toHaveBeenCalled();
  });

  it('lỗi của lượt xoá hiện trong chính hộp thoại', () => {
    renderWithProviders(
      <DangerZone
        {...baseProps({
          isDialogOpen: true,
          errorMessage: 'Địa chỉ vừa gõ không khớp với tài khoản này.',
        })}
      />,
    );

    expect(
      screen.getByText('Địa chỉ vừa gõ không khớp với tài khoản này.'),
    ).toBeTruthy();
  });

  it('chuỗi là tiếng Việt có dấu, và cây render tiếp cận được', () => {
    const { container } = renderWithProviders(
      <DangerZone {...baseProps({ isDialogOpen: true, confirmValue: EMAIL, canConfirm: true })} />,
    );

    // Hộp thoại dựng ngoài `container` của lượt render, nên soát cả `body`.
    expectVietnamese(document.body);

    // Bỏ đúng MỘT phần tử: cái vỏ `role="dialog"` của `Modal.Root`. Nó mang
    // `tabIndex={-1}` cùng `outline-none` vì bẫy tiêu điểm gọi `.focus()` lên
    // nó khi mở, và một vòng sáng quanh cả hộp thoại lúc ấy là thứ không trình
    // duyệt nào vẽ. `ignoreSelector` chỉ bỏ phần tử KHỚP, không bỏ cây con —
    // nên mọi nút và ô bên trong hộp thoại vẫn bị soát đủ. Cái vỏ ấy nằm ở
    // `src/components/overlay/Modal.tsx`, ngoài phần T3 được sửa.
    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
    expect(container).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/* Hook — cửa xác nhận.                                                        */
/* -------------------------------------------------------------------------- */

describe('useAccountAuth — vùng nguy hiểm', () => {
  it('không mở cửa cho tới khi địa chỉ gõ lại khớp, và khoảng trắng hay hoa thường không tính', async () => {
    const deleteAccount = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const model = renderModel({ gateway: fakeGateway({ deleteAccount }) });

    await waitFor(() => {
      expect(model.read().danger.email).toBe(EMAIL);
    });

    expect(model.read().danger.canConfirm).toBe(false);

    await act(async () => {
      model.read().danger.onConfirmValueChange('nguoikhac@congty.vn');
      await Promise.resolve();
    });
    expect(model.read().danger.canConfirm).toBe(false);

    await act(async () => {
      model.read().danger.onConfirmValueChange('  AN@Congty.VN  ');
      await Promise.resolve();
    });
    expect(model.read().danger.canConfirm).toBe(true);

    // Cửa đóng thì bấm cũng không qua: một cửa của A9 chỉ đáng tin khi nó chặn
    // được cả lời gọi thẳng, không riêng cái nút.
    await act(async () => {
      model.read().danger.onConfirmValueChange('sai@congty.vn');
      await Promise.resolve();
    });
    await act(async () => {
      model.read().danger.onConfirmDelete();
      await Promise.resolve();
    });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('khớp rồi thì gọi cổng đúng một lần và chạy tiếp việc sau khi xoá', async () => {
    const deleteAccount = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const onDeleted = vi.fn();
    const model = renderModel({ gateway: fakeGateway({ deleteAccount }), onDeleted });

    await waitFor(() => {
      expect(model.read().danger.email).toBe(EMAIL);
    });

    await act(async () => {
      model.read().danger.onRequestDelete();
      model.read().danger.onConfirmValueChange(EMAIL);
      await Promise.resolve();
    });

    expect(model.read().danger.isDialogOpen).toBe(true);

    await act(async () => {
      model.read().danger.onConfirmDelete();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });

    expect(deleteAccount).toHaveBeenCalledWith({ confirmEmail: EMAIL });
    expect(model.read().danger.isDialogOpen).toBe(false);
  });

  it('cổng từ chối thì hộp thoại ở nguyên đó, kèm câu lỗi', async () => {
    const model = renderModel({
      gateway: fakeGateway({
        deleteAccount: () => Promise.resolve({ ok: false, error: 'email-mismatch' }),
      }),
    });

    await waitFor(() => {
      expect(model.read().danger.email).toBe(EMAIL);
    });

    await act(async () => {
      model.read().danger.onRequestDelete();
      model.read().danger.onConfirmValueChange(EMAIL);
      await Promise.resolve();
    });

    await act(async () => {
      model.read().danger.onConfirmDelete();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(model.read().danger.errorMessage).toBe(
        'Địa chỉ vừa gõ không khớp với tài khoản này.',
      );
    });

    expect(model.read().danger.isDialogOpen).toBe(true);
  });

  it('bỏ ngang thì hộp thoại đóng và ô gõ lại trống trơn', async () => {
    const model = renderModel({ gateway: fakeGateway() });

    await waitFor(() => {
      expect(model.read().danger.email).toBe(EMAIL);
    });

    await act(async () => {
      model.read().danger.onRequestDelete();
      model.read().danger.onConfirmValueChange(EMAIL);
      await Promise.resolve();
    });

    await act(async () => {
      model.read().danger.onCancelDelete();
      await Promise.resolve();
    });

    expect(model.read().danger.isDialogOpen).toBe(false);
    expect(model.read().danger.confirmValue).toBe('');
    expect(model.read().danger.canConfirm).toBe(false);
  });
});
