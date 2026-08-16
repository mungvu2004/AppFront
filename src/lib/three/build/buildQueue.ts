/**
 * The main thread's half of the build: what to rebuild, in what order, and what
 * to throw away.
 *
 * `build.worker.ts` does the arithmetic. This file decides which arithmetic is
 * worth doing, and that decision is the whole performance story — moving work off
 * the main thread stops the interface freezing, but it does not stop the work
 * being wasteful, and a viewer that rebuilds forty-eight walls because one of them
 * moved is wasteful whichever thread it runs on.
 *
 * Three ideas, each answering a different way of wasting time:
 *
 * - **Plan the smallest job.** `planWallChange` returns exactly one job: the wall
 *   that changed, carrying only the openings cut into *it*. Everything else on
 *   the storey keeps the geometry it already has. Dragging a wall therefore posts
 *   one message with a handful of numbers in it, not a storey.
 * - **Coalesce on the entity.** A drag emits a change per pointer move. The queue
 *   is keyed by entity, so a second job for the same wall replaces the first: the
 *   one still queued is dropped before it is ever sent, and the one already in the
 *   worker is answered `cancelled` at once and its result discarded when it lands.
 *   A drag of two hundred frames costs the worker what it can keep up with, and
 *   the interface never waits on a result it no longer wants.
 * - **Close the worker.** Switching project calls `dispose`, which settles every
 *   outstanding promise, detaches the handler and terminates the thread. A worker
 *   that outlives the project it was built for is a leak that survives navigation.
 *
 * What comes back is typed arrays, not meshes; `toMesh` is where they become
 * three.js objects, tagged exactly as `wall.ts` and `floor.ts` tag theirs, so a
 * mesh from the worker and a mesh from the main thread are interchangeable to
 * `merge.ts`, to picking and to highlighting.
 */

import { BufferAttribute, BufferGeometry, Mesh } from 'three';

import type { RoomId, WallId } from '@/domain/spatial/types';
import { isAttached, type Opening } from '@/domain/openings/types';

import { tagPart } from './scene';
import type { BuildFloorInput } from './floor';
import type {
  BuildJob,
  BuildRequestMessage,
  BuildResponseMessage,
  BuiltPartBuffers,
} from './build.worker';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The little of a `Worker` this queue uses, so a test can stand in for one.
 *
 * The handler takes a whole `MessageEvent` rather than the `{ data }` the queue
 * actually reads, so that a real `Worker` satisfies this interface without a
 * cast — narrowing the parameter here would make the browser's own type
 * unassignable, and a cast at the one place a worker is made is exactly the kind
 * of hole that hides a protocol change.
 */
export interface BuildWorkerLike {
  postMessage(message: BuildRequestMessage): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<BuildResponseMessage>) => void) | null;
}

/** Why a job never produced geometry. */
export type CancelReason =
  /** A newer job for the same entity took its place. */
  | 'superseded'
  /** The queue was closed, most likely because the project changed. */
  | 'disposed';

/** How a job ended. */
export type BuildOutcome =
  | { readonly status: 'done'; readonly parts: readonly BuiltPartBuffers[] }
  | { readonly status: 'cancelled'; readonly reason: CancelReason }
  | { readonly status: 'failed'; readonly message: string };

export interface BuildQueueOptions {
  /**
   * How the worker is made. Defaults to the real one; a test passes a stand-in.
   *
   * It is called at most once, and only when the first job is enqueued, so a
   * queue that is built and never used never starts a thread.
   */
  readonly createWorker?: () => BuildWorkerLike;
  /**
   * How many jobs may be with the worker at once.
   *
   * One, by default, because there is one worker: sending it a second job while
   * it is busy buys nothing and only widens the window in which a job that has
   * already been superseded is still being computed.
   */
  readonly maxInFlight?: number;
}

/* -------------------------------------------------------------------------- */
/* Planning the smallest job.                                                  */
/* -------------------------------------------------------------------------- */

/** The openings cut into one wall, and no others. */
function openingsOn(wallId: WallId, openings: readonly Opening[]): readonly Opening[] {
  return openings.filter((opening) => isAttached(opening) && opening.wallId === wallId);
}

