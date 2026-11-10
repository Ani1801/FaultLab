export interface WorkspaceResponse {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
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
  workspace: WorkspaceResponse;
}

export interface WorkspaceListResponse {
  status: 'success';
  workspaces: WorkspaceResponse[];
  count: number;
}

