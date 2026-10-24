import React from 'react';
import { cn } from '../../lib/utils';

// ─── Section ──────────────────────────────────────────────────────────────────
// MỘT khung cho mỗi phần của trang (NGUYEN-TAC-BO-CUC §2): nền trắng, bo 12, bóng
// panel; đầu khung chứa tiêu đề + lọc/tìm/nút của phần đó. Bên trong không lồng thẻ.

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  /** Bỏ đệm thân khung khi nội dung là danh sách tràn mép. */
  flush?: boolean;
}

export function Section({ title, actions, flush = false, className, children, ...props }: SectionProps) {
  return (
    <section className={cn('rounded-xl bg-bg-surface shadow-panel', className)} {...props}>
      {(title || actions) && (
        <div className="flex min-h-14 items-center gap-4 border-b border-border-default px-5 py-4">
          {title && <h2 className="text-heading text-text-primary">{title}</h2>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}
