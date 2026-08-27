/**
 * Cutting a drawing into the pieces the API accepts, and fingerprinting it.
 *
 * A survey scan is routinely tens of megabytes, and the upload endpoint takes
 * one piece per request (`drawings.sendChunk`). Every decision about *how* that
 * file is taken apart lives here, once:
 *
 * - **How big a piece is.** {@link UPLOAD_CHUNK_SIZE_BYTES} is the only place
 *   the number 5 MiB is written down. A screen that retypes it drifts the day
 *   the server changes its limit, and the drift shows up as a rejected upload
 *   rather than as a failing test.
 * - **How a piece goes on the wire.** `SendDrawingChunkInput.body.chunk` is a
 *   `string`, so the bytes travel as base64. {@link encodeChunkBase64} is the
 *   encoder, and it works in blocks because `String.fromCharCode(...bytes)` on
 *   a five megabyte array overflows the call stack.
 * - **How the file is fingerprinted.** {@link hashBlobSha256Hex} walks the same
 *   chunks the upload walks and never holds more than one of them, so a 100 MB
 *   drawing is hashed in 5 MB of memory rather than 100.
 *
 * ## Why the hash has two paths
 *
 * WebCrypto has no streaming digest: `crypto.subtle.digest` takes the whole
 * message at once and offers no `update()` to feed it a chunk at a time. That
 * is a straight choice between the platform primitive and bounded memory, and
 * this module refuses to pick one of them:
 *
 * - A file that fits in a single chunk is already whole in memory, so it goes
 *   to `crypto.subtle.digest` as it stands.
 * - A larger file — and any runtime with no `crypto.subtle` at all, which is
 *   what a page served over plain `http://` gets — is folded block by block
 *   through {@link createSha256Hasher}, an incremental SHA-256 whose only job
 *   is to produce exactly what `crypto.subtle` would have produced. The tests
 *   pin that: every vector is asserted against both paths.
 *
 * Nothing here reads a `File` through `blob.arrayBuffer()` without checking for
 * it first. jsdom's `Blob` has `slice` and nothing else, and Safari shipped
 * `Blob.arrayBuffer` late; {@link readBlobBytes} falls back to `FileReader`,
 * which every one of them has.
 */

/**
 * How many bytes travel in one `drawings.sendChunk` call: 5 MiB.
 *
 * The one and only home of this number. Ask for it; do not retype it.
 */
export const UPLOAD_CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

/** One piece of a file, in the order it goes on the wire. */
export interface UploadChunk {
  /** Position in the sequence, from `0`. This is `body.chunkIndex`. */
  readonly index: number;
  /** First byte of the file this piece carries, inclusive. */
  readonly byteStart: number;
  /** One past the last byte this piece carries, exclusive. */
  readonly byteEnd: number;
  /** The bytes themselves, still lazy — a `Blob` slice reads nothing yet. */
  readonly blob: Blob;
}

/** What {@link hashBlobSha256Hex} accepts beyond the file itself. */
export interface HashBlobOptions {
  /** Bytes read per pass. Defaults to {@link UPLOAD_CHUNK_SIZE_BYTES}. */
  readonly chunkSizeBytes?: number;
  /** Abort a long hash. Throws an `AbortError` at the next chunk boundary. */
  readonly signal?: AbortSignal;
}

/** An incremental SHA-256, fed one piece at a time. */
export interface Sha256Hasher {
  /** Fold more bytes in. May be called any number of times, including none. */
  readonly update: (bytes: Uint8Array) => void;
  /** Close the hash and read it as lowercase hex. Call once. */
  readonly digestHex: () => string;
}

/** Bytes turned into text in blocks of this size, to stay off the call stack. */
const STRING_BUILD_BLOCK_BYTES = 0x8000;

/** SHA-256 works on 64-byte blocks. */
const SHA256_BLOCK_BYTES = 64;

/** Bytes of padding a final block needs beyond the message and the 0x80 mark. */
const SHA256_LENGTH_FIELD_BYTES = 8;

