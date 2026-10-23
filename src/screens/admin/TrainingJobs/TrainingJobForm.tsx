/**
 * Biểu mẫu "Tạo lượt huấn luyện" (`Modal` 560): họ → bộ dữ liệu → phiên bản sẵn sàng → model
 * nền → số vòng. Enter gửi khi hợp lệ; nút gửi tắt trong lúc gửi (chặn bấm lặp). Esc đóng,
 * tiêu điểm về nút đã mở (Modal, A12).
 */

import type { FormEvent } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { NumericField } from '@/components/ui/NumericField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { parseNumber } from '@/lib/format/number';

import type { FormModel, Option, TrainableFamilyId, TrainingJobsActions } from './types';

const TEXT = {
  title: 'Tạo lượt huấn luyện',
  family: 'Loại mô hình',
  dataset: 'Bộ dữ liệu',
  version: 'Phiên bản',
  baseModel: 'Model nền',
  epochs: 'Số vòng',
  close: 'Đóng',
  submit: 'Bắt đầu huấn luyện',
  choose: 'Chọn…',
  noDataset: 'Loại mô hình này chưa có bộ dữ liệu nào. Dựng bộ dữ liệu bằng công cụ dòng lệnh trước (xem tab Bộ dữ liệu).',
  noVersion: 'Chọn bộ dữ liệu trước; chỉ phiên bản đã dựng xong mới dùng để huấn luyện được.',
  baseModelHint: 'Mạng có sẵn để bắt đầu học; bản lớn hơn thường chính xác hơn nhưng học lâu hơn.',
  epochsHint: 'Một vòng là một lần máy đọc hết bộ dữ liệu để học; nhiều vòng hơn thì chính xác hơn nhưng lâu hơn.',
} as const;

interface PickerProps {
  readonly label: string;
  readonly options: readonly Option[];
  readonly value: string | null;
  readonly error?: string | null;
  /** Câu giải thích khi ô bị khoá vì không có lựa chọn nào (G2-19). */
  readonly emptyHint?: string | null;
  readonly onChange: (value: string) => void;
}

function Picker({ emptyHint = null, error = null, label, onChange, options, value }: PickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Select.Root disabled={options.length === 0} onChange={onChange} options={[...options]} value={value ?? undefined}>
        <Select.Label className="text-[13px] text-text-secondary">{label}</Select.Label>
        <Select.Trigger options={[...options]} placeholder={TEXT.choose} />
        <Select.Content>
          {options.map((option, index) => (
            <Select.Item index={index} key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {options.length === 0 && error === null && emptyHint !== null && (
        <p className="text-[13px] text-text-secondary">{emptyHint}</p>
      )}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { readonly message: string | null }) {
  return message === null ? null : (
    <p className="text-[13px] text-state-violation-text" role="alert">
      {message}
    </p>
  );
}

export interface TrainingJobFormProps {
  readonly form: FormModel | null;
  readonly actions: TrainingJobsActions;
}

export function TrainingJobForm({ actions, form }: TrainingJobFormProps) {
  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    actions.onSubmitForm();
  };
  // Ô số vòng chỉ chốt chữ gõ sau 800 ms và không chốt số bị từ chối: báo từng phím để nút gửi/Enter dựa vào số đang gõ.
  const onInput = (event: FormEvent<HTMLFormElement>): void => {
    if (event.target instanceof HTMLInputElement) actions.onTypeEpochs(parseNumber(event.target.value));
  };

  return (
    <Modal.Root isOpen={form !== null} onClose={actions.onCloseForm} width={560}>
      {form !== null && (
        <form noValidate onInput={onInput} onSubmit={onSubmit}>
          <Modal.Header>{TEXT.title}</Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4 pb-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-text-secondary">{TEXT.family}</span>
                <SegmentedControl<TrainableFamilyId>
                  aria-label={TEXT.family}
                  onChange={actions.onFormFamily}
                  options={[...form.families]}
                  value={form.family}
                />
              </div>
              <Picker
                emptyHint={form.isLoadingOptions ? null : TEXT.noDataset}
                label={TEXT.dataset}
                onChange={actions.onFormDataset}
                options={form.datasets}
                value={form.datasetId}
              />
              <Picker
                emptyHint={form.datasets.length === 0 ? null : TEXT.noVersion}
                error={form.versionError}
                label={TEXT.version}
                onChange={actions.onFormVersion}
                options={form.versions}
                value={form.versionId}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-text-secondary">{TEXT.baseModel}</span>
                <SegmentedControl
                  aria-label={TEXT.baseModel}
                  onChange={actions.onFormBaseModel}
                  options={[...form.baseModels]}
                  {...(form.baseModel === null ? {} : { value: form.baseModel })}
                />
                <p className="text-[12px] text-text-secondary">{TEXT.baseModelHint}</p>
                <FieldError message={form.baseModelError} />
              </div>
              <NumericField
                label={TEXT.epochs}
                max={form.epochsMax}
                min={form.epochsMin}
                onChange={actions.onFormEpochs}
                value={form.epochs}
                {...(form.epochsError === null ? {} : { error: form.epochsError })}
              />
              <p className="-mt-2 text-[12px] text-text-secondary">{TEXT.epochsHint}</p>
              {form.formError !== null && <InlineAlert level="violation" message={form.formError} />}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={actions.onCloseForm} type="button" variant="ghost">
              {TEXT.close}
            </Button>
            <Button disabled={!form.canSubmit} loading={form.isSubmitting} type="submit" variant="primary">
              {TEXT.submit}
            </Button>
          </Modal.Footer>
        </form>
      )}
    </Modal.Root>
  );
}
