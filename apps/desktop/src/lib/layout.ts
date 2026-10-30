// Which layout to draw: the desktop workspace, or the phone and iPad designs. The choice is set on
// <html data-layout="…">, so pages restyle with the phone: / tablet: / compact: Tailwind variants
// (tailwind.config.js) and the desktop classes stay the defaults.
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';

export type Layout = 'desktop' | 'tablet' | 'phone';

// A computer: a mouse or trackpad and a screen at least 1280 px wide, and not an iPad (which can report a
// trackpad and a Mac). The same test the phone app's index.html used to send computers here.
function isComputer() {
  const iPad = /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return !iPad && window.matchMedia('(hover: hover) and (pointer: fine)').matches && Math.max(screen.width, screen.height) >= 1280;
}

function compute(): Layout {
  // Computers keep the desktop workspace whatever the window size
  if (isComputer()) return 'desktop';
  const w = window.innerWidth;
  // A phone on its side stays a phone: its short side is under 500 px
  const phone = Math.min(screen.width, screen.height) < 500;
  return w >= 768 && !phone ? 'tablet' : 'phone';
}

let current = compute();
document.documentElement.dataset.layout = current;
const listeners = new Set<() => void>();
window.addEventListener('resize', () => {
  const next = compute();
  if (next === current) return;
  current = next;
  document.documentElement.dataset.layout = current;
  listeners.forEach((l) => l());
});

export function useLayout(): Layout {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}
export const layoutNow = () => current;

// Where a dialog sits: centred on desktop and iPad (narrower on iPad if needed), a bottom sheet on phones
export function dialogFrame(layout: Layout, width: number, top = '8vh', maxHeight = '84vh'): { className: string; style: CSSProperties } {
  if (layout === 'phone') {
    return {
      className: 'sheet-up scroll-thin fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] shadow-pop focus:outline-none',
      style: {}
    };
  }
  return {
    className: 'scroll-thin fixed left-1/2 z-50 -translate-x-1/2 overflow-y-auto rounded-2xl border border-line bg-panel shadow-pop focus:outline-none',
    style: { top, maxHeight, width: layout === 'tablet' ? Math.min(width, window.innerWidth - 48) : width }
  };
}

// The window width, kept up to date (iPads switch between portrait and landscape)
export function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}
