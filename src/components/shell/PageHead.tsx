import React from 'react';
import { cn } from '../../lib/utils';

// ─── PageHead ─────────────────────────────────────────────────────────────────
// Ba câu mỗi màn phải trả lời (NGUYEN-TAC-BO-CUC §1): màn làm gì (title — động từ
// + đối tượng), đang ở trạng thái nào (status — Badge + câu có số + SaveIndicator),
// sang bước sau thế nào (next — điều kiện + MỘT nút). Eyebrow là vị trí, 1–3 từ.

export interface PageHeadProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  status?: React.ReactNode;
  next?: React.ReactNode;
}

export function PageHead({ eyebrow, title, status, next, className, ...props }: PageHeadProps) {
  return (
    <header className={cn('flex flex-wrap items-end gap-x-6 gap-y-4 mb-6', className)} {...props}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-caption font-medium uppercase tracking-[0.06em] text-text-muted">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-title text-text-primary">{title}</h1>
        {status && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-text-secondary">
            {status}
          </div>
        )}
      </div>
      {next && <div className="ml-auto flex items-center gap-4">{next}</div>}
    </header>
  );
}
