/**
 * Bộ kiểm của T8 cho màn `UserManagement` — bốn bộ khẳng định dùng chung (mục 2.2 đặc tả) cộng
 * khẳng định riêng của màn, viết CHỈ từ hợp đồng (`types.ts` + `userManagementScenarios.ts`),
 * không đợi mã hiện thực (R-60/mục D).
 *
 * ## `./UserManagement` (view) đang được viết SONG SONG, CHƯA TỒN TẠI trong worktree này
 *
 * `UserManagement.tsx` (T6), `UserManagementDetail.tsx` (T7) và `useUserManagement.ts` (T5)
 * đang được viết trên ba nhánh khác. Đúng khuôn `ModelLibrary.test.tsx`: mọi lời gọi tới view
 * đi qua `import()` ĐỘNG với tham số là MỘT BIẾN (không phải chuỗi literal) — Vite hoãn việc
 * phân giải sang lúc CHẠY nên một import hỏng chỉ làm hỏng ĐÚNG một `it`, và vì tham số không
 * phải chuỗi literal, TypeScript không cố phân giải module lúc typecheck, nên `pnpm typecheck`
 * không đỏ vì việc này.
 *
 * Vì thế MỌI bài dưới đây hỏng riêng lẻ với "Failed to resolve" cho tới khi lớp gộp (T9) ghép
 * view thật vào — đó là DỰ KIẾN (R-70: không sửa test cho khớp code chưa tồn tại), không phải
 * thất bại. **Bộ này chưa chạy trọn vẹn ở T8 — nó sẽ chạy thật ở lớp gộp** (E.10: không báo
 * "đạt" cho một bước chưa chạy).
 *
 * ## Dữ liệu KHÔNG khai lại ở đây — nhập từ `userManagementScenarios.ts` (R-70)
 *
 * Bảy kịch bản và `USER_MANAGEMENT_ACTIONS` (no-op) đến từ file dữ liệu thuần cùng thư mục,
 * cũng được `UserManagement.stories.tsx` nhập — một nguồn, không hai bản trôi khỏi nhau. Bài
 * nào cần theo dõi lời gọi action tự dựng `buildActions()` (`vi.fn()`) riêng ở đây, vì file
 * kịch bản không được nhập `vitest` (Storybook không đóng gói được nó).
 */

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';

import type { UserManagementActions, UserManagementProps, UserManagementViewModel } from './types';
import {
  USER_MANAGEMENT_ACTIONS,
  USER_MANAGEMENT_SCENARIOS,
  USER_MANAGEMENT_SCENARIO_FORBIDDEN,
  USER_MANAGEMENT_SCENARIO_PARTIAL,
  USER_MANAGEMENT_SCENARIO_SUCCESS,
  userManagementScenarioFor,
} from './userManagementScenarios';
import * as UserManagementModule from './UserManagement';

const DIALOG_IGNORE = { ignoreSelector: '[role="dialog"]' } as const;

/* ==========================================================================
 * 0. Hạ tầng: nhập file cùng thư mục qua biến, không qua chuỗi tĩnh (xem đầu file).
 * ========================================================================== */


/*
 * Nhập TĨNH, tra qua map — trước đây là một lượt `import()` động có `@vite-ignore`.
 *
 * Giàn giáo động ấy có lý do thật lúc nó được viết: các tệp anh em trong thư mục CHƯA tồn tại, và
 * một lượt nhập tĩnh làm Vite sập lúc transform, kéo sập cả tệp. Nay cả thư mục đã đủ tệp và
 * không bài nào trong tệp này dùng `vi.mock`, nên giàn giáo hết việc — còn cái giá thì vẫn trả:
 * `@vite-ignore` làm Vite bỏ phân tích import, nên cả cây module của màn mới được
 * resolve/transform/nạp BÊN TRONG bài kiểm đầu tiên gọi tới, và bài đó đếm luôn lượt biên dịch
 * vào 5 000 ms của nó (`testTimeout` mặc định của vitest — `vitest.config.ts` không khai nó).
 *
 * Nhập tĩnh chuyển việc ấy sang pha `collect`, pha không bị `testTimeout` chặn. Chữ ký của
 * `importFromScreen` và mọi chỗ gọi giữ nguyên, nên diff chỉ nằm ở đây.
 */
