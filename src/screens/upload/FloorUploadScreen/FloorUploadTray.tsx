/**
 * Khay tệp chưa gán tầng, ở đáy danh sách.
 *
 * Một tệp mà tên của nó không nói ra tầng nào thì không bị từ chối và cũng không
 * bị đoán bừa — nó nằm lại đây cho tới khi người dùng chỉ chỗ. `items` rỗng thì
 * khay không được vẽ: một khay trống là một câu hỏi không ai hỏi.
 *
 * Lỗi của một tệp trong khay cũng ở lại trong chính mục của nó, cùng lý do như
 * ở thẻ tầng — không hộp thoại, không chặn cả trang.
 */

import { useRef } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { Trash2 } from 'lucide-react';

import { CHOOSE_FILE_BUTTON_ID } from './FloorUploadDropZone';
import { SheetGlyph } from './FloorUploadGlyphs';
import type { FloorUploadActions, FloorUploadTrayModel } from './types';

const LABEL_ASSIGN = 'Gán cho tầng';
const PLACEHOLDER_ASSIGN = 'Chọn tầng để gán';
const LABEL_DISMISS = 'Đóng';

export interface FloorUploadTrayProps {
  readonly tray: FloorUploadTrayModel;
  readonly actions: FloorUploadActions;
}

export function FloorUploadTray({ tray, actions }: FloorUploadTrayProps) {
  const sectionRef = useRef<HTMLElement | null>(null);

  if (tray.items.length === 0) {
    return null;
  }

  /**
   * Xoá một tệp mà tiêu điểm không rơi về `<body>` (WCAG 2.4.3, BUG-525): sang thùng rác của
   * tệp kế (hay tệp trước nếu là tệp cuối), hết tệp thì về nút "Chọn tệp".
   */
  const removeAndKeepFocus = (trash: HTMLElement, fileId: string): void => {
    const buttons = [...(sectionRef.current?.querySelectorAll<HTMLElement>('[data-tray-remove]') ?? [])];
    const index = buttons.indexOf(trash);
    const neighbour = buttons[index + 1] ?? buttons[index - 1] ?? document.getElementById(CHOOSE_FILE_BUTTON_ID);

    neighbour?.focus();
    actions.onRemoveFile(fileId);
  };

  return (
    <section
      aria-label={tray.title}
      ref={sectionRef}
      className="flex flex-col gap-3 border-t border-border-default pt-4"
    >
      <header className="flex items-baseline gap-2">
        <h3 className="text-heading text-text-primary">{tray.title}</h3>
        <span className="text-body-sm text-text-secondary">{tray.countLabel}</span>
      </header>

      <ul className="flex flex-col gap-3">
        {tray.items.map((item) => (
          <li className="flex flex-col gap-2" key={item.id}>
            {/* `flex-wrap` + a floor under the name: at 375 px the picker drops to its own line instead of
                squeezing the name to 0 px and pushing the trash off screen (BUG-254, BUG-262). */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-sunken">
                <SheetGlyph />
              </div>

              <p className="min-w-24 flex-1 truncate text-[13px] text-text-secondary">
                {item.summaryLine}
              </p>

              {item.assignOptions.length > 0 && (
                <div className="w-[200px] shrink-0">
                  <Select.Root
                    onChange={(next) => actions.onReassign(item.id, next)}
                    options={[...item.assignOptions]}
                  >
                    <Select.Label className="sr-only">{LABEL_ASSIGN}</Select.Label>
                    <Select.Trigger options={[...item.assignOptions]} placeholder={PLACEHOLDER_ASSIGN} />
                    <Select.Content>
                      {item.assignOptions.map((option, index) => (
                        <Select.Item index={index} key={option.value} value={option.value}>
                          {option.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </div>
              )}

              {item.canRemoveFile && item.removeLabel !== null && (
                <IconButton
                  aria-label={item.removeLabel}
                  icon={<Trash2 />}
                  data-tray-remove=""
                  onClick={(event) => removeAndKeepFocus(event.currentTarget, item.id)}
                  size="sm"
                />
              )}
            </div>

            {item.error !== null && (
              <InlineAlert
                // Đã có thùng rác thì không thêm nút "Đóng" cùng ý (G3-23).
                {...(item.canRemoveFile
                  ? {}
                  : {
                      action: {
                        label: LABEL_DISMISS,
                        onClick: () => actions.onDismissError(item.id),
                        variant: 'secondary' as const,
                      },
                    })}
                level="violation"
                message={item.error.sentence}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
