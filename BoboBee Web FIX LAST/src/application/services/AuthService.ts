import { IAuthRepository, LoginRequest, RegisterRequest, LoginResponse } from '../../domain/repositories/IAuthRepository';
import { User } from '../../shared/types';

export class AuthService {
  constructor(private authRepo: IAuthRepository) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.authRepo.login({ email, password });
    this.storeToken(response.token);
    return response;
  }

  async register(email: string, password: string, name?: string): Promise<LoginResponse> {
    const response = await this.authRepo.register({ email, password, name });
    this.storeToken(response.token);
    return response;
  }

  async logout(): Promise<void> {
    await this.authRepo.logout();
    this.clearToken();
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      return await this.authRepo.me();
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private storeToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  private clearToken(): void {
    localStorage.removeItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}