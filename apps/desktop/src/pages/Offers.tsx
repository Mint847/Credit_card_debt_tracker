// Offers: this week's bank promotions, for your cards or every bank. The feed, matching, order and
// wording come from the shared core (offers.js), as on the phone.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { offersView, offerCardInfo, offerTerms, cardTheme } from '@serendib/core';
import { useApp } from '../lib/store';
import { useOffers, fetchOffers, isAdmin } from '../lib/offers';
import { Modal } from '../components/CardDialogs';
import { useCardDialogs } from '../components/CardDialogs';
import { CardDot, Icon, Segmented } from '../components/ui';
import type { Card } from '../lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Mode = 'my-cards' | 'explore';

function OfferCard({ offer, cards, onTerms }: { offer: any; cards: Card[]; onTerms: () => void }) {
  const info = offerCardInfo(offer, cards);
  const card: Card | null = info.match ? info.match.card : null;
  const t = card ? cardTheme(card) : null;
  return (
    <article className="panel flex flex-col gap-3 p-5 transition-shadow hover:shadow-pop phone:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={'truncate rounded-md px-2.5 py-1 text-[12px] font-bold ' + (t ? '' : 'bg-sunken text-ink')} style={t ? { background: t.soft, color: t.ink } : undefined}>{offer.bank}</span>
          <span title={info.category.label} className="shrink-0 text-faint"><Icon name={info.category.icon} size={16} /></span>
        </div>
        {info.urgency && (
          <span className={'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ' +
            (info.urgency.tone === 'today' ? 'border-danger/25 bg-danger/10 text-danger' : 'border-warn/25 bg-warn/10 text-warn')}>
            <Icon name={info.urgency.tone === 'today' ? 'bolt' : 'schedule'} size={14} />{info.urgency.text}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {offer.merchant && <p className="text-[11px] font-semibold uppercase tracking-wide text-faint phone:normal-case phone:tracking-normal">{offer.merchant}</p>}
        <h2 className="text-[16px] font-semibold leading-snug phone:text-[17px] phone:font-bold">{offer.headline}</h2>
        {offer.details && <p className="text-[13px] text-muted">{offer.details}</p>}
      </div>
      <div className="mt-auto space-y-1 text-[12px]">
        <p className="flex items-center gap-1.5 text-muted"><Icon name="credit_card" size={15} />{info.eligibility}</p>
        {info.matchLine && card && (
          <p className={'flex items-center gap-1.5 font-semibold ' + (info.match.certain ? 'text-ok' : 'text-warn')}>
            <Icon name={info.match.certain ? 'check_circle' : 'help'} size={15} /><CardDot card={card} size={8} />{info.matchLine}
          </p>
        )}
        {info.meta && <p className="flex items-center gap-1.5 text-muted"><Icon name="event" size={15} />{info.meta}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <button type="button" onClick={onTerms} className="flex items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline">Terms<Icon name="chevron_right" size={18} /></button>
        {offer.sourceUrl && (
          <a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-ink">View on bank site<Icon name="open_in_new" size={15} /></a>
        )}
      </div>
    </article>
  );
}

export function Offers() {
  const app = useApp();
  const data = useOffers();
  const navigate = useNavigate();
  const openDialog = useCardDialogs();
  const [mode, setMode] = useState<Mode>('my-cards');
  const [category, setCategory] = useState('all');
  const [bank, setBank] = useState('all');
  const [terms, setTerms] = useState<any>(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => { fetchOffers(); isAdmin().then(setAdmin); }, []);

  const view = useMemo(() => offersView({ offers: data.offers, cards: app.cards, mode, category, bank, updatedAt: data.updatedAt, samples: data.samples }), [data, app, mode, category, bank]);
  const t = terms ? offerTerms(terms) : null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-8 py-7 tablet:px-6 tablet:py-6 phone:space-y-4 phone:px-4 phone:py-5">
      <div className="flex items-end justify-between phone:flex-col phone:items-start phone:gap-3">
        <div>
          <h1 className="flex items-center gap-3 font-serif text-[30px] font-medium leading-tight tracking-tight phone:text-[27px]">
            Offers
            <span className={'rounded-full px-2.5 py-1 font-sans text-[12px] font-bold ' + (view.samples ? 'bg-sunken text-faint' : 'bg-ok/10 text-ok')}>{view.badge}</span>
          </h1>
          <p className="mt-1 text-[13px] text-faint">{view.title}{view.sub ? ' · ' + view.sub : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {admin && <button type="button" className="btn-outline" onClick={() => navigate('/offers/admin')}><Icon name="admin_panel_settings" size={18} />Manage offers</button>}
          <span data-tip="offers-mode"><Segmented value={mode} onChange={(m) => { setMode(m); setCategory('all'); }} options={[{ value: 'my-cards', label: 'My cards' }, { value: 'explore', label: 'Explore all' }]} /></span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-tip="offers-cats">
        {view.chips.map((c: any) => (
          <button key={c.key} type="button" aria-pressed={c.active} onClick={() => setCategory(c.key)}
            className={'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors phone:py-2 ' + (c.active ? 'border-brand/40 bg-brand/10 text-brand-ink phone:border-brand phone:bg-brand phone:text-white' : 'border-line bg-panel text-muted hover:bg-sunken phone:border-transparent phone:shadow-card')}>
            <Icon name={c.icon} size={16} />{c.label}<span className="text-[11px] opacity-70">{c.count}</span>
          </button>
        ))}
        {mode === 'explore' && (
          <select value={view.bank} onChange={(e) => setBank(e.target.value)} className="field ml-auto h-9 w-56 phone:ml-0 phone:w-full" aria-label="Bank">
            <option value="all">All banks</option>
            {view.banks.map((b: { key: string; name: string }) => <option key={b.key} value={b.key}>{b.name}</option>)}
          </select>
        )}
      </div>

      {view.samples && <p className="rounded-xl bg-sunken px-4 py-2.5 text-[12px] text-muted">Sample offers: live bank promotions will appear here once they are published.</p>}

      {view.empty ? (
        <div className="panel flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-faint"><Icon name={view.empty.icon} size={24} /></span>
          <p className="text-[15px] font-semibold">{view.empty.title}</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted">{view.empty.body}</p>
          <div className="mt-4 flex gap-2">
            {view.empty.kind === 'no-cards' && <>
              <button type="button" className="btn-primary" onClick={() => openDialog({ kind: 'add' })}>Add card</button>
              <button type="button" className="btn-outline" onClick={() => setMode('explore')}>Explore all</button>
            </>}
            {view.empty.allCategories && <button type="button" className="btn-outline" onClick={() => setCategory('all')}>All categories</button>}
            {view.empty.seeAllBanks && <button type="button" className="btn-primary" onClick={() => setMode('explore')}>See all banks</button>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 phone:grid-cols-1 phone:gap-3" data-tip="offers-list">
          {view.shown.map((o: any) => <OfferCard key={o.id} offer={o} cards={view.userCards} onTerms={() => setTerms(o)} />)}
        </div>
      )}

      <Modal open={!!t} onClose={() => setTerms(null)} title={t ? t.title : ''}>
        {t && (
          <>
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted">{t.body}</p>
            {t.link && <a href={t.link.href} target="_blank" rel="noopener noreferrer" className="btn-outline mt-5 inline-flex"><Icon name="open_in_new" size={16} />{t.link.label}</a>}
          </>
        )}
      </Modal>
    </div>
  );
}
