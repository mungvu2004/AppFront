/**
 * Cột minh hoạ của khung tài khoản (`AuthFrame`): một mặt bằng nét mực trên nền giấy, cùng ngôn ngữ
 * với `/welcome`, và hai câu giới thiệu.
 *
 * Trước đây là ảnh dựng 3D trên khung tối: sau cao trào của trang chào, /login như một app khác (A1 P1).
 * Giờ chỉ là SVG tĩnh — không three.js, không canvas — nên không có gì để tải hay hỏng.
 * Từ `lg` là cột trái 45%; dưới `lg` thu thành một dải gọn trên đầu (ở 768 vẫn còn nét vẽ, A1 hành trình trũng 2).
 *
 * `aria-hidden` cho hình: là hoạ tiết, tiêu đề `h1` của biểu mẫu đã nói nghĩa. Khẩu hiệu là `<p>`, không
 * `<h1>`: h1 duy nhất của màn là tên biểu mẫu (BUG-047).
 */

/* Nhập THEO TÊN, không default: default export của `vi.json` là một object literal liền
   khối nên Rollup phải giữ cả cuốn từ điển trong chunk vào. Đừng "dọn" về default. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

/** Tường ngoài có chừa cửa đi và cửa sổ, vách trong, cung mở cửa — nét mực như mặt bằng của /welcome. */
const WALLS = 'M20 20 H132 M156 20 H220 V140 H124 M100 140 H20 V96 M20 64 V20 M100 20 V72 M100 96 V140 M100 84 H164 M188 84 H220';
const WINDOW = 'M16 64 V96 M24 64 V96';
const DOOR = 'M132 20 V44 A24 24 0 0 0 156 20';
const DIMENSION = 'M20 152 H220 M20 148 V156 M220 148 V156';

function AuthPlan({ className }: { readonly className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 164" fill="none" strokeLinecap="square" className={`auth-art ${className}`}>
      <path d={WALLS} strokeWidth={4} />
      <path d={WINDOW} strokeWidth={1.25} />
      <path d={DOOR} strokeWidth={1.25} />
      <path d={DIMENSION} strokeWidth={1} className="auth-art-accent" />
    </svg>
  );
}

export function ValuePanel() {
  return (
    <section className="auth-art-panel relative flex shrink-0 items-center gap-6 border-b px-6 py-4 sm:px-12 lg:w-[45%] lg:flex-col lg:items-start lg:justify-center lg:gap-12 lg:border-b-0 lg:border-r lg:p-12">
      <AuthPlan className="h-20 w-auto shrink-0 lg:h-auto lg:w-full lg:max-w-[480px]" />
      <div className="flex max-w-[420px] flex-col gap-4 animate-panel-rise motion-reduce:animate-none">
        {/* `text-balance`: ở 1024 cột chữ ~364 px, không cân thì "trường." đứng một mình ở dòng ba (BUG-046). */}
        <p className="hidden text-balance text-title-sm font-medium sm:block lg:text-[28px] lg:leading-9">
          {AUTH_MESSAGES.hero.headline}
        </p>
        <p className="auth-art-soft hidden text-[15px] leading-6 lg:block">{AUTH_MESSAGES.hero.support}</p>
      </div>
    </section>
  );
}
