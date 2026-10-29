// Home alerts: order and wording, and the catch-up plan
import { test, expect } from 'vitest';
import { homeAlerts, catchUpPlan, answerNotYet } from '../src/home-alerts.js';
import { addDays, ymd } from '../src/domain.js';

const t = ymd(new Date());
// The month before a YYYY-MM-DD date, as YYYY-MM
const prevMonth = (d) => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0'); };
const f = (n) => 'LKR ' + Math.round(n).toLocaleString('en-US');
function overdueCard(days, answered) {
  const st = addDays(t, -days - 20), due = addDays(t, -days);
  return { id: 'o', bank: 'Sampath Bank', nick: 'Visa', balance: 50000, limit: 100000, apr: 28, statementDay: +st.slice(8), dueDay: +due.slice(8),
    statements: [{ date: st, due, balance: 50000, minDue: 2000, answered: answered ? 'no' : undefined }], ledger: [], recurring: [] };
}

test('check-in first, then overdue, then CRIB after 60 days', () => {
  expect(homeAlerts([overdueCard(5, false)], t, f).map((a) => a.kind)).toContain('ask');
  const late = homeAlerts([overdueCard(35, true)], t, f).find((a) => a.kind === 'overdue');
  expect(late.title).toBe('Payment overdue · 35 days');
  expect(late.text).toBe('Pay LKR 2,000 to catch up. At 30+ days a missed payment can be reported to CRIB.');
  const crib = homeAlerts([overdueCard(70, true)], t, f).find((a) => a.kind === 'crib');
  expect(crib.text).toBe('Sampath Visa is 70 days past due. 20 days before it’s classed as non-performing (90 days) and reported to CRIB.');
});

test('"Not yet" stops the check-in asking', () => {
  const c = overdueCard(5, false);
  expect(answerNotYet(c, t)).toBe(true);
  expect(c.statements[0].answered).toBe('no');
  expect(homeAlerts([c], t, f).map((a) => a.kind)).toContain('overdue');
});

test('over budget, due tomorrow, interest, and the order', () => {
  const c = { id: 'b', bank: 'HNB', nick: 'Gold', balance: 12000, limit: 100000, apr: 24, budgets: { dining: 1000 },
    ledger: [{ id: 'e', date: t, type: 'purchase', amount: 3000, category: 'dining' }],
    recurring: [{ id: 'r', name: 'Netflix', amount: 2200, day: +addDays(t, 1).slice(8), startDate: addDays(t, -40), category: 'subscriptions', lastPosted: prevMonth(addDays(t, 1)), skipped: [] }] };
  const items = homeAlerts([c], t, f);
  expect(items.map((a) => a.kind)).toEqual(['budget', 'recurring', 'interest']);
  expect(items[0].text).toBe('LKR 3,000 spent of a LKR 1,000 budget this period');
  expect(items[1].title).toBe('Recurring charge due tomorrow');
  expect(items[2].amount).toBeCloseTo(12000 * 0.24 / 12, 6);
});

test('catch-up plan', () => {
  const p = catchUpPlan(overdueCard(10, true), [overdueCard(10, true), { balance: 5, bank: 'X' }], t, f);
  expect(p.owed).toBe(2000);
  expect(p.banner.title.startsWith('LKR 2,000 overdue since ')).toBe(true);
  expect(p.steps.map((s) => s.n)).toEqual([1, 2, 3, 4]);
  expect(p.steps[3].body).toBe('1 other card has no billing cycle, so the app can’t warn you before they’re due.');
});
