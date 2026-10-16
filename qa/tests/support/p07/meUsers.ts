/**
 * Phase 07 helpers shared by the BE API packs P9 (`phase07_me_api.spec.ts`) and P10 (`phase07_me_b_api.spec.ts`).
 */
import { test } from '@playwright/test';

/** Runs registered cleanups in reverse order; a failing cleanup is annotated, never thrown over the test's error. */
export class Cleanup {
  private readonly steps: (() => Promise<unknown>)[] = [];
  add(step: () => Promise<unknown>): void {
    this.steps.push(step);
  }
  async run(): Promise<void> {
    for (const step of this.steps.reverse()) {
      try {
        await step();
      } catch (error) {
        test.info().annotations.push({ type: 'cleanup', description: String(error) });
      }
    }
  }
}

export const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};
