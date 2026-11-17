// Each bank's rules against its own published documents: the worked interest examples in their
// calculation guides, the fees and minimum payments in their tariffs. Figures are quoted from the
// documents (BOC, HNB, LOLC, NDB, NTB, Cargills); see the issuer table in domain.js for the sources.
import { test, expect } from 'vitest';
import {
  dayInterest, cycleInterest, cardFee, minPaymentFor, cardMinRule, cardTerms, cardIssuer, issuerApr, lateFeeText,
  calcCashAdvance, cardMonthlyInterest, calcPayoff, CYCLE_DAYS
} from '../src/domain.js';
import { addCard } from '../src/card-space-actions.js';

const card = (bank, extra) => Object.assign({ bank, balance: 0 }, extra);

test('interest: the lines printed in the banks’ worked examples', () => {
  // HNB: Rs. 100,200 x 28%/360 x 32 days = 2,493.87, and (100,200 - 10,000) x 28%/360 x 12 = 841.87
  expect(dayInterest(100200, 28, 32, 360)).toBeCloseTo(2493.87, 2);
  expect(dayInterest(90200, 28, 12, 360)).toBeCloseTo(841.87, 2);
  // HNB: Rs. 32,000 (purchase on 10 December) x 28%/360 x 22 days = 547.56
  expect(dayInterest(32000, 28, 22, 360)).toBeCloseTo(547.56, 2);
  // LOLC: Rs. 100,200 x 20%/365 x 23 days = 1,262.79; cash advance 100,000 x 20%/365 x 7 = 383.56
  expect(dayInterest(100200, 20, 23, 365)).toBeCloseTo(1262.79, 2);
  expect(dayInterest(100000, 20, 7, 365)).toBeCloseTo(383.56, 2);
  // NTB: LKR 50,000 x 24% x 36/365 = 1,183.56 and LKR 48,000 x 24% x 11/365 = 347.18
  expect(dayInterest(50000, 24, 36, 365)).toBeCloseTo(1183.56, 2);
  expect(dayInterest(48000, 24, 11, 365)).toBeCloseTo(347.18, 2);
  // BOC: 15,000 x 34% x 21/360 = 297.50 (its sample statement, from before the 28% cap)
  expect(dayInterest(15000, 34, 21, 360)).toBeCloseTo(297.5, 2);
});

test('a cycle with a part payment: the whole balance until the payment, then what is left', () => {
  // NTB's statement: 50,000 owed, 2,000 paid on 20 Apr, statement on 30 Apr. From the start of the cycle
  // (1 Apr) that's 19 days on 50,000 and 11 days on 48,000 (the days before 1 Apr are the purchase's own).
  const bank = dayInterest(50000, 24, 19, 365) + dayInterest(48000, 24, 11, 365);
  expect(cycleInterest(50000, 2000, 24, { basis: 365, payDay: 19, days: 30 })).toBeCloseTo(bank, 6);
  // Paying the whole statement balance by the due date costs nothing
  expect(cycleInterest(50000, 50000, 24, { basis: 365, payDay: 19 })).toBe(0);
  // Over an average month it is the bank's daily rate, not APR / 12
  expect(cycleInterest(100000, 0, 28, { basis: 360, payDay: 25 })).toBeCloseTo(100000 * 0.28 / 360 * CYCLE_DAYS, 6);
});

test('the day count each bank uses', () => {
  expect(cardTerms(card('HNB')).basis).toBe(360);
  expect(cardTerms(card('Bank of Ceylon')).basis).toBe(360);
  expect(cardTerms(card("People's Bank")).basis).toBe(360);
  expect(cardTerms(card('LOLC Finance')).basis).toBe(365);
  expect(cardTerms(card('Nations Trust Bank')).basis).toBe(365);
  // Days to pay: the bank's own grace, or the card's billing cycle when it has one
  expect(cardTerms(card('HNB')).payDay).toBe(25);
  expect(cardTerms(card('LOLC')).payDay).toBe(15);
  expect(cardTerms(card('HNB', { statementDay: 25, dueDay: 15 })).payDay).toBeCloseTo(15 + CYCLE_DAYS - 25, 6);
  expect(cardTerms(card('HNB', { statementDay: 1, dueDay: 22 })).payDay).toBe(21);
  // A month's interest on HNB: 100,000 x 28% / 360 x 30.4 days
  expect(cardMonthlyInterest(card('HNB', { balance: 100000, apr: 28 }))).toBeCloseTo(2365.74, 2);
  // Cash advances: daily from the withdrawal on the bank's day count
  expect(calcCashAdvance(15000, 30, card('HNB', { apr: 28 })).interest).toBeCloseTo(350, 6);
  expect(calcCashAdvance(15000, 30, card('LOLC', { apr: 28.5 })).interest).toBeCloseTo(15000 * 0.285 * 30 / 365, 6);
});