const MODULE_MAN: Record<string, unknown> = {
  './UserManagement': UserManagementModule,
};

async function importFromScreen<T>(specifier: string): Promise<T> {
  return MODULE_MAN[specifier] as T;
}

async function loadUserManagementView(): Promise<ComponentType<UserManagementProps>> {
  const mod = await importFromScreen<{ UserManagement: ComponentType<UserManagementProps> }>('./UserManagement');

  return mod.UserManagement;
}

/** Actions với `vi.fn()` — mỗi lời gọi tạo bộ MỚI, không rò số lần gọi giữa các `it`. */
function buildActions(overrides: Partial<UserManagementActions> = {}): UserManagementActions {
  return {
    onSearchChange: vi.fn(),
    onClearSearch: vi.fn(),
    onRoleFilterChange: vi.fn(),
    onStatusFilterChange: vi.fn(),
    onSelectUser: vi.fn(),
    onChangeRole: vi.fn(),
    onChangeMembershipRole: vi.fn(),
    onDisableUser: vi.fn(),
    onEnableUser: vi.fn(),
    onResendInvite: vi.fn(),
    onOpenInvite: vi.fn(),
    onCloseInvite: vi.fn(),
    onInviteEmailsChange: vi.fn(),
    onInviteRoleChange: vi.fn(),
    onSubmitInvite: vi.fn(),
    onOpenRemove: vi.fn(),
    onCloseRemove: vi.fn(),
    onRemoveEmailChange: vi.fn(),
    onConfirmRemove: vi.fn(),
    onOpenPermissionReference: vi.fn(),
    onClosePermissionReference: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

function requireRow(
  model: UserManagementViewModel,
  predicate: (row: UserManagementViewModel['rows'][number]) => boolean,
  what: string,
): UserManagementViewModel['rows'][number] {
  const row = model.rows.find(predicate);

  if (row === undefined) {
    throw new Error(`requireRow: kịch bản cần ${what}.`);
  }

  return row;
}

afterEach(() => {
  cleanup();
});

/* ==========================================================================
 * 1. `expectSevenStates` — 7/7 (R-63). Đây là bài quan trọng nhất.
 * ========================================================================== */

describe('A11 — bảy trạng thái của UserManagement', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', async () => {
    const UserManagementView = await loadUserManagementView();
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      const model = userManagementScenarioFor(scenario.state);

      return renderWithProviders(<UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={model} />);
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(USER_MANAGEMENT_SCENARIOS.length);
  });
});

/* ==========================================================================
 * 2. `expectAccessible` (R-72). Panel dưới 1024 dùng Drawer → cần ignoreSelector dialog.
 * ========================================================================== */

describe('R-72 — expectAccessible trên cây render thật', () => {
  it('trạng thái "thành công" tiếp cận được', async () => {
    const UserManagementView = await loadUserManagementView();

    renderWithProviders(
      <UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={USER_MANAGEMENT_SCENARIO_SUCCESS} />,
    );

    expectAccessible(document.body, DIALOG_IGNORE);
  });

  it('trạng thái "không có quyền" tiếp cận được', async () => {
    const UserManagementView = await loadUserManagementView();

    renderWithProviders(
      <UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={USER_MANAGEMENT_SCENARIO_FORBIDDEN} />,
    );

    expectAccessible(document.body, DIALOG_IGNORE);
  });

  it('trạng thái "thu gọn" tiếp cận được', async () => {
    const UserManagementView = await loadUserManagementView();
    const model = userManagementScenarioFor('collapsed');

    renderWithProviders(<UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={model} />);

    expectAccessible(document.body, DIALOG_IGNORE);
  });
});

/* ==========================================================================
 * 3. `expectVietnamese` (R-72). Email trong DOM là ASCII — cần `ignore`, không thì đỏ oan.
 * ========================================================================== */

