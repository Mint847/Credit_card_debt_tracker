// Security regression tests (from the security audit): what the shared rules must keep refusing.
// Both apps render through these, so a regression here would reach every device.
import { test, expect } from 'vitest';
import { normalizeOffer } from '../src/offers.js';
import { readBackup, safeId } from '../src/domain.js';
import { authErrorMessage, checkPasswordRules } from '../src/auth-rules.js';

const XSS = '"\'><img src=x onerror=alert(1)>';
const backup = (cards, extra = {}) => ({ app: 'serendib', version: 1, exportedAt: '2026-10-31', profile: {}, cards, spaces: [], ...extra });

test('offer links: only https pages, never javascript:, data: or plain http', () => {
  // Given an offer from the public feed, when its link isn't https, then it's dropped
  for (const url of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://bank.lk/offer', '//evil.com']) {
    expect(normalizeOffer({ id: 'o', headline: 'H', sourceUrl: url }).sourceUrl).toBe('');
  }
  expect(normalizeOffer({ id: 'o', headline: 'H', sourceUrl: 'https://www.sampath.lk/offer' }).sourceUrl).toBe('https://www.sampath.lk/offer');
});

test('ids used in the page are reduced to letters, digits, _ and -', () => {
  // Given an id carrying markup, when it's cleaned, then nothing that can break out of an attribute is left
  expect(safeId(XSS)).toBe('imgsrcxonerroralert1');
  expect(safeId('a"b<c>d e/f\\g')).toBe('abcdefg');
  expect(safeId(null)).toBe('');
});

test('backup restore: card ids, colours and last-4 digits are rebuilt, not trusted', () => {
  // Given a backup file crafted with markup in its fields, when it's read, then the unsafe parts are gone
  const res = readBackup(backup([{ id: XSS, bank: 'Bank', nick: 'Visa', limit: 1000, balance: 10, color: XSS, last4: XSS, issuer: XSS }]));
  expect(res.ok).toBe(true);
  const c = res.data.cards[0];
  expect(c.id).toMatch(/^[\w-]+$/);
  expect(c.color).toBe('teal');
  expect(c.last4).toBeUndefined();
  expect(c.issuer).not.toBe(XSS);
});

test('backup restore: refuses files that aren’t Serendib backups or are too big', () => {
  expect(readBackup({ app: 'other', version: 1, cards: [] }).ok).toBe(false);
  expect(readBackup([]).ok).toBe(false);
  expect(readBackup(null).ok).toBe(false);
  const many = Array.from({ length: 51 }, (_, i) => ({ id: 'c' + i, bank: 'Bank', nick: 'N', limit: 1, balance: 0 }));
  expect(readBackup(backup(many)).ok).toBe(false);
  // A damaged card stops the whole restore rather than half-restoring
  expect(readBackup(backup([{ id: 'a', bank: '', nick: 'x', limit: 1, balance: 0 }])).ok).toBe(false);
});

test('sign-in errors don’t reveal whether an email has an account', () => {
  // Given a wrong password or an unknown email, then the message is the same
  const msg = authErrorMessage({ code: 'auth/wrong-password' });
  expect(authErrorMessage({ code: 'auth/user-not-found' })).toBe(msg);
  expect(authErrorMessage({ code: 'auth/invalid-credential' })).toBe(msg);
});

test('passwords need at least 8 characters (and the other rules)', () => {
  expect(checkPasswordRules('Ab1!xyz', 'Ab1!xyz').isValid).toBe(false);
  expect(checkPasswordRules('Ab1!wxyz', 'Ab1!wxyz').isValid).toBe(true);
  expect(checkPasswordRules('Ab1!wxyz', 'Ab1!wxyZ').isValid).toBe(false);
});
