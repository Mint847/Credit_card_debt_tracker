import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content Security Policy for the built app: scripts only from this site, Firebase (gstatic) and Google sign-in
// (apis.google.com); no inline scripts, plugins or <base> changes. Sign-in frames come from the app's own domain
// or firebaseapp.com. Built pages only: the dev server needs inline scripts for hot reload.
// (frame-ancestors can't be set in a meta tag; firebase.json sends it as a header.)
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://apis.google.com https://www.gstatic.com",
  "frame-src 'self' https://stitch-debt-manager.firebaseapp.com https://stitch-debt-manager.web.app https://apis.google.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');
const csp = (): Plugin => ({
  name: 'serendib-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="' + CSP + '" />')
});

// The desktop app is served from /desktop/ next to the phone and iPad app: it builds straight into the
// hosting folder (firebase.json rebuilds it before every deploy)
export default defineConfig({
  base: '/desktop/',
  plugins: [react(), csp()],
  build: { outDir: '../../stitch_fintech_credit_debt_manager/desktop', emptyOutDir: true, target: 'es2020' },
  server: { port: 5174 }
});
