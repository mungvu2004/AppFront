import React from 'react';
import { cn } from '../../lib/utils';

export type SkeletonPreset = 'table-row' | 'project-card' | 'property-panel' | 'canvas' | 'block';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  preset: SkeletonPreset;
}

export function Skeleton({ preset, className, ...props }: SkeletonProps) {
  // Tailwind's built-in pulse, overridden in tailwind.config.ts to three ambient
  // beats so it sits on the duration ladder. (A comment here once described a
  // 1400ms shimmer; no such animation was ever wired up.)
  // motion-reduce:animate-none ensures it stops on reduced motion preference
  //
  // Khối tô `border-default` (sáng 1,22:1 trên app, 1,34:1 trên surface; tối 1,45 và 1,31), không
  // `bg-sunken` (1,05 và 1,16 — gần như vô hình). Không lên 3:1: khung xương là chỗ giữ trang trí,
  // không phải thành phần giao diện hay đồ hoạ mang nghĩa nên WCAG 1.4.11 không áp; thông tin
  // "đang tải" phải nói bằng chữ/ARIA ở nơi gọi (`role="status"`, `aria-busy`). Một khối xám 3:1
  // (`border-control`) đọc ra như nội dung bị vô hiệu hoá. Ngưỡng ở đây: ngang đường kẻ hairline
  // của hệ thống, tức nhận ra được nhưng lùi sau nội dung thật.
  const baseClass = 'bg-border-default rounded-lg animate-pulse motion-reduce:animate-none';

  switch (preset) {
    case 'table-row':
      return (
        <div className={cn('flex items-center gap-4 p-3 w-full', className)} {...props}>
          <div className={cn(baseClass, 'w-8 h-8 rounded-md')} />
          <div className={cn(baseClass, 'h-4 w-1/4')} />
          <div className={cn(baseClass, 'h-4 w-1/4')} />
          <div className={cn(baseClass, 'h-4 w-1/6 ml-auto')} />
        </div>
      );
    case 'project-card':
      // The dashboard card's own boxes (`ProjectCardTile`): 132 px image, then name, stats, progress and the
      // member row at their real heights (44 px touch rows below `sm`), so nothing moves when the cards land
      // (BUG-228). Full cell width: a 384 px cap left gaps between the skeletons the cards then filled.
      return (
        <div className={cn('flex w-full flex-col overflow-hidden rounded-xl border border-border-default bg-bg-surface', className)} {...props}>
          <div className={cn(baseClass, 'h-[132px] shrink-0 rounded-none border-b border-border-default')} />
          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-col gap-1">
              <div className="flex h-11 items-center sm:h-6"><div className={cn(baseClass, 'h-4 w-3/4')} /></div>
              <div className="flex h-[18px] items-center"><div className={cn(baseClass, 'h-3 w-1/2')} /></div>
            </div>
            <div className={cn(baseClass, 'h-[26.5px] w-full')} />
            <div className="flex h-11 items-center sm:h-7"><div className={cn(baseClass, 'h-7 w-7 rounded-full')} /></div>
          </div>
        </div>
      );
    case 'block':
      // One pulsing block sized by the caller, for a control's place while it loads.
      return <div className={cn(baseClass, className)} {...props} />;
    case 'property-panel':
      return (
        <div className={cn('flex flex-col gap-4 p-4 w-full', className)} {...props}>
          <div className={cn(baseClass, 'h-6 w-1/3 mb-2')} />
          {[1, 2, 3, 4].map((i) => (
            <div key={`property-skeleton-${i}`} className="flex justify-between items-center">
              <div className={cn(baseClass, 'h-4 w-24')} />
              <div className={cn(baseClass, 'h-8 w-32')} />
            </div>
          ))}
        </div>
      );
    case 'canvas':
      return (
        <div className={cn('relative w-full h-full min-h-[400px] bg-bg-app border border-border-default overflow-hidden', className)} {...props}>
          <div className={cn(baseClass, 'absolute top-4 left-4 w-48 h-12')} />
          <div className={cn(baseClass, 'absolute top-4 right-4 w-12 h-12')} />
          <div className={cn(baseClass, 'absolute bottom-4 left-4 w-64 h-8')} />
        </div>
      );
    default:
      return null;
  }
}