describe('R-72 — expectVietnamese trên cây render thật', () => {
  it('trạng thái "thành công": toàn chữ tiếng Việt có dấu, trừ email', async () => {
    const UserManagementView = await loadUserManagementView();
    const { container } = renderWithProviders(
      <UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={USER_MANAGEMENT_SCENARIO_SUCCESS} />,
    );

    expectVietnamese(container, {
      ignore: [/^https?:\/\//u, /^[\w.+-]+@[\w-]+\.[\w.-]+$/u],
    });
  });
});

/* ==========================================================================
 * 4. `expectNoRawColor` (A1). Quét cả thư mục màn — file view của T5/T6/T7 chưa có thì bài
 *    này chỉ thấy file của T8 (đều sạch); khi gộp nó quét luôn view thật.
 * ========================================================================== */

describe('A1 — expectNoRawColor trên cả thư mục màn', () => {
  it('không mã màu thô nào trong src/screens/admin/UserManagement', () => {
    expect(() => {
      expectNoRawColor('src/screens/admin/UserManagement');
    }).not.toThrow();
  });
});

/* ==========================================================================
 * 5. Khẳng định riêng của màn (brief mục 2.2, nhóm "riêng của màn này").
 * ========================================================================== */

describe('Ma trận quyền (Đ-2): đúng 3 cột × 7 dòng, mọi ô đọc được', () => {
  it('mọi kịch bản: permissionMatrix có đúng 3 cột, 7 dòng, mỗi ô có srLabel', () => {
    for (const scenario of USER_MANAGEMENT_SCENARIOS) {
      expect(scenario.permissionMatrix.columns, scenario.state).toHaveLength(3);
      expect(scenario.permissionMatrix.rows, scenario.state).toHaveLength(7);

      for (const row of scenario.permissionMatrix.rows) {
        expect(row.cells, `${scenario.state}/${row.key}`).toHaveLength(3);

        for (const cell of row.cells) {
          expect(cell.srLabel.length, `${scenario.state}/${row.key}/${cell.role}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('trạng thái "không có quyền": nhãn của cả bảy dòng ma trận vẫn hiện trong DOM', async () => {
    const UserManagementView = await loadUserManagementView();

    renderWithProviders(
      <UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={USER_MANAGEMENT_SCENARIO_FORBIDDEN} />,
    );

    for (const row of USER_MANAGEMENT_SCENARIO_FORBIDDEN.permissionMatrix.rows) {
      expect(screen.getByText(row.label), row.key).toBeTruthy();
    }
  });
});

describe('Trạng thái 6 (Đ-7) — "không có quyền": chỉ ma trận, không danh sách người', () => {
  it('rows rỗng ở tầng dữ liệu, và không có bảng người dùng nào trong DOM', async () => {
    expect(USER_MANAGEMENT_SCENARIO_FORBIDDEN.rows).toHaveLength(0);

    const UserManagementView = await loadUserManagementView();

    renderWithProviders(
      <UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={USER_MANAGEMENT_SCENARIO_FORBIDDEN} />,
    );

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(USER_MANAGEMENT_SCENARIO_FORBIDDEN.forbiddenLabel)).toBeTruthy();
  });
});

describe('Hành động bị chặn (Đ-8): hiện câu giải thích tại chỗ, không phải nút xám vô cớ', () => {
  it('trạng thái "thành công": roleChangeBlockedReason và removeBlockedReason đều đọc được trong DOM', async () => {
    const model = USER_MANAGEMENT_SCENARIO_SUCCESS;
    const selfRow = requireRow(model, (row) => row.roleChangeBlockedReason !== null, 'một hàng có roleChangeBlockedReason');
    const lastAdminRow = requireRow(model, (row) => row.removeBlockedReason !== null, 'một hàng có removeBlockedReason');

    const UserManagementView = await loadUserManagementView();

    renderWithProviders(<UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={model} />);

    expect(screen.getByText(selfRow.roleChangeBlockedReason as string)).toBeTruthy();
    expect(screen.getByText(lastAdminRow.removeBlockedReason as string)).toBeTruthy();
  });
});

describe('Vai không truyền đạt chỉ bằng màu (Đ-10): mỗi hàng có roleLabel bằng chữ', () => {
  it('trạng thái "thành công": roleLabel của mọi hàng xuất hiện dưới dạng văn bản', async () => {
    const model = USER_MANAGEMENT_SCENARIO_SUCCESS;
    const UserManagementView = await loadUserManagementView();

    renderWithProviders(<UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={model} />);

    for (const row of model.rows) {
      expect(screen.getAllByText(row.roleLabel).length, `hàng "${row.name}"`).toBeGreaterThan(0);
    }
  });
});

describe('Xoá hẳn (A9/Đ-8): nút xác nhận không bật khi email gõ chưa khớp', () => {
  it('typedEmail khác email thật: mọi nút "xoá hẳn" đang bật đều KHÔNG tồn tại', async () => {
    const target = requireRow(USER_MANAGEMENT_SCENARIO_SUCCESS, (row) => !row.isSelf, 'một hàng không phải chính mình');
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      removeConfirm: {
        user: target,
        typedEmail: 'khong-khop@vi-du.vn',
        isMatch: false,
        warningLabel: USER_MANAGEMENT_SCENARIO_SUCCESS.removeConfirm.warningLabel,
        canConfirm: false,
      },
    };

    const UserManagementView = await loadUserManagementView();

    renderWithProviders(<UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={model} />);

    for (const button of screen.queryAllByRole('button', { name: /xoá hẳn|xác nhận xoá/iu })) {
      expect(button, button.textContent ?? '').toBeDisabled();
    }
  });

  it('typedEmail đúng email thật: nút "xoá hẳn" bật', async () => {
    const target = requireRow(USER_MANAGEMENT_SCENARIO_SUCCESS, (row) => !row.isSelf, 'một hàng không phải chính mình');
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      removeConfirm: {
        user: target,
        typedEmail: target.email,
        isMatch: true,
        warningLabel: USER_MANAGEMENT_SCENARIO_SUCCESS.removeConfirm.warningLabel,
        canConfirm: true,
      },
    };

    const UserManagementView = await loadUserManagementView();

    renderWithProviders(<UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={model} />);

    expect(screen.getByRole('button', { name: /xoá hẳn|xác nhận xoá/iu })).toBeEnabled();
  });
});

describe('Lớp trên cùng (A9/A12) — lỗi B-V12b-01, B-V12b-02', () => {
  it('nút "xoá" trên hàng mở hộp hỏi trước cả khi chưa chọn ai (detail: null)', async () => {
    const target = requireRow(USER_MANAGEMENT_SCENARIO_SUCCESS, (row) => !row.isSelf, 'một hàng không phải chính mình');
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      detail: null,
      removeConfirm: { ...USER_MANAGEMENT_SCENARIO_SUCCESS.removeConfirm, user: target, typedEmail: '', isMatch: false, canConfirm: false },
    };

    const UserManagementView = await loadUserManagementView();
    renderWithProviders(<UserManagementView actions={buildActions()} model={model} />);

    expect(await screen.findByRole('dialog', { name: `Xoá hẳn ${target.name}?` })).toBeInTheDocument();
  });

  it('BUG-080: hộp ma trận quyền nói tiêu đề một lần, không lặp làm chú thích', async () => {
    const UserManagementView = await loadUserManagementView();
    const model: UserManagementViewModel = { ...USER_MANAGEMENT_SCENARIO_SUCCESS, detail: null, isPermissionReferenceOpen: true };
    renderWithProviders(<UserManagementView actions={buildActions()} model={model} />);

    const dialog = await screen.findByRole('dialog', { name: 'Ma trận quyền theo vai trò' });
    expect(within(dialog).getAllByText('Ma trận quyền theo vai trò')).toHaveLength(1);
  });

  it.each([false, true])('BUG-082: tìm không thấy ai → cùng EmptyState có nút xoá tìm kiếm (isCollapsed=%s)', async (isCollapsed) => {
    const actions = buildActions();
    const model: UserManagementViewModel = { ...USER_MANAGEMENT_SCENARIO_SUCCESS, detail: null, isCollapsed, rows: [] };
    const UserManagementView = await loadUserManagementView();
    renderWithProviders(<UserManagementView actions={actions} model={model} />);

    expect(await screen.findByRole('heading', { name: 'Không tìm thấy người dùng' })).toBeInTheDocument();
    expect(screen.queryByText('Không có dữ liệu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tìm kiếm' }));
    expect(actions.onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('BUG-075: thẻ ở khổ hẹp không cắt email bằng "…"', async () => {
    const model: UserManagementViewModel = { ...USER_MANAGEMENT_SCENARIO_SUCCESS, detail: null, isCollapsed: true };
    const row = model.rows[0];
    if (row === undefined) throw new Error('kịch bản thành công phải có ít nhất một hàng');
    const UserManagementView = await loadUserManagementView();
    renderWithProviders(<UserManagementView actions={buildActions()} model={model} />);

    const email = await screen.findByText(row.email);
    expect(email).not.toHaveClass('truncate');
  });

  it('BUG-071: panel chi tiết mở thì bảng bỏ cột phụ, gộp trạng thái vào ô người dùng', async () => {
    const row = USER_MANAGEMENT_SCENARIO_SUCCESS.rows[0];
    if (row === undefined) throw new Error('kịch bản thành công phải có ít nhất một hàng');
    const UserManagementView = await loadUserManagementView();
    const closed: UserManagementViewModel = { ...USER_MANAGEMENT_SCENARIO_SUCCESS, detail: null, isCollapsed: false, selectedUserId: null };
    const { unmount } = renderWithProviders(<UserManagementView actions={buildActions()} model={closed} />);
    expect(await screen.findAllByRole('columnheader')).toHaveLength(6);
    unmount();

    renderWithProviders(
      <UserManagementView actions={buildActions()} model={{ ...closed, selectedUserId: row.id }} />,
    );
    const headers = await screen.findAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Người dùng', 'Vai', 'Hành động']);
  });

  it('BUG-076: nút hàng viết hoa chữ đầu (A6), không còn "xoá" viết thường', async () => {
    const UserManagementView = await loadUserManagementView();
    renderWithProviders(<UserManagementView actions={buildActions()} model={USER_MANAGEMENT_SCENARIO_SUCCESS} />);

    expect((await screen.findAllByRole('button', { name: 'Xoá' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'xoá' })).toBeNull();
  });

  it('BUG-077: link "Gửi lại" lời mời có vùng chạm 44 px dưới 640, 24 px từ đó, ở cả bảng lẫn thẻ', async () => {
    const UserManagementView = await loadUserManagementView();
    for (const isCollapsed of [false, true]) {
      const model: UserManagementViewModel = { ...USER_MANAGEMENT_SCENARIO_PARTIAL, detail: null, isCollapsed };
      const { unmount } = renderWithProviders(<UserManagementView actions={buildActions()} model={model} />);
      const links = await screen.findAllByRole('button', { name: 'Gửi lại' });
      for (const link of links) expect(link).toHaveClass('inline-flex', 'min-h-[44px]', 'sm:min-h-6');
      expect(screen.queryByRole('button', { name: 'gửi lại' })).toBeNull();
      unmount();
    }
  });

  it('Esc đóng khối mời khi nó đang mở', async () => {
    const actions = buildActions();
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      detail: null,
      invite: { ...USER_MANAGEMENT_SCENARIO_SUCCESS.invite, isOpen: true },
    };

    const UserManagementView = await loadUserManagementView();
    renderWithProviders(<UserManagementView actions={actions} model={model} />);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(actions.onCloseInvite).toHaveBeenCalledTimes(1);
    expect(actions.onSelectUser).not.toHaveBeenCalled();
  });

  it('Esc đóng tấm chi tiết ở bố cục rộng khi khối mời đóng', async () => {
    const actions = buildActions();
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      isCollapsed: false,
      invite: { ...USER_MANAGEMENT_SCENARIO_SUCCESS.invite, isOpen: false },
    };
    expect(model.detail, 'kịch bản success cần một người đang được chọn').not.toBeNull();

    const UserManagementView = await loadUserManagementView();
    renderWithProviders(<UserManagementView actions={actions} model={model} />);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(actions.onSelectUser).toHaveBeenCalledWith(null);
  });
});

describe('Ô mời (Đ-8/mục 2.5 types.ts): nhận dấu phẩy/xuống dòng, nêu địa chỉ hỏng ngay khi gõ', () => {
  it('gõ vào ô mời: actions.onInviteEmailsChange nhận đúng chuỗi thô, giữ nguyên dấu phẩy và xuống dòng', async () => {
    const actions = buildActions();
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      invite: { ...USER_MANAGEMENT_SCENARIO_SUCCESS.invite, isOpen: true },
    };

    const UserManagementView = await loadUserManagementView();

    renderWithProviders(<UserManagementView actions={actions} model={model} />);

    const textarea = document.querySelector('textarea');

    if (textarea === null) {
      throw new Error('Ô mời phải là Textarea (Đ-5: Combobox không commit được chữ tự do).');
    }

    const raw = 'an@vi-du.vn, khong-hop-le\nchi@vi-du.vn';

    fireEvent.change(textarea, { target: { value: raw } });

    expect(actions.onInviteEmailsChange).toHaveBeenCalledWith(raw);
  });

  it('invalidEmails khác rỗng: địa chỉ hỏng hiện ngay trong DOM khi ô mời đang mở', async () => {
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      invite: {
        ...USER_MANAGEMENT_SCENARIO_SUCCESS.invite,
        isOpen: true,
        rawEmails: 'an@vi-du.vn, khong-hop-le',
        validEmails: ['an@vi-du.vn'],
        invalidEmails: ['khong-hop-le'],
        canSubmit: false,
        errorLabel: 'Chưa đúng dạng địa chỉ thư: khong-hop-le. Viết theo dạng ten@congty.vn',
        submitBlockedReason: 'Sửa địa chỉ chưa đúng dạng rồi mới gửi được',
      },
    };

    const UserManagementView = await loadUserManagementView();

    renderWithProviders(<UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={model} />);

    // `getByText` một mình KHÔNG dùng được ở đây: React dựng `<textarea value>` bằng cách đặt
    // chuỗi làm TEXT CHILD, nên chính ô nhập đã là một khớp của /khong-hop-le/ — và mọi cách
    // hiện địa chỉ hỏng cho người đọc đều tạo khớp thứ hai, tức `getByText` luôn ném "Found
    // multiple elements" trên MỌI bản hiện thực đúng. Nên bài này lọc bỏ ô nhập rồi đòi phần
    // còn lại vẫn có ít nhất một phần tử: điều sản phẩm thật sự cần là địa chỉ hỏng hiện ra ở
    // CHỖ NGƯỜI ĐỌC THẤY, không phải chỉ vọng lại trong ô gõ.
    await waitFor(() => {
      const shown = screen
        .getAllByText(/khong-hop-le/iu)
        .filter((node) => node.tagName !== 'TEXTAREA' && node.tagName !== 'INPUT');

      expect(shown.length, 'địa chỉ hỏng phải hiện ngoài ô nhập').toBeGreaterThan(0);
    });
  });

  it('BUG-083: địa chỉ hỏng nói đúng một lần kèm dạng đúng; chip ẩn khi 0; nút khoá có lý do', async () => {
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      invite: {
        ...USER_MANAGEMENT_SCENARIO_SUCCESS.invite,
        isOpen: true,
        rawEmails: 'khong-hop-le',
        validEmails: [],
        invalidEmails: ['khong-hop-le'],
        canSubmit: false,
        errorLabel: 'Chưa đúng dạng địa chỉ thư: khong-hop-le. Viết theo dạng ten@congty.vn',
        submitBlockedReason: 'Sửa địa chỉ chưa đúng dạng rồi mới gửi được',
      },
    };

    const UserManagementView = await loadUserManagementView();
    renderWithProviders(<UserManagementView actions={USER_MANAGEMENT_ACTIONS} model={model} />);

    const shown = (await screen.findAllByText(/khong-hop-le/iu)).filter((node) => node.tagName !== 'TEXTAREA');
    expect(shown).toHaveLength(1);
    expect(shown[0]).toHaveTextContent('ten@congty.vn');
    expect(screen.queryByText(/hợp lệ$/iu)).toBeNull();
    expect(screen.getByRole('button', { name: 'Gửi lời mời' })).toHaveAccessibleDescription(
      'Sửa địa chỉ chưa đúng dạng rồi mới gửi được',
    );
  });
});

/* QA-01 nợ #8 — avatar ở tấm chi tiết có chữ viết tắt như ở bảng, không trống. */
describe('avatar ở tấm chi tiết', () => {
  it('vẽ chữ viết tắt của người đang chọn', async () => {
    const model = USER_MANAGEMENT_SCENARIO_SUCCESS;
    const detail = model.detail;
    if (detail === null) throw new Error('kịch bản success cần một người đang được chọn');

    const UserManagementView = await loadUserManagementView();
    renderWithProviders(<UserManagementView actions={buildActions()} model={model} />);

    const header = screen.getByRole('heading', { name: detail.user.name }).closest('header');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByLabelText(detail.user.name).textContent).not.toBe('');
  });
});

