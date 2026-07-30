import { StateCreator } from 'zustand';
import { Project, ProjectMember } from '../types/project';
import { ProjectMetadata } from '../types/spatial';

export interface ProjectSlice {
  project: Project | null;
  metadata: ProjectMetadata | null;
  setProject: (project: Project) => void;
  setMetadata: (metadata: ProjectMetadata) => void;
  updateMemberRole: (memberId: string, role: ProjectMember['role']) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice> = (set) => ({
  project: null,
  metadata: null,
  setProject: (project) => set({ project }),
  setMetadata: (metadata) => set({ metadata }),
  updateMemberRole: (memberId, role) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        members: state.project.members.map(m => m.id === memberId ? { ...m, role } : m)
      }
    };
  }),
});
