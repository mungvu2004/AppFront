import type { AppError } from '@/lib/errors';
import type { HttpClient, HttpError, HttpRequestOptions, Result } from '@/lib/http';
import { z, type ZodTypeAny } from 'zod';
import {
  FloorSchema,
  ProgressSchema,
  ProjectSchema,
  VersionSchema,
  toFloorWirePayload,
  toProjectWirePayload,
  type Floor,
  type FloorElevationMm,
  type FloorHeightMm,
  type FloorName,
  type FloorOrder,
  type FloorPayload,
  type Progress,
  type Project,
  type ProjectPayload,
  type Version,
} from './contracts';
import { ENDPOINTS } from './endpoints';
import { decode, safeParseList } from './schemas/decode';

export type { Drawing, Floor, Progress, Project, User, Version } from './contracts';

export type ApiError = HttpError | AppError;
export type ApiResult<T> = Result<T, ApiError>;

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface WriteRequestOptions extends RequestOptions {
  idempotencyKey?: string;
}

export interface ProjectWriteBody extends Omit<ProjectPayload, 'name'> {
  name: string;
}

export interface CreateProjectInput extends WriteRequestOptions {
  body: ProjectWriteBody;
}

export interface UpdateProjectInput extends WriteRequestOptions {
  body: Partial<ProjectWriteBody>;
  projectId: string;
}

export interface DeleteProjectInput extends WriteRequestOptions {
  projectId: string;
}

export interface ReadProjectInput extends RequestOptions {
  projectId: string;
}

export interface FloorWriteBody extends Omit<FloorPayload, 'elevationMm' | 'heightMm' | 'name' | 'order'> {
  elevationMm: FloorElevationMm;
  heightMm: FloorHeightMm;
  name: FloorName;
  order: FloorOrder;
}

export interface CreateFloorInput extends WriteRequestOptions {
  body: FloorWriteBody;
}

export interface ReorderFloorsInput extends WriteRequestOptions {
  body: {
    floorIds: string[];
  };
}

export interface DeleteFloorInput extends WriteRequestOptions {
  floorId: string;
}

export interface InitDrawingUploadInput extends WriteRequestOptions {
  body: {
    fileName: string;
    floorId: string;
    mimeType: string;
    projectId: string;
    sizeBytes: number;
  };
}

export interface SendDrawingChunkInput extends WriteRequestOptions {
  body: {
    chunk: string;
    chunkIndex: number;
  };
  projectId: string;
  uploadId: string;
}

export interface CompleteDrawingUploadInput extends WriteRequestOptions {
  body: {
    uploadId: string;
  };
  projectId: string;
}

export interface ReadDrawingProgressInput extends RequestOptions {
  projectId: string;
  uploadId: string;
}

export interface ReadSpatialFloorInput extends RequestOptions {
  floorId: string;
  projectId: string;
}

export interface PatchSpatialFloorInput extends WriteRequestOptions {
  body: Partial<FloorWriteBody>;
  floorId: string;
  projectId: string;
}

export interface ReadSpatialVersionInput extends RequestOptions {
  projectId: string;
  versionId: string;
}

export interface ProjectsApi {
  create(input: CreateProjectInput): Promise<ApiResult<Project>>;
  delete(input: DeleteProjectInput): Promise<ApiResult<Project>>;
  list(options?: RequestOptions): Promise<ApiResult<Project[]>>;
  read(input: ReadProjectInput): Promise<ApiResult<Project>>;
  update(input: UpdateProjectInput): Promise<ApiResult<Project>>;
}

/**
 * Which heavy features are on for the person holding this session.
 *
 * The one read in this file that is deliberately **not** decoded with a schema.
 * Every other endpoint models a resource where a field of the wrong type means
 * the answer is unusable; a flag payload is a bag of independent switches, and
 * `decode` would turn one unknown flag — a sixth flag rolled out by a newer
 * server — into zero flags for a client that understood the other five.
 *
 * So the body travels as `unknown` to `parseFeatureFlagPayload` in
 * `src/lib/telemetry/flags.ts`, which drops bad entries one at a time and
 * leaves each surviving flag on the table's default. The `Result` envelope is
 * understood there too, so a failed request can be handed over as-is.
 */
