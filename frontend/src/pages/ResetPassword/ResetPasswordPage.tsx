import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordForm>();

  const newPassword = watch('newPassword');

  const getPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  };

  const strength = newPassword ? getPasswordStrength(newPassword) : 0;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'][strength];

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }
    setError('');
    setSuccess(false);
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

  if (!token) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-red-100 mb-4">
          <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Invalid reset link</h3>
        <p className="text-sm text-slate-600 mt-1">The reset link is invalid or has expired.</p>
        <Link to="/forgot-password" className="inline-block mt-4 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press transition-colors">
          Request new link
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      {success ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 mb-4">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Password reset successful!</h3>
          <p className="text-sm text-slate-600 mt-1">You can now login with your new password.</p>
          <Link to="/login" className="inline-block mt-4 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press transition-colors">
            Go to Login
          </Link>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-900">Reset your password</h2>
            <p className="text-sm text-slate-600 mt-1">Enter your new password below</p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </motion.div>
          )}

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
            <input
              id="newPassword"
              type="password"
              {...register('newPassword', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200 ${errors.newPassword ? 'border-red-300' : 'border-slate-200'}`}
              placeholder="Min. 6 characters"
            />
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? strengthColor : 'bg-slate-200'}`} />
                  ))}
                </div>
                <p className={`text-xs mt-1 ${strength <= 1 ? 'text-red-600' : strength <= 2 ? 'text-orange-600' : strength <= 3 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                  {strengthLabel}
                </p>
              </div>
            )}
            {errors.newPassword && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-600">{errors.newPassword.message}</motion.p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword', { required: 'Please confirm your password', validate: (value) => value === newPassword || 'Passwords do not match' })}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200 ${errors.confirmPassword ? 'border-red-300' : 'border-slate-200'}`}
              placeholder="Re-enter password"
            />
            {errors.confirmPassword && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-600">{errors.confirmPassword.message}</motion.p>}
          </div>

          <button type="submit" disabled={loading} className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Resetting...
              </span>
            ) : 'Reset password'}
          </button>

          <p className="text-center text-sm text-slate-600">
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">Back to login</Link>
          </p>
        </form>
      )}
    </motion.div>
  );
}
