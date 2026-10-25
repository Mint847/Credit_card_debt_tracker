// Spending ledger, periods, recurring charges, SMS parsing
// Ported from the Node checks that used to slice this code out of index.html; checks unchanged.
import { test, expect } from 'vitest';
import * as core from '../src/domain.js';

// The checks call the helpers by name, exactly as the app does
Object.assign(globalThis, core);

test('Spending ledger, periods, recurring charges, SMS parsing', () => {
  const failures = [];
  const check = (name, cond, extra) => { if (!cond) failures.push(name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); };
  const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);

  // 1. Periods
  check('stmt day 24, ref 25 Oct -> 25 Oct..24 Nov', eq(billingPeriod({ statementDay: 24 }, '2026-10-25'), { start: '2026-10-25', end: '2026-11-24', hasCycle: true }));
  check('stmt day 24, ref 24 Oct -> 25 Sep..24 Oct', eq(billingPeriod({ statementDay: 24 }, '2026-10-24'), { start: '2026-09-25', end: '2026-10-24', hasCycle: true }));
  check('stmt day 31 in Feb clamps', eq(billingPeriod({ statementDay: 31 }, '2026-02-10'), { start: '2026-02-01', end: '2026-02-28', hasCycle: true }), billingPeriod({ statementDay: 31 }, '2026-02-10'));
  check('stmt day 31, ref 1 Mar -> 1 Mar..31 Mar', eq(billingPeriod({ statementDay: 31 }, '2026-03-01'), { start: '2026-03-01', end: '2026-03-31', hasCycle: true }), billingPeriod({ statementDay: 31 }, '2026-03-01'));
  check('stmt day 5 in Jan, ref 3 Jan -> 6 Dec..5 Jan', eq(billingPeriod({ statementDay: 5 }, '2026-01-03'), { start: '2025-12-06', end: '2026-01-05', hasCycle: true }));
  check('no cycle -> calendar month', eq(billingPeriod({}, '2026-10-24'), { start: '2026-10-01', end: '2026-10-31', hasCycle: false }));

  // 2. Balance effects
  const c = { balance: 13450, limit: 100000 };
  const p = { type: 'purchase', amount: 5000 }; applyLedgerEffect(c, p, 1);
  check('purchase adds', c.balance === 18450);
  const pay = { type: 'payment', amount: 3000 }; applyLedgerEffect(c, pay, 1);
  check('payment subtracts', c.balance === 15450);
  const big = { type: 'payment', amount: 99999 }; applyLedgerEffect(c, big, 1);
  check('payment never below zero', c.balance === 0 && big.applied === -15450);
  applyLedgerEffect(c, big, -1);
  check('reversing restores exactly', c.balance === 15450);
  const adj = { type: 'adjustment', amount: -450.5 }; applyLedgerEffect(c, adj, 1);
  check('signed adjustment', c.balance === 14999.5, c.balance);
  const ref = { type: 'refund', amount: 999.5 }; applyLedgerEffect(c, ref, 1);
  check('refund subtracts', c.balance === 14000);

  // 3. Period summary
  const card = { statementDay: 24, ledger: [
    { date: '2026-10-25', type: 'purchase', amount: 5000, category: 'groceries', merchant: 'Keells' },
    { date: '2026-10-26', type: 'purchase', amount: 2000, category: 'groceries', merchant: 'keells ' },
    { date: '2026-10-27', type: 'refund', amount: 500, category: 'groceries', merchant: 'Keells' },
    { date: '2026-10-28', type: 'purchase', amount: 1200, category: 'dining', merchant: 'Pizza Hut' },
    { date: '2026-10-28', type: 'payment', amount: 3000 },
    { date: '2026-10-24', type: 'purchase', amount: 9999, category: 'dining' }
  ] };
  const s = periodSummary(card, billingPeriod(card, '2026-10-30'));
  check('spent = purchases - refunds in period', s.spent === 7700, s.spent);
  check('payments counted', s.payments === 3000);
  check('by category', s.byCat.groceries === 6500 && s.byCat.dining === 1200, s.byCat);
  check('merchants merged case-insensitively', s.topMerchants[0].name === 'Keells' && s.topMerchants[0].total === 6500, s.topMerchants);
  check('statement-day entry in previous period', periodSummary(card, billingPeriod(card, '2026-10-24')).spent === 9999);

  // 4. Recurring
  const net = { id: 'n1', name: 'Netflix', amount: 2990, category: 'subscriptions', day: 5, startDate: '2026-08-05', endDate: null, paused: false, skipped: [] };
  check('due dates Aug-Oct', eq(recurringDueDates(net, '2026-10-24'), ['2026-08-05', '2026-09-05', '2026-10-05']));
  const rc = { balance: 1000, recurring: [net] };
  const posted = postDueRecurringOnCard(rc, '2026-10-24');
  check('posts 3 entries once', posted.length === 3 && rc.ledger.length === 3 && rc.balance === 1000 + 3 * 2990);
  check('lastPosted = 2026-10', net.lastPosted === '2026-10');
  check('re-run posts nothing', postDueRecurringOnCard(rc, '2026-10-24').length === 0 && rc.ledger.length === 3);
  check('entry ids unique per month', rc.ledger.map(e => e.id).join() === 'rec_n1_2026-08,rec_n1_2026-09,rec_n1_2026-10');
  // Second device: same item state from before posting, but ledger already holds the entries (synced)
  const dev2 = JSON.parse(JSON.stringify(rc)); dev2.recurring[0].lastPosted = null;
  check('second device does not duplicate', postDueRecurringOnCard(dev2, '2026-10-24').length === 0 && dev2.ledger.length === 3);
  check('next due 5 Nov', recurringNextDue(net, '2026-10-24') === '2026-11-05');
  const skipped = Object.assign({}, net, { lastPosted: '2026-10', skipped: ['2026-11'] });
  check('skipped month is not posted and next due moves on', recurringDueDates(skipped, '2026-11-20').length === 0 && recurringNextDue(skipped, '2026-10-24') === '2026-12-05');
  const d31 = { id: 'g', amount: 5000, day: 31, startDate: '2026-11-01', skipped: [] };
  check('day 31 lands on 30 Nov', eq(recurringDueDates(d31, '2026-11-30'), ['2026-11-30']));
  check('paused posts nothing', recurringDueDates(Object.assign({}, net, { paused: true, lastPosted: null }), '2026-10-24').length === 0);
  check('ended stops', eq(recurringDueDates(Object.assign({}, net, { lastPosted: null, endDate: '2026-09-10' }), '2026-10-24'), ['2026-08-05', '2026-09-05']));
  check('ended -> no next due', recurringNextDue(Object.assign({}, net, { endDate: '2026-10-24' }), '2026-10-24') === null);
  check('start mid-month skips earlier day', eq(recurringDueDates({ id: 'x', amount: 1, day: 5, startDate: '2026-10-06', skipped: [] }, '2026-11-24'), ['2026-11-05']));
  check('next due before start date skipped', recurringNextDue({ id: 'x', amount: 1, day: 5, startDate: '2026-11-01' }, '2026-10-02') === '2026-11-05');

  // 5. Archive
  const ac = { ledger: [
    { date: '2024-09-03', type: 'purchase', amount: 100, category: 'dining' },
    { date: '2024-09-09', type: 'payment', amount: 40 },
    { date: '2024-10-01', type: 'purchase', amount: 7, category: 'other' }
  ] };
  check('archive moves entries older than 24 months', archiveOldLedger(ac, '2026-10-24') && ac.ledger.length === 1 && ac.ledgerArchive['2024-09'].spent === 100 && ac.ledgerArchive['2024-09'].payments === 40, ac);
  check('archive is a no-op when nothing is old', archiveOldLedger(ac, '2026-10-24') === false);

  // 6. SMS parsing
  const T = '2026-10-24';
  const sms = [
    ['Your Credit Card ending 4521 has been used for LKR 5,250.00 at KEELLS SUPER on 23/10/26.', { amount: 5250, merchant: 'KEELLS SUPER', date: '2026-10-23', type: 'purchase', last4: '4521' }],
    ['Transaction of Rs. 1,200.50 at PIZZA HUT COLOMBO on 2026-10-21 using card xx9876. Avl bal Rs 120,000', { amount: 1200.5, merchant: 'PIZZA HUT COLOMBO', date: '2026-10-21', last4: '9876' }],
    ['LKR 3,000.00 debited from your card ****1111 at Uber on 22 Oct', { amount: 3000, merchant: 'Uber', date: '2026-10-22', last4: '1111' }],
    ['Thank you for your payment of LKR 25,000.00 to your credit card ending 4521 on 20-10-2026', { amount: 25000, type: 'payment', date: '2026-10-20', merchant: '' }],
    ['Refund of LKR 999.00 from DARAZ credited to card ending 4521', { amount: 999, type: 'refund' }],
    ['USD 15.99 spent at NETFLIX.COM on card ending 4521', { amount: null, foreign: 'USD 15.99', merchant: 'NETFLIX.COM' }],
    ['රු. 750.00 at Cargills Food City on 24 Oct 2026', { amount: 750, merchant: 'Cargills Food City', date: '2026-10-24' }],
    ['Purchase LKR 100 at SHOP on 30/12/26', { date: '' }],
    ['hello there', { amount: null, merchant: '', date: '' }]
  ];
  sms.forEach(([text, want], i) => {
    const got = parseBankSms(text, T);
    const ok = Object.keys(want).every(k => got[k] === want[k]);
    check('sms ' + (i + 1), ok, ok ? undefined : got);
  });
  expect(failures).toEqual([]);
});
