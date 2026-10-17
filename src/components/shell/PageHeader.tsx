import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Tên màn: h1 duy nhất của màn, kiểu câu. */
  readonly title: string;
  /** Một câu nói màn này làm gì; bỏ trống thì không vẽ. */
  readonly description?: string;
  /** Hành động chính của màn (vd. "Mời người dùng"), căn phải cạnh tiêu đề. */
  readonly actions?: ReactNode;
}

/**
 * Đầu trang dùng chung: h1 nhìn thấy được, cỡ 20px đậm vừa — cùng bậc với Thư viện model, Registry,
 * Huấn luyện, Cài đặt tài khoản và Dự án của tôi (trước đây mỗi màn tự viết lại class này).
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[20px] font-semibold text-text-primary">{title}</h1>
        {description !== undefined && <p className="text-[14px] text-text-secondary">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
PageHeader.displayName = 'PageHeader';
