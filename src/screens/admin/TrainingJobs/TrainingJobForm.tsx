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

import type { FormModel, Option, TrainableFamilyId, TrainingJobsActions } from './types';

const TEXT = {
  title: 'Tạo lượt huấn luyện',
  family: 'Họ model',
  dataset: 'Bộ dữ liệu',
  version: 'Phiên bản',
  baseModel: 'Model nền',
  epochs: 'Số vòng',
  close: 'Đóng',
  submit: 'Bắt đầu huấn luyện',
  choose: 'Chọn…',
} as const;

interface PickerProps {
  readonly label: string;
  readonly options: readonly Option[];
  readonly value: string | null;
  readonly error?: string | null;
  readonly onChange: (value: string) => void;
}

function Picker({ error = null, label, onChange, options, value }: PickerProps) {
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

  return (
    <Modal.Root isOpen={form !== null} onClose={actions.onCloseForm} width={560}>
      {form !== null && (
        <form noValidate onSubmit={onSubmit}>
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
              <Picker label={TEXT.dataset} onChange={actions.onFormDataset} options={form.datasets} value={form.datasetId} />
              <Picker
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
