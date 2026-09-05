import { useState, useRef, useEffect, useCallback, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorHandler';
import { Button } from '../../components/ui/Button';

const CODE_LENGTH = 6;

export default function TwoFactorVerificationPage() {
  const { pendingUsername, verifyTwoFactor, cancelTwoFactorLogin, loading } = useAuth();
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const focusIndex = useCallback((i: number) => {
    refs.current[Math.min(Math.max(i, 0), CODE_LENGTH - 1)]?.focus();
  }, []);

  const attempt = useCallback(
    async (value: string) => {
      if (!pendingUsername) return;
      try {
        const ok = await verifyTwoFactor(pendingUsername, value);
        if (!ok) {
          setError('That code didn’t match. Double-check your authenticator app and try again.');
          setShake(true);
          setCode(Array(CODE_LENGTH).fill(''));
          setTimeout(() => setShake(false), 500);
          refs.current[0]?.focus();
        }
      } catch (err) {
        setError(getErrorMessage(err));
        setCode(Array(CODE_LENGTH).fill(''));
        refs.current[0]?.focus();
      }
    },
    [pendingUsername, verifyTwoFactor]
  );

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    setError('');

    if (digit && index < CODE_LENGTH - 1) {
      focusIndex(index + 1);
    } else if (digit && index === CODE_LENGTH - 1) {
      void attempt(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (code[index]) {
        const next = [...code];
        next[index] = '';
        setCode(next);
      } else if (index > 0) {
        focusIndex(index - 1);
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!digits) return;
    const next = digits.split('').concat(Array(CODE_LENGTH - digits.length).fill(''));
    setCode(next);
    setError('');
    if (digits.length === CODE_LENGTH) {
      void attempt(digits);
    } else {
      focusIndex(digits.length);
    }
  };

  /* No pending challenge — likely a direct visit */
  if (!pendingUsername) {
    return (
      <div className="text-center">
        <h1 className="font-display text-xl font-semibold text-slate-900">No active challenge</h1>
        <p className="mt-2 text-sm text-slate-500">
          This verification session has expired. Please sign in again to continue.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-primary-400 hover:text-primary-300">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-400/25 bg-primary-500/10 shadow-glow">
          <svg className="h-7 w-7 text-primary-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        </div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-400">Step 2 of 2</p>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-slate-900">
          Verify your identity
        </h1>
        <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-slate-500">
          Enter the 6-digit code from your authenticator app for{' '}
          <span className="font-mono text-[13px] text-slate-300">{pendingUsername}</span>.
        </p>
      </div>

      {/* Error */}
      <div aria-live="polite" className="mb-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300 ${
              shake ? 'animate-[shake_0.4s_ease-in-out]' : ''
            }`}
          >
            <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </motion.div>
        )}
      </div>

      {/* Code boxes */}
      <div className="flex justify-center gap-2 sm:gap-2.5">
        {code.map((digit, index) => {
          const filled = digit !== '';
          return (
            <motion.input
              key={index}
              ref={(el) => {
                refs.current[index] = el;
              }}
              animate={filled ? { y: -1 } : { y: 0 }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              aria-label={`Digit ${index + 1}`}
              className={[
                'h-14 w-11 rounded-xl border bg-panel text-center font-mono text-xl font-semibold text-slate-800',
                'transition-all duration-150 sm:w-12',
                'focus:outline-none focus:ring-2 focus:ring-primary-500/25',
                filled
                  ? 'border-primary-400/70 shadow-glow'
                  : 'border-line hover:border-line-strong',
                error ? 'border-red-500/60' : '',
              ].join(' ')}
            />
          );
        })}
      </div>

      <p className="mt-3 text-center font-mono text-[11px] text-slate-600">
        {code.filter(Boolean).length}/{CODE_LENGTH} digits entered
      </p>

      <div className="mt-7 flex flex-col gap-3">
        <Button
          size="lg"
          fullWidth
          loading={loading}
          disabled={code.some((c) => c === '') && !loading}
          onClick={() => void attempt(code.join(''))}
        >
          {loading ? 'Verifying…' : 'Verify & continue'}
        </Button>
        <div className="flex items-center justify-center gap-1 text-[13px] text-slate-500">
          <span>Wrong device?</span>
          <Link to="/login" className="font-medium text-primary-400 hover:text-primary-300">
            Sign in another way
          </Link>
        </div>
        <button
          type="button"
          onClick={cancelTwoFactorLogin}
          className="text-[13px] text-slate-600 transition-colors hover:text-slate-300"
        >
          Cancel and go back
        </button>
      </div>

      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`}</style>
    </div>
  );
}
