// The home screen's payoff plan: cascade order, the minimums-only baseline and the never cases
import { test, expect } from 'vitest';
import { projectPlan } from '../src/plan.js';
import { calcPayoff } from '../src/domain.js';

const cards = [
  { id: 'a', balance: 100000, limit: 300000, apr: 28 },
  { id: 'b', balance: 40000, limit: 100000, apr: 24 },
  { id: 'z', balance: 0, limit: 50000, apr: 28 }
];

test('the budget clears everything, faster and cheaper than minimums', () => {
  const p = projectPlan(cards, 'avalanche', 30000);
  expect(p.months).toBeGreaterThan(4);
  expect(p.months).toBeLessThan(8);
  expect(p.curve[0]).toBe(140000);
  expect(p.curve[p.curve.length - 1]).toBeLessThan(0.02);
  expect(p.curve.length).toBe(p.months + 1);
  expect(p.baselineMonths).toBeGreaterThan(p.months);
  expect(p.baselineInterest).toBeGreaterThan(p.interest);
  expect(cards[0].balance).toBe(100000); // the cards themselves are not changed
});

test('one card on its own matches interest-first fixed payments', () => {
  const p = projectPlan([{ id: 'x', balance: 50000, limit: 100000, apr: 0 }], 'avalanche', 10000);
  expect(p.months).toBe(calcPayoff(50000, 10000, 0).months);
  expect(p.interest).toBe(0);
});

test('a budget below the minimums never clears', () => {
  expect(projectPlan(cards, 'snowball', 1500).months).toBe(Infinity);
});

test('snowball and avalanche cost different amounts of interest', () => {
  const av = projectPlan(cards, 'avalanche', 20000), sn = projectPlan(cards, 'snowball', 20000);
  expect(av.interest).toBeLessThanOrEqual(sn.interest);
});

import { strategySavings } from '../src/plan.js';
test('the Avalanche chip shows what it really saves over Snowball', () => {
  const cards = [{ id: 'a', balance: 200000, limit: 300000, apr: 28 }, { id: 'b', balance: 30000, limit: 100000, apr: 18 }];
  window.currentUserData = { income: '120000' };
  const s = strategySavings(cards);
  expect(s.amount % 100).toBe(0);
  expect(s.label).toMatch(/^(Save ~LKR [\d,]+|Same as Snowball)$/);
  expect(strategySavings([]).label).toBe('Saves the most interest');
  window.currentUserData = undefined;
});

import { monthsFromNow, monthYear, planDebtFree, cardDebtFreeDate } from '../src/plan.js';
import { shareText } from '../src/screen-rules.js';
test('debt-free months count from the 1st, so short months never roll over', () => {
  expect(monthYear(monthsFromNow(4, new Date(2026, 9, 31)))).toBe('Feb 2027');
  expect(monthYear(monthsFromNow(19, new Date(2026, 9, 29)))).toBe('May 2028');
  expect(monthsFromNow(Infinity)).toBe(null);
  expect(monthsFromNow(0)).toBe(null);
});

test('one debt-free date everywhere: the month-by-month plan', () => {
  window.currentUserData = { income: '100000' };
  const p = planDebtFree(cards, 'avalanche');
  const pr = projectPlan(cards, 'avalanche', 25000); // 25% of income
  expect(p.months).toBe(pr.months);
  expect(p.label).toBe(monthYear(monthsFromNow(pr.months)));
  // Each card clears no later than the whole plan; the pay-first card (highest APR) clears first
  expect(pr.clearedIn.a).toBeLessThanOrEqual(pr.clearedIn.b);
  expect(Math.max(pr.clearedIn.a, pr.clearedIn.b)).toBe(pr.months);
  expect(pr.clearedIn.z).toBeUndefined(); // already settled
  expect(planDebtFree([{ id: 'q', balance: 0, limit: 1 }]).label).toBe('--');
  window.currentUserData = { income: '1000' };
  expect(planDebtFree(cards, 'avalanche').label).toBe('Never');
  window.currentUserData = undefined;
});

test('share text: the card is debt-free when the plan clears it', () => {
  window.currentUserData = { income: '100000' };
  const b = cards[1];
  const d = cardDebtFreeDate(cards, b, 'avalanche');
  expect(monthYear(d)).toBe(monthYear(monthsFromNow(projectPlan(cards, 'avalanche', 25000).clearedIn.b)));
  expect(shareText(cards, b).endsWith(' On track to be debt-free by ' + monthYear(d) + '.')).toBe(true);
  window.currentUserData = undefined;
});
