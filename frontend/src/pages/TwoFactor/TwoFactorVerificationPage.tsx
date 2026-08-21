import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';

export default function TwoFactorVerificationPage() {
  const { pendingUsername, verifyTwoFactor, cancelTwoFactorLogin, loading } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every(c => c !== '')) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newCode = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
      setCode(newCode);
      const nextEmpty = newCode.findIndex(c => c === '');
      inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
      if (pastedData.length === 6) {
        handleSubmit(pastedData);
      }
    }
  };

  const handleSubmit = async (codeStr: string) => {
    if (!pendingUsername) return;
    
    try {
      const verified = await verifyTwoFactor(pendingUsername, codeStr);
      if (!verified) {
        setError('Invalid code. Please try again.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary-100 mb-4">
          <svg className="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Two-Factor Authentication</h2>
        <p className="text-sm text-slate-600 mt-1">Enter the 6-digit code from your authenticator app</p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        </motion.div>
      )}

      <div className="flex justify-center gap-2 mb-6">
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-all duration-200"
          />
        ))}
      </div>

      <button
        onClick={() => handleSubmit(code.join(''))}
        disabled={loading || code.some(c => c === '')}
        className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verifying...
          </span>
        ) : (
          'Verify'
        )}
      </button>

      <div className="mt-4 text-center">
        <button
          onClick={cancelTwoFactorLogin}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}
