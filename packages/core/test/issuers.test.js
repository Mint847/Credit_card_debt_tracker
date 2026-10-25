// Bank matching, fees and tariffs
// Ported from the Node checks that used to slice this code out of index.html; checks unchanged.
import { test, expect } from 'vitest';
import * as core from '../src/domain.js';

// The checks call the helpers by name, exactly as the app does
Object.assign(globalThis, core);

test('Bank matching, fees and tariffs', () => {
  const failures = [];
  const check = (name, cond, extra) => { if (!cond) failures.push(name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); };

  // 1. Matching
  const cases = {
    'Commercial Bank of Ceylon': 'combank', 'Commercial Bank': 'combank', 'ComBank': 'combank',
    'American Express': 'ntb', 'Amex': 'ntb', 'HSBC': 'ntb', 'Nations Trust Bank': 'ntb', 'NTB': 'ntb',
    'BOC': 'boc', 'Bank of Ceylon': 'boc', 'Hatton National Bank': 'hnb', 'HNB': 'hnb',
    'Pan Asia Banking Corporation': 'pabc', 'Pan Asia Bank': 'pabc', "People's Bank": 'peoples',
    'Sampath': 'sampath', 'Seylan Bank': 'seylan', 'NDB Bank': 'ndb', 'DFCC': 'dfcc',
    'Union Bank of Colombo': 'union', 'Standard Chartered': 'dfcc', 'Cargills Bank': 'cargills', 'LOLC Finance': 'lolc', 'My Credit Union': null, 'Union Bank': 'union',
    'CDB (Citizens Development Business Finance)': 'cdb', 'Robocop Bank': null, '': null
  };
  Object.keys(cases).forEach(n => check('match "' + n + '"', resolveIssuer(n) === cases[n], resolveIssuer(n)));
  // every suggestion-list name resolves back to its own key
  Object.keys(SL_CARD_ISSUERS).filter(k => k !== 'default').forEach(k => check('name round-trips: ' + k, resolveIssuer(SL_CARD_ISSUERS[k].name) === k, resolveIssuer(SL_CARD_ISSUERS[k].name)));

  // 2. Fees, read live from the table
  check("People's fee on 50k = 2,000 (4%)", cardFee({ bank: "People's Bank" }, 50000) === 2000, cardFee({ bank: "People's Bank" }, 50000));
  check('ComBank fee on 50k = 2,250 (4.5%)', cardFee({ bank: 'Commercial Bank of Ceylon' }, 50000) === 2250);
  check('NTB fee on 50k = 3,750 (1,250 + 5%)', cardFee({ bank: 'American Express' }, 50000) === 3750);
  check('Seylan floor on 10k = 700', cardFee({ bank: 'Seylan' }, 10000) === 700);
  check('Standard Chartered now uses DFCC fee (5% / 1,250)', cardFee({ bank: 'Standard Chartered' }, 80000) === 4000);
  check('Unknown bank uses default 4% / 500', cardFee({ bank: 'Robocop Bank' }, 5000) === 500);
  check('stored issuer key wins over the name', cardFee({ bank: 'whatever', issuer: 'seylan' }, 10000) === 700);

  // 3. Cash-advance APR ignores 0% plans
  check('0% plan card: purchase APR 0', cardApr({ isZeroPercent: true, apr: 28 }) === 0);
  check('0% plan card: cash-advance APR 28', cashAdvanceApr({ isZeroPercent: true, apr: 28 }) === 28);
  check('old 0% card with apr 0 falls back to bank rate', cashAdvanceApr({ isZeroPercent: true, apr: 0, bank: 'NTB' }) === 26);

  // 4. Minimum rule
  const ntbCard = { balance: 5000, minPct: 0.04, minFloor: 250 };
  const legacy = { balance: 5000 };
  check('NTB minimum on 5,000 = 250', minPaymentFor(ntbCard) === 250, minPaymentFor(ntbCard));
  check('legacy card minimum on 5,000 = 1,000', minPaymentFor(legacy) === 1000);
  check('minimum never exceeds balance', minPaymentFor({ balance: 180, minPct: 0.04, minFloor: 250 }) === 180);
  const am = window.calculateCBSLAmortization(5000, 26, 0.04, 250);
  const amDefault = window.calculateCBSLAmortization(5000, 26);
  check('amortisation honours the card floor (lower floor = longer payoff)', am.minMonths > amDefault.minMonths, { ntb: am.minMonths, dflt: amDefault.minMonths });

  // 5. One cash-advance model
  const card = { bank: 'Seylan', apr: 28 };
  const r = calcCashAdvance(50000, 30, card);
  const expectInterest = 50000 * 0.28 / 365 * 30;
  check('fee 2,000 (4% of 50k)', r.advanceFee === 2000);
  check('simple daily interest on principal only', Math.abs(r.interest - expectInterest) < 1e-9, r.interest);
  check('total = principal + fee + interest', Math.abs(r.total - (50000 + 2000 + expectInterest)) < 1e-9);
  const rc = calcCashAdvance(50000, 30, null, { fee: 1234, apr: 20 });
  check('custom overrides used', rc.advanceFee === 1234 && Math.abs(rc.interest - 50000 * 0.2 / 365 * 30) < 1e-9);
  expect(failures).toEqual([]);
});
