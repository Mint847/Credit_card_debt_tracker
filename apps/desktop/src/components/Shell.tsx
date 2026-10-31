// The workspace frame: left navigation, top bar (search, Log, alerts), and the shared dialogs
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate, useMatch } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { useApp, setStrategy, signOut, downloadBackup, resetCardData, replayGuide } from '../lib/store';
import { cardName, plan, util } from '../lib/derive';
import { fmtAmt } from '../lib/format';
import { CardDot, Icon, Tip, useToast } from './ui';
import { LogDialog, type LogRequest } from './LogDialog';
import { CardDialogsProvider, useCardDialogs } from './CardDialogs';
import { AlertList, attentionCount, useAlerts } from './Alerts';
import { Welcome, Tips } from './Onboarding';
import { getTheme, setTheme, type ThemeMode } from '../lib/theme';
import { useLayout } from '../lib/layout';
import { PhoneFrame, Rail } from './MobileFrame';

interface Workspace {
  openLog: (r?: LogRequest) => void;
  openPalette: () => void;
  openShortcuts: () => void;
}
const Ctx = createContext<Workspace>({ openLog: () => {}, openPalette: () => {}, openShortcuts: () => {} });
export const useWorkspace = () => useContext(Ctx);

const NAV = [
  { to: '/', label: 'Overview', icon: 'space_dashboard', key: '1' },
  { to: '/cards', label: 'Cards', icon: 'credit_card', key: '2' },
  { to: '/activity', label: 'Activity', icon: 'receipt_long' },
  { to: '/plan', label: 'Plan', icon: 'flag' }
];
const TOOLS = [
  { to: '/simulators', label: 'Simulators', icon: 'calculate', key: '3' },
  { to: '/spaces', label: 'Spaces', icon: 'savings', key: '4' },
  { to: '/offers', label: 'Offers', icon: 'local_offer', key: '5' }
];
const SHORTCUT_ROUTES = ['/', '/cards', '/simulators', '/spaces', '/offers'];

