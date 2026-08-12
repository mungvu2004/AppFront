import viMessages from '@/i18n/vi.json';

const PIPELINE_STAGE_IDS = [
  'preprocess',
  'wallSegmentation',
  'openingAndFurnitureDetection',
  'dimensionReading',
  'spatialDataBuild',
  'qualityCheck',
] as const;

type PipelineStageLabelKey =
  | 'preprocess'
  | 'wallSegmentation'
  | 'openingAndFurnitureDetection'
  | 'dimensionReading'
  | 'spatialDataBuild'
  | 'qualityCheck';

export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];

export type PipelineStageStatus = 'queued' | 'running' | 'done' | 'failed';

export interface PipelineStageDefinition {
  id: PipelineStageId;
  labelKey: PipelineStageLabelKey;
  weight: number;
}

export interface PipelineStage extends PipelineStageDefinition {
  label: string;
}

export interface PipelineStageState {
  id: PipelineStageId;
  status: PipelineStageStatus;
  internalPercent?: number;
  startedAtMs?: number;
  finishedAtMs?: number;
}

export interface PipelineProgressState {
  stages: readonly PipelineStageState[];
  highestProgressReached?: number;
  restarted?: boolean;
}

export const PIPELINE_STAGES = [
  { id: 'preprocess', labelKey: 'preprocess', weight: 5 },
  { id: 'wallSegmentation', labelKey: 'wallSegmentation', weight: 30 },
  { id: 'openingAndFurnitureDetection', labelKey: 'openingAndFurnitureDetection', weight: 20 },
  { id: 'dimensionReading', labelKey: 'dimensionReading', weight: 15 },
  { id: 'spatialDataBuild', labelKey: 'spatialDataBuild', weight: 20 },
  { id: 'qualityCheck', labelKey: 'qualityCheck', weight: 10 },
] as const satisfies readonly PipelineStageDefinition[];

const TOTAL_STAGE_WEIGHT = PIPELINE_STAGES.reduce((total, stage) => total + stage.weight, 0);

if (TOTAL_STAGE_WEIGHT !== 100) {
  throw new Error('Pipeline stage weights must total 100.');
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const createStageStateMap = (
  stages: readonly PipelineStageState[],
): Partial<Record<PipelineStageId, PipelineStageState>> =>
  stages.reduce<Partial<Record<PipelineStageId, PipelineStageState>>>((stageMap, stageState) => {
    stageMap[stageState.id] = stageState;
    return stageMap;
  }, {});

const calculateEffectivePercent = (stageState?: PipelineStageState): number => {
  if (stageState?.status === 'done') {
    return 100;
  }

  if (stageState?.status === 'queued' || stageState === undefined) {
    return 0;
  }

  return clamp(stageState.internalPercent ?? 0, 0, 100);
};

const calculateRawProgress = (stages: readonly PipelineStageState[]): number => {
  const stageStateMap = createStageStateMap(stages);

  return PIPELINE_STAGES.reduce((total, definition) => {
    const internalPercent = calculateEffectivePercent(stageStateMap[definition.id]);
    return total + (definition.weight * internalPercent) / 100;
  }, 0);
};

const areAllStagesDone = (stages: readonly PipelineStageState[]): boolean => {
  const stageStateMap = createStageStateMap(stages);

  return PIPELINE_STAGES.every((definition) => stageStateMap[definition.id]?.status === 'done');
};

const isAtInitialProgress = (stages: readonly PipelineStageState[]): boolean =>
  PIPELINE_STAGES.every((definition) => {
    const stageState = stages.find((item) => item.id === definition.id);
    return calculateEffectivePercent(stageState) === 0;
  });

export function getPipelineStages(): PipelineStage[] {
  return PIPELINE_STAGES.map((stage) => ({
    ...stage,
    label: viMessages.pipeline[stage.labelKey],
  }));
}

export function calculateTotalProgress(progressState: PipelineProgressState): number {
  const rawProgress = calculateRawProgress(progressState.stages);
  const flooredProgress = Math.floor(clamp(rawProgress, 0, 100));
  const honestProgress = areAllStagesDone(progressState.stages) ? flooredProgress : Math.min(flooredProgress, 99);
  const highestProgressReached =
    progressState.restarted || isAtInitialProgress(progressState.stages)
      ? 0
      : clamp(progressState.highestProgressReached ?? 0, 0, 100);

  return Math.max(honestProgress, Math.floor(highestProgressReached));
}

export function estimateRemainingSeconds(progressState: PipelineProgressState): number | null {
  const stageStateMap = createStageStateMap(progressState.stages);
  const recentRates = PIPELINE_STAGES.map((definition) => {
    const stageState = stageStateMap[definition.id];

    if (
      stageState?.status !== 'done' ||
      stageState.startedAtMs === undefined ||
      stageState.finishedAtMs === undefined
    ) {
      return null;
    }

    const durationMs = stageState.finishedAtMs - stageState.startedAtMs;

    if (durationMs <= 0) {
      return null;
    }

    return {
      finishedAtMs: stageState.finishedAtMs,
      weightPerMs: definition.weight / durationMs,
    };
  })
    .filter((rate): rate is { finishedAtMs: number; weightPerMs: number } => rate !== null)
    .sort((left, right) => right.finishedAtMs - left.finishedAtMs)
    .slice(0, 3);

  if (recentRates.length < 3) {
    return null;
  }

  const averageWeightPerMs = recentRates.reduce((total, rate) => total + rate.weightPerMs, 0) / recentRates.length;

  if (averageWeightPerMs <= 0) {
    return null;
  }

  const remainingProgress = 100 - calculateRawProgress(progressState.stages);
  const remainingMs = Math.ceil(clamp(remainingProgress, 0, 100) / averageWeightPerMs);

  return Math.ceil(remainingMs / 1_000);
}
