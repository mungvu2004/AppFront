export type PipelineStatus = 'queued' | 'running' | 'done' | 'failed';

export interface PipelineStep {
  id: string;
  name: string;
  status: PipelineStatus;
  progress: number; // 0 to 100
  eta_seconds?: number;
}