export interface FeatureFlagsApi {
  read(options?: RequestOptions): Promise<ApiResult<unknown>>;
}

export interface FloorsApi {
  create(input: CreateFloorInput): Promise<ApiResult<Floor>>;
  delete(input: DeleteFloorInput): Promise<ApiResult<Floor>>;
  list(options?: RequestOptions): Promise<ApiResult<Floor[]>>;
  reorder(input: ReorderFloorsInput): Promise<ApiResult<Floor[]>>;
}

export interface DrawingsApi {
  complete(input: CompleteDrawingUploadInput): Promise<ApiResult<Progress>>;
  initUpload(input: InitDrawingUploadInput): Promise<ApiResult<Progress>>;
  progress(input: ReadDrawingProgressInput): Promise<ApiResult<Progress>>;
  sendChunk(input: SendDrawingChunkInput): Promise<ApiResult<Progress>>;
}

export interface SpatialApi {
  patchFloor(input: PatchSpatialFloorInput): Promise<ApiResult<Floor>>;
  readFloor(input: ReadSpatialFloorInput): Promise<ApiResult<Floor>>;
  readVersion(input: ReadSpatialVersionInput): Promise<ApiResult<Version>>;
}

export interface ApiClient {
  drawings: DrawingsApi;
  featureFlags: FeatureFlagsApi;
  floors: FloorsApi;
  projects: ProjectsApi;
  spatial: SpatialApi;
}

const asApiResult = <T>(result: Result<T, HttpError>): ApiResult<T> => result as ApiResult<T>;

const decodeSingle = <S extends ZodTypeAny>(
  result: Result<unknown, HttpError>,
  schema: S,
  source: string,
): ApiResult<z.output<S>> => {
  if (!result.ok) {
    return asApiResult(result);
  }

  return decode(schema, result.data, source) as ApiResult<z.output<S>>;
};

const decodeList = <S extends ZodTypeAny>(
  result: Result<unknown, HttpError>,
  schema: S,
  source: string,
): ApiResult<z.output<S>[]> => {
  if (!result.ok) {
    return asApiResult(result);
  }

  return safeParseList(schema, result.data, source) as ApiResult<z.output<S>[]>;
};

type TransportWriteOptions = Pick<HttpRequestOptions, 'idempotencyKey' | 'signal'>;

const toRequestOptions = (options: WriteRequestOptions = {}): TransportWriteOptions => ({
  ...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
  ...(options.signal !== undefined ? { signal: options.signal } : {}),
});

const callGet = async <T>(http: HttpClient, path: string, signal?: AbortSignal): Promise<Result<T, HttpError>> =>
  http.get<T>(path, signal !== undefined ? { signal } : undefined);

const callDelete = async <T>(http: HttpClient, path: string, options: WriteRequestOptions): Promise<Result<T, HttpError>> =>
  http.delete<T>(path, toRequestOptions(options));

const callPost = async <T, TBody>(
  http: HttpClient,
  path: string,
  body: TBody,
  options: WriteRequestOptions,
): Promise<Result<T, HttpError>> => http.post<T, TBody>(path, { body, ...toRequestOptions(options) });

const callPatch = async <T, TBody>(
  http: HttpClient,
  path: string,
  body: TBody,
  options: WriteRequestOptions,
): Promise<Result<T, HttpError>> => http.patch<T, TBody>(path, { body, ...toRequestOptions(options) });

