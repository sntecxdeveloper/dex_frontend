import api from './axios';
import type { LoginRequest, LoginResponse, SignupRequest, SignupResponse } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
  return response.data.data;
}

export async function signup(data: SignupRequest): Promise<SignupResponse> {
  const response = await api.post<ApiResponse<SignupResponse>>('/auth/signup', data);
  return response.data.data;
}

export async function checkUsername(username: string): Promise<boolean> {
  const response = await api.get<ApiResponse<{ exists: boolean }>>('/auth/check-username', {
    params: { username },
  });
  return response.data.data.exists;
}

export async function checkEmail(email: string): Promise<boolean> {
  const response = await api.get<ApiResponse<{ exists: boolean }>>('/auth/check-email', {
    params: { email },
  });
  return response.data.data.exists;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/reset-password', { token, newPassword, confirmPassword });
}

export async function sendOtp(username: string): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/send-otp', { username });
}

export async function verifyOtp(username: string, otp: string): Promise<boolean> {
  const response = await api.post<ApiResponse<{ verified: boolean }>>('/auth/verify-otp', { username, otp });
  return response.data.data.verified;
}

export interface TotpSetupResponse {
  secret: string;
  username: string;
  issuer: string;
  qrCode: string;
}

export async function enableTotp(username: string): Promise<TotpSetupResponse> {
  const response = await api.post<ApiResponse<TotpSetupResponse>>('/auth/enable-totp', { username });
  return response.data.data;
}

export async function verifyTotp(username: string, code: string): Promise<boolean> {
  const response = await api.post<ApiResponse<{ verified: boolean }>>('/auth/verify-totp', { username, code });
  return response.data.data.verified;
}

export async function disableTotp(username: string): Promise<void> {
  await api.post<ApiResponse<null>>('/auth/disable-totp', { username });
}
