import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bytesToBinaryString,
  countUploadChunks,
  createSha256Hasher,
  encodeBytesBase64,
  encodeChunkBase64,
  hashBlobSha256Hex,
  readBlobBytes,
  sha256Hex,
  sliceIntoChunks,
  UPLOAD_CHUNK_SIZE_BYTES,
} from '../chunk';

/** The three vectors FIPS 180-4 and every SHA-256 implementation agree on. */
const KNOWN_DIGESTS: ReadonlyArray<readonly [string, string]> = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    'The quick brown fox jumps over the lazy dog',
    'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
  ],
];

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Bytes `0..255` repeating, so a chunk boundary in the wrong place shows up. */
const rampBytes = (length: number): Uint8Array =>
  Uint8Array.from({ length }, (_unused, index) => index % 256);

const blobOf = (bytes: Uint8Array): Blob => new Blob([bytes]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sliceIntoChunks', () => {
  it('cuts a file into whole chunks when the size divides exactly', () => {
    const chunks = sliceIntoChunks(blobOf(rampBytes(12)), 4);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => [chunk.index, chunk.byteStart, chunk.byteEnd])).toStrictEqual([
      [0, 0, 4],
      [1, 4, 8],
      [2, 8, 12],
    ]);
    expect(chunks.every((chunk) => chunk.blob.size === 4)).toBe(true);
  });

  it('leaves the last chunk short when the size does not divide', () => {
    const chunks = sliceIntoChunks(blobOf(rampBytes(10)), 4);

    expect(chunks).toHaveLength(3);
    expect(chunks[2]?.byteStart).toBe(8);
    expect(chunks[2]?.byteEnd).toBe(10);
    expect(chunks[2]?.blob.size).toBe(2);
  });

  it('gives an empty file no chunks at all', () => {
    expect(sliceIntoChunks(blobOf(new Uint8Array(0)), 4)).toStrictEqual([]);
  });

  it('gives a file smaller than one chunk a single short chunk', () => {
    const chunks = sliceIntoChunks(blobOf(rampBytes(3)), 4);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.byteEnd).toBe(3);
  });

  it('defaults to the one chunk size the project has', () => {
    expect(UPLOAD_CHUNK_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(sliceIntoChunks(blobOf(rampBytes(8)))).toHaveLength(1);
  });

  it('refuses a chunk size that is not a positive integer', () => {
    expect(() => sliceIntoChunks(blobOf(rampBytes(8)), 0)).toThrow(RangeError);
    expect(() => sliceIntoChunks(blobOf(rampBytes(8)), 2.5)).toThrow(RangeError);
  });
});

describe('countUploadChunks', () => {
  it('counts without slicing, and rounds the short last chunk up', () => {
    expect(countUploadChunks(0, 4)).toBe(0);
    expect(countUploadChunks(1, 4)).toBe(1);
    expect(countUploadChunks(8, 4)).toBe(2);
    expect(countUploadChunks(9, 4)).toBe(3);
  });

  it('uses the project chunk size by default', () => {
    expect(countUploadChunks(UPLOAD_CHUNK_SIZE_BYTES * 2)).toBe(2);
  });

  it('refuses a chunk size that is not a positive integer', () => {
    expect(() => countUploadChunks(8, -1)).toThrow(RangeError);
  });
});

describe('readBlobBytes', () => {
  it('reads a blob through FileReader when the runtime has no Blob.arrayBuffer', async () => {
    expect(typeof Blob.prototype.arrayBuffer).not.toBe('function');

    const read = await readBlobBytes(blobOf(encode('xin chào')));

    expect(Array.from(read)).toStrictEqual(Array.from(encode('xin chào')));
  });

  it('reads a blob through Blob.arrayBuffer when the runtime has it', async () => {
    const bytes = encode('có arrayBuffer');
    const fake = {
      arrayBuffer: async (): Promise<ArrayBuffer> => bytes.slice().buffer,
      size: bytes.length,
    } as unknown as Blob;

    const read = await readBlobBytes(fake);

    expect(Array.from(read)).toStrictEqual(Array.from(bytes));
  });

  it('rejects when the reader fails', async () => {
    class FailingReader {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      readonly error = new Error('ổ đĩa hỏng');
      readonly result: ArrayBuffer | null = null;

      readAsArrayBuffer(): void {
        this.onerror?.();
      }
    }

    vi.stubGlobal('FileReader', FailingReader);

    await expect(readBlobBytes(blobOf(encode('a')))).rejects.toThrow('ổ đĩa hỏng');
  });

  it('rejects with a written reason when the reader reports no error object', async () => {
    class SilentReader {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      readonly error = null;
      readonly result: ArrayBuffer | null = null;

      readAsArrayBuffer(): void {
        this.onerror?.();
      }
    }

    vi.stubGlobal('FileReader', SilentReader);

    await expect(readBlobBytes(blobOf(encode('a')))).rejects.toThrow('Không đọc được tệp.');
  });
});

