/**
 * Thẻ nhãn tầng nổi mép phải khung nhìn: tên · cao độ · diện tích · con mắt.
 *
 * Chỉ hiện khi `areLabelsVisible`; hoà tan theo `EXPLODED_MOTION_MS.revealMs`
 * (Tailwind `duration-standard`, đổi sang `duration-instant` khi
 * `reducedMotion` — không hoạt cảnh vị trí, chỉ hoà tan, đúng mục 9 của đặc
 * tả). Mỗi thẻ luôn ở trong DOM (opacity đổi, không mount/unmount) để phép
 * chuyển tiếp CSS chạy được.
 *
 * Thẻ bấm được là một `<button>` phủ kín thẻ (không phải `div onClick`, R-72);
 * con mắt là một `<button>` con đứng NGOÀI vùng phủ đó (không lồng button
 * trong button) nhờ lớp nội dung đặt `pointer-events-none` còn riêng con mắt
 * `pointer-events-auto`.
 */
import { Eye, EyeOff } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

import { DIMMED_FLOOR_OPACITY, EXPLODED_LAYOUT } from './explodedViewTypes';
import type { ExplodedFloorViewModel } from './explodedViewTypes';

export interface ExplodedViewFloorCardsProps {
  readonly floors: readonly ExplodedFloorViewModel[];
  readonly areLabelsVisible: boolean;
  readonly hoveredStoreyId: string | null;
  readonly reducedMotion: boolean;
  readonly onFloorHover: (storeyId: string | null) => void;
  readonly onFloorActivate: (storeyId: string) => void;
  readonly onFloorVisibilityToggle: (storeyId: string) => void;
}

export function ExplodedViewFloorCards({
  floors,
  areLabelsVisible,
  hoveredStoreyId,
  reducedMotion,
  onFloorHover,
  onFloorActivate,
  onFloorVisibilityToggle,
}: ExplodedViewFloorCardsProps) {
  const revealDuration = reducedMotion ? 'duration-instant' : 'duration-standard';
  const dimDuration = reducedMotion ? 'duration-instant' : 'duration-fast';

  return (
    <div
      aria-hidden={!areLabelsVisible}
      className={cn(
        'absolute inset-y-0 right-3 transition-opacity motion-reduce:transition-none',
        revealDuration,
        areLabelsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {floors.map((floor) => {
        const isDimmed = hoveredStoreyId !== null && hoveredStoreyId !== floor.id;

        return (
          <div
            className="absolute right-0 -translate-y-1/2 transition-opacity motion-reduce:transition-none"
            key={floor.id}
            style={{
              top: `${(1 - floor.railFraction) * 100}%`,
              width: EXPLODED_LAYOUT.cardWidthPx,
              opacity: isDimmed ? DIMMED_FLOOR_OPACITY : 1,
            }}
          >
            <div
              className={cn(
                'relative flex items-start justify-between gap-2 bg-bg-surface p-3 shadow-float',
                dimDuration,
                !floor.isReady && 'border-2 border-dashed border-border-default',
              )}
              onMouseEnter={() => {
                onFloorHover(floor.id);
              }}
              onMouseLeave={() => {
                onFloorHover(null);
              }}
              style={{ borderRadius: EXPLODED_LAYOUT.cardRadiusPx }}
            >
              <button
                aria-label={`Chọn tầng ${floor.name}, cao độ ${floor.elevationLabel}, diện tích ${floor.areaLabel}`}
                className={cn(
                  'absolute inset-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
                )}
                onClick={() => {
                  onFloorActivate(floor.id);
                }}
                tabIndex={areLabelsVisible ? 0 : -1}
                type="button"
              />

              <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-0.5 pointer-events-none">
                <span className="truncate text-[13px] font-medium text-text-primary">{floor.name}</span>
                <span className="truncate text-[12px] text-text-secondary">
                  {floor.elevationLabel} · {floor.areaLabel}
                </span>
                {floor.attentionCaption !== null && (
                  <Badge className="mt-1 w-fit" variant="attention">
                    {floor.attentionCaption}
                  </Badge>
                )}
              </div>

              <div className="relative z-10 shrink-0 pointer-events-auto">
                <IconButton
                  aria-label={floor.isVisible ? `Ẩn tầng ${floor.name}` : `Hiện tầng ${floor.name}`}
                  icon={
                    floor.isVisible ? (
                      <Eye aria-hidden="true" className="h-[16px] w-[16px]" />
                    ) : (
                      <EyeOff aria-hidden="true" className="h-[16px] w-[16px]" />
                    )
                  }
                  onClick={() => {
                    onFloorVisibilityToggle(floor.id);
                  }}
                  size="sm"
                  tabIndex={areLabelsVisible ? 0 : -1}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
