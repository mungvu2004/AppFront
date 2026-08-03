export type SingleFlightFn = <T>(key: string, fn: () => Promise<T>) => Promise<T>;

export type SingleFlight = SingleFlightFn & {
  clear: (key?: string) => void;
};

export const createSingleFlight = (): SingleFlight => {
  const inflight = new Map<string, Promise<unknown>>();

  const run = (async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const activeRequest = inflight.get(key) as Promise<T> | undefined;

    if (activeRequest) {
      return activeRequest;
    }

    const promise = Promise.resolve()
      .then(fn)
      .finally(() => {
        if (inflight.get(key) === promise) {
          inflight.delete(key);
        }
      });

    inflight.set(key, promise);

    return promise;
  }) as SingleFlight;

  run.clear = (key?: string): void => {
    if (key) {
      inflight.delete(key);
      return;
    }

    inflight.clear();
  };

  return run;
};

export const singleFlight = createSingleFlight();
