export interface Project {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDTO {
  name: string;
  description?: string | null;
}

export interface UpdateProjectDTO {
  name?: string;
  description?: string | null;
}

export interface ProjectSuccessResponse {
  status: 'success';
  message?: string;
  project: Project;
}

export interface ProjectListResponse {
  status: 'success';
  projects: Project[];
  count: number;
}

