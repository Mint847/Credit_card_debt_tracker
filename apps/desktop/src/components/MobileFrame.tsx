// The phone and iPad frames around the same pages as the desktop workspace.
// Phone: a top bar (search, alerts, account), the page, and a tab bar with Log in the middle; menus
// open as bottom sheets. iPad portrait: a labelled icon rail instead of the desktop sidebar.
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useApp, signOut, downloadBackup, resetCardData, replayGuide } from '../lib/store';
import { cardName } from '../lib/derive';
import { getTheme, setTheme, type ThemeMode } from '../lib/theme';
import { CardDot, Icon, Segmented, useToast } from './ui';
import { Sheet, SheetGroup, SheetItem } from './Sheet';
import { AlertList, attentionCount, useAlerts } from './Alerts';
import { useWorkspace } from './Shell';

const MORE = [
  { to: '/activity', label: 'Activity', icon: 'receipt_long', sub: 'Every card’s entries in one place' },
  { to: '/simulators', label: 'Simulators', icon: 'calculate', sub: 'Minimums, cash advances, 0% plans' },
  { to: '/spaces', label: 'Spaces', icon: 'savings', sub: 'Savings for goals and emergencies' },
  { to: '/offers', label: 'Offers', icon: 'local_offer', sub: 'Card deals for your banks' },
  { to: '/settings', label: 'Settings', icon: 'settings', sub: 'Profile, backups, appearance' }
];

function Avatar({ size = 32 }: { size?: number }) {
  const app = useApp();
  const initials = (app.profile.firstName[0] || '') + (app.profile.lastName[0] || '');
  return app.user?.photoURL
    ? <img src={app.user.photoURL} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <span className="flex items-center justify-center rounded-full bg-brand/15 font-bold text-brand-ink" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>;
}

// The account sheet: the desktop sidebar's account menu
export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [theme, setThemeState] = useState<ThemeMode>(getTheme());
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <Sheet open={open} onClose={onClose} title="Account">
      <div className="mx-5 mb-2 flex items-center gap-3 rounded-2xl bg-sunken p-3.5">
        <Avatar size={44} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{app.profile.firstName} {app.profile.lastName}</p>
          <p className="truncate text-[12px] text-faint">{app.profile.email}</p>
        </div>
      </div>
      <SheetGroup>
        <SheetItem icon="person" label="Profile & settings" onClick={() => go('/settings')} />
        <SheetItem icon="flag" label="Payoff strategy" onClick={() => go('/plan')} />
        <SheetItem icon="gavel" label="CBSL rules" onClick={() => go('/settings#set-cbsl')} />
      </SheetGroup>
      <div className="flex items-center justify-between px-5 py-2.5">
        <span className="text-[14px] font-semibold">Appearance</span>
        <Segmented size="sm" value={theme} onChange={(m) => { setTheme(m); setThemeState(m); }}
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'auto', label: 'Auto' }]} />
      </div>
      <SheetGroup>
        <SheetItem icon="download" label="Download a backup" onClick={() => { onClose(); const d = downloadBackup(); if (d.text) toast(d.text); }} />
        <SheetItem icon="school" label="Replay app guide" onClick={() => { onClose(); replayGuide(); navigate('/'); }} />
      </SheetGroup>
      <div className="mx-5 my-1 h-px bg-line" />
      <SheetGroup>
        <SheetItem icon="restart_alt" label="Reset my card data" danger onClick={() => { onClose(); const d = resetCardData(); if (d.text) toast(d.text); }} />
        <SheetItem icon="logout" label="Sign out" danger onClick={() => { onClose(); signOut(); }} />
      </SheetGroup>
      <p className="flex items-start gap-1.5 px-5 pb-1 pt-2 text-[11px] text-faint"><Icon name="lock" size={14} className="text-brand-ink" />Private by design. Serendib never asks for card numbers or passwords.</p>
    </Sheet>
  );
}

function LogSheet({ open, onClose, cardId }: { open: boolean; onClose: () => void; cardId?: string }) {
  const { openLog } = useWorkspace();
  const run = (r: Parameters<typeof openLog>[0]) => { onClose(); setTimeout(() => openLog(r), 120); };
  return (
    <Sheet open={open} onClose={onClose} title="Log">
      <SheetGroup>
        <SheetItem icon="shopping_bag" tone="brand" label="Log spending" sub="A purchase on one of your cards" onClick={() => run({ type: 'purchase', cardId })} />
        <SheetItem icon="payments" label="Log a payment" sub="Money you paid to a card" onClick={() => run({ type: 'payment', cardId })} />
        <SheetItem icon="undo" label="Log a refund" sub="Money a shop gave back" onClick={() => run({ type: 'refund', cardId })} />
        <SheetItem icon="sms" label="Paste a bank SMS" sub="Fills in the amount, shop and card" onClick={() => run({ sms: true, cardId })} />
      </SheetGroup>
    </Sheet>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title="More">
      <SheetGroup>
        {MORE.map((m) => <SheetItem key={m.to} icon={m.icon} label={m.label} sub={m.sub} onClick={() => { onClose(); navigate(m.to); }} />)}
      </SheetGroup>
    </Sheet>
  );
}

function AlertsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const count = attentionCount(useAlerts());
  return (
    <Sheet open={open} onClose={onClose} title={'Alerts' + (count > 0 ? ' · ' + count + ' Attention' : '')}>
      <div className="px-2 pb-2" onClick={(e) => { if ((e.target as HTMLElement).closest('button, a')) onClose(); }}><AlertList /></div>
    </Sheet>
  );
}

