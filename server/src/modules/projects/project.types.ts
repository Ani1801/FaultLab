export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectDTO {
  name: string;
  description?: string | null;
}

export interface UpdateProjectDTO {
  name?: string;
  description?: string | null;
}

