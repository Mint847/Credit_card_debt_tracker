// Sign-in rules and loading an account copy
import { test, expect } from 'vitest';
import { authErrorMessage, checkPasswordRules, passwordNeedsText, signupFormError, isQuietAuthError, shouldRedirectAfter } from '../src/auth-rules.js';
import { prepareAccount } from '../src/account.js';

test('friendly sign-in errors', () => {
  expect(authErrorMessage({ code: 'auth/wrong-password' })).toBe('Incorrect email or password.');
  expect(authErrorMessage({ code: 'auth/operation-not-allowed' }, 'Apple')).toBe("Apple sign-in isn't available yet. Use Google or email instead.");
  expect(authErrorMessage(null)).toBe('Something went wrong. Please try again.');
  expect(isQuietAuthError({ code: 'auth/popup-closed-by-user' })).toBe(true);
  expect(shouldRedirectAfter({ code: 'auth/popup-blocked' })).toBe(true);
});

test('password rules and the sign-up checks, in order', () => {
  expect(checkPasswordRules('Abcdef1!', 'Abcdef1!').isValid).toBe(true);
  expect(passwordNeedsText(checkPasswordRules('abc', 'abc'))).toBe('Your password needs at least 8 characters, an uppercase letter, a number, a symbol.');
  const f = { firstName: 'A', lastName: 'B', email: 'a@b.c', password: 'Abcdef1!', confirm: 'Abcdef1!' };
  expect(signupFormError(f)).toBe(null);
  expect(signupFormError({ ...f, lastName: '' }).message).toBe('Enter your first name, last name and email address.');
  expect(signupFormError({ ...f, password: '' }).field).toBe('password');
  expect(signupFormError({ ...f, confirm: 'x' }).message).toBe("Passwords don't match.");
  expect(signupFormError({ ...f, password: 'abcdefgh', confirm: 'abcdefgh' }).rules).toBe(true);
});

test('an account copy gets its defaults, a name and tidy cards', () => {
  const p = prepareAccount({ cards: [{ id: 'a', bank: 'Sampath Bank' }], spaces: [{ id: 1, currentLKR: 500 }] }, { displayName: 'Nimal de Silva', email: 'n@x.lk' });
  expect(p.data.firstName).toBe('Nimal');
  expect(p.data.lastName).toBe('de Silva');
  expect(p.data.defaults).toEqual({ firstName: true, income: true, strategy: true });
  expect(p.cards[0].apr).toBe(28);
  expect(p.cards[0].issuer).toBeTruthy();
  expect(Array.isArray(p.spaces[0].history)).toBe(true);
  expect(p.strategy).toBe('avalanche');
  expect(p.income).toBe('175000');
  expect(p.initials).toBe('ND');
  expect(prepareAccount({}, { email: 'kamal@x.lk' }).data.firstName).toBe('kamal');
  expect(prepareAccount(null, null).data.firstName).toBe('User');
  const kept = prepareAccount({ firstName: 'A', income: '9', strategy: 'snowball' }, null);
  expect(kept.data.defaults).toBeUndefined();
  expect(kept.strategy).toBe('snowball');
});
