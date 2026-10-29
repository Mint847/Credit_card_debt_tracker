// Settings: the phone app's Profile & Settings, as one page with a section list. Profile and income
// (with debt-to-income), payoff method, appearance, CBSL rules, backup / restore / earlier copies /
// reset, and the account (change password, delete, sign out). Rules and wording from the shared core.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HELP_TEXTS, PROVIDER_LABELS, primaryProvider, needsEmailVerification, debtToIncome, countsText, backupWhen, safetyCopyWhen,
  restoreMergeLine, restoreReplaceWarning, strategySavings
} from '@serendib/core';
import {
  useApp, setStrategy, setIncome, settleIncome, resetCardData, downloadBackup, readBackupFile, safetyCopies, planFromSafetyCopy,
  applyRestore, accountData, currentUser, signOut, replayGuide, type RestorePlan, type Done
} from '../lib/store';
import { sendOwnPasswordReset, deleteAccount } from '../lib/auth';
import { isAdmin } from '../lib/offers';
import { getTheme, setTheme, type ThemeMode } from '../lib/theme';
import { Modal, Actions, ErrorLine } from '../components/CardDialogs';
import { Icon, useToast } from '../components/ui';
import { useWorkspace } from '../components/Shell';
import { VerifyActions } from '../components/VerifyBanner';
import type { Strategy } from '../lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const SECTIONS = [
  ['profile', 'Profile', 'person'], ['strategy', 'Payoff method', 'flag'], ['appearance', 'Appearance', 'contrast'],
  ['cbsl', 'CBSL rules', 'gavel'], ['data', 'Privacy & data', 'shield'], ['account', 'Account', 'manage_accounts']
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={'set-' + id} className="scroll-mt-6">
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      <div className="panel divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ icon, title, sub, onClick, danger, right }: { icon: string; title: string; sub?: string; onClick?: () => void; danger?: boolean; right?: ReactNode }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={'flex w-full items-center gap-4 px-5 py-3.5 text-left ' + (onClick ? 'hover:bg-sunken ' : '') + (danger ? 'text-danger' : '')}>
      <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (danger ? 'bg-danger/10' : 'bg-sunken text-muted')}><Icon name={icon} size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{title}</span>
        {sub && <span className={'block text-[12px] ' + (danger ? 'text-danger/80' : 'text-faint')}>{sub}</span>}
      </span>
      {right ?? (onClick ? <Icon name="chevron_right" size={18} className="text-faint" /> : null)}
    </Tag>
  );
}

// One of the shared help texts (the phone's info sheets)
function Help({ k, onClose }: { k: string | null; onClose: () => void }) {
  const h = k ? (HELP_TEXTS as any)[k] : null;
  return (
    <Modal open={!!h} onClose={onClose} title={h ? h.title : ''}>
      {h && (
        <>
          <p className="-mt-2 mb-4 text-[12px] font-semibold text-faint">{h.subtitle}</p>
          {h.body.map((b: any, i: number) => b.type === 'p'
            // Trusted app text (from the core), which may contain simple inline markup
            ? <p key={i} className="mb-3 text-[13px] leading-relaxed text-muted" dangerouslySetInnerHTML={{ __html: b.text }} />
            : b.type === 'rule' ? (
              <div key={i} className="mb-3 space-y-2 rounded-xl bg-sunken p-3">
                {b.items.map((it: any, j: number) => (
                  <div key={j} className="flex items-start justify-between gap-3 text-[12px]">
                    <span className="flex items-center gap-2 font-semibold text-muted"><Icon name={it.icon} size={16} />{it.label}</span>
                    <span className="num font-bold" dangerouslySetInnerHTML={{ __html: it.value }} />
                  </div>
                ))}
              </div>
            ) : <p key={i} className="mb-3 rounded-xl border border-line bg-sunken p-3 text-[12px] text-muted" dangerouslySetInnerHTML={{ __html: b.text || '' }} />)}
        </>
      )}
    </Modal>
  );
}

