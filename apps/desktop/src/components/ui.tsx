// Small building blocks shared by every desktop screen
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cardTheme } from '../lib/derive';
import type { Card } from '../lib/types';

export function Icon({ name, className = '', fill = false, size }: { name: string; className?: string; fill?: boolean; size?: number }) {
  return (
    <span aria-hidden="true" className={'icon ' + (fill ? 'icon-fill ' : '') + className} style={size ? { fontSize: size } : undefined}>
      {name}
    </span>
  );
}

// The card's colour as a small dot, used wherever a card is named
export function CardDot({ card, size = 10 }: { card: Card; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: cardTheme(card).hex }} />;
}

// A card's colour tile with the card icon (lists and table rows)
export function CardTile({ card, size = 32 }: { card: Card; size?: number }) {
  const t = cardTheme(card);
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-lg" style={{ width: size, height: size, background: t.soft, color: t.hex }}>
      <Icon name="credit_card" size={Math.round(size * 0.55)} />
    </span>
  );
}

const TONES = {
  ok: 'bg-ok/10 text-ok',
  warn: 'bg-warn/10 text-warn',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-brand/10 text-brand-ink',
  neutral: 'bg-sunken text-muted'
};
export type Tone = keyof typeof TONES;

export function Chip({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: string }) {
  return (
    <span className={'chip ' + TONES[tone]}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

// Utilisation bar: healthy under 30%, watch to 75%, high above
export function UtilBar({ value, className = '' }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = value >= 75 ? 'bg-danger' : value >= 30 ? 'bg-warn' : 'bg-ok';
  return (
    <div className={'h-1.5 w-full overflow-hidden rounded-full bg-sunken ' + className}>
      <div className={'h-full rounded-full ' + color} style={{ width: v + '%' }} />
    </div>
  );
}

export function Tip({ label, children, side = 'top' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Tooltip.Root delayDuration={250}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={6} className="z-50 rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-canvas shadow-pop">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// Phone sections the user has folded away, remembered on this device
const FOLD_KEY = 'serendib_folded';
function foldedNow(): string[] {
  try { return JSON.parse(localStorage.getItem(FOLD_KEY) || '[]'); } catch (e) { return []; }
}
function useFold(id: string | undefined) {
  const [shut, setShut] = useState(() => !!id && foldedNow().includes(id));
  const toggle = useCallback(() => {
    if (!id) return;
    setShut((s) => {
      const rest = foldedNow().filter((x) => x !== id);
      try { localStorage.setItem(FOLD_KEY, JSON.stringify(s ? rest : [...rest, id])); } catch (e) { /* storage blocked */ }
      return !s;
    });
  }, [id]);
  return [shut, toggle] as const;
}

// fold: the header collapses and expands the panel (the summary shows while it's folded)
export function Panel({ title, action, children, className = '', bodyClass = 'px-5 pb-5', tip, fold, summary }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; tip?: string; fold?: string; summary?: ReactNode }) {
  const [shut, toggle] = useFold(fold);
  if (fold) {
    const bodyId = 'fold-' + fold;
    // Folded panels in a grid row keep to their header instead of stretching to the row's height
    return (
      <section className={'panel ' + className + (shut ? ' self-start' : '')} data-tip={tip} data-fold={fold}>
        <div className={'panel-head gap-3 ' + (shut ? 'pb-4' : '')}>
          <button type="button" onClick={toggle} aria-expanded={!shut} aria-controls={bodyId}
            className="group -my-2.5 -ml-1.5 flex min-w-0 flex-1 items-center gap-1.5 py-2.5 pl-1.5 text-left">
            <Icon name="expand_more" size={20} className={'shrink-0 text-faint transition-transform duration-200 group-hover:text-ink ' + (shut ? '-rotate-90' : '')} />
            <h2 className="panel-title truncate">{title}</h2>
            {shut && summary && <span className="ml-auto shrink-0 text-[12px] text-faint">{summary}</span>}
          </button>
          {!shut && action}
        </div>
        <div id={bodyId} className={'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ' + (shut ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
          <div className={'min-h-0 overflow-hidden transition-[visibility] duration-200 ' + (shut ? 'invisible' : 'visible')}>
            <div className={bodyClass}>{children}</div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={'panel ' + className} data-tip={tip}>
      {(title || action) && (
        <div className="panel-head">
          <h2 className="panel-title">{title}</h2>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Empty({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-faint"><Icon name={icon} /></span>
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-xs text-[12px] text-faint">{body}</p>}
    </div>
  );
}

/* Toasts: bottom-right, one action (e.g. Undo) */
interface ToastItem { id: number; text: string; tone: 'info' | 'warn'; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(text: string, opts?: { tone?: 'info' | 'warn'; action?: ToastItem['action'] }) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const show = useCallback((text: string, opts: { tone?: 'info' | 'warn'; action?: ToastItem['action'] } = {}) => {
    const id = next.current++;
    setItems((l) => [...l.slice(-2), { id, text, tone: opts.tone || 'info', action: opts.action }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), opts.action ? 6000 : 3800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[360px] flex-col gap-2 phone:inset-x-3 phone:bottom-[calc(84px+env(safe-area-inset-bottom))] phone:w-auto" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-[13px] text-ink shadow-pop">
            <Icon name={t.tone === 'warn' ? 'warning' : 'check_circle'} className={t.tone === 'warn' ? 'text-warn' : 'text-brand-ink'} fill />
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button type="button" className="text-[13px] font-semibold text-brand-ink hover:underline"
                onClick={() => { t.action!.run(); setItems((l) => l.filter((x) => x.id !== t.id)); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// Segmented control (strategy, entry type, filters)
export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg bg-sunken p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={(size === 'sm' ? 'h-7 px-2.5 text-[12px] ' : 'h-8 px-3 text-[13px] ') + 'rounded-md font-semibold transition-colors ' +
            (value === o.value ? 'bg-panel text-ink shadow-card' : 'text-faint hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
