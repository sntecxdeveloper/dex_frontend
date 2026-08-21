import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from './useAppSelector';
import { useAppDispatch } from './useAppDispatch';
import { loginStart, loginSuccess, loginFailure, requiresTwoFactor, completeTwoFactor, cancelTwoFactor, logout as logoutAction } from '../store/authSlice';
import * as authApi from '../api/authApi';
import type { LoginRequest, SignupRequest } from '../types';

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, token, isAuthenticated, loading, requiresTwoFactor: needsTwoFactor, pendingUsername } = useAppSelector((state) => state.auth);

  const login = useCallback(
    async (data: LoginRequest) => {
      dispatch(loginStart());
      try {
        const response = await authApi.login(data);
        if (response.totpEnabled) {
          // User has 2FA enabled - show OTP verification
          dispatch(requiresTwoFactor(response.username));
        } else {
          // No 2FA - direct login
          dispatch(
            loginSuccess({
              token: response.token,
              user: {
                username: response.username,
                email: response.email,
                role: response.role,
                totpEnabled: response.totpEnabled,
              },
            })
          );
          navigate('/dashboard');
        }
      } catch (error) {
        dispatch(loginFailure());
        throw error;
      }
    },
    [dispatch, navigate]
  );

  const verifyTwoFactor = useCallback(
    async (username: string, code: string) => {
      try {
        const verified = await authApi.verifyTotp(username, code);
        if (verified) {
          // Re-login to get token
          const response = await authApi.login({ username, password: '' });
          dispatch(
            completeTwoFactor({
              token: response.token,
              user: {
                username: response.username,
                email: response.email,
                role: response.role,
                totpEnabled: response.totpEnabled,
              },
            })
          );
          navigate('/dashboard');
        }
        return verified;
      } catch {
        return false;
      }
    },
    [dispatch, navigate]
  );

  const cancelTwoFactorLogin = useCallback(() => {
    dispatch(cancelTwoFactor());
  }, [dispatch]);

  const signup = useCallback(
    async (data: SignupRequest) => {
      await authApi.signup(data);
      navigate('/login');
    },
    [navigate]
  );

  const logout = useCallback(() => {
    dispatch(logoutAction());
    navigate('/login');
  }, [dispatch, navigate]);

  const checkUsername = useCallback(async (username: string) => {
    return await authApi.checkUsername(username);
  }, []);

  const checkEmail = useCallback(async (email: string) => {
    return await authApi.checkEmail(email);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await authApi.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string, confirmPassword: string) => {
    await authApi.resetPassword(token, newPassword, confirmPassword);
  }, []);

  const sendOtp = useCallback(async (username: string) => {
    await authApi.sendOtp(username);
  }, []);

  const verifyOtp = useCallback(async (username: string, otp: string) => {
    return await authApi.verifyOtp(username, otp);
  }, []);

  const enableTotp = useCallback(async (username: string) => {
    return await authApi.enableTotp(username);
  }, []);

  const verifyTotpSetup = useCallback(async (username: string, code: string) => {
    return await authApi.verifyTotp(username, code);
  }, []);

  const disableTotp = useCallback(async (username: string) => {
    await authApi.disableTotp(username);
  }, []);

  return { 
    user, token, isAuthenticated, loading, needsTwoFactor, pendingUsername,
    login, signup, logout, verifyTwoFactor, cancelTwoFactorLogin,
    checkUsername, checkEmail,
    forgotPassword, resetPassword,
    sendOtp, verifyOtp,
    enableTotp, verifyTotpSetup, disableTotp
  };
}
