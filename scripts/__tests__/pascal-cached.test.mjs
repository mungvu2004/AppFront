/**
 * Khoá phép băm/quyết định của `pascal-cached.mjs` — không gọi `main()` (xem khuôn
 * `check-bundle-size.mjs`), nên không lượt test nào kéo theo một lượt dựng Pascal thật.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  INPUT_PATHS,
  OUTPUT_DIRS,
  hashInputs,
  listFiles,
  outputsComplete,
  readStamp,
  shouldSkip,
  writeStamp,
} from '../pascal-cached.mjs';

let dirs = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'pascal-cached-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('listFiles', () => {
  it('đệ quy, đường dẫn đã sắp, dùng dấu /', () => {
    const root = tempDir();
    mkdirSync(join(root, 'b'), { recursive: true });
    writeFileSync(join(root, 'a.ts'), '1');
    writeFileSync(join(root, 'b', 'c.ts'), '2');

    expect(listFiles(root)).toEqual([`${root.split('\\').join('/')}/a.ts`, `${root.split('\\').join('/')}/b/c.ts`]);
  });

  it('trả về chính nó khi root là một tệp', () => {
    const root = tempDir();
    const file = join(root, 'single.ts');
    writeFileSync(file, 'nội dung');

    expect(listFiles(file)).toEqual([file.split('\\').join('/')]);
  });

  it('rỗng khi đường dẫn không tồn tại', () => {
    expect(listFiles(join(tempDir(), 'khong-co'))).toEqual([]);
  });

  it('bỏ qua thư mục node_modules — pnpm vật chất hoá nó ngay trong workspace package', () => {
    const root = tempDir();
    mkdirSync(join(root, 'node_modules', 'dep'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'dep', 'index.js'), 'phu thuoc');
    writeFileSync(join(root, 'src.ts'), 'nguon');

    expect(listFiles(root)).toEqual([`${root.split('\\').join('/')}/src.ts`]);
  });
});

describe('hashInputs', () => {
  it('đổi khi nội dung một tệp đổi', () => {
    const root = tempDir();
    const file = join(root, 'a.ts');
    writeFileSync(file, 'v1');
    const before = hashInputs([file]);

    writeFileSync(file, 'v2');
    const after = hashInputs([file]);

    expect(before).not.toBe(after);
  });

  it('đổi khi thêm một tệp mới, dù nội dung các tệp cũ giữ nguyên', () => {
    const root = tempDir();
    writeFileSync(join(root, 'a.ts'), 'v1');
    const before = hashInputs([root]);

    writeFileSync(join(root, 'b.ts'), 'v2');
    const after = hashInputs([root]);

    expect(before).not.toBe(after);
  });

  it('giống nhau cho cùng nội dung, bất kể thứ tự liệt kê đường dẫn vào', () => {
    const root = tempDir();
    writeFileSync(join(root, 'a.ts'), 'v1');
    const file = join(root, 'a.ts');

    expect(hashInputs([root])).toBe(hashInputs([file]));
  });
});

describe('outputsComplete', () => {
  it('sai nếu một đích không tồn tại', () => {
    const root = tempDir();
    expect(outputsComplete([join(root, 'khong-co')])).toBe(false);
  });

  it('sai nếu một đích tồn tại nhưng rỗng', () => {
    const root = tempDir();
    const empty = join(root, 'rong');
    mkdirSync(empty);
    expect(outputsComplete([empty])).toBe(false);
  });

  it('đúng khi mọi đích đều có ít nhất một tệp', () => {
    const root = tempDir();
    const dirA = join(root, 'a');
    const dirB = join(root, 'b');
    mkdirSync(dirA);
    mkdirSync(dirB);
    writeFileSync(join(dirA, 'x.js'), '1');
    writeFileSync(join(dirB, 'y.js'), '2');

    expect(outputsComplete([dirA, dirB])).toBe(true);
  });
});

describe('shouldSkip', () => {
  it('bỏ qua khi băm khớp và đích còn đủ', () => {
    const root = tempDir();
    const outDir = join(root, 'out');
    mkdirSync(outDir);
    writeFileSync(join(outDir, 'x.js'), '1');

    expect(shouldSkip('abc', { hash: 'abc' }, [outDir])).toBe(true);
  });

  it('không bỏ qua khi băm lệch', () => {
    const root = tempDir();
    const outDir = join(root, 'out');
    mkdirSync(outDir);
    writeFileSync(join(outDir, 'x.js'), '1');

    expect(shouldSkip('abc', { hash: 'khac' }, [outDir])).toBe(false);
  });

  it('không bỏ qua khi chưa có dấu ghi (lần chạy đầu)', () => {
    expect(shouldSkip('abc', null, [])).toBe(false);
  });

  it('không bỏ qua khi băm khớp nhưng một đích dựng rỗng/mất — vd ai đó rm -rf public', () => {
    const root = tempDir();
    const missing = join(root, 'khong-co');

    expect(shouldSkip('abc', { hash: 'abc' }, [missing])).toBe(false);
  });
});

describe('readStamp / writeStamp', () => {
  it('đọc lại đúng băm vừa ghi', () => {
    const path = join(tempDir(), 'stamp.json');
    writeStamp('mothash', path);

    expect(readStamp(path)).toEqual({ hash: 'mothash' });
  });

  it('null khi tệp dấu ghi chưa tồn tại', () => {
    expect(readStamp(join(tempDir(), 'chua-co.json'))).toBeNull();
  });

  it('null khi tệp dấu ghi hỏng (JSON không hợp lệ), không ném lỗi', () => {
    const path = join(tempDir(), 'hong.json');
    writeFileSync(path, '{khong phai json');

    expect(readStamp(path)).toBeNull();
  });

  it('tự tạo thư mục cha nếu chưa có', () => {
    const path = join(tempDir(), 'chua-ton-tai', 'stamp.json');
    writeStamp('h', path);

    expect(readStamp(path)).toEqual({ hash: 'h' });
  });
});

describe('INPUT_PATHS / OUTPUT_DIRS', () => {
  // Review PERF-01: entry Pascal nằm trong `src/` và kéo `src/lib`, `src/domain` qua import —
  // băm thiếu `src` thì sửa mã đó vẫn "băm khớp", lượt dựng bị bỏ qua và bản cũ được ship.
  it('băm phủ entry thư viện của vite.pascal.config.ts', () => {
    const config = readFileSync('vite.pascal.config.ts', 'utf8');
    const entry = /entry: path\.resolve\(__dirname, '\.\/([^']+)'\)/.exec(config)?.[1];
    expect(entry).toBeDefined();
    expect(INPUT_PATHS.some((input) => entry.startsWith(`${input}/`))).toBe(true);
  });

  it('băm phủ mọi kịch bản chép tài sản mà lượt dựng gọi tới', () => {
    expect(INPUT_PATHS).toEqual(
      expect.arrayContaining(['vendor/basis', 'scripts/copy-pascal-assets.mjs', 'scripts/copy-draco.mjs']),
    );
    expect(OUTPUT_DIRS).toContain('public/draco');
  });
});