/** The eight initial hash words of SHA-256 (FIPS 180-4 §5.3.3). */
const SHA256_INITIAL_STATE = Uint32Array.from([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/** The sixty-four round constants of SHA-256 (FIPS 180-4 §4.2.2). */
const SHA256_ROUND_CONSTANTS = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Hex digits, so a digest word never goes through `toString(16)` and a pad. */
const HEX_DIGITS = '0123456789abcdef';

/** One 32-bit rotation, the only primitive SHA-256 needs beyond xor and add. */
const rotateRight = (word: number, bits: number): number =>
  ((word >>> bits) | (word << (32 - bits))) >>> 0;

/**
 * Cut a file into ordered pieces. The last piece is short whenever the size is
 * not a multiple of `chunkSizeBytes`; an empty file yields no pieces at all.
 *
 * Nothing is read here — `Blob.slice` is a view, so slicing a 100 MB file costs
 * nothing until {@link readBlobBytes} is called on one of the pieces.
 *
 * @example
 * const chunks = sliceIntoChunks(file);
 * const body = { chunk: await encodeChunkBase64(chunks[0].blob), chunkIndex: 0 };
 */
export function sliceIntoChunks(
  source: Blob,
  chunkSizeBytes: number = UPLOAD_CHUNK_SIZE_BYTES,
): UploadChunk[] {
  assertChunkSize(chunkSizeBytes);

  const chunks: UploadChunk[] = [];

  for (let byteStart = 0; byteStart < source.size; byteStart += chunkSizeBytes) {
    const byteEnd = Math.min(byteStart + chunkSizeBytes, source.size);

    chunks.push({
      blob: source.slice(byteStart, byteEnd),
      byteEnd,
      byteStart,
      index: chunks.length,
    });
  }

  return chunks;
}

/**
 * How many pieces a file of this size takes, without slicing it.
 *
 * @example
 * countUploadChunks(12_582_912)   // 3
 * countUploadChunks(0)            // 0
 */
export function countUploadChunks(
  sizeBytes: number,
  chunkSizeBytes: number = UPLOAD_CHUNK_SIZE_BYTES,
): number {
  assertChunkSize(chunkSizeBytes);

  return sizeBytes <= 0 ? 0 : Math.ceil(sizeBytes / chunkSizeBytes);
}

/**
 * Read a blob's bytes, whichever way this runtime offers.
 *
 * `Blob.arrayBuffer` where it exists, `FileReader` where it does not — jsdom
 * and older Safari are the two that do not.
 *
 * @example
 * const bytes = await readBlobBytes(chunk.blob);
 */
export async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (): void => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = (): void => {
      reject(reader.error ?? new Error('Không đọc được tệp.'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Bytes as one character per byte — the latin-1 reading of a buffer.
 *
 * Built in blocks because `String.fromCharCode(...bytes)` spreads every byte
 * into an argument list, and a five megabyte spread overflows the stack. It is
 * exported because two callers need it: base64 encoding here, and the PDF token
 * scan in `./validate`, which searches raw bytes for `/Type /Page`.
 *
 * @example
 * bytesToBinaryString(new Uint8Array([37, 80, 68, 70]))   // "%PDF"
 */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let text = '';

  for (let offset = 0; offset < bytes.length; offset += STRING_BUILD_BLOCK_BYTES) {
    const block = bytes.subarray(offset, offset + STRING_BUILD_BLOCK_BYTES);

    text += String.fromCharCode(...block);
  }

  return text;
}

/**
 * Base64 for a buffer already in hand.
 *
 * @example
 * encodeBytesBase64(new Uint8Array([104, 105]))   // "aGk="
 */
export function encodeBytesBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes));
}

/**
 * Base64 for one chunk, which is what `body.chunk` carries.
 *
 * @example
 * const chunk = await encodeChunkBase64(chunks[2].blob);
 */
export async function encodeChunkBase64(blob: Blob): Promise<string> {
  return encodeBytesBase64(await readBlobBytes(blob));
}

/**
 * An incremental SHA-256.
 *
 * The streaming half of this module's hashing story — see the file comment for
 * why it exists next to `crypto.subtle`. Feed it any number of buffers of any
 * size; the digest is that of their concatenation.
 *
 * The non-null assertions inside are on fixed-size typed arrays indexed by a
 * loop bounded by that same size. `noUncheckedIndexedAccess` cannot see that,
 * and a `?? 0` in a compression function would be an unreachable branch
 * dressed up as a guard.
 *
 * @example
 * const hasher = createSha256Hasher();
 * hasher.update(new TextEncoder().encode('a')); hasher.digestHex();
 */
export function createSha256Hasher(): Sha256Hasher {
  const state = Uint32Array.from(SHA256_INITIAL_STATE);
  const block = new Uint8Array(SHA256_BLOCK_BYTES);
  const schedule = new Uint32Array(SHA256_BLOCK_BYTES);
  let blockLength = 0;
  let totalBytes = 0;

  const compress = (bytes: Uint8Array, from: number): void => {
    for (let word = 0; word < 16; word += 1) {
      const at = from + word * 4;

      schedule[word] =
        ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
    }

    for (let word = 16; word < 64; word += 1) {
      const before15 = schedule[word - 15]!;
      const before2 = schedule[word - 2]!;
      const s0 = (rotateRight(before15, 7) ^ rotateRight(before15, 18) ^ (before15 >>> 3)) >>> 0;
      const s1 = (rotateRight(before2, 17) ^ rotateRight(before2, 19) ^ (before2 >>> 10)) >>> 0;

      schedule[word] = (schedule[word - 16]! + s0 + schedule[word - 7]! + s1) >>> 0;
    }

    let a = state[0]!;
    let b = state[1]!;
    let c = state[2]!;
    let d = state[3]!;
    let e = state[4]!;
    let f = state[5]!;
    let g = state[6]!;
    let h = state[7]!;

    for (let round = 0; round < 64; round += 1) {
      const sigma1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const choose = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + sigma1 + choose + SHA256_ROUND_CONSTANTS[round]! + schedule[round]!) >>> 0;
      const sigma0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0]! + a) >>> 0;
    state[1] = (state[1]! + b) >>> 0;
    state[2] = (state[2]! + c) >>> 0;
    state[3] = (state[3]! + d) >>> 0;
    state[4] = (state[4]! + e) >>> 0;
    state[5] = (state[5]! + f) >>> 0;
    state[6] = (state[6]! + g) >>> 0;
    state[7] = (state[7]! + h) >>> 0;
  };

  return {
    digestHex: (): string => {
      const bitLength = totalBytes * 8;
      const roomForLength = SHA256_BLOCK_BYTES - SHA256_LENGTH_FIELD_BYTES;
      const padded = new Uint8Array(
        blockLength < roomForLength ? SHA256_BLOCK_BYTES : SHA256_BLOCK_BYTES * 2,
      );

      padded.set(block.subarray(0, blockLength));
      padded[blockLength] = 0x80;

      const lengthAt = padded.length - SHA256_LENGTH_FIELD_BYTES;
      const high = Math.floor(bitLength / 0x100000000);
      const low = bitLength >>> 0;

      padded[lengthAt] = (high >>> 24) & 0xff;
      padded[lengthAt + 1] = (high >>> 16) & 0xff;
      padded[lengthAt + 2] = (high >>> 8) & 0xff;
      padded[lengthAt + 3] = high & 0xff;
      padded[lengthAt + 4] = (low >>> 24) & 0xff;
      padded[lengthAt + 5] = (low >>> 16) & 0xff;
      padded[lengthAt + 6] = (low >>> 8) & 0xff;
      padded[lengthAt + 7] = low & 0xff;

      for (let at = 0; at < padded.length; at += SHA256_BLOCK_BYTES) {
        compress(padded, at);
      }

      return wordsToHex(state);
    },
    update: (bytes: Uint8Array): void => {
      totalBytes += bytes.length;

      let offset = 0;

      if (blockLength > 0) {
        const wanted = Math.min(SHA256_BLOCK_BYTES - blockLength, bytes.length);

        block.set(bytes.subarray(0, wanted), blockLength);
        blockLength += wanted;
        offset = wanted;

        if (blockLength < SHA256_BLOCK_BYTES) {
          return;
        }

        compress(block, 0);
        blockLength = 0;
      }

      while (offset + SHA256_BLOCK_BYTES <= bytes.length) {
        compress(bytes, offset);
        offset += SHA256_BLOCK_BYTES;
      }

      if (offset < bytes.length) {
        block.set(bytes.subarray(offset));
        blockLength = bytes.length - offset;
      }
    },
  };
}

