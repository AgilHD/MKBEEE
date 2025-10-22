import { IAuthRepository, LoginRequest, RegisterRequest, LoginResponse } from '../../domain/repositories/IAuthRepository';
import { User } from '../../shared/types';
import { HttpClient } from '../http/HttpClient';

export class HttpAuthRepository implements IAuthRepository {
  constructor(private httpClient: HttpClient) {}

  async login(request: LoginRequest): Promise<LoginResponse> {
    return this.httpClient.post<LoginResponse>('/auth/login', request);
  }

  async register(request: RegisterRequest): Promise<LoginResponse> {
    return this.httpClient.post<LoginResponse>('/auth/register', request);
  }

  async logout(): Promise<void> {
    return this.httpClient.post<void>('/auth/logout');
  }

  async me(): Promise<User> {
    return this.httpClient.get<User>('/auth/me');
  }

  async refreshToken(): Promise<string> {
    const response = await this.httpClient.post<{ token: string }>('/auth/refresh');
    return response.token;
  }
}