/**
 * The one source of the wizard's status (NGUYEN-TAC-BO-CUC §1): the chip and
 * sentence under the title, the step bar, the review's group marks and the
 * footer's single button are all read from {@link deriveCreateProjectGate}.
 *
 * Never a dead "Tiếp tục": while a step is not done, the button names the
 * first thing still missing and its click leads there (`fix`).
 */

import type { CreateProjectModalViewProps } from './useCreateProjectModal';

/** What each step is about — the step bar's names. */
export const STEP_TITLES = ['Thông tin công trình', 'Tầng', 'Xem lại'] as const;

/** Field ids the footer button focuses when it leads to what is missing. */
export const FIELD_IDS = {
  name: 'create-project-name',
  code: 'create-project-code',
  address: 'create-project-address',
} as const;

/** Where the footer button leads while something is missing. */
export type CreateProjectFix = 'name' | 'code' | 'address' | 'floors' | 'addFloor' | 'notice' | 'back';

export interface CreateProjectGate {
  readonly ready: boolean;
  readonly chip: { readonly variant: 'verified' | 'violation'; readonly label: string } | null;
  readonly sentence: string;
  /** Ready: the primary action. Not ready: the first missing task, as a verb. */
  readonly buttonLabel: string;
  readonly fix: CreateProjectFix | null;
  /** The review's two groups: is step 1 / step 2 still holding a server refusal? */
  readonly groupOk: { readonly info: boolean; readonly floors: boolean };
}

interface Missing {
  readonly task: string;
  readonly fix: CreateProjectFix;
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function pending(missing: readonly Missing[]): string {
  const [first] = missing;
  if (first === undefined) return '';
  return missing.length === 1
    ? `Còn 1 việc: ${first.task}`
    : `Còn ${String(missing.length)} việc, trước hết: ${first.task}`;
}

function notReady(missing: readonly Missing[], chip: CreateProjectGate['chip'], sentence?: string): Omit<CreateProjectGate, 'groupOk'> {
  const first = missing[0] ?? { task: 'quay lại sửa', fix: 'back' as const };
  return { ready: false, chip, sentence: sentence ?? pending(missing), buttonLabel: capitalise(first.task), fix: first.fix };
}

function stepInfo(p: CreateProjectModalViewProps): Omit<CreateProjectGate, 'groupOk'> {
  const missing: Missing[] = [];
  const nameBlocks = !p.canGoNext && (p.problems.name !== null || (p.problems.code === null && p.problems.address === null));
  if (nameBlocks) missing.push({ task: p.name.trim() === '' ? 'nhập tên dự án' : 'sửa tên dự án', fix: 'name' });
  if (p.problems.code !== null) missing.push({ task: 'sửa mã dự án', fix: 'code' });
  if (p.problems.address !== null) missing.push({ task: 'sửa địa chỉ', fix: 'address' });
  if (missing.length > 0 && !p.canGoNext) {
    const shown = p.problems.name !== null || p.problems.code !== null || p.problems.address !== null;
    return notReady(missing, shown ? { variant: 'violation', label: 'Có ô cần sửa' } : null);
  }
  const sentence =
    p.address.trim() === '' && p.notes.trim() === ''
      ? 'Địa chỉ và ghi chú để sau cũng được.'
      : 'Thông tin công trình đã đủ để sang bước Tầng.';
  return { ready: true, chip: { variant: 'verified', label: 'Đủ thông tin' }, sentence, buttonLabel: `Tiếp: ${STEP_TITLES[1]}`, fix: null };
}

function stepFloors(p: CreateProjectModalViewProps): Omit<CreateProjectGate, 'groupOk'> {
  if (p.floorRows.length === 0) return notReady([{ task: 'thêm tầng', fix: 'addFloor' }], null);
  if (!p.canGoNext) {
    const missingHeight = p.floorRows.some((row) => row.clearHeightM === null);
    const flagged = p.collision !== null || p.floorRows.some((row) => row.problem !== null || row.nameProblem !== null);
    return notReady(
      [{ task: missingHeight ? 'nhập chiều cao các tầng' : 'sửa tầng đang báo lỗi', fix: 'floors' }],
      flagged ? { variant: 'violation', label: 'Có tầng cần sửa' } : null,
      p.floorsHint ?? undefined,
    );
  }
  return {
    ready: true,
    chip: { variant: 'verified', label: 'Đủ thông tin' },
    sentence: `${String(p.floorRows.length)} tầng, cao độ không trùng.`,
    buttonLabel: `Tiếp: ${STEP_TITLES[2]}`,
    fix: null,
  };
}

function stepReview(p: CreateProjectModalViewProps): Omit<CreateProjectGate, 'groupOk'> {
  if (p.isSubmitting) return { ready: true, chip: null, sentence: 'Đang tạo dự án…', buttonLabel: 'Tạo dự án', fix: null };
  if (!p.canSubmit) {
    const fix = p.notice?.fixStep !== undefined ? ('notice' as const) : ('back' as const);
    return notReady(
      [{ task: (p.notice?.actionLabel ?? 'quay lại sửa').toLowerCase(), fix }],
      { variant: 'violation', label: 'Chưa tạo được' },
    );
  }
  return {
    ready: true,
    chip: { variant: 'verified', label: 'Sẵn sàng tạo' },
    sentence: `Kiểm tra lần cuối ${String(p.floorRows.length)} tầng và thông tin công trình.`,
    buttonLabel: 'Tạo dự án',
    fix: null,
  };
}

export function deriveCreateProjectGate(p: CreateProjectModalViewProps): CreateProjectGate {
  const byStep = p.step === 1 ? stepInfo(p) : p.step === 2 ? stepFloors(p) : stepReview(p);
  const refusedStep = p.notice?.level === 'violation' ? p.notice.fixStep : undefined;
  return { ...byStep, groupOk: { info: refusedStep !== 1, floors: refusedStep !== 2 } };
}
