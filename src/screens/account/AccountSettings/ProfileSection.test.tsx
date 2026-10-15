/**
 * Bộ kiểm khối "hồ sơ" — của T4, và chỉ của T4.
 *
 * Mục D: view dựng thẳng từ props, không provider, không cổng dữ liệu, không
 * đồng hồ. Mỗi bài dưới đây bắt đầu bằng một đối tượng props và kết thúc bằng
 * một câu hỏi về thứ nhìn thấy trên màn.
 *
 * `expectSevenStates` cho cả bảy trạng thái là việc của lượt cuối; ở đây soát
 * đúng hai trạng thái thuộc khối này — **1 rỗng** và **nửa của 3 một phần**.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initialsOf } from '@/lib/format/initials';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';

import { ProfileSection, type ProfileSectionProps } from './ProfileSection';
import { DENSITY_ROW_CLASS, LANGUAGE_OPTIONS } from './useAccountPreferences';

afterEach(() => {
  cleanup();
});

/** Một địa chỉ thư mẫu. `expectVietnamese` bỏ qua nó — xem chú thích ở bài dùng. */
const SAMPLE_EMAIL = 'thu.ha@congty.vn';

function props(overrides: Partial<ProfileSectionProps> = {}): ProfileSectionProps {
  return {
    avatarUrl: null,
    avatarInitials: 'NH',
    avatarAlt: 'Ảnh đại diện của Nguyễn Thu Hà',
    isAvatarUploading: false,
    isAvatarLocked: false,
    avatarStatusLabel: 'Đang tải ảnh lên…',
    onAvatarFileSelected: vi.fn(),
    avatarProblem: null,
    avatarReplace: {
      isOpen: false,
      previewUrl: '',
      hasExistingAvatar: false,
      isSending: false,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    },
    problems: {},
    fullName: 'Nguyễn Thu Hà',
    onFullNameChange: vi.fn(),
    jobTitle: '',
    onJobTitleChange: vi.fn(),
    jobTitlePlaceholder: 'chưa đặt',
    phonePlaceholder: 'chưa đặt',
    email: SAMPLE_EMAIL,
    emailReadOnlyReason: 'Thư điện tử là tên đăng nhập nên chỉ đọc ở đây.',
    onChangeEmail: vi.fn(),
    phone: '',
    onPhoneChange: vi.fn(),
    language: 'vi',
    languageOptions: LANGUAGE_OPTIONS,
    onLanguageChange: vi.fn(),
    flashedField: null,
    rowClassName: DENSITY_ROW_CLASS.comfortable,
    motionOff: false,
    isStacked: false,
    ...overrides,
  };
}

/** Hàng của một nhãn, tức cái `<div>` mà `FieldRow` vẽ. */
function rowOf(label: string): HTMLElement {
  const cell = screen.getByText(label);
  const row = cell.closest('div.flex.items-start');

  if (row === null) {
    throw new Error(`không tìm thấy hàng của nhãn "${label}"`);
  }

  return row as HTMLElement;
}

describe('trạng thái 1 — rỗng', () => {
  it('chưa có ảnh thì vẽ chữ cái đầu, không vẽ thẻ ảnh nào', () => {
    const { container } = render(<ProfileSection {...props()} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('NH')).toBeTruthy();
  });

  it('chữ cái đầu ngồi trên --bg-sunken, và đó là nền sẵn có của Avatar', () => {
    const { container } = render(<ProfileSection {...props()} />);
    const sunken = container.querySelector('.bg-bg-sunken');

    expect(sunken).not.toBeNull();
    expect(sunken?.textContent).toBe('NH');
  });

  it('BUG-138: điện thoại trống cũng mang chữ mờ như chức danh', () => {
    render(<ProfileSection {...props()} />);

    expect(screen.getByLabelText('Điện thoại').getAttribute('placeholder')).toBe('chưa đặt');
  });

  it('chưa có chức danh thì hàng vẫn còn, mang chữ mờ "chưa đặt"', () => {
    render(<ProfileSection {...props()} />);

    const jobTitle = screen.getByLabelText('Chức danh');

    expect(jobTitle.getAttribute('placeholder')).toBe('chưa đặt');
    expect((jobTitle as HTMLInputElement).value).toBe('');
    // Hàng biến mất là một ô người dùng không tìm thấy nữa, nên nó không biến mất.
    expect(screen.getByText('Chức danh')).toBeTruthy();
  });

  it('chưa có tên lẫn ảnh thì lấy hai chữ đầu của phần trước dấu a còng, viết hoa', () => {
    expect(initialsOf('', 'thu.ha@congty.vn')).toBe('TH');
    expect(initialsOf('Nguyễn Thu Hà', '')).toBe('NH');
    expect(initialsOf('Hà', '')).toBe('HÀ');
    expect(initialsOf('', '')).toBe('');
  });
});

