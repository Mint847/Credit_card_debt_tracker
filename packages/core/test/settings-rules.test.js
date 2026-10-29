// Settings: sign-in methods, verification, delete-account messages, debt-to-income, restore wording, help texts
import { test, expect } from 'vitest';
import { primaryProvider, needsEmailVerification, deleteAccountError } from '../src/auth-rules.js';
import { debtToIncome } from '../src/screen-rules.js';
import { restoreMergeLine, restoreReplaceWarning, restoreDoneText, backupFileName, backupWhen } from '../src/backup-actions.js';
import { HELP_TEXTS } from '../src/help-texts.js';

test('sign-in method and verification', () => {
  expect(primaryProvider({ providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] })).toBe('password');
  expect(primaryProvider({ providerData: [{ providerId: 'apple.com' }] })).toBe('apple.com');
  expect(needsEmailVerification({ emailVerified: false, providerData: [{ providerId: 'password' }] })).toBe(true);
  expect(needsEmailVerification({ emailVerified: false, providerData: [{ providerId: 'google.com' }] })).toBe(false);
  expect(deleteAccountError({ code: 'auth/popup-closed-by-user' }, 'google.com')).toBe('Confirm with Google to delete your account.');
  expect(deleteAccountError({ code: 'auth/wrong-password' }, 'password')).toBe('Incorrect password.');
});

test('debt-to-income bands', () => {
  const cards = [{ balance: 100000, limit: 200000 }, { balance: 0, limit: 1 }];
  expect(debtToIncome(cards, '200000')).toMatchObject({ pct: '2.0', tone: 'ok' });
  expect(debtToIncome([{ balance: 1000000 }], '100000').tone).toBe('warn');
  expect(debtToIncome([{ balance: 2000000 }], '100000').tone).toBe('danger');
  expect(debtToIncome(cards, '').pct).toBe(0);
});

test('restore wording and help texts', () => {
  expect(restoreMergeLine([], [])).toBe('Everything in this backup is already here.');
  expect(restoreMergeLine([{}], [{}, {}])).toBe('Adds 1 card and 2 spaces you don’t have. Nothing else changes.');
  expect(restoreReplaceWarning([{ ledger: [] }], [])).toBe('This replaces your 1 card · 0 spaces · 0 entries. You can undo straight after.');
  expect(restoreDoneText('replace', [], [])).toBe('Backup restored');
  expect(backupFileName('2026-10-28')).toBe('serendib-backup-2026-10-28.json');
  expect(backupWhen('nope')).toBe('an unknown date');
  expect(Object.keys(HELP_TEXTS)).toEqual(['spaces_info', 'billing', 'apr', 'payoff', 'apr_profile', 'strategy_acceleration', 'min_pmt_profile', 'crib', 'surcharge_rules']);
});
