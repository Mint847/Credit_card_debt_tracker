// The opt-in beta: a PC that picked "Try the new desktop app" in the classic app's account menu opens
// /desktop/ from then on (index.html checks this flag before anything else loads). The choice is per
// device; going back to the classic view clears it.
export const DESKTOP_BETA_KEY = 'serendib_desktop_beta';

export function backToClassic() {
  try { localStorage.removeItem(DESKTOP_BETA_KEY); } catch { /* storage blocked: nothing to clear */ }
  window.location.href = '/';
}
