import { describe, expect, it } from 'vitest';
import { testFilters } from '../verify-fast.mjs';

describe('testFilters — test nào cổng nhanh chạy', () => {
  it('lấy thư mục của tệp đổi, tệp trong __tests__ tính cho thư mục cha', () => {
    expect(
      testFilters(['src/lib/format/number.ts', 'src/lib/format/__tests__/number.test.ts', 'src/screens/qc/A.tsx']),
    ).toEqual(['src/lib/format/', 'src/screens/qc/']);
  });

  it('thư mục cha đã phủ thư mục con', () => {
    expect(testFilters(['src/lib/a.ts', 'src/lib/format/b.ts'])).toEqual(['src/lib/']);
  });

  it('tệp ngoài src/, eslint-rules/, scripts/ không kéo test nào', () => {
    expect(testFilters(['docs/x.md', 'README.md'])).toEqual([]);
  });

  it.each(['vitest.config.ts', 'package.json', 'pnpm-lock.yaml', 'tsconfig.pascal.json', 'src/test/setup.dom.ts'])(
    'đổi %s thì chạy cả bộ',
    (file) => {
      expect(testFilters(['src/lib/a.ts', file])).toBeNull();
    },
  );

  it('quá nhiều thư mục (dòng lệnh quá dài) thì chạy cả bộ', () => {
    const many = Array.from({ length: 400 }, (_, i) => `src/screens/s${i}/View.tsx`);
    expect(testFilters(many)).toBeNull();
  });
});
