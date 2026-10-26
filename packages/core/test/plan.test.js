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
