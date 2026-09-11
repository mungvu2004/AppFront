/**
 * S-47 — lưới khung xem trước: một khung cho MỘT trạng thái, nhãn ĐẶT PHÍA TRÊN
 * khung.
 *
 * Nhãn trên chứ không dưới vì người duyệt đọc theo cột: đọc tên trạng thái rồi
 * mới nhìn vào khung, nên nhãn phải tới trước trong cả thứ tự đọc của mắt và thứ
 * tự của cây DOM. `<figure>` + `<figcaption>` đặt đầu khối làm đúng cả hai.
 *
 * ## Lưới đo khoảng cách
 *
 * Hậu tố alpha của Tailwind (`bg-state-verified` kèm hậu tố tám phần trăm, hay
 * `bg-opacity-N`) biên dịch ra KHÔNG GÌ CẢ
 * trong repo này — mọi token màu là `var()` trần, không có `<alpha-value>` để
 * Tailwind nội suy. Nên lưới là một lớp `aria-hidden` riêng, màu lấy từ token qua
 * `var()`, độ mờ đặt INLINE bằng một hằng có tên. Tiền lệ: `wallStrokeToken`.
 *
 * ## `data-state-gallery-preview` — mối nối với hai phép kiểm nhanh
 *
 * `useStateGallery.ts` (`PREVIEW_FRAME_SELECTOR`) tìm ĐÚNG thuộc tính này để
 * chạy `findNonVietnamese` / `inspectAccessibility` trên cây DOM thật. Thuộc
 * tính đặt trên `<section>` chứ không trên từng khung, vì phép kiểm cần soát cả
 * nhãn màn lẫn bảy khung cùng một lượt. Chỉ màn ĐANG CHỌN dựng khối này, nên 46
 * hàng còn lại của bảng kiểm đứng ở `pending` kèm lý do — đó là ý đồ, không phải
 * thiếu sót (mục E.10). Gỡ thuộc tính này ra thì hai cột đó im lặng `pending`
 * mãi mãi mà không có lỗi nào báo.
 */
import type { GalleryScreenEntry, ScreenStateEntry } from './stateGalleryTypes';

const FRAMES_REGION_LABEL = 'khung xem trước bảy trạng thái';
const FRAME_MISSING = 'chưa có mẫu cho trạng thái này';
const FRAME_PRESENT = 'đã có mẫu';
const STORY_NAME_LABEL = 'tên mẫu';
const SPACING_GRID_LABEL = 'lưới đo khoảng cách';

/** Độ mờ của lưới đo. Đủ thấy để đếm ô, đủ nhạt để không ăn mất nội dung khung. */
const SPACING_GRID_OPACITY = 0.4;

/** Bước lưới, tính theo thang 8 của hệ thống giao diện. */
const SPACING_GRID_STEP = '8px';

/** Màu lưới: token canvas, KHÔNG mã màu thô (A1). */
const SPACING_GRID_TOKEN = 'var(--canvas-2d-grid)';

const SPACING_GRID_IMAGE = [
  `repeating-linear-gradient(to right, ${SPACING_GRID_TOKEN} 0 1px, transparent 1px ${SPACING_GRID_STEP})`,
  `repeating-linear-gradient(to bottom, ${SPACING_GRID_TOKEN} 0 1px, transparent 1px ${SPACING_GRID_STEP})`,
].join(', ');

interface StateGalleryFramesProps {
  readonly screen: GalleryScreenEntry;
  readonly isSpacingGridVisible: boolean;
}

interface StateFrameProps {
  readonly entry: ScreenStateEntry;
  readonly isSpacingGridVisible: boolean;
}

function StateFrame({ entry, isSpacingGridVisible }: StateFrameProps) {
  const isMissing = entry.storyExportName === null;

  return (
    <figure className="flex flex-col gap-1.5">
      {/* Nhãn trạng thái ĐẶT PHÍA TRÊN khung. */}
      <figcaption className="flex items-baseline gap-2">
        <span className="text-[14px] font-medium leading-[20px] text-text-primary">{entry.label}</span>
        <span
          className={[
            'text-[13px] leading-[18px]',
            isMissing ? 'text-state-attention-text' : 'text-text-muted',
          ].join(' ')}
        >
          {isMissing ? FRAME_MISSING : FRAME_PRESENT}
        </span>
      </figcaption>

      <div
        className={[
          'relative flex h-[148px] items-center justify-center overflow-hidden rounded-[8px] border',
          isMissing
            ? 'border-state-attention bg-state-attention-tint'
            : 'border-border-default bg-bg-sunken',
        ].join(' ')}
      >
        {isSpacingGridVisible && (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundImage: SPACING_GRID_IMAGE, opacity: SPACING_GRID_OPACITY }}
          />
        )}

        {isMissing ? (
          <p className="relative px-3 text-center text-[13px] leading-[18px] text-state-attention-text">
            {FRAME_MISSING}
          </p>
        ) : (
          <p className="relative flex flex-col items-center gap-1 px-3 text-center">
            <span className="text-[13px] leading-[18px] text-text-secondary">{STORY_NAME_LABEL}</span>
            <code className="rounded-[4px] bg-bg-surface px-1.5 py-0.5 text-[13px] text-text-primary">
              {entry.storyExportName}
            </code>
          </p>
        )}
      </div>
    </figure>
  );
}

export function StateGalleryFrames({ screen, isSpacingGridVisible }: StateGalleryFramesProps) {
  return (
    <section
      aria-label={FRAMES_REGION_LABEL}
      className="flex flex-col gap-3"
      data-state-gallery-preview
    >
      <h2 className="text-[16px] font-semibold leading-[22px] text-text-primary">{screen.label}</h2>

      {isSpacingGridVisible && (
        <p className="text-[13px] leading-[18px] text-text-secondary">{SPACING_GRID_LABEL}</p>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {screen.states.map((entry) => (
          <li key={entry.state}>
            <StateFrame entry={entry} isSpacingGridVisible={isSpacingGridVisible} />
          </li>
        ))}
      </ul>
    </section>
  );
}
