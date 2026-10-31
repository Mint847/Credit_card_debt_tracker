// Activity: every card's entries in one table (the phone app's per-card spending history, together)
import { useApp } from '../lib/store';
import { fmtAmt } from '../lib/format';
import { spendingByCategory } from '../lib/derive';
import { ActivityTable } from '../components/ActivityTable';
import { Icon } from '../components/ui';
import { useWorkspace } from '../components/Shell';

export function Activity() {
  const app = useApp();
  const { openLog } = useWorkspace();
  const entries = app.cards.reduce((n, c) => n + (c.ledger || []).length, 0);
  const spend = spendingByCategory(app.cards);
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-8 py-7 tablet:px-6 tablet:py-6 phone:space-y-4 phone:px-4 phone:py-5">
      <div className="flex items-end justify-between phone:flex-col phone:items-stretch phone:gap-3">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight phone:text-[27px]">Activity</h1>
          <p className="mt-1 text-[13px] text-faint">{entries} entries across {app.cards.length} cards · {fmtAmt(spend.total)} spent this cycle</p>
        </div>
        <div className="flex gap-2 [&>button]:phone:flex-1 [&>button]:phone:justify-center">
          <button type="button" className="btn-outline" data-tip="paste-sms" onClick={() => openLog({ sms: true })}><Icon name="sms" size={18} />Paste SMS</button>
          <button type="button" className="btn-primary" onClick={() => openLog({ type: 'purchase' })}><Icon name="add" size={18} />Log an entry</button>
        </div>
      </div>
      <ActivityTable cards={app.cards} />
    </div>
  );
}
