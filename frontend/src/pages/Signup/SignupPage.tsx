import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';

interface SignupForm {
  fullName?: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function SignupPage() {
  const { signup, checkUsername, checkEmail } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>();

  const watchedUsername = watch('username');
  const watchedEmail = watch('email');
  const watchedPassword = watch('password');

  const getPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  };

  const strength = watchedPassword ? getPasswordStrength(watchedPassword) : 0;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'][strength];

  const checkUsernameAvailable = useCallback(async (value: string) => {
    if (!value || value.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    try {
      const taken = await checkUsername(value);
      setUsernameStatus(taken ? 'taken' : 'available');
    } catch { setUsernameStatus('idle'); }
  }, [checkUsername]);

  const checkEmailAvailable = useCallback(async (value: string) => {
    if (!value || !value.includes('@')) { setEmailStatus('idle'); return; }
    setEmailStatus('checking');
    try {
      const taken = await checkEmail(value);
      setEmailStatus(taken ? 'taken' : 'available');
    } catch { setEmailStatus('idle'); }
  }, [checkEmail]);

  useEffect(() => {
    const t = setTimeout(() => { if (watchedUsername) checkUsernameAvailable(watchedUsername); }, 500);
    return () => clearTimeout(t);
  }, [watchedUsername, checkUsernameAvailable]);

  useEffect(() => {
    const t = setTimeout(() => { if (watchedEmail) checkEmailAvailable(watchedEmail); }, 500);
    return () => clearTimeout(t);
  }, [watchedEmail, checkEmailAvailable]);

  const onSubmit = async (data: SignupForm) => {
    if (usernameStatus === 'taken') { setError('Username is already taken'); return; }
    if (emailStatus === 'taken') { setError('Email is already in use'); return; }
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      await signup(data);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      {success ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 mb-4">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Account created!</h3>
          <p className="text-sm text-slate-600 mt-1">You can now login with your credentials.</p>
          <Link to="/login" className="inline-block mt-4 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press transition-colors">Go to Login</Link>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`} style={{ animation: shake ? 'shake 0.5s ease-in-out' : undefined }}>
              <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`}</style>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <span>{error}</span>
              </div>
            </motion.div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-slate-400">(optional)</span></label>
            <input id="fullName" type="text" {...register('fullName')} className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200" placeholder="John Doe" />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <input id="username" type="text" {...register('username', { required: 'Username is required', minLength: { value: 3, message: 'At least 3 characters' }, maxLength: { value: 50, message: 'Max 50 characters' } })} className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200 ${errors.username ? 'border-red-300' : usernameStatus === 'taken' ? 'border-red-300' : usernameStatus === 'available' ? 'border-emerald-300' : 'border-slate-200'}`} placeholder="johndoe" />
            {usernameStatus === 'checking' && <p className="mt-1.5 text-xs text-slate-400">Checking availability...</p>}
            {usernameStatus === 'available' && <p className="mt-1.5 text-xs text-emerald-600">Username is available ✓</p>}
            {usernameStatus === 'taken' && <p className="mt-1.5 text-xs text-red-600">Username is already taken ✗</p>}
            {errors.username && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-600">{errors.username.message}</motion.p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input id="email" type="email" {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email address' } })} className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200 ${errors.email ? 'border-red-300' : emailStatus === 'taken' ? 'border-red-300' : emailStatus === 'available' ? 'border-emerald-300' : 'border-slate-200'}`} placeholder="john@example.com" />
            {emailStatus === 'checking' && <p className="mt-1.5 text-xs text-slate-400">Checking availability...</p>}
            {emailStatus === 'available' && <p className="mt-1.5 text-xs text-emerald-600">Email is available ✓</p>}
            {emailStatus === 'taken' && <p className="mt-1.5 text-xs text-red-600">Email is already in use ✗</p>}
            {errors.email && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-600">{errors.email.message}</motion.p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input id="password" type="password" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' }, maxLength: { value: 100, message: 'Max 100 characters' } })} className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200 ${errors.password ? 'border-red-300' : 'border-slate-200'}`} placeholder="Min. 6 characters" />
            {watchedPassword && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? strengthColor : 'bg-slate-200'}`} />
                  ))}
                </div>
                <p className={`text-xs mt-1 ${strength <= 1 ? 'text-red-600' : strength <= 2 ? 'text-orange-600' : strength <= 3 ? 'text-yellow-600' : 'text-emerald-600'}`}>{strengthLabel}</p>
              </div>
            )}
            {errors.password && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-600">{errors.password.message}</motion.p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
            <input id="confirmPassword" type="password" {...register('confirmPassword', { required: 'Please confirm your password', validate: (value) => value === watchedPassword || 'Passwords do not match' })} className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200 ${errors.confirmPassword ? 'border-red-300' : 'border-slate-200'}`} placeholder="Re-enter password" />
            {errors.confirmPassword && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-600">{errors.confirmPassword.message}</motion.p>}
          </div>

          <button type="submit" disabled={loading || usernameStatus === 'taken' || emailStatus === 'taken'} className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Creating account...
              </span>
            ) : 'Create account'}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already have an account? <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">Sign in</Link>
          </p>
        </form>
      )}
    </motion.div>
  );
}
