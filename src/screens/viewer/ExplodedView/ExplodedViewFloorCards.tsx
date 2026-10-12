/**
 * Thẻ nhãn tầng nổi mép phải khung nhìn: tên · cao độ · diện tích · con mắt.
 *
 * Chỉ hiện khi `areLabelsVisible`, và "chỉ hiện" ở đây nghĩa là KHÔNG CÓ TRONG
 * DOM khi độ tách còn dưới `LABEL_REVEAL_SEPARATION` — không phải một thẻ vẫn
 * nằm đó ở `opacity: 0`. Bản trước giữ thẻ trong cây để phép chuyển tiếp CSS
 * chạy được lượt hoà tan của `EXPLODED_MOTION_MS.revealMs`; đổi lại, tên tầng
 * vẫn đọc được bằng `queryByText` lúc lẽ ra chưa có gì để đọc, và bài kiểm cấp
 * màn khẳng định đúng điều ngược lại. Bài kiểm thắng (R-70), nên thẻ nay
 * mount/unmount thật.
 *
 * Lượt hiện vẫn có chuyển động, và nó là một ANIMATION chứ không phải một
 * transition: `transition-opacity` không có tác dụng trên phần tử vừa mount, còn
 * `animate-panel-rise` thì có. Keyframe ấy đã nằm sẵn trong `tailwind.config.ts`
 * (`panel-rise`, `speed('slow')` — 340 ms, `opacity 0 → 1` cộng một quãng trồi
 * 12 px, `forwards`), nên không phải thêm gì vào cấu hình và cũng không phải
 * mượn `requestAnimationFrame` hay một vòng lặp tự viết, cả hai đều bị cấm ở
 * màn này.
 *
 * Nó gắn vào lớp THẺ chứ không vào lớp định vị bên ngoài: lớp ngoài đang giữ
 * `-translate-y-1/2` để căn thẻ vào đúng cao độ, mà `panel-rise` kết thúc ở
 * `translateY(0)` với `forwards` — đặt nhầm chỗ thì thẻ tụt mất nửa chiều cao và
 * đứng sai vĩnh viễn.
 *
 * 340 ms thay cho 240 ms mà đặc tả xin: 240 không có trên thang chuyển động, và
 * `slow` là nấc gần nhất mà một keyframe sẵn có đang chạy. Lượt mờ khi con trỏ
 * đậu lên một thẻ vẫn là transition thật, theo `EXPLODED_MOTION_MS.dimMs`.
 *
 * Trên THẺ chỉ có một dấu ngắn "cần chú ý"; câu đầy đủ ghi độ lệch thuộc về
 * ĐƯỜNG DẪN thẳng hàng, không thuộc về thẻ — đọc kỹ đặc tả thì caption ghi độ
 * lệch đi với đường dẫn, còn thẻ ở trạng thái một phần chỉ cần "caption cần chú
 * ý". Đặt nhầm câu lên thẻ đã gây đúng hai lỗi đo được trong trình duyệt thật:
 * câu tràn khỏi `Badge` cao cố định 22 px và loang sang thẻ bên cạnh, rồi khi
 * cho nó xuống dòng thì thẻ cao 110 px và bốn thẻ không nhét vừa cột 272 px nên
 * chồng lên nhau (đo được 89 px chồng). Câu không mất đi: nó nằm trong
 * `aria-label` của nút chọn tầng và trong `title` của thẻ.
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
  const dimDuration = reducedMotion ? 'duration-instant' : 'duration-fast';

  /* Dưới ngưỡng thì cảnh chưa đủ thưa để chữ không đè lên hình, và thẻ không
     tồn tại — xem docblock đầu file về vì sao đây là unmount chứ không phải
     `opacity: 0`. */
  if (!areLabelsVisible) {
    return null;
  }

  /*
   * Cột thẻ né các lớp nổi CỦA VỎ, không phải né cho đẹp: ViewCube 72 px và bản
   * đồ nhỏ 160×120 ngồi góc trên phải, cụm thu phóng ngồi góc dưới phải, cả ba
   * thuộc `ViewerShell` nên màn này không dời được chúng — chỉ có thể không đứng
   * dưới chúng. Bản trước bám `right-3` và chỉ né theo chiều dọc (`top-20`): bản
   * đồ nhỏ cao tới y≈208 nên vẫn vẽ đè lên thẻ tầng trên cùng và nuốt cú bấm của
   * nó (BUG-371). Nay cột đứng TRÁI cả dải góc phải (`cardsRightPx`), nên không
   * lớp nào của vỏ chạm tới thẻ; `top-20`/`bottom-20` giữ nửa thẻ trên cùng và
   * dưới cùng không bị `overflow-hidden` cắt, và giữ thẻ dưới nút chụp.
   *
   * Khung hẹp (BUG-370): `right` kẹp bằng `min/max` để mép trái thẻ không bao giờ
   * qua mép trái khung nhìn, và bề rộng co theo khung. Khi ấy thẻ có thể chồng
   * lên bản đồ nhỏ — `z-10` để thẻ (thứ người dùng đang thao tác) nằm trên.
   * Cột phủ cả bề ngang nên nó `pointer-events-none`; chỉ thẻ nhận chuột.
   */
  const { cardWidthPx, cardsRightPx, cardsEdgePx } = EXPLODED_LAYOUT;
  const cardRight = `min(${String(cardsRightPx)}px, max(${String(cardsEdgePx)}px, 100% - ${String(cardWidthPx + cardsEdgePx)}px))`;
  const cardWidth = `min(${String(cardWidthPx)}px, 100% - ${String(2 * cardsEdgePx)}px)`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 bottom-20 z-10">
      {floors.map((floor) => {
        const isDimmed = hoveredStoreyId !== null && hoveredStoreyId !== floor.id;

        return (
          <div
            className="pointer-events-auto absolute -translate-y-1/2 transition-opacity motion-reduce:transition-none"
            key={floor.id}
            style={{
              top: `${(1 - Math.min(1, Math.max(0, floor.railFraction))) * 100}%`,
              right: cardRight,
              width: cardWidth,
              opacity: isDimmed ? DIMMED_FLOOR_OPACITY : 1,
            }}
          >
            <div
              className={cn(
                'relative flex items-start justify-between gap-2 bg-bg-surface px-3 py-1.5 shadow-float',
                'animate-panel-rise motion-reduce:animate-none',
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
              {...(floor.attentionCaption !== null ? { title: floor.attentionCaption } : {})}
            >
              <button
                aria-label={
                  floor.attentionCaption === null
                    ? `Chọn ${floor.inlineName}, cao độ ${floor.elevationLabel}, diện tích ${floor.areaLabel}`
                    : `Chọn ${floor.inlineName}, cao độ ${floor.elevationLabel}, diện tích ${floor.areaLabel}. ${floor.attentionCaption}`
                }
                className={cn(
                  'absolute inset-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
                )}
                onClick={() => {
                  onFloorActivate(floor.id);
                }}
                type="button"
              />

              <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-0.5 pointer-events-none">
                {/*
                  Dấu "Cần chú ý" nằm CÙNG DÒNG với TÊN tầng, không chiếm một dòng
                  riêng: một dòng riêng đẩy thẻ từ 64 lên 92 px, mà khoảng cách giữa
                  hai tâm thẻ chỉ 58–78 px, nên bốn thẻ chồng lên nhau 34 px — đo
                  được trong trình duyệt thật. Nó từng nằm cạnh cao độ và diện tích,
                  và ở đó nó cắt "3,20 m · 70,00 m²" thành "3,20 ..." (BUG-383: chữ
                  91 px trong ô 43 px). Số là thứ thẻ tồn tại để nói nên số giữ
                  trọn dòng của nó; tên mới là thứ nhường chỗ (tên đủ vẫn nằm trong
                  `aria-label` của nút chọn tầng).
                */}
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-text-primary">{floor.name}</span>
                  {floor.attentionCaption !== null && (
                    <Badge className="shrink-0" variant="attention">
                      Cần chú ý
                    </Badge>
                  )}
                </div>
                <span className="truncate text-[12px] text-text-secondary">
                  {floor.elevationLabel} · {floor.areaLabel}
                </span>
              </div>

              <div className="relative z-10 shrink-0 pointer-events-auto">
                <IconButton
                  aria-label={floor.isVisible ? `Ẩn ${floor.inlineName}` : `Hiện ${floor.inlineName}`}
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
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
