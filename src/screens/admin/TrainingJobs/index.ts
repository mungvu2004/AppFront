/**
 * `/admin/training/jobs` — lượt huấn luyện và bộ dữ liệu (F-12). Đường nhập duy nhất của thư
 * mục; `src/routes/router.tsx` nạp lười {@link TrainingJobsRoute}.
 */

export { TrainingJobs } from './TrainingJobs';
export { TrainingJobsContainer, TrainingJobsRoute } from './TrainingJobs.container';
export type { TrainingJobsContainerProps } from './TrainingJobs.container';
export { canManageTraining, createTrainingJobsGateway } from './trainingJobsGateway';
export type { TrainingJobsGateway } from './trainingJobsGateway';
export { COLLAPSE_BREAKPOINT_PX, useTrainingJobs } from './useTrainingJobs';
export type { TrainingJobsResult, UseTrainingJobsOptions } from './useTrainingJobs';
export type { TrainingJobsActions, TrainingJobsProps, TrainingJobsViewModel } from './types';