function NavItem({ to, label, icon, kbd }: { to: string; label: string; icon: string; kbd?: string }) {
  return (
    <NavLink to={to} end={to === '/'}
      className={({ isActive }) => 'group flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ' +
        (isActive ? 'bg-brand/10 text-brand-ink' : 'text-muted hover:bg-sunken hover:text-ink')}>
      {({ isActive }) => (
        <>
          <Icon name={icon} fill={isActive} size={19} />
          <span className="flex-1">{label}</span>
          {kbd && <span className="kbd opacity-0 transition-opacity group-hover:opacity-100">{kbd}</span>}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const app = useApp();
  const navigate = useNavigate();
  const { openShortcuts } = useWorkspace();
  const toast = useToast();
  const [theme, setThemeState] = useState<ThemeMode>(getTheme());
  const initials = (app.profile.firstName[0] || '') + (app.profile.lastName[0] || '');
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-serif text-[19px] font-semibold text-white">S</span>
        <span className="font-serif text-[21px] font-medium tracking-tight">Serendib</span>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-3" aria-label="Main" data-tip="nav">
        <div className="space-y-0.5">{NAV.map((n) => <NavItem key={n.to} to={n.to} label={n.label} icon={n.icon} kbd={n.key} />)}</div>
        <p className="label mb-1.5 mt-6 px-3">Tools</p>
        <div className="space-y-0.5">{TOOLS.map((n) => <NavItem key={n.to} to={n.to} label={n.label} icon={n.icon} kbd={n.key} />)}</div>
        <p className="label mb-1.5 mt-6 px-3">Your cards</p>
        <div className="space-y-0.5">
          {app.cards.map((c) => (
            <NavLink key={c.id} to={'/cards/' + c.id}
              className={({ isActive }) => 'flex h-8 items-center gap-2.5 rounded-lg px-3 text-[12.5px] transition-colors ' + (isActive ? 'bg-sunken text-ink' : 'text-muted hover:bg-sunken hover:text-ink')}>
              <CardDot card={c} size={8} />
              <span className="flex-1 truncate">{cardName(c)}</span>
              <span className={'num text-[11px] ' + (util(c) >= 75 ? 'text-danger' : 'text-faint')}>{Math.round(util(c))}%</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="border-t border-line p-3">
        <NavItem to="/settings" label="Settings" icon="settings" />
        <Dropdown.Root>
          <Dropdown.Trigger data-tip="account" className="mt-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
            {app.user?.photoURL
              ? <img src={app.user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
              : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-[12px] font-bold text-brand-ink">{initials}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{app.profile.firstName} {app.profile.lastName}</span>
              <span className="block truncate text-[11px] text-faint">{app.profile.email}</span>
            </span>
            <Icon name="unfold_more" className="text-faint" size={18} />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content side="top" align="start" sideOffset={8} className="z-50 w-[248px] rounded-xl border border-line bg-panel p-1.5 shadow-pop">
              <MenuItem icon="person" label="Profile" onSelect={() => navigate('/settings')} />
              <MenuItem icon="flag" label="Strategy" onSelect={() => navigate('/plan')} />
              <MenuItem icon="gavel" label="CBSL rules" onSelect={() => navigate('/settings#set-cbsl')} />
              <Dropdown.Separator className="my-1 h-px bg-line" />
              <p className="label px-2.5 pb-1 pt-1.5">Appearance</p>
              <div className="flex gap-1 px-1.5 pb-1.5">
                {(['light', 'dark', 'auto'] as ThemeMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => { setTheme(m); setThemeState(m); }}
                    className={'flex-1 rounded-md py-1.5 text-[12px] font-semibold capitalize ' + (theme === m ? 'bg-brand/10 text-brand-ink' : 'text-muted hover:bg-sunken')}>{m}</button>
                ))}
              </div>
              <Dropdown.Separator className="my-1 h-px bg-line" />
              <MenuItem icon="download" label="Download a backup" onSelect={() => { const d = downloadBackup(); if (d.text) toast(d.text); }} />
              <MenuItem icon="backup" label="Backup and restore" onSelect={() => navigate('/settings#set-data')} />
              <MenuItem icon="restart_alt" label="Reset my card data" onSelect={() => { const d = resetCardData(); if (d.text) toast(d.text); }} />
              <MenuItem icon="keyboard" label="Keyboard shortcuts" kbd="?" onSelect={openShortcuts} />
              <MenuItem icon="school" label="Replay app guide" onSelect={() => { replayGuide(); navigate('/'); }} />
              <Dropdown.Separator className="my-1 h-px bg-line" />
              <MenuItem icon="logout" label="Sign out" onSelect={() => { signOut(); }} />
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </aside>
  );
}

function MenuItem({ icon, label, kbd, onSelect }: { icon: string; label: string; kbd?: string; onSelect: () => void }) {
  return (
    <Dropdown.Item onSelect={onSelect}
      className="flex h-8 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken">
      <Icon name={icon} size={18} className="text-faint" />
      <span className="flex-1">{label}</span>
      {kbd && <span className="kbd">{kbd}</span>}
    </Dropdown.Item>
  );
}

const TITLES: Record<string, string> = {
  '/': 'Overview', '/cards': 'Cards', '/activity': 'Activity', '/plan': 'Plan', '/simulators': 'Simulators',
  '/spaces': 'Spaces', '/offers': 'Offers', '/offers/admin': 'Manage offers', '/settings': 'Settings'
};

function Topbar() {
  const app = useApp();
  const { openLog, openPalette } = useWorkspace();
  const loc = useLocation();
  const cardMatch = useMatch('/cards/:id');
  const card = cardMatch ? app.cards.find((c) => c.id === cardMatch.params.id) : undefined;
  const count = attentionCount(useAlerts());
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-canvas/85 px-6 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        {card ? (
          <>
            <NavLink to="/cards" className="text-faint hover:text-ink">Cards</NavLink>
            <Icon name="chevron_right" size={16} className="text-faint" />
            <CardDot card={card} size={8} />
            <span className="truncate font-semibold">{cardName(card)}</span>
          </>
        ) : (
          <span className="font-semibold">{TITLES[loc.pathname] || ''}</span>
        )}
      </div>
      <button type="button" onClick={openPalette} data-tip="search"
        className="ml-auto flex h-9 w-[340px] items-center gap-2 rounded-lg border border-line bg-panel px-3 text-[13px] text-faint hover:border-line-strong tablet:w-[220px]">
        <Icon name="search" size={18} />
        <span className="flex-1 text-left tablet:truncate">Search cards, entries and actions</span>
        <span className="kbd tablet:hidden">Ctrl K</span>
      </button>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button type="button" className="btn-primary" data-tip="log"><Icon name="add" size={18} />Log<Icon name="expand_more" size={16} className="-mr-1 opacity-80" /></button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={6} className="z-50 w-56 rounded-xl border border-line bg-panel p-1.5 shadow-pop">
            <MenuItem icon="shopping_bag" label="Log spending" kbd="L" onSelect={() => openLog({ type: 'purchase', cardId: card?.id })} />
            <MenuItem icon="payments" label="Log a payment" kbd="P" onSelect={() => openLog({ type: 'payment', cardId: card?.id })} />
            <MenuItem icon="undo" label="Log a refund" onSelect={() => openLog({ type: 'refund', cardId: card?.id })} />
            <MenuItem icon="sms" label="Paste a bank SMS" onSelect={() => openLog({ sms: true, cardId: card?.id })} />
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      <Popover.Root>
        <Tip label="Alerts" side="bottom">
          <Popover.Trigger className="btn-ghost relative h-9 w-9 justify-center px-0" aria-label={'Alerts, ' + count}>
            <Icon name="notifications" />
            {count > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white dark:text-canvas">{count}</span>}
          </Popover.Trigger>
        </Tip>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={6} className="z-50 w-[400px] rounded-xl border border-line bg-panel shadow-pop focus:outline-none">
            <p className="border-b border-line px-4 py-3 text-[13px] font-semibold">Alerts{count > 0 ? ' · ' + count + ' Attention' : ''}</p>
            <div className="scroll-thin max-h-[460px] overflow-y-auto p-1.5"><AlertList compact /></div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </header>
  );
}

function Palette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const { openLog, openShortcuts } = useWorkspace();
  const openDialog = useCardDialogs();
  const run = (fn: () => void) => { onOpenChange(false); setTimeout(fn, 0); };
  const entries = useMemo(() => app.cards.flatMap((c) => (c.ledger || []).slice(-40).map((e) => ({ c, e }))).reverse().slice(0, 120), [app]);
  const item = 'flex h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13px] text-ink data-[selected=true]:bg-sunken';
  const group = 'px-1.5 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-[14vh] z-50 w-[600px] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-panel shadow-pop focus:outline-none tablet:top-[10vh] tablet:w-[min(600px,calc(100vw-48px))] phone:inset-x-0 phone:top-0 phone:w-auto phone:translate-x-0 phone:rounded-none phone:rounded-b-2xl phone:pt-[env(safe-area-inset-top)]">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">Jump to a page or card, find an entry, or run an action.</Dialog.Description>
          <Command loop>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Icon name="search" className="text-faint" />
              <Command.Input autoFocus placeholder="Search cards, entries and actions" className="h-12 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none" />
              <span className="kbd">Esc</span>
            </div>
            <Command.List className="scroll-thin max-h-[420px] overflow-y-auto pb-2">
              <Command.Empty className="px-4 py-8 text-center text-[13px] text-faint">Nothing found.</Command.Empty>
              <Command.Group heading="Actions" className={group}>
                <Command.Item className={item} onSelect={() => run(() => openLog({ type: 'purchase' }))}><Icon name="shopping_bag" size={18} className="text-faint" />Log spending<span className="kbd ml-auto">L</span></Command.Item>
                <Command.Item className={item} onSelect={() => run(() => openLog({ type: 'payment' }))}><Icon name="payments" size={18} className="text-faint" />Log a payment<span className="kbd ml-auto">P</span></Command.Item>
                <Command.Item className={item} onSelect={() => run(() => openLog({ sms: true }))}><Icon name="sms" size={18} className="text-faint" />Paste a bank SMS</Command.Item>
                <Command.Item className={item} onSelect={() => run(() => openDialog({ kind: 'add' }))}><Icon name="add_card" size={18} className="text-faint" />Add a card</Command.Item>
                <Command.Item className={item} onSelect={() => run(() => setStrategy(app.strategy === 'avalanche' ? 'snowball' : 'avalanche'))}>
                  <Icon name="swap_vert" size={18} className="text-faint" />Switch to {app.strategy === 'avalanche' ? 'Snowball' : 'Avalanche'} strategy
                </Command.Item>
                <Command.Item className={item} onSelect={() => run(() => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'))}><Icon name="contrast" size={18} className="text-faint" />Toggle light / dark</Command.Item>
                <Command.Item className={item} onSelect={() => run(openShortcuts)}><Icon name="keyboard" size={18} className="text-faint" />Keyboard shortcuts<span className="kbd ml-auto">?</span></Command.Item>
              </Command.Group>
              <Command.Group heading="Go to" className={group}>
                {[...NAV, ...TOOLS, { to: '/settings', label: 'Settings', icon: 'settings' }].map((n) => (
                  <Command.Item key={n.to} className={item} onSelect={() => run(() => navigate(n.to))}><Icon name={n.icon} size={18} className="text-faint" />{n.label}</Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Cards" className={group}>
                {app.cards.map((c) => (
                  <Command.Item key={c.id} value={'card ' + c.bank + ' ' + c.nick + ' ' + (c.last4 || '')} className={item} onSelect={() => run(() => navigate('/cards/' + c.id))}>
                    <CardDot card={c} />{c.bank} {c.nick}<span className="num ml-auto text-[12px] text-faint">{fmtAmt(c.balance)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Recent entries" className={group}>
                {entries.map(({ c, e }) => (
                  <Command.Item key={e.id} value={'entry ' + (e.merchant || e.type) + ' ' + e.amount + ' ' + c.nick + ' ' + e.id} className={item}
                    onSelect={() => run(() => openLog({ editing: { id: e.id, cardId: c.id } }))}>
                    <CardDot card={c} size={7} />
                    <span className="truncate">{e.merchant || (e.type === 'payment' ? 'Payment' : e.note || e.type)}</span>
                    <span className="text-[12px] text-faint">{e.date}</span>
                    <span className={'num ml-auto text-[12px] ' + (e.type === 'payment' || e.type === 'refund' ? 'text-ok' : 'text-muted')}>
                      {e.type === 'payment' || e.type === 'refund' ? '−' : ''}{fmtAmt(e.amount)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Shortcuts({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rows: [string[], string][] = [
    [['Ctrl', 'K'], 'Search and run any action'],
    [['1', '2', '3', '4', '5'], 'Overview, Cards, Simulators, Spaces, Offers'],
    [['L'], 'Log spending (on a card page: that card)'],
    [['P'], 'Log a payment'],
    [['/'], 'Search the open card’s activity'],
    [['?'], 'Show these shortcuts'],
    [['Esc'], 'Close a dialog']
  ];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-[16vh] z-50 w-[440px] -translate-x-1/2 rounded-2xl border border-line bg-panel p-6 shadow-pop focus:outline-none">
          <Dialog.Title className="mb-3 text-[15px] font-semibold">Keyboard shortcuts</Dialog.Title>
          <Dialog.Description className="sr-only">Keys that work anywhere in the app.</Dialog.Description>
          {rows.map(([keys, what]) => (
            <div key={what} className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-0">
              <span className="text-[13px]">{what}</span>
              <span className="flex gap-1">{keys.map((k) => <span key={k} className="kbd h-5">{k}</span>)}</span>
            </div>
          ))}
          <p className="mt-3 text-[11px] text-faint">Single-key shortcuts are paused while you’re typing in a field.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<LogRequest | null>(null);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const navigate = useNavigate();
  const cardMatch = useMatch('/cards/:id');
  const cardId = cardMatch?.params.id;
  // Phone and iPad designs (demo only): the phone frame, or a rail on iPads in portrait
  const layout = useLayout();
  const narrow = useNarrow();
  const ws = useMemo<Workspace>(() => ({
    openLog: (r = {}) => setLog(r),
    openPalette: () => setPalette(true),
    openShortcuts: () => setShortcuts(true)
  }), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((o) => !o); return; }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (log || palette || shortcuts || document.querySelector('[role="menu"], [role="dialog"]')) return;
      const k = e.key;
      if (k >= '1' && k <= '5') { e.preventDefault(); navigate(SHORTCUT_ROUTES[+k - 1]); }
      else if (k === 'l' || k === 'L') { e.preventDefault(); setLog({ type: 'purchase', cardId }); }
      else if (k === 'p' || k === 'P') { e.preventDefault(); setLog({ type: 'payment', cardId }); }
      else if (k === '?') { e.preventDefault(); setShortcuts(true); }
      else if (k === '/') {
        e.preventDefault();
        if (cardId) { navigate('/cards/' + cardId + '?tab=activity&search=1'); }
        else setPalette(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [log, palette, shortcuts, cardId, navigate]);

  return (
    <Ctx.Provider value={ws}>
      <CardDialogsProvider onCardAdded={(id) => navigate('/cards/' + id)} onCardDeleted={(id) => { if (cardId === id) navigate('/cards'); }}
        onLogPayment={(id, amount) => setLog({ type: 'payment', cardId: id, prefill: amount })}>
      {layout === 'phone' ? <PhoneFrame>{children}</PhoneFrame> : (
      <div className="flex h-full">
        {layout === 'tablet' && narrow ? <Rail /> : <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="scroll-thin flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      )}
      <LogDialog request={log} onClose={() => setLog(null)} />
      <Palette open={palette} onOpenChange={setPalette} />
      <Shortcuts open={shortcuts} onOpenChange={setShortcuts} />
      <Welcome />
      <Tips />
      </CardDialogsProvider>
    </Ctx.Provider>
  );
}

function useNarrow() {
  const [n, setN] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const on = () => setN(window.innerWidth < 1024);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return n;
}

// Used by pages that want this month's plan (memoised on the store version)
export function usePlan() {
  const app = useApp();
  return useMemo(() => plan(app.cards, app.strategy), [app]);
}
