/** @vitest-environment node */
/**
 * #13 (A10) — mọi đường sửa từ Pascal đi qua `createPascalEditCommand` rồi
 * `dispatch` → `commit(patch, nhãn)`. Không nơi nào ghi thẳng vào store.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DIRS = ['src/components/pascal', 'src/screens/viewer/PascalViewer', 'src/lib/pascal'];

const sources = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);

    return /\.tsx?$/.test(entry.name) && !/\.(test|stories)\./.test(entry.name) ? [path] : [];
  });

const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

describe('đường sửa Pascal → commit (A10)', () => {
  it('không tệp nào của màn Pascal ghi thẳng vào store AppFront', () => {
    const offenders = DIRS.flatMap(sources).filter((path) =>
      /\buseStore\.(setState|getState\(\)\.set\w*)\b|\bdraftSlice\b/.test(read(path)),
    );

    expect(offenders).toEqual([]);
  });

  it('lượt sửa đi qua createPascalEditCommand → dispatch → commit', () => {
    const edits = read('src/screens/viewer/PascalViewer/usePascalEdits.ts');

    expect(edits).toContain("from '@/lib/pascal/fromPascal'");
    expect(edits).toMatch(/dispatch\(built\.data, deps\)/);
    expect(edits).toMatch(/commit\(patches, label\.current\)/);
  });

  it('src/lib/pascal không chạm store (tầng thuần)', () => {
    const offenders = sources('src/lib/pascal').filter((path) =>
      /from '@\/store/.test(read(path)),
    );

    expect(offenders).toEqual([]);
  });
});
