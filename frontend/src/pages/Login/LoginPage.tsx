import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { login, checkUsername, checkEmail, loading } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [shake, setShake] = useState(false);
  const [userStatus, setUserStatus] = useState<'idle' | 'checking' | 'not-found' | 'found'>('idle');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginForm>();

  const watchedUsername = watch('username');

  const checkUserExists = useCallback(async (value: string) => {
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
  }, [checkUsername, checkEmail]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (watchedUsername) checkUserExists(watchedUsername);
    }, 500);
    return () => clearTimeout(timeout);
  }, [watchedUsername, checkUserExists]);

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setSuccess('');
    try {
      setSuccess('Login successful! Redirecting...');
      await login(data);
    } catch (err) {
      setSuccess('');
      setError(getErrorMessage(err));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
            style={{ animation: shake ? 'shake 0.5s ease-in-out' : undefined }}
          >
            <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`}</style>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{success}</span>
            </div>
          </motion.div>
        )}

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">Username or Email</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            {...register('username', { required: 'Username or email is required' })}
            className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200 ${
              errors.username ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200'
            }`}
            placeholder="Enter username or email"
          />
          {userStatus === 'checking' && (
            <p className="mt-1.5 text-xs text-slate-400">Checking...</p>
          )}
          {userStatus === 'not-found' && watchedUsername && watchedUsername.length >= 3 && (
            <p className="mt-1.5 text-xs text-amber-600">User not found. Please check or sign up.</p>
          )}
          {errors.username && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-600">
              {errors.username.message}
            </motion.p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password', { required: 'Password is required' })}
            className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200 ${
              errors.password ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200'
            }`}
            placeholder="Enter your password"
          />
          {errors.password && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-600">
              {errors.password.message}
            </motion.p>
          )}
        </div>

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Logging in...
            </span>
          ) : (
            'Login'
          )}
        </button>

        <p className="text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">
            Sign up
          </Link>
        </p>
      </form>
    </motion.div>
  );
}
