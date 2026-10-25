// Spending ledger actions: log, edit, delete/undo, payments from a space, warnings
import { test, expect } from 'vitest';
import { saveEntry, removeEntry, restoreEntry, logSystemEntry, afterBalanceChange, entryLabel, sortedLedger } from '../src/ledger-actions.js';
import { ymd, addDays } from '../src/domain.js';

const today = ymd(new Date());
const card = (over) => Object.assign({ id: 'c1', bank: 'Sampath Bank', nick: 'Visa', limit: 100000, balance: 10000, ledger: [] }, over);

test('rejects bad input without changing anything', () => {
  const c = card();
  expect(saveEntry(c, [], { type: 'purchase', amount: NaN, date: today }).error).toBe('Enter an amount.');
  expect(saveEntry(c, [], { type: 'purchase', amount: 0, date: today }).error).toBe('Enter an amount.');
  expect(saveEntry(c, [], { type: 'adjustment', amount: 0, date: today }).error).toBe('Enter an amount.');
  expect(saveEntry(c, [], { type: 'purchase', amount: 2e8, date: today }).error).toBe('That amount looks too large.');
  expect(saveEntry(c, [], { type: 'purchase', amount: 10, date: '2026-02-30' }).error).toBe('Pick a date.');
  expect(saveEntry(c, [], { type: 'purchase', amount: 10, date: addDays(today, 1) }).error).toBe('The date can’t be in the future.');
  expect(c.ledger.length).toBe(0);
  expect(c.balance).toBe(10000);
});

test('a purchase adds to the balance; a payment and a refund take it off', () => {
  const c = card();
  const p = saveEntry(c, [], { type: 'purchase', amount: 2500, date: today, merchant: '  Keells  ', category: 'groceries', note: 'weekly' });
  expect(p.entry.merchant).toBe('Keells');
  expect(p.entry.category).toBe('groceries');
  expect(p.entry.source).toBe('manual');
  expect(c.balance).toBe(12500);
  saveEntry(c, [], { type: 'payment', amount: 3000, date: today, merchant: 'ignored', category: 'groceries' });
  expect(c.balance).toBe(9500);
  expect(c.ledger[1].merchant).toBe('');
  expect(c.ledger[1].category).toBeUndefined();
  saveEntry(c, [], { type: 'refund', amount: 500, date: today, category: 'shopping', fromSms: true });
  expect(c.balance).toBe(9000);
  expect(c.ledger[2].source).toBe('sms');
});

test('one warning at most: over limit, then budget, then a utilisation step (once per period)', () => {
  const over = card({ limit: 5000, balance: 4900 });
  expect(saveEntry(over, [], { type: 'purchase', amount: 200, date: today, category: 'dining' }).warn).toBe('The card is now over its LKR 5,000 limit.');
  const bud = card({ budgets: { dining: 1000 } });
  expect(saveEntry(bud, [], { type: 'purchase', amount: 850, date: today, category: 'dining' }).warn).toBe('You’ve used 85% of your Dining budget.');
  expect(saveEntry(bud, [], { type: 'purchase', amount: 300, date: today, category: 'dining' }).warn).toBe('Dining is over its LKR 1,000 budget.');
  const util = card({ balance: 29000 });
  expect(saveEntry(util, [], { type: 'purchase', amount: 2000, date: today, category: 'other' }).warn).toBe('This card is now at 31% of its limit (aim for under 30%).');
  saveEntry(util, [], { type: 'payment', amount: 5000, date: today });
  expect(saveEntry(util, [], { type: 'purchase', amount: 5000, date: today, category: 'other' }).warn).toBe('');
});

test('editing an entry re-applies it; a missing one is reported', () => {
  const c = card();
  const id = saveEntry(c, [], { type: 'purchase', amount: 1000, date: today, category: 'dining' }).entry.id;
  const r = saveEntry(c, [], { type: 'purchase', amount: 400, date: today, category: 'fuel', editingId: id });
  expect(r.editing).toBe(true);
  expect(c.balance).toBe(10400);
  expect(c.ledger[0].category).toBe('fuel');
  expect(c.ledger[0].editedAt).toBeGreaterThan(0);
  expect(saveEntry(c, [], { type: 'purchase', amount: 1, date: today, editingId: 'nope' }).gone).toBe(true);
});

test('a payment made from a space: editing moves money, deleting puts it back, undo restores it', () => {
  const spaces = [{ id: 's1', name: 'Buffer', currentLKR: 4000, history: [] }];
  const c = card();
  const e = { id: 'e1', date: today, type: 'payment', amount: 1000, applied: -1000, spaceId: 's1', createdAt: 1 };
  c.ledger.push(e); c.balance -= 1000;
  spaces[0].history.push({ ledgerId: 'e1', amount: 1000, date: today, type: 'pay' });
  expect(saveEntry(c, spaces, { type: 'payment', amount: 6000, date: today, editingId: 'e1' }).error).toBe('Buffer only has LKR 4,000 left to cover this.');
  saveEntry(c, spaces, { type: 'payment', amount: 1500, date: today, editingId: 'e1' });
  expect(spaces[0].currentLKR).toBe(3500);
  expect(c.balance).toBe(8500);
  const removed = removeEntry(c, spaces, 'e1');
  expect(c.balance).toBe(10000);
  expect(spaces[0].currentLKR).toBe(5000);
  expect(spaces[0].history.length).toBe(0);
  restoreEntry(c, spaces, removed);
  expect(c.balance).toBe(8500);
  expect(spaces[0].currentLKR).toBe(3500);
  expect(c.ledger[0].id).toBe('e1');
});

test('helpers: system entries, target kept within the balance, labels, newest first', () => {
  const c = card({ targetPayment: 20000 });
  logSystemEntry(c, 'payment', 10000, 'Cleared');
  expect(c.balance).toBe(0);
  afterBalanceChange(c);
  expect(c.targetPayment).toBeUndefined();
  const d = card({ balance: 5000, targetPayment: 8000 });
  afterBalanceChange(d);
  expect(d.targetPayment).toBe(5000);
  expect(entryLabel({ type: 'purchase', category: 'dining' })).toBe('Dining');
  expect(entryLabel({ type: 'adjustment' })).toBe('Balance adjustment');
  const sorted = sortedLedger({ ledger: [{ id: 'a', date: '2026-01-01', createdAt: 1 }, { id: 'b', date: '2026-02-01', createdAt: 1 }, { id: 'c', date: '2026-02-01', createdAt: 5 }] });
  expect(sorted.map((x) => x.id)).toEqual(['c', 'b', 'a']);
});
