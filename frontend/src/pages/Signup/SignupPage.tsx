import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface SignupForm {
  fullName?: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type Availability = 'idle' | 'checking' | 'available' | 'taken';

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_BAR = ['', 'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-primary-400', 'bg-emerald-400'];
const STRENGTH_TEXT = ['', 'text-red-300', 'text-orange-300', 'text-amber-300', 'text-primary-300', 'text-emerald-300'];

function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

export default function SignupPage() {
  const { signup, checkUsername, checkEmail } = useAuth();
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<Availability>('idle');
  const [emailStatus, setEmailStatus] = useState<Availability>('idle');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>();

  const watchedUsername = watch('username');
  const watchedEmail = watch('email');
  const watchedPassword = watch('password');
  const watchedConfirmPassword = watch('confirmPassword');

  const strength = watchedPassword ? scorePassword(watchedPassword) : 0;
  const passwordsMatch = !!watchedConfirmPassword && watchedConfirmPassword === watchedPassword;

  const checkUsernameAvailable = useCallback(
    async (value: string) => {
      if (!value || value.length < 3) {
        setUsernameStatus('idle');
        return;
      }
      setUsernameStatus('checking');
      try {
        const taken = await checkUsername(value);
        setUsernameStatus(taken ? 'taken' : 'available');
      } catch {
        setUsernameStatus('idle');
      }
    },
    [checkUsername]
  );

  const checkEmailAvailable = useCallback(
    async (value: string) => {
      if (!value || !value.includes('@')) {
        setEmailStatus('idle');
        return;
      }
      setEmailStatus('checking');
      try {
        const taken = await checkEmail(value);
        setEmailStatus(taken ? 'taken' : 'available');
      } catch {
        setEmailStatus('idle');
      }
    },
    [checkEmail]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (watchedUsername) void checkUsernameAvailable(watchedUsername);
    }, 500);
    return () => clearTimeout(t);
  }, [watchedUsername, checkUsernameAvailable]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (watchedEmail) void checkEmailAvailable(watchedEmail);
    }, 500);
    return () => clearTimeout(t);
  }, [watchedEmail, checkEmailAvailable]);

  const onSubmit = async (data: SignupForm) => {
    if (usernameStatus === 'taken') {
      setError('That username is already taken.');
      return;
    }
    if (emailStatus === 'taken') {
      setError('That email is already in use.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signup(data);
      // useAuth#signup navigates to /login on success
    } catch (err) {
      setError(getErrorMessage(err));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const availabilityHint = (status: Availability, availableText: string, takenText: string) => {
    if (status === 'checking')
      return (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-slate-500 border-t-transparent" />
          Checking…
        </p>
      );
    if (status === 'available')
      return (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
              clipRule="evenodd"
            />
          </svg>
          {availableText}
        </p>
      );
    if (status === 'taken')
      return (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          {takenText}
        </p>
      );
    return null;
  };

  const eye = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="rounded-md p-1 text-slate-500 transition-colors hover:text-slate-300"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-8">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-400">New operator</p>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.01em] text-slate-900">Create your account</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Request access to the DEX operations console.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

        <Input
          label="Full name (optional)"
          type="text"
          autoComplete="name"
          placeholder="Jordan Smith"
          {...register('fullName')}
        />

        <div>
          <Input
            label="Username"
            type="text"
            autoComplete="username"
            placeholder="jsmith"
            error={errors.username?.message}
            {...register('username', {
              required: 'Username is required',
              minLength: { value: 3, message: 'At least 3 characters' },
              maxLength: { value: 50, message: 'Max 50 characters' },
            })}
          />
          {availabilityHint(usernameStatus, 'Username is available', 'Username is already taken')}
        </div>

        <div>
          <Input
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'That doesn’t look like a valid email' },
            })}
          />
          {availabilityHint(emailStatus, 'Email is available', 'Email is already in use')}
        </div>

        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Min. 6 characters"
            rightSlot={eye}
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'At least 6 characters' },
            })}
          />
          {watchedPassword && (
            <div className="mt-2.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
                      i <= strength ? STRENGTH_BAR[strength] : 'bg-white/[0.07]'
                    }`}
                  />
                ))}
              </div>
              <p className={`mt-1.5 text-xs ${STRENGTH_TEXT[strength]}`}>{STRENGTH_LABELS[strength]}</p>
            </div>
          )}
        </div>

        <div>
          <Input
            label="Confirm password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter password"
            rightSlot={eye}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === watchedPassword || 'Passwords do not match',
            })}
          />
          {passwordsMatch && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                  clipRule="evenodd"
                />
              </svg>
              Passwords match
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          disabled={usernameStatus === 'taken' || emailStatus === 'taken'}
          className="mt-1"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary-400 transition-colors hover:text-primary-300">
          Sign in
        </Link>
      </p>

      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`}</style>
    </div>
  );
}