function TabButton({ to, label, icon, active, onClick }: { to?: string; label: string; icon: string; active: boolean; onClick?: () => void }) {
  const inner = (
    <>
      <span className={'flex h-7 w-14 items-center justify-center rounded-full transition-colors ' + (active ? 'bg-brand/10 text-brand-ink' : 'text-faint')}>
        <Icon name={icon} fill={active} size={22} />
      </span>
      <span className={'text-[11px] font-semibold ' + (active ? 'text-ink' : 'text-faint')}>{label}</span>
    </>
  );
  const cls = 'flex flex-1 flex-col items-center gap-0.5 pt-2';
  return to ? <NavLink to={to} end={to === '/'} className={cls} aria-current={active ? 'page' : undefined}>{inner}</NavLink>
    : <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const app = useApp();
  const loc = useLocation();
  const navigate = useNavigate();
  const { openPalette } = useWorkspace();
  const cardMatch = useMatch('/cards/:id');
  const card = cardMatch ? app.cards.find((c) => c.id === cardMatch.params.id) : undefined;
  const count = attentionCount(useAlerts());
  const [sheet, setSheet] = useState<null | 'log' | 'more' | 'account' | 'alerts'>(null);
  const close = () => setSheet(null);
  const path = loc.pathname;
  const inMore = MORE.some((m) => path.startsWith(m.to));
  const sub = MORE.find((m) => path.startsWith(m.to));
  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-30 flex h-[calc(56px+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b border-line bg-canvas/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        {card || sub ? (
          <button type="button" onClick={() => { if (card) navigate('/cards'); else if (window.history.length > 1) navigate(-1); else navigate('/'); }} className="btn-ghost h-10 w-10 justify-center px-0" aria-label="Back"><Icon name="arrow_back" /></button>
        ) : (
          <span className="ml-2 mr-1 flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-serif text-[19px] font-semibold text-white">S</span>
        )}
        <div className="min-w-0 flex-1">
          {card ? <p className="flex items-center gap-2 truncate text-[15px] font-semibold"><CardDot card={card} size={9} />{cardName(card)}</p>
            : sub ? <p className="truncate text-[15px] font-semibold">{sub.label}</p>
            : <p className="font-serif text-[21px] font-medium tracking-tight">Serendib</p>}
        </div>
        <button type="button" onClick={openPalette} data-tip="search" className="btn-ghost h-10 w-10 justify-center px-0" aria-label="Search"><Icon name="search" /></button>
        <button type="button" onClick={() => setSheet('alerts')} className="btn-ghost relative h-10 w-10 justify-center px-0" aria-label={'Alerts, ' + count}>
          <Icon name="notifications" />
          {count > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white dark:text-canvas">{count}</span>}
        </button>
        <button type="button" onClick={() => setSheet('account')} className="ml-0.5 mr-1 rounded-full" aria-label="Account"><Avatar size={32} /></button>
      </header>
      <main className="scroll-thin flex-1 overflow-y-auto pb-24">{children}</main>
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex h-[62px] max-w-md items-stretch">
          <TabButton to="/" label="Overview" icon="space_dashboard" active={path === '/'} />
          <TabButton to="/cards" label="Cards" icon="credit_card" active={path.startsWith('/cards')} />
          <div className="flex flex-1 items-start justify-center">
            <button type="button" onClick={() => setSheet('log')} aria-label="Log" data-tip="log"
              className="-mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-pop ring-4 ring-canvas active:scale-95">
              <Icon name="add" size={28} />
            </button>
          </div>
          <TabButton to="/plan" label="Plan" icon="flag" active={path === '/plan'} />
          <TabButton label="More" icon="menu" active={inMore || sheet === 'more'} onClick={() => setSheet('more')} />
        </div>
      </nav>
      <LogSheet open={sheet === 'log'} onClose={close} cardId={card?.id} />
      <MoreSheet open={sheet === 'more'} onClose={close} />
      <AccountSheet open={sheet === 'account'} onClose={close} />
      <AlertsSheet open={sheet === 'alerts'} onClose={close} />
    </div>
  );
}

// iPad portrait: icons with labels down the left edge, the account at the bottom
export function Rail() {
  const [account, setAccount] = useState(false);
  const items = [
    { to: '/', label: 'Overview', icon: 'space_dashboard' }, { to: '/cards', label: 'Cards', icon: 'credit_card' },
    { to: '/activity', label: 'Activity', icon: 'receipt_long' }, { to: '/plan', label: 'Plan', icon: 'flag' },
    { to: '/simulators', label: 'Simulators', icon: 'calculate' }, { to: '/spaces', label: 'Spaces', icon: 'savings' },
    { to: '/offers', label: 'Offers', icon: 'local_offer' }, { to: '/settings', label: 'Settings', icon: 'settings' }
  ];
  return (
    <aside className="flex h-full w-[84px] shrink-0 flex-col items-center border-r border-line bg-panel py-3">
      <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-serif text-[20px] font-semibold text-white">S</span>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => 'flex w-[72px] flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-semibold ' + (isActive ? 'text-ink' : 'text-faint')}>
            {({ isActive }) => (
              <>
                <span className={'flex h-8 w-12 items-center justify-center rounded-full ' + (isActive ? 'bg-brand/10 text-brand-ink' : '')}><Icon name={n.icon} fill={isActive} size={21} /></span>
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <button type="button" onClick={() => setAccount(true)} aria-label="Account" className="rounded-full"><Avatar size={38} /></button>
      <AccountSheet open={account} onClose={() => setAccount(false)} />
    </aside>
  );
}
