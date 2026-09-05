import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from '../types';

let storedToken: string | null = null;
let storedUser: any = null;
let storedRefreshToken: string | null = null;

try {
  storedToken = localStorage.getItem('dex_token');
  const userStr = localStorage.getItem('dex_user');
  storedUser = userStr ? JSON.parse(userStr) : null;
  storedRefreshToken = localStorage.getItem('dex_refresh_token');
} catch {
  // Corrupted localStorage — clear it
  localStorage.removeItem('dex_token');
  localStorage.removeItem('dex_user');
  localStorage.removeItem('dex_refresh_token');
}

const initialState: AuthState = {
  token: storedToken,
  refreshToken: storedRefreshToken,
  user: storedUser,
  isAuthenticated: !!storedToken,
  loading: false,
  requiresTwoFactor: false,
  pendingUsername: null,
} satisfies AuthState;

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
    },
    loginSuccess(state, action: PayloadAction<{ token: string; refreshToken?: string; user: User }>) {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken || null;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      localStorage.setItem('dex_token', action.payload.token);
      if (action.payload.refreshToken) {
        localStorage.setItem('dex_refresh_token', action.payload.refreshToken);
      }
      localStorage.setItem('dex_user', JSON.stringify(action.payload.user));
    },
    loginFailure(state) {
      state.loading = false;
    },
    requiresTwoFactor(state, action: PayloadAction<string>) {
      state.loading = false;
      state.requiresTwoFactor = true;
      state.pendingUsername = action.payload;
    },
    completeTwoFactor(state, action: PayloadAction<{ token: string; refreshToken?: string; user: User }>) {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken || null;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      localStorage.setItem('dex_token', action.payload.token);
      if (action.payload.refreshToken) {
        localStorage.setItem('dex_refresh_token', action.payload.refreshToken);
      }
      localStorage.setItem('dex_user', JSON.stringify(action.payload.user));
    },
    cancelTwoFactor(state) {
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      state.loading = false;
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      localStorage.removeItem('dex_token');
      localStorage.removeItem('dex_user');
      localStorage.removeItem('dex_refresh_token');
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, requiresTwoFactor, completeTwoFactor, cancelTwoFactor, logout, setUser } = authSlice.actions;
export default authSlice.reducer;
