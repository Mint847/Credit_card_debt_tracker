// The home alerts (the phone app's, from the core's homeAlerts) for the Overview panel and the bell
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeAlerts, ymd, HELP_TEXTS } from '@serendib/core';
import { useApp, notYetPaid } from '../lib/store';
import { cardName } from '../lib/derive';
import { fmtAmt } from '../lib/format';
import { CardDot, Icon } from './ui';
import { Modal } from './CardDialogs';
import { useCardDialogs } from './CardDialogs';
import { useWorkspace } from './Shell';
import type { Card } from '../lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STYLE: Record<string, { icon: string; chip: string; dot: string }> = {
  due: { icon: 'event', chip: 'bg-brand/10 text-brand-ink', dot: 'bg-brand/10 text-brand-ink' },
  ok: { icon: 'task_alt', chip: 'bg-ok/10 text-ok', dot: 'bg-ok/10 text-ok' },
  ask: { icon: 'help', chip: 'bg-sunken text-muted', dot: 'bg-sunken text-muted' },
  late: { icon: 'schedule', chip: 'bg-warn/10 text-warn', dot: 'bg-warn/10 text-warn' },
  critical: { icon: 'gpp_maybe', chip: 'bg-danger/10 text-danger', dot: 'bg-danger/10 text-danger' },
  budget: { icon: 'savings', chip: 'bg-danger/10 text-danger', dot: 'bg-danger/10 text-danger' },
  recurring: { icon: 'autorenew', chip: 'bg-brand/10 text-brand-ink', dot: 'bg-brand/10 text-brand-ink' },
  interest: { icon: 'trending_down', chip: 'bg-warn/10 text-warn', dot: 'bg-warn/10 text-warn' }
};

export function useAlerts() {
  const app = useApp();
  return useMemo(() => homeAlerts(app.cards, ymd(new Date()), fmtAmt), [app]);
}
// The phone's "N Attention" count: everything but "On track"
export function attentionCount(items: any[]) { return items.filter((a) => a.kind !== 'ontrack').length; }

export function AlertList({ compact }: { compact?: boolean }) {
  const items = useAlerts();
  const app = useApp();
  const navigate = useNavigate();
  const { openLog } = useWorkspace();
  const openDialog = useCardDialogs();
  const [help, setHelp] = useState<string | null>(null);
  const card = (id: string): Card | undefined => app.cards.find((c) => String(c.id) === String(id));
  if (!items.length) return <p className="px-3 py-6 text-center text-[13px] text-faint">You’re all caught up.</p>;
  const h = help ? (HELP_TEXTS as any)[help] : null;
  return (
    <>
      <ul className="space-y-1">
        {items.map((a: any) => {
          const st = STYLE[a.tone] || STYLE.due;
          return (
            <li key={a.kind} className={'flex gap-3 rounded-lg px-3 ' + (compact ? 'py-2.5' : 'py-3') + ' hover:bg-sunken'}>
              <span className={'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' + st.dot}><Icon name={st.icon} size={17} fill /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ' + st.chip}>{a.eyebrow}</span>
                  {a.date && <span className="text-[11px] font-semibold text-faint">{a.date}</span>}
                  {a.help && <button type="button" onClick={() => setHelp(a.help)} className="text-faint hover:text-ink" title="What is CRIB reporting?" aria-label="What is CRIB reporting?"><Icon name="info" size={15} /></button>}
                </div>
                <p className="mt-1 text-[13px] font-semibold">{a.title}</p>
                {a.kind === 'interest'
                  ? <p className="mt-0.5 text-[12px] text-muted"><span className="num text-[15px] font-bold text-warn">{fmtAmt(a.amount)}</span> <span className="ml-1 rounded bg-warn/10 px-1.5 py-0.5 text-[10px] font-semibold text-warn">{a.chip}</span></p>
                  : <p className="mt-0.5 text-[12px] leading-snug text-muted">{a.text}</p>}
                {(a.cards.length > 0 || a.action) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {a.cards.map((c: Card) => (
                      <button key={c.id} type="button" onClick={() => navigate('/cards/' + c.id)} className="flex items-center gap-1.5 text-[11px] text-faint hover:text-ink"><CardDot card={c} size={7} />{cardName(c)}</button>
                    ))}
                    {a.action && a.action.kind === 'ask' && (
                      <>
                        <button type="button" className="text-[12px] font-semibold text-brand-ink hover:underline" onClick={() => openLog({ type: 'payment', cardId: a.action.cardId, prefill: a.action.amount })}>Yes, log it</button>
                        <button type="button" className="text-[12px] font-semibold text-muted hover:underline" onClick={() => notYetPaid(a.action.cardId)}>Not yet</button>
                      </>
                    )}
                    {a.action && a.action.kind === 'log-payment' && (
                      <button type="button" className="text-[12px] font-semibold text-brand-ink hover:underline" onClick={() => openLog({ type: 'payment', cardId: a.action.cardId, prefill: a.action.amount })}>{a.action.label}</button>
                    )}
                    {a.action && a.action.kind === 'catch-up' && card(a.action.cardId) && (
                      <button type="button" className="text-[12px] font-semibold text-brand-ink hover:underline" onClick={() => openDialog({ kind: 'catchup', cardId: a.action.cardId })}>{a.action.label}</button>
                    )}
                    {a.action && a.action.kind === 'open-card' && (
                      <button type="button" className="text-[12px] font-semibold text-brand-ink hover:underline" onClick={() => navigate('/cards/' + a.action.cardId)}>{a.action.label}</button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Modal open={!!h} onClose={() => setHelp(null)} title={h ? h.title : ''}>
        {h && <>{h.body.map((b: any, i: number) => <p key={i} className="mb-3 text-[13px] leading-relaxed text-muted" dangerouslySetInnerHTML={{ __html: b.text || '' }} />)}</>}
      </Modal>
    </>
  );
}
