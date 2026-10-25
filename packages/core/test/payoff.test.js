// Payoff, minimum-payment and surcharge maths
// Ported from the Node checks that used to slice this code out of index.html; checks unchanged.
import { test, expect } from 'vitest';
import * as core from '../src/domain.js';

// The checks call the helpers by name, exactly as the app does
Object.assign(globalThis, core);

test('Payoff, minimum-payment and surcharge maths', () => {
  const failures = [];
  const check = (name, cond, extra) => { if (!cond) failures.push(name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); };
  // Independent model: pay p from the statement balance; whatever is left carries a month's interest
  const model = (B, apr, payFn) => { const r = apr / 1200; let b = B, m = 0, I = 0; while (b > 0.005 && m < 2000) { b -= Math.min(b, payFn(b)); m++; const i = b * r; I += i; b += i; } return { m, I }; };

  for (const [B, P, apr] of [[100000, 5000, 28], [42000, 4180, 28], [250000, 10000, 26], [500000, 12000, 28], [60000, 7000, 0]]) {
    const a = calcPayoff(B, P, apr), m = model(B, apr, () => P);
    check(`fixed ${P}/mo on ${B} at ${apr}%: ${a.months} mo, LKR ${a.totalInterest.toFixed(0)}`, a.months === m.m && Math.abs(a.totalInterest - m.I) < 1, m);
  }
  check('paying the full balance: 1 month, no interest', JSON.stringify(calcPayoff(200000, 200000, 26)) === JSON.stringify({ months: 1, totalInterest: 0 }));
  check('paying more than the balance: 1 month, no interest', calcPayoff(5000, 9000, 28).totalInterest === 0);
  check('payment that only just covers it still finishes correctly', (() => { const a = calcPayoff(30000, 29999, 28), m = model(30000, 28, () => 29999); return a.months === m.m && Math.abs(a.totalInterest - m.I) < 0.01; })());
  check('payment below the interest never clears', calcPayoff(100000, 2000, 28).months === Infinity);
  check('zero balance', calcPayoff(0, 5000, 28).months === 0);

  for (const [B, apr, pct, floor] of [[100000, 28, 0.04, 1000], [42000, 28, 0.04, 1000], [200000, 26, 0.04, 250], [500000, 28, 0.04, 1000], [20000, 0, 0.04, 1000], [800, 28, 0.04, 1000]]) {
    const a = window.calculateCBSLAmortization(B, apr, pct, floor), m = model(B, apr, (b) => Math.max(b * pct, floor));
    check(`minimum only on ${B} at ${apr}% (${pct * 100}%/${floor}): ${a.minMonths} mo, LKR ${a.minTotalInterest.toFixed(0)}`, a.minMonths === m.m && Math.abs(a.minTotalInterest - m.I) < 1, m);
    check(`  fixed plan LKR ${a.targetFixedPayment} clears in about a year (${a.fixedMonths} mo)`, a.fixedMonths <= 12 && a.fixedMonths >= (B < 12000 ? 1 : 9));
  }
  for (const [s, n, expect] of [[0.05, 12, 9.10], [0.12, 3, 70.65], [0.08, 24, 7.50], [0, 12, 0]]) {
    const r = calcSurchargeAPR(100000, s, n);
    check(`surcharge ${s * 100}% over ${n} mo: ${r.apr.toFixed(2)}% a year`, Math.abs(r.apr - expect) < 0.01, r.apr);
  }
  expect(failures).toEqual([]);
});
