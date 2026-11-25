import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Eye, EyeOff, Grip } from 'lucide-react';
import { api, type UserProfile } from '../lib/api';
import { formatUidDisplay } from '../lib/format';
import { soundEngine } from '../lib/soundEngine';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

interface AuthPageProps {
  onAuthenticated: (user: UserProfile) => void;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notify } = useToast();
  const [mode, setMode] = useState<'login' | 'register' | 'otp'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login',
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdUid, setCreatedUid] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  const toggleMode = () => {
    soundEngine.playClick();
    setErrorMsg('');
    setOtpCode('');
    setChallengeToken('');
    setMode(mode === 'login' ? 'register' : 'login');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    setErrorMsg('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await api.loginV2(email, password);
        if (res.requires_otp && res.challenge_token) {
          setChallengeToken(res.challenge_token);
          setMode('otp');
          notify('Enter the 6-digit verification code sent to your email', 'info');
        } else if (res.user) {
          onAuthenticated(res.user);
          navigate('/app');
        }
      } else if (mode === 'otp') {
        const res = await api.verifyOtp(challengeToken, otpCode);
        onAuthenticated(res.user);
        navigate('/app');
      } else {
        const res = await api.register(fullName, email, password);
        setCreatedUid(res.uid);
        setMode('login');
        setPassword('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMsg(msg);
      notify(msg, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCreatedUid = () => {
    if (!createdUid) return;
    void navigator.clipboard?.writeText(createdUid);
    setCopiedUid(true);
    window.setTimeout(() => setCopiedUid(false), 1500);
  };

  return (
    <div
      className="min-h-dvh bg-canvas text-text-primary flex flex-col items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99, 102, 241, 0.08), transparent)',
      }}
    >
      <div className="w-full max-w-[380px] animate-fade-up">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors mb-5"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          <span>Back</span>
        </Link>

        <div className="bg-surface border border-border-default shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] rounded-lg p-7">
          <div className="flex items-center gap-2.5 text-text-primary font-semibold tracking-[-0.02em]">
            <span className="size-7 rounded-sm bg-elevated border border-border-default flex items-center justify-center">
              <Grip className="size-4 text-accent" strokeWidth={1.75} />
            </span>
            <span>CallSphere</span>
          </div>

          <h1 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-text-primary">
            {mode === 'login'
              ? 'Sign in'
              : mode === 'otp'
                ? 'Verify your email'
                : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {mode === 'login'
              ? 'Enter your email and password to continue.'
              : mode === 'otp'
                ? 'Enter the 6-digit code sent to your email.'
                : 'Get your permanent 10-digit UID in seconds.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'otp' ? (
              <Input
                id="auth-otp"
                label="6-Digit Verification Code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="font-mono tracking-[0.25em] text-center text-lg"
                required
              />
            ) : (
              <>
                {mode === 'register' ? (
                  <Input
                    id="auth-name"
                    label="Full Name"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                ) : null}

                <Input
                  id="auth-email"
                  type="email"
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="auth-password" className="text-xs font-medium text-text-secondary">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={mode === 'register' ? 6 : 1}
                      required
                      className="h-10 w-full bg-canvas border border-border-default rounded-sm pl-3 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent-muted outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" strokeWidth={1.5} />
                      ) : (
                        <Eye className="size-4" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {errorMsg ? (
              <div className="p-2.5 rounded-sm bg-danger-bg border border-danger/30 text-xs text-danger">
                {errorMsg}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : mode === 'otp'
                    ? 'Verify Code'
                    : 'Create Account'}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border-subtle text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              {mode === 'login'
                ? 'New to CallSphere? Create an account'
                : mode === 'otp'
                  ? 'Back to sign in'
                  : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={createdUid !== null}
        onClose={() => setCreatedUid(null)}
        title="Your UID is Ready"
        footer={
          <Button onClick={() => setCreatedUid(null)} className="w-full">
            Continue to Sign In
          </Button>
        }
      >
        <p className="text-sm text-text-secondary">
          Share this 10-digit number with contacts so they can call you.
        </p>
        <div className="mt-4 p-4 rounded-md bg-canvas border border-border-default flex items-center justify-between gap-3">
          <span className="font-mono tabular-nums text-xl font-semibold text-text-primary">
            {createdUid ? formatUidDisplay(createdUid) : ''}
          </span>
          <Button variant="secondary" size="sm" onClick={handleCopyCreatedUid}>
            {copiedUid ? (
              <>
                <Check className="size-3.5 text-online" strokeWidth={1.75} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" strokeWidth={1.5} />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
