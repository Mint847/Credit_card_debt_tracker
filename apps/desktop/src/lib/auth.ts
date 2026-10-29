// Signing in: the phone app's steps, with its rules and messages from the shared core (auth-rules.js).
// Each function resolves to an error message to show, or null.
import { authErrorMessage, isQuietAuthError, shouldRedirectAfter, signupFormError } from '@serendib/core';
import { auth, firebase } from './firebase';
import { setPendingName } from './store';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Provider = 'Google' | 'Apple' | 'X';

export function keepSignedIn(): boolean {
  try { return localStorage.getItem('serendib_keep_signed_in') !== 'false'; } catch (e) { return true; }
}
export function setKeepSignedIn(on: boolean) {
  try { localStorage.setItem('serendib_keep_signed_in', on ? 'true' : 'false'); } catch (e) { /* storage blocked */ }
}
// "Keep me signed in" decides whether the session survives closing the tab
function applyPersistence(): Promise<void> {
  const P = firebase.auth.Auth.Persistence;
  return auth.setPersistence(keepSignedIn() ? P.LOCAL : P.SESSION).catch(() => {});
}

function providerFor(name: Provider): any {
  if (name === 'Google') {
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  }
  if (name === 'Apple') {
    const p = new firebase.auth.OAuthProvider('apple.com');
    p.addScope('email');
    p.addScope('name');
    return p;
  }
  return new firebase.auth.TwitterAuthProvider();
}

// One flow for log in and sign up: the account is loaded, or created, once signed in
export async function socialSignIn(name: Provider): Promise<string | null> {
  if (!auth) return 'Sign-in isn’t available right now.';
  const provider = providerFor(name);
  try {
    await applyPersistence();
    await auth.signInWithPopup(provider);
    return null;
  } catch (err: any) {
    if (isQuietAuthError(err)) return null;
    // Pop-ups that can't open fall back to a full-page redirect
    if (shouldRedirectAfter(err)) {
      try { await auth.signInWithRedirect(provider); return null; } catch (e2) { return authErrorMessage(e2, name); }
    }
    return authErrorMessage(err, name);
  }
}

export async function emailLogin(email: string, password: string): Promise<string | null> {
  if (!email.trim() || !password) return 'Enter your email and password.';
  if (!auth) return 'Sign-in isn’t available right now.';
  try {
    await applyPersistence();
    await auth.signInWithEmailAndPassword(email.trim(), password);
    return null;
  } catch (err) {
    return authErrorMessage(err);
  }
}

export interface SignupForm { firstName: string; lastName: string; email: string; password: string; confirm: string }

// Returns null when the account was created, otherwise { field, message, rules }
export async function emailSignup(f: SignupForm): Promise<{ field: string | null; message: string; rules?: boolean } | null> {
  const form = { ...f, firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim() };
  const problem = signupFormError(form);
  if (problem) return problem;
  if (!auth) return { field: null, message: 'Sign-in isn’t available right now.' };
  setPendingName({ firstName: form.firstName, lastName: form.lastName });
  try {
    await applyPersistence();
    const cred = await auth.createUserWithEmailAndPassword(form.email, form.password);
    // Soft verification: the app is usable while the link is pending
    cred.user.sendEmailVerification().catch((e: any) => console.warn('Verification email not sent:', e && e.message));
    return null;
  } catch (err) {
    setPendingName(null);
    return { field: null, message: authErrorMessage(err) };
  }
}

// Unknown emails aren't revealed (email-enumeration protection), so there's no "not found" case
export async function sendReset(email: string): Promise<string | null> {
  if (!email.trim()) return 'Enter your email address.';
  if (!auth) return 'Sign-in isn’t available right now.';
  try {
    await auth.sendPasswordResetEmail(email.trim());
    return null;
  } catch (err) {
    return authErrorMessage(err);
  }
}

// Errors from a redirect sign-in (the pop-up fallback) show up when the page reloads
export function redirectError(): Promise<string | null> {
  if (!auth) return Promise.resolve(null);
  return auth.getRedirectResult().then(() => null, (err: any) => authErrorMessage(err));
}

/* Account (Settings) */
import { authErrorMessage as errText, primaryProvider, deleteAccountError } from '@serendib/core';
import { db } from './firebase';
import { pauseSaves } from './store';

// Change password: a reset link to the account's own email (no password typing in the app)
export async function sendOwnPasswordReset(): Promise<string> {
  const u = auth && auth.currentUser;
  if (!u || !u.email) return '';
  try { await auth.sendPasswordResetEmail(u.email); return 'We’ve sent a password reset link to ' + u.email; }
  catch (err) { return errText(err); }
}

export async function resendVerification(): Promise<string> {
  const u = auth && auth.currentUser;
  if (!u) return '';
  try { await u.sendEmailVerification(); return 'Verification email sent to ' + u.email; }
  catch (err) { return errText(err); }
}

export async function checkVerified(): Promise<{ text: string; verified: boolean }> {
  const u = auth && auth.currentUser;
  if (!u) return { text: '', verified: false };
  try {
    await u.reload();
    const ok = !!(auth.currentUser && auth.currentUser.emailVerified);
    return { text: ok ? 'Email verified. Thank you!' : 'Not verified yet. Open the link in the email we sent.', verified: ok };
  } catch (err) { return { text: errText(err), verified: false }; }
}

// Confirm identity first, so data is never removed while the account survives. Returns an error or null.
export async function deleteAccount(typed: string, password: string): Promise<string | null> {
  const u = auth && auth.currentUser;
  if (!u) return null;
  if (typed.trim() !== 'DELETE') return 'Type DELETE to confirm.';
  const prov = primaryProvider(u);
  try {
    if (prov === 'password') {
      if (!password) return 'Enter your password to confirm.';
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, password));
    } else {
      const provider = prov === 'google.com' ? new firebase.auth.GoogleAuthProvider()
        : prov === 'apple.com' ? new firebase.auth.OAuthProvider('apple.com') : new firebase.auth.TwitterAuthProvider();
      await u.reauthenticateWithPopup(provider);
    }
    pauseSaves(true); // no saves racing the delete
    await db.collection('users').doc(u.uid).delete();
    try { localStorage.removeItem('stitch_user_uid_' + u.uid); } catch (e) { /* storage blocked */ }
    await u.delete();
    return null;
  } catch (e) {
    // The account still exists, so let saves resume
    if (auth.currentUser) pauseSaves(false);
    return deleteAccountError(e, prov);
  }
}
