/**
 * Bộ giải Basis dựng lại không eval (`vendor/basis/`, FIX-380) phải giải RA ĐÚNG
 * TỪNG BYTE như bản `three` đóng gói — cùng tag, chỉ khác cờ `-sDYNAMIC_EXECUTION=0`.
 *
 * Giải mọi `.ktx2` mà Pascal mang theo, mọi mức mip, ở ba định dạng đích mà
 * `KTX2Loader` chọn trên phần cứng thật: ETC1 (di động), BC7 (máy bàn), RGBA32
 * (dự phòng không nén). Lệch một byte nghĩa là bản dựng lại không cùng mã nguồn.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** `KTX2Loader.TranscoderFormat` — `three/examples/jsm/loaders/KTX2Loader.js`. */
const FORMATS = { ETC1: 0, BC7: 6, RGBA32: 13 } as const;

const OLD_DIR = join('node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
const NEW_DIR = join('vendor', 'basis');
const MATERIAL_DIR = join('vendor', 'pascal', 'assets', 'material');

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
  it('giải mọi .ktx2 của Pascal ra đúng như bản cũ ở ETC1/BC7/RGBA32', async () => {
    const files = walk(MATERIAL_DIR).filter((path) => path.endsWith('.ktx2'));
    expect(files.length).toBeGreaterThan(0);

    const [before, after] = [digests(await loadBasis(OLD_DIR), files), digests(await loadBasis(NEW_DIR), files)];

    expect(before.filter((line) => line.endsWith('hỏng'))).toEqual([]);
    expect(after).toEqual(before);
  }, 120_000);
});
