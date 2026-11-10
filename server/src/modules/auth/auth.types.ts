export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthJwtPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

export interface AuthSuccessResponse {
  status: 'success';
  message?: string;
  user: SafeUser;
}

export interface LogoutSuccessResponse {
  status: 'success';
  message: string;
}

