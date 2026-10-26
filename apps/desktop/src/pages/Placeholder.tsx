// Screens that come in Phase 3: what each will hold, so the navigation can be tried end to end
import { Icon } from '../components/ui';

const PLANNED: Record<string, { icon: string; title: string; items: string[] }> = {
  activity: { icon: 'receipt_long', title: 'Activity', items: ['Every card’s entries in one table', 'Filter by card, type, category and date', 'Search, edit, delete with Undo', 'Export to CSV'] },
  plan: { icon: 'flag', title: 'Plan', items: ['This month’s allocation and the pay-first card', 'Avalanche / Snowball switch', 'Committed monthly targets per card', 'Log this month’s payment'] },
  simulators: { icon: 'calculate', title: 'Simulators', items: ['Payoff, cash advance and 0% surcharge for any card or a custom scenario', 'Side-by-side results and the same CBSL rules'] },
  spaces: { icon: 'savings', title: 'Spaces', items: ['Savings buffers with targets and dates', 'Add funds, use funds and pay a card from a space', 'History and monthly pace'] },
  offers: { icon: 'local_offer', title: 'Offers', items: ['This week’s card offers with filters', 'Offers matched to your cards', 'Admin review for new offers'] },
  settings: { icon: 'settings', title: 'Settings', items: ['Profile, income and debt-to-income', 'Strategy and appearance', 'CBSL rules', 'Backup, restore and safety copies', 'Account and sign-out'] }
};

export function Placeholder({ id }: { id: keyof typeof PLANNED }) {
  const p = PLANNED[id];
  return (
    <div className="mx-auto max-w-[720px] px-8 py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand-ink"><Icon name={p.icon} size={26} /></span>
      <h1 className="mt-5 font-serif text-[30px] font-medium tracking-tight">{p.title}</h1>
      <p className="mt-2 text-[14px] text-muted">This screen is built in Phase 3, after you’ve reviewed the prototype. It will have the same features as on your phone:</p>
      <ul className="mt-5 space-y-2.5">
        {p.items.map((i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px]"><Icon name="check" size={18} className="mt-0.5 text-brand-ink" />{i}</li>
        ))}
      </ul>
    </div>
  );
}
