export const RETRY_SCHEDULE_MS = [5_000, 15_000, 45_000] as const;

export const getRetryDelayMs = (retryAttempt: number): number | undefined => RETRY_SCHEDULE_MS[retryAttempt];
