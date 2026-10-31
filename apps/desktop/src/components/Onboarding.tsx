// Guided setup on every layout: the welcome (three slides ending with income and strategy), the
// "Get started" checklist and the tour (first-visit spotlight tips on each screen). The rules and flags are the
// phone app's (shared core, onboarding.js), so progress made on one device shows on the others.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import confetti from 'canvas-confetti';
import { checklistState, isValidDay } from '@serendib/core';
import { useApp, onboarding, finishWelcome, skipWelcome, dismissChecklist, noteChecklistComplete, markTipsSeen, skipAllTips } from '../lib/store';
import { Icon, useToast } from './ui';
import { useLayout, type Layout } from '../lib/layout';
import { useCardDialogs } from './CardDialogs';
import type { Strategy } from '../lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── 1. Welcome ── */
export function Welcome() {
  const app = useApp();
  const navigate = useNavigate();
  const o = onboarding();
  const open = app.status === 'ready' && !!o && !!o.version && !o.welcomeDone;
  const [slide, setSlide] = useState(0);
  const [income, setIncome] = useState('');
  const [strategy, setStrategy] = useState<Strategy>(app.strategy);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setSlide(0); setError(''); setStrategy(app.strategy);
    setIncome(o.incomeSet && app.profile.income ? app.profile.income : '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const finish = () => {
    const err = finishWelcome(income, strategy);
    if (err) { setError(err); return; }
    navigate('/');
  };
  const skip = () => { skipWelcome(); navigate('/'); };
  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) skip(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[3px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[860px] -translate-x-1/2 -translate-y-1/2 grid-cols-[320px_1fr] overflow-hidden rounded-3xl border border-line bg-panel shadow-pop focus:outline-none tablet:w-[min(860px,calc(100vw-48px))] tablet:grid-cols-[260px_1fr] phone:inset-x-0 phone:bottom-0 phone:left-0 phone:top-auto phone:max-h-[92vh] phone:w-full phone:translate-x-0 phone:translate-y-0 phone:grid-cols-1 phone:overflow-y-auto phone:rounded-b-none phone:pb-[env(safe-area-inset-bottom)]">
          <div className="relative flex flex-col justify-between overflow-hidden p-8 text-white phone:hidden" style={{ background: 'linear-gradient(160deg, #00473c 0%, #006b5c 55%, #008374 100%)' }}>
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-serif text-[18px] font-semibold text-[#006b5c]">S</span>
              <span className="font-serif text-[20px]">Serendib</span>
            </div>
            <div className="relative">
              <Icon name={['account_balance_wallet', 'flag', 'tune'][slide]} size={44} className="opacity-90" />
              <p className="mt-3 text-[13px] text-white/75">Step {slide + 1} of 3</p>
              <div className="mt-2 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={'h-1.5 rounded-full transition-all ' + (i === slide ? 'w-6 bg-white' : 'w-1.5 bg-white/40')} />)}</div>
            </div>
          </div>
          <div className="flex min-h-[440px] flex-col p-8 phone:min-h-0 phone:p-5">
            <div className="flex items-center justify-end phone:justify-between">
              <div className="hidden items-center gap-1.5 phone:flex" aria-label={'Step ' + (slide + 1) + ' of 3'}>{[0, 1, 2].map((i) => <span key={i} className={'h-1.5 rounded-full transition-all ' + (i === slide ? 'w-6 bg-brand' : 'w-1.5 bg-line-strong')} />)}</div>
              <button type="button" onClick={skip} className="text-[12px] font-semibold text-faint hover:text-ink phone:py-2">Skip for now</button>
            </div>
            <div className="flex-1">
              {slide === 0 && (
                <>
                  <Dialog.Title className="font-serif text-[28px] font-medium leading-tight">See all your card debt in one place</Dialog.Title>
                  <Dialog.Description className="mt-2 text-[14px] text-muted">Link your credit cards and Serendib keeps a live picture of what you owe.</Dialog.Description>
                  <ul className="mt-6 space-y-3 text-[14px]">
                    {[['donut_large', 'Total debt & utilisation', ' across every card'], ['trending_down', 'Interest this month', ', so you can see what your debt costs'], ['notifications', 'Due-date alerts', ' once you set each card’s billing cycle']].map(([i, b, t]) => (
                      <li key={b} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-ink"><Icon name={i} size={19} /></span><span><strong>{b}</strong>{t}</span></li>
                    ))}
                  </ul>
                </>
              )}
              {slide === 1 && (
                <>
                  <Dialog.Title className="font-serif text-[28px] font-medium leading-tight">Pay the right card first</Dialog.Title>
                  <Dialog.Description className="mt-2 text-[14px] text-muted">Each month Serendib splits a safe repayment budget across your cards. You’ll find it on the Plan page.</Dialog.Description>
                  <ol className="mt-6 space-y-3 text-[14px]">
                    {[<>Every card gets at least its <strong>minimum payment</strong>.</>, <>The rest goes to one <strong>priority card</strong>, chosen by your strategy.</>, <>When it’s cleared, the money <strong>rolls on to the next card</strong>.</>].map((t, i) => (
                      <li key={i} className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">{i + 1}</span><span>{t}</span></li>
                    ))}
                  </ol>
                </>
              )}
              {slide === 2 && (
                <>
                  <Dialog.Title className="font-serif text-[28px] font-medium leading-tight">Personalise your plan</Dialog.Title>
                  <Dialog.Description className="mt-2 text-[14px] text-muted">Two answers and your repayment plan is ready. You can change both later in Settings.</Dialog.Description>
                  <label htmlFor="ob-income" className="mt-6 block text-[12px] font-semibold text-muted">Monthly take-home income</label>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-faint">LKR</span>
                    <input id="ob-income" type="number" min={0} value={income} onChange={(e) => setIncome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') finish(); }}
                      className="field num h-11 pl-12 text-[16px] font-bold" placeholder="175000" />
                  </div>
                  <p className="mt-1 text-[12px] text-faint">Sets a safe repayment budget (25% of income) and your debt-to-income score.</p>
                  <p className="mt-5 text-[12px] font-semibold text-muted">Payoff strategy</p>
                  <div role="radiogroup" aria-label="Payoff strategy" className="mt-1.5 grid grid-cols-2 gap-2">
                    {([['avalanche', 'Avalanche', 'Highest interest first. Saves the most money.'], ['snowball', 'Snowball', 'Smallest balance first. Quickest wins.']] as [Strategy, string, string][]).map(([v, t, sub]) => (
                      <button key={v} type="button" role="radio" aria-checked={strategy === v} onClick={() => setStrategy(v)}
                        className={'rounded-xl border p-3 text-left ' + (strategy === v ? 'border-2 border-brand bg-brand/5' : 'border-line hover:bg-sunken')}>
                        <span className="block text-[13px] font-semibold">{t}</span><span className="mt-0.5 block text-[12px] text-faint">{sub}</span>
                      </button>
                    ))}
                  </div>
                  {error && <p role="alert" className="mt-3 text-[12px] font-semibold text-danger">{error}</p>}
                </>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setSlide(Math.max(0, slide - 1))} className={'btn-ghost ' + (slide === 0 ? 'invisible' : '')}>Back</button>
              <button type="button" autoFocus className="btn-primary h-10 px-6 phone:h-11" onClick={() => (slide < 2 ? setSlide(slide + 1) : finish())}>{slide === 2 ? 'Finish setup' : 'Next'}</button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ── 2. Get started checklist (on the Overview) ── */
export function Checklist() {
  const app = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const openDialog = useCardDialogs();
  const o = onboarding();
  const st = o ? checklistState(o, app.cards, app.spaces) : null;
  const [celebrateUntil, setCelebrateUntil] = useState(0);
  useEffect(() => {
    if (!st || st.hidden || !st.allDone) return;
    if (noteChecklistComplete()) {
      setCelebrateUntil(Date.now() + 6000);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        confetti({ particleCount: 90, spread: 75, gravity: 1.1, origin: { y: 0.25, x: 0.5 }, colors: ['#10b981', '#34d399', '#FFD700', '#4ECDC4'] });
      }
      setTimeout(() => setCelebrateUntil(0), 6100);
    }
  }, [st && st.allDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st || st.hidden) return null;
  if (o.checklistCompleted && Date.now() >= celebrateUntil) return null;
  const go = (key: string) => {
    if (key === 'income') navigate('/settings#set-profile');
    else if (key === 'strategy') navigate('/settings#set-strategy');
    else if (key === 'card') openDialog({ kind: 'add' });
    else if (key === 'billing') {
      const c = app.cards.find((x) => !(isValidDay(x.statementDay) && isValidDay(x.dueDay)));
      if (!c) openDialog({ kind: 'add' }); else { navigate('/cards/' + c.id); openDialog({ kind: 'billing', cardId: c.id }); }
    } else if (key === 'sim') navigate('/simulators');
    else if (key === 'buffer') navigate('/spaces?create=1');
  };
  return (
    <section className="panel" data-tip="checklist" aria-label="Get started">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <div>
          <h2 className="text-[14px] font-semibold">{st.title}</h2>
          <p className="text-[12px] text-faint">{st.progress}</p>
        </div>
        {!st.allDone && <button type="button" className="btn-ghost h-8 text-[12px]" onClick={() => toast(dismissChecklist())}>Hide</button>}
      </div>
      <div className="mx-5 h-1.5 overflow-hidden rounded-full bg-sunken"><div className="meter-reveal h-full rounded-full bg-ok transition-all" style={{ width: st.pct + '%' }} /></div>
      <ul className="grid grid-cols-3 gap-1 p-3 tablet:grid-cols-2 phone:grid-cols-1 phone:p-2">
        {st.items.map((it: any) => (
          <li key={it.key}>
            <button type="button" disabled={it.done} onClick={() => go(it.key)}
              className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ' + (it.done ? 'cursor-default' : 'hover:bg-sunken')}>
              <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ' + (it.done ? 'bg-ok text-white' : 'border-2 border-line-strong text-transparent')}><Icon name="check" size={15} /></span>
              <span className="min-w-0">
                <span className="sr-only">{it.done ? 'Done: ' : 'To do: '}</span>
                <span className={'block truncate text-[13px] font-semibold ' + (it.done ? 'text-faint line-through' : '')}>{it.label}</span>
                {!it.done && <span className="block truncate text-[11px] text-faint">{it.hint}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 3. The tour: first-visit spotlight tips on each screen ── */
// Each tip lights up one element (the first [data-tip="…"] showing in this layout) and says what it's for.
// body is the computer wording; touch is for phones and iPads (tap, no keyboard); phone is for phones
// only (the tab bar and the + button). Tips whose element isn't showing (another layout, or nothing
// added yet) are left out.
interface Tip { tip: string; title: string; body: string; touch?: string; phone?: string }
const TIPS: Record<string, Tip[]> = {
  'tour-home': [
    { tip: 'checklist', title: 'Your setup checklist', body: 'Six steps that build your repayment plan. Click a step to do it now. Each one ticks itself off as you go.',
      touch: 'Six steps that build your repayment plan. Tap a step to do it now. Each one ticks itself off as you go.' },
    { tip: 'kpis', title: 'Your debt at a glance', body: 'What you owe across every card, how much of your limits you’re using (under 30% is healthy), this month’s payments, what the interest costs you and your debt-free date.' },
    { tip: 'payoff', title: 'Your payoff pace', body: 'How fast your debt comes down on your plan, compared with paying only the minimums.' },
    { tip: 'alerts', title: 'What needs you', body: 'Due dates, overdue payments, budgets you’ve gone over and charges due tomorrow show up here, each with a label saying what it is.' },
    { tip: 'fold-alerts', title: 'Fold away any section', body: 'Click a section’s title to fold it away. It stays folded on this computer and shows a one-line summary, like the next due date or what you’ve spent.',
      touch: 'Tap a section’s title to fold it away. It stays folded on this device and shows a one-line summary, like the next due date or what you’ve spent.' },
    { tip: 'home-plan', title: 'This month’s plan', body: 'Which card to pay first and what each card gets this month. Click Open plan to see the full split, switch strategy and log the payment.',
      touch: 'Which card to pay first and what each card gets this month. Tap Open plan to see the full split, switch strategy and log the payment.',
      phone: 'Which card to pay first and what each card gets this month. Tap Open plan, or Plan in the tab bar, to see the full split and log the payment.' },
    { tip: 'home-recent', title: 'Your latest entries', body: 'The newest purchases, payments and refunds across all your cards. Click View all to open Activity, where you can search, filter and export every entry.',
      touch: 'The newest purchases, payments and refunds across all your cards. Tap View all to open Activity, where you can search and filter every entry.',
      phone: 'The newest purchases, payments and refunds across all your cards. Tap View all, or Activity under More, to search and filter every entry.' },
    { tip: 'log', title: 'Log anything', body: 'Record a purchase, a payment or a refund, or paste a bank SMS and Serendib fills it in. Press L or P to start one from anywhere.',
      touch: 'Record a purchase, a payment or a refund, or paste a bank SMS and Serendib fills it in.',
      phone: 'Tap + to record a purchase, a payment or a refund, or paste a bank SMS and Serendib fills it in.' },
    { tip: 'search', title: 'Search everything', body: 'Press Ctrl K to jump to any card, entry or page, or run an action. Press ? to see every keyboard shortcut.',
      touch: 'Find any card, entry or page, or run an action, from here.' },
    { tip: 'nav', title: 'Find your way around', body: 'Overview, Cards, Activity and Plan, then your tools: Simulators, Spaces and Offers. Your cards are listed underneath with how much of each limit you’re using. Press 1 to 5 to jump between pages.',
      touch: 'Every page is one tap away here.',
      phone: 'Overview, Cards and Plan are one tap away. Tap More for Activity, Simulators, Spaces, Offers and Settings.' },
    { tip: 'account', title: 'Your account', body: 'Your profile, light or dark mode, backups, keyboard shortcuts, this guide and signing out.',
      touch: 'Your profile, light or dark mode, backups, this guide and signing out.' }
  ],
  'tour-cards': [
    { tip: 'cards-table', title: 'All your cards', body: 'Sort by any column. Click a card to see its details on the right, or double-click to open it.',
      touch: 'Each card’s balance, what your plan puts on it this month and how much of its limit you’re using. Tap a card to open it.' },
    { tip: 'add-card', title: 'Link a card', body: 'Add each credit card with its limit and current balance. Everything else updates from here.' }
  ],
  'tour-card': [
    { tip: 'card-stats', title: 'This card at a glance', body: 'Its balance, how much of the limit you’re using, what’s due now and by when, and what your plan puts on it this month.' },
    { tip: 'card-log', title: 'Log on this card', body: 'Log spending or a payment on this card. A payment starts with what’s due now filled in.' },
    { tip: 'card-menu', title: 'More for this card', body: 'Edit the card, set its billing cycle, match a statement, set category budgets, share your progress, clear the balance or delete it.' },
    { tip: 'card-tabs', title: 'Everything for this card', body: 'Its activity, recurring payments, budgets, calculators and statements, one tab each.',
      phone: 'Its activity, recurring payments, budgets, calculators and statements, one tab each. Swipe the tabs sideways to see them all.' },
    { tip: 'card-cycle', title: 'This statement cycle', body: 'What you’ve spent and paid since the last statement, by category, and how long until the next one. Set a billing cycle to get due-date alerts.' }
  ],
  'tour-activity': [
    { tip: 'activity-filters', title: 'Find any entry', body: 'Search by shop or note, and filter by card, type, category or dates. Pick one card to export its history as a CSV file.' },
    { tip: 'activity-list', title: 'Every entry, every card', body: 'Newest first. Click an entry to change or delete it.', touch: 'Newest first. Tap an entry to change or delete it.' },
    { tip: 'paste-sms', title: 'Paste a bank SMS', body: 'Copy the SMS your bank sends after a purchase and paste it here. Serendib fills in the amount, the shop and the card.' }
  ],
  'tour-plan': [
    { tip: 'plan-alloc', title: 'This month’s split', body: 'Every card gets at least its minimum. Everything left goes to the pay-first card at the top, picked by your strategy. When it’s cleared, the money rolls on to the next card.' },
    { tip: 'plan-pay', title: 'Log this month’s payment', body: 'Paid what the plan suggests? Log it on the pay-first card in one step, with the amount filled in.' },
    { tip: 'plan-strategy', title: 'Avalanche or Snowball', body: 'Avalanche clears the highest interest first and saves the most. Snowball clears the smallest balance first for quicker wins. Switch any time and the plan updates straight away.' },
    { tip: 'plan-budget', title: 'Your monthly budget', body: 'A quarter of your take-home income, raised if your saved card targets need more. Change your income in Settings.' }
  ],
  'tour-simulators': [
    { tip: 'sim-tabs', title: 'Three sandboxes', body: 'The minimum payment trap, what a cash advance really costs, and the interest hidden in a “0%” instalment plan.' },
    { tip: 'sim-source', title: 'Start from your card', body: 'Load one of your cards to use its real balance and rate, or pick Custom Scenario and try any numbers.' }
  ],
  'tour-spaces': [
    { tip: 'add-space', title: 'Build a buffer', body: 'Create a savings space for emergencies or a goal, so a surprise bill doesn’t land on a credit card.' },
    { tip: 'spaces-total', title: 'Everything you’ve saved', body: 'The total across your spaces and how close you are to their goals.' },
    { tip: 'space-list', title: 'Your spaces', body: 'Click a space to see its history, add money, withdraw it or use it to pay a card.',
      touch: 'Tap a space to see its history, add money, withdraw it or use it to pay a card.' }
  ],
  'tour-offers': [
    { tip: 'offers-mode', title: 'Card offers', body: 'Promotions for the cards you have. Switch to Explore all to see every bank’s.' },
    { tip: 'offers-cats', title: 'Pick a category', body: 'Show one kind of offer at a time. Each one shows how many offers it has.' },
    { tip: 'offers-list', title: 'Read the terms first', body: 'Click Terms on any offer to see its conditions before you use it.',
      touch: 'Tap Terms on any offer to see its conditions before you use it.' }
  ],
  'tour-settings': [
    { tip: 'set-nav', title: 'Every setting', body: 'Jump to your profile, payoff method, appearance, the CBSL rules, your data or your account.' },
    { tip: 'set-income', title: 'Your income', body: 'Your monthly take-home pay. A quarter of it becomes your repayment budget, and it sets your debt-to-income score.' },
    { tip: 'set-strategy', title: 'Payoff method', body: 'Switch between Avalanche and Snowball any time. Your plan updates straight away.' },
    { tip: 'set-appearance', title: 'Light or dark', body: 'Choose Light, Dark or Auto, which follows your device. It’s saved on this device.' },
    { tip: 'set-backup', title: 'Back up your data', body: 'Download a copy of your cards, spending and spaces, and restore it if you ever need to.' },
    { tip: 'set-replay', title: 'Need a refresher?', body: 'Replay the welcome and this tour from here whenever you like.' }
  ]
};
const PAGES: Record<string, string> = {
  '/': 'tour-home', '/cards': 'tour-cards', '/activity': 'tour-activity', '/plan': 'tour-plan', '/simulators': 'tour-simulators',
  '/spaces': 'tour-spaces', '/offers': 'tour-offers', '/settings': 'tour-settings'
};
const screenFor = (path: string): string | null => PAGES[path] || (/^\/cards\/[^/]+$/.test(path) ? 'tour-card' : null);

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function showing(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}
function target(t: Tip): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>('[data-tip="' + t.tip + '"]')].find(showing) || null;
}
// Another dialog, sheet or menu is open (the tour itself is marked data-tips)
const otherOverlay = () => !!document.querySelector('[role=dialog]:not([data-tips]), [role=menu]');

export function Tips() {
  const app = useApp();
  const loc = useLocation();
  const layout = useLayout();
  const o = onboarding();
  const screen = screenFor(loc.pathname);
  const ready = app.status === 'ready' && !!o && !!o.version && !!o.welcomeDone && !!screen && !o.tipsSeen[screen];
  const [queue, setQueue] = useState<Tip[]>([]);
  const [i, setI] = useState(0);
  // Start once the screen has settled and nothing else is open
  useEffect(() => {
    setQueue([]); setI(0);
    if (!ready) return;
    let t = 0;
    const start = () => {
      if (otherOverlay()) { t = window.setTimeout(start, 600); return; }
      const q = (TIPS[screen!] || []).filter((x) => target(x));
      if (q.length) setQueue(q); // nothing to point at yet: try again next visit
    };
    t = window.setTimeout(start, 700);
    return () => clearTimeout(t);
  }, [ready, screen]);
  if (!ready || !queue.length) return null;
  const done = () => { markTipsSeen(screen!); setQueue([]); };
  return (
    <Spotlight key={screen} tips={queue} i={i} layout={layout}
      onNext={() => (i < queue.length - 1 ? setI(i + 1) : done())} onBack={() => setI(Math.max(0, i - 1))}
      onClose={done} onSkip={() => { skipAllTips(); setQueue([]); }} />
  );
}

function Spotlight({ tips, i, layout, onNext, onBack, onClose, onSkip }: { tips: Tip[]; i: number; layout: Layout; onNext: () => void; onBack: () => void; onClose: () => void; onSkip: () => void }) {
  const tip = tips[i];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [shown, setShown] = useState(false); // the card fades in once its element has stopped moving
  const [glide, setGlide] = useState(false);
  const [size, setSize] = useState({ w: 320, h: 170 });
  const card = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const actions = useRef({ onNext, onBack, onClose });
  actions.current = { onNext, onBack, onClose };

  // Focus goes back where it was when the tour ends
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => { if (before && before.isConnected) before.focus({ preventScroll: true }); };
  }, []);

  // Each tip: scroll its element into view, follow it every frame (it may move as data loads, the page
  // scrolls or the iPad turns), and show the card when it has settled
  useEffect(() => {
    let el = target(tip);
    if (!el) { actions.current.onNext(); return; }
    const gliding = i > 0 && !reducedMotion();
    setShown(false);
    setGlide(gliding);
    // Tall elements scroll their top into view (centring would push the top off screen)
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.5;
    const scrolled = el, margin = el.style.scrollMarginTop;
    if (tall) el.style.scrollMarginTop = '16px';
    try { el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: tall ? 'start' : 'center' }); } catch (e) { /* old browsers */ }
    let raf = 0, last = '', still = 0, settled = false, moved = 0;
    const started = Date.now();
    const frame = () => {
      if (!el!.isConnected || !showing(el!)) el = target(tip) || el;
      const r = el!.getBoundingClientRect();
      const key = [r.top, r.left, r.width, r.height, window.innerWidth, window.innerHeight].map(Math.round).join();
      const now = Date.now();
      if (key !== last) { last = key; still = 0; moved = now; setRect(r); } else still++;
      // Settled: the element has stopped moving and the spotlight has finished gliding onto it (1.5 s at most)
      if (!settled && ((still >= 4 && (!gliding || now - moved >= 280)) || now - started > 1500)) {
        settled = true;
        setGlide(false);
        setShown(true);
        nextBtn.current?.focus({ preventScroll: true });
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      if (tall) setTimeout(() => { scrolled.style.scrollMarginTop = margin; }, 1300);
    };
  }, [tip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keys: Esc ends the tour, the arrow keys step through it, Tab stays inside the card. Nothing reaches
  // the app's own shortcuts while the tour is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); actions.current.onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); actions.current.onNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); actions.current.onBack(); }
      else if (e.key === 'Tab' && card.current) {
        const f = [...card.current.querySelectorAll<HTMLElement>('button')];
        const at = f.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') e.preventDefault();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  // The card's real size, for placing it (it changes with the wording, and when the font loads)
  useLayoutEffect(() => {
    const c = card.current;
    if (c && (c.offsetWidth !== size.w || c.offsetHeight !== size.h)) setSize({ w: c.offsetWidth, h: c.offsetHeight });
  });
  useEffect(() => {
    if (!rect || !card.current || !window.ResizeObserver) return;
    const c = card.current;
    const ro = new ResizeObserver(() => setSize((s) => (s.w === c.offsetWidth && s.h === c.offsetHeight ? s : { w: c.offsetWidth, h: c.offsetHeight })));
    ro.observe(c);
    return () => ro.disconnect();
  }, [!!rect]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rect) return null;
  const vw = window.innerWidth, vh = window.innerHeight, pad = 6, edge = 3, gap = 14;
  const sTop = Math.max(edge, rect.top - pad), sLeft = Math.max(edge, rect.left - pad);
  let sBottom = Math.max(sTop + 12, Math.min(vh - edge, rect.bottom + pad));
  const sRight = Math.max(sLeft + 12, Math.min(vw - edge, rect.right + pad));
  // No room for the card above or below (a tall element, a small phone): light the element from its top
  // down and keep the card underneath
  const need = size.h + gap + 8;
  if (vh - sBottom < need && sTop < need) sBottom = Math.max(sTop + 48, vh - need);
  const below = vh - sBottom >= need || vh - sBottom >= sTop;
  const top = Math.max(8, Math.min(vh - size.h - 8, below ? sBottom + gap : sTop - gap - size.h));
  const W = Math.min(340, vw - 32);
  const left = Math.max(16, Math.min(vw - W - 16, rect.left + rect.width / 2 - W / 2));
  const arrow = Math.max(16, Math.min(W - 28, rect.left + rect.width / 2 - left - 6));
  const multi = tips.length > 1, lastTip = i === tips.length - 1;
  const text = (layout === 'phone' && tip.phone) || (layout !== 'desktop' && tip.touch) || tip.body;
  return (
    <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true" data-tips={tip.tip} aria-labelledby="tour-title" aria-describedby="tour-body">
      {/* Blocks the page while the tour is open */}
      <div className="absolute inset-0" />
      <div className={'tour-spot' + (glide ? ' tour-spot-move' : '')} style={{ top: sTop, left: sLeft, width: sRight - sLeft, height: sBottom - sTop }} />
      <div ref={card} className={'absolute rounded-2xl border border-line bg-panel p-4 shadow-pop transition-[opacity,transform] duration-200 motion-reduce:transition-none ' + (shown ? 'opacity-100' : 'translate-y-1 opacity-0')}
        style={{ left, top, width: W }}>
        <span aria-hidden="true" className={'absolute h-3 w-3 rotate-45 border-line bg-panel ' + (below ? '-top-[7px] border-l border-t' : '-bottom-[7px] border-b border-r')} style={{ left: arrow }} />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">{multi ? (i + 1) + ' of ' + tips.length : 'Tip'}</span>
          {multi && <button type="button" onClick={onSkip} className="-my-2 -mr-2 rounded-full px-2 py-2 text-[12px] font-semibold text-faint hover:text-ink">Skip tour</button>}
        </div>
        <h3 id="tour-title" className="mt-1 text-[15px] font-semibold">{tip.title}</h3>
        <p id="tour-body" className="mt-1 text-[13px] leading-relaxed text-muted">{text}</p>
        <div className="mt-3.5 flex items-center justify-between gap-2">
          {multi ? (
            <span className="flex gap-1" aria-hidden="true">{tips.map((_, k) => <span key={k} className={'h-1.5 rounded-full transition-all ' + (k === i ? 'w-4 bg-brand' : 'w-1.5 bg-line-strong')} />)}</span>
          ) : <span />}
          <span className="flex gap-1.5">
            {i > 0 && <button type="button" className="btn-ghost h-9" onClick={onBack}>Back</button>}
            <button ref={nextBtn} type="button" className="btn-primary h-9 px-5" onClick={onNext}>{lastTip ? 'Got it' : 'Next'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
