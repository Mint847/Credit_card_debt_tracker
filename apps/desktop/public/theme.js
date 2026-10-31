// Same theme choice as the phone app (shared on this device), applied before the first paint.
// A file rather than an inline script, so the page's Content Security Policy needs no inline scripts.
(function () {
  var mode = 'auto';
  try { var s = localStorage.getItem('serendib_theme'); if (s === 'light' || s === 'dark' || s === 'auto') mode = s; } catch (e) {}
  var dark = mode === 'dark' || (mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
