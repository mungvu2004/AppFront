export type ProjectRole = 'Quản trị' | 'Kỹ sư' | 'Người xem';

export interface ProjectMember {
  id: string;
  name: string;
  role: ProjectRole;
  avatar_url?: string;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string;
  members: ProjectMember[];
}
