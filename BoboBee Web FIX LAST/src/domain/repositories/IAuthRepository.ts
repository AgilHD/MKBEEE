import { User } from '../../shared/types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface IAuthRepository {
  login(request: LoginRequest): Promise<LoginResponse>;
  register(request: RegisterRequest): Promise<LoginResponse>;
  logout(): Promise<void>;
  me(): Promise<User>;
  refreshToken(): Promise<string>;
}