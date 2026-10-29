// The Simulators screen's sandboxes
import { test, expect } from 'vitest';
import { simulateMinimum, simulateCashAdvance, simulateSurcharge, advanceFeeRule, simTime, simAmount } from '../src/simulators.js';
import { calculateCBSLAmortization } from '../src/domain.js';

test('minimum payment trap: custom scenario at the CBSL ceiling', () => {
  const s = simulateMinimum(250000, null);
  const r = calculateCBSLAmortization(250000, 28, 0.04, 1000);
  expect(s.apr).toBe(28);
  expect(s.aprNote).toBe('CBSL Statutory Ceiling');
  expect(s.minMonths).toBe(r.minMonths);
  expect(s.fixedTitle).toBe('IF PAYING FIXED LKR ' + new Intl.NumberFormat('en-LK').format(r.targetFixedPayment));
  expect(s.principalPct + s.interestPct).toBe(100);
  expect(s.speed).toMatch(/x faster payoff pace$/);
  expect(simulateMinimum(0, null).empty).toBe(true);
  expect(simulateMinimum(100000, { apr: 24, isZeroPercent: true, balance: 1 }).aprNote).toBe('0% plan rate');
});

test('cash advance: a bank’s fee, or a custom fee with the LKR 500 minimum', () => {
  const custom = simulateCashAdvance(10000, '30', null, { feePct: '3', apr: '28' });
  expect(custom.fee).toBe(500);
  expect(custom.total).toBeCloseTo(10000 + 500 + 10000 * 0.28 / 365 * 30, 6);
  expect(custom.sub2).toBe('Settled in 30 days');
  expect(simulateCashAdvance(10000, '1', null, {}).sub2).toBe('Settled in 1 day');
  expect(simulateCashAdvance(10000, 'x', null, {}).days).toBe(30);
  expect(advanceFeeRule({ bank: 'Sampath Bank' }).label).toMatch(/^(Min LKR|Plus flat LKR|Flat fee)/);
});

test('0% surcharge and formatting helpers', () => {
  const s = simulateSurcharge(150000, '6', '12');
  expect(s.hidden).toBe(9000);
  expect(s.insight).toBe('+6.0% total cost');
  expect(simulateSurcharge(0, 6, 12).empty).toBe(true);
  expect(simTime(27)).toBe('2 Yrs 3 Mo');
  expect(simTime(12)).toBe('1 Yr');
  expect(simAmount('LKR 1,250.50')).toBe(1250.5);
});

import { payoffStart, payoffPreset, cardPayoffSim, cardAdvanceSim } from '../src/simulators.js';
test('card page: payoff slider, presets and the headline', () => {
  const c = { balance: 100000, limit: 300000, apr: 28 };
  expect(payoffStart(c)).toEqual({ value: 10000, min: 4000, max: 105001 });
  expect(payoffStart({ ...c, targetPayment: 25000 }).value).toBe(25000);
  expect(payoffPreset(c, 'min')).toBe(4000);
  expect(payoffPreset(c, 'rec')).toBe(12000);
  expect(payoffPreset(c, 'half')).toBe(50000);
  expect(payoffPreset(c, 'full')).toBe(100000);
  const s = cardPayoffSim(c, 10000);
  expect(s.headline).toMatch(/^Pay LKR 6,000 more per month and be debt-free ~[\d.]+ years earlier!$/);
  expect(s.tag.startsWith('Save LKR ')).toBe(true);
  expect(cardPayoffSim(c, 100000).headline.startsWith('Clear your entire balance this month')).toBe(true);
  expect(cardPayoffSim(c, 2000).planDuration).toBe('Too low to pay down');
  expect(cardPayoffSim({ balance: 0 }, 0).headline).toBe('This card is fully paid off. Nothing to pay this month.');
});
test('card page: cash advance for 15, 30 and 60 days', () => {
  const r = cardAdvanceSim({ bank: 'Sampath Bank', apr: 28 }, 50000);
  expect(r.rows.map((x) => x.days)).toEqual([15, 30, 60]);
  expect(r.rows[2].total).toBeGreaterThan(r.rows[0].total);
  expect(r.effRate).toMatch(/% p\.a\.$/);
  expect(cardAdvanceSim({}, 0)).toBe(null);
});

import { cashPriceRequest } from '../src/simulators.js';
test('cash price request quotes the real cost', () => {
  expect(cashPriceRequest(100000, simulateSurcharge(100000, 3, 12))).toMatch(/^I’d like to pay the cash price of LKR 100,000\. The 0% plan adds a LKR 3,000 fee, which works out to about [\d.]+% a year\./);
  expect(cashPriceRequest(0, simulateSurcharge(0, 3, 12))).toBe('');
});
