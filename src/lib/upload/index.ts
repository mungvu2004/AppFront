/**
 * The upload logic layer, in one import.
 *
 * Three modules, one job each: `./chunk` cuts and fingerprints, `./validate`
 * decides what may be uploaded and which floor a name suggests, `./uploadTask`
 * drives one file through the API and limits how many run at once. Nothing here
 * touches React, the store or the network directly — the API client is injected
 * (`src/lib` may not import any of those; CLAUDE.md mục 0.4).
 *
 * The Vietnamese sentences a person reads are **not** here. Every refusal and
 * every failure comes back as tagged data carrying the numbers a sentence
 * needs, and the screen writes the sentence.
 *
 * File sizes are formatted by `@/lib/format/bytes`, which is a sibling of the
 * other formatters rather than part of this folder.
 */

export {
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
} from './chunk';
export type { HashBlobOptions, Sha256Hasher, UploadChunk } from './chunk';

export {
  ACCEPTED_UPLOAD_EXTENSIONS,
  guessFloorFromFileName,
  MAX_PDF_PAGE_COUNT,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  readExtension,
  readPdfPageCount,
  validateUploadFile,
} from './validate';
export type {
  AcceptedUploadExtension,
  FloorGuess,
  FloorGuessConfidence,
  FloorGuessHit,
  FloorGuessMiss,
  UploadAccepted,
  UploadBranch,
  UploadCandidate,
  UploadRejected,
  UploadRejection,
  UploadValidation,
} from './validate';

export {
  createUploadScheduler,
  createUploadTask,
  isTerminalUploadError,
  MAX_CHUNK_ATTEMPTS,
  MAX_PARALLEL_UPLOADS,
  PROGRESS_EMITS_PER_SECOND,
  PROGRESS_MIN_GAP_MS,
  runUploadQueue,
  systemUploadClock,
} from './uploadTask';
export type {
  CreateUploadSchedulerOptions,
  CreateUploadTaskOptions,
  UploadClock,
  UploadFailure,
  UploadFile,
  UploadScheduler,
  UploadStage,
  UploadTask,
  UploadTaskState,
  UploadTaskStatus,
  UploadTimerHandle,
} from './uploadTask';
