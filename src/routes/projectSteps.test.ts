/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { ROUTES } from './paths';
import { PROJECT_STEPS, projectLocationOf } from './projectSteps';

describe('projectLocationOf', () => {
  it.each([
    [ROUTES.project.upload('p1'), 0],
    [ROUTES.project.quality('p1'), 0],
    [ROUTES.project.pipelineGraph('p1'), 1],
    [ROUTES.project.walls('p1', 'f1'), 2],
    [ROUTES.project.scale('p1', 'f1'), 2],
    [ROUTES.project.measure('p1'), 3],
    [ROUTES.project.ruleSettings('p1'), 4],
    [ROUTES.project.versions('p1'), 5],
    [ROUTES.project.settings('p1'), -1],
  ])('%s → bước %i', (path, stepIndex) => {
    expect(projectLocationOf(path)).toEqual({ projectId: 'p1', stepIndex });
  });

  it('ngoài dự án thì không có bước', () => {
    expect(projectLocationOf(ROUTES.dashboard)).toBeNull();
    expect(projectLocationOf(ROUTES.account)).toBeNull();
  });

  it('mỗi bước trỏ về chính nó', () => {
    PROJECT_STEPS.forEach((step, index) => {
      expect(projectLocationOf(step.path('p1'))?.stepIndex).toBe(index);
    });
  });
});
