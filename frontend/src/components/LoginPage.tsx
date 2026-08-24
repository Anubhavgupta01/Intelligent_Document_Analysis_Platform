import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-blue-400 to-indigo-500 text-slate-950 shadow-[0_12px_32px_rgba(67,154,255,0.3)] ${small ? 'h-10 w-10 rounded-xl' : 'h-14 w-14'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width={small ? 22 : 28} height={small ? 22 : 28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
      </svg>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
      <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 8.27 4.11 9 6-.25.64-.84 1.62-1.79 2.63M6.61 6.61C4.78 7.79 3.56 9.45 3 10c.73 1.89 4 6 9 6 1.17 0 2.24-.23 3.2-.62" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.06 12.35a1 1 0 0 1 0-.7C3.77 7.88 7.53 5 12 5s8.23 2.88 9.94 6.65a1 1 0 0 1 0 .7C20.23 16.12 16.47 19 12 19s-8.23-2.88-9.94-6.65Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address to continue.');
      return;
    }
    if (!password) {
      setError('Enter your password to continue.');
      return;
    }

    setError('');
    setLoading(true);

    const result = await login(normalizedEmail, password);
    if (!result.success) {
      setError(result.error || 'We could not sign you in. Please check your details and try again.');
    }
    setLoading(false);
  };

  const fieldClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] text-slate-900 shadow-sm outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f5f7fb] text-slate-900">
      <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="relative hidden overflow-hidden bg-[#0a1022] px-10 py-10 text-white lg:flex lg:flex-col xl:px-16">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <BrandMark small />
            <span className="text-sm font-semibold tracking-[0.22em] text-slate-200">IDAP</span>
          </div>

          <div className="relative z-10 my-auto max-w-lg py-16">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Intelligent document analysis</p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-5xl">
              Turn dense documents into decisions you can trust.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
              Ask sharper questions, surface the important details, and keep every research conversation in one focused workspace.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ['01', 'Upload once', 'Bring PDFs, DOCX, and text into one place.'],
                ['02', 'Ask naturally', 'Get context-aware answers without the digging.'],
                ['03', 'Move forward', 'Summaries and insights ready when you are.'],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm">
                  <span className="text-xs font-semibold text-cyan-200">{number}</span>
                  <h2 className="mt-5 text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-400">
            <span>Research with more clarity.</span>
            <span className="rounded-full border border-white/10 px-3 py-1.5">Secure workspace</span>
          </div>
        </section>

        <section className="flex min-h-[100dvh] items-center justify-center px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
          <div className="w-full max-w-[460px] animate-fadeIn">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandMark small />
              <div>
                <p className="text-sm font-semibold tracking-[0.18em] text-slate-800">IDAP</p>
                <p className="text-xs text-slate-500">Intelligent document analysis</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-blue-600">Welcome back</p>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Sign in to your workspace</h1>
              <p className="mt-3 text-[15px] leading-6 text-slate-500">Continue your document research and pick up where you left off.</p>
            </div>

            <div className="rounded-[26px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
              <form onSubmit={handleSubmit} noValidate>
                {error && (
                  <div role="alert" aria-live="polite" className="mb-6 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm leading-5 text-rose-700">
                    <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="login-email" className="text-sm font-semibold text-slate-800">Email address</label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); if (error) setError(''); }}
                    placeholder="you@company.com"
                    className={fieldClass}
                    aria-invalid={Boolean(error)}
                  />
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor="login-password" className="text-sm font-semibold text-slate-800">Password</label>
                    <span className="text-xs text-slate-400">Keep it private</span>
                  </div>
                  <div className="relative mt-2">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); if (error) setError(''); }}
                      placeholder="Enter your password"
                      className={`${fieldClass} pr-12`}
                      aria-invalid={Boolean(error)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <EyeIcon hidden={showPassword} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(29,78,216,0.24)] transition duration-200 hover:bg-[#1e40af] hover:shadow-[0_14px_28px_rgba(29,78,216,0.28)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                  {loading ? 'Signing you in…' : 'Sign in'}
                </button>
              </form>

              <div className="my-7 flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>New to IDAP?</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                onClick={onSwitchToRegister}
                className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Create a free account
              </button>
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-slate-400">
              By continuing, you agree to use the workspace responsibly and keep your account credentials private.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
