/**
 * S-45 — view thuần của lớp trạng thái kết nối.
 *
 * Không import `src/api`, `src/store`, `src/domain` hay `src/lib/http` (R-60).
 *
 * ## Ba tầng, ba nhánh, không nhánh nào lồng nhau
 *
 * `model.tier` quyết định vẽ gì, và nó chỉ nhận một giá trị. Đó là cách duy
 * nhất tôi biết để giữ lời hứa "ba tầng không được trộn" mà không phải nhớ nó.
 *
 * ## Dải giữ chỗ sẵn
 *
 * Đặc tả nói dải phải giữ chỗ để nội dung không nhảy khi nó xuất hiện. Nên chỗ
 * của dải **luôn** chiếm 32px; thứ đổi là độ mờ và nội dung, không phải chiều
 * cao. Một dải đẩy trang xuống 32px giữa lúc người ta đang bấm là một cú nhấn
 * nhầm.
 */

import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';

import { Drawer } from '@/components/overlay/Drawer';
import { Button } from '@/components/ui/Button';

import type { ConnectionStatesProps } from './types';

/** Chiều cao dải, cố định để nội dung không nhảy. */
const BAND_HEIGHT_PX = 32;

/** Bề rộng tấm trượt chi tiết, theo đặc tả. */
const DETAIL_WIDTH_PX = 360;

const DETAIL_TITLE = 'Việc đang chờ đồng bộ';
const DETAIL_EMPTY = 'Không còn thay đổi nào chờ đồng bộ.';
const REPLAY_NOW = 'Thử đồng bộ lại ngay';

function PendingDetail({ actions, model }: ConnectionStatesProps) {
  return (
    <Drawer isOpen={model.isDetailOpen} onClose={actions.onCloseDetail} size={DETAIL_WIDTH_PX}>
      <div className="flex flex-col gap-5">
        <h2 className="text-[19px] font-medium leading-7 text-text-primary">{DETAIL_TITLE}</h2>

        {model.lastSyncLabel !== null ? (
          <p className="text-[13px] leading-[18px] text-text-secondary">{model.lastSyncLabel}</p>
        ) : null}

        {model.droppedLabel !== null ? (
          <p className="rounded-[8px] bg-state-violation-tint px-3 py-2 text-[13px] leading-[18px] text-state-violation-text">
            {model.droppedLabel}
          </p>
        ) : null}

        {model.pendingRows.length === 0 ? (
          <p className="text-[15px] leading-6 text-text-secondary">{DETAIL_EMPTY}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {model.pendingRows.map((row) => (
              <li
                key={row.id}
                className="flex h-9 items-center gap-3 rounded-[8px] px-3 hover:bg-bg-hover"
              >
                <span className="flex-1 truncate text-[14px] leading-5 text-text-primary">
                  {row.label}
                </span>
                <span className="shrink-0 font-mono text-[13px] leading-5 text-text-muted">
                  {row.createdAtLabel}
                </span>
                <span className="shrink-0 font-mono text-[13px] leading-5 text-text-muted">
                  {row.sizeLabel}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Button variant="secondary" size="sm" onClick={actions.onReplayNow}>
          {REPLAY_NOW}
        </Button>
      </div>
    </Drawer>
  );
}

export function ConnectionStates({ actions, model }: ConnectionStatesProps) {
  if (model.state === 'forbidden') {
    return (
      <p role="status" className="px-5 py-2 text-[13px] leading-[18px] text-text-secondary">
        {model.forbiddenMessage}
      </p>
    );
  }

  if (model.state === 'error') {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 px-5 py-2 text-[13px] leading-[18px] text-state-violation-text"
      >
        <CloudOff size={16} aria-hidden="true" />
        <span>{model.errorMessage}</span>
      </div>
    );
  }

  if (model.state === 'loading') {
    return (
      <p role="status" className="px-5 py-2 text-[13px] leading-[18px] text-text-muted">
        Đang kiểm tra kết nối.
      </p>
    );
  }

  /* Tầng 7 — thu gọn: dải rút thành một biểu tượng ở thanh trạng thái. */
  if (model.isCollapsed) {
    return (
      <span
        role="status"
        aria-label={model.headline === '' ? 'Kết nối bình thường' : model.headline}
        className="flex h-6 w-6 items-center justify-center text-text-secondary"
      >
        {model.tier === 'none' ? null : <WifiOff size={16} aria-hidden="true" />}
      </span>
    );
  }

  /* Tầng 1 — không có gì để nói thì KHÔNG nói gì. */
  if (model.tier === 'none') {
    return null;
  }

  /* Tầng 2 — một chấm và một nhãn ngắn ở thanh trạng thái. */
  if (model.tier === 'statusBar') {
    return (
      <span role="status" className="flex items-center gap-2 text-[13px] leading-[18px] text-text-secondary">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-state-attention" />
        {model.headline}
      </span>
    );
  }

  /* Tầng 4 — tấm giữa màn. CHỈ phiên hết hạn mới lên tới đây. */
  if (model.tier === 'blocking') {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={model.headline}
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay"
      >
        <div className="flex w-[420px] flex-col gap-5 rounded-[12px] bg-bg-surface p-6 shadow-modal">
          <p className="text-[19px] font-medium leading-7 text-text-primary">{model.headline}</p>
          <p className="text-[15px] leading-6 text-text-secondary">
            Những thay đổi này vẫn được giữ nguyên trong máy của bạn. Đăng nhập lại là chúng được gửi đi
            tiếp, không mất gì cả.
          </p>
          {actions.onSignInAgain !== null && model.actionLabel !== null ? (
            <Button variant="primary" onClick={actions.onSignInAgain}>
              {model.actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  /* Tầng 3 — dải 32px. Chỗ của nó luôn được giữ sẵn. */
  return (
    <>
      <div
        role="status"
        style={{ height: `${String(BAND_HEIGHT_PX)}px` }}
        className="flex w-full items-center justify-center gap-3 bg-state-attention-tint px-5 transition-opacity duration-fast"
      >
        {model.connectionCase === 'syncing' ? (
          <RefreshCw size={14} aria-hidden="true" className="text-state-attention-text" />
        ) : null}

        <span className="text-[13px] leading-[18px] text-state-attention-text">{model.headline}</span>

        {model.replayLabel !== null ? (
          <span className="font-mono text-[13px] leading-5 text-state-attention-text">
            {model.replayLabel}
          </span>
        ) : null}

        {model.actionLabel !== null ? (
          <Button variant="ghost" size="sm" onClick={actions.onOpenDetail}>
            {model.actionLabel}
          </Button>
        ) : null}
      </div>

      <PendingDetail model={model} actions={actions} />
    </>
  );
}
