/**
 * Khối "giao diện" của màn `/tai-khoan`: chủ đề, nền khung nhìn 3D, giảm chuyển
 * động, lưới 100 mm, và mật độ hiển thị.
 *
 * View thuần (mục D, R-60): mọi giá trị và mọi quyết định đã xong ở
 * `useAccountPreferences`. File này không chạm store, không chạm mạng, không giữ
 * một bộ đếm giờ nào của riêng nó — dựng được chỉ từ props, và test dựng thẳng nó.
 *
 * ## Chủ đề tối là một BỘ TOKEN, không phải một bộ lọc
 *
 * [CẤM TUYỆT ĐỐI] cấm làm tối màu bằng `filter`. Cơ chế thật nằm ở khối `.dark`
 * trong `src/styles/globals.css`: 36 custom property khai lại, và mọi mục màu
 * trong `tailwind.config.ts` vốn đã là `var(--token)`. `useTheme` gắn lớp `dark`
 * lên `<html>`; không một lớp `dark:` nào xuất hiện trong file này, vì hệ này
 * đổi chủ đề bằng thuộc tính tuỳ biến chứ không bằng biến thể của Tailwind.
 *
 * ## Ba chỗ chuyển động, và cả ba tắt được
 *
 * 1. **Hoà tan màu khi đổi chủ đề** — đặc tả ghi 240 ms; 240 KHÔNG nằm trên
 *    thang của mục B, nên theo R1 nó là `duration-standard` (260 ms).
 * 2. **Nháy nền hàng sau khi lưu** — đặc tả ghi 400 ms và màu `#EEF4EF`. Theo R6
 *    đây là prop `flash` có sẵn của `FieldRow` (nó tô `bg-accent-wash`, một
 *    token), và theo R1 thời lượng là `duration-340` mà chính `FieldRow` đã khai.
 * 3. **Con trượt của `SegmentedControl`** — `layoutId` của framer-motion. Đây là
 *    lý do file này dựng dạng ghép `Root`/`Item` thay vì gọi dạng gọn: khi tắt
 *    chuyển động, `layoutId` không được truyền, nên không có `motion.div` nào để
 *    trượt, và ô đang chọn được tô nền tĩnh thay thế.
 *
 * `SegmentedField` bên dưới **không phải component dùng chung mới** — nó không
 * xuất ra khỏi file, đúng cách `AccountSettings.tsx` giữ `AccountBlock` ở trong
 * nhà nó (R-68).
 */

import { useId, useRef } from 'react';

import { FieldRow } from '@/components/ui/FieldRow';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';

/**
 * Ba lựa chọn chủ đề. `ThemeMode` của store chỉ có `'light' | 'dark'`, nên
 * `'system'` là lựa chọn của MÀN, giải ra bằng `matchMedia` ở hook rồi mới hạ
 * xuống store (R5). Định danh tiếng Anh, nhãn tiếng Việt — mục B và E.11.
 */
export type ThemeChoice = 'dark' | 'light' | 'system';

/** Hai mức mật độ. Chúng đổi CHIỀU CAO DÒNG, không đổi thời lượng nào. */
export type DensityChoice = 'comfortable' | 'compact';

/**
 * Nhãn viết thường, kiểu câu — A6. Đặc tả viết hoa; A6 là bất biến, nên A6 thắng.
 *
 * Hai bảng này KHÔNG xuất ra: chúng là từ vựng của khối chứ không phải mối nối,
 * và một hằng có kiểu khai tường minh mà xuất ra khỏi file component thì
 * `react-refresh/only-export-components` từ chối — mà `pnpm lint` chạy với
 * `--max-warnings 0`. Chiều cao dòng theo mật độ nằm ở `useAccountPreferences.ts`
 * cùng với mọi quyết định khác, và xuống đây bằng prop `rowClassName`.
 */
const THEME_OPTIONS: readonly SegmentedControlOption<ThemeChoice>[] = [
  { label: 'sáng', value: 'light' },
  { label: 'tối', value: 'dark' },
  { label: 'theo hệ thống', value: 'system' },
];

/** Hai mức mật độ, cùng quy ước nhãn. */
const DENSITY_OPTIONS: readonly SegmentedControlOption<DensityChoice>[] = [
  { label: 'thoải mái', value: 'comfortable' },
  { label: 'gọn', value: 'compact' },
];

/** Khoá của một hàng, để hook nói được hàng nào vừa ghi xong và đang nháy. */
export type AppearanceFieldKey =
  | 'density'
  | 'reducedMotion'
  | 'showGrid'
  | 'theme'
  | 'viewportDark';

export interface AppearanceSectionProps {
  readonly theme: ThemeChoice;
  readonly onThemeChange: (theme: ThemeChoice) => void;
  readonly viewportDark: boolean;
  readonly onViewportDarkChange: (enabled: boolean) => void;
  readonly reducedMotion: boolean;
  readonly onReducedMotionChange: (enabled: boolean) => void;
  readonly showGrid: boolean;
  readonly onShowGridChange: (enabled: boolean) => void;
  readonly density: DensityChoice;
  readonly onDensityChange: (density: DensityChoice) => void;
  /** Hàng vừa ghi xong; `null` khi không hàng nào đang nháy. */
  readonly flashedField: AppearanceFieldKey | null;
  /** Lớp chiều cao dòng, giải ra từ `DENSITY_ROW_CLASS` ở `useAccountPreferences.ts`. */
  readonly rowClassName: string;
  /**
   * Giảm chuyển động ĐANG có hiệu lực — hoặc người dùng bật, hoặc hệ điều hành
   * yêu cầu. Khác `reducedMotion` ở trên: cái kia là vị trí của công tắc, cái
   * này là kết quả.
   */
  readonly motionOff: boolean;
}

