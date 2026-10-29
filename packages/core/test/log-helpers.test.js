// The log sheet's helpers
import { test, expect } from 'vitest';
import { merchantItems, defaultCategory, categoryForMerchant, overLimitWarning, paymentShortcuts } from '../src/ledger-actions.js';

const cards = [
  { id: 'a', ledger: [{ id: '1', date: '2026-10-01', type: 'purchase', merchant: 'Keells', category: 'groceries', createdAt: 1 },
    { id: '2', date: '2026-10-03', type: 'purchase', merchant: 'Netflix', category: 'subscriptions', source: 'recurring', createdAt: 5 }] },
  { id: 'b', ledger: [{ id: '3', date: '2026-10-02', type: 'purchase', merchant: 'Pizza Hut', category: 'dining', createdAt: 3 },
    { id: '4', date: '2026-10-04', type: 'purchase', merchant: 'keells ', category: 'groceries', createdAt: 2 }] }
];

test('merchants: this card first, no duplicates, no recurring', () => {
  expect(merchantItems(cards, 'b').map((m) => m.label)).toEqual(['keells ', 'Pizza Hut']);
  expect(merchantItems(cards, 'a').map((m) => m.label)).toEqual(['Keells', 'Pizza Hut']);
  expect(categoryForMerchant(cards, 'a', 'PIZZA HUT')).toBe('dining');
  expect(categoryForMerchant(cards, 'a', 'Unknown')).toBe(null);
});

test('default category is the last purchase you logged', () => {
  expect(defaultCategory(cards)).toBe('dining');
  expect(defaultCategory([])).toBe('groceries');
});

test('over-limit warning and payment shortcuts', () => {
  expect(overLimitWarning({ balance: 90, limit: 100 }, 'purchase', 20, null)).toBe('This takes the card over its LKR 100 limit.');
  expect(overLimitWarning({ balance: 90, limit: 100 }, 'purchase', 20, { applied: 15 })).toBe('');
  expect(overLimitWarning({ balance: 90, limit: 100 }, 'payment', 20, null)).toBe('');
  expect(paymentShortcuts({ balance: 5000 }, 5000, 2000)).toEqual([{ label: 'Due now', value: 5000 }, { label: 'Plan', value: 2000 }]);
  expect(paymentShortcuts({ balance: 0 }, 0, 0)).toEqual([]);
});

import { smsFill, logSavedText, SMS_HINT } from '../src/ledger-actions.js';
test('SMS read-back and the save toast', () => {
  expect(smsFill('  ', [], '2026-10-28')).toMatchObject({ empty: true, status: { text: SMS_HINT } });
  const f = smsFill('Your card ending 4821 was used for LKR 4,350.00 at KEELLS SUPER on 24/10/2026', [{ id: 'a', last4: '4821' }], '2026-10-28');
  expect(f).toMatchObject({ amount: 4350, cardId: 'a', fromSms: true });
  expect(f.status.text.startsWith('Filled amount')).toBe(true);
  expect(smsFill('Your card ending 9999 was used for LKR 100 at X', [], '2026-10-28').status.text).toMatch(/card ending 9999\. Add those digits in Edit Card/);
  expect(logSavedText('purchase', 4350, 'Keells', false, '')).toBe('Logged LKR 4,350 at Keells');
  expect(logSavedText('payment', 5000, '', true, '')).toBe('Entry updated');
  expect(logSavedText('refund', 100, '', false, 'Over budget')).toBe('Refund of LKR 100 logged. Over budget');
});
