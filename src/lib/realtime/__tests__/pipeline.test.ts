import { describe, expect, it } from 'vitest';

import viMessages from '@/i18n/vi.json';

import {
  PIPELINE_STAGES,
  calculateTotalProgress,
  estimateRemainingSeconds,
  getPipelineStages,
  type PipelineProgressState,
  type PipelineStageId,
  type PipelineStageState,
} from '../pipeline';

const makeStageState = (
  id: PipelineStageId,
  overrides: Partial<Omit<PipelineStageState, 'id'>> = {},
): PipelineStageState => ({
  id,
  status: 'queued',
  ...overrides,
});

const makeProgressState = (
  stages: readonly PipelineStageState[],
  overrides: Partial<Omit<PipelineProgressState, 'stages'>> = {},
): PipelineProgressState => ({
  stages,
  ...overrides,
});

describe('PIPELINE_STAGES', () => {
  it('declares six stages with a total weight of 100 and labels from vi.json', () => {
    expect(PIPELINE_STAGES).toHaveLength(6);
    expect(PIPELINE_STAGES.map((stage) => stage.weight)).toEqual([5, 30, 20, 15, 20, 10]);
    expect(PIPELINE_STAGES.reduce((total, stage) => total + stage.weight, 0)).toBe(100);
    expect(getPipelineStages().map((stage) => stage.label)).toEqual([
      viMessages.pipeline.preprocess,
      viMessages.pipeline.wallSegmentation,
      viMessages.pipeline.openingAndFurnitureDetection,
      viMessages.pipeline.dimensionReading,
      viMessages.pipeline.spatialDataBuild,
      viMessages.pipeline.qualityCheck,
    ]);
  });
});

describe('calculateTotalProgress', () => {
  it('returns 55 when the first three stages are done', () => {
    const progress = calculateTotalProgress(
      makeProgressState([
        makeStageState('preprocess', { status: 'done' }),
        makeStageState('wallSegmentation', { status: 'done' }),
        makeStageState('openingAndFurnitureDetection', { status: 'done' }),
      ]),
    );

    expect(progress).toBe(55);
  });

  it('counts a running stage by internal percent multiplied by weight', () => {
    const progress = calculateTotalProgress(
      makeProgressState([
        makeStageState('preprocess', { status: 'done' }),
        makeStageState('wallSegmentation', { internalPercent: 50, status: 'running' }),
      ]),
    );

    expect(progress).toBe(20);
  });

  it('does not decrease when a late event has lower progress', () => {
    const progress = calculateTotalProgress(
      makeProgressState(
        [
          makeStageState('preprocess', { status: 'done' }),
          makeStageState('wallSegmentation', { internalPercent: 20, status: 'running' }),
        ],
        { highestProgressReached: 55 },
      ),
    );

    expect(progress).toBe(55);
  });

  it('allows progress to return to 0 when the whole process restarts', () => {
    const progress = calculateTotalProgress(
      makeProgressState([makeStageState('preprocess', { internalPercent: 0, status: 'running' })], {
        highestProgressReached: 55,
        restarted: true,
      }),
    );

    expect(progress).toBe(0);
  });

  it('does not return 100 until every stage is done', () => {
    const unfinished = calculateTotalProgress(
      makeProgressState([
        makeStageState('preprocess', { status: 'done' }),
        makeStageState('wallSegmentation', { status: 'done' }),
        makeStageState('openingAndFurnitureDetection', { status: 'done' }),
        makeStageState('dimensionReading', { status: 'done' }),
        makeStageState('spatialDataBuild', { status: 'done' }),
        makeStageState('qualityCheck', { internalPercent: 100, status: 'running' }),
      ]),
    );
    const done = calculateTotalProgress(
      makeProgressState([
        makeStageState('preprocess', { status: 'done' }),
        makeStageState('wallSegmentation', { status: 'done' }),
        makeStageState('openingAndFurnitureDetection', { status: 'done' }),
        makeStageState('dimensionReading', { status: 'done' }),
        makeStageState('spatialDataBuild', { status: 'done' }),
        makeStageState('qualityCheck', { status: 'done' }),
      ]),
    );

    expect(unfinished).toBe(99);
    expect(done).toBe(100);
  });
});

describe('estimateRemainingSeconds', () => {
  it('returns null when fewer than three stages have rate data', () => {
    const eta = estimateRemainingSeconds(
      makeProgressState([
        makeStageState('preprocess', { finishedAtMs: 1_000, startedAtMs: 0, status: 'done' }),
        makeStageState('wallSegmentation', { finishedAtMs: 4_000, startedAtMs: 1_000, status: 'done' }),
      ]),
    );

    expect(eta).toBeNull();
  });

  it('estimates from the moving average rate of the latest three stages', () => {
    const eta = estimateRemainingSeconds(
      makeProgressState([
        makeStageState('preprocess', { finishedAtMs: 1_000, startedAtMs: 0, status: 'done' }),
        makeStageState('wallSegmentation', { finishedAtMs: 4_000, startedAtMs: 1_000, status: 'done' }),
        makeStageState('openingAndFurnitureDetection', {
          finishedAtMs: 5_000,
          startedAtMs: 4_000,
          status: 'done',
        }),
        makeStageState('dimensionReading', { finishedAtMs: 6_000, startedAtMs: 5_000, status: 'done' }),
      ]),
    );

    expect(eta).toBe(2);
  });
});
