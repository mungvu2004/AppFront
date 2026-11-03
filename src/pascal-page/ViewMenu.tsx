/**
 * Menu "Xem" của thanh trên trang 3D: gộp Phong cách, Ánh sáng, Chất lượng hình và Nướng ánh sáng
 * vào MỘT menu thả xuống chia mục (thanh trên trước dài, bốn menu mở chồng nhau). Mỗi mục là thẻ cũ
 * ở chế độ `section`, logic giữ nguyên.
 */
import { ChevronDown, Eye } from 'lucide-react';

import { BakeLightingCard } from './BakeLightingCard';
import { LightingCard, type LightingCardProps } from './LightingCard';
import { MENU_SUMMARY_CLASS, useMenuGroup } from './menuGroup';
import { QualityCard } from './QualityCard';
import { SceneStyleCard, type SceneStyleCardProps } from './SceneStyleCard';

export interface ViewMenuProps {
  readonly projectId: string;
  readonly useViewer: LightingCardProps['useViewer'];
  readonly saveNow: SceneStyleCardProps['saveNow'];
  readonly flushAutosaves: SceneStyleCardProps['flushAutosaves'];
  readonly reload: SceneStyleCardProps['reload'];
  /** Không có (chỉ xem) thì ẩn mục Nướng ánh sáng. */
  readonly exportGlb?: () => Promise<Blob | null>;
  /** Chỉ cho test: phong cách của dự án. */
  readonly source?: SceneStyleCardProps['source'];
}

const DIVIDER = 'mx-2 my-1 border-t border-[var(--pa-border)]';

export function ViewMenu({ projectId, useViewer, saveNow, flushAutosaves, reload, exportGlb, source }: ViewMenuProps) {
  useMenuGroup();
  return (
    <details className="relative" data-appfront-menu="">
      <summary aria-label="Xem — phong cách, ánh sáng, chất lượng hình" className={MENU_SUMMARY_CLASS} title="Phong cách, ánh sáng, chất lượng hình">
        <Eye aria-hidden="true" className="h-4 w-4 shrink-0" />
        Xem
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)]" />
      </summary>
      <div
        className="absolute top-full left-0 z-50 mt-1 max-h-[calc(100vh-6rem)] w-64 overflow-y-auto rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 shadow-[var(--pa-shadow-overlay)]"
      >
        <SceneStyleCard
          flushAutosaves={flushAutosaves}
          reload={reload}
          saveNow={saveNow}
          section
          {...(source === undefined ? {} : { source })}
        />
        <div aria-hidden="true" className={DIVIDER} />
        <LightingCard projectId={projectId} section useViewer={useViewer} />
        <div aria-hidden="true" className={DIVIDER} />
        <QualityCard section />
        {exportGlb === undefined ? null : (
          <>
            <div aria-hidden="true" className={DIVIDER} />
            <BakeLightingCard exportGlb={exportGlb} projectId={projectId} section />
          </>
        )}
      </div>
    </details>
  );
}