/**
 * What has to be rebuilt when one wall changes: that wall, and nothing else.
 *
 * The wall's own geometry carries its holes, and the panels hung in them are part
 * of the same job, so moving a wall is one message however many doors are in it.
 * Its neighbours are untouched — a wall's shape depends on its centreline and its
 * openings, never on what is drawn beside it.
 *
 * An id that is not on the storey plans nothing, rather than throwing: a stale
 * selection is an ordinary thing for an interface to hold, and it is not a reason
 * to take the viewer down.
 */
export function planWallChange(model: BuildFloorInput, wallId: WallId): readonly BuildJob[] {
  const wall = model.walls.find((candidate) => candidate.id === wallId);
  if (wall === undefined) {
    return [];
  }

  return [
    {
      kind: 'wall',
      key: wall.id,
      levelId: model.level.id,
      wall,
      openings: openingsOn(wall.id, model.openings ?? []),
    },
  ];
}

/** What has to be rebuilt when one room changes: its floor slab and its ceiling. */
export function planRoomChange(model: BuildFloorInput, roomId: RoomId): readonly BuildJob[] {
  const room = model.rooms.find((candidate) => candidate.id === roomId);
  if (room === undefined) {
    return [];
  }

  const job: BuildJob =
    model.slabThicknessMm === undefined
      ? { kind: 'room', key: room.id, levelId: model.level.id, room, level: model.level }
      : {
          kind: 'room',
          key: room.id,
          levelId: model.level.id,
          room,
          level: model.level,
          slabThicknessMm: model.slabThicknessMm,
        };

  return [job];
}

/**
 * Every job a storey needs from cold: one per wall, one per room.
 *
 * This is the expensive path, and naming it that way is the point — everything
 * else in this file exists so that it runs once, when a project opens, rather
 * than every time somebody nudges a wall.
 */
export function planFullBuild(model: BuildFloorInput): readonly BuildJob[] {
  return [
    ...model.walls.flatMap((wall) => planWallChange(model, wall.id)),
    ...model.rooms.flatMap((room) => planRoomChange(model, room.id)),
  ];
}

/* -------------------------------------------------------------------------- */
/* Buffers back into three.js.                                                 */
/* -------------------------------------------------------------------------- */

/** A part's buffers as a geometry, with no copy of the vertex data. */
export function toGeometry(part: BuiltPartBuffers): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(part.position, 3));
  geometry.setAttribute('normal', new BufferAttribute(part.normal, 3));
  geometry.setAttribute('uv', new BufferAttribute(part.uv, 2));

  if (part.position.length > 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  return geometry;
}

/**
 * A part as a tagged mesh, the same shape `wall.ts` and `floor.ts` return.
 *
 * `userData` carries the model id, so picking, batching and highlighting cannot
 * tell a worker-built mesh from a main-thread one — and neither can a reviewer:
 * the refusals arrive with the same Vietnamese sentence `buildWallMesh` writes,
 * because both come from `planCuts` in `plan.ts`.
 *
 * No material is assigned. Colour is a token decision and belongs to the caller.
 */
export function toMesh(part: BuiltPartBuffers): Mesh {
  const mesh = tagPart(new Mesh(toGeometry(part)), {
    kind: part.kind,
    entityId: part.entityId,
    levelId: part.levelId,
  });

  mesh.userData = {
    ...mesh.userData,
    openingIds: part.openingIds,
    refusals: part.refusals,
  };

  return mesh;
}

/* -------------------------------------------------------------------------- */
/* The queue.                                                                  */
/* -------------------------------------------------------------------------- */

/** One job on its way through the queue. */
interface Entry {
  readonly job: BuildJob;
  readonly settle: (outcome: BuildOutcome) => void;
  settled: boolean;
}

