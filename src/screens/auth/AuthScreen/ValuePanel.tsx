/**
 * Cột minh hoạ của khung tài khoản (`AuthFrame`): CHÍNH mặt bằng nét mực của `/welcome` (`planSvg` của
 * `lib/landing/house`, cùng nhà mẫu, cùng cây, hatch và kích thước), tên sản phẩm như đầu trang chào, và hai
 * câu giới thiệu.
 *
 * Bản trước vẽ tay một mặt bằng 4 nét dày cùng đường kích thước xanh: thô, lạc tông với trang chào ngay trước
 * nó (người dùng chê 24-10). Giờ là SVG tĩnh sinh từ dữ liệu nhà mẫu — không three.js, không canvas; tải lười
 * như `StaticLanding` để chunk đăng nhập không mang cả bộ dữ liệu nhà.
 * Từ `lg` là cột trái 50%; dưới `lg` thu thành dải gọn trên đầu (ở 768 vẫn còn nét vẽ, A1 hành trình trũng 2).
 *
 * `aria-hidden` cho hình: là hoạ tiết, tiêu đề `h1` của biểu mẫu đã nói nghĩa. Khẩu hiệu là `<p>`, không
 * `<h1>`: h1 duy nhất của màn là tên biểu mẫu (BUG-047).
 */

import { useEffect, useState } from 'react';

/* Nhập THEO TÊN, không default: default export của `vi.json` là một object literal liền
   khối nên Rollup phải giữ cả cuốn từ điển trong chunk vào. Đừng "dọn" về default. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

import { drawablePlan } from './drawablePlan';

const PLAN_CAPTION = 'Mặt bằng tầng 1 (dữ liệu minh hoạ)';

function usePlanSvg(): string | null {
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void import('@/lib/landing/house').then(({ LANDING_HOUSE, planSvg }) => {
      if (alive) setPlan(drawablePlan(planSvg(LANDING_HOUSE)));
    });

    return () => {
      alive = false;
    };
  }, []);

  return plan;
}

export function ValuePanel() {
  const plan = usePlanSvg();

  return (
    <section className="auth-art-panel relative flex shrink-0 items-center gap-6 border-b px-6 py-4 sm:px-12 lg:w-1/2 lg:flex-col lg:items-stretch lg:justify-between lg:gap-8 lg:border-b-0 lg:border-r lg:px-12 lg:py-10">
      <p className="auth-wordmark hidden lg:block">
        AppFront <span className="auth-art-soft">· Bản vẽ thành mô hình 3D</span>
      </p>
      <figure className="auth-plan m-0 shrink-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-center lg:gap-3">
        {/*
          Khung giữ chỗ cùng tỉ lệ, để chữ bên cạnh không nhảy khi SVG tải xong. Một khoảnh khắc chuyển động
          duy nhất, kể đúng việc sản phẩm làm: nét mực tự vẽ ra, rồi một vệt quét lướt ngang và nét được "đọc"
          sáng lên màu mực xanh rồi lắng xuống (`landing.css`, `.auth-plan-*`). Giảm chuyển động: hình tĩnh.
        */}
        <div aria-hidden="true" className="auth-plan-art">
          {plan !== null && (
            <>
              <div className="auth-plan-draw" dangerouslySetInnerHTML={{ __html: plan }} />
              <div className="auth-plan-scan" dangerouslySetInnerHTML={{ __html: plan }} />
              <span className="auth-plan-beam" />
            </>
          )}
        </div>
        <figcaption className="auth-art-soft hidden text-caption uppercase tracking-[0.06em] lg:block">
          {PLAN_CAPTION}
        </figcaption>
      </figure>
      <div className="flex max-w-[460px] flex-col gap-3 animate-panel-rise motion-reduce:animate-none">
        {/* `text-balance`: ở 1024 cột chữ hẹp, không cân thì "trường." đứng một mình ở dòng cuối (BUG-046). */}
        <p className="hidden text-balance text-title-sm font-medium sm:block lg:text-[28px] lg:leading-9">
          {AUTH_MESSAGES.hero.headline}
        </p>
        <p className="auth-art-soft hidden text-[15px] leading-6 lg:block">{AUTH_MESSAGES.hero.support}</p>
      </div>
    </section>
  );
}