describe('BUG-497, BUG-502 — khổ hẹp: nhãn trên ô, thư dài không đẩy nút ra ngoài thẻ', () => {
  it('isStacked thì mọi hàng xếp dọc, ô rộng hết thẻ', () => {
    render(<ProfileSection {...props({ isStacked: true })} />);

    for (const label of ['Họ tên', 'Chức danh', 'Thư điện tử', 'Điện thoại']) {
      expect(rowOf(label)).toHaveClass('flex-col');
    }
  });

  it('ô thư điện tử co được (min-w-0 flex-1) để nút "Đổi thư điện tử" ở lại trong hàng', () => {
    render(<ProfileSection {...props({ email: `${'a'.repeat(120)}@congty.vn` })} />);

    const button = screen.getByRole('button', { name: 'Đổi thư điện tử' });
    const wrapper = button.previousElementSibling;

    expect(wrapper).toHaveClass('min-w-0', 'flex-1');
  });
});

describe('trạng thái 3 — một phần: ảnh đang tải lên', () => {
  it('nói ra bằng role="status" và khoá ô chọn tệp', () => {
    const { container } = render(<ProfileSection {...props({ isAvatarUploading: true })} />);

    expect(screen.getByRole('status').textContent).toBe('Đang tải ảnh lên…');
    expect(container.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(true);
  });

  it('lúc bình thường thì không có dòng trạng thái nào', () => {
    render(<ProfileSection {...props()} />);

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('ảnh đại diện: 56, bo tròn, lớp phủ "Đổi ảnh"', () => {
  it('kích thước đi qua className vì AvatarProps.size không có nấc 56', () => {
    const { container } = render(<ProfileSection {...props()} />);
    const avatar = container.querySelector('.rounded-full');

    expect(avatar).not.toBeNull();
    // 14 × 4px = 56. `cn` là twMerge nên `h-14 w-14` ĐÈ `w-16 h-16` của size="profile".
    const root = container.querySelector('.h-14.w-14');
    expect(root).not.toBeNull();
    expect(root?.className).not.toContain('w-16');
  });

  it('lớp phủ là <label> gắn với ô chọn tệp, nên bàn phím chỉ gặp một điều khiển', () => {
    const { container } = render(<ProfileSection {...props()} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input).not.toBeNull();
    expect(screen.getByText('Đổi ảnh').getAttribute('for')).toBe(input?.id);
    expect(screen.getByLabelText('Đổi ảnh')).toBe(input);
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });

  it('chọn một tệp thì gọi lên hook, và hook mới là chỗ đọc tệp', () => {
    const onAvatarFileSelected = vi.fn();
    const { container } = render(<ProfileSection {...props({ onAvatarFileSelected })} />);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['x'], 'anh.png', { type: 'image/png' });

    if (input === null) {
      throw new Error('không có ô chọn tệp');
    }

    fireEvent.change(input, { target: { files: [file] } });

    expect(onAvatarFileSelected).toHaveBeenCalledWith(file);
  });

  it.each(['Huỷ', 'Esc'] as const)('[33P-E-010] chọn ảnh (ô khoá lúc đọc tệp, mất focus) rồi %s thì focus về ô "Đổi ảnh"', async (way) => {
    const open: Partial<ProfileSectionProps> = {
      avatarReplace: { ...props().avatarReplace, isOpen: true, previewUrl: 'data:image/png;base64,AA' },
    };
    // Như AccountSettings.tsx: liên kết "Về bảng điều khiển" đứng trước khối, là phần tử focus được đầu tiên của trang.
    const page = (p: Partial<ProfileSectionProps>) => (
      <>
        <a href="/">Về bảng điều khiển</a>
        <ProfileSection {...props(p)} />
      </>
    );
    const view = render(page({}));
    const input = screen.getByLabelText('Đổi ảnh');

    input.focus();
    // Hook đọc tệp: ô bị khoá, trình duyệt bỏ focus của ô bị khoá về <body> (jsdom không tự làm).
    (input as HTMLInputElement).blur(); // jsdom bỏ qua blur() của ô đã khoá, nên bỏ focus trước khi khoá
    view.rerender(page({ isAvatarUploading: true }));
    // Đọc xong: ô mở lại và hộp thoại mở cùng lượt.
    view.rerender(page(open));
    await waitFor(() => {
      expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();
    });

    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true'); // [33P-E-009]
    if (way === 'Huỷ') {
      fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    } else {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); // [33P-A-037]
    }
    view.rerender(page({}));

    expect(document.activeElement).toBe(input);
  });
});

describe('thư điện tử chỉ đọc', () => {
  it('không dựng ô nhập sửa được, và câu lý do đọc được ngay dưới ô', () => {
    render(<ProfileSection {...props()} />);

    // `Input isReadOnly` vẽ một đoạn văn chứ không phải `<input>`, nên không có
    // ô nào để gõ vào. `readOnlyReason` của `FieldRow` KHÔNG được truyền: thân
    // `FieldRow` không rút nó khỏi props nên nó rơi lên `<div>` thành một thuộc
    // tính DOM không có thật, và React kêu về chuyện đó.
    expect(screen.queryByLabelText('Thư điện tử')).toBeNull();
    expect(screen.getByText(SAMPLE_EMAIL)).toBeTruthy();
    expect(screen.getByText('Thư điện tử là tên đăng nhập nên chỉ đọc ở đây.')).toBeTruthy();
  });

  it('liên kết "Đổi thư điện tử" gọi lên hook', () => {
    const onChangeEmail = vi.fn();
    render(<ProfileSection {...props({ onChangeEmail })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Đổi thư điện tử' }));

    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });
});

describe('bốn ô sửa được báo lên hook', () => {
  it('gõ vào họ tên, chức danh và điện thoại thì gọi đúng hàm', () => {
    const onFullNameChange = vi.fn();
    const onJobTitleChange = vi.fn();
    const onPhoneChange = vi.fn();

    render(<ProfileSection {...props({ onFullNameChange, onJobTitleChange, onPhoneChange })} />);

    fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Trần Minh' } });
    fireEvent.change(screen.getByLabelText('Chức danh'), { target: { value: 'Kỹ sư' } });
    fireEvent.change(screen.getByLabelText('Điện thoại'), { target: { value: '0900' } });

    expect(onFullNameChange).toHaveBeenCalledWith('Trần Minh');
    expect(onJobTitleChange).toHaveBeenCalledWith('Kỹ sư');
    expect(onPhoneChange).toHaveBeenCalledWith('0900');
  });

  it('ô ngôn ngữ có nhãn cho trình đọc màn hình, dù combobox không lấy tên từ nội dung', () => {
    render(<ProfileSection {...props()} />);

    const trigger = screen.getByRole('combobox', { name: 'Ngôn ngữ' });

    expect(trigger.textContent).toContain('Tiếng Việt');
    // Đúng MỘT nhãn nhìn thấy được: cột trái của FieldRow. Cái còn lại là sr-only.
    expect(screen.getAllByText('Ngôn ngữ')).toHaveLength(2);
  });
});

describe('nháy nền sau khi ghi — R6, prop flash có sẵn', () => {
  it('hàng đang nháy mang bg-accent-wash, một token, không phải mã màu thô', () => {
    render(<ProfileSection {...props({ flashedField: 'fullName' })} />);

    expect(rowOf('Họ tên').className).toContain('bg-accent-wash');
    expect(rowOf('Điện thoại').className).not.toContain('bg-accent-wash');
  });
});

describe('giảm chuyển động', () => {
  it('tắt thì không hàng nào nháy, và mọi hàng về duration-0', () => {
    render(<ProfileSection {...props({ flashedField: 'fullName', motionOff: true })} />);

    const row = rowOf('Họ tên');

    expect(row.className).not.toContain('bg-accent-wash');
    expect(row.className).toContain('duration-0');
    expect(row.className).not.toContain('duration-340');
    expect(row.className).not.toContain('duration-260');
  });

  it('bật thì hàng hoà tan màu ở nấc standard — 260 ms, thay cho 240 ms của đặc tả (R1)', () => {
    render(<ProfileSection {...props()} />);

    // Đúng MỘT lớp thời lượng trên hàng: `duration-260` đè hẳn `duration-340`
    // của `FieldRow`, không xếp cạnh nó rồi để thứ tự CSS phân xử.
    expect(rowOf('Họ tên').className).toContain('duration-260');
    expect(rowOf('Họ tên').className).not.toContain('duration-340');
  });

  it('lớp phủ ảnh cũng tắt hoạt cảnh mờ dần', () => {
    render(<ProfileSection {...props({ motionOff: true })} />);

    expect(screen.getByText('Đổi ảnh').className).toContain('duration-0');
  });
});

describe('mật độ hiển thị đổi chiều cao dòng', () => {
  it('lớp hook truyền xuống thắng min-h-9 mà FieldRow khai sẵn', () => {
    render(<ProfileSection {...props({ rowClassName: DENSITY_ROW_CLASS.comfortable })} />);
    expect(rowOf('Họ tên').className).toContain('min-h-10');

    cleanup();

    render(<ProfileSection {...props({ rowClassName: DENSITY_ROW_CLASS.compact })} />);
    expect(rowOf('Họ tên').className).toContain('min-h-9');
  });
});

describe('màu, chữ và khả năng tiếp cận', () => {
  it('không có mã màu thô trong hai file của khối', () => {
    expect(() => {
      expectNoRawColor('src/screens/account/AccountSettings/ProfileSection.tsx');
      expectNoRawColor('src/screens/account/AccountSettings/useAccountPreferences.ts');
    }).not.toThrow();
  });

  it('mọi chuỗi là tiếng Việt có dấu', () => {
    const { container } = render(<ProfileSection {...props()} />);

    // Địa chỉ thư là văn bản của máy, không phải câu người ta viết: nó không có
    // dấu và không bao giờ có. Bỏ qua đúng nó, không nới cả bài kiểm.
    expectVietnamese(container, { ignore: [SAMPLE_EMAIL] });
  });

  it('cây render tiếp cận được, ở cả hai trạng thái của khối', () => {
    const { container, unmount } = render(<ProfileSection {...props()} />);
    expectAccessible(container);
    unmount();

    const second = render(<ProfileSection {...props({ isAvatarUploading: true })} />);
    expectAccessible(second.container);
  });
});
