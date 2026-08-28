import { describe, expect, it } from 'vitest';

import * as upload from '../index';

/**
 * The barrel is the contract a screen's hook is written against — see
 * `.notes/contract-upload.md`. A symbol renamed or dropped here breaks a caller
 * that never opens the source, so the list is pinned rather than described.
 */
const EXPECTED_EXPORTS = [
  'ACCEPTED_UPLOAD_EXTENSIONS',
  'MAX_CHUNK_ATTEMPTS',
  'MAX_PARALLEL_UPLOADS',
  'MAX_PDF_PAGE_COUNT',
  'MAX_UPLOAD_FILE_SIZE_BYTES',
  'PROGRESS_EMITS_PER_SECOND',
  'PROGRESS_MIN_GAP_MS',
  'UPLOAD_CHUNK_SIZE_BYTES',
  'bytesToBinaryString',
  'countUploadChunks',
  'createSha256Hasher',
  'createUploadScheduler',
  'createUploadTask',
  'encodeBytesBase64',
  'encodeChunkBase64',
  'guessFloorFromFileName',
  'hashBlobSha256Hex',
  'isTerminalUploadError',
  'readBlobBytes',
  'readExtension',
  'readPdfPageCount',
  'runUploadQueue',
  'sha256Hex',
  'sliceIntoChunks',
  'systemUploadClock',
  'validateUploadFile',
] as const;

describe('the upload barrel', () => {
  it('exports exactly the symbols the contract promises', () => {
    expect(Object.keys(upload).sort()).toStrictEqual([...EXPECTED_EXPORTS].sort());
  });

  it('re-exports the same values the modules define', () => {
    expect(upload.UPLOAD_CHUNK_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(upload.MAX_UPLOAD_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
    expect(upload.MAX_PDF_PAGE_COUNT).toBe(20);
    expect(upload.MAX_PARALLEL_UPLOADS).toBe(3);
    expect(upload.MAX_CHUNK_ATTEMPTS).toBe(3);
    expect(upload.PROGRESS_EMITS_PER_SECOND).toBe(4);
    expect(upload.PROGRESS_MIN_GAP_MS).toBe(250);
    expect(upload.ACCEPTED_UPLOAD_EXTENSIONS).toStrictEqual(['.png', '.jpg', '.pdf', '.dwg']);
  });
});
