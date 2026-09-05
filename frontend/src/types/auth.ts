export interface User {
  id?: number;
  username: string;
  email: string;
  fullName?: string | null;
  role: string;
  totpEnabled?: boolean;
}

export interface LoginRequest {
  username: string;  // Can be username or email
  password: string;
}

export interface LoginResponse {
  id?: number;
  token: string;
  refreshToken?: string;
  type: string;
  username: string;
  email: string;
  role: string;
  totpEnabled: boolean;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
}

export interface SignupResponse {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  role: string;
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  requiresTwoFactor: boolean;
  pendingUsername: string | null;
}
