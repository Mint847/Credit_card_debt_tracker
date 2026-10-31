// Phones and narrow iPads: entries as rows (category icon, what and where, amount) instead of a table
import { entryLabel, spendCategory } from '@serendib/core';
import { cardName } from '../lib/derive';
import { fmtAmt, shortDate } from '../lib/format';
import { categoryHex } from '../lib/colors';
import { CardDot, Icon } from './ui';
import { useLayout } from '../lib/layout';
import type { Card, Entry } from '../lib/types';

export function EntryList({ rows, onOpen, showCard = true }: { rows: { c: Card; e: Entry }[]; onOpen: (c: Card, e: Entry) => void; showCard?: boolean }) {
  const phone = useLayout() === 'phone';
  return (
    <ul className="border-t border-line">
      {rows.map(({ c, e }) => {
        const credit = e.type === 'payment' || e.type === 'refund' || (e.type === 'adjustment' && e.amount < 0);
        const cat = e.category ? spendCategory(e.category) : null;
        return (
          <li key={c.id + e.id} className="border-b border-line last:border-0">
            <button type="button" onClick={() => onOpen(c, e)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sunken phone:py-3.5">
              {/* Phones: the tile tinted with the category's colour */}
              <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl phone:h-10 phone:w-10 ' + (credit ? 'bg-ok/10 text-ok' : 'bg-sunken')}
                style={!credit && e.category ? { color: categoryHex(e.category), ...(phone ? { background: categoryHex(e.category) + '1f' } : {}) } : undefined}>
                <Icon name={credit ? (e.type === 'refund' ? 'undo' : 'payments') : cat?.icon || 'shopping_bag'} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-medium">{entryLabel(e)}</span>
                  {e.source === 'sms' && <span className="chip shrink-0 bg-sunken text-muted">SMS</span>}
                </span>
                <span className="flex items-center gap-1.5 truncate text-[12px] text-faint">
                  {showCard && <CardDot card={c} size={7} />}
                  <span className="truncate">{showCard ? cardName(c) + ' · ' : ''}{shortDate(e.date)}{cat && !showCard ? ' · ' + cat.label : ''}</span>
                </span>
              </span>
              <span className={'num shrink-0 text-[14px] font-semibold phone:font-bold ' + (credit ? 'text-ok' : '')}>{credit ? '−' : ''}{fmtAmt(Math.abs(e.amount))}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
