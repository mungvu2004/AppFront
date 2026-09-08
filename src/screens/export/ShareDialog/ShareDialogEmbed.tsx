/**
 * Mục 3 — nhúng bản vẽ vào một trang khác.
 *
 * Khung xem trước là TĨNH: vẽ lại đúng bốn sự thật của `model.embed.view` (tầng · chế
 * độ màu · thanh công cụ · có góc nhìn hay không), không nạp three, không WebGL — cổng
 * kích thước gói tính mọi chunk dùng chung vào TỪNG route lazy, và route xấu nhất đang
 * áp trần (xem chú thích `EmbedSectionModel.view` trong `types.ts`).
 *
 * `levelOptions` có thể rỗng khi dự án chưa có tầng nào — `Select` tầng ẩn đi thay vì vẽ
 * một `Select` trống. Danh mục tầng/màu đến từ `model.embed.levelOptions`/`coloringOptions`,
 * không tự khai ở đây, để `id` không lệch với hook.
 */

import { Check, Copy, ImageOff } from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';

import type { EmbedSectionModel, ShareDialogActions } from './types';

export interface ShareDialogEmbedProps {
  readonly embed: EmbedSectionModel;
  /**
   * `model.copiedTargetId` đang trỏ vào mã nhúng — dấu tích giữ 700 ms rồi bỏ, đúng như
   * hàng liên kết. Vỏ hộp thoại so sánh, không phải mục này, để mục này vẫn thuần props.
   */
  readonly isCodeCopied: boolean;
  readonly actions: Pick<
    ShareDialogActions,
    | 'setEmbedLevel'
    | 'setEmbedColoring'
    | 'setEmbedToolbar'
    | 'setEmbedSizePreset'
    | 'setEmbedWidth'
    | 'setEmbedHeight'
    | 'copyEmbedCode'
  >;
}

/** Nền `--bg-selected` trong chốc lát cho điều khiển vừa đổi, rồi mờ dần (mục B). */
function changedWrapperClass(
  key: 'levelId' | 'coloring' | 'toolbar',
  recentlyChangedKey: EmbedSectionModel['recentlyChangedKey'],
): string {
  return cn(
    'flex flex-col gap-1 rounded-lg p-1.5 transition-colors duration-standard',
    recentlyChangedKey === key && 'bg-bg-selected',
  );
}

interface EmbedPreviewProps {
  readonly embed: EmbedSectionModel;
}

function EmbedPreview({ embed }: EmbedPreviewProps) {
  const levelLabel = embed.levelOptions.find((option) => option.id === embed.view.levelId)?.label ?? 'chưa chọn';
  const coloringLabel =
    embed.coloringOptions.find((option) => option.id === embed.view.coloring)?.label ?? embed.view.coloring;

  return (
    <div className="flex w-[240px] shrink-0 flex-col gap-2">
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-border-default bg-bg-sunken p-3 text-center">
        <ImageOff aria-hidden="true" size={20} className="text-text-muted" />
        <p className="text-xs text-text-muted">xem trước tĩnh</p>
      </div>
      <dl className="flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">tầng</dt>
          <dd className="text-text-primary">{levelLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">chế độ màu</dt>
          <dd className="text-text-primary">{coloringLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">thanh công cụ</dt>
          <dd className="text-text-primary">{embed.view.toolbar ? 'có' : 'không'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">góc nhìn</dt>
          <dd className="text-text-primary">{embed.view.viewpoint !== null ? 'có' : 'không'}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ShareDialogEmbed({ embed, isCodeCopied, actions }: ShareDialogEmbedProps) {
  const sizePresetOptions = embed.sizePresets.map((preset) => ({ label: preset.label, value: preset.id }));
  const levelSelectOptions = embed.levelOptions.map((option) => ({ label: option.label, value: option.id }));
  const coloringSelectOptions = embed.coloringOptions.map((option) => ({ label: option.label, value: option.id }));

  const handleLevelChange = (value: string) => {
    const option = embed.levelOptions.find((candidate) => candidate.id === value);
    if (option) {
      actions.setEmbedLevel(option.id);
    }
  };

  const handleColoringChange = (value: string) => {
    const option = embed.coloringOptions.find((candidate) => candidate.id === value);
    if (option) {
      actions.setEmbedColoring(option.id);
    }
  };

  return (
    <section aria-label="nhúng vào trang khác" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-text-secondary">nhúng vào trang khác</h3>

      <div className={cn('flex gap-4', embed.previewHidden ? 'flex-col' : 'flex-col md:flex-row')}>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-start gap-2">
            <pre className="flex-1 overflow-x-auto rounded-lg bg-bg-sunken p-3 font-mono text-[13px] text-text-primary">
              <code>{embed.code}</code>
            </pre>
            <IconButton
              aria-label={isCodeCopied ? 'đã sao chép mã nhúng' : 'sao chép mã nhúng'}
              icon={
                isCodeCopied ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Copy size={16} aria-hidden="true" />
                )
              }
              onClick={actions.copyEmbedCode}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">kích thước</span>
            <SegmentedControl
              aria-label="kích thước khung nhúng"
              options={sizePresetOptions}
              value={embed.activeSizePresetId ?? undefined}
              onChange={actions.setEmbedSizePreset}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="chiều rộng (px)"
              value={embed.widthPx}
              onChange={(event) => {
                actions.setEmbedWidth(Number(event.target.value));
              }}
            />
            <Input
              type="number"
              label="chiều cao (px)"
              value={embed.heightPx}
              onChange={(event) => {
                actions.setEmbedHeight(Number(event.target.value));
              }}
            />
          </div>

          <div className={changedWrapperClass('toolbar', embed.recentlyChangedKey)}>
            <Toggle
              label="thanh công cụ"
              description="hiện thanh điều khiển của trình xem trong khung nhúng."
              checked={embed.params.toolbar}
              onChange={actions.setEmbedToolbar}
            />
          </div>

          {embed.levelOptions.length > 0 && (
            <div className={changedWrapperClass('levelId', embed.recentlyChangedKey)}>
              <Select
                label="tầng"
                options={levelSelectOptions}
                {...(embed.params.levelId !== null ? { value: embed.params.levelId } : {})}
                onChange={handleLevelChange}
              />
            </div>
          )}

          <div className={changedWrapperClass('coloring', embed.recentlyChangedKey)}>
            <Select
              label="chế độ tô màu"
              options={coloringSelectOptions}
              {...(embed.params.coloring !== null ? { value: embed.params.coloring } : {})}
              onChange={handleColoringChange}
            />
          </div>
        </div>

        {!embed.previewHidden && <EmbedPreview embed={embed} />}
      </div>
    </section>
  );
}
