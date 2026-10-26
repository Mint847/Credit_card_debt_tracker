import { fmtLKR, parseYmd } from '@serendib/core';

// Whole rupees unless there are cents, as the phone app shows amounts
export function fmtAmt(n: number): string {
  return fmtLKR(n, Math.round(n * 100) % 100 ? 2 : 0);
}

// "LKR 1.2M" / "LKR 285K" for chart axes
export function fmtShort(n: number): string {
  if (Math.abs(n) >= 1e6) return 'LKR ' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1e3) return 'LKR ' + Math.round(n / 1e3) + 'K';
  return 'LKR ' + Math.round(n);
}

// "24 Oct"
export function shortDate(s: string): string {
  return parseYmd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// "Fri, 24 Oct 2026"
export function longDate(s: string): string {
  return parseYmd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function pct(n: number, dec = 0): string {
  return (isFinite(n) ? n : 0).toFixed(dec) + '%';
}