function RestoreDialog({ plan, onClose, onDone }: { plan: RestorePlan | { error: string } | null; onClose: () => void; onDone: (d: Done) => void }) {
  const app = useApp();
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [armed, setArmed] = useState(false);
  useEffect(() => { setMode('replace'); setArmed(false); }, [plan]);
  if (!plan) return null;
  if ('error' in plan) {
    return (
      <Modal open onClose={onClose} title="Restore from a backup">
        <div className="rounded-xl border border-danger/25 bg-danger/5 p-4">
          <p className="text-[13px] font-semibold text-danger" id="restore-error">{plan.error}</p>
          <p className="mt-1 text-[12px] text-danger/80">Nothing was changed.</p>
        </div>
        <div className="mt-5 flex justify-end"><button type="button" className="btn-outline" onClick={onClose}>Close</button></div>
      </Modal>
    );
  }
  const canMerge = plan.newCards.length > 0 || plan.newSpaces.length > 0;
  const go = () => {
    if (mode === 'replace' && !armed) { setArmed(true); return; }
    onDone(applyRestore(plan, mode));
  };
  return (
    <Modal open onClose={onClose} title="Restore from a backup" width={520}>
      <p className="mb-3 text-[13px]">Backup from <strong>{backupWhen(plan.data.exportedAt)}</strong></p>
      <dl className="divide-y divide-line border-y border-line text-[12px]">
        <div className="flex justify-between py-2"><dt className="text-faint">In the backup</dt><dd className="font-semibold">{countsText(plan.data.cards, plan.data.spaces)}</dd></div>
        <div className="flex justify-between py-2"><dt className="text-faint">In the app now</dt><dd className="font-semibold">{countsText(app.cards, app.spaces)}</dd></div>
      </dl>
      <div role="radiogroup" aria-label="How to restore" className="mt-4 space-y-2">
        {([['replace', 'Replace everything', 'Your current cards and spaces are swapped for the backup’s.'], ['merge', 'Add what’s missing', restoreMergeLine(plan.newCards, plan.newSpaces)]] as const).map(([v, t, sub]) => (
          <label key={v} className={'flex cursor-pointer items-start gap-3 rounded-xl border p-3 ' + (mode === v ? 'border-brand bg-brand/5' : 'border-line') + (v === 'merge' && !canMerge ? ' cursor-not-allowed opacity-50' : '')}>
            <input type="radio" name="restore-mode" value={v} checked={mode === v} disabled={v === 'merge' && !canMerge} onChange={() => { setMode(v); setArmed(false); }} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            <span><span className="block text-[13px] font-semibold">{t}</span><span className="mt-0.5 block text-[12px] text-faint">{sub}</span></span>
          </label>
        ))}
      </div>
      {armed && <p role="alert" className="mt-3 text-[12px] font-semibold text-danger">{restoreReplaceWarning(app.cards, app.spaces)}</p>}
      <Actions onCancel={onClose} primary={armed ? 'Yes, replace my data' : 'Restore'} onPrimary={go} danger={armed} />
    </Modal>
  );
}

function DeleteAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const u: any = currentUser();
  const prov = primaryProvider(u);
  const [typed, setTyped] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setTyped(''); setPw(''); setError(''); } }, [open]);
  async function go() {
    setBusy(true); setError('');
    const err = await deleteAccount(typed, pw);
    setBusy(false);
    if (err) { setError(err); return; }
    onClose();
    toast('Your account has been deleted.');
  }
  return (
    <Modal open={open} onClose={onClose} title="Delete your account?">
      <p className="text-[13px] text-muted">This permanently deletes your account and all your cards, spaces and settings. It can’t be undone.</p>
      <label className="mt-4 block"><span className="mb-1 block text-[12px] font-semibold text-muted">Type DELETE to confirm</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="field h-10" /></label>
      {prov === 'password' ? (
        <label className="mt-3 block"><span className="mb-1 block text-[12px] font-semibold text-muted">Your password</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" className="field h-10" /></label>
      ) : <p className="mt-3 text-[12px] text-faint">You’ll be asked to confirm with {PROVIDER_LABELS[prov] || 'your sign-in method'}.</p>}
      <ErrorLine text={error} />
      <Actions danger onCancel={onClose} primary={busy ? 'Deleting...' : 'Delete account'} onPrimary={() => { if (!busy) go(); }} />
    </Modal>
  );
}