/** The real worker. Vite turns the URL into its own bundle at build time. */
export function createBuildWorker(): BuildWorkerLike {
  return new Worker(new URL('./build.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * A queue of build jobs, coalesced by entity and answered out of a worker.
 *
 * Every `enqueue` gets an answer exactly once — built, cancelled or failed — so a
 * caller can `await` it without having to guard against a promise that never
 * settles. That holds through `dispose` too: closing the queue settles everything
 * outstanding rather than leaving the awaiting code hanging on a thread that has
 * gone.
 */
export class BuildQueue {
  private readonly createWorker: () => BuildWorkerLike;
  private readonly maxInFlight: number;
  private readonly pending = new Map<string, Entry>();
  private readonly inFlight = new Map<number, Entry>();
  private worker: BuildWorkerLike | null = null;
  private nextTicket = 1;
  private disposed = false;

  constructor(options: BuildQueueOptions = {}) {
    this.createWorker = options.createWorker ?? createBuildWorker;
    this.maxInFlight = Math.max(1, options.maxInFlight ?? 1);
  }

  /** Jobs waiting to be sent. */
  get pendingCount(): number {
    return this.pending.size;
  }

  /** Jobs the worker has been given and has not yet answered. */
  get inFlightCount(): number {
    return this.inFlight.size;
  }

  /** Has the queue been closed? */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Queue one job, replacing any earlier job for the same entity.
   *
   * The earlier job is answered `cancelled` straight away rather than when the
   * worker gets round to it: the caller asked for a newer state, and making it
   * wait for an answer it is going to throw away is the delay this class exists to
   * remove.
   */
  enqueue(job: BuildJob): Promise<BuildOutcome> {
    if (this.disposed) {
      return Promise.resolve({ status: 'cancelled', reason: 'disposed' });
    }

    this.supersede(job.key);

    return new Promise<BuildOutcome>((resolve) => {
      const entry: Entry = {
        job,
        settled: false,
        settle: (outcome) => {
          if (!entry.settled) {
            entry.settled = true;
            resolve(outcome);
          }
        },
      };

      this.pending.set(job.key, entry);
      this.pump();
    });
  }

  /** Queue several jobs, and wait for all of their answers. */
  enqueueAll(jobs: readonly BuildJob[]): Promise<readonly BuildOutcome[]> {
    return Promise.all(jobs.map((job) => this.enqueue(job)));
  }

  /**
   * Close the queue: settle everything outstanding and end the thread.
   *
   * Safe to call twice, and safe to call on a queue that never built anything —
   * the worker is only made on the first job, so there may be nothing to
   * terminate. `enqueue` after this answers `cancelled` rather than throwing,
   * because a project change racing with a pointer drag is ordinary, not a bug.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const entry of [...this.pending.values(), ...this.inFlight.values()]) {
      entry.settle({ status: 'cancelled', reason: 'disposed' });
    }
    this.pending.clear();
    this.inFlight.clear();

    if (this.worker !== null) {
      this.worker.onmessage = null;
      this.worker.terminate();
      this.worker = null;
    }
  }

  /** Answer any earlier job for this entity, wherever it has got to. */
  private supersede(key: string): void {
    const waiting = this.pending.get(key);
    if (waiting !== undefined) {
      this.pending.delete(key);
      waiting.settle({ status: 'cancelled', reason: 'superseded' });
    }

    for (const entry of this.inFlight.values()) {
      if (entry.job.key === key) {
        // It stays in the map until the worker answers, because the worker is
        // genuinely still busy with it and the slot is genuinely still taken.
        entry.settle({ status: 'cancelled', reason: 'superseded' });
      }
    }
  }

  private ensureWorker(): BuildWorkerLike {
    if (this.worker === null) {
      const worker = this.createWorker();
      worker.onmessage = (event) => {
        this.receive(event.data);
      };
      this.worker = worker;
    }
    return this.worker;
  }

  private pump(): void {
    while (!this.disposed && this.inFlight.size < this.maxInFlight && this.pending.size > 0) {
      const next = [...this.pending.entries()][0];
      if (next === undefined) {
        return;
      }

      const [key, entry] = next;
      this.pending.delete(key);

      const ticket = this.nextTicket;
      this.nextTicket += 1;
      this.inFlight.set(ticket, entry);
      this.ensureWorker().postMessage({ ticket, job: entry.job });
    }
  }

  private receive(response: BuildResponseMessage): void {
    const entry = this.inFlight.get(response.ticket);
    if (entry === undefined) {
      return;
    }
    this.inFlight.delete(response.ticket);

    // An entry that is already settled was superseded while the worker was
    // working; its buffers are dropped rather than handed to anybody.
    if (!entry.settled) {
      entry.settle(
        'error' in response
          ? { status: 'failed', message: response.error }
          : { status: 'done', parts: response.parts },
      );
    }

    this.pump();
  }
}