test('cash-advance fees from the tariffs', () => {
  // HNB: 4% of the withdrawal, no minimum
  expect(cardFee(card('HNB'), 15000)).toBe(600);
  expect(cardFee(card('HNB'), 5000)).toBe(200);
  // BOC: 4% or Rs. 300, whichever is higher (its example: 600 on 15,000)
  expect(cardFee(card('BOC'), 15000)).toBe(600);
  expect(cardFee(card('BOC'), 5000)).toBe(300);
  // LOLC: Rs 500 or 6% of the transaction value, whichever is higher
  expect(cardFee(card('LOLC'), 5000)).toBe(500);
  expect(cardFee(card('LOLC'), 100000)).toBe(6000);
  // NDB: LKR 1,200 + 5% on face value; Cargills: Rs. 990 + 5%
  expect(cardFee(card('NDB Bank'), 50000)).toBe(3700);
  expect(cardFee(card('Cargills Bank'), 50000)).toBe(3490);
});

test('minimum payments from the banks’ statements and tariffs', () => {
  // HNB: 3,006.00 due on a 100,200.00 statement
  expect(minPaymentFor(card('HNB', { balance: 100200 }))).toBeCloseTo(3006, 6);
  // BOC: 5% of the amount or Rs 500, whichever is higher
  expect(minPaymentFor(card('BOC', { balance: 100000 }))).toBe(5000);
  expect(minPaymentFor(card('BOC', { balance: 8000 }))).toBe(500);
  expect(minPaymentFor(card('BOC', { balance: 300 }))).toBe(300); // under Rs 500: the full amount
  // NTB: 2,940.00 due on 73,500.00, and at least LKR 250
  expect(minPaymentFor(card('Nations Trust Bank', { balance: 73500 }))).toBeCloseTo(2940, 6);
  expect(minPaymentFor(card('Nations Trust Bank', { balance: 3000 }))).toBe(250);
  // LOLC: 4% of the total outstanding or Rs. 100, whichever is higher
  expect(minPaymentFor(card('LOLC', { balance: 100200 }))).toBeCloseTo(4008, 6);
  expect(minPaymentFor(card('LOLC', { balance: 1500 }))).toBe(100);
  // Read live from the bank, so cards saved with the old rule get the corrected one
  expect(cardMinRule({ bank: 'HNB', issuer: 'hnb', minPct: 0.04, minFloor: 1000 })).toEqual({ pct: 0.03, floor: 1000 });
  // A bank the app doesn't know keeps the rule saved with the card
  expect(cardMinRule({ bank: 'My Credit Union', issuer: null, minPct: 0.05, minFloor: 2000 })).toEqual({ pct: 0.05, floor: 2000 });
});

test('rates and late fees', () => {
  expect(issuerApr('lolc', 'Mastercard Gold')).toBe(28.5);
  expect(issuerApr('lolc', 'Mastercard Pulse')).toBe(29);
  expect(issuerApr('lolc', 'Savi World')).toBe(29);
  expect(issuerApr('hnb', 'Visa Gold')).toBe(28);
  expect(cardIssuer(card('Cargills Bank')).apr).toBe(26);
  const cards = [];
  expect(addCard(cards, { bank: 'LOLC Finance', nick: 'Savi Credit Card', limit: 100000, balance: 0, color: 'sky' }).card.apr).toBe(29);
  expect(lateFeeText(card('HNB'))).toBe('0.75% of the opening balance or LKR 750, whichever is higher');
  expect(lateFeeText(card('NDB'))).toBe('0.5% of the closing balance or LKR 2,100, whichever is higher');
  expect(lateFeeText(card('Nations Trust Bank'))).toBe('LKR 2,000');
  expect(lateFeeText(card('Sampath Bank'))).toBe('');
});

test('payoff on HNB’s terms matches a day-by-day statement model', () => {
  // Independent model: each month, the statement balance accrues at 28%/360 for 25 days until the payment
  // lands on the due date, then the rest accrues for the remaining days of the month
  let b = 100000, months = 0, total = 0;
  while (b > 0.005 && months < 600) {
    months++;
    if (b <= 10000 + 0.005) break;
    const i = b * 0.28 / 360 * 25 + (b - 10000) * 0.28 / 360 * (365 / 12 - 25);
    total += i; b = b - 10000 + i;
  }
  const bank = calcPayoff(100000, 10000, 28, cardTerms(card('HNB')));
  expect(bank.months).toBe(months);
  expect(bank.totalInterest).toBeCloseTo(total, 6);
  // More than APR / 12 on what's left: the 10,000 paid keeps accruing until the due date
  expect(bank.totalInterest).toBeGreaterThan(calcPayoff(100000, 10000, 28).totalInterest);
});
