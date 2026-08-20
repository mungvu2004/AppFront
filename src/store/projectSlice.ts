import type { StateCreator } from 'zustand';
import type { Level, LevelId } from '../domain/spatial/types';
import type { Project, ProjectRole } from '../types/project';

/**
 * Project context: which project is open, its floors, the floor being viewed,
 * and what the signed-in user is allowed to do on it.
 *
 * Permission checks are derived data and stay out of the store: call
 * `can(action, resource, { roles })` from `lib/auth` with `userRoles`.
 */
export interface ProjectSlice {
  /** Project currently open; null when none is. */
  project: Project | null;
  /** Floors of the open project, ordered bottom-up. */
  floors: readonly Level[];
  /** Floor being viewed; null until one is picked. */
  activeFloorId: LevelId | null;
  /** Roles of the signed-in user on the open project. */
  userRoles: readonly ProjectRole[];
  /** Opens a project (or closes it with null); floors and the viewed floor reset with it. */
  setProject: (project: Project | null) => void;
  setFloors: (floors: readonly Level[]) => void;
  setActiveFloor: (activeFloorId: LevelId | null) => void;
  setUserRoles: (userRoles: readonly ProjectRole[]) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice> = (set) => ({
  project: null,
  floors: [],
  activeFloorId: null,
  userRoles: [],
  setProject: (project) => set({ project, floors: [], activeFloorId: null }),
  setFloors: (floors) => set({ floors }),
  setActiveFloor: (activeFloorId) => set({ activeFloorId }),
  setUserRoles: (userRoles) => set({ userRoles }),
});
