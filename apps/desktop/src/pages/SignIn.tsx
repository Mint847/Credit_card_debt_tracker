// Log in, sign up and reset a password: the phone app's options, rules and wording, laid out for a
// desktop screen (brand panel on the left, the form on the right)
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { checkPasswordRules } from '@serendib/core';
import { emailLogin, emailSignup, keepSignedIn, redirectError, sendReset, setKeepSignedIn, socialSignIn, type Provider } from '../lib/auth';
import { Icon } from '../components/ui';

type View = 'login' | 'signup' | 'forgot';

const LOGOS: Record<Provider, ReactNode> = {
  Google: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  ),
  Apple: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="fill-ink">
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4zM13.9 5c.7-.9 1.2-2 1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
    </svg>
  ),
  X: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="fill-ink">
      <path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.9 2.3h7l4.8 6.4 5.5-6.4zm-1.2 17.9h1.9L7 4.2H5l12 16z" />
    </svg>
  )
};

function Field({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-muted">{label}</span>
        {aside}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Social({ onError }: { onError: (m: string) => void }) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const go = async (p: Provider) => {
    setBusy(p);
    const m = await socialSignIn(p);
    setBusy(null);
    if (m) onError(m);
  };
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {(['Google', 'Apple', 'X'] as Provider[]).map((p) => (
        <button key={p} type="button" onClick={() => go(p)} disabled={!!busy} aria-label={'Continue with ' + p}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-panel text-[13px] font-semibold text-ink transition-colors hover:bg-sunken disabled:opacity-60">
          {LOGOS[p]}<span>{p}</span>
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
      <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
    </div>
  );
}

function ErrorText({ text }: { text: string }) {
  if (!text) return null;
  return <p role="alert" className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[13px] font-medium text-danger">{text}</p>;
}

function Login({ go }: { go: (v: View) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(keepSignedIn());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { redirectError().then((m) => { if (m) setError(m); }); }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const m = await emailLogin(email, password);
    setBusy(false);
    if (m) setError(m);
  }
  return (
    <>
      <h1 className="font-serif text-[32px] font-medium tracking-tight">Log in to Serendib</h1>
      <p className="mt-1 text-[14px] text-muted">Your debt-free journey starts here</p>
      <div className="mt-7"><Social onError={setError} /></div>
      <Divider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email address"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field h-11" placeholder="Enter your email" /></Field>
        <Field label="Password" aside={<button type="button" onClick={() => go('forgot')} className="text-[12px] font-semibold text-brand-ink hover:underline">Forgot password?</button>}>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field h-11" placeholder="Enter your password" />
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={keep} onChange={(e) => { setKeep(e.target.checked); setKeepSignedIn(e.target.checked); }} className="h-4 w-4 rounded border-line accent-[rgb(var(--brand))]" />
          Keep me signed in
        </label>
        <ErrorText text={error} />
        <button type="submit" disabled={busy} className="btn-primary h-11 w-full justify-center text-[14px]">{busy ? 'Logging in...' : 'Log in with Email'}</button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted">Don’t have an account? <button type="button" onClick={() => go('signup')} className="font-semibold text-brand-ink hover:underline">Sign up</button></p>
    </>
  );
}

function Signup({ go }: { go: (v: View) => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [bad, setBad] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const rules = checkPasswordRules(f.password, f.confirm);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setBad(null);
    setBusy(true);
    const r = await emailSignup(f);
    setBusy(false);
    if (r) { setError(r.message); setBad(r.field); if (r.field || r.rules) setShowRules(true); }
  }
  const ring = (k: string) => (bad === k ? ' border-danger ring-1 ring-danger' : '');
  const rule = (ok: boolean, text: string) => (
    <li className={'flex items-center gap-1.5 ' + (ok ? 'text-ok' : 'text-faint')}><Icon name={ok ? 'check_circle' : 'circle'} size={15} fill={ok} />{text}</li>
  );
  return (
    <>
      <h1 className="font-serif text-[32px] font-medium tracking-tight">Create an Account</h1>
      <p className="mt-1 text-[14px] text-muted">Join Serendib to conquer your debt</p>
      <div className="mt-7"><Social onError={setError} /></div>
      <Divider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input autoComplete="given-name" value={f.firstName} onChange={set('firstName')} className="field h-11" /></Field>
          <Field label="Last name"><input autoComplete="family-name" value={f.lastName} onChange={set('lastName')} className="field h-11" /></Field>
        </div>
        <Field label="Email address"><input type="email" autoComplete="email" value={f.email} onChange={set('email')} className="field h-11" placeholder="Enter your email" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password"><input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} onFocus={() => setShowRules(true)} className={'field h-11' + ring('password')} placeholder="Create strong password" /></Field>
          <Field label="Confirm password"><input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} className={'field h-11' + ring('confirm')} placeholder="Confirm your password" /></Field>
        </div>
        {showRules && (
          <ul className="grid grid-cols-3 gap-x-3 gap-y-1.5 rounded-lg bg-sunken px-3 py-2.5 text-[12px] font-medium" aria-label="Password requirements">
            {rule(rules.len, '8+ characters')}{rule(rules.upper, '1 uppercase (A-Z)')}{rule(rules.lower, '1 lowercase (a-z)')}
            {rule(rules.num, '1 number (0-9)')}{rule(rules.special, '1 special symbol')}{rule(rules.match, 'Passwords match')}
          </ul>
        )}
        <ErrorText text={error} />
        <button type="submit" disabled={busy} className="btn-primary h-11 w-full justify-center text-[14px]">{busy ? 'Creating your account...' : 'Create Account'}</button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted">Already have an account? <button type="button" onClick={() => go('login')} className="font-semibold text-brand-ink hover:underline">Log in</button></p>
    </>
  );
}

function Forgot({ go }: { go: (v: View) => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e?: FormEvent) {
    if (e) e.preventDefault();
    setError('');
    setBusy(true);
    const m = await sendReset(email);
    setBusy(false);
    if (m) setError(m); else setSentTo(email.trim());
  }
  return (
    <>
      <button type="button" onClick={() => go('login')} className="mb-6 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink"><Icon name="arrow_back" size={18} />Log in</button>
      <h1 className="font-serif text-[32px] font-medium tracking-tight">Reset your password</h1>
      <p className="mt-1 text-[14px] text-muted">Enter your registered email address to receive password reset instructions</p>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <Field label="Email address"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field h-11" placeholder="Enter your email" /></Field>
        <ErrorText text={error} />
        <button type="submit" disabled={busy} className="btn-primary h-11 w-full justify-center text-[14px]">{busy ? 'Sending...' : sentTo ? 'Resend Reset Email' : 'Send Reset Email'}</button>
      </form>
      {sentTo && (
        <div className="mt-5 flex gap-3 rounded-xl border border-ok/25 bg-ok/5 p-4" role="status">
          <Icon name="mark_email_read" className="text-ok" />
          <div className="text-[13px]">
            <p className="font-semibold">Check your email</p>
            <p className="mt-0.5 text-muted">If an account exists for <strong className="text-ink">{sentTo}</strong>, a reset link is on its way. Check your inbox and spam folder.</p>
            <p className="mt-2 text-muted">Didn’t receive it? <button type="button" onClick={() => submit()} className="font-semibold text-brand-ink hover:underline">Resend email</button></p>
          </div>
        </div>
      )}
    </>
  );
}

export function SignIn() {
  const [view, setView] = useState<View>('login');
  return (
    <div className="flex h-full min-h-[640px]">
      <aside className="relative hidden w-[44%] max-w-[640px] flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(150deg, #00473c 0%, #006b5c 45%, #008374 100%)' }}>
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-black/10" />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white font-serif text-[20px] font-semibold text-[#006b5c]">S</span>
          <span className="font-serif text-[24px] font-medium">Serendib</span>
        </div>
        <div className="relative">
          <p className="max-w-md font-serif text-[40px] font-medium leading-[1.15]">Plan, track and pay off your credit cards.</p>
          <ul className="mt-8 space-y-3 text-[14px] text-white/85">
            {[
              ['flag', 'A monthly plan that pays the right card first'],
              ['event', 'Statement and due-date tracking with reminders'],
              ['calculate', 'Real CBSL rules for interest, fees and minimums'],
              ['sync', 'Your phone and computer stay in sync']
            ].map(([i, t]) => <li key={t} className="flex items-center gap-3"><Icon name={i} size={20} />{t}</li>)}
          </ul>
        </div>
        <p className="relative text-[12px] text-white/60">Your data stays in your own account.</p>
      </aside>
      <main className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-10">
        <div className="w-full max-w-[420px]">
          {view === 'login' && <Login go={setView} />}
          {view === 'signup' && <Signup go={setView} />}
          {view === 'forgot' && <Forgot go={setView} />}
        </div>
      </main>
    </div>
  );
}
