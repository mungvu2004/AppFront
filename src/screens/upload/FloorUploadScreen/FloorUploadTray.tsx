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

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { Trash2 } from 'lucide-react';

import { SheetGlyph } from './FloorUploadGlyphs';
import type { FloorUploadActions, FloorUploadTrayModel } from './types';

const LABEL_ASSIGN = 'Gán cho tầng khác';
const LABEL_DISMISS = 'Đóng';

export interface FloorUploadTrayProps {
  readonly tray: FloorUploadTrayModel;
  readonly actions: FloorUploadActions;
}

export function FloorUploadTray({ tray, actions }: FloorUploadTrayProps) {
  if (tray.items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={tray.title}
      className="flex flex-col gap-3 rounded-[12px] border border-border-default bg-bg-surface p-5"
    >
      <header className="flex items-baseline gap-2">
        <h2 className="text-[15px] font-medium text-text-primary">{tray.title}</h2>
        <span className="text-[13px] text-text-muted">{tray.countLabel}</span>
      </header>

      <ul className="flex flex-col gap-3">
        {tray.items.map((item) => (
          <li className="flex flex-col gap-2" key={item.id}>
            <div className="flex items-center gap-3">
              <div className="flex h-[48px] w-[64px] shrink-0 items-center justify-center rounded-[8px] bg-bg-sunken">
                <SheetGlyph />
              </div>

              <p className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                {item.summaryLine}
              </p>

              {item.assignOptions.length > 0 && (
                <div className="w-[200px] shrink-0">
                  <Select.Root
                    onChange={(next) => actions.onReassign(item.id, next)}
                    options={[...item.assignOptions]}
                  >
                    <Select.Label className="sr-only">{LABEL_ASSIGN}</Select.Label>
                    <Select.Trigger options={[...item.assignOptions]} placeholder={LABEL_ASSIGN} />
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
                  onClick={() => actions.onRemoveFile(item.id)}
                  size="sm"
                />
              )}
            </div>

            {item.error !== null && (
              <InlineAlert
                action={{
                  label: LABEL_DISMISS,
                  onClick: () => actions.onDismissError(item.id),
                  variant: 'secondary',
                }}
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