describe('base64', () => {
  it('encodes bytes the way body.chunk wants them', () => {
    expect(encodeBytesBase64(encode('hi'))).toBe('aGk=');
    expect(encodeBytesBase64(new Uint8Array(0))).toBe('');
  });

  it('encodes a chunk read from a blob', async () => {
    const chunks = sliceIntoChunks(blobOf(encode('xinchao')), 3);

    await expect(encodeChunkBase64(chunks[0]!.blob)).resolves.toBe(btoa('xin'));
    await expect(encodeChunkBase64(chunks[2]!.blob)).resolves.toBe(btoa('o'));
  });

  it('encodes a buffer larger than one fromCharCode block without overflowing', () => {
    const bytes = rampBytes(0x8000 * 2 + 7);

    expect(encodeBytesBase64(bytes)).toBe(btoa(bytesToBinaryString(bytes)));
  });
});

describe('bytesToBinaryString', () => {
  it('reads each byte as one character', () => {
    expect(bytesToBinaryString(Uint8Array.from([37, 80, 68, 70]))).toBe('%PDF');
  });
});

describe('sha256Hex', () => {
  it.each(KNOWN_DIGESTS)('matches the published digest for %o', async (text, digest) => {
    await expect(sha256Hex(encode(text))).resolves.toBe(digest);
  });

  it.each(KNOWN_DIGESTS)(
    'matches the published digest for %o without crypto.subtle',
    async (text, digest) => {
      vi.stubGlobal('crypto', {});

      await expect(sha256Hex(encode(text))).resolves.toBe(digest);
    },
  );
});

describe('createSha256Hasher', () => {
  it('gives the same digest however the bytes are split', async () => {
    const bytes = rampBytes(1000);
    const whole = await sha256Hex(bytes);

    for (const step of [1, 7, 64, 65, 128, 999]) {
      const hasher = createSha256Hasher();

      for (let at = 0; at < bytes.length; at += step) {
        hasher.update(bytes.subarray(at, at + step));
      }

      expect(hasher.digestHex()).toBe(whole);
    }
  });

  it('pads into a second block when the tail leaves no room for the length', async () => {
    for (const length of [55, 56, 57, 63, 64, 65]) {
      const bytes = rampBytes(length);
      const hasher = createSha256Hasher();

      hasher.update(bytes);

      expect(hasher.digestHex()).toBe(await sha256Hex(bytes));
    }
  });
});

describe('hashBlobSha256Hex', () => {
  it('hashes a file that fits in one chunk', async () => {
    await expect(hashBlobSha256Hex(blobOf(encode('abc')), { chunkSizeBytes: 1024 })).resolves.toBe(
      KNOWN_DIGESTS[1]![1],
    );
  });

  it('hashes an empty file', async () => {
    await expect(hashBlobSha256Hex(blobOf(new Uint8Array(0)))).resolves.toBe(KNOWN_DIGESTS[0]![1]);
  });

  it('hashes a file spanning many chunks without reading it whole', async () => {
    const bytes = rampBytes(1000);

    await expect(hashBlobSha256Hex(blobOf(bytes), { chunkSizeBytes: 64 })).resolves.toBe(
      await sha256Hex(bytes),
    );
  });

  it('stops at a chunk boundary when the signal is already aborted', async () => {
    const controller = new AbortController();

    controller.abort();

    await expect(
      hashBlobSha256Hex(blobOf(rampBytes(1000)), { chunkSizeBytes: 64, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('finishes a single-chunk file even with an aborted signal, having read nothing extra', async () => {
    const controller = new AbortController();

    controller.abort();

    await expect(
      hashBlobSha256Hex(blobOf(encode('abc')), { chunkSizeBytes: 64, signal: controller.signal }),
    ).resolves.toBe(KNOWN_DIGESTS[1]![1]);
  });
});