interface SegmentedFieldProps<T extends string> {
  readonly ariaLabel: string;
  readonly options: readonly SegmentedControlOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly motionOff: boolean;
}

/**
 * `SegmentedControl` dạng ghép, để con trượt tắt được.
 *
 * Dạng gọn của component luôn truyền `layoutId`, nên con trượt luôn trượt. Dạng
 * ghép cho phép bỏ `layoutId` đi — và `SegmentedControl.Item` chỉ dựng
 * `motion.div` KHI có `layoutId`, nên bỏ nó là bỏ hẳn hoạt cảnh chứ không phải
 * rút ngắn nó. Phần điều hướng bằng phím mũi tên chép đúng dạng gọn, vì A12 nói
 * bàn phím là đường đi hạng nhất chứ không phải phương án dự phòng.
 */
function SegmentedField<T extends string>(props: SegmentedFieldProps<T>) {
  const layoutId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const move = (step: number): void => {
    const at = props.options.findIndex((option) => option.value === props.value);
    const next = (at + step + props.options.length) % props.options.length;
    const option = props.options[next];

    if (option === undefined || option.disabled === true) {
      return;
    }

    props.onChange(option.value);
    containerRef.current?.querySelectorAll('button')[next]?.focus();
  };

  return (
    <SegmentedControl.Root
      ref={containerRef}
      aria-label={props.ariaLabel}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          move(1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {props.options.map((option) => {
        const isActive = option.value === props.value;

        return (
          <SegmentedControl.Item
            key={option.value}
            value={option.value}
            isActive={isActive}
            {...(props.motionOff ? {} : { layoutId: `account-segment-${layoutId}` })}
            onClick={() => props.onChange(option.value)}
            className={cn(
              // `duration-0` không phải một nấc trên thang của mục B: nó là
              // "không có chuyển động", đúng thứ `no-raw-duration` gọi là một
              // quyết định chứ không phải một thời lượng.
              props.motionOff && 'duration-0',
              // Không còn `motion.div` để vẽ con trượt, nên ô đang chọn tự tô nền.
              props.motionOff && isActive && 'rounded bg-bg-surface shadow-rest',
            )}
          >
            {option.label}
          </SegmentedControl.Item>
        );
      })}
    </SegmentedControl.Root>
  );
}

export function AppearanceSection(props: AppearanceSectionProps) {
  const { motionOff, rowClassName } = props;

  // Lớp chung của một hàng: chiều cao theo mật độ, hoà tan màu khi đổi chủ đề.
  //
  // `duration-260` chứ không phải `duration-standard`, dù hai tên trỏ vào cùng
  // một giá trị (`tailwind.config.ts` dựng cả hai từ `speed('standard')`):
  // `tailwind-merge` chỉ nhận ra nhóm `duration` khi giá trị là MỘT CON SỐ, nên
  // `duration-standard` không đè được `duration-340` mà `FieldRow` khai sẵn — cả
  // hai lớp cùng ở lại trên phần tử và thứ tự trong tệp CSS mới là thứ quyết
  // định. Tên số thì đè sạch, và đó cũng là tên mà `FieldRow`, `Input`,
  // `Toggle` đang dùng.
  const rowClass = cn(rowClassName, motionOff ? 'duration-0' : 'duration-260');

  /** Hàng có nháy hay không. Tắt chuyển động thì không hàng nào nháy. */
  const flashOf = (key: AppearanceFieldKey): boolean => !motionOff && props.flashedField === key;

  return (
    <div className="flex flex-col">
      <FieldRow label="chủ đề" className={rowClass} flash={flashOf('theme')}>
        <SegmentedField
          ariaLabel="chủ đề"
          options={THEME_OPTIONS}
          value={props.theme}
          onChange={props.onThemeChange}
          motionOff={motionOff}
        />
      </FieldRow>

      <FieldRow
        label="dùng nền tối cho khung nhìn 3D"
        className={rowClass}
        flash={flashOf('viewportDark')}
      >
        <Toggle
          checked={props.viewportDark}
          onChange={props.onViewportDarkChange}
          aria-label="dùng nền tối cho khung nhìn 3D"
          description="Chỉ đổi màu vùng mô hình, giao diện vẫn sáng."
        />
      </FieldRow>

      <FieldRow label="giảm chuyển động" className={rowClass} flash={flashOf('reducedMotion')}>
        <Toggle
          checked={props.reducedMotion}
          onChange={props.onReducedMotionChange}
          aria-label="giảm chuyển động"
          description="Tắt hoạt cảnh trong ứng dụng, không riêng màn này."
        />
      </FieldRow>

      <FieldRow label="hiện lưới 100 mm" className={rowClass} flash={flashOf('showGrid')}>
        <Toggle
          checked={props.showGrid}
          onChange={props.onShowGridChange}
          aria-label="hiện lưới 100 mm"
          description="Lưới nền của khung nhìn, bước 100 mm."
        />
      </FieldRow>

      <FieldRow label="mật độ hiển thị" className={rowClass} flash={flashOf('density')} isLast>
        <SegmentedField
          ariaLabel="mật độ hiển thị"
          options={DENSITY_OPTIONS}
          value={props.density}
          onChange={props.onDensityChange}
          motionOff={motionOff}
        />
      </FieldRow>
    </div>
  );
}
