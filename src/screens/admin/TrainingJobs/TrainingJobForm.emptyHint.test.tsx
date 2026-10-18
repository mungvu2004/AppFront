import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TrainingJobForm } from './TrainingJobForm';
import type { FormModel, TrainingJobsActions } from './types';

const form: FormModel = {
  families: [{ label: 'Tách lớp tường', value: 'wallSegmentation' }],
  family: 'wallSegmentation',
  datasets: [],
  datasetId: null,
  versions: [],
  versionId: null,
  isLoadingOptions: false,
  versionError: null,
  baseModels: [],
  baseModel: null,
  baseModelError: null,
  epochs: 50,
  epochsMin: 1,
  epochsMax: 300,
  epochsError: null,
  formError: null,
  canSubmit: false,
  isSubmitting: false,
};

const actions = new Proxy({}, { get: () => vi.fn() }) as unknown as TrainingJobsActions;

describe('TrainingJobForm (G2-19)', () => {
  it('không có bộ dữ liệu → nói vì sao ô bị khoá', () => {
    render(<TrainingJobForm actions={actions} form={form} />);
    expect(screen.getByText(/chưa có bộ dữ liệu nào/u)).toBeInTheDocument();
    // Ô phiên bản không lặp thêm câu thứ hai khi gốc rễ là thiếu bộ dữ liệu.
    expect(screen.queryByText(/Chọn bộ dữ liệu trước/u)).toBeNull();
  });
});
