// Shared screen rules: amounts typed in, dates, budgets, CSV, share text, recurring hints
import { test, expect } from 'vitest';
import { parseAmountInput, shortDate, ordinal, budgetsFromInputs, ledgerCsv, ledgerCsvFileName, shareText, recurringStatusText, recurringDayHint, chargeNowDate, matchDiffText, targetRange } from '../src/screen-rules.js';

test('amounts, dates and ordinals as the phone shows them', () => {
  expect(parseAmountInput('LKR 12,500.505')).toBe(12500.51);
  expect(parseAmountInput('-300')).toBe(-300);
  expect(parseAmountInput('12a')).toBeNaN();
  expect(shortDate('2026-09-24')).toBe('24 Sep');
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 31].map(ordinal).join(' ')).toBe('1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 31st');
});

test('budgets: blanks clear, the first bad category is named', () => {
  expect(budgetsFromInputs({ dining: '15,000', fuel: ' ', groceries: '' })).toEqual({ budgets: { dining: 15000 } });
  expect(budgetsFromInputs({ dining: 'abc', fuel: '0' }).error).toBe('Enter a valid amount for Dining, or leave it blank.');
});

test('CSV guards formulas and names the file after the card', () => {
  const card = { bank: 'Sampath Bank', nick: 'Visa Gold', ledger: [{ id: 'a', date: '2026-10-02', type: 'purchase', amount: 500, merchant: '=HYPERLINK("x")', category: 'dining', source: 'manual' }] };
  const csv = ledgerCsv(card).split('\r\n');
  expect(csv[0]).toBe('"Date","Type","Amount (LKR)","Category","Merchant","Note","Source"');
  expect(csv[1]).toBe('"2026-10-02","purchase",500,"Dining","\'=HYPERLINK(""x"")","","manual"');
  expect(ledgerCsvFileName(card, '2026-10-28')).toBe('serendib-sampath-visa-gold-2026-10-28.csv');
});

test('share text has no amounts or banks', () => {
  const c = { id: 'a', bank: 'Sampath Bank', nick: 'Visa', balance: 50000, limit: 200000, apr: 28, ledger: [] };
  const t = shareText([c], c);
  expect(t.startsWith('My credit card progress on Serendib: 25% of my limit used.')).toBe(true);
  expect(t).not.toMatch(/LKR|Sampath|50,000/);
  expect(shareText([c], { ...c, balance: 0 })).toBe('My credit card progress on Serendib: this card is fully paid off.');
});

test('recurring hints and the match-statement line', () => {
  expect(recurringDayHint(31)).toBe('Logged on the 31st of each month, or the last day in shorter months.');
  expect(recurringDayHint('x')).toBe('');
  expect(chargeNowDate(5, new Date(2026, 9, 20))).toBe('2026-10-05');
  expect(chargeNowDate(25, new Date(2026, 9, 20))).toBe(null);
  expect(recurringStatusText({ paused: true }, '2026-10-20', null)).toBe('Paused. Nothing is logged until you resume it.');
  expect(recurringStatusText({ cancelled: true, endDate: '2026-10-01' }, '2026-10-20')).toBe('Cancelled on 1 Oct. Past charges stay in your history.');
  const f = (n) => 'LKR ' + n;
  expect(matchDiffText({ balance: 100 }, 150, f)).toBe('Adds LKR 50.');
  expect(matchDiffText({ balance: 100 }, 100, f)).toBe('Already matches.');
  expect(targetRange(4000.7, 100000)).toEqual({ min: 4000, max: 105001 });
});
