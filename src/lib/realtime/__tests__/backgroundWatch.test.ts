/**
 * Sổ theo dõi nền, kiểm không cần DOM và không cần mạng.
 *
 * Bốn điều phải đúng, và chúng là toàn bộ lý do module tồn tại:
 *
 * 1. đăng ký rồi RỜI MÀN thì dòng sự kiện KHÔNG bị huỷ — nơi gọi tự quyết định
 *    không gọi `release`, và sổ giữ hàm đó nguyên vẹn;
 * 2. lượt xong thì dòng sự kiện được nhả TRƯỚC, rồi mới báo — không có cửa sổ nào
 *    mà một nhịp nữa lọt vào sau lời báo;
 * 3. một lượt kết thúc đúng MỘT lần, kể cả khi nhịp cuối về hai lần;
 * 4. đăng ký lại cùng một lượt thì bản cũ được nhả — hai dòng sự kiện cho một
 *    lượt là rò rỉ.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  backgroundWatchRegistry,
  createBackgroundWatchRegistry,
  type BackgroundWatchEntry,
  type BackgroundWatchOutcome,
} from '../backgroundWatch';

interface Recorded {
  readonly entry: BackgroundWatchEntry;
  readonly log: string[];
  readonly outcomes: BackgroundWatchOutcome[];
}

function recordedEntry(id: string, label = 'Tầng 1'): Recorded {
  const log: string[] = [];
  const outcomes: BackgroundWatchOutcome[] = [];

  const entry: BackgroundWatchEntry = {
    id,
    label,
    release: () => {
      log.push(`release:${id}`);
    },
    onSettled: (outcome) => {
      log.push(`settled:${id}`);
      outcomes.push(outcome);
    },
  };

  return { entry, log, outcomes };
}

describe('backgroundWatch', () => {
  it('đăng ký rồi rời màn: dòng sự kiện KHÔNG bị huỷ', () => {
    const registry = createBackgroundWatchRegistry();
    const watched = recordedEntry('project-1:upload-1');

    registry.watch(watched.entry);

    // "Rời màn" ở đây chính là việc nơi gọi KHÔNG gọi gì thêm. Sổ vẫn giữ lượt,
    // và không một `release` nào được gọi.
    expect(registry.has('project-1:upload-1')).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(watched.log).toEqual([]);
  });

  it('lượt xong: nhả dòng sự kiện TRƯỚC, rồi mới gọi callback báo', () => {
    const registry = createBackgroundWatchRegistry();
    const watched = recordedEntry('project-1:upload-1');

    registry.watch(watched.entry);

    expect(registry.settle('project-1:upload-1', 'done')).toBe(true);
    expect(watched.log).toEqual(['release:project-1:upload-1', 'settled:project-1:upload-1']);
    expect(watched.outcomes).toEqual(['done']);
    expect(registry.has('project-1:upload-1')).toBe(false);
  });

  it('lượt hỏng cũng kết thúc, và mang theo kết cục "failed"', () => {
    const registry = createBackgroundWatchRegistry();
    const watched = recordedEntry('project-1:upload-2');

    registry.watch(watched.entry);
    registry.settle('project-1:upload-2', 'failed');

    expect(watched.outcomes).toEqual(['failed']);
  });

  it('nhịp cuối về hai lần: chỉ báo MỘT lần', () => {
    const registry = createBackgroundWatchRegistry();
    const watched = recordedEntry('project-1:upload-1');

    registry.watch(watched.entry);

    expect(registry.settle('project-1:upload-1', 'done')).toBe(true);
    expect(registry.settle('project-1:upload-1', 'done')).toBe(false);
    expect(watched.outcomes).toEqual(['done']);
  });

  it('lượt không đăng ký nền: settle trả false và không báo gì', () => {
    const registry = createBackgroundWatchRegistry();
    const onSettled = vi.fn();

    registry.watch({ id: 'khác', label: 'Tầng 2', release: () => undefined, onSettled });

    expect(registry.settle('project-1:upload-1', 'done')).toBe(false);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('đăng ký lại cùng một lượt: bản cũ được nhả, không có hai dòng sự kiện', () => {
    const registry = createBackgroundWatchRegistry();
    const first = recordedEntry('project-1:upload-1');
    const second = recordedEntry('project-1:upload-1', 'Tầng 1');

    registry.watch(first.entry);
    registry.watch(second.entry);

    expect(first.log).toEqual(['release:project-1:upload-1']);
    expect(registry.list()).toHaveLength(1);

    registry.settle('project-1:upload-1', 'done');

    // Bản cũ không báo lần nào; bản mới báo đúng một lần.
    expect(first.outcomes).toEqual([]);
    expect(second.outcomes).toEqual(['done']);
  });

  it('release nhả mà KHÔNG báo; releaseAll dọn sạch sổ', () => {
    const registry = createBackgroundWatchRegistry();
    const one = recordedEntry('project-1:upload-1');
    const two = recordedEntry('project-1:upload-2', 'Tầng 2');

    registry.watch(one.entry);
    registry.watch(two.entry);

    expect(registry.release('project-1:upload-1')).toBe(true);
    expect(registry.release('project-1:upload-1')).toBe(false);
    expect(one.log).toEqual(['release:project-1:upload-1']);
    expect(one.outcomes).toEqual([]);

    registry.releaseAll();

    expect(registry.list()).toEqual([]);
    expect(two.log).toEqual(['release:project-1:upload-2']);
    expect(two.outcomes).toEqual([]);
  });

  it('sổ của cả ứng dụng là một sổ thật, dùng được ngay', () => {
    const watched = recordedEntry('project-app:upload-1');

    backgroundWatchRegistry.watch(watched.entry);

    expect(backgroundWatchRegistry.has('project-app:upload-1')).toBe(true);

    backgroundWatchRegistry.settle('project-app:upload-1', 'done');

    expect(watched.outcomes).toEqual(['done']);
    expect(backgroundWatchRegistry.has('project-app:upload-1')).toBe(false);
  });
});
