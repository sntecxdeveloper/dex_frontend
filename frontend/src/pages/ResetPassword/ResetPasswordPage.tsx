import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_BAR = [
  '',
  'bg-red-400',
  'bg-orange-400',
  'bg-amber-400',
  'bg-primary-400',
  'bg-emerald-400',
];
const STRENGTH_TEXT = [
  '',
  'text-red-300',
  'text-orange-300',
  'text-amber-300',
  'text-primary-300',
  'text-emerald-300',
];

function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordForm>();

  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');
  const strength = newPassword ? scorePassword(newPassword) : 0;
  const confirmTouched = !!confirmPassword;

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(token, data.newPassword, data.confirmPassword);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
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

  /* Missing / expired token */
  if (!token) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
          <svg className="h-7 w-7 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-red-400">Link expired</p>
        <h1 className="font-display text-[22px] font-semibold text-slate-900">Invalid reset link</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-slate-500">
          This link is invalid or has already been used. Request a fresh one to continue.
        </p>
        <Button size="lg" fullWidth className="mt-7" onClick={() => navigate('/forgot-password')}>
          Request a new link
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10">
          <svg className="h-7 w-7 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">All set</p>
        <h1 className="font-display text-[22px] font-semibold text-slate-900">Password updated</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-slate-500">
          Your password has been reset. Sign in with your new credentials.
        </p>
        <Button size="lg" fullWidth className="mt-7" onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-8">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-400">Account recovery</p>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.01em] text-slate-900">Reset your password</h1>
        <p className="mt-1.5 text-sm text-slate-500">Choose a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-300"
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

        <div>
          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Min. 6 characters"
            rightSlot={eye}
            error={errors.newPassword?.message}
            {...register('newPassword', {
              required: 'Password is required',
              minLength: { value: 6, message: 'At least 6 characters' },
            })}
          />
          {newPassword && (
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
            label="Confirm new password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter password"
            rightSlot={eye}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === newPassword || 'Passwords do not match',
            })}
          />
          {confirmTouched && errors.confirmPassword?.type !== 'validate' && newPassword === confirmPassword && (
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

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-slate-500">
        <Link to="/login" className="font-medium text-primary-400 transition-colors hover:text-primary-300">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