/**
 * SHA-256 of bytes already in hand, as lowercase hex.
 *
 * Uses `crypto.subtle` where the runtime has it — a page served over plain
 * `http://` does not — and {@link createSha256Hasher} otherwise. Both produce
 * the same digest; the tests assert that on every vector.
 *
 * @example
 * await sha256Hex(new TextEncoder().encode('abc'))   // "ba7816bf…f20015ad"
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;

  if (subtle === undefined) {
    const hasher = createSha256Hasher();

    hasher.update(bytes);

    return hasher.digestHex();
  }

  return bytesToHex(new Uint8Array(await subtle.digest('SHA-256', bytes)));
}

/**
 * SHA-256 of a whole file, read one chunk at a time, as lowercase hex.
 *
 * Never holds more than `chunkSizeBytes` of the file, so a 100 MB drawing is
 * fingerprinted in 5 MB of memory. A file that fits in a single chunk is handed
 * straight to `crypto.subtle`.
 *
 * @example
 * const sha256 = await hashBlobSha256Hex(file);
 * const sha256 = await hashBlobSha256Hex(file, { signal: controller.signal });
 */
export async function hashBlobSha256Hex(
  source: Blob,
  options: HashBlobOptions = {},
): Promise<string> {
  const chunkSizeBytes = options.chunkSizeBytes ?? UPLOAD_CHUNK_SIZE_BYTES;
  const chunks = sliceIntoChunks(source, chunkSizeBytes);

  if (chunks.length <= 1) {
    const only = chunks[0];

    return sha256Hex(only === undefined ? new Uint8Array(0) : await readBlobBytes(only.blob));
  }

  const hasher = createSha256Hasher();

  for (const chunk of chunks) {
    throwIfAborted(options.signal);
    hasher.update(await readBlobBytes(chunk.blob));
  }

  return hasher.digestHex();
}

