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

// Where the last tap or click was, so a theme change can spread from it
let lastPointer: { x: number; y: number } | null = null;
window.addEventListener('pointerdown', (e) => { lastPointer = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });

export function setTheme(mode: ThemeMode) {
  try { localStorage.setItem('serendib_theme', mode); } catch (e) { /* storage blocked */ }
  const willBeDark = mode === 'dark' || (mode === 'auto' && !!(mq && mq.matches));
  // (older browsers don't have View Transitions; checked at run time)
  const start = (document as unknown as { startViewTransition?: (update: () => void) => { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> } }).startViewTransition;
  const still = !!mq && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A real change, with View Transitions available: the new theme spreads in a circle from the tap (index.css)
  if (willBeDark !== document.documentElement.classList.contains('dark') && start && !still) {
    const x = lastPointer ? lastPointer.x : innerWidth / 2, y = lastPointer ? lastPointer.y : innerHeight / 2;
    const root = document.documentElement.style;
    root.setProperty('--vt-x', x + 'px');
    root.setProperty('--vt-y', y + 'px');
    root.setProperty('--vt-r', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
    const vt = start.call(document, () => apply(mode));
    // (the browser cancels a transition if the window resizes mid-way; the theme is already switched, so that's fine)
    vt.ready.catch(() => {}); vt.updateCallbackDone.catch(() => {});
    vt.finished.catch(() => {}).then(() => ['--vt-x', '--vt-y', '--vt-r'].forEach((p) => root.removeProperty(p)));
    return;
  }
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
