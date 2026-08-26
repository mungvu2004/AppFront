/**
 * Khối "hồ sơ" của màn `/tai-khoan`: ảnh đại diện, họ tên, chức danh, thư điện
 * tử chỉ đọc, điện thoại, ngôn ngữ.
 *
 * View thuần (mục D, R-60): dựng được chỉ từ props — không store, không mạng,
 * không một bộ đếm giờ nào của riêng nó. Việc đọc `FileReader` và việc hẹn giờ
 * nháy nền đều nằm ở `useAccountPreferences`.
 *
 * ## Hai trạng thái màn hình của khối này
 *
 * - **1 rỗng** — chưa có ảnh thì `Avatar` vẽ chữ cái đầu trên `--bg-sunken`
 *   (đó là nền mặc định của chính nó, không phải một lớp thêm vào); chưa có chức
 *   danh thì hàng chức danh mang chữ mờ "chưa đặt" chứ không biến mất, vì một
 *   hàng biến mất là một ô người dùng không tìm thấy nữa.
 * - **3 một phần** — đang tải ảnh lên: ô chọn tệp khoá lại và một dòng
 *   `role="status"` nói ra điều đó. Nửa còn lại của trạng thái 3 là của T3.
 *
 * ## Vì sao "Đổi ảnh" là `<label>` chứ không phải `<button>`
 *
 * A12 nói bàn phím là đường đi hạng nhất. Một `<button>` gọi `.click()` lên một
 * `<input type="file">` ẩn thì trình đọc màn hình gặp hai điều khiển cho một
 * việc. Một `<label htmlFor>` gắn với ô chọn tệp thì chỉ có MỘT điều khiển: nó
 * nhận tiêu điểm, Enter mở hộp thoại chọn tệp, và tên của nó chính là dòng chữ
 * người ta nhìn thấy. Viền tiêu điểm vẽ trên lớp phủ bằng biến thể `peer-*`, vì
 * ô nhập thật nằm dưới `sr-only`.
 *
 * ## `readOnlyReason` cố ý không truyền
 *
 * `FieldRowProps` khai `readOnlyReason`, nhưng thân `FieldRow` không rút nó ra
 * khỏi props — nó rơi vào `...props` rồi được rải thẳng lên `<div>`, và React
 * cảnh báo về một thuộc tính DOM không có thật. Nên lý do chỉ đọc của thư điện
 * tử là một câu người ta ĐỌC ĐƯỢC ngay dưới ô, thay vì một tooltip không ai thấy.
 * Đây là lỗi của `FieldRow`, và `src/components/**` là thư mục màn này không sửa.
 */

import { useId } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

/**
 * Ảnh đại diện 56, bo tròn.
 *
 * `AvatarProps.size` chỉ có hai nấc và **không nấc nào là 56**: `'default'` là
 * `w-7 h-7` (28) còn `'profile'` là `w-16 h-16` (64). Nên kích thước đi qua
 * `className`, và nó thắng được vì `cn` là `twMerge` chứ không phải `clsx` trần
 * — `h-14 w-14` đè `w-16 h-16` thay vì xếp cạnh nó rồi thua theo thứ tự CSS.
 */
export const AVATAR_SIZE_PX = 56;

/** Lớp Tailwind của {@link AVATAR_SIZE_PX}, viết tĩnh cho bộ quét của Tailwind. */
export const AVATAR_SIZE_CLASS = 'h-14 w-14';

/** Khoá của một hàng, để hook nói được hàng nào vừa ghi xong và đang nháy. */
export type ProfileFieldKey = 'fullName' | 'jobTitle' | 'language' | 'phone';

export interface ProfileSectionProps {
  /** Ảnh đại diện; `null` là trạng thái 1 — `Avatar` tự vẽ chữ cái đầu. */
  readonly avatarUrl: string | null;
  readonly avatarInitials: string;
  /** Câu tả ảnh, luôn tiếng Việt — `Avatar` mặc định về chuỗi "Avatar" nếu thiếu. */
  readonly avatarAlt: string;
  /** Trạng thái 3: đang đọc tệp ảnh. */
  readonly isAvatarUploading: boolean;
  /** Câu đã dựng sẵn ở hook cho lượt tải ảnh (A15: view không dựng chuỗi). */
  readonly avatarStatusLabel: string;
  readonly onAvatarFileSelected: (file: File) => void;

  readonly fullName: string;
  readonly onFullNameChange: (value: string) => void;

  readonly jobTitle: string;
  readonly onJobTitleChange: (value: string) => void;
  /** Chữ mờ khi chưa có chức danh — trạng thái 1. */
  readonly jobTitlePlaceholder: string;

  readonly email: string;
  readonly emailReadOnlyReason: string;
  readonly onChangeEmail: () => void;

  readonly phone: string;
  readonly onPhoneChange: (value: string) => void;

