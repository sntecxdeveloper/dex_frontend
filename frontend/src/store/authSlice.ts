import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from '../types';

const storedToken = localStorage.getItem('dex_token');
const storedUser = localStorage.getItem('dex_user');

const initialState: AuthState = {
  token: storedToken,
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: !!storedToken,
  loading: false,
  requiresTwoFactor: false,
  pendingUsername: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
    },
    loginSuccess(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      localStorage.setItem('dex_token', action.payload.token);
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
    completeTwoFactor(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      localStorage.setItem('dex_token', action.payload.token);
      localStorage.setItem('dex_user', JSON.stringify(action.payload.user));
    },
    cancelTwoFactor(state) {
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      state.loading = false;
    },
    logout(state) {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.requiresTwoFactor = false;
      state.pendingUsername = null;
      localStorage.removeItem('dex_token');
      localStorage.removeItem('dex_user');
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, requiresTwoFactor, completeTwoFactor, cancelTwoFactor, logout, setUser } = authSlice.actions;
export default authSlice.reducer;
