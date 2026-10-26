// Light / Dark / Auto, shared with the phone app on this device (localStorage serendib_theme)
import { useSyncExternalStore } from 'react';
export type ThemeMode = 'light' | 'dark' | 'auto';

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function getTheme(): ThemeMode {
  try {
    const s = localStorage.getItem('serendib_theme');
    if (s === 'light' || s === 'dark' || s === 'auto') return s;
  } catch (e) { /* storage blocked */ }
  return 'auto';
}

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'auto' && !!(mq && mq.matches));
  document.documentElement.classList.toggle('dark', dark);
}

export function setTheme(mode: ThemeMode) {
  try { localStorage.setItem('serendib_theme', mode); } catch (e) { /* storage blocked */ }
  apply(mode);
}

if (mq) mq.addEventListener('change', () => { if (getTheme() === 'auto') apply('auto'); });

// Re-render when light/dark changes (charts need real colours: SVG attributes can't use CSS variables)
function subscribeDark(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
}
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribeDark, () => document.documentElement.classList.contains('dark'));
}

// A theme colour token (see index.css) as rgb(), for chart strokes and fills
export function token(name: string): string {
  return 'rgb(' + getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() + ')';
}