  readonly language: string;
  readonly languageOptions: readonly SelectOption[];
  readonly onLanguageChange: (value: string) => void;

  /** Hàng vừa ghi xong; `null` khi không hàng nào đang nháy. */
  readonly flashedField: ProfileFieldKey | null;
  /** Lớp chiều cao dòng, giải ra từ mật độ hiển thị của khối "giao diện". */
  readonly rowClassName: string;
  /** Giảm chuyển động đang có hiệu lực. */
  readonly motionOff: boolean;
}

export function ProfileSection(props: ProfileSectionProps) {
  const { motionOff, rowClassName } = props;
  const avatarInputId = useId();

  // `duration-260`, không phải `duration-standard`: hai tên cùng giá trị, nhưng
  // `tailwind-merge` chỉ đè được nhóm `duration` khi tên là một con số. Xem chú
  // thích dài hơn ở `AppearanceSection.tsx`.
  const rowClass = cn(rowClassName, motionOff ? 'duration-0' : 'duration-260');
  const flashOf = (key: ProfileFieldKey): boolean => !motionOff && props.flashedField === key;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="group relative shrink-0">
          <Avatar
            size="profile"
            className={AVATAR_SIZE_CLASS}
            alt={props.avatarAlt}
            initials={props.avatarInitials}
            {...(props.avatarUrl === null ? {} : { src: props.avatarUrl })}
          />
          <input
            id={avatarInputId}
            type="file"
            accept="image/*"
            disabled={props.isAvatarUploading}
            className="peer sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file !== undefined) {
                props.onAvatarFileSelected(file);
              }
            }}
          />
          <label
            htmlFor={avatarInputId}
            className={cn(
              'absolute inset-0 flex cursor-pointer items-center justify-center rounded-full',
              'bg-bg-overlay text-[12px] font-medium text-white',
              'opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
              'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-surface',
              'transition-opacity',
              motionOff ? 'duration-0' : 'duration-fast',
            )}
          >
            Đổi ảnh
          </label>
        </div>

        {props.isAvatarUploading ? (
          <p role="status" className="text-[13px] text-text-secondary">
            {props.avatarStatusLabel}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col">
        <FieldRow label="họ tên" className={rowClass} flash={flashOf('fullName')}>
          <Input
            aria-label="họ tên"
            value={props.fullName}
            onChange={(event) => props.onFullNameChange(event.target.value)}
            flash={flashOf('fullName')}
          />
        </FieldRow>

        <FieldRow label="chức danh" className={rowClass} flash={flashOf('jobTitle')}>
          <Input
            aria-label="chức danh"
            value={props.jobTitle}
            placeholder={props.jobTitlePlaceholder}
            onChange={(event) => props.onJobTitleChange(event.target.value)}
            flash={flashOf('jobTitle')}
          />
        </FieldRow>

        <FieldRow label="thư điện tử" className={rowClass}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input aria-label="thư điện tử" value={props.email} isReadOnly readOnly />
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-accent"
                onClick={props.onChangeEmail}
              >
                Đổi thư điện tử
              </Button>
            </div>
            <p className="text-[13px] leading-[18px] text-text-muted">
              {props.emailReadOnlyReason}
            </p>
          </div>
        </FieldRow>

        <FieldRow label="điện thoại" className={rowClass} flash={flashOf('phone')}>
          <Input
            aria-label="điện thoại"
            type="tel"
            inputMode="tel"
            value={props.phone}
            onChange={(event) => props.onPhoneChange(event.target.value)}
            flash={flashOf('phone')}
          />
        </FieldRow>

        {/*
          Dạng ghép chứ không phải dạng gọn, và lý do là khả năng tiếp cận.

          Ô kích hoạt của `Select` mang `role="combobox"`, mà `combobox` KHÔNG
          phải một vai lấy tên từ nội dung — nên chữ "Tiếng Việt" bên trong nó
          không đặt tên cho nó, và `expectAccessible` báo thiếu nhãn. Dạng gọn
          chỉ dựng `Select.Label` khi có prop `label`, và prop ấy vẽ một nhãn
          NHÌN THẤY ĐƯỢC — thành hai lần "ngôn ngữ" trên cùng một hàng, vì cột
          trái của `FieldRow` đã viết nó rồi. Dạng ghép cho phép giữ đúng một
          nhãn nhìn thấy và một `<label htmlFor>` cho trình đọc màn hình.
        */}
        <FieldRow label="ngôn ngữ" className={rowClass} flash={flashOf('language')} isLast>
          <Select.Root
            value={props.language}
            onChange={props.onLanguageChange}
            options={[...props.languageOptions]}
          >
            <Select.Label className="sr-only">ngôn ngữ</Select.Label>
            <Select.Trigger options={[...props.languageOptions]} />
            <Select.Content>
              {props.languageOptions.map((option, index) => (
                <Select.Item key={option.value} value={option.value} index={index}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </FieldRow>
      </div>
    </div>
  );
}
