import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface LoginForm {
  username: string;
  password: string;
}

import type { ReactNode } from 'react';

type UserStatus = 'idle' | 'checking' | 'not-found' | 'found';

const statusHint: Record<UserStatus, { node: ReactNode; tone: 'text-emerald-400' | 'text-amber-400' | 'text-slate-500' } | null> = {
  idle: null,
  checking: { node: null, tone: 'text-slate-500' },
  'not-found': {
    node: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    tone: 'text-amber-400',
  },
  found: {
    node: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    tone: 'text-emerald-400',
  },
};

export default function LoginPage() {
  const { login, checkUsername, checkEmail, loading } = useAuth();
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userStatus, setUserStatus] = useState<UserStatus>('idle');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginForm>();

  const watchedUsername = watch('username');

  const checkUserExists = useCallback(
    async (value: string) => {
      if (!value || value.length < 3) {
        setUserStatus('idle');
        return;
      }
      setUserStatus('checking');
      try {
        const isEmail = value.includes('@');
        const exists = isEmail ? await checkEmail(value) : await checkUsername(value);
        setUserStatus(exists ? 'found' : 'not-found');
      } catch {
        setUserStatus('idle');
      }
    },
    [checkUsername, checkEmail]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (watchedUsername) void checkUserExists(watchedUsername);
    }, 500);
    return () => clearTimeout(timeout);
  }, [watchedUsername, checkUserExists]);

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      await login(data);
    } catch (err) {
      setError(getErrorMessage(err));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const hint = statusHint[userStatus];

  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-8">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-400">
          Operator console
        </p>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.01em] text-slate-900">
          Sign in to DEX
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Your fleet is waiting. Enter your credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Error banner */}
        <div aria-live="polite">
          {error && (
            <motion.div
              key={error}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-300 ${
                shake ? 'animate-[shake_0.4s_ease-in-out]' : ''
              }`}
              style={shake ? { animation: 'shake 0.4s ease-in-out' } : undefined}
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </motion.div>
          )}
        </div>

        <Input
          label="Username or email"
          placeholder="you@company.com"
          autoComplete="username"
          leftIcon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          }
          error={errors.username?.message}
          {...register('username', { required: 'Username or email is required' })}
        />
        {userStatus !== 'idle' && (
          <div className="-mt-3 flex items-center gap-1.5 text-xs">
            {userStatus === 'checking' && (
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-slate-500 border-t-transparent" />
            )}
            {hint?.node}
            {userStatus === 'not-found' && (
              <span className={hint?.tone}>No account found — check the spelling or sign up.</span>
            )}
            {userStatus === 'found' && <span className={hint?.tone}>Account found. Enter your password.</span>}
          </div>
        )}

        <Input
          label="Password"
          placeholder="••••••••••••"
          autoComplete="current-password"
          type={showPassword ? 'text' : 'password'}
          leftIcon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          }
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="rounded-md p-1 text-slate-500 transition-colors hover:text-slate-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          }
          error={errors.password?.message}
          {...register('password', { required: 'Password is required' })}
        />

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-500">
            <input
              type="checkbox"
              defaultChecked
              className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600"
            />
            Keep me signed in
          </label>
          <Link
            to="/forgot-password"
            className="text-[13px] font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? 'Signing in…' : 'Sign in to console'}
        </Button>
      </form>

      {/* Trust footer */}
      <div className="mt-8 flex items-center justify-center gap-5 border-t border-line pt-6 text-[11px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-emerald-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          TOTP 2FA enforced
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-primary-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          Full audit trail
        </span>
      </div>

      <p className="mt-6 text-center text-[13px] text-slate-500">
        New to DEX?{' '}
        <Link to="/signup" className="font-medium text-primary-400 transition-colors hover:text-primary-300">
          Request an account
        </Link>
      </p>

      {/* shake keyframes */}
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`}</style>
    </div>
  );
}
