/**
 * Bộ giải Basis dựng lại không eval (`vendor/basis/`, FIX-380) phải giải RA ĐÚNG
 * TỪNG BYTE như bản `three` đóng gói — cùng tag, chỉ khác cờ `-sDYNAMIC_EXECUTION=0`.
 *
 * Giải mọi `.ktx2` mà Pascal mang theo, mọi mức mip, ở ba định dạng đích mà
 * `KTX2Loader` chọn trên phần cứng thật: ETC1 (di động), BC7 (máy bàn), RGBA32
 * (dự phòng không nén). Lệch một byte nghĩa là bản dựng lại không cùng mã nguồn.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** `KTX2Loader.TranscoderFormat` — `three/examples/jsm/loaders/KTX2Loader.js`. */
const FORMATS = { ETC1: 0, BC7: 6, RGBA32: 13 } as const;

const OLD_DIR = join('node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
const NEW_DIR = join('vendor', 'basis');
const MATERIAL_DIR = join('vendor', 'pascal', 'assets', 'material');

/**
 * sha256 của bộ giải `three@0.186.0` mà `vendor/basis` được dựng lại từ đó —
 * bảng "sha256" của `vendor/basis/NGUON.md`. Lệch nghĩa là `three` đã đổi bộ giải.
 */
const OLD_SHA256 = {
  'basis_transcoder.js': '8478b5b6d6b74e7d3082b89f6417321d8d1dc0307f2b30d4484bb11b441696a1',
  'basis_transcoder.wasm': '6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a',
} as const;

const sha256Of = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

interface Ktx2File {
  isValid(): boolean;
  getLevels(): number;
  startTranscoding(): boolean;
  getImageTranscodedSizeInBytes(level: number, layer: number, face: number, format: number): number;
  transcodeImage(dst: Uint8Array, level: number, layer: number, face: number, format: number, ...rest: number[]): number;
  close(): void;
  delete(): void;
}

interface BasisModule {
  initializeBasis(): void;
  KTX2File: new (data: Uint8Array) => Ktx2File;
}

/**
 * Nạp một bản giải. Tệp `.js` là CommonJS mà repo là `"type": "module"`, nên
 * chép nó ra `.cjs` tạm rồi `require` — không dựng mã từ chuỗi.
 */
async function loadBasis(dir: string): Promise<BasisModule> {
  const scratch = mkdtempSync(join(tmpdir(), 'basis-'));
  const script = join(scratch, 'basis_transcoder.cjs');
  copyFileSync(join(dir, 'basis_transcoder.js'), script);

  const factory = createRequire(import.meta.url)(script) as (m: object) => Promise<BasisModule>;
  rmSync(scratch, { recursive: true, force: true });
  const basis = await factory({ wasmBinary: readFileSync(join(dir, 'basis_transcoder.wasm')) });
  basis.initializeBasis();

  return basis;
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** sha256 của mỗi (tệp, định dạng, mức mip) — hoặc `hỏng` nếu bản giải từ chối. */
function digests(basis: BasisModule, files: readonly string[]): string[] {
  const out: string[] = [];

  for (const path of files) {
    for (const [name, format] of Object.entries(FORMATS)) {
      const ktx2 = new basis.KTX2File(new Uint8Array(readFileSync(path)));

      if (!ktx2.isValid() || !ktx2.startTranscoding()) {
        out.push(`${path} ${name} hỏng`);
      } else {
        for (let level = 0; level < ktx2.getLevels(); level += 1) {
          const dst = new Uint8Array(ktx2.getImageTranscodedSizeInBytes(level, 0, 0, format));
          const ok = ktx2.transcodeImage(dst, level, 0, 0, format, 0, -1, -1);
          out.push(`${path} ${name} ${String(level)} ${ok ? createHash('sha256').update(dst).digest('hex') : 'hỏng'}`);
        }
      }

      ktx2.close();
      ktx2.delete();
    }
  }

  return out;
}

describe('bộ giải Basis không eval — so khớp từng byte với bản three', () => {
  it.each(Object.entries(OLD_SHA256))('bộ giải của three vẫn là bản vendor/basis được dựng từ: %s', (name, sha) => {
    expect(
      sha256Of(join(OLD_DIR, name)),
      'three đã đổi bộ giải Basis — dựng lại vendor/basis theo vendor/basis/NGUON.md mục "Dựng lại", ' +
        'rồi cập nhật OLD_SHA256 và bảng sha256 của NGUON.md',
    ).toBe(sha);
  });

  it('giải mọi .ktx2 của Pascal ra đúng như bản cũ ở ETC1/BC7/RGBA32', async () => {
    const files = walk(MATERIAL_DIR).filter((path) => path.endsWith('.ktx2'));
    expect(files.length).toBeGreaterThan(0);

    const [before, after] = [digests(await loadBasis(OLD_DIR), files), digests(await loadBasis(NEW_DIR), files)];

    expect(before.filter((line) => line.endsWith('hỏng'))).toEqual([]);
    expect(after).toEqual(before);
  }, 120_000);
});