export function Settings() {
  const app = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const { openShortcuts } = useWorkspace();
  const [theme, setThemeState] = useState<ThemeMode>(getTheme());
  const [help, setHelp] = useState<string | null>(null);
  const [plan, setPlan] = useState<RestorePlan | { error: string } | null>(null);
  const [copiesOpen, setCopiesOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [admin, setAdmin] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { isAdmin().then(setAdmin); }, []);
  // The account menu links straight to a section (#set-cbsl, #set-data)
  const loc = useLocation();
  useEffect(() => { if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 50); }, [loc.hash]);
  const u: any = currentUser();
  const prov = primaryProvider(u);
  const unverified = needsEmailVerification(u);
  const income = accountData().income ?? '';
  const dti = debtToIncome(app.cards, accountData().income || '175000');
  const tone = dti.tone === 'danger' ? 'border-danger/25 bg-danger/5 text-danger' : dti.tone === 'warn' ? 'border-warn/25 bg-warn/5 text-warn' : 'border-ok/25 bg-ok/5 text-ok';
  const show = (d: Done) => { if (d.text) toast(d.text, { tone: d.tone, action: d.undo ? { label: 'Undo', run: d.undo } : undefined }); };
  const initials = (app.profile.firstName[0] || '').toUpperCase() + (app.profile.lastName[0] || '').toUpperCase();
  const copies = copiesOpen ? safetyCopies() : [];

  return (
    <div className="mx-auto flex max-w-[1120px] gap-10 px-8 py-7">
      <nav className="sticky top-7 h-fit w-52 shrink-0" aria-label="Settings sections">
        <h1 className="mb-4 font-serif text-[30px] font-medium tracking-tight">Settings</h1>
        <ul className="space-y-0.5">
          {SECTIONS.map(([id, label, icon]) => (
            <li key={id}><a href={'#set-' + id} onClick={(e) => { e.preventDefault(); document.getElementById('set-' + id)?.scrollIntoView({ behavior: 'smooth' }); }}
              className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink"><Icon name={icon} size={18} />{label}</a></li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 space-y-8 pb-10 pt-1">
        <Section id="profile" title="Profile">
          <div className="flex items-center gap-4 px-5 py-4">
            {app.user?.photoURL
              ? <img src={app.user.photoURL} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" />
              : <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand bg-brand/10 text-[15px] font-bold text-brand-ink">{initials}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{app.profile.firstName} {app.profile.lastName}</p>
              <p className="truncate text-[12px] text-faint">{app.profile.email}</p>
              <p className="mt-0.5 text-[12px] text-faint">{u ? PROVIDER_LABELS[prov] || 'Email & password' : ''}{u ? ' · ' : ''}
                {u && <span className={'font-semibold ' + (unverified ? 'text-warn' : 'text-ok')}>{unverified ? 'Email not verified' : 'Email verified'}</span>}</p>
            </div>
            {unverified && <VerifyActions />}
          </div>
          <div className="px-5 py-4">
            <div data-tip="set-income"><label htmlFor="set-income" className="label">Monthly net take-home income</label>
            <div className="relative mt-1.5 max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-faint">LKR</span>
              <input id="set-income" type="number" min={0} value={income} placeholder="175000" onChange={(e) => setIncome(e.target.value)} onBlur={settleIncome}
                className="field num h-11 pl-12 text-[17px] font-bold" />
            </div></div>
            <div className={'mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[12px] ' + tone}>
              <span className="flex items-center gap-2"><Icon name={dti.tone === 'danger' ? 'warning' : dti.tone === 'warn' ? 'info' : 'check_circle'} size={17} />
                <span className="text-ink">Current card debt load: <strong className="num">{dti.pct}%</strong> of monthly income</span></span>
            </div>
            <p className="mt-2 text-[12px] text-faint">This percentage represents your mandatory monthly credit card payments divided by your net monthly income. It assumes you pay each card’s minimum (usually 4% of the balance). Banks use this exact ratio to determine if you can safely afford new loans or higher credit limits.</p>
          </div>
        </Section>

        <Section id="strategy" title="Default payoff method">
          <div role="radiogroup" aria-label="Payoff method" className="grid grid-cols-2 gap-3 p-4">
            {([['avalanche', 'Debt Avalanche', 'trending_down', 'Saves maximum interest (Target highest APR).', strategySavings(app.cards).label],
               ['snowball', 'Debt Snowball', 'filter_vintage', 'Quick psychological wins (Target lowest balance).', 'Speed payoff']] as [Strategy, string, string, string, string][]).map(([v, t, i, sub, chip]) => {
              const on = app.strategy === v;
              return (
                <button key={v} type="button" role="radio" aria-checked={on} onClick={() => { if (!on) setStrategy(v); }}
                  className={'relative rounded-xl border p-4 text-left transition-colors ' + (on ? 'border-2 border-brand' : 'border-line hover:bg-sunken')}>
                  {on && <Icon name="check_circle" fill className="absolute right-3 top-3 text-brand-ink" />}
                  <span className={'mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg ' + (on ? 'bg-brand text-white' : 'bg-sunken text-muted')}><Icon name={i} size={18} /></span>
                  <span className="block text-[13px] font-semibold">{t}</span>
                  <span className="mt-0.5 block text-[12px] text-faint">{sub}</span>
                  <span className="mt-2.5 inline-block rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold text-muted">{chip}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section id="appearance" title="Appearance">
          <div className="flex items-center justify-between px-5 py-4">
            <span><span className="block text-[13px] font-semibold">Theme</span><span className="block text-[12px] text-faint">Saved on this device</span></span>
            <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg bg-sunken p-0.5">
              {(['light', 'dark', 'auto'] as ThemeMode[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={theme === m} onClick={() => { setTheme(m); setThemeState(m); }}
                  className={'h-8 rounded-md px-4 text-[13px] font-semibold capitalize ' + (theme === m ? 'bg-panel text-ink shadow-card' : 'text-faint hover:text-ink')}>{m}</button>
              ))}
            </div>
          </div>
        </Section>

        <Section id="cbsl" title="Central Bank (CBSL) tariff caps">
          <Row icon="account_balance" title="Maximum credit card APR" sub="Statutory finance charge ceiling" onClick={() => setHelp('apr_profile')}
            right={<span className="num text-[15px] font-bold">28.0% <span className="text-[11px] font-normal text-faint">p.a.</span></span>} />
          <Row icon="warning" title="Usual minimum payment" sub="What most banks ask for each month" onClick={() => setHelp('min_pmt_profile')}
            right={<span className="num text-[15px] font-bold">4.0% <span className="text-[11px] font-normal text-faint">min</span></span>} />
          <p className="px-5 py-3 text-[12px] text-faint">Rates fixed under CBSL Monetary Law Act directives. Non-editable by individual cardholders to prevent miscalculated amortizations.</p>
        </Section>

        <Section id="data" title="Privacy & data management">
          <div className="flex items-center gap-3 px-5 py-3 text-[12px]">
            <Icon name="verified_user" className="text-ok" />
            <span><strong className="text-ink">Private by design</strong> <span className="text-muted">Serendib never asks for card numbers or passwords. Your data is saved to your own account only.</span></span>
          </div>
          <div data-tip="set-backup"><Row icon="download" title="Download a backup" sub="Cards, spending history and spaces, as a JSON file" onClick={() => show(downloadBackup())} /></div>
          <Row icon="upload_file" title="Restore from a backup" sub="See what’s in it before anything changes" onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Backup file"
            onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) setPlan(await readBackupFile(f)); }} />
          <Row icon="history" title="Earlier copies on this device" sub="Recover cards from a recent copy kept on this device" onClick={() => setCopiesOpen(true)} />
          <Row icon="restart_alt" title="Reset my card data" sub="Removes cards and spaces, keeps your profile" danger onClick={() => show(resetCardData())} />
        </Section>

        <Section id="account" title="Account">
          {admin && <Row icon="admin_panel_settings" title="Manage offers" sub="Review drafts and publish bank offers" onClick={() => navigate('/offers/admin')} />}
          <div data-tip="set-replay"><Row icon="school" title="Replay app guide" sub="Walk through setup and screen tips again" onClick={() => { replayGuide(); navigate('/'); }} /></div>
          <Row icon="keyboard" title="Keyboard shortcuts" sub="Ctrl K, 1 to 5, L, P, / and ?" onClick={openShortcuts} />
          <Row icon="smartphone" title="Back to classic view" sub="The phone layout, on this computer" onClick={() => { window.location.href = '/'; }} />
          {u && prov === 'password' && <Row icon="key" title="Change password" sub="We’ll email you a secure reset link" onClick={async () => { const m = await sendOwnPasswordReset(); if (m) toast(m); }} />}
          <Row icon="delete_forever" title="Delete account" sub="Permanently remove your account and data" danger onClick={() => setDeleting(true)} />
          <Row icon="logout" title="Sign out" danger onClick={() => { signOut(); }} />
        </Section>
        <p className="text-center text-[11px] text-faint">Serendib Debt Health • v2.4.1 (Build 118)<br />Compliant with Central Bank of Sri Lanka Consumer Protection Directives</p>
      </div>

      <Help k={help} onClose={() => setHelp(null)} />
      <RestoreDialog plan={plan} onClose={() => setPlan(null)} onDone={(d) => { setPlan(null); show(d); navigate('/'); }} />
      <Modal open={copiesOpen} onClose={() => setCopiesOpen(false)} title="Earlier copies">
        {copies.length ? (
          <>
            <p className="-mt-1 mb-3 text-[12px] text-faint">This device keeps its last few copies of your cards and spaces. Pick one to see what’s in it before anything changes.</p>
            <div className="space-y-2">
              {copies.map((c: any, i: number) => (
                <button key={i} type="button" onClick={() => { setCopiesOpen(false); setPlan(planFromSafetyCopy(c)); }} className="w-full rounded-xl border border-line p-3 text-left hover:bg-sunken">
                  <span className="block text-[13px] font-semibold">{safetyCopyWhen(c.at)}</span>
                  <span className="mt-0.5 block text-[12px] text-faint">{countsText(c.data.cards || [], c.data.spaces || [])}{c.reason ? ' · ' + c.reason : ''}</span>
                </button>
              ))}
            </div>
          </>
        ) : <p className="py-6 text-center text-[13px] text-faint">No earlier copies on this device yet.</p>}
      </Modal>
      <DeleteAccount open={deleting} onClose={() => setDeleting(false)} />
    </div>
  );
}