export const createApiClient = (http: HttpClient): ApiClient => ({
  drawings: {
    complete: async (input) => {
      const { body, projectId } = input;

      return decodeSingle(
        await callPost(http, ENDPOINTS.drawings.complete(projectId, body.uploadId), body, input),
        ProgressSchema,
        'drawings.complete',
      );
    },
    initUpload: async (input) => {
      const { body } = input;

      return decodeSingle(
        await callPost(http, ENDPOINTS.drawings.initUpload(body.projectId, body.floorId), body, input),
        ProgressSchema,
        'drawings.initUpload',
      );
    },
    progress: async ({ projectId, signal, uploadId }) =>
      decodeSingle(
        await callGet<unknown>(http, ENDPOINTS.drawings.progress(projectId, uploadId), signal),
        ProgressSchema,
        'drawings.progress',
      ),
    sendChunk: async (input) => {
      const { body, projectId, uploadId } = input;

      return decodeSingle(
        await callPost(http, ENDPOINTS.drawings.chunk(projectId, uploadId), body, input),
        ProgressSchema,
        'drawings.sendChunk',
      );
    },
  },
  featureFlags: {
    read: async (options) =>
      asApiResult(await callGet<unknown>(http, ENDPOINTS.featureFlags.read, options?.signal)),
  },
  floors: {
    create: async (input) => {
      const { body } = input;

      return decodeSingle(
        await callPost(http, ENDPOINTS.floors.create, toFloorWirePayload(body), input),
        FloorSchema,
        'floors.create',
      );
    },
    delete: async (input) => {
      const { floorId } = input;

      return decodeSingle(
        await callDelete<unknown>(http, ENDPOINTS.floors.delete(floorId), input),
        FloorSchema,
        'floors.delete',
      );
    },
    list: async (options) =>
      decodeList(await callGet<unknown>(http, ENDPOINTS.floors.list, options?.signal), FloorSchema, 'floors.list'),
    reorder: async (input) => {
      const { body } = input;

      return decodeList(
        await callPatch(http, ENDPOINTS.floors.reorder, body, input),
        FloorSchema,
        'floors.reorder',
      );
    },
  },
  projects: {
    create: async (input) => {
      const { body } = input;

      return decodeSingle(
        await callPost(http, ENDPOINTS.projects.create, toProjectWirePayload(body), input),
        ProjectSchema,
        'projects.create',
      );
    },
    delete: async (input) => {
      const { projectId } = input;

      return decodeSingle(
        await callDelete<unknown>(http, ENDPOINTS.projects.delete(projectId), input),
        ProjectSchema,
        'projects.delete',
      );
    },
    list: async (options) =>
      decodeList(await callGet<unknown>(http, ENDPOINTS.projects.list, options?.signal), ProjectSchema, 'projects.list'),
    read: async ({ projectId, signal }) =>
      decodeSingle(
        await callGet<unknown>(http, ENDPOINTS.projects.read(projectId), signal),
        ProjectSchema,
        'projects.read',
      ),
    update: async (input) => {
      const { body, projectId } = input;

      return decodeSingle(
        await callPatch(http, ENDPOINTS.projects.update(projectId), toProjectWirePayload(body), input),
        ProjectSchema,
        'projects.update',
      );
    },
  },
  spatial: {
    patchFloor: async (input) => {
      const { body, floorId, projectId } = input;

      return decodeSingle(
        await callPatch(http, ENDPOINTS.spatial.floor(projectId, floorId), toFloorWirePayload(body), input),
        FloorSchema,
        'spatial.patchFloor',
      );
    },
    readFloor: async ({ floorId, projectId, signal }) =>
      decodeSingle(
        await callGet<unknown>(http, ENDPOINTS.spatial.floor(projectId, floorId), signal),
        FloorSchema,
        'spatial.readFloor',
      ),
    readVersion: async ({ projectId, signal, versionId }) =>
      decodeSingle(
        await callGet<unknown>(http, ENDPOINTS.spatial.version(projectId, versionId), signal),
        VersionSchema,
        'spatial.readVersion',
      ),
  },
});

