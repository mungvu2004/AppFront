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

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';

import { ProfileSection, type ProfileSectionProps } from './ProfileSection';
import { DENSITY_ROW_CLASS, LANGUAGE_OPTIONS, initialsOf } from './useAccountPreferences';

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
    avatarStatusLabel: 'Đang tải ảnh lên…',
    onAvatarFileSelected: vi.fn(),
    fullName: 'Nguyễn Thu Hà',
    onFullNameChange: vi.fn(),
    jobTitle: '',
    onJobTitleChange: vi.fn(),
    jobTitlePlaceholder: 'chưa đặt',
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

  it('chưa có chức danh thì hàng vẫn còn, mang chữ mờ "chưa đặt"', () => {
    render(<ProfileSection {...props()} />);

    const jobTitle = screen.getByLabelText('chức danh');

    expect(jobTitle.getAttribute('placeholder')).toBe('chưa đặt');
    expect((jobTitle as HTMLInputElement).value).toBe('');
    // Hàng biến mất là một ô người dùng không tìm thấy nữa, nên nó không biến mất.
    expect(screen.getByText('chức danh')).toBeTruthy();
  });

  it('chưa có tên lẫn ảnh thì lấy chữ đầu của phần trước dấu a còng', () => {
    expect(initialsOf('', 'thu.ha@congty.vn')).toBe('t');
    expect(initialsOf('Nguyễn Thu Hà', '')).toBe('NH');
    expect(initialsOf('Hà', '')).toBe('H');
    expect(initialsOf('', '')).toBe('');
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
});

describe('thư điện tử chỉ đọc', () => {
  it('không dựng ô nhập sửa được, và câu lý do đọc được ngay dưới ô', () => {
    render(<ProfileSection {...props()} />);

    // `Input isReadOnly` vẽ một đoạn văn chứ không phải `<input>`, nên không có
    // ô nào để gõ vào. `readOnlyReason` của `FieldRow` KHÔNG được truyền: thân
    // `FieldRow` không rút nó khỏi props nên nó rơi lên `<div>` thành một thuộc
    // tính DOM không có thật, và React kêu về chuyện đó.
    expect(screen.queryByLabelText('thư điện tử')).toBeNull();
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

    render(
      <ProfileSection {...props({ onFullNameChange, onJobTitleChange, onPhoneChange })} />,
    );

    fireEvent.change(screen.getByLabelText('họ tên'), { target: { value: 'Trần Minh' } });
    fireEvent.change(screen.getByLabelText('chức danh'), { target: { value: 'Kỹ sư' } });
    fireEvent.change(screen.getByLabelText('điện thoại'), { target: { value: '0900' } });

    expect(onFullNameChange).toHaveBeenCalledWith('Trần Minh');
    expect(onJobTitleChange).toHaveBeenCalledWith('Kỹ sư');
    expect(onPhoneChange).toHaveBeenCalledWith('0900');
  });

  it('ô ngôn ngữ có nhãn cho trình đọc màn hình, dù combobox không lấy tên từ nội dung', () => {
    render(<ProfileSection {...props()} />);

    const trigger = screen.getByRole('combobox', { name: 'ngôn ngữ' });

    expect(trigger.textContent).toContain('Tiếng Việt');
    // Đúng MỘT nhãn nhìn thấy được: cột trái của FieldRow. Cái còn lại là sr-only.
    expect(screen.getAllByText('ngôn ngữ')).toHaveLength(2);
  });
});

describe('nháy nền sau khi ghi — R6, prop flash có sẵn', () => {
  it('hàng đang nháy mang bg-accent-wash, một token, không phải mã màu thô', () => {
    render(<ProfileSection {...props({ flashedField: 'fullName' })} />);

    expect(rowOf('họ tên').className).toContain('bg-accent-wash');
    expect(rowOf('điện thoại').className).not.toContain('bg-accent-wash');
  });
});

describe('giảm chuyển động', () => {
  it('tắt thì không hàng nào nháy, và mọi hàng về duration-0', () => {
    render(<ProfileSection {...props({ flashedField: 'fullName', motionOff: true })} />);

    const row = rowOf('họ tên');

    expect(row.className).not.toContain('bg-accent-wash');
    expect(row.className).toContain('duration-0');
    expect(row.className).not.toContain('duration-340');
    expect(row.className).not.toContain('duration-260');
  });

  it('bật thì hàng hoà tan màu ở nấc standard — 260 ms, thay cho 240 ms của đặc tả (R1)', () => {
    render(<ProfileSection {...props()} />);

    // Đúng MỘT lớp thời lượng trên hàng: `duration-260` đè hẳn `duration-340`
    // của `FieldRow`, không xếp cạnh nó rồi để thứ tự CSS phân xử.
    expect(rowOf('họ tên').className).toContain('duration-260');
    expect(rowOf('họ tên').className).not.toContain('duration-340');
  });

  it('lớp phủ ảnh cũng tắt hoạt cảnh mờ dần', () => {
    render(<ProfileSection {...props({ motionOff: true })} />);

    expect(screen.getByText('Đổi ảnh').className).toContain('duration-0');
  });
});

describe('mật độ hiển thị đổi chiều cao dòng', () => {
  it('lớp hook truyền xuống thắng min-h-[36px] mà FieldRow khai sẵn', () => {
    render(<ProfileSection {...props({ rowClassName: DENSITY_ROW_CLASS.comfortable })} />);
    expect(rowOf('họ tên').className).toContain('min-h-[40px]');

    cleanup();

    render(<ProfileSection {...props({ rowClassName: DENSITY_ROW_CLASS.compact })} />);
    expect(rowOf('họ tên').className).toContain('min-h-[36px]');
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
