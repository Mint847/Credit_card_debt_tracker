// "Verify your email" for email-and-password accounts (soft verification: the app works meanwhile).
// Resend has the phone's 60-second cooldown; dismissing hides it for this browser session.
import { useEffect, useState } from 'react';
import { needsEmailVerification } from '@serendib/core';
import { currentUser, useApp } from '../lib/store';
import { resendVerification, checkVerified } from '../lib/auth';
import { Icon, useToast } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
let cooldownUntil = 0;

export function VerifyActions() {
  const toast = useToast();
  const [, tick] = useState(0);
  const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex shrink-0 gap-2">
      <button type="button" className="btn h-8 bg-warn text-white hover:bg-warn/90 dark:text-canvas" onClick={async () => { const r = await checkVerified(); if (r.text) toast(r.text); tick((n) => n + 1); }}>I’ve verified</button>
      <button type="button" className="btn-outline h-8" disabled={left > 0} onClick={async () => {
        if (Date.now() < cooldownUntil) return;
        const m = await resendVerification();
        if (m.startsWith('Verification email sent')) cooldownUntil = Date.now() + 60000;
        if (m) toast(m);
        tick((n) => n + 1);
      }}>{left > 0 ? 'Resend in ' + left + 's' : 'Resend email'}</button>
    </div>
  );
}

export function VerifyBanner() {
  useApp();
  const u: any = currentUser();
  const [dismissed, setDismissed] = useState(() => { try { return !!u && sessionStorage.getItem('serendib_verify_dismissed') === u.uid; } catch (e) { return false; } });
  if (!needsEmailVerification(u) || dismissed) return null;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-warn/30 bg-warn/[0.07] px-5 py-3.5" role="status">
      <Icon name="mark_email_unread" className="text-warn" />
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="font-semibold">Verify your email</p>
        <p className="text-muted">We sent a link to <strong className="text-ink">{u.email}</strong>. Open it to confirm your account.</p>
      </div>
      <VerifyActions />
      <button type="button" aria-label="Dismiss verification reminder" className="btn-ghost h-8 w-8 justify-center px-0"
        onClick={() => { try { sessionStorage.setItem('serendib_verify_dismissed', u.uid); } catch (e) { /* storage blocked */ } setDismissed(true); }}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
