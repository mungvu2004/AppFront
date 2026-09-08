/**
 * Ba hàm nhớ kết quả mà mọi selector dùng chung.
 *
 * Chúng ở riêng một file vì `src/store/selectors.ts` đã tách làm hai: phần đọc
 * đồ thị (`./graphSelectors.ts`) và phần chạy bộ luật (`./selectors.ts`). Cả hai
 * cần đúng ba hàm này; để chúng ở một trong hai bên thì bên kia phải nhập bên
 * này, và cái vòng ấy chính là thứ khiến một màn chỉ đọc hình học vẫn kéo theo
 * cả engine luật.
 *
 * Không có gì ở đây biết store là gì: chỉ là so sánh nông và một ô nhớ.
 */

/** Caches the latest call; the same inputs return the same result untouched. */
export const memoizeLatest = <TArgs extends readonly unknown[], TResult>(
  compute: (...args: TArgs) => TResult,
): ((...args: TArgs) => TResult) => {
  let cachedArgs: TArgs | null = null;
  let cachedResult: TResult;

  return (...args: TArgs): TResult => {
    const previousArgs = cachedArgs;

    if (
      previousArgs !== null &&
      previousArgs.length === args.length &&
      args.every((arg, index) => Object.is(arg, previousArgs[index]))
    ) {
      return cachedResult;
    }

    cachedArgs = args;
    cachedResult = compute(...args);

    return cachedResult;
  };
};

/** Keeps the previous array when the fresh one is shallow-equal to it. */
export const keepIfShallowEqualArray = <TItem>(
  previous: readonly TItem[] | null,
  next: readonly TItem[],
): readonly TItem[] => {
  if (previous === null || previous.length !== next.length) {
    return next;
  }

  return next.every((item, index) => Object.is(item, previous[index])) ? previous : next;
};

/** Keeps the previous record when the fresh one matches it field by field. */
export const keepIfShallowEqualRecord = <TValue>(
  previous: Readonly<Record<string, TValue>> | null,
  next: Readonly<Record<string, TValue>>,
): Readonly<Record<string, TValue>> => {
  if (previous === null) {
    return next;
  }

  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);

  if (previousKeys.length !== nextKeys.length) {
    return next;
  }

  return nextKeys.every((key) => Object.is(previous[key], next[key])) ? previous : next;
};