/** A bad chunk size is a programming mistake, not a person's bad file. */
function assertChunkSize(chunkSizeBytes: number): void {
  if (!Number.isInteger(chunkSizeBytes) || chunkSizeBytes <= 0) {
    throw new RangeError(
      `chunkSizeBytes phải là số nguyên dương, nhận được: ${String(chunkSizeBytes)}`,
    );
  }
}

/** The shape an abort takes everywhere in the platform: `error.name`. */
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) {
    return;
  }

  const aborted = new Error('Đã huỷ.');

  aborted.name = 'AbortError';

  throw aborted;
}

/**
 * The hash state — eight words, most significant digit first — as hex.
 *
 * Deliberately not reused for `crypto.subtle`'s answer: that arrives as a byte
 * buffer, and reading it back through `Uint32Array` would reorder every group
 * of four bytes on a little-endian machine, which is every machine this runs
 * on. {@link bytesToHex} is the one for bytes.
 */
function wordsToHex(words: Uint32Array): string {
  let hex = '';

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;

    for (let shift = 28; shift >= 0; shift -= 4) {
      hex += HEX_DIGITS[(word >>> shift) & 0xf];
    }
  }

  return hex;
}

/** A digest buffer as lowercase hex, byte order untouched. */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index]!;

    hex += HEX_DIGITS[(byte >>> 4) & 0xf];
    hex += HEX_DIGITS[byte & 0xf];
  }

  return hex;
}
