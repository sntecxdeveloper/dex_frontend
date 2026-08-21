import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';

export default function SecuritySettingsPage() {
  const { user, enableTotp, verifyTotpSetup, disableTotp } = useAuth();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'enabled'>('idle');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.totpEnabled) {
      setStep('enabled');
    }
  }, [user]);

  const handleEnableTotp = async () => {
    if (!user?.username) return;
    setError('');
    setLoading(true);
    try {
      const result = await enableTotp(user.username);
      setSecret(result.secret);
      setQrCode(result.qrCode);
      setStep('setup');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!user?.username || !code) return;
    setError('');
    setLoading(true);
    try {
      const verified = await verifyTotpSetup(user.username, code);
      if (verified) {
        setSuccess('Two-factor authentication enabled successfully!');
        setStep('enabled');
        setCode('');
      } else {
        setError('Invalid code. Please try again.');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!user?.username) return;
    setError('');
    setLoading(true);
    try {
      await disableTotp(user.username);
      setSuccess('Two-factor authentication disabled');
      setStep('idle');
      setCode('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Security Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account security</p>
      </motion.div>

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

      {success && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{success}</span>
          </div>
        </motion.div>
      )}

      {/* Two-Factor Authentication Card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900">Two-Factor Authentication</h3>
            <p className="text-sm text-slate-500 mt-1">Add an extra layer of security to your account using an authenticator app</p>

            {step === 'idle' && (
              <button onClick={handleEnableTotp} disabled={loading} className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press disabled:opacity-50 transition-all duration-200">
                {loading ? 'Setting up...' : 'Enable 2FA'}
              </button>
            )}

            {step === 'setup' && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-600 mb-3">1. Scan this QR code with your authenticator app</p>
                  {qrCode && (
                    <div className="flex justify-center">
                      <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48 rounded-lg" />
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-3 text-center">Or enter this key manually:</p>
                  <p className="text-sm font-mono font-semibold text-slate-900 text-center mt-1 bg-white px-3 py-2 rounded-lg border border-slate-200">{secret}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">2. Enter the 6-digit code from your app</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); setSuccess(''); }}
                      className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200"
                      placeholder="000000"
                    />
                    <button
                      onClick={handleVerifyCode}
                      disabled={loading || code.length !== 6}
                      className="px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press disabled:opacity-50 transition-all duration-200"
                    >
                      {loading ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 'enabled' && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span className="text-sm font-medium text-emerald-700">2FA is enabled</span>
                </div>
                <button onClick={handleDisableTotp} disabled={loading} className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 btn-press disabled:opacity-50 transition-all duration-200">
                  {loading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
