export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceDTO {
  name: string;
}

export interface UpdateWorkspaceDTO {
  name: string;
}

export interface WorkspaceSuccessResponse {
  status: 'success';
  message?: string;
  workspace: Workspace;
}

export interface WorkspaceListResponse {
  status: 'success';
  workspaces: Workspace[];
  count: number;
}

