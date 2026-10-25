// Recurring charges, match-statement, cycles and plan amounts
import { test, expect } from 'vitest';
import { saveRecurringItem, toggleRecurringPaused, cancelRecurringItem, uncancelRecurringItem, skipPostedCharges, runDueRecurring, matchStatement, initCycleTracking, amountDueNow, planAllocationFor } from '../src/recurring-actions.js';
import { ymd, addDays } from '../src/domain.js';

const now = new Date(), today = ymd(now);
const card = (over) => Object.assign({ id: 'c1', bank: 'Sampath Bank', nick: 'Visa', limit: 100000, balance: 10000, ledger: [], recurring: [] }, over);

test('validation messages, nothing saved', () => {
  const c = card();
  expect(saveRecurringItem(c, null, { name: ' ', amount: 100, day: 5 }).error).toBe('Enter a name, e.g. Netflix.');
  expect(saveRecurringItem(c, null, { name: 'Netflix', amount: 0, day: 5 }).error).toBe('Enter the monthly amount.');
  expect(saveRecurringItem(c, null, { name: 'Netflix', amount: 100, day: 32 }).error).toBe('Day of month must be between 1 and 31.');
  expect(saveRecurringItem(c, null, { name: 'Netflix', amount: 100, day: 5, end: addDays(today, -1) }).error).toBe('The end date can’t be in the past.');
  expect(c.recurring.length).toBe(0);
});

test('a charge for a day that has passed: charged now only when asked', () => {
  const day = 1;
  if (now.getDate() === 1) return; // the 1st hasn't passed on the 1st
  const asked = card(), skipped = card();
  const a = saveRecurringItem(asked, null, { name: 'Netflix', amount: 2990, day: day, category: 'subscriptions', chargeNow: () => true });
  expect(a.posted.length).toBe(1);
  expect(asked.balance).toBe(12990);
  const b = saveRecurringItem(skipped, null, { name: 'Netflix', amount: 2990, day: day, category: 'subscriptions', chargeNow: () => false });
  expect(b.posted.length).toBe(0);
  expect(b.item.startDate.slice(8)).toBe('01');
  expect(b.item.startDate > today).toBe(true);
});

test('edit, pause/resume, cancel/undo', () => {
  const c = card();
  const id = saveRecurringItem(c, null, { name: 'Gym', amount: 5000, day: 28, category: 'health', chargeNow: () => false }).item.id;
  const e = saveRecurringItem(c, id, { name: 'Gym+', amount: 5500, day: 28, category: 'health' });
  expect(e.editing).toBe(true);
  expect(c.recurring[0].name).toBe('Gym+');
  expect(saveRecurringItem(c, 'missing', { name: 'x', amount: 1, day: 1 }).gone).toBe(true);
  expect(toggleRecurringPaused(c, id).item.paused).toBe(true);
  const resumed = toggleRecurringPaused(c, id);
  expect(resumed.item.paused).toBe(false);
  expect(resumed.item.startDate).toBe(today);
  const cancel = cancelRecurringItem(c, id);
  expect(c.recurring[0].cancelled).toBe(true);
  expect(c.recurring[0].endDate).toBe(today);
  expect(uncancelRecurringItem(c, id, cancel.prevEnd)).toBe(true);
  expect(c.recurring[0].cancelled).toBe(false);
  expect(toggleRecurringPaused(c, 'nope')).toBe(null);
});

test('undoing posted charges removes them and skips those months', () => {
  if (now.getDate() === 1) return;
  const c = card();
  const res = saveRecurringItem(c, null, { name: 'Netflix', amount: 2990, day: 1, category: 'subscriptions', chargeNow: () => true });
  skipPostedCharges([c], [], res.posted);
  expect(c.balance).toBe(10000);
  expect(c.ledger.length).toBe(0);
  expect(c.recurring[0].skipped).toEqual([today.slice(0, 7)]);
  expect(runDueRecurring([c], today).posted.length).toBe(0);
});

test('match my statement', () => {
  const c = card();
  expect(matchStatement(c, NaN).error).toBe('Enter the balance shown on your statement.');
  expect(matchStatement(c, -5).error).toBe('Enter the balance shown on your statement.');
  expect(matchStatement(c, 10000).same).toBe(true);
  const r = matchStatement(c, 12345.67);
  expect(r.entry.type).toBe('adjustment');
  expect(r.entry.amount).toBe(2345.67);
  expect(c.balance).toBe(12345.67);
});

test('cycle tracking and amounts due', () => {
  const c = card({ statementDay: 5, dueDay: 25 });
  initCycleTracking(c, today);
  expect(typeof c.cycleTrackedFrom).toBe('string');
  const none = card({ statementDay: 5 });
  none.cycleTrackedFrom = 'x';
  initCycleTracking(none, today);
  expect(none.cycleTrackedFrom).toBeUndefined();
  expect(amountDueNow(card({ balance: 50000 }))).toBe(2000); // untracked: 4% minimum
  const a = card({ id: 'a', balance: 50000, apr: 28 }), b = card({ id: 'b', balance: 9000, apr: 26 });
  const total = planAllocationFor([a, b], a) + planAllocationFor([a, b], b);
  expect(total).toBeGreaterThan(0);
  expect(planAllocationFor([a, b], a)).toBeGreaterThan(planAllocationFor([a, b], b) - 1); // avalanche: highest APR first
});
